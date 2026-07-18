const QuotationManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.QUOTATIONS) || [];
  },

  getById(id) {
    return this.getAll().find((q) => q.id === id);
  },

  delete(id) {
    const quotation = this.getById(id);
    if (!quotation) return;

    const quotations = this.getAll().filter((q) => q.id !== id);
    Storage.set(STORAGE_KEYS.QUOTATIONS, quotations);

    AuditLog.log('delete_quotation', quotation.number, {
      number: quotation.number,
      clientName: quotation.clientName,
      totalPrice: quotation.totalPrice
    });

    Notifications.add(`Cotización ${quotation.number} eliminada`, 'warning', { section: 'quotations' });
  },

  confirmDelete(id) {
    const q = this.getById(id);
    if (!q) return;
    if (confirm(`¿Eliminar la cotización ${q.number} de ${q.clientName}? Esta acción no se puede deshacer.`)) {
      this.delete(id);
      App.renderSection('quotations');
      document.getElementById('quotation-view-modal')?.classList.remove('active');
    }
  },

  save(quotation) {
    const quotations = this.getAll();
    if (!quotation.id) {
      quotation.id = Storage.generateId();
      quotation.number = `COT-${String(quotations.length + 1).padStart(4, '0')}`;
      quotation.createdAt = new Date().toISOString();
      quotation.status = 'pending';
      quotations.push(quotation);
    } else {
      const index = quotations.findIndex((q) => q.id === quotation.id);
      quotations[index] = { ...quotations[index], ...quotation };
    }

    Storage.set(STORAGE_KEYS.QUOTATIONS, quotations);
    Notifications.add(`Cotización ${quotation.number} creada`, 'success', {
      section: 'quotations', entityId: quotation.id, action: 'view'
    });
    EmailService.sendQuotation(quotation);
    return quotation;
  },

  createForCoffee(coffeeId) {
    App.navigateTo('quotations');
    setTimeout(() => this.showForm(null, coffeeId), 100);
  },

  createForClient(clientId) {
    App.navigateTo('quotations');
    setTimeout(() => this.showForm(clientId), 100);
  },

  showForm(clientId = null, coffeeId = null) {
    const modal = document.getElementById('quotation-modal');
    document.getElementById('quotation-modal-title').textContent = 'Nueva Cotización';

    const clients = ClientManager.getAll();
    const coffees = CoffeeManager.getAll();
    const costs = ProductionCosts.get();

    document.getElementById('quotation-form').innerHTML = `
      <div class="form-group">
        <label>Modo de Producción</label>
        <div class="selection-grid" id="quot-production-mode">
          ${Object.entries(PRODUCTION_MODES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === 'full_pack' ? 'active' : ''}" data-value="${key}">
              <strong>${val.label}</strong><br><small style="opacity:0.7">${val.description}</small>
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="quot-production-mode-value" value="full_pack">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Cliente</label>
          <select class="form-control" id="quot-client" required>
            <option value="">Seleccionar cliente...</option>
            ${clients.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${c.name} (${CLIENT_TYPES[c.type]?.label})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Café</label>
          <select class="form-control" id="quot-coffee" required>
            <option value="">Seleccionar café...</option>
            ${coffees.map((c) => `<option value="${c.id}" ${c.id === coffeeId ? 'selected' : ''}>${c.name} - ${c.region} (${formatCurrency(c.pricePerKg)}/kg)</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="maquila-options" style="display:none">
        <div class="form-group">
          <label>¿El cliente aporta el café?</label>
          <div class="toggle-group" style="margin-top:8px">
            <label class="toggle">
              <input type="checkbox" id="quot-client-coffee" checked>
              <span class="toggle-slider"></span>
            </label>
            <span id="client-coffee-status">Sí, el cliente aporta el café</span>
          </div>
        </div>
        <div class="form-group">
          <label>Servicios de Maquila</label>
          <p class="form-hint" style="margin-bottom:8px">Seleccione los procesos a realizar. No incluye materiales de empaque.</p>
          <div class="selection-grid selection-grid-multi" id="quot-maquila-steps">
            ${Object.entries(TRANSFORMATION_STEPS).map(([key, val]) => `
              <button type="button" class="selection-btn ${['tostion', 'seleccion', 'empacada'].includes(key) ? 'active' : ''}" data-value="${key}">${val.label}</button>
            `).join('')}
          </div>
          <input type="hidden" id="quot-maquila-steps-value" value='["tostion","seleccion","empacada"]'>
        </div>
      </div>

      <div class="form-group">
        <label>Presentación de Empaque</label>
        <div class="selection-grid" id="quot-packaging">
          ${Object.entries(PACKAGING_SIZES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === '250g' ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="quot-packaging-value" value="250g">
      </div>

      <div class="form-group">
        <label>Preparación del Café</label>
        <div class="selection-grid" id="quot-grind">
          ${Object.entries(GRIND_TYPES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === 'grano' ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="quot-grind-value" value="grano">
      </div>

      <div id="full-pack-labels">
        <div class="form-group">
          <label>Etiquetas</label>
          <p class="form-hint" style="margin-bottom:8px">Selección múltiple: pequeña, grande o ambas</p>
          <div class="selection-grid selection-grid-multi" id="quot-label">
            <button type="button" class="selection-btn active" data-value="small">Pequeña (${formatCurrency(costs.labels.small)})</button>
            <button type="button" class="selection-btn" data-value="large">Grande (${formatCurrency(costs.labels.large)})</button>
          </div>
          <input type="hidden" id="quot-label-value" value='["small"]'>
        </div>
      </div>

      <div class="form-group">
        <label>Margen de Ganancia</label>
        <div class="selection-grid" id="quot-margin">
          ${PROFIT_MARGINS.map((m) => `
            <button type="button" class="selection-btn ${m === 35 ? 'active' : ''}" data-value="${m}">${m}%</button>
          `).join('')}
        </div>
        <input type="hidden" id="quot-margin-value" value="35">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Cantidad (unidades)</label>
          <input type="number" class="form-control" id="quot-quantity" value="1" min="1">
        </div>
        <div class="form-group">
          <label>Validez (días)</label>
          <input type="number" class="form-control" id="quot-validity" value="15" min="1">
        </div>
      </div>

      <div class="form-group">
        <label>Notas adicionales</label>
        <textarea class="form-control" id="quot-notes" rows="2" placeholder="Condiciones especiales, descuentos, etc."></textarea>
      </div>

      <div id="quot-suppliers-section" style="display:none;margin-top:8px">
        <div class="form-group">
          <label>Proveedores por Proceso</label>
          <p class="form-hint" style="margin-bottom:8px">Indique dónde se realizará cada etapa (tostador, empacadora, transporte, etc.)</p>
          <div id="quot-suppliers-fields"></div>
        </div>
      </div>

      <div id="quotation-preview-area" style="margin-top:20px"></div>
    `;

    this.bindQuotationEvents();
    this.updateModeVisibility();
    this.updateSupplierFields();
    this.updatePreview();
    modal.classList.add('active');
  },

  getActiveQuoteSteps() {
    const coffeeId = document.getElementById('quot-coffee')?.value;
    const coffee = coffeeId ? CoffeeManager.getById(coffeeId) : null;
    if (!coffee) return [];

    const options = this.getQuoteOptions();
    return ProductionCosts.getActiveSteps({
      productionMode: options.productionMode,
      coffee,
      maquilaSteps: options.maquilaSteps,
      grindType: options.grindType
    });
  },

  updateSupplierFields() {
    const section = document.getElementById('quot-suppliers-section');
    const container = document.getElementById('quot-suppliers-fields');
    if (!section || !container) return;

    const coffeeId = document.getElementById('quot-coffee')?.value;
    if (!coffeeId) {
      section.style.display = 'none';
      return;
    }

    const coffee = CoffeeManager.getById(coffeeId);
    const options = this.getQuoteOptions();
    const steps = this.getActiveQuoteSteps();
    const defaults = ProductionCosts.get().defaultSuppliers || {};
    const compraDefault = coffee?.supplierId || CoffeeManager.resolveSupplierId(coffee) || defaults.compra || '';
    const fields = [];

    if (options.productionMode === 'full_pack' || !options.clientProvidesCoffee) {
      fields.push(`
        <div class="form-group">
          <label>${getProcessSupplierLabel('compra')}</label>
          ${SupplierManager.renderSelect('compra', { id: 'quot-supplier-compra', selectedId: compraDefault })}
        </div>
        <div class="form-group">
          <label>${getProcessSupplierLabel('transporte')}</label>
          ${SupplierManager.renderSelect('transporte', { id: 'quot-supplier-transporte', selectedId: defaults.transporte || '', placeholder: 'Opcional...' })}
        </div>
      `);
    }

    steps.forEach((stepKey) => {
      fields.push(`
        <div class="form-group">
          <label>${getProcessSupplierLabel(stepKey)}</label>
          ${SupplierManager.renderSelect(stepKey, {
            id: `quot-supplier-${stepKey}`,
            selectedId: defaults[stepKey] || ''
          })}
        </div>
      `);
    });

    section.style.display = fields.length ? 'block' : 'none';
    container.innerHTML = fields.join('');
    this.updatePreview();
  },

  getProcessSuppliersFromForm() {
    const suppliers = {};
    const options = this.getQuoteOptions();
    const steps = this.getActiveQuoteSteps();

    if (options.productionMode === 'full_pack' || !options.clientProvidesCoffee) {
      const compra = document.getElementById('quot-supplier-compra')?.value;
      const transporte = document.getElementById('quot-supplier-transporte')?.value;
      if (compra) suppliers.compra = compra;
      if (transporte) suppliers.transporte = transporte;
    }

    steps.forEach((stepKey) => {
      const value = document.getElementById(`quot-supplier-${stepKey}`)?.value;
      if (value) suppliers[stepKey] = value;
    });

    return suppliers;
  },

  formatProcessSuppliers(processSuppliers = {}) {
    return Object.entries(processSuppliers)
      .filter(([, id]) => id)
      .map(([key, id]) => `${getProcessSupplierLabel(key)}: ${SupplierManager.getName(id)}`)
      .join(' · ');
  },

  bindQuotationEvents() {
    const modeContainer = document.getElementById('quot-production-mode');
    const modeHidden = document.getElementById('quot-production-mode-value');
    modeContainer?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        modeContainer.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        if (modeHidden) modeHidden.value = btn.dataset.value;
        this.updateModeVisibility();
        this.updateSupplierFields();
        this.updatePreview();
      });
    });

    document.getElementById('quot-client-coffee')?.addEventListener('change', (e) => {
      document.getElementById('client-coffee-status').textContent = e.target.checked
        ? 'Sí, el cliente aporta el café'
        : 'No, nosotros compramos el café';
      this.updateSupplierFields();
      this.updatePreview();
    });

    this.bindMultiSelect('quot-maquila-steps', 'quot-maquila-steps-value', true);
    this.bindSingleSelect('quot-packaging', 'quot-packaging-value');
    this.bindSingleSelect('quot-grind', 'quot-grind-value');
    this.bindSingleSelect('quot-margin', 'quot-margin-value');
    document.getElementById('quot-grind')?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => setTimeout(() => this.updateSupplierFields(), 0));
    });
    this.bindMultiSelect('quot-label', 'quot-label-value', true);

    ['quot-client', 'quot-coffee', 'quot-quantity'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (id === 'quot-coffee') this.updateSupplierFields();
        this.updatePreview();
      });
      document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    });

    document.getElementById('quot-suppliers-fields')?.addEventListener('change', () => this.updatePreview());
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

  bindMultiSelect(containerId, hiddenId, requireOne = false) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    if (!container || !hidden) return;

    container.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        let selected = [...container.querySelectorAll('.selection-btn.active')].map((b) => b.dataset.value);
        if (requireOne && selected.length === 0) {
          btn.classList.add('active');
          selected = [btn.dataset.value];
        }
        hidden.value = JSON.stringify(selected);
        if (containerId === 'quot-maquila-steps') {
          QuotationManager.updateSupplierFields();
        }
        this.updatePreview();
      });
    });
  },

  updateModeVisibility() {
    const mode = document.getElementById('quot-production-mode-value')?.value || 'full_pack';
    const isMaquila = mode === 'maquila';
    document.getElementById('maquila-options').style.display = isMaquila ? 'block' : 'none';
    document.getElementById('full-pack-labels').style.display = isMaquila ? 'none' : 'block';
  },

  getQuoteOptions() {
    const mode = document.getElementById('quot-production-mode-value')?.value || 'full_pack';
    let maquilaSteps = [];
    try {
      maquilaSteps = JSON.parse(document.getElementById('quot-maquila-steps-value')?.value || '[]');
    } catch {
      maquilaSteps = [];
    }

    return {
      productionMode: mode,
      maquilaSteps,
      clientProvidesCoffee: document.getElementById('quot-client-coffee')?.checked ?? false,
      grindType: document.getElementById('quot-grind-value')?.value || 'grano'
    };
  },

  getSelectedLabels() {
    const mode = document.getElementById('quot-production-mode-value')?.value || 'full_pack';
    if (mode === 'maquila') return [];
    return parseLabelSelection(document.getElementById('quot-label-value')?.value);
  },

  renderBreakdownHTML(pricing, labels, margin, quantity) {
    const total = pricing.finalPrice * quantity;
    const adminRows = pricing.breakdown.administrative.map((item) => `
      <div class="cost-row">
        <span class="cost-label">${item.label}${item.detail ? ` <small>(${item.detail})</small>` : ''}</span>
        <span>${formatCurrency(item.cost)}</span>
      </div>
    `).join('');

    const transformRows = pricing.breakdown.transformation.map((item) => `
      <div class="cost-row">
        <span class="cost-label">${item.label}${item.detail ? ` <small>(${item.detail})</small>` : ''}</span>
        <span>${formatCurrency(item.cost)}</span>
      </div>
    `).join('');

    const materialRows = pricing.breakdown.materials.map((item) => `
      <div class="cost-row">
        <span class="cost-label">${item.label}</span>
        <span>${formatCurrency(item.cost)}</span>
      </div>
    `).join('');

    return `
      <div class="cost-breakdown">
        <h4 style="margin-bottom:4px">Desglose de Costos por Unidad</h4>
        <p class="form-hint" style="margin-bottom:12px">
          ${PRODUCTION_MODES[pricing.productionMode]?.label || pricing.productionMode}
          · ${GRIND_TYPES[pricing.grindType]?.label || pricing.grindType}
          · Merma total: ${pricing.mermaDetails?.totalLossPercent || 0}%
        </p>

        ${adminRows ? `<h5 style="margin:12px 0 8px;color:var(--text-secondary)">Administrativa / Logística</h5>${adminRows}` : ''}
        ${transformRows ? `<h5 style="margin:12px 0 8px;color:var(--text-secondary)">Transformación</h5>${transformRows}` : ''}
        ${materialRows ? `<h5 style="margin:12px 0 8px;color:var(--text-secondary)">Materiales</h5>${materialRows}` : ''}

        <div class="cost-row" style="margin-top:8px"><span class="cost-label">Costo Total</span><span>${formatCurrency(pricing.totalCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Margen (${margin}%)</span><span>+${formatCurrency(pricing.finalPrice - pricing.totalCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Precio Unitario</span><span>${formatCurrency(pricing.finalPrice)}</span></div>
        <div class="cost-row"><span class="cost-label">Total (${quantity} uds)</span><span>${formatCurrency(total)}</span></div>
      </div>
    `;
  },

  updatePreview() {
    const coffeeId = document.getElementById('quot-coffee')?.value;
    const clientId = document.getElementById('quot-client')?.value;
    const packaging = document.getElementById('quot-packaging-value')?.value || '250g';
    const labels = this.getSelectedLabels();
    const margin = parseInt(document.getElementById('quot-margin-value')?.value || '35', 10);
    const quantity = parseInt(document.getElementById('quot-quantity')?.value || '1', 10);
    const preview = document.getElementById('quotation-preview-area');
    const options = this.getQuoteOptions();

    if (!coffeeId || !clientId || !preview) {
      if (preview) {
        preview.innerHTML = '<p class="form-hint">Seleccione cliente y café para ver el desglose de costos.</p>';
      }
      return;
    }

    const coffee = CoffeeManager.getById(coffeeId);
    const client = ClientManager.getById(clientId);
    if (!coffee || !client) return;

    const processSuppliers = this.getProcessSuppliersFromForm();
    const pricing = ProductionCosts.calculateSellingPrice(
      coffee, packaging, margin, client.type, labels, { ...options, processSuppliers }
    );

    preview.innerHTML = this.renderBreakdownHTML(pricing, labels, margin, quantity);
  },

  saveFromForm() {
    const clientId = document.getElementById('quot-client').value;
    const coffeeId = document.getElementById('quot-coffee').value;
    const packaging = document.getElementById('quot-packaging-value').value;
    const labels = this.getSelectedLabels();
    const margin = parseInt(document.getElementById('quot-margin-value').value, 10);
    const quantity = parseInt(document.getElementById('quot-quantity').value, 10);
    const validity = parseInt(document.getElementById('quot-validity').value, 10);
    const notes = document.getElementById('quot-notes').value;
    const options = this.getQuoteOptions();
    const processSuppliers = this.getProcessSuppliersFromForm();

    if (!clientId || !coffeeId) {
      Toast.show('Seleccione cliente y café', 'danger');
      return;
    }

    if (options.productionMode === 'maquila' && options.maquilaSteps.length === 0) {
      Toast.show('Seleccione al menos un servicio de maquila', 'danger');
      return;
    }

    const coffee = CoffeeManager.getById(coffeeId);
    const client = ClientManager.getById(clientId);
    const pricing = ProductionCosts.calculateSellingPrice(
      coffee, packaging, margin, client.type, labels, { ...options, processSuppliers }
    );

    const quotation = {
      clientId,
      coffeeId,
      packaging,
      labels,
      label: labels.join(','),
      margin,
      quantity,
      validity,
      notes,
      productionMode: options.productionMode,
      maquilaSteps: options.maquilaSteps,
      clientProvidesCoffee: options.clientProvidesCoffee,
      grindType: options.grindType,
      processSuppliers,
      unitPrice: pricing.finalPrice,
      totalPrice: pricing.finalPrice * quantity,
      costBreakdown: pricing,
      internalUnitCost: pricing.totalCost,
      internalTotalCost: pricing.totalCost * quantity,
      internalProfit: (pricing.finalPrice - pricing.totalCost) * quantity,
      internalProfitMargin: pricing.finalPrice > 0
        ? ((pricing.finalPrice - pricing.totalCost) / pricing.finalPrice) * 100
        : 0,
      clientName: client.name,
      clientType: client.type,
      coffeeName: coffee.name,
      coffeeDetails: `${coffee.variety} · ${coffee.region} · ${coffee.process}${coffee.fermentation ? ' · ' + coffee.fermentation : ''}`
    };

    const saved = this.save(quotation);
    document.getElementById('quotation-modal').classList.remove('active');
    App.renderSection('quotations');
    PDFGenerator.generate(saved);
  },

  getInternalMetrics(q) {
    const unitCost = q.internalUnitCost ?? q.costBreakdown?.totalCost ?? 0;
    const totalCost = q.internalTotalCost ?? unitCost * (q.quantity || 1);
    const profit = q.internalProfit ?? (q.totalPrice - totalCost);
    const profitMargin = q.internalProfitMargin ?? (q.totalPrice > 0 ? (profit / q.totalPrice) * 100 : 0);
    return { unitCost, totalCost, profit, profitMargin };
  },

  getReportSummary(quotations = null) {
    const list = quotations || this.getAll();
    const totalQuoted = list.reduce((sum, q) => sum + (q.totalPrice || 0), 0);
    const totalCost = list.reduce((sum, q) => sum + this.getInternalMetrics(q).totalCost, 0);
    const totalProfit = list.reduce((sum, q) => sum + this.getInternalMetrics(q).profit, 0);
    const avgMargin = totalQuoted > 0 ? (totalProfit / totalQuoted) * 100 : 0;
    return { count: list.length, totalQuoted, totalCost, totalProfit, avgMargin };
  },

  renderTable(container) {
    const quotations = this.getAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (quotations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>No hay cotizaciones</h3>
          <p>Crea tu primera cotización para un cliente</p>
        </div>`;
      return;
    }

    const summary = this.getReportSummary(quotations);

    container.innerHTML = `
      <div class="grid-4 sales-summary" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-value">${summary.count}</div>
          <div class="stat-label">Cotizaciones</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(summary.totalQuoted)}</div>
          <div class="stat-label">Valor Cotizado (cliente)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(summary.totalCost)}</div>
          <div class="stat-label">Costo Interno Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${formatNumber(summary.avgMargin, 1)}%</div>
          <div class="stat-label">Margen Promedio</div>
        </div>
      </div>
      <p class="form-hint" style="margin:-8px 0 16px">
        El PDF y la vista para el cliente muestran solo el precio de entrega. Los costos internos quedan en este informe.
      </p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Cliente</th>
              <th>Modo</th>
              <th>Café</th>
              <th>Presentación</th>
              <th>Cantidad</th>
              <th>P. Cliente</th>
              <th>Costo Int.</th>
              <th>Utilidad</th>
              <th>Margen</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${quotations.map((q) => {
              const metrics = this.getInternalMetrics(q);
              return `
              <tr>
                <td><strong>${q.number}</strong></td>
                <td>${q.clientName}</td>
                <td><span class="badge badge-neutral">${PRODUCTION_MODES[q.productionMode || 'full_pack']?.label || 'Full Pack'}</span></td>
                <td>${q.coffeeName}</td>
                <td>${PACKAGING_SIZES[q.packaging]?.label || q.packaging}</td>
                <td>${q.quantity}</td>
                <td><strong>${formatCurrency(q.totalPrice)}</strong></td>
                <td>${formatCurrency(metrics.totalCost)}</td>
                <td style="color:${metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                  <strong>${formatCurrency(metrics.profit)}</strong>
                </td>
                <td>
                  <span class="badge ${metrics.profitMargin >= 30 ? 'badge-success' : metrics.profitMargin >= 15 ? 'badge-warning' : 'badge-danger'}">
                    ${formatNumber(metrics.profitMargin, 1)}%
                  </span>
                </td>
                <td>${formatDate(q.createdAt)}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="PDFGenerator.generate(QuotationManager.getById('${q.id}'))">PDF Cliente</button>
                    <button class="btn btn-sm btn-secondary" onclick="QuotationManager.view('${q.id}')">Ver</button>
                    <button class="btn btn-sm btn-secondary" onclick="QuotationManager.viewInternal('${q.id}')">Costos</button>
                    <button class="btn btn-sm btn-danger" onclick="QuotationManager.confirmDelete('${q.id}')">Eliminar</button>
                  </div>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  view(id) {
    const q = this.getById(id);
    if (!q) return;

    const modal = document.getElementById('quotation-view-modal');
    document.getElementById('quotation-view-content').innerHTML = this.renderClientQuotationHTML(q);
    const footer = modal.querySelector('.modal-footer');
    if (footer) {
      footer.innerHTML = `
        <button class="btn btn-danger" onclick="QuotationManager.confirmDelete('${q.id}')">Eliminar</button>
        <button class="btn btn-secondary" onclick="QuotationManager.viewInternal('${q.id}')">Análisis interno</button>
        <button class="btn btn-secondary" data-modal-close>Cerrar</button>
        <button class="btn btn-primary" onclick="PDFGenerator.generate(QuotationManager.getById('${q.id}'))">PDF para Cliente</button>
      `;
      footer.querySelector('[data-modal-close]')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
    modal.classList.add('active');
  },

  viewInternal(id) {
    const q = this.getById(id);
    if (!q) return;

    const modal = document.getElementById('quotation-view-modal');
    document.getElementById('quotation-view-content').innerHTML = this.renderInternalAnalysisHTML(q);
    const footer = modal.querySelector('.modal-footer');
    if (footer) {
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="QuotationManager.view('${q.id}')">Vista cliente</button>
        <button class="btn btn-secondary" data-modal-close>Cerrar</button>
      `;
      footer.querySelector('[data-modal-close]')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
    modal.classList.add('active');
  },

  renderClientQuotationHTML(q) {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const validUntil = new Date(q.createdAt);
    validUntil.setDate(validUntil.getDate() + (q.validity || 15));
    const mode = PRODUCTION_MODES[q.productionMode || 'full_pack']?.label || 'Full Pack';
    const grindLabel = GRIND_TYPES[q.grindType || 'grano']?.label || 'En Grano';

    return `
      <div class="quotation-preview">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:30px;flex-wrap:wrap;gap:16px">
          <div>
            ${settings.logo ? `<img src="${settings.logo}" style="max-height:50px;margin-bottom:10px">` : ''}
            <h2>${settings.companyName}</h2>
            <p style="color:#666">${settings.tagline}</p>
          </div>
          <div style="text-align:right">
            <h3>COTIZACIÓN</h3>
            <p><strong>${q.number}</strong></p>
            <p style="color:#666">${formatDate(q.createdAt)}</p>
            <p style="color:#666">Válida hasta: ${formatDate(validUntil)}</p>
          </div>
        </div>
        <div style="margin-bottom:24px">
          <p><strong>Cliente:</strong> ${q.clientName}</p>
          <p><strong>Producto:</strong> ${q.coffeeName}</p>
          <p><strong>Detalle:</strong> ${q.coffeeDetails}</p>
          <p><strong>Presentación:</strong> ${PACKAGING_SIZES[q.packaging]?.label || q.packaging}</p>
          <p><strong>Preparación:</strong> ${grindLabel}</p>
          ${q.productionMode === 'full_pack' ? `<p><strong>Etiquetas:</strong> ${formatLabelSelection(q.labels || q.label)}</p>` : ''}
        </div>
        <table style="width:100%;margin-bottom:24px">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${q.coffeeName}</strong><br>
                <small style="color:#666">${q.coffeeDetails} · ${PACKAGING_SIZES[q.packaging]?.label || q.packaging} · ${grindLabel}</small>
              </td>
              <td>${q.quantity}</td>
              <td>${formatCurrency(q.unitPrice)}</td>
              <td><strong>${formatCurrency(q.totalPrice)}</strong></td>
            </tr>
          </tbody>
        </table>
        ${q.notes ? `<p style="margin-bottom:16px"><strong>Notas:</strong> ${q.notes}</p>` : ''}
        <div style="border-top:2px solid #333;padding-top:16px;text-align:right">
          <p style="font-size:1.3rem"><strong>TOTAL: ${formatCurrency(q.totalPrice)}</strong></p>
          <p style="color:#666;font-size:0.85rem;margin-top:4px">Precio por producto entregado · ${mode}</p>
        </div>
      </div>
    `;
  },

  renderInternalAnalysisHTML(q) {
    const metrics = this.getInternalMetrics(q);
    const pricing = q.costBreakdown;

    let breakdownBlock = '';
    if (pricing?.breakdown) {
      breakdownBlock = this.renderBreakdownHTML(
        pricing,
        q.labels || parseLabelSelection(q.label),
        q.margin || 0,
        q.quantity || 1
      );
    }

    const supplierBlock = q.processSuppliers && Object.keys(q.processSuppliers).length
      ? `<p class="form-hint" style="margin-bottom:12px"><strong>Proveedores:</strong> ${this.formatProcessSuppliers(q.processSuppliers)}</p>`
      : '';

    return `
      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <span class="card-title">Análisis interno · ${q.number}</span>
            <span class="badge badge-neutral">Solo plataforma</span>
          </div>
          <p><strong>Cliente:</strong> ${q.clientName} · <strong>Café:</strong> ${q.coffeeName}</p>
          ${supplierBlock}
          <div class="grid-4 sales-summary" style="margin-top:16px">
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(q.totalPrice)}</div>
              <div class="stat-label">Precio al cliente</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(metrics.totalCost)}</div>
              <div class="stat-label">Costo interno</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--success)">${formatCurrency(metrics.profit)}</div>
              <div class="stat-label">Utilidad estimada</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatNumber(metrics.profitMargin, 1)}%</div>
              <div class="stat-label">Margen</div>
            </div>
          </div>
        </div>
        ${breakdownBlock || '<p class="form-hint">Sin desglose detallado guardado para esta cotización.</p>'}
      </div>
    `;
  },

  renderQuotationHTML(q) {
    return this.renderClientQuotationHTML(q);
  },

  create() {
    this.showForm();
  }
};
