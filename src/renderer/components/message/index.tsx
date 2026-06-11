import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

export type MessageType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface MessageItem {
  id: number;
  type: MessageType;
  content: ReactNode;
  duration: number;
  visible: boolean;
}

interface OpenConfig {
  type?: MessageType;
  content: ReactNode;
  duration?: number;
}

const DEFAULT_DURATION = 3; // seconds
const LEAVE_MS = 250; // exit animation duration

// ---- store (lives outside React so message.* works from anywhere) ----

let seed = 0;
let items: MessageItem[] = [];
const listeners = new Set<(items: MessageItem[]) => void>();

function emit() {
  const snapshot = items.slice();
  listeners.forEach((l) => l(snapshot));
}

function remove(id: number) {
  // start leave animation
  items = items.map((it) => (it.id === id ? { ...it, visible: false } : it));
  emit();
  window.setTimeout(() => {
    items = items.filter((it) => it.id !== id);
    emit();
  }, LEAVE_MS);
}

function open(config: OpenConfig): () => void {
  const id = ++seed;
  const duration = config.duration ?? DEFAULT_DURATION;
  const item: MessageItem = {
    id,
    type: config.type ?? 'info',
    content: config.content,
    duration,
    visible: false,
  };
  items = [...items, item];
  emit();
  // trigger enter animation on next frame
  requestAnimationFrame(() => {
    items = items.map((it) => (it.id === id ? { ...it, visible: true } : it));
    emit();
  });
  if (duration > 0) {
    window.setTimeout(() => remove(id), duration * 1000);
  }
  return () => remove(id);
}

function subscribe(listener: (items: MessageItem[]) => void) {
  listeners.add(listener);
  listener(items.slice());
  return () => {
    listeners.delete(listener);
  };
}

// ---- icons ----

const iconColors: Record<MessageType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  loading: '#3b82f6',
};

function Icon({ type }: { type: MessageType }) {
  const color = iconColors[type];
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
  };
  switch (type) {
    case 'success':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6M9 9l6 6" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'loading':
      return (
        <svg {...common} className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
  }
}

// ---- single message row ----

function MessageRow({ item }: { item: MessageItem }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 8,
        opacity: item.visible ? 1 : 0,
        transform: item.visible ? 'translateY(0)' : 'translateY(-100%)',
        transition: `opacity ${LEAVE_MS}ms ease, transform ${LEAVE_MS}ms ease`,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          maxWidth: '70vw',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.4,
          backgroundColor: 'var(--card-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)',
          pointerEvents: 'auto',
        }}
      >
        <Icon type={item.type} />
        <span style={{ wordBreak: 'break-word' }}>{item.content}</span>
      </div>
    </div>
  );
}

// ---- container (mounted once) ----

function MessageContainer() {
  const [list, setList] = useState<MessageItem[]>([]);
  useEffect(() => subscribe(setList), []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        left: 0,
        right: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {list.map((item) => (
        <MessageRow key={item.id} item={item} />
      ))}
    </div>
  );
}

// ---- self-mount: render the container once into <body> ----

let mounted = false;
function ensureMounted() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  const host = document.createElement('div');
  host.setAttribute('data-fish-message', '');
  document.body.appendChild(host);
  createRoot(host).render(<MessageContainer />);
}

// ---- public API (antd-like) ----

type ContentOrConfig = ReactNode | OpenConfig;

function call(type: MessageType, arg: ContentOrConfig, duration?: number) {
  ensureMounted();
  if (arg && typeof arg === 'object' && 'content' in (arg as OpenConfig)) {
    const cfg = arg as OpenConfig;
    return open({ type, ...cfg });
  }
  return open({ type, content: arg as ReactNode, duration });
}

export const message = {
  success: (content: ContentOrConfig, duration?: number) => call('success', content, duration),
  error: (content: ContentOrConfig, duration?: number) => call('error', content, duration),
  info: (content: ContentOrConfig, duration?: number) => call('info', content, duration),
  warning: (content: ContentOrConfig, duration?: number) => call('warning', content, duration),
  loading: (content: ContentOrConfig, duration = 0) => call('loading', content, duration),
  open: (config: OpenConfig) => {
    ensureMounted();
    return open(config);
  },
};

export default message;
