import { app, BrowserWindow, protocol, net, shell, session } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { initDatabase } from './main/database';
import { registerIpcHandlers } from './main/ipc/handlers';
import { registerExportHandlers } from './main/ipc/exportHandlers';
import { ensureImagesDir, getImagesDir } from './main/images';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Dev-only: isolate all app data into a separate profile (DB + images + settings).
// Lets you run a throwaway demo profile for screenshots without touching real data:
//   FISH_NOTES_USER_DATA=/tmp/fish-notes-demo yarn start
// Has no effect in normal/production runs (env var unset).
if (process.env.FISH_NOTES_USER_DATA) {
  app.setPath('userData', process.env.FISH_NOTES_USER_DATA);
}

// Register fish-image:// scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'fish-image',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // 外部链接用系统浏览器打开
  const EXTERNAL_PROTOCOL = /^(https?|mailto|tel):/i;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (EXTERNAL_PROTOCOL.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (EXTERNAL_PROTOCOL.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

// Content-Security-Policy: strict in production (scripts only from the bundle), relaxed
// in dev so Vite HMR (inline scripts, eval, websocket) keeps working. `fish-image:` and
// `data:` are allowed for images; inline styles are needed for the app's style attributes.
function applyCsp() {
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const policy = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: fish-image:; font-src 'self' data:; connect-src 'self' ws: http: https:;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: fish-image:; font-src 'self' data:; connect-src 'self';";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

app.on('ready', () => {
  initDatabase();
  ensureImagesDir();
  applyCsp();

  // Register fish-image:// protocol to serve local images. The filename must resolve to a
  // file *inside* the images dir — reject any path-traversal attempt (`../`, absolute paths,
  // URL-encoded separators) so malicious note content can't read arbitrary local files.
  protocol.handle('fish-image', (request) => {
    const notFound = () => new Response(null, { status: 404 });
    let filename: string;
    try {
      filename = decodeURIComponent(request.url.replace(/^fish-image:\/\/\/?/, ''));
    } catch {
      return notFound();
    }
    // Keep only the final path segment; strip any directory components entirely.
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename || safeName.includes('..')) {
      return notFound();
    }
    const imagesDir = getImagesDir();
    const filePath = path.join(imagesDir, safeName);
    const resolved = path.resolve(filePath);
    if (resolved !== filePath || !resolved.startsWith(imagesDir + path.sep)) {
      return notFound();
    }
    return net.fetch(`file://${resolved}`);
  });

  registerIpcHandlers();
  registerExportHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
