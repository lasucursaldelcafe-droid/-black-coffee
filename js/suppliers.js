const SupplierManager = {
  _filter: 'all',

  migrate(supplier) {
    if (!supplier) return supplier;
    if (supplier.category) {
      return {
        services: [],
        address: '',
        city: '',
        department: '',
        invima: '',
        kimba: '',
        ...supplier
      };
    }

    const legacyType = supplier.type || 'Caficultor';
    const isLogistics = /transporte|logística|logistica|flete/i.test(legacyType);
    const isOperational = /tost|trill|selecci|empac|molienda/i.test(legacyType);

    let category = 'coffee';
    let services = [];
    if (isLogistics) {
      category = 'logistics';
      services = ['transporte'];
    } else if (isOperational) {
      category = 'operational';
      if (/tost/i.test(legacyType)) services.push('tostion');
      if (/trill/i.test(legacyType)) services.push('trilla');
      if (/selecci/i.test(legacyType)) services.push('seleccion');
      if (/empac/i.test(legacyType)) services.push('empacada');
    }

    return {
      ...supplier,
      category,
      services,
      address: supplier.address || '',
      city: supplier.city || '',
      department: supplier.department || supplier.region || '',
      invima: supplier.invima || '',
      kimba: supplier.kimba || ''
    };
  },

  getAll() {
    return (Storage.get(STORAGE_KEYS.SUPPLIERS) || []).map((s) => this.migrate(s));
  },

  getById(id) {
    return this.getAll().find((s) => s.id === id);
  },

  getByCategory(category) {
    return this.getAll().filter((s) => s.category === category);
  },

  getByService(serviceKey) {
    if (serviceKey === 'compra') {
      return this.getByCategory('coffee');
    }
    if (serviceKey === 'transporte') {
      return this.getAll().filter((s) =>
        s.category === 'logistics' || s.services?.includes('transporte')
      );
    }
    return this.getAll().filter((s) =>
      s.category === 'operational' && s.services?.includes(serviceKey)
    );
  },

  getName(id) {
    if (!id) return '—';
    return this.getById(id)?.name || 'Proveedor desconocido';
  },

  renderSelect(serviceKey, options = {}) {
    const {
      id = `supplier-${serviceKey}`,
      selectedId = '',
      required = false,
      placeholder = 'Seleccionar proveedor...'
    } = options;

    const suppliers = this.getByService(serviceKey);
    return `
      <select class="form-control" id="${id}" ${required ? 'required' : ''}>
        <option value="">${placeholder}</option>
        ${suppliers.map((s) => `
          <option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>
            ${s.name}${s.invima ? ` · INVIMA ${s.invima}` : ''}
          </option>
        `).join('')}
      </select>
      ${suppliers.length === 0 ? `<p class="form-hint" style="margin-top:4px">No hay proveedores para ${getProcessSupplierLabel(serviceKey)}. <a href="#" onclick="SupplierManager.createForService('${serviceKey}');return false">Agregar uno</a></p>` : ''}
    `;
  },

  renderComplianceBadges(supplier) {
    const badges = [];
    if (supplier.invima) badges.push(`<span class="badge badge-success" title="INVIMA">INVIMA ${supplier.invima}</span>`);
    if (supplier.kimba) badges.push(`<span class="badge badge-neutral" title="KIMBA">KIMBA ${supplier.kimba}</span>`);
    return badges.join(' ') || '<span class="form-hint">—</span>';
  },

  formatServices(supplier) {
    if (supplier.category === 'coffee') {
      return supplier.type || 'Caficultor';
    }
    if (supplier.category === 'logistics') {
      return SUPPLIER_SERVICES.transporte.label;
    }
    return (supplier.services || [])
      .map((key) => SUPPLIER_SERVICES[key]?.label || key)
      .join(', ') || '—';
  },

  formatLocation(supplier) {
    const parts = [supplier.city, supplier.department || supplier.region].filter(Boolean);
    return parts.join(', ') || supplier.region || '—';
  },

  save(supplier) {
    const suppliers = this.getAll();
    const normalized = this.migrate(supplier);
    const index = suppliers.findIndex((s) => s.id === normalized.id);

    if (index >= 0) {
      suppliers[index] = { ...suppliers[index], ...normalized, updatedAt: new Date().toISOString() };
      supplier = suppliers[index];
    } else {
      normalized.id = Storage.generateId();
      normalized.createdAt = new Date().toISOString();
      suppliers.push(normalized);
      supplier = normalized;
    }

    Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    Notifications.add(`Proveedor "${supplier.name}" guardado`, 'success', {
      section: 'suppliers', entityId: supplier.id, action: 'edit'
    });
    return supplier;
  },

  delete(id) {
    const supplier = this.getById(id);
    const suppliers = this.getAll().filter((s) => s.id !== id);
    Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    if (supplier) {
      AuditLog.log('delete_supplier', supplier.name, { supplierId: id, name: supplier.name });
    }
    Notifications.add('Proveedor eliminado', 'warning', { section: 'suppliers' });
  },

  setFilter(filter) {
    this._filter = filter;
    App.renderSection('suppliers');
  },

  renderTable(container) {
    const suppliers = this.getAll();
    const filtered = this._filter === 'all'
      ? suppliers
      : suppliers.filter((s) => s.category === this._filter);

    const filterButtons = [
      ['all', 'Todos'],
      ...Object.entries(SUPPLIER_CATEGORIES).map(([key, val]) => [key, val.shortLabel])
    ];

    if (suppliers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌱</div>
          <h3>No hay proveedores registrados</h3>
          <p>Agrega caficultores, tostadores, empacadoras y transportistas</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${filterButtons.map(([key, label]) => `
          <button type="button" class="btn btn-sm ${this._filter === key ? 'btn-primary' : 'btn-secondary'}"
            onclick="SupplierManager.setFilter('${key}')">${label}</button>
        `).join('')}
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Categoría</th>
              <th>Servicios / Tipo</th>
              <th>Ubicación</th>
              <th>INVIMA / KIMBA</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((s) => `
              <tr>
                <td>
                  <strong>${s.name}</strong>
                  ${s.address ? `<div class="form-hint" style="font-size:0.75rem">${s.address}</div>` : ''}
                </td>
                <td><span class="badge badge-neutral">${SUPPLIER_CATEGORIES[s.category]?.shortLabel || s.category}</span></td>
                <td style="font-size:0.85rem">${this.formatServices(s)}</td>
                <td>${this.formatLocation(s)}</td>
                <td>${this.renderComplianceBadges(s)}</td>
                <td>${s.phone || s.email || s.contact || '—'}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="SupplierManager.edit('${s.id}')">Editar</button>
                  <button class="btn btn-sm btn-danger" onclick="SupplierManager.confirmDelete('${s.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  },

  showForm(supplier = null, preset = {}) {
    const modal = document.getElementById('supplier-modal');
    const data = supplier ? this.migrate(supplier) : {
      category: preset.category || 'coffee',
      services: preset.services || [],
      type: 'Caficultor'
    };

    document.getElementById('supplier-modal-title').textContent = supplier ? 'Editar Proveedor' : 'Nuevo Proveedor';

    document.getElementById('supplier-form').innerHTML = `
      <input type="hidden" id="supplier-id" value="${supplier?.id || ''}">
      <div class="form-group">
        <label>Categoría de Proveedor</label>
        <div class="selection-grid" id="supplier-category-selection">
          ${Object.entries(SUPPLIER_CATEGORIES).map(([key, val]) => `
            <button type="button" class="selection-btn ${data.category === key ? 'active' : ''}" data-value="${key}">
              <strong>${val.label}</strong><br><small style="opacity:0.7">${val.description}</small>
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="supplier-category" value="${data.category}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nombre / Razón Social</label>
          <input type="text" class="form-control" id="supplier-name" value="${data.name || ''}" required>
        </div>
        <div class="form-group" id="supplier-coffee-type-group">
          <label>Tipo (Café)</label>
          <select class="form-control" id="supplier-type">
            ${COFFEE_SUPPLIER_TYPES.map((t) => `
              <option value="${t}" ${data.type === t ? 'selected' : ''}>${t}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" id="supplier-services-group" style="display:none">
        <label>Servicios que ofrece</label>
        <p class="form-hint" style="margin-bottom:8px">Seleccione los procesos que realiza este proveedor operativo</p>
        <div class="selection-grid selection-grid-multi" id="supplier-services-selection">
          ${Object.entries(SUPPLIER_SERVICES)
            .filter(([, val]) => val.category === 'operational')
            .map(([key, val]) => `
              <button type="button" class="selection-btn ${(data.services || []).includes(key) ? 'active' : ''}" data-value="${key}">${val.label}</button>
            `).join('')}
        </div>
        <input type="hidden" id="supplier-services" value='${JSON.stringify(data.services || [])}'>
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input type="text" class="form-control" id="supplier-address" value="${data.address || ''}" placeholder="Calle, barrio, bodega...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Ciudad</label>
          <input type="text" class="form-control" id="supplier-city" value="${data.city || ''}">
        </div>
        <div class="form-group">
          <label>Departamento</label>
          <input type="text" class="form-control" id="supplier-department" value="${data.department || data.region || ''}">
        </div>
      </div>
      <div class="form-group" id="supplier-region-group">
        <label>Región cafetera</label>
        <div class="selection-grid" id="supplier-region-selection">
          ${COLOMBIAN_REGIONS.map((r) => `
            <button type="button" class="selection-btn ${(data.region || data.department) === r ? 'active' : ''}" data-value="${r}">${r}</button>
          `).join('')}
        </div>
        <input type="hidden" id="supplier-region" value="${data.region || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Registro INVIMA</label>
          <input type="text" class="form-control" id="supplier-invima" value="${data.invima || ''}" placeholder="Ej: RSA-XXXXXX">
        </div>
        <div class="form-group">
          <label>Registro KIMBA</label>
          <input type="text" class="form-control" id="supplier-kimba" value="${data.kimba || ''}" placeholder="Código KIMBA si aplica">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contacto</label>
          <input type="text" class="form-control" id="supplier-contact" value="${data.contact || ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="supplier-email" value="${data.email || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Teléfono</label>
        <input type="tel" class="form-control" id="supplier-phone" value="${data.phone || ''}">
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="form-control" id="supplier-notes" rows="2">${data.notes || ''}</textarea>
      </div>
    `;

    this.bindCategoryForm();
    modal.classList.add('active');
  },

  bindCategoryForm() {
    const updateCategoryUI = () => {
      const category = document.getElementById('supplier-category')?.value || 'coffee';
      document.getElementById('supplier-coffee-type-group').style.display = category === 'coffee' ? 'block' : 'none';
      document.getElementById('supplier-region-group').style.display = category === 'coffee' ? 'block' : 'none';
      document.getElementById('supplier-services-group').style.display = category === 'operational' ? 'block' : 'none';
    };

    document.getElementById('supplier-category-selection')?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#supplier-category-selection .selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('supplier-category').value = btn.dataset.value;
        updateCategoryUI();
      });
    });

    const servicesContainer = document.getElementById('supplier-services-selection');
    const servicesHidden = document.getElementById('supplier-services');
    servicesContainer?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const selected = [...servicesContainer.querySelectorAll('.selection-btn.active')].map((b) => b.dataset.value);
        servicesHidden.value = JSON.stringify(selected);
      });
    });

    document.getElementById('supplier-region-selection')?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#supplier-region-selection .selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('supplier-region').value = btn.dataset.value;
      });
    });

    updateCategoryUI();
  },

  saveFromForm() {
    const category = document.getElementById('supplier-category').value;
    let services = [];
    try {
      services = JSON.parse(document.getElementById('supplier-services')?.value || '[]');
    } catch {
      services = [];
    }
    if (category === 'logistics') services = ['transporte'];

    const supplier = {
      id: document.getElementById('supplier-id').value || undefined,
      name: document.getElementById('supplier-name').value.trim(),
      category,
      type: document.getElementById('supplier-type')?.value || 'Caficultor',
      services,
      region: document.getElementById('supplier-region')?.value || '',
      department: document.getElementById('supplier-department').value.trim(),
      city: document.getElementById('supplier-city').value.trim(),
      address: document.getElementById('supplier-address').value.trim(),
      invima: document.getElementById('supplier-invima').value.trim(),
      kimba: document.getElementById('supplier-kimba').value.trim(),
      contact: document.getElementById('supplier-contact').value.trim(),
      email: document.getElementById('supplier-email').value.trim(),
      phone: document.getElementById('supplier-phone').value.trim(),
      notes: document.getElementById('supplier-notes').value.trim()
    };

    if (!supplier.name) {
      Toast.show('El nombre es obligatorio', 'danger');
      return;
    }
    if (category === 'operational' && services.length === 0) {
      Toast.show('Seleccione al menos un servicio operativo', 'danger');
      return;
    }

    this.save(supplier);
    document.getElementById('supplier-modal').classList.remove('active');
    App.renderSection('suppliers');
  },

  createForService(serviceKey) {
    const service = SUPPLIER_SERVICES[serviceKey];
    if (!service) {
      this.create();
      return;
    }
    document.getElementById('supplier-modal')?.classList.remove('active');
    this.showForm(null, {
      category: service.category,
      services: service.category === 'operational' ? [serviceKey] : ['transporte']
    });
  },

  edit(id) {
    const supplier = this.getById(id);
    if (supplier) this.showForm(supplier);
  },

  create() {
    this.showForm();
  },

  confirmDelete(id) {
    if (confirm('¿Está seguro de eliminar este proveedor?')) {
      this.delete(id);
      App.renderSection('suppliers');
    }
  },

  getDefaultSupplierId(processKey) {
    const costs = ProductionCosts.get();
    return costs.defaultSuppliers?.[processKey] || null;
  },

  resolveSuppliersForSteps(stepKeys) {
    const resolved = {};
    stepKeys.forEach((key) => {
      const defaultId = this.getDefaultSupplierId(key);
      if (defaultId) resolved[key] = defaultId;
    });
    return resolved;
  }
};
