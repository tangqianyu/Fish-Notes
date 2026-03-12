import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import NoteList from './NoteList';
import Editor from './Editor';
import SearchBar from './SearchBar';
import Settings from './Settings';
import { useApp } from '../contexts/AppContext';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 350;
const NOTELIST_MIN = 200;
const NOTELIST_MAX = 450;

function Layout() {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [noteListWidth, setNoteListWidth] = useState(280);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  const noteListWidthRef = useRef(noteListWidth);

  const { state, updateNoteContent, createNote } = useApp();
  const { notes, selectedNoteId } = state;

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const openSearch = useCallback(() => setShowSearch(true), []);
  const closeSearch = useCallback(() => setShowSearch(false), []);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        createNote();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNote]);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarWidthRef.current = sidebarWidth;
    const startX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, sidebarWidthRef.current + moveEvent.clientX - startX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleNoteListMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    noteListWidthRef.current = noteListWidth;
    const startX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(NOTELIST_MIN, Math.min(NOTELIST_MAX, noteListWidthRef.current + moveEvent.clientX - startX));
      setNoteListWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        width={sidebarWidth}
        onResizeStart={handleSidebarMouseDown}
        onSearchClick={openSearch}
        onSettingsClick={openSettings}
      />
      <NoteList width={noteListWidth} onResizeStart={handleNoteListMouseDown} />
      <Editor
        noteId={selectedNote?.id ?? null}
        title={selectedNote?.title ?? ''}
        content={selectedNote?.content ?? ''}
        onContentChange={updateNoteContent}
      />
      {showSearch && <SearchBar onClose={closeSearch} />}
      {showSettings && <Settings onClose={closeSettings} />}
    </div>
  );
}

export default Layout;
