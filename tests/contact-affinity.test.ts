import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decayedWeight } from '../server/services/directory/contactAffinityService.js';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-08-29T12:00:00.000Z').getTime();
const diasAtras = (dias: number) => new Date(AGORA - dias * DAY_MS);

describe('afinidade de contato — a ordem sai do que já aconteceu', () => {
  it('a meia-vida é de 30 dias, e é ela que define a escala', () => {
    assert.equal(decayedWeight(diasAtras(0), AGORA), 1);
    assert.ok(Math.abs(decayedWeight(diasAtras(30), AGORA) - 0.5) < 1e-9);
    assert.ok(Math.abs(decayedWeight(diasAtras(60), AGORA) - 0.25) < 1e-9);
  });

  it('três desta semana passam na frente de trinta do ano passado', () => {
    // É o caso que "só frequência" erra: a contagem bruta congelaria quem foi muito acionado e
    // sumiu, e ele ficaria no topo para sempre.
    const recentes = [1, 3, 5].reduce(
      (soma, dia) => soma + decayedWeight(diasAtras(dia), AGORA),
      0,
    );
    const antigas = Array.from({ length: 30 }).reduce<number>(
      (soma, _, i) => soma + decayedWeight(diasAtras(300 + i), AGORA),
      0,
    );

    assert.ok(recentes > antigas, `recentes=${recentes} antigas=${antigas}`);
  });

  it('uma interação de ontem não vira o jogo contra volume recente de verdade', () => {
    // E é o caso que "só recência" erra: um envio avulso empurraria o time de todo dia para baixo.
    const avulsa = decayedWeight(diasAtras(1), AGORA);
    const timeDeTodoDia = [2, 4, 6, 9, 12].reduce(
      (soma, dia) => soma + decayedWeight(diasAtras(dia), AGORA),
      0,
    );

    assert.ok(timeDeTodoDia > avulsa);
  });

  it('nada de futuro pontua mais que hoje', () => {
    // Relógio adiantado em outra máquina não pode comprar o topo da lista.
    assert.equal(decayedWeight(new Date(AGORA + 10 * DAY_MS), AGORA), 1);
  });

  it('a troca com outra empresa só pontua depois do aceite', () => {
    const service = read('server/services/directory/contactAffinityService.ts');

    // Antes do aceite houve oferta, e ela pode ter sido recusada. Pontuar pendente transformaria
    // intenção em histórico — a mesma regra de `listPartnerTenants`.
    assert.ok(service.includes("'inbound.status': 'accepted'"));
    assert.ok(!service.includes("'inbound.status': 'pending'"));
  });

  it('toda consulta começa pelo prefixo de um índice que existe', () => {
    const service = read('server/services/directory/contactAffinityService.ts');
    const indices = read('server/db/documentSignatureIndexes.ts');

    // Sem o `tenantId` na frente, os dois índices de `document_requests` não servem, e a consulta
    // varreria o acervo de todos os tenants.
    assert.ok(service.includes("tenantId: ctx.tenantId,\n        'requestedBy.userId': user.id"));
    assert.ok(service.includes("tenantId: ctx.tenantId,\n        'requestedFrom.userId': user.id"));

    // `signers.userId` já existia; quem pede assinatura era o sentido sem índice.
    assert.ok(indices.includes('requestedByUserId: 1, status: 1, createdAt: -1'));
  });

  it('a lista é do próprio usuário, e nunca um ranking da plataforma', () => {
    const service = read('server/services/directory/contactAffinityService.ts');

    // Toda origem é recortada por `user.id`: não há caminho que agregue a plataforma inteira.
    assert.ok(service.includes('sharedByUserId: user.id'));
    assert.ok(service.includes('sharedWithUserId: user.id'));
    assert.ok(service.includes('requestedByUserId: user.id'));
    assert.ok(service.includes("'signers.userId': user.id"));
  });

  it('a tela de contatos não oferece cadastrar ninguém', () => {
    const page = read('src/features/contacts/ContactsPage.tsx');

    // Um botão de adicionar prometeria curadoria que não existe, e mandaria a pessoa procurar um
    // controle que a lista não tem — ela cresce sozinha.
    assert.ok(!/Adicionar contato|Novo contato|adicionar à lista/i.test(page));
    assert.ok(page.includes('Não há nada para cadastrar'));
  });

  it('a tela só oferece a ação que começa por uma pessoa', () => {
    const page = read('src/features/contacts/ContactsPage.tsx');

    // Compartilhar e pedir assinatura começam por um documento. Oferecê-los daqui exigiria
    // escolher o arquivo antes, e um seletor de documento nesta tela seria a Biblioteca de novo.
    assert.ok(page.includes('Pedir documento'));
    assert.ok(!page.includes('ShareDocumentModal'));
    assert.ok(!page.includes('RequestSignatureModal'));
  });

  it('contato externo sem e-mail não promete envio', () => {
    const page = read('src/features/contacts/ContactsPage.tsx');

    // Nem toda origem registra o e-mail. Sem ele não há para onde mandar, e o botão ativo
    // ofereceria um caminho que falha no envio.
    assert.ok(page.includes("disabled={contact.scope === 'external' && !contact.email}"));
  });

  it('signatário sem conta não vira contato', () => {
    const service = read('server/services/directory/contactAffinityService.ts');

    // Convidado por link não tem `userId`. Guardá-lo criaria uma linha cujo caminho de envio não
    // é o da lista de contatos, e sim o link com token.
    assert.ok(service.includes('if (!signer.userId || signer.userId === user.id) continue;'));
  });
});
