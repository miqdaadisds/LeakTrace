const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');

const fs = require('fs');

// Persistent UserData in production, isolated temporary path in dev
if (!app.isPackaged) {
  const userDataDir = path.join(os.tmpdir(), `leaktrace-electron-${process.pid}`);
  app.setPath('userData', userDataDir);
} else {
  const userDataDir = path.join(app.getPath('appData'), 'LeakTrace');
  try { fs.mkdirSync(userDataDir, { recursive: true }); } catch (_) {}
  app.setPath('userData', userDataDir);
}

// Disable GPU acceleration and disk cache entirely to prevent lock errors on Windows
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.commandLine.appendSwitch('no-sandbox');

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
    console.log(`[LeakTrace] Launching Standalone backend executable from: ${standaloneExe}`);
    const exeDir = path.dirname(standaloneExe);

    // If persistent DB doesn't exist yet in AppData, seed it if a template exists
    if (!fs.existsSync(persistentDbPath)) {
      const templateDb = path.join(exeDir, 'leaktrace.db');
      if (fs.existsSync(templateDb)) {
        try {
          fs.copyFileSync(templateDb, persistentDbPath);
          console.log(`[LeakTrace] Seeded initial database to: ${persistentDbPath}`);
        } catch (e) {
          console.warn(`[LeakTrace] Failed to seed database: ${e.message}`);
        }
      }
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
    console.log(`[LeakTrace] Standalone binary not found. Falling back to python worker: ${backendDir}`);

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
    console.log(`[LeakTrace] Backend worker exited with code ${code}, signal ${signal}`);
  });
}

function killPythonBackend() {
  if (spawnedByUs && pythonProcess && pythonProcess.pid) {
    console.log(`[LeakTrace] Terminating backend worker PID: ${pythonProcess.pid}`);
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
    title: 'LeakTrace',
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

  // Block external window / popup creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[LeakTrace Security] Denied window open request: ${url}`);
    return { action: 'deny' };
  });

  const remoteApiUrl = process.env.LEAKTRACE_API_URL || null;
  const isRemoteMode = remoteApiUrl && !remoteApiUrl.includes('127.0.0.1') && !remoteApiUrl.includes('localhost');

  // Block external navigation away from authorized enclaves
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isLocalhost = parsedUrl.origin === `http://127.0.0.1:${BACKEND_PORT}`;
      const isConfiguredRemote = isRemoteMode && parsedUrl.origin === new URL(remoteApiUrl).origin;
      if (!isLocalhost && !isConfiguredRemote && parsedUrl.protocol !== 'file:') {
        console.warn(`[LeakTrace Security] Blocked external navigation: ${navigationUrl}`);
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

app.whenReady().then(async () => {
  const remoteApiUrl = process.env.LEAKTRACE_API_URL || null;
  const isRemoteMode = remoteApiUrl && !remoteApiUrl.includes('127.0.0.1') && !remoteApiUrl.includes('localhost');

  if (isRemoteMode) {
    console.log(`[LeakTrace] Connected Mode: Active Central Backend configured at ${remoteApiUrl}`);
    createWindow();
    return;
  }

  try {
    let alreadyRunning = false;
    try {
      await checkBackendHealth(2, 200);
      alreadyRunning = true;
      console.log('[LeakTrace] Active Python worker detected on port 8000. Reusing instance.');
    } catch (_) {
      alreadyRunning = false;
    }

    if (!alreadyRunning) {
      startPythonBackend();
      console.log('[LeakTrace] Awaiting Python backend initialization...');
      await checkBackendHealth(30, 500);
      console.log('[LeakTrace] Python backend is operational.');
    }

    createWindow();
  } catch (err) {
    console.error('[LeakTrace] Failed to start background worker:', err);
    dialog.showErrorBox(
      'LeakTrace Enclave Startup Error',
      `Failed to initialize local cryptographic worker: ${err.message}`
    );
    app.quit();
  }
});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
