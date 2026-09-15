import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthUser } from '../server/auth/types.js';
import { assertSessionSigner } from '../server/services/signatures/documentSignatureService.js';

const user = { id: 'user_1' } as AuthUser;
const status = (code: number) => (error: { statusCode?: number }) => error.statusCode === code;

describe('assinar ou recusar pela sessão', () => {
  it('signatário interno designado passa', () => {
    assert.doesNotThrow(() =>
      assertSessionSigner({ signerType: 'internal_user', userId: 'user_1' }, user),
    );
  });

  it('outro usuário, convidado externo e signatário sem id não passam', () => {
    for (const signer of [
      { signerType: 'internal_user', userId: 'user_2' },
      { signerType: 'external_guest', userId: null },
      { signerType: 'internal_user', userId: null },
      undefined,
    ]) {
      assert.throws(() => assertSessionSigner(signer, user), status(403));
    }
  });

  it('sem sessão é 401', () => {
    assert.throws(
      () => assertSessionSigner({ signerType: 'internal_user', userId: 'user_1' }, undefined),
      status(401),
    );
  });
});
