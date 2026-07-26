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
  function getFileTypeIcon(fileType) {
    if (fileType && fileType.includes('pdf')) return '📕';
    if (fileType && fileType.includes('image')) return '🖼️';
    return '📄';
  }

  /* ============================================
     Screen Renderers
     ============================================ */

  /**
   * Render the Home Screen
   */
  function renderHome(container, { personalCount, officialCount, recentDocs, favoriteDocs }) {
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

          <!-- Recent Documents -->
          ${recentDocs.length > 0 ? `
            <div class="section-header">
              <h2 class="section-title"><span class="section-icon">🕐</span> Recent Documents</h2>
            </div>
            <div class="documents-grid anim-stagger">
              ${recentDocs.map((doc) => renderDocCard(doc)).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-icon anim-float">📂</div>
              <h3 class="empty-title">Welcome to Vaulta!</h3>
              <p class="empty-desc">Start by uploading your first document. Tap the + button below to get started.</p>
              <button class="btn btn-primary" id="emptyUploadBtn">
                <span class="btn-text">+ Upload Document</span>
              </button>
            </div>
          `}
        </div>

        <!-- FAB -->
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

    return `
      <div class="doc-card ${selectMode ? 'select-mode' : ''}" data-doc-id="${doc.id}" data-vault="${doc.vault}" data-action="${selectMode ? 'toggle-select' : 'preview'}">
        ${selectCheckbox}
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
  function renderVault(container, { vault, documents, activeCategory, sortBy }) {
    const isPersonal = vault === 'personal';
    const categories = getAllCategories(vault);
    const title = isPersonal ? 'Personal Vault' : 'Official Vault';
    const icon = isPersonal ? '🔐' : '💼';

    container.innerHTML = `
      <div class="container page-enter">
        <!-- Page Title Bar -->
        <div class="page-title-bar" style="margin-top: var(--space-6);">
          <div style="display: flex; align-items: center; gap: var(--space-4);">
            <button class="back-btn" id="backToHome" aria-label="Back to home">← Back</button>
            <h1 class="page-title">
              <span class="vault-badge ${vault}">${icon}</span>
              ${title}
            </h1>
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-3);">
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

        <!-- Documents Grid -->
        <div class="documents-grid anim-stagger" id="documentsGrid">
          ${documents.map((doc) => renderDocCard(doc)).join('')}
        </div>

        ${documents.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon anim-float">📭</div>
            <h3 class="empty-title">No documents yet</h3>
            <p class="empty-desc">Upload your first ${isPersonal ? 'personal' : 'official'} document to get started.</p>
            <button class="btn btn-primary" id="emptyUploadBtn">
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
  function renderUploadModal(defaultVault = 'personal') {
    const personalCats = getAllCategories('personal').filter((c) => c.name !== 'All');
    const officialCats = getAllCategories('official').filter((c) => c.name !== 'All');

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
              <p class="drop-subtext" style="margin-top: var(--space-2); font-size: var(--font-size-xs);">Supports images (JPG, PNG) and PDF</p>
              <input type="file" id="fileInput" accept="image/*,.pdf" style="display:none;" />
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

  /* ============================================
     Preview Overlay
     ============================================ */

  function renderPreview(doc, fileUrl) {
    const isImage = doc.fileType && doc.fileType.startsWith('image/');
    const isPdf = doc.fileType && doc.fileType.includes('pdf');

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
    } else {
      viewerContent = `
        <div class="empty-state">
          <div class="empty-icon">${getFileTypeIcon(doc.fileType)}</div>
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
    renderPreview,
    renderDeleteConfirm,
    renderShareAsModal,
    showToast,
    escapeHtml,
  };
})();
