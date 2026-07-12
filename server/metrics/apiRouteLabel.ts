/** Normaliza paths da API para labels Prometheus (evita cardinalidade explosiva). */

const STATIC_PREFIXES = [
  '/api/health',
  '/api/health/deep',
  '/api/metrics',
  '/api/auth/',
  '/api/ai/',
  '/api/documents',
  '/api/dashboard/',
  '/api/audit',
  '/api/tracking/',
  '/api/trash/',
  '/api/settings/',
  '/api/internal/',
];

export function normalizeApiRouteLabel(pathname: string): string {
  if (!pathname.startsWith('/api/')) {
    return pathname || '/';
  }

  if (pathname === '/api/health' || pathname === '/api/health/deep' || pathname === '/api/metrics') {
    return pathname;
  }

  if (pathname.startsWith('/api/ai/jobs/')) {
    return '/api/ai/jobs/:jobId';
  }

  if (pathname.startsWith('/api/documents/') && pathname.includes('/signature-requests/')) {
    return '/api/documents/:documentId/signature-requests/:signatureRequestId';
  }

  if (pathname.startsWith('/api/documents/') && pathname.endsWith('/signature-requests')) {
    return '/api/documents/:documentId/signature-requests';
  }

  if (pathname.startsWith('/api/documents/') && pathname.includes('/external-shares/')) {
    return '/api/documents/:documentId/external-shares/:shareId';
  }

  if (pathname.startsWith('/api/documents/') && pathname.endsWith('/external-shares')) {
    return '/api/documents/:documentId/external-shares';
  }

  if (pathname.startsWith('/api/documents/') && pathname.includes('/versions/')) {
    return '/api/documents/:documentId/versions/:versionId';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/versions$/)) {
    return '/api/documents/:documentId/versions';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/restore$/)) {
    return '/api/documents/:documentId/restore';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/permanent$/)) {
    return '/api/documents/:documentId/permanent';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/trash$/)) {
    return '/api/documents/:documentId/trash';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/move$/)) {
    return '/api/documents/:documentId/move';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/share$/)) {
    return '/api/documents/:documentId/share';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/favorite$/)) {
    return '/api/documents/:documentId/favorite';
  }

  if (pathname.match(/^\/api\/documents\/[^/]+$/)) {
    return '/api/documents/:documentId';
  }

  if (pathname.startsWith('/api/signature-requests/') && pathname.endsWith('/cancel')) {
    return '/api/signature-requests/:signatureRequestId/cancel';
  }

  if (pathname.startsWith('/api/signature-requests/') && pathname.endsWith('/evidence')) {
    return '/api/signature-requests/:signatureRequestId/evidence';
  }

  if (pathname.startsWith('/api/signature-requests/') && pathname.endsWith('/preview')) {
    return '/api/signature-requests/:signatureRequestId/preview';
  }

  if (pathname.startsWith('/api/signature-requests/') && pathname.endsWith('/signed-pdf')) {
    return '/api/signature-requests/:signatureRequestId/signed-pdf';
  }

  if (pathname.startsWith('/api/signature-requests/') && pathname.endsWith('/signing-payload')) {
    return '/api/signature-requests/:signatureRequestId/signing-payload';
  }

  if (pathname.match(/^\/api\/signature-requests\/[^/]+$/)) {
    return '/api/signature-requests/:signatureRequestId';
  }

  if (pathname.startsWith('/api/sign/') && pathname.endsWith('/signed-pdf')) {
    return '/api/sign/:token/signed-pdf';
  }

  if (pathname.startsWith('/api/sign/') && pathname.endsWith('/preview')) {
    return '/api/sign/:token/preview';
  }

  if (pathname.startsWith('/api/sign/') && pathname.endsWith('/sign')) {
    return '/api/sign/:token/sign';
  }

  if (pathname.match(/^\/api\/sign\/[^/]+$/)) {
    return '/api/sign/:token';
  }

  if (pathname.startsWith('/api/guest/share/')) {
    return '/api/guest/share/:token';
  }

  if (pathname.startsWith('/api/guest/sign/')) {
    return '/api/guest/sign/:token';
  }

  if (pathname.startsWith('/api/og/guest/share/')) {
    return '/api/og/guest/share/:token';
  }

  if (pathname.startsWith('/api/og/guest/sign/')) {
    return '/api/og/guest/sign/:token';
  }

  if (pathname.match(/^\/api\/[^/]+\/[^/]+$/)) {
    for (const prefix of STATIC_PREFIXES) {
      if (pathname.startsWith(prefix.replace(/\/$/, ''))) {
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length === 3) {
          return `/api/${segments[1]}/:id`;
        }
      }
    }
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 3) {
    return pathname;
  }

  return `/${segments.slice(0, 3).join('/')}/:id`;
}
