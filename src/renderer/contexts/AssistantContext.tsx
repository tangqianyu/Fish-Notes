import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
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
  activeTab: Tab;
  newTab: () => void;
  selectTab: (key: string) => void;
  closeTab: (key: string) => void;

  // active-tab conversation
  send: (text: string) => Promise<void>;
  abort: () => void;
  detachNote: () => void;
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
  return { key: genId(), chatId: null, title: '', boundNote, messages: [], isStreaming: false };
}

interface StreamEntry {
  tabKey: string;
  chatId: string;
  assistantId: string;
  acc: string;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state, refreshNotes, refreshTags } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(() => [freshTab()]);
  const [activeKey, setActiveKey] = useState<string>(() => tabs[0]?.key);
  const [chats, setChats] = useState<ChatData[]>([]);
  const [prefill, setPrefill] = useState<string>('');

  // refs for synchronous reads inside IPC listeners / send
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;
  const activeKeyRef = useRef<string>(activeKey);
  activeKeyRef.current = activeKey;
  // requestId -> live stream bookkeeping (synchronous, race-free)
  const streams = useRef<Map<string, StreamEntry>>(new Map());

  const activeTab = tabs.find((tb) => tb.key === activeKey) ?? tabs[0];

  // helpers
  const patchTab = useCallback((key: string, patch: (tb: Tab) => Tab) => {
    setTabs((prev) => prev.map((tb) => (tb.key === key ? patch(tb) : tb)));
  }, []);

  useEffect(() => {
    window.api.chats.list().then(setChats);
  }, []);

  // global stream listeners (route by requestId via the streams map)
  useEffect(() => {
    const offChunk = window.api.ai.onChatChunk(({ requestId, delta }) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      s.acc += delta;
      patchTab(s.tabKey, (tb) => ({
        ...tb,
        messages: tb.messages.map((m) =>
          m.id === s.assistantId ? { ...m, content: m.content + delta } : m,
        ),
      }));
    });

    // persistence happens OUTSIDE the setState updater (StrictMode double-invokes
    // updaters; that previously duplicated DB rows).
    const finalize = (requestId: string, fullText?: string) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      streams.current.delete(requestId);
      const content = (fullText ?? s.acc).trim();
      patchTab(s.tabKey, (tb) => ({
        ...tb,
        isStreaming: false,
        messages: tb.messages.map((m) =>
          m.id === s.assistantId ? { ...m, content, streaming: false } : m,
        ),
      }));
      if (content) window.api.chats.addMessage(s.chatId, 'assistant', content);
    };

    const offDone = window.api.ai.onChatDone(({ requestId, fullText }) =>
      finalize(requestId, fullText || undefined),
    );
    const offError = window.api.ai.onChatError(({ requestId, message: msg }) => {
      const s = streams.current.get(requestId);
      if (!s) return;
      streams.current.delete(requestId);
      patchTab(s.tabKey, (tb) => ({
        ...tb,
        isStreaming: false,
        messages: tb.messages.filter((m) => !(m.id === s.assistantId && !m.content.trim())),
      }));
      message.error(msg);
    });

    return () => {
      offChunk();
      offDone();
      offError();
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
        const t0 = freshTab();
        setActiveKey(t0.key);
        return [t0];
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
      streams.current.set(requestId, { tabKey: key, chatId, assistantId: assistantMsg.id, acc: '' });
      window.api.ai.chatStream({ requestId, messages: history, noteContext });
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
    streams.current.delete(requestId);
    const content = s.acc.trim();
    if (content) window.api.chats.addMessage(s.chatId, 'assistant', content);
    patchTab(key, (tb) => ({
      ...tb,
      isStreaming: false,
      messages: tb.messages
        .map((m) => (m.id === s.assistantId ? { ...m, streaming: false } : m))
        .filter((m) => !(m.id === s.assistantId && !m.content.trim())),
    }));
  }, [patchTab]);

  const detachNote = useCallback(() => {
    patchTab(activeKeyRef.current, (tb) => ({ ...tb, boundNote: null }));
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
          const t0 = freshTab();
          setActiveKey(t0.key);
          return [t0];
        }
        setActiveKey((cur) => (prev.find((tb) => tb.chatId === id)?.key === cur ? next[0].key : cur));
        return next;
      });
    },
    [],
  );

  const clearPrefill = useCallback(() => setPrefill(''), []);

  const isStreaming = tabs.some((tb) => tb.isStreaming);

  return (
    <AssistantContext.Provider
      value={{
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
        saveAsNote,
        askWithSelection,
        askAboutNote,
        chats,
        selectChat,
        deleteChat,
        prefill,
        clearPrefill,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}
