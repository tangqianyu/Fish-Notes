import { useTheme } from '../contexts/ThemeContext';

interface SettingsProps {
  onClose: () => void;
}

const themes = [
  { id: 'light' as const, label: '浅色', preview: 'bg-white border-gray-200' },
  { id: 'dark' as const, label: '深色', preview: 'bg-gray-900 border-gray-700' },
  { id: 'solarized' as const, label: 'Solarized', preview: 'bg-[#fdf6e3] border-[#e0d9c4]' },
];

function Settings({ onClose }: SettingsProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--overlay-bg)' }} onClick={onClose}>
      <div
        className="w-[400px] rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>设置</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Theme selection */}
        <div className="px-6 py-5">
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>主题</div>
          <div className="flex gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  theme === t.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'
                }`}
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <div className={`w-full h-12 rounded-md border ${t.preview}`} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
