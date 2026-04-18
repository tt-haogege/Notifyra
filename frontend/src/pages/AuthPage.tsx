import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import AnimatedCharacters from '../components/login/AnimatedCharacters';
import { useToast } from '../components/common/toast-context';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(location.pathname === '/register' ? 'register' : 'login');

  // 共享状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const secretVisible = showPassword || (mode === 'register' && showConfirm);

  const reset = (next: Mode) => {
    setUsername('');
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setShowConfirm(false);
    setError('');
    setMode(next);
    navigate(next === 'login' ? '/login' : '/register', { replace: true });
  };

  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 800);
  };

  const handleLogin = async () => {
    setError('');
    try {
      const result = await authApi.login(username, password);
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.removeItem('userId');
      localStorage.setItem('username', result.username);
      toast(`欢迎回来，${result.username}！`, 'success');
      setTimeout(() => window.location.replace('/overview'), 600);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '登录失败'));
    }
  };

  const handleRegister = async () => {
    setError('');
    if (password !== confirm) {
      setError('两次密码不一致');
      return;
    }
    try {
      await authApi.register(username, password);
      toast('注册成功，请登录', 'success');
      reset('login');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '注册失败'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister();
  };

  return (
    <div
      className="grid min-h-screen place-items-center px-4 py-8"
      style={{ background: mode === 'login' ? 'var(--auth-bg)' : 'var(--auth-bg-register)' }}
    >
      {/* 液态玻璃容器 — 尺寸永远固定 */}
      <div
        className="w-full flex overflow-hidden"
        style={{
          maxWidth: '1040px',
          height: '620px',
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
              <AnimatedCharacters isTyping={isTyping} hasSecret={true} secretVisible={secretVisible} />
            </div>
          </div>

          <div />
        </div>

        {/* 右侧表单区 — overflow hidden 防止内容撑开容器 */}
        <div className="flex flex-1 items-center justify-center px-8 overflow-hidden">
          <div className="w-full max-w-[360px]">
            {/* 移动端 Logo */}
            <div className="mb-6 text-[22px] font-extrabold tracking-[0.4px] text-app-text lg:hidden">Notifyra</div>

            <h1 className="mb-1.5 text-[28px] font-semibold leading-tight text-app-text">
              {mode === 'login' ? '欢迎回来' : '创建账号'}
            </h1>
            <p className="mb-6 text-sm text-app-muted">
              {mode === 'login' ? '登录后即可进入 Notifyra 控制台。' : '注册后即可开始使用 Notifyra。'}
            </p>

            <div className="grid gap-3">
              {/* 用户名 */}
              <div>
                <div className="mb-1.5 text-sm font-medium text-app-text">用户名</div>
                <input
                  className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-2.5 text-app-input-text outline-none transition focus:border-app-primary"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); handleTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="请输入用户名"
                />
              </div>

              {/* 密码 */}
              <div>
                <div className="mb-1.5 text-sm font-medium text-app-text">密码</div>
                <div className="relative">
                  <input
                    className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-2.5 pr-12 text-app-input-text outline-none transition focus:border-app-primary"
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

              {/* 确认密码 — 仅注册模式显示 */}
              {mode === 'register' && (
                <div>
                  <div className="mb-1.5 text-sm font-medium text-app-text">确认密码</div>
                  <div className="relative">
                    <input
                      className="w-full rounded-[14px] border border-app-input-border bg-app-input px-4 py-2.5 pr-12 text-app-input-text outline-none transition focus:border-app-primary"
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
              )}

              {/* 错误提示 */}
              {error ? (
                <div className="rounded-2xl border border-app-warning/20 bg-app-warning/10 px-4 py-2.5 text-sm text-app-warning">
                  {error}
                </div>
              ) : null}

              {/* 主操作按钮 */}
              <button
                className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5 mt-1"
                onClick={mode === 'login' ? handleLogin : handleRegister}
                type="button"
              >
                {mode === 'login' ? '登录并进入概览' : '注册'}
              </button>

              {/* 切换模式 */}
              <button
                className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium text-app-primary transition hover:bg-app-primary/5"
                onClick={() => reset(mode === 'login' ? 'register' : 'login')}
                type="button"
              >
                {mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
