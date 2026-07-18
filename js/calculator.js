/* Costos de producción, mermas y cotización */
window.BC = window.BC || {};

BC.Calc = {
  /**
   * Convierte kilos de entrada (según estado de compra) a kilos tostados disponibles
   * tras aplicar mermas de trilla / tostión / selección.
   */
  yieldRoastedKg(inputKg, estadoCompra, mermas) {
    let kg = Number(inputKg) || 0;
    if (estadoCompra === "pergamino") {
      kg *= 1 - (mermas.trilla || 0) / 100;
    }
    if (estadoCompra === "pergamino" || estadoCompra === "verde") {
      kg *= 1 - (mermas.tostion || 0) / 100;
      kg *= 1 - (mermas.seleccion || 0) / 100;
    }
    // tostado: se asume ya listo (sin merma de proceso)
    return Math.max(0, kg);
  },

  /** Factor de merma total (entrada → tostado listo) */
  yieldFactor(estadoCompra, mermas) {
    return this.yieldRoastedKg(1, estadoCompra, mermas);
  },

  /** Costo café verde/pergamino por kg de entrada + transporte opcional */
  coffeeLandedCostPerKg(coffee) {
    const base = Number(coffee.precioKg) || 0;
    const transport = coffee.transporteIncluido
      ? 0
      : Number(coffee.transportePorKg) || 0;
    return base + transport;
  },

  /**
   * Costo de producción por kg tostado (sin margen comercial).
   * Incluye: café (ajustado por merma), tostión, selección, empaque, etiqueta, alza.
   */
  productionCostPerKgRoasted({ coffee, costs, formatoId, etiqueta = "pequena" }) {
    const factor = this.yieldFactor(coffee.estadoCompra, costs.mermas);
    const coffeePerRoastedKg = factor > 0
      ? this.coffeeLandedCostPerKg(coffee) / factor
      : 0;

    const tostion = Number(costs.tostionPorKg) || 0;
    const seleccion = Number(costs.seleccionPorKg) || 0;
    const empaque = Number(costs.empaque?.[formatoId]) || 0;
    const formato = BC.CATALOGS.formatosEmpaque.find((f) => f.id === formatoId);
    const kgPorUnidad = formato?.kg || 0.25;
    // empaque y etiqueta son por unidad → prorrateo a kg
    const empaquePorKg = kgPorUnidad > 0 ? empaque / kgPorUnidad : 0;
    const etiquetaCosto =
      etiqueta === "grande"
        ? Number(costs.etiquetaGrande) || 0
        : Number(costs.etiquetaPequena) || 0;
    const etiquetaPorKg = kgPorUnidad > 0 ? etiquetaCosto / kgPorUnidad : 0;
    const alza = costs.alzaActiva ? Number(costs.costoAlza) || 0 : 0;

    const unitCost =
      coffeePerRoastedKg + tostion + seleccion + empaquePorKg + etiquetaPorKg + alza;

    return {
      coffeePerRoastedKg,
      tostion,
      seleccion,
      empaquePorKg,
      etiquetaPorKg,
      alza,
      unitCost,
      factor,
      kgPorUnidad,
      empaqueUnit: empaque,
      etiquetaUnit: etiquetaCosto,
    };
  },

  priceWithMargin(cost, marginPct) {
    const m = Number(marginPct) || 0;
    return cost * (1 + m / 100);
  },

  buildQuoteLine({ coffee, costs, formatoId, etiqueta, margen, kilosTostados, tipoCliente }) {
    const breakdown = this.productionCostPerKgRoasted({
      coffee,
      costs,
      formatoId,
      etiqueta,
    });
    const precioVentaKg = this.priceWithMargin(breakdown.unitCost, margen);
    const unidades = breakdown.kgPorUnidad > 0
      ? Math.round((Number(kilosTostados) / breakdown.kgPorUnidad) * 100) / 100
      : 0;
    const precioUnidad = breakdown.kgPorUnidad * precioVentaKg;
    const subtotal = precioVentaKg * Number(kilosTostados);

    return {
      coffeeId: coffee.id,
      coffeeName: coffee.nombre,
      formatoId,
      etiqueta,
      margen,
      tipoCliente,
      kilosTostados: Number(kilosTostados),
      unidades,
      precioVentaKg,
      precioUnidad,
      costoProduccionKg: breakdown.unitCost,
      subtotal,
      breakdown,
    };
  },
};
