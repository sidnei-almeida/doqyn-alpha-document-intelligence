import 'dotenv/config';
import { closeMongoConnection } from '../server/db/mongoClient.js';
import { ensureDevTenantSeed } from '../server/services/tenantsService.js';
import {
  ensureSidneiDevTenantMember,
  findActiveTenantMember,
  SIDNEI_DEV_KEYCLOAK_USER_ID,
} from '../server/services/tenantMembersService.js';
import { resolveMeFromKeycloakClaims } from '../server/services/meService.js';
import { isServiceError } from '../server/utils/serviceErrors.js';
import type { VerifiedKeycloakAuth } from '../server/auth/keycloakJwtVerifier.js';
import { isKeycloakAdminConfigured } from '../server/utils/keycloakEnv.js';

const SIDNEI_EMAIL = 'sidnei.almeida1806@gmail.com';

const sidneiClaims: VerifiedKeycloakAuth = {
  keycloakUserId: SIDNEI_DEV_KEYCLOAK_USER_ID,
  username: 'sidnei',
  email: SIDNEI_EMAIL,
  firstName: 'Sidnei',
  lastName: 'Almeida',
  name: 'Sidnei Almeida',
  roles: ['company_admin', 'user'],
};

async function assertLinkedUserMe() {
  const payload = await resolveMeFromKeycloakClaims(sidneiClaims);
  const ok =
    payload.user.keycloakUserId === SIDNEI_DEV_KEYCLOAK_USER_ID &&
    payload.tenant.tenantId === 'company_dev' &&
    payload.membership.status === 'active' &&
    payload.membership.tenantRoles.includes('company_admin');

  console.log('resolveMeFromKeycloakClaims (sidnei):', ok ? 'OK' : 'FALHOU', {
    tenantId: payload.tenant.tenantId,
    membershipStatus: payload.membership.status,
    tenantRoles: payload.membership.tenantRoles,
  });

  if (!ok) {
    throw new Error('Payload /api/me inesperado para sidnei.');
  }
}

async function assertUnlinkedUser403() {
  const unlinkedClaims: VerifiedKeycloakAuth = {
    ...sidneiClaims,
    keycloakUserId: '00000000-0000-0000-0000-000000000099',
    email: 'unlinked-user@example.com',
  };

  try {
    await resolveMeFromKeycloakClaims(unlinkedClaims);
    throw new Error('Esperado MEMBER_NOT_LINKED para usuário sem vínculo.');
  } catch (error) {
    if (!isServiceError(error) || error.code !== 'MEMBER_NOT_LINKED' || error.statusCode !== 403) {
      throw error;
    }
    console.log('resolveMeFromKeycloakClaims (sem vínculo): OK 403 MEMBER_NOT_LINKED');
  }
}

async function optionalHttpMeTest() {
  const token = process.env.KEYCLOAK_TEST_ACCESS_TOKEN?.trim();
  const apiBase = process.env.KEYCLOAK_TEST_API_BASE?.trim() || 'http://localhost:3001';

  if (!token) {
    console.log('HTTP /api/me: ignorado (defina KEYCLOAK_TEST_ACCESS_TOKEN para teste E2E).');
    return;
  }

  const response = await fetch(`${apiBase}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  console.log('HTTP /api/me:', response.status, {
    tenantId: body.tenant?.tenantId,
    membershipStatus: body.membership?.status,
    code: body.code,
  });

  if (!response.ok) {
    throw new Error(`HTTP /api/me falhou com status ${response.status}`);
  }
}

async function main() {
  console.log('Keycloak admin configurado:', isKeycloakAdminConfigured() ? 'sim' : 'não (secret ausente)');

  const tenant = await ensureDevTenantSeed();
  console.log('Tenant dev:', {
    tenantId: tenant.tenantId,
    displayName: tenant.displayName,
    status: tenant.status,
    collectionPrefix: tenant.isolation.collectionPrefix,
  });

  const member = await ensureSidneiDevTenantMember();
  console.log('tenant_member sidnei:', {
    memberId: member.memberId,
    keycloakUserId: member.keycloakUserId,
    status: member.status,
    tenantRoles: member.tenantRoles,
  });

  const found = await findActiveTenantMember({
    keycloakUserId: SIDNEI_DEV_KEYCLOAK_USER_ID,
    email: SIDNEI_EMAIL,
  });
  if (!found || found.status !== 'active') {
    throw new Error('findActiveTenantMember não encontrou sidnei ativo.');
  }
  console.log('findActiveTenantMember (sidnei): OK');

  await assertLinkedUserMe();
  await assertUnlinkedUser403();
  await optionalHttpMeTest();
}

main()
  .then(async () => {
    await closeMongoConnection();
    console.log('Checkpoint Keycloak + MongoDB verificado.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Falha no checkpoint:', error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
