import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CANONICAL_VALIDITY_KEY, canonicalizeMetadataKey } from '../shared/metadataKeyNormalize.js';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('vencimentos — edição manual no documento', () => {
  it('a chave gravada é a que o servidor lê como vencimento', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');
    const projection = read('server/services/confirm/projectSearchMeta.ts');

    // Gravar outra chave preencheria o metadado sem nunca alimentar searchMeta.validityDate,
    // e portanto sem nunca disparar alerta. É `data_validade` e não `data_vencimento` porque só
    // essa sobrevive à canonicalização da confirmação — a outra é renomeada para cá, e a linha da
    // regra ficava vazia com o dado aparecendo abaixo, fora da regra.
    assert.ok(editor.includes('const VALIDITY_KEY = CANONICAL_VALIDITY_KEY'));
    assert.equal(canonicalizeMetadataKey(CANONICAL_VALIDITY_KEY), CANONICAL_VALIDITY_KEY);
    assert.ok(projection.includes("'data_validade'"));
    assert.ok(projection.includes('VALIDITY_SOURCE_KEYS'));
  });

  it('campo vazio apaga o valor em vez de mandar string vazia', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');
    assert.ok(editor.includes('value: raw ? raw : null'));
  });

  it('a tabela lista os campos da regra da categoria, não só os extraídos', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');
    const service = read('server/services/expiry/documentMetadataEditService.ts');
    const handler = read('api/documents/[documentId]/metadata.ts');

    // Sem a ficha do servidor o usuário teria de adivinhar a chave do que ficou faltando.
    assert.ok(editor.includes("queryKey: ['document-metadata-sheet', documentId]"));
    assert.ok(editor.includes('getDocumentMetadataSheet'));
    assert.ok(service.includes('export function buildMetadataSheetRows'));
    assert.ok(handler.includes("req.method === 'GET'"));
  });

  it('salvar recarrega a própria ficha, senão a linha continua marcada como faltando', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');
    assert.ok(
      editor.includes("invalidateQueries({ queryKey: ['document-metadata-sheet', documentId] })"),
    );
  });

  it('salvar invalida os caches que realmente existem', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');
    const hook = read('src/features/documents/hooks/useDocuments.ts');

    // A chave do detalhe é ['document-detail', tenantId, documentId]. Invalidar ['document', id]
    // não casa por prefixo: o painel ficaria com a data antiga e o botão Salvar preso habilitado.
    assert.ok(hook.includes("queryKey: ['document-detail'"));
    assert.ok(editor.includes("queryKey: ['document-detail']"));
    assert.equal(editor.includes("queryKey: ['document', documentId]"), false);

    // A data nova muda quais alertas valem; deixar o cache velho mostraria aviso obsoleto.
    assert.ok(editor.includes("queryKey: ['expiry-alerts']"));
  });
});

describe('vencimentos — configuração na regra da categoria', () => {
  it('a config atravessa drawer, hook e API até o servidor', () => {
    const drawer = read('src/features/rules/components/ExtractionConfigDrawer.tsx');
    const hook = read('src/features/rules/hooks/useRules.ts');
    const api = read('src/features/rules/api/rulesApi.ts');
    const handler = read('api/document-extraction-rules/index.ts');

    assert.ok(drawer.includes('expiryAlerts,'), 'drawer precisa enviar no payload');
    assert.ok(hook.includes('expiryAlerts: payload.expiryAlerts'), 'hook precisa repassar');
    assert.ok(api.includes('expiryAlerts?: ExpiryAlertConfig'), 'API precisa aceitar');
    assert.ok(handler.includes('expiryAlerts'), 'handler precisa repassar ao serviço');
  });

  it('a regra devolvida expõe a config para a tela reabrir no estado salvo', () => {
    const api = read('src/features/rules/api/rulesApi.ts');
    assert.ok(api.includes('expiryAlerts: rule.expiryAlerts'));

    const service = read('server/services/documentExtractionRulesService.ts');
    assert.ok(service.includes('expiryAlerts: normalizeExpiryAlertConfig(rule.expiryAlerts)'));
  });

  it('a normalização final é do servidor, não do formulário', () => {
    const service = read('server/services/documentExtractionRulesService.ts');
    // O formulário aceita entrada livre; quem garante marcos válidos e deduplicados é o serviço.
    assert.ok(service.includes('patch.expiryAlerts = normalizeExpiryAlertConfig'));
  });
});

// A caixa de vencimentos foi absorvida pelas notificações em `e95fa66` ("o sino deixa de ser só
// de vencimento"): a rota `/vencimentos` virou `/notifications`, e `ExpiryAlertsBell` virou
// `NotificationsBell`. As garantias abaixo são as mesmas de antes, apuradas no lugar novo.
describe('vencimentos — caixa de alertas, dentro das notificações', () => {
  it('a rota da página está registrada', () => {
    const routes = read('src/app/routes.tsx');
    const lazy = read('src/app/lazyRoutes.tsx');

    assert.ok(routes.includes("path: '/notifications'"));
    assert.ok(lazy.includes('NotificationsRoute'));
    assert.ok(lazy.includes('@/features/notifications/NotificationsPage'));
  });

  it('o sino está na barra superior', () => {
    const topbar = read('src/components/layout/WorkspaceTopBar.tsx');
    assert.ok(topbar.includes('NotificationsBell'));
  });

  it('o cache é chaveado por tenant', () => {
    const hook = read('src/features/notifications/hooks/useNotifications.ts');
    // Trocar de empresa não pode mostrar alerta da anterior.
    assert.ok(hook.includes('tenant?.tenantId'));
    assert.ok(hook.includes('[NOTIFICATIONS_KEY, tenantId'));
  });

  it('o sino lista só não lidos, para "Dispensar" surtir efeito visível', () => {
    const bell = read('src/features/notifications/components/NotificationsBell.tsx');
    assert.ok(bell.includes("status: 'unread'"));
  });

  it('o campo de marcos guarda texto cru enquanto é digitado', () => {
    const section = read('src/features/rules/components/ExpiryAlertConfigSection.tsx');

    // Reparsear a cada tecla apagava a vírgula recém-digitada e impedia um segundo marco;
    // o sinal de menos sozinho virava NaN, inviabilizando marcos após vencimento.
    assert.ok(section.includes('offsetsText'));
    assert.ok(section.includes('onBlur'));
    assert.equal(section.includes("value={value.offsetsDays.join(', ')}"), false);
  });

  it('a urgência exibida vem dos dias restantes, não do marco', () => {
    const list = read('src/features/notifications/components/NotificationList.tsx');
    assert.ok(list.includes('function expiryTone(daysRemaining: number)'));
    assert.ok(list.includes("if (daysRemaining < 0) return 'text-doqyn-danger'"));
  });
});
