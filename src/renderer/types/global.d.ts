interface NoteData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isTrashed: boolean;
  isPinned: boolean;
}

interface TagData {
  id: string;
  name: string;
  parentId: string | null;
  noteCount: number;
  isPinned: boolean;
}

interface Window {
  api: {
    notes: {
      create: () => Promise<NoteData>;
      getAll: () => Promise<NoteData[]>;
      getTrashed: () => Promise<NoteData[]>;
      get: (id: string) => Promise<NoteData | undefined>;
      update: (id: string, data: { title?: string; content?: string; contentText?: string }) => Promise<void>;
      trash: (id: string) => Promise<void>;
      restore: (id: string) => Promise<void>;
      deletePermanently: (id: string) => Promise<void>;
      togglePin: (id: string) => Promise<boolean>;
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
      saveFromPath: (filePath: string) => Promise<string>;
      saveFromBuffer: (buffer: ArrayBuffer, mimeType: string) => Promise<string>;
      pickFile: () => Promise<string | null>;
    };
  };
}
