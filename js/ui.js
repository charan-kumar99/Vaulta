/* ============================================
   DocVault — UI Rendering Module
   ============================================ */

const DocUI = (() => {
  /* ---- Category Definitions ---- */
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

  /* ---- Custom Categories Persistence ---- */
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

  /* ---- Nested Sub-Folders System ---- */
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

    // Check if folder already exists in the same parentId & vault
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

  /**
   * Render a Folder Card in the documents grid
   */
  function renderFolderCard(folder, itemCount = 0) {
    return `
      <div class="doc-card folder-card" data-folder-id="${folder.id}">
        <div class="doc-thumbnail folder-thumbnail" style="background: rgba(99, 102, 241, 0.08); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px;">
          <div style="font-size: 3.5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">📁</div>
        </div>

        <div class="doc-actions" style="opacity: 1; gap: 4px;">
          <button class="doc-action-btn edit-folder-btn" data-folder-id="${folder.id}" title="Rename folder" aria-label="Rename folder" style="background: rgba(0,0,0,0.4);">
            ✏️
          </button>
          <button class="doc-action-btn delete-folder-btn" data-folder-id="${folder.id}" title="Delete folder" aria-label="Delete folder" style="color: var(--color-accent-danger); background: rgba(0,0,0,0.4);">
            🗑️
          </button>
        </div>

        <div class="doc-info">
          <div class="doc-name" title="${escapeHtml(folder.name)}" style="font-weight: var(--font-weight-semibold);">${escapeHtml(folder.name)}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-2);">
            <span class="doc-folder-badge" style="background: rgba(99, 102, 241, 0.12); color: var(--color-accent-primary); border-color: rgba(99, 102, 241, 0.2);">
              📁 Folder
            </span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-weight: var(--font-weight-medium);">
              ${itemCount} ${itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get category icon by name and vault
   */
  function getCategoryIcon(category, vault) {
    const cats = getAllCategories(vault || 'personal');
    const cat = cats.find((c) => c.name.toLowerCase() === (category || '').toLowerCase());
    return cat ? cat.icon : '📄';
  }

  /**
   * Get category color by name
   */
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

  /**
   * Format timestamp to readable date
   */
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

  /**
   * Get file type icon (for non-image files)
   */
  function getFileTypeIcon(fileType, fileName = '') {
    const fn = (fileName || '').toLowerCase();
    const ft = (fileType || '').toLowerCase();

    if (ft.includes('pdf') || fn.endsWith('.pdf')) return '📕';
    if (ft.includes('image') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png') || fn.endsWith('.webp')) return '🖼️';
    if (ft.includes('excel') || ft.includes('spreadsheet') || ft.includes('csv') || fn.endsWith('.xls') || fn.endsWith('.xlsx') || fn.endsWith('.csv')) return '📊';
    return '📄';
  }

  /* ============================================
     Screen Renderers
     ============================================ */

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

  /**
   * Render the Home Screen
   */
  function renderHome(container, { personalCount, officialCount, allDocs = [], filteredDocs = [], favoriteDocs = [], activeCategory = 'all' }) {
    const categories = getUsedCategories(allDocs);
    const docsToRender = (activeCategory && activeCategory !== 'all') ? filteredDocs : allDocs;

    container.innerHTML = `
      <div class="container page-enter">
        <!-- Search Bar -->
        <div class="search-container" style="margin-top: var(--space-8);">
          <input type="text" class="search-bar" id="globalSearch" placeholder="Search all documents..." autocomplete="off" />
          <span class="search-icon">🔍</span>
          <button class="search-clear" id="searchClear" aria-label="Clear search">✕</button>
        </div>

        <!-- Search Results (hidden by default) -->
        <div id="searchResults" style="display:none; margin-bottom: var(--space-8);">
          <div class="section-header">
            <h2 class="section-title"><span class="section-icon">🔍</span> Search Results</h2>
            <button class="section-action" id="clearSearch">Clear</button>
          </div>
          <div class="documents-grid anim-stagger" id="searchResultsGrid"></div>
          <div id="searchEmptyState" style="display:none;">
            <div class="empty-state">
              <div class="empty-icon">🔎</div>
              <h3 class="empty-title">No results found</h3>
              <p class="empty-desc">Try a different search term</p>
            </div>
          </div>
        </div>

        <!-- Vault Cards -->
        <div id="homeContent">
          <div class="vaults-grid">
            <div class="vault-card personal" id="vaultPersonal" role="button" tabindex="0" aria-label="Open Personal Vault">
              <div>
                <div class="vault-icon">🔐</div>
                <h2 class="vault-title">Personal Vault</h2>
                <p class="vault-desc">Aadhar, PAN, Passbook & more</p>
              </div>
              <div class="vault-count">
                <span>${personalCount}</span> document${personalCount !== 1 ? 's' : ''}
              </div>
              <div class="vault-arrow">→</div>
            </div>

            <div class="vault-card official" id="vaultOfficial" role="button" tabindex="0" aria-label="Open Official Vault">
              <div>
                <div class="vault-icon">💼</div>
                <h2 class="vault-title">Official Vault</h2>
                <p class="vault-desc">Offer Letters, Experience & more</p>
              </div>
              <div class="vault-count">
                <span>${officialCount}</span> document${officialCount !== 1 ? 's' : ''}
              </div>
              <div class="vault-arrow">→</div>
            </div>
          </div>

          <!-- Favorites Section -->
          ${favoriteDocs.length > 0 ? `
            <div class="section-header">
              <h2 class="section-title"><span class="section-icon">⭐</span> Favorites</h2>
            </div>
            <div class="favorites-row">
              ${favoriteDocs.map((doc) => renderFavCard(doc)).join('')}
            </div>
          ` : ''}

          <!-- All Documents Section -->
          <div class="section-header">
            <h2 class="section-title"><span class="section-icon">📄</span> All Documents</h2>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-weight: var(--font-weight-medium);">${allDocs.length} total</span>
          </div>

          <!-- Category Chips Filter (shows only categories that have uploaded documents) -->
          <div class="category-chips" id="homeCategoryChips" style="margin-bottom: var(--space-4);">
            ${categories.map((cat) => `
              <button class="category-chip ${(activeCategory.toLowerCase() === cat.name.toLowerCase() || (activeCategory === 'all' && cat.name === 'All')) ? 'active' : ''}"
                      data-category="${cat.name === 'All' ? 'all' : cat.name}">
                ${cat.icon} ${escapeHtml(cat.name)}
              </button>
            `).join('')}
          </div>

          ${docsToRender.length > 0 ? `
            <div class="documents-grid anim-stagger">
              ${docsToRender.map((doc) => renderDocCard(doc)).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-icon anim-float">📂</div>
              <h3 class="empty-title">${activeCategory !== 'all' ? 'No documents in this category' : 'Welcome to Vaulta!'}</h3>
              <p class="empty-desc">${activeCategory !== 'all' ? 'Try selecting a different category filter.' : 'Start by uploading your first document. Tap the + button in the bottom right to get started.'}</p>
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

  /**
   * Render a favorite card (compact horizontal)
   */
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

  /**
   * Render a document card
   */
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
    if (doc.expiryDate && window.DocDB && typeof window.DocDB.getExpiryStatus === 'function') {
      const exp = window.DocDB.getExpiryStatus(doc.expiryDate);
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
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: var(--space-2);">
            <span class="doc-category-badge" style="background: ${getCategoryColor(doc.category)}15; color: ${getCategoryColor(doc.category)};">
              ${getCategoryIcon(doc.category, doc.vault)} ${escapeHtml(doc.category)}
            </span>
            ${expiryBadge}
            ${doc.folder ? `<span class="doc-folder-badge">📁 ${escapeHtml(doc.folder)}</span>` : ''}
            ${(doc.tags || []).slice(0, 3).map((tag) => `<span class="doc-tag-badge">#${escapeHtml(tag)}</span>`).join('')}
          </div>
          <div class="doc-date">${formatDate(doc.createdAt)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render the Vault Screen
   */
  function renderVault(container, { vault, currentFolder, folderPath = [], subFolders = [], subFolderCounts = {}, documents, activeCategory, sortBy }) {
    const isPersonal = vault === 'personal';
    const categories = getAllCategories(vault);
    const title = isPersonal ? 'Personal Vault' : 'Official Vault';
    const icon = isPersonal ? '🔐' : '💼';

    // Build breadcrumb HTML
    let breadcrumbHtml = `
      <span class="breadcrumb-item ${!currentFolder ? 'active' : ''}" data-nav-folder="root">
        ${icon} ${title}
      </span>
    `;

    folderPath.forEach((f, idx) => {
      const isLast = idx === folderPath.length - 1;
      breadcrumbHtml += `
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-nav-folder="${f.id}">
          📁 ${escapeHtml(f.name)}
        </span>
      `;
    });

    const folderCardsHtml = subFolders.map((f) => renderFolderCard(f, subFolderCounts[f.id] || 0)).join('');
    const docCardsHtml = documents.map((doc) => renderDocCard(doc)).join('');
    const totalItems = subFolders.length + documents.length;

    container.innerHTML = `
      <div class="container page-enter">
        <!-- Page Title Bar & Breadcrumbs -->
        <div class="page-title-bar" style="margin-top: var(--space-6);">
          <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
            <button class="back-btn" id="vaultBackBtn" aria-label="Back">← Back</button>
            <div class="vault-breadcrumbs" style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text-primary);">
              ${breadcrumbHtml}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
            <button class="btn btn-secondary" id="createFolderBtn" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);">
              📁 + Create Folder
            </button>
            <button class="btn btn-secondary" id="bulkSelectBtn" style="font-size: var(--font-size-sm); padding: var(--space-2) var(--space-4);">
              ☑ Select & Share
            </button>
            <div class="sort-dropdown">
              <button class="sort-btn" id="sortToggle">
                ↕ ${getSortLabel(sortBy)}
              </button>
              <div class="sort-menu" id="sortMenu">
                <button class="sort-option ${sortBy === 'date-desc' ? 'active' : ''}" data-sort="date-desc">📅 Newest First</button>
                <button class="sort-option ${sortBy === 'date-asc' ? 'active' : ''}" data-sort="date-asc">📅 Oldest First</button>
                <button class="sort-option ${sortBy === 'name-asc' ? 'active' : ''}" data-sort="name-asc">🔤 Name A-Z</button>
                <button class="sort-option ${sortBy === 'name-desc' ? 'active' : ''}" data-sort="name-desc">🔤 Name Z-A</button>
                <button class="sort-option ${sortBy === 'category' ? 'active' : ''}" data-sort="category">📁 Category</button>
              </div>
            </div>
          </div>

          <!-- Bulk Select Bar (hidden by default) -->
          <div class="bulk-action-bar" id="bulkActionBar" style="display: none;">
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
        </div>

        <!-- Search (vault-specific) -->
        <div class="search-container">
          <input type="text" class="search-bar" id="vaultSearch" placeholder="Search in ${title.toLowerCase()}..." autocomplete="off" />
          <span class="search-icon">🔍</span>
          <button class="search-clear" id="vaultSearchClear" aria-label="Clear search">✕</button>
        </div>

        <!-- Category Chips -->
        <div class="category-chips" id="categoryChips">
          ${categories.map((cat) => `
            <button class="category-chip ${(activeCategory === cat.name || (activeCategory === 'all' && cat.name === 'All')) ? 'active' : ''}"
                    data-category="${cat.name === 'All' ? 'all' : cat.name}">
              ${cat.icon} ${cat.name}
            </button>
          `).join('')}
        </div>

        <!-- Documents & Folders Grid -->
        <div class="documents-grid anim-stagger" id="documentsGrid">
          ${folderCardsHtml}
          ${docCardsHtml}
        </div>

        ${totalItems === 0 ? `
          <div class="empty-state">
            <div class="empty-icon anim-float">📁</div>
            <h3 class="empty-title">This folder is empty</h3>
            <p class="empty-desc">Upload a document to get started. You can create a new folder when uploading!</p>
            <button class="btn btn-primary" id="emptyUploadBtn" style="margin-top: var(--space-3);">
              <span class="btn-text">+ Upload Document</span>
            </button>
          </div>
        ` : ''}

        <!-- FAB -->
        <button class="fab" id="fabUpload" aria-label="Upload document">+</button>
      </div>
    `;
  }

  /**
   * Get human-readable sort label
   */
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

  /* ============================================
     Upload Modal
     ============================================ */

  /**
   * Render the Upload Modal
   */
  function renderUploadModal(defaultVault = 'personal', selectedFolderId = null) {
    const personalCats = getAllCategories('personal').filter((c) => c.name !== 'All');
    const officialCats = getAllCategories('official').filter((c) => c.name !== 'All');
    const personalFolders = getAllFoldersFlat('personal');
    const officialFolders = getAllFoldersFlat('official');

    return `
      <div class="modal-overlay active modal-overlay-enter" id="uploadModal">
        <div class="modal-content modal-content-enter">
          <div class="modal-header">
            <h2 class="modal-title">📤 Upload Document</h2>
            <button class="modal-close" id="uploadModalClose" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <!-- Drop Zone -->
            <div class="drop-zone" id="dropZone">
              <div class="drop-icon anim-float">📁</div>
              <p class="drop-text">Drag & drop your file here</p>
              <p class="drop-subtext">or <span class="drop-browse">click to browse</span></p>
              <p class="drop-subtext" style="margin-top: var(--space-2); font-size: var(--font-size-xs);">Supports images (JPG, PNG), PDF, and Excel (XLS, XLSX, CSV)</p>
              <input type="file" id="fileInput" accept="image/*,.pdf,.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style="display:none;" />
            </div>

            <!-- Upload Preview -->
            <div class="upload-preview" id="uploadPreview">
              <button class="preview-remove" id="previewRemove" aria-label="Remove file">✕</button>
            </div>

            <!-- Form Fields -->
            <div class="form-group">
              <label class="form-label" for="docName">Document Name *</label>
              <input type="text" class="form-input" id="docName" placeholder="e.g. Aadhar Card Front" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="docVault">Vault *</label>
                <select class="form-select" id="docVault">
                  <option value="personal" ${defaultVault === 'personal' ? 'selected' : ''}>🔐 Personal</option>
                  <option value="official" ${defaultVault === 'official' ? 'selected' : ''}>💼 Official</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="docCategory">Category *</label>
                <select class="form-select" id="docCategory">
                  <optgroup label="Personal" id="personalCatGroup" ${defaultVault !== 'personal' ? 'style="display:none;"' : ''}>
                    ${personalCats.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Official" id="officialCatGroup" ${defaultVault !== 'official' ? 'style="display:none;"' : ''}>
                    ${officialCats.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
            </div>

            <div class="form-group" id="customCategoryGroup" style="display: none;">
              <label class="form-label" for="customCategory">Custom Category Name *</label>
              <input type="text" class="form-input" id="customCategory" placeholder="e.g. Medical, Tax Receipts, Vehicle" />
            </div>

            <div class="form-group">
              <label class="form-label" for="docFolder">Folder / Location</label>
              <select class="form-select" id="docFolder">
                <option value="">📁 Root (Main Vault)</option>
                <optgroup label="Personal Folders" id="personalFolderGroup" ${defaultVault !== 'personal' ? 'style="display:none;"' : ''}>
                  ${personalFolders.map((f) => `<option value="${f.id}" ${selectedFolderId === f.id ? 'selected' : ''}>📁 ${escapeHtml(f.displayName)}</option>`).join('')}
                </optgroup>
                <optgroup label="Official Folders" id="officialFolderGroup" ${defaultVault !== 'official' ? 'style="display:none;"' : ''}>
                  ${officialFolders.map((f) => `<option value="${f.id}" ${selectedFolderId === f.id ? 'selected' : ''}>📁 ${escapeHtml(f.displayName)}</option>`).join('')}
                </optgroup>
                <option value="__new__">➕ Create New Folder...</option>
              </select>
            </div>

            <div class="form-group" id="newFolderGroup" style="display: none;">
              <label class="form-label" for="newFolderName">New Folder Name *</label>
              <input type="text" class="form-input" id="newFolderName" placeholder="e.g. Nettech Service, TCS, Agreements" />
            </div>

            <div class="form-group">
              <label class="form-label" for="docExpiry">Expiry Date (Optional)</label>
              <input type="date" class="form-input" id="docExpiry" />
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

  /* ============================================
     Edit Modal
     ============================================ */

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
                  <option value="personal" ${doc.vault === 'personal' ? 'selected' : ''}>🔐 Personal</option>
                  <option value="official" ${doc.vault === 'official' ? 'selected' : ''}>💼 Official</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="editDocCategory">Category *</label>
                <select class="form-select" id="editDocCategory">
                  <optgroup label="Personal" id="editPersonalCatGroup" ${doc.vault !== 'personal' ? 'style="display:none;"' : ''}>
                    ${personalCats.map((c) => `<option value="${c.name}" ${doc.category === c.name && doc.vault === 'personal' ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Official" id="editOfficialCatGroup" ${doc.vault !== 'official' ? 'style="display:none;"' : ''}>
                    ${officialCats.map((c) => `<option value="${c.name}" ${doc.category === c.name && doc.vault === 'official' ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
            </div>

            <div class="form-group" id="editCustomCategoryGroup" style="display: none;">
              <label class="form-label" for="editCustomCategory">Custom Category Name *</label>
              <input type="text" class="form-input" id="editCustomCategory" placeholder="e.g. Medical, Tax Receipts, Vehicle" />
            </div>

            <div class="form-group">
              <label class="form-label" for="editDocFolder">Folder / Location</label>
              <select class="form-select" id="editDocFolder">
                <option value="">📁 Root (Main Vault)</option>
                <optgroup label="Personal Folders" id="editPersonalFolderGroup" ${doc.vault !== 'personal' ? 'style="display:none;"' : ''}>
                  ${personalFolders.map((f) => `<option value="${f.id}" ${doc.folderId === f.id ? 'selected' : ''}>📁 ${escapeHtml(f.displayName)}</option>`).join('')}
                </optgroup>
                <optgroup label="Official Folders" id="editOfficialFolderGroup" ${doc.vault !== 'official' ? 'style="display:none;"' : ''}>
                  ${officialFolders.map((f) => `<option value="${f.id}" ${doc.folderId === f.id ? 'selected' : ''}>📁 ${escapeHtml(f.displayName)}</option>`).join('')}
                </optgroup>
                <option value="__new__">➕ Create New Folder...</option>
              </select>
            </div>

            <div class="form-group" id="editNewFolderGroup" style="display: none;">
              <label class="form-label" for="editNewFolderName">New Folder Name *</label>
              <input type="text" class="form-input" id="editNewFolderName" placeholder="e.g. Nettech Service, TCS, Agreements" />
            </div>

            <div class="form-group">
              <label class="form-label" for="editDocExpiry">Expiry Date (Optional)</label>
              <input type="date" class="form-input" id="editDocExpiry" value="${doc.expiryDate || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="editDocTags">Tags (comma separated)</label>
              <input type="text" class="form-input" id="editDocTags" value="${(doc.tags || []).join(', ')}" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="editCancel">Cancel</button>
            <button class="btn btn-primary" id="editSubmit" data-doc-id="${doc.id}">
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

    let viewerContent;
    if (isImage) {
      viewerContent = `<img src="${fileUrl}" alt="${escapeHtml(doc.name)}" />`;
    } else if (isPdf) {
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
            <button class="header-btn desktop-only-btn" id="previewEdit" data-doc-id="${doc.id}" title="Edit details">✏️</button>
            <button class="header-btn desktop-only-btn" id="previewShare" data-doc-id="${doc.id}" title="Share">↗</button>
            <button class="header-btn desktop-only-btn" id="previewDownload" data-doc-id="${doc.id}" title="Download">⬇</button>
            <button class="header-btn desktop-only-btn danger" id="previewDelete" data-doc-id="${doc.id}" title="Delete" style="color: var(--color-accent-danger);">🗑️</button>
          </div>
        </div>
        <div class="preview-body modal-content-enter">
          ${viewerContent}
          <div class="preview-meta-bar" style="padding: var(--space-3) var(--space-4); background: var(--color-bg-secondary); border-top: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
              <span class="doc-category-badge" style="background: ${getCategoryColor(doc.category)}15; color: ${getCategoryColor(doc.category)};">
                ${getCategoryIcon(doc.category, doc.vault)} ${escapeHtml(doc.category)}
              </span>
              ${(doc.tags || []).length > 0 ? `
                <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                  ${doc.tags.map((t) => `<span class="doc-tag-badge">#${escapeHtml(t)}</span>`).join('')}
                </div>
              ` : '<span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">No tags</span>'}
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">
              Added ${formatDate(doc.createdAt)}
            </div>
          </div>
        </div>
        <div class="preview-mobile-footer">
          <button class="mobile-action-btn" id="previewMobileEdit" data-doc-id="${doc.id}">
            <span class="btn-icon">✏️</span>
            <span class="btn-label">Edit</span>
          </button>
          <button class="mobile-action-btn" id="previewMobileShare" data-doc-id="${doc.id}">
            <span class="btn-icon">↗</span>
            <span class="btn-label">Share</span>
          </button>
          <button class="mobile-action-btn" id="previewMobileDownload" data-doc-id="${doc.id}">
            <span class="btn-icon">⬇</span>
            <span class="btn-label">Download</span>
          </button>
          <button class="mobile-action-btn danger" id="previewMobileDelete" data-doc-id="${doc.id}">
            <span class="btn-icon">🗑️</span>
            <span class="btn-label">Delete</span>
          </button>
        </div>
      </div>
    `;
  }

  /* ============================================
     Delete Confirmation
     ============================================ */

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

  /* ============================================
     Share As (Format Picker) Modal
     ============================================ */

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

  /* ============================================
     Create Folder Modal
     ============================================ */

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

  /* ============================================
     Edit Folder Modal
     ============================================ */

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

  /* ============================================
     Secret Vault Sync Modal
     ============================================ */

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

  /* ============================================
     Toast Notifications
     ============================================ */

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

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      removeToast(toast);
    });

    // Auto-dismiss
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
    
    let isBioSupported = false;
    try {
      if (window.SecurityModule && typeof window.SecurityModule.isBiometricsSupported === 'function') {
        isBioSupported = await Promise.race([
          window.SecurityModule.isBiometricsSupported(),
          new Promise((resolve) => setTimeout(() => resolve(false), 500))
        ]);
      }
    } catch (e) {
      console.warn('[Security] Biometrics check error:', e);
      isBioSupported = false;
    }

    modalsContainer.innerHTML = `
      <div class="modal-overlay active modal-overlay-enter" id="securityModalOverlay">
        <div class="modal-content modal-content-enter" style="max-width: 440px;" role="dialog" aria-modal="true" aria-labelledby="securityModalTitle">
          <div class="modal-header">
            <h2 class="modal-title" id="securityModalTitle">🔐 Security & App Lock</h2>
            <button class="modal-close" id="closeSecurityModalBtn" aria-label="Close modal">✕</button>
          </div>
          <div class="modal-body">
            <div class="setting-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--color-border);">
              <div>
                <strong style="display: block; font-size: 0.95rem; color: var(--color-text-primary);">App Lock Protection</strong>
                <span style="font-size: 0.78rem; color: var(--color-text-secondary);">${isSecEnabled ? '🔒 Protection is ACTIVE' : '🔓 Protection is OFF'}</span>
              </div>
              <button type="button" class="btn ${isSecEnabled ? 'btn-danger' : 'btn-primary'} btn-sm" id="toggleAppLockBtn">
                ${isSecEnabled ? 'Disable Lock' : 'Enable Lock'}
              </button>
            </div>

            <div class="setting-item" style="padding: 14px 0; border-bottom: 1px solid var(--color-border);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div>
                  <strong style="display: block; font-size: 0.95rem; color: var(--color-text-primary);">Passcode PIN</strong>
                  <span style="font-size: 0.78rem; color: var(--color-text-secondary);">${hasPin ? '🔑 PIN configured' : '⚠️ No PIN configured'}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="setPinBtn">
                  ${hasPin ? 'Change PIN' : 'Set PIN'}
                </button>
              </div>
              <div id="pinInputGroup" style="display: none; margin-top: 12px; background: var(--color-bg-tertiary); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--color-border);">
                <input type="password" id="newPinInput" maxlength="6" pattern="[0-9]*" inputmode="numeric" placeholder="Enter 4 to 6 digit PIN" class="form-input" style="margin-bottom: 8px; width: 100%;">
                <button type="button" class="btn btn-primary btn-sm" id="savePinBtn" style="width: 100%;">Save Passcode PIN</button>
              </div>
            </div>

            <div class="setting-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--color-border);">
              <div>
                <strong style="display: block; font-size: 0.95rem; color: var(--color-text-primary);">Fingerprint / Face ID / Windows Hello</strong>
                <span style="font-size: 0.78rem; color: var(--color-text-secondary);">
                  ${isBioSupported ? (isBioEnabled ? '🖐️ Biometrics enabled' : 'Device supported') : 'Not supported on this browser'}
                </span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="toggleBioBtn" ${(!isBioSupported || !isSecEnabled) ? 'disabled' : ''}>
                ${isBioEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            ${isSecEnabled ? `
              <div style="margin-top: 20px;">
                <button type="button" class="btn btn-primary" id="lockNowBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--gradient-accent);">
                  🔒 Lock App Now
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const closeBtn = document.getElementById('closeSecurityModalBtn');
    const backdrop = document.getElementById('securityModalOverlay');
    const closeModal = () => { modalsContainer.innerHTML = ''; };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    // Toggle App Lock Button
    const toggleLockBtn = document.getElementById('toggleAppLockBtn');
    if (toggleLockBtn) {
      toggleLockBtn.addEventListener('click', async () => {
        if (!isSecEnabled) {
          if (!window.SecurityModule.hasPasscode()) {
            showToast('Please set a Passcode PIN first', 'warning');
            const pinGrp = document.getElementById('pinInputGroup');
            if (pinGrp) pinGrp.style.display = 'block';
            return;
          }
          window.SecurityModule.setSecurityEnabled(true);
          showToast('🔒 App Lock Enabled', 'success');
        } else {
          window.SecurityModule.setSecurityEnabled(false);
          showToast('🔓 App Lock Disabled', 'info');
        }
        renderSecurityModal();
      });
    }

    // Set PIN button
    const setPinBtn = document.getElementById('setPinBtn');
    const pinGroup = document.getElementById('pinInputGroup');
    if (setPinBtn && pinGroup) {
      setPinBtn.addEventListener('click', () => {
        pinGroup.style.display = pinGroup.style.display === 'none' ? 'block' : 'none';
      });
    }

    // Save PIN button
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

    // Toggle Biometrics button
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

    // Lock Now button
    const lockNowBtn = document.getElementById('lockNowBtn');
    if (lockNowBtn) {
      lockNowBtn.addEventListener('click', () => {
        closeModal();
        window.SecurityModule.lockApp();
      });
    }
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
            <div style="max-height: 220px; overflow-y: auto;">
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
  }

  /* ============================================
     Helpers
     ============================================ */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Public API
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
    renderEditModal,
    renderCreateFolderModal,
    renderEditFolderModal,
    renderSecretSyncModal,
    renderPreview,
    renderDeleteConfirm,
    renderShareAsModal,
    renderSecurityModal,
    renderStorageAnalyticsModal,
    loadPdfJsLibrary,
    showToast,
    escapeHtml,
    formatBytes,
  };
})();
