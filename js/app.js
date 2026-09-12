
const DocApp = (() => {
  
  const state = {
    currentScreen: 'home', 
    currentVault: null, 
    currentFolderId: null, 
    activeCategory: 'all',
    homeActiveCategory: 'all',
    sortBy: 'date-desc',
    searchQuery: '',
    selectedFile: null,
    currentPreviewUrl: null,
    selectMode: false,
    selectedDocs: new Set(),
  };

  const mainContainer = () => document.getElementById('app');
  const modalsContainer = () => document.getElementById('modals');

  function triggerHaptic(pattern = 15) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  let activeSwipedInner = null;
  let wasSwiping = false;

  function closeActiveSwiped() {
    if (activeSwipedInner) {
      activeSwipedInner.style.transform = '';
      activeSwipedInner.classList.remove('swiping');
      delete activeSwipedInner.dataset.swipedOffset;
      activeSwipedInner = null;
    }
  }

  async function init() {
    
    await DocDB.open();

    const savedTheme = localStorage.getItem('docvault_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    window.addEventListener('hashchange', handleRoute);

    window.addEventListener('popstate', (e) => {
      if (document.body.classList.contains('preview-open')) {
        closePreview(true);
        return;
      }
      const modals = modalsContainer();
      if (modals && modals.innerHTML.trim() !== '') {
        modals.innerHTML = '';
        syncActiveTab();
      }
    });

    bindBottomNav();
    initScreenSecurity();

    const directCam = document.getElementById('directCameraInput');
    if (directCam) {
      directCam.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          window.SecurityModule?.suppressLock(45000);
          openUploadModal();
          setTimeout(() => {
            handleFileSelect(file);
          }, 60);
          directCam.value = '';
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (activeSwipedInner && !e.target.closest('.doc-card-swipe-wrapper')) {
        closeActiveSwiped();
      }
    });

    handleRoute();

    checkExpiryNotifications();

    // Check if app was opened via Share Target (e.g. from WhatsApp share sheet)
    checkShareTarget();
  }

  // ── Share Target: retrieve file stashed by service worker and open upload modal ──
  async function checkShareTarget() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('share-target')) return;

      // Clean up the URL so refreshing doesn't re-trigger
      const cleanUrl = window.location.pathname + (window.location.hash || '');
      window.history.replaceState(null, '', cleanUrl);

      // Open the share-target IndexedDB and retrieve the pending file
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('vaulta_share_target', 1);
        req.onupgradeneeded = (e) => {
          const database = e.target.result;
          if (!database.objectStoreNames.contains('pending_files')) {
            database.createObjectStore('pending_files', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction('pending_files', 'readwrite');
        const store = tx.objectStore('pending_files');
        const getReq = store.get('latest');
        getReq.onsuccess = () => {
          const result = getReq.result;
          // Delete the record after retrieving so it doesn't persist
          store.delete('latest');
          resolve(result || null);
        };
        getReq.onerror = () => reject(getReq.error);
      });

      db.close();

      if (!record || !record.data) {
        DocUI.showToast('📎 Shared file could not be loaded. Please try again.', 'error');
        return;
      }

      // Reconstruct a File object from the stored ArrayBuffer
      const blob = new Blob([record.data], { type: record.type });
      const file = new File([blob], record.name, {
        type: record.type,
        lastModified: record.timestamp || Date.now()
      });

      // Use the shared title as document name if available, else derive from filename
      const prefillName = record.title
        || record.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
        || 'Shared Document';

      // Open upload modal and attach the shared file
      openUploadModal({ name: prefillName });
      
      // Give the modal time to render, then inject the file
      setTimeout(() => {
        handleFileSelect(file);
        DocUI.showToast('📥 Document received! Fill in the details and save.', 'success', 4000);
      }, 150);

    } catch (err) {
      console.error('[Vaulta] Share target handling failed:', err);
      DocUI.showToast('Failed to process shared file. Please try uploading manually.', 'error');
    }
  }

  function parseStandardDate(str) {
    if (!str) return null;
    str = String(str).trim();
    if (!str) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return str;
  }

  async function checkExpiryNotifications(force = false) {
    if (!force && sessionStorage.getItem('vaulta_expiry_notified') === 'true') return;
    sessionStorage.setItem('vaulta_expiry_notified', 'true');

    try {
      const dbObj = window.DocDB || (typeof DocDB !== 'undefined' ? DocDB : null);
      if (!dbObj) return;

      const allDocs = await dbObj.getAll();
      const expiredDocs = [];
      const expiringSoonDocs = [];

      allDocs.forEach((doc) => {
        if (doc.expiryDate && typeof dbObj.getExpiryStatus === 'function') {
          const exp = dbObj.getExpiryStatus(doc.expiryDate);
          if (exp.status === 'expired') {
            expiredDocs.push(doc);
          } else if (exp.status === 'expiring-soon') {
            expiringSoonDocs.push({ doc, daysLeft: exp.daysLeft });
          }
        }
      });

      if (expiredDocs.length > 0) {
        const msg = expiredDocs.length === 1
          ? `🔴 Expiry Alert: "${expiredDocs[0].name}" has EXPIRED!`
          : `🔴 Expiry Alert: ${expiredDocs.length} documents have EXPIRED!`;
        DocUI.showToast(msg, 'error', 7000);
        triggerNativeNotification('Vaulta Document Expiry Alert', msg);
      }

      if (expiringSoonDocs.length > 0) {
        setTimeout(() => {
          const first = expiringSoonDocs[0];
          const msg = expiringSoonDocs.length === 1
            ? `🟡 Renewal Warning: "${first.doc.name}" expires in ${first.daysLeft} days!`
            : `🟡 Renewal Warning: ${expiringSoonDocs.length} documents are expiring soon!`;
          DocUI.showToast(msg, 'warning', 7000);
          triggerNativeNotification('Vaulta Document Renewal Alert', msg);
        }, 1200);
      }
    } catch (e) {
      console.error('Expiry notification check failed:', e);
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      DocUI.showToast('Desktop Notifications are not supported by this browser.', 'error');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      DocUI.showToast('🔔 Universal System Notifications enabled!', 'success');
      triggerNativeNotification('Vaulta Notifications Enabled', 'You will now receive universal alerts in your phone & laptop notification bar even when the app is closed!');

      if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.periodicSync.register('vaulta-check-expiries', {
            minInterval: 12 * 60 * 60 * 1000
          });
        } catch (e) {
          console.log('Periodic sync registration info:', e);
        }
      }
    } else {
      DocUI.showToast('Notification permission denied in browser settings.', 'error');
    }
  }

  function triggerNativeNotification(title, body) {
    if (!('Notification' in window)) return;

    const options = {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      requireInteraction: true
    };

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (e) {
        console.warn('Native notification fallback:', e);
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, options);
        }).catch(() => {});
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          triggerNativeNotification(title, body);
        }
      });
    }
  }

  function handleRoute() {
    const hash = window.location.hash || '#home';

    if (hash === '#home' || hash === '#') {
      state.currentScreen = 'home';
      state.currentVault = null;
      state.currentFolderId = null;
      state.activeCategory = 'all';
      state.homeActiveCategory = 'all';
      state.searchQuery = '';
      updateActiveTab('home');
      renderCurrentScreen();
    } else if (hash.startsWith('#vault/')) {
      const vault = hash.replace('#vault/', '');
      if (vault === 'personal' || vault === 'official') {
        state.currentScreen = 'vault';
        state.currentVault = vault;
        state.currentFolderId = null;
        state.activeCategory = 'all';
        state.searchQuery = '';
        updateActiveTab('vaults');
        renderCurrentScreen();
      }
    }
  }

  function navigate(screen, vault = null) {
    const targetHash = screen === 'home' ? '#home' : (screen === 'vault' && vault ? `#vault/${vault}` : '#home');
    if (window.location.hash === targetHash) {
      handleRoute();
    } else {
      window.location.hash = targetHash;
    }
  }

  async function renderCurrentScreen() {
    const container = mainContainer();

    if (state.currentScreen === 'home') {
      await renderHomeScreen(container);
    } else if (state.currentScreen === 'vault') {
      await renderVaultScreen(container);
    }

    bindEvents();
  }

  async function renderHomeScreen(container) {
    const counts = await DocDB.getCounts();
    const allDocs = await DocDB.getAll();
    const favoriteDocs = await DocDB.getFavorites();

    const filteredDocs = (state.homeActiveCategory && state.homeActiveCategory !== 'all')
      ? allDocs.filter((d) => (d.category || '').toLowerCase() === state.homeActiveCategory.toLowerCase())
      : allDocs;

    DocUI.renderHome(container, {
      personalCount: counts.personal,
      officialCount: counts.official,
      allDocs,
      filteredDocs,
      favoriteDocs,
      activeCategory: state.homeActiveCategory || 'all',
    });
  }

  async function renderVaultScreen(container) {
    const allDocs = await DocDB.getAllByVault(state.currentVault);

    const subFolders = DocUI.getChildFolders(state.currentVault, state.currentFolderId);
    const currentFolder = DocUI.getFolder(state.currentFolderId);
    const folderPath = DocUI.getFolderPath(state.currentFolderId);

    const subFolderCounts = {};
    subFolders.forEach((sf) => {
      const sfChildren = DocUI.getChildFolders(state.currentVault, sf.id).length;
      const sfDocs = allDocs.filter((d) => d.folderId === sf.id || d.folder === sf.name).length;
      subFolderCounts[sf.id] = sfChildren + sfDocs;
    });

    let filteredDocs = [];
    let displaySubFolders = subFolders;

    if (state.searchQuery) {
      filteredDocs = DocSearch.query(allDocs, {
        searchQuery: state.searchQuery,
        filters: { category: state.activeCategory },
        sortBy: state.sortBy,
      });
      displaySubFolders = [];
    } else {
      const directDocs = allDocs.filter((d) => {
        if (state.currentFolderId) {
          return d.folderId === state.currentFolderId || d.folder === (currentFolder ? currentFolder.name : '');
        } else {
          return !d.folderId && !d.folder;
        }
      });

      filteredDocs = DocSearch.query(directDocs, {
        filters: { category: state.activeCategory },
        sortBy: state.sortBy,
      });
    }

    DocUI.renderVault(container, {
      vault: state.currentVault,
      currentFolder,
      folderPath,
      subFolders: displaySubFolders,
      subFolderCounts,
      documents: filteredDocs,
      activeCategory: state.activeCategory,
      sortBy: state.sortBy,
    });
  }

  function bindEvents() {
    const container = mainContainer();

    container.removeEventListener('click', handleClick);
    container.addEventListener('click', handleClick);

    bindSearchEvents();
    bindFAB();
    bindVaultCards();
    bindSortDropdown();
    bindCategoryChips();
    bindHomeCategoryChips();
    bindFolderCardEvents();
    bindBackButton();
    bindBulkSelect();
    bindLongPressToSelect();
    bindSecretSyncEvents();
    bindSwipeGestures();
    bindBottomNav();
  }

  function bindHomeCategoryChips() {
    const chipsContainer = document.getElementById('homeCategoryChips');
    if (!chipsContainer) return;

    chipsContainer.addEventListener('click', async (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;

      const cat = chip.dataset.category;
      if (!cat) return;

      state.homeActiveCategory = cat;
      await renderCurrentScreen();
    });
  }

  function bindBackButton() {
    const backBtn = document.getElementById('backToHome') || document.getElementById('vaultBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (state.currentFolderId) {
          const folder = DocUI.getFolder(state.currentFolderId);
          state.currentFolderId = folder ? folder.parentId : null;
          renderCurrentScreen();
        } else {
          navigate('home');
        }
      });
    }

    const heroBadge = document.getElementById('vaultHeroBadge');
    if (heroBadge) {
      heroBadge.addEventListener('click', () => {
        DocUI.renderSecurityModal();
      });
    }
  }

  let longPressTimer = null;
  let isLongPressTriggered = false;
  let startX = 0;
  let startY = 0;

  function bindLongPressToSelect() {
    const container = mainContainer();
    if (!container) return;

    container.removeEventListener('pointerdown', handlePointerDown);
    container.removeEventListener('pointerup', handlePointerUp);
    container.removeEventListener('pointermove', handlePointerMove);
    container.removeEventListener('pointercancel', handlePointerUp);

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointercancel', handlePointerUp);
  }

  function handlePointerDown(e) {
    const card = e.target.closest('.doc-card');
    if (!card) return;

    const docId = card.dataset.docId;
    const docVault = card.dataset.vault || 'personal';
    if (!docId) return;

    if (e.target.closest('.doc-action-btn') || e.target.closest('.doc-select-checkbox')) {
      return;
    }

    startX = e.clientX;
    startY = e.clientY;
    isLongPressTriggered = false;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(async () => {
      isLongPressTriggered = true;

      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (_) {}
      }

      if (state.currentScreen !== 'vault' || state.currentVault !== docVault) {
        state.currentScreen = 'vault';
        state.currentVault = docVault;
        window.location.hash = `#vault/${docVault}`;
        await renderCurrentScreen();
      }

      if (!state.selectMode) {
        enterSelectMode();
      }

      handleToggleSelect(docId);
      DocUI.showToast('Select mode activated', 'info', 1500);
    }, 450);
  }

  function handlePointerMove(e) {
    if (!longPressTimer) return;
    const diffX = Math.abs(e.clientX - startX);
    const diffY = Math.abs(e.clientY - startY);
    if (diffX > 10 || diffY > 10) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handlePointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  async function handleDeleteDoc(docId) {
    try {
      const doc = await DocDB.getDocument(docId);
      openDeleteConfirm(docId, doc ? doc.name : 'Document');
    } catch (err) {
      console.error('Failed to get document for delete:', err);
    }
  }

  async function handleQuickAction(action) {
    switch (action) {
      case 'scan': {
        window.SecurityModule?.suppressLock(60000);
        if (DocUI && typeof DocUI.openCameraScannerModal === 'function') {
          await DocUI.openCameraScannerModal();
        } else {
          const directCam = document.getElementById('directCameraInput');
          if (directCam) {
            directCam.click();
          } else {
            openUploadModal({ autoCamera: true });
          }
        }
        break;
      }
      case 'upload': {
        openUploadModal();
        break;
      }
      case 'favorites': {
        if (state.currentScreen !== 'home') {
          await navigate('home');
        }
        const favSection = document.querySelector('.favorites-row');
        if (favSection) {
          favSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          DocUI.showToast('No starred documents yet. Tap the star icon on any document to add it to Starred!', 'info');
        }
        break;
      }
      case 'expiring': {
        if (DocUI && typeof DocUI.renderExpiryTrackerModal === 'function') {
          await DocUI.renderExpiryTrackerModal();
        } else {
          DocUI.showToast('Opening expiry tracker...', 'info');
        }
        break;
      }
    }
  }

  function handleClick(e) {
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (wasSwiping) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (activeSwipedInner) {
      const isSwipeBtn = e.target.closest('.swipe-action-btn');
      closeActiveSwiped();
      if (!isSwipeBtn) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const quickPill = e.target.closest('.quick-action-pill');
    if (quickPill) {
      e.preventDefault();
      e.stopPropagation();
      triggerHaptic(15);
      const action = quickPill.dataset.quickAction;
      handleQuickAction(action);
      return;
    }

    const templateChip = e.target.closest('.template-chip');
    if (templateChip) {
      e.preventDefault();
      e.stopPropagation();
      triggerHaptic(15);
      const name = templateChip.dataset.templateName || '';
      const category = templateChip.dataset.templateCategory || '';
      const vault = templateChip.dataset.templateVault || 'personal';
      openUploadModal({ name, category, vault, autoBrowse: true });
      return;
    }

    const target = e.target.closest('[data-action], [data-swipe-action]');
    if (!target) return;

    const action = target.dataset.action || target.dataset.swipeAction;
    const docId = target.dataset.docId;

    e.stopPropagation();

    switch (action) {
      case 'preview':
        openPreview(docId);
        break;
      case 'favorite':
        triggerHaptic(15);
        toggleFavorite(docId);
        break;
      case 'share':
        triggerHaptic(15);
        shareDoc(docId);
        break;
      case 'delete':
        triggerHaptic(20);
        handleDeleteDoc(docId);
        break;
      case 'toggle-select':
        triggerHaptic(15);
        handleToggleSelect(docId);
        break;
    }
  }

  function bindSwipeGestures() {
    const container = mainContainer();
    if (!container || container.dataset.swipeBound === 'true') return;
    container.dataset.swipeBound = 'true';

    let touchStartX = 0;
    let touchStartY = 0;
    let currentDx = 0;
    let currentDy = 0;
    let isHorizontalSwipe = false;
    let isGestureDetermined = false;
    let targetCardInner = null;
    let hasHapticFired = false;

    container.addEventListener('touchstart', (e) => {
      if (state.selectMode) return;
      const touch = e.touches[0];
      if (!touch) return;

      const actionBtn = e.target.closest('.swipe-action-btn');
      if (actionBtn) return;

      const inner = e.target.closest('.doc-card-inner');
      const card = e.target.closest('.doc-card');

      if (activeSwipedInner && activeSwipedInner !== inner) {
        closeActiveSwiped();
      }

      if (!inner || !card) return;

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      currentDx = 0;
      currentDy = 0;
      isHorizontalSwipe = false;
      isGestureDetermined = false;
      hasHapticFired = false;
      targetCardInner = inner;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!targetCardInner || state.selectMode) return;
      const touch = e.touches[0];
      if (!touch) return;

      currentDx = touch.clientX - touchStartX;
      currentDy = touch.clientY - touchStartY;

      if (!isGestureDetermined) {
        if (Math.abs(currentDx) > 8 || Math.abs(currentDy) > 8) {
          isGestureDetermined = true;
          if (Math.abs(currentDx) > Math.abs(currentDy)) {
            isHorizontalSwipe = true;
            wasSwiping = true;
            targetCardInner.classList.add('swiping');
          } else {
            isHorizontalSwipe = false;
            targetCardInner = null;
            return;
          }
        } else {
          return;
        }
      }

      if (!isHorizontalSwipe) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      let tx = currentDx;
      if (activeSwipedInner === targetCardInner && targetCardInner.dataset.swipedOffset) {
        tx += parseFloat(targetCardInner.dataset.swipedOffset);
      }

      if (tx < -75) {
        tx = -75 - Math.pow(Math.abs(tx + 75), 0.7);
      } else if (tx > 145) {
        tx = 145 + Math.pow(tx - 145, 0.7);
      }

      if (!hasHapticFired) {
        if (tx < -45 || tx > 60) {
          triggerHaptic(15);
          hasHapticFired = true;
        }
      } else if (tx > -35 && tx < 45) {
        hasHapticFired = false;
      }

      targetCardInner.style.transform = `translateX(${tx}px)`;
    }, { passive: false });

    container.addEventListener('touchend', () => {
      if (!targetCardInner) return;

      targetCardInner.classList.remove('swiping');

      if (!isHorizontalSwipe) {
        targetCardInner = null;
        return;
      }

      let tx = currentDx;
      if (activeSwipedInner === targetCardInner && targetCardInner.dataset.swipedOffset) {
        tx += parseFloat(targetCardInner.dataset.swipedOffset);
      }

      if (tx < -45) {
        targetCardInner.style.transform = 'translateX(-70px)';
        targetCardInner.dataset.swipedOffset = '-70';
        activeSwipedInner = targetCardInner;
        triggerHaptic(15);
      } else if (tx > 50) {
        targetCardInner.style.transform = 'translateX(140px)';
        targetCardInner.dataset.swipedOffset = '140';
        activeSwipedInner = targetCardInner;
        triggerHaptic(15);
      } else {
        targetCardInner.style.transform = '';
        delete targetCardInner.dataset.swipedOffset;
        if (activeSwipedInner === targetCardInner) {
          activeSwipedInner = null;
        }
      }

      targetCardInner = null;
      isHorizontalSwipe = false;
      isGestureDetermined = false;

      setTimeout(() => {
        wasSwiping = false;
      }, 250);
    }, { passive: true });

    container.addEventListener('touchcancel', () => {
      if (targetCardInner) {
        targetCardInner.classList.remove('swiping');
        targetCardInner.style.transform = '';
        delete targetCardInner.dataset.swipedOffset;
        if (activeSwipedInner === targetCardInner) {
          activeSwipedInner = null;
        }
        targetCardInner = null;
      }
      isHorizontalSwipe = false;
      isGestureDetermined = false;
      wasSwiping = false;
    }, { passive: true });
  }

  function bindBottomNav() {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav || bottomNav.dataset.bound === 'true') return;
    bottomNav.dataset.bound = 'true';

    bottomNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nav]');
      if (!btn) return;

      const navTarget = btn.dataset.nav;
      triggerHaptic(15);

      switch (navTarget) {
        case 'home': {
          const modals = modalsContainer();
          if (modals) modals.innerHTML = '';
          document.body.classList.remove('modal-open');
          navigate('home');
          updateActiveTab('home');
          break;
        }
        case 'vaults': {
          const existingVaultsSheet = document.getElementById('vaultsSheetOverlay');
          const modals = modalsContainer();
          if (existingVaultsSheet) {
            if (modals) modals.innerHTML = '';
            document.body.classList.remove('modal-open');
            syncActiveTab();
          } else {
            if (modals) modals.innerHTML = '';
            document.body.classList.remove('modal-open');
            DocUI.renderVaultsSheet();
            updateActiveTab('vaults');
          }
          break;
        }
        case 'upload': {
          const modals = modalsContainer();
          if (modals) modals.innerHTML = '';
          document.body.classList.remove('modal-open');
          triggerHaptic(20);
          openUploadModal();
          break;
        }
        case 'search': {
          const modals = modalsContainer();
          if (modals) modals.innerHTML = '';
          document.body.classList.remove('modal-open');
          updateActiveTab('search');
          const searchInput = document.getElementById('globalSearch');
          if (searchInput) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            navigate('home');
            setTimeout(() => {
              const input = document.getElementById('globalSearch');
              if (input) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                input.focus();
              }
            }, 100);
          }
          break;
        }
        case 'settings': {
          const existingSettingsSheet = document.getElementById('settingsSheetOverlay');
          const existingSecModal = document.getElementById('securityModalOverlay');
          const existingStorageModal = document.getElementById('storageModalOverlay');
          const modals = modalsContainer();
          if (existingSettingsSheet || existingSecModal || existingStorageModal) {
            if (modals) modals.innerHTML = '';
            document.body.classList.remove('modal-open');
            syncActiveTab();
          } else {
            if (modals) modals.innerHTML = '';
            document.body.classList.remove('modal-open');
            DocUI.renderSettingsSheet();
            updateActiveTab('settings');
          }
          break;
        }
      }
    });
  }

  function updateActiveTab(activeName) {
    if (!activeName) return;
    const tabs = document.querySelectorAll('.bottom-nav-tab');
    tabs.forEach((tab) => {
      if (tab.dataset.nav === activeName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  function syncActiveTab() {
    updateActiveTab(state.currentScreen === 'vault' ? 'vaults' : 'home');
  }

  function bindVaultCards() {
    const personalCard = document.getElementById('vaultPersonal');
    const officialCard = document.getElementById('vaultOfficial');

    if (personalCard) {
      personalCard.addEventListener('click', () => navigate('vault', 'personal'));
      personalCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate('vault', 'personal');
      });
    }

    if (officialCard) {
      officialCard.addEventListener('click', () => navigate('vault', 'official'));
      officialCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate('vault', 'official');
      });
    }
  }

  function bindFAB() {
    const fab = document.getElementById('fabUpload');
    const emptyBtn = document.getElementById('emptyUploadBtn');

    if (fab) fab.addEventListener('click', () => openUploadModal());
    if (emptyBtn) emptyBtn.addEventListener('click', () => openUploadModal());
  }

  function bindSearchEvents() {
    
    const globalSearch = document.getElementById('globalSearch');
    const searchClear = document.getElementById('searchClear');
    const clearSearchBtn = document.getElementById('clearSearch');

    if (globalSearch) {
      const debouncedSearch = DocSearch.debounced(async (query) => {
        state.searchQuery = query;
        await performGlobalSearch(query);
      }, 200);

      globalSearch.addEventListener('input', (e) => {
        const val = e.target.value;
        const clearBtn = document.getElementById('searchClear');
        if (clearBtn) {
          clearBtn.classList.toggle('visible', val.length > 0);
        }
        debouncedSearch(val);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        const input = document.getElementById('globalSearch');
        if (input) input.value = '';
        searchClear.classList.remove('visible');
        state.searchQuery = '';
        hideGlobalSearchResults();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        const input = document.getElementById('globalSearch');
        if (input) input.value = '';
        const clearBtn = document.getElementById('searchClear');
        if (clearBtn) clearBtn.classList.remove('visible');
        state.searchQuery = '';
        hideGlobalSearchResults();
      });
    }

    const vaultSearch = document.getElementById('vaultSearch');
    const vaultSearchClear = document.getElementById('vaultSearchClear');

    if (vaultSearch) {
      const debouncedVaultSearch = DocSearch.debounced(async (query) => {
        state.searchQuery = query;
        await refreshVaultGrid();
      }, 200);

      vaultSearch.addEventListener('input', (e) => {
        const val = e.target.value;
        const clearBtn = document.getElementById('vaultSearchClear');
        if (clearBtn) {
          clearBtn.classList.toggle('visible', val.length > 0);
        }
        debouncedVaultSearch(val);
      });
    }

    if (vaultSearchClear) {
      vaultSearchClear.addEventListener('click', () => {
        const input = document.getElementById('vaultSearch');
        if (input) input.value = '';
        vaultSearchClear.classList.remove('visible');
        state.searchQuery = '';
        refreshVaultGrid();
      });
    }
  }

  async function performGlobalSearch(query) {
    const resultsSection = document.getElementById('searchResults');
    const resultsGrid = document.getElementById('searchResultsGrid');
    const homeContent = document.getElementById('homeContent');
    const emptyState = document.getElementById('searchEmptyState');

    if (!query) {
      hideGlobalSearchResults();
      return;
    }

    const allDocs = await DocDB.getAll();
    const results = DocSearch.search(allDocs, query);

    if (resultsSection) resultsSection.style.display = 'block';
    if (homeContent) homeContent.style.display = 'none';

    if (results.length === 0) {
      if (resultsGrid) resultsGrid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (resultsGrid) {
        resultsGrid.innerHTML = results.map((doc) => DocUI.renderDocCard(doc)).join('');
      }
    }
  }

  function hideGlobalSearchResults() {
    const resultsSection = document.getElementById('searchResults');
    const homeContent = document.getElementById('homeContent');

    if (resultsSection) resultsSection.style.display = 'none';
    if (homeContent) homeContent.style.display = 'block';
  }

  function bindSortDropdown() {
    const sortToggle = document.getElementById('sortToggle');
    const sortMenu = document.getElementById('sortMenu');

    if (sortToggle && sortMenu) {
      sortToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sortMenu.classList.toggle('active');
      });

      sortMenu.addEventListener('click', async (e) => {
        const option = e.target.closest('.sort-option');
        if (!option) return;

        state.sortBy = option.dataset.sort;
        sortMenu.classList.remove('active');
        await refreshVaultGrid();
      });

      document.addEventListener('click', () => {
        sortMenu.classList.remove('active');
      });
    }
  }

  function bindCategoryChips() {
    const chips = document.getElementById('categoryChips');
    if (!chips) return;

    chips.addEventListener('click', async (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;

      state.activeCategory = chip.dataset.category;

      chips.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      await refreshVaultGrid();
    });
  }

  function bindFolderCardEvents() {
    const container = mainContainer();
    if (!container) return;

    container.querySelectorAll('.folder-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.delete-folder-btn') || e.target.closest('.edit-folder-btn')) return;
        const folderId = card.dataset.folderId;
        if (folderId) {
          state.currentFolderId = folderId;
          renderCurrentScreen();
        }
      });
    });

    container.querySelectorAll('.edit-folder-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.folderId;
        if (folderId) openEditFolderModal(folderId);
      });
    });

    container.querySelectorAll('.delete-folder-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.folderId;
        if (!folderId) return;

        const folder = DocUI.getFolder(folderId);
        if (!folder) return;

        const allVaultDocs = await DocDB.getAllByVault(state.currentVault);
        const idsToDelete = new Set([folderId]);
        let added = true;
        const allFolders = DocUI.getFolders();
        while (added) {
          added = false;
          allFolders.forEach((f) => {
            if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
              idsToDelete.add(f.id);
              added = true;
            }
          });
        }
        const descendantIds = Array.from(idsToDelete);

        const docsInFolder = allVaultDocs.filter(
          (d) => (d.folderId && idsToDelete.has(d.folderId)) || d.folder === folder.name
        );

        let warningMsg = `Delete folder "${folder.name}"?`;
        if (docsInFolder.length > 0 || descendantIds.length > 1) {
          const docCountStr = `${docsInFolder.length} document(s)`;
          const subfolderCountStr = `${descendantIds.length - 1} sub-folder(s)`;
          warningMsg = `⚠️ WARNING: Folder "${folder.name}" contains ${docCountStr}${descendantIds.length > 1 ? ' and ' + subfolderCountStr : ''}.\n\nDeleting this folder will PERMANENTLY DELETE all files and sub-folders inside it!\n\nDo you want to proceed?`;
        }

        if (confirm(warningMsg)) {
          
          for (const doc of docsInFolder) {
            await DocDB.deleteDocument(doc.id);
          }

          DocUI.deleteFolder(folderId);
          await renderCurrentScreen();
          DocUI.showToast(`Deleted folder "${folder.name}" and ${docsInFolder.length} file(s).`, 'info');
        }
      });
    });

    container.querySelectorAll('.breadcrumb-item').forEach((item) => {
      item.addEventListener('click', () => {
        const target = item.dataset.navFolder;
        if (target === 'root') {
          state.currentFolderId = null;
        } else if (target) {
          state.currentFolderId = target;
        }
        renderCurrentScreen();
      });
    });

    const vaultBackBtn = document.getElementById('vaultBackBtn');
    if (vaultBackBtn) {
      vaultBackBtn.addEventListener('click', () => {
        if (state.currentFolderId) {
          const current = DocUI.getFolder(state.currentFolderId);
          state.currentFolderId = current ? current.parentId : null;
          renderCurrentScreen();
        } else {
          navigate('home');
        }
      });
    }

    const createFolderBtns = [document.getElementById('createFolderBtn'), document.getElementById('emptyCreateFolderBtn')].filter(Boolean);
    createFolderBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        openCreateFolderModal();
      });
    });

    bindDragAndDropToMove();
  }

  function bindDragAndDropToMove() {
    const container = mainContainer();
    if (!container) return;

    container.querySelectorAll('.doc-card:not(.folder-card)').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        const docId = card.dataset.docId;
        if (!docId) return;

        card.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', docId);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        container.querySelectorAll('.folder-card').forEach((fc) => fc.classList.remove('drag-over-folder'));
      });
    });

    container.querySelectorAll('.folder-card').forEach((folderCard) => {
      folderCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        folderCard.classList.add('drag-over-folder');
      });

      folderCard.addEventListener('dragleave', () => {
        folderCard.classList.remove('drag-over-folder');
      });

      folderCard.addEventListener('drop', async (e) => {
        e.preventDefault();
        folderCard.classList.remove('drag-over-folder');

        const docId = e.dataTransfer.getData('text/plain');
        const targetFolderId = folderCard.dataset.folderId;
        if (!docId || !targetFolderId) return;

        const folderObj = DocUI.getFolder(targetFolderId);
        const docObj = await DocDB.getDocument(docId);
        if (docObj && folderObj) {
          await DocDB.updateDocument(docId, {
            folderId: folderObj.id,
            folder: folderObj.name,
          });
          DocUI.showToast(`Moved "${docObj.name}" into "${folderObj.name}"!`, 'success');
          await renderCurrentScreen();
        }
      });
    });
  }

  async function refreshVaultGrid() {
    const grid = document.getElementById('documentsGrid');
    if (!grid) return;

    const allDocs = await DocDB.getAllByVault(state.currentVault);
    const filteredDocs = DocSearch.query(allDocs, {
      searchQuery: state.searchQuery,
      filters: {
        category: state.activeCategory,
        folder: state.activeFolder,
      },
      sortBy: state.sortBy,
    });

    const sortToggle = document.getElementById('sortToggle');
    if (sortToggle) {
      const labels = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'name-asc': 'A-Z', 'name-desc': 'Z-A', 'category': 'Category' };
      sortToggle.textContent = `↕ ${labels[state.sortBy] || 'Sort'}`;
    }

    if (filteredDocs.length === 0) {
      grid.innerHTML = '';
      
      const existingEmpty = grid.parentElement.querySelector('.empty-state');
      if (!existingEmpty) {
        grid.insertAdjacentHTML('afterend', `
          <div class="empty-state temp-empty">
            <div class="empty-icon">🔎</div>
            <h3 class="empty-title">No documents found</h3>
            <p class="empty-desc">Try a different search term or category</p>
          </div>
        `);
      }
    } else {
      
      const tempEmpty = grid.parentElement.querySelector('.temp-empty');
      if (tempEmpty) tempEmpty.remove();

      grid.innerHTML = filteredDocs.map((doc) => DocUI.renderDocCard(doc, state.selectMode)).join('');

      if (state.selectMode) {
        state.selectedDocs.forEach((id) => {
          const card = grid.querySelector(`.doc-card[data-doc-id="${id}"]`);
          if (card) {
            card.classList.add('selected');
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
          }
        });
      }
    }
  }

  function bindBulkSelect() {
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const cancelSelectBtn = document.getElementById('cancelSelectBtn');
    const bulkShareBtn = document.getElementById('bulkShareBtn');
    const bulkDownloadBtn = document.getElementById('bulkDownloadBtn');
    const bulkWhatsAppBtn = document.getElementById('bulkWhatsAppBtn');

    if (bulkSelectBtn) {
      bulkSelectBtn.addEventListener('click', () => enterSelectMode());
    }

    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => selectAllDocs());
    }

    if (cancelSelectBtn) {
      cancelSelectBtn.addEventListener('click', () => exitSelectMode());
    }

    if (bulkShareBtn) {
      bulkShareBtn.addEventListener('click', () => bulkShare());
    }

    if (bulkDownloadBtn) {
      bulkDownloadBtn.addEventListener('click', () => bulkDownload());
    }

    if (bulkWhatsAppBtn) {
      bulkWhatsAppBtn.addEventListener('click', () => bulkWhatsAppShare());
    }
  }

  function enterSelectMode() {
    state.selectMode = true;
    state.selectedDocs.clear();

    const bulkBar = document.getElementById('bulkActionBar');
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    if (bulkBar) bulkBar.style.display = 'flex';
    if (bulkSelectBtn) bulkSelectBtn.style.display = 'none';

    refreshVaultGrid();
    updateBulkUI();
  }

  function exitSelectMode() {
    state.selectMode = false;
    state.selectedDocs.clear();

    const bulkBar = document.getElementById('bulkActionBar');
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    if (bulkBar) bulkBar.style.display = 'none';
    if (bulkSelectBtn) bulkSelectBtn.style.display = '';

    refreshVaultGrid();
  }

  function handleToggleSelect(docId) {
    if (!state.selectMode) return;

    if (state.selectedDocs.has(docId)) {
      state.selectedDocs.delete(docId);
    } else {
      state.selectedDocs.add(docId);
    }

    const card = document.querySelector(`.doc-card[data-doc-id="${docId}"]`);
    if (card) {
      card.classList.toggle('selected', state.selectedDocs.has(docId));
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = state.selectedDocs.has(docId);
    }

    updateBulkUI();
  }

  async function selectAllDocs() {
    const allDocs = await DocDB.getAllByVault(state.currentVault);
    const filteredDocs = DocSearch.query(allDocs, {
      searchQuery: state.searchQuery,
      filters: { category: state.activeCategory },
      sortBy: state.sortBy,
    });

    const allSelected = filteredDocs.length > 0 && filteredDocs.every((d) => state.selectedDocs.has(d.id));

    if (allSelected) {
      
      state.selectedDocs.clear();
    } else {
      
      filteredDocs.forEach((d) => state.selectedDocs.add(d.id));
    }

    document.querySelectorAll('.doc-card.select-mode').forEach((card) => {
      const id = card.dataset.docId;
      card.classList.toggle('selected', state.selectedDocs.has(id));
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = state.selectedDocs.has(id);
    });

    updateBulkUI();
  }

  function updateBulkUI() {
    const count = state.selectedDocs.size;
    const countLabel = document.getElementById('selectedCount');
    const shareBtn = document.getElementById('bulkShareBtn');
    const downloadBtn = document.getElementById('bulkDownloadBtn');
    const whatsAppBtn = document.getElementById('bulkWhatsAppBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');

    if (countLabel) countLabel.textContent = `${count} selected`;
    if (shareBtn) shareBtn.disabled = count === 0;
    if (downloadBtn) downloadBtn.disabled = count === 0;
    if (whatsAppBtn) whatsAppBtn.disabled = count === 0;

    if (selectAllBtn) {
      const grid = document.getElementById('documentsGrid');
      const totalCards = grid ? grid.querySelectorAll('.doc-card').length : 0;
      selectAllBtn.textContent = (count > 0 && count === totalCards) ? '☐ Deselect All' : '☑ Select All';
    }
  }

  async function bulkShare() {
    const ids = Array.from(state.selectedDocs);
    if (ids.length === 0) return;

    try {
      DocUI.showToast(`Preparing ${ids.length} original document(s)...`, 'info');
      const result = await DocShare.shareMultiple(ids);
      if (result.success && result.method !== 'cancelled') {
        DocUI.showToast(`${ids.length} document(s) shared!`, 'success');
        exitSelectMode();
      }
    } catch (error) {
      console.error('Bulk share failed:', error);
      DocUI.showToast('Failed to share documents.', 'error');
    }
  }

  async function bulkDownload() {
    const ids = Array.from(state.selectedDocs);
    if (ids.length === 0) return;

    try {
      DocUI.showToast(`Downloading ${ids.length} document(s) in original format...`, 'info');
      for (let i = 0; i < ids.length; i++) {
        await DocShare.downloadDocument(ids[i]);
        if (ids.length > 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      DocUI.showToast(`${ids.length} document(s) downloaded!`, 'success');
      exitSelectMode();
    } catch (error) {
      console.error('Bulk download failed:', error);
      DocUI.showToast('Failed to download documents.', 'error');
    }
  }

  async function bulkWhatsAppShare() {
    const ids = Array.from(state.selectedDocs);
    if (ids.length === 0) return;

    try {
      DocUI.showToast(`Preparing ${ids.length} document(s)...`, 'info');

      const result = await DocShare.shareMultiple(ids);
      if (result.success) {
        if (result.method !== 'cancelled') {
          DocUI.showToast('Shared successfully!', 'success');
          exitSelectMode();
        }
        return;
      }

      const docNames = [];
      for (const id of ids) {
        const doc = await DocDB.getDocument(id);
        if (doc) docNames.push(`• ${doc.name} (${doc.fileName})`);
      }

      const message = `Sharing documents from Vaulta:\n${docNames.join('\n')}`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      DocUI.showToast('Files downloaded! Attach them in WhatsApp.', 'info', 4000);
      exitSelectMode();
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('WhatsApp share failed:', error);
      DocUI.showToast('Failed to share via WhatsApp.', 'error');
    }
  }

  function openCreateFolderModal() {
    const modals = modalsContainer();
    modals.innerHTML = DocUI.renderCreateFolderModal();

    const modal = document.getElementById('createFolderModal');
    const closeBtn = document.getElementById('createFolderClose');
    const cancelBtn = document.getElementById('createFolderCancel');
    const submitBtn = document.getElementById('createFolderSubmit');
    const nameInput = document.getElementById('customFolderName');

    const closeModal = () => modal.remove();

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (nameInput) {
      setTimeout(() => nameInput.focus(), 100);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCreateFolderSubmit();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', handleCreateFolderSubmit);
    }

    function handleCreateFolderSubmit() {
      const name = nameInput.value.trim();
      if (!name) {
        DocUI.showToast('Please enter a folder name.', 'error');
        return;
      }

      const created = DocUI.createFolder(state.currentVault || 'personal', name, state.currentFolderId);
      if (created) {
        closeModal();
        renderCurrentScreen();
        DocUI.showToast(`Folder "${created.name}" created!`, 'success');
      }
    }
  }

  function openEditFolderModal(folderId) {
    const folder = DocUI.getFolder(folderId);
    if (!folder) return;

    const modals = modalsContainer();
    modals.innerHTML = DocUI.renderEditFolderModal(folder);

    const modal = document.getElementById('editFolderModal');
    const closeBtn = document.getElementById('editFolderClose');
    const cancelBtn = document.getElementById('editFolderCancel');
    const submitBtn = document.getElementById('editFolderSubmit');
    const nameInput = document.getElementById('editFolderNameInput');

    const closeModal = () => modal.remove();

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (nameInput) {
      setTimeout(() => {
        nameInput.focus();
        nameInput.select();
      }, 100);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleEditFolderSubmit();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', handleEditFolderSubmit);
    }

    async function handleEditFolderSubmit() {
      const newName = nameInput.value.trim();
      if (!newName) {
        DocUI.showToast('Please enter a folder name.', 'error');
        return;
      }

      const updated = DocUI.updateFolder(folderId, newName);
      if (updated) {
        const allDocs = await DocDB.getAllByVault(folder.vault);
        for (const d of allDocs) {
          if (d.folderId === folderId || d.folder === folder.name) {
            await DocDB.updateDocument(d.id, { folder: updated.name });
          }
        }

        closeModal();
        await renderCurrentScreen();
        DocUI.showToast(`Folder renamed to "${updated.name}"!`, 'success');
      }
    }
  }

  let secretSyncBound = false;
  function bindSecretSyncEvents() {
    if (secretSyncBound) return;
    secretSyncBound = true;

    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => openSecretSyncModal());
    }

    let badgeClickCount = 0;
    let badgeClickTimer = null;
    const badgeEl = document.querySelector('.security-status-badge');
    if (badgeEl) {
      badgeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        badgeClickCount++;
        clearTimeout(badgeClickTimer);
        if (badgeClickCount >= 3) {
          badgeClickCount = 0;
          DocUI.showToast('🔐 Secret Vault Sync Unlocked!', 'info');
          openSecretSyncModal();
        } else {
          badgeClickTimer = setTimeout(() => { badgeClickCount = 0; }, 800);
        }
      });
    }
  }

  function openSecretSyncModal() {
    const modals = modalsContainer();
    modals.innerHTML = DocUI.renderSecretSyncModal();

    const modal = document.getElementById('secretSyncModal');
    const closeBtn = document.getElementById('secretSyncClose');
    const cancelBtn = document.getElementById('secretSyncCancel');
    const exportBtn = document.getElementById('secretSyncExportBtn');
    const dropZone = document.getElementById('secretSyncDropZone');
    const fileInput = document.getElementById('secretSyncFileInput');

    const closeModal = () => modal.remove();

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        exportBtn.classList.add('loading');
        exportBtn.disabled = true;
        try {
          DocUI.showToast('Packaging all documents & folders...', 'info');
          const packageObj = await DocDB.exportSecretSyncPackage();
          const jsonStr = JSON.stringify(packageObj);
          const dateStr = new Date().toISOString().slice(0, 10);
          const fileName = `Vaulta_Sync_${dateStr}.json`;
          const blob = new Blob([jsonStr], { type: 'application/json' });

          DocShare.downloadFile(blob, fileName);

          DocUI.showToast('📦 Vault Sync File downloaded! Check your Downloads folder.', 'success', 5000);
        } catch (err) {
          console.error('Sync export failed:', err);
          DocUI.showToast('Failed to export sync file: ' + (err.message || 'Unknown error'), 'error', 5000);
        } finally {
          exportBtn.classList.remove('loading');
          exportBtn.disabled = false;
        }
      });
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleSyncFileImport(files[0]);
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleSyncFileImport(e.target.files[0]);
      });
    }

    async function handleSyncFileImport(file) {
      if (!file) return;
      try {
        DocUI.showToast('Importing Vaulta sync file...', 'info');
        const text = await file.text();
        const packageObj = JSON.parse(text);

        const result = await DocDB.importSecretSyncPackage(packageObj);
        closeModal();
        await renderCurrentScreen();
        DocUI.showToast(`✅ Successfully restored ${result.documentCount} document(s) & ${result.folderCount} folder(s)!`, 'success', 5000);
      } catch (err) {
        console.error('Import failed:', err);
        DocUI.showToast('Failed to import file. Make sure it is a valid Vaulta backup (.json or .vaulta).', 'error');
      }
    }
  }

  function openUploadModal(prefill = {}) {
    document.body.classList.add('modal-open');
    const modals = modalsContainer();
    const defaultVault = prefill.vault || state.currentVault || 'personal';
    modals.innerHTML = DocUI.renderUploadModal(defaultVault, state.currentFolderId, prefill);

    bindUploadModalEvents();

    if (prefill.name) {
      const nameInput = document.getElementById('docName');
      if (nameInput) nameInput.value = prefill.name;
    }
    if (prefill.category) {
      const catSelect = document.getElementById('docCategory');
      if (catSelect) {
        catSelect.value = prefill.category;
        catSelect.dispatchEvent(new Event('change'));
      }
    }
    if (prefill.autoCamera) {
      setTimeout(() => {
        const cam = document.getElementById('cameraInput');
        if (cam) {
          window.SecurityModule?.suppressLock(25000);
          cam.click();
        }
      }, 120);
    } else if (prefill.autoBrowse) {
      setTimeout(() => {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
          window.SecurityModule?.suppressLock(25000);
          fileInput.click();
        }
      }, 120);
    }
  }

  function bindUploadModalEvents() {
    const modal = document.getElementById('uploadModal');
    const closeBtn = document.getElementById('uploadModalClose');
    const cancelBtn = document.getElementById('uploadCancel');
    const submitBtn = document.getElementById('uploadSubmit');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const btnBrowse = document.getElementById('btnFileBrowse');
    const vaultSelect = document.getElementById('docVault');
    const previewRemove = document.getElementById('previewRemove');

    DocUI.initVaultaDatePicker('docExpiry_container', 'docExpiry', '');
    const vaultCustom = DocUI.setupVaultaCustomSelect ? DocUI.setupVaultaCustomSelect('docVault', 'vault') : null;
    const catCustom = DocUI.setupVaultaCustomSelect ? DocUI.setupVaultaCustomSelect('docCategory', 'category') : null;
    const folderCustom = DocUI.setupVaultaCustomSelect ? DocUI.setupVaultaCustomSelect('docFolder', 'folder') : null;

    const closeModal = () => {
      state.selectedFile = null;
      window.SecurityModule?.clearLockSuppression();
      document.body.classList.remove('modal-open');
      const modals = modalsContainer();
      if (modals) modals.innerHTML = '';
      if (modal) modal.remove();
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          e.preventDefault();
          closeModal();
        }
      });
    }

    const onFilePicked = (file) => {
      if (!file) return;
      handleFileSelect(file);
    };

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        window.SecurityModule?.suppressLock(45000);
        if (e.target.files && e.target.files.length > 0) onFilePicked(e.target.files[0]);
      });
    }

    if (btnBrowse) {
      btnBrowse.addEventListener('click', () => {
        window.SecurityModule?.suppressLock(45000);
      });
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#btnFileBrowse') || e.target.closest('label') || e.target.closest('input')) return;
        window.SecurityModule?.suppressLock(45000);
        fileInput.click();
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) onFilePicked(files[0]);
      });
    }

    if (previewRemove) {
      previewRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedFile = null;
        const preview = document.getElementById('uploadPreview');
        if (preview) {
          preview.classList.remove('visible');
          preview.querySelector('img, .preview-pdf')?.remove();
        }
        if (dropZone) dropZone.style.display = '';
        if (submitBtn) submitBtn.disabled = true;
      });
    }

    const catSelect = document.getElementById('docCategory');
    const customGroup = document.getElementById('customCategoryGroup');
    const folderSelect = document.getElementById('docFolder');
    const newFolderGroup = document.getElementById('newFolderGroup');

    const updateCustomVisibility = () => {
      if (catSelect && catSelect.value === 'Other') {
        if (customGroup) customGroup.style.display = 'block';
        document.getElementById('customCategory')?.focus();
      } else {
        if (customGroup) customGroup.style.display = 'none';
      }
    };

    const updateFolderVisibility = () => {
      if (folderSelect && folderSelect.value === '__new__') {
        if (newFolderGroup) newFolderGroup.style.display = 'block';
        document.getElementById('newFolderName')?.focus();
      } else {
        if (newFolderGroup) newFolderGroup.style.display = 'none';
      }
    };

    if (catSelect) catSelect.addEventListener('change', updateCustomVisibility);
    if (folderSelect) folderSelect.addEventListener('change', updateFolderVisibility);

    if (vaultSelect) {
      vaultSelect.addEventListener('change', () => {
        const vault = vaultSelect.value;
        const personalGroup = document.getElementById('personalCatGroup');
        const officialGroup = document.getElementById('officialCatGroup');
        const personalFolders = document.getElementById('personalFolderGroup');
        const officialFolders = document.getElementById('officialFolderGroup');

        if (vault === 'personal') {
          if (personalGroup) personalGroup.style.display = '';
          if (officialGroup) officialGroup.style.display = 'none';
          if (personalFolders) personalFolders.style.display = '';
          if (officialFolders) officialFolders.style.display = 'none';
          const firstOption = personalGroup?.querySelector('option');
          if (firstOption) firstOption.selected = true;
        } else {
          if (personalGroup) personalGroup.style.display = 'none';
          if (officialGroup) officialGroup.style.display = '';
          if (personalFolders) personalFolders.style.display = 'none';
          if (officialFolders) officialFolders.style.display = '';
          const firstOption = officialGroup?.querySelector('option');
          if (firstOption) firstOption.selected = true;
        }
        if (folderSelect) folderSelect.value = '';
        if (catCustom) catCustom.refresh();
        if (folderCustom) folderCustom.refresh();
        updateCustomVisibility();
        updateFolderVisibility();
      });
    }

    updateCustomVisibility();
    updateFolderVisibility();

    if (submitBtn) submitBtn.addEventListener('click', handleUpload);
  }

  function handleFileSelect(file) {
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    const isImageFile = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(fileName);
    const isPdfFile = (file.type && file.type.includes('pdf')) || fileName.endsWith('.pdf');
    const isExcelFile = fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv') || (file.type && (file.type.includes('excel') || file.type.includes('spreadsheet') || file.type.includes('csv')));

    if (!isImageFile && !isPdfFile && !isExcelFile) {
      DocUI.showToast('Unsupported file type. Please use JPG, PNG, PDF, or Excel (XLS, XLSX, CSV).', 'error');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      DocUI.showToast('File is too large. Maximum 25MB allowed.', 'error');
      return;
    }

    state.selectedFile = file;

    const preview = document.getElementById('uploadPreview');
    const dropZone = document.getElementById('dropZone');
    const submitBtn = document.getElementById('uploadSubmit');
    const nameInput = document.getElementById('docName');

    if (nameInput && !nameInput.value) {
      const baseName = file.name ? file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') : 'Scanned Document';
      nameInput.value = baseName;
    }

    if (preview) preview.classList.add('visible');
    if (dropZone) dropZone.style.display = 'none';

    if (preview) {
      const existingPreviewContent = preview.querySelector('img, .preview-pdf');
      if (existingPreviewContent) existingPreviewContent.remove();

      if (isImageFile) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Preview';
        preview.insertBefore(img, preview.firstChild);
      } else if (isExcelFile) {
        const excelDiv = document.createElement('div');
        excelDiv.className = 'preview-pdf';
        excelDiv.innerHTML = `
          <span class="pdf-icon">📊</span>
          <div>
            <div style="font-weight: var(--font-weight-semibold);">${DocUI.escapeHtml(file.name)}</div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${formatFileSize(file.size)}</div>
          </div>
        `;
        preview.insertBefore(excelDiv, preview.firstChild);
      } else {
        const pdfDiv = document.createElement('div');
        pdfDiv.className = 'preview-pdf';
        pdfDiv.innerHTML = `
          <span class="pdf-icon">📕</span>
          <div>
            <div style="font-weight: var(--font-weight-semibold);">${DocUI.escapeHtml(file.name)}</div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${formatFileSize(file.size)}</div>
          </div>
        `;
        preview.insertBefore(pdfDiv, preview.firstChild);
      }
    }

    if (submitBtn) submitBtn.disabled = false;
  }

  function parseStandardDate(str) {
    if (!str) return null;
    str = str.trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parts = str.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  async function handleUpload() {
    const file = state.selectedFile;
    if (!file) return;

    const name = document.getElementById('docName').value.trim();
    const vault = document.getElementById('docVault').value;
    const selectedCategory = document.getElementById('docCategory').value;
    const selectedFolder = document.getElementById('docFolder')?.value || '';
    const tagsStr = document.getElementById('docTags').value.trim();

    if (!name) {
      DocUI.showToast('Please enter a document name.', 'error');
      return;
    }

    let category = selectedCategory;
    if (selectedCategory === 'Other') {
      const customVal = document.getElementById('customCategory')?.value.trim();
      if (!customVal) {
        DocUI.showToast('Please specify a custom category name.', 'error');
        return;
      }
      category = DocUI.addCustomCategory(vault, customVal);
    }

    let folderId = selectedFolder;
    let folderName = null;

    if (selectedFolder === '__new__') {
      const newFolderVal = document.getElementById('newFolderName')?.value.trim();
      if (newFolderVal) {
        const newFolderObj = DocUI.createFolder(vault, newFolderVal, state.currentFolderId);
        if (newFolderObj) {
          folderId = newFolderObj.id;
          folderName = newFolderObj.name;
        }
      } else {
        folderId = null;
      }
    } else if (selectedFolder) {
      const fObj = DocUI.getFolder(selectedFolder);
      if (fObj) folderName = fObj.name;
    }

    const rawExpiry = document.getElementById('docExpiry')?.value;
    const expiryDate = parseStandardDate(rawExpiry);

    const submitBtn = document.getElementById('uploadSubmit');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      
      const thumbnail = await DocDB.generateThumbnail(file);

      const tags = tagsStr
        ? tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];

      await DocDB.addDocument({
        vault,
        name,
        category,
        folderId,
        folder: folderName,
        tags,
        expiryDate,
        fileData: file,
        fileType: file.type,
        fileName: file.name,
        thumbnail,
      });

      state.selectedFile = null;
      document.getElementById('uploadModal')?.remove();

      await renderCurrentScreen();

      DocUI.showToast(`"${name}" uploaded successfully!`, 'success');
    } catch (error) {
      console.error('Upload failed:', error);
      DocUI.showToast('Upload failed. Please try again.', 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  async function openPreview(docId) {
    const doc = await DocDB.getDocument(docId);
    if (!doc) return;

    const fileUrl = await DocDB.getFileUrl(docId);
    if (!fileUrl) {
      DocUI.showToast('Could not load file for preview.', 'error');
      return;
    }

    state.currentPreviewUrl = fileUrl;
    document.body.classList.add('preview-open');
    try {
      history.pushState({ modal: 'preview' }, '');
    } catch (_) {}

    const modals = modalsContainer();
    modals.innerHTML = DocUI.renderPreview(doc, fileUrl);

    bindPreviewEvents(doc);

    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    if (isPdf) {
      renderPdfInPreview(fileUrl, doc);
    }
  }

  async function renderPdfInPreview(fileUrl, doc) {
    const container = document.getElementById('pdfViewerContainer');
    if (!container) return;

    try {
      if (typeof pdfjsLib === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } else {
        throw new Error('PDF.js library is missing');
      }

      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      container.innerHTML = '';

      const toolbar = document.createElement('div');
      toolbar.className = 'pdf-toolbar';
      toolbar.innerHTML = `
        <button class="pdf-tb-btn" id="pdfPrevPage" title="Previous Page">◀</button>
        <span class="pdf-page-num">Page <span id="pdfCurrentPage">1</span> of ${pdf.numPages}</span>
        <button class="pdf-tb-btn" id="pdfNextPage" title="Next Page">▶</button>
        <div class="pdf-tb-divider"></div>
        <button class="pdf-tb-btn" id="pdfZoomOut" title="Zoom Out">🔍−</button>
        <span class="pdf-zoom-level" id="pdfZoomLevel">100%</span>
        <button class="pdf-tb-btn" id="pdfZoomIn" title="Zoom In">🔍+</button>
        <button class="pdf-tb-btn" id="pdfFitWidth" title="Fit to Screen">↔ Fit</button>
      `;

      const pagesContainer = document.createElement('div');
      pagesContainer.className = 'pdf-pages-container';

      container.appendChild(toolbar);
      container.appendChild(pagesContainer);

      let currentScale = 1.0;
      let userScaleOverride = false;
      let currentPage = 1;

      const renderPages = async () => {
        pagesContainer.innerHTML = '';

        const firstPage = await pdf.getPage(1);
        const unscaledViewport = firstPage.getViewport({ scale: 1.0 });
        const containerWidth = pagesContainer.clientWidth > 0 ? pagesContainer.clientWidth - 24 : window.innerWidth - 32;

        if (!userScaleOverride && containerWidth > 0 && unscaledViewport.width > 0) {
          let fitScale = containerWidth / unscaledViewport.width;
          if (fitScale < 0.5) fitScale = 0.5;
          if (fitScale > 2.0) fitScale = 2.0;
          currentScale = fitScale;
        }

        const zoomLevelEl = document.getElementById('pdfZoomLevel');
        if (zoomLevelEl) {
          zoomLevelEl.textContent = userScaleOverride
            ? `${Math.round(currentScale * 100)}%`
            : 'Fit';
        }

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: currentScale });

          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page-wrapper';
          pageWrapper.setAttribute('data-page-number', pageNum);

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-canvas';

          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);

          pageWrapper.appendChild(canvas);
          pagesContainer.appendChild(pageWrapper);

          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;
        }
      };

      await renderPages();

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page-number'));
            if (pageNum) {
              currentPage = pageNum;
              const curPageEl = document.getElementById('pdfCurrentPage');
              if (curPageEl) curPageEl.textContent = currentPage;
            }
          }
        });
      }, { root: pagesContainer, threshold: 0.3 });

      pagesContainer.querySelectorAll('.pdf-page-wrapper').forEach((el) => observer.observe(el));

      document.getElementById('pdfPrevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          const target = pagesContainer.querySelector(`.pdf-page-wrapper[data-page-number="${currentPage}"]`);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      });

      document.getElementById('pdfNextPage')?.addEventListener('click', () => {
        if (currentPage < pdf.numPages) {
          currentPage++;
          const target = pagesContainer.querySelector(`.pdf-page-wrapper[data-page-number="${currentPage}"]`);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      });

      document.getElementById('pdfZoomIn')?.addEventListener('click', async () => {
        userScaleOverride = true;
        currentScale = Math.min(currentScale + 0.25, 3.0);
        await renderPages();
      });

      document.getElementById('pdfZoomOut')?.addEventListener('click', async () => {
        userScaleOverride = true;
        currentScale = Math.max(currentScale - 0.25, 0.4);
        await renderPages();
      });

      document.getElementById('pdfFitWidth')?.addEventListener('click', async () => {
        userScaleOverride = false;
        await renderPages();
      });

    } catch (err) {
      console.error('PDF rendering failed, providing direct fallback:', err);
      container.innerHTML = `
        <div class="pdf-fallback-container">
          <div class="empty-state">
            <div class="empty-icon">📕</div>
            <h3 class="empty-title">${escapeHtml(doc.name)}</h3>
            <p class="empty-desc">PDF document ready. Tap below to view or download.</p>
            <a href="${fileUrl}" download="${escapeHtml(doc.fileName)}" class="btn btn-primary" style="margin-top: 12px; font-weight: var(--font-weight-semibold);">
              ⬇ Download / View PDF
            </a>
          </div>
        </div>
      `;
    }
  }

  function bindPreviewEvents(doc) {
    const closeBtn = document.getElementById('previewClose');
    const favBtn = document.getElementById('previewFavorite');

    const editBtns = [document.getElementById('previewEdit'), document.getElementById('previewMobileEdit')].filter(Boolean);
    const shareBtns = [document.getElementById('previewShare'), document.getElementById('previewMobileShare')].filter(Boolean);
    const downloadBtns = [document.getElementById('previewDownload'), document.getElementById('previewMobileDownload')].filter(Boolean);
    const deleteBtns = [document.getElementById('previewDelete'), document.getElementById('previewMobileDelete')].filter(Boolean);

    closeBtn?.addEventListener('click', closePreview);

    favBtn?.addEventListener('click', async () => {
      try {
        const updated = await DocDB.toggleFavorite(doc.id);
        doc.isFavorite = updated.isFavorite;
        favBtn.classList.toggle('active', updated.isFavorite);
        favBtn.textContent = updated.isFavorite ? '★' : '☆';
        favBtn.title = updated.isFavorite ? 'Remove from favorites' : 'Add to favorites';
        DocUI.showToast(
          updated.isFavorite ? 'Added to favorites ⭐' : 'Removed from favorites',
          'info'
        );
        await renderCurrentScreen();
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
        DocUI.showToast('Could not update favorite status.', 'error');
      }
    });

    editBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        closePreview();
        openEditModal(doc.id);
      });
    });

    shareBtns.forEach((btn) => btn.addEventListener('click', () => shareDoc(doc.id)));
    downloadBtns.forEach((btn) => btn.addEventListener('click', () => downloadDoc(doc.id)));
    deleteBtns.forEach((btn) => btn.addEventListener('click', () => openDeleteConfirm(doc.id, doc.name)));

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closePreview();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function closePreview(fromPopState = false) {
    document.body.classList.remove('preview-open');
    if (state.currentPreviewUrl) {
      URL.revokeObjectURL(state.currentPreviewUrl);
      state.currentPreviewUrl = null;
    }

    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.remove();

    if (!fromPopState && history.state && history.state.modal === 'preview') {
      try {
        history.back();
      } catch (_) {}
    }

    renderCurrentScreen();
  }

  async function openEditModal(docId) {
    const doc = await DocDB.getDocument(docId);
    if (!doc) return;

    document.body.classList.add('modal-open');
    const modals = modalsContainer();
    modals.innerHTML = DocUI.renderEditModal(doc);

    bindEditModalEvents(doc);
  }

  function bindEditModalEvents(doc) {
    const modal = document.getElementById('editModal');
    const closeBtn = document.getElementById('editModalClose');
    const cancelBtn = document.getElementById('editCancel');
    const submitBtn = document.getElementById('editSubmit');
    const vaultSelect = document.getElementById('editDocVault');

    DocUI.initVaultaDatePicker('editDocExpiry_container', 'editDocExpiry', doc.expiryDate || '');
    const editVaultCustom = DocUI.setupVaultaCustomSelect ? DocUI.setupVaultaCustomSelect('editDocVault', 'vault') : null;
    const editCatCustom = DocUI.setupVaultaCustomSelect ? DocUI.setupVaultaCustomSelect('editDocCategory', 'category') : null;
    const editFolderCustom = DocUI.setupVaultaCustomSelect ? DocUI.setupVaultaCustomSelect('editDocFolder', 'folder') : null;

    const closeModal = () => {
      document.body.classList.remove('modal-open');
      const modals = modalsContainer();
      if (modals) modals.innerHTML = '';
      if (modal) modal.remove();
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          e.preventDefault();
          closeModal();
        }
      });
    }

    const catSelect = document.getElementById('editDocCategory');
    const customGroup = document.getElementById('editCustomCategoryGroup');
    const folderSelect = document.getElementById('editDocFolder');
    const newFolderGroup = document.getElementById('editNewFolderGroup');

    const updateEditCustomVisibility = () => {
      if (catSelect && catSelect.value === 'Other') {
        if (customGroup) customGroup.style.display = 'block';
        document.getElementById('editCustomCategory')?.focus();
      } else {
        if (customGroup) customGroup.style.display = 'none';
      }
    };

    const updateEditFolderVisibility = () => {
      if (folderSelect && folderSelect.value === '__new__') {
        if (newFolderGroup) newFolderGroup.style.display = 'block';
        document.getElementById('editNewFolderName')?.focus();
      } else {
        if (newFolderGroup) newFolderGroup.style.display = 'none';
      }
    };

    if (catSelect) catSelect.addEventListener('change', updateEditCustomVisibility);
    if (folderSelect) folderSelect.addEventListener('change', updateEditFolderVisibility);

    vaultSelect.addEventListener('change', () => {
      const vault = vaultSelect.value;
      const personalGroup = document.getElementById('editPersonalCatGroup');
      const officialGroup = document.getElementById('editOfficialCatGroup');
      const personalFolders = document.getElementById('editPersonalFolderGroup');
      const officialFolders = document.getElementById('editOfficialFolderGroup');

      if (vault === 'personal') {
        if (personalGroup) personalGroup.style.display = '';
        if (officialGroup) officialGroup.style.display = 'none';
        if (personalFolders) personalFolders.style.display = '';
        if (officialFolders) officialFolders.style.display = 'none';
      } else {
        if (personalGroup) personalGroup.style.display = 'none';
        if (officialGroup) officialGroup.style.display = '';
        if (personalFolders) personalFolders.style.display = 'none';
        if (officialFolders) officialFolders.style.display = '';
      }
      if (editCatCustom) editCatCustom.refresh();
      if (editFolderCustom) editFolderCustom.refresh();
      updateEditCustomVisibility();
      updateEditFolderVisibility();
    });

    updateEditCustomVisibility();
    updateEditFolderVisibility();

    submitBtn.addEventListener('click', async () => {
      const name = document.getElementById('editDocName').value.trim();
      const vault = document.getElementById('editDocVault').value;
      const selectedCategory = document.getElementById('editDocCategory').value;
      const selectedFolder = document.getElementById('editDocFolder')?.value || '';
      const tagsStr = document.getElementById('editDocTags').value.trim();

      if (!name) {
        DocUI.showToast('Please enter a document name.', 'error');
        return;
      }

      let category = selectedCategory;
      if (selectedCategory === 'Other') {
        const customVal = document.getElementById('editCustomCategory')?.value.trim();
        if (!customVal) {
          DocUI.showToast('Please specify a custom category name.', 'error');
          return;
        }
        category = DocUI.addCustomCategory(vault, customVal);
      }

      let folderId = selectedFolder;
      let folderName = null;

      if (selectedFolder === '__new__') {
        const newFolderVal = document.getElementById('editNewFolderName')?.value.trim();
        if (newFolderVal) {
          const newFolderObj = DocUI.createFolder(vault, newFolderVal, state.currentFolderId);
          if (newFolderObj) {
            folderId = newFolderObj.id;
            folderName = newFolderObj.name;
          }
        } else {
          folderId = null;
        }
      } else if (selectedFolder) {
        const fObj = DocUI.getFolder(selectedFolder);
        if (fObj) folderName = fObj.name;
      }

      const rawExpiry = document.getElementById('editDocExpiry')?.value;
      const expiryDate = parseStandardDate(rawExpiry);

      const tags = tagsStr
        ? tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];

      try {
        await DocDB.updateDocument(doc.id, { name, vault, category, folderId, folder: folderName, tags, expiryDate });
        closeModal();
        await renderCurrentScreen();
        DocUI.showToast('Document updated successfully!', 'success');
        await checkExpiryNotifications(true);
      } catch (error) {
        console.error('Update failed:', error);
        DocUI.showToast('Failed to update document.', 'error');
      }
    });
  }

  function openDeleteConfirm(docId, docName) {
    const modals = modalsContainer();

    const previewOverlay = document.getElementById('previewOverlay');
    if (previewOverlay) previewOverlay.remove();

    modals.innerHTML = DocUI.renderDeleteConfirm(docId, docName);

    const modal = document.getElementById('deleteModal');
    const cancelBtn = document.getElementById('deleteCancel');
    const confirmBtn = document.getElementById('deleteConfirm');

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    confirmBtn.addEventListener('click', async () => {
      try {
        await DocDB.deleteDocument(docId);
        modal.remove();

        if (state.currentPreviewUrl) {
          URL.revokeObjectURL(state.currentPreviewUrl);
          state.currentPreviewUrl = null;
        }

        await renderCurrentScreen();
        DocUI.showToast('Document deleted.', 'success');
      } catch (error) {
        console.error('Delete failed:', error);
        DocUI.showToast('Failed to delete document.', 'error');
      }
    });
  }

  async function shareDoc(docId) {
    try {
      const doc = await DocDB.getDocument(docId);
      if (!doc) return;

      const formats = DocShare.getAvailableFormats(doc.fileType);
      const modals = modalsContainer();
      modals.innerHTML = DocUI.renderShareAsModal(doc, formats);

      bindShareAsModalEvents(doc);
    } catch (error) {
      console.error('Share modal failed:', error);
      DocUI.showToast('Failed to open share options.', 'error');
    }
  }

  function bindShareAsModalEvents(doc) {
    const modal = document.getElementById('shareAsModal');
    const closeBtn = document.getElementById('shareAsClose');
    const shareBtn = document.getElementById('shareAsShareBtn');
    const downloadBtn = document.getElementById('shareAsDownloadBtn');
    const whatsAppBtn = document.getElementById('shareAsWhatsAppBtn');
    const formatList = document.getElementById('shareFormatList');

    const closeModal = () => modal.remove();

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (formatList) {
      formatList.addEventListener('change', (e) => {
        formatList.querySelectorAll('.share-format-option').forEach((opt) => {
          const radio = opt.querySelector('input[type="radio"]');
          opt.classList.toggle('selected', radio.checked);
        });
      });
    }

    function getSelectedFormat() {
      const checkedRadio = modal.querySelector('input[name="shareFormat"]:checked');
      return checkedRadio ? checkedRadio.value : 'original';
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const fmt = getSelectedFormat();
        shareBtn.classList.add('loading');
        shareBtn.disabled = true;

        try {
          const result = await DocShare.shareDocumentAs(doc.id, fmt);
          closeModal();
          if (result.success && result.method === 'download') {
            DocUI.showToast(`Shared & Downloaded as ${fmt.toUpperCase()}!`, 'success');
          } else if (result.success && result.method === 'native') {
            DocUI.showToast(`Shared as ${fmt.toUpperCase()}!`, 'success');
          }
        } catch (err) {
          console.error('Share error:', err);
          DocUI.showToast('Failed to share in selected format.', 'error');
        } finally {
          shareBtn.classList.remove('loading');
          shareBtn.disabled = false;
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const fmt = getSelectedFormat();
        try {
          const blob = await DocDB.getFileBlob(doc.id);
          const converted = await DocShare.convertFile(blob, doc.fileType, fmt, doc.name, doc.fileName);
          DocShare.downloadFile(converted.blob, converted.fileName);
          closeModal();
          DocUI.showToast(`Downloaded as ${converted.fileName}!`, 'success');
        } catch (err) {
          console.error('Download error:', err);
          DocUI.showToast('Failed to download in selected format.', 'error');
        }
      });
    }

    if (whatsAppBtn) {
      whatsAppBtn.addEventListener('click', async () => {
        const fmt = getSelectedFormat();
        try {
          const blob = await DocDB.getFileBlob(doc.id);
          const converted = await DocShare.convertFile(blob, doc.fileType, fmt, doc.name, doc.fileName);
          const file = new File([converted.blob], converted.fileName, { type: converted.mime });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: doc.name,
            });
            closeModal();
            DocUI.showToast(`Shared ${converted.fileName}!`, 'success');
          } else {
            
            DocShare.downloadFile(converted.blob, converted.fileName);
            closeModal();
            DocUI.showToast(`Downloaded ${converted.fileName}! Please attach this file in WhatsApp.`, 'info', 5000);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('WhatsApp share error:', err);
            DocUI.showToast('Failed to share document.', 'error');
          }
        }
      });
    }
  }

  async function downloadDoc(docId) {
    try {
      await DocShare.downloadDocument(docId);
      DocUI.showToast('Download started!', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      DocUI.showToast('Failed to download.', 'error');
    }
  }

  async function toggleFavorite(docId) {
    try {
      const updated = await DocDB.toggleFavorite(docId);
      DocUI.showToast(
        updated.isFavorite ? 'Added to favorites ⭐' : 'Removed from favorites',
        'info'
      );

      await renderCurrentScreen();
    } catch (error) {
      console.error('Favorite toggle failed:', error);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('docvault_theme', next);

    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  async function exportBackup() {
    try {
      DocUI.showToast('Preparing backup...', 'info');
      await DocShare.exportBackup();
      DocUI.showToast('Backup downloaded!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      DocUI.showToast('Failed to create backup.', 'error');
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function initScreenSecurity() {
    // Secret 5-tap counter on header logo for testing screenshots
    const logoEl = document.querySelector('.app-header .logo');
    let tapCount = 0;
    let tapTimer = null;

    function handleLogoTap(e) {
      if (e) e.stopPropagation();
      tapCount++;
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, 2500);

      triggerHaptic(15);

      if (tapCount === 3) {
        DocUI.showToast('Tap 2 more times for Secret Screenshot Mode...', 'info');
      }

      if (tapCount >= 5) {
        tapCount = 0;
        if (tapTimer) clearTimeout(tapTimer);
        const currentDisabled = localStorage.getItem('vaulta_screen_security') === 'disabled';
        const newStatus = currentDisabled ? 'enabled' : 'disabled';
        localStorage.setItem('vaulta_screen_security', newStatus);

        triggerHaptic([60, 100, 60]);
        if (newStatus === 'disabled') {
          DocUI.showToast('🔓 Secret Test Mode: Screenshots ALLOWED (Protection OFF)', 'warning');
        } else {
          DocUI.showToast('🛡️ Screen Security ACTIVATED (Protection ON — Screenshots Blocked)', 'success');
        }
        updatePrivacyShieldState();
      }
    }

    if (logoEl) {
      logoEl.addEventListener('click', handleLogoTap);
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('.lock-app-icon')) {
        handleLogoTap(e);
      }
    });

    // Privacy shield element for obfuscating screen during app switch or capture attempts
    let shieldEl = document.getElementById('vaultaPrivacyShield');
    if (!shieldEl) {
      shieldEl = document.createElement('div');
      shieldEl.id = 'vaultaPrivacyShield';
      shieldEl.className = 'screen-privacy-shield';
      shieldEl.style.display = 'none';
      shieldEl.innerHTML = `
        <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 28px rgba(99, 102, 241, 0.35);">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <h3 style="font-size: 1.2rem; font-weight: 700; color: #ffffff; margin: 0;">Protected Content</h3>
        <p style="font-size: 0.85rem; color: #94a3b8; max-width: 290px; margin: 0; line-height: 1.4;">
          Vaulta Screen Security is active. Content is obfuscated to protect sensitive documents.
        </p>
      `;
      document.body.appendChild(shieldEl);
    }

    function isScreenSecActive() {
      return localStorage.getItem('vaulta_screen_security') !== 'disabled';
    }

    function showShield() {
      if (isScreenSecActive() && shieldEl) {
        shieldEl.style.display = 'flex';
      }
    }

    function hideShield() {
      if (shieldEl) {
        shieldEl.style.display = 'none';
      }
    }

    function updatePrivacyShieldState() {
      if (!isScreenSecActive()) {
        hideShield();
      }
    }

    // Obfuscate when app loses focus / app-switcher opened
    window.addEventListener('blur', () => {
      if (window.SecurityModule && typeof window.SecurityModule.isLockSuppressed === 'function' && window.SecurityModule.isLockSuppressed()) {
        return;
      }
      if (isScreenSecActive()) showShield();
    });

    window.addEventListener('focus', () => {
      hideShield();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (window.SecurityModule && typeof window.SecurityModule.isLockSuppressed === 'function' && window.SecurityModule.isLockSuppressed()) {
          return;
        }
        if (isScreenSecActive()) showShield();
      } else {
        hideShield();
      }
    });

    // Multi-touch screenshot gesture detection (e.g. 3-finger swipe on Android)
    window.addEventListener('touchstart', (e) => {
      if (!isScreenSecActive()) return;
      if (e.touches && e.touches.length >= 3) {
        showShield();
        DocUI.showToast('🛡️ Screenshot blocked by Vaulta Screen Security', 'warning');
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isScreenSecActive()) return;
      if (e.touches && e.touches.length >= 3) {
        showShield();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (!e.touches || e.touches.length < 3) {
        setTimeout(() => {
          hideShield();
        }, 1200);
      }
    }, { passive: true });

    // Anti-screenshot key shortcuts
    window.addEventListener('keydown', (e) => {
      if (!isScreenSecActive()) return;

      const isPrtSc = e.key === 'PrintScreen';
      const isMacScreenshot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key);

      if (isPrtSc || isMacScreenshot) {
        e.preventDefault();
        showShield();
        DocUI.showToast('🛡️ Screenshot blocked by Vaulta Screen Security', 'warning');
        setTimeout(hideShield, 1500);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!isScreenSecActive()) return;
      if (e.key === 'PrintScreen') {
        showShield();
        DocUI.showToast('🛡️ Screenshot blocked by Vaulta Screen Security', 'warning');
        setTimeout(hideShield, 1500);
      }
    });

    // Prevent context menu (right click / long-press save) on documents & sensitive images
    document.addEventListener('contextmenu', (e) => {
      if (!isScreenSecActive()) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      e.preventDefault();
    });

    window.VaultaScreenSec = {
      isActive: isScreenSecActive,
      toggle: () => {
        const current = isScreenSecActive();
        localStorage.setItem('vaulta_screen_security', current ? 'disabled' : 'enabled');
        updatePrivacyShieldState();
        return !current;
      }
    };
  }

  return {
    init,
    navigate,
    toggleTheme,
    exportBackup,
    openUploadModal,
    requestNotificationPermission,
    updateActiveTab,
    syncActiveTab,
  };
})();

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
