import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { getFriendlyAuthErrorMessage } from '../src/lib/authErrorMessages.js';
import { getLoginAlertTitle, getLoginAlertVariant } from '../src/pages/login/loginFeedback.js';
import { sanitizeToastText } from '../src/shared/feedback/appFeedbackSanitize.js';

const SRC_ROOT = join(process.cwd(), 'src');

function walkTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkTsFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(fullPath);
  }
  return files;
}

describe('feedback UI — sem diálogos nativos', () => {
  it('não usa window.alert/window.confirm/window.prompt no src', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8');
      if (/\bwindow\.(alert|confirm|prompt)\s*\(/.test(content)) {
        offenders.push(file.replace(`${process.cwd()}/`, ''));
      }
    }
    assert.deepEqual(offenders, []);
  });
});

describe('login feedback', () => {
  it('mapeia INVALID_CREDENTIALS para alerta de erro', () => {
    assert.equal(getLoginAlertVariant('INVALID_CREDENTIALS'), 'error');
    assert.equal(getLoginAlertTitle('INVALID_CREDENTIALS'), 'Credenciais inválidas');
  });

  it('mapeia NO_ACTIVE_MEMBERSHIP para alerta informativo', () => {
    assert.equal(getLoginAlertVariant('NO_ACTIVE_MEMBERSHIP'), 'info');
    assert.match(
      getFriendlyAuthErrorMessage('NO_ACTIVE_MEMBERSHIP'),
      /nenhuma empresa/i,
    );
  });

  it('mapeia MEMBERSHIP_PENDING para alerta de aviso', () => {
    assert.equal(getLoginAlertVariant('MEMBERSHIP_PENDING'), 'warning');
    assert.match(
      getFriendlyAuthErrorMessage('MEMBERSHIP_PENDING'),
      /aguardando aprovação/i,
    );
  });
});

describe('toast sanitization', () => {
  it('redige segredos em mensagens de toast', () => {
    const sanitized = sanitizeToastText('Falha com Bearer abc.def.ghi e passwordHash exposto');
    assert.match(sanitized, /\[redigido\]/);
    assert.doesNotMatch(sanitized, /passwordHash/i);
  });
});
