import { useState, useRef, useCallback, useEffect } from 'react';
import { useAssistant } from '../../contexts/AssistantContext';

const POS_KEY = 'fish-notes:assistant-pos';
const SIZE = 52;

interface Pos {
  x: number;
  y: number;
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  // default: bottom-right
  return { x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 24 };
}

function clamp(p: Pos): Pos {
  return {
    x: Math.min(Math.max(8, p.x), window.innerWidth - SIZE - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - SIZE - 8),
  };
}

export default function FloatingBall() {
  const { toggle, isStreaming, isOpen } = useAssistant();
  const [pos, setPos] = useState<Pos>(loadPos);
  // grab offset within the ball + the pointer's start position (for click vs drag)
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(
    null,
  );

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = {
        dx: e.clientX - pos.x,
        dy: e.clientY - pos.y,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      toggle();
    } else {
      setPos((p) => {
        localStorage.setItem(POS_KEY, JSON.stringify(p));
        return p;
      });
    }
  }, [toggle]);

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="Fish"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 26,
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        background: 'linear-gradient(135deg, var(--bg-active), var(--card-bg))',
        border: '1px solid var(--border-primary)',
        boxShadow: isOpen ? '0 4px 14px rgba(0,0,0,0.25)' : '0 6px 18px rgba(0,0,0,0.22)',
        transition: 'box-shadow 0.2s, transform 0.1s',
      }}
    >
      <span style={{ pointerEvents: 'none' }}>🐟</span>
      {isStreaming && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            animation: 'fish-breathe 1s ease-in-out infinite',
          }}
        />
      )}
    </button>
  );
}
