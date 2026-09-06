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
  | 'sem_progresso'
  /** O campo foi reprocurado no documento inteiro e realmente não está lá. */
  | 'ausencia_provada';

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
  /** Campos preenchidos com valor que o documento não sustenta, apagados pelo Avaliador. */
  clearedFields: string[];
  /**
   * Ausências que foram confirmadas por busca no documento inteiro, e não apenas nos trechos que
   * o retriever tinha escolhido. É a diferença entre "não achei" e "não existe".
   */
  provenAbsentFields: string[];
  /** true quando os trechos avaliados já eram o documento inteiro — prova sai de graça. */
  evaluatorSawWholeDocument: boolean;
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
    clearedFields: [],
    provenAbsentFields: [],
    // O Avaliador julga sobre a seleção do retriever, não sobre o documento. Quando a seleção é o
    // documento inteiro — o caso de todo arquivo curto —, "não está aqui" já é "não existe" e a
    // prova não custa chamada nenhuma.
    evaluatorSawWholeDocument: input.extractionChunks.length >= input.chunks.length,
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

    const absentNow = evaluation.fields
      .filter((verdict) => verdict.verdict === 'ausente_de_fato')
      .map((verdict) => verdict.key);
    trail.absentFields = [...new Set([...trail.absentFields, ...absentNow])];

    const questioned = new Set(evaluation.triage.suspectFieldKeys);

    /**
     * Ausência sobre trecho selecionado não é ausência.
     *
     * O Avaliador julga o que o retriever entregou, não o documento. Quando ele diz "esse dado não
     * está aqui", o que ele sabe dizer é "não está nos trechos que me deram" — e num contrato de
     * cem páginas isso não é a mesma frase. Declarar ausência com base numa leitura parcial é
     * afirmar mais do que se apurou, e é justamente a afirmação em que o usuário vai confiar para
     * parar de procurar.
     *
     * Então a ausência vira alvo de busca, não conclusão: o campo entra no passe focado com
     * `retrieveChunksForField` sobre TODOS os chunks. Só depois de procurar no documento inteiro,
     * com os termos daquele campo, e não achar, é que a ausência fica provada.
     *
     * E não custa quase nada: quando a seleção já era o documento inteiro, a prova é dispensada; e
     * quando não era, os campos ausentes entram no mesmo passe focado que já ia acontecer.
     */
    const needsProof = absentNow.filter(
      (key) => !trail.evaluatorSawWholeDocument && fieldsByKey.has(key),
    );
    const provenNow = absentNow.filter((key) => !needsProof.includes(key));
    trail.provenAbsentFields = [...new Set([...trail.provenAbsentFields, ...provenNow])];

    /**
     * Ausência provada apaga o valor que estava lá.
     *
     * O recibo avulso de `financeiro_03` traz "Nº 0447" impresso no talão, o extrator preenche
     * `numero_nota` com isso, e o gabarito diz que o certo é vazio. Sem apagar, a conclusão do
     * Avaliador morria no relatório e o 0447 seguia para o banco.
     *
     * Só apaga campo que a triagem já tinha questionado — "ausente de fato" sobre campo que
     * ninguém perguntou é o modelo se distraindo — e só quando a ausência está provada.
     */
    const clearIfProven = (key: string) => {
      if (!questioned.has(key) || !isFilled(metadata[key])) return;
      metadata = Object.fromEntries(
        Object.entries(metadata).filter(([entryKey]) => entryKey !== key),
      );
      trail.clearedFields = [...new Set([...trail.clearedFields, key])];
    };
    for (const key of provenNow) clearIfProven(key);

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

    for (const key of needsProof) {
      const field = fieldsByKey.get(key);
      if (!field || targets.some((target) => target.field.key === key)) continue;
      targets.push({
        field,
        hint: 'O auditor concluiu que este dado não existe no documento, mas ele leu apenas parte dos trechos. Estes são os trechos do documento inteiro que mais se aproximam deste campo. Confirme a ausência ou traga o valor.',
        previousValue: metadata[key]?.normalizedValue ?? metadata[key]?.value ?? null,
        chunks: retrieveChunksForField({
          chunks: input.chunks,
          field,
          selectedClass: input.selectedClass,
        }),
      });
    }

    // Confirmação de ausência não é motivo para o laço continuar: se o Avaliador aprovou o resto,
    // o passe focado é o último ato.
    const onlyProving = actionable.length === 0 && needsProof.length > 0;

    if (evaluation.complete && !onlyProving) {
      trail.stopReason = 'avaliador_aprovou';
      break;
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

    /**
     * A prova fecha aqui.
     *
     * Cada campo em `needsProof` foi reprocurado no documento inteiro. O que voltou com evidência
     * nunca esteve ausente — o retriever é que não tinha entregue o trecho, e recuperá-lo é o
     * melhor resultado possível deste laço. O que não voltou está provado ausente, e só agora a
     * afirmação "o documento não traz esse dado" é uma afirmação que o sistema apurou.
     */
    for (const key of needsProof) {
      if (merged.recoveredKeys.includes(key)) continue;
      trail.provenAbsentFields = [...new Set([...trail.provenAbsentFields, key])];
      clearIfProven(key);
    }

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
    // orçamento para chegar à mesma resposta. Confirmar ausência conta como progresso: é o passe
    // fazendo exatamente o que foi pedido, e repetir a busca do mesmo campo não mudaria a resposta.
    if (merged.recoveredKeys.length === 0 && !namingImproved) {
      trail.stopReason = needsProof.length > 0 ? 'ausencia_provada' : 'sem_progresso';
      break;
    }

    // Só faltava provar ausência, e ficou provado. Não há segundo passe a fazer.
    if (onlyProving) {
      trail.stopReason = 'ausencia_provada';
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
  const recovered =
    trail.recoveredFields.length > 0 ||
    trail.clearedFields.length > 0 ||
    trail.provenAbsentFields.length > 0 ||
    trail.passes.length > 0;
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
