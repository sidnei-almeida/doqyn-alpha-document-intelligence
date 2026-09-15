import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  UNCATEGORIZED_CATEGORY_NAME,
  UNCATEGORIZED_CATEGORY_SLUG,
  isUncategorizedCategory,
} from '../shared/systemCategory.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('classe de sistema "Sem categoria"', () => {
  it('é reconhecida pela chave técnica, e pelo nome só em documento que guardou o nome', () => {
    assert.ok(
      isUncategorizedCategory({ slug: UNCATEGORIZED_CATEGORY_SLUG, name: 'Uncategorized' }),
    );
    assert.ok(isUncategorizedCategory({ id: 'cat_sem_categoria' }));
    assert.ok(isUncategorizedCategory({ id: 'cat_sem_categoria__company_dev' }));
    assert.ok(isUncategorizedCategory({ name: `  ${UNCATEGORIZED_CATEGORY_NAME} ` }));
  });

  it('não confunde classe do tenant com a de sistema', () => {
    assert.equal(
      isUncategorizedCategory({ id: 'cat_contratos', slug: 'contratos', name: 'Contracts' }),
      false,
    );
    assert.equal(isUncategorizedCategory({ id: 'cat_sem_categoria_fiscal' }), false);
    assert.equal(isUncategorizedCategory({}), false);
  });

  it('servidor cria a classe com os valores que o front reconhece', () => {
    const service = read('server/services/documentCategoriesService.ts');
    assert.match(service, /from '\.\.\/\.\.\/shared\/systemCategory\.js'/);
    assert.equal(service.includes("= 'Sem categoria'"), false);
  });

  it('a tela troca o nome no fetch de categorias e de documentos', () => {
    const api = read('src/features/documents/api/documentsApi.ts');
    assert.match(api, /map\(withCategoryDisplayName\)/);
    assert.equal(api.match(/categoryDisplayName\(/g)?.length, 2);
  });

  it('portal do convidado, avisos, painel e matriz também trocam no fetch', () => {
    for (const rel of [
      'src/features/sharing/api/externalShareApi.ts',
      'src/features/notifications/api/notificationsApi.ts',
      'src/features/dashboard/api/dashboardApi.ts',
      'src/features/matrix/api/matrixApi.ts',
    ]) {
      assert.match(read(rel), /categoryDisplayName\(/, rel);
    }
  });
});
