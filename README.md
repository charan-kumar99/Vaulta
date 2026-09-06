# ⚡ Vaulta — Secure Personal Document Manager

> **A private, offline-first Progressive Web App (PWA) to securely store, organize, scan, convert, protect, and backup your personal & official documents.**

---

## ✨ Key Features

- 🔒 **Biometric & PIN App Lock**:
  - Secure your vaults with a 4–6 digit Passcode PIN or device biometric sensors (Fingerprint, Touch ID, Face ID, Windows Hello via WebAuthn).
  - Background auto-lock when leaving the tab or minimizing the app, with smart suppression during native camera capture and file picker workflows.
  - Client-side cryptographic hashing — zero remote server dependencies.

- 🛡️ **Screen Privacy & Anti-Screenshot Shield (`VaultaScreenSec`)**:
  - Obfuscates and blurs document content during app switching, multitasking, and window blur to prevent snooping.
  - Intercepts screenshot shortcuts (`PrintScreen`, `Win + Shift + S`) and blocks unauthorized context menus.
  - Easily toggled on or off in Settings and Security modals.

- 📷 **Live Document & ID Camera Scanner**:
  - Interactive full-screen viewfinder HUD with target reticle lines, animated laser scanner, and camera flipping (environment/user).
  - Native fallback to device high-resolution camera input if `getUserMedia` is unsupported.
  - Direct instant capture with automatic image-to-document ingestion.

- 📂 **Dual Vault System & Nested Folder Hierarchy**:
  - Dedicated **Personal Vault** (Identity, Finance, Health, Family) and **Official Vault** (Employment, Tax, Legal, Contracts).
  - Infinite nested folder structures, breadcrumb navigation, document counts, and custom category badges.

- 📅 **Custom Glassmorphic Calendar & Date Picker**:
  - Fully custom styled month and year dropdown selectors matching the app's glassmorphic aesthetics.
  - Day picker with quick navigation and automatic format standardization (`YYYY-MM-DD`).

- 🔔 **Document Expiry Tracking & Proactive Alerts**:
  - Comprehensive expiry tracker modal displaying expired, expiring soon (<= 30 days), and active documents.
  - System toast reminders upon startup when renewals are pending.

- 📦 **Offline Backup & Export (.ZIP Archive)**:
  - One-click encrypted offline backup generating a structured `.zip` containing all documents, metadata, folders, and categories.
  - Fast offline export using client-side JSZip.

- 📊 **Storage Analytics**:
  - Real-time disk space usage, category breakdown charts, and document size distributions stored inside IndexedDB.

- 🌙 **Modern Glassmorphic UI & Themes**:
  - Curated dark and light themes with smooth micro-animations, SVG vector icons, touch-friendly bottom sheets, and responsive mobile layouts.

---

## 🚀 Quick Start

Vaulta is built with vanilla web technologies (HTML5, CSS3, ES6+ JS, IndexedDB) with zero build steps or npm installations required.

### Run Locally

```bash
# Using Python 3
python -m http.server 8090

# Or using Node.js
npx http-server -p 8090
```

Open your browser at `http://localhost:8090`.

---

## 📱 Installing as a Progressive Web App (PWA)

1. Open Vaulta in Chrome, Edge, or Safari on your mobile device or computer.
2. **Android (Chrome)**: Tap **"📲 Install App"** in the top bar or tap the Chrome menu (`⋮`) $\rightarrow$ **Install app**.
3. **iOS (Safari)**: Tap **Share** $\rightarrow$ **Add to Home Screen**.
4. **Desktop (Chrome/Edge)**: Click the Install icon in the address bar.
5. Vaulta operates standalone with full offline persistence.

---

## 🛠️ Tech Architecture

- **Core Engine**: Vanilla HTML5, CSS3 (Custom Design System with CSS variables), ES6+ JavaScript.
- **Storage Layer**: IndexedDB (`docvault_db`) for zero-cloud, encrypted offline persistence of files and metadata.
- **Security & Privacy**: Web Cryptography API, WebAuthn API for biometrics, and dynamic DOM occlusion shields.
- **PWA / Service Worker**: `sw.js` for offline caching and background sync.
- **Document Processing**: `pdf.js` for client-side PDF rendering, `jszip` for offline backup archives.

---

## 📄 License

MIT License — 100% Free, Private, and Open Source.
