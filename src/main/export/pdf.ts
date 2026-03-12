import { BrowserWindow,app } from 'electron';
import { writeFileSync } from 'node:fs';
import { exportHtml } from './html';
import path from 'node:path';

export async function exportPdf(filePath: string, title: string, content: string): Promise<void> {
  // Create a temporary HTML file, load it in a hidden window, then print to PDF
  const tmpHtml = path.join(app.getPath('temp'), `fish-notes-export-${Date.now()}.html`);
  exportHtml(tmpHtml, title, content);

  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: false },
  });

  await win.loadFile(tmpHtml);

  const pdfData = await win.webContents.printToPDF({
    pageSize: 'A4',
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
  });

  writeFileSync(filePath, pdfData);
  win.close();
}
