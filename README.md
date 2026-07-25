# ⚡ Vaulta — Personal Document Manager

> **A private, offline-first Progressive Web App (PWA) to securely organize, search, preview, and backup your personal & official documents.**

---

## ✨ Features

- 🔒 **100% Private & Offline-First**: All files, metadata, and categories are stored locally in your browser via **IndexedDB**. Zero cloud server required.
- 📱 **Installable Mobile PWA**: Install Vaulta directly to your phone's home screen / app drawer (iOS & Android) with standalone native app UI.
- 🔍 **Instant Search & Filtering**: Fast full-text search across titles, descriptions, categories, and custom tags.
- 📂 **Smart Category Management**: Organize documents into Personal, Work, Financial, Medical, Identity, and custom categories.
- 👁️ **In-App Document Preview**: Preview images, PDFs, text, and documents directly inside the app.
- 💾 **Data Backup & Restore**: Export your document vault metadata as JSON backups and restore them anytime.
- 🌙 **Modern Glassmorphic Dark UI**: Built with dynamic animations, modern typography, responsive layouts, and dark/light mode toggle.

---

## 🚀 Quick Start

### 1. Run Locally
Because Vaulta is built with pure web technologies (HTML, CSS, JS), you can serve it with any lightweight web server:

```bash
# Using Python
python -m http.server 8090

# Or using Node.js npx http-server
npx http-server -p 8090
```

Open your browser at `http://localhost:8090`.

---

## 📱 Installing as a Phone App (PWA)

1. Open Vaulta on your phone browser (`http://<YOUR_COMPUTER_IP>:8090` or your deployed web host).
2. **Android (Chrome)**: Tap **"Install App"** in the app header or select **"Add to Home screen"** / **"Install app"** from Chrome menu (`⋮`).
3. **iPhone (Safari)**: Tap **Share** $\rightarrow$ **Add to Home Screen**.
4. Vaulta will install into your phone's app launcher as a standalone app!

---

## 🛠️ Built With

- **HTML5 & CSS3**: Custom CSS variables, glassmorphism, responsive grid layout.
- **JavaScript (ES6+)**: Vanilla modular architecture.
- **IndexedDB API**: High-performance client-side document database.
- **Service Worker & Web App Manifest**: PWA installation and offline caching engine.

---

## 🐙 Pushing to GitHub

To publish Vaulta to your GitHub account, run the following commands in your terminal:

```bash
git init
git add .
git commit -m "Initial commit: Vaulta PWA Personal Document Manager"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vaulta.cmd
git push -u origin main
```

---

## 📄 License

MIT License — Free to use, modify, and distribute privately or publicly.
