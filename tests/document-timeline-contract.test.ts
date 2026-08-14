import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTimelineActionGroupFilter,
  buildTimelineStatusFilter,
  mapDocumentTimelineRow,
} from '../server/audit/documentAuditLogService.js';
import type { MongoAuditLog } from '../server/db/types.js';

type Filter = Record<string, unknown>;

function readPath(doc: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      doc,
    );
}

/**
 * Avaliador do subconjunto de operadores que os filtros da timeline usam. Existe para que o teste
 * verifique o comportamento da consulta contra documentos, e não o formato do objeto — a precedência
 * de grupo de ação é justamente o que um assert estrutural deixaria passar quebrado.
 */
function matches(doc: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return (value as Filter[]).some((sub) => matches(doc, sub));
    if (key === '$and') return (value as Filter[]).every((sub) => matches(doc, sub));
    if (key === '$nor') return !(value as Filter[]).some((sub) => matches(doc, sub));

    const actual = readPath(doc, key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.entries(value as Record<string, unknown>).every(([operator, operand]) => {
        if (operator === '$regex') return new RegExp(operand as string).test(String(actual ?? ''));
        if (operator === '$exists') return (actual !== undefined) === operand;
        throw new Error(`Operador não suportado pelo matcher do teste: ${operator}`);
      });
    }

    return actual === value;
  });
}

function row(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    _id: 'audit_1',
    action: 'document.downloaded',
    description: 'Download realizado',
    result: 'success',
    createdAt: new Date('2026-08-13T12:00:00.000Z'),
    documentId: 'doc_1',
    versionId: null,
    actor: { userId: 'user_1' },
    metadata: {},
    ...overrides,
  };
}

describe('buildTimelineActionGroupFilter', () => {
  it('casa o carimbo de metadata quando o evento passou por emitTrackingEvent', () => {
    const filter = buildTimelineActionGroupFilter('governance')!;
    assert.ok(
      matches(row({ action: 'document.rule_matched', metadata: { actionGroup: 'governance' } }), filter),
    );
  });

  it('casa por derivação quando o evento não tem carimbo', () => {
    const filter = buildTimelineActionGroupFilter('preview')!;
    assert.ok(matches(row({ action: 'document.preview_viewed' }), filter));
  });

  it('respeita a precedência de primeira regra: preview não cai em lifecycle', () => {
    const lifecycle = buildTimelineActionGroupFilter('lifecycle')!;
    const preview = buildTimelineActionGroupFilter('preview')!;
    const previewRow = row({ action: 'document.preview_viewed' });

    assert.equal(matches(previewRow, preview), true);
    assert.equal(matches(previewRow, lifecycle), false);
  });

  it('não deixa o prefixo document. genérico capturar download nem storage', () => {
    const lifecycle = buildTimelineActionGroupFilter('lifecycle')!;
    assert.equal(matches(row({ action: 'document.downloaded' }), lifecycle), false);
    assert.equal(matches(row({ action: 'document.storage_promoted' }), lifecycle), false);
    assert.equal(matches(row({ action: 'document.metadata_updated' }), lifecycle), true);
  });

  it('carimbo divergente vence a derivação, nos dois sentidos', () => {
    const explorer = buildTimelineActionGroupFilter('explorer')!;
    const lifecycle = buildTimelineActionGroupFilter('lifecycle')!;
    const stamped = row({ action: 'document.created', metadata: { actionGroup: 'explorer' } });

    assert.equal(matches(stamped, explorer), true);
    assert.equal(matches(stamped, lifecycle), false);
  });

  it('system também recolhe action que não casa com nenhuma regra', () => {
    const system = buildTimelineActionGroupFilter('system')!;
    assert.equal(matches(row({ action: 'tenant.provision.completed' }), system), true);
    assert.equal(matches(row({ action: 'coisa.desconhecida' }), system), true);
    assert.equal(matches(row({ action: 'document.created' }), system), false);
  });
});

describe('buildTimelineStatusFilter', () => {
  it('deriva negado por action ou por result', () => {
    const denied = buildTimelineStatusFilter('denied')!;
    assert.equal(matches(row({ action: 'document.download_denied' }), denied), true);
    assert.equal(matches(row({ action: 'document.downloaded', result: 'denied' }), denied), true);
    assert.equal(matches(row(), denied), false);
  });

  it('negado ganha de falho, como em resolveTrackingEventStatus', () => {
    const failed = buildTimelineStatusFilter('failed')!;
    const denied = buildTimelineStatusFilter('denied')!;
    const ambiguous = row({ action: 'document.share_denied', result: 'error' });

    assert.equal(matches(ambiguous, denied), true);
    assert.equal(matches(ambiguous, failed), false);
  });

  it('success exclui negado, falho e pendente', () => {
    const success = buildTimelineStatusFilter('success')!;
    assert.equal(matches(row(), success), true);
    assert.equal(matches(row({ action: 'document.upload_failed' }), success), false);
    assert.equal(matches(row({ action: 'document.share_denied' }), success), false);
    assert.equal(matches(row({ result: 'pending' }), success), false);
  });

  it('carimbo de metadata.status vence a derivação', () => {
    const success = buildTimelineStatusFilter('success')!;
    const stamped = row({ action: 'document.upload_failed', metadata: { status: 'success' } });
    assert.equal(matches(stamped, success), true);
  });
});

describe('mapDocumentTimelineRow', () => {
  it('preenche actionGroup e status derivados quando o evento não tem carimbo', () => {
    const item = mapDocumentTimelineRow(row({ action: 'document.preview_denied' }) as MongoAuditLog);
    assert.equal(item.actionGroup, 'preview');
    assert.equal(item.status, 'denied');
  });

  it('honra o carimbo quando ele existe', () => {
    const item = mapDocumentTimelineRow(
      row({ metadata: { actionGroup: 'governance', status: 'pending' } }) as MongoAuditLog,
    );
    assert.equal(item.actionGroup, 'governance');
    assert.equal(item.status, 'pending');
  });

  it('expõe o securityContext como context e o remove do metadata', () => {
    const item = mapDocumentTimelineRow(
      row({
        metadata: {
          source: 'api',
          securityContext: {
            ipAddressMasked: '189.45.xxx.xxx',
            country: 'BR',
            city: 'Porto Alegre',
            browser: 'Chrome',
            deviceType: 'desktop',
            sessionIdHash: 'abc123',
            authMethod: 'session',
            isExternalGuest: false,
            permissionResult: 'allowed',
          },
        },
      }) as MongoAuditLog,
    );

    assert.equal(item.context?.ipMasked, '189.45.xxx.xxx');
    assert.equal(item.context?.country, 'BR');
    assert.equal(item.context?.deviceType, 'desktop');
    assert.equal(item.context?.sessionHash, 'abc123');
    assert.equal(item.context?.isExternalGuest, false);
    assert.equal(item.context?.permissionResult, 'allowed');
    assert.equal(item.metadata?.securityContext, undefined);
    assert.equal(item.metadata?.source, 'api');
  });

  it('aceita o formato legado security e omite context quando não há nenhum dos dois', () => {
    const legacy = mapDocumentTimelineRow(
      row({ metadata: { security: { country: 'BR' } } }) as MongoAuditLog,
    );
    assert.equal(legacy.context?.country, 'BR');
    assert.equal(legacy.metadata?.security, undefined);

    const bare = mapDocumentTimelineRow(row() as MongoAuditLog);
    assert.equal(bare.context, undefined);
  });

  it('leva os papéis do ator para o contrato', () => {
    const item = mapDocumentTimelineRow(
      row({
        actor: {
          userId: 'user_1',
          role: 'company_admin',
          roles: ['company_admin', 'user'],
          displayNameSnapshot: 'Helena',
          emailSnapshot: 'helena@meridiano-eng.dev',
        },
      }) as MongoAuditLog,
    );

    assert.equal(item.actor.role, 'company_admin');
    assert.deepEqual(item.actor.roles, ['company_admin', 'user']);
    assert.equal(item.actor.displayName, 'Helena');
    assert.equal(item.actor.email, 'helena@meridiano-eng.dev');
  });
});
