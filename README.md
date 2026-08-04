# ⚡ Vaulta — Personal Document Manager

> **A private, offline-first Progressive Web App (PWA) to securely store, organize, convert, search, and backup your personal & official documents.**

---

## ✨ Key Features

- 🔒 **App Security & Privacy Lock**: Protect your documents with PIN or Pattern lock. Supports auto-locking when switching tabs or minimizing the app. 100% local client-side storage — zero cloud tracking.
- 📂 **Dual Vault System & Folders**: Separate **Personal** and **Official** document vaults with custom folders, smart categories, and tags.
- 🔄 **In-App Format Converter**: Convert document images seamlessly into **PDF**, **PNG**, **JPG**, **WebP**, or text notes during export and sharing.
- 📱 **Installable Offline PWA**: Works 100% offline. Install directly to your iOS or Android home screen with native app capabilities.
- 🔍 **Instant Full-Text Search**: Fuzzy and relevance-based search across document titles, categories, tags, and folders.
- 🔔 **Document Expiry Tracking & Alerts**: Automated background monitoring for document expiration dates with desktop and mobile notification triggers.
- 💾 **Data Backup & Encrypted Sync**: Export and import complete JSON backups or encrypted Secret Sync packages between devices.
- 🌙 **Glassmorphic UI**: High-contrast dark and light modes with smooth animations, modern typography, and mobile-responsive layouts.

---

## 🚀 Quick Start

### Run Locally

Vaulta is built with pure vanilla web technologies (HTML5, CSS3, ES6+ JS, IndexedDB). Serve it locally using any HTTP server:

```bash
# Using Python 3
python -m http.server 8090

# Or using Node.js
npx http-server -p 8090
```

Open your browser at `http://localhost:8090`.

---

## 📱 Installing as a Progressive Web App (PWA)

1. Open Vaulta in your mobile browser.
2. **Android (Chrome)**: Click **"📲 Install App"** in the top bar or tap Chrome menu (`⋮`) $\rightarrow$ **Install app**.
3. **iOS (Safari)**: Tap **Share** $\rightarrow$ **Add to Home Screen**.
4. Launch Vaulta from your home screen as a standalone application.

---

## 🛠️ Tech Architecture

- **Core**: Vanilla HTML5, CSS3, ES6 JavaScript (No external framework dependencies).
- **Storage**: IndexedDB API (`docvault_db`) for encrypted client-side storage of document files and metadata.
- **PWA**: Service Worker (`sw.js`) for offline caching, background periodicsync, and desktop push notifications.
- **Design System**: Modular CSS design system with CSS custom properties, glassmorphism, and keyframe animations.

---

## 📄 License

MIT License — Free to use, modify, and distribute privately or publicly.
