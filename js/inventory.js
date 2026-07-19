const InventoryManager = {
  _batchFilter: 'all',
  _pendingStageEntry: null,

  _setSaveButtonVisible(visible = true) {
    const btn = document.getElementById('save-inventory-btn');
    if (btn) btn.style.display = visible ? '' : 'none';
  },

  getProductionBatches(coffeeId = null) {
    const batches = Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES) || [];
    if (!coffeeId || coffeeId === 'all') return batches;
    return batches.filter((b) => b.coffeeId === coffeeId);
  },

  setBatchFilter(coffeeId) {
    this._batchFilter = coffeeId || 'all';
    App.renderSection('inventory');
  },

  formatBatchSteps(batch) {
    if (!batch.steps?.length) return 'Sin proveedores registrados';
    return batch.steps
      .map((s) => `${s.label}: ${s.supplierName || '—'}`)
      .join(' · ');
  },

  getSupplierSnapshot(supplierId) {
    const supplier = supplierId ? SupplierManager.getById(supplierId) : null;
    if (!supplier) {
      return { supplierId: null, supplierName: '—', invima: '', kimba: '', address: '', city: '' };
    }
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      invima: supplier.invima || '',
      kimba: supplier.kimba || '',
      address: supplier.address || '',
      city: supplier.city || '',
      department: supplier.department || supplier.region || ''
    };
  },
  getAll() {
    return (Storage.get(STORAGE_KEYS.INVENTORY) || []).map(normalizeInventoryItem);
  },

  getByCoffeeId(coffeeId) {
    const item = this.getAll().find((i) => i.coffeeId === coffeeId);
    return item ? normalizeInventoryItem(item) : undefined;
  },

  getStageQuantity(item, stageKey) {
    const stage = INVENTORY_PIPELINE_STAGES[stageKey];
    if (!stage) return 0;
    if (stage.isPackaged) return getPackagedUnitsTotal(item.packagedUnits);
    return item[stage.field] || 0;
  },

  addStageEntry(coffeeId, stageKey, payload) {
    const stage = INVENTORY_PIPELINE_STAGES[stageKey];
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    if (!stage || !coffee || !item) return false;

    const {
      quantity,
      cost = 0,
      packaging = '250g',
      suppliers = {},
      packagingMaterialCost = 0,
      packagingLaborCost = 0,
      clientProvidesPackaging = false
    } = payload;

    const session = Auth.getSession();
    let changes = {};
    let auditDetails = {
      coffeeName: coffee.name,
      coffeeId,
      stage: stage.label,
      stageKey,
      costPerUnit: cost,
      supplierName: null
    };

    if (stage.isPackaged) {
      const qty = Math.max(0, parseInt(String(quantity), 10) || 0);
      if (qty <= 0) {
        Toast.show('Ingrese una cantidad válida de unidades', 'danger');
        return false;
      }
      const nextUnits = { ...item.packagedUnits };
      nextUnits[packaging] = (nextUnits[packaging] || 0) + qty;
      changes = { packagedUnits: nextUnits };
      auditDetails = {
        ...auditDetails,
        packaging,
        quantity: qty,
        unit: 'uds',
        costPerUnit: cost,
        packagingMaterialCost,
        packagingLaborCost,
        clientProvidesPackaging,
        totalCost: qty * cost,
        supplierId: suppliers.empacada || null,
        supplierName: SupplierManager.getName(suppliers.empacada)
      };
    } else {
      const kg = parseFloat(quantity);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida en kg', 'danger');
        return false;
      }
      changes = { [stage.field]: (item[stage.field] || 0) + kg };
      const primarySupplier = stage.supplierServices[0];
      auditDetails = {
        ...auditDetails,
        kg,
        quantity: kg,
        unit: 'kg',
        costPerKg: cost,
        totalCost: kg * cost,
        supplierId: suppliers[primarySupplier] || null,
        supplierName: SupplierManager.getName(suppliers[primarySupplier])
      };
    }

    this.update(coffeeId, changes, {
      action: stage.auditAction,
      entity: coffee.name,
      details: auditDetails
    });

    const purchases = Storage.get(STORAGE_KEYS.PURCHASES) || [];
    purchases.push({
      id: Storage.generateId(),
      coffeeId,
      stageKey,
      kg: stage.isPackaged ? undefined : auditDetails.kg,
      packaging: stage.isPackaged ? packaging : undefined,
      units: stage.isPackaged ? auditDetails.quantity : undefined,
      costPerKg: stage.isPackaged ? undefined : cost,
      costPerUnit: stage.isPackaged ? cost : undefined,
      packagingMaterialCost: stage.isPackaged ? packagingMaterialCost : undefined,
      packagingLaborCost: stage.isPackaged ? packagingLaborCost : undefined,
      clientProvidesPackaging: stage.isPackaged ? clientProvidesPackaging : undefined,
      totalCost: auditDetails.totalCost,
      stockType: stageKey,
      supplierId: auditDetails.supplierId,
      userId: session?.userId,
      userName: session?.name,
      date: new Date().toISOString()
    });
    Storage.set(STORAGE_KEYS.PURCHASES, purchases);

    Notifications.add(`Entrada registrada: ${stage.shortLabel} · ${coffee.name}`, 'success', {
      section: 'inventory', entityId: coffeeId, action: 'purchase'
    });
    return true;
  },

  addPurchase(coffeeId, kg, cost, supplierIds = {}) {
    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;
    const stageKey = getInventoryStageForCoffeeState(coffee.state);
    const suppliers = typeof supplierIds === 'object' ? supplierIds : { compra: supplierIds };
    return this.addStageEntry(coffeeId, stageKey, { quantity: kg, cost, suppliers });
  },

  addRoastedPurchase(coffeeId, kg, cost, supplierIds = {}) {
    const suppliers = typeof supplierIds === 'object' ? supplierIds : { tostion: supplierIds };
    return this.addStageEntry(coffeeId, 'roasted', { quantity: kg, cost, suppliers });
  },

  update(coffeeId, changes, auditMeta = null, options = {}) {
    const inventory = this.getAll();
    const index = inventory.findIndex((i) => i.coffeeId === coffeeId);

    if (index >= 0) {
      inventory[index] = { ...inventory[index], ...changes, lastUpdated: new Date().toISOString() };
    }

    Storage.set(STORAGE_KEYS.INVENTORY, inventory);

    if (auditMeta) {
      AuditLog.log(auditMeta.action, auditMeta.entity, auditMeta.details);
    }

    if (!options.skipStockCheck) {
      this.checkLowStock(coffeeId);
    }
    return inventory[index];
  },

  processRoasting(coffeeId, greenKg, supplierId = null, activeSteps = ['tostion']) {
    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    if (!isGreenCoffeeState(coffee.state)) {
      Toast.show('Use "Entrada por etapa" para cafés que no están en verde/pergamino.', 'warning');
      return;
    }

    const item = this.getByCoffeeId(coffeeId);
    if (!item || item.greenKg < greenKg) {
      Toast.show('Stock insuficiente de café verde', 'danger');
      return;
    }

    const result = ProductionCosts.calculateGreenToRoasted(greenKg, coffee.state, activeSteps);
    this.update(coffeeId, {
      greenKg: item.greenKg - greenKg,
      roastedKg: item.roastedKg + result.roastedKg
    }, {
      action: 'roast',
      entity: coffee.name,
      details: {
        coffeeName: coffee.name,
        coffeeId,
        greenKg,
        roastedKg: result.roastedKg,
        mermaKg: greenKg - result.roastedKg,
        supplierId,
        supplierName: SupplierManager.getName(supplierId)
      }
    });

    Notifications.add(`Tostión completada: ${formatNumber(result.roastedKg)}kg tostado`, 'info', {
      section: 'inventory', entityId: coffeeId, action: 'roast'
    });
    return result;
  },

  registerProductionBatch(coffeeId, greenKg, processSuppliers = {}) {
    const coffee = CoffeeManager.getById(coffeeId);
    if (!coffee) return;

    if (coffee.state !== 'verde' && coffee.state !== 'pergamino') {
      Toast.show('Este café ya está en estado procesado. Use "Entrada por etapa".', 'warning');
      return;
    }

    const activeSteps = ProductionCosts.getActiveSteps({
      productionMode: 'full_pack',
      coffee,
      grindType: 'grano'
    });

    const result = this.processRoasting(
      coffeeId,
      greenKg,
      processSuppliers.tostion || null,
      activeSteps.filter((s) => ['trilla', 'greenSelection', 'tostion', 'seleccion'].includes(s))
    );
    if (!result) return;

    const steps = activeSteps.map((stepKey) => ({
      step: stepKey,
      label: getProcessSupplierLabel(stepKey),
      ...this.getSupplierSnapshot(processSuppliers[stepKey])
    }));

    const batches = Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES) || [];
    const session = Auth.getSession();
    batches.unshift({
      id: Storage.generateId(),
      coffeeId,
      coffeeName: coffee.name,
      greenKg,
      roastedKg: result.roastedKg,
      processSuppliers,
      steps,
      userId: session?.userId,
      userName: session?.name,
      createdAt: new Date().toISOString()
    });
    if (batches.length > 100) batches.length = 100;
    Storage.set(STORAGE_KEYS.PRODUCTION_BATCHES, batches);

    AuditLog.log('production_batch', coffee.name, {
      coffeeName: coffee.name,
      coffeeId,
      greenKg,
      roastedKg: result.roastedKg,
      steps
    });

    Notifications.add(`Lote de producción registrado: ${coffee.name}`, 'success', {
      section: 'inventory', entityId: coffeeId
    });
  },

  adjustStock(coffeeId, field, newValue, reason = '') {
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    if (!coffee || !item) return;

    if (!['greenKg', 'roastedKg', 'selectedKg', 'groundKg'].includes(field)) {
      Toast.show('Campo de inventario no válido', 'danger');
      return;
    }

    const fieldLabels = {
      greenKg: 'Café verde',
      roastedKg: 'Café tostado',
      selectedKg: 'Café seleccionado',
      groundKg: 'Café molido'
    };

    const parsed = parseFloat(newValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      Toast.show('Ingrese una cantidad válida', 'danger');
      return;
    }

    const previousValue = item[field];
    if (parsed === previousValue) {
      Toast.show('El valor no ha cambiado', 'warning');
      return;
    }

    const fieldLabel = fieldLabels[field] || field;
    this.update(coffeeId, { [field]: parsed }, {
      action: 'adjust',
      entity: coffee.name,
      details: {
        coffeeName: coffee.name,
        coffeeId,
        field: fieldLabel,
        previousValue: formatNumber(previousValue),
        newValue: formatNumber(parsed),
        reason
      }
    });

    Notifications.add(`Inventario ajustado: ${coffee.name} (${fieldLabel})`, 'info', {
      section: 'inventory', entityId: coffeeId
    });
  },

  checkLowStock(coffeeId) {
    const item = this.getByCoffeeId(coffeeId);
    const coffee = CoffeeManager.getById(coffeeId);
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    if (!item || !coffee) return;

    const threshold = item.minStockKg || settings.lowStockThreshold;
    const stageKey = getInventoryStageForCoffeeState(coffee.state);
    const stockKg = stageKey === 'packaged'
      ? getPackagedUnitsTotal(item.packagedUnits)
      : (item[INVENTORY_PIPELINE_STAGES[stageKey]?.field] ?? item.greenKg);
    if (stockKg > threshold) {
      if (item.lastLowStockAlertAt) {
        this.update(coffeeId, { lastLowStockAlertAt: null }, null, { skipStockCheck: true });
      }
      return;
    }

    const now = Date.now();
    const lastAlert = item.lastLowStockAlertAt ? Date.parse(item.lastLowStockAlertAt) : 0;
    if (lastAlert && now - lastAlert < 24 * 60 * 60 * 1000) return;

    this.update(coffeeId, { lastLowStockAlertAt: new Date().toISOString() }, null, { skipStockCheck: true });

    const stageLabel = INVENTORY_PIPELINE_STAGES[stageKey]?.shortLabel || coffee.state;
    Notifications.add(
      `⚠️ Stock bajo: ${coffee.name} (${formatNumber(stockKg)} ${stageKey === 'packaged' ? 'uds' : 'kg'} ${stageLabel} restantes)`,
      'warning',
      { section: 'inventory', entityId: coffeeId, action: 'purchase' }
    );
    EmailService.sendNotification('Alerta de Stock Bajo',
      `El café "${coffee.name}" tiene solo ${formatNumber(stockKg)} ${stageKey === 'packaged' ? 'unidades' : 'kg'} (${stageLabel}) en inventario. Se recomienda registrar una nueva entrada.`);
  },

  checkAllLowStock() {
    const inventory = this.getAll();
    inventory.forEach((item) => this.checkLowStock(item.coffeeId));
  },

  renderDashboard(container) {
    const inventory = this.getAll();
    const coffees = CoffeeManager.getAll();
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    if (inventory.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>Inventario vacío</h3>
          <p>Agrega cafés para comenzar a gestionar el inventario</p>
        </div>`;
      return;
    }

    const pipelineBar = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title">Entrada por Etapa del Proceso</span>
        </div>
        <p class="form-hint" style="margin-bottom:12px">Registre café en cualquier punto: llegada, tostión, selección, molienda o empaque.</p>
        <div class="selection-grid">
          ${Object.entries(INVENTORY_PIPELINE_STAGES).map(([key, stage]) => `
            <button type="button" class="selection-btn pipeline-entry-btn" onclick="InventoryManager.showStageEntryForm(null, '${key}')">
              <span style="font-size:1.4rem">${stage.icon}</span>
              <strong>${stage.shortLabel}</strong>
              <small style="opacity:0.75;display:block;margin-top:4px">${stage.label}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const cardsHtml = inventory.map((item) => {
      const coffee = coffees.find((c) => c.id === item.coffeeId);
      if (!coffee) return '';

      const stageKey = getInventoryStageForCoffeeState(coffee.state);
      const primaryStock = stageKey === 'packaged'
        ? getPackagedUnitsTotal(item.packagedUnits)
        : item[INVENTORY_PIPELINE_STAGES[stageKey]?.field] ?? 0;
      const isLow = primaryStock <= (item.minStockKg ?? settings.lowStockThreshold ?? 0);
      const stateLabel = COFFEE_STATES[coffee.state]?.label || coffee.state;
      const mermaInfo = isGreenCoffeeState(coffee.state)
        ? ProductionCosts.getMermaDetails(1, coffee.state)
        : { totalLossPercent: '0', details: [] };

      const stageStats = Object.entries(INVENTORY_PIPELINE_STAGES).map(([key, stage]) => {
        const val = stage.isPackaged
          ? formatPackagedUnitsSummary(item.packagedUnits)
          : `${formatNumber(item[stage.field] || 0)} kg`;
        return `
          <div class="inventory-stage-stat">
            <div class="stat-label">${stage.icon} ${stage.shortLabel}</div>
            <div class="stat-value inventory-stat" style="font-size:1rem">${val}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="card inventory-card">
          <div class="card-header">
            <div>
              <div class="card-title">${coffee.name}</div>
              <span style="font-size:0.85rem;color:var(--text-muted)">${coffee.variety} · ${coffee.region} · <span class="badge badge-neutral">${stateLabel}</span></span>
            </div>
            ${isLow ? '<span class="badge badge-danger">Stock Bajo</span>' : '<span class="badge badge-success">OK</span>'}
          </div>
          <div class="inventory-pipeline-stats">${stageStats}</div>
          ${isGreenCoffeeState(coffee.state) ? `
          <div class="cost-breakdown" style="margin-bottom:16px">
            <h4 style="margin-bottom:8px;font-size:0.9rem">Mermas estimadas (desde verde)</h4>
            ${mermaInfo.details.map((d) => `
              <div class="cost-row">
                <span class="cost-label">${d.name} (${d.percent}%)</span>
                <span class="cost-value">-${formatNumber(d.lossKg * 100)}g por kg</span>
              </div>
            `).join('') || '<p class="form-hint">Sin mermas configuradas</p>'}
          </div>` : ''}
          <div class="action-buttons">
            <button class="btn btn-sm btn-primary" onclick="InventoryManager.showStageEntryForm('${coffee.id}')">+ Entrada por Etapa</button>
            ${isGreenCoffeeState(coffee.state) ? `
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showRoastForm('${coffee.id}')">Transformar (Tostión)</button>
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showProductionBatchForm('${coffee.id}')">Lote con Proveedores</button>` : ''}
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.setBatchFilter('${coffee.id}')">Ver Lotes</button>
            <button class="btn btn-sm btn-secondary" onclick="InventoryManager.showAdjustForm('${coffee.id}')">Ajustar Stock</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      ${pipelineBar}
      <div class="grid-auto inventory-grid">${cardsHtml}</div>
      <div class="section" style="margin-top:32px">
        <div class="section-header">
          <h3 class="section-title">Historial de Lotes de Producción</h3>
          <span class="form-hint">Proveedores por proceso en cada lote</span>
        </div>
        <div class="card">
          <div id="production-batch-history"></div>
        </div>
      </div>
      <div class="section" style="margin-top:32px">
        <div class="section-header">
          <h3 class="section-title">Historial de Movimientos</h3>
          <span class="form-hint">Registro de quién realizó cada cambio</span>
        </div>
        <div class="card">
          <div id="inventory-audit-log"></div>
        </div>
      </div>
    `;

    this.renderProductionHistory(document.getElementById('production-batch-history'));
    AuditLog.renderLog(document.getElementById('inventory-audit-log'), { limit: 30 });
  },

  renderProductionHistory(container) {
    if (!container) return;

    const coffees = CoffeeManager.getAll();
    const batches = this.getProductionBatches(this._batchFilter === 'all' ? null : this._batchFilter);

    const filterButtons = [
      ['all', 'Todos los cafés'],
      ...coffees.map((c) => [c.id, c.name])
    ];

    if (batches.length === 0) {
      container.innerHTML = `
        <div class="filter-bar">
          ${filterButtons.map(([key, label]) => `
            <button type="button" class="btn btn-sm ${this._batchFilter === key ? 'btn-primary' : 'btn-secondary'}"
              onclick="InventoryManager.setBatchFilter('${key}')">${label}</button>
          `).join('')}
        </div>
        <div class="empty-state" style="padding:24px">
          <div class="empty-state-icon">⚙️</div>
          <h3>Sin lotes registrados</h3>
          <p>Use <strong>Lote con Proveedores</strong> en un café para registrar tostión y proveedores por proceso</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="filter-bar">
        ${filterButtons.map(([key, label]) => `
          <button type="button" class="btn btn-sm ${this._batchFilter === key ? 'btn-primary' : 'btn-secondary'}"
            onclick="InventoryManager.setBatchFilter('${key}')">${label}</button>
        `).join('')}
      </div>
      <div class="batch-history-list">
        ${batches.map((batch) => `
          <div class="batch-history-item" onclick="InventoryManager.showBatchDetail('${batch.id}')">
            <div class="batch-history-header">
              <div>
                <div class="batch-history-title">${batch.coffeeName}</div>
                <div class="batch-history-meta">
                  ${formatDateTime(batch.createdAt)} · ${batch.userName || 'Usuario'}
                </div>
              </div>
              <div class="batch-history-yield">
                <span class="batch-yield-in">${formatNumber(batch.greenKg)} kg verde</span>
                <span class="batch-yield-arrow">→</span>
                <span class="batch-yield-out">${formatNumber(batch.roastedKg)} kg tostado</span>
              </div>
            </div>
            <div class="batch-supplier-chips">
              ${(batch.steps || []).map((step) => `
                <span class="batch-supplier-chip ${step.supplierId ? '' : 'batch-supplier-chip--empty'}">
                  <strong>${step.label}</strong>
                  ${step.supplierName || 'Sin asignar'}
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  showBatchDetail(batchId) {
    const batches = Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES) || [];
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;

    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Lote — ${batch.coffeeName}`;
    this._setSaveButtonVisible(false);

    const mermaPct = batch.greenKg > 0
      ? formatNumber(((batch.greenKg - batch.roastedKg) / batch.greenKg) * 100, 1)
      : '0';

    document.getElementById('inventory-form').innerHTML = `
      <div class="cost-breakdown" style="margin-bottom:16px">
        <div class="cost-row"><span class="cost-label">Fecha</span><span>${formatDateTime(batch.createdAt)}</span></div>
        <div class="cost-row"><span class="cost-label">Registrado por</span><span>${batch.userName || '—'}</span></div>
        <div class="cost-row"><span class="cost-label">Entrada</span><span>${formatNumber(batch.greenKg)} kg verde</span></div>
        <div class="cost-row"><span class="cost-label">Salida</span><span>${formatNumber(batch.roastedKg)} kg tostado</span></div>
        <div class="cost-row"><span class="cost-label">Merma</span><span>${formatNumber(batch.greenKg - batch.roastedKg)} kg (${mermaPct}%)</span></div>
      </div>
      <h4 style="margin-bottom:12px;font-size:0.95rem">Proveedores por proceso</h4>
      ${(batch.steps || []).length ? (batch.steps || []).map((step) => `
        <div class="batch-detail-step">
          <div class="batch-detail-step-title">${step.label}</div>
          <div class="batch-detail-step-name">${step.supplierName || 'Sin proveedor asignado'}</div>
          ${step.address ? `<div class="form-hint" style="margin-top:4px">📍 ${step.address}${step.city ? `, ${step.city}` : ''}${step.department ? ` (${step.department})` : ''}</div>` : ''}
          <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
            ${step.invima ? `<span class="badge badge-success">INVIMA ${step.invima}</span>` : ''}
            ${step.kimba ? `<span class="badge badge-neutral">KIMBA ${step.kimba}</span>` : ''}
          </div>
        </div>
      `).join('') : '<p class="form-hint">No hay proveedores registrados en este lote</p>'}
    `;

    modal.classList.add('active');
  },

  getPackagingCostFromForm() {
    const packaging = document.getElementById('inv-packaging')?.value || '250g';
    const supplierId = document.getElementById('inv-supplier-empacada')?.value || null;
    const clientProvidesPackaging = document.getElementById('inv-client-packaging')?.checked === true;
    const breakdown = ProductionCosts.getPackagingEntryCosts(packaging, supplierId, { clientProvidesPackaging });

    const materialInput = document.getElementById('inv-packaging-material-cost');
    const laborInput = document.getElementById('inv-packaging-labor-cost');
    if (materialInput && document.activeElement !== materialInput) {
      materialInput.value = breakdown.materialCost;
    }
    if (laborInput && document.activeElement !== laborInput) {
      laborInput.value = breakdown.laborCost;
    }

    const materialCost = parseFloat(materialInput?.value) || 0;
    const laborCost = parseFloat(laborInput?.value) || 0;
    const totalPerUnit = materialCost + laborCost;

    const qty = parseInt(document.getElementById('inv-quantity')?.value || '0', 10) || 0;
    const preview = document.getElementById('inv-packaging-cost-preview');
    if (preview) {
      preview.innerHTML = `
        <div class="cost-row">
          <span class="cost-label">Material empaque</span>
          <span class="cost-value">${clientProvidesPackaging ? 'Aportado por cliente' : formatCurrency(materialCost)}/ud</span>
        </div>
        <div class="cost-row">
          <span class="cost-label">Mano de obra · ${breakdown.supplierName || 'Empacadora'}</span>
          <span class="cost-value">${formatCurrency(laborCost)}/ud</span>
        </div>
        <div class="cost-row cost-row-total">
          <span class="cost-label"><strong>Total por unidad</strong></span>
          <span class="cost-value"><strong>${formatCurrency(totalPerUnit)}</strong></span>
        </div>
        ${qty > 0 ? `
        <div class="cost-row">
          <span class="cost-label">Total entrada (${qty} uds)</span>
          <span class="cost-value">${formatCurrency(totalPerUnit * qty)}</span>
        </div>` : ''}`;
    }

    const totalHidden = document.getElementById('inv-cost');
    if (totalHidden) totalHidden.value = totalPerUnit;

    return {
      packaging,
      supplierId,
      clientProvidesPackaging,
      materialCost,
      laborCost,
      totalPerUnit
    };
  },

  bindPackagingCostEvents() {
    if (this._packagingCostBound) return;
    this._packagingCostBound = true;

    const refresh = () => {
      if (document.getElementById('inv-stage-key')?.value === 'packaged') {
        this.getPackagingCostFromForm();
      }
    };

    document.getElementById('inv-client-packaging')?.addEventListener('change', () => {
      const group = document.getElementById('inv-material-cost-group');
      const checked = document.getElementById('inv-client-packaging')?.checked;
      if (group) group.style.display = checked ? 'none' : '';
      refresh();
    });

    ['inv-packaging-material-cost', 'inv-packaging-labor-cost', 'inv-quantity'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', refresh);
    });

    document.getElementById('inventory-form')?.addEventListener('change', (event) => {
      if (event.target?.id === 'inv-supplier-empacada') refresh();
    });
  },

  showPurchaseForm(coffeeId) {
    const coffee = CoffeeManager.getById(coffeeId);
    const stageKey = coffee ? getInventoryStageForCoffeeState(coffee.state) : 'green';
    this.showStageEntryForm(coffeeId, stageKey);
  },

  showStageEntryForm(coffeeId = null, stageKey = null) {
    this._setSaveButtonVisible(true);
    const coffees = CoffeeManager.getAll();
    const defaults = ProductionCosts.get().defaultSuppliers || {};
    const modal = document.getElementById('inventory-modal');

    if (coffees.length === 0) {
      Toast.show('Primero agregue cafés al catálogo', 'warning');
      return;
    }

    const coffee = coffeeId ? CoffeeManager.getById(coffeeId) : null;
    const resolvedStage = stageKey
      || (coffee ? getInventoryStageForCoffeeState(coffee.state) : 'green');
    const stage = INVENTORY_PIPELINE_STAGES[resolvedStage];
    if (!stage) return;

    this._pendingStageEntry = { coffeeId: coffee?.id || null, stageKey: resolvedStage };
    this._packagingCostBound = false;

    document.getElementById('inventory-modal-title').textContent = coffee
      ? `Entrada — ${stage.shortLabel} · ${coffee.name}`
      : `Entrada por Etapa — ${stage.label}`;

    const coffeeOptions = coffees.map((c) => {
      const stageForCoffee = getInventoryStageForCoffeeState(c.state);
      const stageLabel = INVENTORY_PIPELINE_STAGES[stageForCoffee]?.shortLabel || c.state;
      return `<option value="${c.id}" ${coffee?.id === c.id ? 'selected' : ''}>${c.name} (${stageLabel})</option>`;
    }).join('');

    const stageButtons = Object.entries(INVENTORY_PIPELINE_STAGES).map(([key, s]) => `
      <button type="button" class="selection-btn stage-pick-btn ${key === resolvedStage ? 'active' : ''}"
        data-stage="${key}" title="${s.label}">
        <span style="font-size:1.2rem">${s.icon}</span>
        <strong>${s.shortLabel}</strong>
      </button>
    `).join('');

    const supplierFields = (sk) => {
      const st = INVENTORY_PIPELINE_STAGES[sk];
      if (!st) return '';
      return st.supplierServices.map((serviceKey) => `
        <div class="form-group stage-supplier-field" data-service="${serviceKey}">
          <label>${getProcessSupplierLabel(serviceKey)}${serviceKey === 'transporte' ? ' (opcional)' : ''}</label>
          ${SupplierManager.renderSelect(serviceKey, {
            id: `inv-supplier-${serviceKey}`,
            selectedId: serviceKey === 'compra' && coffee
              ? (coffee.supplierId || CoffeeManager.resolveSupplierId(coffee) || defaults.compra || '')
              : (defaults[serviceKey] || ''),
            placeholder: serviceKey === 'transporte' ? 'Sin transporte externo...' : 'Seleccionar proveedor...'
          })}
        </div>
      `).join('');
    };

    const packagedFields = `
      <div class="form-group stage-packaged-field" style="display:none">
        <label>Tamaño de empaque</label>
        <div class="selection-grid" id="inv-packaging-grid">
          ${Object.entries(PACKAGING_SIZES).map(([key, val]) => `
            <button type="button" class="selection-btn ${key === '250g' ? 'active' : ''}" data-value="${key}">${val.label}</button>
          `).join('')}
        </div>
        <input type="hidden" id="inv-packaging" value="250g">
      </div>
    `;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-action" value="stage_entry">
      <input type="hidden" id="inv-stage-key" value="${resolvedStage}">
      <p class="form-hint" style="margin-bottom:16px">
        Registre café en cualquier etapa: llegada, tostión, selección, molienda o empaque.
      </p>
      <div class="form-group">
        <label>Café</label>
        <select class="form-control" id="inv-coffee-id" required>
          <option value="">Seleccionar café...</option>
          ${coffeeOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Etapa del proceso</label>
        <div class="selection-grid" id="inv-stage-grid">${stageButtons}</div>
      </div>
      <div id="inv-stage-description" class="form-hint" style="margin-bottom:12px">${stage.label}</div>
      <div class="form-group">
        <label id="inv-quantity-label">Cantidad (${stage.unit})</label>
        <input type="number" class="form-control" id="inv-quantity" step="${stage.isPackaged ? '1' : '0.1'}" min="0" required>
      </div>
      <div id="inv-cost-standard" class="form-row" style="${stage.isPackaged ? 'display:none' : ''}">
        <div class="form-group" style="flex:1">
          <label id="inv-cost-label">${stage.costLabel}</label>
          <input type="number" class="form-control" id="inv-cost-standard-input" value="${coffee?.pricePerKg || ''}" min="0">
        </div>
      </div>
      <div id="inv-cost-packaged" style="${stage.isPackaged ? '' : 'display:none'}">
        <div class="form-group">
          <label class="toggle-group" style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" id="inv-client-packaging">
            <span>Cliente aporta el empaque (solo se cobra mano de obra del proveedor)</span>
          </label>
        </div>
        <div class="form-row">
          <div class="form-group" id="inv-material-cost-group">
            <label>Costo material empaque / ud</label>
            <input type="number" class="form-control" id="inv-packaging-material-cost" min="0" step="1">
            <p class="form-hint">Valor de bolsa, valve bag o empaque según Configuración → Costos</p>
          </div>
          <div class="form-group">
            <label>Mano de obra empacada / ud</label>
            <input type="number" class="form-control" id="inv-packaging-labor-cost" min="0" step="1">
            <p class="form-hint">Tarifa del proveedor empacador seleccionado abajo</p>
          </div>
        </div>
        <div class="cost-breakdown" id="inv-packaging-cost-preview" style="margin-bottom:12px"></div>
        <input type="hidden" id="inv-cost" value="0">
      </div>
      ${stage.isPackaged ? '' : '<input type="hidden" id="inv-cost" value="">'}
      ${packagedFields}
      <div id="inv-supplier-fields">${supplierFields(resolvedStage)}</div>
    `;

    const renderStageUI = (sk) => {
      const st = INVENTORY_PIPELINE_STAGES[sk];
      if (!st) return;
      document.getElementById('inv-stage-key').value = sk;
      document.getElementById('inv-stage-description').textContent = st.label;
      document.getElementById('inv-quantity-label').textContent = `Cantidad (${st.unit})`;
      const qtyInput = document.getElementById('inv-quantity');
      qtyInput.step = st.isPackaged ? '1' : '0.1';
      qtyInput.value = '';

      const costStandard = document.getElementById('inv-cost-standard');
      const costPackaged = document.getElementById('inv-cost-packaged');
      costStandard?.style.setProperty('display', st.isPackaged ? 'none' : '');
      costPackaged?.style.setProperty('display', st.isPackaged ? '' : 'none');

      document.querySelector('.stage-packaged-field')?.style.setProperty('display', st.isPackaged ? '' : 'none');
      document.getElementById('inv-supplier-fields').innerHTML = supplierFields(sk);
      this._pendingStageEntry = { ...this._pendingStageEntry, stageKey: sk };

      if (st.isPackaged) {
        const defaults = ProductionCosts.get().defaultSuppliers || {};
        const supplierSelect = document.getElementById('inv-supplier-empacada');
        const supplierId = supplierSelect?.value || defaults.empacada || '';
        const packaging = document.getElementById('inv-packaging')?.value || '250g';
        const breakdown = ProductionCosts.getPackagingEntryCosts(packaging, supplierId, { clientProvidesPackaging: false });
        const materialInput = document.getElementById('inv-packaging-material-cost');
        const laborInput = document.getElementById('inv-packaging-labor-cost');
        if (materialInput) materialInput.value = breakdown.materialCost;
        if (laborInput) laborInput.value = breakdown.laborCost;
        this.getPackagingCostFromForm();
      } else {
        const costLabel = document.getElementById('inv-cost-label');
        if (costLabel) costLabel.textContent = st.costLabel;
      }
    };

    document.getElementById('inv-stage-grid')?.querySelectorAll('.stage-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stage-pick-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderStageUI(btn.dataset.stage);
      });
    });

    const packagingGrid = document.getElementById('inv-packaging-grid');
    packagingGrid?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        packagingGrid.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('inv-packaging').value = btn.dataset.value;
        if (document.getElementById('inv-stage-key')?.value === 'packaged') {
          this.getPackagingCostFromForm();
        }
      });
    });

    document.getElementById('inv-coffee-id')?.addEventListener('change', (e) => {
      const selected = CoffeeManager.getById(e.target.value);
      if (!selected) return;
      const suggestedStage = getInventoryStageForCoffeeState(selected.state);
      document.querySelectorAll('.stage-pick-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.stage === suggestedStage);
      });
      renderStageUI(suggestedStage);
      if (suggestedStage !== 'packaged') {
        const costInput = document.getElementById('inv-cost-standard-input');
        if (costInput && selected.pricePerKg) costInput.value = selected.pricePerKg;
      }
    });

    if (stage.isPackaged) {
      document.querySelector('.stage-packaged-field')?.style.setProperty('display', '');
      this.bindPackagingCostEvents();
      this.getPackagingCostFromForm();
    }

    modal.classList.add('active');
  },

  showRoastForm(coffeeId) {
    this._setSaveButtonVisible(true);
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const defaults = ProductionCosts.get().defaultSuppliers || {};
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Tostión - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="roast">
      <p style="margin-bottom:16px;color:var(--text-secondary)">Stock verde disponible: <strong>${formatNumber(item.greenKg)} kg</strong></p>
      <div class="form-group">
        <label>Cantidad a Tostar (kg verde)</label>
        <input type="number" class="form-control" id="inv-kg" step="0.1" max="${item.greenKg}" required>
      </div>
      <div class="form-group">
        <label>Tostador</label>
        ${SupplierManager.renderSelect('tostion', { id: 'inv-supplier-roast', selectedId: defaults.tostion || '' })}
      </div>
      <div id="roast-preview" style="margin-top:16px"></div>
    `;

    document.getElementById('inv-kg')?.addEventListener('input', (e) => {
      const kg = parseFloat(e.target.value);
      if (kg > 0) {
        const result = ProductionCosts.calculateGreenToRoasted(kg, coffee.state, ['tostion']);
        document.getElementById('roast-preview').innerHTML = `
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Entrada</span><span>${formatNumber(kg)} kg verde</span></div>
            <div class="cost-row"><span class="cost-label">Salida estimada</span><span>${formatNumber(result.roastedKg)} kg tostado</span></div>
            <div class="cost-row"><span class="cost-label">Merma total</span><span>${formatNumber(kg - result.roastedKg)} kg</span></div>
          </div>`;
      }
    });

    modal.classList.add('active');
  },

  showProductionBatchForm(coffeeId) {
    this._setSaveButtonVisible(true);
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const defaults = ProductionCosts.get().defaultSuppliers || {};
    const activeSteps = ProductionCosts.getActiveSteps({
      productionMode: 'full_pack',
      coffee,
      grindType: 'grano'
    });
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Lote de Producción - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="production_batch">
      <p class="form-hint" style="margin-bottom:16px">
        Registre el lote indicando qué proveedor realizó cada proceso. Stock verde: <strong>${formatNumber(item.greenKg)} kg</strong>
      </p>
      <div class="form-group">
        <label>Cantidad a procesar (kg verde)</label>
        <input type="number" class="form-control" id="inv-kg" step="0.1" max="${item.greenKg}" required>
      </div>
      <h4 style="margin:16px 0 8px;font-size:0.95rem;color:var(--text-secondary)">Proveedores por proceso</h4>
      ${activeSteps.map((stepKey) => `
        <div class="form-group">
          <label>${getProcessSupplierLabel(stepKey)}</label>
          ${SupplierManager.renderSelect(stepKey, {
            id: `inv-supplier-${stepKey}`,
            selectedId: defaults[stepKey] || ''
          })}
        </div>
      `).join('')}
      <div id="roast-preview" style="margin-top:16px"></div>
    `;

    document.getElementById('inv-kg')?.addEventListener('input', (e) => {
      const kg = parseFloat(e.target.value);
      if (kg > 0) {
        const result = ProductionCosts.calculateGreenToRoasted(kg, coffee.state, activeSteps);
        document.getElementById('roast-preview').innerHTML = `
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Entrada</span><span>${formatNumber(kg)} kg verde</span></div>
            <div class="cost-row"><span class="cost-label">Salida estimada</span><span>${formatNumber(result.roastedKg)} kg tostado</span></div>
            <div class="cost-row"><span class="cost-label">Merma total</span><span>${formatNumber(kg - result.roastedKg)} kg</span></div>
          </div>`;
      }
    });

    modal.classList.add('active');
  },

  showAdjustForm(coffeeId) {
    this._setSaveButtonVisible(true);
    const coffee = CoffeeManager.getById(coffeeId);
    const item = this.getByCoffeeId(coffeeId);
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-modal-title').textContent = `Ajustar Stock - ${coffee.name}`;

    document.getElementById('inventory-form').innerHTML = `
      <input type="hidden" id="inv-coffee-id" value="${coffeeId}">
      <input type="hidden" id="inv-action" value="adjust">
      <p class="form-hint" style="margin-bottom:16px">Los ajustes quedan registrados con su usuario.</p>
      <div class="form-group">
        <label>Tipo de stock</label>
        <div class="selection-grid" id="inv-adjust-field">
          <button type="button" class="selection-btn active" data-value="greenKg">🌱 Verde (${formatNumber(item.greenKg)} kg)</button>
          <button type="button" class="selection-btn" data-value="roastedKg">🔥 Tostado (${formatNumber(item.roastedKg)} kg)</button>
          <button type="button" class="selection-btn" data-value="selectedKg">✨ Seleccionado (${formatNumber(item.selectedKg)} kg)</button>
          <button type="button" class="selection-btn" data-value="groundKg">⚙️ Molido (${formatNumber(item.groundKg)} kg)</button>
        </div>
        <input type="hidden" id="inv-field" value="greenKg">
      </div>
      <div class="form-group">
        <label>Nueva cantidad (kg)</label>
        <input type="number" class="form-control" id="inv-new-value" step="0.1" min="0" required>
      </div>
      <div class="form-group">
        <label>Motivo del ajuste</label>
        <textarea class="form-control" id="inv-reason" rows="2" placeholder="Ej: Corrección por conteo físico, merma no registrada..."></textarea>
      </div>
    `;

    const fieldContainer = document.getElementById('inv-adjust-field');
    const fieldHidden = document.getElementById('inv-field');
    const fieldValues = {
      greenKg: item.greenKg,
      roastedKg: item.roastedKg,
      selectedKg: item.selectedKg,
      groundKg: item.groundKg
    };
    fieldContainer?.querySelectorAll('.selection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        fieldContainer.querySelectorAll('.selection-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        fieldHidden.value = btn.dataset.value;
        const current = fieldValues[btn.dataset.value] ?? 0;
        document.getElementById('inv-new-value').placeholder = `Actual: ${formatNumber(current)} kg`;
      });
    });
    document.getElementById('inv-new-value').placeholder = `Actual: ${formatNumber(item.greenKg)} kg`;

    modal.classList.add('active');
  },

  saveFromForm() {
    const action = document.getElementById('inv-action').value;
    const coffeeIdEl = document.getElementById('inv-coffee-id');
    const coffeeId = coffeeIdEl?.value;

    if (action === 'stage_entry') {
      if (!coffeeId) {
        Toast.show('Seleccione un café', 'danger');
        return;
      }
      const stageKey = document.getElementById('inv-stage-key')?.value;
      const stage = INVENTORY_PIPELINE_STAGES[stageKey];
      if (!stage) {
        Toast.show('Etapa no válida', 'danger');
        return;
      }
      const quantity = document.getElementById('inv-quantity')?.value;
      const suppliers = {};
      stage.supplierServices.forEach((serviceKey) => {
        const el = document.getElementById(`inv-supplier-${serviceKey}`);
        if (el?.value) suppliers[serviceKey] = el.value;
      });
      const payload = { quantity, suppliers };

      if (stage.isPackaged) {
        const packagedCosts = this.getPackagingCostFromForm();
        payload.packaging = packagedCosts.packaging;
        payload.cost = packagedCosts.totalPerUnit;
        payload.packagingMaterialCost = packagedCosts.materialCost;
        payload.packagingLaborCost = packagedCosts.laborCost;
        payload.clientProvidesPackaging = packagedCosts.clientProvidesPackaging;
        if (!suppliers.empacada && packagedCosts.supplierId) {
          suppliers.empacada = packagedCosts.supplierId;
        }
        payload.suppliers = suppliers;
        if (!suppliers.empacada) {
          Toast.show('Seleccione el proveedor de empaque', 'danger');
          return;
        }
      } else {
        payload.cost = parseFloat(document.getElementById('inv-cost-standard-input')?.value) || 0;
      }

      const ok = this.addStageEntry(coffeeId, stageKey, payload);
      if (!ok) return;
    } else if (action === 'purchase') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      const cost = parseFloat(document.getElementById('inv-cost').value);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      this.addPurchase(coffeeId, kg, cost, {
        compra: document.getElementById('inv-supplier-coffee')?.value || null,
        transporte: document.getElementById('inv-supplier-transport')?.value || null
      });
    } else if (action === 'roast') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      const supplierId = document.getElementById('inv-supplier-roast')?.value || null;
      this.processRoasting(coffeeId, kg, supplierId);
    } else if (action === 'production_batch') {
      const kg = parseFloat(document.getElementById('inv-kg').value);
      if (!kg || kg <= 0) {
        Toast.show('Ingrese una cantidad válida', 'danger');
        return;
      }
      const coffee = CoffeeManager.getById(coffeeId);
      const activeSteps = ProductionCosts.getActiveSteps({
        productionMode: 'full_pack',
        coffee,
        grindType: 'grano'
      });
      const processSuppliers = {};
      activeSteps.forEach((stepKey) => {
        const el = document.getElementById(`inv-supplier-${stepKey}`);
        if (el?.value) processSuppliers[stepKey] = el.value;
      });
      this.registerProductionBatch(coffeeId, kg, processSuppliers);
    } else if (action === 'adjust') {
      const field = document.getElementById('inv-field').value;
      const newValue = document.getElementById('inv-new-value').value;
      const reason = document.getElementById('inv-reason').value.trim();
      if (!newValue) {
        Toast.show('Ingrese la nueva cantidad', 'danger');
        return;
      }
      if (!reason) {
        Toast.show('Indique el motivo del ajuste', 'danger');
        return;
      }
      this.adjustStock(coffeeId, field, newValue, reason);
    }

    Toast.show('Inventario actualizado', 'success');
    document.getElementById('inventory-modal').classList.remove('active');
    App.renderSection('inventory');
  }
};
