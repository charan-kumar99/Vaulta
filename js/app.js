/* ============================================
   DocVault — Main App Controller
   ============================================ */

const DocApp = (() => {
  /* ---- App State ---- */
  const state = {
    currentScreen: 'home', // 'home' | 'vault'
    currentVault: null, // 'personal' | 'official'
    activeCategory: 'all',
    sortBy: 'date-desc',
    searchQuery: '',
    selectedFile: null,
    currentPreviewUrl: null,
    selectMode: false,
    selectedDocs: new Set(),
  };

  const mainContainer = () => document.getElementById('app');
  const modalsContainer = () => document.getElementById('modals');

  /* ============================================
     Initialization
     ============================================ */

  async function init() {
    // Initialize database
    await DocDB.open();

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('docvault_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Handle hash routing
    window.addEventListener('hashchange', handleRoute);

    // Initial route
    handleRoute();
  }

  /* ============================================
     Routing
     ============================================ */

  function handleRoute() {
    const hash = window.location.hash || '#home';

    if (hash === '#home' || hash === '#') {
      state.currentScreen = 'home';
      state.currentVault = null;
      state.activeCategory = 'all';
      state.searchQuery = '';
      renderCurrentScreen();
    } else if (hash.startsWith('#vault/')) {
      const vault = hash.replace('#vault/', '');
      if (vault === 'personal' || vault === 'official') {
        state.currentScreen = 'vault';
        state.currentVault = vault;
        state.activeCategory = 'all';
        state.searchQuery = '';
        renderCurrentScreen();
      }
    }
  }

  function navigate(screen, vault = null) {
    if (screen === 'home') {
      window.location.hash = '#home';
    } else if (screen === 'vault' && vault) {
      window.location.hash = `#vault/${vault}`;
    }
  }

  /* ============================================
     Screen Rendering
     ============================================ */

  async function renderCurrentScreen() {
    const container = mainContainer();

    if (state.currentScreen === 'home') {
      await renderHomeScreen(container);
    } else if (state.currentScreen === 'vault') {
      await renderVaultScreen(container);
    }

    // Re-bind events after render
    bindEvents();
  }

  async function renderHomeScreen(container) {
    const counts = await DocDB.getCounts();
    const recentDocs = await DocDB.getRecent(6);
    const favoriteDocs = await DocDB.getFavorites();

    DocUI.renderHome(container, {
      personalCount: counts.personal,
      officialCount: counts.official,
      recentDocs,
      favoriteDocs,
    });
  }

  async function renderVaultScreen(container) {
    const allDocs = await DocDB.getAllByVault(state.currentVault);

    const filteredDocs = DocSearch.query(allDocs, {
      searchQuery: state.searchQuery,
      filters: {
        category: state.activeCategory,
      },
      sortBy: state.sortBy,
    });

    DocUI.renderVault(container, {
      vault: state.currentVault,
      documents: filteredDocs,
      activeCategory: state.activeCategory,
      sortBy: state.sortBy,
    });
  }

  /* ============================================
     Event Binding
     ============================================ */

  function bindEvents() {
    const container = mainContainer();

    // Use event delegation on the main container
    container.removeEventListener('click', handleClick);
    container.addEventListener('click', handleClick);

    // Bind specific inputs
    bindSearchEvents();
    bindFAB();
    bindVaultCards();
    bindSortDropdown();
    bindCategoryChips();
    bindBackButton();
    bindBulkSelect();
  }

  function bindBackButton() {
    const backBtn = document.getElementById('backToHome');
    if (backBtn) {
      backBtn.addEventListener('click', () => navigate('home'));
    }
  }

  function handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const docId = target.dataset.docId;

    e.stopPropagation();

    switch (action) {
      case 'preview':
        openPreview(docId);
        break;
      case 'favorite':
        toggleFavorite(docId);
        break;
      case 'share':
        shareDoc(docId);
        break;
      case 'toggle-select':
        handleToggleSelect(docId);
        break;
    }
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
    // Home screen global search
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

    // Vault screen search
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

      // Close on click outside
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

      // Update active state visually
      chips.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      await refreshVaultGrid();
    });
  }

  async function refreshVaultGrid() {
    const grid = document.getElementById('documentsGrid');
    if (!grid) return;

    const allDocs = await DocDB.getAllByVault(state.currentVault);
    const filteredDocs = DocSearch.query(allDocs, {
      searchQuery: state.searchQuery,
      filters: { category: state.activeCategory },
      sortBy: state.sortBy,
    });

    // Update sort button label
    const sortToggle = document.getElementById('sortToggle');
    if (sortToggle) {
      const labels = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'name-asc': 'A-Z', 'name-desc': 'Z-A', 'category': 'Category' };
      sortToggle.textContent = `↕ ${labels[state.sortBy] || 'Sort'}`;
    }

    if (filteredDocs.length === 0) {
      grid.innerHTML = '';
      // Check if we already have an empty state, if not add one
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
      // Remove temp empty state
      const tempEmpty = grid.parentElement.querySelector('.temp-empty');
      if (tempEmpty) tempEmpty.remove();

      grid.innerHTML = filteredDocs.map((doc) => DocUI.renderDocCard(doc, state.selectMode)).join('');

      // Re-apply selected state if in select mode
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

  /* ============================================
     Bulk Select & Share
     ============================================ */

  function bindBulkSelect() {
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const cancelSelectBtn = document.getElementById('cancelSelectBtn');
    const bulkShareBtn = document.getElementById('bulkShareBtn');
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

    if (bulkWhatsAppBtn) {
      bulkWhatsAppBtn.addEventListener('click', () => bulkWhatsAppShare());
    }
  }

  function enterSelectMode() {
    state.selectMode = true;
    state.selectedDocs.clear();

    // Show bulk action bar, hide sort/select button
    const bulkBar = document.getElementById('bulkActionBar');
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    if (bulkBar) bulkBar.style.display = 'flex';
    if (bulkSelectBtn) bulkSelectBtn.style.display = 'none';

    // Re-render grid with checkboxes
    refreshVaultGrid();
    updateBulkUI();
  }

  function exitSelectMode() {
    state.selectMode = false;
    state.selectedDocs.clear();

    // Hide bulk action bar, show select button
    const bulkBar = document.getElementById('bulkActionBar');
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    if (bulkBar) bulkBar.style.display = 'none';
    if (bulkSelectBtn) bulkSelectBtn.style.display = '';

    // Re-render grid without checkboxes
    refreshVaultGrid();
  }

  function handleToggleSelect(docId) {
    if (!state.selectMode) return;

    if (state.selectedDocs.has(docId)) {
      state.selectedDocs.delete(docId);
    } else {
      state.selectedDocs.add(docId);
    }

    // Update card visual
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
      // Deselect all
      state.selectedDocs.clear();
    } else {
      // Select all
      filteredDocs.forEach((d) => state.selectedDocs.add(d.id));
    }

    // Update all cards visually
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
    const whatsAppBtn = document.getElementById('bulkWhatsAppBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');

    if (countLabel) countLabel.textContent = `${count} selected`;
    if (shareBtn) shareBtn.disabled = count === 0;
    if (whatsAppBtn) whatsAppBtn.disabled = count === 0;

    // Toggle "Select All" / "Deselect All" text
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
      DocUI.showToast(`Preparing ${ids.length} document(s)...`, 'info');
      const result = await DocShare.shareMultiple(ids, 'Vaulta_Documents.zip');
      if (result.success) {
        DocUI.showToast(`${ids.length} document(s) shared as ZIP!`, 'success');
        exitSelectMode();
      }
    } catch (error) {
      console.error('Bulk share failed:', error);
      DocUI.showToast('Failed to share documents.', 'error');
    }
  }

  async function bulkWhatsAppShare() {
    const ids = Array.from(state.selectedDocs);
    if (ids.length === 0) return;

    try {
      // First, download the ZIP so user has the file
      if (typeof JSZip === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        document.head.appendChild(script);
        await new Promise((resolve) => { script.onload = resolve; });
      }

      const zip = new JSZip();
      const docNames = [];

      for (const id of ids) {
        const doc = await DocDB.getDocument(id);
        if (doc && doc.fileData) {
          const blob = doc.fileData instanceof Blob
            ? doc.fileData
            : new Blob([doc.fileData], { type: doc.fileType });
          zip.file(doc.fileName, blob);
          docNames.push(doc.name);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Try native share with WhatsApp if on mobile
      if ('share' in navigator && 'canShare' in navigator) {
        const file = new File([zipBlob], 'Vaulta_Documents.zip', { type: 'application/zip' });
        const shareData = { title: 'My Documents', text: 'Sharing documents: ' + docNames.join(', '), files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          DocUI.showToast('Documents shared via WhatsApp!', 'success');
          exitSelectMode();
          return;
        }
      }

      // Fallback: Download ZIP and open WhatsApp with message
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Vaulta_Documents.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);

      // Open WhatsApp with a message
      const message = encodeURIComponent('Hi, sharing my documents from Vaulta:\n' + docNames.map((n) => '📄 ' + n).join('\n') + '\n\nPlease find the attached ZIP file.');
      const whatsappUrl = `https://wa.me/919380455922?text=${message}`;
      window.open(whatsappUrl, '_blank');

      DocUI.showToast('ZIP downloaded! Attach it in WhatsApp chat.', 'info', 5000);
      exitSelectMode();
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('WhatsApp share failed:', error);
      DocUI.showToast('Failed to share via WhatsApp.', 'error');
    }
  }

  /* ============================================
     Upload Modal
     ============================================ */

  function openUploadModal() {
    const modals = modalsContainer();
    const defaultVault = state.currentVault || 'personal';
    modals.innerHTML = DocUI.renderUploadModal(defaultVault);

    bindUploadModalEvents();
  }

  function bindUploadModalEvents() {
    const modal = document.getElementById('uploadModal');
    const closeBtn = document.getElementById('uploadModalClose');
    const cancelBtn = document.getElementById('uploadCancel');
    const submitBtn = document.getElementById('uploadSubmit');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const vaultSelect = document.getElementById('docVault');
    const previewRemove = document.getElementById('previewRemove');

    // Close handlers
    const closeModal = () => {
      state.selectedFile = null;
      modal.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Drop zone
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
      if (files.length > 0) handleFileSelect(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    // Remove preview
    if (previewRemove) {
      previewRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedFile = null;
        const preview = document.getElementById('uploadPreview');
        preview.classList.remove('visible');
        preview.querySelector('img, .preview-pdf')?.remove();
        dropZone.style.display = '';
        submitBtn.disabled = true;
      });
    }

    // Vault change → update category options
    vaultSelect.addEventListener('change', () => {
      const vault = vaultSelect.value;
      const personalGroup = document.getElementById('personalCatGroup');
      const officialGroup = document.getElementById('officialCatGroup');

      if (vault === 'personal') {
        personalGroup.style.display = '';
        officialGroup.style.display = 'none';
        // Select first personal category
        const firstOption = personalGroup.querySelector('option');
        if (firstOption) firstOption.selected = true;
      } else {
        personalGroup.style.display = 'none';
        officialGroup.style.display = '';
        const firstOption = officialGroup.querySelector('option');
        if (firstOption) firstOption.selected = true;
      }
    });

    // Submit
    submitBtn.addEventListener('click', handleUpload);
  }

  function handleFileSelect(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      DocUI.showToast('Unsupported file type. Please use JPG, PNG, or PDF.', 'error');
      return;
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      DocUI.showToast('File is too large. Maximum 20MB allowed.', 'error');
      return;
    }

    state.selectedFile = file;

    const preview = document.getElementById('uploadPreview');
    const dropZone = document.getElementById('dropZone');
    const submitBtn = document.getElementById('uploadSubmit');
    const nameInput = document.getElementById('docName');

    // Auto-fill name if empty
    if (nameInput && !nameInput.value) {
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      nameInput.value = baseName;
    }

    // Show preview
    preview.classList.add('visible');
    dropZone.style.display = 'none';

    // Remove old preview content (keeping the remove button)
    const existingPreviewContent = preview.querySelector('img, .preview-pdf');
    if (existingPreviewContent) existingPreviewContent.remove();

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = 'Preview';
      preview.insertBefore(img, preview.firstChild);
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

    submitBtn.disabled = false;
  }

  async function handleUpload() {
    const file = state.selectedFile;
    if (!file) return;

    const name = document.getElementById('docName').value.trim();
    const vault = document.getElementById('docVault').value;
    const category = document.getElementById('docCategory').value;
    const tagsStr = document.getElementById('docTags').value.trim();

    if (!name) {
      DocUI.showToast('Please enter a document name.', 'error');
      return;
    }

    const submitBtn = document.getElementById('uploadSubmit');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      // Generate thumbnail for images
      const thumbnail = await DocDB.generateThumbnail(file);

      // Parse tags
      const tags = tagsStr
        ? tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];

      // Save to database
      await DocDB.addDocument({
        vault,
        name,
        category,
        tags,
        fileData: file,
        fileType: file.type,
        fileName: file.name,
        thumbnail,
      });

      // Close modal
      state.selectedFile = null;
      document.getElementById('uploadModal')?.remove();

      // Refresh screen
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

  /* ============================================
     Preview
     ============================================ */

  async function openPreview(docId) {
    const doc = await DocDB.getDocument(docId);
    if (!doc) return;

    const fileUrl = await DocDB.getFileUrl(docId);
    if (!fileUrl) {
      DocUI.showToast('Could not load file for preview.', 'error');
      return;
    }

    state.currentPreviewUrl = fileUrl;

    const modals = modalsContainer();
    modals.innerHTML = DocUI.renderPreview(doc, fileUrl);

    bindPreviewEvents(doc);
  }

  function bindPreviewEvents(doc) {
    const closeBtn = document.getElementById('previewClose');
    const favBtn = document.getElementById('previewFavorite');
    const editBtn = document.getElementById('previewEdit');
    const shareBtn = document.getElementById('previewShare');
    const downloadBtn = document.getElementById('previewDownload');
    const deleteBtn = document.getElementById('previewDelete');

    closeBtn.addEventListener('click', closePreview);

    favBtn.addEventListener('click', async () => {
      const updated = await DocDB.toggleFavorite(doc.id);
      favBtn.classList.toggle('active');
      favBtn.textContent = updated.isFavorite ? '★' : '☆';
      DocUI.showToast(
        updated.isFavorite ? 'Added to favorites' : 'Removed from favorites',
        'info'
      );
    });

    editBtn.addEventListener('click', () => {
      closePreview();
      openEditModal(doc.id);
    });

    shareBtn.addEventListener('click', () => shareDoc(doc.id));
    downloadBtn.addEventListener('click', () => downloadDoc(doc.id));

    deleteBtn.addEventListener('click', () => {
      openDeleteConfirm(doc.id, doc.name);
    });

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closePreview();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function closePreview() {
    // Revoke blob URL to free memory
    if (state.currentPreviewUrl) {
      URL.revokeObjectURL(state.currentPreviewUrl);
      state.currentPreviewUrl = null;
    }

    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.remove();

    // Refresh screen to reflect any changes (favorites, etc.)
    renderCurrentScreen();
  }

  /* ============================================
     Edit Modal
     ============================================ */

  async function openEditModal(docId) {
    const doc = await DocDB.getDocument(docId);
    if (!doc) return;

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

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Vault change → toggle category groups
    vaultSelect.addEventListener('change', () => {
      const vault = vaultSelect.value;
      const personalGroup = document.getElementById('editPersonalCatGroup');
      const officialGroup = document.getElementById('editOfficialCatGroup');

      if (vault === 'personal') {
        personalGroup.style.display = '';
        officialGroup.style.display = 'none';
        personalGroup.querySelector('option').selected = true;
      } else {
        personalGroup.style.display = 'none';
        officialGroup.style.display = '';
        officialGroup.querySelector('option').selected = true;
      }
    });

    // Save
    submitBtn.addEventListener('click', async () => {
      const name = document.getElementById('editDocName').value.trim();
      const vault = document.getElementById('editDocVault').value;
      const category = document.getElementById('editDocCategory').value;
      const tagsStr = document.getElementById('editDocTags').value.trim();

      if (!name) {
        DocUI.showToast('Please enter a document name.', 'error');
        return;
      }

      const tags = tagsStr
        ? tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];

      try {
        await DocDB.updateDocument(doc.id, { name, vault, category, tags });
        closeModal();
        await renderCurrentScreen();
        DocUI.showToast('Document updated successfully!', 'success');
      } catch (error) {
        console.error('Update failed:', error);
        DocUI.showToast('Failed to update document.', 'error');
      }
    });
  }

  /* ============================================
     Delete Confirmation
     ============================================ */

  function openDeleteConfirm(docId, docName) {
    const modals = modalsContainer();

    // Close preview first if open
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

        // Revoke preview URL if any
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

  /* ============================================
     Share & Download
     ============================================ */

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

    // Format option radio toggle visual
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

    // Share button action
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

    // Download button action
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

    // WhatsApp button action
    if (whatsAppBtn) {
      whatsAppBtn.addEventListener('click', async () => {
        const fmt = getSelectedFormat();
        try {
          const blob = await DocDB.getFileBlob(doc.id);
          const converted = await DocShare.convertFile(blob, doc.fileType, fmt, doc.name, doc.fileName);

          // Download file for user to attach
          DocShare.downloadFile(converted.blob, converted.fileName);

          // Open WhatsApp link to 9380455922
          const message = encodeURIComponent(`Hi, sharing my document: ${doc.name} (Format: ${fmt.toUpperCase()})\nVault: ${doc.vault.toUpperCase()}\nCategory: ${doc.category}`);
          const waUrl = `https://wa.me/919380455922?text=${message}`;
          window.open(waUrl, '_blank');

          closeModal();
          DocUI.showToast(`File downloaded (${converted.fileName})! Opening WhatsApp...`, 'info', 5000);
        } catch (err) {
          console.error('WhatsApp share error:', err);
          DocUI.showToast('Failed to prepare document for WhatsApp.', 'error');
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

  /* ============================================
     Favorite Toggle (from card)
     ============================================ */

  async function toggleFavorite(docId) {
    try {
      const updated = await DocDB.toggleFavorite(docId);
      DocUI.showToast(
        updated.isFavorite ? 'Added to favorites ⭐' : 'Removed from favorites',
        'info'
      );

      // Refresh screen
      await renderCurrentScreen();
    } catch (error) {
      console.error('Favorite toggle failed:', error);
    }
  }

  /* ============================================
     Theme Toggle
     ============================================ */

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('docvault_theme', next);

    // Update button icon
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  /* ============================================
     Backup Export
     ============================================ */

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

  /* ============================================
     Helpers
     ============================================ */

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Public API
  return {
    init,
    navigate,
    toggleTheme,
    exportBackup,
    openUploadModal,
  };
})();

// Also expose formatFileSize globally for the upload handler
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
