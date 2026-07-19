const LOCAL_SYNC_META_KEY = 'bca_local_sync_meta';
const DEVICE_ID_KEY = 'bca_device_id';
const DELETED_RECORDS_KEY = 'bca_deleted_records';
const DISMISSED_SUPPLIER_SERVICES_KEY = 'bca_dismissed_supplier_services';

const STORAGE_KEYS = {
  USERS: 'bca_users',
  SESSION: 'bca_session',
  PRODUCTION_COSTS: 'bca_production_costs',
  COFFEES: 'bca_coffees',
  CLIENTS: 'bca_clients',
  SUPPLIERS: 'bca_suppliers',
  INVENTORY: 'bca_inventory',
  QUOTATIONS: 'bca_quotations',
  PURCHASES: 'bca_purchases',
  SALES: 'bca_sales',
  NOTIFICATIONS: 'bca_notifications',
  SETTINGS: 'bca_settings',
  COSTS_CHECKED: 'bca_costs_checked_date',
  AUDIT_LOG: 'bca_audit_log',
  PRODUCTION_BATCHES: 'bca_production_batches',
  COST_SCENARIOS: 'bca_cost_scenarios',
  PROCESS_TEMPLATES: 'bca_process_templates',
  DELETED_RECORDS: DELETED_RECORDS_KEY,
  DISMISSED_SUPPLIER_SERVICES: DISMISSED_SUPPLIER_SERVICES_KEY
};

const TOMBSTONE_LIST_KEYS = new Set([
  STORAGE_KEYS.COFFEES,
  STORAGE_KEYS.CLIENTS,
  STORAGE_KEYS.SUPPLIERS,
  STORAGE_KEYS.QUOTATIONS,
  STORAGE_KEYS.SALES,
  STORAGE_KEYS.INVENTORY,
  STORAGE_KEYS.PURCHASES,
  STORAGE_KEYS.PRODUCTION_BATCHES,
  STORAGE_KEYS.NOTIFICATIONS
]);

const Storage = {
  getRaw(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getDeletedIds(key) {
    const tomb = this.getRaw(DELETED_RECORDS_KEY) || {};
    return new Set(tomb[key] || []);
  },

  recordDeletion(key, id) {
    if (!id) return;

    const tomb = this.getRaw(DELETED_RECORDS_KEY) || {};
    if (!tomb[key]) tomb[key] = [];
    if (tomb[key].includes(id)) return;

    tomb[key] = [...tomb[key], id].slice(-500);
    localStorage.setItem(DELETED_RECORDS_KEY, JSON.stringify(tomb));
    this.markLocalWrite(DELETED_RECORDS_KEY);

    if (typeof FirebaseSync !== 'undefined') {
      FirebaseSync.queuePush(DELETED_RECORDS_KEY, tomb);
      if (FirebaseSync.isEnabled()) {
        FirebaseSync.pushKeyNow(DELETED_RECORDS_KEY).catch(() => {});
      }
    }
  },

  filterDeleted(key, items) {
    if (!Array.isArray(items)) return items;
    const deleted = this.getDeletedIds(key);
    if (deleted.size === 0) return items;
    return items.filter((item) => !item?.id || !deleted.has(item.id));
  },

  dismissSupplierService(serviceKey) {
    if (!serviceKey) return;
    const list = this.getRaw(DISMISSED_SUPPLIER_SERVICES_KEY) || [];
    if (list.includes(serviceKey)) return;
    const next = [...list, serviceKey];
    this.set(DISMISSED_SUPPLIER_SERVICES_KEY, next, { immediate: true });
  },

  isSupplierServiceDismissed(serviceKey) {
    return (this.getRaw(DISMISSED_SUPPLIER_SERVICES_KEY) || []).includes(serviceKey);
  },

  deleteFromList(key, id, options = {}) {
    this.recordDeletion(key, id);

    (options.dismissSupplierServices || []).forEach((serviceKey) => {
      this.dismissSupplierService(serviceKey);
    });

    const items = (this.getRaw(key) || []).filter((item) => item.id !== id);
    this.set(key, items, { immediate: true });
    return items;
  },

  compactDeleted(key) {
    const raw = this.getRaw(key);
    if (!Array.isArray(raw)) return;
    const filtered = this.filterDeleted(key, raw);
    if (filtered.length === raw.length) return;
    localStorage.setItem(key, JSON.stringify(filtered));
    this.markLocalWrite(key);
  },

  purgeDeletedFromStorage() {
    TOMBSTONE_LIST_KEYS.forEach((key) => this.compactDeleted(key));
  },

  get(key) {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (TOMBSTONE_LIST_KEYS.has(key) && Array.isArray(parsed)) {
        return this.filterDeleted(key, parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  },

  getLocalSyncMeta() {
    try {
      const data = localStorage.getItem(LOCAL_SYNC_META_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  },

  markLocalWrite(key) {
    const meta = this.getLocalSyncMeta();
    meta[key] = Date.now();
    localStorage.setItem(LOCAL_SYNC_META_KEY, JSON.stringify(meta));
  },

  setRemote(key, value) {
    let next = value;
    if (TOMBSTONE_LIST_KEYS.has(key) && Array.isArray(value)) {
      next = this.filterDeleted(key, value);
    }
    localStorage.setItem(key, JSON.stringify(next));
  },

  set(key, value, options = {}) {
    let next = value;
    if (TOMBSTONE_LIST_KEYS.has(key) && Array.isArray(value)) {
      next = this.filterDeleted(key, value);
    }

    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (error) {
      console.error(`No se pudo guardar ${key}:`, error);
      throw new Error('No hay espacio suficiente para guardar los datos en este navegador.');
    }

    if (options.fromRemote) return;

    this.markLocalWrite(key);
    if (typeof FirebaseSync !== 'undefined') {
      if (options.immediate) {
        FirebaseSync.queuePush(key, next);
        if (FirebaseSync.isEnabled()) {
          FirebaseSync.pushKeyNow(key).catch((error) => {
            console.warn(`Sync inmediato fallo para ${key}:`, error.message);
          });
        }
      } else {
        FirebaseSync.queuePush(key, next);
      }
    }
  },

  remove(key) {
    localStorage.removeItem(key);
    this.markLocalWrite(key);
    if (typeof FirebaseSync !== 'undefined') {
      FirebaseSync.queueDelete(key);
    }
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
};

const DEFAULT_PRODUCTION_COSTS = {
  transformation: {
    trilla: 0,
    greenSelection: 0,
    roasting: 0,
    selection: 0,
    grinding: 0,
    packagingLabor: {
      '250g': 0,
      '500g': 0,
      '5lb': 0
    }
  },
  administrative: {
    negotiation: 0
  },
  packaging: {
    '250g': 0,
    '500g': 0,
    '5lb': 0
  },
  labels: {
    large: 0,
    small: 0
  },
  costIncrease: {
    enabled: false,
    amount: 0
  },
  mermas: {
    trilla: 0,
    greenSelection: 0,
    tostion: 0,
    seleccion: 0
  },
  defaultSuppliers: {
    compra: null,
    transporte: null,
    trilla: null,
    greenSelection: null,
    tostion: null,
    seleccion: null,
    molienda: null,
    empacada: null
  },
  lastUpdated: new Date().toISOString()
};

const PRODUCTION_MODES = {
  full_pack: {
    label: 'Producción Full Pack',
    description: 'Café, logística, transformación completa y empaque con materiales'
  },
  maquila: {
    label: 'Maquila',
    description: 'Transformación y empacada. El cliente aporta empaque; solo se cobra mano de obra'
  }
};

const TRANSFORMATION_STEPS = {
  trilla: { label: 'Trilla', group: 'transformacion', mermaKey: 'trilla', costKey: 'trilla', perUnit: 'kg' },
  greenSelection: { label: 'Selección en Verde', group: 'transformacion', mermaKey: 'greenSelection', costKey: 'greenSelection', perUnit: 'kg' },
  tostion: { label: 'Tostión', group: 'transformacion', mermaKey: 'tostion', costKey: 'roasting', perUnit: 'kg' },
  seleccion: { label: 'Selección Post-Tostión', group: 'transformacion', mermaKey: 'seleccion', costKey: 'selection', perUnit: 'kg' },
  molienda: { label: 'Molienda', group: 'transformacion', costKey: 'grinding', perUnit: 'lb' },
  empacada: { label: 'Empacada (mano de obra)', group: 'transformacion', costKey: 'packagingLabor', perUnit: 'unit' }
};

const ADMINISTRATIVE_STEPS = {
  negociacion: { label: 'Negociación', costKey: 'negotiation' },
  compra: { label: 'Compra de Café', dynamic: 'coffee' },
  transporte: { label: 'Transporte', dynamic: 'transport' }
};

const GRIND_TYPES = {
  grano: { label: 'En Grano', requiresMolienda: false },
  molido: { label: 'Molido', requiresMolienda: true }
};

const SUPPLIER_CATEGORIES = {
  coffee: {
    label: 'Proveedor de Café',
    shortLabel: 'Café',
    description: 'Caficultores, cooperativas y compradores de café verde'
  },
  operational: {
    label: 'Proveedor de Transformación',
    shortLabel: 'Transformación',
    description: 'Trilladora, selección, tostión, molienda y empacado'
  },
  logistics: {
    label: 'Proveedor Logístico',
    shortLabel: 'Logística',
    description: 'Transporte, flete y distribución'
  }
};

const SUPPLIER_SERVICES = {
  trilla: { label: 'Trilladora', category: 'operational', unit: 'por kg' },
  greenSelection: { label: 'Selección en Verde', category: 'operational', unit: 'por kg' },
  tostion: { label: 'Tostador', category: 'operational', unit: 'por kg' },
  seleccion: { label: 'Selección Post-Tostión', category: 'operational', unit: 'por kg' },
  molienda: { label: 'Molienda', category: 'operational', unit: 'por libra' },
  empacada: { label: 'Empacadora', category: 'operational', unit: 'por unidad' },
  transporte: { label: 'Transporte / Flete', category: 'logistics', unit: 'por kg' }
};

const COFFEE_SUPPLIER_TYPES = ['Caficultor', 'Cooperativa', 'Exportador', 'Beneficio', 'Otro'];

const OPERATIONAL_SUPPLIER_TYPES = [
  'Trilladora',
  'Seleccionadora',
  'Tostador',
  'Molino',
  'Empacadora',
  'Beneficio',
  'Otro'
];

const PROCESS_SUPPLIER_KEYS = [
  'compra', 'transporte', 'trilla', 'greenSelection', 'tostion', 'seleccion', 'molienda', 'empacada'
];

function getProcessSupplierLabel(key) {
  if (key === 'compra') return 'Proveedor de Café';
  if (key === 'transporte') return SUPPLIER_SERVICES.transporte.label;
  return TRANSFORMATION_STEPS[key]?.label || SUPPLIER_SERVICES[key]?.label || key;
}

function getGlobalServiceRate(costs, serviceKey, packagingSize = '250g') {
  if (serviceKey === 'empacada') {
    return costs.transformation.packagingLabor[packagingSize] || 0;
  }
  if (serviceKey === 'molienda') {
    return costs.transformation.grinding || 0;
  }
  if (serviceKey === 'transporte') {
    return 0;
  }
  const step = TRANSFORMATION_STEPS[serviceKey];
  if (step?.costKey) {
    return costs.transformation[step.costKey] || 0;
  }
  return 0;
}

function getServiceRateUnitLabel(serviceKey) {
  return SUPPLIER_SERVICES[serviceKey]?.unit || 'por kg';
}

function getFullPackSteps(coffeeState) {
  if (coffeeState === 'tostado') {
    return ['seleccion', 'empacada'];
  }
  const steps = ['greenSelection', 'tostion', 'seleccion', 'empacada'];
  if (coffeeState === 'pergamino') steps.unshift('trilla');
  return steps;
}

const TRANSFORMATION_PIPELINE_ORDER = [
  'trilla',
  'greenSelection',
  'tostion',
  'seleccion',
  'molienda',
  'empacada'
];

function getTransformationServiceKeys() {
  return TRANSFORMATION_PIPELINE_ORDER.filter((key) => SUPPLIER_SERVICES[key]?.category === 'operational');
}

function migrateProductionCosts(stored) {
  if (!stored) return { ...DEFAULT_PRODUCTION_COSTS };
  if (stored.transformation) {
    return {
      ...DEFAULT_PRODUCTION_COSTS,
      ...stored,
      transformation: { ...DEFAULT_PRODUCTION_COSTS.transformation, ...stored.transformation },
      administrative: { ...DEFAULT_PRODUCTION_COSTS.administrative, ...stored.administrative },
      packaging: { ...DEFAULT_PRODUCTION_COSTS.packaging, ...stored.packaging },
      labels: { ...DEFAULT_PRODUCTION_COSTS.labels, ...stored.labels },
      mermas: { ...DEFAULT_PRODUCTION_COSTS.mermas, ...stored.mermas },
      defaultSuppliers: {
        ...DEFAULT_PRODUCTION_COSTS.defaultSuppliers,
        ...(stored.defaultSuppliers || {})
      }
    };
  }
  return {
    ...DEFAULT_PRODUCTION_COSTS,
    transformation: {
      ...DEFAULT_PRODUCTION_COSTS.transformation,
      roasting: stored.roasting ?? DEFAULT_PRODUCTION_COSTS.transformation.roasting,
      selection: stored.selection ?? DEFAULT_PRODUCTION_COSTS.transformation.selection
    },
    packaging: stored.packaging || DEFAULT_PRODUCTION_COSTS.packaging,
    labels: stored.labels || DEFAULT_PRODUCTION_COSTS.labels,
    costIncrease: stored.costIncrease || DEFAULT_PRODUCTION_COSTS.costIncrease,
    mermas: stored.mermas || DEFAULT_PRODUCTION_COSTS.mermas,
    defaultSuppliers: stored.defaultSuppliers || DEFAULT_PRODUCTION_COSTS.defaultSuppliers
  };
}

const DEFAULT_SETTINGS = {
  companyName: 'Black Coffee Administration',
  tagline: 'Gestión integral de café de especialidad',
  email: 'ghostspecialtycoffee@gmail.com',
  logo: null,
  heroTitle: 'Bienvenido a Black Coffee Administration',
  heroSubtitle: 'Plataforma integral para la gestión de producción, cotizaciones e inventario de café de especialidad.',
  primaryColor: '#f5f5f5',
  accentColor: '#e5e5e5',
  lowStockThreshold: 0,
  syncPullEnabled: false
};

const COFFEE_VARIETIES = [
  'Caturra', 'Castillo', 'Colombia', 'Típica', 'Borbón', 'Geisha',
  'SL28', 'SL34', 'Pacamara', 'Maragogipe', 'Tabi', 'Variedad Colombia'
];

const COFFEE_PROCESSES = [
  'Lavado', 'Natural', 'Honey', 'Semi-lavado', 'Anaeróbico',
  'Lavado fermentado', 'Double fermentation', 'Thermal shock'
];

const COLOMBIAN_REGIONS = [
  'Huila', 'Nariño', 'Cauca', 'Tolima', 'Antioquia', 'Caldas',
  'Risaralda', 'Quindío', 'Santander', 'Cundinamarca', 'Boyacá',
  'Sierra Nevada', 'Valle del Cauca', 'Magdalena', 'Casanare'
];

const PROFIT_MARGIN_MIN = 1;
const PROFIT_MARGIN_MAX = 100;
const PROFIT_MARGIN_DEFAULT = 35;
const PROFIT_MARGIN_QUICK = [10, 25, 35, 40, 50, 75, 100];
/** @deprecated Use PROFIT_MARGIN_QUICK — mantiene compatibilidad */
const PROFIT_MARGINS = PROFIT_MARGIN_QUICK;

function clampProfitMargin(value, fallback = PROFIT_MARGIN_DEFAULT) {
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(PROFIT_MARGIN_MAX, Math.max(PROFIT_MARGIN_MIN, parsed));
}

/** Margen sobre costo (markup): precio = costo × (1 + markup/100) */
function priceFromMarkupOnCost(unitCost, markupPct) {
  if (!unitCost || unitCost <= 0) return 0;
  const markup = clampProfitMargin(markupPct, 0);
  return Math.ceil(unitCost * (1 + markup / 100) / 100) * 100;
}

function markupFromTargetPrice(unitCost, targetPrice) {
  if (!unitCost || unitCost <= 0 || !targetPrice || targetPrice <= 0) return PROFIT_MARGIN_DEFAULT;
  const raw = ((targetPrice / unitCost) - 1) * 100;
  return clampProfitMargin(Math.round(raw));
}

function profitAmountFromMarkup(unitCost, markupPct) {
  const price = priceFromMarkupOnCost(unitCost, markupPct);
  return Math.max(0, price - unitCost);
}

function markupFromProfitAmount(unitCost, profitAmount) {
  if (!unitCost || unitCost <= 0) return PROFIT_MARGIN_DEFAULT;
  const targetPrice = unitCost + Math.max(0, profitAmount);
  return markupFromTargetPrice(unitCost, targetPrice);
}

/** Porcentaje de ganancia sobre el precio de venta (margen comercial) */
function marginOnRevenueFromMarkup(markupPct) {
  const markup = clampProfitMargin(markupPct, 0);
  if (markup <= 0) return 0;
  return Math.round((markup / (100 + markup)) * 1000) / 10;
}

const CLIENT_TYPES = {
  final: { label: 'Cliente Final', multiplier: 1.0 },
  mayorista: { label: 'Cliente Mayorista', multiplier: 0.85 },
  distribuidor: { label: 'Distribuidor', multiplier: 0.75 }
};

const PACKAGING_SIZES = {
  '250g': { label: '250 gramos', grams: 250 },
  '500g': { label: '500 gramos', grams: 500 },
  '5lb': { label: '5 libras', grams: 2268 }
};

function normalizePackagingMix(mix) {
  if (!mix || typeof mix !== 'object') return {};
  const normalized = {};
  Object.entries(mix).forEach(([size, qty]) => {
    const amount = Math.max(0, parseInt(String(qty), 10) || 0);
    if (amount > 0 && PACKAGING_SIZES[size]) {
      normalized[size] = amount;
    }
  });
  return normalized;
}

function getPackagingMixTotal(mix) {
  return Object.values(normalizePackagingMix(mix)).reduce((sum, qty) => sum + qty, 0);
}

function formatPackagingMix(mix, fallbackPackaging = null, fallbackQty = null) {
  const normalized = normalizePackagingMix(mix);
  const entries = Object.entries(normalized);
  if (entries.length > 0) {
    return entries.map(([size, qty]) => `${qty} × ${PACKAGING_SIZES[size]?.label || size}`).join(' · ');
  }
  if (fallbackPackaging) {
    const label = PACKAGING_SIZES[fallbackPackaging]?.label || fallbackPackaging;
    return fallbackQty ? `${fallbackQty} × ${label}` : label;
  }
  return '—';
}

function getQuotationLineItems(quotation) {
  if (Array.isArray(quotation.packagingLines) && quotation.packagingLines.length > 0) {
    return quotation.packagingLines.map((line) => ({
      packaging: line.packaging,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.linePrice ?? line.unitPrice * line.quantity
    }));
  }
  return [{
    packaging: quotation.packaging,
    quantity: quotation.quantity || 1,
    unitPrice: quotation.unitPrice,
    lineTotal: quotation.totalPrice
  }];
}

const COFFEE_STATES = {
  verde: { label: 'Café Verde', mermas: ['greenSelection', 'tostion', 'seleccion'] },
  pergamino: { label: 'Café Pergamino', mermas: ['trilla', 'greenSelection', 'tostion', 'seleccion'] },
  tostado: {
    label: 'Café Tostado',
    description: 'Ya transformado — las entradas van directo al inventario tostado',
    mermas: ['seleccion']
  }
};

function isRoastedCoffeeState(state) {
  return state === 'tostado';
}

function isGreenCoffeeState(state) {
  return state === 'verde' || state === 'pergamino';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(date));
}

function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

const LABEL_NAMES = {
  small: 'Pequeña',
  large: 'Grande'
};

function formatLabelSelection(labels) {
  const list = Array.isArray(labels) ? labels : (labels ? [labels] : []);
  if (list.length === 0) return 'Sin etiqueta';
  return list.map((label) => LABEL_NAMES[label] || label).join(' + ');
}

function parseLabelSelection(value) {
  if (!value) return ['small'];
  if (Array.isArray(value)) return value.length > 0 ? value : ['small'];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['small'];
  } catch {
    return value ? [value] : ['small'];
  }
}

function calculateLabelCost(labels, costs) {
  const list = parseLabelSelection(labels);
  return list.reduce((sum, size) => sum + (costs.labels[size] || 0), 0);
}
