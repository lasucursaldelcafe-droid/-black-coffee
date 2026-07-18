const SalesManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.SALES) || [];
  },

  getById(id) {
    return this.getAll().find((s) => s.id === id);
  },

  calculateMetrics(coffee, packaging, quantity, unitPrice, options = {}) {
    const {
      productionMode = 'full_pack',
      labels = ['small'],
      grindType = 'grano',
      clientProvidesCoffee = false,
      maquilaSteps = []
    } = options;

    const unitCostData = ProductionCosts.calculateUnitCost(coffee, packaging, labels, {
      productionMode,
      maquilaSteps,
      clientProvidesCoffee,
      grindType
    });

    const unitCost = unitCostData.totalCost;
    const totalCost = unitCost * quantity;
    const totalRevenue = unitPrice * quantity;
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const roastedKgUsed = unitCostData.roastedKgNeeded * quantity;

    return {
      unitCost,
      totalCost,
      totalRevenue,
      profit,
      profitMargin,
      roastedKgUsed,
      costBreakdown: unitCostData
    };
  },

  save(sale) {
    const sales = this.getAll();
    const session = Auth.getSession();

    if (!sale.id) {
      sale.id = Storage.generateId();
      sale.createdAt = new Date().toISOString();
      sale.userId = session?.userId;
      sale.userName = session?.name || 'Usuario desconocido';
      if (!sale.soldAt) sale.soldAt = sale.createdAt;
      sales.push(sale);
    } else {
      const index = sales.findIndex((s) => s.id === sale.id);
      if (index >= 0) sales[index] = { ...sales[index], ...sale };
    }

    Storage.set(STORAGE_KEYS.SALES, sales);

    AuditLog.log('sale', sale.coffeeName, {
      coffeeName: sale.coffeeName,
      packaging: PACKAGING_SIZES[sale.packaging]?.label || sale.packaging,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      totalRevenue: sale.totalRevenue,
      profit: sale.profit,
      profitMargin: sale.profitMargin,
      soldBy: sale.userName,
      roastedKg: sale.roastedKgUsed
    });

    Notifications.add(
      `Venta registrada: ${sale.quantity} × ${PACKAGING_SIZES[sale.packaging]?.label || sale.packaging} por ${sale.userName}`,
      'success'
    );

    return sale;
  },

  registerSale(data) {
    const coffee = CoffeeManager.getById(data.coffeeId);
    if (!coffee) {
      Toast.show('Café no encontrado', 'danger');
      return null;
    }

    const metrics = this.calculateMetrics(
      coffee,
      data.packaging,
      data.quantity,
      data.unitPrice,
      data.costOptions || {}
    );

    const item = InventoryManager.getByCoffeeId(data.coffeeId);
    if (item && metrics.roastedKgUsed > item.roastedKg) {
      Toast.show(
        `Stock tostado insuficiente (disponible: ${formatNumber(item.roastedKg)} kg, necesario: ${formatNumber(metrics.roastedKgUsed)} kg)`,
        'danger'
      );
      return null;
    }

    const client = data.clientId ? ClientManager.getById(data.clientId) : null;
    const session = Auth.getSession();

    const sale = {
      coffeeId: data.coffeeId,
      coffeeName: coffee.name,
      clientId: client?.id || null,
      clientName: client?.name || data.clientName || 'Venta directa',
      packaging: data.packaging,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      totalRevenue: metrics.totalRevenue,
      unitCost: metrics.unitCost,
      totalCost: metrics.totalCost,
      profit: metrics.profit,
      profitMargin: metrics.profitMargin,
      roastedKgUsed: metrics.roastedKgUsed,
      productionMode: data.costOptions?.productionMode || 'full_pack',
      grindType: data.costOptions?.grindType || 'grano',
      labels: data.costOptions?.labels || ['small'],
      notes: data.notes || '',
      soldAt: data.soldAt || new Date().toISOString(),
      userId: session?.userId,
      userName: session?.name || 'Usuario desconocido'
    };

    this.save(sale);

    if (item) {
      InventoryManager.update(data.coffeeId, {
        roastedKg: Math.max(0, item.roastedKg - metrics.roastedKgUsed)
      });
    }

    return sale;
  },

  delete(id) {
    const sale = this.getById(id);
    if (!sale) return;

    const item = InventoryManager.getByCoffeeId(sale.coffeeId);
    if (item && sale.roastedKgUsed) {
      InventoryManager.update(sale.coffeeId, {
        roastedKg: item.roastedKg + sale.roastedKgUsed
      });
    }

    const sales = this.getAll().filter((s) => s.id !== id);
    Storage.set(STORAGE_KEYS.SALES, sales);

    AuditLog.log('delete_sale', sale.coffeeName, {
      coffeeName: sale.coffeeName,
      quantity: sale.quantity,
      totalRevenue: sale.totalRevenue
    });

    Notifications.add(`Venta eliminada: ${sale.coffeeName}`, 'warning');
  },

  confirmDelete(id) {
    const sale = this.getById(id);
    if (!sale) return;
    if (confirm(`¿Eliminar la venta de ${sale.quantity} × ${sale.coffeeName}? Esta acción no se puede deshacer.`)) {
      this.delete(id);
      App.renderSection('sales');
    }
  },

  getReportSummary(sales = null) {
    const list = sales || this.getAll();
    const totalRevenue = list.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalCost = list.reduce((sum, s) => sum + s.totalCost, 0);
    const totalProfit = list.reduce((sum, s) => sum + s.profit, 0);
    const totalUnits = list.reduce((sum, s) => sum + s.quantity, 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, totalProfit, totalUnits, avgMargin, count: list.length };
  },

  renderDashboard(container) {
    const sales = this.getAll().sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
    const summary = this.getReportSummary(sales);

    const summaryHtml = `
      <div class="grid-4 sales-summary" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-value">${summary.count}</div>
          <div class="stat-label">Ventas Registradas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(summary.totalRevenue)}</div>
          <div class="stat-label">Ingresos Totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${formatCurrency(summary.totalProfit)}</div>
          <div class="stat-label">Utilidad Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatNumber(summary.avgMargin, 1)}%</div>
          <div class="stat-label">Margen Promedio</div>
        </div>
      </div>
    `;

    if (sales.length === 0) {
      container.innerHTML = `
        ${summaryHtml}
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <h3>No hay ventas registradas</h3>
          <p>Registra tu primera venta para ver el informe de rentabilidad</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="SalesManager.showForm()">Registrar Venta</button>
        </div>`;
      return;
    }

    container.innerHTML = `
      ${summaryHtml}
      <div class="card">
        <div class="card-header">
          <span class="card-title">Informe de Rentabilidad</span>
          <span class="form-hint">Se actualiza al registrar cada venta</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Café</th>
                <th>Cliente</th>
                <th>Presentación</th>
                <th>Cant.</th>
                <th>P. Venta</th>
                <th>Costo</th>
                <th>Utilidad</th>
                <th>Margen</th>
                <th>Vendió</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${sales.map((s) => `
                <tr>
                  <td>${formatDateTime(s.soldAt)}</td>
                  <td><strong>${s.coffeeName}</strong></td>
                  <td>${s.clientName}</td>
                  <td>${PACKAGING_SIZES[s.packaging]?.label || s.packaging}</td>
                  <td>${s.quantity}</td>
                  <td>${formatCurrency(s.unitPrice)}</td>
                  <td>${formatCurrency(s.totalCost)}</td>
                  <td style="color:${s.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    <strong>${formatCurrency(s.profit)}</strong>
                  </td>
                  <td>
                    <span class="badge ${s.profitMargin >= 30 ? 'badge-success' : s.profitMargin >= 15 ? 'badge-warning' : 'badge-danger'}">
                      ${formatNumber(s.profitMargin, 1)}%
                    </span>
                  </td>
                  <td>${s.userName}</td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="SalesManager.confirmDelete('${s.id}')">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700;background:var(--bg-secondary)">
                <td colspan="5">Totales (${summary.count} ventas · ${summary.totalUnits} uds)</td>
                <td>${formatCurrency(summary.totalRevenue)}</td>
                <td>${formatCurrency(summary.totalCost)}</td>
                <td style="color:var(--success)">${formatCurrency(summary.totalProfit)}</td>
                <td>${formatNumber(summary.avgMargin, 1)}%</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  showForm(coffeeId = null, clientId = null) {
    const modal = document.getElementById('sales-modal');
    const coffees = CoffeeManager.getAll();
    const clients = ClientManager.getAll();
    const today = new Date().toISOString().split('T')[0];

    document.getElementById('sales-modal-title').textContent = 'Registrar Venta';
    document.getElementById('sales-form').innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Café</label>
          <select class="form-control" id="sale-coffee" required>
            <option value="">Seleccionar café...</option>
            ${coffees.map((c) => `<option value="${c.id}" ${c.id === coffeeId ? 'selected' : ''}>${c.name} - ${c.region}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Cliente (opcional)</label>
          <select class="form-control" id="sale-client">
            <option value="">Venta directa</option>
            ${clients.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Presentación</label>
        <div class="selection-grid" id="sale-packaging">
          ${Object.entries(PACKAGING_SIZES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === '250g' ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="sale-packaging-value" value="250g">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Cantidad vendida (unidades)</label>
          <input type="number" class="form-control" id="sale-quantity" value="1" min="1" step="1" required>
        </div>
        <div class="form-group">
          <label>Precio de venta por unidad (COP)</label>
          <input type="number" class="form-control" id="sale-unit-price" min="0" step="100" required placeholder="Precio al que se vendió">
        </div>
        <div class="form-group">
          <label>Fecha de venta</label>
          <input type="date" class="form-control" id="sale-date" value="${today}">
        </div>
      </div>

      <div class="form-group">
        <label>Preparación (para cálculo de costo)</label>
        <div class="selection-grid" id="sale-grind">
          ${Object.entries(GRIND_TYPES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === 'grano' ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="sale-grind-value" value="grano">
      </div>

      <div class="form-group">
        <label>Notas</label>
        <textarea class="form-control" id="sale-notes" rows="2" placeholder="Observaciones de la venta..."></textarea>
      </div>

      <div id="sale-preview-area"></div>
    `;

    this.bindFormEvents();
    this.updatePreview();
    modal.classList.add('active');
  },

  bindFormEvents() {
    this.bindSingleSelect('sale-packaging', 'sale-packaging-value');
    this.bindSingleSelect('sale-grind', 'sale-grind-value');

    ['sale-coffee', 'sale-quantity', 'sale-unit-price'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => this.updatePreview());
      document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    });
  },

  bindSingleSelect(containerId, hiddenId) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    if (!container || !hidden) return;

    container.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        hidden.value = btn.dataset.value;
        this.updatePreview();
      });
    });
  },

  getFormCostOptions() {
    return {
      productionMode: 'full_pack',
      labels: ['small'],
      grindType: document.getElementById('sale-grind-value')?.value || 'grano'
    };
  },

  updatePreview() {
    const preview = document.getElementById('sale-preview-area');
    const coffeeId = document.getElementById('sale-coffee')?.value;
    const packaging = document.getElementById('sale-packaging-value')?.value || '250g';
    const quantity = parseInt(document.getElementById('sale-quantity')?.value || '1', 10);
    const unitPrice = parseFloat(document.getElementById('sale-unit-price')?.value);

    if (!preview) return;

    if (!coffeeId || !unitPrice || unitPrice <= 0) {
      preview.innerHTML = '<p class="form-hint" style="margin-top:16px">Complete café y precio para ver rentabilidad estimada.</p>';
      return;
    }

    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    const metrics = this.calculateMetrics(coffee, packaging, quantity, unitPrice, this.getFormCostOptions());
    const marginClass = metrics.profitMargin >= 30 ? 'badge-success' : metrics.profitMargin >= 15 ? 'badge-warning' : 'badge-danger';

    preview.innerHTML = `
      <div class="cost-breakdown" style="margin-top:16px">
        <h4 style="margin-bottom:12px">Rentabilidad Estimada</h4>
        <div class="cost-row"><span class="cost-label">Costo unitario (Full Pack)</span><span>${formatCurrency(metrics.unitCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Costo total (${quantity} uds)</span><span>${formatCurrency(metrics.totalCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Ingreso total</span><span>${formatCurrency(metrics.totalRevenue)}</span></div>
        <div class="cost-row">
          <span class="cost-label">Utilidad</span>
          <span style="color:${metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(metrics.profit)}</span>
        </div>
        <div class="cost-row">
          <span class="cost-label">Margen de rentabilidad</span>
          <span class="badge ${marginClass}">${formatNumber(metrics.profitMargin, 1)}%</span>
        </div>
        <div class="cost-row"><span class="cost-label">Café tostado requerido</span><span>${formatNumber(metrics.roastedKgUsed, 3)} kg</span></div>
        <p class="form-hint" style="margin-top:8px">Vendedor: ${Auth.getSession()?.name || 'Usuario actual'}</p>
      </div>
    `;
  },

  saveFromForm() {
    const coffeeId = document.getElementById('sale-coffee').value;
    const clientId = document.getElementById('sale-client').value;
    const packaging = document.getElementById('sale-packaging-value').value;
    const quantity = parseInt(document.getElementById('sale-quantity').value, 10);
    const unitPrice = parseFloat(document.getElementById('sale-unit-price').value);
    const saleDate = document.getElementById('sale-date').value;
    const notes = document.getElementById('sale-notes').value;

    if (!coffeeId) {
      Toast.show('Seleccione un café', 'danger');
      return;
    }
    if (!quantity || quantity <= 0) {
      Toast.show('Ingrese una cantidad válida', 'danger');
      return;
    }
    if (!unitPrice || unitPrice <= 0) {
      Toast.show('Ingrese el precio de venta', 'danger');
      return;
    }

    const soldAt = saleDate ? new Date(`${saleDate}T12:00:00`).toISOString() : new Date().toISOString();

    const sale = this.registerSale({
      coffeeId,
      clientId: clientId || null,
      packaging,
      quantity,
      unitPrice,
      soldAt,
      notes,
      costOptions: this.getFormCostOptions()
    });

    if (!sale) return;

    document.getElementById('sales-modal').classList.remove('active');
    App.renderSection('sales');
    Toast.show(`Venta registrada · Margen: ${formatNumber(sale.profitMargin, 1)}%`, 'success');
  },

  create() {
    this.showForm();
  }
};
