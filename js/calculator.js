/**
 * Costos de producción, mermas y cotizaciones
 */
(function () {
  const BCA = window.BCA;

  /**
   * Factores de merma según forma de compra.
   * Verde: tostión + selección
   * Pergamino: trilla + tostión + selección
   * Tostado: solo selección (si aplica)
   */
  function yieldFactor(form, merma) {
    const t = (100 - (merma.trilla || 0)) / 100;
    const r = (100 - (merma.tostion || 0)) / 100;
    const s = (100 - (merma.seleccion || 0)) / 100;
    switch (form) {
      case "pergamino":
        return t * r * s;
      case "verde":
        return r * s;
      case "tostado":
        return s;
      default: {
        const _exhaustive = form;
        void _exhaustive;
        return r * s;
      }
    }
  }

  function inputNeededForOutputKg(outputKg, form, merma) {
    const y = yieldFactor(form, merma);
    if (y <= 0) return Infinity;
    return outputKg / y;
  }

  function packagesPerKg(packageId) {
    const pack = BCA.PACKAGES.find((p) => p.id === packageId);
    if (!pack) return 1;
    return 1000 / pack.grams;
  }

  function labelCostForPackage(packageId, costs) {
    // 250g / 500g → etiqueta pequeña; 5lb → grande
    if (packageId === "5lb") return costs.labelLarge;
    return costs.labelSmall;
  }

  /**
   * Calcula desglose de costo y precio de venta.
   */
  function calculateQuote({
    coffee,
    costs,
    packageId,
    marginPercent,
    quantityKg,
    clientType,
    overrideTransportIncluded,
    overrideTransportPerKg,
  }) {
    const qty = Math.max(0, Number(quantityKg) || 0);
    const form = coffee.form || "verde";
    const y = yieldFactor(form, costs.merma);
    const inputKg = inputNeededForOutputKg(qty, form, costs.merma);

    const transportIncluded =
      overrideTransportIncluded !== undefined
        ? overrideTransportIncluded
        : !!coffee.transportIncluded;
    const transportPerKg = transportIncluded
      ? 0
      : Number(
          overrideTransportPerKg !== undefined
            ? overrideTransportPerKg
            : coffee.transportPerKg || 0
        );

    const coffeeRaw = inputKg * Number(coffee.pricePerKg || 0);
    const transportRaw = inputKg * transportPerKg;
    const roasting = qty * Number(costs.roastingPerKg || 0);
    const selection = qty * Number(costs.selectionPerKg || 0);

    const packs = packagesPerKg(packageId) * qty;
    const packUnit = Number(costs.packaging[packageId] ?? BCA.DEFAULT_COSTS.packaging[packageId] ?? 0);
    const packaging = packs * packUnit;
    const labels = packs * labelCostForPackage(packageId, costs);
    const alza = costs.alzaActive ? qty * Number(costs.alza || 0) : 0;

    const productionTotal =
      coffeeRaw + transportRaw + roasting + selection + packaging + labels + alza;

    // Ajuste suave mayorista: sugiere margen, no cambia fórmula base
    let margin = Number(marginPercent) || 35;
    if (clientType === "mayorista" && margin > 40) {
      /* permitido, solo informativo */
    }

    const sellingTotal = productionTotal * (1 + margin / 100);
    const costPerKg = qty ? productionTotal / qty : 0;
    const pricePerKg = qty ? sellingTotal / qty : 0;
    const pack = BCA.PACKAGES.find((p) => p.id === packageId);
    const units = packs;
    const pricePerUnit = units ? sellingTotal / units : 0;

    return {
      form,
      yieldFactor: y,
      yieldPercent: y * 100,
      inputKg,
      quantityKg: qty,
      packageId,
      units,
      packageLabel: pack?.label || packageId,
      marginPercent: margin,
      clientType,
      transportIncluded,
      transportPerKg,
      lines: {
        cafe: coffeeRaw,
        transporte: transportRaw,
        tostion: roasting,
        seleccion: selection,
        empaque: packaging,
        etiquetas: labels,
        alza,
      },
      productionTotal,
      sellingTotal,
      costPerKg,
      pricePerKg,
      pricePerUnit,
      profit: sellingTotal - productionTotal,
    };
  }

  function processPurchaseToInventory(purchase, coffee, costs) {
    // Entrada de inventario según forma
    const kg = Number(purchase.kg) || 0;
    if (coffee.form === "tostado") {
      return {
        kgAvailableGreen: 0,
        kgAvailableRoasted: kg * ((100 - costs.merma.seleccion) / 100),
      };
    }
    return {
      kgAvailableGreen: kg,
      kgAvailableRoasted: 0,
    };
  }

  /**
   * Simula conversión a tostado aplicando mermas del flujo.
   */
  function roastFromGreen(kgGreen, form, costs) {
    const m = costs.merma;
    let kg = kgGreen;
    if (form === "pergamino") {
      kg = kg * ((100 - m.trilla) / 100);
    }
    if (form === "pergamino" || form === "verde") {
      kg = kg * ((100 - m.tostion) / 100);
      kg = kg * ((100 - m.seleccion) / 100);
    }
    return kg;
  }

  BCA.calc = {
    yieldFactor,
    inputNeededForOutputKg,
    packagesPerKg,
    labelCostForPackage,
    calculateQuote,
    processPurchaseToInventory,
    roastFromGreen,
  };
})();
