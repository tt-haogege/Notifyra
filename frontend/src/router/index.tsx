import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import OverviewPage from '../pages/OverviewPage';
import NotificationsListPage from '../pages/NotificationsListPage';
import NotificationFormPage from '../pages/NotificationFormPage';
import NotificationDetailPage from '../pages/NotificationDetailPage';
import ChannelsListPage from '../pages/ChannelsListPage';
import ChannelFormPage from '../pages/ChannelFormPage';
import ChannelDetailPage from '../pages/ChannelDetailPage';
import PushRecordsListPage from '../pages/PushRecordsListPage';
import PushRecordDetailPage from '../pages/PushRecordDetailPage';
import TestModulePage from '../pages/TestModulePage';
import SettingsPage from '../pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate replace to="/login" /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'notifications', element: <NotificationsListPage /> },
      { path: 'notifications/new', element: <NotificationFormPage /> },
      { path: 'notifications/:id', element: <NotificationDetailPage /> },
      { path: 'notifications/:id/edit', element: <NotificationFormPage /> },
      { path: 'channels', element: <ChannelsListPage /> },
      { path: 'channels/new', element: <ChannelFormPage /> },
      { path: 'channels/:id', element: <ChannelDetailPage /> },
      { path: 'channels/:id/edit', element: <ChannelFormPage /> },
      { path: 'push-records', element: <PushRecordsListPage /> },
      { path: 'push-records/:id', element: <PushRecordDetailPage /> },
      { path: 'test', element: <TestModulePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
