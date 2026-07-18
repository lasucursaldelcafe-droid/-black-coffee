/**
 * Black Coffee Administration — defaults & seed data
 */
const BCA = window.BCA || {};

BCA.NOTIFY_EMAIL = "ghostspecialtycoffee@gmail.com";
BCA.STORAGE_KEY = "bca_platform_v1";

BCA.USERS = {
  ximena: {
    id: "ximena",
    name: "Ximena Polo",
    role: "Administración",
    password: "XimenaBCA2026!",
  },
  pablo: {
    id: "pablo",
    name: "Pablo Colorado Gómez",
    role: "Operaciones",
    password: "PabloBCA2026!",
  },
};

BCA.ZONES = [
  "Cauca",
  "Huila",
  "Nariño",
  "Tolima",
  "Antioquia",
  "Caldas",
  "Risaralda",
  "Quindío",
  "Valle del Cauca",
  "Sierra Nevada",
  "Santander",
  "Boyacá",
];

BCA.PROCESSES = [
  "Lavado",
  "Natural",
  "Honey",
  "Anaeróbico",
  "Fermentación controlada",
  "Experimental",
];

BCA.FORMS = [
  { id: "verde", label: "Café verde (almendra)" },
  { id: "pergamino", label: "Pergamino" },
  { id: "tostado", label: "Café tostado" },
];

BCA.MARGINS = [25, 35, 40, 50];

BCA.CLIENT_TYPES = [
  { id: "final", label: "Cliente final" },
  { id: "mayorista", label: "Cliente al por mayor" },
];

BCA.PACKAGES = [
  { id: "250g", label: "Bolsa 250 g", grams: 250, cost: 1500 },
  { id: "500g", label: "Bolsa 500 g", grams: 500, cost: 1900 },
  { id: "5lb", label: "Bolsa 5 lb", grams: 2268, cost: 3000 },
];

BCA.DEFAULT_COSTS = {
  roastingPerKg: 3700,
  selectionPerKg: 1900,
  packaging: {
    "250g": 1500,
    "500g": 1900,
    "5lb": 3000,
  },
  labelLarge: 1000,
  labelSmall: 500,
  alza: 1500,
  alzaActive: true,
  merma: {
    trilla: 18,
    tostion: 16,
    seleccion: 3,
  },
  lowStockKg: 15,
};

BCA.DEFAULT_BRANDING = {
  logoDataUrl: "",
  accent: "#111111",
  background: "#f3f3f1",
  heroUrl:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=80",
  companyName: "Black Coffee",
  tagline: "Specialty coffee · distribución & producción",
};

BCA.seedState = function seedState() {
  const coffeeId = "cafe-oscar-alejandro";
  const supplierId = "prov-oscar-alejandro";
  const clientId = "cli-chocolatada";

  return {
    version: 1,
    costs: structuredClone(BCA.DEFAULT_COSTS),
    branding: structuredClone(BCA.DEFAULT_BRANDING),
    costCheckDoneAt: null,
    session: null,
    suppliers: [
      {
        id: supplierId,
        name: "Óscar Alejandro",
        zone: "Cauca",
        contact: "Cauca · caficultor",
        notes: "Color y alabado · fermentación 24h",
        createdAt: Date.now(),
      },
    ],
    coffees: [
      {
        id: coffeeId,
        name: "Óscar Alejandro — Lavado 24h",
        farmer: "Óscar Alejandro",
        zone: "Cauca",
        process: "Lavado",
        fermentation: "24 horas",
        form: "verde",
        pricePerKg: 33000,
        transportIncluded: true,
        transportPerKg: 0,
        supplierId,
        notes: "Colombia lavado, 24 horas de fermentación. Transporte incluido en el precio.",
        imageDataUrl: "",
        active: true,
        createdAt: Date.now(),
      },
    ],
    clients: [
      {
        id: clientId,
        name: "La Chocolatada",
        type: "final",
        city: "Cali",
        contact: "",
        email: "",
        phone: "",
        notes: "Panadería — cliente piloto",
        createdAt: Date.now(),
      },
    ],
    inventory: [
      {
        id: "inv-oscar-1",
        coffeeId,
        form: "verde",
        kgPurchased: 100,
        kgAvailableGreen: 100,
        kgAvailableRoasted: 0,
        purchasedAt: Date.now(),
        unitCost: 33000,
        notes: "Compra inicial de ejemplo",
      },
    ],
    purchases: [
      {
        id: "pur-1",
        coffeeId,
        supplierId,
        kg: 100,
        form: "verde",
        unitPrice: 33000,
        transportIncluded: true,
        transportTotal: 0,
        total: 3300000,
        date: new Date().toISOString().slice(0, 10),
        notes: "Compra semilla — Óscar Alejandro",
      },
    ],
    sales: [],
    quotes: [],
    notifications: [
      {
        id: "n-welcome",
        type: "sistema",
        title: "Plataforma lista",
        body: "Black Coffee Administration inicializada con café Óscar Alejandro y cliente La Chocolatada.",
        email: BCA.NOTIFY_EMAIL,
        read: false,
        createdAt: Date.now(),
      },
    ],
  };
};

window.BCA = BCA;
