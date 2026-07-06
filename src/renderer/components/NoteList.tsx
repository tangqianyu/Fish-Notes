import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { useAssistant } from '../contexts/AssistantContext';
import PasswordPrompt from './PasswordPrompt';
import { buildNotePreview } from '../utils/mdUtils';
import { PinIcon, RobotIcon } from './icons';

interface NoteListProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

interface NoteContextMenu {
  x: number;
  y: number;
  noteId: string;
}

function NoteList({ width, onResizeStart }: NoteListProps) {
  const { t } = useTranslation();
  const {
    state,
    createNote,
    selectNote,
    trashNote,
    restoreNote,
    deleteNotePermanently,
    togglePinNote,
    lockNote,
    unlockNote,
    encryptionReady,
    sessionUnlocked,
    verifyPassword,
  } = useApp();
  const { askAboutNote } = useAssistant();
  const { notes, selectedNoteId, selectSeq, viewMode } = state;

  const [contextMenu, setContextMenu] = useState<NoteContextMenu | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);

  const headerLabel = viewMode === 'trash' ? t('Trash') : t('All Notes');

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, noteId: string) => {
      e.preventDefault();
      selectNote(noteId);
      setContextMenu({ x: e.clientX, y: e.clientY, noteId });
    },
    [selectNote],
  );

  const handleTrash = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    await trashNote(noteId);
  }, [contextMenu, trashNote]);

  const handleAskAi = useCallback(() => {
    if (!contextMenu) return;
    const note = notes.find((n) => n.id === contextMenu.noteId);
    setContextMenu(null);
    if (note) askAboutNote({ id: note.id, title: note.title || t('Untitled') });
  }, [contextMenu, notes, askAboutNote, t]);

  const handleRestore = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    await restoreNote(noteId);
  }, [contextMenu, restoreNote]);

  const handleDeletePermanently = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    await deleteNotePermanently(noteId);
  }, [contextMenu, deleteNotePermanently]);

  const handleTogglePin = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    await togglePinNote(noteId);
  }, [contextMenu, togglePinNote]);

  const handleLock = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    if (!sessionUnlocked) {
      pendingActionRef.current = () => lockNote(noteId);
      setShowPasswordPrompt(true);
      return;
    }
    await lockNote(noteId);
  }, [contextMenu, lockNote, sessionUnlocked]);

  const handleUnlock = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    if (!sessionUnlocked) {
      pendingActionRef.current = () => unlockNote(noteId);
      setShowPasswordPrompt(true);
      return;
    }
    await unlockNote(noteId);
  }, [contextMenu, unlockNote, sessionUnlocked]);

  const handlePasswordVerify = useCallback(
    async (password: string) => {
      const ok = await verifyPassword(password);
      if (ok) {
        setShowPasswordPrompt(false);
        if (pendingActionRef.current) {
          await pendingActionRef.current();
          pendingActionRef.current = null;
        }
      }
      return ok;
    },
    [verifyPassword],
  );

  const handlePasswordCancel = useCallback(() => {
    setShowPasswordPrompt(false);
    pendingActionRef.current = null;
  }, []);

  const contextNote = contextMenu ? notes.find((n) => n.id === contextMenu.noteId) : null;

  // When the selection jumps (e.g. from search), scroll the list to reveal it.
  // Keyed by id + selectSeq: re-selecting the SAME note (search again) still scrolls,
  // while content edits (notes updates) don't keep yanking the list back.
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const lastScrolledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedNoteId) return;
    const key = `${selectedNoteId}:${selectSeq}`;
    if (lastScrolledKeyRef.current === key) return;
    if (!selectedItemRef.current) return; // list not loaded yet; retry on next notes change
    lastScrolledKeyRef.current = key;
    selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedNoteId, selectSeq, notes]);

  return (
    <div
      className="relative flex flex-col no-select shrink-0 transition-colors"
      style={{
        width,
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-primary)',
      }}
    >
      {/* Header */}
      <div
        className="h-12 flex items-center justify-between px-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border-secondary)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {headerLabel}
        </span>
        {viewMode !== 'trash' && (
          <button
            onClick={createNote}
            className="fn-accent-btn p-1 rounded-lg transition-all hover:opacity-90"
            style={{
              background: 'var(--accent-bg)',
              color: 'var(--accent-fg)',
              boxShadow: 'var(--accent-shadow)',
            }}
            title={t('New Note')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('No notes')}
          </div>
        ) : (
          notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
              itemRef={note.id === selectedNoteId ? selectedItemRef : undefined}
              onSelect={selectNote}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 transition-colors"
        onMouseDown={onResizeStart}
      />

      {/* Context menu */}
      {contextMenu &&
        (viewMode === 'trash' ? (
          <NoteContextMenuPopup x={contextMenu.x} y={contextMenu.y}>
            <ContextMenuItem label={t('Restore')} onClick={handleRestore} />
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
            <ContextMenuItem
              label={t('Delete Permanently')}
              onClick={handleDeletePermanently}
              danger
            />
          </NoteContextMenuPopup>
        ) : (
          <NoteContextMenuPopup x={contextMenu.x} y={contextMenu.y}>
            <ContextMenuItem
              label={
                <span className="inline-flex items-center gap-1.5">
                  <RobotIcon size={14} style={{ color: 'var(--accent-solid)' }} />
                  {t('Ask AI')}
                </span>
              }
              onClick={handleAskAi}
            />
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
            <ContextMenuItem
              label={contextNote?.isPinned ? t('Unpin') : t('Pin')}
              onClick={handleTogglePin}
            />
            {encryptionReady && (
              <>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
                {contextNote?.isLocked ? (
                  <ContextMenuItem label={t('Remove Encryption')} onClick={handleUnlock} />
                ) : (
                  <ContextMenuItem label={t('Encrypt Note')} onClick={handleLock} />
                )}
              </>
            )}
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
            <ContextMenuItem label={t('Delete')} onClick={handleTrash} danger />
          </NoteContextMenuPopup>
        ))}

      {/* Password prompt modal */}
      {showPasswordPrompt && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: 'var(--overlay-bg)' }}
        >
          <div
            className="w-80 rounded-xl shadow-2xl p-6"
            style={{ backgroundColor: 'var(--card-bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <PasswordPrompt
              onVerify={handlePasswordVerify}
              onCancel={handlePasswordCancel}
              message={t('Enter password to continue')}
              buttonText={t('Confirm')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return t('Just now');
  if (diffHour < 1) return t('{{n}} min ago', { n: diffMin });
  if (diffHour < 24) return t('{{n}} hr ago', { n: diffHour });

  const sameYear = now.getFullYear() === date.getFullYear();
  if (sameYear) {
    return t('{{month}}/{{day}}', { month: date.getMonth() + 1, day: date.getDate() });
  }
  return t('{{month}}/{{day}}/{{year}}', {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

const NoteListItem = memo(function NoteListItem({
  note,
  isSelected,
  itemRef,
  onSelect,
  onContextMenu,
}: {
  note: NoteData;
  isSelected: boolean;
  itemRef?: React.Ref<HTMLButtonElement>;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, noteId: string) => void;
}) {
  const { t } = useTranslation();
  const title = note.title || t('Untitled');
  // Prefer the DB-stored plain text; only fall back to stripping markdown for
  // legacy rows that predate content_text. Avoids re-running regex over full
  // content on every render.
  const preview = note.contentText ? note.contentText.slice(0, 80) : buildNotePreview(note.content);
  const date = formatRelativeDate(note.updatedAt, t);

  return (
    <button
      ref={itemRef}
      onClick={() => onSelect(note.id)}
      onContextMenu={(e) => onContextMenu(e, note.id)}
      className={`fn-note-item w-full text-left px-4 py-3 ${isSelected ? 'fn-note-active' : ''}`}
      style={{ borderBottom: '1px solid var(--border-secondary)' }}
    >
      <div
        className="flex items-center text-sm font-medium truncate"
        style={{ color: 'var(--text-primary)' }}
      >
        {note.isPinned && (
          <PinIcon
            size={14}
            className="mr-1 shrink-0"
            style={{ color: 'var(--pin-color, var(--accent-solid))' }}
          />
        )}
        {note.isLocked && (
          <svg
            className="w-3.5 h-3.5 mr-1 shrink-0 opacity-60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        )}
        {title}
      </div>
      {note.isLocked ? (
        <div className="mt-1 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
          {t('Encrypted note')}
        </div>
      ) : (
        preview && (
          <div className="mt-1 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
            {preview}
          </div>
        )
      )}
      <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {date}
      </div>
    </button>
  );
});

function NoteContextMenuPopup({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className="fixed rounded-lg shadow-lg border py-1 z-[100] min-w-[140px]"
      style={{
        left: x,
        top: y,
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {children}
    </div>
  );
}

function ContextMenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left px-3 py-1.5 text-sm transition-colors hover:opacity-80"
      style={{ color: danger ? '#ef4444' : 'var(--text-secondary)' }}
    >
      {label}
    </button>
  );
}

export default NoteList;
