import {
  createUser,
  findUserByEmail,
  generateTemporaryPassword,
  setTemporaryPassword,
  syncRealmRoles,
} from '../auth/keycloakAdminService.js';
import { isKeycloakAdminConfigured } from '../utils/keycloakEnv.js';
import {
  CONSENT_TEXT_VERSION,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type MongoTenantMember,
  type NotificationPreferences,
  type TenantType,
} from '../db/types.js';
import { detectTaxIdType, hashTaxId, maskTaxId, validateTaxId, type TaxIdType } from '../tenancy/taxId.js';
import {
  isValidEmail,
  isValidWhatsapp,
  maskWhatsappForLog,
  normalizeEmail,
  normalizeWhatsapp,
} from '../utils/contactNormalize.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { logger } from '../utils/logger.js';
import { findOrCreateTenantByTaxId, getTenantByTaxIdHash } from './tenantsService.js';
import {
  createUniqueMemberId,
  findTenantMemberByEmailInTenant,
  saveTenantMember,
} from './tenantMemberRepository.js';
import { createUserAuditLog } from './userAuditService.js';

const APP_ENV = process.env.APP_ENV?.trim() || process.env.NODE_ENV || 'development';
const PUBLIC_ACTOR = { userId: 'public', name: 'Solicitação pública', role: 'public' };

function isDevelopmentEnv(): boolean {
  return APP_ENV !== 'production';
}

function genericSuccessResponse() {
  return {
    ok: true,
    message:
      'Solicitação enviada com sucesso. Seu acesso será analisado pelo administrador responsável.',
  };
}

async function ensureKeycloakUserForPublicRequest(input: {
  email: string;
  firstName: string;
  lastName: string;
  memberId: string;
  tenantId: string;
}): Promise<{ keycloakUserId?: string; temporaryPassword?: string }> {
  if (!isKeycloakAdminConfigured()) {
    logger.warn('Keycloak admin não configurado — solicitação sem usuário Keycloak.');
    return {};
  }

  const email = normalizeEmail(input.email);
  let keycloakUserId = (await findUserByEmail(email))?.id;

  if (!keycloakUserId) {
    keycloakUserId = await createUser({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
    });

    await createUserAuditLog({
      tenantId: input.tenantId,
      actor: PUBLIC_ACTOR,
      action: 'KEYCLOAK_USER_CREATED',
      description: 'Usuário criado no Keycloak durante solicitação pública.',
      memberId: input.memberId,
      metadata: { email },
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  await setTemporaryPassword(keycloakUserId, temporaryPassword);
  await syncRealmRoles(keycloakUserId, ['user']);

  return {
    keycloakUserId,
    temporaryPassword: isDevelopmentEnv() ? temporaryPassword : undefined,
  };
}

export type PublicAccessRequestInput = {
  personType: TenantType;
  taxId: string;
  tenantDisplayName: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  jobTitle: string;
  departmentText: string;
  reason: string;
  operationalNotificationsConsent: boolean;
};

export async function submitPublicAccessRequest(input: PublicAccessRequestInput) {
  const personType = input.personType;
  const taxIdType: TaxIdType = personType === 'individual' ? 'CPF' : 'CNPJ';
  const taxId = input.taxId.trim();
  const tenantDisplayName = input.tenantDisplayName.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);
  const whatsapp = input.whatsapp.trim();
  const jobTitle = input.jobTitle.trim();
  const departmentText = input.departmentText.trim();
  const reason = input.reason.trim();

  if (!tenantDisplayName) {
    throw new ServiceError('Nome ou razão social é obrigatório.', 'VALIDATION_ERROR', 400);
  }
  if (!firstName || !lastName) {
    throw new ServiceError('Nome e sobrenome são obrigatórios.', 'VALIDATION_ERROR', 400);
  }
  if (!isValidEmail(email)) {
    throw new ServiceError('E-mail inválido.', 'VALIDATION_ERROR', 400);
  }
  if (!isValidWhatsapp(whatsapp)) {
    throw new ServiceError('WhatsApp inválido.', 'VALIDATION_ERROR', 400);
  }
  if (!validateTaxId(taxId, taxIdType)) {
    throw new ServiceError(`${taxIdType} inválido.`, 'VALIDATION_ERROR', 400);
  }
  if (detectTaxIdType(taxId) !== taxIdType) {
    throw new ServiceError('Tipo de documento incompatível com o tipo de cliente.', 'VALIDATION_ERROR', 400);
  }
  if (!jobTitle) {
    throw new ServiceError('Cargo ou função é obrigatório.', 'VALIDATION_ERROR', 400);
  }
  if (!departmentText) {
    throw new ServiceError('Setor informado é obrigatório.', 'VALIDATION_ERROR', 400);
  }
  if (!reason) {
    throw new ServiceError('Motivo do acesso é obrigatório.', 'VALIDATION_ERROR', 400);
  }
  if (!input.operationalNotificationsConsent) {
    throw new ServiceError('É necessário aceitar o consentimento de notificações.', 'VALIDATION_ERROR', 400);
  }

  const taxIdHash = hashTaxId(taxId);
  const taxIdMasked = maskTaxId(taxId, taxIdType);
  const whatsappNormalized = normalizeWhatsapp(whatsapp);
  const now = new Date();

  let tenant = await getTenantByTaxIdHash(taxIdHash);
  if (!tenant) {
    const created = await findOrCreateTenantByTaxId({
      taxId,
      tenantType: personType,
      displayName: tenantDisplayName,
      legalName: tenantDisplayName,
      status: 'pending',
    });
    tenant = created.tenant;
  }

  const tenantId = tenant.tenantId;

  const existingActive = await findTenantMemberByEmailInTenant(tenantId, email, ['active']);
  if (existingActive) {
    if (!isDevelopmentEnv()) return genericSuccessResponse();
    throw new ServiceError(
      'Já existe um usuário ativo com este e-mail neste cliente.',
      'DUPLICATE_ACTIVE_MEMBER',
      409,
    );
  }

  const existingPending = await findTenantMemberByEmailInTenant(tenantId, email, ['pending']);
  if (existingPending) {
    if (!isDevelopmentEnv()) return genericSuccessResponse();
    throw new ServiceError(
      'Já existe uma solicitação pendente para este e-mail.',
      'DUPLICATE_PENDING_REQUEST',
      409,
    );
  }

  const memberId = await createUniqueMemberId(email, tenantId);
  const { keycloakUserId, temporaryPassword } = await ensureKeycloakUserForPublicRequest({
    email,
    firstName,
    lastName,
    memberId,
    tenantId,
  });

  const member: MongoTenantMember = {
    _id: memberId,
    memberId,
    tenantId,
    companyId: tenantId,
    keycloakUserId,
    username: email,
    email,
    emailNormalized: email,
    firstName,
    lastName,
    whatsapp,
    whatsappNormalized,
    status: 'pending',
    tenantRoles: [],
    accessGroupIds: [],
    requestedAccess: {
      personType,
      taxIdType,
      taxIdMasked,
      taxIdHash,
      tenantId,
      tenantDisplayName,
      jobTitle,
      departmentText,
      reason,
      requestedAt: now,
      source: 'public_form',
    },
    consent: {
      operationalNotifications: true,
      acceptedAt: now,
      consentTextVersion: CONSENT_TEXT_VERSION,
    },
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      email: true,
      whatsapp: true,
    },
    createdAt: now,
    updatedAt: now,
  };

  await saveTenantMember(member);

  await createUserAuditLog({
    tenantId,
    actor: PUBLIC_ACTOR,
    action: 'USER_ACCESS_REQUESTED',
    description: 'Solicitação pública de acesso recebida.',
    memberId,
    metadata: {
      email,
      whatsappMasked: maskWhatsappForLog(whatsapp),
      personType,
      taxIdType,
      departmentText,
      jobTitle,
      source: 'public_form',
    },
  });

  logger.info('public access request created', {
    tenantId,
    memberId,
    personType,
    membershipStatus: 'pending',
  });

  const response = genericSuccessResponse();

  if (isDevelopmentEnv() && temporaryPassword) {
    return {
      ...response,
      dev: {
        memberId,
        tenantId,
        temporaryPassword,
      },
    };
  }

  return response;
}

export function mergeNotificationPreferences(
  input?: Partial<NotificationPreferences>,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(input ?? {}),
  };
}
