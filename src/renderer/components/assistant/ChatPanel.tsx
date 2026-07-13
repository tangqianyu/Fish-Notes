import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssistant, type UiMessage } from '../../contexts/AssistantContext';
import { useApp } from '../../contexts/AppContext';
import { message } from '../message';
import MarkdownPreview from '../editor/MarkdownPreview';
import {
  RobotIcon,
  NotesIcon,
  FileIcon,
  ClockIcon,
  TrashIcon,
  SendIcon,
  PlusIcon,
  CloseIcon,
  BookIcon,
} from '../icons';

const GEO_KEY = 'fish-notes:assistant-panel';
const MIN_W = 300;
const MIN_H = 360;

interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clampGeo(g: Geo): Geo {
  const w = Math.min(Math.max(MIN_W, g.w), window.innerWidth - 16);
  const h = Math.min(Math.max(MIN_H, g.h), window.innerHeight - 16);
  const x = Math.min(Math.max(8, g.x), window.innerWidth - w - 8);
  const y = Math.min(Math.max(8, g.y), window.innerHeight - h - 8);
  return { x, y, w, h };
}

function loadGeo(): Geo {
  try {
    const raw = localStorage.getItem(GEO_KEY);
    if (raw) return clampGeo(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  const w = 380;
  const h = 560;
  // default: docked bottom-right, just above the floating ball
  return clampGeo({ x: window.innerWidth - w - 24, y: window.innerHeight - h - 88, w, h });
}

function ThinkingBlock({ msg }: { msg: UiMessage }) {
  const { t } = useTranslation();
  // live while the model is still thinking (no answer text yet); collapsible afterwards
  const live = !!msg.streaming && !msg.content;
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // keep the live view pinned to the latest thought
  useEffect(() => {
    if (live && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [live, msg.thinking]);

  const tokens = msg.thinkingTokens ?? 0;
  const hasText = !!msg.thinking?.trim();
  if (!hasText && !tokens) return null;

  // some models (e.g. Opus 4.8 via CLI) redact thinking text and only report token
  // counts — show a live "thinking" indicator instead of an expandable transcript
  if (!hasText) {
    return (
      <div
        className={live ? 'fn-pulse' : undefined}
        style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}
      >
        {live ? t('Thinking…') : t('Thought for a while')} · ~{tokens} tokens
      </div>
    );
  }

  const open = live || expanded;
  return (
    <div style={{ maxWidth: '85%', marginBottom: 6 }}>
      <button
        onClick={() => !live && setExpanded((v) => !v)}
        className="flex items-center gap-1"
        style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: live ? 'default' : 'pointer' }}
      >
        <span
          style={{
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          ▸
        </span>
        {live ? t('Thinking…') : t('Thought process')}
      </button>
      {open && (
        <div
          ref={bodyRef}
          style={{
            marginTop: 4,
            padding: '6px 10px',
            borderLeft: '2px solid var(--border-primary)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-tertiary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: live ? 96 : 240,
            overflowY: 'auto',
          }}
        >
          {msg.thinking}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onSaveNote,
  onOpenNote,
}: {
  msg: UiMessage;
  onSaveNote?: (text: string) => void;
  onOpenNote?: (noteId: string) => void;
}) {
  const { t } = useTranslation();
  const isUser = msg.role === 'user';
  return (
    <div
      className="group flex flex-col"
      style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}
    >
      {!isUser && <ThinkingBlock msg={msg} />}
      <div
        style={{
          maxWidth: '85%',
          padding: isUser ? '8px 12px' : '6px 10px',
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.55,
          backgroundColor: isUser ? 'var(--bg-active)' : 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        ) : msg.content ? (
          <MarkdownPreview value={msg.content} />
        ) : msg.streaming ? (
          <span className="fn-typing" style={{ color: 'var(--text-tertiary)' }}>
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>
      {!isUser && !!msg.sources?.length && (
        <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 6, maxWidth: '85%' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('Sources')}</span>
          {msg.sources.map((src) => (
            <button
              key={src.id}
              onClick={() => onOpenNote?.(src.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full hover:opacity-80"
              style={{
                fontSize: 11,
                background: 'var(--tag-bg)',
                color: 'var(--tag-text)',
                maxWidth: 180,
              }}
              title={src.title}
            >
              <FileIcon size={10} />
              <span
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {src.title}
              </span>
            </button>
          ))}
        </div>
      )}
      {!isUser && !msg.streaming && msg.content.trim() && (
        <div
          className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ marginTop: 4, fontSize: 11 }}
        >
          <button
            onClick={() => {
              navigator.clipboard.writeText(msg.content);
              message.success(t('Copied'));
            }}
            style={{ color: 'var(--text-tertiary)' }}
          >
            ⧉ {t('Copy')}
          </button>
          {onSaveNote && (
            <button onClick={() => onSaveNote(msg.content)} style={{ color: 'var(--text-tertiary)' }}>
              <NotesIcon size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> {t('Save as note')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel() {
  const { t } = useTranslation();
  const {
    isOpen,
    close,
    chats,
    tabs,
    activeKey,
    activeTab,
    newTab,
    selectTab,
    closeTab,
    detachNote,
    selectChat,
    deleteChat,
    send,
    abort,
    toggleKb,
    saveAsNote,
    prefill,
    clearPrefill,
  } = useAssistant();
  const { state: appState, selectNote, setViewMode } = useApp();

  const openNote = useCallback(
    (noteId: string) => {
      if (appState.viewMode !== 'all') setViewMode('all');
      selectNote(noteId);
    },
    [appState.viewMode, setViewMode, selectNote],
  );

  const messages = activeTab?.messages ?? [];
  const boundNote = activeTab?.boundNote ?? null;
  const isStreaming = activeTab?.isStreaming ?? false;

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isFree = !boundNote;

  // reset composer text when switching tabs
  useEffect(() => {
    setInput('');
  }, [activeKey]);

  // adopt prefilled text (e.g. a quoted selection)
  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      clearPrefill();
      inputRef.current?.focus();
    }
  }, [prefill, clearPrefill]);

  // autoscroll on new content
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // auto-grow the composer height to fit its content (capped, then scrolls)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const submit = useCallback(() => {
    const text = input;
    if (!text.trim() || isStreaming) return;
    setInput('');
    send(text);
  }, [input, isStreaming, send]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Ignore Enter while an IME composition is active — pressing Enter to confirm a
    // candidate (e.g. an English word typed under a Chinese IME) must commit the text,
    // not send the message. keyCode 229 covers browsers that don't set isComposing.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // ---- geometry: drag (header) + resize (top-left handle) ----
  const [geo, setGeo] = useState<Geo>(loadGeo);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ l: number; t: number; r: number; b: number; dir: string } | null>(
    null,
  );

  useEffect(() => {
    const onResize = () => setGeo((g) => clampGeo(g));
    window.addEventListener('resize', onResize);
    // re-clamp once after mount in case the window size wasn't settled at init
    onResize();
    const raf = requestAnimationFrame(onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const persist = useCallback((g: Geo) => {
    localStorage.setItem(GEO_KEY, JSON.stringify(g));
  }, []);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return; // let header buttons work
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { dx: e.clientX - geo.x, dy: e.clientY - geo.y };
    },
    [geo],
  );
  const onHeaderPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setGeo((g) => clampGeo({ ...g, x: e.clientX - d.dx, y: e.clientY - d.dy }));
  }, []);
  const onHeaderPointerUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      setGeo((g) => {
        persist(g);
        return g;
      });
    }
  }, [persist]);

  const onResizePointerDown = useCallback(
    (dir: string) => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = { l: geo.x, t: geo.y, r: geo.x + geo.w, b: geo.y + geo.h, dir };
    },
    [geo],
  );
  const onResizePointerMove = useCallback((e: React.PointerEvent) => {
    const s = resizeRef.current;
    if (!s) return;
    let { l, t, r, b } = s;
    const { dir } = s;
    if (dir.includes('e')) r = Math.min(window.innerWidth - 8, Math.max(l + MIN_W, e.clientX));
    if (dir.includes('w')) l = Math.max(8, Math.min(r - MIN_W, e.clientX));
    if (dir.includes('s')) b = Math.min(window.innerHeight - 8, Math.max(t + MIN_H, e.clientY));
    if (dir.includes('n')) t = Math.max(8, Math.min(b - MIN_H, e.clientY));
    setGeo({ x: l, y: t, w: r - l, h: b - t });
  }, []);
  const onResizePointerUp = useCallback(() => {
    if (resizeRef.current) {
      resizeRef.current = null;
      setGeo((g) => {
        persist(g);
        return g;
      });
    }
  }, [persist]);

  if (!isOpen) return null;

  return (
    <div
      style={
        {
          position: 'fixed',
          left: geo.x,
          top: geo.y,
          width: geo.w,
          height: geo.h,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
          // opt out of the macOS title-bar drag region so buttons stay clickable
          // even when the panel is dragged over the top bar
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties
      }
    >
      {/* Resize handles: 4 edges + 4 corners */}
      <ResizeHandles
        onDown={onResizePointerDown}
        onMove={onResizePointerMove}
        onUp={onResizePointerUp}
      />

      {/* Header (drag handle) */}
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{
          borderBottom: '1px solid var(--border-primary)',
          cursor: 'move',
          touchAction: 'none',
        }}
      >
        <span style={{ display: 'inline-flex', color: 'var(--accent-solid)' }}>
          <RobotIcon size={16} />
        </span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
          {t('Fish Assistant')}
        </span>
        <HeaderBtn title={t('New chat')} onClick={newTab}>
          <PlusIcon size={14} />
        </HeaderBtn>
        <HeaderBtn title={t('History')} onClick={() => setShowHistory((v) => !v)}>
          <ClockIcon size={14} />
        </HeaderBtn>
        {isFree && messages.length > 0 && (
          <HeaderBtn
            title={t('Save conversation as note')}
            onClick={() => saveAsNote(formatTranscript(messages))}
          >
            <NotesIcon size={14} />
          </HeaderBtn>
        )}
        <HeaderBtn title={t('Close')} onClick={close}>
          <CloseIcon size={14} />
        </HeaderBtn>
      </div>

      {/* Tab strip */}
      {tabs.length > 0 && (
        <div
          className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto shrink-0"
          style={{ borderBottom: '1px solid var(--border-secondary)' }}
        >
          {tabs.map((tb) => {
            const active = tb.key === activeKey;
            return (
              <div
                key={tb.key}
                onClick={() => selectTab(tb.key)}
                className="group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer shrink-0"
                style={{
                  maxWidth: 140,
                  fontSize: 12,
                  backgroundColor: active ? 'var(--bg-active)' : 'var(--bg-secondary)',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {tb.boundNote && (
                  <span style={{ display: 'inline-flex' }}>
                    <FileIcon size={12} />
                  </span>
                )}
                {tb.isStreaming && <span>•</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tb.title || (tb.boundNote ? tb.boundNote.title : t('New chat'))}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tb.key);
                  }}
                  className="opacity-60 hover:opacity-100"
                  style={{ marginLeft: 2 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Context chip: only when this conversation is bound to a note */}
      {boundNote && (
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--border-secondary)' }}
        >
          <span
            className="flex items-center gap-1.5 rounded-md px-2 py-1"
            style={{ backgroundColor: 'var(--bg-tertiary)', fontSize: 12, maxWidth: '100%' }}
          >
            <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)' }}>
              <FileIcon size={13} />
            </span>
            <span
              style={{
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {boundNote.title || t('Untitled')}
            </span>
            <button
              onClick={detachNote}
              title={t('Detach note')}
              style={{ color: 'var(--text-tertiary)', marginLeft: 2 }}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* Body: history or messages */}
      {showHistory ? (
        <HistoryList
          chats={chats}
          currentChatId={activeTab?.chatId ?? null}
          onSelect={(id) => {
            selectChat(id);
            setShowHistory(false);
          }}
          onDelete={deleteChat}
        />
      ) : !activeTab ? (
        <NoTabState onNew={newTab} />
      ) : (
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3">
          {messages.length === 0 ? (
            <EmptyState bound={!!boundNote} onPick={(text) => send(text)} />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                onSaveNote={isFree ? (text) => saveAsNote(text) : undefined}
                onOpenNote={openNote}
              />
            ))
          )}
        </div>
      )}

      {/* Composer (only when a conversation is open) */}
      {activeTab && (
      <div className="px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div
          className="flex items-end gap-2 rounded-lg px-2 py-1.5"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          {isFree && (
            <button
              onClick={toggleKb}
              title={t('Ask my notes')}
              className="flex items-center justify-center rounded shrink-0 transition-colors"
              style={{
                width: 24,
                height: 24,
                marginBottom: 1,
                background: activeTab?.useKb ? 'var(--accent-soft-bg)' : 'transparent',
                color: activeTab?.useKb ? 'var(--accent-solid)' : 'var(--text-tertiary)',
              }}
            >
              <BookIcon size={15} />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              boundNote
                ? t('Ask about this note…')
                : activeTab?.useKb
                  ? t('Ask your notes…')
                  : t('Ask anything…')
            }
            className="flex-1 resize-none outline-none bg-transparent text-sm"
            style={{ color: 'var(--text-primary)', maxHeight: 120, overflowY: 'auto' }}
          />
          {isStreaming ? (
            <button
              onClick={abort}
              title={t('Stop')}
              style={{ color: '#ef4444', fontSize: 16, lineHeight: 1 }}
            >
              ■
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              title={t('Send')}
              style={{ color: input.trim() ? 'var(--text-active)' : 'var(--text-tertiary)', fontSize: 16 }}
            >
              <SendIcon size={16} />
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function NoTabState({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
      <div style={{ color: 'var(--accent-solid)', display: 'inline-flex' }}>
        <RobotIcon size={34} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {t('No conversation yet')}
      </div>
      <button
        onClick={onNew}
        className="fn-accent-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: 'var(--accent-bg)',
          color: 'var(--accent-fg)',
          boxShadow: 'var(--accent-shadow)',
        }}
      >
        <PlusIcon size={13} />
        {t('New chat')}
      </button>
    </div>
  );
}

function ResizeHandles({
  onDown,
  onMove,
  onUp,
}: {
  onDown: (dir: string) => (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
}) {
  const T = 8; // edge thickness / corner size
  const handles: { dir: string; style: React.CSSProperties; cursor: string }[] = [
    { dir: 'n', style: { top: 0, left: T, right: T, height: T }, cursor: 'ns-resize' },
    { dir: 's', style: { bottom: 0, left: T, right: T, height: T }, cursor: 'ns-resize' },
    { dir: 'w', style: { left: 0, top: T, bottom: T, width: T }, cursor: 'ew-resize' },
    { dir: 'e', style: { right: 0, top: T, bottom: T, width: T }, cursor: 'ew-resize' },
    { dir: 'nw', style: { top: 0, left: 0, width: T, height: T }, cursor: 'nwse-resize' },
    { dir: 'se', style: { bottom: 0, right: 0, width: T, height: T }, cursor: 'nwse-resize' },
    { dir: 'ne', style: { top: 0, right: 0, width: T, height: T }, cursor: 'nesw-resize' },
    { dir: 'sw', style: { bottom: 0, left: 0, width: T, height: T }, cursor: 'nesw-resize' },
  ];
  return (
    <>
      {handles.map((h) => (
        <div
          key={h.dir}
          onPointerDown={onDown(h.dir)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          style={{
            position: 'absolute',
            zIndex: 3,
            touchAction: 'none',
            cursor: h.cursor,
            ...h.style,
          }}
        />
      ))}
    </>
  );
}

function HeaderBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded hover:opacity-70 transition-opacity flex items-center justify-center"
      style={{ width: 22, height: 22, color: 'var(--text-secondary)' }}
    >
      {children}
    </button>
  );
}

function EmptyState({ bound, onPick }: { bound: boolean; onPick: (text: string) => void }) {
  const { t } = useTranslation();
  const chip = {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  } as const;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3">
      <div style={{ color: 'var(--accent-solid)', display: 'inline-flex' }}>
        <RobotIcon size={34} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {bound ? t('Ask me anything about this note') : t('Hi, I am Fish — your note assistant')}
      </div>
      <div className="flex flex-wrap gap-2 justify-center" style={{ maxWidth: 280 }}>
        {bound ? (
          <>
            <button style={chip} onClick={() => onPick(t('Summarize the key points of this note'))}>
              {t('Summarize this note')}
            </button>
            <button style={chip} onClick={() => onPick(t('Extract the action items from this note'))}>
              {t('Extract action items')}
            </button>
          </>
        ) : (
          <button style={chip} onClick={() => onPick(t('Help me brainstorm some ideas'))}>
            {t('Brainstorm ideas')}
          </button>
        )}
      </div>
    </div>
  );
}

function HistoryList({
  chats,
  currentChatId,
  onSelect,
  onDelete,
}: {
  chats: ChatData[];
  currentChatId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {chats.length === 0 ? (
        <div className="text-center text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 24 }}>
          {t('No conversations yet')}
        </div>
      ) : (
        chats.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: c.id === currentChatId ? 'var(--bg-active)' : 'transparent',
            }}
            onClick={() => onSelect(c.id)}
          >
            <span
              className="flex-1 text-sm"
              style={{
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {c.title || t('Untitled')}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded shrink-0"
              style={{ width: 22, height: 22, color: 'var(--text-tertiary)' }}
            >
              <TrashIcon size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function formatTranscript(messages: UiMessage[]): string {
  return messages
    .filter((m) => m.content.trim())
    .map((m) => (m.role === 'user' ? `**我：** ${m.content}` : m.content))
    .join('\n\n---\n\n');
}
