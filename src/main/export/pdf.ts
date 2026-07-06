import { BrowserWindow, app } from 'electron';
import { writeFileSync, rmSync } from 'node:fs';
import { exportHtml } from './html';
import path from 'node:path';
import crypto from 'node:crypto';

export async function exportPdf(filePath: string, title: string, content: string): Promise<void> {
  // Create a temporary HTML file, load it in a hidden window, then print to PDF.
  // The temp file holds the note in plaintext, so it must always be removed.
  const tmpHtml = path.join(app.getPath('temp'), `fish-notes-export-${crypto.randomUUID()}.html`);
  exportHtml(tmpHtml, title, content);

  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });

  try {
    await win.loadFile(tmpHtml);

    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      // Electron expects margins in inches
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });

    writeFileSync(filePath, pdfData);
  } finally {
    if (!win.isDestroyed()) win.close();
    try {
      rmSync(tmpHtml, { force: true });
    } catch {
      /* best-effort temp cleanup */
    }
  }
}
