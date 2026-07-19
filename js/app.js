const App = {
  currentSection: 'dashboard',

  init() {
    Auth.init();
    if (!Auth.requireAuth()) {
      return Promise.resolve(false);
    }

    return this.bootstrap().catch((error) => {
      console.error('Error al iniciar la aplicación:', error);
      Toast?.show('Error al cargar la plataforma. Recargue la página.', 'danger');
      throw error;
    });
  },

  async bootstrap() {
    try {
      DataSeed.init();
      EmailService.init();

      this.bindNavigation();
      this.bindModals();
      this.bindSyncEvents();
      this.renderUserInfo();
      this.applySettings();
      this.checkProductionCostsModal();
      Notifications.updateBadge();

      this.navigateTo('dashboard');

      FirebaseSync.startInBackground().finally(() => {
        InventoryManager.checkAllLowStock();
      });
    } catch (error) {
      console.error('Bootstrap falló:', error);
      Toast?.show('No se pudo cargar los datos. Use Configuración o repare el acceso.', 'danger');
      throw error;
    }
  },

  handleNotificationLink(link) {
    if (!link?.section) return;

    Notifications.closePanel();

    this.navigateTo(link.section);

    if (!link.entityId && !link.action) return;

    setTimeout(() => {
      const { section, entityId, action } = link;

      switch (section) {
        case 'quotations':
          if (action === 'view' && entityId) QuotationManager.view(entityId);
          break;
        case 'coffees':
          if (action === 'edit' && entityId) CoffeeManager.edit(entityId);
          break;
        case 'clients':
          if (action === 'edit' && entityId) ClientManager.edit(entityId);
          break;
        case 'suppliers':
          if (action === 'edit' && entityId) SupplierManager.edit(entityId);
          break;
        case 'inventory':
          if (action === 'purchase' && entityId) InventoryManager.showPurchaseForm(entityId);
          else if (action === 'roast' && entityId) InventoryManager.showRoastForm(entityId);
          break;
        case 'sales':
          if (entityId) {
            const row = document.querySelector(`[data-sale-id="${entityId}"]`);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row?.classList.add('highlight-row');
            setTimeout(() => row?.classList.remove('highlight-row'), 2000);
          }
          break;
        case 'costs':
          break;
        default:
          break;
      }
    }, 150);
  },

  bindSyncEvents() {
    window.addEventListener('bca-data-changed', () => {
      this.applySettings();
      this.renderSection(this.currentSection);
      Notifications.updateBadge();
      FirebaseSync.updateStatusElement();
    });

    window.addEventListener('bca-sync-complete', (event) => {
      const { pushed, pulled } = event.detail || {};
      Toast.show(`Sincronización completa · ${pushed} enviados · ${pulled} recibidos`, 'success');
      this.applySettings();
      this.renderSection(this.currentSection);
      Notifications.updateBadge();
      FirebaseSync.updateStatusElement();
    });
  },

  async runFullSync() {
    const btn = document.getElementById('sync-all-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sincronizando...';
    }
    FirebaseSync.updateStatusElement();

    try {
      const result = await FirebaseSync.syncAll();
      Toast.show(`Todo sincronizado · ${result.pushed} enviados · ${result.pulled} recibidos`, 'success');
      this.applySettings();
      this.renderSection(this.currentSection);
      Notifications.updateBadge();
    } catch (error) {
      Toast.show(error.message || 'No se pudo sincronizar', 'danger');
    } finally {
      FirebaseSync.updateStatusElement();
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sincronizar todo';
      }
    }
  },

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (section) this.navigateTo(section);
      });
    });

    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-backdrop')?.classList.toggle('active');
    });

    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.remove('open');
      document.getElementById('sidebar-backdrop')?.classList.remove('active');
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    document.getElementById('notification-btn')?.addEventListener('click', () => {
      Notifications.togglePanel();
    });

    document.getElementById('mark-all-read')?.addEventListener('click', () => {
      Notifications.markAllRead();
      Notifications.renderPanel(document.getElementById('notification-list'));
    });
  },

  bindModals() {
    const closeInventoryModal = () => {
      const btn = document.getElementById('save-inventory-btn');
      if (btn) btn.style.display = '';
    };

    document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        overlay?.classList.remove('active');
        if (overlay?.id === 'inventory-modal') closeInventoryModal();
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          if (overlay.id === 'inventory-modal') closeInventoryModal();
        }
      });
    });

    document.getElementById('save-coffee-btn')?.addEventListener('click', () => CoffeeManager.saveFromForm());
    document.getElementById('save-client-btn')?.addEventListener('click', () => ClientManager.saveFromForm());
    document.getElementById('save-supplier-btn')?.addEventListener('click', () => SupplierManager.saveFromForm());
    document.getElementById('save-quotation-btn')?.addEventListener('click', () => QuotationManager.saveFromForm());
    document.getElementById('save-inventory-btn')?.addEventListener('click', () => InventoryManager.saveFromForm());
    document.getElementById('save-sale-btn')?.addEventListener('click', () => SalesManager.saveFromForm());
    document.getElementById('confirm-import-btn')?.addEventListener('click', () => ImportManager.confirmImport());
    document.getElementById('save-costs-btn')?.addEventListener('click', () => {
      ProductionCosts.saveFromForm();
      document.getElementById('costs-modal')?.classList.remove('active');
      Toast.show('Costos actualizados', 'success');
    });
    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());

    document.getElementById('costs-no-change')?.addEventListener('click', () => {
      ProductionCosts.markChecked();
      document.getElementById('costs-check-modal')?.classList.remove('active');
    });

    document.getElementById('costs-yes-change')?.addEventListener('click', () => {
      ProductionCosts.markChecked();
      document.getElementById('costs-check-modal')?.classList.remove('active');
      this.openCostsModal();
    });
  },

  navigateTo(section) {
    this.currentSection = section;

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    document.querySelectorAll('.page-section').forEach(s => {
      s.classList.toggle('active', s.id === `section-${section}`);
    });

    const titles = {
      dashboard: 'Dashboard',
      coffees: 'Cafés',
      clients: 'Clientes',
      suppliers: 'Proveedores',
      inventory: 'Inventario',
      quotations: 'Cotizaciones',
      'cost-engine': 'Costeo Interno',
      sales: 'Ventas',
      costs: 'Costos de Producción',
      settings: 'Configuración'
    };
    document.getElementById('page-title').textContent = titles[section] || section;

    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');
    this.renderSection(section);
  },

  renderSection(section) {
    switch (section) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'coffees':
        CoffeeManager.renderGrid(document.getElementById('coffees-grid'));
        break;
      case 'clients':
        ClientManager.renderTable(document.getElementById('clients-table'));
        break;
      case 'suppliers':
        SupplierManager.renderTable(document.getElementById('suppliers-table'));
        break;
      case 'inventory':
        InventoryManager.renderDashboard(document.getElementById('inventory-grid'));
        break;
      case 'quotations':
        QuotationManager.renderTable(document.getElementById('quotations-table'));
        break;
      case 'cost-engine':
        CostEngine.render(document.getElementById('cost-engine-container'));
        break;
      case 'sales':
        SalesManager.renderDashboard(document.getElementById('sales-dashboard'));
        break;
      case 'costs':
        ProductionCosts.renderCostForm(document.getElementById('costs-form-container'));
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  },

  renderDashboard() {
    const coffees = CoffeeManager.getAll();
    const clients = ClientManager.getAll();
    const quotations = QuotationManager.getAll();
    const sales = SalesManager.getAll();
    const inventory = InventoryManager.getAll();
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    const totalGreenKg = inventory.reduce((sum, i) => sum + i.greenKg, 0);
    const lowStockCount = inventory.filter(i => i.greenKg <= (i.minStockKg ?? settings.lowStockThreshold ?? 0)).length;
    const pendingQuotations = quotations.filter((q) => q.status === 'pending').length;
    const salesSummary = SalesManager.getReportSummary(sales);

    document.getElementById('dashboard-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${coffees.length}</div>
        <div class="stat-label">Cafés Registrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${clients.length}</div>
        <div class="stat-label">Clientes Activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatNumber(totalGreenKg)} kg</div>
        <div class="stat-label">Inventario Verde</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatCurrency(salesSummary.totalRevenue)}</div>
        <div class="stat-label">Ventas (${salesSummary.count})</div>
      </div>
    `;

    document.getElementById('dashboard-hero').innerHTML = `
      <h2>${settings.heroTitle}</h2>
      <p>${settings.heroSubtitle}</p>
    `;

    const alerts = [];
    if (lowStockCount > 0) {
      alerts.push(`<div class="card" style="border-color:var(--warning);margin-bottom:16px">
        <p>⚠️ <strong>${lowStockCount}</strong> café(s) con stock bajo. <a href="#" onclick="App.navigateTo('inventory');return false">Ver inventario</a></p>
      </div>`);
    }

    document.getElementById('dashboard-alerts').innerHTML = alerts.join('');

    const recentSales = [...sales].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt)).slice(0, 5);
    document.getElementById('dashboard-recent').innerHTML = recentSales.length > 0 ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title">Ventas Recientes</span>
          <button class="btn btn-sm btn-secondary" onclick="App.navigateTo('sales')">Ver informe</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Café</th>
                <th>Cant.</th>
                <th>Total</th>
                <th>Margen</th>
                <th>Vendió</th>
              </tr>
            </thead>
            <tbody>
              ${recentSales.map((s) => `
                <tr>
                  <td>${formatDate(s.soldAt)}</td>
                  <td>${s.coffeeName}</td>
                  <td>${s.quantity} × ${PACKAGING_SIZES[s.packaging]?.label || s.packaging}</td>
                  <td>${formatCurrency(s.totalRevenue)}</td>
                  <td><span class="badge badge-neutral">${formatNumber(s.profitMargin, 1)}%</span></td>
                  <td>${s.userName}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    const recentQuotations = quotations.slice(0, 5);
    document.getElementById('dashboard-recent').innerHTML += recentQuotations.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Cotizaciones Recientes</span>
          <button class="btn btn-sm btn-secondary" onclick="App.navigateTo('quotations')">Ver todas</button>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>No.</th><th>Cliente</th><th>Total</th><th>Fecha</th></tr></thead>
            <tbody>
              ${recentQuotations.map(q => `
                <tr>
                  <td>${q.number}</td>
                  <td>${q.clientName}</td>
                  <td>${formatCurrency(q.totalPrice)}</td>
                  <td>${formatDate(q.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    document.getElementById('dashboard-quick-actions').innerHTML = `
      <button class="btn btn-primary" onclick="SalesManager.create()">Registrar Venta</button>
      <button class="btn btn-secondary" onclick="QuotationManager.create()">Nueva Cotización</button>
      <button class="btn btn-secondary" onclick="App.navigateTo('cost-engine')">Costeo Interno</button>
      <button class="btn btn-secondary" onclick="CoffeeManager.create()">Agregar Café</button>
      <button class="btn btn-secondary" onclick="ClientManager.create()">Agregar Cliente</button>
    `;

    document.getElementById('dashboard-recent').innerHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Flujo de Gestión</span></div>
        <div class="workflow-steps">
          <button class="workflow-step" onclick="App.navigateTo('inventory')">
            <span class="workflow-num">1</span>
            <span>Compra</span>
            <small>Registrar café verde</small>
          </button>
          <span class="workflow-arrow">→</span>
          <button class="workflow-step" onclick="App.navigateTo('inventory')">
            <span class="workflow-num">2</span>
            <span>Transformación</span>
            <small>Tostión y mermas</small>
          </button>
          <span class="workflow-arrow">→</span>
          <button class="workflow-step" onclick="QuotationManager.create()">
            <span class="workflow-num">3</span>
            <span>Cotización</span>
            <small>Full Pack o Maquila</small>
          </button>
          <span class="workflow-arrow">→</span>
          <button class="workflow-step" onclick="SalesManager.create()">
            <span class="workflow-num">4</span>
            <span>Venta</span>
            <small>Registrar y ver margen</small>
          </button>
        </div>
      </div>
    ` + document.getElementById('dashboard-recent').innerHTML;
  },

  renderSettings() {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    const container = document.getElementById('settings-form');

    container.innerHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Identidad Visual</span></div>
        <div class="form-group">
          <label>Logo de la Empresa</label>
          <div class="image-upload" id="settings-logo-upload">
            ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="max-height:80px">` : '<p>📷 Haz clic para subir el logo</p>'}
            <input type="file" accept="image/*" id="settings-logo-input" style="display:none">
          </div>
          <input type="hidden" id="settings-logo" value="${settings.logo || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de la Empresa</label>
            <input type="text" class="form-control" id="settings-company" value="${settings.companyName}">
          </div>
          <div class="form-group">
            <label>Eslogan</label>
            <input type="text" class="form-control" id="settings-tagline" value="${settings.tagline}">
          </div>
        </div>
        <div class="form-group">
          <label>Email de Notificaciones</label>
          <input type="email" class="form-control" id="settings-email" value="${settings.email}">
        </div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Respaldo de Datos</span></div>
        <p class="form-hint" style="margin-bottom:12px">
          Exporte un archivo JSON con cafés, clientes, inventario y cotizaciones. Guárdelo en Google Drive o su PC.
          Si cambia de navegador o borra caché, importe el respaldo para recuperar todo.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <button type="button" class="btn btn-secondary" id="export-backup-btn">⬇ Exportar respaldo</button>
          <label class="btn btn-secondary" style="cursor:pointer;margin:0">
            ⬆ Importar respaldo
            <input type="file" accept="application/json,.json" id="import-backup-input" style="display:none">
          </label>
        </div>
        <p class="form-hint">El import reemplaza los datos actuales. Se le pedirá confirmación antes.</p>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Base de Datos y Nube</span></div>
        <p class="form-hint" style="margin-bottom:12px">
          Los datos se guardan <strong>primero en este navegador</strong> y se respaldan en Firebase.
          Entre dispositivos con la misma URL, use <strong>Forzar sincronización</strong> para unificar cambios.
        </p>
        <p id="firebase-sync-status" style="font-weight:600;margin-bottom:8px">${typeof FirebaseSync !== 'undefined' ? FirebaseSync.getStatusLabel() : 'Cargando...'}</p>
        <p id="online-status" class="form-hint" style="margin-bottom:12px"></p>
        <button type="button" class="btn btn-sm btn-secondary" id="sync-all-btn">Forzar sincronización</button>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Correos de Notificación</span></div>
        <div id="email-queue-summary">${typeof EmailService !== 'undefined' ? EmailService.renderQueueSummary() : ''}</div>
        <p class="form-hint" style="margin-top:8px">
          Para activar correo real: GitHub → Acciones → <strong>Instalar secretos</strong> y luego <strong>Desplegar Firebase</strong>.
          Guía: <a href="https://github.com/lasucursaldelcafe-droid/-black-coffee/blob/main/docs/PASOS_USUARIO.md" target="_blank" rel="noopener">PASOS_USUARIO.md</a>
        </p>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Hero del Dashboard</span></div>
        <div class="form-group">
          <label>Título</label>
          <input type="text" class="form-control" id="settings-hero-title" value="${settings.heroTitle}">
        </div>
        <div class="form-group">
          <label>Subtítulo</label>
          <textarea class="form-control" id="settings-hero-subtitle" rows="2">${settings.heroSubtitle}</textarea>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Alertas de Inventario</span></div>
        <div class="form-group">
          <label>Umbral de Stock Bajo (kg)</label>
          <input type="number" class="form-control" id="settings-low-stock" value="${settings.lowStockThreshold}">
          <p class="form-hint">Se enviará una alerta cuando el stock esté por debajo de este valor</p>
        </div>
      </div>
      <div style="margin-top:20px">
        <button class="btn btn-primary btn-lg" id="save-settings-btn">Guardar Configuración</button>
      </div>
    `;

    const logoUpload = document.getElementById('settings-logo-upload');
    const logoInput = document.getElementById('settings-logo-input');
    if (logoUpload && logoInput) {
      logoUpload.addEventListener('click', () => logoInput.click());
      logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById('settings-logo').value = ev.target.result;
            logoUpload.innerHTML = `<img src="${ev.target.result}" alt="Logo" style="max-height:80px">`;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('sync-all-btn')?.addEventListener('click', () => this.runFullSync());

    document.getElementById('export-backup-btn')?.addEventListener('click', () => {
      BackupManager.download();
      Toast.show('Respaldo descargado', 'success');
    });

    document.getElementById('import-backup-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm('¿Importar respaldo? Esto reemplazará los datos actuales en este navegador.')) {
        e.target.value = '';
        return;
      }
      try {
        const count = await BackupManager.importFromFile(file);
        Toast.show(`Respaldo importado (${count} claves)`, 'success');
        this.applySettings();
        this.renderSection(this.currentSection);
        Notifications.updateBadge();
      } catch (error) {
        Toast.show(error.message || 'Error al importar', 'danger');
      }
      e.target.value = '';
    });

    const onlineEl = document.getElementById('online-status');
    if (onlineEl) {
      onlineEl.textContent = navigator.onLine ? '🟢 En línea' : '🔴 Sin conexión — los cambios se guardan localmente';
      window.addEventListener('online', () => { onlineEl.textContent = '🟢 En línea'; });
      window.addEventListener('offline', () => { onlineEl.textContent = '🔴 Sin conexión — los cambios se guardan localmente'; });
    }
  },

  saveSettings() {
    const settings = {
      companyName: document.getElementById('settings-company')?.value || DEFAULT_SETTINGS.companyName,
      tagline: document.getElementById('settings-tagline')?.value || DEFAULT_SETTINGS.tagline,
      email: document.getElementById('settings-email')?.value || DEFAULT_SETTINGS.email,
      logo: document.getElementById('settings-logo')?.value || null,
      heroTitle: document.getElementById('settings-hero-title')?.value || DEFAULT_SETTINGS.heroTitle,
      heroSubtitle: document.getElementById('settings-hero-subtitle')?.value || DEFAULT_SETTINGS.heroSubtitle,
      lowStockThreshold: parseFloat(document.getElementById('settings-low-stock')?.value) || 0
    };

    Storage.set(STORAGE_KEYS.SETTINGS, settings);
    EmailService.email = settings.email;
    this.applySettings();
    Toast.show('Configuración guardada', 'success');
  },

  applySettings() {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    const brandLogo = document.getElementById('sidebar-logo');
    if (brandLogo && settings.logo) {
      brandLogo.src = settings.logo;
      brandLogo.style.display = 'block';
    }

    const brandName = document.getElementById('sidebar-brand-name');
    if (brandName) brandName.textContent = settings.companyName;
  },

  renderUserInfo() {
    const session = Auth.getSession();
    if (!session) return;

    const initials = session.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    document.getElementById('user-avatar').textContent = initials;
    document.getElementById('user-name').textContent = session.name;
    document.getElementById('user-role').textContent = session.role;
  },

  checkProductionCostsModal() {
    if (ProductionCosts.shouldShowModal()) {
      setTimeout(() => {
        document.getElementById('costs-check-modal')?.classList.add('active');
      }, 500);
    }
  },

  openCostsModal() {
    ProductionCosts.renderCostForm(document.getElementById('costs-modal-form'));
    document.getElementById('costs-modal')?.classList.add('active');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init().catch((error) => {
    console.error('Error al iniciar la aplicación:', error);
  });
});
