import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('preferências de upload na fila da Biblioteca', () => {
  it('uploadQueueCore centraliza roteamento pós-análise', () => {
    const core = readSrc('features/upload/queue/uploadQueueCore.ts');
    assert.ok(core.includes('shouldPauseForReview'));
    assert.ok(core.includes('canAutoAcceptWithSettings'));
    assert.ok(core.includes('policyRequiresPerItemChoice'));
    assert.ok(core.includes('resolveQueueAnalysisAction'));
  });

  it('resolveQueueAnalysisAction reexporta uploadQueueCore', () => {
    const resolver = readSrc('features/upload/config/resolveQueueAnalysisAction.ts');
    assert.ok(resolver.includes('uploadQueueCore'));
  });

  it('SettingsPage expõe seção de upload e análise da IA', () => {
    const settings = readSrc('features/settings/SettingsPage.tsx');
    const section = readSrc('features/settings/components/sections/UploadAiSettingsSection.tsx');
    assert.ok(settings.includes('UploadAiSettingsSection'));
    assert.ok(section.includes('ReviewWorkflowSettingsPanel'));
    assert.ok(section.includes('variant="inline"'));
    assert.ok(section.includes('useUploadQueueContext'));
  });

  it('ReviewWorkflowSettingsPanel suporta variant inline para configurações', () => {
    const panel = readSrc('features/document-send/components/ReviewWorkflowSettingsPanel.tsx');
    assert.ok(panel.includes("variant?: 'dropdown' | 'inline'"));
    assert.ok(panel.includes('upload-workflow-settings-inline'));
  });
});
