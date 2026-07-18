const ProductionCosts = {
  get() {
    return Storage.get(STORAGE_KEYS.PRODUCTION_COSTS) || DEFAULT_PRODUCTION_COSTS;
  },

  save(costs) {
    costs.lastUpdated = new Date().toISOString();
    Storage.set(STORAGE_KEYS.PRODUCTION_COSTS, costs);
    Notifications.add('Costos de producción actualizados', 'info');
    EmailService.sendNotification('Costos de Producción Actualizados', 
      'Se han modificado los costos de producción en la plataforma BCA.');
  },

  shouldShowModal() {
    const today = new Date().toDateString();
    const lastChecked = Storage.get(STORAGE_KEYS.COSTS_CHECKED);
    return lastChecked !== today;
  },

  markChecked() {
    Storage.set(STORAGE_KEYS.COSTS_CHECKED, new Date().toDateString());
  },

  calculateGreenToRoasted(greenKg, coffeeState = 'verde') {
    const costs = this.get();
    let remaining = greenKg;

    if (coffeeState === 'pergamino') {
      remaining = remaining * (1 - costs.mermas.trilla / 100);
    }

    remaining = remaining * (1 - costs.mermas.tostion / 100);
    remaining = remaining * (1 - costs.mermas.seleccion / 100);

    return {
      roastedKg: remaining,
      mermaDetails: this.getMermaDetails(greenKg, coffeeState)
    };
  },

  getMermaDetails(inputKg, coffeeState) {
    const costs = this.get();
    const details = [];
    let current = inputKg;

    if (coffeeState === 'pergamino') {
      const loss = current * (costs.mermas.trilla / 100);
      details.push({ name: 'Trilla', percent: costs.mermas.trilla, lossKg: loss });
      current -= loss;
    }

    const roastLoss = current * (costs.mermas.tostion / 100);
    details.push({ name: 'Tostión', percent: costs.mermas.tostion, lossKg: roastLoss });
    current -= roastLoss;

    const selectLoss = current * (costs.mermas.seleccion / 100);
    details.push({ name: 'Selección', percent: costs.mermas.seleccion, lossKg: selectLoss });
    current -= selectLoss;

    return {
      details,
      inputKg,
      outputKg: current,
      totalLossKg: inputKg - current,
      totalLossPercent: ((inputKg - current) / inputKg * 100).toFixed(1)
    };
  },

  calculateUnitCost(coffee, packagingSize, labelSizes = ['small']) {
    const costs = this.get();
    const { roastedKg } = this.calculateGreenToRoasted(1, coffee.state);
    const labels = parseLabelSelection(labelSizes);
    
    const greenCostPerKg = coffee.pricePerKg + (coffee.transportIncluded ? 0 : (coffee.transportCost || 0));
    const greenCostForRoastedKg = greenCostPerKg / roastedKg;

    const roastingCost = costs.roasting;
    const selectionCost = costs.selection;
    const packagingCost = costs.packaging[packagingSize] || 0;
    const labelDetails = labels.map((size) => ({
      size,
      name: LABEL_NAMES[size] || size,
      cost: costs.labels[size] || 0
    }));
    const labelCost = labelDetails.reduce((sum, item) => sum + item.cost, 0);
    const increaseCost = costs.costIncrease.enabled ? costs.costIncrease.amount : 0;

    const pkg = PACKAGING_SIZES[packagingSize];
    const roastedGrams = pkg.grams;
    const roastedKgNeeded = roastedGrams / 1000;

    const coffeeCost = greenCostForRoastedKg * roastedKgNeeded;
    const processCost = (roastingCost + selectionCost) * roastedKgNeeded;
    const totalCost = coffeeCost + processCost + packagingCost + labelCost + increaseCost;

    return {
      coffeeCost,
      processCost,
      roastingCost: roastingCost * roastedKgNeeded,
      selectionCost: selectionCost * roastedKgNeeded,
      packagingCost,
      labelCost,
      labelDetails,
      labels,
      increaseCost,
      totalCost,
      roastedKgNeeded,
      greenKgNeeded: roastedKgNeeded / roastedKg
    };
  },

  calculateSellingPrice(coffee, packagingSize, profitMargin, clientType, labelSizes = ['small']) {
    const unitCost = this.calculateUnitCost(coffee, packagingSize, labelSizes);
    const clientMultiplier = CLIENT_TYPES[clientType]?.multiplier || 1;
    const basePrice = unitCost.totalCost * (1 + profitMargin / 100);
    const finalPrice = basePrice / clientMultiplier;

    return {
      ...unitCost,
      profitMargin,
      clientType,
      clientMultiplier,
      basePrice,
      finalPrice: Math.ceil(finalPrice / 100) * 100
    };
  },

  renderCostForm(container) {
    const costs = this.get();
    container.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Costo de Tostión (por kg)</label>
          <input type="number" class="form-control" id="cost-roasting" value="${costs.roasting}">
        </div>
        <div class="form-group">
          <label>Costo de Selección (por kg)</label>
          <input type="number" class="form-control" id="cost-selection" value="${costs.selection}">
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Empaque</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Bolsa 250g</label>
          <input type="number" class="form-control" id="cost-pkg-250" value="${costs.packaging['250g']}">
        </div>
        <div class="form-group">
          <label>Bolsa 500g</label>
          <input type="number" class="form-control" id="cost-pkg-500" value="${costs.packaging['500g']}">
        </div>
        <div class="form-group">
          <label>Bolsa 5 libras</label>
          <input type="number" class="form-control" id="cost-pkg-5lb" value="${costs.packaging['5lb']}">
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Etiquetas</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Etiqueta Grande</label>
          <input type="number" class="form-control" id="cost-label-large" value="${costs.labels.large}">
        </div>
        <div class="form-group">
          <label>Etiqueta Pequeña</label>
          <input type="number" class="form-control" id="cost-label-small" value="${costs.labels.small}">
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Costo de Alza</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Monto de Alza</label>
          <input type="number" class="form-control" id="cost-increase-amount" value="${costs.costIncrease.amount}">
        </div>
        <div class="form-group">
          <label>Activar Costo de Alza</label>
          <div class="toggle-group" style="margin-top: 8px;">
            <label class="toggle">
              <input type="checkbox" id="cost-increase-enabled" ${costs.costIncrease.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span id="cost-increase-status">${costs.costIncrease.enabled ? 'Activado' : 'Desactivado'}</span>
          </div>
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Mermas (%)</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Trilla (Pergamino)</label>
          <input type="number" class="form-control" id="merma-trilla" value="${costs.mermas.trilla}" step="0.1">
        </div>
        <div class="form-group">
          <label>Tostión</label>
          <input type="number" class="form-control" id="merma-tostion" value="${costs.mermas.tostion}" step="0.1">
        </div>
        <div class="form-group">
          <label>Selección</label>
          <input type="number" class="form-control" id="merma-seleccion" value="${costs.mermas.seleccion}" step="0.1">
        </div>
      </div>
    `;

    document.getElementById('cost-increase-enabled')?.addEventListener('change', (e) => {
      document.getElementById('cost-increase-status').textContent = e.target.checked ? 'Activado' : 'Desactivado';
    });
  },

  saveFromForm() {
    const costs = {
      roasting: parseFloat(document.getElementById('cost-roasting').value),
      selection: parseFloat(document.getElementById('cost-selection').value),
      packaging: {
        '250g': parseFloat(document.getElementById('cost-pkg-250').value),
        '500g': parseFloat(document.getElementById('cost-pkg-500').value),
        '5lb': parseFloat(document.getElementById('cost-pkg-5lb').value)
      },
      labels: {
        large: parseFloat(document.getElementById('cost-label-large').value),
        small: parseFloat(document.getElementById('cost-label-small').value)
      },
      costIncrease: {
        enabled: document.getElementById('cost-increase-enabled').checked,
        amount: parseFloat(document.getElementById('cost-increase-amount').value)
      },
      mermas: {
        trilla: parseFloat(document.getElementById('merma-trilla').value),
        tostion: parseFloat(document.getElementById('merma-tostion').value),
        seleccion: parseFloat(document.getElementById('merma-seleccion').value)
      }
    };
    this.save(costs);
    return costs;
  }
};
