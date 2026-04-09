import React, { useCallback, useState, useRef, useEffect } from 'react';
import TinyMCEEditor from './editor/TinyMCEEditor';
import TagBar from './TagBar';
import PasswordPrompt from './PasswordPrompt';
import { useAutoSave } from '../hooks/useAutoSave';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';

interface EditorProps {
  noteId: string | null;
  title: string;
  content: string;
  isLocked: boolean;
  onContentChange?: (noteId: string, content: string) => void;
}

function Editor({ noteId, title, content, isLocked, onContentChange }: EditorProps) {
  const { save } = useAutoSave(500);
  const { save: saveTitle } = useAutoSave(500);
  const { updateNoteTitle, sessionUnlocked, verifyPassword, encryptionReady, lockNote, unlockNote } = useApp();
  const { theme } = useTheme();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);

  // Decrypted content for locked notes
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [loadingDecrypted, setLoadingDecrypted] = useState(false);

  // Keep initialContent stable per note to prevent @tinymce/tinymce-react from calling
  // setContent() when selectedNote.content updates in state (which resets the cursor).
  const initialContentRef = useRef(content);
  // Track the last known content to skip no-op saves (e.g. TinyMCE init events)
  const lastContentRef = useRef(content);
  const prevNoteIdRef = useRef(noteId);
  if (noteId !== prevNoteIdRef.current) {
    initialContentRef.current = content;
    lastContentRef.current = content;
    prevNoteIdRef.current = noteId;
    setLocalTitle(title);
    setDecryptedContent(null);
  }

  // Fetch decrypted content when a locked note is opened and session is unlocked
  useEffect(() => {
    if (!noteId || !isLocked || !sessionUnlocked) {
      setDecryptedContent(null);
      return;
    }
    let cancelled = false;
    setLoadingDecrypted(true);
    window.api.notes.getDecrypted(noteId).then((note) => {
      if (cancelled) return;
      if (note) {
        setDecryptedContent(note.content);
        initialContentRef.current = note.content;
        lastContentRef.current = note.content;
      }
      setLoadingDecrypted(false);
    });
    return () => { cancelled = true; };
  }, [noteId, isLocked, sessionUnlocked]);

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
      if (html === lastContentRef.current) return;
      lastContentRef.current = html;
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
      const exportContent = isLocked && decryptedContent ? decryptedContent : content;
      await window.api.export[format](title, exportContent);
    },
    [title, content, isLocked, decryptedContent],
  );

  const handleVerify = useCallback(
    async (password: string) => {
      return await verifyPassword(password);
    },
    [verifyPassword],
  );

  const handleLockToggle = useCallback(async () => {
    if (!noteId) return;
    if (isLocked) {
      await unlockNote(noteId);
    } else {
      await lockNote(noteId);
    }
  }, [noteId, isLocked, lockNote, unlockNote]);

  // Determine if we should show the password prompt
  const needsPassword = isLocked && !sessionUnlocked;
  // Determine the effective content for the editor
  const editorContent = isLocked ? (decryptedContent ?? '') : initialContentRef.current;

  return (
    <div className="flex-1 flex flex-col min-w-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Editor header with export button */}
      <div
        className="h-12 flex items-center justify-end px-4 gap-1 shrink-0 no-select"
        style={{ borderBottom: '1px solid var(--border-secondary)', WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {noteId && (
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Lock/unlock button */}
            {encryptionReady && sessionUnlocked && (
              <button
                onClick={handleLockToggle}
                className="p-1.5 rounded transition-colors hover:opacity-70"
                style={{ color: isLocked ? '#3b82f6' : 'var(--text-tertiary)' }}
                title={isLocked ? '移除加密' : '加密笔记'}
              >
                {isLocked ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}

            {/* Export button */}
            <div ref={menuRef} className="relative">
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
          </div>
        )}
      </div>

      {noteId ? (
        needsPassword ? (
          <PasswordPrompt onVerify={handleVerify} />
        ) : loadingDecrypted ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
            解密中...
          </div>
        ) : (
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
            <TinyMCEEditor key={`${noteId}-${theme}`} defaultValue={editorContent} onChange={handleChange} />
          </>
        )
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
