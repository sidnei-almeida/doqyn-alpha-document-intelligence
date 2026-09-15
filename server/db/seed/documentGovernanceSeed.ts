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

/**
 * Idiomas em que a governança de demonstração sabe nascer (Fase 11.6 do `.planning/I18N-PLANO.md`).
 *
 * Só o seed demo usa este arquivo. Uma demonstração em inglês com classes chamadas "Contratos" e
 * "Financeiro" desfaz a tradução inteira justamente na tela que o cliente vê — então nome,
 * descrição, palavras-chave, rótulos e modelo de nome seguem o idioma. `_id`, `slug` e `key` não
 * mudam: são chave técnica, e regra de acesso e pipeline apontam para eles.
 */
export const GOVERNANCE_SEED_LOCALES = ['pt-BR', 'en-US', 'es-419'] as const;
export type GovernanceSeedLocale = (typeof GOVERNANCE_SEED_LOCALES)[number];

/** Sem idioma é pt-BR; idioma desconhecido para o seed, em vez de semear português calado. */
export function resolveGovernanceSeedLocale(
  value: string | null | undefined,
): GovernanceSeedLocale {
  if (!value) return 'pt-BR';
  if ((GOVERNANCE_SEED_LOCALES as readonly string[]).includes(value)) {
    return value as GovernanceSeedLocale;
  }
  throw new Error(
    `Idioma do seed demo não suportado: "${value}". Use ${GOVERNANCE_SEED_LOCALES.join(', ')}.`,
  );
}

type Text = { name: string; description: string };
type CategoryText = Text & { keywords: string[] };
type FieldText = { label: string; aliases: string[] };

type CategoryTextKey = 'contratos' | 'financeiro' | 'juridico' | 'rh' | 'compras' | 'operacional';
type GroupTextKey = 'financeiro' | 'juridico' | 'rh' | 'compras' | 'diretoria';
type FieldTextKey =
  | 'parte_reveladora'
  | 'parte_receptora'
  | 'data_assinatura'
  | 'fornecedor_contrato'
  | 'fornecedor_fiscal'
  | 'numero_nota'
  | 'data_emissao'
  | 'titulo'
  | 'referencia';

type GovernanceText = {
  categories: Record<CategoryTextKey, CategoryText>;
  groups: Record<GroupTextKey, Text>;
  fields: Record<FieldTextKey, FieldText>;
  naming: { nda: string; contract: string; fiscal: string; generic: string };
};

const GOVERNANCE_TEXT: Record<GovernanceSeedLocale, GovernanceText> = {
  'pt-BR': {
    categories: {
      contratos: {
        name: 'Contratos',
        description: 'Contratos comerciais, fornecedores e parceiros.',
        keywords: ['contrato', 'contratante', 'contratada', 'fornecedor', 'vigência', 'assinatura'],
      },
      financeiro: {
        name: 'Financeiro',
        description: 'Documentos financeiros, fiscais e de pagamento.',
        keywords: ['nota fiscal', 'boleto', 'fatura', 'pagamento', 'financeiro', 'nf-e'],
      },
      juridico: {
        name: 'Jurídico',
        description: 'Documentos jurídicos, NDAs e compliance.',
        keywords: ['jurídico', 'juridico', 'nda', 'confidencialidade', 'legal', 'acordo'],
      },
      rh: {
        name: 'Recursos Humanos',
        description: 'Políticas internas, folha e documentos de RH.',
        keywords: ['recursos humanos', 'rh', 'funcionário', 'política interna', 'folha'],
      },
      compras: {
        name: 'Compras',
        description: 'Ordens de compra, cotações e procurement.',
        keywords: ['compras', 'ordem de compra', 'cotação', 'fornecedor', 'pedido'],
      },
      operacional: {
        name: 'Operacional',
        description: 'Procedimentos operacionais e documentos do dia a dia.',
        keywords: ['operacional', 'procedimento', 'manual', 'processo', 'operação'],
      },
    },
    groups: {
      financeiro: { name: 'Financeiro', description: 'Equipe financeira e fiscal.' },
      juridico: { name: 'Jurídico', description: 'Equipe jurídica e compliance.' },
      rh: { name: 'RH', description: 'Recursos humanos.' },
      compras: { name: 'Compras', description: 'Equipe de compras e procurement.' },
      diretoria: { name: 'Diretoria', description: 'Diretoria executiva.' },
    },
    fields: {
      parte_reveladora: {
        label: 'Parte reveladora',
        aliases: ['parte reveladora', 'revelador', 'divulgador', 'contratante'],
      },
      parte_receptora: {
        label: 'Parte receptora',
        aliases: [
          'parte receptora',
          'receptor',
          'recebedor',
          'contratado',
          'destinatário',
          'destinatario',
        ],
      },
      data_assinatura: {
        label: 'Data de assinatura',
        aliases: ['data de assinatura', 'assinado em', 'firmado em', 'celebrado em'],
      },
      fornecedor_contrato: {
        label: 'Fornecedor / contratada',
        aliases: ['fornecedor', 'contratada', 'prestador', 'contratado'],
      },
      fornecedor_fiscal: {
        label: 'Emitente / fornecedor',
        aliases: ['fornecedor', 'emitente', 'prestador'],
      },
      numero_nota: {
        label: 'Número do documento',
        aliases: ['nota fiscal', 'número', 'numero', 'nf-e', 'nfe'],
      },
      data_emissao: {
        label: 'Data de emissão',
        aliases: ['data de emissão', 'data de emissao', 'emitido em'],
      },
      titulo: { label: 'Título', aliases: ['título', 'titulo', 'assunto'] },
      referencia: {
        label: 'Referência / parte principal',
        aliases: ['referência', 'referencia', 'parte', 'empresa', 'responsável', 'responsavel'],
      },
    },
    naming: {
      nda: 'NDA_{parte_reveladora}_e_{parte_receptora}_{data_assinatura}_v{version}',
      contract: 'Contrato_{fornecedor}_{data_assinatura}_v{version}',
      fiscal: 'Fiscal_{fornecedor}_{numero_nota}_{data_emissao}_v{version}',
      generic: '{referencia}_{titulo}_{data_assinatura}_v{version}',
    },
  },
  'en-US': {
    categories: {
      contratos: {
        name: 'Contracts',
        description: 'Commercial contracts, suppliers and partners.',
        keywords: ['contract', 'contractor', 'supplier', 'term', 'signature', 'agreement'],
      },
      financeiro: {
        name: 'Finance',
        description: 'Financial, tax and payment documents.',
        keywords: ['invoice', 'bill', 'payment', 'receipt', 'tax', 'finance'],
      },
      juridico: {
        name: 'Legal',
        description: 'Legal documents, NDAs and compliance.',
        keywords: ['legal', 'nda', 'confidentiality', 'non-disclosure', 'compliance', 'agreement'],
      },
      rh: {
        name: 'Human Resources',
        description: 'Internal policies, payroll and HR documents.',
        keywords: ['human resources', 'hr', 'employee', 'internal policy', 'payroll'],
      },
      compras: {
        name: 'Purchasing',
        description: 'Purchase orders, quotes and procurement.',
        keywords: ['purchasing', 'purchase order', 'quote', 'supplier', 'procurement'],
      },
      operacional: {
        name: 'Operations',
        description: 'Operating procedures and day-to-day documents.',
        keywords: ['operations', 'procedure', 'manual', 'process', 'operation'],
      },
    },
    groups: {
      financeiro: { name: 'Finance', description: 'Finance and tax team.' },
      juridico: { name: 'Legal', description: 'Legal and compliance team.' },
      rh: { name: 'HR', description: 'Human resources.' },
      compras: { name: 'Purchasing', description: 'Purchasing and procurement team.' },
      diretoria: { name: 'Executive Board', description: 'Executive leadership.' },
    },
    fields: {
      parte_reveladora: {
        label: 'Disclosing party',
        aliases: ['disclosing party', 'discloser', 'disclosing', 'contracting party'],
      },
      parte_receptora: {
        label: 'Receiving party',
        aliases: ['receiving party', 'recipient', 'receiver', 'contractor'],
      },
      data_assinatura: {
        label: 'Signature date',
        aliases: ['signature date', 'signed on', 'executed on', 'dated'],
      },
      fornecedor_contrato: {
        label: 'Supplier / contractor',
        aliases: ['supplier', 'contractor', 'service provider', 'vendor'],
      },
      fornecedor_fiscal: {
        label: 'Issuer / supplier',
        aliases: ['supplier', 'issuer', 'vendor', 'seller'],
      },
      numero_nota: {
        label: 'Document number',
        aliases: ['invoice number', 'number', 'invoice no', 'bill number'],
      },
      data_emissao: {
        label: 'Issue date',
        aliases: ['issue date', 'issued on', 'invoice date'],
      },
      titulo: { label: 'Title', aliases: ['title', 'subject'] },
      referencia: {
        label: 'Reference / main party',
        aliases: ['reference', 'party', 'company', 'responsible'],
      },
    },
    naming: {
      nda: 'NDA_{parte_reveladora}_and_{parte_receptora}_{data_assinatura}_v{version}',
      contract: 'Contract_{fornecedor}_{data_assinatura}_v{version}',
      fiscal: 'Invoice_{fornecedor}_{numero_nota}_{data_emissao}_v{version}',
      generic: '{referencia}_{titulo}_{data_assinatura}_v{version}',
    },
  },
  'es-419': {
    categories: {
      contratos: {
        name: 'Contratos',
        description: 'Contratos comerciales, proveedores y socios.',
        keywords: ['contrato', 'contratante', 'contratista', 'proveedor', 'vigencia', 'firma'],
      },
      financeiro: {
        name: 'Finanzas',
        description: 'Documentos financieros, fiscales y de pago.',
        keywords: ['factura', 'pago', 'recibo', 'fiscal', 'finanzas', 'comprobante'],
      },
      juridico: {
        name: 'Jurídico',
        description: 'Documentos jurídicos, NDA y cumplimiento.',
        keywords: ['jurídico', 'nda', 'confidencialidad', 'legal', 'acuerdo', 'cumplimiento'],
      },
      rh: {
        name: 'Recursos Humanos',
        description: 'Políticas internas, nómina y documentos de RR. HH.',
        keywords: ['recursos humanos', 'rrhh', 'empleado', 'política interna', 'nómina'],
      },
      compras: {
        name: 'Compras',
        description: 'Órdenes de compra, cotizaciones y abastecimiento.',
        keywords: ['compras', 'orden de compra', 'cotización', 'proveedor', 'pedido'],
      },
      operacional: {
        name: 'Operaciones',
        description: 'Procedimientos operativos y documentos del día a día.',
        keywords: ['operaciones', 'procedimiento', 'manual', 'proceso', 'operación'],
      },
    },
    groups: {
      financeiro: { name: 'Finanzas', description: 'Equipo financiero y fiscal.' },
      juridico: { name: 'Jurídico', description: 'Equipo jurídico y de cumplimiento.' },
      rh: { name: 'RR. HH.', description: 'Recursos humanos.' },
      compras: { name: 'Compras', description: 'Equipo de compras y abastecimiento.' },
      diretoria: { name: 'Dirección', description: 'Dirección ejecutiva.' },
    },
    fields: {
      parte_reveladora: {
        label: 'Parte reveladora',
        aliases: ['parte reveladora', 'revelador', 'divulgador', 'contratante'],
      },
      parte_receptora: {
        label: 'Parte receptora',
        aliases: ['parte receptora', 'receptor', 'destinatario', 'contratista'],
      },
      data_assinatura: {
        label: 'Fecha de firma',
        aliases: ['fecha de firma', 'firmado el', 'suscrito el', 'celebrado el'],
      },
      fornecedor_contrato: {
        label: 'Proveedor / contratista',
        aliases: ['proveedor', 'contratista', 'prestador', 'contratado'],
      },
      fornecedor_fiscal: {
        label: 'Emisor / proveedor',
        aliases: ['proveedor', 'emisor', 'prestador'],
      },
      numero_nota: {
        label: 'Número del documento',
        aliases: ['número de factura', 'número', 'factura', 'folio'],
      },
      data_emissao: {
        label: 'Fecha de emisión',
        aliases: ['fecha de emisión', 'emitido el', 'fecha de factura'],
      },
      titulo: { label: 'Título', aliases: ['título', 'titulo', 'asunto'] },
      referencia: {
        label: 'Referencia / parte principal',
        aliases: ['referencia', 'parte', 'empresa', 'responsable'],
      },
    },
    naming: {
      nda: 'NDA_{parte_reveladora}_y_{parte_receptora}_{data_assinatura}_v{version}',
      contract: 'Contrato_{fornecedor}_{data_assinatura}_v{version}',
      fiscal: 'Factura_{fornecedor}_{numero_nota}_{data_emissao}_v{version}',
      generic: '{referencia}_{titulo}_{data_assinatura}_v{version}',
    },
  },
};

const CATEGORY_DEFS: Array<{
  _id: string;
  slug: string;
  text: CategoryTextKey;
  sortOrder: number;
  color: string;
}> = [
  { _id: 'cat_contratos', slug: 'contratos', text: 'contratos', sortOrder: 1, color: 'blue' },
  { _id: 'cat_financeiro', slug: 'financeiro', text: 'financeiro', sortOrder: 2, color: 'green' },
  { _id: 'cat_juridico', slug: 'juridico', text: 'juridico', sortOrder: 3, color: 'purple' },
  { _id: 'cat_rh', slug: 'recursos-humanos', text: 'rh', sortOrder: 4, color: 'amber' },
  { _id: 'cat_compras', slug: 'compras', text: 'compras', sortOrder: 5, color: 'red' },
  {
    _id: 'cat_operacional',
    slug: 'operacional',
    text: 'operacional',
    sortOrder: 6,
    color: 'neutral',
  },
];

const GROUP_DEFS: Array<{ _id: string; slug: string; text: GroupTextKey }> = [
  { _id: 'group_financeiro', slug: 'financeiro', text: 'financeiro' },
  { _id: 'group_juridico', slug: 'juridico', text: 'juridico' },
  { _id: 'group_rh', slug: 'rh', text: 'rh' },
  { _id: 'group_compras', slug: 'compras', text: 'compras' },
  { _id: 'group_diretoria', slug: 'diretoria', text: 'diretoria' },
];

function buildCategories(text: GovernanceText): MongoDocumentCategory[] {
  return CATEGORY_DEFS.map((def) => ({
    _id: def._id,
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: text.categories[def.text].name,
    slug: def.slug,
    description: text.categories[def.text].description,
    active: true,
    keywords: text.categories[def.text].keywords,
    negativeKeywords: [],
    iconKey: 'file-text',
    color: def.color,
    sortOrder: def.sortOrder,
    notifyOnUpdate: false,
    notifyGroups: [],
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  }));
}

function buildGroups(text: GovernanceText): MongoDocumentGroup[] {
  return GROUP_DEFS.map((def) => ({
    _id: def._id,
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: text.groups[def.text].name,
    slug: def.slug,
    description: text.groups[def.text].description,
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  }));
}

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

function buildAccessRules(categories: MongoDocumentCategory[]): MongoDocumentAccessRule[] {
  return [
    accessRule('rule_juridico_juridico', 'group_juridico', 'cat_juridico', fullManage),
    accessRule('rule_juridico_contratos', 'group_juridico', 'cat_contratos', fullManage),
    accessRule('rule_financeiro_financeiro', 'group_financeiro', 'cat_financeiro', readUpload),
    accessRule('rule_financeiro_contratos', 'group_financeiro', 'cat_contratos', readUpload),
    accessRule('rule_rh_rh', 'group_rh', 'cat_rh', { ...readUpload, manage: true }),
    accessRule('rule_compras_compras', 'group_compras', 'cat_compras', readUpload),
    ...categories.map((category) =>
      accessRule(
        `rule_diretoria_${category._id}`,
        'group_diretoria',
        category._id,
        readDownloadShareManage,
      ),
    ),
  ];
}

function field(
  text: GovernanceText,
  key: string,
  textKey: FieldTextKey,
  type: 'string' | 'date',
  required: boolean,
) {
  return {
    key,
    label: text.fields[textKey].label,
    type,
    required,
    aliases: text.fields[textKey].aliases,
  };
}

function buildExtractionRule(
  category: MongoDocumentCategory,
  text: GovernanceText,
): MongoDocumentExtractionRule {
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
  const signatureDate = field(text, 'data_assinatura', 'data_assinatura', 'date', false);

  if (category.slug === 'juridico') {
    return {
      ...base,
      fields: [
        field(text, 'parte_reveladora', 'parte_reveladora', 'string', false),
        field(text, 'parte_receptora', 'parte_receptora', 'string', true),
        signatureDate,
      ],
      namingTemplate: text.naming.nda,
    };
  }

  if (category.slug === 'contratos') {
    return {
      ...base,
      fields: [field(text, 'fornecedor', 'fornecedor_contrato', 'string', true), signatureDate],
      namingTemplate: text.naming.contract,
    };
  }

  if (category.slug === 'financeiro') {
    return {
      ...base,
      fields: [
        field(text, 'fornecedor', 'fornecedor_fiscal', 'string', false),
        field(text, 'numero_nota', 'numero_nota', 'string', false),
        field(text, 'data_emissao', 'data_emissao', 'date', false),
      ],
      namingTemplate: text.naming.fiscal,
    };
  }

  return {
    ...base,
    fields: [
      field(text, 'titulo', 'titulo', 'string', false),
      field(text, 'referencia', 'referencia', 'string', false),
      signatureDate,
    ],
    namingTemplate: text.naming.generic,
  };
}

export type SeedGovernance = {
  categories: MongoDocumentCategory[];
  groups: MongoDocumentGroup[];
  accessRules: MongoDocumentAccessRule[];
  extractionRules: MongoDocumentExtractionRule[];
};

export function buildSeedGovernance(locale: GovernanceSeedLocale = 'pt-BR'): SeedGovernance {
  const text = GOVERNANCE_TEXT[locale];
  const categories = buildCategories(text);
  return {
    categories,
    groups: buildGroups(text),
    accessRules: buildAccessRules(categories),
    extractionRules: categories.map((category) => buildExtractionRule(category, text)),
  };
}

const PT_BR_GOVERNANCE = buildSeedGovernance('pt-BR');

export const SEED_GOVERNANCE_CATEGORIES: MongoDocumentCategory[] = PT_BR_GOVERNANCE.categories;
export const SEED_GOVERNANCE_GROUPS: MongoDocumentGroup[] = PT_BR_GOVERNANCE.groups;
export const SEED_GOVERNANCE_ACCESS_RULES: MongoDocumentAccessRule[] = PT_BR_GOVERNANCE.accessRules;
export const SEED_GOVERNANCE_EXTRACTION_RULES: MongoDocumentExtractionRule[] =
  PT_BR_GOVERNANCE.extractionRules;

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
