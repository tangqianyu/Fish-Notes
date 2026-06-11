import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import CodeMirrorView, { type CodeMirrorHandle, type PolishSelectionInfo } from './CodeMirrorView';
import MarkdownPreview from './MarkdownPreview';
import EditorToolbar from './EditorToolbar';
import PolishDialog from './PolishDialog';
import type { AppTheme } from './extensions/themes';
import { useAssistant } from '../../contexts/AssistantContext';

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
  const { askWithSelection } = useAssistant();
  const [mode, setMode] = useState<EditorMode>(readMode);
  const [content, setContent] = useState(defaultValue);
  const [toolbarVisible] = useState(readToolbar);
  const editorRef = useRef<CodeMirrorHandle>(null);
  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  const showToolbar = showToolbarProp ?? toolbarVisible;

  // Polish bubble state
  const [polishSel, setPolishSel] = useState<PolishSelectionInfo | null>(null);
  const [bubblePos, setBubblePos] = useState<{
    top: number;
    left: number;
    placement: 'above' | 'below';
  } | null>(null);
  const [polishDialog, setPolishDialog] = useState<{
    from: number;
    to: number;
    original: string;
    polished: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  // Recompute bubble position whenever selection changes or editor scrolls/resizes.
  useEffect(() => {
    if (!polishSel) {
      setBubblePos(null);
      return;
    }
    const view = editorRef.current?.view;
    if (!view) return;

    const update = () => {
      const v = editorRef.current?.view;
      if (!v) return;
      const startCoords = v.coordsAtPos(polishSel.from);
      const endCoords = v.coordsAtPos(polishSel.to);
      if (!startCoords || !endCoords) {
        setBubblePos(null);
        return;
      }
      // Clip horizontal anchor inside the editor's visible rect — when the selection
      // spans many lines, end is on a different line and using its left/right blindly
      // would yank the bubble off to the side.
      const editorRect = v.dom.getBoundingClientRect();
      const anchorTop = Math.min(startCoords.top, endCoords.top);
      const anchorBottom = Math.max(startCoords.bottom, endCoords.bottom);
      const sameLine = Math.abs(startCoords.top - endCoords.top) < 4;
      const left = sameLine
        ? (startCoords.left + endCoords.right) / 2
        : (editorRect.left + editorRect.right) / 2;
      // Flip below when not enough room above (e.g. toolbar covers the top).
      const BUBBLE_SAFE = 44;
      const placement: 'above' | 'below' =
        anchorTop - BUBBLE_SAFE < editorRect.top ? 'below' : 'above';
      const top = placement === 'above' ? anchorTop - 8 : anchorBottom + 8;
      setBubblePos({ top, left, placement });
    };

    update();
    const scroller = view.scrollDOM;
    scroller.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [polishSel]);

  const runPolish = useCallback(async (info: { from: number; to: number; text: string }) => {
    setPolishDialog({
      from: info.from,
      to: info.to,
      original: info.text,
      polished: null,
      loading: true,
      error: null,
    });
    try {
      const polished = await window.api.ai.polishText(info.text);
      setPolishDialog((d) => (d ? { ...d, polished, loading: false } : d));
    } catch (e) {
      setPolishDialog((d) =>
        d ? { ...d, loading: false, error: e instanceof Error ? e.message : String(e) } : d,
      );
    }
  }, []);

  const handlePolishClick = useCallback(() => {
    if (!polishSel) return;
    const captured = polishSel;
    setPolishSel(null);
    setBubblePos(null);
    runPolish(captured);
  }, [polishSel, runPolish]);

  const handleApplyPolish = useCallback(
    (polishedText: string) => {
      const view = editorRef.current?.view;
      const dialog = polishDialog;
      if (!view || !dialog) {
        setPolishDialog(null);
        return;
      }
      // Replace the original range with polished text.
      view.dispatch({
        changes: { from: dialog.from, to: dialog.to, insert: polishedText },
        selection: { anchor: dialog.from + polishedText.length },
      });
      view.focus();
      setPolishDialog(null);
    },
    [polishDialog],
  );

  const handleRetryPolish = useCallback(() => {
    if (!polishDialog) return;
    runPolish({ from: polishDialog.from, to: polishDialog.to, text: polishDialog.original });
  }, [polishDialog, runPolish]);

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

  const syncScroll = useCallback(
    (source: 'editor' | 'preview') => {
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
    },
    [mode],
  );

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
        <TabButton
          label="MD"
          shortcut="⌘1"
          active={mode === 'source'}
          onClick={() => updateMode('source')}
        />
        <TabButton
          label={t('Preview')}
          shortcut="⌘2"
          active={mode === 'preview'}
          onClick={() => updateMode('preview')}
        />
        <TabButton
          label={t('Split')}
          shortcut="⌘3"
          active={mode === 'split'}
          onClick={() => updateMode('split')}
        />
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
            onPolishSelection={setPolishSel}
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

      {polishSel &&
        bubblePos &&
        createPortal(
          <div
            className="fixed z-[9999] flex items-center gap-1.5"
            style={{
              top: bubblePos.top,
              left: bubblePos.left,
              transform:
                bubblePos.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
          >
            <button
              type="button"
              onMouseDown={(e) => {
                // Prevent the editor from losing selection before our click handler fires.
                e.preventDefault();
              }}
              onClick={handlePolishClick}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg text-xs font-medium transition-transform hover:scale-105"
              style={{ backgroundColor: '#f97316', color: 'white' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
              {t('AI polish')}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const text = polishSel.text;
                setPolishSel(null);
                askWithSelection(text);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg text-xs font-medium transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              🐟 {t('Ask Fish about selection')}
            </button>
          </div>,
          document.body,
        )}

      {polishDialog && (
        <PolishDialog
          loading={polishDialog.loading}
          error={polishDialog.error}
          original={polishDialog.original}
          polished={polishDialog.polished}
          onAccept={handleApplyPolish}
          onClose={() => setPolishDialog(null)}
          onRetry={handleRetryPolish}
        />
      )}
    </div>
  );
}
