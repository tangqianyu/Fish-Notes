import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  shortcut?: string[];
  children: ReactNode;
  delay?: number;
  placement?: 'top' | 'bottom';
}

export default function Tooltip({
  label,
  shortcut,
  children,
  delay = 200,
  placement = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const trigger = wrapRef.current?.firstElementChild as HTMLElement | null;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: placement === 'top' ? rect.top : rect.bottom,
      });
      setVisible(true);
    }, delay);
  }, [delay, placement]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <span
        ref={wrapRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onMouseDown={hide}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] flex flex-col items-center"
            style={{
              left: pos.x,
              top: pos.y,
              transform:
                placement === 'top'
                  ? 'translate(-50%, calc(-100% - 6px))'
                  : 'translate(-50%, 6px)',
            }}
          >
            <div
              className="px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap shadow-lg flex items-center gap-2.5"
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              <span style={{ fontWeight: 600 }}>{label}</span>
              {shortcut && shortcut.length > 0 && (
                <span className="flex items-center gap-1" style={{ opacity: 0.75 }}>
                  {shortcut.map((key, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span style={{ opacity: 0.5 }}>+</span>}
                      <kbd
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.15)',
                          padding: '1px 5px',
                          borderRadius: 3,
                          fontFamily: 'inherit',
                          fontSize: '0.95em',
                          fontWeight: 500,
                          minWidth: 16,
                          textAlign: 'center',
                          display: 'inline-block',
                        }}
                      >
                        {key}
                      </kbd>
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
