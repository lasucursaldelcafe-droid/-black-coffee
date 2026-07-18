/* Black Coffee Administration — default seed & catalogs */
window.BC = window.BC || {};

BC.USERS = {
  ximena: {
    id: "ximena",
    name: "Ximena Polo",
    role: "Administración",
    initials: "XP",
    password: "BlackCoffee2026!",
  },
  pablo: {
    id: "pablo",
    name: "Pablo Colorado Gómez",
    role: "Operaciones",
    initials: "PC",
    password: "GhostSpecialty26!",
  },
};

BC.NOTIFY_EMAIL = "ghostspecialtycoffee@gmail.com";

BC.CATALOGS = {
  zonas: [
    "Cauca",
    "Huila",
    "Nariño",
    "Antioquia",
    "Tolima",
    "Caldas",
    "Risaralda",
    "Quindío",
    "Santander",
    "Sierra Nevada",
    "Valle del Cauca",
    "Cundinamarca",
  ],
  procesos: [
    "Lavado",
    "Natural",
    "Honey",
    "Anaeróbico",
    "Fermentación controlada",
    "Lavado + fermentación 24h",
    "Lavado + fermentación 48h",
    "Lavado + fermentación 72h",
  ],
  variedades: [
    "Caturra",
    "Castillo",
    "Colombia",
    "Bourbon",
    "Geisha",
    "Typica",
    "Pink Bourbon",
    "Yellow Bourbon",
    "Pacamara",
    "Maragogipe",
    "SL28",
    "Ombligon",
  ],
  rangosPrecio: [
    { id: "r1", label: "$20.000 – $28.000 / kg", min: 20000, max: 28000 },
    { id: "r2", label: "$28.001 – $35.000 / kg", min: 28001, max: 35000 },
    { id: "r3", label: "$35.001 – $45.000 / kg", min: 35001, max: 45000 },
    { id: "r4", label: "$45.001 – $60.000 / kg", min: 45001, max: 60000 },
    { id: "r5", label: "$60.001+ / kg", min: 60001, max: 999999 },
  ],
  margenes: [25, 35, 40, 50],
  tiposCliente: [
    { id: "final", label: "Cliente final" },
    { id: "mayorista", label: "Cliente al por mayor" },
    { id: "distribuidor", label: "Distribuidor" },
  ],
  formatosEmpaque: [
    { id: "250g", label: "Bolsa 250 g", kg: 0.25 },
    { id: "500g", label: "Bolsa 500 g", kg: 0.5 },
    { id: "5lb", label: "Bolsa 5 lb (~2.27 kg)", kg: 2.26796 },
  ],
  estadosCafe: [
    { id: "verde", label: "Café verde (oro)" },
    { id: "pergamino", label: "Café en pergamino" },
    { id: "tostado", label: "Café tostado" },
  ],
};

BC.DEFAULT_COSTS = {
  tostionPorKg: 3700,
  seleccionPorKg: 1900,
  empaque: {
    "250g": 1500,
    "500g": 1900,
    "5lb": 3000,
  },
  etiquetaGrande: 1000,
  etiquetaPequena: 500,
  costoAlza: 1500,
  alzaActiva: true,
  mermas: {
    trilla: 18, // % pérdida pergamino → verde
    tostion: 16, // % pérdida verde → tostado
    seleccion: 6, // % pérdida post-tostión
  },
  umbralInventarioKg: 15,
  updatedAt: null,
};

BC.DEFAULT_APPEARANCE = {
  logoDataUrl: "",
  heroDataUrl: "",
  brandName: "Black Coffee",
  tagline: "Specialty · Distribución · Cotización",
  primaryBg: "#0a0a0a",
  accent: "#ffffff",
};

BC.DEFAULT_STATE = {
  costs: structuredClone(BC.DEFAULT_COSTS),
  appearance: structuredClone(BC.DEFAULT_APPEARANCE),
  session: null,
  costsPromptSeenAt: null,
  clients: [
    {
      id: "cli-chocolatada",
      name: "La Chocolatada",
      tipo: "mayorista",
      ciudad: "Cali",
      departamento: "Valle del Cauca",
      contacto: "",
      email: "",
      telefono: "",
      notas: "Panadería — cliente piloto",
      createdAt: new Date().toISOString(),
    },
  ],
  providers: [
    {
      id: "prov-oscar",
      name: "Óscar Alejandro",
      zona: "Cauca",
      telefono: "",
      email: "",
      notas: "Caficultor — lote lavado 24h fermentación",
      createdAt: new Date().toISOString(),
    },
  ],
  coffees: [
    {
      id: "cafe-oscar-lavado-24h",
      nombre: "Óscar Alejandro — Colombia lavado 24h",
      caficultor: "Óscar Alejandro",
      proveedorId: "prov-oscar",
      zona: "Cauca",
      variedad: "Colombia",
      proceso: "Lavado + fermentación 24h",
      estadoCompra: "verde",
      precioKg: 33000,
      transporteIncluido: true,
      transportePorKg: 0,
      rangoPrecioId: "r2",
      imagenDataUrl: "",
      notas: "Transporte incluido en precio de compra",
      stockVerdeKg: 100,
      stockTostadoKg: 0,
      createdAt: new Date().toISOString(),
    },
  ],
  inventoryLots: [
    {
      id: "lot-oscar-100",
      coffeeId: "cafe-oscar-lavado-24h",
      estado: "verde",
      kilosIniciales: 100,
      kilosDisponibles: 100,
      fecha: new Date().toISOString().slice(0, 10),
      notas: "Lote inicial de ejemplo",
    },
  ],
  quotes: [],
  sales: [],
  purchases: [
    {
      id: "pur-oscar-100",
      coffeeId: "cafe-oscar-lavado-24h",
      proveedorId: "prov-oscar",
      kilos: 100,
      precioKg: 33000,
      transporteIncluido: true,
      transporteTotal: 0,
      total: 3300000,
      fecha: new Date().toISOString().slice(0, 10),
      notas: "Compra inicial — 100 kg verde",
    },
  ],
  notifications: [],
};

BC.formatCOP = function formatCOP(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
};

BC.uid = function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

BC.today = function today() {
  return new Date().toISOString().slice(0, 10);
};
