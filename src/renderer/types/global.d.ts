interface NoteData {
  id: string;
  title: string;
  content: string;
  contentText: string;
  createdAt: string;
  updatedAt: string;
  isTrashed: boolean;
  isPinned: boolean;
  isLocked: boolean;
}

interface TagData {
  id: string;
  name: string;
  parentId: string | null;
  noteCount: number;
  isPinned: boolean;
  sortOrder: number;
}

interface Window {
  api: {
    notes: {
      create: () => Promise<NoteData>;
      getAll: () => Promise<NoteData[]>;
      getTrashed: () => Promise<NoteData[]>;
      get: (id: string) => Promise<NoteData | undefined>;
      update: (
        id: string,
        data: { title?: string; content?: string; contentText?: string },
      ) => Promise<void>;
      trash: (id: string) => Promise<void>;
      restore: (id: string) => Promise<void>;
      deletePermanently: (id: string) => Promise<void>;
      togglePin: (id: string) => Promise<boolean>;
      lock: (id: string) => Promise<boolean>;
      unlock: (id: string) => Promise<boolean>;
      getDecrypted: (id: string) => Promise<NoteData | undefined>;
    };
    encryption: {
      hasPassword: () => Promise<boolean>;
      verifyPassword: (password: string) => Promise<boolean>;
      setPassword: (password: string) => Promise<boolean>;
      changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
      removePassword: (password: string) => Promise<boolean>;
      isUnlocked: () => Promise<boolean>;
      lockAll: () => Promise<boolean>;
    };
    tags: {
      getAll: () => Promise<TagData[]>;
      setNoteTags: (noteId: string, tagNames: string[]) => Promise<void>;
      getByNoteId: (noteId: string) => Promise<TagData[]>;
      getNotesByTag: (tagId: string) => Promise<string[]>;
      cleanupUnused: () => Promise<void>;
      delete: (tagId: string) => Promise<string[]>;
      rename: (tagId: string, newName: string) => Promise<string | null>;
      togglePin: (tagId: string) => Promise<boolean>;
      reorder: (orderedIds: string[]) => Promise<void>;
    };
    search: {
      notes: (query: string) => Promise<NoteData[]>;
    };
    export: {
      markdown: (title: string, content: string) => Promise<boolean>;
      html: (title: string, content: string) => Promise<boolean>;
      pdf: (title: string, content: string) => Promise<boolean>;
    };
    images: {
      saveFromBuffer: (buffer: ArrayBuffer, mimeType: string) => Promise<string>;
      pickFile: () => Promise<string | null>;
    };
    ai: {
      getConfig: () => Promise<PublicAIConfig>;
      setConfig: (cfg: AIConfig) => Promise<void>;
      testConnection: (
        cfg?: AIConfig,
      ) => Promise<{ ok: true; reply: string } | { ok: false; error: string }>;
      suggestTitle: (content: string) => Promise<string>;
      polishText: (text: string) => Promise<string>;
      chatStream: (payload: {
        requestId: string;
        messages: ChatMessage[];
        noteContext?: string;
        scope?: 'notes';
      }) => Promise<void>;
      abortChat: (requestId: string) => Promise<void>;
      onChatChunk: (cb: (data: { requestId: string; delta: string }) => void) => () => void;
      onChatSources: (
        cb: (data: { requestId: string; sources: { id: string; title: string }[] }) => void,
      ) => () => void;
      onChatThinking: (
        cb: (data: { requestId: string; delta: string; tokens?: number }) => void,
      ) => () => void;
      onChatDone: (cb: (data: { requestId: string; fullText: string }) => void) => () => void;
      onChatError: (cb: (data: { requestId: string; message: string }) => void) => () => void;
    };
    chats: {
      list: () => Promise<ChatData[]>;
      create: (title?: string) => Promise<ChatData>;
      getMessages: (chatId: string) => Promise<ChatMessageData[]>;
      addMessage: (
        chatId: string,
        role: 'user' | 'assistant',
        content: string,
        noteId?: string | null,
      ) => Promise<ChatMessageData>;
      rename: (chatId: string, title: string) => Promise<void>;
      delete: (chatId: string) => Promise<void>;
    };
  };
}

interface AIConfig {
  token: string;
  model: string;
  claudePath?: string;
}

interface PublicAIConfig {
  model: string;
  claudePath?: string;
  hasToken: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessageData {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  noteId: string | null;
  createdAt: string;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}
