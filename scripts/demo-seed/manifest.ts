import { readFileSync } from 'node:fs';

export const DEMO_MANIFEST_VERSION = 1 as const;

export type DemoSeedManifestAccessGroup = {
  groupId: string;
  slug: string;
  name: string;
};

export type DemoSeedManifestPendingUser = {
  seedKey: string;
  email: string;
  displayName: string;
  whatsapp: string;
  personType: 'cpf' | 'cnpj';
  taxIdMasked: string;
  jobTitle: string;
  departmentText: string;
  reason: string;
  operationalNotificationsConsent: boolean;
  membershipId: string;
  accessRequestId: string;
  status: 'pending';
};

export type DemoSeedManifestCompany = {
  seedKey: string;
  tenantId: string;
  tenantType: 'business';
  displayName: string;
  legalName: string;
  cnpj: string;
  slug: string;
  status: 'active';
  accessGroups: DemoSeedManifestAccessGroup[];
  pendingUsers: DemoSeedManifestPendingUser[];
};

export type DemoSeedManifestGlobalAdmin = {
  seedKey: string;
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  membershipId: string;
  roles: string[];
  status: 'active';
};

export type DemoSeedManifest = {
  version: typeof DEMO_MANIFEST_VERSION;
  source: 'dev_seed_demo';
  generatedAt: string;
  authServiceRoot: string;
  companies: DemoSeedManifestCompany[];
  globalAdmin: DemoSeedManifestGlobalAdmin;
};

export function readDemoSeedManifest(manifestPath: string): DemoSeedManifest {
  const raw = readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as DemoSeedManifest;

  if (parsed.version !== DEMO_MANIFEST_VERSION) {
    throw new Error(`Manifest demo incompatível: version=${String(parsed.version)}.`);
  }
  if (parsed.source !== 'dev_seed_demo') {
    throw new Error(`Manifest demo inválido: source=${String(parsed.source)}.`);
  }

  return parsed;
}
