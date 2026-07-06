import { useState, useRef, useCallback, useEffect } from 'react';
import { useAssistant } from '../../contexts/AssistantContext';
import { useTheme } from '../../contexts/ThemeContext';
import { RobotIcon } from '../icons';
import cinnaIdle from '../../assets/mascots/cinnamoroll-idle.gif';
import cinnaHappy from '../../assets/mascots/cinnamoroll-happy.gif';
import cinnaThink from '../../assets/mascots/cinnamoroll-think.gif';
import cinnaSleep from '../../assets/mascots/cinnamoroll-sleep.gif';
import kuromiIdle from '../../assets/mascots/kuromi-idle.gif';
import kuromiThink from '../../assets/mascots/kuromi-think.gif';
import kuromiHappy from '../../assets/mascots/kuromi-happy.gif';
import kuromiSleep from '../../assets/mascots/kuromi-sleep.gif';
import melodyIdle from '../../assets/mascots/melody-idle.gif';
import melodyThink from '../../assets/mascots/melody-think.gif';
import melodyHappy from '../../assets/mascots/melody-happy.gif';
import melodySleep from '../../assets/mascots/melody-sleep.gif';
import totoroIdle from '../../assets/mascots/totoro-idle.gif';
import totoroThink from '../../assets/mascots/totoro-think.gif';
import totoroHappy from '../../assets/mascots/totoro-happy.gif';
import totoroSleep from '../../assets/mascots/totoro-sleep.gif';

/**
 * 主题吉祥物：这些主题的悬浮球直接显示角色本体（无圆框）。
 * idle 必填；happy/thinking/sleep 可选 —— 提供后角色会按状态切换动图：
 * hover 开心、AI 回答中思考、长时间无操作睡觉。
 */
interface MascotSet {
  idle: string;
  happy?: string;
  thinking?: string;
  sleep?: string;
  /** 像素画贴纸用最近邻渲染保持锐利；高清立绘保持平滑缩放 */
  pixelArt?: boolean;
}

const THEME_MASCOTS: Record<string, MascotSet> = {
  cinnamoroll: {
    idle: cinnaIdle,
    happy: cinnaHappy,
    thinking: cinnaThink,
    sleep: cinnaSleep,
    pixelArt: true,
  },
  kuromi: {
    idle: kuromiIdle,
    happy: kuromiHappy,
    thinking: kuromiThink,
    sleep: kuromiSleep,
    pixelArt: true,
  },
  melody: {
    idle: melodyIdle,
    happy: melodyHappy,
    thinking: melodyThink,
    sleep: melodySleep,
    pixelArt: true,
  },
  totoro: { idle: totoroIdle, happy: totoroHappy, thinking: totoroThink, sleep: totoroSleep },
};

const POS_KEY = 'fish-notes:assistant-pos';
const SIZE = 52;
/** 全局无操作超过这个时长，吉祥物睡觉 */
const SLEEP_AFTER_MS = 5 * 60_000;

interface Pos {
  x: number;
  y: number;
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return clamp(JSON.parse(raw)); // clamp saved value into the current viewport
  } catch {
    /* ignore */
  }
  // default: bottom-right
  return clamp({ x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 24 });
}

function clamp(p: Pos): Pos {
  return {
    x: Math.min(Math.max(8, p.x), window.innerWidth - SIZE - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - SIZE - 8),
  };
}

export default function FloatingBall() {
  const { toggle, isStreaming, isOpen } = useAssistant();
  const { resolvedTheme } = useTheme();
  const mascot = THEME_MASCOTS[resolvedTheme.replace(/-night$/, '')];
  const [pos, setPos] = useState<Pos>(loadPos);
  const [hovered, setHovered] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const asleepRef = useRef(false);
  asleepRef.current = asleep;
  // grab offset within the ball + the pointer's start position (for click vs drag)
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(
    null,
  );

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    // Re-clamp once after mount: on first launch the window size may not be
    // settled when the initial position is computed, leaving the ball off-screen.
    onResize();
    const raf = requestAnimationFrame(onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 睡眠检测：任何键鼠活动都会重置计时并唤醒
  useEffect(() => {
    let last = Date.now();
    const bump = () => {
      last = Date.now();
      if (asleepRef.current) setAsleep(false);
    };
    window.addEventListener('pointermove', bump, { passive: true });
    window.addEventListener('pointerdown', bump, { passive: true });
    window.addEventListener('keydown', bump, { passive: true });
    const iv = window.setInterval(() => {
      if (Date.now() - last > SLEEP_AFTER_MS && !asleepRef.current) setAsleep(true);
    }, 30_000);
    return () => {
      window.removeEventListener('pointermove', bump);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      window.clearInterval(iv);
    };
  }, []);

  // 预加载所有状态动图，避免状态切换时闪空
  useEffect(() => {
    if (!mascot) return;
    for (const src of [mascot.idle, mascot.happy, mascot.thinking, mascot.sleep]) {
      if (src) new Image().src = src;
    }
  }, [mascot]);

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

  // 状态优先级：思考中 > hover 开心 > 睡觉 > 待机
  const mascotSrc = mascot
    ? (isStreaming && mascot.thinking) ||
      (hovered && mascot.happy) ||
      (asleep && !isOpen && mascot.sleep) ||
      mascot.idle
    : null;

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={
        {
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
          background: mascotSrc
            ? 'none'
            : 'linear-gradient(135deg, var(--bg-active), var(--card-bg))',
          border: mascotSrc ? 'none' : '1px solid var(--border-primary)',
          boxShadow: mascotSrc
            ? 'none'
            : isOpen
              ? '0 4px 14px rgba(0,0,0,0.25)'
              : '0 6px 18px rgba(0,0,0,0.22)',
          transition: 'box-shadow 0.2s, transform 0.1s',
          // don't let the macOS title-bar drag region swallow clicks/drag on the ball
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties
      }
    >
      <span style={{ pointerEvents: 'none', color: 'var(--accent-solid)', display: 'inline-flex' }}>
        {mascotSrc ? (
          <img
            src={mascotSrc}
            alt=""
            draggable={false}
            style={{
              maxWidth: SIZE + 16,
              maxHeight: SIZE + 14,
              objectFit: 'contain',
              // 像素画贴纸按像素风格锐利渲染，避免平滑缩放的糊边锯齿
              imageRendering: mascot?.pixelArt ? 'pixelated' : 'auto',
              filter: 'drop-shadow(0 4px 10px rgba(30, 40, 70, 0.3))',
            }}
          />
        ) : (
          <RobotIcon size={24} strokeWidth={1.6} />
        )}
      </span>
      {isStreaming && !mascot && (
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
