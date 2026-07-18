const ImportManager = {
  COLUMN_ALIASES: {
    name: ['nombre', 'name', 'café', 'cafe', 'producto', 'nombre del café', 'nombre cafe'],
    farmer: ['caficultor', 'farmer', 'productor'],
    variety: ['variedad', 'variety'],
    region: ['región', 'region', 'origen'],
    process: ['proceso', 'process'],
    fermentation: ['fermentación', 'fermentacion', 'fermentation'],
    altitude: ['altitud', 'altitude', 'msnm'],
    state: ['estado', 'state'],
    pricePerKg: ['precio', 'precio/kg', 'precio kg', 'precio_kg', 'price', 'precio por kg', 'valor kg'],
    notes: ['notas', 'notes', 'descripción', 'descripcion', 'cata']
  },

  normalizeHeader(h) {
    return String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  },

  mapHeaders(headers) {
    const mapping = {};
    const normalized = headers.map((h) => this.normalizeHeader(h));

    Object.entries(this.COLUMN_ALIASES).forEach(([field, aliases]) => {
      const idx = normalized.findIndex((h) => aliases.some((a) => h.includes(this.normalizeHeader(a))));
      if (idx >= 0) mapping[field] = idx;
    });

    return mapping;
  },

  rowToCoffee(row, mapping) {
    const get = (field) => {
      const idx = mapping[field];
      if (idx === undefined) return '';
      return row[idx] != null ? String(row[idx]).trim() : '';
    };

    const name = get('name');
    if (!name) return null;

    const priceRaw = get('pricePerKg').replace(/[^\d.,]/g, '').replace(',', '.');
    const pricePerKg = parseFloat(priceRaw) || 0;
    if (!pricePerKg) return null;

    let state = get('state').toLowerCase();
    if (state.includes('perga')) state = 'pergamino';
    else state = 'verde';

    let variety = get('variety');
    if (variety && !COFFEE_VARIETIES.includes(variety)) {
      const match = COFFEE_VARIETIES.find((v) => v.toLowerCase() === variety.toLowerCase());
      variety = match || variety;
    }

    let region = get('region');
    if (region && !COLOMBIAN_REGIONS.includes(region)) {
      const match = COLOMBIAN_REGIONS.find((r) => r.toLowerCase() === region.toLowerCase());
      region = match || region;
    }

    let process = get('process');
    if (process && !COFFEE_PROCESSES.includes(process)) {
      const match = COFFEE_PROCESSES.find((p) => p.toLowerCase() === process.toLowerCase());
      process = match || process;
    }

    return {
      name,
      farmer: get('farmer') || name,
      variety: variety || 'Caturra',
      region: region || 'Huila',
      process: process || 'Lavado',
      fermentation: get('fermentation'),
      altitude: get('altitude'),
      state,
      pricePerKg,
      transportIncluded: true,
      transportCost: 0,
      image: null,
      notes: get('notes')
    };
  },

  parseWorkbook(buffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Lector Excel no disponible');
    }
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) return { coffees: [], errors: ['El archivo no tiene filas de datos'] };

    const headers = rows[0];
    const mapping = this.mapHeaders(headers);
    const coffees = [];
    const errors = [];

    if (!mapping.name) errors.push('No se encontró columna de nombre (nombre, café, producto...)');
    if (!mapping.pricePerKg) errors.push('No se encontró columna de precio (precio/kg, precio...)');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => !c)) continue;
      const coffee = this.rowToCoffee(row, mapping);
      if (coffee) {
        coffees.push({ ...coffee, _row: i + 1 });
      } else {
        errors.push(`Fila ${i + 1}: nombre o precio inválido`);
      }
    }

    return { coffees, errors, mapping, headers };
  },

  analyzeCongruence(importedCoffees) {
    const existing = CoffeeManager.getAll();
    const purchases = Storage.get(STORAGE_KEYS.PURCHASES) || [];
    const sales = SalesManager.getAll();
    const issues = [];
    const matches = [];

    importedCoffees.forEach((imp) => {
      const existingMatch = existing.find((c) =>
        c.name.toLowerCase() === imp.name.toLowerCase()
        || (imp.farmer && c.farmer?.toLowerCase() === imp.farmer.toLowerCase() && c.region === imp.region)
      );

      if (existingMatch) {
        const priceDiff = Math.abs(existingMatch.pricePerKg - imp.pricePerKg);
        const pricePct = existingMatch.pricePerKg > 0 ? (priceDiff / existingMatch.pricePerKg) * 100 : 0;

        if (pricePct > 5) {
          issues.push({
            type: 'precio',
            coffee: imp.name,
            message: `Precio en catálogo (${formatCurrency(existingMatch.pricePerKg)}) vs Excel (${formatCurrency(imp.pricePerKg)}) — diferencia ${formatNumber(pricePct, 1)}%`
          });
        } else {
          matches.push({ coffee: imp.name, message: 'Precio congruente con catálogo' });
        }

        const coffeePurchases = purchases.filter((p) => p.coffeeId === existingMatch.id);
        if (coffeePurchases.length > 0) {
          const avgPurchase = coffeePurchases.reduce((s, p) => s + p.costPerKg, 0) / coffeePurchases.length;
          const purchaseDiff = Math.abs(avgPurchase - imp.pricePerKg) / imp.pricePerKg * 100;
          if (purchaseDiff > 10) {
            issues.push({
              type: 'compra',
              coffee: imp.name,
              message: `Precio Excel (${formatCurrency(imp.pricePerKg)}) vs promedio compras (${formatCurrency(avgPurchase)}) — revisar`
            });
          }
        }

        const coffeeSales = sales.filter((s) => s.coffeeId === existingMatch.id);
        coffeeSales.forEach((sale) => {
          if (sale.profitMargin < 15) {
            issues.push({
              type: 'venta',
              coffee: imp.name,
              message: `Venta con margen bajo (${formatNumber(sale.profitMargin, 1)}%) — precio catálogo puede estar desactualizado`
            });
          }
        });
      } else {
        matches.push({ coffee: imp.name, message: 'Café nuevo — se agregará al catálogo' });
      }
    });

    return { issues, matches, summary: {
      total: importedCoffees.length,
      issues: issues.length,
      newCoffees: importedCoffees.filter((i) => !existing.find((e) => e.name.toLowerCase() === i.name.toLowerCase())).length
    }};
  },

  importCoffees(coffees, options = { skipDuplicates: true }) {
    const existing = CoffeeManager.getAll();
    let added = 0;
    let updated = 0;
    let skipped = 0;

    coffees.forEach((coffee) => {
      const match = existing.find((c) => c.name.toLowerCase() === coffee.name.toLowerCase());
      if (match) {
        if (options.skipDuplicates) {
          CoffeeManager.save({ ...match, ...coffee, id: match.id }, { notify: false });
          updated++;
        } else {
          skipped++;
        }
      } else {
        CoffeeManager.save(coffee, { notify: false });
        added++;
      }
    });

    Notifications.add(
      `Importación: ${added} nuevos, ${updated} actualizados${skipped ? `, ${skipped} omitidos` : ''}`,
      'success',
      { section: 'coffees' }
    );

    return { added, updated, skipped };
  },

  showModal() {
    const modal = document.getElementById('import-modal');
    document.getElementById('import-form').innerHTML = `
      <p class="form-hint" style="margin-bottom:16px">
        Sube un Excel (.xlsx, .xls) o CSV con columnas como: <strong>Nombre</strong>, <strong>Variedad</strong>,
        <strong>Región</strong>, <strong>Proceso</strong>, <strong>Precio/kg</strong>, Caficultor, Fermentación, Altitud.
      </p>
      <div class="form-group">
        <label>Archivo Excel / CSV</label>
        <input type="file" class="form-control" id="import-file" accept=".xlsx,.xls,.csv">
      </div>
      <div id="import-preview"></div>
      <div id="import-congruence"></div>
    `;

    document.getElementById('import-file')?.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files[0]);
    });

    modal.classList.add('active');
  },

  async handleFileSelect(file) {
    if (!file) return;

    const preview = document.getElementById('import-preview');
    const congruence = document.getElementById('import-congruence');
    preview.innerHTML = '<p class="form-hint">Procesando archivo...</p>';
    congruence.innerHTML = '';

    try {
      const buffer = await file.arrayBuffer();
      let result;

      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(buffer);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const rows = lines.map((l) => l.split(/[,;]/).map((c) => c.replace(/^"|"$/g, '').trim()));
        const headers = rows[0];
        const mapping = this.mapHeaders(headers);
        const coffees = [];
        const errors = [];
        for (let i = 1; i < rows.length; i++) {
          const coffee = this.rowToCoffee(rows[i], mapping);
          if (coffee) coffees.push({ ...coffee, _row: i + 1 });
          else errors.push(`Fila ${i + 1}: datos inválidos`);
        }
        result = { coffees, errors };
      } else {
        result = this.parseWorkbook(buffer);
      }

      this._pendingImport = result.coffees;

      const analysis = this.analyzeCongruence(result.coffees);

      preview.innerHTML = `
        <div class="cost-breakdown" style="margin-top:16px">
          <h4 style="margin-bottom:8px">Vista previa (${result.coffees.length} cafés)</h4>
          ${result.errors?.length ? `<p style="color:var(--warning);font-size:0.85rem;margin-bottom:8px">${result.errors.slice(0, 5).join('<br>')}</p>` : ''}
          <div class="table-container" style="max-height:200px;overflow-y:auto">
            <table>
              <thead><tr><th>Nombre</th><th>Región</th><th>Proceso</th><th>Precio/kg</th></tr></thead>
              <tbody>
                ${result.coffees.slice(0, 20).map((c) => `
                  <tr>
                    <td>${c.name}</td>
                    <td>${c.region}</td>
                    <td>${c.process}</td>
                    <td>${formatCurrency(c.pricePerKg)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${result.coffees.length > 20 ? `<p class="form-hint">... y ${result.coffees.length - 20} más</p>` : ''}
        </div>
      `;

      congruence.innerHTML = `
        <div class="cost-breakdown" style="margin-top:16px;border-color:${analysis.issues.length ? 'var(--warning)' : 'var(--success)'}">
          <h4 style="margin-bottom:8px">Análisis de Congruencia</h4>
          <p style="font-size:0.9rem;margin-bottom:12px">
            ${analysis.summary.newCoffees} nuevos · ${analysis.summary.total - analysis.summary.newCoffees} existentes ·
            <strong style="color:${analysis.issues.length ? 'var(--warning)' : 'var(--success)'}">${analysis.issues.length} alertas</strong>
          </p>
          ${analysis.issues.length ? `
            <div style="margin-bottom:12px">
              ${analysis.issues.map((i) => `<p style="font-size:0.85rem;color:var(--warning);margin:4px 0">⚠ <strong>${i.coffee}</strong>: ${i.message}</p>`).join('')}
            </div>
          ` : '<p style="color:var(--success);font-size:0.9rem">✓ Sin incongruencias detectadas con catálogo, compras y ventas</p>'}
          ${analysis.matches.slice(0, 5).map((m) => `<p style="font-size:0.8rem;color:var(--text-muted);margin:2px 0">✓ ${m.coffee}: ${m.message}</p>`).join('')}
        </div>
      `;
    } catch (err) {
      preview.innerHTML = `<p style="color:var(--danger)">Error al leer archivo: ${err.message}</p>`;
    }
  },

  confirmImport() {
    if (!this._pendingImport?.length) {
      Toast.show('Primero seleccione un archivo válido', 'danger');
      return;
    }

    const result = this.importCoffees(this._pendingImport, { skipDuplicates: false });
    document.getElementById('import-modal')?.classList.remove('active');
    this._pendingImport = null;
    App.renderSection('coffees');
    Toast.show(`Importados: ${result.added} nuevos, ${result.updated} actualizados`, 'success');
  }
};
