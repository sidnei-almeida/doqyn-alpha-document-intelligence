/**
 * Normalização de chaves/labels de metadados de documento.
 * Evita duplicar o mesmo campo por variação de capitalização ou label vs snake_case.
 */

/** Labels canônicos (capitalização estável) para chaves conhecidas. */
export const CANONICAL_METADATA_LABELS: Record<string, string> = {
  partes_envolvidas: 'Partes envolvidas',
  data_referencia: 'Data de referência',
  parte_reveladora: 'Parte reveladora',
  parte_receptora: 'Parte receptora',
  data_assinatura: 'Data de assinatura',
  data_documento: 'Data do documento',
  data_validade: 'Validade',
  data_emissao: 'Data de emissão',
  vigencia_inicio: 'Início da vigência',
  vigencia_fim: 'Fim da vigência',
  prazo_vigencia: 'Prazo de vigência',
  prazo: 'Prazo de vigência',
  documento_type: 'Tipo',
  document_type: 'Tipo',
  documenttype: 'Tipo',
  tipo: 'Tipo',
  titulo: 'Título',
  title: 'Título',
  parties: 'Partes',
  cnpj: 'CNPJ',
  cpf: 'CPF',
  cpf_cnpj: 'CPF/CNPJ',
  cpf_cnpj_receptora: 'CPF/CNPJ da parte receptora',
  resumo: 'Resumo',
  summary: 'Resumo',
  clausulas: 'Cláusulas',
  sensitivity: 'Sensibilidade',
  sensibilidade: 'Sensibilidade',
  category: 'Categoria',
  classname: 'Categoria',
  recommendedfilename: 'Nome sugerido (IA)',
  aisuggestedfilename: 'Nome sugerido (IA)',
  fornecedor: 'Fornecedor',
  beneficiario: 'Beneficiário',
  pagador: 'Pagador',
  cliente: 'Cliente',
  titular: 'Titular',
};

/**
 * Os rótulos canônicos em inglês e espanhol, pelo rótulo em português.
 *
 * A chave continua em português — é identificador gravado no banco, e traduzi-la invalidaria todo
 * metadado já salvo. Só o que a pessoa lê muda. Rótulo sem entrada aqui fica em português.
 */
const CANONICAL_LABEL_TRANSLATIONS: Record<string, readonly [en: string, es: string]> = {
  'Partes envolvidas': ['Parties involved', 'Partes involucradas'],
  'Data de referência': ['Reference date', 'Fecha de referencia'],
  'Parte reveladora': ['Disclosing party', 'Parte reveladora'],
  'Parte receptora': ['Receiving party', 'Parte receptora'],
  'Data de assinatura': ['Signature date', 'Fecha de firma'],
  'Data do documento': ['Document date', 'Fecha del documento'],
  Validade: ['Expiry date', 'Fecha de vencimiento'],
  'Data de emissão': ['Issue date', 'Fecha de emisión'],
  'Início da vigência': ['Term start', 'Inicio de vigencia'],
  'Fim da vigência': ['Term end', 'Fin de vigencia'],
  'Prazo de vigência': ['Term', 'Plazo de vigencia'],
  Tipo: ['Type', 'Tipo'],
  Título: ['Title', 'Título'],
  Partes: ['Parties', 'Partes'],
  'CPF/CNPJ da parte receptora': ['Receiving party CPF/CNPJ', 'CPF/CNPJ de la parte receptora'],
  Resumo: ['Summary', 'Resumen'],
  Cláusulas: ['Clauses', 'Cláusulas'],
  Sensibilidade: ['Sensitivity', 'Sensibilidad'],
  Categoria: ['Category', 'Categoría'],
  'Nome sugerido (IA)': ['Suggested name (AI)', 'Nombre sugerido (IA)'],
  Fornecedor: ['Supplier', 'Proveedor'],
  Beneficiário: ['Beneficiary', 'Beneficiario'],
  Pagador: ['Payer', 'Pagador'],
  Cliente: ['Customer', 'Cliente'],
  Titular: ['Holder', 'Titular'],
};

function localizeCanonicalLabel(label: string, locale?: string | null): string {
  const primary = locale?.split('-')[0]?.toLowerCase();
  const translated = CANONICAL_LABEL_TRANSLATIONS[label];
  if (!translated) return label;
  if (primary === 'en') return translated[0];
  if (primary === 'es') return translated[1];
  return label;
}

/**
 * Ordem da ficha no painel Detalhes (viewer).
 * Validade absoluta/inferida é tratada à parte (não listar data_validade aqui se o builder unificar).
 */
export const STANDARD_DETAILS_KEYS: readonly string[] = [
  'titulo',
  /**
   * Os campos da regra padrão entram aqui porque são os que todo tenant recebe ao criar uma
   * categoria pela interface. Sem eles, o painel Detalhes de um documento comum mostrava só a
   * validade, e "partes envolvidas" — o campo que diz de quem é o documento — só existia dentro do
   * editor de metadados, que é tela de edição e não de leitura.
   */
  'partes_envolvidas',
  'data_referencia',
  'parte_reveladora',
  'parte_receptora',
  'fornecedor',
  'beneficiario',
  'pagador',
  'cliente',
  'titular',
  'cpf_cnpj_receptora',
  'cpf_cnpj',
  'cnpj',
  'cpf',
  'data_assinatura',
  'data_documento',
  'data_emissao',
  'vigencia_inicio',
  'prazo_vigencia',
  'resumo',
  'tipo',
];

/**
 * O nome da data de validade — um só, em todo o produto.
 *
 * Existe como constante porque já foi três literais soltos em três camadas, e uma delas escolheu
 * `data_vencimento`: a regra padrão gravava esse nome, `canonicalizeMetadataKey` o renomeava para
 * `data_validade` ao confirmar a versão, e a ficha passava a mostrar a linha da regra vazia com o
 * mesmo dado logo abaixo, como campo fora da regra. Chave nova de validade se escreve daqui.
 *
 * `VALIDITY_ABSOLUTE_KEYS` continua aceitando os outros nomes porque LER é outra história: o tenant
 * pode ter nomeado o campo dele de qualquer jeito, e dado que já está no banco não se renomeia.
 */
export const CANONICAL_VALIDITY_KEY = 'data_validade';

/** Chaves de validade absoluta — o builder une num único campo "Validade". */
export const VALIDITY_ABSOLUTE_KEYS = new Set([
  CANONICAL_VALIDITY_KEY,
  'vigencia_fim',
  'data_vencimento',
]);

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
  prazo_vigencia: 'prazo_vigencia',
  prazo: 'prazo_vigencia',
  vigencia_prazo: 'prazo_vigencia',
  titulo: 'titulo',
  title: 'titulo',
  nome_documento: 'titulo',
  document_title: 'titulo',
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

/**
 * Label estável para UI: preferir mapa canônico; senão label limpo; senão humanize.
 *
 * `locale` só vale para rótulo canônico: o rótulo que o tenant escreveu é dado dele e fica como
 * está. O servidor chama sem `locale` e grava o rótulo em português, como sempre.
 */
export function resolveMetadataLabel(
  key: string,
  label?: string | null,
  locale?: string | null,
): string {
  const canonical = canonicalizeMetadataKey(key, label);
  if (CANONICAL_METADATA_LABELS[canonical]) {
    return localizeCanonicalLabel(CANONICAL_METADATA_LABELS[canonical], locale);
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
