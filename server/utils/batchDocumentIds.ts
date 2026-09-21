/**
 * Teto de documentos por chamada de lote.
 *
 * Os endpoints de lote liam `documentIds` sem limite nenhum e tratavam um por um: carregar o
 * documento, conferir acesso, gravar, e ainda um evento de rastreio aguardado por linha. A duração
 * da requisição e o tamanho da resposta cresciam junto com o que o cliente mandasse.
 *
 * 200 é folgado para a tela: a listagem devolve no máximo 100 por página, então nem "selecionar
 * tudo" duas vezes chega aqui.
 */
export const MAX_BATCH_DOCUMENT_IDS = 200;

/** Descarta o que não é id e repete: a mesma seleção não precisa ser processada duas vezes. */
export function normalizeBatchDocumentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return [...new Set(ids)];
}
