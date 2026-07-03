import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { AiAnalysisError } from '../server/ai/utils/errors.js';
import { DocumentRulesNotSeededError } from '../server/services/documentRulesService.js';
import {
  RULES_ADMIN_HREF,
  buildDocumentRulesNotConfiguredError,
  isDevelopmentEnvironment,
  resolveWorkflowErrorBody,
  workflowErrorFromUnknown,
} from '../server/utils/workflowErrors.js';

describe('workflowErrors backend', () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('retorna erro estruturado para ausência de regras/classes', () => {
    const body = buildDocumentRulesNotConfiguredError(
      'Nenhuma classe/regra ativa encontrada para esta empresa.',
    );

    assert.equal(body.code, 'DOCUMENT_RULES_NOT_CONFIGURED');
    assert.equal(body.category, 'configuration');
    assert.equal(body.title, 'Configuração documental incompleta');
    assert.match(body.message, /classes e regras de documentos configuradas/);
    assert.equal(body.action?.label, 'Ir para Regras');
    assert.equal(body.action?.href, RULES_ADMIN_HREF);
    assert.equal(body.suggestion, 'Cadastre ao menos uma classe documental e uma regra ativa.');
  });

  it('workflowErrorFromUnknown mapeia DocumentRulesNotSeededError', () => {
    const error = new DocumentRulesNotSeededError('detalhe interno', 'no_categories');
    const { statusCode, body } = workflowErrorFromUnknown(error, { requestId: 'req_test' });

    assert.equal(statusCode, 503);
    assert.equal(body.code, 'DOCUMENT_RULES_NOT_CONFIGURED');
    assert.equal(body.error.title, 'Configuração documental incompleta');
    assert.equal(body.requestId, 'req_test');
    assert.match(body.message, /categoria documental/i);
  });

  it('workflowErrorFromUnknown mapeia AiAnalysisError com código conhecido', () => {
    const error = new AiAnalysisError(
      'Não há classes e regras de documentos configuradas para esta empresa.',
      'DOCUMENT_RULES_NOT_CONFIGURED',
      503,
    );
    const { body } = workflowErrorFromUnknown(error);

    assert.equal(body.error.code, 'DOCUMENT_RULES_NOT_CONFIGURED');
    assert.equal(body.error.category, 'configuration');
    assert.equal(body.error.action?.href, '/rules');
  });

  it('não inclui devHint em produção', () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';

    const body = resolveWorkflowErrorBody(
      'DOCUMENT_RULES_NOT_CONFIGURED',
      'fallback',
      'detalhe técnico',
    );

    assert.equal(body.devHint, undefined);
    assert.equal(body.technicalDetail, undefined);
  });

  it('inclui devHint em desenvolvimento', () => {
    process.env.APP_ENV = 'development';
    process.env.NODE_ENV = 'development';

    const body = buildDocumentRulesNotConfiguredError('detalhe');
    assert.match(body.devHint ?? '', /npm run db:setup/);
    assert.equal(body.technicalDetail, 'detalhe');
  });
});

describe('isDevelopmentEnvironment', () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('detecta development por APP_ENV', () => {
    process.env.APP_ENV = 'development';
    assert.equal(isDevelopmentEnvironment(), true);
  });
});
