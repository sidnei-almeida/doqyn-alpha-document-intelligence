import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { initGeoIpCityReader } from './services/tracking/geoIpResolver.js';
import { connectRedisOnBoot } from './redis/redisClient.js';
import { startInProcessAnalysisWorker } from './workers/analysisWorker.js';
import { initPrometheusMetrics, recordHttpRequest } from './metrics/prometheus.js';
import { normalizeApiRouteLabel } from './metrics/apiRouteLabel.js';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

type RouteMatch = {
  loader: () => Promise<{ default: ApiHandler }>;
  params: Record<string, string>;
};

type RoutePattern = {
  regex: RegExp;
  loader: RouteMatch['loader'];
  paramKeys?: string[];
};

const staticRoutes: Record<string, () => Promise<{ default: ApiHandler }>> = {
  '/api/health': () => import('../api/health.js'),
  '/api/health/deep': () => import('../api/health/deep.js'),
  '/api/geo/detect-country': () => import('../api/geo/detect-country.js'),
  '/api/metrics': () => import('../api/metrics.js'),
  '/api/auth/login': () => import('../api/auth/login.js'),
  '/api/auth/me': () => import('../api/auth/me.js'),
  '/api/me': () => import('../api/me.js'),
  '/api/auth/logout': () => import('../api/auth/logout.js'),
  '/api/documents': () => import('../api/documents/index.js'),
  '/api/documents/upload': () => import('../api/documents/upload.js'),
  '/api/documents/upload-url': () => import('../api/documents/upload-url.js'),
  '/api/documents/download': () => import('../api/documents/download.js'),
  '/api/documents/preview': () => import('../api/documents/preview.js'),
  '/api/documents/confirm-analysis': () => import('../api/documents/confirm-analysis.js'),
  '/api/documents/submit-upload-approval': () => import('../api/documents/submit-upload-approval.js'),
  '/api/documents/upload-approvals': () => import('../api/documents/upload-approvals/index.js'),
  '/api/documents/confirm-update': () => import('../api/documents/confirm-update.js'),
  '/api/dashboard/overview': () => import('../api/dashboard/overview.js'),
  '/api/document-rules/active': () => import('../api/document-rules/active.js'),
  '/api/document-rules': () => import('../api/document-rules/index.js'),
  '/api/document-rules/matrix': () => import('../api/document-rules/matrix.js'),
  '/api/access-groups': () => import('../api/access-groups/index.js'),
  '/api/auth/access-requests': () => import('../api/auth/access-requests.js'),
  '/api/internal/tenants/provision': () => import('../api/internal/tenants/provision.js'),
  '/api/internal/tenant-members/sync': () => import('../api/internal/tenant-members/sync.js'),
  '/api/company-members': () => import('../api/company-members/index.js'),
  '/api/company-members/invite': () => import('../api/company-members/invite.js'),
  '/api/document-classes': () => import('../api/document-classes/index.js'),
  '/api/document-categories': () => import('../api/document-categories/index.js'),
  '/api/document-groups': () => import('../api/document-groups/index.js'),
  '/api/document-extraction-rules': () => import('../api/document-extraction-rules/index.js'),
  '/api/audit': () => import('../api/audit/index.js'),
  '/api/audit/overview': () => import('../api/audit/overview.js'),
  '/api/tracking/document-events': () => import('../api/tracking/document-events.js'),
  '/api/tracking/summary': () => import('../api/tracking/summary.js'),
  '/api/tracking/client-event': () => import('../api/tracking/client-event.js'),
  '/api/favorites/documents': () => import('../api/favorites/documents.js'),
  '/api/shared-with-me/documents': () => import('../api/shared-with-me/documents.js'),
  '/api/share/users': () => import('../api/share/users.js'),
  '/api/profile/me': () => import('../api/profile/me.js'),
  '/api/profile/avatar': () => import('../api/profile/avatar.js'),
  '/api/ai/analyze-pdf': () => import('../api/ai/analyze-pdf.js'),
  '/api/ai/analyze-pdf-update': () => import('../api/ai/analyze-pdf-update.js'),
  '/api/documents/rag-query': () => import('../api/documents/rag-query.js'),
  '/api/trash/documents': () => import('../api/trash/documents.js'),
  '/api/deactivated/documents': () => import('../api/deactivated/documents.js'),
  '/api/settings/trash-retention': () => import('../api/settings/trash-retention.js'),
  '/api/documents/batch/trash': () => import('../api/documents/batch/trash.js'),
  '/api/documents/batch/restore': () => import('../api/documents/batch/restore.js'),
  '/api/documents/batch/reactivate': () => import('../api/documents/batch/reactivate.js'),
  '/api/documents/batch/permanent-delete': () => import('../api/documents/batch/permanent-delete.js'),
  '/api/documents/batch/move': () => import('../api/documents/batch/move.js'),
};

function resolveRoute(pathname: string): RouteMatch | null {
  const exact = staticRoutes[pathname];
  if (exact) {
    return { loader: exact, params: {} };
  }

  const patterns: RoutePattern[] = [
    {
      regex: /^\/api\/access-groups\/([^/]+)\/toggle-active$/,
      loader: () => import('../api/access-groups/toggle-active.js'),
    },
    { regex: /^\/api\/access-groups\/([^/]+)$/, loader: () => import('../api/access-groups/item.js') },
    {
      regex: /^\/api\/company-members\/([^/]+)\/approve$/,
      loader: () => import('../api/company-members/approve.js'),
    },
    {
      regex: /^\/api\/company-members\/([^/]+)\/reject$/,
      loader: () => import('../api/company-members/reject.js'),
    },
    {
      regex: /^\/api\/company-members\/([^/]+)\/block$/,
      loader: () => import('../api/company-members/block.js'),
    },
    {
      regex: /^\/api\/company-members\/([^/]+)\/activate$/,
      loader: () => import('../api/company-members/activate.js'),
    },
    {
      regex: /^\/api\/company-members\/([^/]+)\/access$/,
      loader: () => import('../api/company-members/access.js'),
    },
    {
      regex: /^\/api\/company-members\/([^/]+)\/status$/,
      loader: () => import('../api/company-members/status.js'),
    },
    {
      regex: /^\/api\/company-members\/([^/]+)\/groups$/,
      loader: () => import('../api/company-members/groups.js'),
    },
    { regex: /^\/api\/company-members\/([^/]+)$/, loader: () => import('../api/company-members/item.js') },
    {
      regex: /^\/api\/document-classes\/([^/]+)\/toggle-active$/,
      loader: () => import('../api/document-classes/toggle-active.js'),
    },
    {
      regex: /^\/api\/document-classes\/([^/]+)\/permissions$/,
      loader: () => import('../api/document-classes/permissions.js'),
    },
    {
      regex: /^\/api\/document-classes\/([^/]+)\/notifications$/,
      loader: () => import('../api/document-classes/notifications.js'),
    },
    { regex: /^\/api\/document-classes\/([^/]+)$/, loader: () => import('../api/document-classes/item.js') },
    {
      regex: /^\/api\/document-categories\/([^/]+)\/toggle-active$/,
      loader: () => import('../api/document-categories/toggle-active.js'),
    },
    { regex: /^\/api\/document-categories\/([^/]+)$/, loader: () => import('../api/document-categories/item.js') },
    {
      regex: /^\/api\/document-groups\/([^/]+)\/members$/,
      loader: () => import('../api/document-groups/members.js'),
    },
    { regex: /^\/api\/document-groups\/([^/]+)$/, loader: () => import('../api/document-groups/item.js') },
    {
      regex: /^\/api\/document-extraction-rules\/([^/]+)$/,
      loader: () => import('../api/document-extraction-rules/item.js'),
    },
    {
      regex: /^\/api\/document-rules\/([^/]+)\/toggle-active$/,
      loader: () => import('../api/document-rules/toggle-active.js'),
    },
    { regex: /^\/api\/document-rules\/([^/]+)$/, loader: () => import('../api/document-rules/item.js') },
    {
      regex: /^\/api\/documents\/upload-approvals\/([^/]+)\/approve$/,
      loader: () => import('../api/documents/upload-approvals/[approvalId]/approve.js'),
      paramKeys: ['approvalId'],
    },
    {
      regex: /^\/api\/documents\/upload-approvals\/([^/]+)\/reject$/,
      loader: () => import('../api/documents/upload-approvals/[approvalId]/reject.js'),
      paramKeys: ['approvalId'],
    },
    {
      regex: /^\/api\/ai\/jobs\/([^/]+)$/,
      loader: () => import('../api/ai/jobs/[jobId].js'),
      paramKeys: ['jobId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/trash$/,
      loader: () => import('../api/documents/[documentId]/trash.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/restore$/,
      loader: () => import('../api/documents/[documentId]/restore.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/reactivate$/,
      loader: () => import('../api/documents/[documentId]/reactivate.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/permanent$/,
      loader: () => import('../api/documents/[documentId]/permanent.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/versions$/,
      loader: () => import('../api/documents/[documentId]/versions.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/favorite$/,
      loader: () => import('../api/documents/[documentId]/favorite.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/chat$/,
      loader: () => import('../api/documents/[documentId]/chat.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/external-shares\/([^/]+)\/regenerate-invite$/,
      loader: () =>
        import('../api/documents/[documentId]/external-shares/[shareId]/regenerate-invite.js'),
      paramKeys: ['documentId', 'shareId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/external-shares\/([^/]+)$/,
      loader: () => import('../api/documents/[documentId]/external-shares/[shareId].js'),
      paramKeys: ['documentId', 'shareId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/external-shares$/,
      loader: () => import('../api/documents/[documentId]/external-shares.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/signature-requests\/([^/]+)\/cancel$/,
      loader: () =>
        import('../api/documents/[documentId]/signature-requests/[signatureRequestId]/cancel.js'),
      paramKeys: ['documentId', 'signatureRequestId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/signature-requests$/,
      loader: () => import('../api/documents/[documentId]/signature-requests.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/signature-requests\/assigned-to-me$/,
      loader: () => import('../api/signature-requests/assigned-to-me.js'),
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/preview(?:\/.*)?$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/preview.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/signing-payload$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/signing-payload.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/signed-pdf$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/signed-pdf.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/evidence$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/evidence.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/sign$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/sign.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/decline$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/decline.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)\/cancel$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/cancel.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/signature-requests\/([^/]+)$/,
      loader: () => import('../api/signature-requests/[signatureRequestId]/index.js'),
      paramKeys: ['signatureRequestId'],
    },
    {
      regex: /^\/api\/og\/guest\/share\/([^/]+)\/image$/,
      loader: () => import('../api/og/guest/share/[token]/image.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/og\/guest\/share\/([^/]+)$/,
      loader: () => import('../api/og/guest/share/[token].js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/og\/guest\/sign\/([^/]+)\/image$/,
      loader: () => import('../api/og/guest/sign/[token]/image.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/og\/guest\/sign\/([^/]+)$/,
      loader: () => import('../api/og/guest/sign/[token].js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/sign\/([^/]+)\/preview(?:\/.*)?$/,
      loader: () => import('../api/sign/[token]/preview.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/sign\/([^/]+)\/signed-pdf$/,
      loader: () => import('../api/sign/[token]/signed-pdf.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/sign\/([^/]+)\/sign$/,
      loader: () => import('../api/sign/[token]/sign.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/sign\/([^/]+)$/,
      loader: () => import('../api/sign/[token]/index.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/verify\/signature\/([^/]+)$/,
      loader: () => import('../api/verify/signature/[verificationCode].js'),
      paramKeys: ['verificationCode'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/shares\/([^/]+)$/,
      loader: () => import('../api/documents/[documentId]/shares/[shareId].js'),
      paramKeys: ['documentId', 'shareId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/shares$/,
      loader: () => import('../api/documents/[documentId]/shares.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/move$/,
      loader: () => import('../api/documents/[documentId]/move.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/transfer-ownership$/,
      loader: () => import('../api/documents/[documentId]/transfer-ownership.js'),
      paramKeys: ['documentId'],
    },
    {
      regex: /^\/api\/external-shares\/([^/]+)\/accept$/,
      loader: () => import('../api/external-shares/[token]/accept.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/external-shares\/([^/]+)\/preview(?:\/.*)?$/,
      loader: () => import('../api/external-shares/[token]/preview.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/external-shares\/([^/]+)\/download$/,
      loader: () => import('../api/external-shares/[token]/download.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/external-shares\/([^/]+)\/document$/,
      loader: () => import('../api/external-shares/[token]/document.js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/external-shares\/([^/]+)$/,
      loader: () => import('../api/external-shares/[token].js'),
      paramKeys: ['token'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/versions\/([^/]+)\/preview\/manifest$/,
      loader: () => import('../api/documents/preview-manifest.js'),
      paramKeys: ['documentId', 'versionId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/versions\/([^/]+)\/preview\/pages\/([^/]+)$/,
      loader: () => import('../api/documents/preview-page.js'),
      paramKeys: ['documentId', 'versionId', 'page'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/versions\/([^/]+)\/preview\/thumbnails\/([^/]+)$/,
      loader: () => import('../api/documents/preview-thumbnail.js'),
      paramKeys: ['documentId', 'versionId', 'page'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/versions\/([^/]+)\/preview\/image$/,
      loader: () => import('../api/documents/preview-image.js'),
      paramKeys: ['documentId', 'versionId'],
    },
    {
      regex: /^\/api\/documents\/([^/]+)\/timeline$/,
      loader: () => import('../api/documents/timeline.js'),
    },
    {
      regex: /^\/api\/documents\/([^/]+)$/,
      loader: () => import('../api/documents/item.js'),
    },
    {
      regex: /^\/api\/tracking\/document-events\/([^/]+)$/,
      loader: () => import('../api/tracking/document-events-item.js'),
    },
    {
      regex: /^\/api\/users\/([^/]+)\/avatar$/,
      loader: () => import('../api/users/user-avatar.js'),
      paramKeys: ['userId'],
    },
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern.regex);
    if (match) {
      const params: Record<string, string> = {};
      const keys = pattern.paramKeys ?? ['id'];
      keys.forEach((key, index) => {
        const value = match[index + 1];
        if (value) params[key] = value;
      });

      if (!pattern.paramKeys) {
        const captured = match[1] ?? '';
        params.id = captured;
        params.memberId = captured;
        if (pattern.regex.source.includes('document-groups')) {
          params.groupId = captured;
        }
        if (pattern.regex.source.includes('documents')) {
          params.documentId = captured;
        }
        if (pattern.regex.source.includes('tracking')) {
          params.eventId = captured;
        }
      }

      return { loader: pattern.loader, params };
    }
  }

  return null;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function toVercelReq(
  req: IncomingMessage,
  query: Record<string, string>,
  body?: unknown,
): IncomingMessage & { query: Record<string, string>; body?: unknown } {
  return Object.assign(req, { query, body });
}

function toVercelRes(res: ServerResponse) {
  return Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(data: unknown) {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(data));
    },
    send(data: string | Buffer | Uint8Array) {
      res.end(data);
    },
  });
}

const PORT = Number(process.env.API_PORT ?? 3001);

export async function startApiServer(): Promise<void> {
  initPrometheusMetrics();
  await connectRedisOnBoot();
  startInProcessAnalysisWorker();

  const server = createServer(async (req, res) => {
    const startedAt = process.hrtime.bigint();
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pathname = url.pathname;
    const routeLabel = normalizeApiRouteLabel(pathname);
    let recordedMetrics = false;

    const recordMetrics = () => {
      if (recordedMetrics) return;
      recordedMetrics = true;
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      recordHttpRequest({
        method,
        route: routeLabel,
        statusCode: res.statusCode || 500,
        durationSeconds,
      });
    };

    res.on('finish', recordMetrics);

    const route = resolveRoute(pathname);
    if (!route) {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not found' }));
      return;
    }

    try {
      let body: unknown;
      const query: Record<string, string> = { ...route.params };
      url.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      const contentType = req.headers['content-type'] ?? '';
      const isMultipart = contentType.includes('multipart/form-data');

      if (
        !isMultipart &&
        (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
      ) {
        const raw = await readBody(req);
        if (raw) {
          body = contentType.includes('application/json') ? JSON.parse(raw) : raw;
        }
      }

      const mod = await route.loader();
      const vercelReq = toVercelReq(req, query, body);
      const vercelRes = toVercelRes(res);
      await mod.default(vercelReq as unknown as VercelRequest, vercelRes as unknown as VercelResponse);
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    const mode = process.env.NODE_ENV === 'production' ? 'produção' : 'desenvolvimento';
    console.log(`DOQYN API (${mode}) em http://0.0.0.0:${PORT}`);
  });

  void initGeoIpCityReader()
    .then(() => {
      console.log('GeoIP City (GeoLite2) pronto para tracking.');
    })
    .catch(() => {
      console.warn('GeoIP City indisponível — tracking usará fallback limitado.');
    });
}
