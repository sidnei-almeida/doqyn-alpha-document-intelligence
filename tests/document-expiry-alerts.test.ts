import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  DEFAULT_EXPIRY_OFFSETS_DAYS,
  buildPendingAlerts,
  computeScanWindow,
  daysUntil,
  normalizeExpiryAlertConfig,
  resolveAlertGroupIds,
  resolveDueOffset,
} from '../server/services/expiry/documentExpiryAlertService.js';
import { buildMetadataSheetRows } from '../server/services/expiry/documentMetadataEditService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

describe('alerta de vencimento — cálculo de marcos', () => {
  it('conta dias de calendário, não períodos de 24 horas', () => {
    // Duas horas de diferença, mas atravessa a meia-noite UTC: falta 1 dia, não 0.
    assert.equal(
      daysUntil(new Date('2026-03-11T01:00:00Z'), new Date('2026-03-10T23:00:00Z')),
      1,
    );

    // E 23 horas dentro do mesmo dia UTC continuam sendo 0.
    assert.equal(
      daysUntil(new Date('2026-03-10T23:59:00Z'), new Date('2026-03-10T00:30:00Z')),
      0,
    );
  });

  it('dispara o menor marco já alcançado, um por vez', () => {
    const offsets = [30, 7, 1];

    // "Alcançado" = o vencimento entrou na janela do marco. A 20 dias, só a janela de 30 abriu,
    // então o aviso devido é o de 30 — mesmo que a varredura só rode agora. A 5 dias, as janelas
    // de 30 e 7 abriram, e o aviso corrente é o de 7; o de 1 ainda não chegou.
    assert.equal(resolveDueOffset(30, offsets), 30);
    assert.equal(resolveDueOffset(20, offsets), 30);
    assert.equal(resolveDueOffset(5, offsets), 7);
    assert.equal(resolveDueOffset(1, offsets), 1);

    // Se a varredura ficar parada, o índice único garante que só o marco corrente é criado —
    // o documento não despeja os três avisos de uma vez.
  });

  it('não alerta quando o vencimento ainda está fora de todos os marcos', () => {
    assert.equal(resolveDueOffset(45, [30, 7, 1]), null);
  });

  it('o dia do vencimento é o marco zero, se configurado', () => {
    assert.equal(resolveDueOffset(0, [7, 0]), 0);
    assert.equal(resolveDueOffset(0, [7, 1]), 1);
  });

  it('documento vencido para no último marco até o negativo ser alcançado', () => {
    // Já vencido há 3 dias, sem marco negativo: fica no menor marco positivo, entregue uma vez.
    assert.equal(resolveDueOffset(-3, [30, 7, 1]), 1);

    // Com marco de 7 dias após vencer, ele só entra quando o prazo realmente passa de -7.
    assert.equal(resolveDueOffset(-3, [7, -7]), 7);
    assert.equal(resolveDueOffset(-9, [7, -7]), -7);
  });

  it('daysUntil devolve negativo para documento já vencido', () => {
    assert.equal(daysUntil(daysFromNow(-5)), -5);
    assert.equal(daysUntil(daysFromNow(12)), 12);
  });
});

describe('alerta de vencimento — janela de varredura', () => {
  const now = new Date('2026-08-10T09:00:00Z');

  /** Um documento só é avaliado se o vencimento cair dentro da janela lida do banco. */
  function inWindow(validityIso: string, offsets: number[]): boolean {
    const { start, end } = computeScanWindow(offsets, now);
    const validity = new Date(validityIso);
    return validity >= start && validity <= end;
  }

  it('inclui o documento que vence hoje', () => {
    // O piso da janela era o menor marco (positivo), o que empurrava o início para o futuro e
    // excluía justamente quem está prestes a vencer.
    assert.equal(inWindow('2026-08-10T00:00:00Z', [30, 7, 1]), true);
    assert.equal(daysUntil(new Date('2026-08-10T00:00:00Z'), now), 0);
  });

  it('inclui documento dentro do único marco configurado', () => {
    // Categoria com um marco só, de 30 dias: o documento a 15 dias precisa alertar.
    const validity = '2026-08-25T00:00:00Z';
    assert.equal(inWindow(validity, [30]), true);
    assert.equal(resolveDueOffset(daysUntil(new Date(validity), now), [30]), 30);
  });

  it('inclui documento já vencido quando há marco negativo', () => {
    assert.equal(inWindow('2026-08-05T00:00:00Z', [30, 7, -7]), true);
  });

  it('recupera documento que venceu enquanto a varredura estava parada', () => {
    // Sem janela de recuperação, um fim de semana com a varredura fora engoliria o último aviso.
    assert.equal(inWindow('2026-08-08T00:00:00Z', [30, 7, 1]), true);
  });

  it('mas não reprocessa o histórico inteiro de vencidos', () => {
    assert.equal(inWindow('2026-06-01T00:00:00Z', [30, 7, 1]), false);
  });

  it('exclui documento com vencimento além do marco mais distante', () => {
    assert.equal(inWindow('2026-10-01T00:00:00Z', [30, 7, 1]), false);
  });

  it('a janela nunca começa no futuro', () => {
    for (const offsets of [[1], [7], [30], [30, 7, 1], [365]]) {
      const { start } = computeScanWindow(offsets, now);
      assert.ok(
        start <= now,
        `janela com marcos ${JSON.stringify(offsets)} começa no futuro e perde documentos`,
      );
    }
  });
});

describe('alerta de vencimento — fuso', () => {
  it('conta em UTC, como as datas são gravadas', () => {
    // `projectSearchMeta` grava validityDate com Date.UTC. Contar em horário local faria um host
    // a oeste de UTC ver "vence hoje" um dia antes.
    const validity = new Date(Date.UTC(2026, 7, 10));
    const lateNightUtcMinus3 = new Date('2026-08-09T02:30:00Z');

    assert.equal(daysUntil(validity, lateNightUtcMinus3), 1);
    assert.equal(daysUntil(validity, new Date('2026-08-10T23:30:00Z')), 0);
  });
});

describe('alerta de vencimento — normalização da configuração', () => {
  it('usa 30/7/1 quando nada é informado', () => {
    const config = normalizeExpiryAlertConfig(undefined);
    assert.deepEqual(config.offsetsDays, DEFAULT_EXPIRY_OFFSETS_DAYS);
    assert.equal(config.enabled, false);
  });

  it('descarta marcos negativos a menos que avisar-após-vencer esteja ligado', () => {
    assert.deepEqual(
      normalizeExpiryAlertConfig({ offsetsDays: [30, 7, -7] }).offsetsDays,
      [30, 7],
    );
    assert.deepEqual(
      normalizeExpiryAlertConfig({ offsetsDays: [30, 7, -7], notifyAfterExpiry: true }).offsetsDays,
      [30, 7, -7],
    );
  });

  it('deduplica, ordena do mais distante ao mais próximo e rejeita lixo', () => {
    const config = normalizeExpiryAlertConfig({
      offsetsDays: [7, 30, 7, 1.5 as unknown as number, 9999, 1],
    });
    assert.deepEqual(config.offsetsDays, [30, 7, 1]);
  });

  it('deduplica e limpa os grupos destinatários', () => {
    const config = normalizeExpiryAlertConfig({
      notifyGroupIds: [' group_a ', 'group_a', '', 'group_b'],
    });
    assert.deepEqual(config.notifyGroupIds, ['group_a', 'group_b']);
  });
});

describe('alerta de vencimento — quem é avisado', () => {
  const viewGroups = new Set(['group_fiscal', 'group_juridico']);

  it('sem restrição, avisa todos os grupos que veem a categoria', () => {
    // Lista vazia era silêncio total; agora é o default útil.
    assert.deepEqual(resolveAlertGroupIds(viewGroups, []), ['group_fiscal', 'group_juridico']);
  });

  it('a lista configurada restringe, nunca amplia', () => {
    assert.deepEqual(resolveAlertGroupIds(viewGroups, ['group_fiscal']), ['group_fiscal']);

    // Grupo escolhido no alerta mas sem acesso à categoria não entra: receberia o nome de um
    // documento que não pode abrir, e sobreviveria a desconectar o grupo no mapa de regras.
    assert.deepEqual(resolveAlertGroupIds(viewGroups, ['group_rh']), []);
    assert.deepEqual(resolveAlertGroupIds(viewGroups, ['group_rh', 'group_juridico']), [
      'group_juridico',
    ]);
  });

  it('categoria sem nenhum grupo na governança não avisa grupo algum', () => {
    assert.deepEqual(resolveAlertGroupIds(undefined, ['group_fiscal']), []);
    assert.deepEqual(resolveAlertGroupIds(undefined, []), []);
  });

  it('tenant PF avisa o dono, sem grupo nem governança', () => {
    const service = read('server/services/expiry/documentExpiryAlertService.ts');

    // A varredura antiga descartava PF inteira: o dono nunca sabia que o próprio documento vencia.
    assert.equal(service.includes('skippedIndividualTenant'), false);
    assert.ok(service.includes('evaluateIndividualTenantExpiryAlerts'));

    // O filtro de ownership de PF exige o userId do dono; sem ele a leitura lançaria
    // OWNER_USER_REQUIRED e a varredura engoliria o erro.
    assert.ok(service.includes('listActiveTenantMemberUserIds'));
    assert.ok(service.includes('getTenantCollections(tenantId, { userId: ownerUserId })'));
    assert.ok(service.includes('new Set([document.ownerUserId || ownerUserId])'));
  });

  it('gera um alerta por destinatário e ignora documento fora do marco', () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const config = normalizeExpiryAlertConfig({ enabled: true, offsetsDays: [30, 7, 1] });

    const documento = (id: string, validityDate: string, ownerUserId?: string) =>
      ({
        _id: id,
        classId: 'cat_1',
        title: `Doc ${id}`,
        ownerUserId,
        searchMeta: { validityDate: new Date(validityDate) },
      }) as never;

    const { pending, documentsWithoutRecipients } = buildPendingAlerts({
      tenantId: 'tenant_1',
      documents: [
        documento('doc_perto', '2026-08-15T00:00:00Z', 'user_dono'),
        // Fora de qualquer marco: faltam 60 dias.
        documento('doc_longe', '2026-10-09T00:00:00Z', 'user_dono'),
        documento('doc_orfao', '2026-08-11T00:00:00Z'),
      ],
      configByCategory: new Map([['cat_1', config]]),
      now,
      resolveRecipients: (document) =>
        new Set(document.ownerUserId ? [document.ownerUserId, 'user_gestor'] : []),
    });

    assert.deepEqual(
      pending.map((alert) => [alert.documentId, alert.userId, alert.offsetDays]),
      [
        ['doc_perto', 'user_dono', 7],
        ['doc_perto', 'user_gestor', 7],
      ],
    );

    // Documento sem ninguém para avisar é contado, não silenciado.
    assert.equal(documentsWithoutRecipients, 1);
    assert.equal(pending[0].daysRemaining, 5);
    assert.equal(pending[0].status, 'unread');
  });

  it('a varredura usa a governança e sempre inclui o dono', () => {
    const service = read('server/services/expiry/documentExpiryAlertService.ts');

    assert.ok(service.includes('loadGovernanceAccessIndex'));
    assert.ok(service.includes('governanceIndex.viewByCategory.get(categoryId)'));

    // O dono renova/reassina o documento; ele já tem acesso por ownership.
    assert.ok(service.includes('if (document.ownerUserId) userIds.add(document.ownerUserId)'));

    // A categoria não pode mais ser descartada por não ter grupo escolhido à mão.
    assert.equal(service.includes('config.notifyGroupIds.length === 0 ||'), false);
  });
});

describe('alerta de vencimento — integração no servidor', () => {
  it('a avaliação é idempotente por índice único, não por checagem em memória', () => {
    const indexes = read('server/db/documentExpiryAlertIndexes.ts');

    // Sem o índice único, uma segunda execução no mesmo dia avisaria o usuário de novo.
    assert.ok(indexes.includes('documentId: 1, userId: 1, offsetDays: 1'));
    assert.ok(indexes.includes('unique: true'));

    const service = read('server/services/expiry/documentExpiryAlertService.ts');
    assert.ok(service.includes('ordered: false'));
    assert.ok(service.includes('11000'), 'duplicate-key precisa ser tolerado, não propagado');
  });

  it('corrigir o vencimento à mão descarta os alertas antigos', () => {
    const edit = read('server/services/expiry/documentMetadataEditService.ts');

    // Sem isso o usuário fica com alerta de uma data que não existe mais, e o índice único
    // bloquearia o alerta da data nova.
    assert.ok(edit.includes('clearDocumentExpiryAlerts'));
    assert.ok(edit.includes('validityChanged'));
    assert.ok(edit.includes('enqueueTenantExpiryEvaluation'));
  });

  it('edição manual grava source manual e exige permissão de atualização', () => {
    const edit = read('server/services/expiry/documentMetadataEditService.ts');

    assert.ok(edit.includes("source: 'manual'"));
    assert.ok(edit.includes('assertCanUpdateDocument'));
    assert.ok(edit.includes('projectDocumentSearchMeta'), 'searchMeta precisa ser reprojetado');
  });

  it('a leitura de alertas é escopada por tenant e usuário', () => {
    const service = read('server/services/expiry/documentExpiryAlertService.ts');

    // Marcar como lido não pode alcançar alerta de outra pessoa.
    assert.ok(
      service.includes('{ _id: input.alertId, tenantId: input.tenantId, userId: input.userId }'),
    );
  });

  it('a varredura diária é registrada com jobId fixo', () => {
    const queue = read('server/queues/expiryAlertQueue.ts');

    // Sem jobId fixo, cada réplica da API registraria a própria varredura.
    assert.ok(queue.includes("jobId: REPEATABLE_JOB_NAME"));
    assert.ok(queue.includes('repeat: { pattern: cron }'));
    assert.ok(queue.includes('removeRepeatableByKey'), 'trocar o cron não pode deixar dois ativos');
  });

  it('um tenant com erro não interrompe a varredura dos demais', () => {
    const queue = read('server/queues/expiryAlertQueue.ts');
    const sweep = queue.slice(queue.indexOf('const tenants = await listActiveTenants()'));

    assert.ok(sweep.includes('try {'));
    assert.ok(sweep.includes('catch'));
  });

  it('as rotas novas estão registradas no dispatcher', () => {
    const server = read('server/apiServer.ts');

    // Adicionar arquivo em api/ não basta fora da Vercel.
    assert.ok(server.includes("'/api/expiry-alerts'"));
    assert.ok(server.includes('api/expiry-alerts/[alertId].js'));
    assert.ok(server.includes('api/documents/[documentId]/metadata.js'));
  });

  it('a ficha de metadados mostra o que a regra espera e o que ficou vazio', () => {
    const rows = buildMetadataSheetRows(
      [
        { key: 'numero_apolice', label: 'Número da apólice', type: 'string', required: true },
        { key: 'data_vencimento', label: 'Vencimento', type: 'date', required: true },
      ],
      {
        numero_apolice: {
          label: 'Número da apólice',
          value: 'AP-99',
          confidence: 0.9,
          source: 'ai',
        },
        // Chave fora da regra: precisa continuar visível, senão vira dado órfão que ninguém corrige.
        segurado: { label: 'Segurado', value: 'ACME', confidence: 1, source: 'manual' },
      },
    );

    assert.deepEqual(
      rows.map((row) => [row.key, row.filled, row.fromRule, row.isValidity]),
      [
        ['numero_apolice', true, true, false],
        ['data_vencimento', false, true, true],
        ['segurado', true, false, false],
      ],
    );

    // A ordem é a da regra: é como o admin configurou a categoria.
    assert.equal(rows[0].label, 'Número da apólice');
    assert.equal(rows[1].required, true);
  });

  it('valor vazio na versão conta como faltando, não como preenchido', () => {
    const rows = buildMetadataSheetRows(
      [{ key: 'cnpj', label: 'CNPJ', type: 'string', required: true }],
      { cnpj: { label: 'CNPJ', value: '', confidence: 0.2, source: 'ai' } },
    );

    // String vazia gravada pela extração enganaria a contagem de pendências.
    assert.equal(rows[0].filled, false);
  });

  it('a coleção de alertas é compartilhada, não prefixada por tenant', () => {
    const constants = read('server/db/constants.ts');

    // O Passo 7 acabou de remover coleções por tenant; a feature nova não pode reintroduzi-las.
    assert.ok(constants.includes("documentExpiryAlerts: 'document_expiry_alerts'"));
    const indexes = read('server/db/documentExpiryAlertIndexes.ts');
    assert.ok(indexes.includes('SHARED_APP_COLLECTIONS.documentExpiryAlerts'));
  });
});
