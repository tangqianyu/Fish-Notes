import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';

interface SettingsProps {
  onClose: () => void;
}

const languages = [
  { id: 'zh-CN', label: '中文' },
  { id: 'en', label: 'English' },
];

function Settings({ onClose }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { encryptionReady, sessionUnlocked, refreshEncryptionState, refreshNotes, lockAllNotes } = useApp();

  const [passwordView, setPasswordView] = useState<'none' | 'set' | 'change' | 'remove'>('none');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setError('');
  }, []);

  const handleSetPassword = useCallback(async () => {
    if (!password) { setError(t('Please enter a password')); return; }
    if (password !== confirmPassword) { setError(t('Passwords do not match')); return; }
    setLoading(true);
    await window.api.encryption.setPassword(password);
    await refreshEncryptionState();
    resetForm();
    setLoading(false);
  }, [password, confirmPassword, refreshEncryptionState, resetForm, t]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword) { setError(t('Please enter current password')); return; }
    if (!password) { setError(t('Please enter new password')); return; }
    if (password !== confirmPassword) { setError(t('Passwords do not match')); return; }
    setLoading(true);
    const ok = await window.api.encryption.changePassword(oldPassword, password);
    if (!ok) {
      setError(t('Current password is incorrect'));
      setLoading(false);
      return;
    }
    await refreshEncryptionState();
    resetForm();
    setLoading(false);
  }, [oldPassword, password, confirmPassword, refreshEncryptionState, resetForm, t]);

  const handleRemovePassword = useCallback(async () => {
    if (!password) { setError(t('Please enter a password')); return; }
    setLoading(true);
    const ok = await window.api.encryption.removePassword(password);
    if (!ok) {
      setError(t('Incorrect password'));
      setLoading(false);
      return;
    }
    await refreshEncryptionState();
    await refreshNotes();
    resetForm();
    setLoading(false);
  }, [password, refreshEncryptionState, refreshNotes, resetForm, t]);

  const handleLanguageChange = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  }, [i18n]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--overlay-bg)' }} onClick={onClose}>
      <div
        className="w-[400px] rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('Settings')}</h2>
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
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t('Theme')}</div>
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
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{th.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language selection */}
        <div className="px-6 pb-5">
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t('Language')}</div>
          <div className="flex gap-3">
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                  i18n.language === lang.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'
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
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t('Encryption')}</div>

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
                    {t('Encryption password is set.')}{sessionUnlocked ? t('Session unlocked.') : t('Session locked.')}
                  </p>
                  {sessionUnlocked && (
                    <button
                      onClick={lockAllNotes}
                      className="px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    >
                      {t('Lock Session')}
                    </button>
                  )}
                  <button
                    onClick={() => setPasswordView('change')}
                    className="px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
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
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder={t('Set password')}
                    autoFocus
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder={t('Confirm password')}
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </>
              )}
              {passwordView === 'change' && (
                <>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => { setOldPassword(e.target.value); setError(''); }}
                    placeholder={t('Current password')}
                    autoFocus
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder={t('New password')}
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder={t('Confirm new password')}
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </>
              )}
              {passwordView === 'remove' && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder={t('Enter password to confirm removal')}
                  autoFocus
                  className="px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                />
              )}

              {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}

              <div className="flex gap-2 mt-1">
                <button
                  onClick={resetForm}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  {t('Cancel')}
                </button>
                <button
                  onClick={
                    passwordView === 'set' ? handleSetPassword :
                    passwordView === 'change' ? handleChangePassword :
                    handleRemovePassword
                  }
                  disabled={loading}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: passwordView === 'remove' ? '#ef4444' : '#3b82f6' }}
                >
                  {loading ? t('Processing...') :
                    passwordView === 'set' ? t('Set') :
                    passwordView === 'change' ? t('Change') : t('Remove')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
