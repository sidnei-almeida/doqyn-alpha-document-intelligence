import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildSecurityAuditRestricted,
  buildSecurityContext,
  encryptIpForSecurityAudit,
  maskIpAddress,
  parseUserAgentDetails,
  resolveClientIp,
} from '../server/services/tracking/securityContext.js';
import {
  initGeoIpCityReader,
  isPrivateOrLoopbackIp,
  lookupApproximateGeoFromIp,
  mapMaxMindCityResponse,
} from '../server/services/tracking/geoIpResolver.js';
import { formatSecurityContextDisplay } from '../src/features/tracking/utils/trackingDisplay.js';
import { DOCUMENT_SECURITY_CONTEXT_ACTIONS } from '../server/services/tracking/trackingTypes.js';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('tracking securityContext', () => {
  it('inclui securityContext no emitTrackingEvent', () => {
    const service = read('server/services/tracking/trackingService.ts');
    assert.ok(service.includes('securityContext'));
    assert.ok(service.includes('buildSecurityContext'));
    assert.ok(service.includes('securityAuditRestricted'));
  });

  it('mascara IP e gera hash sem expor IP completo', () => {
    assert.equal(maskIpAddress('189.45.12.34'), '189.45.xxx.xxx');
    const context = buildSecurityContext(
      {
        headers: {
          'x-forwarded-for': '189.45.12.34',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
        socket: { remoteAddress: '127.0.0.1' },
      },
      { requestId: 'req_1', isExternalGuest: false },
    );
    assert.equal(context.ipAddressMasked, '189.45.xxx.xxx');
    assert.ok(context.ipHash);
    assert.notEqual(context.ipAddressMasked, '189.45.12.34');
    assert.equal('ipAddress' in context, false);
  });

  it('resolve IP com cf-connecting-ip e x-forwarded-for', () => {
    const cfReq = {
      headers: { 'cf-connecting-ip': '203.0.113.10', 'x-forwarded-for': '10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    assert.equal(resolveClientIp(cfReq), '203.0.113.10');
  });

  it('parseia user-agent em browser/os/deviceType sem UA bruto', () => {
    const parsed = parseUserAgentDetails(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    );
    assert.equal(parsed.browser, 'Chrome');
    assert.equal(parsed.os, 'Windows');
    assert.equal(parsed.deviceType, 'desktop');
    assert.ok(parsed.userAgent);
    assert.equal(parsed.userAgent?.includes('Mozilla/5.0'), false);
  });

  it('evento externo registra isExternalGuest=true', () => {
    const context = buildSecurityContext(
      { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }, socket: {} },
      { isExternalGuest: true, authMethod: 'external_share_token' },
    );
    assert.equal(context.isExternalGuest, true);
    assert.equal(context.authMethod, 'external_share_token');
    assert.equal(context.deviceType, 'mobile');
  });

  it('evento interno registra isExternalGuest=false', () => {
    const context = buildSecurityContext(
      { headers: { 'user-agent': 'Mozilla/5.0' }, socket: {} },
      { isExternalGuest: false },
    );
    assert.equal(context.isExternalGuest, false);
    assert.equal(context.authMethod, 'session');
  });

  it('sanitize remove IP completo, token e objectKey do payload público', () => {
    const safe = sanitizeAuditMetadata({
      securityContext: {
        ipAddressMasked: '189.45.xxx.xxx',
        ipHash: 'abc123',
        userAgent: 'Chrome 120 em Windows',
      },
      securityAuditRestricted: { ipAddressEncrypted: 'enc_value' },
      inviteToken: 'secret-token',
      objectKey: 'tenant/doc/file.pdf',
      token: 'guest-token',
    });
    assert.equal('securityAuditRestricted' in safe, false);
    assert.equal('inviteToken' in safe, false);
    assert.equal('objectKey' in safe, false);
    assert.equal('token' in safe, false);
    const ctx = safe.securityContext as Record<string, unknown>;
    assert.equal(ctx.ipAddressMasked, '189.45.xxx.xxx');
    assert.equal('ipAddress' in ctx, false);
  });

  it('ações documentais críticas estão na allowlist de securityContext', () => {
    assert.equal(DOCUMENT_SECURITY_CONTEXT_ACTIONS.has('document.downloaded'), true);
    assert.equal(DOCUMENT_SECURITY_CONTEXT_ACTIONS.has('document.external_share_viewed'), true);
    assert.equal(DOCUMENT_SECURITY_CONTEXT_ACTIONS.has('document.share_created'), true);
    assert.equal(DOCUMENT_SECURITY_CONTEXT_ACTIONS.has('document.trash_moved'), true);
  });

  it('UI de tracking exibe contexto resumido', () => {
    const drawer = read('src/features/tracking/components/TrackingEventDetailsDrawer.tsx');
    const display = read('src/features/tracking/utils/trackingDisplay.ts');
    assert.ok(drawer.includes('formatSecurityContextDisplay'));
    assert.ok(drawer.includes('Contexto de acesso'));
    assert.ok(drawer.includes('Local aproximado'));
    assert.ok(display.includes('ipAddressMasked'));
    assert.equal(drawer.includes('user-agent bruto'), false);
  });

  it('detalhe de tracking remove securityAuditRestricted da resposta pública', () => {
    const audit = read('server/audit/documentAuditLogService.ts');
    assert.ok(audit.includes('stripRestrictedTrackingMetadata'));
    assert.ok(audit.includes('resolveTrackingSecurity'));
    assert.ok(audit.includes('securityContext'));
  });

  it('criptografa IP para securityAuditRestricted quando TRACKING_IP_ENCRYPTION_KEY está definida', () => {
    const previousKey = process.env.TRACKING_IP_ENCRYPTION_KEY;
    process.env.TRACKING_IP_ENCRYPTION_KEY = 'unit-test-tracking-ip-encryption-key';
    try {
      const encrypted = encryptIpForSecurityAudit('10.0.0.1');
      const restricted = buildSecurityAuditRestricted('10.0.0.1');
      assert.ok(encrypted);
      assert.ok(restricted?.ipAddressEncrypted);
      assert.equal(restricted?.retentionPolicy, 'security_audit_restricted');
      assert.equal(String(restricted?.ipAddressEncrypted).includes('10.0.0.1'), false);
    } finally {
      if (previousKey === undefined) delete process.env.TRACKING_IP_ENCRYPTION_KEY;
      else process.env.TRACKING_IP_ENCRYPTION_KEY = previousKey;
    }
  });

  it('usa TRACKING_IP_HASH_SALT no ipHash quando configurado', () => {
    const previousSalt = process.env.TRACKING_IP_HASH_SALT;
    process.env.TRACKING_IP_HASH_SALT = 'custom-ip-hash-salt';
    try {
      const context = buildSecurityContext(
        { headers: { 'x-forwarded-for': '203.0.113.55' }, socket: {} },
        { isExternalGuest: false },
      );
      assert.ok(context.ipHash);
      assert.notEqual(context.ipHash, '203.0.113.55');
    } finally {
      if (previousSalt === undefined) delete process.env.TRACKING_IP_HASH_SALT;
      else process.env.TRACKING_IP_HASH_SALT = previousSalt;
    }
  });

  it('identifica loopback IPv6 como rede local', () => {
    const context = buildSecurityContext(
      { headers: { 'user-agent': 'Mozilla/5.0' }, socket: { remoteAddress: '::1' } },
      { isExternalGuest: false },
    );
    assert.equal(context.isLocalNetwork, true);
    assert.equal(context.ipAddressMasked, 'rede local');
    assert.equal(isPrivateOrLoopbackIp('::1'), true);
  });

  it('resolve geo aproximada por IP público quando headers CF ausentes', async () => {
    await initGeoIpCityReader();
    const geo = lookupApproximateGeoFromIp('200.160.2.3');
    assert.equal(geo.country, 'BR');
    assert.ok(geo.region);
    assert.ok(geo.city);
  });

  it('mapeia resposta MaxMind para cidade, estado e país', () => {
    const geo = mapMaxMindCityResponse({
      city: { names: { 'pt-BR': 'Caxias do Sul', en: 'Caxias do Sul' } },
      subdivisions: [{ iso_code: 'RS', names: { en: 'Rio Grande do Sul' } }],
      country: { iso_code: 'BR' },
      location: { time_zone: 'America/Sao_Paulo' },
    } as import('maxmind').CityResponse);
    assert.equal(geo.city, 'Caxias do Sul');
    assert.equal(geo.region, 'RS');
    assert.equal(geo.country, 'BR');
    assert.equal(geo.timezone, 'America/Sao_Paulo');
  });

  it('prioriza headers Cloudflare sobre lookup local', () => {
    const context = buildSecurityContext(
      {
        headers: {
          'cf-ipcountry': 'BR',
          'cf-region': 'RS',
          'cf-ipcity': 'Caxias do Sul',
          'x-forwarded-for': '8.8.8.8',
        },
        socket: {},
      },
      { isExternalGuest: false },
    );
    assert.equal(context.city, 'Caxias do Sul');
    assert.equal(context.region, 'RS');
    assert.equal(context.country, 'BR');
  });

  it('UI mostra Rede local para eventos locais', () => {
    const display = formatSecurityContextDisplay({
      browser: 'Firefox',
      browserVersion: '152',
      os: 'Linux',
      deviceType: 'desktop',
      ipAddressMasked: '1:…',
      sessionIdHash: '1dc4576dabc',
      isLocalNetwork: true,
    });
    assert.equal(display?.locationLabel, 'Rede local');
    assert.equal(display?.ipLabel, '1:…');
  });
});
