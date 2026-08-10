import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { ProtectedRoute, PublicRoute } from '@/features/auth/ProtectedRoute';
import {
  AcceptInviteRoute,
  AccessChoiceRoute,
  AuditRoute,
  CompanySignupRoute,
  DashboardRoute,
  DocumentSendRoute,
  IndividualSignupRoute,
  LibraryRoute,
  OAuthCallbackRoute,
  OnboardingRoute,
  RequestAccessRoute,
  RulesRoute,
  ExpiryAlertsRoute,
  SettingsRoute,
  TermsRoute,
  TrackingRoute,
  UserManagementRouteLazy,
  VersioningRoute,
  ExternalSharePortalRoute,
  SignaturePortalRoute,
  SignatureVerificationRoute,
  InternalSignatureRoute,
} from '@/app/lazyRoutes';

export const router = createBrowserRouter([
  { path: '/guest/share/:token', element: <ExternalSharePortalRoute /> },
  { path: '/guest/sign/:token', element: <SignaturePortalRoute /> },
  { path: '/share/:token', element: <ExternalSharePortalRoute /> },
  { path: '/sign/:token', element: <SignaturePortalRoute /> },
  { path: '/verify/signature/:verificationCode', element: <SignatureVerificationRoute /> },
  { path: '/convite/:token', element: <AcceptInviteRoute /> },
  { path: '/acesso', element: <AccessChoiceRoute /> },
  { path: '/solicitar-acesso', element: <RequestAccessRoute /> },
  { path: '/criar-empresa', element: <CompanySignupRoute /> },
  { path: '/criar-acesso-cpf', element: <IndividualSignupRoute /> },
  { path: '/onboarding', element: <OnboardingRoute /> },
  { path: '/auth/oauth/callback', element: <OAuthCallbackRoute /> },
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
          { path: '/biblioteca', element: <LibraryRoute /> },
          // Views da Biblioteca (compartilhados, recentes, favoritos, lixeira, desativados)
          { path: '/biblioteca/:collection', element: <LibraryRoute /> },
          { path: '/assinaturas/:signatureRequestId', element: <InternalSignatureRoute /> },
          { path: '/dashboard', element: <DashboardRoute /> },
          // Rota legada de envio: fora da navegação, mantida até a fila unificada cobrir tudo.
          { path: '/upload', element: <DocumentSendRoute /> },
          { path: '/rules', element: <RulesRoute /> },
          { path: '/vencimentos', element: <ExpiryAlertsRoute /> },
          { path: '/users', element: <UserManagementRouteLazy /> },
          { path: '/documents', element: <Navigate to="/biblioteca" replace /> },
          { path: '/versioning', element: <VersioningRoute /> },
          { path: '/audit', element: <AuditRoute /> },
          { path: '/tracking', element: <TrackingRoute /> },
          { path: '/settings', element: <SettingsRoute /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/biblioteca" replace /> },
  { path: '*', element: <Navigate to="/biblioteca" replace /> },
]);
