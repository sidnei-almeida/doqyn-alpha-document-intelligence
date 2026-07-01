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
const LazyRulesPage = lazyNamed(() => import('@/features/rules/RulesPage'), 'RulesPage');
const LazyDocumentsPage = lazyNamed(() => import('@/features/documents/DocumentsPage'), 'DocumentsPage');
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

export const AuditRoute = withRouteSuspense(LazyAuditPage);
export const RulesRoute = withRouteSuspense(LazyRulesPage);
export const DocumentsRoute = withRouteSuspense(LazyDocumentsPage);
export const DocumentSendRoute = withRouteSuspense(LazyDocumentSendPage);
export const UserManagementRouteLazy = withRouteSuspense(LazyUserManagementRoute);
export const SettingsRoute = withRouteSuspense(LazySettingsPage);
export const DashboardRoute = withRouteSuspense(LazyDashboardPage);
export const VersioningRoute = withRouteSuspense(LazyVersioningPage);
export const RequestAccessRoute = withRouteSuspense(LazyRequestAccessPage);
export const AccessChoiceRoute = withRouteSuspense(LazyAccessChoicePage);
export const CompanySignupRoute = withRouteSuspense(LazyCompanySignupPage);
export const IndividualSignupRoute = withRouteSuspense(LazyIndividualSignupPage);
