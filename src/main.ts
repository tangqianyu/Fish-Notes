import { app, BrowserWindow, protocol, net } from 'electron';
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
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', () => {
  initDatabase();
  ensureImagesDir();

  // Register fish-image:// protocol to serve local images
  protocol.handle('fish-image', (request) => {
    const filename = request.url.replace(/^fish-image:\/\/\/?/, '');
    const filePath = path.join(getImagesDir(), filename);
    return net.fetch(`file://${filePath}`);
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
