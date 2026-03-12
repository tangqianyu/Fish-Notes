import { ipcMain, dialog } from 'electron';
import { exportMarkdown } from '../export/markdown';
import { exportHtml } from '../export/html';
import { exportPdf } from '../export/pdf';

export function registerExportHandlers() {
  ipcMain.handle('export:markdown', async (_event, title: string, content: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '导出为 Markdown',
      defaultPath: `${title || '未命名'}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (canceled || !filePath) return false;
    exportMarkdown(filePath, content);
    return true;
  });

  ipcMain.handle('export:html', async (_event, title: string, content: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '导出为 HTML',
      defaultPath: `${title || '未命名'}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (canceled || !filePath) return false;
    exportHtml(filePath, title, content);
    return true;
  });

  ipcMain.handle('export:pdf', async (_event, title: string, content: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '导出为 PDF',
      defaultPath: `${title || '未命名'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return false;
    await exportPdf(filePath, title, content);
    return true;
  });
}
