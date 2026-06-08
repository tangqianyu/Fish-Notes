import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { diffWordsWithSpace, type Change } from 'diff';

interface PolishDialogProps {
  /** 加载中（AI 还没返回）。loading 时显示 spinner，按钮禁用。 */
  loading: boolean;
  /** AI 出错时的错误信息（loading 完成且失败时显示）。 */
  error: string | null;
  /** 原文。打开 dialog 时立即可用。 */
  original: string;
  /** 润色结果。AI 返回前为 null。 */
  polished: string | null;
  onAccept: (polishedText: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

type ViewMode = 'unified' | 'sideBySide';

export default function PolishDialog({
  loading,
  error,
  original,
  polished,
  onAccept,
  onClose,
  onRetry,
}: PolishDialogProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const changes: Change[] = useMemo(() => {
    if (polished == null) return [];
    return diffWordsWithSpace(original, polished);
  }, [original, polished]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--overlay-bg)' }}
      onClick={onClose}
    >
      <div
        className="w-[720px] max-h-[80vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            ✨ {t('AI Polish Suggestion')}
          </h2>
          <div className="flex items-center gap-2">
            {polished && !loading && !error && (
              <div
                className="flex items-center text-xs rounded overflow-hidden"
                style={{ border: '1px solid var(--border-primary)' }}
              >
                <button
                  onClick={() => setViewMode('unified')}
                  className="px-2 py-1 transition-colors"
                  style={{
                    backgroundColor: viewMode === 'unified' ? 'var(--bg-active)' : 'transparent',
                    color: viewMode === 'unified' ? 'var(--text-active)' : 'var(--text-tertiary)',
                  }}
                >
                  {t('Unified')}
                </button>
                <button
                  onClick={() => setViewMode('sideBySide')}
                  className="px-2 py-1 transition-colors"
                  style={{
                    backgroundColor: viewMode === 'sideBySide' ? 'var(--bg-active)' : 'transparent',
                    color:
                      viewMode === 'sideBySide' ? 'var(--text-active)' : 'var(--text-tertiary)',
                  }}
                >
                  {t('Side by side')}
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div
              className="flex items-center justify-center gap-2 py-12"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm">{t('Polishing...')}</span>
            </div>
          )}

          {error && !loading && (
            <div
              className="text-xs px-3 py-2 rounded mb-3"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
              }}
            >
              <div className="font-semibold mb-1">❌ {t('Polish failed')}</div>
              <pre className="whitespace-pre-wrap break-all">{error}</pre>
            </div>
          )}

          {polished != null && !loading && !error && (
            <>
              {viewMode === 'unified' ? (
                <UnifiedDiff changes={changes} />
              ) : (
                <SideBySide original={original} polished={polished} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            {t('Reject')}
          </button>
          {error && !loading && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg text-sm border transition-colors"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              {t('Retry')}
            </button>
          )}
          <button
            onClick={() => polished && onAccept(polished)}
            disabled={loading || !polished || !!error}
            className="px-3 py-1.5 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#f97316' }}
          >
            {t('Apply polish')}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnifiedDiff({ changes }: { changes: Change[] }) {
  return (
    <div
      className="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono"
      style={{ color: 'var(--text-primary)' }}
    >
      {changes.map((c, i) => {
        if (c.added) {
          return (
            <span
              key={i}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.18)',
                color: '#059669',
              }}
            >
              {c.value}
            </span>
          );
        }
        if (c.removed) {
          return (
            <span
              key={i}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#dc2626',
                textDecoration: 'line-through',
                textDecorationThickness: '1px',
              }}
            >
              {c.value}
            </span>
          );
        }
        return <span key={i}>{c.value}</span>;
      })}
    </div>
  );
}

function SideBySide({ original, polished }: { original: string; polished: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <div
          className="text-xs uppercase mb-1.5 font-semibold tracking-wide"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Original
        </div>
        <div
          className="p-3 rounded whitespace-pre-wrap break-words font-mono leading-relaxed"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
        >
          {original}
        </div>
      </div>
      <div>
        <div
          className="text-xs uppercase mb-1.5 font-semibold tracking-wide"
          style={{ color: '#059669' }}
        >
          Polished
        </div>
        <div
          className="p-3 rounded whitespace-pre-wrap break-words font-mono leading-relaxed"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            color: 'var(--text-primary)',
          }}
        >
          {polished}
        </div>
      </div>
    </div>
  );
}
