import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { resolveExternalSharingConfig } from '../server/config/externalSharingConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('validade do compartilhamento externo tem teto', () => {
  it('a configuração expõe um teto positivo', () => {
    const config = resolveExternalSharingConfig();
    assert.ok(config.maxExternalShareExpirationDays > 0);
    assert.ok(config.maxExternalShareExpirationDays >= config.defaultExternalShareExpirationDays);
  });

  it('criar e regenerar passam pela mesma checagem', () => {
    const source = read('server/services/sharing/externalDocumentShareService.ts');

    assert.ok(source.includes('function assertExpirationWithinLimit'));
    assert.ok(source.includes("'EXPIRES_AT_ABOVE_LIMIT'"));

    // Duas chamadas: uma na criação, outra na regeneração do convite. Se uma delas voltar a
    // validar sozinha, o teto deixa de valer por aquele caminho.
    const chamadas = source.match(/assertExpirationWithinLimit\(/g) ?? [];
    assert.ok(chamadas.length >= 3, 'esperado a definição e as duas chamadas');
  });
});

describe('desligamento revoga os compartilhamentos do membro', () => {
  it('o serviço de revogação existe e cobre os dois tipos de grant', () => {
    const source = read('server/services/sharing/membershipShareRevocationService.ts');

    assert.ok(source.includes('revokeSharesGrantedByMembership'));
    assert.ok(source.includes('SHARED_APP_COLLECTIONS.documentShareGrants'));
    assert.ok(source.includes('SHARED_APP_COLLECTIONS.externalDocumentShareGrants'));
    // Só grant vivo é tocado — revogar duas vezes não conta de novo.
    assert.ok(source.includes("$nin: ['revoked', 'expired']"));
  });

  it('a rota interna existe e está registrada no dispatcher', () => {
    assert.ok(existsSync(join(repoRoot, 'api/internal/memberships/revoke-shares.ts')));

    const handler = read('api/internal/memberships/revoke-shares.ts');
    assert.ok(handler.includes('assertAppInternalApiKey'));
    assert.ok(handler.includes('revokeSharesGrantedByMembership'));

    const dispatcher = read('server/apiServer.ts');
    assert.ok(dispatcher.includes("'/api/internal/memberships/revoke-shares'"));
  });
});

describe('verbos da matriz de acesso chegam à autorização', () => {
  it('nenhum call site de canUserShareDocument fica sem o índice de governança', () => {
    const arquivos = [
      'server/services/sharing/documentShareService.ts',
      'server/services/sharing/externalDocumentShareService.ts',
      'server/services/signatures/documentSignatureService.ts',
    ];

    for (const arquivo of arquivos) {
      const source = read(arquivo);
      const chamadas = source.match(/canUserShareDocument\([^)]*\)/gs) ?? [];
      assert.ok(chamadas.length > 0, `${arquivo} deveria chamar canUserShareDocument`);

      for (const chamada of chamadas) {
        assert.ok(
          chamada.includes('governanceIndex'),
          `${arquivo}: sem o índice, o verbo share da matriz não concede nada — ${chamada}`,
        );
      }
    }
  });

  it('o tracking consulta o verbo audit da matriz', () => {
    const permissions = read('server/auth/permissions.ts');
    assert.ok(permissions.includes('userHasGovernanceCategoryPermission'));
    assert.ok(permissions.includes("'audit'"));

    const guard = read('server/audit/requireDocumentTrackingAccess.ts');
    assert.ok(guard.includes('loadDocumentAccessContext'));
    assert.ok(guard.includes('governanceIndex'));
  });

  it('o PUT da matriz valida as chaves de permissões', () => {
    const handler = read('api/document-rules/matrix.ts');
    assert.ok(handler.includes('.strict()'));
    assert.ok(handler.includes("'INVALID_PERMISSIONS'"));
    // O formato persistido é upload/manage; update/audit são aceitos e traduzidos.
    assert.ok(handler.includes('value.upload ?? value.update'));
    assert.ok(handler.includes('value.manage ?? value.audit'));
  });
});
