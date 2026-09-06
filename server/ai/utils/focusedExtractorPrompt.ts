/**
 * O prompt do passe focado.
 *
 * Diferente do extrator normal em duas coisas, e são as duas que fazem o custo caber no orçamento:
 * ele recebe só os campos que o Avaliador mandou reprocurar, e recebe trechos re-selecionados por
 * campo em vez do documento inteiro. Um passe focado num campo custa uma fração da extração
 * completa, e é isso que permite insistir sem multiplicar a conta.
 *
 * O contrato de normalização é o mesmo do extrator, importado e não copiado: duas cópias do mesmo
 * texto divergiriam na primeira vez que alguém corrigisse uma delas.
 */
import type {
  DocumentClassRule,
  DocumentRuleField,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import { normalizationContract } from './extractorPrompt.js';
import { MAX_CHARS_PER_EXTRACTOR_CHUNK } from '../constants.js';

export type FocusedTarget = {
  field: DocumentRuleField;
  /** O que o Avaliador disse para procurar. */
  hint?: string;
  /** Por que o valor anterior não serviu — vazio quando o campo nunca foi preenchido. */
  previousProblem?: string;
  /** O valor que o passe anterior devolveu, quando havia um. */
  previousValue?: string | number | null;
  chunks: RetrievedChunk[];
};

/** Os papéis de nomeação, quando o Avaliador pediu para reprocurá-los. */
export type FocusedNamingTarget = {
  keys: string[];
  hint?: string;
};

function limitChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    text:
      chunk.text.length > MAX_CHARS_PER_EXTRACTOR_CHUNK
        ? `${chunk.text.slice(0, MAX_CHARS_PER_EXTRACTOR_CHUNK)}…`
        : chunk.text,
  }));
}

/**
 * Um bloco por campo, com os trechos daquele campo.
 *
 * O extrator normal recebe um monte de campos e um monte de trechos, e cabe a ele descobrir qual
 * trecho serve a qual campo. Aqui a associação já vem feita, porque a re-seleção usou os termos que
 * o próprio Avaliador escreveu. É a diferença entre "procure isto no documento" e "procure isto
 * aqui" — e é onde o segundo passe ganha do primeiro.
 */
function renderTarget(target: FocusedTarget, index: number): string {
  const lines = [
    `### Campo ${index + 1}: ${target.field.key}`,
    `Rótulo: ${target.field.label}`,
    `Tipo: ${target.field.type}`,
  ];

  if (target.field.description) lines.push(`O que é: ${target.field.description}`);
  if (target.field.aliases?.length) {
    lines.push(`Como pode estar escrito: ${target.field.aliases.slice(0, 10).join(', ')}`);
  }
  if (target.previousValue !== undefined && target.previousValue !== null) {
    lines.push(`Valor recusado na leitura anterior: ${JSON.stringify(target.previousValue)}`);
  }
  if (target.previousProblem) lines.push(`Problema apontado: ${target.previousProblem}`);
  if (target.hint) lines.push(`Onde procurar: ${target.hint}`);

  lines.push(
    '',
    'Trechos selecionados para este campo:',
    formatChunksForPrompt(limitChunks(target.chunks)),
  );

  return lines.join('\n');
}

export function buildFocusedExtractorPrompt(input: {
  selectedClass: DocumentClassRule;
  targets: FocusedTarget[];
  naming?: FocusedNamingTarget;
}): string {
  const namingBlock = input.naming?.keys.length
    ? `
Também refaça estes papéis de nomeação: ${input.naming.keys.join(', ')}.
${input.naming.hint ? `Onde procurar: ${input.naming.hint}` : ''}
- "tipo": o que o documento É, em uma a três palavras MAIÚSCULAS com espaço entre elas
  (ORDEM DE COMPRA, nunca ORDEMDECOMPRA). Nunca o nome da classe, nunca DOCUMENTO ou ARQUIVO.
- "sujeitos": uma ou duas entidades que distinguem ESTE documento de outro do mesmo tipo — as
  partes, o fornecedor, o paciente, a peça. Nomes próprios ou razão social, sem qualificação.
  Rótulo de papel ("CONTRATANTE", "RECEPTOR") não é sujeito.
- "dataReferencia": a data que identifica o documento, em yyyy-mm-dd, ou null.
`
    : '';

  return `Uma primeira leitura deste documento já foi feita e alguns campos não se sustentaram.
Sua tarefa é reprocurar SOMENTE os campos listados abaixo, um por vez, nos trechos que acompanham
cada um.

Como proceder em cada campo:
1. Leia os trechos daquele campo inteiros antes de concluir qualquer coisa. O texto pode vir de
   OCR, com caractere trocado, quebra de linha no meio da frase e ordem de leitura embaralhada.
2. Não procure só o rótulo esperado. O dado pode estar escrito de outra forma: data por extenso,
   valor que só existe somando âncora e prazo, nome no bloco de assinaturas em vez do preâmbulo.
3. Achou a passagem, preencha e cite-a em evidence.snippet. Não achou, o campo é null.

null continua sendo resposta correta. Esta é a segunda tentativa, e a pressão de encontrar algo é
exatamente o que produz valor inventado. Preencher com um valor plausível e não comprovado é pior
do que devolver vazio, porque alguém vai decidir com base nele.

Não invente campos fora da lista e não repita campos que não foram pedidos.
${normalizationContract()}
${namingBlock}
Classe documental: ${input.selectedClass.name}

Formato da resposta (apenas os campos pedidos, sem markdown):
{"metadata":{"exemplo_campo":{"label":"Rótulo","value":"o que está escrito","normalizedValue":"a forma padronizada","confidence":0.9,"source":"document_text","evidence":{"pageNumber":1,"snippet":"trecho literal que comprova"}}}${input.naming?.keys.length ? ',"naming":{"tipo":"NOTA FISCAL","sujeitos":["Fulano"],"dataReferencia":"2026-05-05"}' : ''}}

${input.targets.map(renderTarget).join('\n\n')}`;
}
