import { lazy, Suspense, type ComponentType } from 'react';
import { RouteLoadingFallback } from '@/components/layout/RouteLoadingFallback';

function lazyNamed<T extends Record<string, ComponentType<object>>>(
  importer: () => Promise<T>,
  exportName: keyof T & string,
) {
  return lazy(() => importer().then((mod) => ({ default: mod[exportName] })));
}

function withRouteSuspense(LazyComponent: ReturnType<typeof lazyNamed>) {
  return function LazyRouteElement() {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyComponent />
      </Suspense>
    );
  };
}

const LazyAuditPage = lazyNamed(() => import('@/features/audit/AuditPage'), 'AuditPage');
const LazyRulesRoute = lazyNamed(
  () => import('@/features/rules/RulesRoute'),
  'RulesRoute',
);
const LazyExpiryAlertsPage = lazyNamed(
  () => import('@/features/expiry/ExpiryAlertsPage'),
  'ExpiryAlertsPage',
);
const LazyLibraryPage = lazyNamed(() => import('@/features/library/LibraryPage'), 'LibraryPage');
const LazyDocumentSendPage = lazyNamed(
  () => import('@/features/document-send/DocumentSendPage'),
  'DocumentSendPage',
);
const LazyUserManagementRoute = lazyNamed(
  () => import('@/features/users/UserManagementRoute'),
  'UserManagementRoute',
);
const LazySettingsPage = lazyNamed(() => import('@/features/documents/SettingsPage'), 'SettingsPage');
const LazyDashboardPage = lazyNamed(() => import('@/features/documents/DashboardPage'), 'DashboardPage');
const LazyVersioningPage = lazyNamed(
  () => import('@/features/versioning/VersioningPage'),
  'VersioningPage',
);
const LazyRequestAccessPage = lazyNamed(
  () => import('@/features/access-request/RequestAccessPage'),
  'RequestAccessPage',
);
const LazyAccessChoicePage = lazyNamed(
  () => import('@/features/access-request/AccessChoicePage'),
  'AccessChoicePage',
);
const LazyCompanySignupPage = lazyNamed(
  () => import('@/features/company-signup/CompanySignupPage'),
  'CompanySignupPage',
);
const LazyIndividualSignupPage = lazyNamed(
  () => import('@/features/individual-signup/IndividualSignupPage'),
  'IndividualSignupPage',
);
const LazyTermsPage = lazyNamed(() => import('@/pages/TermsPage'), 'TermsPage');
const LazyOAuthCallbackPage = lazyNamed(
  () => import('@/pages/OAuthCallbackPage'),
  'OAuthCallbackPage',
);
const LazyOnboardingPage = lazyNamed(() => import('@/pages/OnboardingPage'), 'OnboardingPage');
const LazyAcceptInvitePage = lazyNamed(
  () => import('@/features/invite/AcceptInvitePage'),
  'AcceptInvitePage',
);
const LazyConfirmEmailChangePage = lazyNamed(
  () => import('@/features/settings/ConfirmEmailChangePage'),
  'ConfirmEmailChangePage',
);

const LazyTrackingRoute = lazyNamed(
  () => import('@/features/tracking/TrackingRoute'),
  'TrackingRoute',
);

const LazyExternalSharePortalPage = lazyNamed(
  () => import('@/features/external-share/ExternalSharePortalPage'),
  'ExternalSharePortalPage',
);

const LazySignaturePortalPage = lazyNamed(
  () => import('@/features/signature/SignaturePortalPage'),
  'SignaturePortalPage',
);

const LazySignatureVerificationPage = lazyNamed(
  () => import('@/features/signature/SignatureVerificationPage'),
  'SignatureVerificationPage',
);

const LazyInternalSignaturePage = lazyNamed(
  () => import('@/features/signature/InternalSignaturePage'),
  'InternalSignaturePage',
);

export const TrackingRoute = withRouteSuspense(LazyTrackingRoute);
export const ExternalSharePortalRoute = withRouteSuspense(LazyExternalSharePortalPage);
export const SignaturePortalRoute = withRouteSuspense(LazySignaturePortalPage);
export const SignatureVerificationRoute = withRouteSuspense(LazySignatureVerificationPage);
export const InternalSignatureRoute = withRouteSuspense(LazyInternalSignaturePage);
export const AuditRoute = withRouteSuspense(LazyAuditPage);
export const RulesRoute = withRouteSuspense(LazyRulesRoute);
export const ExpiryAlertsRoute = withRouteSuspense(LazyExpiryAlertsPage);
export const LibraryRoute = withRouteSuspense(LazyLibraryPage);
export const DocumentSendRoute = withRouteSuspense(LazyDocumentSendPage);
export const UserManagementRouteLazy = withRouteSuspense(LazyUserManagementRoute);
export const SettingsRoute = withRouteSuspense(LazySettingsPage);
export const DashboardRoute = withRouteSuspense(LazyDashboardPage);
export const VersioningRoute = withRouteSuspense(LazyVersioningPage);
export const RequestAccessRoute = withRouteSuspense(LazyRequestAccessPage);
export const AccessChoiceRoute = withRouteSuspense(LazyAccessChoicePage);
export const CompanySignupRoute = withRouteSuspense(LazyCompanySignupPage);
export const IndividualSignupRoute = withRouteSuspense(LazyIndividualSignupPage);
export const TermsRoute = withRouteSuspense(LazyTermsPage);
export const OAuthCallbackRoute = withRouteSuspense(LazyOAuthCallbackPage);
export const OnboardingRoute = withRouteSuspense(LazyOnboardingPage);
export const AcceptInviteRoute = withRouteSuspense(LazyAcceptInvitePage);
export const ConfirmEmailChangeRoute = withRouteSuspense(LazyConfirmEmailChangePage);
