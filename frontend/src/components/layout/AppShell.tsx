import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, Radio, Settings } from 'lucide-react';
import Sidebar from './Sidebar';

const navItems = [
  { label: '概览', to: '/overview', icon: LayoutDashboard },
  { label: '通知', to: '/notifications', icon: Bell },
  { label: '渠道', to: '/channels', icon: Radio },
  { label: '设置', to: '/settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activeIndex = navItems.findIndex((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="app-content">{children}</main>
      </div>
      <nav className="mobile-tab-bar">
        {activeIndex >= 0 && (
          <div
            className="mobile-tab-indicator"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'mobile-tab active' : 'mobile-tab'}
            >
              <Icon size={22} strokeWidth={1.8} />
              <span className="mobile-tab-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
