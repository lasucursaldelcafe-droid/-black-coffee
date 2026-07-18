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

    Notifications.add(`Cotización ${quotation.number} eliminada`, 'warning');
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
    Notifications.add(`Cotización ${quotation.number} creada`, 'success');
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

      <div id="quotation-preview-area" style="margin-top:20px"></div>
    `;

    this.bindQuotationEvents();
    this.updateModeVisibility();
    this.updatePreview();
    modal.classList.add('active');
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
        this.updatePreview();
      });
    });

    document.getElementById('quot-client-coffee')?.addEventListener('change', (e) => {
      document.getElementById('client-coffee-status').textContent = e.target.checked
        ? 'Sí, el cliente aporta el café'
        : 'No, nosotros compramos el café';
      this.updatePreview();
    });

    this.bindMultiSelect('quot-maquila-steps', 'quot-maquila-steps-value', true);
    this.bindSingleSelect('quot-packaging', 'quot-packaging-value');
    this.bindSingleSelect('quot-grind', 'quot-grind-value');
    this.bindSingleSelect('quot-margin', 'quot-margin-value');
    this.bindMultiSelect('quot-label', 'quot-label-value', true);

    ['quot-client', 'quot-coffee', 'quot-quantity'].forEach((id) => {
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

    const pricing = ProductionCosts.calculateSellingPrice(
      coffee, packaging, margin, client.type, labels, options
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
      coffee, packaging, margin, client.type, labels, options
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
      unitPrice: pricing.finalPrice,
      totalPrice: pricing.finalPrice * quantity,
      costBreakdown: pricing,
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

    container.innerHTML = `
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
              <th>Total</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${quotations.map((q) => `
              <tr>
                <td><strong>${q.number}</strong></td>
                <td>${q.clientName}</td>
                <td><span class="badge badge-neutral">${PRODUCTION_MODES[q.productionMode || 'full_pack']?.label || 'Full Pack'}</span></td>
                <td>${q.coffeeName}</td>
                <td>${PACKAGING_SIZES[q.packaging]?.label || q.packaging}</td>
                <td>${q.quantity}</td>
                <td><strong>${formatCurrency(q.totalPrice)}</strong></td>
                <td>${formatDate(q.createdAt)}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="PDFGenerator.generate(QuotationManager.getById('${q.id}'))">PDF</button>
                    <button class="btn btn-sm btn-secondary" onclick="QuotationManager.view('${q.id}')">Ver</button>
                    <button class="btn btn-sm btn-danger" onclick="QuotationManager.confirmDelete('${q.id}')">Eliminar</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  },

  view(id) {
    const q = this.getById(id);
    if (!q) return;

    const modal = document.getElementById('quotation-view-modal');
    document.getElementById('quotation-view-content').innerHTML = this.renderQuotationHTML(q);
    const footer = modal.querySelector('.modal-footer');
    if (footer) {
      footer.innerHTML = `
        <button class="btn btn-danger" onclick="QuotationManager.confirmDelete('${q.id}')">Eliminar</button>
        <button class="btn btn-secondary" data-modal-close>Cerrar</button>
        <button class="btn btn-primary" onclick="PDFGenerator.generate(QuotationManager.getById('${q.id}'))">Descargar PDF</button>
      `;
      footer.querySelector('[data-modal-close]')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
    modal.classList.add('active');
  },

  renderQuotationHTML(q) {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const validUntil = new Date(q.createdAt);
    validUntil.setDate(validUntil.getDate() + (q.validity || 15));
    const mode = PRODUCTION_MODES[q.productionMode || 'full_pack']?.label || 'Full Pack';

    let breakdownHtml = '';
    if (q.costBreakdown?.breakdown) {
      const b = q.costBreakdown.breakdown;
      const section = (title, items) => items?.length
        ? `<h5 style="margin:16px 0 8px">${title}</h5>${items.map((i) => `<p style="margin:4px 0">${i.label}: ${formatCurrency(i.cost)}</p>`).join('')}`
        : '';

      breakdownHtml = `
        <div style="margin:20px 0;padding:16px;background:#f5f5f5;border-radius:8px;color:#333">
          <h4 style="margin-bottom:12px">Desglose de Costos</h4>
          ${section('Administrativa / Logística', b.administrative)}
          ${section('Transformación', b.transformation)}
          ${section('Materiales', b.materials)}
        </div>
      `;
    }

    return `
      <div class="quotation-preview">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:30px">
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
          <p><strong>Tipo:</strong> ${CLIENT_TYPES[q.clientType]?.label || q.clientType}</p>
          <p><strong>Modo:</strong> ${mode}</p>
          <p><strong>Preparación:</strong> ${GRIND_TYPES[q.grindType || 'grano']?.label || 'En Grano'}</p>
          ${q.productionMode === 'full_pack' ? `<p><strong>Etiquetas:</strong> ${formatLabelSelection(q.labels || q.label)}</p>` : ''}
          ${q.productionMode === 'maquila' ? `<p><strong>Café:</strong> ${q.clientProvidesCoffee ? 'Aportado por el cliente' : 'Comprado por BCA'}</p>` : ''}
        </div>
        <table style="width:100%;margin-bottom:24px">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th>Cantidad</th>
              <th>Precio Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${q.coffeeName}</strong><br>
                <small style="color:#666">${q.coffeeDetails}</small>
              </td>
              <td>${PACKAGING_SIZES[q.packaging]?.label || q.packaging}</td>
              <td>${q.quantity}</td>
              <td>${formatCurrency(q.unitPrice)}</td>
              <td><strong>${formatCurrency(q.totalPrice)}</strong></td>
            </tr>
          </tbody>
        </table>
        ${breakdownHtml}
        ${q.notes ? `<p style="margin-bottom:16px"><strong>Notas:</strong> ${q.notes}</p>` : ''}
        <div style="border-top:2px solid #333;padding-top:16px;text-align:right">
          <p style="font-size:1.3rem"><strong>TOTAL: ${formatCurrency(q.totalPrice)}</strong></p>
        </div>
      </div>
    `;
  },

  create() {
    this.showForm();
  }
};
