/**
 * De onde veio — ou por que não veio — a data de vencimento de um documento.
 *
 * `data_vencimento` não é um metadado entre outros: ele alimenta `searchMeta.validityDate`, que
 * alimenta o alerta de vencimento. Campo vazio aqui não é lacuna de metadado, é o alerta que nunca
 * dispara e o contrato que vence sem ninguém saber.
 *
 * Existe porque não havia número nenhum sobre isso. Sem contagem, "melhorou" é impressão: o laço
 * de refino já registra o que recuperou e o que provou ausente, e o campo que sustenta uma
 * funcionalidade do produto não registrava nada. Cada origem é uma pergunta diferente — `ausente`
 * pede prompt, `derivado_de_texto` pede conferir a heurística, `sem_campo` não é falha nenhuma e
 * não pode ser contada como uma.
 */
import type { DocumentClassRule, ExtractedMetadataField } from '../types/documentAi.types.js';
import { isEndDateFieldName } from './derivedDates.js';

export type ExpiryProvenance =
  /** O modelo leu a data escrita no documento. */
  | 'lido'
  /** Calculada a partir de âncora + prazo que estava num campo extraído. */
  | 'derivado_de_campo'
  /** Calculada a partir de âncora + prazo lido do corpo do documento. */
  | 'derivado_de_texto'
  /** A classe tem campo de data final e ele ficou vazio. É este que o alerta perde. */
  | 'ausente'
  /** A classe não tem campo de data final: não há vencimento a esperar. */
  | 'sem_campo';

function isEmpty(field: ExtractedMetadataField | undefined): boolean {
  const value = field?.normalizedValue ?? field?.value;
  return value === null || value === undefined || String(value).trim() === '';
}

export function resolveExpiryProvenance(
  selectedClass: DocumentClassRule,
  metadata: Record<string, ExtractedMetadataField>,
): ExpiryProvenance {
  const target = selectedClass.fields.find(
    (field) =>
      field.type === 'date' &&
      isEndDateFieldName(field),
  );
  if (!target) return 'sem_campo';

  const extracted = metadata[target.key];
  if (isEmpty(extracted)) return 'ausente';
  if (extracted!.source !== 'derived') return 'lido';
  return extracted!.derivedFrom === 'texto' ? 'derivado_de_texto' : 'derivado_de_campo';
}
