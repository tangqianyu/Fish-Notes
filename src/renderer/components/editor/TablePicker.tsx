import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TablePickerProps {
  onSelect: (rows: number, cols: number) => void;
  onClose: () => void;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

export default function TablePicker({ onSelect, onClose }: TablePickerProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const label = hover
    ? `${hover.rows} × ${hover.cols}`
    : t('Select table size');

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 rounded-lg shadow-lg border p-2 z-50"
      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-primary)' }}
      onMouseLeave={() => setHover(null)}
    >
      <div
        className="text-center text-xs mb-2 select-none"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1.25rem)` }}
      >
        {Array.from({ length: MAX_ROWS * MAX_COLS }).map((_, i) => {
          const r = Math.floor(i / MAX_COLS) + 1;
          const c = (i % MAX_COLS) + 1;
          const active = hover !== null && r <= hover.rows && c <= hover.cols;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover({ rows: r, cols: c })}
              onClick={() => {
                onSelect(r, c);
                onClose();
              }}
              className="w-5 h-5 rounded-sm cursor-pointer transition-colors"
              style={{
                backgroundColor: active ? 'var(--text-active)' : 'var(--bg-tertiary)',
                border: `1px solid ${active ? 'var(--text-active)' : 'var(--border-primary)'}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
