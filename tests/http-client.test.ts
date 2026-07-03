import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldSetJsonContentType, withAuthHeaders } from '../src/auth/httpHeaders.js';

describe('authFetch headers', () => {
  it('POST sem body não manda Content-Type JSON', () => {
    const headers = withAuthHeaders(undefined, { json: true, hasBody: false });
    const merged = new Headers(headers);
    assert.equal(merged.get('Content-Type'), null);
    assert.equal(shouldSetJsonContentType({ method: 'POST' }), false);
  });

  it('POST com {} manda Content-Type JSON quando hasBody=true', () => {
    const headers = withAuthHeaders(undefined, {
      json: true,
      hasBody: true,
    });
    const merged = new Headers(headers);
    assert.equal(merged.get('Content-Type'), 'application/json');
    assert.equal(shouldSetJsonContentType({ method: 'POST', body: '{}' }), true);
  });

  it('PATCH com body manda JSON', () => {
    assert.equal(
      shouldSetJsonContentType({ method: 'PATCH', body: JSON.stringify({ roles: ['user'] }) }),
      true,
    );
  });

  it('DELETE sem body não manda JSON', () => {
    assert.equal(shouldSetJsonContentType({ method: 'DELETE' }), false);
    const headers = withAuthHeaders(undefined, { json: true, hasBody: false });
    assert.equal(new Headers(headers).get('Content-Type'), null);
  });

  it('FormData não deve receber Content-Type JSON automático', () => {
    const formData = new FormData();
    assert.equal(shouldSetJsonContentType({ method: 'POST', body: formData }), false);
  });
});
