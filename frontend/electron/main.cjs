const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

let mainWindow = null;
let pythonProcess = null;
const BACKEND_PORT = 8000;
const HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/system/status`;

function checkBackendHealth(retries = 30, interval = 500) {
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
  const backendDir = path.resolve(__dirname, '../../backend');
  console.log(`[Electron] Launching Python backend worker from: ${backendDir}`);

  // Launch python uvicorn silently in background (no cmd window)
  pythonProcess = spawn(
    'python',
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
    {
      cwd: backendDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Worker] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Worker] ${data.toString().trim()}`);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[Electron] Python worker exited with code ${code}, signal ${signal}`);
  });
}

function killPythonBackend() {
  if (pythonProcess && pythonProcess.pid) {
    console.log(`[Electron] Terminating Python backend PID: ${pythonProcess.pid}`);
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pythonProcess.pid} /f /t`);
      } else {
        pythonProcess.kill('SIGKILL');
      }
    } catch (e) {
      // Ignore if already dead
    }
    pythonProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'NISHAN-PQ: Cryptographic Attribution & Provenance Enclave (SIH26237)',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows local file loading to access localhost API without CORS restrictions
    },
    autoHideMenuBar: true,
  });

  const distPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(distPath).catch((err) => {
    console.error('Failed to load dist/index.html:', err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    let alreadyRunning = false;
    try {
      await checkBackendHealth(2, 200);
      alreadyRunning = true;
      console.log('[Electron] Active Python worker detected on port 8000. Reusing instance.');
    } catch (_) {
      alreadyRunning = false;
    }

    if (!alreadyRunning) {
      startPythonBackend();
      console.log('[Electron] Awaiting Python backend initialization...');
      await checkBackendHealth(30, 500);
      console.log('[Electron] Python backend is operational.');
    }

    createWindow();
  } catch (err) {
    console.error('[Electron] Failed to start background worker:', err);
    dialog.showErrorBox(
      'Enclave Startup Error',
      `Failed to initialize local cryptographic worker: ${err.message}`
    );
    app.quit();
  }

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
});
