import { ipcMain } from 'electron';
import * as notesDb from '../database/notes';
import * as tagsDb from '../database/tags';
import * as searchDb from '../database/search';
import * as images from '../images';
import { getRawDatabase } from '../database/index';
import { randomBytes } from 'node:crypto';
import {
  hashPassword,
  verifyPassword as verifyPw,
  deriveEncryptionKey,
  setCachedKey,
  clearCachedKey,
  isKeyReady,
} from '../encryption';
import {
  getAIConfigPublic,
  setAIConfig,
  testClaudeConnection,
  suggestTitle,
  polishText,
  chatStream,
  abortChat,
  type AIConfig,
  type ChatMessage,
} from '../ai';
import { buildKbContext } from '../ai/retrieval';
import * as chatsDb from '../database/chats';

function getSetting(key: string): string | undefined {
  const rawDb = getRawDatabase();
  const row = rawDb.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

function setSetting(key: string, value: string): void {
  const rawDb = getRawDatabase();
  rawDb.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value);
}

function deleteSetting(key: string): void {
  const rawDb = getRawDatabase();
  rawDb.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
}

export function registerIpcHandlers() {
  // Notes
  ipcMain.handle('notes:create', () => notesDb.createNote());
  ipcMain.handle('notes:getAll', () => notesDb.getAllNotes());
  ipcMain.handle('notes:getTrashed', () => notesDb.getTrashedNotes());
  ipcMain.handle('notes:get', (_event, id: string) => notesDb.getNote(id));
  ipcMain.handle(
    'notes:update',
    (_event, id: string, data: { title?: string; content?: string; contentText?: string }) =>
      notesDb.updateNote(id, data),
  );
  ipcMain.handle('notes:trash', (_event, id: string) => notesDb.trashNote(id));
  ipcMain.handle('notes:restore', (_event, id: string) => notesDb.restoreNote(id));
  ipcMain.handle('notes:deletePermanently', (_event, id: string) =>
    notesDb.deleteNotePermanently(id),
  );
  ipcMain.handle('notes:togglePin', (_event, id: string) => notesDb.togglePinNote(id));

  // Note encryption
  ipcMain.handle('notes:lock', (_event, id: string) => notesDb.lockNote(id));
  ipcMain.handle('notes:unlock', (_event, id: string) => notesDb.unlockNote(id));
  ipcMain.handle('notes:getDecrypted', (_event, id: string) => notesDb.getDecryptedNote(id));

  // Encryption management
  ipcMain.handle('encryption:hasPassword', () => {
    return !!getSetting('encryption_password_hash');
  });

  ipcMain.handle('encryption:isUnlocked', () => {
    return isKeyReady();
  });

  ipcMain.handle('encryption:verifyPassword', async (_event, password: string) => {
    const hash = getSetting('encryption_password_hash');
    const salt = getSetting('encryption_password_salt');
    const keySalt = getSetting('encryption_key_salt');
    if (!hash || !salt || !keySalt) return false;

    if (!(await verifyPw(password, hash, salt))) return false;

    // Cache the encryption key for this session
    const key = await deriveEncryptionKey(password, keySalt);
    setCachedKey(key);
    return true;
  });

  ipcMain.handle('encryption:setPassword', async (_event, password: string) => {
    // First-time password setup
    const { hash, salt } = await hashPassword(password);
    const keySaltBuf = randomBytes(32);
    const keySalt = keySaltBuf.toString('base64');

    setSetting('encryption_password_hash', hash);
    setSetting('encryption_password_salt', salt);
    setSetting('encryption_key_salt', keySalt);

    // Cache the key
    const key = await deriveEncryptionKey(password, keySalt);
    setCachedKey(key);
    return true;
  });

  ipcMain.handle(
    'encryption:changePassword',
    async (_event, oldPassword: string, newPassword: string) => {
      const hash = getSetting('encryption_password_hash');
      const salt = getSetting('encryption_password_salt');
      const keySalt = getSetting('encryption_key_salt');
      if (!hash || !salt || !keySalt) return false;

      if (!(await verifyPw(oldPassword, hash, salt))) return false;

      const oldKey = await deriveEncryptionKey(oldPassword, keySalt);

      // Generate new credentials
      const newHash = await hashPassword(newPassword);
      const newKeySaltBuf = randomBytes(32);
      const newKeySalt = newKeySaltBuf.toString('base64');
      const newKey = await deriveEncryptionKey(newPassword, newKeySalt);

      // Re-encrypt all locked notes in a transaction
      notesDb.reEncryptAllNotes(oldKey, newKey);

      // Update stored credentials
      setSetting('encryption_password_hash', newHash.hash);
      setSetting('encryption_password_salt', newHash.salt);
      setSetting('encryption_key_salt', newKeySalt);

      setCachedKey(newKey);
      return true;
    },
  );

  ipcMain.handle('encryption:removePassword', async (_event, password: string) => {
    const hash = getSetting('encryption_password_hash');
    const salt = getSetting('encryption_password_salt');
    const keySalt = getSetting('encryption_key_salt');
    if (!hash || !salt || !keySalt) return false;

    if (!(await verifyPw(password, hash, salt))) return false;

    const key = await deriveEncryptionKey(password, keySalt);

    // Decrypt all locked notes
    notesDb.decryptAllNotes(key);

    // Remove encryption settings
    deleteSetting('encryption_password_hash');
    deleteSetting('encryption_password_salt');
    deleteSetting('encryption_key_salt');

    clearCachedKey();
    return true;
  });

  ipcMain.handle('encryption:lockAll', () => {
    clearCachedKey();
    return true;
  });

  // Tags
  ipcMain.handle('tags:getAll', () => tagsDb.getAllTags());
  ipcMain.handle('tags:setNoteTags', (_event, noteId: string, tagNames: string[]) =>
    tagsDb.setNoteTags(noteId, tagNames),
  );
  ipcMain.handle('tags:getByNoteId', (_event, noteId: string) => tagsDb.getTagsByNoteId(noteId));
  ipcMain.handle('tags:getNotesByTag', (_event, tagId: string) => tagsDb.getNotesByTag(tagId));
  ipcMain.handle('tags:cleanupUnused', () => tagsDb.deleteUnusedTags());
  ipcMain.handle('tags:delete', (_event, tagId: string) => tagsDb.deleteTag(tagId));
  ipcMain.handle('tags:rename', (_event, tagId: string, newName: string) =>
    tagsDb.renameTag(tagId, newName),
  );
  ipcMain.handle('tags:togglePin', (_event, tagId: string) => tagsDb.togglePinTag(tagId));
  ipcMain.handle('tags:reorder', (_event, orderedIds: string[]) => tagsDb.reorderTags(orderedIds));

  // Search
  ipcMain.handle('search:notes', (_event, query: string) => searchDb.searchNotes(query));

  // Images. NOTE: there is deliberately no "save from arbitrary path" IPC — letting the
  // renderer hand the main process any absolute path to copy is a file-exfiltration vector.
  // Images enter only via saveFromBuffer (drag/paste) or the main-driven file picker.
  ipcMain.handle('images:saveFromBuffer', (_event, buffer: ArrayBuffer, mimeType: string) =>
    images.saveImageFromBuffer(Buffer.from(buffer), mimeType),
  );
  ipcMain.handle('images:pickFile', () => images.pickImageFile());

  // AI
  ipcMain.handle('ai:getConfig', () => getAIConfigPublic());
  ipcMain.handle('ai:setConfig', (_event, cfg: AIConfig) => setAIConfig(cfg));
  ipcMain.handle('ai:testConnection', (_event, cfg?: AIConfig) => testClaudeConnection(cfg));
  ipcMain.handle('ai:suggestTitle', (_event, content: string) => suggestTitle(content));
  ipcMain.handle('ai:polishText', (_event, text: string) => polishText(text));

  // AI assistant — streaming chat. Pushes chunks back to the requesting webContents.
  ipcMain.handle(
    'ai:chatStream',
    (
      event,
      payload: {
        requestId: string;
        messages: ChatMessage[];
        noteContext?: string;
        scope?: 'notes';
      },
    ) => {
      const sender = event.sender;
      const { requestId, messages, noteContext, scope } = payload;
      let kbPrompt: string | undefined;
      if (scope === 'notes') {
        const question = messages[messages.length - 1]?.content ?? '';
        const kb = buildKbContext(question);
        kbPrompt = kb.prompt;
        if (!sender.isDestroyed())
          sender.send('ai:chat-sources', { requestId, sources: kb.sources });
      }
      chatStream(requestId, messages, { noteContext, kbPrompt }, {
        onDelta: (text) => {
          if (!sender.isDestroyed()) sender.send('ai:chat-chunk', { requestId, delta: text });
        },
        onThinking: (text, estimatedTokens) => {
          if (!sender.isDestroyed())
            sender.send('ai:chat-thinking', { requestId, delta: text, tokens: estimatedTokens });
        },
        onDone: (fullText) => {
          if (!sender.isDestroyed()) sender.send('ai:chat-done', { requestId, fullText });
        },
        onError: (message) => {
          if (!sender.isDestroyed()) sender.send('ai:chat-error', { requestId, message });
        },
      });
    },
  );
  ipcMain.handle('ai:abortChat', (_event, requestId: string) => abortChat(requestId));

  // AI assistant — chat persistence
  ipcMain.handle('chats:list', () => chatsDb.listChats());
  ipcMain.handle('chats:create', (_event, title?: string) => chatsDb.createChat(title));
  ipcMain.handle('chats:getMessages', (_event, chatId: string) => chatsDb.getChatMessages(chatId));
  ipcMain.handle(
    'chats:addMessage',
    (
      _event,
      chatId: string,
      role: 'user' | 'assistant',
      content: string,
      noteId?: string | null,
    ) => chatsDb.addMessage(chatId, role, content, noteId),
  );
  ipcMain.handle('chats:rename', (_event, chatId: string, title: string) =>
    chatsDb.renameChat(chatId, title),
  );
  ipcMain.handle('chats:delete', (_event, chatId: string) => chatsDb.deleteChat(chatId));
}
