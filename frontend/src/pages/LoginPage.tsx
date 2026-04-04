import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      const result = await authApi.login(username, password);
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.removeItem('userId');
      localStorage.setItem('username', result.username);
      window.location.replace('/overview');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || '登录失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand dark">Notifyra</div>
        <h1>欢迎回来</h1>
        <p className="muted-text">登录后即可进入 Notifyra 控制台。</p>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div className="field-label">用户名</div>
            <input
              className="input-shell full-width"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <div className="field-label">密码</div>
            <input
              className="input-shell full-width"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入密码"
            />
          </div>
          {error && <div className="warning-banner">{error}</div>}
          <button className="primary-button full-width" onClick={handleLogin} type="button">
            登录并进入概览
          </button>
          <button className="text-button" onClick={() => navigate('/register')} type="button">
            还没有账号？去注册
          </button>
        </div>
      </div>
    </div>
  );
}
