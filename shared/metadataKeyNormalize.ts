/**
 * Normalização de chaves/labels de metadados de documento.
 * Evita duplicar o mesmo campo por variação de capitalização ou label vs snake_case.
 */

/** Labels canônicos (capitalização estável) para chaves conhecidas. */
export const CANONICAL_METADATA_LABELS: Record<string, string> = {
  parte_reveladora: 'Parte reveladora',
  parte_receptora: 'Parte receptora',
  data_assinatura: 'Data de assinatura',
  data_documento: 'Data do documento',
  data_validade: 'Validade',
  data_emissao: 'Data de emissão',
  vigencia_inicio: 'Início da vigência',
  vigencia_fim: 'Fim da vigência',
  documento_type: 'Tipo',
  document_type: 'Tipo',
  documenttype: 'Tipo',
  tipo: 'Tipo',
  parties: 'Partes',
  cnpj: 'CNPJ',
  cpf: 'CPF',
  cpf_cnpj: 'CPF/CNPJ',
  resumo: 'Resumo',
  summary: 'Resumo',
  clausulas: 'Cláusulas',
  sensitivity: 'Sensibilidade',
  sensibilidade: 'Sensibilidade',
  category: 'Categoria',
  classname: 'Categoria',
  recommendedfilename: 'Nome sugerido (IA)',
  aisuggestedfilename: 'Nome sugerido (IA)',
};

/** Aliases textuais (já slugificados) → chave canônica. */
const ALIAS_TO_CANONICAL_KEY: Record<string, string> = {
  parte_reveladora: 'parte_reveladora',
  parte_revelador: 'parte_reveladora',
  reveladora: 'parte_reveladora',
  divulgador: 'parte_reveladora',
  contratante: 'parte_reveladora',
  parte_receptora: 'parte_receptora',
  parte_receptor: 'parte_receptora',
  receptora: 'parte_receptora',
  receptor: 'parte_receptora',
  recebedor: 'parte_receptora',
  contratada: 'parte_receptora',
  contratado: 'parte_receptora',
  data_assinatura: 'data_assinatura',
  data_de_assinatura: 'data_assinatura',
  assinado_em: 'data_assinatura',
  firmado_em: 'data_assinatura',
  celebrado_em: 'data_assinatura',
  data_documento: 'data_documento',
  data_do_documento: 'data_documento',
  data_validade: 'data_validade',
  validade: 'data_validade',
  data_vencimento: 'data_validade',
  vencimento: 'data_validade',
  data_emissao: 'data_emissao',
  data_de_emissao: 'data_emissao',
  resumo: 'resumo',
  summary: 'resumo',
  tipo: 'tipo',
  documenttype: 'tipo',
  document_type: 'tipo',
};

/** Slug estável: "Parte Reveladora" / "parte reveladora" / "parte_reveladora" → mesma forma. */
export function slugifyMetadataToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveCanonicalFromSlug(slug: string): string | null {
  if (!slug) return null;
  if (ALIAS_TO_CANONICAL_KEY[slug]) return ALIAS_TO_CANONICAL_KEY[slug];
  if (CANONICAL_METADATA_LABELS[slug]) return slug;
  return null;
}

/** Converte chave e/ou label para a chave canônica (snake_case estável). */
export function canonicalizeMetadataKey(key: string, label?: string | null): string {
  const fromKey = slugifyMetadataToken(key);
  const fromLabel = label ? slugifyMetadataToken(label) : '';

  for (const candidate of [fromKey, fromLabel]) {
    const resolved = resolveCanonicalFromSlug(candidate);
    if (resolved) return resolved;
  }

  return fromKey || fromLabel || key.trim();
}

function humanizeCanonicalKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (char) => char.toUpperCase());
}

/** Label estável para UI: preferir mapa canônico; senão label limpo; senão humanize. */
export function resolveMetadataLabel(key: string, label?: string | null): string {
  const canonical = canonicalizeMetadataKey(key, label);
  if (CANONICAL_METADATA_LABELS[canonical]) {
    return CANONICAL_METADATA_LABELS[canonical];
  }
  const trimmed = label?.trim();
  if (trimmed) {
    // Evita Title Case artificial; mantém a primeira letra maiúscula se vier tudo minúsculo.
    if (trimmed === trimmed.toLowerCase()) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    return trimmed;
  }
  return humanizeCanonicalKey(canonical);
}

export type MetadataMergeCandidate = {
  label?: string | null;
  value?: unknown;
  normalizedValue?: unknown;
  confidence?: number | null;
};

function hasPresentValue(field: MetadataMergeCandidate | undefined): boolean {
  if (!field) return false;
  const raw = field.normalizedValue ?? field.value;
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 0;
  return true;
}

/**
 * Reescreve um record de metadados com chaves/labels canônicos,
 * fundindo duplicatas (ex.: "Parte Reveladora" + parte_reveladora).
 */
export function dedupeMetadataRecord<T extends MetadataMergeCandidate>(
  metadata: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = {};

  for (const [key, field] of Object.entries(metadata)) {
    const canonicalKey = canonicalizeMetadataKey(key, field?.label);
    const nextLabel = resolveMetadataLabel(canonicalKey, field?.label);
    const next = { ...field, label: nextLabel } as T;
    const existing = out[canonicalKey];

    if (!existing) {
      out[canonicalKey] = next;
      continue;
    }

    const existingConfidence =
      typeof existing.confidence === 'number' && Number.isFinite(existing.confidence)
        ? existing.confidence
        : -1;
    const nextConfidence =
      typeof next.confidence === 'number' && Number.isFinite(next.confidence)
        ? next.confidence
        : -1;

    const preferNext =
      (hasPresentValue(next) && !hasPresentValue(existing)) ||
      (hasPresentValue(next) === hasPresentValue(existing) && nextConfidence > existingConfidence);

    out[canonicalKey] = preferNext ? next : { ...existing, label: nextLabel };
  }

  return out;
}
