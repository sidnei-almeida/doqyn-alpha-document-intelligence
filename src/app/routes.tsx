import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { ProtectedRoute, PublicRoute } from '@/features/auth/ProtectedRoute';
import {
  AccessChoiceRoute,
  AuditRoute,
  CompanySignupRoute,
  DashboardRoute,
  DocumentSendRoute,
  DocumentsRoute,
  IndividualSignupRoute,
  RequestAccessRoute,
  RulesRoute,
  SettingsRoute,
  TermsRoute,
  TrackingRoute,
  UserManagementRouteLazy,
  VersioningRoute,
} from '@/app/lazyRoutes';

export const router = createBrowserRouter([
  { path: '/acesso', element: <AccessChoiceRoute /> },
  { path: '/solicitar-acesso', element: <RequestAccessRoute /> },
  { path: '/criar-empresa', element: <CompanySignupRoute /> },
  { path: '/criar-acesso-cpf', element: <IndividualSignupRoute /> },
  { path: '/termos', element: <TermsRoute /> },
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
          { path: '/dashboard', element: <DashboardRoute /> },
          { path: '/upload', element: <DocumentSendRoute /> },
          { path: '/rules', element: <RulesRoute /> },
          { path: '/users', element: <UserManagementRouteLazy /> },
          { path: '/documents', element: <DocumentsRoute /> },
          { path: '/versioning', element: <VersioningRoute /> },
          { path: '/audit', element: <AuditRoute /> },
          { path: '/tracking', element: <TrackingRoute /> },
          { path: '/settings', element: <SettingsRoute /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/upload" replace /> },
  { path: '*', element: <Navigate to="/upload" replace /> },
]);
