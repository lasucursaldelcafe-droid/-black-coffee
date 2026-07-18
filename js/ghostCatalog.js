const GhostCatalog = {
  PDF_PACKAGING_COSTS: {
    '250g': 1766,
    '500g': 2000,
    '5lb': 2500
  },

  PLATFORM_DEFAULTS: {
    mermaTostion: 16,
    mermaSeleccion: 3,
    packaging: { '250g': 1500, '500g': 1900, '5lb': 3000 },
    roasting: 3700,
    selection: 1900
  },

  toCoffeeRecord(entry) {
    const transportIncluded = !entry.transportCost || entry.transportCost === 0;
    return {
      name: entry.name,
      variety: entry.variety || 'Caturra',
      region: entry.region || 'Huila',
      process: entry.process || 'Lavado',
      fermentation: entry.fermentation || '',
      farmer: entry.farmer || entry.name,
      pricePerKg: entry.priceEfectivo || entry.priceVerde,
      transportIncluded,
      transportCost: transportIncluded ? 0 : (entry.transportCost || 0),
      state: 'pergamino',
      altitude: 'Bruselas, Pitalito',
      notes: [
        entry.notes,
        entry.ghostCode ? `Código Ghost: ${entry.ghostCode}` : '',
        entry.sourceFile ? `Fuente: ${entry.sourceFile}` : ''
      ].filter(Boolean).join(' | '),
      image: null,
      ghostCode: entry.ghostCode,
      ghostMeta: {
        priceVerde: entry.priceVerde,
        priceEfectivoResumen: entry.priceEfectivoResumen,
        mermaTostion: entry.mermaTostion,
        salePrices: entry.salePrices,
        productionMode: entry.productionMode || 'full_pack',
        sourceFile: entry.sourceFile
      }
    };
  },

  getCatalogEntries() {
    return this._catalog || [];
  },

  async loadCatalog() {
    if (this._catalog) return this._catalog;
    try {
      const response = await fetch('test-data/ghost-catalog.json');
      if (!response.ok) throw new Error('No se pudo cargar el catálogo');
      this._catalog = await response.json();
      return this._catalog;
    } catch {
      this._catalog = this._embeddedCatalog();
      return this._catalog;
    }
  },

  _embeddedCatalog() {
    return [];
  },

  analyzeEntry(entry, allEntries = []) {
    const issues = [];
    const matches = [];

    if (entry.priceEfectivoResumen != null && entry.priceEfectivo != null) {
      const diff = Math.abs(entry.priceEfectivoResumen - entry.priceEfectivo);
      const pct = entry.priceEfectivo > 0 ? (diff / entry.priceEfectivo) * 100 : 0;
      if (pct > 2) {
        issues.push({
          type: 'pdf_interno',
          severity: 'alta',
          message: `Resumen ($${entry.priceEfectivoResumen.toLocaleString('es-CO')}) ≠ Supuestos ($${entry.priceEfectivo.toLocaleString('es-CO')}) — ${formatNumber(pct, 1)}% diferencia`
        });
      } else {
        matches.push('Precio resumen y supuestos coherentes');
      }
    }

    if (entry.transportCost > 0 && entry.priceEfectivo === entry.priceVerde) {
      issues.push({
        type: 'pdf_interno',
        severity: 'media',
        message: `Logística $${entry.transportCost.toLocaleString('es-CO')}/kg declarada pero precio efectivo no la suma`
      });
    }

    if (entry.mermaTostion && entry.mermaTostion !== this.PLATFORM_DEFAULTS.mermaTostion) {
      issues.push({
        type: 'plataforma',
        severity: 'media',
        message: `Merma PDF ${entry.mermaTostion}% vs plataforma ${this.PLATFORM_DEFAULTS.mermaTostion}%`
      });
    }

    const coffee = this.toCoffeeRecord(entry);
    const bcaCost500 = ProductionCosts.calculateUnitCost(coffee, '500g', ['small'], {
      productionMode: entry.productionMode || 'full_pack'
    });

    const pdfGhost500 = entry.salePrices?.['500g'];
    if (pdfGhost500 && pdfGhost500 > 0) {
      const costDiff = pdfGhost500 - bcaCost500.totalCost;
      const marginPct = bcaCost500.totalCost > 0
        ? ((pdfGhost500 - bcaCost500.totalCost) / bcaCost500.totalCost) * 100
        : 0;

      if (marginPct < 0) {
        issues.push({
          type: 'costo',
          severity: 'alta',
          message: `Precio Ghost 500g ($${pdfGhost500.toLocaleString('es-CO')}) menor que costo BCA ($${Math.round(bcaCost500.totalCost).toLocaleString('es-CO')}) — pérdida`
        });
      } else if (marginPct < 15) {
        issues.push({
          type: 'costo',
          severity: 'media',
          message: `Margen BCA vs PDF Ghost 500g: ${formatNumber(marginPct, 1)}% (costo BCA $${Math.round(bcaCost500.totalCost).toLocaleString('es-CO')})`
        });
      } else {
        matches.push(`Costo BCA 500g coherente (margen ~${formatNumber(marginPct, 0)}%)`);
      }
    }

    if (entry.salePrices?.['340g']) {
      issues.push({
        type: 'plataforma',
        severity: 'baja',
        message: 'Presentación 340g en PDF no existe en BCA (solo 250g, 500g, 5lb)'
      });
    }

    const existing = CoffeeManager.getAll().find((c) =>
      c.name.toLowerCase() === entry.name.toLowerCase()
      || c.ghostCode === entry.ghostCode
    );

    if (existing) {
      const priceDiff = Math.abs(existing.pricePerKg - coffee.pricePerKg);
      const pricePct = existing.pricePerKg > 0 ? (priceDiff / existing.pricePerKg) * 100 : 0;
      if (pricePct > 5) {
        issues.push({
          type: 'catalogo',
          severity: 'media',
          message: `Catálogo BCA ($${existing.pricePerKg.toLocaleString('es-CO')}) vs PDF ($${coffee.pricePerKg.toLocaleString('es-CO')})`
        });
      } else {
        matches.push('Coincide con catálogo BCA existente');
      }
    } else {
      matches.push('Café nuevo para BCA');
    }

    const catalog = allEntries.length ? allEntries : this.getCatalogEntries();
    const duplicateCode = catalog.filter((e) =>
      e.ghostCode === entry.ghostCode && e.name !== entry.name
    );
    if (duplicateCode.length > 0) {
      issues.push({
        type: 'pdf_interno',
        severity: 'alta',
        message: `Código ${entry.ghostCode} duplicado con: ${duplicateCode.map((d) => d.name).join(', ')}`
      });
    }

    return { issues, matches, bcaCost500: bcaCost500.totalCost };
  },

  analyzeAll(entries) {
    const allIssues = [];
    const allMatches = [];
    const byCoffee = [];

    entries.forEach((entry) => {
      const { issues, matches, bcaCost500 } = this.analyzeEntry(entry, entries);
      byCoffee.push({ entry, issues, matches, bcaCost500 });
      issues.forEach((i) => allIssues.push({ coffee: entry.name, ...i }));
      matches.forEach((m) => allMatches.push({ coffee: entry.name, message: m }));
    });

    const codes = entries.map((e) => e.ghostCode);
    const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i);

    return {
      byCoffee,
      issues: allIssues,
      matches: allMatches,
      summary: {
        total: entries.length,
        issues: allIssues.length,
        high: allIssues.filter((i) => i.severity === 'alta').length,
        medium: allIssues.filter((i) => i.severity === 'media').length,
        low: allIssues.filter((i) => i.severity === 'baja').length,
        duplicateCodes: [...new Set(dupCodes)],
        newCoffees: entries.filter((e) =>
          !CoffeeManager.getAll().find((c) => c.name.toLowerCase() === e.name.toLowerCase())
        ).length
      }
    };
  },

  parsePdfText(text, fileName) {
    const titleMatch = text.match(/☕\s+(.+?)(?:\n|BLACK)/);
    const title = titleMatch ? titleMatch[1].trim() : fileName.replace('.pdf', '');

    const parseMoney = (raw) => {
      if (!raw) return null;
      const cleaned = String(raw).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      const val = parseFloat(cleaned);
      return Number.isFinite(val) ? val : null;
    };

    const code = (text.match(/Código\s+(\S+)/) || [])[1];
    const variety = (text.match(/Variedad\s+(.+?)(?:\n|Precio)/) || [])[1]?.trim();
    const priceVerde = parseMoney((text.match(/Precio verde[^\d]*([\d.,]+)/) || [])[1]);
    const transportCost = parseMoney((text.match(/Ajuste logístico[^\d]*([\d.,]+)/) || [])[1]) || 0;
    const priceEfectivo = parseMoney((text.match(/Precio efectivo[^\d]*([\d.,]+)/) || [])[1]);
    const mermaTostion = parseInt((text.match(/Merma tostión\s+(\d+)/) || [])[1], 10) || 15;

    const priceVerdeSup = parseMoney((text.match(/Precio verde \(COP\/kg\)\s+([\d.,]+)/) || [])[1]);
    const priceEfSup = parseMoney((text.match(/Precio verde efectivo \(COP\/kg\)\s+([\d.,]+)/) || [])[1]);

    const effectivePrice = priceEfSup || priceEfectivo || priceVerde;
    if (!title || !effectivePrice) return null;

    return {
      ghostCode: code || `PDF-${Date.now().toString(36)}`,
      name: title,
      variety: variety || 'Caturra',
      region: text.includes('Pitalito') || text.includes('Huila') ? 'Huila' : 'Cauca',
      process: variety?.toLowerCase().includes('natural') ? 'Natural'
        : variety?.toLowerCase().includes('honey') ? 'Honey'
          : variety?.toLowerCase().includes('thermal') ? 'Thermal shock'
            : 'Lavado',
      farmer: text.includes('FRESCO') ? 'Fresco Coffee' : 'Ghost Specialty Coffee',
      priceVerde: priceVerdeSup || priceVerde || effectivePrice,
      transportCost,
      priceEfectivo: effectivePrice,
      priceEfectivoResumen: priceEfectivo,
      mermaTostion,
      salePrices: {
        '500g': parseMoney((text.match(/Precio Ghost Coffee 1 lb\s+([\d.,]+)/) || [])[1])
          || parseMoney((text.match(/Precio FRESCO Coffee 340\s*G?\s+([\d.,]+)/i) || [])[1])
      },
      sourceFile: fileName,
      notes: `Importado desde PDF: ${fileName}`
    };
  },

  async importCatalog(entries, options = { updateExisting: true }) {
    let added = 0;
    let updated = 0;

    entries.forEach((entry) => {
      const coffee = this.toCoffeeRecord(entry);
      const existing = CoffeeManager.getAll().find((c) =>
        c.name.toLowerCase() === coffee.name.toLowerCase()
        || (coffee.ghostCode && c.ghostCode === coffee.ghostCode)
      );

      if (existing) {
        if (options.updateExisting) {
          CoffeeManager.save({ ...existing, ...coffee, id: existing.id }, { notify: false });
          updated++;
        }
      } else {
        CoffeeManager.save(coffee, { notify: false });
        added++;
      }
    });

    AuditLog.log('import_ghost_catalog', `${added} nuevos, ${updated} actualizados`, {
      added, updated, total: entries.length
    });

    Notifications.add(
      `Catálogo Ghost: ${added} nuevos, ${updated} actualizados`,
      'success',
      { section: 'coffees' }
    );

    return { added, updated };
  },

  renderCongruenceReport(analysis, container) {
    const { summary, issues, byCoffee } = analysis;

    container.innerHTML = `
      <div class="cost-breakdown" style="margin-top:16px;border-color:${issues.length ? 'var(--warning)' : 'var(--success)'}">
        <h4 style="margin-bottom:8px">Análisis de Congruencia — Catálogo Ghost</h4>
        <p style="font-size:0.9rem;margin-bottom:12px">
          ${summary.total} cafés · ${summary.newCoffees} nuevos ·
          <strong style="color:var(--danger)">${summary.high} alertas altas</strong> ·
          <strong style="color:var(--warning)">${summary.medium} medias</strong> ·
          ${summary.low} bajas
        </p>
        ${summary.duplicateCodes.length ? `
          <p style="font-size:0.85rem;color:var(--danger);margin-bottom:8px">
            ⚠ Códigos duplicados en PDFs: ${summary.duplicateCodes.join(', ')}
          </p>
        ` : ''}
        ${issues.length ? `
          <div style="max-height:220px;overflow-y:auto;margin-bottom:12px">
            ${issues.map((i) => `
              <p style="font-size:0.85rem;color:${i.severity === 'alta' ? 'var(--danger)' : i.severity === 'media' ? 'var(--warning)' : 'var(--text-muted)'};margin:4px 0">
                ${i.severity === 'alta' ? '🔴' : i.severity === 'media' ? '🟡' : '⚪'}
                <strong>${i.coffee}</strong>: ${i.message}
              </p>
            `).join('')}
          </div>
        ` : '<p style="color:var(--success)">✓ Sin incongruencias críticas</p>'}
        <details style="margin-top:8px">
          <summary style="cursor:pointer;font-size:0.85rem;color:var(--text-secondary)">Detalle por café (${byCoffee.length})</summary>
          <div class="table-container" style="max-height:180px;overflow-y:auto;margin-top:8px">
            <table>
              <thead><tr><th>Café</th><th>Código</th><th>Precio/kg</th><th>Costo BCA 500g</th><th>Alertas</th></tr></thead>
              <tbody>
                ${byCoffee.map(({ entry, issues: ci, bcaCost500 }) => `
                  <tr>
                    <td>${entry.name}</td>
                    <td>${entry.ghostCode}</td>
                    <td>${formatCurrency(entry.priceEfectivo || entry.priceVerde)}</td>
                    <td>${formatCurrency(bcaCost500)}</td>
                    <td>${ci.length || '✓'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    `;
  }
};
