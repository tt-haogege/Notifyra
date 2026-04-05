import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    if (password !== confirm) {
      setError('两次密码不一致');
      return;
    }
    try {
      await authApi.register(username, password);
      navigate('/login');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || '注册失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRegister();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--auth-bg-register)] px-4 py-8">
      <div className="w-full max-w-[460px] rounded-[28px] border border-app-border bg-app-surface p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:p-8">
        <div className="mb-7 text-[26px] font-extrabold tracking-[0.4px] text-app-text">Notifyra</div>
        <h1 className="mb-2 text-3xl leading-tight font-semibold text-app-text">创建账号</h1>
        <p className="mb-6 text-sm text-app-muted">注册后即可开始使用 Notifyra。</p>
        <div className="grid gap-4">
          <div>
            <div className="mb-2 text-sm font-medium text-app-text">用户名</div>
            <input
              className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-3 text-app-input-text outline-none transition focus:border-app-primary"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-app-text">密码</div>
            <input
              className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-3 text-app-input-text outline-none transition focus:border-app-primary"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入密码"
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-app-text">确认密码</div>
            <input
              className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-3 text-app-input-text outline-none transition focus:border-app-primary"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="再次输入密码"
            />
          </div>
          {error ? (
            <div className="rounded-2xl border border-app-warning/20 bg-app-warning/10 px-4 py-3 text-sm text-app-warning">
              {error}
            </div>
          ) : null}
          <button
            className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5"
            onClick={handleRegister}
            type="button"
          >
            注册
          </button>
          <button
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium text-app-primary transition hover:bg-app-primary/5"
            onClick={() => navigate('/login')}
            type="button"
          >
            已有账号？去登录
          </button>
        </div>
      </div>
    </div>
  );
}
