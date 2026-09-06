/**
 * O Avaliador.
 *
 * Roda depois da extração e decide, campo a campo, se o resultado se sustenta. A decisão que
 * justifica a existência dele é uma só: separar o campo vazio porque o documento não traz o dado
 * do campo vazio porque a leitura falhou. A primeira encerra o assunto; a segunda vale mais uma
 * chamada, focada só naquele campo.
 *
 * Ele não extrai. Devolve veredito e dica; quem re-lê é o extrator focado, no passe seguinte.
 * Separar as duas coisas é o que permite medir cada uma — e é o que torna possível rodar o juiz
 * num modelo menor que o extrator, se a bancada aprovar.
 */
import type {
  DocumentClassRule,
  DocumentNamingRoles,
  ExtractedMetadataField,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { buildEvaluatorFieldBriefs, buildEvaluatorPrompt } from '../utils/evaluatorPrompt.js';
import { triageExtraction, type ExtractionTriage } from '../utils/extractionTriage.js';
import {
  completeJsonPromptWithUsage,
  EMPTY_TOKEN_USAGE,
  type GroqPromptContext,
  type TokenUsage,
} from './groqClient.js';
import { isGroqSaturationError } from '../utils/groqSaturation.js';
import { logger } from '../../utils/logger.js';

export type FieldVerdictKind = 'ok' | 'ausente_de_fato' | 'buscar_de_novo' | 'valor_errado';

export type FieldVerdict = {
  key: string;
  verdict: FieldVerdictKind;
  reason?: string;
  /** O que procurar, escrito pelo Avaliador. Alimenta o prompt do passe focado. */
  hint?: string;
  /** Termos que devem aparecer perto do dado. Alimentam a re-seleção de trechos. */
  where?: string[];
};

export type EvaluationResult = {
  complete: boolean;
  fields: FieldVerdict[];
  usage: TokenUsage;
  /** true quando a triagem não achou sintoma e o modelo nem chegou a ser chamado. */
  skipped: boolean;
  triage: ExtractionTriage;
};

const VERDICT_KINDS = new Set<FieldVerdictKind>([
  'ok',
  'ausente_de_fato',
  'buscar_de_novo',
  'valor_errado',
]);

export function parseVerdicts(parsed: unknown): FieldVerdict[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const fields = (parsed as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];

  const verdicts: FieldVerdict[] = [];
  for (const entry of fields) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key.trim() : '';
    const verdict = typeof record.verdict === 'string' ? record.verdict.trim() : '';
    if (!key || !VERDICT_KINDS.has(verdict as FieldVerdictKind)) continue;

    const where = Array.isArray(record.where)
      ? record.where.filter(
          (term): term is string => typeof term === 'string' && term.trim().length > 0,
        )
      : undefined;

    verdicts.push({
      key,
      verdict: verdict as FieldVerdictKind,
      reason: typeof record.reason === 'string' ? record.reason.trim() || undefined : undefined,
      hint: typeof record.hint === 'string' ? record.hint.trim() || undefined : undefined,
      where: where?.length ? where.slice(0, 8) : undefined,
    });
  }

  return verdicts;
}

/**
 * `complete` não é lido do modelo.
 *
 * Deixar o modelo declarar que terminou é convidar a contradição: ele marca um campo obrigatório
 * como `buscar_de_novo` e ainda assim escreve `complete: true`, e aí o laço encerra com trabalho
 * por fazer. A conclusão é derivável dos vereditos, então é derivada.
 */
export function deriveComplete(input: {
  verdicts: FieldVerdict[];
  selectedClass: DocumentClassRule;
}): boolean {
  const requiredKeys = new Set(
    input.selectedClass.fields.filter((field) => field.required).map((field) => field.key),
  );

  return !input.verdicts.some(
    (verdict) =>
      (verdict.verdict === 'buscar_de_novo' || verdict.verdict === 'valor_errado') &&
      (requiredKeys.has(verdict.key) || verdict.key.startsWith('naming.')),
  );
}

export async function evaluateExtraction(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
  naming?: DocumentNamingRoles;
  chunks: RetrievedChunk[];
  /** O tipo declarado pelo classificador, para confrontar com o que o extrator leu. */
  classifierDocumentType?: string | null;
  context?: GroqPromptContext;
  model?: string;
}): Promise<EvaluationResult> {
  const triage = triageExtraction({
    selectedClass: input.selectedClass,
    metadata: input.metadata,
    naming: input.naming,
    chunks: input.chunks,
    classifierDocumentType: input.classifierDocumentType,
  });

  // Documento sem sintoma não vira chamada. É o que mantém o refino barato: o custo cai sobre o
  // documento problemático, não sobre a fila inteira.
  if (triage.clean) {
    return {
      complete: true,
      fields: [],
      usage: EMPTY_TOKEN_USAGE,
      skipped: true,
      triage,
    };
  }

  const fields = buildEvaluatorFieldBriefs({
    selectedClass: input.selectedClass,
    metadata: input.metadata,
    findings: triage.findings,
  });

  const prompt = buildEvaluatorPrompt({
    selectedClass: input.selectedClass,
    fields,
    naming: input.naming,
    findings: triage.findings,
    chunks: input.chunks,
  });

  try {
    const answer = await completeJsonPromptWithUsage(prompt, {
      context: { ...input.context, operation: 'extraction_evaluation' },
      model: input.model,
    });

    const parsed = safeParseJsonFromModel<unknown>(answer.content);
    const verdicts = parseVerdicts(parsed);

    if (verdicts.length === 0) {
      // Sem veredito utilizável não há em que basear uma re-busca. Devolver "completo" aqui é
      // deliberado: o laço para, o documento segue com o que a extração já tinha, e o custo do
      // erro é o de antes deste agente existir — nunca pior.
      logger.warn('avaliação da extração sem veredito utilizável', {
        requestId: input.context?.requestId,
        jobId: input.context?.jobId,
        className: input.selectedClass.name,
        responseChars: answer.content.length,
        responsePreview: answer.content.slice(0, 200),
      });
      return { complete: true, fields: [], usage: answer.usage, skipped: false, triage };
    }

    return {
      complete: deriveComplete({ verdicts, selectedClass: input.selectedClass }),
      fields: verdicts,
      usage: answer.usage,
      skipped: false,
      triage,
    };
  } catch (error) {
    // Saturação sobe intacta: o worker devolve o job à fila em vez de degradar o documento para
    // revisão manual justamente sob carga. Mesmo contrato do extrator.
    if (isGroqSaturationError(error)) {
      throw error;
    }

    logger.error('avaliação da extração falhou', {
      requestId: input.context?.requestId,
      jobId: input.context?.jobId,
      companyId: input.context?.companyId,
      className: input.selectedClass.name,
      symptomCount: triage.findings.length,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return { complete: true, fields: [], usage: EMPTY_TOKEN_USAGE, skipped: false, triage };
  }
}
