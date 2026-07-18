const CoffeeManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.COFFEES) || [];
  },

  getById(id) {
    return this.getAll().find(c => c.id === id);
  },

  save(coffee) {
    const coffees = this.getAll();
    const index = coffees.findIndex(c => c.id === coffee.id);

    if (index >= 0) {
      coffees[index] = { ...coffees[index], ...coffee, updatedAt: new Date().toISOString() };
    } else {
      coffee.id = Storage.generateId();
      coffee.createdAt = new Date().toISOString();
      coffees.push(coffee);

      const inventory = Storage.get(STORAGE_KEYS.INVENTORY) || [];
      inventory.push({
        id: Storage.generateId(),
        coffeeId: coffee.id,
        greenKg: 0,
        roastedKg: 0,
        packagedUnits: {},
        minStockKg: 10,
        lastUpdated: new Date().toISOString()
      });
      Storage.set(STORAGE_KEYS.INVENTORY, inventory);
    }

    Storage.set(STORAGE_KEYS.COFFEES, coffees);
    Notifications.add(`Café "${coffee.name}" guardado`, 'success');
    return coffee;
  },

  delete(id) {
    const coffees = this.getAll().filter(c => c.id !== id);
    Storage.set(STORAGE_KEYS.COFFEES, coffees);

    const inventory = (Storage.get(STORAGE_KEYS.INVENTORY) || []).filter(i => i.coffeeId !== id);
    Storage.set(STORAGE_KEYS.INVENTORY, inventory);
    Notifications.add('Café eliminado', 'warning');
  },

  renderGrid(container) {
    const coffees = this.getAll();
    if (coffees.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">☕</div>
          <h3>No hay cafés registrados</h3>
          <p>Agrega tu primer café de especialidad</p>
        </div>`;
      return;
    }

    container.innerHTML = coffees.map(coffee => `
      <div class="coffee-card" data-id="${coffee.id}">
        <div class="coffee-card-image">
          ${coffee.image 
            ? `<img src="${coffee.image}" alt="${coffee.name}">` 
            : '<span style="font-size:3rem;opacity:0.3">☕</span>'}
        </div>
        <div class="coffee-card-body">
          <div class="coffee-card-title">${coffee.name}</div>
          <div class="coffee-card-meta">
            ${coffee.variety} · ${coffee.region} · ${coffee.process}
            ${coffee.fermentation ? `<br>${coffee.fermentation}` : ''}
          </div>
          <div class="coffee-card-price">${formatCurrency(coffee.pricePerKg)}/kg</div>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <button class="btn btn-sm btn-secondary" onclick="CoffeeManager.edit('${coffee.id}')">Editar</button>
            <button class="btn btn-sm btn-primary" onclick="QuotationManager.createForCoffee('${coffee.id}')">Cotizar</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showForm(coffee = null) {
    const isEdit = !!coffee;
    const modal = document.getElementById('coffee-modal');
    const title = document.getElementById('coffee-modal-title');
    title.textContent = isEdit ? 'Editar Café' : 'Nuevo Café';

    const form = document.getElementById('coffee-form');
    form.innerHTML = `
      <input type="hidden" id="coffee-id" value="${coffee?.id || ''}">
      <div class="form-row">
        <div class="form-group">
          <label>Nombre del Café / Productor</label>
          <input type="text" class="form-control" id="coffee-name" value="${coffee?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Caficultor</label>
          <input type="text" class="form-control" id="coffee-farmer" value="${coffee?.farmer || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Variedad</label>
        <div class="selection-grid" id="variety-selection">
          ${COFFEE_VARIETIES.map(v => `
            <button type="button" class="selection-btn ${coffee?.variety === v ? 'active' : ''}" data-value="${v}">${v}</button>
          `).join('')}
        </div>
        <input type="hidden" id="coffee-variety" value="${coffee?.variety || ''}">
      </div>
      <div class="form-group">
        <label>Región</label>
        <div class="selection-grid" id="region-selection">
          ${COLOMBIAN_REGIONS.map(r => `
            <button type="button" class="selection-btn ${coffee?.region === r ? 'active' : ''}" data-value="${r}">${r}</button>
          `).join('')}
        </div>
        <input type="hidden" id="coffee-region" value="${coffee?.region || ''}">
      </div>
      <div class="form-group">
        <label>Proceso</label>
        <div class="selection-grid" id="process-selection">
          ${COFFEE_PROCESSES.map(p => `
            <button type="button" class="selection-btn ${coffee?.process === p ? 'active' : ''}" data-value="${p}">${p}</button>
          `).join('')}
        </div>
        <input type="hidden" id="coffee-process" value="${coffee?.process || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fermentación</label>
          <input type="text" class="form-control" id="coffee-fermentation" value="${coffee?.fermentation || ''}" placeholder="Ej: 24 horas">
        </div>
        <div class="form-group">
          <label>Altitud</label>
          <input type="text" class="form-control" id="coffee-altitude" value="${coffee?.altitude || ''}" placeholder="Ej: 1800 msnm">
        </div>
      </div>
      <div class="form-group">
        <label>Estado del Café</label>
        <div class="selection-grid" id="state-selection">
          ${Object.entries(COFFEE_STATES).map(([key, val]) => `
            <button type="button" class="selection-btn ${coffee?.state === key ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="coffee-state" value="${coffee?.state || 'verde'}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Precio por Kg (COP)</label>
          <input type="number" class="form-control" id="coffee-price" value="${coffee?.pricePerKg || ''}" required>
        </div>
        <div class="form-group">
          <label>Transporte incluido en precio</label>
          <div class="toggle-group" style="margin-top: 8px;">
            <label class="toggle">
              <input type="checkbox" id="coffee-transport-included" ${coffee?.transportIncluded !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span id="transport-status">${coffee?.transportIncluded !== false ? 'Incluido' : 'No incluido'}</span>
          </div>
        </div>
      </div>
      <div class="form-group" id="transport-cost-group" style="${coffee?.transportIncluded !== false ? 'display:none' : ''}">
        <label>Costo de Transporte (por kg)</label>
        <input type="number" class="form-control" id="coffee-transport-cost" value="${coffee?.transportCost || 0}">
      </div>
      <div class="form-group">
        <label>Imagen del Producto</label>
        <div class="image-upload" id="coffee-image-upload">
          ${coffee?.image ? `<img src="${coffee.image}" alt="Preview">` : '<p>📷 Arrastra o haz clic para subir imagen</p>'}
          <input type="file" accept="image/*" id="coffee-image-input" style="display:none">
        </div>
        <input type="hidden" id="coffee-image" value="${coffee?.image || ''}">
      </div>
      <div class="form-group">
        <label>Notas de Cata</label>
        <textarea class="form-control" id="coffee-notes" rows="3">${coffee?.notes || ''}</textarea>
      </div>
    `;

    this.bindFormEvents();
    modal.classList.add('active');
  },

  bindFormEvents() {
    ['variety-selection', 'region-selection', 'process-selection', 'state-selection'].forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      const hiddenId = id.replace('-selection', '');
      container.querySelectorAll('.selection-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.selection-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById(`coffee-${hiddenId}`).value = btn.dataset.value;
        });
      });
    });

    const transportToggle = document.getElementById('coffee-transport-included');
    if (transportToggle) {
      transportToggle.addEventListener('change', (e) => {
        document.getElementById('transport-status').textContent = e.target.checked ? 'Incluido' : 'No incluido';
        document.getElementById('transport-cost-group').style.display = e.target.checked ? 'none' : 'block';
      });
    }

    const imageUpload = document.getElementById('coffee-image-upload');
    const imageInput = document.getElementById('coffee-image-input');
    if (imageUpload && imageInput) {
      imageUpload.addEventListener('click', () => imageInput.click());
      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById('coffee-image').value = ev.target.result;
            imageUpload.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  },

  saveFromForm() {
    const coffee = {
      id: document.getElementById('coffee-id').value || undefined,
      name: document.getElementById('coffee-name').value,
      farmer: document.getElementById('coffee-farmer').value,
      variety: document.getElementById('coffee-variety').value,
      region: document.getElementById('coffee-region').value,
      process: document.getElementById('coffee-process').value,
      fermentation: document.getElementById('coffee-fermentation').value,
      altitude: document.getElementById('coffee-altitude').value,
      state: document.getElementById('coffee-state').value,
      pricePerKg: parseFloat(document.getElementById('coffee-price').value),
      transportIncluded: document.getElementById('coffee-transport-included').checked,
      transportCost: parseFloat(document.getElementById('coffee-transport-cost').value) || 0,
      image: document.getElementById('coffee-image').value || null,
      notes: document.getElementById('coffee-notes').value
    };

    if (!coffee.name || !coffee.pricePerKg) {
      Toast.show('Complete los campos obligatorios', 'danger');
      return;
    }

    this.save(coffee);
    document.getElementById('coffee-modal').classList.remove('active');
    App.renderSection('coffees');
  },

  edit(id) {
    const coffee = this.getById(id);
    if (coffee) this.showForm(coffee);
  },

  create() {
    this.showForm();
  }
};
