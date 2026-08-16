import type { CategoryFieldSpec } from '@/features/documents/api/documentsApi';
import type { ExtractedMetadata } from '@/features/document-send/types';

/**
 * Linhas do formulário rápido de revisão: o que a categoria pede cruzado com o que a IA trouxe.
 *
 * Mora fora do componente porque é a regra da tela — qual campo aparece, em que ordem, com que
 * valor — e é ela que o teste precisa alcançar sem renderizar React.
 */
export type QuickFieldRow = {
  key: string;
  label: string;
  description?: string;
  type: string;
  required: boolean;
  value: string;
  /** Veio da IA e não foi tocado — a origem some assim que a pessoa digita. */
  fromAi: boolean;
};

function indexAiFields(metadata: ExtractedMetadata): Map<string, { label: string; value: string }> {
  const index = new Map<string, { label: string; value: string }>();
  for (const field of metadata.extractedFields ?? []) {
    index.set(field.key, { label: field.label || field.key, value: field.value ?? '' });
  }
  return index;
}

/**
 * Une o que a categoria pede com o que a IA trouxe.
 *
 * A ordem é a da regra da categoria — é como o cliente configurou o que importa naquele tipo de
 * documento. Chaves extras que a IA trouxe e a regra não prevê vêm depois, em vez de sumirem.
 */
export function buildQuickFieldRows(input: {
  categoryFields: CategoryFieldSpec[];
  metadata: ExtractedMetadata;
  overrides: Record<string, string>;
}): QuickFieldRow[] {
  const aiFields = indexAiFields(input.metadata);
  const rows: QuickFieldRow[] = [];
  const seen = new Set<string>();

  for (const field of input.categoryFields) {
    seen.add(field.key);
    const aiValue = aiFields.get(field.key)?.value ?? '';
    const override = input.overrides[field.key];
    rows.push({
      key: field.key,
      label: field.label,
      description: field.description,
      type: field.type,
      required: field.required,
      value: override ?? aiValue,
      fromAi: override === undefined && aiValue !== '',
    });
  }

  for (const [key, field] of aiFields) {
    if (seen.has(key)) continue;
    const override = input.overrides[key];
    rows.push({
      key,
      label: field.label,
      type: 'string',
      required: false,
      value: override ?? field.value,
      fromAi: override === undefined && field.value !== '',
    });
  }

  return rows;
}
