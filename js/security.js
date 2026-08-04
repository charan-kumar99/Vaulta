
(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    ENABLED: 'vaulta_security_enabled',
    PIN_HASH: 'vaulta_security_pin_hash',
    PIN_LEN: 'vaulta_security_pin_len',
    BIOMETRIC_ENABLED: 'vaulta_bio_enabled',
    BIOMETRIC_CRED_ID: 'vaulta_bio_cred_id',
    ENCRYPTION_ENABLED: 'vaulta_encryption_enabled'
  };

  let _isLocked = false;
  let _currentPinInput = '';

  async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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

  const SecurityModule = {
    
    isSecurityEnabled() {
      return localStorage.getItem(STORAGE_KEYS.ENABLED) === 'true';
    },

    hasPasscode() {
      return !!localStorage.getItem(STORAGE_KEYS.PIN_HASH);
    },

    isBiometricsEnabled() {
      return localStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED) === 'true' && !!localStorage.getItem(STORAGE_KEYS.BIOMETRIC_CRED_ID);
    },

    async isBiometricsSupported() {
      if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        try {
          return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
          console.warn('[Security] WebAuthn support check failed:', e);
          return false;
        }
      }
      return false;
    },

    getPinLength() {
      const len = parseInt(localStorage.getItem(STORAGE_KEYS.PIN_LEN) || '4', 10);
      return (isNaN(len) || len < 4) ? 4 : len;
    },
    
    isEncryptionEnabled() {
      return localStorage.getItem(STORAGE_KEYS.ENCRYPTION_ENABLED) === 'true';
    },

    setEncryptionEnabled(enabled) {
      localStorage.setItem(STORAGE_KEYS.ENCRYPTION_ENABLED, enabled ? 'true' : 'false');
    },

    async encryptBlob(blob, pin) {
      if (!blob || !pin) return blob;
      const arrayBuffer = await blob.arrayBuffer();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(pin, salt);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer);

      const packed = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      packed.set(salt, 0);
      packed.set(iv, salt.length);
      packed.set(new Uint8Array(encrypted), salt.length + iv.length);

      return new Blob([packed], { type: 'application/octet-stream' });
    },

    async decryptBlob(blob, pin, originalMimeType = 'application/octet-stream') {
      if (!blob || !pin) return blob;
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const dataView = new Uint8Array(arrayBuffer);
        const salt = dataView.slice(0, 16);
        const iv = dataView.slice(16, 28);
        const ciphertext = dataView.slice(28);

        const key = await deriveKey(pin, salt);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new Blob([decrypted], { type: originalMimeType });
      } catch (e) {
        console.error('[Security] Blob decryption failed:', e);
        throw new Error('Decryption failed. Incorrect passcode PIN.');
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
      return true;
    },

    async verifyPasscode(pin) {
      const storedHash = localStorage.getItem(STORAGE_KEYS.PIN_HASH);
      if (!storedHash) return false;
      const enteredHash = await hashString(pin);
      return storedHash === enteredHash;
    },

    setSecurityEnabled(enabled) {
      if (enabled && !this.hasPasscode()) {
        throw new Error('Please set a passcode first');
      }
      localStorage.setItem(STORAGE_KEYS.ENABLED, enabled ? 'true' : 'false');
      if (!enabled) {
        localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
      }
    },

    async registerBiometric() {
      const supported = await this.isBiometricsSupported();
      if (!supported) {
        throw new Error('Biometric authentication is not supported or enabled on this device.');
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: 'Vaulta App',
          id: window.location.hostname
        },
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

    lockApp() {
      if (!this.isSecurityEnabled()) return;
      _isLocked = true;
      this.showLockOverlay();
    },

    unlockApp() {
      _isLocked = false;
      this.hideLockOverlay();
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
        <div class="lock-card glass-panel">
          <div class="lock-header">
            <div class="lock-app-icon">⚡</div>
            <h2 class="lock-title">Vaulta Locked</h2>
            <p class="lock-subtitle">Enter your Passcode or use Biometrics to access your files</p>
            <p class="lock-error-msg" id="lockErrorMsg" style="display:none; color: var(--color-danger); font-size: 0.82rem; font-weight: 600; margin-top: 8px; animation: fadeIn 0.3s;"></p>
          </div>

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
            <div class="biometric-trigger-wrap">
              <button type="button" class="btn btn-secondary biometric-btn" id="bioUnlockBtn">
                <span class="bio-icon">🖐️</span> Unlock with Fingerprint / Face
              </button>
            </div>
          ` : ''}
        </div>
      `;

      overlay.style.display = 'flex';
      _currentPinInput = '';
      this.updatePinDisplay();
      this.bindLockOverlayEvents(overlay);

      if (bioEnabled) {
        setTimeout(() => {
          this.triggerBiometricUnlock();
        }, 300);
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

    async triggerBiometricUnlock() {
      const success = await this.authenticateBiometric();
      if (success) {
        this.unlockApp();
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
          _currentPinInput = '';
          this.updatePinDisplay();
        });
      }

      const backBtn = overlay.querySelector('#keypadBack');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (_currentPinInput.length > 0) {
            _currentPinInput = _currentPinInput.slice(0, -1);
            this.updatePinDisplay();
          }
        });
      }

      const bioBtn = overlay.querySelector('#bioUnlockBtn');
      if (bioBtn) {
        bioBtn.addEventListener('click', () => {
          this.triggerBiometricUnlock();
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
      if (this.isSecurityEnabled()) {
        this.lockApp();
      }
    }
  };

  window.SecurityModule = SecurityModule;
})(window);
