import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/auth';
import AnimatedCharacters from '../components/login/AnimatedCharacters';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 800);
  };

  return (
    <div
      className="grid min-h-screen place-items-center px-4 py-8"
      style={{ background: 'var(--auth-bg-register)' }}
    >
      {/* 液态玻璃容器 */}
      <div
        className="w-full flex overflow-hidden"
        style={{
          maxWidth: '1040px',
          minHeight: '660px',
          borderRadius: '28px',
          border: '1px solid rgba(148,163,184,0.18)',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          boxShadow: '0 24px 60px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {/* 左侧动画面板 */}
        <div
          className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden"
          style={{
            width: '480px',
            flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.95) 0%, rgba(79,70,229,0.92) 100%)',
            borderRadius: '28px 0 0 28px',
          }}
        >
          {/* 网格背景 */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
          {/* 光晕 */}
          <div style={{ position: 'absolute', top: '20%', right: '20%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '20%', left: '10%', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(48px)', pointerEvents: 'none' }} />

          {/* Logo */}
          <div className="relative flex items-center gap-2 text-white text-lg font-semibold">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>✨</div>
            <span>Notifyra</span>
          </div>

          {/* 动画角色 */}
          <div className="relative flex items-end justify-center" style={{ height: '420px', overflow: 'visible' }}>
            <div style={{ transform: 'scale(0.82)', transformOrigin: 'bottom center' }}>
              <AnimatedCharacters isTyping={isTyping} hasSecret={true} secretVisible={showPassword || showConfirm} />
            </div>
          </div>

          {/* 占位，保持 justify-between 布局平衡 */}
          <div />
        </div>

        {/* 右侧表单 */}
        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <div className="w-full max-w-[360px]">
            <div className="mb-7 text-[22px] font-extrabold tracking-[0.4px] text-app-text lg:hidden">Notifyra</div>
            <h1 className="mb-1.5 text-[28px] font-semibold leading-tight text-app-text">创建账号</h1>
            <p className="mb-7 text-sm text-app-muted">注册后即可开始使用 Notifyra。</p>

            <div className="grid gap-4">
              <div>
                <div className="mb-2 text-sm font-medium text-app-text">用户名</div>
                <input
                  className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-3 text-app-input-text outline-none transition focus:border-app-primary"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); handleTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="请输入用户名"
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-app-text">密码</div>
                <div className="relative">
                  <input
                    className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-3 pr-12 text-app-input-text outline-none transition focus:border-app-primary"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); handleTyping(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-app-text">确认密码</div>
                <div className="relative">
                  <input
                    className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-3 pr-12 text-app-input-text outline-none transition focus:border-app-primary"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); handleTyping(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="再次输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text transition-colors"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-app-warning/20 bg-app-warning/10 px-4 py-3 text-sm text-app-warning">
                  {error}
                </div>
              ) : null}

              <button
                className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5 mt-1"
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
      </div>
    </div>
  );
}
