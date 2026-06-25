import type {
  AnalyzePdfResponse,
  ExtractedMetadataField,
  MetadataExtractionResult,
  ProcessingLogItem,
} from '../types/documentAi.types.js';
import { AI_ERROR_MESSAGES } from '../constants.js';
import { AiAnalysisError } from '../utils/errors.js';
import { getNoAiTemplate } from '../utils/aiMode.js';
import { generateRecommendedFileName } from './documentNaming.js';
import { getMongoClassAndRule } from '../../services/documentRulesService.js';
import { mapMongoToDocumentClassRule } from './noAiRuleMapper.js';
import { logger } from '../../utils/logger.js';

const NDA_CLASS_ID = 'class_confidentiality_agreement';
const NDA_RULE_ID = 'rule_confidentiality_agreement_v1';

const NO_AI_EVIDENCE_SNIPPET =
  'Evidência simulada em modo de desenvolvimento.';

function createLog(
  title: string,
  description: string,
  status: ProcessingLogItem['status'] = 'done',
): ProcessingLogItem {
  return { title, description, status };
}

function buildNoAiMetadataField(
  label: string,
  value: string | number,
  normalizedValue?: string | number,
  currency?: string,
): ExtractedMetadataField {
  return {
    label,
    value,
    normalizedValue: normalizedValue ?? value,
    confidence: 0.99,
    source: 'no_ai',
    evidence: {
      pageNumber: 1,
      snippet: NO_AI_EVIDENCE_SNIPPET,
    },
    ...(currency ? { currency } : {}),
  };
}

function buildNdaMetadata(): Record<string, ExtractedMetadataField> {
  return {
    parte_reveladora: buildNoAiMetadataField(
      'Parte reveladora',
      'Cristiano Rafael Baldissera',
    ),
    parte_receptora: buildNoAiMetadataField(
      'Parte receptora',
      'Sidnei Alves de Almeida',
    ),
    cpf_cnpj_receptora: buildNoAiMetadataField(
      'CPF/CNPJ da parte receptora',
      '02790730095',
    ),
    data_assinatura: buildNoAiMetadataField(
      'Data de assinatura',
      '09 de junho de 2026',
      '2026-06-09',
    ),
    prazo_vigencia: buildNoAiMetadataField('Prazo de vigência', '7 anos'),
    prazo_confidencialidade: buildNoAiMetadataField('Prazo de confidencialidade', '7 anos'),
    multa_penalidade: buildNoAiMetadataField(
      'Multa ou penalidade',
      500000,
      500000,
      'BRL',
    ),
    foro: buildNoAiMetadataField('Foro', 'Comarca de Caxias do Sul/RS'),
    objeto_confidencialidade: buildNoAiMetadataField(
      'Objeto da confidencialidade',
      'Informações confidenciais compartilhadas entre as partes',
    ),
  };
}

async function resolveNdaClassAndRule(companyId: string) {
  const classAndRule = await getMongoClassAndRule({
    companyId,
    classId: NDA_CLASS_ID,
  });

  if (!classAndRule) {
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.noAiClassRuleNotFound,
      'NO_AI_CLASS_RULE_NOT_FOUND',
      503,
    );
  }

  if (classAndRule.rule._id !== NDA_RULE_ID) {
    logger.warn('no_ai: regra ativa difere do template NDA esperado', {
      companyId,
      expectedRuleId: NDA_RULE_ID,
      activeRuleId: classAndRule.rule._id,
      classId: NDA_CLASS_ID,
    });
  }

  return classAndRule;
}

export async function analyzePdfWithNoAi(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  companyId: string;
  jobId: string;
  fileHash: string;
  fileSizeBytes: number;
  requestContext?: {
    requestId?: string;
    batchId?: string;
    itemId?: string;
    fileName?: string;
  };
}): Promise<AnalyzePdfResponse> {
  const template = getNoAiTemplate();

  if (template !== 'nda') {
    throw new AiAnalysisError(
      `Template no_ai "${template}" não implementado. Use NO_AI_TEMPLATE=nda.`,
      'NO_AI_TEMPLATE_UNSUPPORTED',
      501,
    );
  }

  logger.info('AI_MODE=no_ai ativo. Retornando análise determinística para desenvolvimento.', {
    requestId: input.requestContext?.requestId,
    batchId: input.requestContext?.batchId,
    itemId: input.requestContext?.itemId,
    fileName: input.requestContext?.fileName ?? input.originalFileName,
    companyId: input.companyId,
    template,
    fileSizeBytes: input.fileSizeBytes,
  });

  const { docClass, rule } = await resolveNdaClassAndRule(input.companyId);
  const selectedClass = mapMongoToDocumentClassRule(docClass, rule);
  const metadata = buildNdaMetadata();
  const version = 'v1.0';

  const extraction: MetadataExtractionResult = {
    documentType: docClass.name,
    version,
    metadata,
    missingFields: [],
    requiresReview: false,
    reviewReasons: [],
  };

  const recommendedFileName = generateRecommendedFileName({
    originalFileName: input.originalFileName,
    selectedClass,
    metadata,
    version,
  });

  const logs: ProcessingLogItem[] = [
    createLog('Documento recebido', 'O PDF foi recebido com sucesso.'),
    createLog(
      'Modo de desenvolvimento sem IA ativo',
      'A análise determinística foi usada para teste do workflow (AI_MODE=no_ai).',
    ),
    createLog(
      'Classe simulada identificada',
      `O documento foi classificado como "${docClass.name}" (modo de desenvolvimento).`,
    ),
    createLog(
      'Metadados simulados gerados',
      'Os campos configurados foram preenchidos com valores determinísticos de teste.',
    ),
    createLog(
      'Nome recomendado gerado',
      `Nome sugerido: ${recommendedFileName}`,
    ),
    createLog(
      'Pronto para confirmação',
      'O resultado está pronto para revisão e confirmação.',
    ),
  ];

  logger.info('no_ai analyze-pdf concluído', {
    requestId: input.requestContext?.requestId,
    jobId: input.jobId,
    companyId: input.companyId,
    classId: NDA_CLASS_ID,
    ruleId: rule._id,
    recommendedFileName,
    template,
  });

  return {
    jobId: input.jobId,
    status: 'completed',
    originalFileName: input.originalFileName,
    fileHash: input.fileHash,
    fileSizeBytes: input.fileSizeBytes,
    recommendedFileName,
    textExtraction: {
      status: 'completed',
      pageCount: 1,
      charCount: 1200,
      truncated: false,
    },
    classification: {
      classId: NDA_CLASS_ID,
      className: docClass.name,
      confidence: 0.99,
      requiresReview: false,
      reason:
        'Modo de desenvolvimento sem IA: classificação determinística para teste do workflow.',
      evidence: [
        {
          pageNumber: 1,
          snippet: 'Modo de desenvolvimento: evidência simulada para teste do workflow.',
        },
      ],
    },
    extraction,
    logs,
  };
}
