const AdminConfig = {
  isAdmin() {
    const role = (Auth.getSession()?.role || '').toLowerCase();
    return role.includes('admin');
  },

  render(container) {
    if (!container) return;

    if (!this.isAdmin()) {
      container.innerHTML = `
        <div class="card">
          <p class="form-hint">Esta sección es solo para administradores. Inicie sesión con una cuenta de administrador.</p>
        </div>`;
      return;
    }

    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const costs = ProductionCosts.get();
    const syncLabel = typeof SyncHub !== 'undefined' ? SyncHub.getStatusLabel() : '—';

    container.innerHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Identidad visual</span></div>
        <p class="form-hint" style="margin-bottom:12px">Logo, colores y textos visibles en la app y cotizaciones PDF.</p>
        <div class="form-group">
          <label>Logo</label>
          <div class="image-upload" id="admin-logo-upload">
            ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="max-height:80px">` : '<p>📷 Clic para subir logo</p>'}
            <input type="file" accept="image/*" id="admin-logo-input" style="display:none">
          </div>
          <input type="hidden" id="admin-logo" value="${settings.logo || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de la empresa</label>
            <input type="text" class="form-control" id="admin-company" value="${settings.companyName || ''}">
          </div>
          <div class="form-group">
            <label>Eslogan</label>
            <input type="text" class="form-control" id="admin-tagline" value="${settings.tagline || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Color de acento (UI)</label>
            <input type="color" class="form-control" id="admin-accent-color" value="${this._normalizeColor(settings.accentColor, '#e5e5e5')}">
          </div>
          <div class="form-group">
            <label>Color primario de fondo</label>
            <input type="color" class="form-control" id="admin-primary-color" value="${this._normalizeColor(settings.primaryColor, '#141414')}">
          </div>
        </div>
        <div class="form-group">
          <label>Título del dashboard</label>
          <input type="text" class="form-control" id="admin-hero-title" value="${settings.heroTitle || ''}">
        </div>
        <div class="form-group">
          <label>Subtítulo del dashboard</label>
          <textarea class="form-control" id="admin-hero-subtitle" rows="2">${settings.heroSubtitle || ''}</textarea>
        </div>
        <button type="button" class="btn btn-primary" id="admin-save-visual-btn">Guardar identidad visual</button>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Datos y operación</span></div>
        <p class="form-hint" style="margin-bottom:8px"><strong>Sync:</strong> ${syncLabel}</p>
        <p class="form-hint" style="margin-bottom:12px">
          Intervalo automático: <strong>10 segundos</strong>.
          Mermas globales: tostión ${costs.mermas?.tostion || 0}% · selección ${costs.mermas?.seleccion || 0}%.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.navigateTo('costs')">Costos de producción</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.navigateTo('settings')">Configuración completa</button>
          <button type="button" class="btn btn-secondary btn-sm" id="admin-sync-now-btn">Forzar sync ahora</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="BackupManager.download()">Exportar respaldo</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Resumen de registros</span></div>
        <div id="admin-data-summary"></div>
      </div>
    `;

    this.bindEvents();
    this.renderDataSummary();
  },

  _normalizeColor(value, fallback) {
    if (!value || typeof value !== 'string') return fallback;
    if (value.startsWith('#') && (value.length === 7 || value.length === 4)) return value;
    return fallback;
  },

  bindEvents() {
    const logoUpload = document.getElementById('admin-logo-upload');
    const logoInput = document.getElementById('admin-logo-input');
    logoUpload?.addEventListener('click', () => logoInput?.click());
    logoInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById('admin-logo').value = reader.result;
        logoUpload.innerHTML = `<img src="${reader.result}" alt="Logo" style="max-height:80px">`;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('admin-save-visual-btn')?.addEventListener('click', () => this.saveVisual());
    document.getElementById('admin-sync-now-btn')?.addEventListener('click', async () => {
      if (typeof SyncHub !== 'undefined') {
        await SyncHub.forceSync();
        Toast.show('Sincronización iniciada', 'info');
        this.render(document.getElementById('admin-config-container'));
      }
    });
  },

  saveVisual() {
    const current = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const settings = {
      ...current,
      companyName: document.getElementById('admin-company')?.value || DEFAULT_SETTINGS.companyName,
      tagline: document.getElementById('admin-tagline')?.value || DEFAULT_SETTINGS.tagline,
      logo: document.getElementById('admin-logo')?.value || null,
      heroTitle: document.getElementById('admin-hero-title')?.value || DEFAULT_SETTINGS.heroTitle,
      heroSubtitle: document.getElementById('admin-hero-subtitle')?.value || DEFAULT_SETTINGS.heroSubtitle,
      accentColor: document.getElementById('admin-accent-color')?.value || DEFAULT_SETTINGS.accentColor,
      primaryColor: document.getElementById('admin-primary-color')?.value || DEFAULT_SETTINGS.primaryColor
    };

    Storage.set(STORAGE_KEYS.SETTINGS, settings);
    EmailService.email = settings.email;
    App.applySettings();
    Toast.show('Identidad visual guardada', 'success');
  },

  renderDataSummary() {
    const el = document.getElementById('admin-data-summary');
    if (!el) return;

    const counts = {
      Cafés: CoffeeManager.getAll().length,
      Clientes: ClientManager.getAll().length,
      Proveedores: SupplierManager.getAll().length,
      Cotizaciones: QuotationManager.getAll().length,
      Ventas: SalesManager.getAll().length,
      'Items inventario': InventoryManager.getAll().length
    };

    el.innerHTML = `
      <div class="dashboard-stats" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
        ${Object.entries(counts).map(([label, n]) => `
          <div class="stat-card"><div class="stat-value">${n}</div><div class="stat-label">${label}</div></div>
        `).join('')}
      </div>`;
  }
};
