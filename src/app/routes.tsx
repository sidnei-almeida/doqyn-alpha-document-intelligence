import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { ProtectedRoute, PublicRoute } from '@/features/auth/ProtectedRoute';
import { AuthSplitShell } from '@/components/layout/AuthSplitShell';
import {
  AcceptInviteRoute,
  AccessChoiceRoute,
  AuditRoute,
  CompanySignupRoute,
  ConfirmEmailChangeRoute,
  ContactsRoute,
  DashboardRoute,
  EmailVerificationRoute,
  IndividualSignupRoute,
  LibraryRoute,
  DocumentRequestsRoute,
  OAuthCallbackRoute,
  OnboardingRoute,
  MatrixRoute,
  RulesRoute,
  NotificationsRoute,
  SettingsRoute,
  TermsRoute,
  TrackingRoute,
  UserManagementRouteLazy,
  VerifyEmailLinkRoute,
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
  // A página desenha a própria casca (logo, tema), então fica fora da antessala. A rota faltava:
  // o auth-service já mandava este endereço no e-mail de troca, e quem clicava caía no curinga e
  // era jogado na biblioteca sem que a troca acontecesse.
  { path: '/confirmar-email/:token', element: <ConfirmEmailChangeRoute /> },
  // A antessala é rota de layout: o painel do documento fica montado enquanto a
  // pessoa circula entre entrar, escolher como começar e se cadastrar. Só a
  // coluna do formulário transiciona.
  {
    element: <AuthSplitShell />,
    children: [
      { element: <PublicRoute />, children: [{ path: '/login', element: <Login /> }] },
      { path: '/acesso', element: <AccessChoiceRoute /> },
      // Quem chega por convite entra pela mesma porta que todo mundo: mesma casca, mesmo
      // painel lendo um documento ao lado. Era a única entrada que montava a própria tela.
      { path: '/convite/:token', element: <AcceptInviteRoute /> },
      { path: '/criar-empresa', element: <CompanySignupRoute /> },
      { path: '/criar-acesso-cpf', element: <IndividualSignupRoute /> },
      // Confirmação de e-mail. Fica na antessala, e fora do `PublicRoute`, de propósito: quem
      // chega aqui não tem sessão (o login recusou) e não pode ser mandado para a biblioteca por
      // um guarda que só sabe perguntar se já está logado.
      { path: '/confirmar-cadastro', element: <EmailVerificationRoute /> },
      { path: '/verificar-email/:token', element: <VerifyEmailLinkRoute /> },
      { path: '/onboarding', element: <OnboardingRoute /> },
    ],
  },
  { path: '/sso/callback', element: <OAuthCallbackRoute /> },
  { path: '/termos', element: <TermsRoute /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/biblioteca', element: <LibraryRoute /> },
          // Views da Biblioteca (compartilhados, recentes, favoritos, lixeira, desativados)
          { path: '/biblioteca/:collection', element: <LibraryRoute /> },
          // Fora de `/biblioteca/:collection` de propósito: aquela rota lista documentos, e um
          // pedido só vira documento quando alguém envia.
          { path: '/pedidos', element: <DocumentRequestsRoute /> },
          // Fora de `/biblioteca/:collection` pelo mesmo motivo dos pedidos: aquela rota lista
          // documentos, e um contato não é um.
          { path: '/contatos', element: <ContactsRoute /> },
          { path: '/assinaturas/:signatureRequestId', element: <InternalSignatureRoute /> },
          { path: '/dashboard', element: <DashboardRoute /> },
          { path: '/rules', element: <RulesRoute /> },
          { path: '/matriz', element: <MatrixRoute /> },
          { path: '/notificacoes', element: <NotificationsRoute /> },
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
