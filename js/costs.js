const ProductionCosts = {
  get() {
    return migrateProductionCosts(Storage.get(STORAGE_KEYS.PRODUCTION_COSTS));
  },

  save(costs) {
    costs.lastUpdated = new Date().toISOString();
    Storage.set(STORAGE_KEYS.PRODUCTION_COSTS, costs);
    Notifications.add('Costos de producción actualizados', 'info');
    EmailService.sendNotification(
      'Costos de Producción Actualizados',
      'Se han modificado los costos de producción en la plataforma BCA.'
    );
  },

  shouldShowModal() {
    const today = new Date().toDateString();
    const lastChecked = Storage.get(STORAGE_KEYS.COSTS_CHECKED);
    return lastChecked !== today;
  },

  markChecked() {
    Storage.set(STORAGE_KEYS.COSTS_CHECKED, new Date().toDateString());
  },

  getActiveSteps(options) {
    const { productionMode, coffee, maquilaSteps = [], grindType = 'grano' } = options;
    let steps = productionMode === 'full_pack'
      ? getFullPackSteps(coffee.state)
      : [...maquilaSteps];

    if (grindType === 'molido' && !steps.includes('molienda')) {
      steps.push('molienda');
    }
    if (grindType === 'grano') {
      steps = steps.filter((s) => s !== 'molienda');
    }

    return [...new Set(steps)];
  },

  calculateGreenToRoasted(greenKg, coffeeState = 'verde', activeSteps = []) {
    const costs = this.get();
    let remaining = greenKg;
    const details = [];

    if (activeSteps.includes('trilla') && coffeeState === 'pergamino') {
      const loss = remaining * (costs.mermas.trilla / 100);
      details.push({ name: 'Trilla', percent: costs.mermas.trilla, lossKg: loss });
      remaining -= loss;
    }

    if (activeSteps.includes('greenSelection')) {
      const loss = remaining * ((costs.mermas.greenSelection || 0) / 100);
      if (loss > 0) {
        details.push({ name: 'Selección en Verde', percent: costs.mermas.greenSelection, lossKg: loss });
        remaining -= loss;
      }
    }

    if (activeSteps.includes('tostion')) {
      const loss = remaining * (costs.mermas.tostion / 100);
      details.push({ name: 'Tostión', percent: costs.mermas.tostion, lossKg: loss });
      remaining -= loss;
    }

    if (activeSteps.includes('seleccion')) {
      const loss = remaining * (costs.mermas.seleccion / 100);
      details.push({ name: 'Selección', percent: costs.mermas.seleccion, lossKg: loss });
      remaining -= loss;
    }

    return {
      roastedKg: remaining,
      mermaDetails: {
        details,
        inputKg: greenKg,
        outputKg: remaining,
        totalLossKg: greenKg - remaining,
        totalLossPercent: greenKg > 0 ? ((greenKg - remaining) / greenKg * 100).toFixed(1) : '0'
      }
    };
  },

  getMermaDetails(inputKg, coffeeState) {
    const activeSteps = getFullPackSteps(coffeeState);
    return this.calculateGreenToRoasted(inputKg, coffeeState, activeSteps).mermaDetails;
  },

  getTransformationCost(stepKey, amount, packagingSize, costs) {
    const step = TRANSFORMATION_STEPS[stepKey];
    if (!step) return 0;

    if (stepKey === 'empacada') {
      const labor = costs.transformation.packagingLabor[packagingSize];
      return labor || 0;
    }

    if (stepKey === 'molienda') {
      const pkg = PACKAGING_SIZES[packagingSize];
      const pounds = pkg.grams / 453.592;
      return pounds * costs.transformation.grinding;
    }

    const rate = costs.transformation[step.costKey] || 0;
    return rate * amount;
  },

  calculateUnitCost(coffee, packagingSize, labelSizes = ['small'], options = {}) {
    const costs = this.get();
    const {
      productionMode = 'full_pack',
      maquilaSteps = [],
      clientProvidesCoffee = false,
      grindType = 'grano'
    } = options;

    const activeSteps = this.getActiveSteps({
      productionMode,
      coffee,
      maquilaSteps,
      grindType
    });

    const pkg = PACKAGING_SIZES[packagingSize];
    const roastedKgNeeded = pkg.grams / 1000;

    let greenKgNeeded = roastedKgNeeded;
    if (activeSteps.some((s) => ['tostion', 'seleccion', 'trilla', 'greenSelection'].includes(s))) {
      const { roastedKg } = this.calculateGreenToRoasted(1, coffee.state, activeSteps);
      greenKgNeeded = roastedKg > 0 ? roastedKgNeeded / roastedKg : roastedKgNeeded;
    }

    const breakdown = {
      administrative: [],
      transformation: [],
      materials: [],
      labels: parseLabelSelection(labelSizes)
    };

    let totalCost = 0;

    if (productionMode === 'full_pack' || !clientProvidesCoffee) {
      const transportCost = coffee.transportIncluded ? 0 : (coffee.transportCost || 0);
      const coffeeCost = coffee.pricePerKg * greenKgNeeded;
      const transportTotal = transportCost * greenKgNeeded;

      if (productionMode === 'full_pack') {
        if (costs.administrative.negotiation > 0) {
          breakdown.administrative.push({
            key: 'negociacion',
            label: 'Negociación',
            cost: costs.administrative.negotiation
          });
          totalCost += costs.administrative.negotiation;
        }

        breakdown.administrative.push({
          key: 'compra',
          label: 'Compra de Café',
          cost: coffeeCost,
          detail: `${formatNumber(greenKgNeeded, 3)} kg × ${formatCurrency(coffee.pricePerKg)}`
        });
        totalCost += coffeeCost;

        if (transportTotal > 0) {
          breakdown.administrative.push({
            key: 'transporte',
            label: 'Transporte',
            cost: transportTotal,
            detail: `${formatNumber(greenKgNeeded, 3)} kg`
          });
          totalCost += transportTotal;
        }
      } else if (!clientProvidesCoffee) {
        breakdown.administrative.push({
          key: 'compra',
          label: 'Compra de Café (Maquila)',
          cost: coffeeCost,
          detail: `${formatNumber(greenKgNeeded, 3)} kg`
        });
        totalCost += coffeeCost;
      }
    } else {
      breakdown.administrative.push({
        key: 'cafe_cliente',
        label: 'Café aportado por el cliente',
        cost: 0
      });
    }

    const kgSteps = ['trilla', 'greenSelection', 'tostion', 'seleccion'];
    kgSteps.forEach((stepKey) => {
      if (!activeSteps.includes(stepKey)) return;
      if (stepKey === 'trilla' && coffee.state !== 'pergamino') return;

      const stepCost = this.getTransformationCost(stepKey, greenKgNeeded, packagingSize, costs);
      breakdown.transformation.push({
        key: stepKey,
        label: TRANSFORMATION_STEPS[stepKey].label,
        cost: stepCost,
        detail: `${formatNumber(greenKgNeeded, 3)} kg`
      });
      totalCost += stepCost;
    });

    if (activeSteps.includes('molienda')) {
      const stepCost = this.getTransformationCost('molienda', 0, packagingSize, costs);
      const pounds = pkg.grams / 453.592;
      breakdown.transformation.push({
        key: 'molienda',
        label: 'Molienda',
        cost: stepCost,
        detail: `${formatNumber(pounds, 2)} lb × ${formatCurrency(costs.transformation.grinding)}`
      });
      totalCost += stepCost;
    }

    if (activeSteps.includes('empacada')) {
      const stepCost = this.getTransformationCost('empacada', 0, packagingSize, costs);
      breakdown.transformation.push({
        key: 'empacada',
        label: 'Empacada (mano de obra)',
        cost: stepCost,
        detail: PACKAGING_SIZES[packagingSize].label
      });
      totalCost += stepCost;
    }

    if (productionMode === 'full_pack') {
      const packagingCost = costs.packaging[packagingSize] || 0;
      breakdown.materials.push({
        key: 'empaque',
        label: 'Material de Empaque',
        cost: packagingCost
      });
      totalCost += packagingCost;

      const labelDetails = breakdown.labels.map((size) => ({
        size,
        name: LABEL_NAMES[size] || size,
        cost: costs.labels[size] || 0
      }));
      const labelCost = labelDetails.reduce((sum, item) => sum + item.cost, 0);
      labelDetails.forEach((item) => {
        breakdown.materials.push({
          key: `label_${item.size}`,
          label: `Etiqueta ${item.name}`,
          cost: item.cost
        });
      });
      breakdown.labelDetails = labelDetails;
      breakdown.labelCost = labelCost;
      totalCost += labelCost;
    }

    const increaseCost = costs.costIncrease.enabled ? costs.costIncrease.amount : 0;
    if (increaseCost > 0) {
      breakdown.materials.push({ key: 'alza', label: 'Costo de Alza', cost: increaseCost });
      totalCost += increaseCost;
    }

    const { mermaDetails } = this.calculateGreenToRoasted(greenKgNeeded, coffee.state, activeSteps);

    return {
      productionMode,
      activeSteps,
      grindType,
      clientProvidesCoffee,
      greenKgNeeded,
      roastedKgNeeded,
      mermaDetails,
      breakdown,
      labelDetails: breakdown.labelDetails || [],
      labelCost: breakdown.labelCost || 0,
      packagingCost: productionMode === 'full_pack' ? (costs.packaging[packagingSize] || 0) : 0,
      packagingLaborCost: activeSteps.includes('empacada')
        ? this.getTransformationCost('empacada', 0, packagingSize, costs)
        : 0,
      increaseCost,
      totalCost,
      coffeeCost: breakdown.administrative.find((a) => a.key === 'compra')?.cost || 0,
      processCost: breakdown.transformation.reduce((sum, item) => sum + item.cost, 0)
    };
  },

  calculateSellingPrice(coffee, packagingSize, profitMargin, clientType, labelSizes = ['small'], options = {}) {
    const unitCost = this.calculateUnitCost(coffee, packagingSize, labelSizes, options);
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
    const t = costs.transformation;
    const a = costs.administrative;
    const m = costs.mermas;

    container.innerHTML = `
      <h4 style="margin: 0 0 12px; color: var(--text-secondary);">Transformación del Café</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Trilla (por kg)</label>
          <input type="number" class="form-control" id="cost-trilla" value="${t.trilla}">
        </div>
        <div class="form-group">
          <label>Selección en Verde (por kg)</label>
          <input type="number" class="form-control" id="cost-green-selection" value="${t.greenSelection}">
        </div>
        <div class="form-group">
          <label>Tostión (por kg)</label>
          <input type="number" class="form-control" id="cost-roasting" value="${t.roasting}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Selección Post-Tostión (por kg)</label>
          <input type="number" class="form-control" id="cost-selection" value="${t.selection}">
        </div>
        <div class="form-group">
          <label>Molienda (por libra)</label>
          <input type="number" class="form-control" id="cost-grinding" value="${t.grinding}">
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Empacada — Mano de Obra</h4>
      <div class="form-row">
        <div class="form-group">
          <label>250g</label>
          <input type="number" class="form-control" id="cost-labor-250" value="${t.packagingLabor['250g']}">
        </div>
        <div class="form-group">
          <label>500g</label>
          <input type="number" class="form-control" id="cost-labor-500" value="${t.packagingLabor['500g']}">
        </div>
        <div class="form-group">
          <label>5 libras</label>
          <input type="number" class="form-control" id="cost-labor-5lb" value="${t.packagingLabor['5lb']}">
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Administrativa (Full Pack)</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Negociación (tarifa fija)</label>
          <input type="number" class="form-control" id="cost-negotiation" value="${a.negotiation}">
        </div>
      </div>
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Materiales de Empaque (Full Pack)</h4>
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
      <h4 style="margin: 20px 0 12px; color: var(--text-secondary);">Etiquetas (Full Pack)</h4>
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
          <label>Trilla</label>
          <input type="number" class="form-control" id="merma-trilla" value="${m.trilla}" step="0.1">
        </div>
        <div class="form-group">
          <label>Selección en Verde</label>
          <input type="number" class="form-control" id="merma-green-selection" value="${m.greenSelection || 0}" step="0.1">
        </div>
        <div class="form-group">
          <label>Tostión</label>
          <input type="number" class="form-control" id="merma-tostion" value="${m.tostion}" step="0.1">
        </div>
        <div class="form-group">
          <label>Selección</label>
          <input type="number" class="form-control" id="merma-seleccion" value="${m.seleccion}" step="0.1">
        </div>
      </div>
    `;

    document.getElementById('cost-increase-enabled')?.addEventListener('change', (e) => {
      document.getElementById('cost-increase-status').textContent = e.target.checked ? 'Activado' : 'Desactivado';
    });
  },

  saveFromForm() {
    const costs = {
      transformation: {
        trilla: parseFloat(document.getElementById('cost-trilla').value),
        greenSelection: parseFloat(document.getElementById('cost-green-selection').value),
        roasting: parseFloat(document.getElementById('cost-roasting').value),
        selection: parseFloat(document.getElementById('cost-selection').value),
        grinding: parseFloat(document.getElementById('cost-grinding').value),
        packagingLabor: {
          '250g': parseFloat(document.getElementById('cost-labor-250').value),
          '500g': parseFloat(document.getElementById('cost-labor-500').value),
          '5lb': parseFloat(document.getElementById('cost-labor-5lb').value)
        }
      },
      administrative: {
        negotiation: parseFloat(document.getElementById('cost-negotiation').value)
      },
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
        greenSelection: parseFloat(document.getElementById('merma-green-selection').value),
        tostion: parseFloat(document.getElementById('merma-tostion').value),
        seleccion: parseFloat(document.getElementById('merma-seleccion').value)
      }
    };
    this.save(costs);
    return costs;
  }
};
