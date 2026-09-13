import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGovernanceSeedForTenant } from '../scripts/demo-seed/governance.ts';
import {
  GOVERNANCE_SEED_LOCALES,
  resolveGovernanceSeedLocale,
} from '../server/db/seed/documentGovernanceSeed.ts';

const TENANT = 'company_alpha_consultoria';

describe('seed demo por idioma', () => {
  it('sem idioma é pt-BR, e idioma desconhecido para o seed em vez de semear português', () => {
    assert.equal(resolveGovernanceSeedLocale(undefined), 'pt-BR');
    assert.equal(resolveGovernanceSeedLocale('es-419'), 'es-419');
    assert.throws(() => resolveGovernanceSeedLocale('fr-FR'), /não suportado/);
  });

  it('muda o que se lê e mantém o que se aponta', () => {
    const pt = buildGovernanceSeedForTenant(TENANT);
    for (const locale of GOVERNANCE_SEED_LOCALES) {
      const seed = buildGovernanceSeedForTenant(TENANT, locale);
      const ids = (s: typeof pt) =>
        [...s.categories, ...s.groups, ...s.accessRules, ...s.extractionRules].map((r) => r._id);
      assert.deepEqual(ids(seed), ids(pt), locale);
      assert.deepEqual(
        seed.categories.map((c) => c.slug),
        pt.categories.map((c) => c.slug),
      );
      assert.deepEqual(
        seed.accessRules.map((r) => [r.groupId, r.categoryId]),
        pt.accessRules.map((r) => [r.groupId, r.categoryId]),
      );
      assert.deepEqual(
        seed.extractionRules.map((r) => r.fields.map((f) => f.key)),
        pt.extractionRules.map((r) => r.fields.map((f) => f.key)),
      );
      for (const rule of seed.extractionRules) {
        const placeholders = (template?: string) => template?.match(/\{\w+\}/g)?.sort();
        const ptRule = pt.extractionRules.find((r) => r._id === rule._id)!;
        assert.deepEqual(placeholders(rule.namingTemplate), placeholders(ptRule.namingTemplate));
      }
    }
  });

  it('em inglês nenhum nome, descrição ou rótulo continua em português', () => {
    const pt = buildGovernanceSeedForTenant(TENANT);
    const en = buildGovernanceSeedForTenant(TENANT, 'en-US');
    const texts = (s: typeof pt) => [
      ...s.categories.flatMap((c) => [c.name, c.description]),
      ...s.groups.flatMap((g) => [g.name, g.description]),
      ...s.extractionRules.flatMap((r) => r.fields.map((f) => f.label)),
    ];
    const portugues = new Set(texts(pt));
    assert.deepEqual(
      texts(en).filter((text) => portugues.has(text)),
      [],
    );
    assert.equal(en.categories.find((c) => c._id.startsWith('cat_contratos'))?.name, 'Contracts');
  });

  it('todo idioma tem todo texto preenchido', () => {
    for (const locale of GOVERNANCE_SEED_LOCALES) {
      const seed = buildGovernanceSeedForTenant(TENANT, locale);
      for (const category of seed.categories) {
        assert.ok(category.name && category.description && category.keywords.length, locale);
      }
      for (const group of seed.groups) assert.ok(group.name && group.description, locale);
      for (const rule of seed.extractionRules) {
        for (const f of rule.fields) assert.ok(f.label && f.aliases?.length, `${locale} ${f.key}`);
      }
    }
  });
});
