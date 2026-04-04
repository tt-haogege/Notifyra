import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/common/Toast';
import { AppShell } from './components/layout/AppShell';

const authRoutes = new Set(['/login', '/register']);

function App() {
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('accessToken');
  const isAuthRoute = authRoutes.has(location.pathname);

  if (!isAuthenticated && !isAuthRoute) {
    return <Navigate replace to="/login" />;
  }

  if (isAuthenticated && isAuthRoute) {
    return <Navigate replace to="/overview" />;
  }

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <ToastProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ToastProvider>
  );
}

export default App;
