import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parseRecipientLocale, withRecipientLocaleQuery } from '../server/i18n/index.ts';
import { buildExternalShareInviteUrl } from '../server/services/sharing/externalDocumentShareService.ts';
import { buildSignaturePortalUrl } from '../server/services/signatures/documentSignatureService.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/**
 * Chamada de função como expressão regular tolerante a quebra de linha.
 *
 * A versão cravada num único `\(a, b, c\)` quebrou quando o Prettier partiu a chamada em várias
 * linhas — o argumento continuava lá, a asserção é que não enxergava. O que este teste protege é
 * o locale ser passado, não a chamada caber numa linha.
 */
function callMatching(fnName: string, args: string[]): RegExp {
  const escaped = args.map((arg) => arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`${fnName}\\(\\s*${escaped.join(',\\s*')},?\\s*\\)`);
}

describe('idioma escolhido para o convidado', () => {
  it('só idioma conhecido vira escolha; o resto é "não escolheu", e não pt-BR', () => {
    assert.equal(parseRecipientLocale('en'), 'en-US');
    assert.equal(parseRecipientLocale('es-MX'), 'es-419');
    assert.equal(parseRecipientLocale('pt-BR'), 'pt-BR');
    assert.equal(parseRecipientLocale('fr-FR'), null);
    assert.equal(parseRecipientLocale(''), null);
    assert.equal(parseRecipientLocale(42), null);
  });

  it('o link leva ?lang= quando houve escolha, e sai limpo quando não', () => {
    assert.equal(
      withRecipientLocaleQuery('https://x/guest/share/t', 'es-419'),
      'https://x/guest/share/t?lang=es-419',
    );
    assert.equal(
      withRecipientLocaleQuery('https://x/guest/share/t', null),
      'https://x/guest/share/t',
    );

    assert.match(
      buildExternalShareInviteUrl('tok', 'https://app.doqyn.com', 'en-US'),
      /\/guest\/share\/tok\?lang=en-US$/,
    );
    assert.match(
      buildExternalShareInviteUrl('tok', 'https://app.doqyn.com'),
      /\/guest\/share\/tok$/,
    );
    assert.match(
      buildSignaturePortalUrl('tok', 'https://app.doqyn.com', 'es-419'),
      /\/guest\/sign\/tok\?lang=es-419$/,
    );
  });

  it('a escolha é gravada e volta no link recopiado e no link novo', () => {
    const share = read('server/services/sharing/externalDocumentShareService.ts');
    assert.match(
      share,
      callMatching('buildExternalShareInviteUrl', [
        'recoveredToken',
        'options?.inviteOrigin',
        'grant.recipientLocale',
      ]),
    );
    assert.match(
      share,
      callMatching('buildExternalShareInviteUrl', [
        'inviteToken',
        'input?.inviteOrigin',
        'grant.recipientLocale',
      ]),
    );
    // Grava nos dois caminhos: convite que reaproveita o registro e convite novo.
    assert.match(share, /message: input\.message\?\.trim\(\) \|\| null,\n\s+recipientLocale,/);
    assert.match(
      share,
      /inviteTokenEncrypted: encryptLinkToken\(inviteToken\),\n\s+recipientLocale,/,
    );

    const sign = read('server/services/signatures/documentSignatureService.ts');
    assert.match(
      sign,
      callMatching('buildSignaturePortalUrl', [
        'recoveredToken',
        'options?.origin',
        'request.recipientLocale',
      ]),
    );
    assert.match(
      sign,
      /recipientLocale: portalToken \? parseRecipientLocale\(input\.recipientLocale\) : null/,
    );
  });

  it('as rotas repassam a escolha e os dois fluxos de envio a mandam', () => {
    assert.match(
      read('api/documents/[documentId]/external-shares.ts'),
      /recipientLocale: body\.recipientLocale/,
    );
    assert.match(
      read('api/documents/[documentId]/signature-requests.ts'),
      /recipientLocale:\s+typeof body\.recipientLocale/,
    );
    for (const modal of [
      'src/features/sharing/components/ShareDocumentModal.tsx',
      'src/features/signature/RequestSignatureModal.tsx',
    ]) {
      const source = read(modal);
      assert.match(source, /onRecipientLocaleChange=\{setRecipientLocale\}/, modal);
      assert.match(
        source,
        /recipientLocale: .*recipientLocale\) \|\| undefined|recipientLocale: recipientLocale \|\| undefined/,
        modal,
      );
    }
  });

  it('o seletor oferece todos os idiomas, inclusive os em preparo', () => {
    const flow = read('src/features/documents/recipients/RecipientFlow.tsx');
    assert.match(flow, /\.\.\.LOCALES\.map\(\(locale\) => \(\{/);
    assert.equal(flow.includes('EXPOSED_LOCALES'), false);
  });
});
