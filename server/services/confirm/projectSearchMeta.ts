import type {
  MongoDocumentDateMeta,
  MongoDocumentPersonMeta,
  MongoDocumentSearchMeta,
  MongoRuleField,
  MongoVersionMetadataField,
} from '../../db/types.js';
import { isValidPartyName } from '../../ai/utils/partyNameValidation.js';

/** Roles canônicos a partir de keys conhecidas do seed / extras comuns. */
const PERSON_KEY_ROLES: Record<string, string> = {
  parte_reveladora: 'parte_reveladora',
  parte_receptora: 'parte_receptora',
  fornecedor: 'fornecedor',
  beneficiario: 'beneficiario',
  pagador: 'pagador',
  cliente: 'cliente',
  titular: 'titular',
  nascido: 'titular',
  registrado: 'titular',
  nome: 'titular',
  nome_completo: 'titular',
  mae: 'mae',
  nome_mae: 'mae',
  filiacao_mae: 'mae',
  pai: 'pai',
  nome_pai: 'pai',
  filiacao_pai: 'pai',
  responsavel: 'responsavel',
  nome_responsavel: 'responsavel',
  responsavel_legal: 'responsavel',
  tutora: 'responsavel',
  tutor: 'responsavel',
  representante: 'representante',
  emitente: 'emitente',
  contratante: 'contratante',
  contratada: 'contratada',
};

const DATE_KEY_KINDS: Record<string, string> = {
  data_assinatura: 'assinatura',
  data_emissao: 'emissao',
  data_pedido: 'pedido',
  data_proposta: 'proposta',
  data_vencimento: 'vencimento',
  data_validade: 'validade',
  data_vigencia: 'vigencia_inicio',
  vigencia_inicio: 'vigencia_inicio',
  vigencia_fim: 'vigencia_fim',
  validade: 'validade',
};

export const VALIDITY_SOURCE_KEYS = new Set([
  'data_vencimento',
  'data_validade',
  'vigencia_fim',
  'validade',
]);

/** Campos de prazo relativo (“5 anos”, “24 meses”) — não são data absoluta. */
const DURATION_SOURCE_KEYS = new Set([
  'prazo_vigencia',
  'prazo',
  'vigencia_prazo',
  'periodo_vigencia',
  'duracao',
  'duracao_vigencia',
]);

const ANCHOR_DATE_PRIORITY = [
  'data_assinatura',
  'data_emissao',
  'vigencia_inicio',
  'data_vigencia',
  'data_documento',
] as const;

const TITLE_KEYS = new Set(['titulo', 'title', 'nome_documento', 'document_title']);

const PERSON_KEY_HINT =
  /(nome|parte|pessoa|mae|pai|responsavel|beneficiario|pagador|cliente|fornecedor|titular|nascido|representante|contratante|contratad[ao]|emitente)/i;

const DATE_KEY_HINT = /(data_|_data$|venciment|validade|vigencia|assinatura|emissao|nascimento)/i;

const EXCLUDE_FROM_PERSON =
  /(cnpj|cpf|\brg\b|valor|numero|n[uú]mero|telefone|email|endereco|\bcep\b|codigo|moeda|multa|prazo_vigencia|inscricao)/i;

export type ValidityDuration = {
  years: number;
  months: number;
  days: number;
};

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fieldRawValue(field: MongoVersionMetadataField): string | number | null {
  const raw = field.normalizedValue ?? field.value;
  if (raw === null || raw === undefined || raw === '') return null;
  return raw;
}

function fieldString(field: MongoVersionMetadataField): string | null {
  const raw = fieldRawValue(field);
  if (raw === null) return null;
  const text = String(raw).trim();
  return text || null;
}

/** Aceita ISO, yyyy-mm-dd e dd/mm/yyyy (comum em docs BR). */
export function parseMetadataDate(raw: string | number): Date | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const text = String(raw).trim();
  if (!text) return null;

  const br = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d;
    }
    return null;
  }

  const isoDay = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    const year = Number(isoDay[1]);
    const month = Number(isoDay[2]);
    const day = Number(isoDay[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d;
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Interpreta prazos relativos comuns em contratos BR.
 * Ex.: "5 anos", "válido por 24 meses", "pelo prazo de 90 dias".
 */
export function parseValidityDuration(raw: string | number | null | undefined): ValidityDuration | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const text = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  // Se parece data absoluta, não tratar como duração.
  if (parseMetadataDate(text)) return null;

  let years = 0;
  let months = 0;
  let days = 0;

  const yearMatch = text.match(/(\d{1,3})\s*(anos?|ano)\b/);
  if (yearMatch) years = Number(yearMatch[1]);

  const monthMatch = text.match(/(\d{1,4})\s*(meses?|mes)\b/);
  if (monthMatch) months = Number(monthMatch[1]);

  const dayMatch = text.match(/(\d{1,5})\s*(dias?|dia)\b/);
  if (dayMatch) days = Number(dayMatch[1]);

  // Fallback: "prazo de 5" / "valido por 5" sem unidade → anos (comum em NDA).
  if (years === 0 && months === 0 && days === 0) {
    const bare = text.match(
      /(?:prazo|valido por|vigencia(?:\s+de)?)\s*(?:de\s*)?(\d{1,3})\b/,
    );
    if (bare) years = Number(bare[1]);
  }

  if (!Number.isFinite(years) || !Number.isFinite(months) || !Number.isFinite(days)) {
    return null;
  }
  if (years <= 0 && months <= 0 && days <= 0) return null;
  if (years > 100 || months > 600 || days > 3650) return null;

  return { years, months, days };
}

/** Soma duração em UTC (evita deslocamento de fuso em dd/mm). */
export function addValidityDuration(anchor: Date, duration: ValidityDuration): Date {
  const result = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
  );
  if (duration.years) result.setUTCFullYear(result.getUTCFullYear() + duration.years);
  if (duration.months) result.setUTCMonth(result.getUTCMonth() + duration.months);
  if (duration.days) result.setUTCDate(result.getUTCDate() + duration.days);
  return result;
}

function isDurationField(key: string, label: string): boolean {
  const keyNorm = key.toLowerCase();
  if (DURATION_SOURCE_KEYS.has(keyNorm)) return true;
  const blob = `${keyNorm} ${normalizeSearchText(label)}`;
  return /\bprazo\b/.test(blob) && /vigenc|validad/.test(blob);
}

function resolvePersonRole(key: string, label: string): string | null {
  const keyNorm = key.toLowerCase();
  if (PERSON_KEY_ROLES[keyNorm]) return PERSON_KEY_ROLES[keyNorm];

  const blob = `${keyNorm} ${normalizeSearchText(label)}`;
  if (/\bmae\b|mãe/.test(blob) || blob.includes('filiacao_mae') || blob.includes('nome_mae')) {
    return 'mae';
  }
  if (/\bpai\b/.test(blob) || blob.includes('filiacao_pai') || blob.includes('nome_pai')) {
    return 'pai';
  }
  if (/responsavel|tutor/.test(blob)) return 'responsavel';
  if (/revelador/.test(blob)) return 'parte_reveladora';
  if (/receptor/.test(blob)) return 'parte_receptora';
  if (/fornecedor|prestador/.test(blob)) return 'fornecedor';
  if (/beneficiar/.test(blob)) return 'beneficiario';
  if (/pagador/.test(blob)) return 'pagador';
  if (/cliente/.test(blob)) return 'cliente';
  if (/titular|nascido|registrado/.test(blob)) return 'titular';
  if (/contratante/.test(blob)) return 'contratante';
  if (/contratad/.test(blob)) return 'contratada';

  if (PERSON_KEY_HINT.test(keyNorm) || PERSON_KEY_HINT.test(label)) {
    return keyNorm.replace(/[^a-z0-9_]+/g, '_') || 'pessoa';
  }

  return null;
}

function resolveDateKind(key: string, label: string): string | null {
  const keyNorm = key.toLowerCase();
  if (DATE_KEY_KINDS[keyNorm]) return DATE_KEY_KINDS[keyNorm];

  const blob = `${keyNorm} ${normalizeSearchText(label)}`;
  if (/venciment/.test(blob)) return 'vencimento';
  if (/validade/.test(blob)) return 'validade';
  if (/assinatur/.test(blob)) return 'assinatura';
  if (/emiss/.test(blob)) return 'emissao';
  if (/nascimento/.test(blob)) return 'nascimento';
  if (/vigencia.*fim|fim.*vigencia/.test(blob)) return 'vigencia_fim';
  if (/vigencia/.test(blob)) return 'vigencia_inicio';
  if (/proposta/.test(blob)) return 'proposta';
  if (/pedido/.test(blob)) return 'pedido';
  if (DATE_KEY_HINT.test(keyNorm) || DATE_KEY_HINT.test(label)) return 'outra';

  return null;
}

function looksLikeIdentifierNotPerson(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 11 && digits.length / Math.max(value.replace(/\s/g, '').length, 1) > 0.7) {
    return true;
  }
  return false;
}

function pickRelatedAnchor(people: MongoDocumentPersonMeta[]): string | undefined {
  const preferred = ['titular', 'parte_reveladora', 'cliente', 'pagador', 'beneficiario'];
  for (const role of preferred) {
    const hit = people.find((p) => p.role === role);
    if (hit) return hit.name;
  }
  return people[0]?.name;
}

/**
 * Projeta nomes, datas e validade a partir do metadata rico da versão.
 * Não remove nem altera o blob original — só isola sinais para busca.
 *
 * Validade:
 * 1) data absoluta (vencimento/validade/vigência fim), se existir;
 * 2) senão, âncora (assinatura/emissão) + prazo relativo (“5 anos”).
 */
export function projectDocumentSearchMeta(
  metadata: Record<string, MongoVersionMetadataField>,
  ruleFields?: MongoRuleField[],
): MongoDocumentSearchMeta {
  const ruleTypeByKey = new Map((ruleFields ?? []).map((f) => [f.key, f.type]));
  const people: MongoDocumentPersonMeta[] = [];
  const dates: MongoDocumentDateMeta[] = [];
  let documentTitle: string | null = null;
  let validityDate: Date | null = null;
  const durationCandidates: Array<{ key: string; label: string; duration: ValidityDuration }> = [];
  const anchorByKey = new Map<string, Date>();

  for (const [key, field] of Object.entries(metadata)) {
    const keyNorm = key.toLowerCase();
    const label = field.label?.trim() || key;
    const ruleType = ruleTypeByKey.get(key);

    if (TITLE_KEYS.has(keyNorm)) {
      const title = fieldString(field);
      if (title) documentTitle = title;
    }

    if (isDurationField(key, label)) {
      const duration = parseValidityDuration(fieldRawValue(field));
      if (duration) {
        durationCandidates.push({ key, label, duration });
      }
      continue;
    }

    const dateKind =
      ruleType === 'date' || DATE_KEY_HINT.test(keyNorm) || DATE_KEY_HINT.test(label)
        ? resolveDateKind(key, label) ?? (ruleType === 'date' ? 'outra' : null)
        : resolveDateKind(key, label);

    if (dateKind) {
      const raw = fieldRawValue(field);
      if (raw !== null) {
        const parsed = parseMetadataDate(raw);
        if (parsed) {
          dates.push({
            kind: dateKind,
            date: parsed,
            sourceKey: key,
            label,
          });
          if (ANCHOR_DATE_PRIORITY.includes(keyNorm as (typeof ANCHOR_DATE_PRIORITY)[number])) {
            anchorByKey.set(keyNorm, parsed);
          }
          if (dateKind === 'assinatura' || dateKind === 'emissao' || dateKind === 'vigencia_inicio') {
            anchorByKey.set(keyNorm, parsed);
          }
          if (VALIDITY_SOURCE_KEYS.has(keyNorm) || dateKind === 'vencimento' || dateKind === 'validade') {
            if (!validityDate || dateKind === 'vencimento' || dateKind === 'vigencia_fim') {
              validityDate = parsed;
            }
          }
          if (dateKind === 'vigencia_fim' && !validityDate) {
            validityDate = parsed;
          }
        }
      }
      continue;
    }

    if (EXCLUDE_FROM_PERSON.test(keyNorm) || EXCLUDE_FROM_PERSON.test(label)) {
      continue;
    }

    const role = resolvePersonRole(key, label);
    if (!role) continue;

    const name = fieldString(field);
    if (!name || looksLikeIdentifierNotPerson(name)) continue;
    if (name.length < 3 || name.length > 120) continue;

    const isKnownPersonKey = Boolean(PERSON_KEY_ROLES[keyNorm]);
    if (!isKnownPersonKey && !isValidPartyName(name)) continue;

    people.push({
      name,
      nameNormalized: normalizeSearchText(name),
      role,
      sourceKey: key,
    });
  }

  if (!validityDate && durationCandidates.length > 0) {
    let anchor: Date | null = null;
    let anchorKey: string | null = null;
    for (const key of ANCHOR_DATE_PRIORITY) {
      const hit = anchorByKey.get(key) ?? dates.find((d) => d.sourceKey === key)?.date;
      if (hit) {
        anchor = hit;
        anchorKey = key;
        break;
      }
    }
    if (!anchor) {
      const byKind = dates.find(
        (d) =>
          d.kind === 'assinatura' || d.kind === 'emissao' || d.kind === 'vigencia_inicio',
      );
      if (byKind) {
        anchor = byKind.date;
        anchorKey = byKind.sourceKey;
      }
    }

    if (anchor) {
      const chosen = durationCandidates[0]!;
      const inferred = addValidityDuration(anchor, chosen.duration);
      validityDate = inferred;
      dates.push({
        kind: 'validade',
        date: inferred,
        sourceKey: chosen.key,
        label: `${chosen.label} (inferido de ${anchorKey ?? 'âncora'})`,
      });
    }
  }

  const reveladora = people.find((p) => p.role === 'parte_reveladora');
  const receptora = people.find((p) => p.role === 'parte_receptora');
  if (reveladora && receptora) {
    reveladora.relatedTo = receptora.name;
    receptora.relatedTo = reveladora.name;
  }

  const anchor = pickRelatedAnchor(people);
  if (anchor) {
    for (const person of people) {
      if (person.relatedTo) continue;
      if (person.role === 'mae' || person.role === 'pai' || person.role === 'responsavel') {
        person.relatedTo = anchor;
      }
    }
  }

  // Dedup por nome+role
  const seen = new Set<string>();
  const uniquePeople = people.filter((p) => {
    const id = `${p.role}::${p.nameNormalized}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return {
    people: uniquePeople,
    dates,
    documentTitle,
    validityDate,
  };
}
