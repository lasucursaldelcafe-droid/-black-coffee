const CostEngine = {
  activeTab: 'simulator',
  editingScenarioId: null,

  getScenarios() {
    return Storage.get(STORAGE_KEYS.COST_SCENARIOS) || [];
  },

  getTemplates() {
    return Storage.get(STORAGE_KEYS.PROCESS_TEMPLATES) || [];
  },

  saveScenario(scenario) {
    const scenarios = this.getScenarios();
    if (!scenario.id) {
      scenario.id = Storage.generateId();
      scenario.createdAt = new Date().toISOString();
      scenarios.push(scenario);
    } else {
      const idx = scenarios.findIndex((s) => s.id === scenario.id);
      if (idx >= 0) scenarios[idx] = { ...scenarios[idx], ...scenario };
      else scenarios.push(scenario);
    }
    scenario.updatedAt = new Date().toISOString();
    Storage.set(STORAGE_KEYS.COST_SCENARIOS, scenarios);
    AuditLog.log('save_cost_scenario', scenario.name, { id: scenario.id });
    Notifications.add(`Escenario "${scenario.name}" guardado`, 'success', { section: 'cost-engine' });
    return scenario;
  },

  deleteScenario(id) {
    const scenario = this.getScenarios().find((s) => s.id === id);
    if (!scenario) return;
    if (!confirm(`¿Eliminar el escenario "${scenario.name}"?`)) return;
    const next = this.getScenarios().filter((s) => s.id !== id);
    Storage.set(STORAGE_KEYS.COST_SCENARIOS, next);
    Toast.show('Escenario eliminado', 'info');
    this.render(document.getElementById('cost-engine-container'));
  },

  saveTemplate(template) {
    const templates = this.getTemplates();
    if (!template.id) {
      template.id = Storage.generateId();
      template.createdAt = new Date().toISOString();
      templates.push(template);
    } else {
      const idx = templates.findIndex((t) => t.id === template.id);
      if (idx >= 0) templates[idx] = { ...templates[idx], ...template };
      else templates.push(template);
    }
    template.updatedAt = new Date().toISOString();
    Storage.set(STORAGE_KEYS.PROCESS_TEMPLATES, templates);
    Toast.show(`Plantilla "${template.name}" guardada`, 'success');
    return template;
  },

  deleteTemplate(id) {
    const template = this.getTemplates().find((t) => t.id === id);
    if (!template) return;
    if (!confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    Storage.set(STORAGE_KEYS.PROCESS_TEMPLATES, this.getTemplates().filter((t) => t.id !== id));
    Toast.show('Plantilla eliminada', 'info');
    this.render(document.getElementById('cost-engine-container'));
  },

  buildInternalOptions(formMode) {
    const mode = formMode || document.getElementById('ce-production-mode-value')?.value || 'full_pack';
    const grindType = document.getElementById('ce-grind-value')?.value || 'grano';
    let maquilaSteps = [];
    if (mode === 'maquila') {
      document.querySelectorAll('#ce-maquila-steps .selection-btn.active').forEach((btn) => {
        maquilaSteps.push(btn.dataset.value);
      });
    }
    return {
      productionMode: mode,
      maquilaSteps,
      clientProvidesCoffee: document.getElementById('ce-client-coffee')?.checked ?? false,
      clientProvidesPackaging: document.getElementById('ce-client-packaging')?.checked ?? (mode === 'maquila'),
      grindType
    };
  },

  getPackagingMixFromForm() {
    const mix = {};
    document.querySelectorAll('[data-ce-mix-size]').forEach((input) => {
      const qty = parseInt(input.value, 10) || 0;
      if (qty > 0) mix[input.dataset.ceMixSize] = qty;
    });
    return normalizePackagingMix(mix);
  },

  computePricing(coffee, options, packaging, labels, margin, quantity, packagingMix) {
    if (options.productionMode === 'maquila') {
      const mix = packagingMix || this.getPackagingMixFromForm();
      if (getPackagingMixTotal(mix) === 0) return null;
      return ProductionCosts.calculateMixPricing(
        coffee, mix, margin, 'final', labels, options
      );
    }
    const pricing = ProductionCosts.calculateSellingPrice(
      coffee, packaging, margin, 'final', labels, options
    );
    return { ...pricing, quantity };
  },

  getTargetMargin(unitCost, targetMode, targetValue) {
    const val = parseFloat(String(targetValue).replace(/[^\d.-]/g, '')) || 0;
    if (targetMode === 'profit_amount') return markupFromProfitAmount(unitCost, val);
    if (targetMode === 'target_price') return markupFromTargetPrice(unitCost, val);
    return clampProfitMargin(targetValue);
  },

  render(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="tabs" id="ce-tabs">
        <button type="button" class="tab ${this.activeTab === 'simulator' ? 'active' : ''}" data-tab="simulator">Simulador Interno</button>
        <button type="button" class="tab ${this.activeTab === 'memory' ? 'active' : ''}" data-tab="memory">Memoria Guardada</button>
        <button type="button" class="tab ${this.activeTab === 'maquila' ? 'active' : ''}" data-tab="maquila">Análisis Maquila</button>
        <button type="button" class="tab ${this.activeTab === 'templates' ? 'active' : ''}" data-tab="templates">Plantillas</button>
      </div>
      <div id="ce-tab-content"></div>
    `;

    container.querySelectorAll('#ce-tabs .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render(container);
      });
    });

    const tabContent = container.querySelector('#ce-tab-content');
    switch (this.activeTab) {
      case 'memory':
        this.renderMemoryTab(tabContent);
        break;
      case 'maquila':
        this.renderMaquilaTab(tabContent);
        break;
      case 'templates':
        this.renderTemplatesTab(tabContent);
        break;
      default:
        this.renderSimulatorTab(tabContent);
    }
  },

  renderSimulatorTab(container) {
    const coffees = CoffeeManager.getAll();
    const defaultCoffee = coffees[0];
    const scenario = this.editingScenarioId
      ? this.getScenarios().find((s) => s.id === this.editingScenarioId)
      : null;

    container.innerHTML = `
      <div class="grid-2" style="gap:20px;align-items:start">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Costeo de Transformación — Empresa</span>
          </div>
          <p class="form-hint" style="margin-bottom:16px">
            Calcule cuánto invierte la empresa para transformar el café antes de vender.
            Defina su ganancia deseada y el sistema convierte a porcentaje de margen.
          </p>

          <div class="form-group">
            <label>Nombre del escenario (opcional)</label>
            <input type="text" id="ce-scenario-name" class="form-control"
              placeholder="Ej: Huila 250g full pack julio 2026"
              value="${scenario?.name || ''}">
          </div>

          <div class="form-group">
            <label>Café</label>
            <select id="ce-coffee" class="form-control">
              ${coffees.map((c) => `
                <option value="${c.id}" ${(scenario?.coffeeId || defaultCoffee?.id) === c.id ? 'selected' : ''}>
                  ${c.name} — ${formatCurrency(c.pricePerKg)}/kg
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Modo de producción</label>
            <div class="selection-grid" id="ce-production-mode">
              ${Object.entries(PRODUCTION_MODES).map(([key, val]) => `
                <button type="button" class="selection-btn ${(scenario?.productionMode || 'full_pack') === key ? 'active' : ''}"
                  data-value="${key}">
                  <strong>${val.label}</strong><br>
                  <small style="opacity:0.7">${val.description}</small>
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="ce-production-mode-value" value="${scenario?.productionMode || 'full_pack'}">
          </div>

          <div id="ce-maquila-options" style="display:${(scenario?.productionMode || 'full_pack') === 'maquila' ? 'block' : 'none'}">
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="ce-client-coffee" ${scenario?.clientProvidesCoffee ? 'checked' : ''}>
                El cliente aporta el café
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="ce-client-packaging" ${scenario?.clientProvidesPackaging !== false ? 'checked' : ''}>
                El cliente aporta el empaque (solo mano de obra)
              </label>
            </div>
            <div class="form-group">
              <label>Procesos de maquila</label>
              <div class="selection-grid" id="ce-maquila-steps">
                ${['trilla', 'greenSelection', 'tostion', 'seleccion', 'molienda', 'empacada'].map((step) => `
                  <button type="button" class="selection-btn ${(scenario?.maquilaSteps || ['tostion', 'seleccion', 'empacada']).includes(step) ? 'active' : ''}"
                    data-value="${step}">${TRANSFORMATION_STEPS[step]?.label || step}</button>
                `).join('')}
              </div>
            </div>
            <div class="form-group">
              <label>Cantidades por presentación</label>
              <div class="grid-3" style="gap:8px">
                ${Object.entries(PACKAGING_SIZES).map(([key, val]) => `
                  <div>
                    <label class="form-hint">${val.label}</label>
                    <input type="number" min="0" class="form-control" data-ce-mix-size="${key}"
                      value="${scenario?.packagingMix?.[key] || ''}" placeholder="0">
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div id="ce-fullpack-options">
            <div class="form-group">
              <label>Presentación</label>
              <div class="selection-grid" id="ce-packaging">
                ${Object.entries(PACKAGING_SIZES).map(([key, val]) => `
                  <button type="button" class="selection-btn ${(scenario?.packaging || '250g') === key ? 'active' : ''}"
                    data-value="${key}">${val.label}</button>
                `).join('')}
              </div>
              <input type="hidden" id="ce-packaging-value" value="${scenario?.packaging || '250g'}">
            </div>
            <div class="form-group">
              <label>Cantidad (unidades)</label>
              <input type="number" id="ce-quantity" class="form-control" min="1" value="${scenario?.quantity || 1}">
            </div>
            <div class="form-group">
              <label>Etiquetas</label>
              <div class="selection-grid" id="ce-labels">
                ${Object.entries(LABEL_NAMES).map(([key, name]) => `
                  <button type="button" class="selection-btn ${(scenario?.labelSizes || ['small']).includes(key) ? 'active' : ''}"
                    data-value="${key}">${name}</button>
                `).join('')}
              </div>
              <input type="hidden" id="ce-label-value" value="${(scenario?.labelSizes || ['small']).join(',')}">
            </div>
          </div>

          <div class="form-group">
            <label>Estado del grano</label>
            <div class="selection-grid" id="ce-grind">
              ${Object.entries(GRIND_TYPES).map(([key, val]) => `
                <button type="button" class="selection-btn ${(scenario?.grindType || 'grano') === key ? 'active' : ''}"
                  data-value="${key}">${val.label}</button>
              `).join('')}
            </div>
            <input type="hidden" id="ce-grind-value" value="${scenario?.grindType || 'grano'}">
          </div>

          <hr style="margin:20px 0;border-color:var(--border)">

          <div class="form-group">
            <label>¿Cómo define su ganancia?</label>
            <div class="selection-grid" id="ce-target-mode">
              <button type="button" class="selection-btn active" data-value="margin">Margen %</button>
              <button type="button" class="selection-btn" data-value="profit_amount">Ganancia $ por unidad</button>
              <button type="button" class="selection-btn" data-value="target_price">Precio venta objetivo</button>
            </div>
            <input type="hidden" id="ce-target-mode-value" value="${scenario?.targetMode || 'margin'}">
          </div>

          <div class="form-group" id="ce-target-input-wrap">
            <label id="ce-target-label">Margen de ganancia (%)</label>
            <input type="number" id="ce-target-value" class="form-control"
              min="${PROFIT_MARGIN_MIN}" max="${PROFIT_MARGIN_MAX}" step="1"
              value="${scenario?.targetValue ?? scenario?.profitMargin ?? PROFIT_MARGIN_DEFAULT}">
            <div class="selection-grid" style="margin-top:8px" id="ce-margin-quick">
              ${PROFIT_MARGIN_QUICK.map((m) => `
                <button type="button" class="selection-btn" data-value="${m}">${m}%</button>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Notas / aprendizajes</label>
            <textarea id="ce-notes" class="form-control" rows="2"
              placeholder="Ej: Con este proveedor sube $200 la libra si sube el flete">${scenario?.notes || ''}</textarea>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-primary" id="ce-save-scenario">Guardar en memoria</button>
            <button type="button" class="btn btn-secondary" id="ce-save-template">Guardar como plantilla</button>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-header"><span class="card-title">Resumen Empresa</span></div>
            <div id="ce-summary"></div>
          </div>
          <div id="ce-breakdown"></div>
        </div>
      </div>
    `;

    this.bindSimulatorEvents(container);
    this.updateSimulatorPreview();
  },

  bindSimulatorEvents(container) {
    const bindSelection = (gridId, hiddenId, multi = false) => {
      const grid = container.querySelector(`#${gridId}`);
      const hidden = container.querySelector(`#${hiddenId}`);
      if (!grid) return;
      grid.querySelectorAll('.selection-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (multi) {
            btn.classList.toggle('active');
            const selected = [...grid.querySelectorAll('.selection-btn.active')].map((b) => b.dataset.value);
            if (hidden) hidden.value = selected.join(',');
          } else {
            grid.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            if (hidden) hidden.value = btn.dataset.value;
          }
          if (gridId === 'ce-production-mode') this.toggleProductionMode(container);
          this.updateSimulatorPreview();
        });
      });
    };

    bindSelection('ce-production-mode', 'ce-production-mode-value');
    bindSelection('ce-packaging', 'ce-packaging-value');
    bindSelection('ce-grind', 'ce-grind-value');
    bindSelection('ce-labels', 'ce-label-value', true);
    bindSelection('ce-target-mode', 'ce-target-mode-value');

    container.querySelector('#ce-maquila-steps')?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        this.updateSimulatorPreview();
      });
    });

    container.querySelector('#ce-margin-quick')?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('ce-target-mode-value').value = 'margin';
        document.getElementById('ce-target-value').value = btn.dataset.value;
        this.updateTargetModeUI(container);
        this.updateSimulatorPreview();
      });
    });

    ['ce-coffee', 'ce-quantity', 'ce-target-value', 'ce-scenario-name', 'ce-notes'].forEach((id) => {
      container.querySelector(`#${id}`)?.addEventListener('input', () => this.updateSimulatorPreview());
    });
    container.querySelectorAll('[data-ce-mix-size]').forEach((input) => {
      input.addEventListener('input', () => this.updateSimulatorPreview());
    });
    container.querySelectorAll('#ce-client-coffee, #ce-client-packaging').forEach((el) => {
      el?.addEventListener('change', () => this.updateSimulatorPreview());
    });

    container.querySelector('#ce-target-mode')?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelector('#ce-target-mode-value').value = btn.dataset.value;
        this.updateTargetModeUI(container);
        this.updateSimulatorPreview();
      });
    });

    container.querySelector('#ce-save-scenario')?.addEventListener('click', () => this.saveFromSimulator());
    container.querySelector('#ce-save-template')?.addEventListener('click', () => this.saveTemplateFromSimulator());

    this.updateTargetModeUI(container);
    if (container.querySelector('#ce-target-mode-value')?.value !== 'margin') {
      container.querySelectorAll('#ce-target-mode .selection-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.value === container.querySelector('#ce-target-mode-value').value);
      });
    }
  },

  toggleProductionMode(container) {
    const mode = container.querySelector('#ce-production-mode-value')?.value || 'full_pack';
    container.querySelector('#ce-maquila-options').style.display = mode === 'maquila' ? 'block' : 'none';
    container.querySelector('#ce-fullpack-options').style.display = mode === 'full_pack' ? 'block' : 'none';
  },

  updateTargetModeUI(container) {
    const mode = container.querySelector('#ce-target-mode-value')?.value || 'margin';
    const label = container.querySelector('#ce-target-label');
    const input = container.querySelector('#ce-target-value');
    const quick = container.querySelector('#ce-margin-quick');
    if (mode === 'profit_amount') {
      label.textContent = 'Ganancia deseada por unidad ($ COP)';
      input.removeAttribute('min');
      input.removeAttribute('max');
      if (quick) quick.style.display = 'none';
    } else if (mode === 'target_price') {
      label.textContent = 'Precio de venta objetivo ($ COP)';
      input.removeAttribute('min');
      input.removeAttribute('max');
      if (quick) quick.style.display = 'none';
    } else {
      label.textContent = 'Margen de ganancia (%)';
      input.min = PROFIT_MARGIN_MIN;
      input.max = PROFIT_MARGIN_MAX;
      if (quick) quick.style.display = '';
    }
  },

  updateSimulatorPreview() {
    const coffeeId = document.getElementById('ce-coffee')?.value;
    const summary = document.getElementById('ce-summary');
    const breakdown = document.getElementById('ce-breakdown');
    if (!coffeeId || !summary || !breakdown) return;

    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    const options = this.buildInternalOptions();
    const packaging = document.getElementById('ce-packaging-value')?.value || '250g';
    const labels = parseLabelSelection(document.getElementById('ce-label-value')?.value);
    const quantity = parseInt(document.getElementById('ce-quantity')?.value || '1', 10);
    const targetMode = document.getElementById('ce-target-mode-value')?.value || 'margin';
    const targetValue = document.getElementById('ce-target-value')?.value;

    const costOnly = this.computePricing(coffee, options, packaging, labels, 0, quantity);
    if (!costOnly) {
      summary.innerHTML = '<p class="form-hint">Indique cantidades por presentación.</p>';
      breakdown.innerHTML = '';
      return;
    }

    const unitCost = options.productionMode === 'maquila'
      ? (costOnly.totalCost / (costOnly.totalQuantity || 1))
      : costOnly.totalCost;
    const margin = this.getTargetMargin(unitCost, targetMode, targetValue);
    const pricing = this.computePricing(coffee, options, packaging, labels, margin, quantity);
    if (!pricing) return;

    const sellUnit = options.productionMode === 'maquila' ? pricing.avgUnitPrice : pricing.finalPrice;
    const totalCost = options.productionMode === 'maquila' ? pricing.totalCost : pricing.totalCost * quantity;
    const totalRevenue = options.productionMode === 'maquila' ? pricing.totalPrice : sellUnit * quantity;
    const profit = totalRevenue - totalCost;
    const revenueMargin = marginOnRevenueFromMarkup(margin);

    summary.innerHTML = `
      <div class="stat-card" style="margin-bottom:12px">
        <div class="stat-value">${formatCurrency(totalCost)}</div>
        <div class="stat-label">Inversión total empresa</div>
      </div>
      <div class="grid-2" style="gap:12px">
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(unitCost)}</div>
          <div class="stat-label">Costo por unidad</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(sellUnit)}</div>
          <div class="stat-label">Precio venta sugerido</div>
        </div>
      </div>
      <div style="margin-top:16px">
        <div class="cost-row"><span class="cost-label">Margen sobre costo</span><span><strong>${margin}%</strong></span></div>
        <div class="cost-row"><span class="cost-label">Margen sobre ingreso</span><span>${revenueMargin}%</span></div>
        <div class="cost-row"><span class="cost-label">Ganancia por unidad</span><span>${formatCurrency(sellUnit - unitCost)}</span></div>
        <div class="cost-row"><span class="cost-label">Ganancia total (${options.productionMode === 'maquila' ? pricing.totalQuantity : quantity} uds)</span><span><strong>${formatCurrency(profit)}</strong></span></div>
      </div>
    `;

    const displayQty = options.productionMode === 'maquila' ? pricing.totalQuantity : quantity;
    breakdown.innerHTML = QuotationManager.renderBreakdownHTML(pricing, labels, margin, displayQty);
  },

  saveFromSimulator() {
    const coffeeId = document.getElementById('ce-coffee')?.value;
    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    const options = this.buildInternalOptions();
    const packaging = document.getElementById('ce-packaging-value')?.value || '250g';
    const labels = parseLabelSelection(document.getElementById('ce-label-value')?.value);
    const quantity = parseInt(document.getElementById('ce-quantity')?.value || '1', 10);
    const targetMode = document.getElementById('ce-target-mode-value')?.value || 'margin';
    const targetValue = document.getElementById('ce-target-value')?.value;
    const name = document.getElementById('ce-scenario-name')?.value?.trim()
      || `${coffee.name} · ${options.productionMode === 'maquila' ? 'Maquila' : PACKAGING_SIZES[packaging]?.label}`;

    const costOnly = this.computePricing(coffee, options, packaging, labels, 0, quantity);
    const unitCost = options.productionMode === 'maquila'
      ? (costOnly.totalCost / (costOnly.totalQuantity || 1))
      : costOnly.totalCost;
    const margin = this.getTargetMargin(unitCost, targetMode, targetValue);
    const pricing = this.computePricing(coffee, options, packaging, labels, margin, quantity);

    const scenario = {
      id: this.editingScenarioId || undefined,
      name,
      notes: document.getElementById('ce-notes')?.value || '',
      coffeeId,
      coffeeName: coffee.name,
      packaging: options.productionMode === 'full_pack' ? packaging : null,
      packagingMix: options.productionMode === 'maquila' ? pricing.packagingMix : null,
      quantity: options.productionMode === 'full_pack' ? quantity : pricing.totalQuantity,
      productionMode: options.productionMode,
      grindType: options.grindType,
      maquilaSteps: options.maquilaSteps,
      clientProvidesCoffee: options.clientProvidesCoffee,
      clientProvidesPackaging: options.clientProvidesPackaging,
      labelSizes: labels,
      profitMargin: margin,
      targetMode,
      targetValue: parseFloat(String(targetValue).replace(/[^\d.-]/g, '')) || margin,
      unitCost,
      unitPrice: options.productionMode === 'maquila' ? pricing.avgUnitPrice : pricing.finalPrice,
      totalCost: options.productionMode === 'maquila' ? pricing.totalCost : pricing.totalCost * quantity,
      totalPrice: options.productionMode === 'maquila' ? pricing.totalPrice : pricing.finalPrice * quantity,
      revenueMargin: marginOnRevenueFromMarkup(margin)
    };

    const saved = this.saveScenario(scenario);
    this.editingScenarioId = saved.id;
    Toast.show('Escenario guardado en memoria activa', 'success');
  },

  saveTemplateFromSimulator() {
    const name = prompt('Nombre de la plantilla:', document.getElementById('ce-scenario-name')?.value || 'Plantilla');
    if (!name?.trim()) return;

    const options = this.buildInternalOptions();
    const packaging = document.getElementById('ce-packaging-value')?.value || '250g';
    const labels = parseLabelSelection(document.getElementById('ce-label-value')?.value);
    const margin = clampProfitMargin(document.getElementById('ce-target-value')?.value);

    this.saveTemplate({
      name: name.trim(),
      description: document.getElementById('ce-notes')?.value || '',
      productionMode: options.productionMode,
      grindType: options.grindType,
      maquilaSteps: options.maquilaSteps,
      clientProvidesCoffee: options.clientProvidesCoffee,
      clientProvidesPackaging: options.clientProvidesPackaging,
      packaging,
      labelSizes: labels,
      defaultMargin: margin
    });
  },

  loadScenario(id) {
    this.editingScenarioId = id;
    this.activeTab = 'simulator';
    this.render(document.getElementById('cost-engine-container'));
  },

  loadTemplate(id) {
    const template = this.getTemplates().find((t) => t.id === id);
    if (!template) return;
    this.editingScenarioId = null;
    this.activeTab = 'simulator';
    this.render(document.getElementById('cost-engine-container'));
    setTimeout(() => {
      document.getElementById('ce-production-mode-value').value = template.productionMode;
      document.getElementById('ce-grind-value').value = template.grindType;
      document.getElementById('ce-packaging-value').value = template.packaging || '250g';
      document.getElementById('ce-label-value').value = (template.labelSizes || ['small']).join(',');
      document.getElementById('ce-target-value').value = template.defaultMargin || PROFIT_MARGIN_DEFAULT;
      document.getElementById('ce-scenario-name').value = template.name;
      document.getElementById('ce-notes').value = template.description || '';
      if (template.clientProvidesCoffee) document.getElementById('ce-client-coffee').checked = true;
      if (template.clientProvidesPackaging === false) document.getElementById('ce-client-packaging').checked = false;
      this.toggleProductionMode(document.getElementById('cost-engine-container'));
      this.updateSimulatorPreview();
      Toast.show(`Plantilla "${template.name}" cargada`, 'info');
    }, 50);
  },

  renderMemoryTab(container) {
    const scenarios = [...this.getScenarios()].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Memoria Activa — Escenarios Guardados</span>
          <span class="badge badge-neutral">${scenarios.length}</span>
        </div>
        <p class="form-hint" style="margin-bottom:16px">
          Historial de costeos internos. Use estos datos como referencia al cotizar maquila y mejorar decisiones.
        </p>
        ${scenarios.length === 0 ? `
          <p class="form-hint">Aún no hay escenarios. Use el Simulador Interno y pulse "Guardar en memoria".</p>
        ` : `
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Café</th>
                  <th>Modo</th>
                  <th>Costo ud.</th>
                  <th>Margen</th>
                  <th>Precio ud.</th>
                  <th>Actualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${scenarios.map((s) => `
                  <tr>
                    <td><strong>${s.name}</strong>${s.notes ? `<br><small class="form-hint">${s.notes}</small>` : ''}</td>
                    <td>${s.coffeeName || '—'}</td>
                    <td><span class="badge badge-neutral">${PRODUCTION_MODES[s.productionMode]?.label || s.productionMode}</span></td>
                    <td>${formatCurrency(s.unitCost)}</td>
                    <td>${s.profitMargin}% <small>(${s.revenueMargin || marginOnRevenueFromMarkup(s.profitMargin)}% ing.)</small></td>
                    <td>${formatCurrency(s.unitPrice)}</td>
                    <td>${formatDate(s.updatedAt || s.createdAt)}</td>
                    <td style="white-space:nowrap">
                      <button class="btn btn-sm btn-secondary" onclick="CostEngine.loadScenario('${s.id}')">Abrir</button>
                      <button class="btn btn-sm btn-danger" onclick="CostEngine.deleteScenario('${s.id}')">×</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  renderMaquilaTab(container) {
    const quotations = QuotationManager.getAll().filter((q) => q.productionMode === 'maquila' || q.packagingMix);
    const scenarios = this.getScenarios();
    const reference = scenarios.find((s) => s.productionMode === 'full_pack') || scenarios[0];

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Referencia interna</span></div>
        ${reference ? `
          <p>Escenario base: <strong>${reference.name}</strong> — costo ${formatCurrency(reference.unitCost)}/ud · margen ${reference.profitMargin}%</p>
        ` : `
          <p class="form-hint">Guarde un escenario en memoria para comparar cotizaciones de maquila contra su costo real.</p>
        `}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Cotizaciones Maquila vs Costeo Interno</span>
        </div>
        ${quotations.length === 0 ? `
          <p class="form-hint">No hay cotizaciones de maquila registradas.</p>
        ` : `
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Cliente</th>
                  <th>Costo cotizado</th>
                  <th>Precio cliente</th>
                  <th>Margen</th>
                  ${reference ? '<th>vs Referencia</th>' : ''}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${quotations.map((q) => {
                  const unitCost = q.unitCost || (q.totalCost / (q.quantity || q.totalQuantity || 1));
                  const unitPrice = q.unitPrice || (q.totalPrice / (q.quantity || q.totalQuantity || 1));
                  const margin = q.profitMargin || 0;
                  let vsRef = '';
                  if (reference) {
                    const diff = unitCost - reference.unitCost;
                    const pct = reference.unitCost > 0 ? ((diff / reference.unitCost) * 100).toFixed(1) : '—';
                    const cls = diff > 0 ? 'var(--danger)' : 'var(--success)';
                    vsRef = `<span style="color:${cls}">${diff >= 0 ? '+' : ''}${formatCurrency(diff)} (${pct}%)</span>`;
                  }
                  return `
                    <tr>
                      <td>${q.number}</td>
                      <td>${q.clientName}</td>
                      <td>${formatCurrency(unitCost)}</td>
                      <td>${formatCurrency(unitPrice)}</td>
                      <td>${margin}%</td>
                      ${reference ? `<td>${vsRef}</td>` : ''}
                      <td>
                        <button class="btn btn-sm btn-secondary" onclick="QuotationManager.view('${q.id}')">Ver</button>
                        <button class="btn btn-sm btn-primary" onclick="CostEngine.linkQuotationToScenario('${q.id}')">Guardar análisis</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  linkQuotationToScenario(quotationId) {
    const q = QuotationManager.getById(quotationId);
    if (!q) return;
    const scenarios = this.getScenarios();
    const reference = scenarios.find((s) => s.productionMode === 'full_pack') || scenarios[0];
    const unitCost = q.unitCost || (q.totalCost / (q.quantity || q.totalQuantity || 1));
    const unitPrice = q.unitPrice || (q.totalPrice / (q.totalQuantity || q.quantity || 1));

    let analysisNote = `Análisis maquila ${q.number}: costo ${formatCurrency(unitCost)}/ud, precio ${formatCurrency(unitPrice)}, margen ${q.profitMargin || 0}%`;
    if (reference) {
      const diff = unitCost - reference.unitCost;
      analysisNote += `. vs referencia "${reference.name}": ${diff >= 0 ? '+' : ''}${formatCurrency(diff)}/ud`;
    }

    this.saveScenario({
      name: `Maquila ${q.number} — ${q.clientName}`,
      notes: analysisNote,
      coffeeId: q.coffeeId,
      coffeeName: q.coffeeName,
      productionMode: 'maquila',
      packagingMix: q.packagingMix,
      packaging: q.packaging,
      quantity: q.totalQuantity || q.quantity,
      profitMargin: q.profitMargin || 0,
      unitCost,
      unitPrice,
      totalCost: q.totalCost,
      totalPrice: q.totalPrice,
      linkedQuotationId: q.id,
      grindType: q.grindType || 'grano',
      maquilaSteps: q.maquilaSteps || [],
      clientProvidesCoffee: q.clientProvidesCoffee,
      clientProvidesPackaging: q.clientProvidesPackaging
    });

    Toast.show('Análisis guardado en memoria', 'success');
    this.activeTab = 'memory';
    this.render(document.getElementById('cost-engine-container'));
  },

  renderTemplatesTab(container) {
    const templates = this.getTemplates();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Plantillas de Proceso</span>
          <span class="badge badge-neutral">${templates.length}</span>
        </div>
        <p class="form-hint" style="margin-bottom:16px">
          Configuraciones reutilizables de transformación. Cárguelas en el simulador para acelerar el costeo.
        </p>
        ${templates.length === 0 ? `
          <p class="form-hint">Cree plantillas desde el Simulador Interno con "Guardar como plantilla".</p>
        ` : `
          <div class="grid-3" style="gap:12px">
            ${templates.map((t) => `
              <div class="card" style="padding:16px">
                <strong>${t.name}</strong>
                <p class="form-hint" style="margin:8px 0">${PRODUCTION_MODES[t.productionMode]?.label || t.productionMode} · Margen ${t.defaultMargin || PROFIT_MARGIN_DEFAULT}%</p>
                ${t.description ? `<p style="font-size:0.9em">${t.description}</p>` : ''}
                <div style="margin-top:12px;display:flex;gap:8px">
                  <button class="btn btn-sm btn-primary" onclick="CostEngine.loadTemplate('${t.id}')">Usar</button>
                  <button class="btn btn-sm btn-danger" onclick="CostEngine.deleteTemplate('${t.id}')">Eliminar</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }
};
