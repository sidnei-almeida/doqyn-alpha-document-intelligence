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
import { AccessChoicePage } from '@/features/access-request/AccessChoicePage';
import { CompanySignupPage } from '@/features/company-signup/CompanySignupPage';
import { IndividualSignupPage } from '@/features/individual-signup/IndividualSignupPage';

export const router = createBrowserRouter([
  { path: '/acesso', element: <AccessChoicePage /> },
  { path: '/solicitar-acesso', element: <RequestAccessPage /> },
  { path: '/criar-empresa', element: <CompanySignupPage /> },
  { path: '/criar-acesso-cpf', element: <IndividualSignupPage /> },
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
