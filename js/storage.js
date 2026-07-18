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
  COSTS_CHECKED: 'bca_costs_checked_date'
};

const Storage = {
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
};

const DEFAULT_PRODUCTION_COSTS = {
  roasting: 3700,
  selection: 1900,
  packaging: {
    '250g': 1500,
    '500g': 1900,
    '5lb': 3000
  },
  labels: {
    large: 1000,
    small: 500
  },
  costIncrease: {
    enabled: false,
    amount: 1500
  },
  mermas: {
    trilla: 20,
    tostion: 16,
    seleccion: 3
  },
  lastUpdated: new Date().toISOString()
};

const DEFAULT_SETTINGS = {
  companyName: 'Black Coffee Administration',
  tagline: 'Gestión integral de café de especialidad',
  email: 'ghostspecialtycoffee@gmail.com',
  logo: null,
  heroTitle: 'Bienvenido a Black Coffee Administration',
  heroSubtitle: 'Plataforma integral para la gestión de producción, cotizaciones e inventario de café de especialidad.',
  primaryColor: '#f5f5f5',
  accentColor: '#e5e5e5',
  lowStockThreshold: 10
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

const PROFIT_MARGINS = [25, 35, 40, 50];

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

const COFFEE_STATES = {
  verde: { label: 'Café Verde', mermas: ['tostion', 'seleccion'] },
  pergamino: { label: 'Café Pergamino', mermas: ['trilla', 'tostion', 'seleccion'] }
};

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
