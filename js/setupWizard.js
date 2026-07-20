const SetupWizard = {
  currentStep: 0,
  totalSteps: 4,
  _pendingSection: null,
  _pendingOptions: null,

  getState() {
    return Storage.get(STORAGE_KEYS.PLATFORM_SETUP) || { ...DEFAULT_PLATFORM_SETUP };
  },

  isComplete() {
    return this.getState().completed === true;
  },

  hasOperationalData() {
    const dataKeys = [
      STORAGE_KEYS.COFFEES,
      STORAGE_KEYS.CLIENTS,
      STORAGE_KEYS.SUPPLIERS,
      STORAGE_KEYS.INVENTORY,
      STORAGE_KEYS.QUOTATIONS,
      STORAGE_KEYS.SALES,
      STORAGE_KEYS.PURCHASES
    ];

    return dataKeys.some((key) => {
      const data = Storage.get(key);
      return Array.isArray(data) && data.length > 0;
    });
  },

  hasConfiguredCosts() {
    const costs = migrateProductionCosts(Storage.get(STORAGE_KEYS.PRODUCTION_COSTS));
    if (!costs) return false;

    const t = costs.transformation || {};
    const numericValues = [
      t.trilla,
      t.greenSelection,
      t.roasting,
      t.selection,
      t.grinding,
      t.packagingLabor?.['250g'],
      t.packagingLabor?.['500g'],
      t.packagingLabor?.['5lb'],
      costs.mermas?.trilla,
      costs.mermas?.greenSelection,
      costs.mermas?.tostion,
      costs.mermas?.seleccion,
      costs.packaging?.['250g'],
      costs.packaging?.['500g'],
      costs.packaging?.['5lb'],
      costs.labels?.small,
      costs.labels?.large
    ];

    return numericValues.some((value) => Number(value) > 0);
  },

  hasCustomSettings() {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS);
    if (!settings) return false;

    return settings.companyName !== DEFAULT_SETTINGS.companyName
      || settings.email !== DEFAULT_SETTINGS.email
      || settings.tagline !== DEFAULT_SETTINGS.tagline
      || Boolean(settings.logo);
  },

  shouldTreatAsComplete() {
    if (this.isComplete()) return true;
    return this.hasOperationalData() || this.hasConfiguredCosts() || this.hasCustomSettings();
  },

  autoCompleteIfNeeded(options = {}) {
    if (this.isComplete()) return true;
    if (!this.shouldTreatAsComplete()) return false;

    this.markComplete();
    this.close();

    const pending = this._pendingSection;
    const pendingOpts = this._pendingOptions;
    this._pendingSection = null;
    this._pendingOptions = null;

    if (pending && typeof App !== 'undefined') {
      setTimeout(() => App.navigateTo(pending, pendingOpts || {}), 0);
    } else if (typeof App !== 'undefined') {
      App.applySettings();
      App.renderSection(App.currentSection);
    }

    if (!options.silent) {
      Toast?.show('Configuración detectada desde datos sincronizados', 'success');
    }

    return true;
  },

  saveState(partial) {
    const next = { ...this.getState(), ...partial };
    Storage.set(STORAGE_KEYS.PLATFORM_SETUP, next, { immediate: true });
  },

  markComplete() {
    const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
    this.saveState({
      completed: true,
      step: this.totalSteps,
      completedAt: new Date().toISOString(),
      completedBy: session?.userId || session?.name || null
    });
  },

  getPipelineParameterCatalog() {
    const categories = [
      {
        id: 'compra',
        label: 'Compra al caficultor',
        count: 8,
        items: [
          'Precio por kg (FOB origen)',
          'Costo de transporte / flete',
          'Transporte incluido en precio (sí/no)',
          'Estado de llegada (verde, pergamino, tostado…)',
          'Variedad, proceso, región, productor',
          'Proveedor de café vinculado',
          'Notas de calidad / lote',
          'Entrada a inventario (kg por etapa)'
        ]
      },
      {
        id: 'transformacion',
        label: 'Transformación (por kg o unidad)',
        count: 14,
        items: [
          'Trilla ($/kg)',
          'Selección en verde ($/kg)',
          'Tostión ($/kg)',
          'Selección post-tostión ($/kg)',
          'Molienda ($/lb)',
          'Empacada — mano de obra 250g / 500g / 5lb',
          'Mermas: trilla, selección verde, tostión, selección',
          'Proveedor por etapa (8 slots)'
        ]
      },
      {
        id: 'empaque',
        label: 'Empaque y etiquetas',
        count: 7,
        items: [
          'Material empaque 250g / 500g / 5lb',
          'Etiqueta pequeña / grande',
          'Mix de presentaciones en cotización',
          'Cliente aporta empaque (maquila)',
          'Costo total por unidad empacada',
          'Unidades por tamaño en inventario',
          'Negociación administrativa ($/kg)'
        ]
      },
      {
        id: 'cotizacion',
        label: 'Cotización y modos de producción',
        count: 12,
        items: [
          'Modo Full Pack vs Maquila',
          'Pasos de maquila seleccionables',
          'Tipo de molienda (grano / molido)',
          'Margen de ganancia (markup %)',
          'Tipo de cliente (final, mayorista, distribuidor)',
          'Multiplicador por tipo de cliente',
          'Cantidad y presentación',
          'Cliente aporta café (maquila)',
          'Desglose de costos por etapa',
          'Precio unitario y total',
          'Escenarios de costo guardados',
          'Plantillas de proceso'
        ]
      },
      {
        id: 'inventario',
        label: 'Pipeline de inventario',
        count: 5,
        items: [
          'Verde / pergamino (kg)',
          'Tostado (kg)',
          'Seleccionado (kg)',
          'Molido (kg)',
          'Empacado (uds por tamaño)'
        ]
      },
      {
        id: 'global',
        label: 'Configuración global',
        count: 6,
        items: [
          'Nombre empresa, email, logo',
          'Umbral stock bajo',
          'Incremento de costo opcional',
          'Hero del dashboard',
          'Sincronización Firebase',
          'Auditoría de movimientos'
        ]
      }
    ];

    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);
    return { categories, totalCount };
  },

  shouldInterceptNavigation(section) {
    if (this.isComplete()) return false;
    if (section === 'settings' || section === 'dashboard' || section === 'glossary' || section === 'workflow') return false;
    return true;
  },

  open(options = {}) {
    if (options.force || !this.isComplete()) {
      this.currentStep = options.step ?? this.getState().step ?? 0;
      this.render();
      document.getElementById('setup-wizard-overlay')?.classList.add('active');
      document.body.classList.add('setup-wizard-open');
    }
  },

  close() {
    document.getElementById('setup-wizard-overlay')?.classList.remove('active');
    document.body.classList.remove('setup-wizard-open');
  },

  bindNavigationIntercept() {
    if (this._bound) return;
    this._bound = true;

    const originalNavigate = App.navigateTo.bind(App);
    App.navigateTo = (section, options = {}) => {
      if (this.shouldInterceptNavigation(section)) {
        this._pendingSection = section;
        this._pendingOptions = options;
        this.open();
        Toast?.show('Complete la configuración inicial para usar esta sección', 'warning');
        return;
      }
      originalNavigate(section, options);
    };
  },

  render() {
    const container = document.getElementById('setup-wizard-body');
    if (!container) return;

    const catalog = this.getPipelineParameterCatalog();
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const costs = migrateProductionCosts(Storage.get(STORAGE_KEYS.PRODUCTION_COSTS));

    const stepLabels = ['Identidad', 'Costos base', 'Pipeline café', 'Listo'];
    const progress = Math.round(((this.currentStep + 1) / this.totalSteps) * 100);

    let bodyHtml = '';

    if (this.currentStep === 0) {
      bodyHtml = `
        <p class="setup-wizard-intro">
          Bienvenido. Antes de operar la plataforma, configure los datos básicos de su negocio.
          Puede ajustar todo después en <strong>Configuración</strong> y <strong>Costos</strong>.
        </p>
        <div class="form-group">
          <label>Nombre de la empresa</label>
          <input type="text" class="form-control" id="setup-company" value="${settings.companyName || ''}">
        </div>
        <div class="form-group">
          <label>Correo de notificaciones</label>
          <input type="email" class="form-control" id="setup-email" value="${settings.email || ''}">
        </div>
        <div class="form-group">
          <label>Eslogan (opcional)</label>
          <input type="text" class="form-control" id="setup-tagline" value="${settings.tagline || ''}">
        </div>
        <div class="form-group">
          <label>Umbral de stock bajo (kg)</label>
          <input type="number" class="form-control" id="setup-low-stock" min="0" step="0.1" value="${settings.lowStockThreshold ?? 0}">
        </div>
      `;
    } else if (this.currentStep === 1) {
      bodyHtml = `
        <p class="setup-wizard-intro">
          Tarifas estándar de transformación y empaque. <strong>Seleccione un valor</strong> o ingrese uno personalizado.
          Use <strong>0</strong> si aún no las conoce.
        </p>
        <div class="setup-cost-grid">
          ${renderStandardNumberField({ id: 'setup-trilla', label: 'Trilla ($/kg)', value: costs.transformation.trilla, quickValues: STANDARD_COST_KG_QUICK, step: 100, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-greenSelection', label: 'Selección verde ($/kg)', value: costs.transformation.greenSelection, quickValues: STANDARD_COST_KG_QUICK, step: 100, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-roasting', label: 'Tostión ($/kg)', value: costs.transformation.roasting, quickValues: STANDARD_COST_KG_QUICK, step: 100, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-selection', label: 'Selección post-tostión ($/kg)', value: costs.transformation.selection, quickValues: STANDARD_COST_KG_QUICK, step: 100, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-grinding', label: 'Molienda ($/lb)', value: costs.transformation.grinding, quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-pack-250', label: 'MO empacado 250g ($/ud)', value: costs.transformation.packagingLabor['250g'], quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-pack-500', label: 'MO empacado 500g ($/ud)', value: costs.transformation.packagingLabor['500g'], quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-pack-5lb', label: 'MO empacado 5lb ($/ud)', value: costs.transformation.packagingLabor['5lb'], quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
        </div>
        <h4 class="setup-subtitle">Mermas (%)</h4>
        <div class="setup-cost-grid setup-cost-grid--4">
          ${renderStandardNumberField({ id: 'setup-merma-trilla', label: 'Trilla', value: costs.mermas.trilla, quickValues: STANDARD_MERMA_QUICK, step: 0.1, min: 0, max: 100, suffix: '%' })}
          ${renderStandardNumberField({ id: 'setup-merma-green', label: 'Selección verde', value: costs.mermas.greenSelection, quickValues: STANDARD_MERMA_QUICK, step: 0.1, min: 0, max: 100, suffix: '%' })}
          ${renderStandardNumberField({ id: 'setup-merma-tostion', label: 'Tostión', value: costs.mermas.tostion, quickValues: STANDARD_MERMA_QUICK, step: 0.1, min: 0, max: 100, suffix: '%' })}
          ${renderStandardNumberField({ id: 'setup-merma-seleccion', label: 'Selección', value: costs.mermas.seleccion, quickValues: STANDARD_MERMA_QUICK, step: 0.1, min: 0, max: 100, suffix: '%' })}
        </div>
        <h4 class="setup-subtitle">Material de empaque ($/ud)</h4>
        <div class="setup-cost-grid setup-cost-grid--3">
          ${renderStandardNumberField({ id: 'setup-mat-250', label: '250g', value: costs.packaging['250g'], quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-mat-500', label: '500g', value: costs.packaging['500g'], quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-mat-5lb', label: '5lb', value: costs.packaging['5lb'], quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
        </div>
        <div class="setup-cost-grid setup-cost-grid--2">
          ${renderStandardNumberField({ id: 'setup-label-small', label: 'Etiqueta pequeña ($/ud)', value: costs.labels.small, quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
          ${renderStandardNumberField({ id: 'setup-label-large', label: 'Etiqueta grande ($/ud)', value: costs.labels.large, quickValues: STANDARD_COST_UNIT_QUICK, step: 50, min: 0 })}
        </div>
      `;
    } else if (this.currentStep === 2) {
      bodyHtml = `
        <p class="setup-wizard-intro">
          La plataforma modela el café desde la <strong>compra al caficultor</strong> hasta el
          <strong>producto empacado</strong>, con modos <strong>Full Pack</strong>, <strong>Maquila</strong> y precios por
          <strong>mayorista / distribuidor</strong>.
        </p>
        <div class="setup-param-summary">
          <div class="setup-param-total">
            <span class="setup-param-total-num">${catalog.totalCount}</span>
            <span>parámetros configurables en el pipeline</span>
          </div>
        </div>
        <div class="setup-pipeline-flow">
          <span>🌱 Compra</span><span>→</span>
          <span>⚙️ Trilla</span><span>→</span>
          <span>✨ Selección</span><span>→</span>
          <span>🔥 Tostión</span><span>→</span>
          <span>✨ Selección</span><span>→</span>
          <span>⚙️ Molienda</span><span>→</span>
          <span>📦 Empaque</span>
        </div>
        <div class="setup-catalog-grid">
          ${catalog.categories.map((cat) => `
            <details class="setup-catalog-card">
              <summary><strong>${cat.label}</strong> <span class="badge">${cat.count} params</span></summary>
              <ul>${cat.items.map((item) => `<li>${item}</li>`).join('')}</ul>
            </details>
          `).join('')}
        </div>
        <div class="setup-mode-cards">
          <div class="setup-mode-card">
            <h4>Full Pack</h4>
            <p>Café + logística + transformación completa + empaque con materiales propios.</p>
          </div>
          <div class="setup-mode-card">
            <h4>Maquila</h4>
            <p>Cliente aporta café y/o empaque; se cobra transformación y mano de obra.</p>
          </div>
          <div class="setup-mode-card">
            <h4>Tipos de cliente</h4>
            <p>Final (×1.0), Mayorista (×0.85), Distribuidor (×0.75) sobre precio base.</p>
          </div>
        </div>
        <p class="form-hint">Los proveedores, cafés y clientes los agregará después según necesidad.</p>
      `;
    } else {
      bodyHtml = `
        <div class="setup-complete">
          <div class="setup-complete-icon">✅</div>
          <h3>Configuración base lista</h3>
          <p>Puede comenzar a registrar cafés, proveedores, inventario y cotizaciones.</p>
          <ul class="setup-complete-list">
            <li>Agregue su primer café en <strong>Cafés</strong></li>
            <li>Registre proveedores de transformación en <strong>Proveedores</strong></li>
            <li>Entrada de compra en <strong>Inventario → Verde</strong></li>
            <li>Genere cotizaciones Full Pack o Maquila</li>
          </ul>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="setup-wizard-progress">
        <div class="setup-wizard-progress-bar" style="width:${progress}%"></div>
      </div>
      <div class="setup-wizard-steps">
        ${stepLabels.map((label, i) => `
          <span class="setup-wizard-step ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'done' : ''}">${i + 1}. ${label}</span>
        `).join('')}
      </div>
      <div class="setup-wizard-content">${bodyHtml}</div>
    `;

    const backBtn = document.getElementById('setup-wizard-back');
    const nextBtn = document.getElementById('setup-wizard-next');
    if (backBtn) backBtn.style.display = this.currentStep === 0 ? 'none' : '';
    if (nextBtn) {
      nextBtn.textContent = this.currentStep === this.totalSteps - 1 ? 'Comenzar a operar' : 'Siguiente';
    }

    this.saveState({ step: this.currentStep });

    if (this.currentStep === 1) {
      bindStandardNumberFields([
        'setup-trilla', 'setup-greenSelection', 'setup-roasting', 'setup-selection', 'setup-grinding',
        'setup-pack-250', 'setup-pack-500', 'setup-pack-5lb',
        'setup-merma-trilla', 'setup-merma-green', 'setup-merma-tostion', 'setup-merma-seleccion',
        'setup-mat-250', 'setup-mat-500', 'setup-mat-5lb', 'setup-label-small', 'setup-label-large'
      ]);
    }
  },

  saveStepData() {
    if (this.currentStep === 0) {
      const settings = {
        ...(Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS),
        companyName: document.getElementById('setup-company')?.value?.trim() || DEFAULT_SETTINGS.companyName,
        email: document.getElementById('setup-email')?.value?.trim() || DEFAULT_SETTINGS.email,
        tagline: document.getElementById('setup-tagline')?.value?.trim() || DEFAULT_SETTINGS.tagline,
        lowStockThreshold: parseFloat(document.getElementById('setup-low-stock')?.value) || 0
      };
      Storage.set(STORAGE_KEYS.SETTINGS, settings, { immediate: true });
      if (typeof EmailService !== 'undefined') {
        EmailService.email = settings.email;
      }
      if (typeof App !== 'undefined') {
        App.applySettings();
      }
    }

    if (this.currentStep === 1) {
      const costs = migrateProductionCosts(Storage.get(STORAGE_KEYS.PRODUCTION_COSTS));
      const updated = {
        ...costs,
        transformation: {
          ...costs.transformation,
          trilla: parseFloat(document.getElementById('setup-trilla')?.value) || 0,
          greenSelection: parseFloat(document.getElementById('setup-greenSelection')?.value) || 0,
          roasting: parseFloat(document.getElementById('setup-roasting')?.value) || 0,
          selection: parseFloat(document.getElementById('setup-selection')?.value) || 0,
          grinding: parseFloat(document.getElementById('setup-grinding')?.value) || 0,
          packagingLabor: {
            '250g': parseFloat(document.getElementById('setup-pack-250')?.value) || 0,
            '500g': parseFloat(document.getElementById('setup-pack-500')?.value) || 0,
            '5lb': parseFloat(document.getElementById('setup-pack-5lb')?.value) || 0
          }
        },
        mermas: {
          trilla: parseFloat(document.getElementById('setup-merma-trilla')?.value) || 0,
          greenSelection: parseFloat(document.getElementById('setup-merma-green')?.value) || 0,
          tostion: parseFloat(document.getElementById('setup-merma-tostion')?.value) || 0,
          seleccion: parseFloat(document.getElementById('setup-merma-seleccion')?.value) || 0
        },
        packaging: {
          '250g': parseFloat(document.getElementById('setup-mat-250')?.value) || 0,
          '500g': parseFloat(document.getElementById('setup-mat-500')?.value) || 0,
          '5lb': parseFloat(document.getElementById('setup-mat-5lb')?.value) || 0
        },
        labels: {
          small: parseFloat(document.getElementById('setup-label-small')?.value) || 0,
          large: parseFloat(document.getElementById('setup-label-large')?.value) || 0
        },
        lastUpdated: new Date().toISOString()
      };
      Storage.set(STORAGE_KEYS.PRODUCTION_COSTS, updated, { immediate: true });
    }
  },

  next() {
    this.saveStepData();

    if (this.currentStep >= this.totalSteps - 1) {
      this.finish();
      return;
    }

    this.currentStep += 1;
    this.render();
  },

  back() {
    if (this.currentStep <= 0) return;
    this.currentStep -= 1;
    this.render();
  },

  finish() {
    this.markComplete();
    this.close();
    Toast?.show('Configuración inicial completada', 'success');
    window.dispatchEvent(new CustomEvent('bca-data-changed'));

    const pending = this._pendingSection;
    const pendingOpts = this._pendingOptions;
    this._pendingSection = null;
    this._pendingOptions = null;

    if (pending && typeof App !== 'undefined') {
      App.navigateTo(pending, pendingOpts || {});
    } else if (typeof App !== 'undefined') {
      App.renderSection(App.currentSection);
      App.applySettings();
    }
  },

  init(options = {}) {
    document.getElementById('setup-wizard-back')?.addEventListener('click', () => this.back());
    document.getElementById('setup-wizard-next')?.addEventListener('click', () => this.next());
    document.getElementById('setup-wizard-skip')?.addEventListener('click', () => {
      if (confirm('¿Omitir por ahora? Las secciones seguirán bloqueadas hasta completar la configuración.')) {
        this.close();
      }
    });

    this.bindNavigationIntercept();
    this.bindSyncRecheck();

    this.autoCompleteIfNeeded({ silent: true });

    if (!this.isComplete() && !options.deferOpen) {
      setTimeout(() => {
        this.autoCompleteIfNeeded({ silent: true });
        if (!this.isComplete()) {
          this.open();
        }
      }, 300);
    }
  },

  bindSyncRecheck() {
    if (this._syncRecheckBound) return;
    this._syncRecheckBound = true;

    const recheck = () => {
      if (this.autoCompleteIfNeeded({ silent: true })) {
        window.dispatchEvent(new CustomEvent('bca-data-changed'));
      }
    };

    window.addEventListener('bca-sync-complete', recheck);
    window.addEventListener('bca-data-changed', () => {
      if (!this.isComplete()) recheck();
    });
  },

  afterSyncBootstrap() {
    this.autoCompleteIfNeeded({ silent: true });
    if (!this.isComplete()) {
      this.open();
    }
  },

  confirmFactoryReset() {
    const first = confirm(
      '¿Reiniciar TODOS los datos de la plataforma?\n\nSe borrarán cafés, clientes, proveedores, inventario, cotizaciones, ventas y auditoría.\nLos usuarios de acceso NO se eliminan.'
    );
    if (!first) return false;

    const second = confirm(
      'Confirmación final: esta acción no se puede deshacer.\n\n¿Proceder con el reinicio total?'
    );
    return second;
  },

  runFactoryReset() {
    if (!this.confirmFactoryReset()) return;

    DataSeed.factoryReset({ preserveSession: true });
    this.currentStep = 0;
    Toast?.show('Plataforma reiniciada. Complete la configuración inicial.', 'success');
    this.open({ force: true });

    if (typeof App !== 'undefined') {
      App.applySettings();
      App.navigateTo('dashboard');
    }
  }
};
