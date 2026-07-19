const ReportsManager = {
  _activeTab: 'summary',
  _preset: 'month',
  _from: '',
  _to: '',

  getFilters() {
    return { preset: this._preset, from: this._from, to: this._to, tab: this._activeTab };
  },

  resolveDateRange(filters = this.getFilters()) {
    const now = new Date();
    const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

    let from = null;
    let to = endOfDay(now);

    switch (filters.preset) {
      case 'today':
        from = startOfDay(now);
        break;
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        from = startOfDay(d);
        break;
      }
      case 'month':
        from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        break;
      case 'last_month':
        from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      case 'year':
        from = startOfDay(new Date(now.getFullYear(), 0, 1));
        break;
      case 'all':
        from = null;
        to = null;
        break;
      case 'custom':
        if (filters.from) from = startOfDay(new Date(`${filters.from}T00:00:00`));
        if (filters.to) to = endOfDay(new Date(`${filters.to}T00:00:00`));
        break;
      default:
        from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    }

    return { from, to };
  },

  isInRange(isoDate, range) {
    if (!isoDate) return false;
    if (!range.from && !range.to) return true;
    const ts = new Date(isoDate).getTime();
    if (range.from && ts < range.from.getTime()) return false;
    if (range.to && ts > range.to.getTime()) return false;
    return true;
  },

  filterByRange(items, dateField, range) {
    if (!range.from && !range.to) return items;
    return items.filter((item) => this.isInRange(item[dateField], range));
  },

  getInventorySnapshot() {
    const inventory = InventoryManager.getAll();
    const coffees = CoffeeManager.getAll();
    const byCoffee = coffees.map((coffee) => {
      const item = inventory.find((i) => i.coffeeId === coffee.id) || {};
      return {
        coffeeId: coffee.id,
        coffeeName: coffee.name,
        state: coffee.state,
        greenKg: item.greenKg || 0,
        roastedKg: item.roastedKg || 0,
        selectedKg: item.selectedKg || 0,
        groundKg: item.groundKg || 0,
        packagedUnits: formatPackagedUnitsSummary(item.packagedUnits || {})
      };
    });

    const totals = byCoffee.reduce(
      (acc, row) => ({
        greenKg: acc.greenKg + row.greenKg,
        roastedKg: acc.roastedKg + row.roastedKg,
        selectedKg: acc.selectedKg + row.selectedKg,
        groundKg: acc.groundKg + row.groundKg
      }),
      { greenKg: 0, roastedKg: 0, selectedKg: 0, groundKg: 0 }
    );

    return { byCoffee, totals };
  },

  getMovements(range) {
    const purchases = Storage.get(STORAGE_KEYS.PURCHASES) || [];
    return purchases
      .filter((p) => this.isInRange(p.date, range))
      .map((p) => {
        const coffee = CoffeeManager.getById(p.coffeeId);
        return {
          date: p.date,
          type: p.type === 'transfer' ? 'Transformación' : 'Entrada',
          coffeeName: coffee?.name || p.coffeeId,
          stage: p.stageKey || p.transferKey || p.stockType || '—',
          detail: p.type === 'transfer'
            ? `${formatNumber(p.inputKg || 0)} kg → ${p.outputUnits ? `${p.outputUnits} uds` : `${formatNumber(p.outputKg || 0)} kg`}`
            : p.units
              ? `${p.units} uds ${PACKAGING_SIZES[p.packaging]?.label || p.packaging || ''}`
              : `${formatNumber(p.kg || 0)} kg`,
          cost: p.totalCost || p.processCost || 0,
          userName: p.userName || '—'
        };
      });
  },

  buildReportData(filters = this.getFilters()) {
    const range = this.resolveDateRange(filters);
    const sales = this.filterByRange(SalesManager.getAll(), 'soldAt', range);
    const quotations = this.filterByRange(QuotationManager.getAll(), 'createdAt', range);
    const salesSummary = SalesManager.getReportSummary(sales);
    const quotationsSummary = QuotationManager.getReportSummary(quotations);

    const statusBreakdown = quotations.reduce((acc, q) => {
      const key = q.status || 'pending';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const movements = this.getMovements(range);
    const movementCost = movements.reduce((sum, m) => sum + (m.cost || 0), 0);
    const inventory = this.getInventorySnapshot();

    const label = this.formatRangeLabel(range, filters.preset);

    return {
      range,
      label,
      sales,
      quotations,
      salesSummary,
      quotationsSummary,
      statusBreakdown,
      movements,
      movementCost,
      inventory
    };
  },

  formatRangeLabel(range, preset) {
    const presets = {
      today: 'Hoy',
      week: 'Últimos 7 días',
      month: 'Este mes',
      last_month: 'Mes anterior',
      year: 'Este año',
      all: 'Todo el historial',
      custom: 'Rango personalizado'
    };
    if (preset !== 'custom') return presets[preset] || presets.month;
    const from = range.from ? range.from.toLocaleDateString('es-CO') : '—';
    const to = range.to ? range.to.toLocaleDateString('es-CO') : '—';
    return `${from} → ${to}`;
  },

  setPreset(preset) {
    this._preset = preset;
    App.renderSection('reports');
  },

  setCustomRange(from, to) {
    this._preset = 'custom';
    this._from = from;
    this._to = to;
    App.renderSection('reports');
  },

  setTab(tab) {
    this._activeTab = tab;
    App.renderSection('reports');
  },

  render(container) {
    if (!container) return;

    const data = this.buildReportData();
    const tabs = [
      { key: 'summary', label: 'Resumen' },
      { key: 'sales', label: 'Ventas' },
      { key: 'quotations', label: 'Cotizaciones' },
      { key: 'inventory', label: 'Inventario' },
      { key: 'movements', label: 'Movimientos' }
    ];

    container.innerHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header" style="flex-wrap:wrap;gap:12px">
          <div>
            <span class="card-title">Filtros</span>
            <p class="form-hint" style="margin:4px 0 0">${data.label}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto">
            <button type="button" class="btn btn-sm btn-secondary" onclick="ReportsManager.exportCsv()">⬇ CSV</button>
            <button type="button" class="btn btn-sm btn-primary" onclick="ReportsManager.exportExcel()">⬇ Excel</button>
          </div>
        </div>
        <div class="filter-bar" id="reports-preset-bar">
          ${[
            ['today', 'Hoy'],
            ['week', '7 días'],
            ['month', 'Este mes'],
            ['last_month', 'Mes ant.'],
            ['year', 'Este año'],
            ['all', 'Todo'],
            ['custom', 'Personalizado']
          ].map(([key, label]) => `
            <button type="button" class="btn btn-sm ${this._preset === key ? 'btn-primary' : 'btn-secondary'}"
              data-preset="${key}">${label}</button>
          `).join('')}
        </div>
        <div id="reports-custom-range" class="form-row" style="margin-top:12px;${this._preset === 'custom' ? '' : 'display:none'}">
          <div class="form-group">
            <label>Desde</label>
            <input type="date" class="form-control" id="reports-from" value="${this._from}">
          </div>
          <div class="form-group">
            <label>Hasta</label>
            <input type="date" class="form-control" id="reports-to" value="${this._to}">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button type="button" class="btn btn-primary" id="reports-apply-range">Aplicar</button>
          </div>
        </div>
      </div>

      <div class="filter-bar" style="margin-bottom:20px">
        ${tabs.map((t) => `
          <button type="button" class="btn btn-sm ${this._activeTab === t.key ? 'btn-primary' : 'btn-secondary'}"
            data-tab="${t.key}">${t.label}</button>
        `).join('')}
      </div>

      <div id="reports-tab-content"></div>
    `;

    container.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 'custom') {
          this._preset = 'custom';
          container.querySelector('#reports-custom-range').style.display = '';
          App.renderSection('reports');
          return;
        }
        this.setPreset(preset);
      });
    });

    container.querySelector('#reports-apply-range')?.addEventListener('click', () => {
      const from = container.querySelector('#reports-from')?.value || '';
      const to = container.querySelector('#reports-to')?.value || '';
      if (!from || !to) {
        Toast.show('Seleccione fecha desde y hasta', 'warning');
        return;
      }
      this.setCustomRange(from, to);
    });

    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab));
    });

    const tabEl = container.querySelector('#reports-tab-content');
    switch (this._activeTab) {
      case 'sales':
        this.renderSalesTab(tabEl, data);
        break;
      case 'quotations':
        this.renderQuotationsTab(tabEl, data);
        break;
      case 'inventory':
        this.renderInventoryTab(tabEl, data);
        break;
      case 'movements':
        this.renderMovementsTab(tabEl, data);
        break;
      default:
        this.renderSummaryTab(tabEl, data);
    }
  },

  renderSummaryTab(container, data) {
    const { salesSummary, quotationsSummary, statusBreakdown, movementCost, inventory } = data;
    container.innerHTML = `
      <div class="grid-4" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(salesSummary.totalRevenue)}</div>
          <div class="stat-label">Ingresos · ${salesSummary.count} ventas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${formatCurrency(salesSummary.totalProfit)}</div>
          <div class="stat-label">Utilidad · margen ${formatNumber(salesSummary.avgMargin, 1)}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(quotationsSummary.totalQuoted)}</div>
          <div class="stat-label">Cotizado · ${quotationsSummary.count} cotiz.</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--warning)">${formatCurrency(salesSummary.pendingAmount)}</div>
          <div class="stat-label">${salesSummary.pendingPayment} ventas sin pagar</div>
        </div>
      </div>
      <div class="grid-2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px">
        <div class="card">
          <div class="card-header"><span class="card-title">Ventas en período</span></div>
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Ingresos</span><span>${formatCurrency(salesSummary.totalRevenue)}</span></div>
            <div class="cost-row"><span class="cost-label">Costos</span><span>${formatCurrency(salesSummary.totalCost)}</span></div>
            <div class="cost-row"><span class="cost-label">Utilidad</span><span>${formatCurrency(salesSummary.totalProfit)}</span></div>
            <div class="cost-row"><span class="cost-label">Unidades vendidas</span><span>${salesSummary.totalUnits}</span></div>
            <div class="cost-row"><span class="cost-label">Pagadas / pendientes</span><span>${salesSummary.paidCount} / ${salesSummary.pendingPayment}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Cotizaciones en período</span></div>
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Valor cotizado</span><span>${formatCurrency(quotationsSummary.totalQuoted)}</span></div>
            <div class="cost-row"><span class="cost-label">Costo interno</span><span>${formatCurrency(quotationsSummary.totalCost)}</span></div>
            <div class="cost-row"><span class="cost-label">Utilidad estimada</span><span>${formatCurrency(quotationsSummary.totalProfit)}</span></div>
            <div class="cost-row"><span class="cost-label">Margen prom.</span><span>${formatNumber(quotationsSummary.avgMargin, 1)}%</span></div>
            ${Object.entries(statusBreakdown).map(([status, count]) => `
              <div class="cost-row"><span class="cost-label">${QUOTATION_STATUSES[status]?.label || status}</span><span>${count}</span></div>
            `).join('') || '<p class="form-hint">Sin cotizaciones en el período</p>'}
          </div>
        </div>
      </div>
      <div class="grid-2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
        <div class="card">
          <div class="card-header"><span class="card-title">Inventario actual (instantánea)</span></div>
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Verde</span><span>${formatNumber(inventory.totals.greenKg)} kg</span></div>
            <div class="cost-row"><span class="cost-label">Tostado</span><span>${formatNumber(inventory.totals.roastedKg)} kg</span></div>
            <div class="cost-row"><span class="cost-label">Seleccionado</span><span>${formatNumber(inventory.totals.selectedKg)} kg</span></div>
            <div class="cost-row"><span class="cost-label">Molido</span><span>${formatNumber(inventory.totals.groundKg)} kg</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Movimientos en período</span></div>
          <div class="cost-breakdown">
            <div class="cost-row"><span class="cost-label">Registros</span><span>${data.movements.length}</span></div>
            <div class="cost-row"><span class="cost-label">Costo registrado</span><span>${formatCurrency(data.movementCost)}</span></div>
          </div>
        </div>
      </div>
    `;
  },

  renderSalesTab(container, data) {
    const { sales, salesSummary } = data;
    if (sales.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No hay ventas en el período seleccionado</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="grid-4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value">${salesSummary.count}</div><div class="stat-label">Ventas</div></div>
        <div class="stat-card"><div class="stat-value">${formatCurrency(salesSummary.totalRevenue)}</div><div class="stat-label">Ingresos</div></div>
        <div class="stat-card"><div class="stat-value">${formatCurrency(salesSummary.totalProfit)}</div><div class="stat-label">Utilidad</div></div>
        <div class="stat-card"><div class="stat-value">${formatNumber(salesSummary.avgMargin, 1)}%</div><div class="stat-label">Margen prom.</div></div>
      </div>
      <div class="card"><div class="table-container"><table>
        <thead><tr>
          <th>Fecha</th><th>Café</th><th>Cliente</th><th>Presentación</th><th>Cant.</th>
          <th>Ingreso</th><th>Costo</th><th>Utilidad</th><th>Margen</th><th>Pago</th><th>Vendedor</th>
        </tr></thead>
        <tbody>
          ${sales.map((s) => `
            <tr>
              <td>${formatDate(s.soldAt)}</td>
              <td>${s.coffeeName}</td>
              <td>${s.clientName}</td>
              <td>${PACKAGING_SIZES[s.packaging]?.label || s.packaging}</td>
              <td>${s.quantity}</td>
              <td>${formatCurrency(s.totalRevenue)}</td>
              <td>${formatCurrency(s.totalCost)}</td>
              <td>${formatCurrency(s.profit)}</td>
              <td>${formatNumber(s.profitMargin, 1)}%</td>
              <td>${SALE_PAYMENT_STATUSES[s.paymentStatus]?.label || s.paymentStatus || '—'}</td>
              <td>${s.userName || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div></div>
    `;
  },

  renderQuotationsTab(container, data) {
    const { quotations, quotationsSummary } = data;
    if (quotations.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No hay cotizaciones en el período seleccionado</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="grid-4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value">${quotationsSummary.count}</div><div class="stat-label">Cotizaciones</div></div>
        <div class="stat-card"><div class="stat-value">${formatCurrency(quotationsSummary.totalQuoted)}</div><div class="stat-label">Valor cotizado</div></div>
        <div class="stat-card"><div class="stat-value">${formatCurrency(quotationsSummary.totalCost)}</div><div class="stat-label">Costo interno</div></div>
        <div class="stat-card"><div class="stat-value">${formatNumber(quotationsSummary.avgMargin, 1)}%</div><div class="stat-label">Margen prom.</div></div>
      </div>
      <div class="card"><div class="table-container"><table>
        <thead><tr>
          <th>No.</th><th>Fecha</th><th>Cliente</th><th>Café</th><th>Modo</th><th>Cant.</th>
          <th>Total cliente</th><th>Costo int.</th><th>Utilidad</th><th>Margen</th><th>Estado</th>
        </tr></thead>
        <tbody>
          ${quotations.map((q) => {
            const m = QuotationManager.getInternalMetrics(q);
            return `
            <tr>
              <td>${q.number}</td>
              <td>${formatDate(q.createdAt)}</td>
              <td>${q.clientName}</td>
              <td>${q.coffeeName}</td>
              <td>${PRODUCTION_MODES[q.productionMode || 'full_pack']?.label || '—'}</td>
              <td>${q.quantity}</td>
              <td>${formatCurrency(q.totalPrice)}</td>
              <td>${formatCurrency(m.totalCost)}</td>
              <td>${formatCurrency(m.profit)}</td>
              <td>${formatNumber(m.profitMargin, 1)}%</td>
              <td>${QUOTATION_STATUSES[q.status || 'pending']?.label || q.status}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div></div>
    `;
  },

  renderInventoryTab(container, data) {
    const { inventory } = data;
    container.innerHTML = `
      <p class="form-hint" style="margin-bottom:16px">Stock actual por café (no filtrado por fecha — es una instantánea al momento del reporte).</p>
      <div class="grid-4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value">${formatNumber(inventory.totals.greenKg)}</div><div class="stat-label">kg Verde</div></div>
        <div class="stat-card"><div class="stat-value">${formatNumber(inventory.totals.roastedKg)}</div><div class="stat-label">kg Tostado</div></div>
        <div class="stat-card"><div class="stat-value">${formatNumber(inventory.totals.selectedKg)}</div><div class="stat-label">kg Seleccionado</div></div>
        <div class="stat-card"><div class="stat-value">${formatNumber(inventory.totals.groundKg)}</div><div class="stat-label">kg Molido</div></div>
      </div>
      <div class="card"><div class="table-container"><table>
        <thead><tr>
          <th>Café</th><th>Estado</th><th>Verde</th><th>Tostado</th><th>Seleccionado</th><th>Molido</th><th>Empacado</th>
        </tr></thead>
        <tbody>
          ${inventory.byCoffee.map((row) => `
            <tr>
              <td>${row.coffeeName}</td>
              <td>${COFFEE_STATES[row.state]?.label || row.state}</td>
              <td>${formatNumber(row.greenKg)} kg</td>
              <td>${formatNumber(row.roastedKg)} kg</td>
              <td>${formatNumber(row.selectedKg)} kg</td>
              <td>${formatNumber(row.groundKg)} kg</td>
              <td>${row.packagedUnits}</td>
            </tr>
          `).join('') || '<tr><td colspan="7">Sin cafés registrados</td></tr>'}
        </tbody>
      </table></div></div>
    `;
  },

  renderMovementsTab(container, data) {
    const { movements } = data;
    if (movements.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No hay entradas ni transformaciones en el período</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="card"><div class="table-container"><table>
        <thead><tr>
          <th>Fecha</th><th>Tipo</th><th>Café</th><th>Etapa</th><th>Detalle</th><th>Costo</th><th>Usuario</th>
        </tr></thead>
        <tbody>
          ${movements.map((m) => `
            <tr>
              <td>${formatDate(m.date)}</td>
              <td>${m.type}</td>
              <td>${m.coffeeName}</td>
              <td>${m.stage}</td>
              <td>${m.detail}</td>
              <td>${formatCurrency(m.cost)}</td>
              <td>${m.userName}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div></div>
    `;
  },

  downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  exportCsv() {
    const data = this.buildReportData();
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = [];

    rows.push(['Reporte Black Coffee Administration']);
    rows.push(['Período', data.label]);
    rows.push(['Generado', new Date().toLocaleString('es-CO')]);
    rows.push([]);

    rows.push(['RESUMEN VENTAS']);
    rows.push(['Ventas', data.salesSummary.count]);
    rows.push(['Ingresos', data.salesSummary.totalRevenue]);
    rows.push(['Costos', data.salesSummary.totalCost]);
    rows.push(['Utilidad', data.salesSummary.totalProfit]);
    rows.push([]);

    rows.push(['VENTAS']);
    rows.push(['Fecha', 'Café', 'Cliente', 'Presentación', 'Cantidad', 'Ingreso', 'Costo', 'Utilidad', 'Margen %', 'Pago']);
    data.sales.forEach((s) => {
      rows.push([
        s.soldAt,
        s.coffeeName,
        s.clientName,
        PACKAGING_SIZES[s.packaging]?.label || s.packaging,
        s.quantity,
        s.totalRevenue,
        s.totalCost,
        s.profit,
        s.profitMargin,
        s.paymentStatus
      ]);
    });
    rows.push([]);

    rows.push(['COTIZACIONES']);
    rows.push(['No.', 'Fecha', 'Cliente', 'Café', 'Total', 'Estado']);
    data.quotations.forEach((q) => {
      rows.push([q.number, q.createdAt, q.clientName, q.coffeeName, q.totalPrice, q.status]);
    });

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadBlob(`BCA-reporte-${stamp}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
    Toast.show('Reporte CSV descargado', 'success');
  },

  exportExcel() {
    if (typeof XLSX === 'undefined') {
      Toast.show('Cargando librería Excel… intente de nuevo en unos segundos', 'warning');
      return;
    }

    const data = this.buildReportData();
    const stamp = new Date().toISOString().slice(0, 10);
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ['Reporte BCA', data.label],
      ['Generado', new Date().toLocaleString('es-CO')],
      [],
      ['Ventas', data.salesSummary.count, 'Ingresos', data.salesSummary.totalRevenue],
      ['Utilidad', data.salesSummary.totalProfit, 'Margen %', data.salesSummary.avgMargin],
      ['Cotizaciones', data.quotationsSummary.count, 'Cotizado', data.quotationsSummary.totalQuoted]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Resumen');

    const salesRows = [
      ['Fecha', 'Café', 'Cliente', 'Presentación', 'Cant.', 'Ingreso', 'Costo', 'Utilidad', 'Margen %', 'Pago', 'Vendedor'],
      ...data.sales.map((s) => [
        s.soldAt, s.coffeeName, s.clientName,
        PACKAGING_SIZES[s.packaging]?.label || s.packaging,
        s.quantity, s.totalRevenue, s.totalCost, s.profit, s.profitMargin,
        s.paymentStatus, s.userName
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesRows), 'Ventas');

    const quotRows = [
      ['No.', 'Fecha', 'Cliente', 'Café', 'Modo', 'Cant.', 'Total', 'Costo int.', 'Utilidad', 'Margen %', 'Estado'],
      ...data.quotations.map((q) => {
        const m = QuotationManager.getInternalMetrics(q);
        return [
          q.number, q.createdAt, q.clientName, q.coffeeName,
          q.productionMode, q.quantity, q.totalPrice, m.totalCost, m.profit, m.profitMargin, q.status
        ];
      })
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quotRows), 'Cotizaciones');

    const invRows = [
      ['Café', 'Estado', 'Verde kg', 'Tostado kg', 'Seleccionado kg', 'Molido kg', 'Empacado'],
      ...data.inventory.byCoffee.map((r) => [
        r.coffeeName, r.state, r.greenKg, r.roastedKg, r.selectedKg, r.groundKg, r.packagedUnits
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invRows), 'Inventario');

    const movRows = [
      ['Fecha', 'Tipo', 'Café', 'Etapa', 'Detalle', 'Costo', 'Usuario'],
      ...data.movements.map((m) => [m.date, m.type, m.coffeeName, m.stage, m.detail, m.cost, m.userName])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(movRows), 'Movimientos');

    XLSX.writeFile(wb, `BCA-reporte-${stamp}.xlsx`);
    Toast.show('Reporte Excel descargado', 'success');
  }
};
