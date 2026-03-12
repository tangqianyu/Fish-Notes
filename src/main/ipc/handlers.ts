import { ipcMain } from 'electron';
import * as notesDb from '../database/notes';
import * as tagsDb from '../database/tags';
import * as searchDb from '../database/search';
import * as images from '../images';

export function registerIpcHandlers() {
  // Notes
  ipcMain.handle('notes:create', () => notesDb.createNote());
  ipcMain.handle('notes:getAll', () => notesDb.getAllNotes());
  ipcMain.handle('notes:getTrashed', () => notesDb.getTrashedNotes());
  ipcMain.handle('notes:get', (_event, id: string) => notesDb.getNote(id));
  ipcMain.handle('notes:update', (_event, id: string, data: { title?: string; content?: string; contentText?: string }) =>
    notesDb.updateNote(id, data),
  );
  ipcMain.handle('notes:trash', (_event, id: string) => notesDb.trashNote(id));
  ipcMain.handle('notes:restore', (_event, id: string) => notesDb.restoreNote(id));
  ipcMain.handle('notes:deletePermanently', (_event, id: string) => notesDb.deleteNotePermanently(id));
  ipcMain.handle('notes:togglePin', (_event, id: string) => notesDb.togglePinNote(id));

  // Tags
  ipcMain.handle('tags:getAll', () => tagsDb.getAllTags());
  ipcMain.handle('tags:setNoteTags', (_event, noteId: string, tagNames: string[]) =>
    tagsDb.setNoteTags(noteId, tagNames),
  );
  ipcMain.handle('tags:getByNoteId', (_event, noteId: string) => tagsDb.getTagsByNoteId(noteId));
  ipcMain.handle('tags:getNotesByTag', (_event, tagId: string) => tagsDb.getNotesByTag(tagId));
  ipcMain.handle('tags:cleanupUnused', () => tagsDb.deleteUnusedTags());
  ipcMain.handle('tags:delete', (_event, tagId: string) => tagsDb.deleteTag(tagId));
  ipcMain.handle('tags:rename', (_event, tagId: string, newName: string) => tagsDb.renameTag(tagId, newName));
  ipcMain.handle('tags:togglePin', (_event, tagId: string) => tagsDb.togglePinTag(tagId));

  // Search
  ipcMain.handle('search:notes', (_event, query: string) => searchDb.searchNotes(query));

  // Images
  ipcMain.handle('images:saveFromPath', (_event, filePath: string) =>
    images.saveImageFromPath(filePath),
  );
  ipcMain.handle('images:saveFromBuffer', (_event, buffer: ArrayBuffer, mimeType: string) =>
    images.saveImageFromBuffer(Buffer.from(buffer), mimeType),
  );
  ipcMain.handle('images:pickFile', () => images.pickImageFile());
}
