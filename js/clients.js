const ClientManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.CLIENTS) || [];
  },

  getById(id) {
    return this.getAll().find(c => c.id === id);
  },

  save(client) {
    const clients = this.getAll();
    const index = clients.findIndex(c => c.id === client.id);

    if (index >= 0) {
      clients[index] = { ...clients[index], ...client, updatedAt: new Date().toISOString() };
      client = clients[index];
    } else {
      client.id = Storage.generateId();
      client.createdAt = new Date().toISOString();
      clients.push(client);
    }

    Storage.set(STORAGE_KEYS.CLIENTS, clients);
    Notifications.add(`Cliente "${client.name}" guardado`, 'success', {
      section: 'clients', entityId: client.id, action: 'edit'
    });
    return client;
  },

  delete(id) {
    const clients = this.getAll().filter(c => c.id !== id);
    Storage.set(STORAGE_KEYS.CLIENTS, clients);
    Notifications.add('Cliente eliminado', 'warning', { section: 'clients' });
  },

  renderTable(container) {
    const clients = this.getAll();
    if (clients.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>No hay clientes registrados</h3>
          <p>Agrega tu primer cliente para generar cotizaciones</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Ciudad</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${clients.map(client => `
              <tr>
                <td><strong>${client.name}</strong></td>
                <td><span class="badge badge-neutral">${CLIENT_TYPES[client.type]?.label || client.type}</span></td>
                <td>${client.city || '-'}, ${client.department || ''}</td>
                <td>${client.email || client.phone || '-'}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="ClientManager.edit('${client.id}')">Editar</button>
                  <button class="btn btn-sm btn-primary" onclick="QuotationManager.createForClient('${client.id}')">Cotizar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  },

  showForm(client = null) {
    const modal = document.getElementById('client-modal');
    document.getElementById('client-modal-title').textContent = client ? 'Editar Cliente' : 'Nuevo Cliente';

    document.getElementById('client-form').innerHTML = `
      <input type="hidden" id="client-id" value="${client?.id || ''}">
      <div class="form-row">
        <div class="form-group">
          <label>Nombre / Empresa</label>
          <input type="text" class="form-control" id="client-name" value="${client?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Tipo de Cliente</label>
          <div class="selection-grid" id="client-type-selection">
            ${Object.entries(CLIENT_TYPES).map(([key, val]) => `
              <button type="button" class="selection-btn ${client?.type === key ? 'active' : ''}" data-value="${key}">${val.label}</button>
            `).join('')}
          </div>
          <input type="hidden" id="client-type" value="${client?.type || 'final'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contacto</label>
          <input type="text" class="form-control" id="client-contact" value="${client?.contact || ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="client-email" value="${client?.email || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" class="form-control" id="client-phone" value="${client?.phone || ''}">
        </div>
        <div class="form-group">
          <label>Ciudad</label>
          <input type="text" class="form-control" id="client-city" value="${client?.city || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Departamento</label>
        <input type="text" class="form-control" id="client-department" value="${client?.department || ''}">
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input type="text" class="form-control" id="client-address" value="${client?.address || ''}">
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="form-control" id="client-notes" rows="2">${client?.notes || ''}</textarea>
      </div>
    `;

    document.getElementById('client-type-selection')?.querySelectorAll('.selection-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#client-type-selection .selection-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('client-type').value = btn.dataset.value;
      });
    });

    modal.classList.add('active');
  },

  saveFromForm() {
    const client = {
      id: document.getElementById('client-id').value || undefined,
      name: document.getElementById('client-name').value,
      type: document.getElementById('client-type').value,
      contact: document.getElementById('client-contact').value,
      email: document.getElementById('client-email').value,
      phone: document.getElementById('client-phone').value,
      city: document.getElementById('client-city').value,
      department: document.getElementById('client-department').value,
      address: document.getElementById('client-address').value,
      notes: document.getElementById('client-notes').value
    };

    if (!client.name) {
      Toast.show('El nombre del cliente es obligatorio', 'danger');
      return;
    }

    this.save(client);
    Toast.show(`Cliente "${client.name}" guardado`, 'success');
    document.getElementById('client-modal').classList.remove('active');
    App.renderSection('clients');
  },

  edit(id) {
    const client = this.getById(id);
    if (client) this.showForm(client);
  },

  create() {
    this.showForm();
  }
};
