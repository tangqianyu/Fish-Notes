import { dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { htmlToMarkdown } from './markdown';
import { createNoteFromImport, type NoteData } from './database/notes';

/** Extensions accepted by the import dialog. */
const SUPPORTED_EXTS = ['md', 'markdown', 'txt', 'html', 'htm'];

export interface ImportResult {
  created: NoteData[];
  failed: { name: string; error: string }[];
}

async function fileToMarkdown(filePath: string): Promise<string> {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const text = fs.readFileSync(filePath, 'utf8');
  if (ext === 'html' || ext === 'htm') {
    return htmlToMarkdown(text);
  }
  // md / markdown / txt — already Markdown/plain text
  return text;
}

/** Import a set of local files (main-process paths only) into new notes. Each file
 *  becomes one note titled after its filename; conversion failures are collected
 *  rather than aborting the whole batch. */
export async function importFromPaths(filePaths: string[]): Promise<ImportResult> {
  const result: ImportResult = { created: [], failed: [] };
  for (const filePath of filePaths) {
    const name = path.basename(filePath);
    try {
      const content = await fileToMarkdown(filePath);
      const title = path.basename(filePath, path.extname(filePath)) || name;
      result.created.push(createNoteFromImport(title, content));
    } catch (e) {
      result.failed.push({ name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

/** Open a native multi-select file picker, then import the chosen files. The dialog
 *  is main-driven, so the renderer never supplies arbitrary filesystem paths. */
export async function importFiles(): Promise<ImportResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入笔记',
    filters: [
      { name: '笔记文件', extensions: SUPPORTED_EXTS },
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || filePaths.length === 0) return { created: [], failed: [] };
  return importFromPaths(filePaths);
}
