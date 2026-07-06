import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from './AppContext';
import { message } from '../components/message';

export interface BoundNote {
  id: string;
  title: string;
}

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** live extended-thinking text (display only, not persisted) */
  thinking?: string;
  /** approx. thinking tokens — some models redact thinking text and only report counts */
  thinkingTokens?: number;
  /** notes retrieved for a knowledge-base answer (display only, not persisted) */
  sources?: { id: string; title: string }[];
  streaming?: boolean;
  noteId?: string | null;
}

export interface Tab {
  key: string;
  chatId: string | null;
  title: string;
  boundNote: BoundNote | null;
  messages: UiMessage[];
  isStreaming: boolean;
  /** "ask my notes" mode — retrieve from the whole note library before answering */
  useKb: boolean;
}

interface AssistantContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** any tab currently streaming — drives the floating-ball indicator */
  isStreaming: boolean;

  // tabs
  tabs: Tab[];
  activeKey: string;
  /** null when no conversation is open (initial state) */
  activeTab: Tab | null;
  newTab: () => void;
  selectTab: (key: string) => void;
  closeTab: (key: string) => void;

  // active-tab conversation
  send: (text: string) => Promise<void>;
  abort: () => void;
  detachNote: () => void;
  /** toggle knowledge-base mode on the active tab */
  toggleKb: () => void;
  saveAsNote: (markdown: string) => Promise<void>;

  // entry points
  askWithSelection: (snippet: string) => void;
  askAboutNote: (note: BoundNote) => void;

  // history (persisted chats)
  chats: ChatData[];
  selectChat: (id: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;

  // composer prefill (quoted selection)
  prefill: string;
  clearPrefill: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

const AI_TAG = 'AI对话';

function genId(): string {
  return crypto.randomUUID();
}

function freshTab(boundNote: BoundNote | null = null): Tab {
  return {
    key: genId(),
    chatId: null,
    title: '',
    boundNote,
    messages: [],
    isStreaming: false,
    useKb: false,
  };
}

interface StreamEntry {
  tabKey: string;
  chatId: string;
  assistantId: string;
  /** full text received from the model so far */
  acc: string;
  /** how many chars of `acc` are currently shown (typewriter smoothing) */
  revealed: number;
  /** stream finished; reveal loop drains the backlog then cleans up */
  done?: boolean;
  timer?: number;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state, refreshNotes, refreshTags } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  // starts with NO tab — a conversation only exists after the user opens one
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [chats, setChats] = useState<ChatData[]>([]);
  const [prefill, setPrefill] = useState<string>('');

  // refs for synchronous reads inside IPC listeners / send
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;
  const activeKeyRef = useRef<string>(activeKey);
  activeKeyRef.current = activeKey;
  // requestId -> live stream bookkeeping (synchronous, race-free)
  const streams = useRef<Map<string, StreamEntry>>(new Map());

  const activeTab = tabs.find((tb) => tb.key === activeKey) ?? null;

  // helpers
  const patchTab = useCallback((key: string, patch: (tb: Tab) => Tab) => {
    setTabs((prev) => prev.map((tb) => (tb.key === key ? patch(tb) : tb)));
  }, []);

  useEffect(() => {
    window.api.chats.list().then(setChats);
  }, []);

  // global stream listeners (route by requestId via the streams map)
  useEffect(() => {
    // Typewriter smoothing: the CLI delivers ~0.5s bursts of 10–30 chars. Instead of
    // pasting each burst, buffer into `acc` and reveal a few chars per tick — the
    // backlog-proportional step keeps latency bounded while looking smooth.
    const REVEAL_MS = 24;
    const startReveal = (requestId: string) => {
      const entry = streams.current.get(requestId);
      if (!entry || entry.timer != null) return;
      entry.timer = window.setInterval(() => {
        const cur = streams.current.get(requestId);
        if (!cur) return;
        const backlog = cur.acc.length - cur.revealed;
        if (backlog > 0) {
          cur.revealed = Math.min(
            cur.acc.length,
            cur.revealed + Math.max(1, Math.ceil(backlog / 24)),
          );
          const shown = cur.acc.slice(0, cur.revealed);
          patchTab(cur.tabKey, (tb) => ({
            ...tb,
            messages: tb.messages.map((m) =>
              m.id === cur.assistantId ? { ...m, content: shown } : m,
            ),
          }));
        } else if (cur.done) {
          if (cur.timer != null) window.clearInterval(cur.timer);
          streams.current.delete(requestId);
          const content = cur.acc.trim();
          patchTab(cur.tabKey, (tb) => ({
            ...tb,
            isStreaming: false,
            messages: tb.messages
              .map((m) => (m.id === cur.assistantId ? { ...m, content, streaming: false } : m))
              .filter((m) => !(m.id === cur.assistantId && !content)),
          }));
        }
      }, REVEAL_MS);
    };

    const offChunk = window.api.ai.onChatChunk(({ requestId, delta }) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      s.acc += delta;
      startReveal(requestId);
    });

    const offSources = window.api.ai.onChatSources(({ requestId, sources }) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      patchTab(s.tabKey, (tb) => ({
        ...tb,
        messages: tb.messages.map((m) => (m.id === s.assistantId ? { ...m, sources } : m)),
      }));
    });

    const offThinking = window.api.ai.onChatThinking(({ requestId, delta, tokens }) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      patchTab(s.tabKey, (tb) => ({
        ...tb,
        messages: tb.messages.map((m) =>
          m.id === s.assistantId
            ? {
                ...m,
                thinking: (m.thinking ?? '') + delta,
                thinkingTokens: (m.thinkingTokens ?? 0) + (tokens ?? 0),
              }
            : m,
        ),
      }));
    });

    // persistence happens OUTSIDE the setState updater (StrictMode double-invokes
    // updaters; that previously duplicated DB rows).
    const finalize = (requestId: string, fullText?: string) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      // fallback path (no partial events): the result carries the whole text
      if (fullText && fullText.trim().length > s.acc.trim().length) s.acc = fullText;
      s.done = true;
      const content = s.acc.trim();
      if (content) window.api.chats.addMessage(s.chatId, 'assistant', content);
      // let the reveal loop drain the backlog, then it cleans up UI state
      startReveal(requestId);
    };

    const offDone = window.api.ai.onChatDone(({ requestId, fullText }) =>
      finalize(requestId, fullText || undefined),
    );
    const offError = window.api.ai.onChatError(({ requestId, message: msg }) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      if (s.timer != null) window.clearInterval(s.timer);
      streams.current.delete(requestId);
      const content = s.acc.trim();
      patchTab(s.tabKey, (tb) => ({
        ...tb,
        isStreaming: false,
        messages: tb.messages
          .map((m) => (m.id === s.assistantId ? { ...m, content, streaming: false } : m))
          .filter((m) => !(m.id === s.assistantId && !content)),
      }));
      message.error(msg);
    });

    const streamsAtMount = streams.current;
    return () => {
      offChunk();
      offSources();
      offThinking();
      offDone();
      offError();
      for (const s of streamsAtMount.values()) {
        if (s.timer != null) window.clearInterval(s.timer);
      }
    };
  }, [patchTab]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // ---- tabs ----
  const newTab = useCallback(() => {
    const tab = freshTab();
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
    setPrefill('');
  }, []);

  const selectTab = useCallback((key: string) => setActiveKey(key), []);

  const closeTab = useCallback((key: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((tb) => tb.key === key);
      if (idx === -1) return prev;
      const next = prev.filter((tb) => tb.key !== key);
      if (next.length === 0) {
        setActiveKey('');
        return [];
      }
      // if closing the active tab, focus a neighbour
      setActiveKey((cur) => (cur === key ? next[Math.max(0, idx - 1)].key : cur));
      return next;
    });
  }, []);

  // ---- send / abort ----
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const key = activeKeyRef.current;
      const tab = tabsRef.current.find((tb) => tb.key === key);
      if (!trimmed || !tab || tab.isStreaming) return;

      // ensure a persisted chat exists for this tab
      let chatId = tab.chatId;
      if (!chatId) {
        const chat = await window.api.chats.create(trimmed.slice(0, 24));
        chatId = chat.id;
        patchTab(key, (tb) => ({ ...tb, chatId: chat.id, title: chat.title }));
        setChats((prev) => [chat, ...prev]);
      } else if (!tab.title) {
        patchTab(key, (tb) => ({ ...tb, title: trimmed.slice(0, 24) }));
      }

      // resolve bound-note context
      let noteContext: string | undefined;
      let noteId: string | null = null;
      if (tab.boundNote) {
        const bound = tab.boundNote;
        const note = state.notes.find((n) => n.id === bound.id);
        noteId = bound.id;
        if (note?.isLocked) {
          const dec = await window.api.notes.getDecrypted(note.id);
          noteContext = dec?.content || undefined;
        } else {
          noteContext = note?.content || undefined;
        }
        if (!noteContext) {
          message.warning(
            note?.isLocked ? t('Unlock this note first to ask about it') : t('This note is empty'),
          );
          return;
        }
      }

      const userMsg: UiMessage = { id: genId(), role: 'user', content: trimmed, noteId };
      const assistantMsg: UiMessage = { id: genId(), role: 'assistant', content: '', streaming: true };
      const history = [...tab.messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

      patchTab(key, (tb) => ({
        ...tb,
        isStreaming: true,
        messages: [...tb.messages, userMsg, assistantMsg],
      }));
      setPrefill('');

      await window.api.chats.addMessage(chatId, 'user', trimmed, noteId);
      window.api.chats.list().then(setChats);

      const requestId = genId();
      streams.current.set(requestId, {
        tabKey: key,
        chatId,
        assistantId: assistantMsg.id,
        acc: '',
        revealed: 0,
      });
      window.api.ai.chatStream({
        requestId,
        messages: history,
        noteContext,
        scope: !tab.boundNote && tab.useKb ? 'notes' : undefined,
      });
    },
    [patchTab, state.notes, t],
  );

  const abort = useCallback(() => {
    const key = activeKeyRef.current;
    let entry: [string, StreamEntry] | undefined;
    for (const e of streams.current.entries()) {
      if (e[1].tabKey === key) {
        entry = e;
        break;
      }
    }
    if (!entry) return;
    const [requestId, s] = entry;
    window.api.ai.abortChat(requestId);
    if (s.timer != null) window.clearInterval(s.timer);
    streams.current.delete(requestId);
    const content = s.acc.trim();
    if (content) window.api.chats.addMessage(s.chatId, 'assistant', content);
    patchTab(key, (tb) => ({
      ...tb,
      isStreaming: false,
      messages: tb.messages
        .map((m) => (m.id === s.assistantId ? { ...m, content, streaming: false } : m))
        .filter((m) => !(m.id === s.assistantId && !content)),
    }));
  }, [patchTab]);

  const detachNote = useCallback(() => {
    patchTab(activeKeyRef.current, (tb) => ({ ...tb, boundNote: null }));
  }, [patchTab]);

  const toggleKb = useCallback(() => {
    patchTab(activeKeyRef.current, (tb) => (tb.boundNote ? tb : { ...tb, useKb: !tb.useKb }));
  }, [patchTab]);

  const saveAsNote = useCallback(
    async (markdown: string) => {
      const body = markdown.trim();
      if (!body) return;
      const note = await window.api.notes.create();
      const tab = tabsRef.current.find((tb) => tb.key === activeKeyRef.current);
      const title = tab?.title?.trim() || body.split('\n')[0].slice(0, 30);
      const contentText = body.replace(/[#*`>\-[\]()!]/g, '').trim();
      await window.api.notes.update(note.id, { title, content: body, contentText });
      await window.api.tags.setNoteTags(note.id, [AI_TAG]);
      await refreshNotes();
      await refreshTags();
      message.success(t('Saved as note'));
    },
    [refreshNotes, refreshTags, t],
  );

  // ---- entry points ----
  const askWithSelection = useCallback((snippet: string) => {
    const tab = freshTab(null);
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
    setPrefill(`> ${snippet.replace(/\n/g, '\n> ')}\n\n`);
    setIsOpen(true);
  }, []);

  const askAboutNote = useCallback((note: BoundNote) => {
    const tab = freshTab(note);
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
    setPrefill('');
    setIsOpen(true);
  }, []);

  // ---- history ----
  const selectChat = useCallback(
    async (id: string) => {
      // focus an already-open tab if present
      const existing = tabsRef.current.find((tb) => tb.chatId === id);
      if (existing) {
        setActiveKey(existing.key);
        return;
      }
      const msgs = await window.api.chats.getMessages(id);
      const boundId = msgs.find((m) => m.noteId)?.noteId;
      let boundNote: BoundNote | null = null;
      if (boundId) {
        const note = state.notes.find((n) => n.id === boundId);
        boundNote = note ? { id: note.id, title: note.title || t('Untitled') } : null;
      }
      const tab: Tab = {
        key: genId(),
        chatId: id,
        title: chats.find((c) => c.id === id)?.title || '',
        boundNote,
        messages: msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          noteId: m.noteId,
        })),
        isStreaming: false,
        useKb: false,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveKey(tab.key);
    },
    [chats, state.notes, t],
  );

  const deleteChat = useCallback(
    async (id: string) => {
      await window.api.chats.delete(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      // close any open tab backed by this chat
      setTabs((prev) => {
        const next = prev.filter((tb) => tb.chatId !== id);
        if (next.length === 0) {
          setActiveKey('');
          return [];
        }
        setActiveKey((cur) => (prev.find((tb) => tb.chatId === id)?.key === cur ? next[0].key : cur));
        return next;
      });
    },
    [],
  );

  const clearPrefill = useCallback(() => setPrefill(''), []);

  const isStreaming = tabs.some((tb) => tb.isStreaming);

  const value = useMemo<AssistantContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      isStreaming,
      tabs,
      activeKey,
      activeTab,
      newTab,
      selectTab,
      closeTab,
      send,
      abort,
      detachNote,
      toggleKb,
      saveAsNote,
      askWithSelection,
      askAboutNote,
      chats,
      selectChat,
      deleteChat,
      prefill,
      clearPrefill,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      isStreaming,
      tabs,
      activeKey,
      activeTab,
      newTab,
      selectTab,
      closeTab,
      send,
      abort,
      detachNote,
      toggleKb,
      saveAsNote,
      askWithSelection,
      askAboutNote,
      chats,
      selectChat,
      deleteChat,
      prefill,
      clearPrefill,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}
