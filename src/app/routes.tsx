import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { ProtectedRoute, PublicRoute } from '@/features/auth/ProtectedRoute';
import { AuthSplitShell } from '@/components/layout/AuthSplitShell';
import { LegacyRedirect } from './LegacyRedirect';
import { LEGACY_ROUTE_ROOTS } from './legacyRoutes';
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
  RequestPasswordResetRoute,
  ResetPasswordRoute,
  RulesRoute,
  NotificationsRoute,
  SettingsRoute,
  TermsRoute,
  TrackingRoute,
  UserManagementRouteLazy,
  VerifyEmailLinkRoute,
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
  { path: '/confirm-email-change/:token', element: <ConfirmEmailChangeRoute /> },
  // A antessala é rota de layout: o painel do documento fica montado enquanto a
  // pessoa circula entre entrar, escolher como começar e se cadastrar. Só a
  // coluna do formulário transiciona.
  {
    element: <AuthSplitShell />,
    children: [
      { element: <PublicRoute />, children: [{ path: '/login', element: <Login /> }] },
      { path: '/access', element: <AccessChoiceRoute /> },
      // Quem chega por convite entra pela mesma porta que todo mundo: mesma casca, mesmo
      // painel lendo um documento ao lado. Era a única entrada que montava a própria tela.
      { path: '/invite/:token', element: <AcceptInviteRoute /> },
      { path: '/signup/company', element: <CompanySignupRoute /> },
      { path: '/signup/individual', element: <IndividualSignupRoute /> },
      // Confirmação de e-mail. Fica na antessala, e fora do `PublicRoute`, de propósito: quem
      // chega aqui não tem sessão (o login recusou) e não pode ser mandado para a biblioteca por
      // um guarda que só sabe perguntar se já está logado.
      { path: '/verify-email', element: <EmailVerificationRoute /> },
      { path: '/verify-email/:token', element: <VerifyEmailLinkRoute /> },
      // Pedir redefinição de senha. Fora do `PublicRoute` pelo mesmo motivo de
      // `/reset-password/:token` — ver o comentário completo naquela rota.
      { path: '/forgot-password', element: <RequestPasswordResetRoute /> },
      // O endereço que o e-mail de redefinição já manda. Fora do `PublicRoute` de propósito: quem
      // abre este link pode ter uma sessão válida ativa noutra aba — o próprio motivo de existir a
      // redefinição é funcionar independente disso, inclusive para quem suspeita da própria conta
      // comprometida. E `resetPassword` revoga todas as sessões no sucesso: um guarda que manda
      // quem já está logado direto para a biblioteca impediria exatamente o caso que mais importa.
      { path: '/reset-password/:token', element: <ResetPasswordRoute /> },
      { path: '/onboarding', element: <OnboardingRoute /> },
    ],
  },
  { path: '/sso/callback', element: <OAuthCallbackRoute /> },
  { path: '/terms', element: <TermsRoute /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/library', element: <LibraryRoute /> },
          // Views da Biblioteca (compartilhados, recentes, favoritos, lixeira, desativados)
          { path: '/library/:collection', element: <LibraryRoute /> },
          // Fora de `/library/:collection` de propósito: aquela rota lista documentos, e um
          // pedido só vira documento quando alguém envia.
          { path: '/requests', element: <DocumentRequestsRoute /> },
          // Fora de `/library/:collection` pelo mesmo motivo dos pedidos: aquela rota lista
          // documentos, e um contato não é um.
          { path: '/contacts', element: <ContactsRoute /> },
          { path: '/signatures/:signatureRequestId', element: <InternalSignatureRoute /> },
          { path: '/dashboard', element: <DashboardRoute /> },
          { path: '/rules', element: <RulesRoute /> },
          { path: '/access-matrix', element: <MatrixRoute /> },
          { path: '/notifications', element: <NotificationsRoute /> },
          { path: '/users', element: <UserManagementRouteLazy /> },
          { path: '/documents', element: <Navigate to="/library" replace /> },
          { path: '/audit', element: <AuditRoute /> },
          { path: '/tracking', element: <TrackingRoute /> },
          { path: '/settings', element: <SettingsRoute /> },
        ],
      },
    ],
  },
  // Endereços antigos em português. Fora de toda casca e de todo guarda: o redirect acontece
  // primeiro, e quem decide sessão é a rota nova. Ver `legacyRoutes.ts`.
  ...LEGACY_ROUTE_ROOTS.map((root) => ({ path: `/${root}/*`, element: <LegacyRedirect /> })),
  { path: '/', element: <Navigate to="/library" replace /> },
  { path: '*', element: <Navigate to="/library" replace /> },
]);
