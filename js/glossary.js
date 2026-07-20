const Glossary = {
  terms: [
    {
      id: 'full_pack',
      title: 'Full Pack',
      category: 'Modos de producción',
      summary: 'BCA compra el café, lo transforma, empaca y etiqueta. El precio incluye todo el pipeline.',
      detail: 'Incluye negociación administrativa, compra de café verde/pergamino, transporte (si aplica), transformación completa, material de empaque, etiquetas y costo de alza cuando está activo. Las mermas se calculan según el estado de llegada del café y pueden usar valores específicos del catálogo (p. ej. merma de tostión del PDF Ghost).'
    },
    {
      id: 'maquila',
      title: 'Maquila',
      category: 'Modos de producción',
      summary: 'El cliente puede aportar café y/o empaque; BCA cobra solo los servicios seleccionados.',
      detail: 'Configure qué aporta el cliente (café, empaque) y qué procesos ejecuta BCA: trilla, selección verde, tostión, selección post-tostión, molienda, empacada. Puede incluir o no etiquetas BCA. El costo de material de empaque solo se cobra si BCA aporta las bolsas.'
    },
    {
      id: 'merma',
      title: 'Merma',
      category: 'Costeo',
      summary: 'Pérdida de peso en cada etapa de transformación (trilla, selección, tostión, etc.).',
      detail: 'Se expresa en porcentaje sobre el kg que entra a cada paso. Los valores globales se configuran en Costos de Producción. Cada café puede tener mermas propias (ghostMeta.mermaTostion, mermaSeleccion) que prevalecen sobre los globales. El desglose de cotización muestra cada merma aplicada y la fuente (café vs global).'
    },
    {
      id: 'green_kg',
      title: 'Kg de entrada / compra',
      category: 'Costeo',
      summary: 'Kilogramos necesarios en el estado de compra del café para obtener la presentación final.',
      detail: 'Para café verde o pergamino se calcula invirtiendo la cadena de mermas activa. Para café ya tostado, seleccionado o molido solo se aplica merma en los pasos que aún faltan (p. ej. selección post-tostión en maquila).'
    },
    {
      id: 'empacada',
      title: 'Empacada (mano de obra)',
      category: 'Transformación',
      summary: 'Costo por unidad de empacar según presentación (250g, 500g, 5 lb).',
      detail: 'Tarifa configurable por proveedor en Proveedores. En maquila con empaque del cliente solo se cobra esta mano de obra, no el material de bolsa.'
    },
    {
      id: 'etiquetas',
      title: 'Etiquetas',
      category: 'Materiales',
      summary: 'Costo de etiqueta pequeña y/o grande por unidad empacada.',
      detail: 'En Full Pack siempre se incluyen (selección múltiple). En Maquila puede activarse con el interruptor «¿Incluir etiquetas BCA?»; si está desactivado, el costo de etiqueta es $0.'
    },
    {
      id: 'margen',
      title: 'Margen de ganancia',
      category: 'Precios',
      summary: 'Porcentaje sobre el costo total para obtener el precio de venta.',
      detail: 'En Full Pack se calcula automáticamente según margen objetivo y tipo de cliente (mayorista, retail, etc.). En Maquila puede fijarse el precio total al cliente y la plataforma calcula el margen implícito.'
    },
    {
      id: 'tipo_cliente',
      title: 'Tipo de cliente',
      category: 'Precios',
      summary: 'Multiplicador que ajusta el precio final (mayorista paga menos por unidad).',
      detail: 'Configurado en Clientes. Afecta el precio unitario final en Full Pack dividiendo el precio base entre el multiplicador del tipo.'
    },
    {
      id: 'costo_alza',
      title: 'Costo de alza',
      category: 'Costeo',
      summary: 'Recargo fijo opcional por unidad cuando está activado en Costos de Producción.',
      detail: 'Útil para cubrir incrementos temporales de insumos o logística. Se suma al costo unitario en Full Pack y Maquila.'
    },
    {
      id: 'negociacion',
      title: 'Negociación administrativa',
      category: 'Administrativa',
      summary: 'Tarifa fija de gestión comercial incluida solo en Full Pack.',
      detail: 'Representa el costo administrativo de negociar y cerrar la compra al caficultor. No aplica en Maquila.'
    },
    {
      id: 'sync',
      title: 'Sincronización',
      category: 'Plataforma',
      summary: 'Copia automática de datos entre dispositivos vía Google Apps Script (cada 10 s).',
      detail: 'Los cambios locales se envían a la nube y se fusionan con los del otro usuario. Si hay conflicto, gana el dato más reciente por clave. Funciona offline con cola de pendientes.'
    },
    {
      id: 'estado_cafe',
      title: 'Estado del café',
      category: 'Inventario',
      summary: 'Punto de entrada: verde, pergamino, tostado, seleccionado o molido.',
      detail: 'Determina qué mermas y pasos de transformación aplican. Un café tostado no vuelve a aplicar merma de tostión, pero sí puede aplicar selección post-tostión si el servicio está activo.'
    }
  ],

  render(container) {
    if (!container) return;

    const categories = [...new Set(this.terms.map((t) => t.category))];

    container.innerHTML = `
      <p class="form-hint" style="margin-bottom:20px">
        Referencia de términos usados en cotizaciones, inventario y costeo. Haga clic en un término para ver el detalle.
      </p>
      ${categories.map((cat) => `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header"><span class="card-title">${cat}</span></div>
          <div class="glossary-list">
            ${this.terms.filter((t) => t.category === cat).map((term) => `
              <details class="glossary-item">
                <summary><strong>${term.title}</strong> — ${term.summary}</summary>
                <p class="form-hint" style="margin-top:8px;padding-left:4px">${term.detail}</p>
              </details>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }
};
