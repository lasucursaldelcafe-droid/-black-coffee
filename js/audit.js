const AUDIT_ACTIONS = {
  purchase: 'Compra',
  roast: 'Tostión',
  production_batch: 'Lote de producción',
  adjust: 'Ajuste manual',
  delete_coffee: 'Eliminación de café',
  delete_quotation: 'Eliminación de cotización',
  delete_supplier: 'Eliminación de proveedor',
  update_inventory: 'Actualización de inventario',
  sale: 'Venta registrada',
  delete_sale: 'Eliminación de venta'
};

const AuditLog = {
  getAll() {
    return Storage.get(STORAGE_KEYS.AUDIT_LOG) || [];
  },

  log(action, entity, details = {}) {
    const session = Auth.getSession();
    const entry = {
      id: Storage.generateId(),
      action,
      actionLabel: AUDIT_ACTIONS[action] || action,
      entity,
      details,
      userId: session?.userId || 'unknown',
      userName: session?.name || 'Usuario desconocido',
      createdAt: new Date().toISOString()
    };

    const log = this.getAll();
    log.unshift(entry);
    if (log.length > 200) log.length = 200;
    Storage.set(STORAGE_KEYS.AUDIT_LOG, log);
    return entry;
  },

  getByEntity(entity) {
    return this.getAll().filter((e) => e.entity === entity);
  },

  renderLog(container, options = {}) {
    const { entity = null, limit = 50 } = options;
    let entries = this.getAll();
    if (entity) entries = entries.filter((e) => e.entity === entity);
    entries = entries.slice(0, limit);

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px">
          <p style="color:var(--text-muted)">No hay movimientos registrados</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="audit-log">
        ${entries.map((e) => `
          <div class="audit-entry">
            <div class="audit-entry-icon">${this.getActionIcon(e.action)}</div>
            <div class="audit-entry-body">
              <div class="audit-entry-title">${e.actionLabel}</div>
              <div class="audit-entry-detail">${this.formatDetails(e)}</div>
              <div class="audit-entry-meta">
                <span class="audit-user">${e.userName}</span>
                <span class="audit-date">${formatDateTime(e.createdAt)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
  },

  getActionIcon(action) {
    const icons = {
      purchase: '📥',
      roast: '🔥',
      production_batch: '⚙️',
      adjust: '✏️',
      delete_coffee: '🗑️',
      delete_quotation: '🗑️',
      delete_supplier: '🗑️',
      update_inventory: '📦',
      sale: '💰',
      delete_sale: '🗑️'
    };
    return icons[action] || '📝';
  },

  formatDetails(entry) {
    const d = entry.details || {};
    switch (entry.action) {
      case 'purchase':
        return `${d.coffeeName || entry.entity}: +${formatNumber(d.kg)} kg verde${d.costPerKg ? ` · ${formatCurrency(d.costPerKg)}/kg` : ''}${d.supplierName ? ` · ${d.supplierName}` : ''}`;
      case 'roast':
        return `${d.coffeeName || entry.entity}: ${formatNumber(d.greenKg)} kg verde → ${formatNumber(d.roastedKg)} kg tostado${d.supplierName ? ` · ${d.supplierName}` : ''}`;
      case 'production_batch':
        return `${d.coffeeName || entry.entity}: ${d.steps?.map((s) => `${s.label}: ${s.supplierName || '—'}`).join(' · ') || 'Lote registrado'}`;
      case 'adjust':
        return `${d.coffeeName || entry.entity}: ${d.field} ${d.previousValue} → ${d.newValue} kg${d.reason ? ` · ${d.reason}` : ''}`;
      case 'delete_coffee':
        return `Café eliminado: ${d.coffeeName || entry.entity}`;
      case 'delete_quotation':
        return `Cotización eliminada: ${d.number || entry.entity}`;
      case 'delete_supplier':
        return `Proveedor eliminado: ${d.name || entry.entity}`;
      case 'sale':
        return `${d.coffeeName || entry.entity}: ${d.quantity} × ${d.packaging || ''} · ${formatCurrency(d.totalRevenue || 0)} · Margen ${formatNumber(d.profitMargin || 0, 1)}% · Vendió: ${d.soldBy || entry.userName}`;
      case 'delete_sale':
        return `Venta eliminada: ${d.coffeeName || entry.entity} (${d.quantity} uds)`;
      default:
        return d.message || entry.entity || '';
    }
  }
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
