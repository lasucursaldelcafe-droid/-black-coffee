const PWA = {
  deferredPrompt: null,
  dismissedKey: 'bca_pwa_install_dismissed',

  init() {
    this.registerServiceWorker();
    this.setupAutoUpdate();
    this.bindInstallPrompt();
    this.renderInstallUI();
    this.updateStandaloneClass();
  },

  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  },

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },

  isAndroid() {
    return /Android/i.test(navigator.userAgent);
  },

  isMobileDevice() {
    return this.isIOS() || this.isAndroid() || window.innerWidth <= 768;
  },

  canInstall() {
    return Boolean(this.deferredPrompt);
  },

  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((registration) => {
        this._swRegistration = registration;
        registration.update().catch(() => {});

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated' && navigator.serviceWorker.controller) {
              this.promptReload('Nueva versión de la app lista');
            }
          });
        });
      }).catch((error) => {
        console.warn('Service worker no registrado:', error.message);
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BCA_SW_UPDATED') {
          this.promptReload('Actualización instalada');
        }
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  },

  setupAutoUpdate() {
    const check = () => this.checkForNewBuild();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._swRegistration?.update().catch(() => {});
        check();
      }
    });
    window.addEventListener('focus', check);
    check();
    setInterval(check, 2 * 60 * 1000);
    setInterval(() => this._swRegistration?.update().catch(() => {}), 5 * 60 * 1000);
  },

  async checkForNewBuild() {
    if (this._reloadPending) return;
    try {
      const response = await fetch(`./app.html?buildCheck=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const html = await response.text();
      const match = html.match(/BCA_BUILD\s*=\s*['"](\d+)['"]/);
      const remoteBuild = match?.[1];
      const localBuild = String(window.BCA_BUILD || '');
      if (remoteBuild && localBuild && remoteBuild !== localBuild) {
        this.promptReload(`Actualización disponible (build ${remoteBuild})`);
      }
    } catch {
      /* sin conexión */
    }
  },

  promptReload(message) {
    if (this._reloadPending) return;
    this._reloadPending = true;
    Toast?.show(`${message}. Recargando…`, 'info');
    setTimeout(() => window.location.reload(), 1200);
  },

  bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.renderInstallUI();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      localStorage.removeItem(this.dismissedKey);
      Toast?.show('App instalada correctamente', 'success');
      this.renderInstallUI();
    });
  },

  updateStandaloneClass() {
    document.documentElement.classList.toggle('pwa-standalone', this.isStandalone());
    document.documentElement.classList.toggle('pwa-mobile', this.isMobileDevice());
  },

  async promptInstall() {
    if (!this.deferredPrompt) {
      this.showInstallInstructions();
      return false;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.renderInstallUI();
    if (outcome === 'accepted') {
      Toast?.show('Instalando app…', 'success');
      return true;
    }
    return false;
  },

  dismissInstallBanner() {
    localStorage.setItem(this.dismissedKey, String(Date.now()));
    this.renderInstallUI();
  },

  shouldShowBanner() {
    if (this.isStandalone()) return false;
    if (!this.isMobileDevice() && !this.canInstall()) return false;
    const dismissed = parseInt(localStorage.getItem(this.dismissedKey) || '0', 10);
    if (dismissed && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) return false;
    return this.canInstall() || this.isIOS() || this.isAndroid();
  },

  showInstallInstructions() {
    const iosSteps = `
      <ol class="pwa-steps">
        <li>Toque el botón <strong>Compartir</strong> en Safari</li>
        <li>Seleccione <strong>Añadir a pantalla de inicio</strong></li>
        <li>Confirme con <strong>Añadir</strong></li>
      </ol>`;
    const androidSteps = `
      <ol class="pwa-steps">
        <li>Abra el menú del navegador (⋮)</li>
        <li>Toque <strong>Instalar app</strong> o <strong>Añadir a inicio</strong></li>
        <li>Confirme la instalación</li>
      </ol>`;
    const genericSteps = `
      <ol class="pwa-steps">
        <li>Use el menú del navegador</li>
        <li>Busque <strong>Instalar aplicación</strong> o <strong>Añadir a inicio</strong></li>
      </ol>`;

    const steps = this.isIOS() ? iosSteps : this.isAndroid() ? androidSteps : genericSteps;
    const container = document.getElementById('pwa-instructions-body');
    if (container) {
      container.innerHTML = `
        <p class="form-hint" style="margin-bottom:12px">
          Instale BCA como app nativa para acceso rápido, pantalla completa y uso offline del panel.
        </p>
        ${steps}
        <p class="form-hint" style="margin-top:12px">Build ${window.BCA_BUILD || '—'}</p>`;
      document.getElementById('pwa-instructions-modal')?.classList.add('active');
      return;
    }
    alert('Instale desde el menú del navegador: "Añadir a pantalla de inicio" (iOS) o "Instalar app" (Android).');
  },

  renderInstallCard(containerId = 'pwa-install-card') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.isStandalone()) {
      container.innerHTML = `
        <div class="pwa-status pwa-status--installed">
          <span class="pwa-status-icon">✅</span>
          <div>
            <strong>App instalada</strong>
            <p class="form-hint">Está usando BCA en modo pantalla completa.</p>
          </div>
        </div>`;
      return;
    }

    const showInstallBtn = this.canInstall() || this.isIOS() || this.isAndroid();
    container.innerHTML = `
      <div class="pwa-install-card-inner">
        <div class="pwa-install-icon">
          <img src="./icons/icon-192.png" alt="BCA" width="64" height="64">
        </div>
        <div class="pwa-install-copy">
          <strong>App móvil BCA</strong>
          <p class="form-hint">Descargue la app para iOS y Android. Acceso rápido a inventario, cotizaciones y ventas sin abrir el navegador.</p>
          <div class="pwa-platform-badges">
            ${this.isIOS() ? '<span class="badge badge-neutral">iOS</span>' : ''}
            ${this.isAndroid() ? '<span class="badge badge-neutral">Android</span>' : ''}
            ${!this.isIOS() && !this.isAndroid() ? '<span class="badge badge-neutral">iOS · Android</span>' : ''}
          </div>
        </div>
        ${showInstallBtn ? `
          <div class="pwa-install-actions">
            <button type="button" class="btn btn-primary" id="pwa-install-btn">
              ${this.canInstall() ? '⬇ Instalar App' : '📲 Cómo instalar'}
            </button>
            <button type="button" class="btn btn-sm btn-secondary" id="pwa-instructions-btn">Ver pasos</button>
          </div>` : `
          <div class="pwa-install-actions">
            <button type="button" class="btn btn-secondary" id="pwa-instructions-btn">Ver pasos de instalación</button>
          </div>`}
      </div>`;

    document.getElementById('pwa-install-btn')?.addEventListener('click', () => this.promptInstall());
    document.getElementById('pwa-instructions-btn')?.addEventListener('click', () => this.showInstallInstructions());
  },

  renderInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (!banner) return;

    if (!this.shouldShowBanner()) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }

    banner.hidden = false;
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <img src="./icons/icon-192.png" alt="" width="40" height="40" class="pwa-banner-icon">
        <div class="pwa-banner-text">
          <strong>Instalar BCA en su celular</strong>
          <span>Acceso rápido como app nativa</span>
        </div>
        <button type="button" class="btn btn-sm btn-primary" id="pwa-banner-install">
          ${this.canInstall() ? 'Instalar' : 'Ver cómo'}
        </button>
        <button type="button" class="pwa-banner-close" id="pwa-banner-dismiss" aria-label="Cerrar">×</button>
      </div>`;

    document.getElementById('pwa-banner-install')?.addEventListener('click', () => this.promptInstall());
    document.getElementById('pwa-banner-dismiss')?.addEventListener('click', () => this.dismissInstallBanner());
  },

  renderInstallUI() {
    this.renderInstallBanner();
    this.renderInstallCard('pwa-install-card');
    this.renderInstallCard('pwa-install-card-settings');
  },

  bindMobileNav() {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav) return;

    nav.querySelectorAll('[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        if (section === 'menu') {
          document.querySelector('.sidebar')?.classList.add('open');
          document.getElementById('sidebar-backdrop')?.classList.add('active');
          return;
        }
        App.navigateTo(section);
        nav.querySelectorAll('.mobile-nav-item').forEach((item) => {
          item.classList.toggle('active', item.dataset.section === section);
        });
      });
    });

    window.addEventListener('resize', () => this.updateStandaloneClass());
  },

  syncMobileNavActive(section) {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav) return;
    nav.querySelectorAll('.mobile-nav-item').forEach((item) => {
      const match = item.dataset.section === section
        || (section === 'inventory' && item.dataset.section === 'inventory');
      item.classList.toggle('active', match);
    });
  }
};
