import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Paths that may mention legado (migração, audit, tipos, fallbacks de leitura). */
const ALLOW_WRITE_MENTION = [
  /scripts\/(migrate|audit|cleanup|drop-empty|backfill|mongo-cleanup|seed-|demo-seed|dev-reset|assert-)/,
  /server\/db\/(types|constants|setupMongo)\.ts$/,
  /server\/services\/accessGroupsService\.ts$/,
  /tests\//,
];

/** Writes proibidos em runtime do app. */
const FORBIDDEN_WRITE_PATTERNS = [
  /REGISTRY_COLLECTIONS\.companyMembers\)\.(insert|update|replace|bulkWrite|findOneAndUpdate)/,
  /REGISTRY_COLLECTIONS\.companies\)\.(insert|update|replace|bulkWrite|findOneAndUpdate)/,
  /collection\([^)]*companyMembers[^)]*\)\.(insert|update|replace|bulkWrite)/,
  /collection\([^)]*companies[^)]*\)\.(insert|update|replace|bulkWrite)/,
  /names\.documentClasses!\)\.(insert|update|replace|bulkWrite)/,
  /names\.accessGroups!\)\.(insert|update|replace|bulkWrite)/,
  /documentClasses\)\.(insert|update|replace|bulkWrite)/,
  /accessGroups\)\.(insert|update|replace|bulkWrite)/,
  /currentMetadataPreview:\s*[\[{'"`0-9a-zA-Z_]/,
  /metadataIndex:\s*[\[{]/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isAllowed(rel: string): boolean {
  return ALLOW_WRITE_MENTION.some((p) => p.test(rel));
}

describe('persistência Mongo — formato canônico', () => {
  it('server/api não gravam company_members, companies, document_classes, access_groups, preview/index', () => {
    const files = [
      ...walk(join(root, 'server')),
      ...walk(join(root, 'api')),
    ];
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(root, file).replace(/\\/g, '/');
      if (isAllowed(rel)) continue;
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of FORBIDDEN_WRITE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
          }
        }
      }
    }

    assert.deepEqual(violations, [], violations.join('\n'));
  });

  it('confirm grava searchMeta e não metadataIndex/preview', () => {
    const confirm = readFileSync(join(root, 'server/services/confirmAnalysisService.ts'), 'utf8');
    const update = readFileSync(
      join(root, 'server/services/confirmUpdateDocumentVersionService.ts'),
      'utf8',
    );
    assert.ok(confirm.includes('searchMeta'));
    assert.ok(update.includes('searchMeta'));
    assert.equal(confirm.includes('currentMetadataPreview'), false);
    assert.equal(update.includes('currentMetadataPreview'), false);
    assert.equal(confirm.includes('metadataIndex'), false);
    assert.equal(update.includes('metadataIndex'), false);
  });

  it('saveTenantMember não faz dual-write em company_members', () => {
    const repo = readFileSync(join(root, 'server/services/tenantMemberRepository.ts'), 'utf8');
    const saveBlock = repo.slice(repo.indexOf('export async function saveTenantMember'));
    const end = saveBlock.indexOf('export async function listTenantMembers');
    const body = end > 0 ? saveBlock.slice(0, end) : saveBlock;
    assert.ok(body.includes('tenantMembers'));
    assert.equal(body.includes('companyMembers'), false);
  });

  it('resolver não aponta para document_classes/access_groups', () => {
    const resolver = readFileSync(join(root, 'server/tenancy/tenantResolver.ts'), 'utf8');
    const storage = readFileSync(join(root, 'server/tenancy/tenantStorage.ts'), 'utf8');
    assert.equal(/accessGroups:\s*resolvePrefixedName/.test(resolver), false);
    assert.equal(/documentClasses:\s*resolvePrefixedName/.test(resolver), false);
    assert.equal(/accessGroups:\s*resolvePrefixedName/.test(storage), false);
    assert.equal(/documentClasses:\s*resolvePrefixedName/.test(storage), false);
  });
});
