const DATA_VERSION = 4;
const DATA_VERSION_KEY = 'bca_data_version';

const DataSeed = {
  init() {
    const storedVersion = Storage.get(DATA_VERSION_KEY);
    if (storedVersion !== DATA_VERSION) {
      this.migrate(storedVersion);
      Storage.set(DATA_VERSION_KEY, DATA_VERSION);
    }

    this.seedProductionCosts();
    this.seedSettings();
    this.seedCoffees();
    this.seedClients();
    this.seedSuppliers();
    this.seedInventory();
    this.ensureTransformationSuppliers();
    this.linkCoffeeSuppliers();
  },

  linkCoffeeSuppliers() {
    const coffees = Storage.get(STORAGE_KEYS.COFFEES) || [];
    if (!coffees.length) return;

    let changed = false;
    const linked = coffees.map((coffee) => {
      if (coffee.supplierId && SupplierManager.getById(coffee.supplierId)) {
        return coffee;
      }
      const supplier = CoffeeManager.findSupplierForCoffee(coffee);
      if (!supplier) return coffee;
      changed = true;
      return {
        ...coffee,
        supplierId: supplier.id,
        farmer: coffee.farmer || supplier.name
      };
    });

    if (changed) {
      Storage.set(STORAGE_KEYS.COFFEES, linked);
    }
  },

  migrate(fromVersion) {
    if (fromVersion === null || fromVersion === undefined) {
      return;
    }
    if (fromVersion === 1) {
      this.migrateV1ToV2();
      return;
    }
    if (fromVersion === 2) {
      this.migrateV2ToV3();
      return;
    }
    if (fromVersion === 3) {
      this.migrateV3ToV4();
      return;
    }
    if (fromVersion !== DATA_VERSION) {
      console.warn(`Migración desconocida desde versión ${fromVersion}`);
    }
  },

  migrateV1ToV2() {
    const quotations = Storage.get(STORAGE_KEYS.QUOTATIONS) || [];
    const enriched = quotations.map((q) => this.enrichQuotationMetrics(q));
    if (enriched.length > 0) {
      Storage.set(STORAGE_KEYS.QUOTATIONS, enriched);
    }
  },

  migrateV2ToV3() {
    this.linkCoffeeSuppliers();
  },

  migrateV3ToV4() {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS);
    if (settings && (!settings.email || settings.email === 'ghostspecialtycoffee@gmail.com')) {
      Storage.set(STORAGE_KEYS.SETTINGS, {
        ...settings,
        email: 'lasucursaldelcafe@gmail.com'
      });
    }
    this.linkCoffeeSuppliers();
  },

  enrichQuotationMetrics(quotation) {
    const unitCost = quotation.costBreakdown?.totalCost || 0;
    const unitPrice = quotation.unitPrice || 0;
    const quantity = quotation.quantity || 1;
    const totalCost = unitCost * quantity;
    const profit = quotation.totalPrice - totalCost;
    const profitMargin = quotation.totalPrice > 0 ? (profit / quotation.totalPrice) * 100 : 0;

    return {
      ...quotation,
      internalUnitCost: unitCost,
      internalTotalCost: totalCost,
      internalProfit: profit,
      internalProfitMargin: profitMargin
    };
  },

  resetAllToZero() {
    Storage.set(STORAGE_KEYS.PRODUCTION_COSTS, {
      ...DEFAULT_PRODUCTION_COSTS,
      lastUpdated: new Date().toISOString()
    });

    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    Storage.set(STORAGE_KEYS.SETTINGS, { ...settings, lowStockThreshold: 0 });

    const coffees = (Storage.get(STORAGE_KEYS.COFFEES) || []).map((coffee) => ({
      ...coffee,
      pricePerKg: 0,
      transportCost: 0,
      transportIncluded: false
    }));

    if (coffees.length === 0) {
      coffees.push(this.createSampleCoffee());
    }

    Storage.set(STORAGE_KEYS.COFFEES, coffees);

    Storage.set(STORAGE_KEYS.INVENTORY, coffees.map((coffee) => ({
      id: Storage.generateId(),
      coffeeId: coffee.id,
      greenKg: 0,
      roastedKg: 0,
      packagedUnits: {},
      minStockKg: 0,
      lastUpdated: new Date().toISOString()
    })));

    Storage.set(STORAGE_KEYS.QUOTATIONS, []);
    Storage.set(STORAGE_KEYS.PURCHASES, []);
    Storage.set(STORAGE_KEYS.SALES, []);
    Storage.set(STORAGE_KEYS.PRODUCTION_BATCHES, []);
    Storage.set(STORAGE_KEYS.NOTIFICATIONS, []);
    Storage.set(STORAGE_KEYS.AUDIT_LOG, []);
    Storage.remove(STORAGE_KEYS.COSTS_CHECKED);

    if (!Storage.get(STORAGE_KEYS.CLIENTS)?.length) {
      this.seedClients(true);
    }
    if (!Storage.get(STORAGE_KEYS.SUPPLIERS)?.length) {
      this.seedSuppliers(true);
    }
    this.ensureTransformationSuppliers();
  },

  getTransformationSupplierTemplates() {
    return [
      {
        name: 'Beneficio La Trilla',
        category: 'operational',
        type: 'Trilladora',
        services: ['trilla'],
        region: 'Huila',
        department: 'Huila',
        city: 'Pitalito',
        address: 'Km 2 vía Bruselas',
        notes: 'Trilla de café pergamino.'
      },
      {
        name: 'Selección Verde Huila',
        category: 'operational',
        type: 'Seleccionadora',
        services: ['greenSelection'],
        region: 'Huila',
        department: 'Huila',
        city: 'Pitalito',
        address: 'Bodega selección Bruselas',
        notes: 'Clasificación y selección de café en verde.'
      },
      {
        name: 'Ghost Specialty Coffee — Tostión',
        category: 'operational',
        type: 'Tostador',
        services: ['tostion'],
        region: 'Huila',
        department: 'Huila',
        city: 'Pitalito',
        address: 'Bruselas, Pitalito',
        invima: 'RSA-GHOST-001',
        contact: 'Producción Ghost',
        email: 'ghostspecialtycoffee@gmail.com',
        notes: 'Planta de tostión principal.'
      },
      {
        name: 'Selección Post-Tostión Ghost',
        category: 'operational',
        type: 'Seleccionadora',
        services: ['seleccion'],
        region: 'Huila',
        department: 'Huila',
        city: 'Pitalito',
        address: 'Bruselas, Pitalito',
        invima: 'RSA-GHOST-001',
        notes: 'Selección de granos después de tostar.'
      },
      {
        name: 'Molino Bruselas',
        category: 'operational',
        type: 'Molino',
        services: ['molienda'],
        region: 'Huila',
        department: 'Huila',
        city: 'Pitalito',
        address: 'Bruselas, Pitalito',
        notes: 'Molienda de café — preparación molido.'
      },
      {
        name: 'Empacadora Ghost',
        category: 'operational',
        type: 'Empacadora',
        services: ['empacada'],
        region: 'Huila',
        department: 'Huila',
        city: 'Pitalito',
        address: 'Bruselas, Pitalito',
        invima: 'RSA-GHOST-001',
        notes: 'Empaque y sellado de presentaciones.'
      },
      {
        name: 'Transportes del Huila',
        category: 'logistics',
        type: 'Transporte',
        services: ['transporte'],
        region: 'Huila',
        department: 'Huila',
        city: 'Neiva',
        address: 'Terminal de cargas',
        kimba: 'KIMBA-TH-2024',
        contact: 'Despachos',
        notes: 'Flete origen Huila → punto de transformación.'
      }
    ];
  },

  ensureTransformationSuppliers() {
    const suppliers = Storage.get(STORAGE_KEYS.SUPPLIERS) || [];
    const templates = this.getTransformationSupplierTemplates();
    let changed = false;

    templates.forEach((template) => {
      const serviceKey = template.services[0];
      const exists = suppliers.some((s) =>
        s.services?.includes(serviceKey) || (serviceKey === 'transporte' && s.category === 'logistics')
      );
      if (!exists) {
        suppliers.push({
          id: Storage.generateId(),
          ...template,
          serviceRates: {},
          invima: template.invima || '',
          kimba: template.kimba || '',
          contact: template.contact || '',
          email: template.email || '',
          phone: '',
          createdAt: new Date().toISOString()
        });
        changed = true;
      }
    });

    if (changed) {
      Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    }
  },

  createSampleCoffee() {
    return {
      id: Storage.generateId(),
      name: 'Óscar Alejandro',
      variety: 'Caturra',
      region: 'Cauca',
      process: 'Lavado',
      fermentation: '24 horas',
      farmer: 'Óscar Alejandro',
      pricePerKg: 0,
      transportIncluded: false,
      transportCost: 0,
      state: 'verde',
      altitude: '1800 msnm',
      notes: 'Café de especialidad con fermentación controlada de 24 horas. Notas a chocolate, caramelo y frutos rojos.',
      image: null,
      createdAt: new Date().toISOString()
    };
  },

  seedProductionCosts() {
    if (!Storage.get(STORAGE_KEYS.PRODUCTION_COSTS)) {
      Storage.set(STORAGE_KEYS.PRODUCTION_COSTS, DEFAULT_PRODUCTION_COSTS);
    }
  },

  seedSettings() {
    if (!Storage.get(STORAGE_KEYS.SETTINGS)) {
      Storage.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
  },

  seedCoffees() {
    if (!Storage.get(STORAGE_KEYS.COFFEES)) {
      Storage.set(STORAGE_KEYS.COFFEES, [this.createSampleCoffee()]);
    }
  },

  seedClients(force = false) {
    if (force || !Storage.get(STORAGE_KEYS.CLIENTS)) {
      const clients = [
        {
          id: Storage.generateId(),
          name: 'La Chocolatada',
          type: 'mayorista',
          contact: 'Gerencia',
          email: 'contacto@lachocolatada.com',
          phone: '+57 300 000 0000',
          city: 'Cali',
          department: 'Valle del Cauca',
          address: 'Centro, Cali',
          notes: 'Panadería artesanal en Cali. Cliente principal para café de especialidad.',
          createdAt: new Date().toISOString()
        }
      ];
      Storage.set(STORAGE_KEYS.CLIENTS, clients);
    }
  },

  seedSuppliers(force = false) {
    if (force || !Storage.get(STORAGE_KEYS.SUPPLIERS)) {
      const suppliers = [
        {
          id: Storage.generateId(),
          name: 'Óscar Alejandro',
          category: 'coffee',
          type: 'Caficultor',
          services: [],
          serviceRates: {},
          region: 'Cauca',
          department: 'Cauca',
          city: 'Piendamó',
          address: 'Vereda El Paraíso',
          invima: '',
          kimba: '',
          contact: 'Óscar Alejandro',
          email: '',
          phone: '',
          notes: 'Productor de café de especialidad en el Cauca. Fermentación controlada.',
          createdAt: new Date().toISOString()
        },
        ...this.getTransformationSupplierTemplates().map((template) => ({
          id: Storage.generateId(),
          ...template,
          serviceRates: {},
          invima: template.invima || '',
          kimba: template.kimba || '',
          contact: template.contact || '',
          email: template.email || '',
          phone: '',
          createdAt: new Date().toISOString()
        }))
      ];
      Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    }
  },

  seedInventory() {
    if (!Storage.get(STORAGE_KEYS.INVENTORY)) {
      const coffees = Storage.get(STORAGE_KEYS.COFFEES) || [];
      const inventory = coffees.map((coffee) => ({
        id: Storage.generateId(),
        coffeeId: coffee.id,
        greenKg: 0,
        roastedKg: 0,
        packagedUnits: {},
        minStockKg: 0,
        lastUpdated: new Date().toISOString()
      }));
      Storage.set(STORAGE_KEYS.INVENTORY, inventory);
    }

    if (!Storage.get(STORAGE_KEYS.QUOTATIONS)) {
      Storage.set(STORAGE_KEYS.QUOTATIONS, []);
    }
    if (!Storage.get(STORAGE_KEYS.PURCHASES)) {
      Storage.set(STORAGE_KEYS.PURCHASES, []);
    }
    if (!Storage.get(STORAGE_KEYS.SALES)) {
      Storage.set(STORAGE_KEYS.SALES, []);
    }
    if (!Storage.get(STORAGE_KEYS.PRODUCTION_BATCHES)) {
      Storage.set(STORAGE_KEYS.PRODUCTION_BATCHES, []);
    }
    if (!Storage.get(STORAGE_KEYS.NOTIFICATIONS)) {
      Storage.set(STORAGE_KEYS.NOTIFICATIONS, []);
    }
  }
};
