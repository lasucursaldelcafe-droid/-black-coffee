const CoffeeManager = {
  getAll() {
    return Storage.get(STORAGE_KEYS.COFFEES) || [];
  },

  getById(id) {
    return this.getAll().find(c => c.id === id);
  },

  findSupplierForCoffee(coffee) {
    if (!coffee) return null;
    const suppliers = SupplierManager.getByCategory('coffee');
    if (coffee.supplierId) {
      const linked = suppliers.find((s) => s.id === coffee.supplierId);
      if (linked) return linked;
    }
    const farmer = (coffee.farmer || '').trim().toLowerCase();
    const name = (coffee.name || '').trim().toLowerCase();
    return suppliers.find((s) => {
      const supplierName = (s.name || '').trim().toLowerCase();
      return supplierName && (supplierName === farmer || supplierName === name);
    }) || null;
  },

  resolveSupplierId(coffee) {
    return this.findSupplierForCoffee(coffee)?.id || coffee?.supplierId || '';
  },

  getStateInventoryHint(state) {
    const stageKey = getInventoryStageForCoffeeState(state);
    const stage = INVENTORY_PIPELINE_STAGES[stageKey];
    const stateInfo = COFFEE_STATES[state];
    if (!stage) return stateInfo?.description || '';
    return `Las entradas de este café se registran en inventario <strong>${stage.shortLabel}</strong> (${stage.label}). Use Inventario → Entrada por Etapa o el menú Transformación.`;
  },

  applySupplierToForm(supplierId) {
    const supplier = supplierId ? SupplierManager.getById(supplierId) : null;
    const farmerInput = document.getElementById('coffee-farmer');
    const regionHidden = document.getElementById('coffee-region');
    if (!supplier) return;

    if (farmerInput && !farmerInput.value.trim()) {
      farmerInput.value = supplier.name;
    }

    const region = supplier.region || supplier.department || '';
    if (region && regionHidden && !regionHidden.value) {
      regionHidden.value = region;
      const regionContainer = document.getElementById('region-selection');
      regionContainer?.querySelectorAll('.selection-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.value === region);
      });
    }
  },

  save(coffee, options = {}) {
    const linkedSupplier = this.findSupplierForCoffee(coffee);
    if (!coffee.supplierId && linkedSupplier) {
      coffee.supplierId = linkedSupplier.id;
    }
    if (!coffee.farmer && linkedSupplier) {
      coffee.farmer = linkedSupplier.name;
    }

    const coffees = this.getAll();
    const index = coffees.findIndex(c => c.id === coffee.id);

    if (index >= 0) {
      coffees[index] = { ...coffees[index], ...coffee, updatedAt: new Date().toISOString() };
      coffee = coffees[index];
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
        selectedKg: 0,
        groundKg: 0,
        packagedUnits: {},
        minStockKg: 0,
        lastUpdated: new Date().toISOString()
      });
      Storage.set(STORAGE_KEYS.INVENTORY, inventory);
    }

    Storage.set(STORAGE_KEYS.COFFEES, coffees);
    if (options.notify !== false) {
      Notifications.add(`Café "${coffee.name}" guardado`, 'success', {
        section: 'coffees', entityId: coffee.id, action: 'edit'
      });
    }
    return coffee;
  },

  delete(id) {
    const coffee = this.getById(id);
    if (!coffee) return;

    Storage.deleteFromList(STORAGE_KEYS.COFFEES, id);

    const inventory = (Storage.get(STORAGE_KEYS.INVENTORY) || []).filter((i) => i.coffeeId !== id);
    Storage.set(STORAGE_KEYS.INVENTORY, inventory, { immediate: true });

    AuditLog.log('delete_coffee', coffee.name, { coffeeName: coffee.name, coffeeId: id });
    Notifications.add(`Café "${coffee.name}" eliminado`, 'warning', { section: 'coffees' });
  },

  confirmDelete(id) {
    const coffee = this.getById(id);
    if (!coffee) return;
    if (confirm(`¿Eliminar el café "${coffee.name}" y su inventario asociado? Esta acción no se puede deshacer.`)) {
      this.delete(id);
      App.renderSection('coffees');
    }
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

    container.innerHTML = coffees.map(coffee => {
      const supplier = this.findSupplierForCoffee(coffee);
      const supplierLabel = supplier
        ? `<br><span class="form-hint">Proveedor: ${supplier.name}${supplier.region ? ` · ${supplier.region}` : ''}</span>`
        : '';

      return `
      <div class="coffee-card" data-id="${coffee.id}">
        <div class="coffee-card-image">
          ${coffee.image 
            ? `<img src="${coffee.image}" alt="${coffee.name}">` 
            : '<span style="font-size:3rem;opacity:0.3">☕</span>'}
        </div>
        <div class="coffee-card-body">
          <div class="coffee-card-title">${coffee.name}</div>
          <div class="coffee-card-meta">
            ${getCoffeeVarietyLabel(coffee)} · ${coffee.region} · ${coffee.process}
            ${coffee.fermentation ? `<br>${coffee.fermentation}` : ''}
            ${supplierLabel}
          </div>
          <div class="coffee-card-price">${formatCurrency(coffee.pricePerKg)}/kg</div>
          <div class="action-buttons" style="margin-top:12px">
            <button class="btn btn-sm btn-secondary" onclick="CoffeeManager.edit('${coffee.id}')">Editar</button>
            <button class="btn btn-sm btn-primary" onclick="QuotationManager.createForCoffee('${coffee.id}')">Cotizar</button>
            <button class="btn btn-sm btn-danger" onclick="CoffeeManager.confirmDelete('${coffee.id}')">Eliminar</button>
          </div>
        </div>
      </div>
    `;
    }).join('');
  },

  showForm(coffee = null) {
    const isEdit = !!coffee;
    const modal = document.getElementById('coffee-modal');
    const title = document.getElementById('coffee-modal-title');
    title.textContent = isEdit ? 'Editar Café' : 'Nuevo Café';
    const selectedSupplierId = this.resolveSupplierId(coffee || {});

    const form = document.getElementById('coffee-form');
    form.innerHTML = `
      <input type="hidden" id="coffee-id" value="${coffee?.id || ''}">
      <div class="form-group">
        <label>Proveedor de café</label>
        ${SupplierManager.renderSelect('compra', {
          id: 'coffee-supplier',
          selectedId: selectedSupplierId,
          placeholder: 'Seleccionar proveedor de café...'
        })}
        <p class="form-hint" style="margin-top:4px">Registre caficultores en <strong>Proveedores</strong> para vincularlos aquí.</p>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nombre del Café / Productor</label>
          <input type="text" class="form-control" id="coffee-name" value="${coffee?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Caficultor</label>
          <input type="text" class="form-control" id="coffee-farmer" value="${coffee?.farmer || ''}" placeholder="Se completa al elegir proveedor">
        </div>
      </div>
      <div class="form-group">
        <label>Variedad</label>
        <div class="selection-grid" id="variety-selection">
          ${COFFEE_VARIETIES.map(v => `
            <button type="button" class="selection-btn ${(coffee?.variety === v || (v === COFFEE_VARIETY_OTHER && coffee?.varietyCustom && !COFFEE_VARIETIES.includes(coffee?.variety))) ? 'active' : ''}" data-value="${v}">${v}</button>
          `).join('')}
        </div>
        <input type="hidden" id="coffee-variety" value="${coffee?.variety === COFFEE_VARIETY_OTHER || (coffee?.varietyCustom && !COFFEE_VARIETIES.includes(coffee?.variety || '')) ? COFFEE_VARIETY_OTHER : (coffee?.variety || '')}">
        <div class="form-group" id="coffee-variety-custom-group" style="margin-top:12px;${(coffee?.variety === COFFEE_VARIETY_OTHER || coffee?.varietyCustom) ? '' : 'display:none'}">
          <label>Nombre de la variedad</label>
          <input type="text" class="form-control" id="coffee-variety-custom" value="${coffee?.varietyCustom || (coffee?.variety && !COFFEE_VARIETIES.includes(coffee.variety) ? coffee.variety : '')}" placeholder="Ej: Pink Bourbon, Chiroso, Sidra...">
          <p class="form-hint">Los Borbón no son únicos — indique la variedad específica.</p>
        </div>
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
        <label>Proceso de beneficio</label>
        <p class="form-hint" style="margin-bottom:8px">Lavado, Natural, Honey, etc. — identifica el café en cotizaciones y PDF.</p>
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
        <label>Estado del grano (define transformaciones y costo)</label>
        <div class="selection-grid" id="state-selection">
          ${Object.entries(COFFEE_STATES).map(([key, val]) => `
            <button type="button" class="selection-btn ${coffee?.state === key ? 'active' : ''}" data-value="${key}" title="${val.description || ''}">
              ${val.label}${val.description ? `<br><small style="opacity:0.7">${val.description}</small>` : ''}
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="coffee-state" value="${coffee?.state || 'verde'}">
        <p class="form-hint" id="coffee-state-hint" style="margin-top:8px">
          ${this.getStateInventoryHint(coffee?.state || 'verde')}
        </p>
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
          if (id === 'variety-selection') {
            const customGroup = document.getElementById('coffee-variety-custom-group');
            if (customGroup) {
              customGroup.style.display = btn.dataset.value === COFFEE_VARIETY_OTHER ? '' : 'none';
            }
          }
          if (id === 'state-selection') {
            const hint = document.getElementById('coffee-state-hint');
            if (hint) hint.innerHTML = CoffeeManager.getStateInventoryHint(btn.dataset.value);
          }
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

    const supplierSelect = document.getElementById('coffee-supplier');
    if (supplierSelect) {
      supplierSelect.addEventListener('change', (e) => {
        const supplier = SupplierManager.getById(e.target.value);
        if (!supplier) return;
        const farmerInput = document.getElementById('coffee-farmer');
        if (farmerInput) farmerInput.value = supplier.name;
        this.applySupplierToForm(supplier.id);
      });
    }
  },

  saveFromForm() {
    const supplierId = document.getElementById('coffee-supplier')?.value || null;
    const supplier = supplierId ? SupplierManager.getById(supplierId) : null;
    let farmer = document.getElementById('coffee-farmer').value.trim();
    if (!farmer && supplier) farmer = supplier.name;

    let variety = document.getElementById('coffee-variety').value;
    let varietyCustom = '';
    if (variety === COFFEE_VARIETY_OTHER) {
      varietyCustom = document.getElementById('coffee-variety-custom')?.value?.trim() || '';
      if (!varietyCustom) {
        Toast.show('Indique el nombre de la variedad', 'danger');
        return;
      }
    }

    const coffee = {
      id: document.getElementById('coffee-id').value || undefined,
      name: document.getElementById('coffee-name').value,
      supplierId: supplierId || null,
      farmer,
      variety,
      varietyCustom: varietyCustom || null,
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

    if (!coffee.name || Number.isNaN(coffee.pricePerKg)) {
      Toast.show('Complete los campos obligatorios', 'danger');
      return;
    }

    if (!coffee.process) {
      Toast.show('Seleccione el proceso de beneficio del café', 'danger');
      return;
    }

    if (!coffee.state) {
      Toast.show('Seleccione el estado del grano', 'danger');
      return;
    }

    this.save(coffee);
    Toast.show(`Café "${coffee.name}" guardado`, 'success');
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
