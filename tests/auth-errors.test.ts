import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getFriendlyAuthErrorMessage, getAuthErrorActions } from '../src/lib/authErrorMessages.js';
import { resolveMembershipAccessError } from '../server/utils/membershipAccessErrors.js';

function parseApiErrorBody(
  status: number,
  data: unknown,
  fallbackMessage = 'Não foi possível concluir a ação agora. Tente novamente.',
) {
  const body = (data && typeof data === 'object' ? data : {}) as {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
  const code = body.code ?? (status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : 'UNKNOWN_ERROR');
  const message = body.message ?? fallbackMessage;

  return {
    status,
    code,
    message,
    friendlyMessage: getFriendlyAuthErrorMessage(code, message, body.details),
    details: body.details,
    requestId: body.requestId,
  };
}

function accessCodeToGate(code: string) {
  switch (code) {
    case 'NO_ACTIVE_MEMBERSHIP':
      return 'no_membership';
    case 'MEMBERSHIP_PENDING':
      return 'pending';
    case 'MEMBERSHIP_BLOCKED':
      return 'blocked';
    case 'MEMBERSHIP_REJECTED':
      return 'rejected';
    case 'MEMBERSHIP_REMOVED':
      return 'removed';
    default:
      return null;
  }
}

function shouldLogoutForError(code: string): boolean {
  return ['INVALID_SESSION', 'SESSION_EXPIRED', 'AUTH_REQUIRED', 'NO_SESSION', 'UNAUTHORIZED'].includes(code);
}

describe('parseApiErrorBody', () => {
  it('preserva code, message e details do backend', () => {
    const parsed = parseApiErrorBody(403, {
      ok: false,
      code: 'MEMBERSHIP_PENDING',
      message: 'Sua solicitação de acesso ainda está aguardando aprovação.',
      details: { status: 'pending' },
      requestId: 'req-123',
    });

    assert.equal(parsed.status, 403);
    assert.equal(parsed.code, 'MEMBERSHIP_PENDING');
    assert.equal(parsed.details?.status, 'pending');
    assert.equal(parsed.requestId, 'req-123');
    assert.match(parsed.friendlyMessage, /aguardando aprovação/i);
  });

  it('mapeia 401 sem code para AUTH_REQUIRED', () => {
    const parsed = parseApiErrorBody(401, { message: 'Unauthorized' });
    assert.equal(parsed.code, 'AUTH_REQUIRED');
  });
});

describe('auth error messages', () => {
  it('mapeia NO_ACTIVE_MEMBERSHIP', () => {
    const message = getFriendlyAuthErrorMessage('NO_ACTIVE_MEMBERSHIP');
    assert.match(message, /nenhuma empresa/i);
  });

  it('oferece CTAs para NO_ACTIVE_MEMBERSHIP', () => {
    const actions = getAuthErrorActions('NO_ACTIVE_MEMBERSHIP');
    assert.equal(actions.length, 2);
    assert.equal(actions[0]?.href, '/solicitar-acesso');
    assert.equal(actions[1]?.href, '/criar-empresa');
  });
});

describe('accessCodeToGate', () => {
  it('mapeia membership pending para gate pending', () => {
    assert.equal(accessCodeToGate('MEMBERSHIP_PENDING'), 'pending');
    assert.equal(accessCodeToGate('MEMBERSHIP_REJECTED'), 'rejected');
  });
});

describe('shouldLogoutForError', () => {
  it('desloga em SESSION_EXPIRED mas não em FORBIDDEN', () => {
    assert.equal(shouldLogoutForError('SESSION_EXPIRED'), true);
    assert.equal(shouldLogoutForError('FORBIDDEN'), false);
  });
});

describe('resolveMembershipAccessError', () => {
  it('retorna MEMBERSHIP_PENDING quando só há pending', () => {
    const result = resolveMembershipAccessError([{ status: 'pending' }]);
    assert.equal(result.code, 'MEMBERSHIP_PENDING');
  });

  it('retorna NO_ACTIVE_MEMBERSHIP sem memberships visíveis', () => {
    const result = resolveMembershipAccessError([]);
    assert.equal(result.code, 'NO_ACTIVE_MEMBERSHIP');
  });
});
