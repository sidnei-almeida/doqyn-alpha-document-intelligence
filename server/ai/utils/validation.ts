import {
  AI_ERROR_MESSAGES,
  MIN_CLASSIFICATION_CONFIDENCE,
  MIN_FIELD_CONFIDENCE,
  DERIVED_FIELD_CONFIDENCE,
} from '../constants.js';
import type {
  ClassificationResult,
  DocumentClassRule,
  EvidenceSnippet,
  ExtractedMetadataField,
  MetadataExtractionResult,
} from '../types/documentAi.types.js';
import type { DocumentRuleField } from '../types/documentAi.types.js';
import { isConfidentialityClassRule } from './documentClassHeuristics.js';
import { deriveEndDates, normalizeDateValue } from './derivedDates.js';
import {
  normalizeCurrency,
  normalizeCpf,
  normalizeStringFieldValue,
  validateCnpj,
  validateCpf,
} from '../services/documentValidators.js';

function parseEvidence(raw: unknown): EvidenceSnippet | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const data = raw as Record<string, unknown>;
  const snippet = typeof data.snippet === 'string' ? data.snippet.trim() : '';
  if (!snippet) return undefined;

  const pageNumber =
    typeof data.pageNumber === 'number' && Number.isFinite(data.pageNumber)
      ? data.pageNumber
      : undefined;

  return { pageNumber, snippet: snippet.slice(0, 300) };
}

function parseEvidenceList(raw: unknown): EvidenceSnippet[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => parseEvidence(item))
    .filter((item): item is EvidenceSnippet => Boolean(item));
}

export function validateClassificationResult(
  raw: unknown,
  allowedClassIds: string[],
): ClassificationResult {
  const fallback: ClassificationResult = {
    classId: null,
    className: null,
    confidence: 0,
    requiresReview: true,
    reason: AI_ERROR_MESSAGES.invalidAiResponse,
    evidence: [],
  };

  if (!raw || typeof raw !== 'object') return fallback;

  const data = raw as Record<string, unknown>;
  const classId = typeof data.classId === 'string' ? data.classId : null;
  const className = typeof data.className === 'string' ? data.className : null;
  let confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(1, Math.max(0, data.confidence))
      : 0;
  const reason = typeof data.reason === 'string' ? data.reason : fallback.reason;
  const evidence = parseEvidenceList(data.evidence);

  let requiresReview = Boolean(data.requiresReview);

  const validClass = Boolean(classId && allowedClassIds.includes(classId));

  if (!validClass) {
    requiresReview = true;
  }

  if (confidence < MIN_CLASSIFICATION_CONFIDENCE) {
    requiresReview = true;
  }

  if (evidence.length === 0 && confidence < 0.85 && !requiresReview) {
    confidence = Math.min(confidence, MIN_CLASSIFICATION_CONFIDENCE);
    requiresReview = confidence < MIN_CLASSIFICATION_CONFIDENCE;
  }

  return {
    classId: validClass ? classId : null,
    className: validClass ? className : null,
    confidence,
    requiresReview,
    reason,
    evidence,
  };
}

function applyFieldNormalization(
  field: DocumentRuleField,
  value: string | number | null,
  modelNormalized?: string | number | null,
): { value: string | number | null; normalizedValue: string | number | null; currency?: string } {
  const normalizedValue = normalizeStringFieldValue(value, field);

  // Data: o prompt pede ISO em normalizedValue, mas esta função recalculava tudo a partir do
  // `value` cru e não tratava data — então o ISO do modelo era descartado e o campo chegava ao
  // banco por extenso. Aceita o ISO do modelo quando ele veio válido; senão converte aqui.
  // Ter o ISO também é pré-requisito da derivação de data final (deriveEndDates).
  if (field.type === 'date' && value !== null) {
    const fromModel = normalizeDateValue(modelNormalized);
    const fromValue = normalizeDateValue(value);
    const iso = fromModel ?? fromValue;
    if (iso) return { value, normalizedValue: iso };
  }

  if (field.type === 'currency' && value !== null) {
    const { amount, currency } = normalizeCurrency(value);
    return { value, normalizedValue: amount, currency };
  }

  if (field.key.includes('cnpj') && typeof value === 'string' && validateCnpj(value)) {
    return { value, normalizedValue };
  }

  if (field.key.includes('cpf') && typeof value === 'string' && validateCpf(value)) {
    return { value, normalizedValue: normalizeCpf(value) };
  }

  return {
    value,
    normalizedValue: normalizedValue ?? value,
  };
}

export function validateMetadataResult(
  raw: unknown,
  selectedClass: DocumentClassRule,
): MetadataExtractionResult {
  const requiredFieldKeys = selectedClass.fields.filter((f) => f.required).map((f) => f.key);

  const fallback: MetadataExtractionResult = {
    documentType: selectedClass.name,
    version: 'v1.0',
    metadata: {},
    missingFields: requiredFieldKeys,
    requiresReview: true,
    reviewReasons: ['Resposta de metadados inválida ou incompleta.'],
  };

  if (!raw || typeof raw !== 'object') return fallback;

  const data = raw as Record<string, unknown>;
  const metadataRaw = data.metadata;
  if (!metadataRaw || typeof metadataRaw !== 'object') return fallback;

  const metadata: Record<string, ExtractedMetadataField> = {};
  const missingFields: string[] = [];
  const reviewReasons: string[] = [];
  const ndaClass = isConfidentialityClassRule(selectedClass);

  for (const fieldDef of selectedClass.fields) {
    const key = fieldDef.key;
    const fieldRaw = (metadataRaw as Record<string, unknown>)[key];

    if (!fieldRaw || typeof fieldRaw !== 'object') {
      metadata[key] = {
        label: fieldDef.label,
        value: null,
        normalizedValue: null,
        confidence: 0,
        source: 'document_text',
      };
      if (fieldDef.required) missingFields.push(key);
      continue;
    }

    const field = fieldRaw as Record<string, unknown>;
    const rawValue =
      typeof field.value === 'string' || typeof field.value === 'number' || field.value === null
        ? field.value
        : null;
    const value = rawValue === '' ? null : rawValue;
    let confidence =
      typeof field.confidence === 'number' && Number.isFinite(field.confidence)
        ? Math.min(1, Math.max(0, field.confidence))
        : 0;

    const evidence = parseEvidence(field.evidence);
    const modelNormalized =
      typeof field.normalizedValue === 'string' || typeof field.normalizedValue === 'number'
        ? field.normalizedValue
        : null;
    const normalized = applyFieldNormalization(fieldDef, value, modelNormalized);

    metadata[key] = {
      label: fieldDef.label,
      value: normalized.value,
      normalizedValue: normalized.normalizedValue,
      confidence,
      source: 'document_text',
      ...(normalized.currency ? { currency: normalized.currency } : {}),
      ...(evidence ? { evidence } : {}),
    };

    if (fieldDef.required && (value === null || value === '')) {
      missingFields.push(key);
    }

    if (fieldDef.required && confidence < MIN_FIELD_CONFIDENCE) {
      reviewReasons.push(`Campo obrigatório "${fieldDef.label}" com confiança baixa.`);
    }

    if (value !== null && !evidence) {
      if (fieldDef.required) {
        confidence = Math.min(confidence, MIN_FIELD_CONFIDENCE);
        metadata[key].confidence = confidence;
        reviewReasons.push(`Campo obrigatório "${fieldDef.label}" sem evidência textual.`);
      } else if (!ndaClass) {
        confidence = Math.min(confidence, MIN_FIELD_CONFIDENCE);
        metadata[key].confidence = confidence;
        reviewReasons.push(`Campo "${fieldDef.label}" sem evidência textual.`);
      }
    }
  }

  // Data final calculada a partir de âncora + prazo, em código e não pelo LLM: o modelo pequeno
  // não faz essa aritmética (16 de 16 vazias na medição), o grande faz — então pelo LLM o
  // resultado dependeria do modelo configurado. Ver server/ai/utils/derivedDates.ts.
  for (const derived of deriveEndDates(selectedClass.fields, metadata)) {
    const fieldDef = selectedClass.fields.find((f) => f.key === derived.targetKey);
    if (!fieldDef) continue;

    metadata[derived.targetKey] = {
      label: fieldDef.label,
      value: derived.value,
      normalizedValue: derived.value,
      confidence: DERIVED_FIELD_CONFIDENCE,
      source: 'derived',
      evidence: {
        snippet:
          `Calculado: ${derived.anchorValue} (${derived.anchorKey}) + ` +
          `${derived.durationValue} (${derived.durationKey})`,
      },
    };

    const stillMissing = missingFields.indexOf(derived.targetKey);
    if (stillMissing >= 0) missingFields.splice(stillMissing, 1);
  }

  const parsedMissing = Array.isArray(data.missingFields)
    ? data.missingFields.filter((f): f is string => typeof f === 'string')
    : missingFields;

  const requiredKeys = new Set(
    selectedClass.fields.filter((field) => field.required).map((field) => field.key),
  );

  const mergedMissing = [...new Set([...missingFields, ...parsedMissing])];
  const requiredMissing = mergedMissing.filter((key) => requiredKeys.has(key));

  const extraReviewReasons = Array.isArray(data.reviewReasons)
    ? data.reviewReasons.filter((r): r is string => typeof r === 'string')
    : [];

  let allReviewReasons = [...new Set([...reviewReasons, ...extraReviewReasons])];

  if (ndaClass) {
    allReviewReasons = allReviewReasons.filter(
      (reason) =>
        !reason.includes('prazo_confidencialidade') &&
        !reason.includes('objeto_confidencialidade') &&
        !reason.includes('cpf_cnpj'),
    );
  }

  const requiresReview =
    Boolean(data.requiresReview && requiredMissing.length > 0) ||
    requiredMissing.length > 0 ||
    allReviewReasons.some((reason) => reason.includes('obrigatório'));

  if (requiredMissing.length > 0 && !allReviewReasons.some((r) => r.includes('obrigatório'))) {
    allReviewReasons.push('Campos obrigatórios ausentes no documento.');
  }

  return {
    documentType:
      typeof data.documentType === 'string' ? data.documentType : selectedClass.name,
    version: typeof data.version === 'string' ? data.version : 'v1.0',
    metadata,
    missingFields: mergedMissing,
    requiresReview,
    reviewReasons: allReviewReasons,
  };
}
