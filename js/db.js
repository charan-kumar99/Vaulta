/* ============================================
   DocVault — IndexedDB Database Layer
   ============================================ */

const DocDB = (() => {
  const DB_NAME = 'docvault_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'documents';
  let db = null;

  /**
   * Generate a UUID v4
   */
  function generateId() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Open/Initialize the database
   */
  function open() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Create indexes for searching and filtering
          store.createIndex('vault', 'vault', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('isFavorite', 'isFavorite', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to open database: ' + event.target.error));
      };
    });
  }

  /**
   * Get a transaction and object store
   */
  async function getStore(mode = 'readonly') {
    const database = await open();
    const tx = database.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  /**
   * Add a new document
   * @param {Object} doc - Document data
   * @param {string} doc.vault - 'personal' or 'official'
   * @param {string} doc.name - Document name
   * @param {string} doc.category - Category name
   * @param {string[]} doc.tags - Array of tags
   * @param {Blob} doc.fileData - The actual file
   * @param {string} doc.fileType - MIME type
   * @param {string} doc.fileName - Original file name
   * @param {string} [doc.thumbnail] - Base64 thumbnail
   * @returns {Promise<Object>} The saved document (without fileData for memory)
   */
  async function addDocument(doc) {
    const store = await getStore('readwrite');

    const document = {
      id: generateId(),
      vault: doc.vault,
      name: doc.name,
      category: doc.category,
      tags: doc.tags || [],
      fileData: doc.fileData,
      fileType: doc.fileType,
      fileName: doc.fileName,
      thumbnail: doc.thumbnail || null,
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.add(document);

      request.onsuccess = () => {
        // Return document metadata (without heavy blob data)
        const { fileData, ...metadata } = document;
        resolve(metadata);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to add document: ' + event.target.error));
      };
    });
  }

  /**
   * Get a single document by ID (includes file data)
   */
  async function getDocument(id) {
    const store = await getStore('readonly');

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to get document: ' + event.target.error));
      };
    });
  }

  /**
   * Get all documents by vault (metadata only, no fileData for performance)
   * @param {string} vault - 'personal' or 'official'
   */
  async function getAllByVault(vault) {
    const store = await getStore('readonly');
    const index = store.index('vault');

    return new Promise((resolve, reject) => {
      const request = index.getAll(vault);

      request.onsuccess = () => {
        const docs = request.result.map((doc) => {
          const { fileData, ...metadata } = doc;
          return metadata;
        });
        resolve(docs);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to get documents: ' + event.target.error));
      };
    });
  }

  /**
   * Get all documents (metadata only)
   */
  async function getAll() {
    const store = await getStore('readonly');

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result.map((doc) => {
          const { fileData, ...metadata } = doc;
          return metadata;
        });
        resolve(docs);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to get all documents: ' + event.target.error));
      };
    });
  }

  /**
   * Get favorite documents (metadata only)
   */
  async function getFavorites() {
    const store = await getStore('readonly');

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result
          .filter((doc) => doc.isFavorite)
          .map((doc) => {
            const { fileData, ...metadata } = doc;
            return metadata;
          });
        resolve(docs);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to get favorites: ' + event.target.error));
      };
    });
  }

  /**
   * Get recent documents (last N, metadata only)
   */
  async function getRecent(limit = 5) {
    const allDocs = await getAll();
    return allDocs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get document counts per vault
   */
  async function getCounts() {
    const allDocs = await getAll();
    return {
      personal: allDocs.filter((d) => d.vault === 'personal').length,
      official: allDocs.filter((d) => d.vault === 'official').length,
      total: allDocs.length,
    };
  }

  /**
   * Update a document's metadata (not file data)
   */
  async function updateDocument(id, updates) {
    const store = await getStore('readwrite');

    return new Promise((resolve, reject) => {
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const doc = getReq.result;
        if (!doc) {
          reject(new Error('Document not found'));
          return;
        }

        const updated = {
          ...doc,
          ...updates,
          id: doc.id, // preserve ID
          fileData: doc.fileData, // preserve file data
          updatedAt: Date.now(),
        };

        const putReq = store.put(updated);

        putReq.onsuccess = () => {
          const { fileData, ...metadata } = updated;
          resolve(metadata);
        };

        putReq.onerror = (event) => {
          reject(new Error('Failed to update document: ' + event.target.error));
        };
      };

      getReq.onerror = (event) => {
        reject(new Error('Failed to get document for update: ' + event.target.error));
      };
    });
  }

  /**
   * Toggle favorite status
   */
  async function toggleFavorite(id) {
    const doc = await getDocument(id);
    if (!doc) throw new Error('Document not found');
    return updateDocument(id, { isFavorite: !doc.isFavorite });
  }

  /**
   * Delete a document
   */
  async function deleteDocument(id) {
    const store = await getStore('readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        reject(new Error('Failed to delete document: ' + event.target.error));
      };
    });
  }

  /**
   * Get file data as a Blob URL for preview/download
   */
  async function getFileUrl(id) {
    const doc = await getDocument(id);
    if (!doc || !doc.fileData) return null;

    // If fileData is already a Blob
    if (doc.fileData instanceof Blob) {
      return URL.createObjectURL(doc.fileData);
    }

    // If fileData is an ArrayBuffer, convert it
    const blob = new Blob([doc.fileData], { type: doc.fileType });
    return URL.createObjectURL(blob);
  }

  /**
   * Get raw file Blob for sharing
   */
  async function getFileBlob(id) {
    const doc = await getDocument(id);
    if (!doc || !doc.fileData) return null;

    if (doc.fileData instanceof Blob) {
      return doc.fileData;
    }

    return new Blob([doc.fileData], { type: doc.fileType });
  }

  /**
   * Export all documents as an array (for backup)
   */
  async function exportAll() {
    const store = await getStore('readonly');

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to export: ' + event.target.error));
      };
    });
  }

  /**
   * Generate a thumbnail from an image file
   */
  function generateThumbnail(file, maxWidth = 300, maxHeight = 200) {
    return new Promise((resolve) => {
      if (file.type && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width *= ratio;
              height *= ratio;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.onerror = () => resolve(null);
          img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } else if (file.type && file.type.includes('pdf') && typeof pdfjsLib !== 'undefined') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.4 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } catch (err) {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * Clear all documents from database
   */
  async function clearAll() {
    const store = await getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // Public API
  return {
    open,
    addDocument,
    getDocument,
    getAllByVault,
    getAll,
    getFavorites,
    getRecent,
    getCounts,
    updateDocument,
    toggleFavorite,
    deleteDocument,
    clearAll,
    getFileUrl,
    getFileBlob,
    exportAll,
    generateThumbnail,
  };
})();
