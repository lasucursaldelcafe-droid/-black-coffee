const InventoryManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.INVENTORY) || [];
  },

  getByCoffeeId(coffeeId) {
    return this.getAll().find((i) => i.coffeeId === coffeeId);
  },

  update(coffeeId, changes, auditMeta = null) {
    const inventory = this.getAll();
    const index = inventory.findIndex((i) => i.coffeeId === coffeeId);

    if (index >= 0) {
      inventory[index] = { ...inventory[index], ...changes, lastUpdated: new Date().toISOString() };
    }

    Storage.set(STORAGE_KEYS.INVENTORY, inventory);

    if (auditMeta) {
      AuditLog.log(auditMeta.action, auditMeta.entity, auditMeta.details);
    }

    this.checkLowStock(coffeeId);
    return inventory[index];
  },

  addPurchase(coffeeId, kg, cost, supplierId = null) {
    const item = this.getByCoffeeId(coffeeId);
    const coffee = CoffeeManager.getById(coffeeId);
    if (!item || !coffee) return;

    const newKg = item.greenKg + kg;
    this.update(coffeeId, { greenKg: newKg }, {
      action: 'purchase',
      entity: coffee.name,
      details: { coffeeName: coffee.name, coffeeId, kg, costPerKg: cost, supplierId }
    });

    const purchases = Storage.get(STORAGE_KEYS.PURCHASES) || [];
    const session = Auth.getSession();
    purchases.push({
      id: Storage.generateId(),
      coffeeId,
      kg,
      costPerKg: cost,
      totalCost: kg * cost,
      supplierId: supplierId || null,
      userId: session?.userId,
      userName: session?.name,
      date: new Date().toISOString()
    });
    Storage.set(STORAGE_KEYS.PURCHASES, purchases);

    Notifications.add(`Compra registrada: ${kg}kg por ${session?.name || 'usuario'}`, 'success');
    EmailService.sendNotification('Nueva Compra de Café',
      `Se registró una compra de ${kg}kg de café por ${session?.name || 'usuario'}. Costo: ${formatCurrency(kg * cost)}`);
  },

  processRoasting(coffeeId, greenKg) {
    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    const item = this.getByCoffeeId(coffeeId);
    if (!item || item.greenKg < greenKg) {
      Toast.show('Stock insuficiente de café verde', 'danger');
      return;
    }

    const result = ProductionCosts.calculateGreenToRoasted(greenKg, coffee.state);
    this.update(coffeeId, {
      greenKg: item.greenKg - greenKg,
      roastedKg: item.roastedKg + result.roastedKg
    }, {
      action: 'roast',
      entity: coffee.name,
      details: {
        coffeeName: coffee.name,
        coffeeId,
        greenKg,
        roastedKg: result.roastedKg,
        mermaKg: greenKg - result.roastedKg
      }
    });

    Notifications.add(`Tostión completada: ${formatNumber(result.roastedKg)}kg tostado`, 'info');
    return result;
  },

  adjustStock(coffeeId, field, newValue, reason = '') {
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    if (!coffee || !item) return;

    if (!['greenKg', 'roastedKg'].includes(field)) {
      Toast.show('Campo de inventario no válido', 'danger');
      return;
    }

    const parsed = parseFloat(newValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      Toast.show('Ingrese una cantidad válida', 'danger');
      return;
    }

    const previousValue = item[field];
    if (parsed === previousValue) {
      Toast.show('El valor no ha cambiado', 'warning');
      return;
    }

    const fieldLabel = field === 'greenKg' ? 'Café verde' : 'Café tostado';
    this.update(coffeeId, { [field]: parsed }, {
      action: 'adjust',
      entity: coffee.name,
      details: {
        coffeeName: coffee.name,
        coffeeId,
        field: fieldLabel,
        previousValue: formatNumber(previousValue),
        newValue: formatNumber(parsed),
        reason
      }
    });

    Notifications.add(`Inventario ajustado: ${coffee.name} (${fieldLabel})`, 'info');
  },

  checkLowStock(coffeeId) {
    const item = this.getByCoffeeId(coffeeId);
    const coffee = CoffeeManager.getById(coffeeId);
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    if (item && coffee && item.greenKg <= (item.minStockKg || settings.lowStockThreshold)) {
      Notifications.add(
        `⚠️ Stock bajo: ${coffee.name} (${formatNumber(item.greenKg)}kg restantes)`,
        'warning'
      );
      EmailService.sendNotification('Alerta de Stock Bajo',
        `El café "${coffee.name}" tiene solo ${formatNumber(item.greenKg)}kg en inventario. Se recomienda realizar una nueva compra.`);
    }
  },

  checkAllLowStock() {
    const inventory = this.getAll();
    inventory.forEach((item) => this.checkLowStock(item.coffeeId));
  },

  renderDashboard(container) {
    const inventory = this.getAll();
    const coffees = CoffeeManager.getAll();

    if (inventory.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>Inventario vacío</h3>
          <p>Agrega cafés para comenzar a gestionar el inventario</p>
        </div>`;
      return;
    }

    const cardsHtml = inventory.map((item) => {
      const coffee = coffees.find((c) => c.id === item.coffeeId);
      if (!coffee) return '';

      const isLow = item.greenKg <= (item.minStockKg || 10);
      const mermaInfo = ProductionCosts.getMermaDetails(1, coffee.state);

      return `
        <div class="card inventory-card">
          <div class="card-header">
            <div>
              <div class="card-title">${coffee.name}</div>
              <span style="font-size:0.85rem;color:var(--text-muted)">${coffee.variety} · ${coffee.region}</span>
            </div>
            ${isLow ? '<span class="badge badge-danger">Stock Bajo</span>' : '<span class="badge badge-success">OK</span>'}
          </div>
          <div class="inventory-stats">
            <div>
              <div class="stat-label">Café Verde</div>
              <div class="stat-value inventory-stat">${formatNumber(item.greenKg)} kg</div>
            </div>
            <div>
              <div class="stat-label">Café Tostado</div>
              <div class="stat-value inventory-stat">${formatNumber(item.roastedKg)} kg</div>
            </div>
            <div>
              <div class="stat-label">Merma Total</div>
              <div class="stat-value inventory-stat">${mermaInfo.totalLossPercent}%</div>
            </div>
          </div>
          <div class="cost-breakdown" style="margin-bottom:16px">
            <h4 style="margin-bottom:8px;font-size:0.9rem">Mermas de Producción</h4>
            ${mermaInfo.details.map((d) => `
              <div class="cost-row">
                <span class="cost-label">${d.name} (${d.percent}%)</span>
                <span class="cost-value">-${formatNumber(d.lossKg * 100)}g por kg</span>
              </div>
            `).join('')}
          </div>
          <div class="action-buttons">
            <button class="btn btn-sm btn-primary" onclick="InventoryManager.showPurchaseForm('${coffee.id}')">Registrar Compra</button>
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showRoastForm('${coffee.id}')">Registrar Tostión</button>
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showAdjustForm('${coffee.id}')">Ajustar Stock</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="grid-auto inventory-grid">${cardsHtml}</div>
      <div class="section" style="margin-top:32px">
        <div class="section-header">
          <h3 class="section-title">Historial de Movimientos</h3>
          <span class="form-hint">Registro de quién realizó cada cambio</span>
        </div>
        <div class="card">
          <div id="inventory-audit-log"></div>
        </div>
      </div>
    `;

    AuditLog.renderLog(document.getElementById('inventory-audit-log'), { limit: 30 });
  },

  showPurchaseForm(coffeeId) {
    const coffee = CoffeeManager.getById(coffeeId);
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Compra - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="purchase">
      <div class="form-row">
        <div class="form-group">
          <label>Cantidad (kg)</label>
          <input type="number" class="form-control" id="inv-kg" step="0.1" required>
        </div>
        <div class="form-group">
          <label>Costo por Kg</label>
          <input type="number" class="form-control" id="inv-cost" value="${coffee.pricePerKg}">
        </div>
      </div>
      <div class="form-group">
        <label>Proveedor</label>
        <select class="form-control" id="inv-supplier">
          <option value="">Seleccionar...</option>
          ${SupplierManager.getAll().map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
    `;

    modal.classList.add('active');
  },

  showRoastForm(coffeeId) {
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Tostión - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="roast">
      <p style="margin-bottom:16px;color:var(--text-secondary)">Stock verde disponible: <strong>${formatNumber(item.greenKg)} kg</strong></p>
      <div class="form-group">
        <label>Cantidad a Tostar (kg verde)</label>
        <input type="number" class="form-control" id="inv-kg" step="0.1" max="${item.greenKg}" required>
      </div>
      <div id="roast-preview" style="margin-top:16px"></div>
    `;

    document.getElementById('inv-kg')?.addEventListener('input', (e) => {
      const kg = parseFloat(e.target.value);
      if (kg > 0) {
        const result = ProductionCosts.calculateGreenToRoasted(kg, coffee.state);
        document.getElementById('roast-preview').innerHTML = `
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Entrada</span><span>${formatNumber(kg)} kg verde</span></div>
            <div class="cost-row"><span class="cost-label">Salida estimada</span><span>${formatNumber(result.roastedKg)} kg tostado</span></div>
            <div class="cost-row"><span class="cost-label">Merma total</span><span>${formatNumber(kg - result.roastedKg)} kg</span></div>
          </div>`;
      }
    });

    modal.classList.add('active');
  },

  showAdjustForm(coffeeId) {
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Ajustar Stock - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="adjust">
      <p class="form-hint" style="margin-bottom:16px">Los ajustes quedan registrados con su usuario.</p>
      <div class="form-group">
        <label>Tipo de stock</label>
        <div class="selection-grid" id="inv-adjust-field">
          <button type="button" class="selection-btn active" data-value="greenKg">Café Verde (${formatNumber(item.greenKg)} kg)</button>
          <button type="button" class="selection-btn" data-value="roastedKg">Café Tostado (${formatNumber(item.roastedKg)} kg)</button>
        </div>
        <input type="hidden" id="inv-field" value="greenKg">
      </div>
      <div class="form-group">
        <label>Nueva cantidad (kg)</label>
        <input type="number" class="form-control" id="inv-new-value" step="0.1" min="0" required>
      </div>
      <div class="form-group">
        <label>Motivo del ajuste</label>
        <textarea class="form-control" id="inv-reason" rows="2" placeholder="Ej: Corrección por conteo físico, merma no registrada..."></textarea>
      </div>
    `;

    const fieldContainer = document.getElementById('inv-adjust-field');
    const fieldHidden = document.getElementById('inv-field');
    fieldContainer?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        fieldContainer.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        fieldHidden.value = btn.dataset.value;
        const current = btn.dataset.value === 'greenKg' ? item.greenKg : item.roastedKg;
        document.getElementById('inv-new-value').placeholder = `Actual: ${formatNumber(current)} kg`;
      });
    });
    document.getElementById('inv-new-value').placeholder = `Actual: ${formatNumber(item.greenKg)} kg`;

    modal.classList.add('active');
  },

  saveFromForm() {
    const action = document.getElementById('inv-action').value;
    const coffeeId = document.getElementById('inv-coffee-id').value;

    if (action === 'purchase') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      const cost = parseFloat(document.getElementById('inv-cost').value);
      const supplierId = document.getElementById('inv-supplier')?.value || null;
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      this.addPurchase(coffeeId, kg, cost, supplierId);
    } else if (action === 'roast') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      this.processRoasting(coffeeId, kg);
    } else if (action === 'adjust') {
      const field = document.getElementById('inv-field').value;
      const newValue = document.getElementById('inv-new-value').value;
      const reason = document.getElementById('inv-reason').value.trim();
      if (!newValue) {
        Toast.show('Ingrese la nueva cantidad', 'danger');
        return;
      }
      if (!reason) {
        Toast.show('Indique el motivo del ajuste', 'danger');
        return;
      }
      this.adjustStock(coffeeId, field, newValue, reason);
    }

    document.getElementById('inventory-modal').classList.remove('active');
    App.renderSection('inventory');
  }
};
