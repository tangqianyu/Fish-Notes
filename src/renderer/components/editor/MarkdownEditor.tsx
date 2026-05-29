import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import CodeMirrorView, { type CodeMirrorHandle } from './CodeMirrorView';
import MarkdownPreview from './MarkdownPreview';
import EditorToolbar from './EditorToolbar';
import type { AppTheme } from './extensions/themes';

export type EditorMode = 'source' | 'preview' | 'split';

interface MarkdownEditorProps {
  defaultValue: string;
  onChange?: (markdown: string) => void;
  onSave?: () => void;
  showToolbar?: boolean;
}

const MODE_STORAGE_KEY = 'fish-notes:editor-mode';
const TOOLBAR_STORAGE_KEY = 'fish-notes:editor-toolbar';

function readMode(): EditorMode {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === 'source' || stored === 'preview' || stored === 'split') return stored;
  return 'source';
}

function readToolbar(): boolean {
  const stored = localStorage.getItem(TOOLBAR_STORAGE_KEY);
  return stored === null ? true : stored === '1';
}

interface TabButtonProps {
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, shortcut, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 text-xs rounded transition-colors"
      style={{
        color: active ? 'var(--text-active)' : 'var(--text-tertiary)',
        backgroundColor: active ? 'var(--bg-active)' : 'transparent',
        fontWeight: active ? 600 : 500,
      }}
      title={`${label} (${shortcut})`}
    >
      {label}
    </button>
  );
}

export default function MarkdownEditor({
  defaultValue,
  onChange,
  onSave,
  showToolbar: showToolbarProp,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mode, setMode] = useState<EditorMode>(readMode);
  const [content, setContent] = useState(defaultValue);
  const [toolbarVisible] = useState(readToolbar);
  const editorRef = useRef<CodeMirrorHandle>(null);
  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  const showToolbar = showToolbarProp ?? toolbarVisible;

  const updateMode = useCallback((next: EditorMode) => {
    setMode(next);
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '1') {
        e.preventDefault();
        updateMode('source');
      } else if (e.key === '2') {
        e.preventDefault();
        updateMode('preview');
      } else if (e.key === '3') {
        e.preventDefault();
        updateMode('split');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [updateMode]);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      onChange?.(value);
    },
    [onChange],
  );

  const getView = useCallback(() => editorRef.current?.view ?? null, []);

  const syncScroll = useCallback((source: 'editor' | 'preview') => {
    if (isScrollingSyncRef.current) return;
    if (mode !== 'split') return;
    const editorScroller = editorRef.current?.view?.scrollDOM;
    const previewScroller = previewScrollRef.current;
    if (!editorScroller || !previewScroller) return;

    isScrollingSyncRef.current = true;
    if (source === 'editor') {
      const ratio =
        editorScroller.scrollTop /
        Math.max(1, editorScroller.scrollHeight - editorScroller.clientHeight);
      previewScroller.scrollTop =
        ratio * (previewScroller.scrollHeight - previewScroller.clientHeight);
    } else {
      const ratio =
        previewScroller.scrollTop /
        Math.max(1, previewScroller.scrollHeight - previewScroller.clientHeight);
      editorScroller.scrollTop =
        ratio * (editorScroller.scrollHeight - editorScroller.clientHeight);
    }
    requestAnimationFrame(() => {
      isScrollingSyncRef.current = false;
    });
  }, [mode]);

  useEffect(() => {
    if (mode !== 'split') return;
    const editorScroller = editorRef.current?.view?.scrollDOM;
    const previewScroller = previewScrollRef.current;
    if (!editorScroller || !previewScroller) return;
    const onEditor = () => syncScroll('editor');
    const onPreview = () => syncScroll('preview');
    editorScroller.addEventListener('scroll', onEditor);
    previewScroller.addEventListener('scroll', onPreview);
    return () => {
      editorScroller.removeEventListener('scroll', onEditor);
      previewScroller.removeEventListener('scroll', onPreview);
    };
  }, [mode, syncScroll]);

  const themeKey: AppTheme = (theme as AppTheme) ?? 'light';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        className="flex items-center gap-1 px-2 py-1 shrink-0 no-select"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-secondary)',
        }}
      >
        <TabButton label="MD" shortcut="⌘1" active={mode === 'source'} onClick={() => updateMode('source')} />
        <TabButton label={t('Preview')} shortcut="⌘2" active={mode === 'preview'} onClick={() => updateMode('preview')} />
        <TabButton label={t('Split')} shortcut="⌘3" active={mode === 'split'} onClick={() => updateMode('split')} />
      </div>

      {showToolbar && mode !== 'preview' && <EditorToolbar getView={getView} />}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          ref={sourceScrollRef}
          className="flex-1 min-w-0 overflow-hidden"
          style={{
            display: mode === 'preview' ? 'none' : 'flex',
            flexDirection: 'column',
            borderRight: mode === 'split' ? '1px solid var(--border-secondary)' : 'none',
          }}
        >
          <CodeMirrorView
            ref={editorRef}
            defaultValue={defaultValue}
            onChange={handleChange}
            onSave={onSave}
            theme={themeKey}
            className="h-full"
          />
        </div>
        <div
          ref={previewScrollRef}
          className="flex-1 min-w-0 overflow-auto px-6 py-4"
          style={{
            display: mode === 'source' ? 'none' : 'block',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <MarkdownPreview value={content} />
        </div>
      </div>
    </div>
  );
}
