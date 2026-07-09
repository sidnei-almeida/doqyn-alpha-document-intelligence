import type {
  MongoDocumentAccessPermissions,
  MongoDocumentAccessRule,
  MongoDocumentCategory,
  MongoDocumentExtractionRule,
  MongoDocumentGroup,
  MongoDocumentGroupMember,
} from '../types.js';
import { DEV_TENANT_ID } from '../constants.js';

const now = new Date();

function categorySeed(input: {
  _id: string;
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  sortOrder: number;
  iconKey?: string;
  color?: string;
}): MongoDocumentCategory {
  return {
    _id: input._id,
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: input.name,
    slug: input.slug,
    description: input.description,
    active: true,
    keywords: input.keywords,
    negativeKeywords: [],
    iconKey: input.iconKey ?? 'file-text',
    color: input.color ?? 'neutral',
    sortOrder: input.sortOrder,
    notifyOnUpdate: false,
    notifyGroups: [],
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

export const SEED_GOVERNANCE_CATEGORIES: MongoDocumentCategory[] = [
  categorySeed({
    _id: 'cat_contratos',
    name: 'Contratos',
    slug: 'contratos',
    description: 'Contratos comerciais, fornecedores e parceiros.',
    keywords: ['contrato', 'contratante', 'contratada', 'fornecedor', 'vigência', 'assinatura'],
    sortOrder: 1,
    color: 'blue',
  }),
  categorySeed({
    _id: 'cat_financeiro',
    name: 'Financeiro',
    slug: 'financeiro',
    description: 'Documentos financeiros, fiscais e de pagamento.',
    keywords: ['nota fiscal', 'boleto', 'fatura', 'pagamento', 'financeiro', 'nf-e'],
    sortOrder: 2,
    color: 'green',
  }),
  categorySeed({
    _id: 'cat_juridico',
    name: 'Jurídico',
    slug: 'juridico',
    description: 'Documentos jurídicos, NDAs e compliance.',
    keywords: ['jurídico', 'juridico', 'nda', 'confidencialidade', 'legal', 'acordo'],
    sortOrder: 3,
    color: 'purple',
  }),
  categorySeed({
    _id: 'cat_rh',
    name: 'Recursos Humanos',
    slug: 'recursos-humanos',
    description: 'Políticas internas, folha e documentos de RH.',
    keywords: ['recursos humanos', 'rh', 'funcionário', 'política interna', 'folha'],
    sortOrder: 4,
    color: 'amber',
  }),
  categorySeed({
    _id: 'cat_compras',
    name: 'Compras',
    slug: 'compras',
    description: 'Ordens de compra, cotações e procurement.',
    keywords: ['compras', 'ordem de compra', 'cotação', 'fornecedor', 'pedido'],
    sortOrder: 5,
    color: 'red',
  }),
  categorySeed({
    _id: 'cat_operacional',
    name: 'Operacional',
    slug: 'operacional',
    description: 'Procedimentos operacionais e documentos do dia a dia.',
    keywords: ['operacional', 'procedimento', 'manual', 'processo', 'operação'],
    sortOrder: 6,
    color: 'neutral',
  }),
];

export const SEED_GOVERNANCE_GROUPS: MongoDocumentGroup[] = [
  {
    _id: 'group_financeiro',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Financeiro',
    slug: 'financeiro',
    description: 'Equipe financeira e fiscal.',
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_juridico',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Jurídico',
    slug: 'juridico',
    description: 'Equipe jurídica e compliance.',
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_rh',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'RH',
    slug: 'rh',
    description: 'Recursos humanos.',
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_compras',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Compras',
    slug: 'compras',
    description: 'Equipe de compras e procurement.',
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_diretoria',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Diretoria',
    slug: 'diretoria',
    description: 'Diretoria executiva.',
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  },
];

function accessRule(
  _id: string,
  groupId: string,
  categoryId: string,
  permissions: MongoDocumentAccessPermissions,
): MongoDocumentAccessRule {
  return {
    _id,
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    groupId,
    categoryId,
    permissions,
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

const fullManage: MongoDocumentAccessPermissions = {
  view: true,
  download: true,
  upload: true,
  share: true,
  manage: true,
};

const readUpload: MongoDocumentAccessPermissions = {
  view: true,
  download: true,
  upload: true,
  share: false,
  manage: false,
};

const readDownloadShareManage: MongoDocumentAccessPermissions = {
  view: true,
  download: true,
  upload: false,
  share: true,
  manage: true,
};

export const SEED_GOVERNANCE_ACCESS_RULES: MongoDocumentAccessRule[] = [
  accessRule('rule_juridico_juridico', 'group_juridico', 'cat_juridico', fullManage),
  accessRule('rule_juridico_contratos', 'group_juridico', 'cat_contratos', fullManage),
  accessRule('rule_financeiro_financeiro', 'group_financeiro', 'cat_financeiro', readUpload),
  accessRule('rule_financeiro_contratos', 'group_financeiro', 'cat_contratos', readUpload),
  accessRule('rule_rh_rh', 'group_rh', 'cat_rh', { ...readUpload, manage: true }),
  accessRule('rule_compras_compras', 'group_compras', 'cat_compras', readUpload),
  ...SEED_GOVERNANCE_CATEGORIES.map((category) =>
    accessRule(`rule_diretoria_${category._id}`, 'group_diretoria', category._id, readDownloadShareManage),
  ),
];

const PARTY_FIELD_REVELADORA = {
  key: 'parte_reveladora',
  label: 'Parte reveladora',
  type: 'string' as const,
  required: false,
  aliases: ['parte reveladora', 'revelador', 'divulgador', 'contratante'],
};

const PARTY_FIELD_RECEPTORA = {
  key: 'parte_receptora',
  label: 'Parte receptora',
  type: 'string' as const,
  required: true,
  aliases: ['parte receptora', 'receptor', 'recebedor', 'contratado', 'destinatário', 'destinatario'],
};

const FIELD_DATA_ASSINATURA = {
  key: 'data_assinatura',
  label: 'Data de assinatura',
  type: 'date' as const,
  required: false,
  aliases: ['data de assinatura', 'assinado em', 'firmado em', 'celebrado em'],
};

function governanceExtractionRule(category: MongoDocumentCategory): MongoDocumentExtractionRule {
  const base = {
    _id: `ext_${category._id}_v1`,
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    categoryId: category._id,
    classId: category._id,
    version: 1,
    active: true,
    minimumConfidence: 0.7,
    onLowConfidence: 'requires_review' as const,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  };

  if (category.slug === 'juridico') {
    return {
      ...base,
      fields: [PARTY_FIELD_REVELADORA, PARTY_FIELD_RECEPTORA, FIELD_DATA_ASSINATURA],
      namingTemplate: 'NDA_{parte_reveladora}_e_{parte_receptora}_{data_assinatura}_v{version}',
    };
  }

  if (category.slug === 'contratos') {
    return {
      ...base,
      fields: [
        {
          key: 'fornecedor',
          label: 'Fornecedor / contratada',
          type: 'string' as const,
          required: true,
          aliases: ['fornecedor', 'contratada', 'prestador', 'contratado'],
        },
        FIELD_DATA_ASSINATURA,
      ],
      namingTemplate: 'Contrato_{fornecedor}_{data_assinatura}_v{version}',
    };
  }

  if (category.slug === 'financeiro') {
    return {
      ...base,
      fields: [
        {
          key: 'fornecedor',
          label: 'Emitente / fornecedor',
          type: 'string' as const,
          required: false,
          aliases: ['fornecedor', 'emitente', 'prestador'],
        },
        {
          key: 'numero_nota',
          label: 'Número do documento',
          type: 'string' as const,
          required: false,
          aliases: ['nota fiscal', 'número', 'numero', 'nf-e', 'nfe'],
        },
        {
          key: 'data_emissao',
          label: 'Data de emissão',
          type: 'date' as const,
          required: false,
          aliases: ['data de emissão', 'data de emissao', 'emitido em'],
        },
      ],
      namingTemplate: 'Fiscal_{fornecedor}_{numero_nota}_{data_emissao}_v{version}',
    };
  }

  return {
    ...base,
    fields: [
      {
        key: 'titulo',
        label: 'Título',
        type: 'string' as const,
        required: false,
        aliases: ['título', 'titulo', 'assunto'],
      },
      {
        key: 'referencia',
        label: 'Referência / parte principal',
        type: 'string' as const,
        required: false,
        aliases: ['referência', 'referencia', 'parte', 'empresa', 'responsável', 'responsavel'],
      },
      FIELD_DATA_ASSINATURA,
    ],
    namingTemplate: '{referencia}_{titulo}_{data_assinatura}_v{version}',
  };
}

export const SEED_GOVERNANCE_EXTRACTION_RULES: MongoDocumentExtractionRule[] =
  SEED_GOVERNANCE_CATEGORIES.map((category) => governanceExtractionRule(category));

export type GovernanceMemberSeed = {
  membershipId: string;
  userId: string;
  displayName?: string;
  email?: string;
  groupId: string;
};

export function buildGovernanceMemberSeeds(input: {
  membershipId: string;
  userId: string;
  displayName?: string;
  email?: string;
}): MongoDocumentGroupMember[] {
  return [
    {
      _id: `dgm_seed_diretoria_${input.membershipId}`,
      tenantId: DEV_TENANT_ID,
      companyId: DEV_TENANT_ID,
      groupId: 'group_diretoria',
      membershipId: input.membershipId,
      userId: input.userId,
      displayName: input.displayName,
      email: input.email,
      active: true,
      addedBy: 'system',
      addedAt: now,
    },
  ];
}
