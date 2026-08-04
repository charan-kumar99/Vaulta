
window.DocDB = (() => {
  const DB_NAME = 'docvault_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'documents';
  let db = null;

  function generateId() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

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

  async function getStore(mode = 'readonly') {
    const database = await open();
    const tx = database.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  async function addDocument(doc) {
    const store = await getStore('readwrite');

    const document = {
      id: generateId(),
      vault: doc.vault,
      name: doc.name,
      category: doc.category,
      folder: doc.folder || null,
      tags: doc.tags || [],
      fileData: doc.fileData,
      fileType: doc.fileType,
      fileName: doc.fileName,
      thumbnail: doc.thumbnail || null,
      expiryDate: doc.expiryDate || null,
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.add(document);

      request.onsuccess = () => {
        
        const { fileData, ...metadata } = document;
        resolve(metadata);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to add document: ' + event.target.error));
      };
    });
  }

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

  async function getRecent(limit = 5) {
    const allDocs = await getAll();
    return allDocs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  async function getCounts() {
    const allDocs = await getAll();
    return {
      personal: allDocs.filter((d) => d.vault === 'personal').length,
      official: allDocs.filter((d) => d.vault === 'official').length,
      total: allDocs.length,
    };
  }

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
          id: doc.id, 
          fileData: doc.fileData, 
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

  async function toggleFavorite(id) {
    const doc = await getDocument(id);
    if (!doc) throw new Error('Document not found');
    return updateDocument(id, { isFavorite: !doc.isFavorite });
  }

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

  async function getFileUrl(id) {
    const doc = await getDocument(id);
    if (!doc || !doc.fileData) return null;

    if (doc.fileData instanceof Blob) {
      return URL.createObjectURL(doc.fileData);
    }

    const blob = new Blob([doc.fileData], { type: doc.fileType });
    return URL.createObjectURL(blob);
  }

  async function getFileBlob(id) {
    const doc = await getDocument(id);
    if (!doc || !doc.fileData) return null;

    if (doc.fileData instanceof Blob) {
      return doc.fileData;
    }

    return new Blob([doc.fileData], { type: doc.fileType });
  }

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

  async function clearAll() {
    const store = await getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async function exportSecretSyncPackage() {
    const store = await getStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = async () => {
        try {
          const docs = request.result || [];
          const processedDocs = [];

          for (const doc of docs) {
            let fileDataBase64 = null;
            if (doc.fileData) {
              try {
                const blob = doc.fileData instanceof Blob
                  ? doc.fileData
                  : new Blob([doc.fileData], { type: doc.fileType || 'application/octet-stream' });

                fileDataBase64 = await new Promise((res) => {
                  const reader = new FileReader();
                  reader.onload = (e) => res(e.target.result);
                  reader.onerror = () => res(null);
                  reader.readAsDataURL(blob);
                });
              } catch (err) {
                console.error('Failed to convert fileData to Base64:', err);
              }
            }

            processedDocs.push({
              ...doc,
              fileData: undefined,
              fileDataBase64,
            });
          }

          let folders = [];
          try {
            folders = JSON.parse(localStorage.getItem('vaulta_nested_folders_v2') || '[]');
          } catch (e) {
            folders = [];
          }

          let customCategories = { personal: [], official: [] };
          try {
            customCategories = JSON.parse(localStorage.getItem('vaulta_custom_categories') || '{"personal":[],"official":[]}');
          } catch (e) {
            customCategories = { personal: [], official: [] };
          }

          const packageObj = {
            version: 'vaulta_sync_v2',
            exportedAt: Date.now(),
            folders,
            customCategories,
            documents: processedDocs,
          };

          resolve(packageObj);
        } catch (err) {
          reject(new Error('Failed to package export data: ' + err.message));
        }
      };
      request.onerror = (event) => reject(new Error('Failed to export sync package: ' + event.target.error));
    });
  }

  async function importSecretSyncPackage(packageObj) {
    if (!packageObj || !packageObj.documents) {
      throw new Error('Invalid Vaulta sync file.');
    }

    if (Array.isArray(packageObj.folders)) {
      const currentFolders = JSON.parse(localStorage.getItem('vaulta_nested_folders_v2') || '[]');
      const folderMap = new Map();
      currentFolders.forEach((f) => folderMap.set(f.id, f));
      packageObj.folders.forEach((f) => folderMap.set(f.id, f));
      localStorage.setItem('vaulta_nested_folders_v2', JSON.stringify(Array.from(folderMap.values())));
    }

    if (packageObj.customCategories) {
      const currentCats = JSON.parse(localStorage.getItem('vaulta_custom_categories') || '{"personal":[],"official":[]}');
      const personalCats = Array.from(new Set([...(currentCats.personal || []), ...(packageObj.customCategories.personal || [])]));
      const officialCats = Array.from(new Set([...(currentCats.official || []), ...(packageObj.customCategories.official || [])]));
      localStorage.setItem('vaulta_custom_categories', JSON.stringify({ personal: personalCats, official: officialCats }));
    }

    const store = await getStore('readwrite');
    let count = 0;

    for (const doc of packageObj.documents) {
      let blob = null;
      if (doc.fileDataBase64) {
        try {
          const parts = doc.fileDataBase64.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : doc.fileType || 'application/octet-stream';
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          blob = new Blob([u8arr], { type: mime });
        } catch (e) {
          console.error('Error converting base64 to blob:', e);
        }
      }

      const docToStore = {
        ...doc,
        fileData: blob || doc.fileData,
        fileDataBase64: undefined,
        updatedAt: Date.now(),
      };

      await new Promise((res, rej) => {
        const req = store.put(docToStore);
        req.onsuccess = () => { count++; res(); };
        req.onerror = (event) => rej(event.target.error);
      });
    }

    return { documentCount: count, folderCount: (packageObj.folders || []).length };
  }

  function getExpiryStatus(expiryDateStr) {
    if (!expiryDateStr) return { status: 'valid', daysLeft: Infinity };
    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime())) return { status: 'valid', daysLeft: Infinity };
    const now = new Date();
    
    expiry.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) return { status: 'expired', daysLeft };
    if (daysLeft <= 30) return { status: 'expiring-soon', daysLeft };
    return { status: 'valid', daysLeft };
  }

  async function getStorageStats() {
    const docs = await getAll();
    let totalBytes = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    const vaultStats = {
      personal: { count: 0, bytes: 0 },
      official: { count: 0, bytes: 0 }
    };
    const categoryStats = {};

    docs.forEach((doc) => {
      let size = doc.fileSize || 0;
      if (!size && doc.fileData) {
        size = doc.fileData.size || doc.fileData.byteLength || doc.fileData.length || 0;
      }
      if (!size && doc.fileDataBase64) {
        size = Math.round((doc.fileDataBase64.length * 3) / 4);
      }
      if (!size && doc.thumbnail) {
        size = Math.round((doc.thumbnail.length * 3) / 4);
      }
      if (!size) {
        size = 153600; 
      }

      totalBytes += size;

      const vault = doc.vault === 'official' ? 'official' : 'personal';
      vaultStats[vault].count++;
      vaultStats[vault].bytes += size;

      const cat = doc.category || 'Other';
      if (!categoryStats[cat]) categoryStats[cat] = { count: 0, bytes: 0 };
      categoryStats[cat].count++;
      categoryStats[cat].bytes += size;

      if (doc.expiryDate) {
        const exp = getExpiryStatus(doc.expiryDate);
        if (exp.status === 'expiring-soon') expiringCount++;
        if (exp.status === 'expired') expiredCount++;
      }
    });

    return {
      totalBytes,
      totalDocs: docs.length,
      vaultStats,
      categoryStats,
      expiringCount,
      expiredCount
    };
  }

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
    exportSecretSyncPackage,
    importSecretSyncPackage,
    generateThumbnail,
    getExpiryStatus,
    getStorageStats,
  };
})();
