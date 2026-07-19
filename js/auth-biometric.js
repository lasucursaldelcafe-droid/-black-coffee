const BiometricAuth = {
  getCredentials() {
    const stored = Storage.get(STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
    return Array.isArray(stored) ? stored : [];
  },

  saveCredentials(credentials) {
    Storage.set(STORAGE_KEYS.BIOMETRIC_CREDENTIALS, credentials);
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
    return window.location.hostname;
  },

  async isSupported() {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false;
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch {
      return false;
    }
    return false;
  },

  hasCredentialForUser(userId) {
    return this.getCredentials().some((c) => c.userId === userId);
  },

  hasAnyCredential() {
    return this.getCredentials().length > 0;
  },

  async register(user) {
    if (!await this.isSupported()) {
      return { success: false, message: 'Este dispositivo no soporta inicio biométrico' };
    }

    const existing = this.getCredentials().filter((c) => c.userId !== user.id);
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(user.id);

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
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
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
            requireResidentKey: false
          },
          timeout: 60000,
          attestation: 'none'
        }
      });

      if (!credential) {
        return { success: false, message: 'Registro biométrico cancelado' };
      }

      const record = {
        userId: user.id,
        username: user.username,
        name: user.name,
        credentialId: this.bufferToBase64url(credential.rawId),
        createdAt: new Date().toISOString()
      };

      this.saveCredentials([...existing, record]);
      return { success: true, message: 'Inicio biométrico activado' };
    } catch (error) {
      console.error('Biometric register error:', error);
      return {
        success: false,
        message: error.name === 'NotAllowedError'
          ? 'Registro cancelado o no autorizado'
          : 'No se pudo activar el inicio biométrico'
      };
    }
  },

  async authenticate() {
    if (!await this.isSupported()) {
      return { success: false, message: 'Inicio biométrico no disponible en este dispositivo' };
    }

    const credentials = this.getCredentials();
    if (credentials.length === 0) {
      return { success: false, message: 'Ningún usuario tiene inicio biométrico en este dispositivo' };
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: credentials.map((c) => ({
            id: this.base64urlToBuffer(c.credentialId),
            type: 'public-key',
            transports: ['internal']
          })),
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion) {
        return { success: false, message: 'Autenticación cancelada' };
      }

      const credId = this.bufferToBase64url(assertion.rawId);
      const match = credentials.find((c) => c.credentialId === credId);
      if (!match) {
        return { success: false, message: 'Credencial no reconocida' };
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
    } catch (error) {
      console.error('Biometric auth error:', error);
      return {
        success: false,
        message: error.name === 'NotAllowedError'
          ? 'Autenticación cancelada'
          : 'Error en inicio biométrico'
      };
    }
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
