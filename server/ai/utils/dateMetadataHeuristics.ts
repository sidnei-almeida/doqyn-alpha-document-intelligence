import type { ExtractedMetadataField, RetrievedChunk } from '../types/documentAi.types.js';
import { parseMetadataDate } from '../../services/confirm/projectSearchMeta.js';

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const ANCHOR_CONTEXT =
  /(?:assinad[oa]s?|firmad[oa]s?|celebrad[oa]s?|datad[oa]|feito|lavrad[oa])\s+em\s+/i;

function fieldHasValue(
  field: Pick<ExtractedMetadataField, 'value' | 'normalizedValue'> | undefined,
): boolean {
  if (!field) return false;
  const raw = field.normalizedValue ?? field.value;
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 0;
  return true;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parsePortugueseLongDate(text: string): Date | null {
  const match = text.match(
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
  );
  if (!match) return null;
  const day = Number(match[1]);
  const monthName = match[2]!.toLowerCase().normalize('NFC');
  const month =
    MONTHS[monthName] ??
    MONTHS[monthName.normalize('NFD').replace(/\p{M}/gu, '')] ??
    null;
  const year = Number(match[3]);
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function firstDateInText(text: string): { date: Date; snippet: string } | null {
  const long = parsePortugueseLongDate(text);
  if (long) {
    const snip = text.match(
      /.{0,40}\d{1,2}\s+de\s+\w+\s+de\s+\d{4}.{0,20}/i,
    );
    return { date: long, snippet: (snip?.[0] ?? text).slice(0, 160).trim() };
  }

  const iso = text.match(/\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const parsed = parseMetadataDate(iso[0]!);
    if (parsed) return { date: parsed, snippet: iso[0]! };
  }

  const br = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2}|19\d{2})\b/);
  if (br) {
    const parsed = parseMetadataDate(br[0]!);
    if (parsed) return { date: parsed, snippet: br[0]! };
  }

  return null;
}

/** Data embutida no nome do arquivo (ex.: NDA_Foo_2026-06-09.pdf). */
export function inferSignatureDateFromFileName(
  fileName: string | null | undefined,
): { date: Date; snippet: string } | null {
  if (!fileName) return null;
  // Evita fallback em fixtures nomeadas como "sem_data".
  if (/sem[_-]?data/i.test(fileName)) return null;

  const iso = fileName.match(/(?:^|[_\-.])((?:20|19)\d{2})-(\d{2})-(\d{2})(?:[_\-.]|$)/);
  if (iso) {
    const parsed = parseMetadataDate(`${iso[1]}-${iso[2]}-${iso[3]}`);
    if (parsed) return { date: parsed, snippet: `filename:${iso[0]}` };
  }

  const compact = fileName.match(/(?:^|[_\-.])((?:20|19)\d{2})(\d{2})(\d{2})(?:[_\-.]|$)/);
  if (compact) {
    const parsed = parseMetadataDate(`${compact[1]}-${compact[2]}-${compact[3]}`);
    if (parsed) return { date: parsed, snippet: `filename:${compact[0]}` };
  }

  return null;
}

function inferSignatureDateFromChunks(
  chunks: Array<Pick<RetrievedChunk, 'text'>>,
): { date: Date; snippet: string } | null {
  const blob = chunks.map((c) => c.text).join('\n');
  if (!blob.trim()) return null;

  // Preferir datas perto de "assinado em" / "celebrado em".
  const windowMatches = blob.matchAll(
    new RegExp(`${ANCHOR_CONTEXT.source}([^\\n.]{0,80})`, 'gi'),
  );
  for (const match of windowMatches) {
    const vicinity = `${match[0] ?? ''} ${match[1] ?? ''}`;
    const hit = firstDateInText(vicinity);
    if (hit) return hit;
  }

  // Datas em cláusula de vigência com âncora ("a partir de", "contado de").
  const vigencia = blob.match(
    /(?:a\s+partir\s+de|contado\s+d[eoa]|in[ií]cio\s+em)\s+[^\n.]{0,80}/gi,
  );
  if (vigencia) {
    for (const line of vigencia) {
      const hit = firstDateInText(line);
      if (hit) return hit;
    }
  }

  return null;
}

function toField(date: Date, snippet: string, confidence: number): ExtractedMetadataField {
  const iso = toIsoDay(date);
  return {
    label: 'Data de assinatura',
    value: iso,
    normalizedValue: iso,
    confidence,
    source: 'document_text',
    evidence: { snippet: snippet.slice(0, 160) },
  };
}

/**
 * Preenche `data_assinatura` ausente a partir do texto/OCR ou do filename.
 * Não sobrescreve valor já preenchido pela IA.
 */
export function enrichMetadataWithDateHeuristics(input: {
  metadata: Record<string, ExtractedMetadataField>;
  chunks?: Array<Pick<RetrievedChunk, 'text'>>;
  originalFileName?: string | null;
}): Record<string, ExtractedMetadataField> {
  const out = { ...input.metadata };
  if (fieldHasValue(out.data_assinatura)) return out;

  const fromChunks = inferSignatureDateFromChunks(input.chunks ?? []);
  if (fromChunks) {
    out.data_assinatura = toField(fromChunks.date, fromChunks.snippet, 0.72);
    return out;
  }

  const fromName = inferSignatureDateFromFileName(input.originalFileName);
  if (fromName) {
    out.data_assinatura = toField(fromName.date, fromName.snippet, 0.6);
  }

  return out;
}
