import { useRef, useCallback } from 'react';

export function useAutoSave(delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the most recent pending save so flush() can run it immediately instead of
  // discarding it (e.g. on unmount / note switch / window close).
  const pendingRef = useRef<(() => void) | null>(null);

  const save = useCallback(
    (fn: () => void) => {
      pendingRef.current = fn;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pendingRef.current = null;
        fn();
      }, delay);
    },
    [delay],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      const fn = pendingRef.current;
      pendingRef.current = null;
      fn();
    }
  }, []);

  return { save, flush };
}
