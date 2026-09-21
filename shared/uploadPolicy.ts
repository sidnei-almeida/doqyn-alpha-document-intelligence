/**
 * Política de upload/IA do tenant — fonte única do formato entre front e servidor.
 *
 * Antes vivia só no localStorage do navegador (`doqyn.upload.reviewSettings`), o que fazia
 * cada máquina ter a sua regra de nomeação. Agora é configuração de tenant, persistida em
 * `tenants.settings.uploadPolicy`, como já era a retenção de lixeira.
 */

export type UploadNamingPolicy = 'original' | 'ai_suggested' | 'ask_each_file' | 'manual_required';

/**
 * O que fazer quando nenhuma categoria configurada serve para o documento.
 *
 * `off` é o comportamento anterior: sem classe, o documento cai em "Sem categoria" e alguém
 * reclassifica depois. `suggest` faz a IA propor uma categoria nova — nome, descrição e palavras-
 * chave — e a proposta vira um botão na revisão. `auto_create` cria a categoria na confirmação,
 * sem passar por ninguém.
 *
 * O padrão é `suggest` de propósito: taxonomia que cresce sozinha vira dez pastas quase iguais, e
 * o classificador passa a competir com as próprias duplicatas.
 */
export type CategorySuggestionMode = 'off' | 'suggest' | 'auto_create';

/**
 * O que fazer com o documento de que não se extraiu texto nenhum.
 *
 * Folha em branco, digitalização falhada, PDF que só tem imagem e voltou vazio do OCR: a análise
 * não tem o que classificar nem o que resumir, e antes isso passava calado — o arquivo era salvo
 * com o nome original, sem resumo e sem categoria, como se estivesse tudo certo.
 *
 * - `review` (padrão): a revisão abre dizendo que a folha veio vazia, e quem revisa decide entre
 *   salvar assim mesmo e descartar. É o único modo que pergunta.
 * - `auto_save`: salva sem perguntar, em "Sem categoria". Para quem arquiva digitalização em lote
 *   e prefere resolver depois, na Biblioteca.
 * - `auto_reject`: não salva. O item termina recusado na fila, com o motivo à vista; o arquivo
 *   provisório nunca é promovido e expira sozinho.
 */
export type EmptyDocumentMode = 'review' | 'auto_save' | 'auto_reject';

export type TenantUploadPolicy = {
  autoReviewEnabled: boolean;
  autoAcceptDelaySeconds: number;
  pauseOnLowConfidence: boolean;
  pauseOnMissingFields: boolean;
  pauseOnSensitiveDocs: boolean;

  defaultNamingPolicy: UploadNamingPolicy;
  aiRenameEnabled: boolean;

  aiMetadataEnabled: boolean;
  aiClassificationEnabled: boolean;
  categorySuggestionMode: CategorySuggestionMode;
  emptyDocumentMode: EmptyDocumentMode;
  preventSensitiveDataInFileName: boolean;

  applyToBatch: boolean;
  pauseOnConflict: boolean;
  continueWhenSafe: boolean;
};

export const UPLOAD_AUTO_DELAY_SECONDS_MIN = 0;
export const UPLOAD_AUTO_DELAY_SECONDS_MAX = 30;
export const UPLOAD_AUTO_DELAY_SECONDS_DEFAULT = 10;

export const DEFAULT_TENANT_UPLOAD_POLICY: TenantUploadPolicy = {
  autoReviewEnabled: false,
  autoAcceptDelaySeconds: UPLOAD_AUTO_DELAY_SECONDS_DEFAULT,
  pauseOnLowConfidence: true,
  pauseOnMissingFields: true,
  pauseOnSensitiveDocs: false,

  defaultNamingPolicy: 'ai_suggested',
  aiRenameEnabled: true,

  aiMetadataEnabled: true,
  aiClassificationEnabled: true,
  categorySuggestionMode: 'suggest',
  // Perguntar é o padrão: salvar folha em branco sem avisar foi exatamente o que se quis corrigir.
  emptyDocumentMode: 'review',
  preventSensitiveDataInFileName: true,

  applyToBatch: false,
  pauseOnConflict: true,
  continueWhenSafe: true,
};

const NAMING_POLICIES: readonly UploadNamingPolicy[] = [
  'original',
  'ai_suggested',
  'ask_each_file',
  'manual_required',
];

export const CATEGORY_SUGGESTION_MODES: readonly CategorySuggestionMode[] = [
  'off',
  'suggest',
  'auto_create',
];

export const EMPTY_DOCUMENT_MODES: readonly EmptyDocumentMode[] = [
  'review',
  'auto_save',
  'auto_reject',
];

export function isUploadNamingPolicy(value: unknown): value is UploadNamingPolicy {
  return typeof value === 'string' && (NAMING_POLICIES as readonly string[]).includes(value);
}

export function isCategorySuggestionMode(value: unknown): value is CategorySuggestionMode {
  return (
    typeof value === 'string' && (CATEGORY_SUGGESTION_MODES as readonly string[]).includes(value)
  );
}

export function isEmptyDocumentMode(value: unknown): value is EmptyDocumentMode {
  return typeof value === 'string' && (EMPTY_DOCUMENT_MODES as readonly string[]).includes(value);
}

export function clampUploadAutoDelaySeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return UPLOAD_AUTO_DELAY_SECONDS_DEFAULT;
  }
  return Math.min(
    UPLOAD_AUTO_DELAY_SECONDS_MAX,
    Math.max(UPLOAD_AUTO_DELAY_SECONDS_MIN, Math.round(value)),
  );
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Aceita entrada parcial/desconhecida (body de request, documento antigo) e devolve política válida. */
export function normalizeTenantUploadPolicy(
  input?: Partial<TenantUploadPolicy> | null,
): TenantUploadPolicy {
  const base = DEFAULT_TENANT_UPLOAD_POLICY;
  const raw = (input ?? {}) as Partial<TenantUploadPolicy>;

  return {
    autoReviewEnabled: pickBoolean(raw.autoReviewEnabled, base.autoReviewEnabled),
    autoAcceptDelaySeconds: clampUploadAutoDelaySeconds(
      typeof raw.autoAcceptDelaySeconds === 'number'
        ? raw.autoAcceptDelaySeconds
        : base.autoAcceptDelaySeconds,
    ),
    pauseOnLowConfidence: pickBoolean(raw.pauseOnLowConfidence, base.pauseOnLowConfidence),
    pauseOnMissingFields: pickBoolean(raw.pauseOnMissingFields, base.pauseOnMissingFields),
    pauseOnSensitiveDocs: pickBoolean(raw.pauseOnSensitiveDocs, base.pauseOnSensitiveDocs),

    defaultNamingPolicy: isUploadNamingPolicy(raw.defaultNamingPolicy)
      ? raw.defaultNamingPolicy
      : base.defaultNamingPolicy,
    aiRenameEnabled: pickBoolean(raw.aiRenameEnabled, base.aiRenameEnabled),

    aiMetadataEnabled: pickBoolean(raw.aiMetadataEnabled, base.aiMetadataEnabled),
    aiClassificationEnabled: pickBoolean(raw.aiClassificationEnabled, base.aiClassificationEnabled),
    categorySuggestionMode: isCategorySuggestionMode(raw.categorySuggestionMode)
      ? raw.categorySuggestionMode
      : base.categorySuggestionMode,
    emptyDocumentMode: isEmptyDocumentMode(raw.emptyDocumentMode)
      ? raw.emptyDocumentMode
      : base.emptyDocumentMode,
    preventSensitiveDataInFileName: pickBoolean(
      raw.preventSensitiveDataInFileName,
      base.preventSensitiveDataInFileName,
    ),

    applyToBatch: pickBoolean(raw.applyToBatch, base.applyToBatch),
    pauseOnConflict: pickBoolean(raw.pauseOnConflict, base.pauseOnConflict),
    continueWhenSafe: pickBoolean(raw.continueWhenSafe, base.continueWhenSafe),
  };
}
