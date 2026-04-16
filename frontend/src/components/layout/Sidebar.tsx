import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Bell, Cable, History, FlaskConical, Settings,
  Sun, Moon, LogOut,
} from 'lucide-react';
import { authApi } from '../../api/auth';

const navItems = [
  { label: '概览',    to: '/overview',      icon: LayoutDashboard },
  { label: '通知管理', to: '/notifications',  icon: Bell },
  { label: '渠道管理', to: '/channels',       icon: Cable },
  { label: '推送记录', to: '/push-records',   icon: History },
  { label: '测试模块', to: '/test',           icon: FlaskConical },
  { label: '个人设置', to: '/settings',       icon: Settings },
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

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = theme === 'light' ? 'dark' : 'light';
    const root = document.documentElement;

    root.style.setProperty('--theme-x', `${e.clientX}px`);
    root.style.setProperty('--theme-y', `${e.clientY}px`);
    root.setAttribute('data-theme-direction', next === 'dark' ? 'to-dark' : 'to-light');

    const apply = () => {
      setTheme(next);
      root.setAttribute('data-theme', next);
    };

    const vt = (document as Document & { startViewTransition?: (cb: () => void) => void })
      .startViewTransition;

    if (vt) {
      vt.call(document, apply);
    } else {
      apply();
    }
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <item.icon size={17} strokeWidth={1.8} style={{ flexShrink: 0, opacity: 0.85 }} />
                {item.label}
              </span>
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
              onClick={(e) => toggleTheme(e)}
              type="button"
            >
              {theme === 'light' ? <Moon size={16} strokeWidth={1.8} /> : <Sun size={16} strokeWidth={1.8} />}
            </button>
            <button
              aria-label="退出登录"
              className="sidebar-icon-button"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
