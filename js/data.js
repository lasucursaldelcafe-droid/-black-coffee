/**
 * Black Coffee Administration — capa de datos (localStorage)
 */
const BCA_STORAGE_KEY = "bca_platform_v1";

const DEFAULT_USERS = [
  {
    id: "usr_ximena",
    name: "Ximena Polo",
    username: "ximena.polo",
    password: "Ximena#BCA26",
    role: "admin",
    email: "ximena@blackcoffee.admin",
  },
  {
    id: "usr_pablo",
    name: "Pablo Colorado Gómez",
    username: "pablo.colorado",
    password: "Pablo#BCA26",
    role: "admin",
    email: "pablo@blackcoffee.admin",
  },
];

const DEFAULT_PRODUCTION_COSTS = {
  tostionPerKg: 3700,
  seleccionPerKg: 1900,
  empaque: {
    bag250: 1500,
    bag500: 1900,
    bag5lb: 3000,
  },
  etiquetas: {
    grande: 1000,
    pequena: 500,
  },
  alza: {
    enabled: true,
    value: 1500,
  },
  transporteDefault: 0,
  updatedAt: null,
};

/** Mermas configurables (%). Verde: tostión + selección. Pergamino: trilla + tostión + selección. */
const DEFAULT_MERMAS = {
  trilla: 18,
  tostion: 16,
  seleccion: 3,
};

const COLOMBIA_ZONES = [
  "Cauca",
  "Huila",
  "Nariño",
  "Tolima",
  "Antioquia",
  "Caldas",
  "Risaralda",
  "Quindío",
  "Valle del Cauca",
  "Santander",
  "Sierra Nevada",
  "Cundinamarca",
  "Boyacá",
  "Meta",
  "Otra",
];

const PROCESS_TYPES = [
  "Lavado",
  "Natural",
  "Honey",
  "Anaeróbico",
  "Lavado fermentación extendida",
  "Experimental",
];

const VARIETIES = [
  "Caturra",
  "Castillo",
  "Colombia",
  "Bourbon",
  "Typica",
  "Geisha",
  "Pink Bourbon",
  "Yellow Bourbon",
  "SL28",
  "Pacamara",
  "Tabi",
  "Cenicafé 1",
  "Otra",
];

const COFFEE_FORMS = [
  { id: "verde", label: "Café verde (oro)", mermas: ["tostion", "seleccion"] },
  { id: "pergamino", label: "Café pergamino", mermas: ["trilla", "tostion", "seleccion"] },
  { id: "tostado", label: "Café tostado", mermas: [] },
];

const MARGIN_OPTIONS = [25, 35, 40, 50];
const CLIENT_TYPES = [
  { id: "final", label: "Cliente final" },
  { id: "mayorista", label: "Cliente al por mayor" },
];

const PACK_FORMATS = [
  {
    id: "250g",
    label: "Bolsa 250 g",
    grams: 250,
    empaqueKey: "bag250",
    etiqueta: "pequena",
  },
  {
    id: "500g",
    label: "Bolsa 500 g",
    grams: 500,
    empaqueKey: "bag500",
    etiqueta: "pequena",
  },
  {
    id: "5lb",
    label: "Bolsa 5 lb (2.27 kg)",
    grams: 2268,
    empaqueKey: "bag5lb",
    etiqueta: "grande",
  },
];

const NOTIFY_EMAIL = "ghostspecialtycoffee@gmail.com";

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function seedState() {
  const now = new Date().toISOString();
  const coffeeId = "caf_oscar_alejandro";
  const clientId = "cli_chocolatada";
  const supplierId = "prv_oscar";

  return {
    version: 1,
    session: null,
    branding: {
      logoDataUrl: null,
      brandName: "Black Coffee Administration",
      accent: "#c8c8c8",
      density: "comfortable",
      heroTagline: "Distribución, producción y cotización de café especial",
    },
    productionCosts: { ...DEFAULT_PRODUCTION_COSTS, updatedAt: now },
    mermas: { ...DEFAULT_MERMAS },
    costPromptDismissedAt: null,
    catalogs: {
      zones: [...COLOMBIA_ZONES],
      processes: [...PROCESS_TYPES],
      varieties: [...VARIETIES],
      forms: COFFEE_FORMS,
      margins: MARGIN_OPTIONS,
      clientTypes: CLIENT_TYPES,
      packFormats: PACK_FORMATS,
    },
    suppliers: [
      {
        id: supplierId,
        name: "Óscar Alejandro",
        type: "caficultor",
        zone: "Cauca",
        phone: "",
        email: "",
        notes: "Café lavado 24h fermentación — Cauca",
        createdAt: now,
      },
    ],
    coffees: [
      {
        id: coffeeId,
        name: "Óscar Alejandro — Lavado 24h",
        producer: "Óscar Alejandro",
        supplierId,
        zone: "Cauca",
        variety: "Colombia",
        process: "Lavado fermentación extendida",
        processDetail: "24 horas de fermentación",
        form: "verde",
        pricePerKg: 33000,
        transportIncluded: true,
        transportCostPerKg: 0,
        score: null,
        harvest: "2025/2026",
        imageDataUrl: null,
        stockKg: 100,
        stockAlertKg: 20,
        notes: "Transporte incluido en el precio de compra",
        active: true,
        createdAt: now,
      },
    ],
    clients: [
      {
        id: clientId,
        name: "La Chocolatada",
        type: "final",
        city: "Cali",
        department: "Valle del Cauca",
        contact: "",
        phone: "",
        email: "",
        notes: "Panadería — cliente piloto",
        createdAt: now,
      },
    ],
    quotes: [],
    purchases: [
      {
        id: "com_seed_oscar",
        coffeeId,
        supplierId,
        date: now.slice(0, 10),
        form: "verde",
        kg: 100,
        pricePerKg: 33000,
        transportIncluded: true,
        transportCostPerKg: 0,
        total: 3300000,
        notes: "Compra inicial semilla — 100 kg verde",
        createdAt: now,
      },
    ],
    sales: [],
    inventoryLots: [
      {
        id: "lot_seed_oscar",
        coffeeId,
        form: "verde",
        kgAvailable: 100,
        kgOriginal: 100,
        purchaseId: "com_seed_oscar",
        createdAt: now,
      },
    ],
    notifications: [
      {
        id: createId("ntf"),
        type: "system",
        title: "Plataforma lista",
        message:
          "Black Coffee Administration inicializada con café Óscar Alejandro y cliente La Chocolatada.",
        emailTarget: NOTIFY_EMAIL,
        read: false,
        createdAt: now,
      },
    ],
    meta: {
      createdAt: now,
      lastLoginAt: null,
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(BCA_STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    return JSON.parse(raw);
  } catch {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }
}

function saveState(state) {
  localStorage.setItem(BCA_STORAGE_KEY, JSON.stringify(state));
}

function resetPlatform() {
  localStorage.removeItem(BCA_STORAGE_KEY);
  return loadState();
}

window.BCA = {
  STORAGE_KEY: BCA_STORAGE_KEY,
  USERS: DEFAULT_USERS,
  NOTIFY_EMAIL,
  DEFAULT_PRODUCTION_COSTS,
  DEFAULT_MERMAS,
  PACK_FORMATS,
  MARGIN_OPTIONS,
  CLIENT_TYPES,
  createId,
  seedState,
  loadState,
  saveState,
  resetPlatform,
};
