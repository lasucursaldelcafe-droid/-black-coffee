const BiometricAuth = {
  _supportCache: null,
  _supportCacheAt: 0,

  getCredentials() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveCredentials(credentials) {
    localStorage.setItem(STORAGE_KEYS.BIOMETRIC_CREDENTIALS, JSON.stringify(credentials));
    const saved = this.getCredentials();
    if (saved.length !== credentials.length) {
      throw new Error('No se pudo guardar la credencial biométrica en este dispositivo');
    }
  },

  bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach((b) => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  base64urlToBuffer(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  toArrayBuffer(view) {
    if (view instanceof ArrayBuffer) return view;
    if (ArrayBuffer.isView(view)) {
      return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    return view;
  },

  getRpId() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return host;
    return host;
  },

  hasWebAuthnApi() {
    return Boolean(
      typeof window !== 'undefined'
      && window.PublicKeyCredential
      && typeof navigator !== 'undefined'
      && navigator.credentials
      && typeof navigator.credentials.create === 'function'
      && window.isSecureContext
    );
  },

  async getSupportInfo(force = false) {
    if (!force && this._supportCache && Date.now() - this._supportCacheAt < 120000) {
      return this._supportCache;
    }

    if (!window.PublicKeyCredential) {
      this._supportCache = {
        available: false,
        platform: false,
        secure: window.isSecureContext,
        reason: 'Su navegador no soporta WebAuthn. Use Chrome, Edge o Safari actualizado.'
      };
      this._supportCacheAt = Date.now();
      return this._supportCache;
    }

    if (!window.isSecureContext) {
      this._supportCache = {
        available: false,
        platform: false,
        secure: false,
        reason: 'Se requiere HTTPS. Abra la app desde https://lasucursaldelcafe-droid.github.io/-black-coffee/'
      };
      this._supportCacheAt = Date.now();
      return this._supportCache;
    }

    let platform = false;
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } else {
        platform = true;
      }
    } catch {
      platform = true;
    }

    this._supportCache = {
      available: true,
      platform,
      secure: true,
      reason: platform
        ? 'Huella, Face ID o PIN del dispositivo disponibles.'
        : 'WebAuthn disponible. Si falla, use Chrome/Safari en el móvil o active Windows Hello / Touch ID.'
    };
    this._supportCacheAt = Date.now();
    return this._supportCache;
  },

  async isSupported() {
    const info = await this.getSupportInfo();
    return info.available;
  },

  normalizeUser(user) {
    if (!user) return null;

    Auth.init();
    let resolved = user;
    if (!user.id && user.username) {
      resolved = Auth.users.find((u) => u.username === user.username) || user;
    }
    if (!resolved?.id && user.username) {
      resolved = {
        ...resolved,
        id: `user_${String(user.username).replace(/[^\w.-]+/g, '_')}`
      };
    }
    if (!resolved?.username || !resolved?.id) return null;
    return resolved;
  },

  hasCredentialForUser(userId) {
    return this.getCredentials().some((c) => c.userId === userId);
  },

  hasAnyCredential() {
    return this.getCredentials().length > 0;
  },

  mapWebAuthnError(error, phase = 'register') {
    const name = error?.name || '';
    const message = error?.message || '';

    if (name === 'NotAllowedError') {
      return phase === 'register'
        ? 'Registro cancelado o bloqueado. Pulse de nuevo el botón y acepte el diálogo de huella/Face ID de inmediato.'
        : 'Autenticación cancelada.';
    }
    if (name === 'SecurityError') {
      return 'Error de seguridad: abra la app con HTTPS en el dominio oficial (GitHub Pages).';
    }
    if (name === 'InvalidStateError') {
      return 'Ya existe un registro biométrico en el dispositivo. Desactívelo aquí y vuelva a activarlo, o borre la clave en ajustes del teléfono.';
    }
    if (name === 'NotSupportedError') {
      return 'Este dispositivo no completó el registro biométrico. Pruebe Chrome o Safari en el móvil.';
    }
    if (name === 'AbortError') {
      return 'Tiempo agotado. Inténtelo de nuevo.';
    }
    if (/passkey|credential|authenticator/i.test(message)) {
      return `Biométrico: ${message}`;
    }
    return phase === 'register'
      ? 'No se pudo activar el inicio biométrico. Inténtelo de nuevo.'
      : 'Error en inicio biométrico. Use usuario y contraseña.';
  },

  buildRegistrationOptions(user, { usePlatform = true, userVerification = 'required' } = {}) {
    const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(user.id);
    const existingForUser = this.getCredentials().filter((c) => c.userId === user.id);

    const authenticatorSelection = {
      userVerification,
      residentKey: 'discouraged'
    };

    if (usePlatform) {
      authenticatorSelection.authenticatorAttachment = 'platform';
    }

    const options = {
      rp: {
        name: 'Black Coffee Administration',
        id: this.getRpId()
      },
      user: {
        id: this.toArrayBuffer(userIdBytes),
        name: user.username,
        displayName: user.name || user.username
      },
      challenge: this.toArrayBuffer(challengeBytes),
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' }
      ],
      authenticatorSelection,
      timeout: 120000,
      attestation: 'none'
    };

    if (existingForUser.length > 0) {
      options.excludeCredentials = existingForUser.map((c) => ({
        id: this.base64urlToBuffer(c.credentialId),
        type: 'public-key'
      }));
    }

    return options;
  },

  async _registerWithOptions(user, config) {
    const existing = this.getCredentials().filter((c) => c.userId !== user.id);
    const publicKey = this.buildRegistrationOptions(user, config);

    const credential = await navigator.credentials.create({ publicKey });

    if (!credential) {
      return { success: false, message: 'Registro biométrico cancelado', cancelled: true };
    }

    const record = {
      userId: user.id,
      username: user.username,
      name: user.name,
      credentialId: this.bufferToBase64url(credential.rawId),
      rpId: this.getRpId(),
      platform: config.usePlatform !== false,
      createdAt: new Date().toISOString()
    };

    try {
      this.saveCredentials([...existing, record]);
    } catch (error) {
      return {
        success: false,
        message: error?.message || 'No se pudo guardar en el dispositivo. Verifique almacenamiento local.'
      };
    }

    return { success: true, message: 'Inicio biométrico activado en este dispositivo' };
  },

  getRegistrationAttempts(support) {
    const attempts = [
      { usePlatform: true, userVerification: 'required' },
      { usePlatform: true, userVerification: 'preferred' },
      { usePlatform: false, userVerification: 'preferred' }
    ];

    if (!support?.platform) {
      return [{ usePlatform: false, userVerification: 'preferred' }];
    }

    return attempts;
  },

  async register(user, options = {}) {
    const normalized = this.normalizeUser(user);
    if (!normalized) {
      return { success: false, message: 'Usuario no válido para registro biométrico' };
    }

    if (!this.hasWebAuthnApi()) {
      const support = options.supportInfo || await this.getSupportInfo();
      return { success: false, message: support.reason || 'WebAuthn no disponible en este navegador' };
    }

    const support = options.supportInfo || this._supportCache || { available: true, platform: true };
    const attempts = this.getRegistrationAttempts(support);
    let lastError = null;

    for (const attempt of attempts) {
      try {
        return await this._registerWithOptions(normalized, attempt);
      } catch (error) {
        console.error('Biometric register error:', error);
        lastError = error;

        if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
          return {
            success: false,
            message: this.mapWebAuthnError(error, 'register'),
            cancelled: true
          };
        }

        if (error?.name === 'InvalidStateError') {
          this.remove(normalized.id);
          continue;
        }
      }
    }

    return {
      success: false,
      message: this.mapWebAuthnError(lastError, 'register')
    };
  },

  buildAuthenticationOptions(credentials, { strictTransports = true } = {}) {
    const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
    const allowCredentials = credentials.map((c) => {
      const descriptor = {
        id: this.base64urlToBuffer(c.credentialId),
        type: 'public-key'
      };
      if (strictTransports) {
        descriptor.transports = ['internal', 'hybrid'];
      }
      return descriptor;
    });

    return {
      challenge: this.toArrayBuffer(challengeBytes),
      rpId: this.getRpId(),
      allowCredentials,
      userVerification: 'required',
      timeout: 120000
    };
  },

  async _authenticateWithOptions(credentials, options) {
    const assertion = await navigator.credentials.get({
      publicKey: this.buildAuthenticationOptions(credentials, options)
    });

    if (!assertion) {
      return { success: false, message: 'Autenticación cancelada', cancelled: true };
    }

    const credId = this.bufferToBase64url(assertion.rawId);
    const match = credentials.find((c) => c.credentialId === credId);
    if (!match) {
      return { success: false, message: 'Credencial no reconocida en este dispositivo' };
    }

    Auth.init();
    const user = Auth.users.find((u) => u.id === match.userId);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const session = {
      userId: user.id,
      name: user.name,
      role: user.role,
      loginTime: new Date().toISOString(),
      biometric: true
    };
    Storage.set(STORAGE_KEYS.SESSION, session);
    return { success: true, user: session };
  },

  async authenticate(options = {}) {
    if (!this.hasWebAuthnApi()) {
      const support = options.supportInfo || await this.getSupportInfo();
      return { success: false, message: support.reason || 'WebAuthn no disponible' };
    }

    const credentials = this.getCredentials().filter((c) => !c.rpId || c.rpId === this.getRpId());
    if (credentials.length === 0) {
      return {
        success: false,
        message: 'Ningún usuario tiene inicio biométrico en este dispositivo. Inicie sesión con contraseña y actívelo.'
      };
    }

    const attempts = [
      { strictTransports: true },
      { strictTransports: false }
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        return await this._authenticateWithOptions(credentials, attempt);
      } catch (error) {
        console.error('Biometric auth error:', error);
        lastError = error;
        if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
          return {
            success: false,
            message: this.mapWebAuthnError(error, 'authenticate'),
            cancelled: true
          };
        }
      }
    }

    return {
      success: false,
      message: this.mapWebAuthnError(lastError, 'authenticate')
    };
  },

  remove(userId) {
    const next = this.getCredentials().filter((c) => c.userId !== userId);
    this.saveCredentials(next);
    return { success: true };
  },

  getUsersWithBiometricStatus() {
    Auth.init();
    return Auth.users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      biometricEnabled: this.hasCredentialForUser(user.id)
    }));
  }
};
