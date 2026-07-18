const InventoryManager = {
  _batchFilter: 'all',

  _setSaveButtonVisible(visible = true) {
    const btn = document.getElementById('save-inventory-btn');
    if (btn) btn.style.display = visible ? '' : 'none';
  },

  getProductionBatches(coffeeId = null) {
    const batches = Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES) || [];
    if (!coffeeId || coffeeId === 'all') return batches;
    return batches.filter((b) => b.coffeeId === coffeeId);
  },

  setBatchFilter(coffeeId) {
    this._batchFilter = coffeeId || 'all';
    App.renderSection('inventory');
  },

  formatBatchSteps(batch) {
    if (!batch.steps?.length) return 'Sin proveedores registrados';
    return batch.steps
      .map((s) => `${s.label}: ${s.supplierName || '—'}`)
      .join(' · ');
  },

  getSupplierSnapshot(supplierId) {
    const supplier = supplierId ? SupplierManager.getById(supplierId) : null;
    if (!supplier) {
      return { supplierId: null, supplierName: '—', invima: '', kimba: '', address: '', city: '' };
    }
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      invima: supplier.invima || '',
      kimba: supplier.kimba || '',
      address: supplier.address || '',
      city: supplier.city || '',
      department: supplier.department || supplier.region || ''
    };
  },
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

  addPurchase(coffeeId, kg, cost, supplierIds = {}) {
    const item = this.getByCoffeeId(coffeeId);
    const coffee = CoffeeManager.getById(coffeeId);
    if (!item || !coffee) return;

    const coffeeSupplierId = typeof supplierIds === 'string'
      ? supplierIds
      : (supplierIds.compra || supplierIds.coffee || null);
    const transportSupplierId = typeof supplierIds === 'object' ? (supplierIds.transporte || null) : null;

    const newKg = item.greenKg + kg;
    this.update(coffeeId, { greenKg: newKg }, {
      action: 'purchase',
      entity: coffee.name,
      details: {
        coffeeName: coffee.name,
        coffeeId,
        kg,
        costPerKg: cost,
        supplierId: coffeeSupplierId,
        supplierName: SupplierManager.getName(coffeeSupplierId),
        transportSupplierId,
        transportSupplierName: SupplierManager.getName(transportSupplierId)
      }
    });

    const purchases = Storage.get(STORAGE_KEYS.PURCHASES) || [];
    const session = Auth.getSession();
    purchases.push({
      id: Storage.generateId(),
      coffeeId,
      kg,
      costPerKg: cost,
      totalCost: kg * cost,
      supplierId: coffeeSupplierId,
      transportSupplierId,
      userId: session?.userId,
      userName: session?.name,
      date: new Date().toISOString()
    });
    Storage.set(STORAGE_KEYS.PURCHASES, purchases);

    Notifications.add(`Compra registrada: ${kg}kg por ${session?.name || 'usuario'}`, 'success', {
      section: 'inventory', entityId: coffeeId, action: 'purchase'
    });
    EmailService.sendNotification('Nueva Compra de Café',
      `Se registró una compra de ${kg}kg de café por ${session?.name || 'usuario'}. Costo: ${formatCurrency(kg * cost)}`);
  },

  processRoasting(coffeeId, greenKg, supplierId = null) {
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
        mermaKg: greenKg - result.roastedKg,
        supplierId,
        supplierName: SupplierManager.getName(supplierId)
      }
    });

    Notifications.add(`Tostión completada: ${formatNumber(result.roastedKg)}kg tostado`, 'info', {
      section: 'inventory', entityId: coffeeId, action: 'roast'
    });
    return result;
  },

  registerProductionBatch(coffeeId, greenKg, processSuppliers = {}) {
    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    const activeSteps = ProductionCosts.getActiveSteps({
      productionMode: 'full_pack',
      coffee,
      grindType: 'grano'
    });

    const result = this.processRoasting(coffeeId, greenKg, processSuppliers.tostion || null);
    if (!result) return;

    const steps = activeSteps.map((stepKey) => ({
      step: stepKey,
      label: getProcessSupplierLabel(stepKey),
      ...this.getSupplierSnapshot(processSuppliers[stepKey])
    }));

    const batches = Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES) || [];
    const session = Auth.getSession();
    batches.unshift({
      id: Storage.generateId(),
      coffeeId,
      coffeeName: coffee.name,
      greenKg,
      roastedKg: result.roastedKg,
      processSuppliers,
      steps,
      userId: session?.userId,
      userName: session?.name,
      createdAt: new Date().toISOString()
    });
    if (batches.length > 100) batches.length = 100;
    Storage.set(STORAGE_KEYS.PRODUCTION_BATCHES, batches);

    AuditLog.log('production_batch', coffee.name, {
      coffeeName: coffee.name,
      coffeeId,
      greenKg,
      roastedKg: result.roastedKg,
      steps
    });

    Notifications.add(`Lote de producción registrado: ${coffee.name}`, 'success', {
      section: 'inventory', entityId: coffeeId
    });
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

    Notifications.add(`Inventario ajustado: ${coffee.name} (${fieldLabel})`, 'info', {
      section: 'inventory', entityId: coffeeId
    });
  },

  checkLowStock(coffeeId) {
    const item = this.getByCoffeeId(coffeeId);
    const coffee = CoffeeManager.getById(coffeeId);
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    if (item && coffee && item.greenKg <= (item.minStockKg || settings.lowStockThreshold)) {
      Notifications.add(
        `⚠️ Stock bajo: ${coffee.name} (${formatNumber(item.greenKg)}kg restantes)`,
        'warning',
        { section: 'inventory', entityId: coffeeId, action: 'purchase' }
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
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showProductionBatchForm('${coffee.id}')">Lote con Proveedores</button>
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.setBatchFilter('${coffee.id}')">Ver Lotes</button>
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showAdjustForm('${coffee.id}')">Ajustar Stock</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="grid-auto inventory-grid">${cardsHtml}</div>
      <div class="section" style="margin-top:32px">
        <div class="section-header">
          <h3 class="section-title">Historial de Lotes de Producción</h3>
          <span class="form-hint">Proveedores por proceso en cada lote</span>
        </div>
        <div class="card">
          <div id="production-batch-history"></div>
        </div>
      </div>
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

    this.renderProductionHistory(document.getElementById('production-batch-history'));
    AuditLog.renderLog(document.getElementById('inventory-audit-log'), { limit: 30 });
  },

  renderProductionHistory(container) {
    if (!container) return;

    const coffees = CoffeeManager.getAll();
    const batches = this.getProductionBatches(this._batchFilter === 'all' ? null : this._batchFilter);

    const filterButtons = [
      ['all', 'Todos los cafés'],
      ...coffees.map((c) => [c.id, c.name])
    ];

    if (batches.length === 0) {
      container.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          ${filterButtons.map(([key, label]) => `
            <button type="button" class="btn btn-sm ${this._batchFilter === key ? 'btn-primary' : 'btn-secondary'}"
              onclick="InventoryManager.setBatchFilter('${key}')">${label}</button>
          `).join('')}
        </div>
        <div class="empty-state" style="padding:24px">
          <div class="empty-state-icon">⚙️</div>
          <h3>Sin lotes registrados</h3>
          <p>Use <strong>Lote con Proveedores</strong> en un café para registrar tostión y proveedores por proceso</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${filterButtons.map(([key, label]) => `
          <button type="button" class="btn btn-sm ${this._batchFilter === key ? 'btn-primary' : 'btn-secondary'}"
            onclick="InventoryManager.setBatchFilter('${key}')">${label}</button>
        `).join('')}
      </div>
      <div class="batch-history-list">
        ${batches.map((batch) => `
          <div class="batch-history-item" onclick="InventoryManager.showBatchDetail('${batch.id}')">
            <div class="batch-history-header">
              <div>
                <div class="batch-history-title">${batch.coffeeName}</div>
                <div class="batch-history-meta">
                  ${formatDateTime(batch.createdAt)} · ${batch.userName || 'Usuario'}
                </div>
              </div>
              <div class="batch-history-yield">
                <span class="batch-yield-in">${formatNumber(batch.greenKg)} kg verde</span>
                <span class="batch-yield-arrow">→</span>
                <span class="batch-yield-out">${formatNumber(batch.roastedKg)} kg tostado</span>
              </div>
            </div>
            <div class="batch-supplier-chips">
              ${(batch.steps || []).map((step) => `
                <span class="batch-supplier-chip ${step.supplierId ? '' : 'batch-supplier-chip--empty'}">
                  <strong>${step.label}</strong>
                  ${step.supplierName || 'Sin asignar'}
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  showBatchDetail(batchId) {
    const batches = Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES) || [];
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;

    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Lote — ${batch.coffeeName}`;
    this._setSaveButtonVisible(false);

    const mermaPct = batch.greenKg > 0
      ? formatNumber(((batch.greenKg - batch.roastedKg) / batch.greenKg) * 100, 1)
      : '0';

    document.getElementById('inventory-form').innerHTML = `
      <div class="cost-breakdown" style="margin-bottom:16px">
        <div class="cost-row"><span class="cost-label">Fecha</span><span>${formatDateTime(batch.createdAt)}</span></div>
        <div class="cost-row"><span class="cost-label">Registrado por</span><span>${batch.userName || '—'}</span></div>
        <div class="cost-row"><span class="cost-label">Entrada</span><span>${formatNumber(batch.greenKg)} kg verde</span></div>
        <div class="cost-row"><span class="cost-label">Salida</span><span>${formatNumber(batch.roastedKg)} kg tostado</span></div>
        <div class="cost-row"><span class="cost-label">Merma</span><span>${formatNumber(batch.greenKg - batch.roastedKg)} kg (${mermaPct}%)</span></div>
      </div>
      <h4 style="margin-bottom:12px;font-size:0.95rem">Proveedores por proceso</h4>
      ${(batch.steps || []).length ? (batch.steps || []).map((step) => `
        <div class="batch-detail-step">
          <div class="batch-detail-step-title">${step.label}</div>
          <div class="batch-detail-step-name">${step.supplierName || 'Sin proveedor asignado'}</div>
          ${step.address ? `<div class="form-hint" style="margin-top:4px">📍 ${step.address}${step.city ? `, ${step.city}` : ''}${step.department ? ` (${step.department})` : ''}</div>` : ''}
          <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
            ${step.invima ? `<span class="badge badge-success">INVIMA ${step.invima}</span>` : ''}
            ${step.kimba ? `<span class="badge badge-neutral">KIMBA ${step.kimba}</span>` : ''}
          </div>
        </div>
      `).join('') : '<p class="form-hint">No hay proveedores registrados en este lote</p>'}
    `;

    modal.classList.add('active');
  },

  showPurchaseForm(coffeeId) {
    this._setSaveButtonVisible(true);
    const coffee = CoffeeManager.getById(coffeeId);
    const defaults = ProductionCosts.get().defaultSuppliers || {};
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
        <label>Proveedor de Café</label>
        ${SupplierManager.renderSelect('compra', { id: 'inv-supplier-coffee', selectedId: defaults.compra || '' })}
      </div>
      <div class="form-group">
        <label>Proveedor Logístico (opcional)</label>
        ${SupplierManager.renderSelect('transporte', { id: 'inv-supplier-transport', selectedId: defaults.transporte || '', placeholder: 'Sin transporte externo...' })}
      </div>
    `;

    modal.classList.add('active');
  },

  showRoastForm(coffeeId) {
    this._setSaveButtonVisible(true);
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const defaults = ProductionCosts.get().defaultSuppliers || {};
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
      <div class="form-group">
        <label>Tostador</label>
        ${SupplierManager.renderSelect('tostion', { id: 'inv-supplier-roast', selectedId: defaults.tostion || '' })}
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

  showProductionBatchForm(coffeeId) {
    this._setSaveButtonVisible(true);
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const defaults = ProductionCosts.get().defaultSuppliers || {};
    const activeSteps = ProductionCosts.getActiveSteps({
      productionMode: 'full_pack',
      coffee,
      grindType: 'grano'
    });
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Lote de Producción - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="production_batch">
      <p class="form-hint" style="margin-bottom:16px">
        Registre el lote indicando qué proveedor realizó cada proceso. Stock verde: <strong>${formatNumber(item.greenKg)} kg</strong>
      </p>
      <div class="form-group">
        <label>Cantidad a procesar (kg verde)</label>
        <input type="number" class="form-control" id="inv-kg" step="0.1" max="${item.greenKg}" required>
      </div>
      <h4 style="margin:16px 0 8px;font-size:0.95rem;color:var(--text-secondary)">Proveedores por proceso</h4>
      ${activeSteps.map((stepKey) => `
        <div class="form-group">
          <label>${getProcessSupplierLabel(stepKey)}</label>
          ${SupplierManager.renderSelect(stepKey, {
            id: `inv-supplier-${stepKey}`,
            selectedId: defaults[stepKey] || ''
          })}
        </div>
      `).join('')}
      <div id="roast-preview" style="margin-top:16px"></div>
    `;

    document.getElementById('inv-kg')?.addEventListener('input', (e) => {
      const kg = parseFloat(e.target.value);
      if (kg > 0) {
        const result = ProductionCosts.calculateGreenToRoasted(kg, coffee.state, activeSteps);
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
    this._setSaveButtonVisible(true);
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
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      this.addPurchase(coffeeId, kg, cost, {
        compra: document.getElementById('inv-supplier-coffee')?.value || null,
        transporte: document.getElementById('inv-supplier-transport')?.value || null
      });
    } else if (action === 'roast') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      const supplierId = document.getElementById('inv-supplier-roast')?.value || null;
      this.processRoasting(coffeeId, kg, supplierId);
    } else if (action === 'production_batch') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      const coffee = CoffeeManager.getById(coffeeId);
      const activeSteps = ProductionCosts.getActiveSteps({
        productionMode: 'full_pack',
        coffee,
        grindType: 'grano'
      });
      const processSuppliers = {};
      activeSteps.forEach((stepKey) => {
        const el = document.getElementById(`inv-supplier-${stepKey}`);
        if (el?.value) processSuppliers[stepKey] = el.value;
      });
      this.registerProductionBatch(coffeeId, kg, processSuppliers);
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
