import { useState, useEffect } from 'react';
import FloatingBall from './FloatingBall';
import ChatPanel from './ChatPanel';

const ENABLED_KEY = 'fish-notes:assistant-enabled';
export const ASSISTANT_TOGGLE_EVENT = 'fish-notes:assistant-enabled-changed';

export function isAssistantEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) !== 'false';
}

export function setAssistantEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(ASSISTANT_TOGGLE_EVENT));
}

/**
 * Mounts the floating assistant ball + chat panel. The ball is hidden when the
 * Settings toggle is off; the panel is gated internally by AssistantContext.isOpen.
 */
export default function Assistant() {
  const [enabled, setEnabled] = useState(isAssistantEnabled);

  useEffect(() => {
    const handler = () => setEnabled(isAssistantEnabled());
    window.addEventListener(ASSISTANT_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_TOGGLE_EVENT, handler);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <FloatingBall />
      <ChatPanel />
    </>
  );
}
