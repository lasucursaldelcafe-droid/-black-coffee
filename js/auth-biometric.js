const BiometricAuth = {
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

  getRpId() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return host;
    return host;
  },

  hasWebAuthnApi() {
    return Boolean(window.PublicKeyCredential && window.isSecureContext);
  },

  async getSupportInfo() {
    if (!window.PublicKeyCredential) {
      return {
        available: false,
        platform: false,
        secure: window.isSecureContext,
        reason: 'Su navegador no soporta WebAuthn. Use Chrome, Edge o Safari actualizado.'
      };
    }

    if (!window.isSecureContext) {
      return {
        available: false,
        platform: false,
        secure: false,
        reason: 'Se requiere HTTPS. Abra la app desde https://lasucursaldelcafe-droid.github.io/-black-coffee/'
      };
    }

    let platform = false;
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch {
      platform = false;
    }

    return {
      available: true,
      platform,
      secure: true,
      reason: platform
        ? 'Huella, Face ID o PIN del dispositivo disponibles.'
        : 'WebAuthn disponible. Si falla, use Chrome/Safari en el móvil o active Windows Hello / Touch ID.'
    };
  },

  async isSupported() {
    const info = await this.getSupportInfo();
    return info.available;
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
        ? 'Registro cancelado. Acepte el diálogo de huella/Face ID cuando aparezca.'
        : 'Autenticación cancelada.';
    }
    if (name === 'SecurityError') {
      return 'Error de seguridad: abra la app con HTTPS en el dominio oficial (GitHub Pages).';
    }
    if (name === 'InvalidStateError') {
      return 'Ya hay un registro biométrico. Desactívelo en Configuración y vuelva a activarlo.';
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

  buildRegistrationOptions(user, { usePlatform = true } = {}) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(user.id);

    const authenticatorSelection = {
      userVerification: 'required',
      residentKey: 'preferred',
      requireResidentKey: false
    };

    if (usePlatform) {
      authenticatorSelection.authenticatorAttachment = 'platform';
    }

    return {
      rp: {
        name: 'Black Coffee Administration',
        id: this.getRpId()
      },
      user: {
        id: userIdBytes,
        name: user.username,
        displayName: user.name
      },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' }
      ],
      authenticatorSelection,
      timeout: 120000,
      attestation: 'none'
    };
  },

  async _registerWithOptions(user, usePlatform) {
    const existing = this.getCredentials().filter((c) => c.userId !== user.id);
    const publicKey = this.buildRegistrationOptions(user, { usePlatform });

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
      platform: usePlatform,
      createdAt: new Date().toISOString()
    };

    this.saveCredentials([...existing, record]);
    return { success: true, message: 'Inicio biométrico activado en este dispositivo' };
  },

  async register(user) {
    const support = await this.getSupportInfo();
    if (!support.available) {
      return { success: false, message: support.reason };
    }

    if (!user?.id || !user?.username) {
      return { success: false, message: 'Usuario no válido para registro biométrico' };
    }

    const attempts = support.platform
      ? [{ usePlatform: true }, { usePlatform: false }]
      : [{ usePlatform: false }];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        return await this._registerWithOptions(user, attempt.usePlatform);
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
          return { success: false, message: this.mapWebAuthnError(error, 'register') };
        }
      }
    }

    return {
      success: false,
      message: this.mapWebAuthnError(lastError, 'register')
    };
  },

  buildAuthenticationOptions(credentials, { strictTransports = true } = {}) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
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
      challenge,
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

  async authenticate() {
    const support = await this.getSupportInfo();
    if (!support.available) {
      return { success: false, message: support.reason };
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
