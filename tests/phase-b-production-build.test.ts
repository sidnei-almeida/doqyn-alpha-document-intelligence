import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const PRODUCTION_ENTRY = join(ROOT, 'dist/server/production-server.js');
const WORKER_ENTRY = join(ROOT, 'dist/server/workers/runAnalysisWorker.js');
const INDEX_SCRIPT = join(ROOT, 'dist/scripts/ensure-mongodb-indexes.js');
const PREVIEW_ASSET = join(ROOT, 'dist/server/preview/assets/doqyn-horizontal.webp');

describe('Fase B.1 — API compilada para produção', () => {
  it('build:server gera dist/ com entrypoints de produção', () => {
    execFileSync('npm', ['run', 'build:server'], { cwd: ROOT, stdio: 'pipe' });

    assert.ok(existsSync(PRODUCTION_ENTRY), 'production-server.js ausente');
    assert.ok(existsSync(WORKER_ENTRY), 'runAnalysisWorker.js ausente');
    assert.ok(
      existsSync(join(ROOT, 'dist/server/workers/runPreviewWorker.js')),
      'runPreviewWorker.js ausente',
    );
    assert.ok(existsSync(INDEX_SCRIPT), 'ensure-mongodb-indexes.js ausente');
    assert.ok(existsSync(PREVIEW_ASSET), 'assets de preview ausentes em dist/');
  });

  it('handlers compilados em dist/api importam corretamente', async () => {
    const health = await import('../dist/api/health.js');
    assert.equal(typeof health.default, 'function');

    const metrics = await import('../dist/api/metrics.js');
    assert.equal(typeof metrics.default, 'function');
  });

  it('apiServer exporta startApiServer', async () => {
    const mod = await import('../server/apiServer.js');
    assert.equal(typeof mod.startApiServer, 'function');
  });
});
