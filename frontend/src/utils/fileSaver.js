/**
 * Universal file saver for TraceLeak:
 * Uses Electron's native Save Dialog with fallback to standard browser download.
 */
export async function downloadFileToDisk({ defaultFilename, base64Content, textContent, blob, mimeType = 'application/pdf' }) {
  // Convert blob to base64 if needed for Electron native save
  let resolvedBase64 = base64Content;
  if (!resolvedBase64 && blob) {
    try {
      resolvedBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const r = reader.result;
          resolve(typeof r === 'string' ? r.split(',')[1] : null);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (_) {}
  }

  // 1. Electron Native Save Dialog
  if (typeof window !== 'undefined' && window.electronAPI?.saveFile) {
    try {
      const res = await window.electronAPI.saveFile({
        defaultFilename,
        base64Content: resolvedBase64,
        textContent,
      });
      if (res && res.success) {
        return { success: true, filePath: res.filePath, opened: false };
      }
      if (res && res.canceled) {
        return { success: false, canceled: true };
      }
    } catch (e) {
      console.warn('Native save dialog failed, falling back to blob download:', e);
    }
  }

  // 2. Browser Blob Download Fallback
  try {
    let fileBlob = blob;
    if (!fileBlob && base64Content) {
      const byteChars = atob(base64Content);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      fileBlob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    } else if (!fileBlob && textContent) {
      fileBlob = new Blob([textContent], { type: 'application/json' });
    }

    if (fileBlob) {
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { success: true, filePath: defaultFilename };
    }
  } catch (err) {
    console.error('Blob download failed:', err);
    throw err;
  }
}

export function openFolderForFile(filePath) {
  if (typeof window !== 'undefined' && window.electronAPI?.showInFolder) {
    window.electronAPI.showInFolder(filePath);
  }
}
