import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { DocumentRulesNotSeededError } from '../server/services/documentRulesService.js';
import {
  buildDocumentRulesNotConfiguredError,
  workflowErrorFromUnknown,
} from '../server/utils/workflowErrors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function readServer(relativePath: string): string {
  return readFileSync(join(repoRoot, 'server', relativePath), 'utf8');
}

describe('pipeline de análise — fonte de verdade das regras', () => {
  it('loadActiveDocumentClassRules não bloqueia análise quando matriz de acesso está vazia', () => {
    const source = readServer('services/documentRulesService.ts');
    const ownership = readServer('tenancy/documentOwnership.ts');
    assert.equal(
      source.includes('Nenhuma categoria, grupo ou regra de acesso ativa encontrada'),
      false,
    );
    assert.ok(source.includes('no_extraction_rules'));
    assert.ok(source.includes('no_categories'));
    assert.ok(source.includes('Matriz de acesso vazia'));
    assert.equal(ownership.includes("scope: 'global'"), false);
  });

  it('/rules persiste categorias e extração nas collections de governança', () => {
    const categoriesApi = readFileSync(
      join(repoRoot, 'api/document-categories/index.ts'),
      'utf8',
    );
    const extraction = readServer('services/documentExtractionRulesService.ts');
    const access = readServer('services/documentAccessRulesService.ts');

    assert.ok(categoriesApi.includes('createDocumentCategory'));
    assert.ok(categoriesApi.includes('createDefaultExtractionRuleForCategory'));
    assert.ok(extraction.includes('documentExtractionRules'));
    assert.ok(access.includes('collections.documentRules'));
  });

  it('analyze-pdf resolve tenant pela sessão, não pelo body', () => {
    const endpoint = readFileSync(join(repoRoot, 'api/ai/analyze-pdf.ts'), 'utf8');
    assert.ok(endpoint.includes('getCompanyIdFromUser(user)'));
    assert.ok(endpoint.includes('analyze-pdf tenant resolvido'));
    assert.equal(endpoint.includes('req.body.tenantId'), false);
    assert.equal(endpoint.includes('company_dev'), false);
    assert.ok(endpoint.includes('isServiceError(error)'));
  });

  it('mensagens específicas para ausência de categoria vs extração', () => {
    const noCategories = buildDocumentRulesNotConfiguredError(undefined, 'no_categories');
    const noExtraction = buildDocumentRulesNotConfiguredError(undefined, 'no_extraction_rules');

    assert.match(noCategories.message, /categoria documental/i);
    assert.match(noExtraction.message, /classificação\/extração/i);

    const extractionError = new DocumentRulesNotSeededError('detalhe', 'no_extraction_rules');
    const mapped = workflowErrorFromUnknown(extractionError);
    assert.match(mapped.body.message, /classificação\/extração/i);
  });

  it('script audit:governance-rules consulta mesmas collections do pipeline', () => {
    const script = readFileSync(join(repoRoot, 'scripts/audit-governance-rules.ts'), 'utf8');
    const pkg = readFileSync(join(repoRoot, 'package.json'), 'utf8');
    assert.ok(pkg.includes('audit:governance-rules'));
    assert.ok(script.includes('loadActiveDocumentClassRules'));
    assert.ok(script.includes('documentExtractionRules'));
    assert.ok(script.includes('document_rules = matriz de acesso'));
  });

  it('draft do mapa não entra em document_rules até Salvar alterações', () => {
    const draft = readFileSync(
      join(repoRoot, 'src/features/rules/hooks/useGovernanceMapDraft.ts'),
      'utf8',
    );
    const save = readFileSync(join(repoRoot, 'src/features/rules/hooks/useRules.ts'), 'utf8');
    assert.ok(draft.includes('draftEdges'));
    assert.ok(save.includes('saveGovernanceMapChanges'));
    assert.ok(save.includes('disconnectGroupFromCategory'));
  });
});

describe('divergência regras de acesso vs classificação', () => {
  it('document_rules guarda matriz de acesso; document_extraction_rules guarda IA', () => {
    const rulesService = readServer('services/documentRulesService.ts');
    const constants = readFileSync(join(repoRoot, 'server/db/constants.ts'), 'utf8');

    assert.ok(rulesService.includes('documentExtractionRules'));
    assert.ok(rulesService.includes('countActiveAccessRules'));
    assert.ok(constants.includes("documentRules: 'document_rules'"));
    assert.ok(constants.includes("documentExtractionRules: 'document_extraction_rules'"));
  });

  it('criar categoria via API já cria regra de extração padrão', () => {
    const source = readFileSync(join(repoRoot, 'api/document-categories/index.ts'), 'utf8');
    assert.ok(source.includes('createDefaultExtractionRuleForCategory'));
  });
});
