const DataSeed = {
  init() {
    this.seedProductionCosts();
    this.seedSettings();
    this.seedCoffees();
    this.seedClients();
    this.seedSuppliers();
    this.seedInventory();
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
      const coffees = [
        {
          id: Storage.generateId(),
          name: 'Óscar Alejandro',
          variety: 'Caturra',
          region: 'Cauca',
          process: 'Lavado',
          fermentation: '24 horas',
          farmer: 'Óscar Alejandro',
          pricePerKg: 33000,
          transportIncluded: true,
          transportCost: 0,
          state: 'verde',
          altitude: '1800 msnm',
          notes: 'Café de especialidad con fermentación controlada de 24 horas. Notas a chocolate, caramelo y frutos rojos.',
          image: null,
          createdAt: new Date().toISOString()
        }
      ];
      Storage.set(STORAGE_KEYS.COFFEES, coffees);
    }
  },

  seedClients() {
    if (!Storage.get(STORAGE_KEYS.CLIENTS)) {
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

  seedSuppliers() {
    if (!Storage.get(STORAGE_KEYS.SUPPLIERS)) {
      const suppliers = [
        {
          id: Storage.generateId(),
          name: 'Óscar Alejandro',
          category: 'coffee',
          type: 'Caficultor',
          services: [],
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
        {
          id: Storage.generateId(),
          name: 'Ghost Specialty Coffee — Tostión',
          category: 'operational',
          type: 'Tostador',
          services: ['tostion', 'seleccion', 'empacada'],
          region: 'Huila',
          department: 'Huila',
          city: 'Pitalito',
          address: 'Bruselas, Pitalito',
          invima: 'RSA-GHOST-001',
          kimba: '',
          contact: 'Producción Ghost',
          email: 'ghostspecialtycoffee@gmail.com',
          phone: '',
          notes: 'Planta de tostión y empacado principal.',
          createdAt: new Date().toISOString()
        },
        {
          id: Storage.generateId(),
          name: 'Beneficio La Trilla',
          category: 'operational',
          type: 'Trilladora',
          services: ['trilla', 'greenSelection'],
          region: 'Huila',
          department: 'Huila',
          city: 'Pitalito',
          address: 'Km 2 vía Bruselas',
          invima: '',
          kimba: '',
          contact: 'Coordinación Beneficio',
          email: '',
          phone: '',
          notes: 'Trilla y selección en verde.',
          createdAt: new Date().toISOString()
        },
        {
          id: Storage.generateId(),
          name: 'Transportes del Huila',
          category: 'logistics',
          type: 'Transporte',
          services: ['transporte'],
          region: 'Huila',
          department: 'Huila',
          city: 'Neiva',
          address: 'Terminal de cargas',
          invima: '',
          kimba: 'KIMBA-TH-2024',
          contact: 'Despachos',
          email: '',
          phone: '',
          notes: 'Flete origen Huila → punto de tostión. Tarifa referencia $1,500/kg.',
          createdAt: new Date().toISOString()
        },
        {
          id: Storage.generateId(),
          name: 'Fresco Coffee — Empaque',
          category: 'operational',
          type: 'Empacadora',
          services: ['empacada', 'seleccion'],
          region: 'Valle del Cauca',
          department: 'Valle del Cauca',
          city: 'Cali',
          address: 'Bodega maquila Cali',
          invima: 'RSA-FRESCO-01',
          kimba: '',
          contact: 'Fresco Coffee',
          email: '',
          phone: '',
          notes: 'Maquila y empacado para Fresco Coffee. Presentación 340g.',
          createdAt: new Date().toISOString()
        }
      ];
      Storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    }
  },

  seedInventory() {
    if (!Storage.get(STORAGE_KEYS.INVENTORY)) {
      const coffees = Storage.get(STORAGE_KEYS.COFFEES) || [];
      const inventory = coffees.map(coffee => ({
        id: Storage.generateId(),
        coffeeId: coffee.id,
        greenKg: 50,
        roastedKg: 0,
        packagedUnits: {},
        minStockKg: 10,
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
