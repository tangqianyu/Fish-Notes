import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  notes: {
    create: () => ipcRenderer.invoke('notes:create'),
    getAll: () => ipcRenderer.invoke('notes:getAll'),
    getTrashed: () => ipcRenderer.invoke('notes:getTrashed'),
    get: (id: string) => ipcRenderer.invoke('notes:get', id),
    update: (id: string, data: { title?: string; content?: string; contentText?: string }) =>
      ipcRenderer.invoke('notes:update', id, data),
    trash: (id: string) => ipcRenderer.invoke('notes:trash', id),
    restore: (id: string) => ipcRenderer.invoke('notes:restore', id),
    deletePermanently: (id: string) => ipcRenderer.invoke('notes:deletePermanently', id),
    togglePin: (id: string) => ipcRenderer.invoke('notes:togglePin', id),
  },
  tags: {
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    setNoteTags: (noteId: string, tagNames: string[]) =>
      ipcRenderer.invoke('tags:setNoteTags', noteId, tagNames),
    getByNoteId: (noteId: string) => ipcRenderer.invoke('tags:getByNoteId', noteId),
    getNotesByTag: (tagId: string) => ipcRenderer.invoke('tags:getNotesByTag', tagId),
    cleanupUnused: () => ipcRenderer.invoke('tags:cleanupUnused'),
    delete: (tagId: string) => ipcRenderer.invoke('tags:delete', tagId),
    rename: (tagId: string, newName: string) => ipcRenderer.invoke('tags:rename', tagId, newName),
    togglePin: (tagId: string) => ipcRenderer.invoke('tags:togglePin', tagId),
  },
  search: {
    notes: (query: string) => ipcRenderer.invoke('search:notes', query),
  },
  export: {
    markdown: (title: string, content: string) => ipcRenderer.invoke('export:markdown', title, content),
    html: (title: string, content: string) => ipcRenderer.invoke('export:html', title, content),
    pdf: (title: string, content: string) => ipcRenderer.invoke('export:pdf', title, content),
  },
  images: {
    saveFromPath: (filePath: string) => ipcRenderer.invoke('images:saveFromPath', filePath),
    saveFromBuffer: (buffer: ArrayBuffer, mimeType: string) =>
      ipcRenderer.invoke('images:saveFromBuffer', buffer, mimeType),
    pickFile: () => ipcRenderer.invoke('images:pickFile'),
  },
});
