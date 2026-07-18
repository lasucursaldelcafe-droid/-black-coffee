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
          type: 'Caficultor',
          region: 'Cauca',
          contact: 'Óscar Alejandro',
          email: '',
          phone: '',
          notes: 'Productor de café de especialidad en el Cauca. Fermentación controlada.',
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
    if (!Storage.get(STORAGE_KEYS.NOTIFICATIONS)) {
      Storage.set(STORAGE_KEYS.NOTIFICATIONS, []);
    }
  }
};
