import React, { useCallback, useState, useRef, useEffect } from 'react';
import TinyMCEEditor from './editor/TinyMCEEditor';
import TagBar from './TagBar';
import { useAutoSave } from '../hooks/useAutoSave';
import { useApp } from '../contexts/AppContext';

interface EditorProps {
  noteId: string | null;
  title: string;
  content: string;
  onContentChange?: (noteId: string, content: string) => void;
}

function Editor({ noteId, title, content, onContentChange }: EditorProps) {
  const { save } = useAutoSave(500);
  const { save: saveTitle } = useAutoSave(500);
  const { updateNoteTitle } = useApp();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep initialContent stable per note to prevent @tinymce/tinymce-react from calling
  // setContent() when selectedNote.content updates in state (which resets the cursor).
  const initialContentRef = useRef(content);
  const prevNoteIdRef = useRef(noteId);
  if (noteId !== prevNoteIdRef.current) {
    initialContentRef.current = content;
    prevNoteIdRef.current = noteId;
    setLocalTitle(title);
  }

  // Sync title from external changes (e.g. note list selection)
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setLocalTitle(newTitle);
      if (!noteId) return;
      saveTitle(() => {
        updateNoteTitle(noteId, newTitle || '无标题');
      });
    },
    [noteId, saveTitle, updateNoteTitle],
  );

  const handleChange = useCallback(
    (html: string) => {
      if (!noteId) return;
      save(() => {
        onContentChange?.(noteId, html);
      });
    },
    [noteId, save, onContentChange],
  );

  // Close menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExport = useCallback(
    async (format: 'markdown' | 'html' | 'pdf') => {
      setShowExportMenu(false);
      await window.api.export[format](title, content);
    },
    [title, content],
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Editor header with export button */}
      <div
        className="h-12 flex items-center justify-end px-4 shrink-0 no-select"
        style={{ borderBottom: '1px solid var(--border-secondary)', WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {noteId && (
          <div ref={menuRef} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-1.5 rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--text-tertiary)' }}
              title="导出"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-40 rounded-lg shadow-lg border py-1 z-50"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-primary)' }}
              >
                <ExportMenuItem label="Markdown (.md)" onClick={() => handleExport('markdown')} />
                <ExportMenuItem label="HTML (.html)" onClick={() => handleExport('html')} />
                <ExportMenuItem label="PDF (.pdf)" onClick={() => handleExport('pdf')} />
              </div>
            )}
          </div>
        )}
      </div>

      {noteId ? (
        <>
          {/* Row 1: Title input */}
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            placeholder="无标题"
            className="px-4 py-2 text-xl font-semibold outline-none shrink-0"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border-secondary)',
            }}
          />

          {/* Row 2: Tags */}
          <TagBar noteId={noteId} />

          {/* Row 3: TinyMCE editor */}
          <TinyMCEEditor key={noteId} defaultValue={initialContentRef.current} onChange={handleChange} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
          选择或创建一篇笔记开始写作
        </div>
      )}
    </div>
  );
}

function ExportMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm transition-colors hover:opacity-80"
      style={{ color: 'var(--text-secondary)' }}
    >
      {label}
    </button>
  );
}

export default Editor;
