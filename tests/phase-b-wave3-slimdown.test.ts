import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('phase-b wave3 slim-down (Mounjaro)', () => {
  it('helpers compartilhados de confirm existem e são usados', () => {
    const shared = read('server/services/confirm/confirmVersionShared.ts');
    assert.match(shared, /export class ConfirmAnalysisError/);
    assert.match(shared, /export async function persistConfirmedVersionFile/);
    assert.match(shared, /export function mapVersionMetadata/);
    assert.match(shared, /export function requireConfirmClassification/);

    const create = read('server/services/confirmAnalysisService.ts');
    const update = read('server/services/confirmUpdateDocumentVersionService.ts');
    assert.match(create, /from '\.\/confirm\/confirmVersionShared\.js'/);
    assert.match(update, /from '\.\/confirm\/confirmVersionShared\.js'/);
    assert.doesNotMatch(create, /function mapVersionMetadata\(/);
    assert.doesNotMatch(update, /function persistConfirmedVersionFile\(/);
  });

  it('helpers PDF compartilhados existem e são usados', () => {
    const helpers = read('server/ai/services/pdfAnalysisHelpers.ts');
    assert.match(helpers, /export function validatePdfUpload/);
    assert.match(helpers, /export function createLog/);

    const analyze = read('server/ai/services/analyzePdfService.ts');
    const update = read('server/ai/services/analyzePdfUpdateService.ts');
    assert.match(analyze, /from '\.\/pdfAnalysisHelpers\.js'/);
    assert.match(update, /from '\.\/pdfAnalysisHelpers\.js'/);
    assert.doesNotMatch(analyze, /function validatePdfUpload\(/);
    assert.doesNotMatch(update, /function validatePdfUpload\(/);
  });

  it('mongoose e models legados foram removidos', () => {
    assert.equal(existsSync(join(root, 'server/db/mongo.ts')), false);
    assert.equal(existsSync(join(root, 'server/models/Document.ts')), false);
    assert.equal(existsSync(join(root, 'server/models/AuditEvent.ts')), false);

    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
    };
    assert.equal(pkg.dependencies?.mongoose, undefined);
  });

  it('stubs metadata/classification não existem mais como módulos', () => {
    assert.equal(existsSync(join(root, 'server/services/metadataService.ts')), false);
    assert.equal(
      existsSync(join(root, 'server/services/documentClassificationService.ts')),
      false,
    );
    // Os stubs viveram inline no documentService enquanto o upload legado existia. Com a rota
    // /api/documents/upload removida, saíram junto: metadado e classe vêm do pipeline de IA.
    const docService = read('server/services/documentService.ts');
    assert.equal(docService.includes('async function extractMetadata'), false);
    assert.equal(docService.includes('async function classifyDocument'), false);
  });

  it('accessGroupsService permanece como stub 410', () => {
    const source = read('server/services/accessGroupsService.ts');
    assert.match(source, /ACCESS_GROUPS_MONGO_DEPRECATED/);
    assert.match(source, /410/);
  });
});
