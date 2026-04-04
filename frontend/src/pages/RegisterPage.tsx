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
    <div className="auth-page register">
      <div className="auth-card">
        <div className="brand dark">Notifyra</div>
        <h1>创建账号</h1>
        <p className="muted-text">注册后即可开始使用 Notifyra。</p>
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
          <div>
            <div className="field-label">确认密码</div>
            <input
              className="input-shell full-width"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="再次输入密码"
            />
          </div>
          {error && <div className="warning-banner">{error}</div>}
          <button className="primary-button full-width" onClick={handleRegister} type="button">
            注册
          </button>
          <button className="text-button" onClick={() => navigate('/login')} type="button">
            已有账号？去登录
          </button>
        </div>
      </div>
    </div>
  );
}
