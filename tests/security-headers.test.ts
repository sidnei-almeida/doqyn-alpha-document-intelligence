import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const nginx = readFileSync(join(repoRoot, 'deploy/nginx/default.conf.template'), 'utf8');
const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');

describe('cabeçalhos de segurança do nginx', () => {
  it('a CSP bloqueia, não só relata', () => {
    assert.ok(nginx.includes('add_header Content-Security-Policy "'));
    assert.equal(nginx.includes('Content-Security-Policy-Report-Only'), false);
  });

  it('nada de script inline — senão a CSP precisaria de unsafe-inline, que não barra XSS', () => {
    // Script inline é `<script>` sem `src`. O boot do tema mora em `public/boot.js`.
    const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)];
    assert.deepEqual(inline, [], 'index.html voltou a ter script inline');
    assert.ok(html.includes('<script src="/boot.js"></script>'));
  });

  it('o que a aplicação precisa continua permitido', () => {
    const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
    // O worker do pdf.js instancia WebAssembly para JPEG2000.
    assert.ok(csp.includes("'wasm-unsafe-eval'"));
    // Worker e imagem do pdf.js saem como blob; o upload vai direto ao R2, noutro domínio.
    assert.ok(csp.includes('worker-src') && csp.includes('blob:'));
    assert.ok(csp.includes('connect-src') && csp.includes('https:'));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
  });

  it('cada `location` com add_header repete os cabeçalhos do server', () => {
    // `add_header` dentro de um `location` descarta os herdados: sem repetir, a resposta sai nua.
    for (const bloco of nginx.split(/location\s/).slice(1)) {
      const corpo = bloco.slice(0, bloco.indexOf('\n  }'));
      if (!corpo.includes('add_header')) continue;
      assert.ok(
        corpo.includes('X-Content-Type-Options'),
        `location sem nosniff repetido: ${bloco.split('\n')[0]}`,
      );
    }
  });
});
