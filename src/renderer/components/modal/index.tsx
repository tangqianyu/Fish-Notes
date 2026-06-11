import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../i18n';

export type ModalType = 'success' | 'error' | 'info' | 'warning';

interface ModalConfig {
  type?: ModalType;
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
}

interface ModalItem extends ModalConfig {
  id: number;
  visible: boolean;
}

const LEAVE_MS = 200;

// ---- store (lives outside React so modal.* works from anywhere) ----

let seed = 0;
let items: ModalItem[] = [];
const listeners = new Set<(items: ModalItem[]) => void>();

function emit() {
  const snapshot = items.slice();
  listeners.forEach((l) => l(snapshot));
}

function close(id: number) {
  items = items.map((it) => (it.id === id ? { ...it, visible: false } : it));
  emit();
  window.setTimeout(() => {
    items = items.filter((it) => it.id !== id);
    emit();
  }, LEAVE_MS);
}

function open(config: ModalConfig): () => void {
  const id = ++seed;
  items = [...items, { id, visible: false, ...config }];
  emit();
  requestAnimationFrame(() => {
    items = items.map((it) => (it.id === id ? { ...it, visible: true } : it));
    emit();
  });
  return () => close(id);
}

function subscribe(listener: (items: ModalItem[]) => void) {
  listeners.add(listener);
  listener(items.slice());
  return () => {
    listeners.delete(listener);
  };
}

// ---- icons ----

const iconColors: Record<ModalType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

function Icon({ type }: { type: ModalType }) {
  const color = iconColors[type];
  const common = {
    width: 22,
    height: 22,
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

// ---- single modal ----

function ModalCard({ item }: { item: ModalItem }) {
  const type = item.type ?? 'info';
  const onClose = () => close(item.id);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--overlay-bg)',
        opacity: item.visible ? 1 : 0,
        transition: `opacity ${LEAVE_MS}ms ease`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          padding: '20px 24px',
          backgroundColor: 'var(--card-bg)',
          color: 'var(--text-primary)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          transform: item.visible ? 'scale(1)' : 'scale(0.95)',
          transition: `transform ${LEAVE_MS}ms ease, opacity ${LEAVE_MS}ms ease`,
          opacity: item.visible ? 1 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Icon type={type} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {item.title != null && (
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: item.content ? 8 : 0 }}>
                {item.title}
              </div>
            )}
            {item.content != null && (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  overflowY: 'auto',
                  maxHeight: '52vh',
                  wordBreak: 'break-word',
                }}
              >
                {item.content}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onClose}
            autoFocus
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              backgroundColor: iconColors[type],
            }}
          >
            {item.okText ?? i18n.t('OK')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- container (mounted once) ----

function ModalContainer() {
  const [list, setList] = useState<ModalItem[]>([]);
  useEffect(() => subscribe(setList), []);
  return (
    <>
      {list.map((item) => (
        <ModalCard key={item.id} item={item} />
      ))}
    </>
  );
}

// ---- self-mount ----

let mounted = false;
function ensureMounted() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  const host = document.createElement('div');
  host.setAttribute('data-fish-modal', '');
  document.body.appendChild(host);
  createRoot(host).render(<ModalContainer />);
}

// ---- public API (antd-like) ----

function call(type: ModalType, config: ModalConfig) {
  ensureMounted();
  return open({ type, ...config });
}

export const modal = {
  success: (config: ModalConfig) => call('success', config),
  error: (config: ModalConfig) => call('error', config),
  info: (config: ModalConfig) => call('info', config),
  warning: (config: ModalConfig) => call('warning', config),
};

export default modal;
