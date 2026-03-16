import { useState, useCallback } from 'react';

interface PasswordPromptProps {
  onVerify: (password: string) => Promise<boolean>;
  onCancel?: () => void;
  message?: string;
  buttonText?: string;
}

function PasswordPrompt({ onVerify, onCancel, message, buttonText }: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password || loading) return;
      setLoading(true);
      setError(false);
      const ok = await onVerify(password);
      if (!ok) {
        setError(true);
        setPassword('');
      }
      setLoading(false);
    },
    [password, loading, onVerify],
  );

  return (
    <div className="flex-1 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-72 flex flex-col items-center gap-4">
        <svg className="w-12 h-12" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {message || '此笔记已加密，请输入密码查看'}
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="输入密码"
          autoFocus
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: error ? '#ef4444' : 'var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        />
        {error && (
          <p className="text-xs" style={{ color: '#ef4444' }}>密码错误，请重试</p>
        )}
        <div className="flex gap-2 w-full">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={!password || loading}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {loading ? '验证中...' : (buttonText || '解锁')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PasswordPrompt;
