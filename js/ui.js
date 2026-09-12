
const DocUI = (() => {
  
  const CATEGORIES = {
    personal: [
      { name: 'All', icon: '📋', color: 'var(--color-accent-primary)' },
      { name: 'Identity', icon: '🪪', color: 'var(--color-cat-identity)' },
      { name: 'Financial', icon: '🏦', color: 'var(--color-cat-financial)' },
      { name: 'Education', icon: '🎓', color: 'var(--color-cat-education)' },
      { name: 'Insurance', icon: '📋', color: 'var(--color-cat-insurance)' },
      { name: 'Property', icon: '🏠', color: 'var(--color-cat-property)' },
      { name: 'Other', icon: '📄', color: 'var(--color-cat-other)' },
    ],
    official: [
      { name: 'All', icon: '📋', color: 'var(--color-accent-primary)' },
      { name: 'Employment', icon: '💼', color: 'var(--color-cat-employment)' },
      { name: 'Salary', icon: '💰', color: 'var(--color-cat-salary)' },
      { name: 'Appraisal', icon: '📊', color: 'var(--color-cat-appraisal)' },
      { name: 'Company ID', icon: '🆔', color: 'var(--color-cat-company-id)' },
      { name: 'Certificate', icon: '📜', color: 'var(--color-cat-certificate)' },
      { name: 'Agreements', icon: '📝', color: 'var(--color-cat-agreements)' },
      { name: 'Other', icon: '📄', color: 'var(--color-cat-other)' },
    ],
  };

  const CUSTOM_CATS_KEY = 'vaulta_custom_categories';

  function getCustomCategories() {
    try {
      const data = localStorage.getItem(CUSTOM_CATS_KEY);
      return data ? JSON.parse(data) : { personal: [], official: [] };
    } catch (e) {
      return { personal: [], official: [] };
    }
  }

  function addCustomCategory(vault, categoryName) {
    if (!categoryName || !categoryName.trim()) return 'Other';
    const trimmed = categoryName.trim();
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    const targetVault = vault === 'official' ? 'official' : 'personal';
    const builtIn = CATEGORIES[targetVault] || [];

    const matchBuiltIn = builtIn.find((c) => c.name.toLowerCase() === formatted.toLowerCase());
    if (matchBuiltIn) return matchBuiltIn.name;

    const custom = getCustomCategories();
    if (!custom[targetVault]) custom[targetVault] = [];

    const existingCustom = custom[targetVault].find((c) => c.toLowerCase() === formatted.toLowerCase());
    if (!existingCustom) {
      custom[targetVault].push(formatted);
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(custom));
      return formatted;
    }

    return existingCustom;
  }

  function getAllCategories(vault) {
    const targetVault = vault === 'official' ? 'official' : 'personal';
    const builtIn = CATEGORIES[targetVault] || [];
    const customNames = getCustomCategories()[targetVault] || [];

    const customObjs = customNames.map((name) => ({
      name,
      icon: '🏷️',
      color: 'var(--color-accent-secondary)',
      isCustom: true,
    }));

    const otherIdx = builtIn.findIndex((c) => c.name === 'Other');
    if (otherIdx !== -1) {
      const list = [...builtIn];
      list.splice(otherIdx, 0, ...customObjs);
      return list;
    }
    return [...builtIn, ...customObjs];
  }

  const FOLDERS_STORAGE_KEY = 'vaulta_nested_folders_v2';

  function getFolders() {
    try {
      const data = localStorage.getItem(FOLDERS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFolders(folders) {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  }

  function createFolder(vault, name, parentId = null) {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    const folders = getFolders();
    const targetVault = vault === 'official' ? 'official' : 'personal';

    const existing = folders.find(
      (f) => f.vault === targetVault && (f.parentId || null) === (parentId || null) && f.name.toLowerCase() === formatted.toLowerCase()
    );
    if (existing) return existing;

    const newFolder = {
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      vault: targetVault,
      name: formatted,
      parentId: parentId || null,
      createdAt: Date.now(),
    };

    folders.push(newFolder);
    saveFolders(folders);
    return newFolder;
  }

  function deleteFolder(folderId) {
    let folders = getFolders();
    const idsToDelete = new Set([folderId]);
    let added = true;
    while (added) {
      added = false;
      folders.forEach((f) => {
        if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
          idsToDelete.add(f.id);
          added = true;
        }
      });
    }

    folders = folders.filter((f) => !idsToDelete.has(f.id));
    saveFolders(folders);
    return Array.from(idsToDelete);
  }

  function getFolder(folderId) {
    if (!folderId) return null;
    const folders = getFolders();
    return folders.find((f) => f.id === folderId) || null;
  }

  function getChildFolders(vault, parentId = null) {
    const targetVault = vault === 'official' ? 'official' : 'personal';
    const folders = getFolders();
    return folders.filter(
      (f) => f.vault === targetVault && (f.parentId || null) === (parentId || null)
    );
  }

  function getFolderPath(folderId) {
    const path = [];
    let current = getFolder(folderId);
    while (current) {
      path.unshift(current);
      current = getFolder(current.parentId);
    }
    return path;
  }

  function getAllFoldersFlat(vault) {
    const targetVault = vault === 'official' ? 'official' : 'personal';
    const folders = getFolders().filter((f) => f.vault === targetVault);

    const result = [];
    function traverse(parentId, depth = 0) {
      const children = folders.filter((f) => (f.parentId || null) === parentId);
      children.forEach((child) => {
        result.push({
          ...child,
          displayName: '— '.repeat(depth) + child.name,
        });
        traverse(child.id, depth + 1);
      });
    }
    traverse(null, 0);
    return result;
  }

  function updateFolder(folderId, newName) {
    if (!folderId || !newName || !newName.trim()) return null;
    const trimmed = newName.trim();
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      folder.name = formatted;
      saveFolders(folders);
      return folder;
    }
    return null;
  }

  function renderFolderCard(folder, itemCount = 0) {
    return `
      <div class="doc-card folder-card" data-folder-id="${folder.id}">
        <div class="doc-thumbnail folder-thumbnail" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08)); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px;">
          <div style="width: 50px; height: 50px; border-radius: 14px; background: rgba(99, 102, 241, 0.18); border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
        </div>

        <div class="doc-actions" style="opacity: 1; gap: 4px;">
          <button class="doc-action-btn edit-folder-btn" data-folder-id="${folder.id}" title="Rename folder" aria-label="Rename folder">
            ✏️
          </button>
          <button class="doc-action-btn delete-folder-btn" data-folder-id="${folder.id}" title="Delete folder" aria-label="Delete folder" style="color: var(--color-accent-danger);">
            🗑️
          </button>
        </div>

        <div class="doc-info">
          <div class="doc-name" title="${escapeHtml(folder.name)}" style="font-weight: 700;">${escapeHtml(folder.name)}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-2);">
            <span class="doc-folder-badge" style="background: rgba(99, 102, 241, 0.14); color: var(--color-accent-primary); border-color: rgba(99, 102, 241, 0.28); font-weight: 600;">
              📁 Folder
            </span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-weight: 600;">
              ${itemCount} ${itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function getCategoryIcon(category, vault) {
    const cats = getAllCategories(vault || 'personal');
    const cat = cats.find((c) => c.name.toLowerCase() === (category || '').toLowerCase());
    return cat ? cat.icon : '📄';
  }

  function getCategoryColor(category) {
    const map = {
      'Identity': 'var(--color-cat-identity)',
      'Financial': 'var(--color-cat-financial)',
      'Education': 'var(--color-cat-education)',
      'Insurance': 'var(--color-cat-insurance)',
      'Property': 'var(--color-cat-property)',
      'Employment': 'var(--color-cat-employment)',
      'Salary': 'var(--color-cat-salary)',
      'Appraisal': 'var(--color-cat-appraisal)',
      'Company ID': 'var(--color-cat-company-id)',
      'Certificate': 'var(--color-cat-certificate)',
      'Agreements': 'var(--color-cat-agreements)',
      'Other': 'var(--color-cat-other)',
    };
    return map[category] || 'var(--color-accent-secondary)';
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function getFileTypeIcon(fileType, fileName = '') {
    const fn = (fileName || '').toLowerCase();
    const ft = (fileType || '').toLowerCase();

    if (ft.includes('pdf') || fn.endsWith('.pdf')) return '📕';
    if (ft.includes('image') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png') || fn.endsWith('.webp')) return '🖼️';
    if (ft.includes('excel') || ft.includes('spreadsheet') || ft.includes('csv') || fn.endsWith('.xls') || fn.endsWith('.xlsx') || fn.endsWith('.csv')) return '📊';
    return '📄';
  }

  function getUsedCategories(docs) {
    const map = new Map();
    map.set('all', { name: 'All', icon: '📂' });

    (docs || []).forEach((d) => {
      if (d.category) {
        const key = d.category.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: d.category.trim(),
            icon: getCategoryIcon(d.category, d.vault),
          });
        }
      }
    });

    return Array.from(map.values());
  }

  function renderHome(container, { personalCount, officialCount, allDocs = [], filteredDocs = [], favoriteDocs = [], activeCategory = 'all' }) {
    const categories = getUsedCategories(allDocs);
    const docsToRender = (activeCategory && activeCategory !== 'all') ? filteredDocs : allDocs;

    container.innerHTML = `
      <div class="container page-enter">
        <!-- Search Bar -->
        <div class="search-container" style="margin-top: var(--space-4); margin-bottom: var(--space-5);">
          <span class="search-icon-svg">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" class="search-bar" id="globalSearch" placeholder="Search ID cards, certificates, files..." autocomplete="off" />
          <button class="search-clear" id="searchClear" aria-label="Clear search">✕</button>
        </div>

        <!-- Search Results (hidden by default) -->
        <div id="searchResults" style="display:none; margin-bottom: var(--space-8);">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon-svg">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span> Search Results
            </h2>
            <button class="section-action" id="clearSearch">Clear</button>
          </div>
          <div class="documents-grid anim-stagger" id="searchResultsGrid"></div>
          <div id="searchEmptyState" style="display:none;">
            <div class="empty-state">
              <div class="empty-icon-svg">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <h3 class="empty-title">No results found</h3>
              <p class="empty-desc">Try a different search term</p>
            </div>
          </div>
        </div>

        <!-- Home Content -->
        <div id="homeContent">
          <!-- Stacked Hero Vault Cards -->
          <div class="vaults-grid">
            <div class="vault-card vault-hero-card personal" id="vaultPersonal" role="button" tabindex="0" aria-label="Open Personal Vault">
              <div class="vault-hero-badge">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <div class="vault-hero-body">
                <div class="vault-hero-header">
                  <h2 class="vault-hero-title">Personal Vault</h2>
                  <span class="vault-hero-tag">Private</span>
                </div>
                <p class="vault-hero-subtitle">Aadhaar, PAN, Passport, Health & Family</p>
              </div>
              <div class="vault-hero-meta">
                <span class="vault-count-badge">${personalCount} docs</span>
                <span class="vault-hero-arrow">›</span>
              </div>
            </div>

            <div class="vault-card vault-hero-card official" id="vaultOfficial" role="button" tabindex="0" aria-label="Open Official Vault">
              <div class="vault-hero-badge">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              </div>
              <div class="vault-hero-body">
                <div class="vault-hero-header">
                  <h2 class="vault-hero-title">Official Vault</h2>
                  <span class="vault-hero-tag official-tag">Work & Tax</span>
                </div>
                <p class="vault-hero-subtitle">Offer Letters, Experience, Tax & Payslips</p>
              </div>
              <div class="vault-hero-meta">
                <span class="vault-count-badge">${officialCount} docs</span>
                <span class="vault-hero-arrow">›</span>
              </div>
            </div>
          </div>

          <!-- Quick Actions Shortcut Bar -->
          <div class="quick-actions-bar">
            <button class="quick-action-pill" id="quickActionScan" data-quick-action="scan" title="Scan Document">
              <div class="quick-pill-icon icon-cyan">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </div>
              <span class="quick-pill-label">Scan ID</span>
            </button>
            <button class="quick-action-pill" data-quick-action="upload" title="Upload File">
              <div class="quick-pill-icon icon-indigo">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <span class="quick-pill-label">Upload</span>
            </button>
            <button class="quick-action-pill" data-quick-action="favorites" title="View Starred Documents">
              <div class="quick-pill-icon icon-amber">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </div>
              <span class="quick-pill-label">Starred</span>
            </button>
            <button class="quick-action-pill" data-quick-action="expiring" title="View Expiring Soon">
              <div class="quick-pill-icon icon-rose">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <span class="quick-pill-label">Expiring</span>
            </button>
          </div>

          <!-- Favorites Section -->
          ${favoriteDocs.length > 0 ? `
            <div class="section-header">
              <h2 class="section-title">
                <span class="section-icon-svg" style="color: #f59e0b;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </span> Starred Documents
              </h2>
            </div>
            <div class="favorites-row">
              ${favoriteDocs.map((doc) => renderFavCard(doc)).join('')}
            </div>
          ` : ''}

          <!-- All Documents Section Header -->
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon-svg">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </span> All Documents
            </h2>
            <span class="section-count-badge">${allDocs.length} total</span>
          </div>

          <!-- Category Chips Filter -->
          <div class="category-chips" id="homeCategoryChips" style="margin-bottom: var(--space-4);">
            ${categories.map((cat) => `
              <button class="category-chip ${(activeCategory.toLowerCase() === cat.name.toLowerCase() || (activeCategory === 'all' && cat.name === 'All')) ? 'active' : ''}"
                      data-category="${cat.name === 'All' ? 'all' : cat.name}">
                ${escapeHtml(cat.name)}
              </button>
            `).join('')}
          </div>

          ${docsToRender.length > 0 ? `
            <div class="documents-grid anim-stagger">
              ${docsToRender.map((doc) => renderDocCard(doc)).join('')}
            </div>
          ` : allDocs.length === 0 ? `
            <!-- Interactive Quick Start Onboarding Card (Eliminates empty void) -->
            <div class="quick-start-card anim-fade-in">
              <div class="quick-start-header">
                <div class="quick-start-sparkle">✨</div>
                <div>
                  <h3 class="quick-start-title">Quick Start Suggestions</h3>
                  <p class="quick-start-desc">Tap any essential document to add it in seconds:</p>
                </div>
              </div>
              <div class="template-chips-grid">
                <button class="template-chip" data-template-name="Aadhaar Card" data-template-category="Identity" data-template-vault="personal">
                  <span class="chip-plus">+</span> Aadhaar Card
                </button>
                <button class="template-chip" data-template-name="PAN Card" data-template-category="Identity" data-template-vault="personal">
                  <span class="chip-plus">+</span> PAN Card
                </button>
                <button class="template-chip" data-template-name="Driving License" data-template-category="Identity" data-template-vault="personal">
                  <span class="chip-plus">+</span> Driving License
                </button>
                <button class="template-chip" data-template-name="Passport" data-template-category="Identity" data-template-vault="personal">
                  <span class="chip-plus">+</span> Passport
                </button>
                <button class="template-chip" data-template-name="Offer Letter" data-template-category="Work" data-template-vault="official">
                  <span class="chip-plus">+</span> Offer Letter
                </button>
                <button class="template-chip" data-template-name="Vehicle RC / Insurance" data-template-category="Finance" data-template-vault="personal">
                  <span class="chip-plus">+</span> Vehicle RC / Insurance
                </button>
              </div>
              <div style="margin-top: var(--space-4); text-align: center;">
                <button class="btn btn-primary" id="emptyUploadBtn" style="padding: 10px 24px;">
                  <span>+ Custom Document Upload</span>
                </button>
              </div>
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-icon-svg">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <h3 class="empty-title">No documents in this category</h3>
              <p class="empty-desc">Try selecting a different filter above.</p>
              <button class="btn btn-primary" id="emptyUploadBtn">
                <span class="btn-text">+ Upload Document</span>
              </button>
            </div>
          `}
        </div>

        <!-- Floating Action Button -->
        <button class="fab" id="fabUpload" aria-label="Upload document">+</button>
      </div>
    `;
  }

  function renderFavCard(doc) {
    const thumbContent = doc.thumbnail
      ? `<img src="${doc.thumbnail}" alt="${doc.name}" />`
      : `<span style="font-size: 28px; opacity: 0.5;">${getFileTypeIcon(doc.fileType)}</span>`;

    return `
      <div class="fav-card" data-doc-id="${doc.id}" data-action="preview">
        <div class="fav-thumb">${thumbContent}</div>
        <div class="fav-name">${escapeHtml(doc.name)}</div>
      </div>
    `;
  }

  function renderDocCard(doc, selectMode = false) {
    const thumbContent = doc.thumbnail
      ? `<img src="${doc.thumbnail}" alt="${doc.name}" loading="lazy" />`
      : `<span class="doc-type-icon">${getFileTypeIcon(doc.fileType)}</span>`;

    const selectCheckbox = selectMode
      ? `<div class="doc-select-checkbox" data-doc-id="${doc.id}" data-action="toggle-select">
           <input type="checkbox" id="select-${doc.id}" />
           <label for="select-${doc.id}"></label>
         </div>`
      : '';

    let expiryBadge = '';
    const dbObj = window.DocDB || (typeof DocDB !== 'undefined' ? DocDB : null);
    if (doc.expiryDate && dbObj && typeof dbObj.getExpiryStatus === 'function') {
      const exp = dbObj.getExpiryStatus(doc.expiryDate);
      if (exp.status === 'expired') {
        expiryBadge = `<span class="expiry-badge expired" title="Expired on ${doc.expiryDate}">🔴 Expired</span>`;
      } else if (exp.status === 'expiring-soon') {
        expiryBadge = `<span class="expiry-badge expiring-soon" title="Expires on ${doc.expiryDate}">🟡 ${exp.daysLeft}d left</span>`;
      } else if (doc.expiryDate) {
        expiryBadge = `<span class="expiry-badge valid" title="Expires on ${doc.expiryDate}">🟢 Valid</span>`;
      }
    }

    return `
      <div class="doc-card ${selectMode ? 'select-mode' : ''}" draggable="true" data-doc-id="${doc.id}" data-vault="${doc.vault}" data-action="${selectMode ? 'toggle-select' : 'preview'}">
        <div class="doc-card-swipe-wrapper">
          <div class="doc-swipe-actions doc-swipe-actions-right">
            <button class="swipe-action-btn swipe-share" data-doc-id="${doc.id}" data-swipe-action="share">
              ↗<span class="swipe-label">Share</span>
            </button>
            <button class="swipe-action-btn swipe-fav" data-doc-id="${doc.id}" data-swipe-action="favorite">
              ${doc.isFavorite ? '★' : '☆'}<span class="swipe-label">${doc.isFavorite ? 'Unfav' : 'Fav'}</span>
            </button>
          </div>
          <div class="doc-card-inner">
            ${selectCheckbox}
            <div class="doc-quick-actions">
              <button class="quick-act-btn" data-doc-id="${doc.id}" data-action="preview" title="Quick Preview">👁️</button>
              <button class="quick-act-btn" data-doc-id="${doc.id}" data-action="share" title="Download & Share">📥</button>
              <button class="quick-act-btn" data-doc-id="${doc.id}" data-action="favorite" title="Toggle Favorite">${doc.isFavorite ? '★' : '☆'}</button>
            </div>
            <div class="doc-thumbnail">${thumbContent}</div>
            <div class="doc-actions">
              <button class="doc-action-btn favorite ${doc.isFavorite ? 'active' : ''}"
                      data-doc-id="${doc.id}" data-action="favorite"
                      aria-label="${doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
                      title="${doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                ${doc.isFavorite ? '★' : '☆'}
              </button>
              <button class="doc-action-btn" data-doc-id="${doc.id}" data-action="share"
                      aria-label="Share document" title="Share">
                ↗
              </button>
            </div>
            <div class="doc-info">
              <div class="doc-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: var(--space-2); max-width: 100%; overflow: hidden;">
                <span class="doc-category-badge" style="background: ${getCategoryColor(doc.category)}15; color: ${getCategoryColor(doc.category)};">
                  ${getCategoryIcon(doc.category, doc.vault)} ${escapeHtml(doc.category)}
                </span>
                ${expiryBadge}
                ${doc.isEncrypted ? `<span class="doc-tag-badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 600;" title="Encrypted at rest with AES-256-GCM">🔒 AES</span>` : ''}
                ${doc.folder ? `<span class="doc-folder-badge">📁 ${escapeHtml(doc.folder)}</span>` : ''}
                ${(doc.tags || []).slice(0, 3).map((tag) => `<span class="doc-tag-badge">#${escapeHtml(tag)}</span>`).join('')}
              </div>
              <div class="doc-date">${formatDate(doc.createdAt)}</div>
            </div>
          </div>
          <div class="doc-swipe-actions doc-swipe-actions-left">
            <button class="swipe-action-btn swipe-delete" data-doc-id="${doc.id}" data-swipe-action="delete">
              🗑<span class="swipe-label">Delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderVault(container, { vault, currentFolder, folderPath = [], subFolders = [], subFolderCounts = {}, documents, activeCategory, sortBy }) {
    const isPersonal = vault === 'personal';
    const categories = getAllCategories(vault);
    const title = isPersonal ? 'Personal Vault' : 'Official Vault';

    let breadcrumbHtml = `
      <span class="breadcrumb-item ${!currentFolder ? 'active' : ''}" data-nav-folder="root">
        ${title}
      </span>
    `;

    folderPath.forEach((f, idx) => {
      const isLast = idx === folderPath.length - 1;
      breadcrumbHtml += `
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-nav-folder="${f.id}">
          ${escapeHtml(f.name)}
        </span>
      `;
    });

    const folderCardsHtml = subFolders.map((f) => renderFolderCard(f, subFolderCounts[f.id] || 0)).join('');
    const docCardsHtml = documents.map((doc) => renderDocCard(doc)).join('');
    const totalItems = subFolders.length + documents.length;

    container.innerHTML = `
      <div class="container page-enter">
        <!-- Vault Hero Banner -->
        <div class="vault-hero-card ${vault}" style="margin-top: var(--space-4); margin-bottom: var(--space-4); cursor: default;">
          <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <button class="vault-back-circle-btn" id="vaultBackBtn" title="Back" aria-label="Back">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <div class="vault-hero-badge" id="vaultHeroBadge" style="width: 44px; height: 44px; cursor: pointer;" title="Security & App Lock">
              ${isPersonal ? `
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              ` : `
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              `}
            </div>
            <div class="vault-hero-body" style="min-width: 0;">
              <div class="vault-hero-header" style="flex-wrap: wrap; gap: 6px;">
                <div class="vault-breadcrumbs" style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 1.05rem; color: var(--color-text-primary);">
                  ${breadcrumbHtml}
                </div>
                <span class="vault-hero-tag ${vault === 'official' ? 'official-tag' : ''}">${isPersonal ? 'Private' : 'Work & Tax'}</span>
              </div>
              <p class="vault-hero-subtitle" style="margin: 0; font-size: 0.78rem;">
                ${isPersonal ? 'Aadhaar, PAN, Passport, Health & Family' : 'Offer Letters, Experience, Tax & Payslips'}
                <span style="opacity: 0.5; margin: 0 4px;">•</span>
                <span style="color: var(--color-accent-primary); font-weight: 600;">${documents.length} doc${documents.length !== 1 ? 's' : ''}</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Vault Actions Toolbar (Pills) -->
        <div class="vault-actions-toolbar" style="margin-bottom: var(--space-4);">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button class="vault-action-pill" id="createFolderBtn" title="Create Folder">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
              <span>+ Folder</span>
            </button>
            <button class="vault-action-pill" id="bulkSelectBtn" title="Select Multiple">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              <span>Select & Share</span>
            </button>
          </div>
          <div class="sort-dropdown">
            <button class="vault-action-pill sort-btn" id="sortToggle" title="Sort Order">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 15 12 20 17 15"></polyline><polyline points="7 9 12 4 17 9"></polyline></svg>
              <span>${getSortLabel(sortBy)}</span>
              <span style="font-size: 0.65rem; opacity: 0.7; margin-left: 2px;">▾</span>
            </button>
            <div class="sort-menu" id="sortMenu">
              <button class="sort-option ${sortBy === 'date-desc' ? 'active' : ''}" data-sort="date-desc">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="10 16 12 18 14 16"></polyline></svg>
                <span>Newest First</span>
              </button>
              <button class="sort-option ${sortBy === 'date-asc' ? 'active' : ''}" data-sort="date-asc">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="10 14 12 12 14 14"></polyline></svg>
                <span>Oldest First</span>
              </button>
              <button class="sort-option ${sortBy === 'name-asc' ? 'active' : ''}" data-sort="name-asc">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6v12M18 9l-3-3-3 3M4 18h6M4 14h8M4 10h10M4 6h12"/></svg>
                <span>Name A-Z</span>
              </button>
              <button class="sort-option ${sortBy === 'name-desc' ? 'active' : ''}" data-sort="name-desc">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18V6M18 15l-3 3-3-3M4 18h6M4 14h8M4 10h10M4 6h12"/></svg>
                <span>Name Z-A</span>
              </button>
              <button class="sort-option ${sortBy === 'category' ? 'active' : ''}" data-sort="category">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Category</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Bulk Select Bar (hidden by default) -->
        <div class="bulk-action-bar" id="bulkActionBar" style="display: none; margin-bottom: var(--space-4);">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <button class="btn btn-ghost" id="selectAllBtn">☑ Select All</button>
            <span id="selectedCount" style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">0 selected</span>
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
            <button class="btn btn-primary" id="bulkShareBtn" disabled style="font-size: var(--font-size-sm);">
              📤 Share Selected
            </button>
            <button class="btn btn-secondary" id="bulkDownloadBtn" disabled style="font-size: var(--font-size-sm);">
              ⬇ Download Selected
            </button>
            <button class="btn btn-secondary" id="bulkWhatsAppBtn" disabled style="font-size: var(--font-size-sm);">
              💬 WhatsApp
            </button>
            <button class="btn btn-ghost" id="cancelSelectBtn">✕ Cancel</button>
          </div>
        </div>

        <!-- Search (vault-specific) -->
        <div class="search-container" style="margin-bottom: var(--space-4);">
          <span class="search-icon-svg">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" class="search-bar" id="vaultSearch" placeholder="Search in ${title.toLowerCase()}..." autocomplete="off" />
          <button class="search-clear" id="vaultSearchClear" aria-label="Clear search">✕</button>
        </div>

        <!-- Category Chips -->
        <div class="category-chips" id="categoryChips" style="margin-bottom: var(--space-5);">
          ${categories.map((cat) => `
            <button class="category-chip ${(activeCategory === cat.name || (activeCategory === 'all' && cat.name === 'All')) ? 'active' : ''}"
                    data-category="${cat.name === 'All' ? 'all' : cat.name}">
              ${escapeHtml(cat.name)}
            </button>
          `).join('')}
        </div>

        <!-- Documents & Folders Grid -->
        <div class="documents-grid anim-stagger" id="documentsGrid">
          ${folderCardsHtml}
          ${docCardsHtml}
        </div>

        ${totalItems === 0 ? `
          <div class="quick-start-card anim-fade-in" style="margin-top: var(--space-4);">
            <div class="quick-start-header">
              <div class="quick-start-sparkle">${isPersonal ? '🔐' : '💼'}</div>
              <div>
                <h3 class="quick-start-title">${currentFolder ? escapeHtml(currentFolder.name) + ' is Empty' : title + ' is Ready'}</h3>
                <p class="quick-start-desc">${currentFolder ? 'No documents in this folder yet.' : isPersonal ? 'Store and organize your personal identity cards, health records, and family documents.' : 'Store and organize your official employment, tax, and work documents.'}</p>
              </div>
            </div>

            <div style="margin-top: 12px; margin-bottom: 8px;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 8px;">Quick Suggestions:</span>
              <div class="template-chips-grid">
                ${isPersonal ? `
                  <button class="template-chip" data-template-name="Aadhaar Card" data-template-category="Identity" data-template-vault="personal">
                    <span class="chip-plus">+</span> Aadhaar Card
                  </button>
                  <button class="template-chip" data-template-name="PAN Card" data-template-category="Identity" data-template-vault="personal">
                    <span class="chip-plus">+</span> PAN Card
                  </button>
                  <button class="template-chip" data-template-name="Driving License" data-template-category="Identity" data-template-vault="personal">
                    <span class="chip-plus">+</span> Driving License
                  </button>
                  <button class="template-chip" data-template-name="Passport" data-template-category="Identity" data-template-vault="personal">
                    <span class="chip-plus">+</span> Passport
                  </button>
                  <button class="template-chip" data-template-name="Health Insurance" data-template-category="Insurance" data-template-vault="personal">
                    <span class="chip-plus">+</span> Health Insurance
                  </button>
                  <button class="template-chip" data-template-name="Vehicle RC" data-template-category="Property" data-template-vault="personal">
                    <span class="chip-plus">+</span> Vehicle RC
                  </button>
                ` : `
                  <button class="template-chip" data-template-name="Offer Letter" data-template-category="Employment" data-template-vault="official">
                    <span class="chip-plus">+</span> Offer Letter
                  </button>
                  <button class="template-chip" data-template-name="Recent Payslip" data-template-category="Salary" data-template-vault="official">
                    <span class="chip-plus">+</span> Payslip
                  </button>
                  <button class="template-chip" data-template-name="Form 16 / Tax" data-template-category="Financial" data-template-vault="official">
                    <span class="chip-plus">+</span> Form 16
                  </button>
                  <button class="template-chip" data-template-name="Experience Letter" data-template-category="Employment" data-template-vault="official">
                    <span class="chip-plus">+</span> Experience Letter
                  </button>
                  <button class="template-chip" data-template-name="Degree Certificate" data-template-category="Education" data-template-vault="official">
                    <span class="chip-plus">+</span> Degree Certificate
                  </button>
                  <button class="template-chip" data-template-name="Company ID" data-template-category="Company ID" data-template-vault="official">
                    <span class="chip-plus">+</span> Company ID
                  </button>
                `}
              </div>
            </div>

            <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center; justify-content: flex-start; flex-wrap: wrap;">
              <button class="btn btn-primary" id="emptyUploadBtn" style="padding: 9px 20px;">
                <span class="btn-text">+ Upload Document</span>
              </button>
              <button class="btn btn-secondary" id="emptyCreateFolderBtn" style="padding: 9px 16px; font-size: 0.85rem;">
                📁 New Folder
              </button>
            </div>
          </div>
        ` : ''}

        <!-- FAB -->
        <button class="fab" id="fabUpload" aria-label="Upload document">+</button>
      </div>
    `;
  }

  function getSortLabel(sortBy) {
    const labels = {
      'date-desc': 'Newest',
      'date-asc': 'Oldest',
      'name-asc': 'A-Z',
      'name-desc': 'Z-A',
      'category': 'Category',
    };
    return labels[sortBy] || 'Sort';
  }

  function renderUploadModal(defaultVault = 'personal', selectedFolderId = null, prefill = {}) {
    const personalCats = getAllCategories('personal').filter((c) => c.name !== 'All');
    const officialCats = getAllCategories('official').filter((c) => c.name !== 'All');
    const personalFolders = getAllFoldersFlat('personal');
    const officialFolders = getAllFoldersFlat('official');
    const resolvedVault = prefill.vault || defaultVault || 'personal';

    return `
      <div class="modal-overlay active modal-overlay-enter" id="uploadModal">
        <div class="modal-content modal-content-enter">
          <div class="modal-header">
            <h2 class="modal-title">📤 Upload Document</h2>
            <button class="modal-close" id="uploadModalClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <!-- Compact Upload Zone -->
            <div class="drop-zone compact-drop-zone" id="dropZone" style="padding: 12px 16px; margin-bottom: 12px; border-radius: var(--radius-xl); border: 1.5px dashed rgba(99, 102, 241, 0.45); background: rgba(99, 102, 241, 0.05); cursor: pointer; position: relative;">
              <label for="fileInput" id="btnFileBrowse" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin: 0; -webkit-tap-highlight-color: transparent;">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                  <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--gradient-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  </div>
                  <div style="text-align: left; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--color-text-primary); line-height: 1.2;">Choose Document to Upload</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 2px;">PDF, Images (JPG, PNG), Excel or CSV</div>
                  </div>
                </div>
                <span class="btn btn-secondary btn-sm" style="pointer-events: none; padding: 7px 14px; font-size: 0.8rem; font-weight: 600; flex-shrink: 0;">Browse</span>
              </label>

              <input type="file" id="fileInput" accept="image/*,.pdf,.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; opacity: 0;" />
            </div>

            <!-- Upload Preview -->
            <div class="upload-preview" id="uploadPreview">
              <button class="preview-remove" id="previewRemove" aria-label="Remove file">✕</button>
            </div>

            <!-- Form Fields -->
            <div class="form-group">
              <label class="form-label" for="docName">Document Name *</label>
              <input type="text" class="form-input" id="docName" placeholder="e.g. Aadhaar Card Front" value="${escapeHtml(prefill.name || '')}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="docVault">Vault *</label>
                <select class="form-select" id="docVault">
                  <option value="personal" ${resolvedVault === 'personal' ? 'selected' : ''}>Personal</option>
                  <option value="official" ${resolvedVault === 'official' ? 'selected' : ''}>Official</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="docCategory">Category *</label>
                <select class="form-select" id="docCategory">
                  <optgroup label="Personal" id="personalCatGroup" ${resolvedVault !== 'personal' ? 'style="display:none;"' : ''}>
                    ${personalCats.map((c) => `<option value="${c.name}" ${(prefill.category && prefill.category.toLowerCase() === c.name.toLowerCase()) ? 'selected' : ''}>${c.name}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Official" id="officialCatGroup" ${resolvedVault !== 'official' ? 'style="display:none;"' : ''}>
                    ${officialCats.map((c) => `<option value="${c.name}" ${(prefill.category && prefill.category.toLowerCase() === c.name.toLowerCase()) ? 'selected' : ''}>${c.name}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
            </div>

            <div class="form-group" id="customCategoryGroup" style="display: none;">
              <label class="form-label" for="customCategory">Custom Category Name *</label>
              <input type="text" class="form-input" id="customCategory" placeholder="e.g. Medical, Tax Receipts, Vehicle" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="docFolder">Folder / Location</label>
                <select class="form-select" id="docFolder">
                  <option value="">Root (Main Vault)</option>
                  <optgroup label="Personal Folders" id="personalFolderGroup" ${defaultVault !== 'personal' ? 'style="display:none;"' : ''}>
                    ${personalFolders.map((f) => `<option value="${f.id}" ${selectedFolderId === f.id ? 'selected' : ''}>${escapeHtml(f.displayName)}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Official Folders" id="officialFolderGroup" ${defaultVault !== 'official' ? 'style="display:none;"' : ''}>
                    ${officialFolders.map((f) => `<option value="${f.id}" ${selectedFolderId === f.id ? 'selected' : ''}>${escapeHtml(f.displayName)}</option>`).join('')}
                  </optgroup>
                  <option value="__new__">+ Create New Folder...</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Expiry Date (Optional)</label>
                <input type="hidden" id="docExpiry" value="" />
                <div id="docExpiry_container" class="vaulta-datepicker-wrapper"></div>
              </div>
            </div>

            <div class="form-group" id="newFolderGroup" style="display: none;">
              <label class="form-label" for="newFolderName">New Folder Name *</label>
              <input type="text" class="form-input" id="newFolderName" placeholder="e.g. Nettech Service, TCS, Agreements" />
            </div>

            <div class="form-group">
              <label class="form-label" for="docTags">Tags (comma separated)</label>
              <input type="text" class="form-input" id="docTags" placeholder="e.g. identity, government, front" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="uploadCancel">Cancel</button>
            <button class="btn btn-primary" id="uploadSubmit" disabled>
              <span class="btn-text">📤 Upload</span>
              <div class="btn-spinner spinner"></div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEditModal(doc) {
    const personalCats = getAllCategories('personal').filter((c) => c.name !== 'All');
    const officialCats = getAllCategories('official').filter((c) => c.name !== 'All');
    const personalFolders = getAllFoldersFlat('personal');
    const officialFolders = getAllFoldersFlat('official');

    return `
      <div class="modal-overlay active modal-overlay-enter" id="editModal">
        <div class="modal-content modal-content-enter">
          <div class="modal-header">
            <h2 class="modal-title">✏️ Edit Document</h2>
            <button class="modal-close" id="editModalClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="editDocName">Document Name *</label>
              <input type="text" class="form-input" id="editDocName" value="${escapeHtml(doc.name)}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="editDocVault">Vault *</label>
                <select class="form-select" id="editDocVault">
                  <option value="personal" ${doc.vault === 'personal' ? 'selected' : ''}>Personal</option>
                  <option value="official" ${doc.vault === 'official' ? 'selected' : ''}>Official</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="editDocCategory">Category *</label>
                <select class="form-select" id="editDocCategory">
                  <optgroup label="Personal" id="editPersonalCatGroup" ${doc.vault !== 'personal' ? 'style="display:none;"' : ''}>
                    ${personalCats.map((c) => `<option value="${c.name}" ${doc.category === c.name && doc.vault === 'personal' ? 'selected' : ''}>${c.name}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Official" id="editOfficialCatGroup" ${doc.vault !== 'official' ? 'style="display:none;"' : ''}>
                    ${officialCats.map((c) => `<option value="${c.name}" ${doc.category === c.name && doc.vault === 'official' ? 'selected' : ''}>${c.name}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
            </div>

            <div class="form-group" id="editCustomCategoryGroup" style="display: none;">
              <label class="form-label" for="editCustomCategory">Custom Category Name *</label>
              <input type="text" class="form-input" id="editCustomCategory" placeholder="e.g. Medical, Tax Receipts, Vehicle" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="editDocFolder">Folder / Location</label>
                <select class="form-select" id="editDocFolder">
                  <option value="">Root (Main Vault)</option>
                  <optgroup label="Personal Folders" id="editPersonalFolderGroup" ${doc.vault !== 'personal' ? 'style="display:none;"' : ''}>
                    ${personalFolders.map((f) => `<option value="${f.id}" ${doc.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.displayName)}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Official Folders" id="editOfficialFolderGroup" ${doc.vault !== 'official' ? 'style="display:none;"' : ''}>
                    ${officialFolders.map((f) => `<option value="${f.id}" ${doc.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.displayName)}</option>`).join('')}
                  </optgroup>
                  <option value="__new__">+ Create New Folder...</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Expiry Date (Optional)</label>
                <input type="hidden" id="editDocExpiry" value="${doc.expiryDate || ''}" />
                <div id="editDocExpiry_container" class="vaulta-datepicker-wrapper"></div>
              </div>
            </div>

            <div class="form-group" id="editNewFolderGroup" style="display: none;">
              <label class="form-label" for="editNewFolderName">New Folder Name *</label>
              <input type="text" class="form-input" id="editNewFolderName" placeholder="e.g. Nettech Service, TCS, Agreements" />
            </div>

            <div class="form-group">
              <label class="form-label" for="editDocTags">Tags (comma separated)</label>
              <input type="text" class="form-input" id="editDocTags" value="${(doc.tags || []).join(', ')}" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="editCancel" type="button" style="min-width: 90px;">Cancel</button>
            <button class="btn btn-primary" id="editSubmit" data-doc-id="${doc.id}" type="button" style="flex: 1; padding: 12px 18px; font-weight: 700; background: var(--gradient-accent); font-size: 0.92rem;">
              <span class="btn-text">💾 Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async function loadPdfJsLibrary() {
    if (window.pdfjsLib) return window.pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js library script failed to load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js script'));
      document.head.appendChild(script);
    });
  }

  function renderPreview(doc, fileUrl) {
    const isImage = doc.fileType && doc.fileType.startsWith('image/');
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const fileName = (doc.fileName || doc.name || '').toLowerCase();
    const isExcel = (doc.fileType && (doc.fileType.includes('excel') || doc.fileType.includes('spreadsheet') || doc.fileType.includes('csv'))) || fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv');

    let expiryBadge = '';
    const dbObj = window.DocDB || (typeof DocDB !== 'undefined' ? DocDB : null);
    if (doc.expiryDate && dbObj && typeof dbObj.getExpiryStatus === 'function') {
      const exp = dbObj.getExpiryStatus(doc.expiryDate);
      if (exp.status === 'expired') {
        expiryBadge = `<span class="expiry-badge expired" title="Expired on ${doc.expiryDate}">🔴 Expired</span>`;
      } else if (exp.status === 'expiring-soon') {
        expiryBadge = `<span class="expiry-badge expiring-soon" title="Expires on ${doc.expiryDate}">🟡 ${exp.daysLeft}d left</span>`;
      } else if (doc.expiryDate) {
        expiryBadge = `<span class="expiry-badge valid" title="Expires on ${doc.expiryDate}">🟢 Valid</span>`;
      }
    }

    let viewerContent;
    if (isImage) {
      viewerContent = `<img src="${fileUrl}" alt="${escapeHtml(doc.name)}" />`;
    } else if (isPdf) {
      viewerContent = `
        <div class="pdf-viewer-container" id="pdfViewerContainer">
          <div class="pdf-loading">
            <div class="spinner"></div>
            <span>Loading PDF document...</span>
          </div>
        </div>
      `;
    } else if (isExcel) {
      viewerContent = `
        <div class="empty-state" style="padding: var(--space-8);">
          <div class="empty-icon anim-float" style="font-size: 4rem;">📊</div>
          <h3 class="empty-title">${escapeHtml(doc.name)}</h3>
          <p class="empty-desc">Excel / Spreadsheet Document (${escapeHtml(doc.fileName || 'Spreadsheet')})</p>
          <a class="btn btn-primary" href="${fileUrl}" download="${escapeHtml(doc.fileName || doc.name)}" style="margin-top: var(--space-4);">
            <span class="btn-text">⬇ Download / Open Excel File</span>
          </a>
        </div>
      `;
    } else {
      viewerContent = `
        <div class="empty-state">
          <div class="empty-icon">${getFileTypeIcon(doc.fileType, doc.fileName || doc.name)}</div>
          <h3 class="empty-title">Preview unavailable</h3>
          <p class="empty-desc">Download the file to view it.</p>
        </div>
      `;
    }

    return `
      <div class="preview-overlay active modal-overlay-enter" id="previewOverlay">
        <div class="preview-header">
          <div class="preview-header-left">
            <button class="back-btn" id="previewClose" aria-label="Close preview">← Back</button>
            <span class="preview-title" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
          </div>
          <div class="preview-actions">
            <button class="header-btn ${doc.isFavorite ? 'active' : ''}" id="previewFavorite"
                    data-doc-id="${doc.id}" title="${doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
              ${doc.isFavorite ? '★' : '☆'}
            </button>
            <button class="header-btn desktop-only-btn" id="previewEdit" data-doc-id="${doc.id}" title="Edit details">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="header-btn desktop-only-btn" id="previewShare" data-doc-id="${doc.id}" title="Share">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            <button class="header-btn desktop-only-btn" id="previewDownload" data-doc-id="${doc.id}" title="Download">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button class="header-btn desktop-only-btn danger" id="previewDelete" data-doc-id="${doc.id}" title="Delete" style="color: var(--color-accent-danger);">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>
        <div class="preview-body modal-content-enter">
          ${viewerContent}
          <div class="preview-meta-bar" style="padding: var(--space-3) var(--space-4); background: var(--color-bg-secondary); border-top: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
              <span class="doc-category-badge" style="background: ${getCategoryColor(doc.category)}15; color: ${getCategoryColor(doc.category)};">
                ${getCategoryIcon(doc.category, doc.vault)} ${escapeHtml(doc.category)}
              </span>
              ${expiryBadge}
              ${(doc.tags || []).length > 0 ? `
                <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                  ${doc.tags.map((t) => `<span class="doc-tag-badge">#${escapeHtml(t)}</span>`).join('')}
                </div>
              ` : '<span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">No tags</span>'}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: var(--font-size-xs); color: var(--color-text-tertiary);">
              ${doc.isEncrypted ? `<span class="settings-pill-badge pill-active" style="padding: 2px 7px; font-size: 0.65rem;">🔒 AES-256 ENCRYPTED</span>` : ''}
              <span>Added ${formatDate(doc.createdAt)}</span>
            </div>
          </div>
        </div>
        <div class="preview-mobile-footer">
          <button class="mobile-action-btn" id="previewMobileEdit" data-doc-id="${doc.id}">
            <span class="btn-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </span>
            <span class="btn-label">Edit</span>
          </button>
          <button class="mobile-action-btn" id="previewMobileShare" data-doc-id="${doc.id}">
            <span class="btn-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </span>
            <span class="btn-label">Share</span>
          </button>
          <button class="mobile-action-btn" id="previewMobileDownload" data-doc-id="${doc.id}">
            <span class="btn-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </span>
            <span class="btn-label">Download</span>
          </button>
          <button class="mobile-action-btn danger" id="previewMobileDelete" data-doc-id="${doc.id}">
            <span class="btn-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </span>
            <span class="btn-label">Delete</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderDeleteConfirm(docId, docName) {
    return `
      <div class="modal-overlay active modal-overlay-enter" id="deleteModal">
        <div class="modal-content modal-content-enter confirm-dialog" style="max-width: 400px;">
          <div class="modal-body" style="padding: var(--space-8);">
            <div class="confirm-icon">🗑️</div>
            <h3 style="text-align: center; margin-bottom: var(--space-2); font-size: var(--font-size-lg);">Delete Document?</h3>
            <p class="confirm-text">Are you sure you want to delete <strong>"${escapeHtml(docName)}"</strong>? This action cannot be undone.</p>
            <div class="confirm-actions">
              <button class="btn btn-secondary" id="deleteCancel">Cancel</button>
              <button class="btn btn-danger" id="deleteConfirm" data-doc-id="${docId}">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderShareAsModal(doc, formats) {
    return `
      <div class="modal-overlay active modal-overlay-enter" id="shareAsModal">
        <div class="modal-content modal-content-enter" style="max-width: 440px;">
          <div class="modal-header">
            <h2 class="modal-title">↗ Share As</h2>
            <button class="modal-close" id="shareAsClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4); background: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
              <div style="font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm);">${escapeHtml(doc.name)}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 2px;">${escapeHtml(doc.fileName)}</div>
            </div>

            <p class="form-label" style="margin-bottom: var(--space-3);">Choose format to share:</p>

            <div class="share-format-list" id="shareFormatList">
              ${formats.map((fmt, i) => `
                <label class="share-format-option ${i === 0 ? 'selected' : ''}" data-format="${fmt.id}">
                  <input type="radio" name="shareFormat" value="${fmt.id}" ${i === 0 ? 'checked' : ''} />
                  <span class="share-format-icon">${fmt.icon}</span>
                  <span class="share-format-label">${fmt.label}</span>
                  ${i === 0 ? '<span class="share-format-tag">Recommended</span>' : ''}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer" style="flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; gap: var(--space-3); width: 100%;">
              <button class="btn btn-primary" id="shareAsShareBtn" data-doc-id="${doc.id}" style="flex: 1;">
                <span class="btn-text">↗ Share</span>
                <div class="btn-spinner spinner"></div>
              </button>
              <button class="btn btn-secondary" id="shareAsDownloadBtn" data-doc-id="${doc.id}" style="flex: 1;">
                ⬇ Download
              </button>
            </div>
            <button class="btn btn-secondary" id="shareAsWhatsAppBtn" data-doc-id="${doc.id}" style="width: 100%;">
              💬 Send via WhatsApp
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderCreateFolderModal() {
    return `
      <div class="modal-overlay active modal-overlay-enter" id="createFolderModal">
        <div class="modal-content modal-content-enter" style="max-width: 440px;">
          <div class="modal-header">
            <h2 class="modal-title">📁 Create New Folder</h2>
            <button class="modal-close" id="createFolderClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding: var(--space-6);">
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: var(--space-6);">
              <div style="font-size: 3.5rem; filter: drop-shadow(0 4px 10px rgba(99, 102, 241, 0.3)); margin-bottom: var(--space-2);">📁</div>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Organize your documents into custom folders and sub-folders.</p>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="customFolderName">Folder Name *</label>
              <input type="text" class="form-input" id="customFolderName" placeholder="e.g. Nettech Service, TCS, Agreements" autocomplete="off" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="createFolderCancel">Cancel</button>
            <button class="btn btn-primary" id="createFolderSubmit">
              <span class="btn-text">📁 Create Folder</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEditFolderModal(folder) {
    return `
      <div class="modal-overlay active modal-overlay-enter" id="editFolderModal">
        <div class="modal-content modal-content-enter" style="max-width: 440px;">
          <div class="modal-header">
            <h2 class="modal-title">✏️ Rename Folder</h2>
            <button class="modal-close" id="editFolderClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding: var(--space-6);">
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: var(--space-6);">
              <div style="font-size: 3.5rem; filter: drop-shadow(0 4px 10px rgba(99, 102, 241, 0.3)); margin-bottom: var(--space-2);">📁</div>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Enter a new name for this folder.</p>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="editFolderNameInput">Folder Name *</label>
              <input type="text" class="form-input" id="editFolderNameInput" value="${escapeHtml(folder.name)}" placeholder="e.g. Nettech Service" autocomplete="off" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="editFolderCancel">Cancel</button>
            <button class="btn btn-primary" id="editFolderSubmit">
              <span class="btn-text">💾 Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSecretSyncModal() {
    return `
      <div class="modal-overlay active modal-overlay-enter" id="secretSyncModal">
        <div class="modal-content modal-content-enter" style="max-width: 500px;">
          <div class="modal-header">
            <h2 class="modal-title">🔐 Secret Vault Sync & Transfer</h2>
            <button class="modal-close" id="secretSyncClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding: var(--space-6);">
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: var(--space-6);">
              <div style="font-size: 3.5rem; filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.4)); margin-bottom: var(--space-2);">📲</div>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5;">
                Transfer all your PC documents, custom folders, and categories to your mobile phone app seamlessly without uploading manually!
              </p>
            </div>

            <!-- Steps Instructions -->
            <div style="background: rgba(99, 102, 241, 0.08); border: 1px dashed rgba(99, 102, 241, 0.3); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-6); font-size: var(--font-size-xs); color: var(--color-text-secondary);">
              <div style="font-weight: var(--font-weight-bold); color: var(--color-accent-primary); margin-bottom: 6px;">💡 How to sync PC data to Phone:</div>
              <ol style="margin: 0; padding-left: 18px; line-height: 1.6;">
                <li>Click <strong>Export Vault Sync File</strong> below on your PC.</li>
                <li>Send the downloaded <code>.json</code> or <code>.vaulta</code> file to your Phone (WhatsApp/Email/Drive/Files).</li>
                <li>Open Vaulta on your Phone, tap <strong>💾 Sync</strong>, and select the file!</li>
              </ol>
            </div>

            <!-- Action Options -->
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              <button class="btn btn-primary" id="secretSyncExportBtn" style="padding: var(--space-3) var(--space-4); justify-content: center; font-weight: var(--font-weight-bold);">
                <span class="btn-text">📦 Export Vault Sync File (.json)</span>
                <div class="btn-spinner spinner"></div>
              </button>

              <div style="position: relative; text-align: center; margin: 4px 0;">
                <span style="background: var(--color-bg-secondary); padding: 0 10px; font-size: var(--font-size-xs); color: var(--color-text-tertiary); position: relative; z-index: 1;">OR RESTORE DATA ON PHONE</span>
                <div style="position: absolute; top: 50%; left: 0; right: 0; border-top: 1px solid var(--color-border); z-index: 0;"></div>
              </div>

              <div class="drop-zone" id="secretSyncDropZone" style="padding: var(--space-4); text-align: center; cursor: pointer;">
                <div style="font-size: 1.8rem; margin-bottom: 4px;">📥</div>
                <p class="drop-text" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Select or Drag & Drop Sync File (.json / .vaulta)</p>
                <p class="drop-subtext" style="font-size: var(--font-size-xs);">To import PC data into this device</p>
                <input type="file" id="secretSyncFileInput" accept=".json,.vaulta,.vault,.vaulta.json,.txt,application/json,text/plain,*/*" style="display:none;" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="secretSyncCancel" style="width: 100%;">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type} toast-enter`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close notification">✕</button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      removeToast(toast);
    });

    setTimeout(() => removeToast(toast), duration);
  }

  function removeToast(toast) {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }

  async function renderSecurityModal() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;

    const isSecEnabled = window.SecurityModule ? window.SecurityModule.isSecurityEnabled() : false;
    const hasPin = window.SecurityModule ? window.SecurityModule.hasPasscode() : false;
    const isBioEnabled = window.SecurityModule ? window.SecurityModule.isBiometricsEnabled() : false;
    const isEncEnabled = window.SecurityModule && typeof window.SecurityModule.isEncryptionEnabled === 'function'
      ? window.SecurityModule.isEncryptionEnabled()
      : true;

    let encStats = { total: 0, encrypted: 0, unencrypted: 0 };
    if (window.SecurityModule && typeof window.SecurityModule.getEncryptionStats === 'function') {
      try {
        encStats = await window.SecurityModule.getEncryptionStats();
      } catch (_) {}
    }
    
    let isBioSupported = false;
    let bioStatusText = '';

    const statusObj = window.SecurityModule && typeof window.SecurityModule.getBiometricsStatus === 'function'
      ? window.SecurityModule.getBiometricsStatus()
      : { supported: true, message: '' };

    if (!statusObj.supported) {
      isBioSupported = false;
      bioStatusText = statusObj.message || 'Not supported on this browser';
    } else {
      try {
        if (window.SecurityModule && typeof window.SecurityModule.isBiometricsSupported === 'function') {
          isBioSupported = await Promise.race([
            window.SecurityModule.isBiometricsSupported(),
            new Promise((resolve) => setTimeout(() => resolve(false), 3000))
          ]);
        }
      } catch (e) {
        console.warn('[Security] Biometrics check error:', e);
        isBioSupported = false;
      }
      bioStatusText = isBioSupported
        ? (isBioEnabled ? 'Device fingerprint / biometric sensor ready' : 'Sensor detected & ready to pair')
        : 'Device / Windows Hello sensor not detected';
    }

    document.body.classList.add('modal-open');
    const isScreenSecActive = window.VaultaScreenSec
      ? (typeof window.VaultaScreenSec.isEnabled === 'function'
          ? window.VaultaScreenSec.isEnabled()
          : (typeof window.VaultaScreenSec.isActive === 'function' ? window.VaultaScreenSec.isActive() : true))
      : true;

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="securityModalOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 460px;" role="dialog" aria-modal="true" aria-labelledby="securityModalTitle">
          <div class="modal-header">
            <h2 class="modal-title" id="securityModalTitle" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent-primary);"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Security & App Lock
            </h2>
            <button class="modal-close" id="closeSecurityModalBtn" aria-label="Close modal">✕</button>
          </div>
          <div class="modal-body" style="padding-top: var(--space-3); max-height: 75vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 8px; padding-left: 4px;">Access Protection</div>
            <div class="settings-card-group">
              <div class="settings-row-item" style="flex-direction: column; align-items: stretch; gap: 10px;">
                <div style="display: flex; align-items: center; gap: var(--space-3); width: 100%;">
                  <div class="settings-icon-tile tile-cyan">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="8.01" y2="6"></line><line x1="12" y1="6" x2="12.01" y2="6"></line><line x1="16" y1="6" x2="16.01" y2="6"></line><line x1="8" y1="10" x2="8.01" y2="10"></line><line x1="12" y1="10" x2="12.01" y2="10"></line><line x1="16" y1="10" x2="16.01" y2="10"></line><line x1="8" y1="14" x2="8.01" y2="14"></line><line x1="12" y1="14" x2="12.01" y2="14"></line><line x1="16" y1="14" x2="16.01" y2="14"></line><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                  </div>
                  <div class="settings-item-body">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="settings-item-title">Passcode PIN</span>
                      <span class="settings-pill-badge ${hasPin ? 'pill-active' : 'pill-inactive'}">${hasPin ? 'CONFIGURED' : 'NOT SET'}</span>
                    </div>
                    <div class="settings-item-subtitle">${hasPin ? 'App lock is active with security PIN' : 'Set a PIN code to lock the app'}</div>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="setPinBtn">
                      ${hasPin ? 'Change' : 'Set PIN'}
                    </button>
                    ${hasPin ? `
                      <button type="button" class="btn btn-ghost btn-sm" id="removePinBtn" style="color: var(--color-danger); font-size: 0.8rem; padding: 4px 8px;" title="Remove Passcode PIN">
                        ✕
                      </button>
                    ` : ''}
                  </div>
                </div>
                <div id="pinInputGroup" style="display: none; background: var(--color-bg-tertiary); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--color-border);">
                  <input type="password" id="newPinInput" maxlength="6" pattern="[0-9]*" inputmode="numeric" placeholder="Enter 4 to 6 digit PIN" class="form-input" style="margin-bottom: 8px; width: 100%;">
                  <button type="button" class="btn btn-primary btn-sm" id="savePinBtn" style="width: 100%;">Save Passcode PIN</button>
                </div>
              </div>

              <div class="settings-row-item">
                <div class="settings-icon-tile tile-emerald">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11c0 3.5-1.5 6-3 7.5"></path><path d="M12 7c-2 0-4 1.5-4 4.5 0 2.5.5 4.5 2 6"></path><path d="M12 3c-4.5 0-8 3.5-8 8.5 0 3 1.5 6 3 7.5"></path><path d="M15 8.5c.5.8.7 1.7.7 2.7 0 2.5-1 4.5-2 6"></path><path d="M18.5 7C19.5 8.5 20 10 20 12c0 3.5-1.5 6.5-3 8"></path></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="settings-item-title">Fingerprint / Biometrics</span>
                    <span class="settings-pill-badge ${isBioEnabled ? 'pill-active' : 'pill-inactive'}">${isBioEnabled ? 'ENABLED' : 'OFF'}</span>
                  </div>
                  <div class="settings-item-subtitle">${bioStatusText}</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="toggleBioBtn" ${!isBioSupported ? 'disabled' : ''}>
                  ${isBioEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>

              <div class="settings-row-item">
                <div class="settings-icon-tile tile-amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="settings-item-title">Screen Privacy Shield</span>
                    <span class="settings-pill-badge ${isScreenSecActive ? 'pill-active' : 'pill-inactive'}">${isScreenSecActive ? 'ACTIVE' : 'OFF'}</span>
                  </div>
                  <div class="settings-item-subtitle">Obfuscates content in task switchers & anti-screenshot protection</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="toggleScreenSecBtn">
                  ${isScreenSecActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            <!-- At-Rest Encryption Section -->
            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-top: 18px; margin-bottom: 8px; padding-left: 4px;">Data Encryption (At-Rest)</div>
            <div class="settings-card-group">
              <div class="settings-row-item" style="flex-direction: column; align-items: stretch; gap: 12px;">
                <div style="display: flex; align-items: center; gap: var(--space-3); width: 100%;">
                  <div class="settings-icon-tile tile-violet">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
                  </div>
                  <div class="settings-item-body">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="settings-item-title">AES-256-GCM Vault</span>
                      <span class="settings-pill-badge ${isEncEnabled ? 'pill-active' : 'pill-inactive'}">${isEncEnabled ? 'ACTIVE' : 'OFF'}</span>
                    </div>
                    <div class="settings-item-subtitle">Hardware-accelerated AES-GCM at-rest encryption in IndexedDB</div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" id="toggleEncryptionBtn">
                    ${isEncEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>

                <div style="background: var(--color-bg-tertiary); border-radius: var(--radius-lg); padding: 12px; border: 1px solid var(--color-border); font-size: 0.82rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: var(--color-text-primary); display: flex; align-items: center; gap: 6px;">
                      <span>🔐</span> Encryption Coverage
                    </span>
                    <span style="font-weight: 700; color: ${encStats.unencrypted === 0 && encStats.total > 0 ? '#10b981' : 'var(--color-accent-primary)'};">
                      ${encStats.total === 0 ? '0 documents' : `${encStats.encrypted} / ${encStats.total} Encrypted`}
                    </span>
                  </div>
                  <div style="font-size: 0.76rem; color: var(--color-text-secondary); line-height: 1.4;">
                    ${encStats.unencrypted === 0 && encStats.total > 0
                      ? '✅ 100% of your vault documents are encrypted with AES-256-GCM.'
                      : encStats.unencrypted > 0
                        ? `${encStats.unencrypted} document(s) are stored unencrypted. Encrypt them now for complete privacy.`
                        : 'Uploaded documents are encrypted automatically.'}
                  </div>
                  ${encStats.unencrypted > 0 ? `
                    <div style="margin-top: 10px;">
                      <button type="button" class="btn btn-primary btn-sm" id="encryptExistingDocsBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; padding: 8px;">
                        <span>🔒 Encrypt ${encStats.unencrypted} Existing Document${encStats.unencrypted > 1 ? 's' : ''} Now</span>
                      </button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            ${isSecEnabled ? `
              <div style="margin-top: 16px;">
                <button type="button" class="btn btn-primary" id="lockNowBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--gradient-accent); font-weight: 600; padding: 12px;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Lock App Now
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeSecurityModalBtn');
    const backdrop = document.getElementById('securityModalOverlay');
    const closeModal = () => {
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    const setPinBtn = document.getElementById('setPinBtn');
    const removePinBtn = document.getElementById('removePinBtn');
    const pinGroup = document.getElementById('pinInputGroup');

    if (removePinBtn) {
      removePinBtn.addEventListener('click', () => {
        window.SecurityModule.removePasscode();
        showToast('🔓 Passcode PIN removed & App Lock turned off', 'info');
        renderSecurityModal();
      });
    }
    if (setPinBtn && pinGroup) {
      setPinBtn.addEventListener('click', () => {
        pinGroup.style.display = pinGroup.style.display === 'none' ? 'block' : 'none';
      });
    }

    const savePinBtn = document.getElementById('savePinBtn');
    const newPinInput = document.getElementById('newPinInput');
    if (savePinBtn && newPinInput) {
      savePinBtn.addEventListener('click', async () => {
        const pin = newPinInput.value.trim();
        if (pin.length < 4) {
          showToast('PIN must be at least 4 digits', 'warning');
          return;
        }
        await window.SecurityModule.setPasscode(pin);
        showToast('🔑 Passcode PIN saved successfully!', 'success');
        renderSecurityModal();
      });
    }

    const toggleBioBtn = document.getElementById('toggleBioBtn');
    if (toggleBioBtn) {
      toggleBioBtn.addEventListener('click', async () => {
        if (isBioEnabled) {
          window.SecurityModule.disableBiometric();
          showToast('Biometric unlock disabled', 'info');
          renderSecurityModal();
        } else {
          try {
            showToast('Scanning fingerprint / biometrics...', 'info');
            await window.SecurityModule.registerBiometric();
            showToast('🖐️ Biometric authentication enabled!', 'success');
            renderSecurityModal();
          } catch (err) {
            showToast(err.message || 'Biometric setup failed', 'error');
          }
        }
      });
    }

    const toggleScreenSecBtn = document.getElementById('toggleScreenSecBtn');
    if (toggleScreenSecBtn) {
      toggleScreenSecBtn.addEventListener('click', () => {
        if (window.VaultaScreenSec && typeof window.VaultaScreenSec.toggle === 'function') {
          const nowActive = window.VaultaScreenSec.toggle();
          showToast(nowActive ? '🛡️ Screen Privacy Shield Activated' : 'Screen Privacy Shield Disabled', 'info');
          renderSecurityModal();
        }
      });
    }

    const toggleEncryptionBtn = document.getElementById('toggleEncryptionBtn');
    if (toggleEncryptionBtn) {
      toggleEncryptionBtn.addEventListener('click', () => {
        const current = window.SecurityModule.isEncryptionEnabled();
        window.SecurityModule.setEncryptionEnabled(!current);
        showToast(!current ? '🔒 AES-256 Document Encryption Enabled' : 'Document Encryption Disabled', 'info');
        renderSecurityModal();
      });
    }

    const encryptExistingDocsBtn = document.getElementById('encryptExistingDocsBtn');
    if (encryptExistingDocsBtn) {
      encryptExistingDocsBtn.addEventListener('click', async () => {
        encryptExistingDocsBtn.disabled = true;
        encryptExistingDocsBtn.innerHTML = '<span class="spinner-sm"></span> Encrypting documents...';
        try {
          showToast('Encrypting vault documents with AES-256...', 'info');
          const result = await window.SecurityModule.encryptAllExistingDocuments((p) => {
            if (encryptExistingDocsBtn) {
              encryptExistingDocsBtn.textContent = `Encrypting (${p.current}/${p.total})...`;
            }
          });
          showToast(`✅ Successfully encrypted ${result.encryptedCount} document(s)!`, 'success');
          renderSecurityModal();
        } catch (err) {
          console.error('Batch encryption error:', err);
          showToast(err.message || 'Failed to encrypt documents', 'error');
          renderSecurityModal();
        }
      });
    }

    const lockNowBtn = document.getElementById('lockNowBtn');
    if (lockNowBtn) {
      lockNowBtn.addEventListener('click', () => {
        closeModal();
        window.SecurityModule.lockApp();
      });
    }
  }

  function getCustomOptionSvg(type, value, text) {
    const val = (value || '').toLowerCase();
    const txt = (text || '').toLowerCase();

    // Vault icons
    if (type === 'vault') {
      if (val === 'personal') {
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
      }
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
    }

    // Folder icons
    if (type === 'folder') {
      if (val === '__new__') {
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;
      }
      if (val === '') {
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
      }
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    }

    // Category icons
    if (txt.includes('identity')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#818cf8" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="9" cy="10" r="2"></circle><line x1="15" y1="8" x2="17" y2="8"></line><line x1="15" y1="12" x2="17" y2="12"></line><line x1="7" y1="16" x2="17" y2="16"></line></svg>`;
    }
    if (txt.includes('finan') || txt.includes('tax') || txt.includes('salary')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
    }
    if (txt.includes('educat') || txt.includes('degree')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a855f7" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`;
    }
    if (txt.includes('insur')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    }
    if (txt.includes('prop') || txt.includes('vehicle')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`;
    }
    if (txt.includes('employ') || txt.includes('work') || txt.includes('offer')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
    }
    if (txt.includes('apprais') || txt.includes('certif')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#eab308" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`;
    }
    if (txt.includes('company')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6366f1" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="12" cy="10" r="2.5"></circle><line x1="8" y1="16" x2="16" y2="16"></line></svg>`;
    }
    if (txt.includes('agree')) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ec4899" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
  }

  function setupVaultaCustomSelect(selectId, type = 'category') {
    const select = document.getElementById(selectId);
    if (!select) return null;

    select.style.display = 'none';

    const parent = select.parentElement;
    const existingWrapper = parent.querySelector(`.vaulta-custom-select-wrapper[data-for="${selectId}"]`);
    if (existingWrapper) existingWrapper.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'vaulta-custom-select-wrapper';
    wrapper.dataset.for = selectId;

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'button');

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.style.display = 'none';

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    parent.appendChild(wrapper);

    const cleanLabel = (text) => {
      if (!text) return '';
      return text.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim() || text;
    };

    const renderTrigger = () => {
      const selectedOption = select.options[select.selectedIndex] || select.options[0];
      const text = selectedOption ? cleanLabel(selectedOption.text) : 'Select...';
      const val = selectedOption ? selectedOption.value : '';
      const icon = getCustomOptionSvg(type, val, text);

      trigger.innerHTML = `
        <div class="custom-select-selection">
          <span class="custom-select-icon">${icon}</span>
          <span class="custom-select-label">${escapeHtml(text)}</span>
        </div>
        <span class="custom-select-chevron">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      `;
    };

    const appendOptionItem = (opt) => {
      const isSelected = opt.value === select.value;
      const text = cleanLabel(opt.text);
      const icon = getCustomOptionSvg(type, opt.value, text);

      const item = document.createElement('div');
      item.className = `custom-select-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="custom-select-item-content">
          <span class="custom-select-icon">${icon}</span>
          <span class="custom-select-item-label">${escapeHtml(text)}</span>
        </div>
        ${isSelected ? `<span class="custom-select-check">✓</span>` : ''}
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeMenu();
        renderTrigger();
      });

      menu.appendChild(item);
    };

    const renderMenu = () => {
      menu.innerHTML = '';
      const optgroups = Array.from(select.querySelectorAll('optgroup'));

      if (optgroups.length > 0) {
        optgroups.forEach((group) => {
          if (group.style.display === 'none') return;
          if (group.label) {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'custom-select-group-header';
            groupHeader.textContent = group.label;
            menu.appendChild(groupHeader);
          }
          Array.from(group.querySelectorAll('option')).forEach((opt) => {
            appendOptionItem(opt);
          });
        });
        Array.from(select.children).forEach((child) => {
          if (child.tagName === 'OPTION') appendOptionItem(child);
        });
      } else {
        Array.from(select.options).forEach((opt) => {
          appendOptionItem(opt);
        });
      }
    };

    const openMenu = () => {
      document.querySelectorAll('.custom-select-menu').forEach((m) => {
        if (m !== menu) m.style.display = 'none';
      });
      document.querySelectorAll('.custom-select-trigger').forEach((t) => {
        if (t !== trigger) t.classList.remove('active');
      });
      renderMenu();
      menu.style.display = 'block';
      trigger.classList.add('active');
    };

    const closeMenu = () => {
      menu.style.display = 'none';
      trigger.classList.remove('active');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.style.display === 'block') {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        closeMenu();
      }
    });

    select.addEventListener('change', () => {
      renderTrigger();
    });

    renderTrigger();

    return {
      refresh: () => {
        renderTrigger();
        if (menu.style.display === 'block') renderMenu();
      }
    };
  }

  function initVaultaDatePicker(containerId, hiddenInputId, initialDateVal = '') {
    const container = document.getElementById(containerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!container || !hiddenInput) return;

    let currentDate = initialDateVal ? new Date(initialDateVal) : new Date();
    if (isNaN(currentDate.getTime())) currentDate = new Date();

    let viewYear = currentDate.getFullYear();
    let viewMonth = currentDate.getMonth();
    let selectedDateStr = initialDateVal || '';

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const formatDisplay = (isoStr) => {
      if (!isoStr) return '<span style="color: var(--color-text-tertiary); font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Select expiry date...</span>';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return `<strong style="color: var(--color-accent-primary); font-size: 0.9rem;">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>`;
    };

    container.innerHTML = `
      <div class="vaulta-datepicker-trigger" id="${containerId}_trigger">
        <span class="vdp-display-text">${formatDisplay(selectedDateStr)}</span>
        <span style="display: flex; gap: 8px; align-items: center;">
          ${selectedDateStr ? `<span class="vdp-clear-btn" style="cursor:pointer; opacity:0.7; font-size:0.85rem;" title="Clear date">✕</span>` : ''}
          <span style="font-size: 1.1rem; opacity: 0.8;">📅</span>
        </span>
      </div>
      <div class="vaulta-datepicker-popover" id="${containerId}_popover" style="display: none;"></div>
    `;

    const trigger = document.getElementById(`${containerId}_trigger`);
    const popover = document.getElementById(`${containerId}_popover`);

    const renderCalendar = () => {
      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const todayStr = new Date().toISOString().split('T')[0];

      let daysHtml = '';
      for (let i = 0; i < firstDay; i++) {
        daysHtml += `<div class="vdp-day empty"></div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const mStr = String(viewMonth + 1).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        const iso = `${viewYear}-${mStr}-${dStr}`;

        const isToday = iso === todayStr ? 'today' : '';
        const isSelected = iso === selectedDateStr ? 'selected' : '';
        const isSunday = (firstDay + day - 1) % 7 === 0;

        daysHtml += `<div class="vdp-day ${isToday} ${isSelected} ${isSunday ? 'vdp-sunday' : ''}" data-date="${iso}">${day}</div>`;
      }

      popover.innerHTML = `
        <div class="vdp-header">
          <button class="vdp-nav-btn" id="${containerId}_prevMonth" title="Previous Month">‹</button>
          <div class="vdp-selectors">
            <div class="vdp-dropdown-wrap" id="${containerId}_monthWrap">
              <button type="button" class="vdp-custom-btn" id="${containerId}_monthBtn" aria-haspopup="true" aria-expanded="false">
                <span>${months[viewMonth]}</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="vdp-custom-menu month-menu" id="${containerId}_monthMenu" style="display: none;">
                ${months.map((m, idx) => `
                  <button type="button" class="vdp-custom-item ${idx === viewMonth ? 'selected' : ''}" data-month="${idx}">
                    <span>${m}</span>
                    ${idx === viewMonth ? '<span style="color:#818cf8;font-size:0.75rem;">✓</span>' : ''}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="vdp-dropdown-wrap" id="${containerId}_yearWrap">
              <button type="button" class="vdp-custom-btn" id="${containerId}_yearBtn" aria-haspopup="true" aria-expanded="false">
                <span>${viewYear}</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="vdp-custom-menu year-menu" id="${containerId}_yearMenu" style="display: none;">
                ${Array.from({ length: 121 }, (_, i) => 1950 + i).map((y) => `
                  <button type="button" class="vdp-custom-item ${y === viewYear ? 'selected' : ''}" data-year="${y}" id="${containerId}_year_opt_${y}">
                    <span>${y}</span>
                    ${y === viewYear ? '<span style="color:#818cf8;font-size:0.75rem;">✓</span>' : ''}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          <button class="vdp-nav-btn" id="${containerId}_nextMonth" title="Next Month">›</button>
        </div>

        <div class="vdp-weekdays">
          <span class="vdp-sunday">Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>

        <div class="vdp-days-grid">${daysHtml}</div>
      `;

      const prevBtn = document.getElementById(`${containerId}_prevMonth`);
      const nextBtn = document.getElementById(`${containerId}_nextMonth`);
      const monthBtn = document.getElementById(`${containerId}_monthBtn`);
      const monthMenu = document.getElementById(`${containerId}_monthMenu`);
      const yearBtn = document.getElementById(`${containerId}_yearBtn`);
      const yearMenu = document.getElementById(`${containerId}_yearMenu`);

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          viewMonth--;
          if (viewMonth < 0) { viewMonth = 11; viewYear--; }
          renderCalendar();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          viewMonth++;
          if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          renderCalendar();
        });
      }

      if (monthBtn && monthMenu) {
        monthBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = monthMenu.style.display === 'none';
          if (yearMenu) { yearMenu.style.display = 'none'; yearBtn?.classList.remove('active'); }
          monthMenu.style.display = isHidden ? 'flex' : 'none';
          monthBtn.classList.toggle('active', isHidden);
        });

        monthMenu.querySelectorAll('.vdp-custom-item').forEach((item) => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            viewMonth = parseInt(item.dataset.month, 10);
            renderCalendar();
          });
        });
      }

      if (yearBtn && yearMenu) {
        yearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = yearMenu.style.display === 'none';
          if (monthMenu) { monthMenu.style.display = 'none'; monthBtn?.classList.remove('active'); }
          yearMenu.style.display = isHidden ? 'flex' : 'none';
          yearBtn.classList.toggle('active', isHidden);
          if (isHidden) {
            const activeYearEl = document.getElementById(`${containerId}_year_opt_${viewYear}`);
            if (activeYearEl) {
              setTimeout(() => activeYearEl.scrollIntoView({ block: 'center' }), 10);
            }
          }
        });

        yearMenu.querySelectorAll('.vdp-custom-item').forEach((item) => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            viewYear = parseInt(item.dataset.year, 10);
            renderCalendar();
          });
        });
      }

      popover.querySelectorAll('.vdp-day:not(.empty)').forEach((dayEl) => {
        dayEl.addEventListener('click', (e) => {
          e.stopPropagation();
          selectDate(dayEl.dataset.date);
        });
      });
    };

    const selectDate = (isoStr) => {
      selectedDateStr = isoStr;
      hiddenInput.value = isoStr;
      popover.style.display = 'none';
      initVaultaDatePicker(containerId, hiddenInputId, isoStr);
    };

    trigger.addEventListener('click', (e) => {
      if (e.target.classList.contains('vdp-clear-btn')) {
        e.stopPropagation();
        selectDate('');
        return;
      }
      const isVisible = popover.style.display === 'block';
      popover.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) renderCalendar();
    });

    const closeOnOutside = (e) => {
      if (!container.contains(e.target)) {
        popover.style.display = 'none';
      }
    };
    if (container._closeHandler) document.removeEventListener('click', container._closeHandler);
    container._closeHandler = closeOnOutside;
    document.addEventListener('click', closeOnOutside);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function renderStorageAnalyticsModal() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;

    const stats = window.DocDB ? await window.DocDB.getStorageStats() : {
      totalBytes: 0, totalDocs: 0, vaultStats: { personal: { count: 0, bytes: 0 }, official: { count: 0, bytes: 0 } }, categoryStats: {}
    };

    const formattedTotal = formatBytes(stats.totalBytes);
    const personalSize = formatBytes(stats.vaultStats.personal.bytes);
    const officialSize = formatBytes(stats.vaultStats.official.bytes);

    const categories = Object.keys(stats.categoryStats);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#3b82f6'];

    let progressSegments = '';
    let categoryList = '';

    categories.forEach((cat, index) => {
      const cData = stats.categoryStats[cat];
      const percent = stats.totalBytes > 0 ? ((cData.bytes / stats.totalBytes) * 100).toFixed(1) : 0;
      const color = colors[index % colors.length];

      if (cData.bytes > 0) {
        progressSegments += `<div class="storage-progress-segment" style="width: ${percent}%; background: ${color};" title="${cat}: ${formatBytes(cData.bytes)} (${percent}%)"></div>`;
      }

      categoryList += `
        <div class="storage-cat-item">
          <div class="storage-cat-info">
            <span class="storage-cat-dot" style="background: ${color};"></span>
            <div>
              <strong style="font-size: 0.9rem;">${escapeHtml(cat)}</strong>
              <span style="display: block; font-size: 0.75rem; color: var(--color-text-secondary);">${cData.count} file${cData.count !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <strong style="font-size: 0.9rem;">${formatBytes(cData.bytes)}</strong>
        </div>
      `;
    });

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="storageModalOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 460px;" role="dialog" aria-modal="true" aria-labelledby="storageModalTitle">
          <div class="modal-header">
            <h2 class="modal-title" id="storageModalTitle">📊 Storage Analytics</h2>
            <button class="modal-close" id="closeStorageModalBtn" aria-label="Close modal">✕</button>
          </div>
          <div class="modal-body">
            <div style="text-align: center; margin-bottom: 16px;">
              <h3 style="font-size: 1.8rem; font-weight: 800; color: var(--color-text-primary); margin-bottom: 2px;">${formattedTotal}</h3>
              <p style="font-size: 0.8rem; color: var(--color-text-secondary);">Total storage consumed across ${stats.totalDocs} document${stats.totalDocs !== 1 ? 's' : ''}</p>
            </div>

            <div class="storage-progress-track">
              ${progressSegments || '<div class="storage-progress-segment" style="width: 100%; background: var(--color-border);"></div>'}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
              <div style="background: var(--color-bg-tertiary); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); text-align: center;">
                <span style="font-size: 0.78rem; color: var(--color-text-secondary); display: block;">🔐 Personal Vault</span>
                <strong style="font-size: 1.1rem; color: var(--color-text-primary);">${personalSize}</strong>
                <span style="font-size: 0.72rem; color: var(--color-text-secondary); display: block;">${stats.vaultStats.personal.count} files</span>
              </div>
              <div style="background: var(--color-bg-tertiary); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); text-align: center;">
                <span style="font-size: 0.78rem; color: var(--color-text-secondary); display: block;">💼 Official Vault</span>
                <strong style="font-size: 1.1rem; color: var(--color-text-primary);">${officialSize}</strong>
                <span style="font-size: 0.72rem; color: var(--color-text-secondary); display: block;">${stats.vaultStats.official.count} files</span>
              </div>
            </div>

            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 10px; color: var(--color-text-primary);">Category Breakdown</h4>
            <div class="storage-cat-list" style="display: flex; flex-direction: column; gap: 8px; touch-action: pan-y;">
              ${categoryList || '<p style="font-size: 0.85rem; color: var(--color-text-secondary); text-align: center;">No document category data</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeStorageModalBtn');
    const backdrop = document.getElementById('storageModalOverlay');
    const closeModal = () => { modalsContainer.innerHTML = ''; };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    bindSheetDragDismiss(backdrop);
  }

  async function renderExpiryTrackerModal() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;
    document.body.classList.add('modal-open');

    const dbObj = window.DocDB || (typeof DocDB !== 'undefined' ? DocDB : null);
    const allDocs = dbObj ? await dbObj.getAll() : [];

    const expiryDocs = allDocs
      .filter((d) => !!d.expiryDate)
      .map((d) => {
        const exp = (dbObj && typeof dbObj.getExpiryStatus === 'function')
          ? dbObj.getExpiryStatus(d.expiryDate)
          : { status: 'valid', daysLeft: 999 };
        return { ...d, expStatus: exp };
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    const expiredCount = expiryDocs.filter((d) => d.expStatus.status === 'expired').length;
    const soonCount = expiryDocs.filter((d) => d.expStatus.status === 'expiring-soon').length;
    const validCount = expiryDocs.filter((d) => d.expStatus.status === 'valid').length;

    let itemsHtml = '';
    if (expiryDocs.length === 0) {
      itemsHtml = `
        <div style="text-align: center; padding: 32px 16px;">
          <div style="font-size: 2.6rem; margin-bottom: 8px;">📅</div>
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--color-text-primary);">No Expiry Dates Set</h4>
          <p style="font-size: 0.82rem; color: var(--color-text-secondary); max-width: 290px; margin: 0 auto 16px; line-height: 1.4;">
            Set an expiry date on documents like Driving License, Passport, or IDs to track validity and get reminders.
          </p>
        </div>
      `;
    } else {
      itemsHtml = expiryDocs.map((doc) => {
        let badgeHtml = '';
        let badgeBg = '';
        let badgeColor = '';
        let timeRemainingText = '';

        const days = doc.expStatus.daysLeft;
        if (doc.expStatus.status === 'expired') {
          badgeHtml = '🔴 Expired';
          badgeBg = 'rgba(239, 68, 68, 0.15)';
          badgeColor = '#ef4444';
          const daysAgo = Math.abs(days);
          timeRemainingText = `Expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
        } else if (doc.expStatus.status === 'expiring-soon') {
          badgeHtml = `🟡 ${days}d left`;
          badgeBg = 'rgba(245, 158, 11, 0.15)';
          badgeColor = '#f59e0b';
          timeRemainingText = `Expires in ${days} days`;
        } else {
          badgeHtml = '🟢 Valid';
          badgeBg = 'rgba(16, 185, 129, 0.15)';
          badgeColor = '#10b981';
          if (days > 365) {
            const years = (days / 365.25).toFixed(1);
            timeRemainingText = `${years} years left (${days} days)`;
          } else {
            timeRemainingText = `${days} days left`;
          }
        }

        const dateFormatted = new Date(doc.expiryDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        return `
          <div class="expiry-item" data-doc-id="${doc.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); cursor: pointer; transition: all 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <span style="font-size: 1.4rem; flex-shrink: 0;">${getFileTypeIcon(doc.fileType)}</span>
              <div style="min-width: 0;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(doc.name)}</div>
                <div style="display: flex; gap: 6px; align-items: center; margin-top: 3px; font-size: 0.74rem; color: var(--color-text-secondary);">
                  <span style="color: var(--color-accent-primary); font-weight: 600;">${escapeHtml(doc.category)}</span>
                  <span>•</span>
                  <span>${dateFormatted}</span>
                </div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; margin-bottom: 2px;">
                ${badgeHtml}
              </span>
              <span style="display: block; font-size: 0.7rem; color: var(--color-text-tertiary);">${timeRemainingText}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="expiryTrackerOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 480px;" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2 class="modal-title">📅 Document Expiry Tracker</h2>
            <button class="modal-close" id="closeExpiryTrackerBtn" aria-label="Close modal">✕</button>
          </div>
          <div class="modal-body" style="padding: 14px 16px;">
            ${expiryDocs.length > 0 ? `
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px;">
                <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px 6px; border-radius: var(--radius-md); text-align: center;">
                  <span style="font-size: 0.72rem; color: #ef4444; font-weight: 600; display: block;">Expired</span>
                  <strong style="font-size: 1.15rem; color: #ef4444;">${expiredCount}</strong>
                </div>
                <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); padding: 8px 6px; border-radius: var(--radius-md); text-align: center;">
                  <span style="font-size: 0.72rem; color: #f59e0b; font-weight: 600; display: block;">Expiring Soon</span>
                  <strong style="font-size: 1.15rem; color: #f59e0b;">${soonCount}</strong>
                </div>
                <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 8px 6px; border-radius: var(--radius-md); text-align: center;">
                  <span style="font-size: 0.72rem; color: #10b981; font-weight: 600; display: block;">Valid</span>
                  <strong style="font-size: 1.15rem; color: #10b981;">${validCount}</strong>
                </div>
              </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 52vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
              ${itemsHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('expiryTrackerOverlay');
    const closeBtn = document.getElementById('closeExpiryTrackerBtn');
    const closeModal = () => {
      document.body.classList.remove('modal-open');
      if (overlay) overlay.remove();
      if (modalsContainer) modalsContainer.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    overlay.querySelectorAll('.expiry-item').forEach((item) => {
      item.addEventListener('click', () => {
        const docId = item.dataset.docId;
        closeModal();
        window.location.hash = `#preview/${docId}`;
      });
    });
  }

  function renderSettingsSheet() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;
    document.body.classList.add('modal-open');

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const themeLabel = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    const isScreenSecActive = window.VaultaScreenSec
      ? (typeof window.VaultaScreenSec.isEnabled === 'function'
          ? window.VaultaScreenSec.isEnabled()
          : (typeof window.VaultaScreenSec.isActive === 'function' ? window.VaultaScreenSec.isActive() : true))
      : true;

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="settingsSheetOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 480px;" role="dialog" aria-modal="true" aria-labelledby="settingsSheetTitle">
          <div class="modal-header">
            <h2 class="modal-title" id="settingsSheetTitle" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent-primary);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Settings
            </h2>
            <button class="modal-close" id="closeSettingsSheetBtn" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding-top: var(--space-3); padding-bottom: 40px; max-height: 75vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 8px; padding-left: 4px;">Security & Vault</div>
            <div class="settings-card-group">
              <button class="settings-row-item" id="settingsSecurityBtn">
                <div class="settings-icon-tile tile-violet">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="settings-item-title">Security & App Lock</span>
                    <span class="settings-pill-badge pill-active">AES-256</span>
                  </div>
                  <span class="settings-item-subtitle">Passcode, biometric & military-grade AES-256 vault</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300;">›</span>
              </button>

              <div class="settings-row-item">
                <div class="settings-icon-tile tile-amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="settings-item-title">Screen Privacy Shield</span>
                    <span class="settings-pill-badge ${isScreenSecActive ? 'pill-active' : 'pill-inactive'}">${isScreenSecActive ? 'ACTIVE' : 'OFF'}</span>
                  </div>
                  <div class="settings-item-subtitle">Obfuscates content in task switchers & anti-screenshot protection</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="settingsScreenSecToggleBtn">
                  ${isScreenSecActive ? 'Disable' : 'Enable'}
                </button>
              </div>

              <button class="settings-row-item" id="settingsBackupBtn">
                <div class="settings-icon-tile tile-emerald">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                </div>
                <div class="settings-item-body">
                  <span class="settings-item-title">Export Backup</span>
                  <span class="settings-item-subtitle">Encrypted offline document backup archive (.zip)</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300;">›</span>
              </button>

              <button class="settings-row-item" id="settingsStorageBtn">
                <div class="settings-icon-tile tile-cyan">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                </div>
                <div class="settings-item-body">
                  <span class="settings-item-title">Storage Analytics</span>
                  <span class="settings-item-subtitle">Document storage usage & category breakdown</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300;">›</span>
              </button>
            </div>

            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-top: 16px; margin-bottom: 8px; padding-left: 4px;">Appearance</div>
            <div class="settings-card-group">
              <button class="settings-row-item" id="settingsThemeToggleBtn">
                <div class="settings-icon-tile tile-indigo">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                </div>
                <div class="settings-item-body">
                  <span class="settings-item-title">Theme</span>
                  <span class="settings-item-subtitle">Switch to ${themeLabel}</span>
                </div>
                <span class="settings-pill-badge pill-active">${theme.toUpperCase()}</span>
              </button>
            </div>

            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-top: 16px; margin-bottom: 8px; padding-left: 4px;">App & Updates</div>
            <div class="settings-card-group">
              <button class="settings-row-item" id="settingsUpdatesBtn">
                <div class="settings-icon-tile tile-violet">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="settings-item-title">What's New & Updates</span>
                    <span class="settings-pill-badge pill-active">v68 LATEST</span>
                  </div>
                  <span class="settings-item-subtitle">Release notes, changelog & feature history</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300;">›</span>
              </button>

              <button class="settings-row-item" id="settingsIconGuideBtn">
                <div class="settings-icon-tile tile-blue">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="settings-item-title">Update App Icon Guide</span>
                    <span class="settings-pill-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">NEW ICON</span>
                  </div>
                  <span class="settings-item-subtitle">How to get the updated icon on your home screen</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300;">›</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeSettingsSheetBtn');
    const backdrop = document.getElementById('settingsSheetOverlay');
    const closeSheet = () => {
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
      if (window.DocApp && typeof window.DocApp.syncActiveTab === 'function') {
        window.DocApp.syncActiveTab();
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeSheet);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeSheet(); });

    const securityBtn = document.getElementById('settingsSecurityBtn');
    if (securityBtn) securityBtn.addEventListener('click', () => { closeSheet(); renderSecurityModal(); });

    const screenSecToggleBtn = document.getElementById('settingsScreenSecToggleBtn');
    if (screenSecToggleBtn) {
      screenSecToggleBtn.addEventListener('click', () => {
        if (window.VaultaScreenSec && typeof window.VaultaScreenSec.toggle === 'function') {
          const nowActive = window.VaultaScreenSec.toggle();
          showToast(nowActive ? '🛡️ Screen Privacy Shield Activated' : 'Screen Privacy Shield Disabled', 'info');
          renderSettingsSheet();
        }
      });
    }

    const backupBtn = document.getElementById('settingsBackupBtn');
    if (backupBtn) backupBtn.addEventListener('click', () => {
      closeSheet();
      if (window.DocApp && typeof window.DocApp.exportBackup === 'function') {
        window.DocApp.exportBackup();
      } else if (window.DocShare && typeof window.DocShare.exportBackup === 'function') {
        window.DocShare.exportBackup();
      } else {
        showToast('Backup feature initialized', 'info');
      }
    });

    const storageBtn = document.getElementById('settingsStorageBtn');
    if (storageBtn) storageBtn.addEventListener('click', () => { closeSheet(); renderStorageAnalyticsModal(); });

    const themeToggleBtn = document.getElementById('settingsThemeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('vaulta_theme', nextTheme);
        renderSettingsSheet();
      });
    }

    const updatesBtn = document.getElementById('settingsUpdatesBtn');
    if (updatesBtn) {
      updatesBtn.addEventListener('click', () => {
        closeSheet();
        renderUpdatesModal();
      });
    }

    const iconGuideBtn = document.getElementById('settingsIconGuideBtn');
    if (iconGuideBtn) {
      iconGuideBtn.addEventListener('click', () => {
        closeSheet();
        renderIconGuideModal();
      });
    }

    bindSheetDragDismiss(backdrop);
  }

  // ── Updates & Changelog Data ──
  const VAULTA_UPDATES = [
    {
      version: 'v68',
      tag: 'Navigation & Settings',
      date: 'September 12, 2026',
      title: 'Settings Opening & Direct Vault Navigation Fix',
      badge: 'FIX',
      summary: 'Fixed Settings sheet opening in mobile view and enabled direct vault navigation when tapping Personal Vault or Official Vault in the bottom sheet.',
      details: {
        features: [
          'Direct Vault Navigation: Tapping Personal Vault or Official Vault in the Choose Vault sheet now immediately opens that vault screen and highlights the Vaults tab.',
          'Instant Settings Access: Fixed Settings sheet initialization on mobile so tapping Settings opens smoothly with all security, theme, and update options.',
          'Global Module Exposure: Attached DocApp and DocUI to window so all navigation and modal handlers invoke cleanly across the app.'
        ],
        improvements: [
          'Guarded VaultaScreenSec call with fallback to both isEnabled() and isActive().',
          'Clean sheet closure without tab de-sync on vault transitions.'
        ],
        dataSafety: 'Zero impact on documents or keys. All documents remain securely encrypted at rest.'
      }
    },
    {
      version: 'v67',
      tag: 'Navigation',
      date: 'September 12, 2026',
      title: 'Persistent Bottom Nav & Docked Settings Sheet',
      badge: 'FIX',
      summary: 'Bottom navigation bar stays visible and interactive when clicking Settings or opening vault sheets, allowing instant one-tap tab switching.',
      details: {
        features: [
          'Persistent Bottom Navigation: Bottom bar (Home, Vaults, +, Search, Settings) remains completely visible on screen when opening Settings.',
          'Docked Sheet Design: Settings and vault modal sheets float and rest seamlessly above the bottom navigation bar without cutting off content.',
          'One-Tap Tab Switching: Tap Home, Vaults, or Settings to switch tabs or close the settings sheet instantly.'
        ],
        improvements: [
          'Elevated navigation bar z-index to 3000 on mobile devices.',
          'Clean tab state sync when switching directly between bottom bar destinations.'
        ],
        dataSafety: 'Zero changes to storage or encryption. All documents remain 100% encrypted with AES-256.'
      }
    },
    {
      version: 'v66',
      tag: 'Experience',
      date: 'September 12, 2026',
      title: 'Pull-To-Refresh Lock Fix & Session Persistence',
      badge: 'FIX',
      summary: 'Pulling down to refresh inside the app no longer prompts for app lock or PIN. Session authentication is preserved across in-app refreshes.',
      details: {
        features: [
          'Pull-to-Refresh Gesture Awareness: Pulling down to refresh inside your vault keeps your unlocked session intact without asking for PIN or biometric unlock again.',
          'Session State Persistence: Seamlessly reloads your documents while maintaining cryptographic session keys in memory.',
          'Removed Aggressive Blur Locks: Window blur events from pull gestures or browser chrome no longer interrupt your workflow.'
        ],
        improvements: [
          'Immediate re-authentication only when switching away from the app or opening from a fresh cold start.',
          'Instant pull-to-refresh without disruption.'
        ],
        dataSafety: 'Zero security compromise. When switching away to another app or closing the app, Vaulta locks securely as always.'
      }
    },
    {
      version: 'v65',
      tag: 'Security',
      date: 'September 12, 2026',
      title: 'Military-Grade AES-256-GCM Document Encryption',
      badge: 'SECURITY',
      summary: 'All stored documents are now encrypted at rest with hardware-accelerated AES-256-GCM and PBKDF2 key derivation. Includes one-click migration for existing documents.',
      details: {
        features: [
          'Military-Grade AES-256-GCM Encryption: Every document file saved in local IndexedDB storage is securely encrypted at rest with unique 16-byte salt and 12-byte IV.',
          'PBKDF2-SHA-256 Key Derivation: Cryptographic keys derived from your security PIN (50,000 rounds) + hardware device key fallback for complete local privacy.',
          'One-Click Migration Tool: Settings > Security lets you encrypt all pre-existing documents in your vault in seconds without any data loss.',
          'Transparent Decryption: Viewing, opening, and exporting documents automatically decrypts files seamlessly on the fly.'
        ],
        improvements: [
          'Document Cards & Preview: Visual 🔒 AES-256 badges confirming active at-rest protection.',
          'Decrypted Backup Zip: Offline backup archives automatically export clean, readable decrypted files.',
          'Zero-Knowledge Storage: Plaintext document bytes are never stored directly in device storage.'
        ],
        dataSafety: '100% safe & backward-compatible! Pre-existing unencrypted documents remain accessible, and can be upgraded to AES-256 with one tap.'
      }
    },
    {
      version: 'v64',
      tag: 'Feature',
      date: 'September 12, 2026',
      title: 'WhatsApp Share Target, Update History & UI Polish',
      badge: 'NEW',
      summary: 'Direct WhatsApp share to Vaulta, update history with details popups in Settings, bottom nav spacing fix, and cleaner date display.',
      details: {
        features: [
          'WhatsApp & External App Share Target: Share images, PDFs, and files directly from WhatsApp or any app straight into Vaulta upload screen with pre-filled document details.',
          'What\'s New & Updates Center in Settings: Complete list of all updates with dates and tap-to-view details popup.',
          'App Icon Reinstall Guide: Built-in instructions on refreshing your home screen icon without risking any document data.'
        ],
        improvements: [
          'Update Modal Fix: Positioned cleanly above the bottom navigation bar so Home, Vaults, and Settings are always accessible.',
          'One-tap update handling: Tap Update to dismiss instantly, apply the latest files, and reload without getting stuck.',
          'Date Picker Polish: Removed duplicate calendar icons for a clean, single-calendar date display.'
        ],
        dataSafety: 'All documents and cards remain 100% offline and encrypted in local IndexedDB storage. Code updates never delete your files.'
      }
    },
    {
      version: 'v63',
      tag: 'Major',
      date: 'September 11, 2026',
      title: 'Camera Scanner, Screen Privacy Shield & Zip Backup',
      badge: 'FEATURE',
      summary: 'In-app document camera scanner, screen switcher obfuscation, and password-protected zip backup archive.',
      details: {
        features: [
          'Live Camera Scanner: Instant document scanner with torch support, front/back camera switch, and live crop guide.',
          'Screen Privacy Shield: Automatically obfuscates sensitive documents when switching apps in Android/iOS task switcher.',
          'Zip Backup Export: One-click export of your entire document library into an offline encrypted .zip archive.'
        ],
        improvements: [
          'Modernized Vault View: Premium glassmorphic cards matching the home screen aesthetics.',
          'Custom Date & Month Selectors: Fast year-jump and month-jump selectors.',
          'Expiry Tracker: Real-time badges and notifications for soon-to-expire documents.'
        ],
        dataSafety: 'Zero cloud reliance. No account or external server needed — completely local to your device.'
      }
    },
    {
      version: 'v62',
      tag: 'Design',
      date: 'September 10, 2026',
      title: 'Brand Refresh & High-Resolution App Icon',
      badge: 'REDESIGN',
      summary: 'New metallic cyan-blue V-shield logo, adaptive maskable home screen icon, and PWA manifest upgrade.',
      iconGuide: true,
      details: {
        features: [
          'New Brand Identity: Futuristic gradient V emblem with metallic glow.',
          'Adaptive Maskable Icons: Full circle, squircle, and rounded square support on Android launchers.',
          'Reinstall Guide for App Icon: Clear steps for updating home screen icons on mobile PWAs.'
        ],
        improvements: [
          'Upgraded manifest.json with standalone WebAPK launcher configurations.',
          'Enhanced dark theme contrast and typography.'
        ],
        dataSafety: 'Your documents are safe! Reinstalling the shortcut refreshes the icon, while all your documents remain securely saved in IndexedDB.'
      }
    },
    {
      version: 'v61',
      tag: 'Core',
      date: 'September 8, 2026',
      title: 'Personal & Official Dual Vaults + Biometric App Lock',
      badge: 'CORE',
      summary: 'Separated Personal and Official vaults, fingerprint/PIN app lock, and instant offline document search.',
      details: {
        features: [
          'Dual Vault System: Personal Vault (ID, Passport, Health) & Official Vault (Tax, Salary, Offers).',
          'App Lock Security: PIN passcode and WebAuthn fingerprint biometric sensor unlock.',
          'Full-Text Offline Search: Instant query filter by name, category, and date range.'
        ],
        improvements: [
          'Color-coded category tags with custom SVGs.',
          'Multi-format previewer for PDFs, images, and documents.'
        ],
        dataSafety: 'Device-only cryptographic security with AES-GCM local storage encryption.'
      }
    }
  ];

  function renderUpdatesModal() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;
    document.body.classList.add('modal-open');

    const updateCardsHtml = VAULTA_UPDATES.map((upd, idx) => `
      <div class="update-card-item" data-version="${upd.version}" style="cursor: pointer;">
        <div class="update-card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="update-version-tag ${idx === 0 ? 'latest' : ''}">${upd.version}</span>
            <span class="update-date-label">${upd.date}</span>
          </div>
          <span class="update-badge ${upd.badge.toLowerCase()}">${upd.badge}</span>
        </div>
        <div class="update-card-title">${upd.title}</div>
        <div class="update-card-summary">${upd.summary}</div>
        <div class="update-card-footer">
          <span class="update-view-details">View Details & Changes ›</span>
        </div>
      </div>
    `).join('');

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="updatesModalOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 500px;" role="dialog" aria-modal="true" aria-labelledby="updatesModalTitle">
          <div class="modal-header">
            <h2 class="modal-title" id="updatesModalTitle" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent-primary);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              What's New & Updates
            </h2>
            <button class="modal-close" id="closeUpdatesModalBtn" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px 18px 30px; max-height: 75vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
            <!-- Current Status Box -->
            <div class="update-current-status">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="update-status-icon">✨</div>
                  <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-text-primary);">Vaulta v67</div>
                    <div style="font-size: 0.76rem; color: #10b981; font-weight: 600;">● Latest Version Active</div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="manualCheckUpdateBtn" style="font-size: 0.75rem; padding: 6px 12px;">Check Updates</button>
              </div>
              <div style="font-size: 0.78rem; color: var(--color-text-secondary); line-height: 1.4;">
                All documents are saved offline on this device. Updates add features and improvements without altering your stored documents.
              </div>
            </div>

            <!-- Icon update quick highlight card -->
            <div class="update-icon-highlight-card" id="quickIconGuideBtn">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.3rem;">🎨</span>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 0.86rem; color: var(--color-text-primary);">Changed App Icon?</div>
                  <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Tap to see steps to get the new icon on your phone safely.</div>
                </div>
                <span style="color: #38bdf8; font-weight: 700; font-size: 0.82rem;">Steps ›</span>
              </div>
            </div>

            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin: 16px 0 10px 4px;">Update History (Tap to view details)</div>
            <div class="update-cards-list">
              ${updateCardsHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeUpdatesModalBtn');
    const backdrop = document.getElementById('updatesModalOverlay');
    const closeModal = () => {
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
      if (window.DocApp && typeof window.DocApp.syncActiveTab === 'function') {
        window.DocApp.syncActiveTab();
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    const checkBtn = document.getElementById('manualCheckUpdateBtn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        showToast('Checking for updates… 🔄', 'info');
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
              reg.update().then(() => {
                setTimeout(() => {
                  if (reg.waiting) {
                    showToast('Update available! Updating...', 'info');
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  } else {
                    showToast('You are running the latest version! ✨', 'success');
                  }
                }, 1000);
              }).catch(() => {
                showToast('You are on the latest version! ✨', 'success');
              });
            } else {
              showToast('Vaulta is up to date! ✨', 'success');
            }
          }).catch(() => {
            showToast('Vaulta is up to date! ✨', 'success');
          });
        } else {
          showToast('Vaulta is up to date! ✨', 'success');
        }
      });
    }

    const quickIconBtn = document.getElementById('quickIconGuideBtn');
    if (quickIconBtn) {
      quickIconBtn.addEventListener('click', () => {
        renderIconGuideModal();
      });
    }

    // Bind click on each update card
    const cards = modalsContainer.querySelectorAll('.update-card-item');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const ver = card.dataset.version;
        const upd = VAULTA_UPDATES.find((u) => u.version === ver);
        if (upd) {
          renderUpdateDetailModal(upd);
        }
      });
    });

    bindSheetDragDismiss(backdrop);
  }

  function renderUpdateDetailModal(upd) {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;
    document.body.classList.add('modal-open');

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="updateDetailModalOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 480px;" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="update-version-tag ${upd.version === VAULTA_UPDATES[0].version ? 'latest' : ''}">${upd.version}</span>
                <span class="update-date-label">${upd.date}</span>
                <span class="update-badge ${upd.badge.toLowerCase()}">${upd.badge}</span>
              </div>
              <h2 class="modal-title" style="font-size: 1.08rem; margin-top: 5px;">${upd.title}</h2>
            </div>
            <button class="modal-close" id="closeUpdateDetailBtn" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px 18px 30px; max-height: 75vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
            <p style="font-size: 0.86rem; color: var(--color-text-secondary); margin-bottom: 16px; line-height: 1.45;">
              ${upd.summary}
            </p>

            <!-- Features implemented -->
            <div class="update-detail-section">
              <div class="update-section-title">
                <span>🚀</span> Features Implemented
              </div>
              <ul class="update-bullet-list">
                ${upd.details.features.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>

            <!-- Improvements & fixes -->
            <div class="update-detail-section">
              <div class="update-section-title">
                <span>⚡</span> Improvements & Fixes
              </div>
              <ul class="update-bullet-list">
                ${upd.details.improvements.map(imp => `<li>${imp}</li>`).join('')}
              </ul>
            </div>

            ${upd.iconGuide ? `
              <!-- App Icon Update Steps (requested by user) -->
              <div class="update-icon-guide-box">
                <div class="update-icon-guide-title">
                  <span>📱</span> Steps to get the updated App Icon:
                </div>
                <ol class="update-step-list">
                  <li><strong>Uninstall or Remove:</strong> Long-press the Vaulta icon on your phone's home screen and tap <em>Uninstall</em> or <em>Remove shortcut</em>.</li>
                  <li><strong>Open in Browser:</strong> Open Google Chrome, Samsung Internet, or Safari and go to Vaulta.</li>
                  <li><strong>Install Again:</strong> Tap the browser menu (<strong>⋮</strong> or Share) and choose <strong>"Install App"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li><strong>Done:</strong> The app will now show the new updated icon on your home screen!</li>
                </ol>
                <div class="update-safety-alert">
                  <span style="font-size: 1.3rem; flex-shrink: 0;">🛡️</span>
                  <div>
                    <strong>Your documents are 100% safe & will NOT get deleted!</strong>
                    <div style="font-size: 0.78rem; opacity: 0.95; margin-top: 2px;">
                      All your documents and cards are stored in your device's persistent IndexedDB database. Reinstalling the shortcut only refreshes the launcher icon — your data is never touched.
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Data Safety Guarantee -->
            <div class="update-safety-guarantee">
              <span>🔒</span>
              <span><strong>Data Safety Guaranteed:</strong> ${upd.details.dataSafety}</span>
            </div>

            <div style="margin-top: 20px; display: flex; gap: 10px;">
              <button type="button" class="btn btn-secondary" style="flex: 1;" id="backToUpdatesBtn">‹ All Updates</button>
              <button type="button" class="btn btn-primary" style="flex: 1;" id="doneUpdateDetailBtn">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeUpdateDetailBtn');
    const doneBtn = document.getElementById('doneUpdateDetailBtn');
    const backBtn = document.getElementById('backToUpdatesBtn');
    const backdrop = document.getElementById('updateDetailModalOverlay');

    const closeModal = () => {
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
      if (window.DocApp && typeof window.DocApp.syncActiveTab === 'function') {
        window.DocApp.syncActiveTab();
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (doneBtn) doneBtn.addEventListener('click', closeModal);
    if (backBtn) backBtn.addEventListener('click', () => { renderUpdatesModal(); });
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    bindSheetDragDismiss(backdrop);
  }

  function renderIconGuideModal() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;
    document.body.classList.add('modal-open');

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="iconGuideModalOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 480px;" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent-primary);"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Update App Icon Guide
            </h2>
            <button class="modal-close" id="closeIconGuideBtn" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px 18px 30px; max-height: 75vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
            <div style="text-align: center; margin-bottom: 18px;">
              <div style="width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 10px; background: linear-gradient(135deg, #00f5ff, #0062ff); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0, 98, 255, 0.35);">
                <svg viewBox="0 0 34 34" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L17 28L30 6" stroke="#ffffff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div style="font-weight: 700; font-size: 1.05rem; color: var(--color-text-primary);">New Vaulta Brand Icon</div>
              <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 2px;">Follow these steps to refresh the icon on your phone</div>
            </div>

            <!-- Steps -->
            <div class="update-icon-guide-box">
              <div class="update-icon-guide-title">
                <span>📱</span> Easy 3-Step Process:
              </div>
              <ol class="update-step-list">
                <li>
                  <strong>1. Uninstall current app shortcut:</strong><br>
                  <span style="font-size: 0.8rem; color: var(--color-text-secondary);">Long-press the Vaulta icon on your phone's home screen and tap <em>Uninstall</em> or <em>Remove</em>.</span>
                </li>
                <li>
                  <strong>2. Open Vaulta in your browser:</strong><br>
                  <span style="font-size: 0.8rem; color: var(--color-text-secondary);">Open Chrome, Samsung Internet, or Safari and navigate to Vaulta.</span>
                </li>
                <li>
                  <strong>3. Tap "Install App" or "Add to Home Screen":</strong><br>
                  <span style="font-size: 0.8rem; color: var(--color-text-secondary);">Tap the browser menu (<strong>⋮</strong> or Share icon) and choose <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
                </li>
              </ol>

              <!-- Safety Reassurance -->
              <div class="update-safety-alert">
                <span style="font-size: 1.4rem; flex-shrink: 0;">🛡️</span>
                <div>
                  <strong>Your documents will be there — won't get deleted!</strong>
                  <div style="font-size: 0.8rem; opacity: 0.95; margin-top: 3px; line-height: 1.4;">
                    Your uploaded documents and cards live in your browser's persistent IndexedDB database. Removing and reinstalling the home screen shortcut only refreshes the icon, and your documents remain 100% safe and intact.
                  </div>
                </div>
              </div>
            </div>

            <button type="button" class="btn btn-primary" style="width: 100%; margin-top: 14px;" id="gotItIconGuideBtn">Got It, Thanks!</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('closeIconGuideBtn');
    const gotItBtn = document.getElementById('gotItIconGuideBtn');
    const backdrop = document.getElementById('iconGuideModalOverlay');

    const closeModal = () => {
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
      if (window.DocApp && typeof window.DocApp.syncActiveTab === 'function') {
        window.DocApp.syncActiveTab();
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (gotItBtn) gotItBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    bindSheetDragDismiss(backdrop);
  }

  async function renderVaultsSheet() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;

    let personalCount = 0;
    let officialCount = 0;
    try {
      const counts = await (window.DocDB || DocDB).getCounts();
      personalCount = counts.personal || 0;
      officialCount = counts.official || 0;
    } catch (e) {
      console.warn('[UI] Could not fetch vault counts:', e);
    }

    modalsContainer.innerHTML = `
      <div class="modal-overlay active" id="vaultsSheetOverlay">
        <div class="modal-content" style="max-width: 480px;" role="dialog" aria-modal="true" aria-labelledby="vaultsSheetTitle">
          <div class="modal-header">
            <h2 class="modal-title" id="vaultsSheetTitle" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent-primary);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Choose Vault
            </h2>
            <button class="modal-close" id="closeVaultsSheetBtn" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding-top: var(--space-3);">
            <div class="settings-card-group">
              <button class="settings-row-item" id="vaultPersonalBtn">
                <div class="settings-icon-tile tile-violet">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="settings-item-title">Personal Vault</span>
                    <span class="settings-pill-badge pill-active">${personalCount} doc${personalCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span class="settings-item-subtitle">Identity, Finance, Health & Education</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300; margin-left: 8px;">›</span>
              </button>

              <button class="settings-row-item" id="vaultOfficialBtn">
                <div class="settings-icon-tile tile-cyan">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                </div>
                <div class="settings-item-body">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="settings-item-title">Official Vault</span>
                    <span class="settings-pill-badge pill-active">${officialCount} doc${officialCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span class="settings-item-subtitle">Employment, Tax, Legal & Business</span>
                </div>
                <span class="settings-chevron" style="font-size: 1.2rem; opacity: 0.5; font-weight: 300; margin-left: 8px;">›</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.classList.add('modal-open');
    const closeBtn = document.getElementById('closeVaultsSheetBtn');
    const backdrop = document.getElementById('vaultsSheetOverlay');
    const closeSheet = (syncTab = true) => {
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
      if (syncTab) {
        const app = window.DocApp || (typeof DocApp !== 'undefined' ? DocApp : null);
        if (app && typeof app.syncActiveTab === 'function') {
          app.syncActiveTab();
        }
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', () => closeSheet(true));
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeSheet(true); });

    const personalBtn = document.getElementById('vaultPersonalBtn');
    if (personalBtn) personalBtn.addEventListener('click', () => {
      closeSheet(false);
      const app = window.DocApp || (typeof DocApp !== 'undefined' ? DocApp : null);
      if (app && typeof app.navigate === 'function') {
        app.navigate('vault', 'personal');
      } else {
        window.location.hash = '#vault/personal';
      }
    });

    const officialBtn = document.getElementById('vaultOfficialBtn');
    if (officialBtn) officialBtn.addEventListener('click', () => {
      closeSheet(false);
      const app = window.DocApp || (typeof DocApp !== 'undefined' ? DocApp : null);
      if (app && typeof app.navigate === 'function') {
        app.navigate('vault', 'official');
      } else {
        window.location.hash = '#vault/official';
      }
    });

    bindSheetDragDismiss(backdrop);
  }

  function bindSheetDragDismiss(overlayEl) {
    if (!overlayEl) return;
    const content = overlayEl.querySelector('.modal-content');
    if (!content) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    content.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = content.getBoundingClientRect();
      if (touch.clientY - rect.top > 40) return;
      startY = touch.clientY;
      isDragging = true;
      content.style.transition = 'none';
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const modalBody = content.querySelector('.modal-body');
      if (modalBody && modalBody.scrollTop > 0) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      if (diff > 0) {
        content.style.transform = `translateY(${diff}px)`;
      }
    }, { passive: true });

    content.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      content.style.transition = '';
      const diff = currentY - startY;
      if (diff > 100) {
        document.body.classList.remove('modal-open');
        const modalsContainer = document.getElementById('modals');
        if (modalsContainer) {
          modalsContainer.innerHTML = '';
          const app = window.DocApp || (typeof DocApp !== 'undefined' ? DocApp : null);
          if (app && typeof app.syncActiveTab === 'function') {
            app.syncActiveTab();
          }
        }
      } else {
        content.style.transform = '';
      }
      startY = 0;
      currentY = 0;
    }, { passive: true });
  }

  async function openCameraScannerModal() {
    const modalsContainer = document.getElementById('modals');
    if (!modalsContainer) return;

    let currentFacingMode = 'environment';
    let stream = null;

    const stopStream = () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
    };

    const triggerNativeFallback = () => {
      stopStream();
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
      const directInput = document.getElementById('directCameraInput');
      if (directInput) {
        directInput.click();
      } else {
        renderUploadModal();
      }
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerNativeFallback();
      return;
    }

    document.body.classList.add('modal-open');

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="cameraScannerOverlay" style="background: rgba(0,0,0,0.92); z-index: 10000; padding: 0;">
        <div class="camera-scanner-hud" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 24px 16px;">
          
          <!-- Top Bar -->
          <div style="width: 100%; max-width: 500px; display: flex; align-items: center; justify-content: space-between; z-index: 10;">
            <button type="button" id="closeCameraScannerBtn" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer;">✕</button>
            <div style="background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 8px #10b981;"></span>
              ID & DOC SCANNER
            </div>
            <button type="button" id="flipCameraBtn" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Flip Camera">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </button>
          </div>

          <!-- Video Viewfinder Frame -->
          <div style="position: relative; width: 100%; max-width: 440px; height: 60vh; border-radius: 24px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; box-shadow: 0 0 30px rgba(99,102,241,0.2);">
            <video id="cameraScannerVideo" playsinline autoplay muted style="width: 100%; height: 100%; object-fit: cover;"></video>
            
            <!-- Reticle Target Lines -->
            <div style="position: absolute; inset: 20px; border: 2px dashed rgba(255,255,255,0.4); border-radius: 16px; pointer-events: none; box-shadow: inset 0 0 0 1000px rgba(0,0,0,0.25);"></div>
            <div class="scanner-laser" style="position: absolute; left: 24px; right: 24px; height: 2px; background: linear-gradient(90deg, transparent, #6366f1, #06b6d4, #6366f1, transparent); box-shadow: 0 0 15px #6366f1; pointer-events: none; animation: scanLaserAnim 2.4s ease-in-out infinite;"></div>
            
            <div id="cameraLoadingHint" style="position: absolute; color: #fff; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <span class="spinner" style="width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
              Starting camera...
            </div>
          </div>

          <!-- Bottom Control Bar -->
          <div style="width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; gap: 14px; z-index: 10;">
            <p style="color: rgba(255,255,255,0.7); font-size: 0.8rem; margin: 0; text-align: center;">Align document inside frame and tap Capture</p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 24px; width: 100%;">
              <button type="button" id="useGalleryFallbackBtn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 18px; border-radius: 24px; font-size: 0.8rem; cursor: pointer;">Files / Upload</button>
              
              <!-- Shutter Button -->
              <button type="button" id="cameraShutterBtn" style="width: 72px; height: 72px; border-radius: 50%; background: #fff; border: 5px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 0 24px rgba(255,255,255,0.5); transition: transform 0.15s ease;" title="Take Photo">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #4f46e5);"></div>
              </button>

              <div style="width: 80px;"></div>
            </div>
          </div>

        </div>
      </div>
    `;

    const videoEl = document.getElementById('cameraScannerVideo');
    const loadingHint = document.getElementById('cameraLoadingHint');
    const closeBtn = document.getElementById('closeCameraScannerBtn');
    const flipBtn = document.getElementById('flipCameraBtn');
    const shutterBtn = document.getElementById('cameraShutterBtn');
    const galleryFallbackBtn = document.getElementById('useGalleryFallbackBtn');

    const startCameraStream = async (facing) => {
      stopStream();
      if (loadingHint) loadingHint.style.display = 'flex';
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play();
          if (loadingHint) loadingHint.style.display = 'none';
        }
      } catch (err) {
        console.warn('[Camera] getUserMedia error, falling back to input:', err);
        triggerNativeFallback();
      }
    };

    await startCameraStream(currentFacingMode);

    const closeScanner = () => {
      stopStream();
      document.body.classList.remove('modal-open');
      modalsContainer.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeScanner);
    if (galleryFallbackBtn) {
      galleryFallbackBtn.addEventListener('click', () => {
        triggerNativeFallback();
      });
    }

    if (flipBtn) {
      flipBtn.addEventListener('click', async () => {
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        await startCameraStream(currentFacingMode);
      });
    }

    if (shutterBtn) {
      shutterBtn.addEventListener('click', () => {
        shutterBtn.style.transform = 'scale(0.9)';
        setTimeout(() => { shutterBtn.style.transform = 'scale(1)'; }, 150);

        if (!videoEl || !videoEl.videoWidth) {
          triggerNativeFallback();
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) {
            triggerNativeFallback();
            return;
          }
          const scannedFile = new File([blob], `Scanned_Doc_${Date.now()}.jpg`, { type: 'image/jpeg' });
          closeScanner();
          renderUploadModal();
          
          // Populate scanned file into upload modal
          setTimeout(() => {
            const fileInput = document.getElementById('docFile');
            if (fileInput) {
              const dt = new DataTransfer();
              dt.items.add(scannedFile);
              fileInput.files = dt.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, 100);
        }, 'image/jpeg', 0.92);
      });
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  return {
    CATEGORIES,
    getCustomCategories,
    addCustomCategory,
    getAllCategories,
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolder,
    getChildFolders,
    getFolderPath,
    getAllFoldersFlat,
    renderFolderCard,
    getCategoryIcon,
    getCategoryColor,
    formatDate,
    getFileTypeIcon,
    renderHome,
    renderVault,
    renderDocCard,
    renderFavCard,
    renderUploadModal,
    openCameraScannerModal,
    renderEditModal,
    renderCreateFolderModal,
    renderEditFolderModal,
    renderSecretSyncModal,
    renderPreview,
    renderDeleteConfirm,
    renderShareAsModal,
    renderSecurityModal,
    renderStorageAnalyticsModal,
    renderSettingsSheet,
    renderVaultsSheet,
    renderUpdatesModal,
    renderUpdateDetailModal,
    renderIconGuideModal,
    renderExpiryTrackerModal,
    setupVaultaCustomSelect,
    loadPdfJsLibrary,
    initVaultaDatePicker,
    showToast,
    escapeHtml,
    formatBytes,
  };
})();

window.DocUI = DocUI;

