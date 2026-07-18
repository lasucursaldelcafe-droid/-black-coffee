const QuotationManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.QUOTATIONS) || [];
  },

  getById(id) {
    return this.getAll().find(q => q.id === id);
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
      const index = quotations.findIndex(q => q.id === quotation.id);
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

    document.getElementById('quotation-form').innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Cliente</label>
          <select class="form-control" id="quot-client" required>
            <option value="">Seleccionar cliente...</option>
            ${clients.map(c => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${c.name} (${CLIENT_TYPES[c.type]?.label})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Café</label>
          <select class="form-control" id="quot-coffee" required>
            <option value="">Seleccionar café...</option>
            ${coffees.map(c => `<option value="${c.id}" ${c.id === coffeeId ? 'selected' : ''}>${c.name} - ${c.region} (${formatCurrency(c.pricePerKg)}/kg)</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Presentación</label>
        <div class="selection-grid" id="quot-packaging">
          ${Object.entries(PACKAGING_SIZES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === '250g' ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="quot-packaging-value" value="250g">
      </div>
      <div class="form-group">
        <label>Etiquetas</label>
        <p class="form-hint" style="margin-bottom:8px">Selección múltiple: puede incluir pequeña, grande o ambas</p>
        <div class="selection-grid selection-grid-multi" id="quot-label">
          <button type="button" class="selection-btn active" data-value="small">Pequeña (${formatCurrency((Storage.get(STORAGE_KEYS.PRODUCTION_COSTS) || DEFAULT_PRODUCTION_COSTS).labels.small)})</button>
          <button type="button" class="selection-btn" data-value="large">Grande (${formatCurrency((Storage.get(STORAGE_KEYS.PRODUCTION_COSTS) || DEFAULT_PRODUCTION_COSTS).labels.large)})</button>
        </div>
        <input type="hidden" id="quot-label-value" value='["small"]'>
      </div>
      <div class="form-group">
        <label>Margen de Ganancia</label>
        <div class="selection-grid" id="quot-margin">
          ${PROFIT_MARGINS.map(m => `
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
    this.updatePreview();
    modal.classList.add('active');
  },

  bindQuotationEvents() {
    ['quot-packaging', 'quot-margin'].forEach((id) => {
      const container = document.getElementById(id);
      if (!container) return;
      const hidden = document.getElementById(`${id}-value`);
      container.querySelectorAll('.selection-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          if (hidden) hidden.value = btn.dataset.value;
          this.updatePreview();
        });
      });
    });

    const labelContainer = document.getElementById('quot-label');
    const labelHidden = document.getElementById('quot-label-value');
    if (labelContainer && labelHidden) {
      labelContainer.querySelectorAll('.selection-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          let selected = [...labelContainer.querySelectorAll('.selection-btn.active')].map((b) => b.dataset.value);
          if (selected.length === 0) {
            btn.classList.add('active');
            selected = [btn.dataset.value];
          }
          labelHidden.value = JSON.stringify(selected);
          this.updatePreview();
        });
      });
    }

    ['quot-client', 'quot-coffee', 'quot-quantity'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => this.updatePreview());
      document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    });
  },

  getSelectedLabels() {
    return parseLabelSelection(document.getElementById('quot-label-value')?.value);
  },

  updatePreview() {
    const coffeeId = document.getElementById('quot-coffee')?.value;
    const clientId = document.getElementById('quot-client')?.value;
    const packaging = document.getElementById('quot-packaging-value')?.value || '250g';
    const labels = this.getSelectedLabels();
    const margin = parseInt(document.getElementById('quot-margin-value')?.value || '35', 10);
    const quantity = parseInt(document.getElementById('quot-quantity')?.value || '1', 10);
    const preview = document.getElementById('quotation-preview-area');

    if (!coffeeId || !clientId || !preview) {
      if (preview) {
        preview.innerHTML = '<p class="form-hint">Seleccione cliente y café para ver el desglose de costos.</p>';
      }
      return;
    }

    const coffee = CoffeeManager.getById(coffeeId);
    const client = ClientManager.getById(clientId);
    if (!coffee || !client) return;

    const pricing = ProductionCosts.calculateSellingPrice(coffee, packaging, margin, client.type, labels);
    const total = pricing.finalPrice * quantity;
    const labelRows = pricing.labelDetails.map((item) => `
      <div class="cost-row"><span class="cost-label">Etiqueta ${item.name}</span><span>${formatCurrency(item.cost)}</span></div>
    `).join('');

    preview.innerHTML = `
      <div class="cost-breakdown">
        <h4 style="margin-bottom:12px">Desglose de Costos por Unidad</h4>
        <div class="cost-row"><span class="cost-label">Café (${PACKAGING_SIZES[packaging].label})</span><span>${formatCurrency(pricing.coffeeCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Tostión</span><span>${formatCurrency(pricing.roastingCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Selección</span><span>${formatCurrency(pricing.selectionCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Empaque</span><span>${formatCurrency(pricing.packagingCost)}</span></div>
        ${labelRows}
        <div class="cost-row"><span class="cost-label">Total etiquetas (${formatLabelSelection(labels)})</span><span>${formatCurrency(pricing.labelCost)}</span></div>
        ${pricing.increaseCost > 0 ? `<div class="cost-row"><span class="cost-label">Costo de Alza</span><span>${formatCurrency(pricing.increaseCost)}</span></div>` : ''}
        <div class="cost-row"><span class="cost-label">Costo Total</span><span>${formatCurrency(pricing.totalCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Margen (${margin}%)</span><span>+${formatCurrency(pricing.finalPrice - pricing.totalCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Precio Unitario</span><span>${formatCurrency(pricing.finalPrice)}</span></div>
        <div class="cost-row"><span class="cost-label">Total (${quantity} uds)</span><span>${formatCurrency(total)}</span></div>
      </div>
    `;
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

    if (!clientId || !coffeeId) {
      Toast.show('Seleccione cliente y café', 'danger');
      return;
    }

    const coffee = CoffeeManager.getById(coffeeId);
    const client = ClientManager.getById(clientId);
    const pricing = ProductionCosts.calculateSellingPrice(coffee, packaging, margin, client.type, labels);

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
              <th>Café</th>
              <th>Presentación</th>
              <th>Cantidad</th>
              <th>Total</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${quotations.map(q => `
              <tr>
                <td><strong>${q.number}</strong></td>
                <td>${q.clientName}</td>
                <td>${q.coffeeName}</td>
                <td>${PACKAGING_SIZES[q.packaging]?.label || q.packaging}</td>
                <td>${q.quantity}</td>
                <td><strong>${formatCurrency(q.totalPrice)}</strong></td>
                <td>${formatDate(q.createdAt)}</td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="PDFGenerator.generate(QuotationManager.getById('${q.id}'))">PDF</button>
                  <button class="btn btn-sm btn-secondary" onclick="QuotationManager.view('${q.id}')">Ver</button>
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
    modal.classList.add('active');
  },

  renderQuotationHTML(q) {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const validUntil = new Date(q.createdAt);
    validUntil.setDate(validUntil.getDate() + (q.validity || 15));

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
          <p><strong>Etiquetas:</strong> ${formatLabelSelection(q.labels || q.label)}</p>
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
