const Auth = {
  defaultUsers: [
    {
      id: 'user_ximena',
      username: 'ximena.polo',
      password: 'XimenaBCA2026!',
      name: 'Ximena Polo',
      role: 'Administradora',
      email: 'ximena@blackcoffee.admin'
    },
    {
      id: 'user_pablo',
      username: 'pablo.colorado',
      password: 'PabloBCA2026!',
      name: 'Pablo Colorado Gómez',
      role: 'Administrador',
      email: 'pablo@blackcoffee.admin'
    }
  ],

  get users() {
    return this._users;
  },

  set users(value) {
    this._users = value;
  },

  _users: [],

  init() {
    this._users = this.loadUsers();
  },

  loadUsers() {
    const stored = Storage.get(STORAGE_KEYS.USERS);
    if (this.isValidUserList(stored)) {
      return stored;
    }
    Storage.set(STORAGE_KEYS.USERS, this.defaultUsers);
    return [...this.defaultUsers];
  },

  isValidUserList(users) {
    if (!Array.isArray(users) || users.length === 0) return false;
    return users.every((user) =>
      user
      && typeof user.username === 'string'
      && typeof user.password === 'string'
      && typeof user.name === 'string'
    );
  },

  repairAccess() {
    Storage.set(STORAGE_KEYS.USERS, this.defaultUsers);
    Storage.remove(STORAGE_KEYS.SESSION);
    this._users = [...this.defaultUsers];
  },

  login(username, password) {
    if (!Array.isArray(this.users)) {
      this.repairAccess();
    }

    const user = this.users.find(
      (u) => (u.username === username || u.name.toLowerCase().includes(username.toLowerCase()))
        && u.password === password
    );

    if (user) {
      const session = {
        userId: user.id,
        name: user.name,
        role: user.role,
        loginTime: new Date().toISOString()
      };
      Storage.set(STORAGE_KEYS.SESSION, session);
      return { success: true, user: session };
    }

    return { success: false, message: 'Usuario o contraseña incorrectos' };
  },

  logout() {
    Storage.remove(STORAGE_KEYS.SESSION);
    window.location.href = 'index.html';
  },

  getSession() {
    return Storage.get(STORAGE_KEYS.SESSION);
  },

  isAuthenticated() {
    return !!this.getSession();
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    return this.users.find(u => u.id === session.userId);
  }
};
