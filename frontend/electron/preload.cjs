const { contextBridge, ipcRenderer } = require('electron');

const LOCAL_ENCLAVE_URL = 'http://127.0.0.1:8000';
const CLOUD_ENCLAVE_URL = 'https://leaktrace-backend.onrender.com';
const resolvedApiUrl = process.env.LEAKTRACE_API_URL || null;

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  apiUrl: resolvedApiUrl,
  localEnclaveUrl: LOCAL_ENCLAVE_URL,
  cloudEnclaveUrl: CLOUD_ENCLAVE_URL,
  saveFile: (options) => ipcRenderer.invoke('save-file-dialog', options),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
});
