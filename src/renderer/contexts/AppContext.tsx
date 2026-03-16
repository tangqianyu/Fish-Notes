import { createContext, useContext, useReducer, useEffect, useCallback, useState, type ReactNode } from 'react';
import { extractTitle, stripHtml } from '../utils/htmlUtils';

type ViewMode = 'all' | 'trash' | 'tag';

interface AppState {
  notes: NoteData[];
  tags: TagData[];
  selectedNoteId: string | null;
  viewMode: ViewMode;
  selectedTagId: string | null;
}

type AppAction =
  | { type: 'SET_NOTES'; notes: NoteData[] }
  | { type: 'SET_TAGS'; tags: TagData[] }
  | { type: 'SELECT_NOTE'; id: string | null }
  | { type: 'ADD_NOTE'; note: NoteData }
  | { type: 'UPDATE_NOTE'; id: string; data: Partial<NoteData> }
  | { type: 'REMOVE_NOTE'; id: string }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode; tagId?: string | null };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'SET_TAGS':
      return { ...state, tags: action.tags };
    case 'SELECT_NOTE':
      return { ...state, selectedNoteId: action.id };
    case 'ADD_NOTE':
      return {
        ...state,
        notes: [action.note, ...state.notes],
        selectedNoteId: action.note.id,
      };
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, ...action.data } : n,
        ),
      };
    case 'REMOVE_NOTE': {
      const filtered = state.notes.filter((n) => n.id !== action.id);
      return {
        ...state,
        notes: filtered,
        selectedNoteId:
          state.selectedNoteId === action.id
            ? filtered[0]?.id ?? null
            : state.selectedNoteId,
      };
    }
    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.mode,
        selectedTagId: action.tagId ?? null,
        selectedNoteId: null,
      };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  createNote: () => Promise<void>;
  selectNote: (id: string | null) => void;
  updateNoteTitle: (id: string, title: string) => void;
  updateNoteContent: (id: string, content: string) => void;
  addNoteTag: (noteId: string, tagName: string) => Promise<void>;
  removeNoteTag: (noteId: string, tagName: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  setViewMode: (mode: ViewMode, tagId?: string | null) => void;
  refreshNotes: () => Promise<void>;
  refreshTags: () => Promise<void>;
  deleteTag: (tagId: string, tagName: string) => Promise<void>;
  renameTag: (tagId: string, oldName: string, newName: string) => Promise<void>;
  togglePinTag: (tagId: string) => Promise<void>;
  togglePinNote: (id: string) => Promise<void>;
  encryptionReady: boolean;
  sessionUnlocked: boolean;
  lockNote: (id: string) => Promise<void>;
  unlockNote: (id: string) => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  lockAllNotes: () => Promise<void>;
  refreshEncryptionState: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, {
    notes: [],
    tags: [],
    selectedNoteId: null,
    viewMode: 'all',
    selectedTagId: null,
  });

  const [encryptionReady, setEncryptionReady] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

  const refreshEncryptionState = useCallback(async () => {
    const [hasPassword, isUnlocked] = await Promise.all([
      window.api.encryption.hasPassword(),
      window.api.encryption.isUnlocked(),
    ]);
    setEncryptionReady(hasPassword);
    setSessionUnlocked(isUnlocked);
  }, []);

  const refreshTags = useCallback(async () => {
    const tags = await window.api.tags.getAll();
    dispatch({ type: 'SET_TAGS', tags });
  }, []);

  const refreshNotes = useCallback(async () => {
    let notes: NoteData[];
    if (state.viewMode === 'trash') {
      notes = await window.api.notes.getTrashed();
    } else if (state.viewMode === 'tag' && state.selectedTagId) {
      const noteIds = await window.api.tags.getNotesByTag(state.selectedTagId);
      const allNotes = await window.api.notes.getAll();
      notes = allNotes.filter((n) => noteIds.includes(n.id));
    } else {
      notes = await window.api.notes.getAll();
    }
    notes.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    dispatch({ type: 'SET_NOTES', notes });
  }, [state.viewMode, state.selectedTagId]);

  useEffect(() => {
    refreshNotes();
    refreshTags();
    refreshEncryptionState();
  }, [refreshNotes, refreshTags, refreshEncryptionState]);

  const createNote = useCallback(async () => {
    const note = await window.api.notes.create();
    dispatch({ type: 'ADD_NOTE', note });
  }, []);

  const selectNote = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_NOTE', id });
  }, []);

  const updateNoteTitle = useCallback(
    (id: string, title: string) => {
      window.api.notes.update(id, { title });
      dispatch({
        type: 'UPDATE_NOTE',
        id,
        data: { title, updatedAt: new Date().toISOString() },
      });
    },
    [],
  );

  const updateNoteContent = useCallback(
    (id: string, content: string) => {
      const contentText = stripHtml(content);
      window.api.notes.update(id, { content, contentText });
      dispatch({
        type: 'UPDATE_NOTE',
        id,
        data: { content, updatedAt: new Date().toISOString() },
      });
    },
    [],
  );

  const addNoteTag = useCallback(
    async (noteId: string, tagName: string) => {
      const currentTags = await window.api.tags.getByNoteId(noteId);
      const tagNames = currentTags.map((t) => t.name);
      if (!tagNames.includes(tagName)) {
        tagNames.push(tagName);
        await window.api.tags.setNoteTags(noteId, tagNames);
        await refreshTags();
      }
    },
    [refreshTags],
  );

  const removeNoteTag = useCallback(
    async (noteId: string, tagName: string) => {
      const currentTags = await window.api.tags.getByNoteId(noteId);
      const tagNames = currentTags.map((t) => t.name).filter((n) => n !== tagName);
      await window.api.tags.setNoteTags(noteId, tagNames);
      await window.api.tags.cleanupUnused();
      await refreshTags();
    },
    [refreshTags],
  );

  const trashNote = useCallback(
    async (id: string) => {
      await window.api.notes.trash(id);
      dispatch({ type: 'REMOVE_NOTE', id });
      await window.api.tags.cleanupUnused();
      refreshTags();
    },
    [refreshTags],
  );

  const restoreNote = useCallback(async (id: string) => {
    await window.api.notes.restore(id);
    dispatch({ type: 'REMOVE_NOTE', id });
  }, []);

  const deleteNotePermanently = useCallback(
    async (id: string) => {
      await window.api.notes.deletePermanently(id);
      dispatch({ type: 'REMOVE_NOTE', id });
      await window.api.tags.cleanupUnused();
      refreshTags();
    },
    [refreshTags],
  );

  const setViewMode = useCallback((mode: ViewMode, tagId?: string | null) => {
    dispatch({ type: 'SET_VIEW_MODE', mode, tagId });
  }, []);

  const deleteTag = useCallback(
    async (tagId: string, tagName: string) => {
      // Get affected notes before deleting the tag
      const affectedNoteIds = await window.api.tags.delete(tagId);
      const escapedName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Remove #tagName from each affected note's content (both span-wrapped and bare)
      for (const noteId of affectedNoteIds) {
        const note = await window.api.notes.get(noteId);
        if (!note) continue;
        const newContent = note.content
          .replace(new RegExp(`<span class="hashtag">#${escapedName}</span>`, 'g'), '')
          .replace(new RegExp(`#${escapedName}(?=[\\s,;.!?<]|$)`, 'g'), '')
          .replace(/  +/g, ' ');
        if (newContent !== note.content) {
          const title = extractTitle(newContent);
          const contentText = stripHtml(newContent);
          await window.api.notes.update(noteId, { title, content: newContent, contentText });
          dispatch({
            type: 'UPDATE_NOTE',
            id: noteId,
            data: { title, content: newContent, updatedAt: new Date().toISOString() },
          });
        }
      }

      // If currently viewing this tag, switch to all notes
      if (state.selectedTagId === tagId) {
        dispatch({ type: 'SET_VIEW_MODE', mode: 'all' });
      }

      await refreshTags();
      await refreshNotes();
    },
    [refreshTags, refreshNotes, state.selectedTagId],
  );

  const renameTag = useCallback(
    async (tagId: string, oldName: string, newName: string) => {
      await window.api.tags.rename(tagId, newName);
      const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Update all notes that reference this tag (both span-wrapped and bare)
      const noteIds = await window.api.tags.getNotesByTag(tagId);
      for (const noteId of noteIds) {
        const note = await window.api.notes.get(noteId);
        if (!note) continue;
        const newContent = note.content
          .replace(new RegExp(`(<span class="hashtag">)#${escapedOld}(</span>)`, 'g'), `$1#${newName}$2`)
          .replace(new RegExp(`#${escapedOld}(?=[\\s,;.!?<]|$)`, 'g'), `#${newName}`);
        if (newContent !== note.content) {
          const title = extractTitle(newContent);
          const contentText = stripHtml(newContent);
          await window.api.notes.update(noteId, { title, content: newContent, contentText });
          dispatch({
            type: 'UPDATE_NOTE',
            id: noteId,
            data: { title, content: newContent, updatedAt: new Date().toISOString() },
          });
        }
      }

      await refreshTags();
    },
    [refreshTags],
  );

  const togglePinTag = useCallback(
    async (tagId: string) => {
      await window.api.tags.togglePin(tagId);
      await refreshTags();
    },
    [refreshTags],
  );

  const togglePinNote = useCallback(
    async (id: string) => {
      const newPinned = await window.api.notes.togglePin(id);
      dispatch({ type: 'UPDATE_NOTE', id, data: { isPinned: newPinned } });
      await refreshNotes();
    },
    [refreshNotes],
  );

  const lockNote = useCallback(
    async (id: string) => {
      await window.api.notes.lock(id);
      dispatch({ type: 'UPDATE_NOTE', id, data: { isLocked: true, content: '' } });
    },
    [],
  );

  const unlockNote = useCallback(
    async (id: string) => {
      await window.api.notes.unlock(id);
      const note = await window.api.notes.get(id);
      if (note) {
        dispatch({ type: 'UPDATE_NOTE', id, data: { isLocked: false, content: note.content } });
      }
    },
    [],
  );

  const verifyPassword = useCallback(
    async (password: string) => {
      const ok = await window.api.encryption.verifyPassword(password);
      if (ok) {
        setSessionUnlocked(true);
      }
      return ok;
    },
    [],
  );

  const lockAllNotes = useCallback(async () => {
    await window.api.encryption.lockAll();
    setSessionUnlocked(false);
    await refreshNotes();
  }, [refreshNotes]);

  return (
    <AppContext.Provider
      value={{
        state,
        createNote,
        selectNote,
        updateNoteTitle,
        updateNoteContent,
        addNoteTag,
        removeNoteTag,
        trashNote,
        restoreNote,
        deleteNotePermanently,
        setViewMode,
        refreshNotes,
        refreshTags,
        deleteTag,
        renameTag,
        togglePinTag,
        togglePinNote,
        encryptionReady,
        sessionUnlocked,
        lockNote,
        unlockNote,
        verifyPassword,
        lockAllNotes,
        refreshEncryptionState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
