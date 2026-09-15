import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import {
  MAX_CHARS_PER_CLASSIFIER_CHUNK,
  MAX_CLASSIFIER_CHUNKS,
  MAX_NEGATIVE_KEYWORDS_PER_CLASS,
  MAX_POSITIVE_KEYWORDS_PER_CLASS,
} from '../constants.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import {
  isForeignDocumentLanguage,
  languageNameForPrompt,
  type DocumentLanguage,
} from './detectDocumentLanguage.js';

export type CompactDocumentClassForClassifier = {
  classId: string;
  className: string;
  description: string;
  keywords: string[];
  negativeKeywords: string[];
};

function truncateDescription(description: string, maxLength = 220): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function limitKeywords(keywords: string[], max: number): string[] {
  return keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function toCompactDocumentClass(
  docClass: DocumentClassRule,
): CompactDocumentClassForClassifier {
  return {
    classId: docClass.id,
    className: docClass.name,
    description: truncateDescription(docClass.description),
    keywords: limitKeywords(docClass.keywords, MAX_POSITIVE_KEYWORDS_PER_CLASS),
    negativeKeywords: limitKeywords(
      docClass.negativeKeywords ?? [],
      MAX_NEGATIVE_KEYWORDS_PER_CLASS,
    ),
  };
}

export function toCompactDocumentClasses(
  classes: DocumentClassRule[],
): CompactDocumentClassForClassifier[] {
  return classes.map(toCompactDocumentClass);
}

export function limitClassifierChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.slice(0, MAX_CLASSIFIER_CHUNKS).map((chunk) => ({
    ...chunk,
    text:
      chunk.text.length > MAX_CHARS_PER_CLASSIFIER_CHUNK
        ? `${chunk.text.slice(0, MAX_CHARS_PER_CLASSIFIER_CHUNK)}…`
        : chunk.text,
  }));
}

/** Estimativa do prompt legado (com fields) — apenas para métricas de otimização. */
export function estimateLegacyClassifierPromptChars(
  chunks: RetrievedChunk[],
  classes: DocumentClassRule[],
): number {
  const legacyClassesJson = JSON.stringify(
    classes.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      keywords: c.keywords,
      negativeKeywords: c.negativeKeywords ?? [],
      expectedFields: c.fields.map((f) => f.key),
    })),
  );
  const base = 900 + legacyClassesJson.length + formatChunksForPrompt(chunks).length;
  return base;
}

export function buildCompactClassifierPrompt(
  chunks: RetrievedChunk[],
  classes: DocumentClassRule[],
  options: { documentLanguage?: DocumentLanguage } = {},
): {
  prompt: string;
  compactChunks: RetrievedChunk[];
  compactClasses: CompactDocumentClassForClassifier[];
} {
  const compactClasses = toCompactDocumentClasses(classes);
  const compactChunks = limitClassifierChunks(chunks);
  const classesJson = JSON.stringify(compactClasses);
  /**
   * Classe e documento em idiomas diferentes. As classes são dado do tenant, escritas na língua de
   * quem as criou; o documento chega na língua de quem o redigiu. Sem esta linha o modelo tende a
   * ler a diferença de idioma como falta de correspondência. Documento em português não recebe a
   * linha, e o prompt dele fica idêntico ao medido.
   */
  const languageRule = isForeignDocumentLanguage(options.documentLanguage)
    ? `\n- O documento está em ${languageNameForPrompt(options.documentLanguage)}, e as classes foram escritas pelo tenant, possivelmente em outro idioma. Idioma diferente não é sinal de que a classe não serve: decida pelo que o documento É.`
    : '';

  const prompt = `Classifique o documento usando apenas as classes abaixo.

Responda em duas etapas, nesta ordem — a ordem importa:

ETAPA 1 — diga o que o documento É, em "tipoDocumental": uma a três palavras em MAIÚSCULAS, o
termo que a pessoa usaria ao procurá-lo (NDA, PROCURACAO, ATESTADO MEDICO, NOTA FISCAL, ORDEM DE
COMPRA, LAUDO, RECIBO, ATA). Isto vem antes da pasta de propósito: decidir onde arquivar sem ter
decidido o que é leva a escolher pela semelhança superficial. Nunca escreva DOCUMENTO ou ARQUIVO, e
nunca repita o nome de uma classe.

ETAPA 2 — só então escolha a pasta onde esse tipo mora.

Regras:
- Use somente classId da lista.
- Decida pela NATUREZA do instrumento — o que ele É —, não pelos assuntos que ele cita de passagem.
  Um relatório que fala sobre contratos não é um contrato; um e-mail que anexa uma nota fiscal não é
  uma nota fiscal. Procure o que o documento faz: quem se obriga a quê, perante quem.
- A MAIS ESPECÍFICA VENCE. Muito documento cabe em duas pastas porque uma delas é ampla: um NDA é um
  contrato, uma procuração cria obrigações, um atestado é um documento de pessoal. Quando duas
  classes servem e uma descreve o documento mais de perto, escolha a específica — a ampla é o
  destino de quem não achou melhor lugar, não a resposta certa por ser sempre defensável.
- Descrição de pasta é exemplo do que costuma morar lá, não lista fechada do que pode. Um atestado
  médico mora em Recursos Humanos mesmo que a descrição fale em admissão e folha e não cite
  atestado. Recusar por falta de menção literal joga o documento na revisão manual por tecnicismo.
- keywords e negativeKeywords são pistas configuradas pelo tenant, não gatilhos: a presença de uma
  palavra-chave não classifica sozinha, e a ausência não desclassifica.
- Em "alternativa", nomeie a segunda classe mais plausível e diga em "porQueNao" o que no documento
  a descarta. Se você não consegue apontar o que separa as duas, elas não estão separadas: baixe a
  confiança para 0.6 ou menos e marque requiresReview=true. Não havendo segunda opção plausível,
  alternativa=null.
- Se o documento não pertencer a nenhuma classe, classId=null com requiresReview=true. É resposta
  correta e esperada, preferível a forçar a classe menos errada. Mas "não cabe em nenhuma" é
  diferente de "a descrição não cita este tipo" — veja a regra da descrição acima.
- Em evidence, cite os trechos que revelam a natureza do documento, não os que apenas repetem uma
  palavra-chave.
- Responda apenas JSON válido.${languageRule}

Classes:
${classesJson}

Formato:
{"tipoDocumental":"NDA","classId":"id_ou_null","className":"nome_ou_null","confidence":0.0,"requiresReview":false,"reason":"curta","alternativa":{"classId":"id","porQueNao":"o que no documento descarta esta"},"evidence":[{"pageNumber":1,"snippet":"trecho"}]}

Trechos:
${formatChunksForPrompt(compactChunks)}`;

  return { prompt, compactChunks, compactClasses };
}
