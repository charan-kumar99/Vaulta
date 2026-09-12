
const DocShare = (() => {
  
  function canNativeShare() {
    return 'share' in navigator && 'canShare' in navigator;
  }

  async function shareDocument(docId) {
    try {
      const doc = await DocDB.getDocument(docId);
      if (!doc) throw new Error('Document not found');

      const blob = await DocDB.getFileBlob(docId);
      if (!blob) throw new Error('File data not found');

      const file = new File([blob], doc.fileName, { type: doc.fileType });

      if (canNativeShare()) {
        const shareData = {
          title: doc.name,
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return { success: true, method: 'native' };
        }
      }

      return downloadFile(blob, doc.fileName);
    } catch (error) {
      if (error.name === 'AbortError') {
        
        return { success: false, method: 'cancelled' };
      }
      console.error('Share failed:', error);
      throw error;
    }
  }

  function downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);

    return { success: true, method: 'download' };
  }

  async function downloadDocument(docId) {
    const doc = await DocDB.getDocument(docId);
    if (!doc) throw new Error('Document not found');

    const blob = await DocDB.getFileBlob(docId);
    if (!blob) throw new Error('File data not found');

    return downloadFile(blob, doc.fileName);
  }

  async function shareMultiple(docIds) {
    const files = [];
    const docs = [];

    for (const id of docIds) {
      const doc = await DocDB.getDocument(id);
      if (doc && doc.fileData) {
        const blob = doc.fileData instanceof Blob
          ? doc.fileData
          : new Blob([doc.fileData], { type: doc.fileType });
        const fileName = doc.fileName || `${doc.name}.${doc.fileType.includes('pdf') ? 'pdf' : 'jpg'}`;
        const file = new File([blob], fileName, { type: doc.fileType });
        files.push(file);
        docs.push(doc);
      }
    }

    if (files.length === 0) {
      throw new Error('No documents found to share');
    }

    if (canNativeShare()) {
      const shareData = {
        title: files.length === 1 ? docs[0].name : 'Vaulta Documents',
        files: files,
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return { success: true, method: 'native', count: files.length };
        } catch (e) {
          if (e.name === 'AbortError') {
            return { success: false, method: 'cancelled' };
          }
          console.warn('Native share failed, using fallback:', e);
        }
      }
    }

    for (let i = 0; i < files.length; i++) {
      downloadFile(files[i], files[i].name);
      if (files.length > 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    return { success: true, method: 'download', count: files.length };
  }

  async function exportBackup() {
    if (typeof JSZip === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }

    const allDocs = (typeof DocDB !== 'undefined' && DocDB.getAll) ? await DocDB.getAll() : [];
    const zip = new JSZip();

    const personalFolder = zip.folder('Personal');
    const officialFolder = zip.folder('Official');

    const metadata = [];

    for (const doc of allDocs) {
      const folder = doc.vault === 'official' ? officialFolder : personalFolder;

      let fileBlob = null;
      if (typeof DocDB !== 'undefined' && typeof DocDB.getFileBlob === 'function') {
        try {
          fileBlob = await DocDB.getFileBlob(doc.id);
        } catch (e) {
          console.warn('[Backup] getFileBlob error for doc ' + doc.id, e);
        }
      }

      if (fileBlob) {
        folder.file(doc.fileName || `${doc.name}.bin`, fileBlob);
      } else if (doc.fileData) {
        const blob = doc.fileData instanceof Blob
          ? doc.fileData
          : new Blob([doc.fileData], { type: doc.fileType || 'application/octet-stream' });
        folder.file(doc.fileName || `${doc.name}.bin`, blob);
      } else if (doc.fileDataBase64) {
        try {
          const parts = doc.fileDataBase64.split(',');
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          folder.file(doc.fileName || `${doc.name}.bin`, u8arr);
        } catch (e) {
          console.warn('[Backup] Base64 export error:', e);
        }
      }

      const { fileData, fileDataBase64, ...meta } = doc;
      metadata.push(meta);
    }

    let folders = [];
    try {
      folders = JSON.parse(localStorage.getItem('vaulta_nested_folders_v2') || '[]');
    } catch (_) {}
    zip.file('folders.json', JSON.stringify(folders, null, 2));

    let customCategories = { personal: [], official: [] };
    try {
      customCategories = JSON.parse(localStorage.getItem('vaulta_custom_categories') || '{"personal":[],"official":[]}');
    } catch (_) {}
    zip.file('categories.json', JSON.stringify(customCategories, null, 2));

    zip.file('vaulta_metadata.json', JSON.stringify(metadata, null, 2));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const date = new Date().toISOString().slice(0, 10);
    downloadFile(zipBlob, `Vaulta_Backup_${date}.zip`);
    if (window.DocUI && typeof window.DocUI.showToast === 'function') {
      window.DocUI.showToast(`✅ Exported ${allDocs.length} documents backup successfully!`, 'success');
    }
    return { success: true };
  }

  async function importBackup(file) {
    if (!file) throw new Error('No backup file selected');

    const fileNameLower = (file.name || '').toLowerCase();
    const isZip = fileNameLower.endsWith('.zip') || (file.type && (file.type.includes('zip') || file.type.includes('octet-stream')));

    // If it's a JSON or .vaulta sync file, use importSecretSyncPackage directly
    if (!isZip && (fileNameLower.endsWith('.json') || fileNameLower.endsWith('.vaulta') || (file.type && file.type.includes('json')))) {
      const text = await file.text();
      const packageObj = JSON.parse(text);
      if (typeof DocDB !== 'undefined' && typeof DocDB.importSecretSyncPackage === 'function') {
        return await DocDB.importSecretSyncPackage(packageObj);
      }
      throw new Error('Database module is not available to restore JSON package');
    }

    // Ensure JSZip library is loaded
    if (typeof JSZip === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }

    let zip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (zipErr) {
      try {
        const text = await file.text();
        const packageObj = JSON.parse(text);
        if (typeof DocDB !== 'undefined' && typeof DocDB.importSecretSyncPackage === 'function') {
          return await DocDB.importSecretSyncPackage(packageObj);
        }
      } catch (_) {}
      throw new Error('Could not read ZIP archive: ' + zipErr.message);
    }

    // 1. Restore nested folders
    let restoredFoldersCount = 0;
    const foldersEntry = zip.file('folders.json') || zip.file('Folders.json');
    if (foldersEntry) {
      try {
        const foldersText = await foldersEntry.async('text');
        const backupFolders = JSON.parse(foldersText);
        if (Array.isArray(backupFolders)) {
          const currentFolders = JSON.parse(localStorage.getItem('vaulta_nested_folders_v2') || '[]');
          const folderMap = new Map();
          currentFolders.forEach((f) => folderMap.set(f.id, f));
          backupFolders.forEach((f) => folderMap.set(f.id, f));
          localStorage.setItem('vaulta_nested_folders_v2', JSON.stringify(Array.from(folderMap.values())));
          restoredFoldersCount = backupFolders.length;
        }
      } catch (e) {
        console.warn('[Backup Import] Failed to restore folders:', e);
      }
    }

    // 2. Restore custom categories
    const catsEntry = zip.file('categories.json') || zip.file('Categories.json');
    if (catsEntry) {
      try {
        const catsText = await catsEntry.async('text');
        const backupCats = JSON.parse(catsText);
        if (backupCats) {
          const currentCats = JSON.parse(localStorage.getItem('vaulta_custom_categories') || '{"personal":[],"official":[]}');
          const personalCats = Array.from(new Set([...(currentCats.personal || []), ...(backupCats.personal || [])]));
          const officialCats = Array.from(new Set([...(currentCats.official || []), ...(backupCats.official || [])]));
          localStorage.setItem('vaulta_custom_categories', JSON.stringify({ personal: personalCats, official: officialCats }));
        }
      } catch (e) {
        console.warn('[Backup Import] Failed to restore categories:', e);
      }
    }

    // 3. Process documents
    let metadataList = null;
    const metaEntry = zip.file('vaulta_metadata.json') || zip.file('metadata.json');
    if (metaEntry) {
      try {
        const metaText = await metaEntry.async('text');
        metadataList = JSON.parse(metaText);
      } catch (e) {
        console.warn('[Backup Import] Failed to parse vaulta_metadata.json:', e);
      }
    }

    let importedDocsCount = 0;
    const database = await DocDB.open();
    const tx = database.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');

    if (Array.isArray(metadataList) && metadataList.length > 0) {
      for (const meta of metadataList) {
        const docFileName = meta.fileName || `${meta.name}.bin`;
        const candidatePaths = [
          meta.vault === 'official' ? `Official/${docFileName}` : `Personal/${docFileName}`,
          `Personal/${docFileName}`,
          `Official/${docFileName}`,
          docFileName,
          `${meta.name}.bin`,
        ];

        let fileEntry = null;
        for (const p of candidatePaths) {
          fileEntry = zip.file(p);
          if (fileEntry) break;
        }

        if (!fileEntry) {
          const allKeys = Object.keys(zip.files);
          const lowerName = docFileName.toLowerCase();
          const matchKey = allKeys.find((k) => !zip.files[k].dir && k.toLowerCase().endsWith(lowerName));
          if (matchKey) fileEntry = zip.file(matchKey);
        }

        let fileBlob = null;
        if (fileEntry) {
          const arrayBuffer = await fileEntry.async('arraybuffer');
          fileBlob = new Blob([arrayBuffer], { type: meta.fileType || 'application/octet-stream' });
        }

        let fileToSave = fileBlob;
        let isEncrypted = false;
        let encAlgo = null;
        let encryptedAt = null;

        if (window.SecurityModule && typeof window.SecurityModule.isEncryptionEnabled === 'function' && window.SecurityModule.isEncryptionEnabled()) {
          try {
            if (fileBlob) {
              fileToSave = await window.SecurityModule.encryptBlob(fileBlob, meta.fileType || fileBlob.type);
              isEncrypted = true;
              encAlgo = 'AES-GCM-256';
              encryptedAt = Date.now();
            }
          } catch (encErr) {
            console.warn('[DocDB] Encryption fallback during import:', encErr);
          }
        }

        let thumbnail = meta.thumbnail || null;
        if (!thumbnail && fileBlob && (meta.fileType || '').startsWith('image/')) {
          try {
            if (typeof DocDB.generateThumbnail === 'function') {
              thumbnail = await DocDB.generateThumbnail(fileBlob);
            }
          } catch (_) {}
        }

        const docRecord = {
          ...meta,
          fileData: fileToSave,
          thumbnail: thumbnail,
          isEncrypted: isEncrypted || meta.isEncrypted || false,
          encAlgo: encAlgo || meta.encAlgo || null,
          encryptedAt: encryptedAt || meta.encryptedAt || null,
          updatedAt: Date.now(),
        };

        await new Promise((res, rej) => {
          const req = store.put(docRecord);
          req.onsuccess = () => { importedDocsCount++; res(); };
          req.onerror = (e) => rej(e.target.error);
        });
      }
    } else {
      // Fallback: scan all files in zip if no vaulta_metadata.json was included
      const allKeys = Object.keys(zip.files);
      for (const key of allKeys) {
        const entry = zip.files[key];
        if (entry.dir) continue;
        if (key === 'folders.json' || key === 'categories.json' || key === 'vaulta_metadata.json' || key.startsWith('__MACOSX')) continue;

        const parts = key.split('/');
        const rawFileName = parts[parts.length - 1];
        const isOfficial = key.toLowerCase().startsWith('official/');
        const extMatch = rawFileName.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : '';
        const name = rawFileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

        let fileType = 'application/octet-stream';
        if (['jpg', 'jpeg'].includes(ext)) fileType = 'image/jpeg';
        else if (ext === 'png') fileType = 'image/png';
        else if (ext === 'webp') fileType = 'image/webp';
        else if (ext === 'pdf') fileType = 'application/pdf';

        const arrayBuf = await entry.async('arraybuffer');
        const fileBlob = new Blob([arrayBuf], { type: fileType });

        let fileToSave = fileBlob;
        let isEncrypted = false;
        let encAlgo = null;
        let encryptedAt = null;

        if (window.SecurityModule && typeof window.SecurityModule.isEncryptionEnabled === 'function' && window.SecurityModule.isEncryptionEnabled()) {
          try {
            fileToSave = await window.SecurityModule.encryptBlob(fileBlob, fileType);
            isEncrypted = true;
            encAlgo = 'AES-GCM-256';
            encryptedAt = Date.now();
          } catch (_) {}
        }

        let thumbnail = null;
        if (fileType.startsWith('image/')) {
          try {
            if (typeof DocDB.generateThumbnail === 'function') {
              thumbnail = await DocDB.generateThumbnail(fileBlob);
            }
          } catch (_) {}
        }

        const docRecord = {
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          vault: isOfficial ? 'official' : 'personal',
          name: name || rawFileName,
          category: 'All',
          folderId: null,
          folder: null,
          tags: [],
          fileData: fileToSave,
          fileType,
          fileName: rawFileName,
          thumbnail,
          expiryDate: null,
          isFavorite: false,
          isEncrypted,
          encAlgo,
          encryptedAt,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await new Promise((res, rej) => {
          const req = store.put(docRecord);
          req.onsuccess = () => { importedDocsCount++; res(); };
          req.onerror = (e) => rej(e.target.error);
        });
      }
    }

    return { documentCount: importedDocsCount, folderCount: restoredFoldersCount };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getAvailableFormats(fileType) {
    const formats = [];

    const origExt = fileType.includes('pdf') ? 'PDF'
      : fileType.includes('png') ? 'PNG'
      : fileType.includes('jpeg') || fileType.includes('jpg') ? 'JPG'
      : fileType.includes('gif') ? 'GIF'
      : fileType.includes('webp') ? 'WEBP'
      : 'Original';

    formats.push({
      id: 'original',
      label: `Original (${origExt})`,
      icon: '📎',
      mime: fileType,
      ext: origExt.toLowerCase(),
    });

    if (fileType.startsWith('image/')) {
      if (!fileType.includes('jpeg')) {
        formats.push({ id: 'jpg', label: 'JPEG Image (.jpg)', icon: '🖼️', mime: 'image/jpeg', ext: 'jpg' });
      }
      if (!fileType.includes('png')) {
        formats.push({ id: 'png', label: 'PNG Image (.png)', icon: '🖼️', mime: 'image/png', ext: 'png' });
      }
      if (!fileType.includes('webp')) {
        formats.push({ id: 'webp', label: 'WebP Image (.webp)', icon: '🖼️', mime: 'image/webp', ext: 'webp' });
      }
      
      formats.push({ id: 'pdf', label: 'PDF Document (.pdf)', icon: '📕', mime: 'application/pdf', ext: 'pdf' });
    }

    if (fileType.includes('pdf')) {
      formats.push({ id: 'note', label: 'Text Note (.txt)', icon: '📝', mime: 'text/plain', ext: 'txt' });
    }

    return formats;
  }

  async function convertFile(blob, originalType, targetFormat, docName, originalFileName) {
    const baseName = docName.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_');

    if (targetFormat === 'original') {
      return { blob, fileName: originalFileName, mime: originalType };
    }

    if (originalType.startsWith('image/') && ['jpg', 'png', 'webp'].includes(targetFormat)) {
      const converted = await convertImage(blob, targetFormat);
      const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
      return {
        blob: converted,
        fileName: `${baseName}.${targetFormat}`,
        mime: mimeMap[targetFormat],
      };
    }

    if (originalType.startsWith('image/') && targetFormat === 'pdf') {
      const pdfBlob = await imageToPdf(blob, docName);
      return {
        blob: pdfBlob,
        fileName: `${baseName}.pdf`,
        mime: 'application/pdf',
      };
    }

    if (originalType.includes('pdf') && targetFormat === 'note') {
      const textContent = `Document: ${docName}\nOriginal File: ${originalFileName}\nExported from DocVault\nDate: ${new Date().toLocaleDateString('en-IN')}\n\n(This is a text reference for the PDF document)`;
      const textBlob = new Blob([textContent], { type: 'text/plain' });
      return {
        blob: textBlob,
        fileName: `${baseName}.txt`,
        mime: 'text/plain',
      };
    }

    return { blob, fileName: originalFileName, mime: originalType };
  }

  function convertImage(blob, targetFormat) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');

        if (targetFormat === 'jpg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        const quality = targetFormat === 'png' ? undefined : 0.92;

        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error('Canvas conversion failed'));
          },
          mimeMap[targetFormat],
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for conversion'));
      };

      img.src = url;
    });
  }

  async function imageToPdf(blob, title) {
    
    if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        try {
          const JsPDF = (typeof jspdf !== 'undefined') ? jspdf.jsPDF : jsPDF;
          const imgWidth = img.naturalWidth;
          const imgHeight = img.naturalHeight;

          const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
          const pdf = new JsPDF({ orientation, unit: 'px', format: [imgWidth, imgHeight] });

          const canvas = document.createElement('canvas');
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);

          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

          const pdfBlob = pdf.output('blob');
          URL.revokeObjectURL(url);
          resolve(pdfBlob);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for PDF conversion'));
      };

      img.src = url;
    });
  }

  async function shareDocumentAs(docId, format) {
    try {
      const doc = await DocDB.getDocument(docId);
      if (!doc) throw new Error('Document not found');

      const originalBlob = await DocDB.getFileBlob(docId);
      if (!originalBlob) throw new Error('File data not found');

      const { blob, fileName, mime } = await convertFile(
        originalBlob, doc.fileType, format, doc.name, doc.fileName
      );

      const file = new File([blob], fileName, { type: mime });

      if (canNativeShare()) {
        const shareData = {
          title: doc.name,
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return { success: true, method: 'native' };
        }
      }

      return downloadFile(blob, fileName);
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
      console.error('Share as failed:', error);
      throw error;
    }
  }

  return {
    init: () => {},
    shareDocument,
    shareDocumentAs,
    downloadDocument,
    shareMultiple,
    exportBackup,
    importBackup,
    canNativeShare,
    getAvailableFormats,
    convertFile,
    downloadFile,
  };
})();

window.DocShare = DocShare;
