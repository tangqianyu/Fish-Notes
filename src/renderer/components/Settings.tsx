import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';
import { message } from './message';
import { modal } from './modal';

interface SettingsProps {
  onClose: () => void;
}

const languages = [
  { id: 'zh-CN', label: '中文' },
  { id: 'en', label: 'English' },
];

const CLAUDE_MODEL_GROUPS: {
  labelKey: string;
  models: { value: string; labelKey: string }[];
}[] = [
  {
    labelKey: '',
    models: [
      { value: 'claude-fable-5', labelKey: 'Fable 5 (most capable, premium)' },
      { value: 'claude-opus-4-8', labelKey: 'Opus 4.8 (strongest, deep analysis)' },
      { value: 'claude-sonnet-4-6', labelKey: 'Sonnet 4.6 (balanced, default)' },
      { value: 'claude-haiku-4-5-20251001', labelKey: 'Haiku 4.5 (fastest, short summaries)' },
    ],
  },
  {
    labelKey: 'Others',
    models: [
      { value: 'claude-opus-4-7', labelKey: 'Opus 4.7' },
      { value: 'claude-opus-4-6', labelKey: 'Opus 4.6' },
    ],
  },
];

function Settings({ onClose }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { encryptionReady, sessionUnlocked, refreshEncryptionState, refreshNotes, lockAllNotes } =
    useApp();

  const [passwordView, setPasswordView] = useState<'none' | 'set' | 'change' | 'remove'>('none');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // AI config state
  const [aiToken, setAiToken] = useState('');
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6');
  const [aiClaudePath, setAiClaudePath] = useState('');
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    window.api.ai.getConfig().then((cfg) => {
      setAiToken(cfg.token || '');
      setAiModel(cfg.model || 'claude-sonnet-4-6');
      setAiClaudePath(cfg.claudePath || '');
    });
  }, []);

  const persistAI = useCallback(async () => {
    await window.api.ai.setConfig({
      token: aiToken.trim(),
      model: aiModel.trim() || 'claude-sonnet-4-6',
      claudePath: aiClaudePath.trim() || undefined,
    });
  }, [aiToken, aiModel, aiClaudePath]);

  const handleSaveAI = useCallback(async () => {
    await persistAI();
    message.success(t('Saved'));
  }, [persistAI, t]);

  const handleTestAI = useCallback(async () => {
    setAiTesting(true);
    try {
      const r = await window.api.ai.testConnection({
        token: aiToken.trim(),
        model: aiModel.trim() || 'claude-sonnet-4-6',
        claudePath: aiClaudePath.trim() || undefined,
      });
      if (r.ok) {
        message.success(`${t('Connected. Claude replied:')} ${r.reply}`);
      } else {
        modal.error({
          title: t('Connection failed'),
          content: <pre className="whitespace-pre-wrap break-all">{r.error}</pre>,
        });
      }
    } finally {
      setAiTesting(false);
    }
  }, [aiToken, aiModel, aiClaudePath, t]);

  const themes = [
    { id: 'light' as const, label: t('Light'), preview: 'bg-white border-gray-200' },
    { id: 'dark' as const, label: t('Dark'), preview: 'bg-gray-900 border-gray-700' },
    { id: 'solarized' as const, label: t('Solarized'), preview: 'bg-[#fdf6e3] border-[#e0d9c4]' },
    { id: 'anime' as const, label: t('Anime'), preview: 'bg-[#fef5f8] border-[#f0d4e0]' },
  ];

  const resetForm = useCallback(() => {
    setPasswordView('none');
    setPassword('');
    setConfirmPassword('');
    setOldPassword('');
  }, []);

  const handleSetPassword = useCallback(async () => {
    if (!password) {
      message.error(t('Please enter a password'));
      return;
    }
    if (password !== confirmPassword) {
      message.error(t('Passwords do not match'));
      return;
    }
    setLoading(true);
    await window.api.encryption.setPassword(password);
    await refreshEncryptionState();
    resetForm();
    setLoading(false);
    message.success(t('Password set'));
  }, [password, confirmPassword, refreshEncryptionState, resetForm, t]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword) {
      message.error(t('Please enter current password'));
      return;
    }
    if (!password) {
      message.error(t('Please enter new password'));
      return;
    }
    if (password !== confirmPassword) {
      message.error(t('Passwords do not match'));
      return;
    }
    setLoading(true);
    const ok = await window.api.encryption.changePassword(oldPassword, password);
    if (!ok) {
      message.error(t('Current password is incorrect'));
      setLoading(false);
      return;
    }
    await refreshEncryptionState();
    resetForm();
    setLoading(false);
    message.success(t('Password changed'));
  }, [oldPassword, password, confirmPassword, refreshEncryptionState, resetForm, t]);

  const handleRemovePassword = useCallback(async () => {
    if (!password) {
      message.error(t('Please enter a password'));
      return;
    }
    setLoading(true);
    const ok = await window.api.encryption.removePassword(password);
    if (!ok) {
      message.error(t('Incorrect password'));
      setLoading(false);
      return;
    }
    await refreshEncryptionState();
    await refreshNotes();
    resetForm();
    setLoading(false);
    message.success(t('Encryption removed'));
  }, [password, refreshEncryptionState, refreshNotes, resetForm, t]);

  const handleLanguageChange = useCallback(
    (lng: string) => {
      i18n.changeLanguage(lng);
      localStorage.setItem('language', lng);
    },
    [i18n],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--overlay-bg)' }}
    >
      <div
        className="w-[400px] max-h-[88vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--card-bg)' }}
      >
        {/* Header (sticky-feeling: stays visible while body scrolls) */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('Settings')}
          </h2>
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

        {/* Scrollable body */}
        <div className="overflow-y-auto">
          {/* Theme selection */}
          <div className="px-6 py-5">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('Theme')}
            </div>
            <div className="flex gap-3">
              {themes.map((th) => (
                <button
                  key={th.id}
                  onClick={() => setTheme(th.id)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    theme === th.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className={`w-full h-12 rounded-md border ${th.preview}`} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {th.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Language selection */}
          <div className="px-6 pb-5">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('Language')}
            </div>
            <div className="flex gap-3">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang.id)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                    i18n.language === lang.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Encryption section */}
          <div className="px-6 pb-5">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('Encryption')}
            </div>

            {passwordView === 'none' ? (
              <div className="flex flex-col gap-2">
                {!encryptionReady ? (
                  <button
                    onClick={() => setPasswordView('set')}
                    className="px-3 py-2 rounded-lg text-sm text-white transition-colors"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    {t('Set Encryption Password')}
                  </button>
                ) : (
                  <>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      {t('Encryption password is set.')}
                      {sessionUnlocked ? t('Session unlocked.') : t('Session locked.')}
                    </p>
                    {sessionUnlocked && (
                      <button
                        onClick={lockAllNotes}
                        className="px-3 py-2 rounded-lg text-sm transition-colors"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t('Lock Session')}
                      </button>
                    )}
                    <button
                      onClick={() => setPasswordView('change')}
                      className="px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {t('Change Password')}
                    </button>
                    <button
                      onClick={() => setPasswordView('remove')}
                      className="px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{ color: '#ef4444', backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      {t('Remove Password')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {passwordView === 'set' && (
                  <>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                      }}
                      placeholder={t('Set password')}
                      autoFocus
                      className="px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                      }}
                      placeholder={t('Confirm password')}
                      className="px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </>
                )}
                {passwordView === 'change' && (
                  <>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value);
                      }}
                      placeholder={t('Current password')}
                      autoFocus
                      className="px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                      }}
                      placeholder={t('New password')}
                      className="px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                      }}
                      placeholder={t('Confirm new password')}
                      className="px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </>
                )}
                {passwordView === 'remove' && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    placeholder={t('Enter password to confirm removal')}
                    autoFocus
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                )}

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={resetForm}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={
                      passwordView === 'set'
                        ? handleSetPassword
                        : passwordView === 'change'
                          ? handleChangePassword
                          : handleRemovePassword
                    }
                    disabled={loading}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: passwordView === 'remove' ? '#ef4444' : '#3b82f6' }}
                  >
                    {loading
                      ? t('Processing...')
                      : passwordView === 'set'
                        ? t('Set')
                        : passwordView === 'change'
                          ? t('Change')
                          : t('Remove')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI section */}
          <div className="px-6 pb-5">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('Claude AI Config')}
            </h3>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('Call Claude via Claude Code CLI OAuth token, no API key needed.')}
            </p>

            <div className="flex flex-col gap-3 text-sm">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t('OAuth Token')}
                  </label>
                  <TokenInfoIcon t={t} />
                </div>
                <input
                  type="password"
                  value={aiToken}
                  onChange={(e) => {
                    setAiToken(e.target.value);
                  }}
                  placeholder="sk-ant-oat01-..."
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none font-mono"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('Model')}
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => {
                    setAiModel(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {CLAUDE_MODEL_GROUPS.map((group) => {
                    const options = group.models.map((m) => (
                      <option key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </option>
                    ));
                    return group.labelKey ? (
                      <optgroup key={group.labelKey} label={t(group.labelKey)}>
                        {options}
                      </optgroup>
                    ) : (
                      <Fragment key="latest">{options}</Fragment>
                    );
                  })}
                </select>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  {t('Advanced: custom claude CLI path (only if not found)')}
                </summary>
                <div className="mt-2">
                  <input
                    type="text"
                    value={aiClaudePath}
                    onChange={(e) => {
                      setAiClaudePath(e.target.value);
                    }}
                    placeholder={t('Leave empty to auto-detect')}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none font-mono"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <p className="mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {t('Run `which claude` in terminal to find it.')}
                  </p>
                </div>
              </details>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveAI}
                  className="px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                  style={{ backgroundColor: '#f97316' }}
                >
                  {t('Save')}
                </button>
                <button
                  onClick={handleTestAI}
                  disabled={aiTesting}
                  className="px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                >
                  {aiTesting ? t('Testing...') : t('Test connection')}
                </button>
              </div>
            </div>
          </div>

          {/* /Scrollable body */}
        </div>
      </div>
    </div>
  );
}

function TokenInfoIcon({ t }: { t: (key: string) => string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const rect = iconRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    setVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setVisible(false), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        className="inline-flex cursor-help"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
      {visible &&
        createPortal(
          <div
            className="fixed z-[9999]"
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, 0)',
              maxWidth: 360,
            }}
          >
            <div
              className="px-3 py-2 rounded-md text-xs shadow-lg leading-relaxed select-text"
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              <div className="mb-1.5">{t('Generation steps:')}</div>
              <div className="flex flex-wrap items-center gap-y-1.5">
                <code
                  className="inline-block px-1.5 py-0.5 rounded font-mono cursor-text"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  npm i -g @anthropic-ai/claude-code
                </code>
                <span className="mx-1.5">→</span>
                <code
                  className="inline-block px-1.5 py-0.5 rounded font-mono cursor-text"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  claude /login
                </code>
                <span className="mx-1.5">→</span>
                <code
                  className="inline-block px-1.5 py-0.5 rounded font-mono cursor-text"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  claude setup-token
                </code>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Settings;
