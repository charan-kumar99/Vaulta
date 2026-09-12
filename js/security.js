
(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    ENABLED: 'vaulta_security_enabled',
    PIN_HASH: 'vaulta_security_pin_hash',
    PIN_LEN: 'vaulta_security_pin_len',
    BIOMETRIC_ENABLED: 'vaulta_bio_enabled',
    BIOMETRIC_CRED_ID: 'vaulta_bio_cred_id',
    ENCRYPTION_ENABLED: 'vaulta_encryption_enabled',
    DEVICE_VAULT_KEY: 'vaulta_device_key',
    VAULT_SALT: 'vaulta_vault_salt'
  };

  const ENC_HEADER = 'VAULTA_ENC_V1:';
  const ENC_HEADER_BYTES = new TextEncoder().encode(ENC_HEADER);

  let _isLocked = false;
  let _currentPinInput = '';
  let _lockSuppressionUntil = 0;
  let _activePin = null;
  let _activeKey = null;

  async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function getVaultSalt() {
    let hex = localStorage.getItem(STORAGE_KEYS.VAULT_SALT);
    if (!hex || hex.length !== 32) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      hex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(STORAGE_KEYS.VAULT_SALT, hex);
    }
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  function getDevicePassphrase() {
    let key = localStorage.getItem(STORAGE_KEYS.DEVICE_VAULT_KEY);
    if (!key || key.length < 32) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      key = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(STORAGE_KEYS.DEVICE_VAULT_KEY, key);
    }
    return key;
  }

  async function deriveKey(pin, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 50000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function getActiveEncryptionKey() {
    if (_activeKey) return _activeKey;

    let pin = _activePin;
    if (!pin && window.SecurityModule && typeof window.SecurityModule.hasPasscode === 'function' && window.SecurityModule.hasPasscode()) {
      try {
        pin = sessionStorage.getItem('vaulta_session_pin');
        if (pin) _activePin = pin;
      } catch (_) {}
    }

    if (pin) {
      _activeKey = await deriveKey(pin, getVaultSalt());
      return _activeKey;
    }

    const devicePass = getDevicePassphrase();
    _activeKey = await deriveKey(devicePass, getVaultSalt());
    return _activeKey;
  }

  const SecurityModule = {
    
    isSecurityEnabled() {
      return this.hasPasscode() || this.isBiometricsEnabled();
    },

    hasPasscode() {
      return !!localStorage.getItem(STORAGE_KEYS.PIN_HASH);
    },

    isBiometricsEnabled() {
      return localStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED) === 'true' && !!localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CRED_ID);
    },

    removePasscode() {
      localStorage.removeItem(STORAGE_KEYS.PIN_HASH);
      localStorage.removeItem(STORAGE_KEYS.PIN_LEN);
      localStorage.removeItem(STORAGE_KEYS.ENABLED);
      localStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      localStorage.removeItem(STORAGE_KEYS.BIOMETRIC_CRED_ID);
      _activePin = null;
      _activeKey = null;
      try { sessionStorage.removeItem('vaulta_session_pin'); } catch (_) {}
    },

    getBiometricsStatus() {
      if (window.location.protocol === 'file:') {
        return {
          supported: false,
          reason: 'file_protocol',
          message: 'Not supported on file:// protocol. Open via local server (http://localhost:...)'
        };
      }
      if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)) {
        return {
          supported: false,
          reason: 'ip_address',
          message: 'WebAuthn requires http://localhost:... instead of an IP address'
        };
      }
      if (!window.isSecureContext) {
        return {
          supported: false,
          reason: 'insecure_context',
          message: 'WebAuthn requires a secure context (HTTPS or localhost)'
        };
      }
      if (!window.PublicKeyCredential || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        return {
          supported: false,
          reason: 'unsupported_browser',
          message: 'Biometrics / WebAuthn not supported by this browser'
        };
      }
      return {
        supported: true,
        reason: 'ok',
        message: 'Device supported'
      };
    },

    async isBiometricsSupported() {
      const status = this.getBiometricsStatus();
      if (!status.supported) return false;
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (e) {
        console.warn('[Security] WebAuthn support check failed:', e);
        return false;
      }
    },

    getPinLength() {
      const len = parseInt(localStorage.getItem(STORAGE_KEYS.PIN_LEN) || '4', 10);
      return (isNaN(len) || len < 4) ? 4 : len;
    },
    
    isEncryptionEnabled() {
      // Enabled by default for maximum privacy & at-rest security
      const val = localStorage.getItem(STORAGE_KEYS.ENCRYPTION_ENABLED);
      return val !== 'false';
    },

    setEncryptionEnabled(enabled) {
      localStorage.setItem(STORAGE_KEYS.ENCRYPTION_ENABLED, enabled ? 'true' : 'false');
    },

    async isBlobEncrypted(blob) {
      if (!blob || !(blob instanceof Blob) || blob.size < ENC_HEADER_BYTES.length + 28) {
        return false;
      }
      try {
        const slice = blob.slice(0, ENC_HEADER_BYTES.length);
        const text = await slice.text();
        return text === ENC_HEADER;
      } catch (_) {
        return false;
      }
    },

    async encryptBlob(blob, targetMimeType = null) {
      if (!blob) return blob;
      // Prevent double encryption
      if (await this.isBlobEncrypted(blob)) return blob;

      try {
        const arrayBuffer = await blob.arrayBuffer();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await getActiveEncryptionKey();
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer);

        const packed = new Uint8Array(ENC_HEADER_BYTES.length + salt.length + iv.length + encrypted.byteLength);
        packed.set(ENC_HEADER_BYTES, 0);
        packed.set(salt, ENC_HEADER_BYTES.length);
        packed.set(iv, ENC_HEADER_BYTES.length + salt.length);
        packed.set(new Uint8Array(encrypted), ENC_HEADER_BYTES.length + salt.length + iv.length);

        return new Blob([packed], { type: 'application/octet-stream' });
      } catch (e) {
        console.error('[Security] Encryption failed:', e);
        return blob;
      }
    },

    async decryptBlob(blob, originalMimeType = 'application/octet-stream') {
      if (!blob) return blob;
      const isEnc = await this.isBlobEncrypted(blob);
      if (!isEnc) {
        if (blob instanceof Blob && originalMimeType && blob.type !== originalMimeType && blob.type === 'application/octet-stream') {
          return new Blob([blob], { type: originalMimeType });
        }
        return blob;
      }

      try {
        const arrayBuffer = await blob.arrayBuffer();
        const dataView = new Uint8Array(arrayBuffer);
        const headerLen = ENC_HEADER_BYTES.length;
        const salt = dataView.slice(headerLen, headerLen + 16);
        const iv = dataView.slice(headerLen + 16, headerLen + 28);
        const ciphertext = dataView.slice(headerLen + 28);

        const key = await getActiveEncryptionKey();
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new Blob([decrypted], { type: originalMimeType || 'application/octet-stream' });
      } catch (e) {
        console.warn('[Security] Active key decryption failed, attempting device fallback key:', e);
        try {
          const devicePass = getDevicePassphrase();
          const fallbackKey = await deriveKey(devicePass, getVaultSalt());
          const arrayBuffer = await blob.arrayBuffer();
          const dataView = new Uint8Array(arrayBuffer);
          const headerLen = ENC_HEADER_BYTES.length;
          const iv = dataView.slice(headerLen + 16, headerLen + 28);
          const ciphertext = dataView.slice(headerLen + 28);
          const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, fallbackKey, ciphertext);
          return new Blob([decrypted], { type: originalMimeType || 'application/octet-stream' });
        } catch (err2) {
          console.error('[Security] Both decryption attempts failed:', err2);
          throw new Error('Failed to decrypt document. Passcode PIN required.');
        }
      }
    },

    async encryptAllExistingDocuments(onProgress) {
      if (!window.DocDB || typeof window.DocDB.getAll !== 'function') {
        throw new Error('Database is not ready');
      }
      const allDocs = await window.DocDB.getAll();
      const total = allDocs.length;
      let encryptedCount = 0;

      for (let i = 0; i < total; i++) {
        const meta = allDocs[i];
        if (onProgress) {
          onProgress({ current: i + 1, total, name: meta.name });
        }
        const fullDoc = await window.DocDB.getDocument(meta.id);
        if (fullDoc && fullDoc.fileData) {
          const isEnc = await this.isBlobEncrypted(fullDoc.fileData);
          if (!isEnc) {
            const encBlob = await this.encryptBlob(fullDoc.fileData, fullDoc.fileType);
            await window.DocDB.updateDocument(meta.id, {
              fileData: encBlob,
              isEncrypted: true,
              encAlgo: 'AES-GCM-256',
              encryptedAt: Date.now()
            });
            encryptedCount++;
          }
        }
      }

      this.setEncryptionEnabled(true);
      return { total, encryptedCount };
    },

    async decryptAllDocuments(onProgress) {
      if (!window.DocDB || typeof window.DocDB.getAll !== 'function') {
        throw new Error('Database is not ready');
      }
      const allDocs = await window.DocDB.getAll();
      const total = allDocs.length;
      let decryptedCount = 0;

      for (let i = 0; i < total; i++) {
        const meta = allDocs[i];
        if (onProgress) {
          onProgress({ current: i + 1, total, name: meta.name });
        }
        const fullDoc = await window.DocDB.getDocument(meta.id);
        if (fullDoc && fullDoc.fileData) {
          const isEnc = await this.isBlobEncrypted(fullDoc.fileData);
          if (isEnc) {
            const plainBlob = await this.decryptBlob(fullDoc.fileData, fullDoc.fileType);
            await window.DocDB.updateDocument(meta.id, {
              fileData: plainBlob,
              isEncrypted: false,
              encAlgo: null,
              encryptedAt: null
            });
            decryptedCount++;
          }
        }
      }

      this.setEncryptionEnabled(false);
      return { total, decryptedCount };
    },

    async getEncryptionStats() {
      if (!window.DocDB || typeof window.DocDB.getAll !== 'function') {
        return { total: 0, encrypted: 0, unencrypted: 0 };
      }
      try {
        const allDocs = await window.DocDB.getAll();
        const total = allDocs.length;
        let encrypted = 0;
        for (const meta of allDocs) {
          if (meta.isEncrypted) {
            encrypted++;
          }
        }
        return { total, encrypted, unencrypted: total - encrypted };
      } catch (_) {
        return { total: 0, encrypted: 0, unencrypted: 0 };
      }
    },

    async setPasscode(pin) {
      if (!pin || pin.length < 4) {
        throw new Error('PIN must be at least 4 digits');
      }
      const hash = await hashString(pin);
      localStorage.setItem(STORAGE_KEYS.PIN_HASH, hash);
      localStorage.setItem(STORAGE_KEYS.PIN_LEN, pin.length.toString());
      localStorage.setItem(STORAGE_KEYS.ENABLED, 'true');
      _activePin = pin;
      try { sessionStorage.setItem('vaulta_session_pin', pin); } catch (_) {}
      _activeKey = await deriveKey(pin, getVaultSalt());
      return true;
    },

    async verifyPasscode(pin) {
      const storedHash = localStorage.getItem(STORAGE_KEYS.PIN_HASH);
      if (!storedHash) return false;
      const enteredHash = await hashString(pin);
      const valid = storedHash === enteredHash;
      if (valid) {
        _activePin = pin;
        try { sessionStorage.setItem('vaulta_session_pin', pin); } catch (_) {}
        _activeKey = await deriveKey(pin, getVaultSalt());
      }
      return valid;
    },

    setSecurityEnabled(enabled) {
      if (enabled && !this.hasPasscode()) {
        throw new Error('Please set a passcode first');
      }
      localStorage.setItem(STORAGE_KEYS.ENABLED, enabled ? 'true' : 'false');
      if (!enabled) {
        localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
      } else if (localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CRED_ID)) {
        localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      }
    },

    async registerBiometric() {
      const status = this.getBiometricsStatus();
      if (!status.supported) {
        throw new Error(status.message);
      }
      const supported = await this.isBiometricsSupported();
      if (!supported) {
        throw new Error('Biometric authentication (Fingerprint / Face ID / Windows Hello) is not configured or available on this device.');
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const rp = {
        name: 'Vaulta App'
      };
      if (window.location.hostname && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)) {
        rp.id = window.location.hostname;
      }

      const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: rp,
        user: {
          id: userId,
          name: 'Vaulta User',
          displayName: 'Vaulta Owner'
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000,
        attestation: 'none'
      };

      try {
        const credential = await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions
        });

        if (credential) {
          const rawId = new Uint8Array(credential.rawId);
          const credIdStr = btoa(String.fromCharCode.apply(null, rawId));
          localStorage.setItem(STORAGE_KEYS.BIOMETRIC_CRED_ID, credIdStr);
          localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
          return true;
        }
      } catch (err) {
        console.error('[Security] Biometric registration error:', err);
        throw new Error(err.message || 'Biometric registration cancelled or failed');
      }
      return false;
    },

    async authenticateBiometric() {
      if (!this.isBiometricsEnabled()) {
        return false;
      }

      const credIdStr = localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CRED_ID);
      if (!credIdStr) return false;

      const binaryStr = atob(credIdStr);
      const rawId = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        rawId[i] = binaryStr.charCodeAt(i);
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions = {
        challenge: challenge,
        allowCredentials: [{
          id: rawId,
          type: 'public-key'
        }],
        userVerification: 'required',
        timeout: 60000
      };

      if (window.location.hostname && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)) {
        publicKeyCredentialRequestOptions.rpId = window.location.hostname;
      }

      try {
        const assertion = await navigator.credentials.get({
          publicKey: publicKeyCredentialRequestOptions
        });
        return !!assertion;
      } catch (err) {
        console.warn('[Security] Biometric auth failed/cancelled:', err);
        return false;
      }
    },

    disableBiometric() {
      localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
      localStorage.removeItem(STORAGE_KEYS.BIOMETRIC_CRED_ID);
    },

    suppressLock(durationMs = 25000) {
      _lockSuppressionUntil = Date.now() + durationMs;
    },

    isLockSuppressed() {
      return Date.now() < _lockSuppressionUntil;
    },

    clearLockSuppression() {
      _lockSuppressionUntil = 0;
    },

    lockApp(force = false) {
      if (!this.isSecurityEnabled()) return;
      if (!force && this.isLockSuppressed()) return;
      _isLocked = true;
      _activePin = null;
      _activeKey = null;
      try {
        sessionStorage.removeItem('vaulta_session_pin');
        sessionStorage.removeItem('vaulta_session_unlocked');
        sessionStorage.removeItem('vaulta_refreshing');
      } catch (_) {}
      this.showLockOverlay();
    },

    unlockApp() {
      _isLocked = false;
      this.hideLockOverlay();
      try {
        sessionStorage.setItem('vaulta_session_unlocked', 'true');
      } catch (_) {}
      if (!_activePin) {
        try {
          const sPin = sessionStorage.getItem('vaulta_session_pin');
          if (sPin) _activePin = sPin;
        } catch (_) {}
      }
      if (navigator.vibrate) {
        try { navigator.vibrate([20, 30, 20]); } catch (_) {}
      }
      if (window.DocUI && typeof window.DocUI.showToast === 'function') {
        window.DocUI.showToast('🔓 Vault Unlocked', 'success');
      }
    },

    isLocked() {
      return _isLocked;
    },

    showLockOverlay() {
      let overlay = document.getElementById('appLockOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'appLockOverlay';
        document.body.appendChild(overlay);
      }

      const bioEnabled = this.isBiometricsEnabled();
      const pinLen = this.getPinLength();

      let dotsHtml = '';
      for (let i = 0; i < pinLen; i++) {
        dotsHtml += '<span class="pin-dot"></span>';
      }

      overlay.innerHTML = `
        <div class="lock-card glass-panel anim-scale-in">
          <div class="lock-header">
            <div class="lock-app-icon">
              <svg class="logo-v-svg" viewBox="0 0 34 34" width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="lockVGradL" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#00f5ff" />
                    <stop offset="55%" stop-color="#0091ff" />
                    <stop offset="100%" stop-color="#0062ff" />
                  </linearGradient>
                  <linearGradient id="lockVGradR" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#0062ff" />
                    <stop offset="50%" stop-color="#4f46e5" />
                    <stop offset="100%" stop-color="#818cf8" />
                  </linearGradient>
                  <filter id="lockVGlow" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#00e5ff" flood-opacity="0.45" />
                  </filter>
                </defs>
                <g filter="url(#lockVGlow)">
                  <path d="M 6.5 7 L 14.8 24.5 C 15.7 26.4 18.3 26.4 19.2 24.5 L 27.5 7" 
                        stroke="url(#lockVGradL)" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M 17 25.5 L 27.5 7" 
                        stroke="url(#lockVGradR)" stroke-width="5.2" stroke-linecap="round"/>
                </g>
              </svg>
            </div>
            <h2 class="lock-title">Vaulta Locked</h2>
            <p class="lock-subtitle" id="lockSubtitleText">${bioEnabled ? 'Touch the fingerprint sensor to unlock' : 'Enter your Passcode PIN to access your files'}</p>
            <p class="lock-error-msg" id="lockErrorMsg" style="display:none; color: var(--color-danger); font-size: 0.82rem; font-weight: 600; margin-top: 8px; animation: fadeIn 0.3s;"></p>
          </div>

          <!-- Biometric View (Default when biometrics enabled) -->
          ${bioEnabled ? `
            <div class="bio-prompt-view" id="bioPromptView">
              <button type="button" class="bio-pulse-button" id="bioDirectTriggerBtn" title="Authenticate with Fingerprint" aria-label="Authenticate with Fingerprint">
                <div class="bio-pulse-ring"></div>
                <div class="bio-pulse-ring bio-pulse-ring-2"></div>
                <div class="bio-icon-large">
                  <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
                    <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.1-1.4.3-2"/>
                    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
                    <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
                    <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
                    <path d="M2 16h.01"/>
                    <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
                    <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/>
                  </svg>
                </div>
              </button>
              <p class="bio-touch-hint">Touch sensor or tap icon to prompt fingerprint</p>
              <button type="button" class="btn-switch-lock-mode" id="showPinPadBtn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Use Passcode PIN instead</span>
              </button>
            </div>
          ` : ''}

          <!-- PIN Keypad View -->
          <div class="pin-pad-view" id="pinPadView" ${bioEnabled ? 'style="display: none;"' : ''}>
            <div class="pin-display" id="pinDisplay">
              ${dotsHtml}
            </div>

            <div class="pin-keypad">
              <button class="keypad-btn" data-key="1">1</button>
              <button class="keypad-btn" data-key="2">2</button>
              <button class="keypad-btn" data-key="3">3</button>
              <button class="keypad-btn" data-key="4">4</button>
              <button class="keypad-btn" data-key="5">5</button>
              <button class="keypad-btn" data-key="6">6</button>
              <button class="keypad-btn" data-key="7">7</button>
              <button class="keypad-btn" data-key="8">8</button>
              <button class="keypad-btn" data-key="9">9</button>
              <button class="keypad-btn keypad-clear" id="keypadClear">C</button>
              <button class="keypad-btn" data-key="0">0</button>
              <button class="keypad-btn keypad-backspace" id="keypadBack">⌫</button>
            </div>

            ${bioEnabled ? `
              <div style="text-align: center; margin-top: var(--space-4);">
                <button type="button" class="btn-switch-lock-mode" id="backToBioBtn">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M9 6.8a6 6 0 0 1 9 5.2"/></svg>
                  <span>Use Fingerprint instead</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      overlay.style.display = 'flex';
      _currentPinInput = '';
      this.updatePinDisplay();
      this.bindLockOverlayEvents(overlay);

      if (bioEnabled) {
        setTimeout(() => {
          this.triggerBiometricUnlock();
        }, 250);
      }
    },

    hideLockOverlay() {
      const overlay = document.getElementById('appLockOverlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
    },

    updatePinDisplay() {
      const dots = document.querySelectorAll('#pinDisplay .pin-dot');
      dots.forEach((dot, index) => {
        if (index < _currentPinInput.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      });
    },

    async handlePinInput(digit) {
      const pinLen = this.getPinLength();
      if (_currentPinInput.length < pinLen) {
        if (navigator.vibrate) {
          try { navigator.vibrate(12); } catch (_) {}
        }
        _currentPinInput += digit;
        this.updatePinDisplay();

        if (_currentPinInput.length === pinLen) {
          const valid = await this.verifyPasscode(_currentPinInput);
          if (valid) {
            this.unlockApp();
          } else {
            this.triggerPinError();
          }
        }
      }
    },

    triggerPinError() {
      if (navigator.vibrate) {
        try { navigator.vibrate([40, 60, 40]); } catch (_) {}
      }
      const card = document.querySelector('.lock-card');
      const errorMsg = document.getElementById('lockErrorMsg');
      const dots = document.querySelectorAll('#pinDisplay .pin-dot');

      if (errorMsg) {
        errorMsg.textContent = '⚠️ Incorrect Passcode PIN. Try again.';
        errorMsg.style.display = 'block';
      }

      dots.forEach((d) => d.classList.add('error'));

      if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
      }

      setTimeout(() => {
        _currentPinInput = '';
        dots.forEach((d) => d.classList.remove('error'));
        this.updatePinDisplay();
      }, 400);
    },

    async triggerBiometricUnlock(isUserInitiated = false) {
      const bioBtn = document.getElementById('bioUnlockBtn');
      if (bioBtn) {
        bioBtn.classList.add('pulse-active');
      }
      try {
        const success = await this.authenticateBiometric();
        if (success) {
          this.unlockApp();
        } else if (isUserInitiated) {
          if (window.DocUI && typeof window.DocUI.showToast === 'function') {
            window.DocUI.showToast('Biometric prompt cancelled or not recognized. Try again or use PIN.', 'warning');
          }
        }
      } catch (e) {
        console.warn('[Security] Biometric unlock error:', e);
      } finally {
        if (bioBtn) {
          bioBtn.classList.remove('pulse-active');
        }
      }
    },

    bindLockOverlayEvents(overlay) {
      const keypadBtns = overlay.querySelectorAll('.keypad-btn[data-key]');
      keypadBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-key');
          this.handlePinInput(key);
        });
      });

      const clearBtn = overlay.querySelector('#keypadClear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (navigator.vibrate) {
            try { navigator.vibrate(10); } catch (_) {}
          }
          _currentPinInput = '';
          this.updatePinDisplay();
        });
      }

      const backBtn = overlay.querySelector('#keypadBack');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (navigator.vibrate) {
            try { navigator.vibrate(10); } catch (_) {}
          }
          if (_currentPinInput.length > 0) {
            _currentPinInput = _currentPinInput.slice(0, -1);
            this.updatePinDisplay();
          }
        });
      }

      const showPinBtn = overlay.querySelector('#showPinPadBtn');
      const backToBioBtn = overlay.querySelector('#backToBioBtn');
      const bioPromptView = overlay.querySelector('#bioPromptView');
      const pinPadView = overlay.querySelector('#pinPadView');
      const subtitle = overlay.querySelector('#lockSubtitleText');

      if (showPinBtn && bioPromptView && pinPadView) {
        showPinBtn.addEventListener('click', () => {
          bioPromptView.style.display = 'none';
          pinPadView.style.display = 'block';
          if (subtitle) subtitle.textContent = 'Enter your Passcode PIN to access your files';
        });
      }

      if (backToBioBtn && bioPromptView && pinPadView) {
        backToBioBtn.addEventListener('click', () => {
          pinPadView.style.display = 'none';
          bioPromptView.style.display = 'flex';
          if (subtitle) subtitle.textContent = 'Touch the fingerprint sensor to unlock';
          this.triggerBiometricUnlock(true);
        });
      }

      const bioDirectBtn = overlay.querySelector('#bioDirectTriggerBtn');
      if (bioDirectBtn) {
        bioDirectBtn.addEventListener('click', () => {
          this.triggerBiometricUnlock(true);
        });
      }

      const bioBtn = overlay.querySelector('#bioUnlockBtn');
      if (bioBtn) {
        bioBtn.addEventListener('click', () => {
          this.triggerBiometricUnlock(true);
        });
      }

      this.bindKeyboardEvents();
    },

    bindKeyboardEvents() {
      if (this._keyListenerBound) return;
      this._keyListenerBound = true;

      window.addEventListener('keydown', (e) => {
        if (!this.isLocked()) return;

        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          this.handlePinInput(e.key);

          const btn = document.querySelector(`.keypad-btn[data-key="${e.key}"]`);
          if (btn) {
            btn.style.transform = 'scale(0.92)';
            btn.style.background = 'var(--color-bg-glass-hover)';
            setTimeout(() => {
              btn.style.transform = '';
              btn.style.background = '';
            }, 120);
          }
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          if (_currentPinInput.length > 0) {
            _currentPinInput = _currentPinInput.slice(0, -1);
            this.updatePinDisplay();
          }
        } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
          e.preventDefault();
          _currentPinInput = '';
          this.updatePinDisplay();
        }
      });
    },

    async init() {
      _lockSuppressionUntil = 0;
      if (this.isSecurityEnabled()) {
        let wasUnlocked = false;
        let isRefreshing = false;
        let isRecentRefresh = false;
        try {
          wasUnlocked = sessionStorage.getItem('vaulta_session_unlocked') === 'true';
          isRefreshing = sessionStorage.getItem('vaulta_refreshing') === 'true';
          const refreshTime = parseInt(sessionStorage.getItem('vaulta_refresh_timestamp') || '0', 10);
          isRecentRefresh = refreshTime > 0 && (Date.now() - refreshTime) < 25000;
          sessionStorage.removeItem('vaulta_refreshing');
        } catch (_) {}

        if (wasUnlocked && (isRefreshing || isRecentRefresh)) {
          // Inside-app refresh! User was already authenticated and just refreshed/pulled-down.
          _isLocked = false;
          this.hideLockOverlay();
          try {
            const sPin = sessionStorage.getItem('vaulta_session_pin');
            if (sPin) _activePin = sPin;
          } catch (_) {}
          return;
        }

        this.lockApp(true);
      }
    }
  };

  window.SecurityModule = SecurityModule;
})(window);
