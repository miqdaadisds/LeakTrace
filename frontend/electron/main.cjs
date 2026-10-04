const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Persistent UserData in production, isolated temporary path in dev
let userDataDir = null;
if (!app.isPackaged) {
  userDataDir = path.join(os.tmpdir(), `traceleak-electron-${process.pid}`);
  app.setPath('userData', userDataDir);
} else {
  userDataDir = path.join(app.getPath('appData'), 'TraceLeak');
  try { fs.mkdirSync(userDataDir, { recursive: true }); } catch (_) {}
  app.setPath('userData', userDataDir);
}

// Enable standard Chromium GPU compositing for butter-smooth 60fps animations
app.commandLine.appendSwitch('disk-cache-size', '0');


let mainWindow = null;
let pythonProcess = null;
let spawnedByUs = false;
const BACKEND_PORT = 8000;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/system/status`;

function checkBackendHealth(retries = 40, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (attempts < retries) {
          setTimeout(check, interval);
        } else {
          reject(new Error(`Backend returned status ${res.statusCode}`));
        }
      });

      req.on('error', () => {
        if (attempts < retries) {
          setTimeout(check, interval);
        } else {
          reject(new Error('Backend connection timeout'));
        }
      });
      req.end();
    };
    check();
  });
}

function startPythonBackend() {
  const persistentDbPath = path.join(app.getPath('userData'), 'leaktrace.db');

  // Candidate locations for the standalone compiled executable
  const candidateExes = [
    path.join(process.resourcesPath, 'backend', 'leaktrace-backend.exe'),
    path.join(process.resourcesPath, 'leaktrace-backend', 'leaktrace-backend.exe'),
    path.resolve(__dirname, '../../backend/dist/leaktrace-backend/leaktrace-backend.exe'),
    path.resolve(__dirname, '../backend/dist/leaktrace-backend/leaktrace-backend.exe'),
  ];

  let standaloneExe = null;
  for (const p of candidateExes) {
    if (fs.existsSync(p)) {
      standaloneExe = p;
      break;
    }
  }

  if (standaloneExe) {
    console.log(`[TraceLeak] Launching Standalone backend executable from: ${standaloneExe}`);
    const exeDir = path.dirname(standaloneExe);

    // If persistent DB doesn't exist yet in AppData, seed it if a template exists
    if (!fs.existsSync(persistentDbPath)) {
      const templateDb = path.join(exeDir, 'leaktrace.db');
      if (fs.existsSync(templateDb)) {
        try {
          fs.copyFileSync(templateDb, persistentDbPath);
          fs.chmodSync(persistentDbPath, 0o666);
          console.log(`[TraceLeak] Seeded initial database to: ${persistentDbPath}`);
        } catch (e) {
          console.warn(`[TraceLeak] Failed to seed database: ${e.message}`);
        }
      }
    } else {
      try {
        fs.chmodSync(persistentDbPath, 0o666);
      } catch (_) {}
    }

    pythonProcess = spawn(
      standaloneExe,
      [],
      {
        cwd: exeDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          LEAKTRACE_DB: persistentDbPath,
          LEAKTRACE_PORT: String(BACKEND_PORT)
        }
      }
    );
  } else {
    // Development fallback using system python
    const backendDir = path.resolve(__dirname, '../../backend');
    console.log(`[TraceLeak] Standalone binary not found. Falling back to python worker: ${backendDir}`);

    pythonProcess = spawn(
      'python',
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
      {
        cwd: backendDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          LEAKTRACE_DB: persistentDbPath,
          LEAKTRACE_PORT: String(BACKEND_PORT)
        }
      }
    );
  }
  spawnedByUs = true;

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Backend Worker] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Backend Worker] ${data.toString().trim()}`);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[TraceLeak] Backend worker exited with code ${code}, signal ${signal}`);
  });
}

function killPythonBackend() {
  if (spawnedByUs && pythonProcess && pythonProcess.pid) {
    console.log(`[TraceLeak] Terminating backend worker PID: ${pythonProcess.pid}`);
    try {
      pythonProcess.kill();
    } catch (_) {}
    pythonProcess = null;
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'TraceLeak',
    icon: iconPath,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    autoHideMenuBar: true,
  });

  // Handle native file downloads gracefully
  if (mainWindow.webContents.session) {
    mainWindow.webContents.session.on('will-download', (event, item) => {
      const defaultFilename = item.getFilename();
      const savePath = path.join(app.getPath('downloads'), defaultFilename);
      item.setSavePath(savePath);
      console.log(`[TraceLeak] Incoming download: ${defaultFilename} -> ${savePath}`);
      item.once('done', (e, state) => {
        if (state === 'completed') {
          console.log(`[TraceLeak] Download finished successfully: ${savePath}`);
        } else {
          console.warn(`[TraceLeak] Download status: ${state}`);
        }
      });
    });
  }

  // Block external window / popup creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[TraceLeak Security] Denied window open request: ${url}`);
    return { action: 'deny' };
  });

  const CENTRAL_DEFAULT_URL = 'https://leaktrace-backend.onrender.com';
  const isOfflineForced = process.env.LEAKTRACE_OFFLINE === '1' || process.env.LEAKTRACE_API_URL === 'offline';
  const remoteApiUrl = isOfflineForced ? null : (process.env.LEAKTRACE_API_URL || CENTRAL_DEFAULT_URL);
  const isRemoteMode = Boolean(remoteApiUrl && !remoteApiUrl.includes('127.0.0.1') && !remoteApiUrl.includes('localhost'));

  // Block external navigation away from authorized enclaves
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isLocalhost = parsedUrl.origin === `http://127.0.0.1:${BACKEND_PORT}`;
      const isConfiguredRemote = isRemoteMode && parsedUrl.origin === new URL(remoteApiUrl).origin;
      if (!isLocalhost && !isConfiguredRemote && parsedUrl.protocol !== 'file:') {
        console.warn(`[TraceLeak Security] Blocked external navigation: ${navigationUrl}`);
        event.preventDefault();
      }
    } catch (_) {
      event.preventDefault();
    }
  });

  // Load the web application from local bundled distribution
  const distPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(distPath).catch((err) => {
    console.error('Failed to load application index.html:', err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Native Save File Dialog via IPC
ipcMain.handle('save-file-dialog', async (event, { defaultFilename, base64Content, textContent, filters }) => {
  try {
    const defaultFilters = filters || [
      { name: 'All Files (*.*)', extensions: ['*'] }
    ];
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File - TraceLeak',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename || 'document.pdf'),
      filters: defaultFilters
    });
    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }
    if (base64Content) {
      const buffer = Buffer.from(base64Content, 'base64');
      fs.writeFileSync(filePath, buffer);
    } else if (textContent) {
      fs.writeFileSync(filePath, textContent, 'utf-8');
    } else {
      throw new Error('No content provided to save to disk');
    }
    console.log(`[TraceLeak] File successfully saved: ${filePath} (${fs.statSync(filePath).size} bytes)`);
    return { success: true, filePath };
  } catch (err) {
    console.error('[TraceLeak] Save file error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, error: 'File does not exist' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  const CENTRAL_DEFAULT_URL = 'https://leaktrace-backend.onrender.com';
  const isOfflineForced = process.env.LEAKTRACE_OFFLINE === '1' || process.env.LEAKTRACE_API_URL === 'offline';
  const remoteApiUrl = isOfflineForced ? null : (process.env.LEAKTRACE_API_URL || CENTRAL_DEFAULT_URL);
  const isRemoteMode = Boolean(remoteApiUrl && !remoteApiUrl.includes('127.0.0.1') && !remoteApiUrl.includes('localhost'));

  if (isRemoteMode) {
    console.log(`[TraceLeak] Connected Mode: Active Central Backend configured at ${remoteApiUrl}`);
  }

  // Ensure local background worker is bootstrapped for local cryptographic operations
  try {
    let alreadyRunning = false;
    try {
      await checkBackendHealth(2, 200);
      alreadyRunning = true;
      console.log('[TraceLeak] Active Python worker detected on port 8000. Reusing instance.');
    } catch (_) {
      alreadyRunning = false;
    }

    if (!alreadyRunning) {
      startPythonBackend();
      console.log('[TraceLeak] Awaiting Python backend initialization...');
      if (!isRemoteMode) {
        await checkBackendHealth(30, 500);
        console.log('[TraceLeak] Python backend is operational.');
      }
    }
  } catch (err) {
    console.warn('[TraceLeak] Local worker startup note:', err.message);
    if (!isRemoteMode) {
      dialog.showErrorBox(
        'TraceLeak Enclave Startup Error',
        `Failed to initialize local cryptographic worker: ${err.message}`
      );
      app.quit();
      return;
    }
  }

  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  killPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  killPythonBackend();
  // Clean up per-PID temp profile directory
  try {
    const fs = require('fs');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (_) {}
});
