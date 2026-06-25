import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

type RouteMatch = {
  loader: () => Promise<{ default: ApiHandler }>;
  params: Record<string, string>;
};

const staticRoutes: Record<string, () => Promise<{ default: ApiHandler }>> = {
  '/api/health': () => import('../api/health.js'),
  '/api/auth/login': () => import('../api/auth/login.js'),
  '/api/auth/me': () => import('../api/auth/me.js'),
  '/api/me': () => import('../api/me.js'),
  '/api/auth/logout': () => import('../api/auth/logout.js'),
  '/api/documents': () => import('../api/documents/index.js'),
  '/api/documents/upload': () => import('../api/documents/upload.js'),
  '/api/documents/confirm-analysis': () => import('../api/documents/confirm-analysis.js'),
  '/api/document-rules/active': () => import('../api/document-rules/active.js'),
  '/api/document-rules': () => import('../api/document-rules/index.js'),
  '/api/access-groups': () => import('../api/access-groups/index.js'),
  '/api/auth/access-requests': () => import('../api/auth/access-requests.js'),
  '/api/company-members': () => import('../api/company-members/index.js'),
  '/api/company-members/invite': () => import('../api/company-members/invite.js'),
  '/api/document-classes': () => import('../api/document-classes/index.js'),
  '/api/audit': () => import('../api/audit/index.js'),
  '/api/ai/analyze-pdf': () => import('../api/ai/analyze-pdf.js'),
};

function resolveRoute(pathname: string): RouteMatch | null {
  const exact = staticRoutes[pathname];
  if (exact) {
    return { loader: exact, params: {} };
  }

  const patterns: Array<{ regex: RegExp; loader: RouteMatch['loader'] }> = [
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
      regex: /^\/api\/document-rules\/([^/]+)\/toggle-active$/,
      loader: () => import('../api/document-rules/toggle-active.js'),
    },
    { regex: /^\/api\/document-rules\/([^/]+)$/, loader: () => import('../api/document-rules/item.js') },
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern.regex);
    if (match) {
      return { loader: pattern.loader, params: { id: match[1], memberId: match[1] } };
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
  });
}

const PORT = Number(process.env.API_PORT ?? 3001);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

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
}).listen(PORT, () => {
  console.log(`DOQYN API local em http://localhost:${PORT}`);
});
