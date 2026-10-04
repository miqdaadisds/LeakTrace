const { contextBridge, ipcRenderer } = require('electron');

const LOCAL_ENCLAVE_URL = 'http://127.0.0.1:8000';
const resolvedApiUrl = process.env.LEAKTRACE_API_URL || LOCAL_ENCLAVE_URL;

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  apiUrl: resolvedApiUrl,
  saveFile: (options) => ipcRenderer.invoke('save-file-dialog', options),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
});
