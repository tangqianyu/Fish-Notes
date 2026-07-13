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
    lock: (id: string) => ipcRenderer.invoke('notes:lock', id),
    unlock: (id: string) => ipcRenderer.invoke('notes:unlock', id),
    getDecrypted: (id: string) => ipcRenderer.invoke('notes:getDecrypted', id),
  },
  encryption: {
    hasPassword: () => ipcRenderer.invoke('encryption:hasPassword'),
    verifyPassword: (password: string) => ipcRenderer.invoke('encryption:verifyPassword', password),
    setPassword: (password: string) => ipcRenderer.invoke('encryption:setPassword', password),
    changePassword: (oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('encryption:changePassword', oldPassword, newPassword),
    removePassword: (password: string) => ipcRenderer.invoke('encryption:removePassword', password),
    isUnlocked: () => ipcRenderer.invoke('encryption:isUnlocked'),
    lockAll: () => ipcRenderer.invoke('encryption:lockAll'),
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
    reorder: (orderedIds: string[]) => ipcRenderer.invoke('tags:reorder', orderedIds),
  },
  search: {
    notes: (query: string) => ipcRenderer.invoke('search:notes', query),
  },
  export: {
    markdown: (title: string, content: string) =>
      ipcRenderer.invoke('export:markdown', title, content),
    html: (title: string, content: string) => ipcRenderer.invoke('export:html', title, content),
    pdf: (title: string, content: string) => ipcRenderer.invoke('export:pdf', title, content),
  },
  images: {
    saveFromBuffer: (buffer: ArrayBuffer, mimeType: string) =>
      ipcRenderer.invoke('images:saveFromBuffer', buffer, mimeType),
    pickFile: () => ipcRenderer.invoke('images:pickFile'),
  },
  import: {
    files: () => ipcRenderer.invoke('import:files'),
  },
  ai: {
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (cfg: { token: string; model: string; claudePath?: string }) =>
      ipcRenderer.invoke('ai:setConfig', cfg),
    testConnection: (cfg?: { token: string; model: string; claudePath?: string }) =>
      ipcRenderer.invoke('ai:testConnection', cfg),
    suggestTitle: (content: string) => ipcRenderer.invoke('ai:suggestTitle', content),
    polishText: (text: string) => ipcRenderer.invoke('ai:polishText', text),
    chatStream: (payload: {
      requestId: string;
      messages: { role: 'user' | 'assistant'; content: string }[];
      noteContext?: string;
      scope?: 'notes';
    }) => ipcRenderer.invoke('ai:chatStream', payload),
    abortChat: (requestId: string) => ipcRenderer.invoke('ai:abortChat', requestId),
    onChatChunk: (cb: (data: { requestId: string; delta: string }) => void) => {
      const listener = (_e: unknown, data: { requestId: string; delta: string }) => cb(data);
      ipcRenderer.on('ai:chat-chunk', listener);
      return () => ipcRenderer.removeListener('ai:chat-chunk', listener);
    },
    onChatThinking: (
      cb: (data: { requestId: string; delta: string; tokens?: number }) => void,
    ) => {
      const listener = (_e: unknown, data: { requestId: string; delta: string; tokens?: number }) =>
        cb(data);
      ipcRenderer.on('ai:chat-thinking', listener);
      return () => ipcRenderer.removeListener('ai:chat-thinking', listener);
    },
    onChatSources: (
      cb: (data: { requestId: string; sources: { id: string; title: string }[] }) => void,
    ) => {
      const listener = (
        _e: unknown,
        data: { requestId: string; sources: { id: string; title: string }[] },
      ) => cb(data);
      ipcRenderer.on('ai:chat-sources', listener);
      return () => ipcRenderer.removeListener('ai:chat-sources', listener);
    },
    onChatDone: (cb: (data: { requestId: string; fullText: string }) => void) => {
      const listener = (_e: unknown, data: { requestId: string; fullText: string }) => cb(data);
      ipcRenderer.on('ai:chat-done', listener);
      return () => ipcRenderer.removeListener('ai:chat-done', listener);
    },
    onChatError: (cb: (data: { requestId: string; message: string }) => void) => {
      const listener = (_e: unknown, data: { requestId: string; message: string }) => cb(data);
      ipcRenderer.on('ai:chat-error', listener);
      return () => ipcRenderer.removeListener('ai:chat-error', listener);
    },
  },
  chats: {
    list: () => ipcRenderer.invoke('chats:list'),
    create: (title?: string) => ipcRenderer.invoke('chats:create', title),
    getMessages: (chatId: string) => ipcRenderer.invoke('chats:getMessages', chatId),
    addMessage: (
      chatId: string,
      role: 'user' | 'assistant',
      content: string,
      noteId?: string | null,
    ) => ipcRenderer.invoke('chats:addMessage', chatId, role, content, noteId),
    rename: (chatId: string, title: string) => ipcRenderer.invoke('chats:rename', chatId, title),
    delete: (chatId: string) => ipcRenderer.invoke('chats:delete', chatId),
  },
});
