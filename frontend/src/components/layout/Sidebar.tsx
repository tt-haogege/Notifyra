import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/auth';

const navItems = [
  { label: '概览', to: '/overview' },
  { label: '通知管理', to: '/notifications' },
  { label: '渠道管理', to: '/channels' },
  { label: '推送记录', to: '/push-records' },
  { label: '测试模块', to: '/test' },
  { label: '个人设置', to: '/settings' },
];

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
];

function getAvatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });
  const username = profile?.username || localStorage.getItem('username') || 'User';
  const avatar = profile?.avatar;
  const avatarBg = getAvatarColor(username);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <aside className="sidebar-shell">
      <div>
        <div className="brand">Notifyra</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-user-row">
          <div className="sidebar-user">
            <div
              className="sidebar-avatar"
              style={avatar
                ? { backgroundImage: `url(${avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: avatarBg }}
            >
              {!avatar && username[0].toUpperCase()}
            </div>
            <div>
              <div className="sidebar-username">{username}</div>
              <div className="sidebar-user-actions">
                {theme === 'light' ? '浅色主题' : '深色主题'}
              </div>
            </div>
          </div>
          <div className="sidebar-icon-actions">
            <button
              aria-label="切换主题"
              className="sidebar-icon-button"
              onClick={toggleTheme}
              type="button"
            >
              {theme === 'light' ? '◐' : '☀'}
            </button>
            <button
              aria-label="退出登录"
              className="sidebar-icon-button"
              onClick={handleLogout}
              type="button"
            >
              ↗
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
