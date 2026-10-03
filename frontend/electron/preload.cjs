const { contextBridge, ipcRenderer } = require('electron');

const CENTRAL_DEFAULT_URL = 'https://leaktrace-backend.onrender.com';
const isOfflineForced = process.env.LEAKTRACE_OFFLINE === '1' || process.env.LEAKTRACE_API_URL === 'offline';
const resolvedApiUrl = isOfflineForced ? 'http://127.0.0.1:8000' : (process.env.LEAKTRACE_API_URL || CENTRAL_DEFAULT_URL);

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  apiUrl: resolvedApiUrl,
});
