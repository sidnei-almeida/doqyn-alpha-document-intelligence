import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

/**
 * O `vite build` percorre a lista `references` de tsconfig.json ao processar o index.html. Um
 * arquivo referenciado que não foi copiado para a imagem derruba o build com ENOENT — e só na
 * VPS, porque local o arquivo existe no disco. Foi o que tsconfig.scripts.json fez ao chegar
 * pelo merge de perf/scale-plan-steps-4-7.
 */
describe('Dockerfile.nginx copia todos os tsconfig referenciados', () => {
  it('nenhuma referência de tsconfig.json fica de fora da imagem', () => {
    const tsconfig = read('tsconfig.json');
    const dockerfile = read('docker/Dockerfile.nginx');

    const referenced = [...tsconfig.matchAll(/"path"\s*:\s*"\.\/([^"]+)"/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, 'tsconfig.json deveria listar referências');

    const missing = referenced.filter((file) => !dockerfile.includes(file));
    assert.deepEqual(
      missing,
      [],
      `referenciados em tsconfig.json mas não copiados no Dockerfile.nginx: ${missing.join(', ')}`,
    );
  });
});
