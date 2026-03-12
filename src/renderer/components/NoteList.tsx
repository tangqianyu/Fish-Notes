import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../contexts/AppContext';

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
  const { state, createNote, selectNote, trashNote, restoreNote, deleteNotePermanently, togglePinNote } = useApp();
  const { notes, selectedNoteId, viewMode } = state;

  const [contextMenu, setContextMenu] = useState<NoteContextMenu | null>(null);

  const headerLabel = viewMode === 'trash' ? '回收站' : '所有笔记';

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    selectNote(noteId);
    setContextMenu({ x: e.clientX, y: e.clientY, noteId });
  }, [selectNote]);

  const handleTrash = useCallback(async () => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    setContextMenu(null);
    await trashNote(noteId);
  }, [contextMenu, trashNote]);

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

  const contextNote = contextMenu ? notes.find((n) => n.id === contextMenu.noteId) : null;

  return (
    <div
      className="relative flex flex-col no-select shrink-0 transition-colors"
      style={{ width, backgroundColor: 'var(--bg-primary)', borderRight: '1px solid var(--border-primary)' }}
    >
      {/* Header */}
      <div
        className="h-12 flex items-center justify-between px-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border-secondary)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{headerLabel}</span>
        {viewMode !== 'trash' && (
          <button
            onClick={createNote}
            className="p-1 rounded transition-colors hover:opacity-70"
            style={{ color: 'var(--text-tertiary)' }}
            title="新建笔记"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-tertiary)' }}>
            暂无笔记
          </div>
        ) : (
          notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
              onClick={() => selectNote(note.id)}
              onContextMenu={(e) => handleContextMenu(e, note.id)}
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
      {contextMenu && (
        viewMode === 'trash' ? (
          <NoteContextMenuPopup x={contextMenu.x} y={contextMenu.y}>
            <ContextMenuItem label="恢复" onClick={handleRestore} />
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
            <ContextMenuItem label="永久删除" onClick={handleDeletePermanently} danger />
          </NoteContextMenuPopup>
        ) : (
          <NoteContextMenuPopup x={contextMenu.x} y={contextMenu.y}>
            <ContextMenuItem label={contextNote?.isPinned ? '取消置顶' : '置顶'} onClick={handleTogglePin} />
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
            <ContextMenuItem label="删除" onClick={handleTrash} danger />
          </NoteContextMenuPopup>
        )
      )}
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return '刚刚';
  if (diffHour < 1) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;

  const sameYear = now.getFullYear() === date.getFullYear();
  if (sameYear) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function NoteListItem({ note, isSelected, onClick, onContextMenu }: {
  note: NoteData;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const title = note.title || '无标题';
  const preview = note.content
    .replace(/<h1[^>]*>.*?<\/h1>/i, '')
    .replace(/<span class="hashtag">[^<]*<\/span>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const date = formatRelativeDate(note.updatedAt);

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="w-full text-left px-4 py-3 transition-colors"
      style={{
        borderBottom: '1px solid var(--border-secondary)',
        backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
      }}
    >
      <div className="flex items-center text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {note.isPinned && <span className="mr-1 text-xs opacity-60">📌</span>}
        {title}
      </div>
      {preview && <div className="mt-1 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{preview}</div>}
      <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{date}</div>
    </button>
  );
}

function NoteContextMenuPopup({ x, y, children }: {
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

function ContextMenuItem({ label, onClick, danger = false }: {
  label: string;
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
