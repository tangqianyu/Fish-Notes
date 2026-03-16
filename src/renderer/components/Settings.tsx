import { useState, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';

interface SettingsProps {
  onClose: () => void;
}

const themes = [
  { id: 'light' as const, label: '浅色', preview: 'bg-white border-gray-200' },
  { id: 'dark' as const, label: '深色', preview: 'bg-gray-900 border-gray-700' },
  { id: 'solarized' as const, label: '日光', preview: 'bg-[#fdf6e3] border-[#e0d9c4]' },
  { id: 'anime' as const, label: '动漫', preview: 'bg-[#fef5f8] border-[#f0d4e0]' },
];

function Settings({ onClose }: SettingsProps) {
  const { theme, setTheme } = useTheme();
  const { encryptionReady, sessionUnlocked, refreshEncryptionState, refreshNotes, lockAllNotes } = useApp();

  const [passwordView, setPasswordView] = useState<'none' | 'set' | 'change' | 'remove'>('none');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = useCallback(() => {
    setPasswordView('none');
    setPassword('');
    setConfirmPassword('');
    setOldPassword('');
    setError('');
  }, []);

  const handleSetPassword = useCallback(async () => {
    if (!password) { setError('请输入密码'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    setLoading(true);
    await window.api.encryption.setPassword(password);
    await refreshEncryptionState();
    resetForm();
    setLoading(false);
  }, [password, confirmPassword, refreshEncryptionState, resetForm]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword) { setError('请输入当前密码'); return; }
    if (!password) { setError('请输入新密码'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    setLoading(true);
    const ok = await window.api.encryption.changePassword(oldPassword, password);
    if (!ok) {
      setError('当前密码错误');
      setLoading(false);
      return;
    }
    await refreshEncryptionState();
    resetForm();
    setLoading(false);
  }, [oldPassword, password, confirmPassword, refreshEncryptionState, resetForm]);

  const handleRemovePassword = useCallback(async () => {
    if (!password) { setError('请输入密码'); return; }
    setLoading(true);
    const ok = await window.api.encryption.removePassword(password);
    if (!ok) {
      setError('密码错误');
      setLoading(false);
      return;
    }
    await refreshEncryptionState();
    await refreshNotes();
    resetForm();
    setLoading(false);
  }, [password, refreshEncryptionState, refreshNotes, resetForm]);

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

        {/* Encryption section */}
        <div className="px-6 pb-5">
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>笔记加密</div>

          {passwordView === 'none' ? (
            <div className="flex flex-col gap-2">
              {!encryptionReady ? (
                <button
                  onClick={() => setPasswordView('set')}
                  className="px-3 py-2 rounded-lg text-sm text-white transition-colors"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  设置加密密码
                </button>
              ) : (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    已设置加密密码。{sessionUnlocked ? '会话已解锁。' : '会话已锁定。'}
                  </p>
                  {sessionUnlocked && (
                    <button
                      onClick={lockAllNotes}
                      className="px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    >
                      锁定会话
                    </button>
                  )}
                  <button
                    onClick={() => setPasswordView('change')}
                    className="px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    修改密码
                  </button>
                  <button
                    onClick={() => setPasswordView('remove')}
                    className="px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: '#ef4444', backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    移除密码
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
                    placeholder="设置密码"
                    autoFocus
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="确认密码"
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
                    placeholder="当前密码"
                    autoFocus
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="新密码"
                    className="px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="确认新密码"
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
                  placeholder="输入密码以确认移除"
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
                  取消
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
                  {loading ? '处理中...' :
                    passwordView === 'set' ? '设置' :
                    passwordView === 'change' ? '修改' : '移除'}
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
