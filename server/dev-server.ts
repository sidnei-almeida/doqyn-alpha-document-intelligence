import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

const routes: Record<string, () => Promise<{ default: ApiHandler }>> = {
  '/api/health': () => import('../api/health.js'),
  '/api/auth/login': () => import('../api/auth/login.js'),
  '/api/auth/me': () => import('../api/auth/me.js'),
  '/api/auth/logout': () => import('../api/auth/logout.js'),
  '/api/documents': () => import('../api/documents/index.js'),
  '/api/documents/upload': () => import('../api/documents/upload.js'),
  '/api/audit': () => import('../api/audit/index.js'),
};

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function toVercelReq(req: IncomingMessage, body?: unknown): IncomingMessage & { query: Record<string, string>; body?: unknown } {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
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

  const loader = routes[pathname];
  if (!loader) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not found' }));
    return;
  }

  try {
    let body: unknown;

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const raw = await readBody(req);
      if (raw) {
        const contentType = req.headers['content-type'] ?? '';
        body = contentType.includes('application/json') ? JSON.parse(raw) : raw;
      }
    }

    const mod = await loader();
    const vercelReq = toVercelReq(req, body);
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
