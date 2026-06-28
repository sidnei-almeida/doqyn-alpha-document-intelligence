import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWorkflowErrorLogDetails,
  buildWorkflowToastMessage,
  parseWorkflowErrorPayload,
} from '../src/features/document-send/utils/workflowErrors.ts';

describe('workflowErrors frontend', () => {
  it('parseia erro estruturado do backend', () => {
    const display = parseWorkflowErrorPayload(
      {
        message: 'msg legado',
        code: 'DOCUMENT_RULES_NOT_CONFIGURED',
        requestId: 'req_1',
        error: {
          code: 'DOCUMENT_RULES_NOT_CONFIGURED',
          category: 'configuration',
          title: 'Configuração documental incompleta',
          message:
            'Não há classes e regras de documentos configuradas para esta empresa.',
          suggestion: 'Cadastre ao menos uma classe documental e uma regra ativa.',
          action: { label: 'Ir para Regras', href: '/rules' },
          devHint: 'Ambiente de desenvolvimento: execute npm run db:setup',
        },
      },
      'fallback',
    );

    assert.equal(display.title, 'Configuração documental incompleta');
    assert.equal(display.action?.href, '/rules');
    assert.match(display.toastMessage, /Configuração documental incompleta/);
    assert.equal(display.requestId, 'req_1');
  });

  it('toast amigável para ausência de regras', () => {
    const toast = buildWorkflowToastMessage({
      code: 'DOCUMENT_RULES_NOT_CONFIGURED',
      category: 'configuration',
      title: 'Configuração documental incompleta',
      message: 'mensagem',
    });

    assert.match(toast, /Cadastre classes e regras/);
    assert.equal(toast.includes('npm run db:setup'), false);
  });

  it('logs da sessão recebem sugestão e ação', () => {
    const details = buildWorkflowErrorLogDetails(
      {
        code: 'DOCUMENT_RULES_NOT_CONFIGURED',
        category: 'configuration',
        title: 'Configuração documental incompleta',
        message: 'Não há classes e regras de documentos configuradas para esta empresa.',
        suggestion: 'Acesse Administração > Regras e cadastre uma regra ativa.',
        action: { label: 'Ir para Regras', href: '/rules' },
        toastMessage: 'toast',
      },
      { stage: 'Análise', endpoint: '/api/ai/analyze-pdf', showDebug: true },
    );

    assert.equal(details.errorType, 'Configuração');
    assert.equal(details.friendlyTitle, 'Configuração documental incompleta');
    assert.match(String(details.suggestion), /Regras/);
    assert.equal(details.actionLabel, 'Ir para Regras');
    assert.equal(details.actionHref, '/rules');
    assert.equal(details.endpoint, '/api/ai/analyze-pdf');
  });

  it('redige segredos em mensagens de fallback', () => {
    const display = parseWorkflowErrorPayload(
      null,
      'Falha com gsk_ABC123 e mongodb+srv://user:pass@host/db',
    );

    assert.equal(display.message.includes('gsk_'), false);
    assert.equal(display.message.includes('mongodb+srv://'), false);
    assert.match(display.message, /\[redigido\]/);
  });
});
