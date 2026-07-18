/**
 * Motor de costos, mermas y cotizaciones
 */
(function () {
  function clampPct(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.min(99.9, Math.max(0, v));
  }

  function yieldFactor(form, mermas) {
    const t = clampPct(mermas.trilla) / 100;
    const r = clampPct(mermas.tostion) / 100;
    const s = clampPct(mermas.seleccion) / 100;

    if (form === "pergamino") {
      return (1 - t) * (1 - r) * (1 - s);
    }
    if (form === "verde") {
      return (1 - r) * (1 - s);
    }
    // tostado: solo selección residual opcional
    return 1 - s;
  }

  function bagsPerKg(format) {
    return 1000 / format.grams;
  }

  /**
   * Costo de producción por kg de café listo (tostado + seleccionado + empacado)
   */
  function computeUnitCost({
    coffee,
    costs,
    mermas,
    packFormatId,
    includeAlza,
  }) {
    const format =
      BCA.PACK_FORMATS.find((f) => f.id === packFormatId) || BCA.PACK_FORMATS[0];
    const y = yieldFactor(coffee.form, mermas);
    const safeY = y <= 0 ? 0.0001 : y;

    const greenOrInputPrice = Number(coffee.pricePerKg) || 0;
    const transport =
      coffee.transportIncluded || !coffee.transportCostPerKg
        ? 0
        : Number(coffee.transportCostPerKg) || 0;

    const inputCostPerFinalKg = (greenOrInputPrice + transport) / safeY;

    const tostion = Number(costs.tostionPerKg) || 0;
    const seleccion = Number(costs.seleccionPerKg) || 0;
    const empaqueUnit = Number(costs.empaque[format.empaqueKey]) || 0;
    const etiquetaUnit = Number(costs.etiquetas[format.etiqueta]) || 0;
    const packs = bagsPerKg(format);
    const packagingPerKg = (empaqueUnit + etiquetaUnit) * packs;
    const alzaActive =
      includeAlza == null ? costs.alza.enabled : Boolean(includeAlza);
    const alza = alzaActive ? Number(costs.alza.value) || 0 : 0;

    const production =
      (coffee.form === "tostado" ? 0 : tostion) + seleccion + packagingPerKg + alza;

    const totalCostPerKg = inputCostPerFinalKg + production;

    return {
      format,
      yieldFactor: safeY,
      yieldPercent: Math.round(safeY * 10000) / 100,
      inputCostPerFinalKg,
      greenOrInputPrice,
      transport,
      tostion: coffee.form === "tostado" ? 0 : tostion,
      seleccion,
      packagingPerKg,
      empaqueUnit,
      etiquetaUnit,
      packsPerKg: packs,
      alza,
      alzaActive,
      productionPerKg: production,
      totalCostPerKg,
      mermasApplied:
        coffee.form === "pergamino"
          ? ["trilla", "tostion", "seleccion"]
          : coffee.form === "verde"
            ? ["tostion", "seleccion"]
            : ["seleccion"],
    };
  }

  function applyMargin(costPerKg, marginPct) {
    const m = Number(marginPct) || 0;
    const price = costPerKg / (1 - m / 100);
    return {
      marginPct: m,
      salePricePerKg: price,
      profitPerKg: price - costPerKg,
    };
  }

  function quoteLine({
    coffee,
    costs,
    mermas,
    packFormatId,
    marginPct,
    kg,
    includeAlza,
  }) {
    const unit = computeUnitCost({
      coffee,
      costs,
      mermas,
      packFormatId,
      includeAlza,
    });
    const priced = applyMargin(unit.totalCostPerKg, marginPct);
    const quantityKg = Number(kg) || 0;
    const bags = Math.ceil(quantityKg * unit.packsPerKg);
    const subtotal = priced.salePricePerKg * quantityKg;

    return {
      ...unit,
      ...priced,
      quantityKg,
      bags,
      subtotal,
      coffeeId: coffee.id,
      coffeeName: coffee.name,
    };
  }

  /** Kg de entrada necesarios para obtener kg finales deseados */
  function inputKgForOutput(form, mermas, outputKg) {
    const y = yieldFactor(form, mermas);
    return outputKg / (y <= 0 ? 0.0001 : y);
  }

  /** Proyecta inventario tras mermas desde un lote de entrada */
  function projectAfterMermas(form, mermas, inputKg) {
    const steps = [];
    let current = Number(inputKg) || 0;

    if (form === "pergamino") {
      const loss = current * (clampPct(mermas.trilla) / 100);
      current -= loss;
      steps.push({ stage: "trilla", lossKg: loss, remainingKg: current });
    }

    if (form === "pergamino" || form === "verde") {
      const loss = current * (clampPct(mermas.tostion) / 100);
      current -= loss;
      steps.push({ stage: "tostion", lossKg: loss, remainingKg: current });
    }

    {
      const loss = current * (clampPct(mermas.seleccion) / 100);
      current -= loss;
      steps.push({ stage: "seleccion", lossKg: loss, remainingKg: current });
    }

    return { finalKg: current, steps };
  }

  function formatCOP(value) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.round(value || 0));
  }

  function formatKg(value) {
    return `${(Number(value) || 0).toFixed(2)} kg`;
  }

  window.BCACalc = {
    yieldFactor,
    computeUnitCost,
    applyMargin,
    quoteLine,
    inputKgForOutput,
    projectAfterMermas,
    formatCOP,
    formatKg,
    bagsPerKg,
  };
})();
