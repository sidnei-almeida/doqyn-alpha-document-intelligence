import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(p: string): string {
  return readFileSync(resolve(process.cwd(), p), 'utf8');
}

describe('assinatura entre empresas, e o campo que atravessa a fronteira', () => {
  it('quem assina de fora é resolvido pelo e-mail, e de casa primeiro', () => {
    const validation = read('server/services/signatures/signatureRecipientValidation.ts');
    const fn = validation.slice(validation.indexOf('export async function resolveSignerByEmail'));

    const interno = fn.indexOf('external: false');
    const guarda = fn.indexOf('if (!isInterTenantSharingEnabled())');
    const remoto = fn.indexOf('await lookupDirectoryUserByEmail(email)');

    assert.ok(interno > 0 && guarda > interno && remoto > guarda);
    assert.ok(fn.includes('SIGNER_NOT_DOQYN'));
  });

  it('assinar de fora não cria concessão pendente, e sim portal com token', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');

    // Quem assina de fora abre a página própria e não entra no acervo: não há ingresso a governar.
    assert.ok(service.includes('if (resolved.external) {'));
    assert.ok(service.includes('portalToken = generateSignaturePortalToken()'));
    assert.ok(!service.includes('buildInboundState'));
  });

  it('o campo de outra empresa é uma peça só, nos três verbos', () => {
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    for (const modal of [
      'src/features/sharing/components/ShareDocumentModal.tsx',
      'src/features/signature/RequestSignatureModal.tsx',
      'src/features/requests/components/RequestDocumentModal.tsx',
    ]) {
      assert.ok(read(modal).includes('<CrossTenantRecipientField'), modal);
    }

    // Campo próprio, não o mesmo da busca de colegas: aquele procura por nome numa lista
    // conhecida; este resolve e-mail exato contra o diretório.
    // O estado do e-mail é do próprio campo. Passou a ser semeado por `initialEmail` para
    // reabrir no que já havia sido digitado; o que importa aqui é que ele continua sendo dono
    // do valor, e não recebendo-o pronto a cada render.
    assert.ok(field.includes('const [email, setEmail] = useState(initialEmail ?? \'\')'));
    assert.ok(field.includes('<PartnerContactList onPick={setEmail} />'));
  });

  it('o caminho de fora fica sempre visível, e não atrás do "ninguém encontrado"', () => {
    const picker = read('src/features/documents/recipients/RecipientFlow.tsx');

    // Escondê-lo exigia saber de antemão que o destinatário está fora — que é o que se quer
    // descobrir. Com três colegas na lista, o caminho não existia na tela.
    assert.ok(picker.includes('{emptyAction ? ('));
    assert.ok(picker.includes('border-t border-doqyn-border-subtle pt-3'));
  });

  it('achou em casa pelo campo de fora? o campo diz, em vez de deixar seguir', () => {
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    // Mandar um colega pelo caminho de fora criaria uma pendência de aceite sem motivo.
    assert.ok(field.includes('.ehDaqui'));
  });

  it('a lista de acesso mostra a empresa da outra parte, não a nossa', () => {
    const service = read('server/services/sharing/documentShareService.ts');
    const modal = read('src/features/sharing/components/ShareDocumentModal.tsx');

    // `originTenantName` é a empresa de quem enviou, e quem lê a lista é ele: escrevia o próprio
    // nome ao lado do destinatário, como se o colega de fora trabalhasse aqui.
    assert.ok(service.includes('counterpartTenantName: grant.inbound'));
    assert.ok(service.includes('counterpartTenantNames.get(grant.inbound.recipientTenantId)'));
    assert.ok(modal.includes('share.counterpartTenantName'));
  });
});
