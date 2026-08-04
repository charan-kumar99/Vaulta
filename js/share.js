
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

    const allDocs = await DocDB.exportAll();
    const zip = new JSZip();

    const personalFolder = zip.folder('Personal');
    const officialFolder = zip.folder('Official');

    const metadata = [];

    for (const doc of allDocs) {
      const folder = doc.vault === 'personal' ? personalFolder : officialFolder;

      if (doc.fileData) {
        const blob = doc.fileData instanceof Blob
          ? doc.fileData
          : new Blob([doc.fileData], { type: doc.fileType });
        folder.file(doc.fileName, blob);
      }

      const { fileData, ...meta } = doc;
      metadata.push(meta);
    }

    zip.file('vaulta_metadata.json', JSON.stringify(metadata, null, 2));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const date = new Date().toISOString().slice(0, 10);
    return downloadFile(zipBlob, `Vaulta_Backup_${date}.zip`);
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
    shareDocument,
    shareDocumentAs,
    downloadDocument,
    shareMultiple,
    exportBackup,
    canNativeShare,
    getAvailableFormats,
    convertFile,
    downloadFile,
  };
})();
