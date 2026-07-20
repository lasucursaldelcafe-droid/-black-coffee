const WorkflowGuide = {
  flows: [
    {
      id: 'compra_inventario',
      title: '1. Compra e inventario',
      icon: '🌱',
      steps: ['Proveedores', 'Cafés', 'Inventario → Llegada verde/pergamino'],
      connectsTo: ['transformacion'],
      description: 'Registre proveedores y cafés. Ingrese compras en inventario según el estado de llegada (verde, pergamino, tostado, etc.). El costo $/kg alimenta cotizaciones.'
    },
    {
      id: 'transformacion',
      title: '2. Transformación',
      icon: '🔥',
      steps: ['Trilla', 'Selección verde', 'Tostión', 'Selección', 'Molienda', 'Empacado'],
      connectsTo: ['costos', 'cotizaciones'],
      description: 'Cada transferencia en Inventario aplica mermas configuradas y registra kg en la siguiente etapa. Las tarifas por proveedor vienen de Proveedores + Costos de Producción.'
    },
    {
      id: 'costos',
      title: '3. Parámetros de costeo',
      icon: '⚙️',
      steps: ['Costos de Producción', 'Costeo Interno'],
      connectsTo: ['cotizaciones', 'ventas'],
      description: 'Costos de Producción: mermas %, tarifas/kg, empaque, etiquetas, negociación, alza. Costeo Interno: simula escenarios Full Pack vs Maquila antes de cotizar.'
    },
    {
      id: 'cotizaciones',
      title: '4. Cotizaciones',
      icon: '📋',
      steps: ['Cliente', 'Modo Full Pack / Maquila', 'Café(s)', 'Empaque', 'Etiquetas', 'PDF'],
      connectsTo: ['ventas'],
      description: 'El motor de cotización usa los mismos parámetros que Costeo Interno. Full Pack incluye compra + transformación + materiales. Maquila permite café/empaque del cliente y servicios a la carta.'
    },
    {
      id: 'ventas',
      title: '5. Ventas y rentabilidad',
      icon: '💰',
      steps: ['Registrar venta', 'Margen real', 'Reportes'],
      connectsTo: ['compra_inventario'],
      description: 'Al vender se descuenta inventario empacado y se calcula margen real vs costo interno. Los reportes consolidan GTV, costos y márgenes.'
    }
  ],

  render(container) {
    if (!container) return;

    const flowCards = this.flows.map((flow, index) => {
      const next = flow.connectsTo.map((id) => {
        const target = this.flows.find((f) => f.id === id);
        return target ? target.title.replace(/^\d+\.\s/, '') : id;
      }).join(', ');

      return `
        <div class="workflow-flow-card card" data-flow-id="${flow.id}">
          <div class="card-header">
            <span class="card-title">${flow.icon} ${flow.title}</span>
          </div>
          <p style="margin-bottom:12px">${flow.description}</p>
          <ul class="workflow-step-list">
            ${flow.steps.map((s) => `<li>${s}</li>`).join('')}
          </ul>
          ${next ? `<p class="form-hint" style="margin-top:12px"><strong>Conecta con:</strong> ${next}</p>` : ''}
          ${index < this.flows.length - 1 ? '<div class="workflow-connector" aria-hidden="true">↓</div>' : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <p class="form-hint" style="margin-bottom:20px">
        Mapa de cómo se conectan compra, transformación, costos, cotizaciones y ventas en BCA.
      </p>
      <div class="workflow-map">
        ${flowCards}
      </div>
      <div class="card" style="margin-top:20px">
        <div class="card-header"><span class="card-title">Sync entre usuarios</span></div>
        <p>Todos los módulos anteriores comparten la misma base de datos local sincronizada cada <strong>10 segundos</strong> vía Google Apps Script. Cambios de Ximena y Pablo se fusionan automáticamente.</p>
      </div>
    `;
  }
};
