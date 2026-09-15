import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  LEGACY_ROUTE_PREFIXES,
  LEGACY_ROUTE_ROOTS,
  resolveLegacyPath,
} from '../src/app/legacyRoutes.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('rotas antigas em português', () => {
  it('cada endereço antigo leva ao novo, com o resto do caminho', () => {
    assert.equal(resolveLegacyPath('/biblioteca'), '/library');
    assert.equal(resolveLegacyPath('/biblioteca/lixeira'), '/library/trash');
    assert.equal(resolveLegacyPath('/biblioteca/compartilhados'), '/library/shared');
    assert.equal(resolveLegacyPath('/biblioteca/cat_contratos'), '/library/cat_contratos');
    assert.equal(resolveLegacyPath('/convite/abc%2F123'), '/invite/abc%2F123');
    assert.equal(resolveLegacyPath('/verificar-email/tok'), '/verify-email/tok');
    assert.equal(resolveLegacyPath('/confirmar-cadastro'), '/verify-email');
    assert.equal(resolveLegacyPath('/confirmar-email/tok'), '/confirm-email-change/tok');
    assert.equal(resolveLegacyPath('/assinaturas/sig_1'), '/signatures/sig_1');
    assert.equal(resolveLegacyPath('/matriz'), '/access-matrix');
    // Prefixo que só começa igual não é rota antiga.
    assert.equal(resolveLegacyPath('/bibliotecaria'), null);
    assert.equal(resolveLegacyPath('/library'), null);
  });

  it('o prefixo específico vem antes do geral', () => {
    const froms = LEGACY_ROUTE_PREFIXES.map(([from]) => from);
    froms.forEach((from, index) => {
      const earlierGeneral = froms.slice(0, index).find((other) => from.startsWith(`${other}/`));
      assert.equal(earlierGeneral, undefined, `${from} fica atrás de ${earlierGeneral}`);
    });
  });

  it('o roteador redireciona toda raiz antiga e não registra mais rota em português', () => {
    const routes = read('src/app/routes.tsx');
    assert.ok(routes.includes('LEGACY_ROUTE_ROOTS.map'));
    assert.ok(routes.includes('<LegacyRedirect />'));
    for (const root of LEGACY_ROUTE_ROOTS) {
      assert.equal(routes.includes(`path: '/${root}`), false, `rota /${root} ainda registrada`);
    }
  });

  it('o nginx devolve 301 para cada rota antiga', () => {
    const nginx = read('deploy/nginx/default.conf.template');
    for (const [from, to] of LEGACY_ROUTE_PREFIXES) {
      assert.ok(
        nginx.includes(`rewrite ^${from}(/.*)?$ ${to}$1 permanent;`),
        `nginx sem redirect de ${from}`,
      );
    }
  });

  it('o vercel.json redireciona cada rota antiga, permanente', () => {
    const vercel = JSON.parse(read('vercel.json')) as {
      redirects?: Array<{ source: string; destination: string; permanent?: boolean }>;
    };
    for (const [from, to] of LEGACY_ROUTE_PREFIXES) {
      const entry = vercel.redirects?.find((item) => item.source === `${from}/:path*`);
      assert.ok(entry, `vercel.json sem redirect de ${from}`);
      assert.equal(entry.destination, `${to}/:path*`);
      assert.equal(entry.permanent, true);
    }
  });

  it('e-mail do servidor não monta link com rota antiga', () => {
    const template = read('server/services/notifications/emailTemplate.ts');
    for (const root of LEGACY_ROUTE_ROOTS) {
      assert.equal(template.includes(`/${root}`), false, `emailTemplate ainda usa /${root}`);
    }
  });
});
