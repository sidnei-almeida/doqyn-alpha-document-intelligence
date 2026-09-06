/**
 * O laço: extrai, avalia, reprocura, mescla, repete.
 *
 * A ideia é simples e o risco também: um laço que decide sozinho quantas vezes voltar ao mesmo
 * documento pode consumir a janela de vazão da conta inteira num arquivo só, enquanto o resto da
 * fila espera. Por isso todas as saídas são duras e nenhuma depende de o modelo cooperar —
 * orçamento de tokens, teto de passes, e a exigência de que cada passe mude alguma coisa.
 *
 * O estreitamento acontece em duas dimensões por passe: menos campos (só os que o Avaliador marcou)
 * e trechos mais específicos (re-selecionados com os termos que o próprio Avaliador escreveu).
 */
import type {
  ClassificationResult,
  DocumentChunk,
  DocumentClassRule,
  DocumentRuleField,
  ExtractedMetadataField,
  MetadataExtractionResult,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import type { DocumentAnalysisProvider } from '../providers/types.js';
import { retrieveChunksForField } from '../../services/hybridChunkRetriever.js';
import { evaluateExtraction, type FieldVerdict } from './extractionEvaluatorAgent.js';
import { extractFocusedFields } from './focusedExtractorAgent.js';
import type { FocusedTarget } from '../utils/focusedExtractorPrompt.js';
import { addTokenUsage, EMPTY_TOKEN_USAGE, type GroqPromptContext } from './groqClient.js';
import {
  getExtractionRefinementMaxPasses,
  getExtractionTokenBudget,
  isExtractionRefinementEnabled,
} from '../utils/aiConfig.js';
import { createTokenBudget, type TokenBudget } from '../utils/tokenBudget.js';
import { estimateGroqTokens } from './groqRateLimiter.js';
import { logger } from '../../utils/logger.js';

export type RefinementStopReason =
  | 'desligado'
  | 'avaliador_aprovou'
  | 'nada_para_reprocurar'
  | 'teto_de_passes'
  | 'orcamento_esgotado'
  | 'sem_progresso';

export type RefinementPassTrail = {
  pass: number;
  targetKeys: string[];
  namingKeys: string[];
  recoveredKeys: string[];
  evaluatorSkipped: boolean;
  tokensSpent: number;
};

export type RefinementTrail = {
  enabled: boolean;
  passes: RefinementPassTrail[];
  stopReason: RefinementStopReason;
  tokensSpent: number;
  tokenBudget: number;
  /** Campos que o Avaliador declarou realmente ausentes do documento. */
  absentFields: string[];
  recoveredFields: string[];
};

export type RefinedExtraction = {
  extraction: MetadataExtractionResult;
  trail: RefinementTrail;
};

/**
 * Os dois agentes, injetáveis. Mesma razão do `embedder` em `documentChunkEmbeddingService`: as
 * regras de parada do laço — orçamento, teto de passes, ausência de progresso — são a parte que
 * precisa de teste, e testá-las contra o provedor real custaria token e dependeria de rede para
 * exercitar exatamente o caminho em que a rede não deve importar.
 */
export type RefinementDeps = {
  evaluate: typeof evaluateExtraction;
  extractFocused: typeof extractFocusedFields;
};

/** Termos do Avaliador entram como aliases sintéticos: é assim que a re-seleção fica mais estreita. */
function fieldWithHintTerms(field: DocumentRuleField, verdict: FieldVerdict): DocumentRuleField {
  if (!verdict.where?.length) return field;
  return { ...field, aliases: [...(field.aliases ?? []), ...verdict.where] };
}

function isFilled(extracted: ExtractedMetadataField | undefined): boolean {
  if (!extracted) return false;
  const value = extracted.normalizedValue ?? extracted.value;
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * O valor novo só entra se vier com o trecho que o comprova.
 *
 * Sem essa regra o segundo passe piora o primeiro: a pressão de encontrar algo numa segunda
 * tentativa é exatamente o que produz valor inventado, e um valor sem evidência substituindo um
 * valor com evidência é regressão disfarçada de recuperação.
 */
function mergeFocusedMetadata(input: {
  current: Record<string, ExtractedMetadataField>;
  incoming: Record<string, ExtractedMetadataField>;
}): { metadata: Record<string, ExtractedMetadataField>; recoveredKeys: string[] } {
  const metadata = { ...input.current };
  const recoveredKeys: string[] = [];

  for (const [key, incoming] of Object.entries(input.incoming)) {
    if (!incoming.evidence?.snippet?.trim()) continue;
    const previous = metadata[key];
    const previousValue = previous?.normalizedValue ?? previous?.value ?? null;
    const incomingValue = incoming.normalizedValue ?? incoming.value ?? null;
    if (isFilled(previous) && String(previousValue) === String(incomingValue)) continue;

    metadata[key] = incoming;
    recoveredKeys.push(key);
  }

  return { metadata, recoveredKeys };
}

function estimatePassCost(targets: FocusedTarget[]): number {
  const promptChars = targets.reduce(
    (total, target) => total + target.chunks.reduce((sum, chunk) => sum + chunk.text.length, 400),
    600,
  );
  return estimateGroqTokens(promptChars);
}

export async function refineExtraction(input: {
  analysisProvider: DocumentAnalysisProvider;
  /** Todos os chunks do documento — o passe focado re-seleciona a partir daqui. */
  chunks: DocumentChunk[];
  /** A seleção que alimentou a extração inicial; é sobre ela que o Avaliador julga. */
  extractionChunks: RetrievedChunk[];
  selectedClass: DocumentClassRule;
  classification: ClassificationResult;
  context: GroqPromptContext & { jobId: string; companyId: string };
  budget?: TokenBudget;
  deps?: Partial<RefinementDeps>;
}): Promise<RefinedExtraction> {
  const evaluate = input.deps?.evaluate ?? evaluateExtraction;
  const extractFocused = input.deps?.extractFocused ?? extractFocusedFields;
  const extraction = await input.analysisProvider.extractMetadata({
    chunks: input.extractionChunks,
    selectedClass: input.selectedClass,
    classification: input.classification,
    context: {
      requestId: input.context.requestId,
      jobId: input.context.jobId,
      companyId: input.context.companyId,
      database: input.context.database,
    },
  });

  const budget = input.budget ?? createTokenBudget(getExtractionTokenBudget());
  const enabled = isExtractionRefinementEnabled();
  const trail: RefinementTrail = {
    enabled,
    passes: [],
    stopReason: enabled ? 'teto_de_passes' : 'desligado',
    tokensSpent: 0,
    tokenBudget: budget.limit(),
    absentFields: [],
    recoveredFields: [],
  };

  if (!trail.enabled) {
    return { extraction, trail };
  }

  const maxPasses = getExtractionRefinementMaxPasses();
  const fieldsByKey = new Map(input.selectedClass.fields.map((field) => [field.key, field]));
  let metadata = extraction.metadata;
  let naming = extraction.naming;
  let usage = EMPTY_TOKEN_USAGE;

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const evaluation = await evaluate({
      selectedClass: input.selectedClass,
      metadata,
      naming,
      chunks: input.extractionChunks,
      context: input.context,
    });

    usage = addTokenUsage(usage, evaluation.usage);
    budget.spend(evaluation.usage.totalTokens);

    trail.absentFields = [
      ...new Set([
        ...trail.absentFields,
        ...evaluation.fields
          .filter((verdict) => verdict.verdict === 'ausente_de_fato')
          .map((verdict) => verdict.key),
      ]),
    ];

    if (evaluation.complete) {
      trail.stopReason = 'avaliador_aprovou';
      break;
    }

    const actionable = evaluation.fields.filter(
      (verdict) => verdict.verdict === 'buscar_de_novo' || verdict.verdict === 'valor_errado',
    );

    const targets: FocusedTarget[] = [];
    for (const verdict of actionable) {
      const field = fieldsByKey.get(verdict.key);
      if (!field) continue;
      const previous = metadata[verdict.key];
      targets.push({
        field,
        hint: verdict.hint,
        previousProblem: verdict.reason,
        previousValue: previous?.normalizedValue ?? previous?.value ?? null,
        chunks: retrieveChunksForField({
          chunks: input.chunks,
          field: fieldWithHintTerms(field, verdict),
          selectedClass: input.selectedClass,
        }),
      });
    }

    const namingVerdicts = actionable.filter((verdict) => verdict.key.startsWith('naming.'));
    const namingTarget = namingVerdicts.length
      ? {
          keys: namingVerdicts.map((verdict) => verdict.key.replace('naming.', '')),
          hint:
            namingVerdicts
              .map((verdict) => verdict.hint)
              .filter(Boolean)
              .join('; ') || undefined,
        }
      : undefined;

    if (targets.length === 0 && !namingTarget) {
      trail.stopReason = 'nada_para_reprocurar';
      break;
    }

    const estimate = estimatePassCost(targets);
    if (!budget.canAfford(estimate)) {
      trail.stopReason = 'orcamento_esgotado';
      logger.info('refino interrompido pelo orçamento de tokens', {
        requestId: input.context.requestId,
        jobId: input.context.jobId,
        pass,
        spent: budget.spent(),
        limit: budget.limit(),
        estimate,
        pendingKeys: targets.map((target) => target.field.key),
      });
      break;
    }

    const focused = await extractFocused({
      selectedClass: input.selectedClass,
      targets,
      naming: namingTarget,
      context: input.context,
    });

    usage = addTokenUsage(usage, focused.usage);
    budget.spend(focused.usage.totalTokens);

    const merged = mergeFocusedMetadata({ current: metadata, incoming: focused.metadata });
    metadata = merged.metadata;

    const namingImproved = Boolean(
      focused.naming &&
      (focused.naming.tipo !== naming?.tipo ||
        focused.naming.sujeitos.join('|') !== (naming?.sujeitos ?? []).join('|') ||
        focused.naming.dataReferencia !== naming?.dataReferencia),
    );
    if (focused.naming && namingImproved) {
      naming = {
        tipo: focused.naming.tipo ?? naming?.tipo ?? null,
        sujeitos: focused.naming.sujeitos.length
          ? focused.naming.sujeitos
          : (naming?.sujeitos ?? []),
        dataReferencia: focused.naming.dataReferencia ?? naming?.dataReferencia ?? null,
      };
    }

    trail.passes.push({
      pass,
      targetKeys: targets.map((target) => target.field.key),
      namingKeys: namingTarget?.keys ?? [],
      recoveredKeys: merged.recoveredKeys,
      evaluatorSkipped: evaluation.skipped,
      tokensSpent: evaluation.usage.totalTokens + focused.usage.totalTokens,
    });
    trail.recoveredFields = [...new Set([...trail.recoveredFields, ...merged.recoveredKeys])];

    // Passe que não mudou nada é o modelo repetindo, não convergindo. Insistir daqui gasta o
    // orçamento para chegar à mesma resposta.
    if (merged.recoveredKeys.length === 0 && !namingImproved) {
      trail.stopReason = 'sem_progresso';
      break;
    }

    if (pass === maxPasses) {
      trail.stopReason = 'teto_de_passes';
    }
  }

  trail.tokensSpent = usage.totalTokens;

  const requiredKeys = input.selectedClass.fields
    .filter((field) => field.required)
    .map((field) => field.key);
  const missingFields = requiredKeys.filter((key) => !isFilled(metadata[key]));

  /**
   * A revisão só é reavaliada quando o refino de fato recuperou alguma coisa.
   *
   * Manter `requiresReview` herdado depois de recuperar o campo que o causou anularia o trabalho:
   * o dado estaria preenchido e o documento continuaria na fila de revisão manual. Mas recalcular
   * sempre seria pior no outro sentido — a extração marca revisão por motivos que o refino não
   * toca (resposta inválida do modelo, confiança baixa em campo opcional), e apagá-los sem ter
   * mudado nada esconderia problema real.
   */
  const recovered = trail.recoveredFields.length > 0 || trail.passes.length > 0;
  const requiresReview =
    missingFields.length > 0 || (recovered ? false : extraction.requiresReview);

  return {
    extraction: {
      ...extraction,
      metadata,
      naming,
      missingFields,
      requiresReview,
      reviewReasons: requiresReview ? extraction.reviewReasons : [],
    },
    trail,
  };
}
