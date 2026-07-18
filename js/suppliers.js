const SupplierManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.SUPPLIERS) || [];
  },

  getById(id) {
    return this.getAll().find(s => s.id === id);
  },

  save(supplier) {
    const suppliers = this.getAll();
    const index = suppliers.findIndex(s => s.id === supplier.id);

    if (index >= 0) {
      suppliers[index] = { ...suppliers[index], ...supplier, updatedAt: new Date().toISOString() };
      supplier = suppliers[index];
    } else {
      supplier.id = Storage.generateId();
      supplier.createdAt = new Date().toISOString();
      suppliers.push(supplier);
    }

    Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    Notifications.add(`Proveedor "${supplier.name}" guardado`, 'success', {
      section: 'suppliers', entityId: supplier.id, action: 'edit'
    });
    return supplier;
  },

  delete(id) {
    const suppliers = this.getAll().filter(s => s.id !== id);
    Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    Notifications.add('Proveedor eliminado', 'warning', { section: 'suppliers' });
  },

  renderTable(container) {
    const suppliers = this.getAll();
    if (suppliers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌱</div>
          <h3>No hay proveedores registrados</h3>
          <p>Agrega caficultores y proveedores</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Tipo</th>
              <th>Región</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${suppliers.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge badge-neutral">${s.type || 'Caficultor'}</span></td>
                <td>${s.region || '-'}</td>
                <td>${s.phone || s.email || '-'}</td>
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

  showForm(supplier = null) {
    const modal = document.getElementById('supplier-modal');
    document.getElementById('supplier-modal-title').textContent = supplier ? 'Editar Proveedor' : 'Nuevo Proveedor';

    document.getElementById('supplier-form').innerHTML = `
      <input type="hidden" id="supplier-id" value="${supplier?.id || ''}">
      <div class="form-row">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" class="form-control" id="supplier-name" value="${supplier?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select class="form-control" id="supplier-type">
            <option value="Caficultor" ${supplier?.type === 'Caficultor' ? 'selected' : ''}>Caficultor</option>
            <option value="Cooperativa" ${supplier?.type === 'Cooperativa' ? 'selected' : ''}>Cooperativa</option>
            <option value="Exportador" ${supplier?.type === 'Exportador' ? 'selected' : ''}>Exportador</option>
            <option value="Otro" ${supplier?.type === 'Otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Región</label>
        <div class="selection-grid" id="supplier-region-selection">
          ${COLOMBIAN_REGIONS.map(r => `
            <button type="button" class="selection-btn ${supplier?.region === r ? 'active' : ''}" data-value="${r}">${r}</button>
          `).join('')}
        </div>
        <input type="hidden" id="supplier-region" value="${supplier?.region || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contacto</label>
          <input type="text" class="form-control" id="supplier-contact" value="${supplier?.contact || ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="supplier-email" value="${supplier?.email || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Teléfono</label>
        <input type="tel" class="form-control" id="supplier-phone" value="${supplier?.phone || ''}">
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="form-control" id="supplier-notes" rows="2">${supplier?.notes || ''}</textarea>
      </div>
    `;

    document.getElementById('supplier-region-selection')?.querySelectorAll('.selection-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#supplier-region-selection .selection-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('supplier-region').value = btn.dataset.value;
      });
    });

    modal.classList.add('active');
  },

  saveFromForm() {
    const supplier = {
      id: document.getElementById('supplier-id').value || undefined,
      name: document.getElementById('supplier-name').value,
      type: document.getElementById('supplier-type').value,
      region: document.getElementById('supplier-region').value,
      contact: document.getElementById('supplier-contact').value,
      email: document.getElementById('supplier-email').value,
      phone: document.getElementById('supplier-phone').value,
      notes: document.getElementById('supplier-notes').value
    };

    if (!supplier.name) {
      Toast.show('El nombre es obligatorio', 'danger');
      return;
    }

    this.save(supplier);
    document.getElementById('supplier-modal').classList.remove('active');
    App.renderSection('suppliers');
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
  }
};
