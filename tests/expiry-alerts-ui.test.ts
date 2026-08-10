import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
    // e portanto sem nunca disparar alerta.
    assert.ok(editor.includes("const VALIDITY_KEY = 'data_vencimento'"));
    assert.ok(projection.includes("'data_vencimento'"));
    assert.ok(projection.includes('VALIDITY_SOURCE_KEYS'));
  });

  it('campo vazio apaga o valor em vez de mandar string vazia', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');
    assert.ok(editor.includes('value: raw ? raw : null'));
  });

  it('sem permissão de atualização os campos não são editáveis', () => {
    const editor = read('src/features/expiry/components/DocumentExpiryEditor.tsx');

    // A permissão do painel e a da ficha do servidor precisam valer as duas: o painel pode estar
    // com cache antigo, e a ficha é quem o PATCH vai checar de fato.
    assert.ok(editor.includes('const editable = canEdit && (sheet?.canEdit ?? true)'));
    assert.ok(editor.includes('Você não tem permissão para editar'));

    const panel = read('src/features/documents/components/DocumentDetailPanel.tsx');
    assert.ok(panel.includes('canEdit={Boolean(data.permissions.canUpdate)}'));
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

describe('vencimentos — caixa de alertas', () => {
  it('a rota da página está registrada', () => {
    const routes = read('src/app/routes.tsx');
    const lazy = read('src/app/lazyRoutes.tsx');

    assert.ok(routes.includes("path: '/vencimentos'"));
    assert.ok(lazy.includes('ExpiryAlertsRoute'));
    assert.ok(lazy.includes('@/features/expiry/ExpiryAlertsPage'));
  });

  it('o sino está na barra superior', () => {
    const topbar = read('src/components/layout/WorkspaceTopBar.tsx');
    assert.ok(topbar.includes('ExpiryAlertsBell'));
  });

  it('o cache de alertas é chaveado por tenant', () => {
    const hook = read('src/features/expiry/hooks/useExpiryAlerts.ts');
    // Trocar de empresa não pode mostrar alerta da anterior.
    assert.ok(hook.includes('tenant?.tenantId'));
    assert.ok(hook.includes('[ALERTS_KEY, tenantId'));
  });

  it('o sino lista só não lidos, para "Dispensar" surtir efeito visível', () => {
    const bell = read('src/features/expiry/components/ExpiryAlertsBell.tsx');
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
    const list = read('src/features/expiry/components/ExpiryAlertList.tsx');
    assert.ok(list.includes('function urgencyVariant(daysRemaining: number)'));
    assert.ok(list.includes("if (daysRemaining < 0) return 'danger'"));
  });
});
