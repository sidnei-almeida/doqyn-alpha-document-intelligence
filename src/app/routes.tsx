import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { ProtectedRoute, PublicRoute } from '@/features/auth/ProtectedRoute';
import { AuditPage } from '@/features/audit/AuditPage';
import { DashboardPage } from '@/features/documents/DashboardPage';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { SettingsPage } from '@/features/documents/SettingsPage';
import { DocumentSendPage } from '@/features/document-send/DocumentSendPage';
import { RulesPage } from '@/features/rules/RulesPage';
import { UserManagementRoute } from '@/features/users/UserManagementRoute';
import { VersioningPage } from '@/features/versioning/VersioningPage';

import { RequestAccessPage } from '@/features/access-request/RequestAccessPage';

export const router = createBrowserRouter([
  { path: '/solicitar-acesso', element: <RequestAccessPage /> },
  {
    element: <PublicRoute />,
    children: [{ path: '/login', element: <Login /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/upload', element: <DocumentSendPage /> },
          { path: '/rules', element: <RulesPage /> },
          { path: '/users', element: <UserManagementRoute /> },
          { path: '/documents', element: <DocumentsPage /> },
          { path: '/versioning', element: <VersioningPage /> },
          { path: '/audit', element: <AuditPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/upload" replace /> },
  { path: '*', element: <Navigate to="/upload" replace /> },
]);
