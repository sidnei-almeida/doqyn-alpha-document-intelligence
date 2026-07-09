import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serializeQueryParams } from '../src/lib/queryParams.ts';

describe('serializeQueryParams', () => {
  it('omite undefined/null/vazio — evita search=undefined na API', () => {
    const query = serializeQueryParams({
      search: undefined,
      categoryId: undefined,
      type: undefined,
      owner: undefined,
      sort: 'updatedAt',
      direction: 'desc',
      limit: '100',
      excludeArchived: 'true',
    });

    assert.equal(query.includes('undefined'), false);
    assert.equal(query.includes('search='), false);
    assert.ok(query.includes('sort=updatedAt'));
    assert.ok(query.includes('excludeArchived=true'));
  });

  it('retorna string vazia sem parâmetros válidos', () => {
    assert.equal(serializeQueryParams({}), '');
    assert.equal(serializeQueryParams(undefined), '');
  });
});
