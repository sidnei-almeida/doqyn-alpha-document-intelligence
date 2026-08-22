import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import { MAX_CHARS_PER_EXTRACTOR_CHUNK, MAX_EXTRACTOR_FIELDS_IN_PROMPT } from '../constants.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import {
  augmentConfidentialityClassForExtraction,
  isConfidentialityClassRule,
} from './documentClassHeuristics.js';

export type CompactExtractorField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  aliases?: string[];
};

const PARTY_FIELD_KEYS = new Set(['parte_reveladora', 'parte_receptora']);
const VALIDITY_FIELD_KEYS = new Set([
  'data_assinatura',
  'data_emissao',
  'prazo_vigencia',
  'data_validade',
  'vigencia_inicio',
  'vigencia_fim',
]);

function limitExtractorChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    text:
      chunk.text.length > MAX_CHARS_PER_EXTRACTOR_CHUNK
        ? `${chunk.text.slice(0, MAX_CHARS_PER_EXTRACTOR_CHUNK)}…`
        : chunk.text,
  }));
}

function toCompactFields(selectedClass: DocumentClassRule): CompactExtractorField[] {
  const classForFields = augmentConfidentialityClassForExtraction(selectedClass);
  const sorted = [...classForFields.fields].sort((a, b) => {
    const partyBoost =
      Number(PARTY_FIELD_KEYS.has(b.key)) - Number(PARTY_FIELD_KEYS.has(a.key));
    if (partyBoost !== 0) return partyBoost;
    const validityBoost =
      Number(VALIDITY_FIELD_KEYS.has(b.key)) - Number(VALIDITY_FIELD_KEYS.has(a.key));
    if (validityBoost !== 0) return validityBoost;
    return Number(b.required) - Number(a.required);
  });

  return sorted.slice(0, MAX_EXTRACTOR_FIELDS_IN_PROMPT).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    description: field.description,
    aliases: field.aliases?.slice(0, 10),
  }));
}

/**
 * Contrato de normalização — genérico, vale para qualquer tipo documental.
 *
 * Medido em 2026-08-12 (`docs/ESTUDO-PROMPTS-EXTRACAO-2026-08-12.md`): de 12 campos avaliados, 10
 * acertavam sempre. Os dois que falhavam não falhavam por leitura — `data_assinatura` errou 30 de
 * 32 devolvendo "09 de junho de 2026" em vez de `2026-06-09` (o modelo achava a data certa e não a
 * padronizava), e `data_validade` faltou 16 de 16 por exigir aritmética que ninguém pedia.
 *
 * `applyFieldNormalization` (validation.ts) cobre currency, cpf e cnpj — e nada para data. Como o
 * schema já separa `value` (o que está escrito) de `normalizedValue` (a forma padronizada), o
 * caminho mais barato é o próprio modelo entregar as duas.
 */
function normalizationContract(): string {
  return `
PADRONIZAÇÃO — obrigatória para todo campo preenchido:
Cada campo tem dois lados. \`value\` é o que está literalmente escrito no documento. \`normalizedValue\`
é a forma padronizada, e é ela que o sistema usa para buscar, ordenar, comparar e alertar. Preencher
value e repetir o mesmo texto cru em normalizedValue desperdiça o campo.

Padronize \`normalizedValue\` conforme o \`type\` declarado do campo:
- type "date": sempre \`yyyy-mm-dd\`. "09 de junho de 2026" → "2026-06-09"; "15/01/2026" → "2026-01-15";
  "jan/2026" sem dia → "2026-01-01" e confidence mais baixa. Ano com 2 dígitos: resolva pelo século
  do documento. Nunca deixe data por extenso ou em dd/mm/aaaa no normalizedValue.
- type "currency" ou "number": só o número, ponto decimal, sem separador de milhar e sem símbolo.
  "R$ 27.500,00" → 27500.00. O símbolo/moeda fica no value.
- campos de CPF/CNPJ: só dígitos, sem ponto, barra ou hífen.
- type "string": colapse espaços e quebras de linha vindas do OCR, remova rótulo que não faz parte
  do dado ("CONTRATANTE:", "Nome:"), preserve a grafia própria de nomes e razões sociais.
- type "boolean": true ou false.

VALORES DERIVADOS:
Quando o documento traz uma data âncora e um prazo relativo em vez da data final, calcule.
Exemplo do padrão: âncora 2026-06-09 + "7 (sete) anos" → 2033-06-09. Vale para vigência, validade,
garantia, carência, renovação — qualquer par âncora+prazo. Registre no evidence.snippet que o valor
foi calculado e de quais trechos. Sem âncora explícita no texto, o campo é null: nunca use a data de
hoje, de upload ou de criação do arquivo como âncora.

ABSTENÇÃO:
null é resposta correta e frequente. Preencher um campo com valor plausível mas não comprovado é
pior do que deixá-lo vazio, porque alguém vai decidir com base nele. Se você precisa supor, inferir
de contexto ou juntar pedaços distantes sem ligação explícita, o campo é null.

CAMPOS PARECIDOS:
Um documento costuma conter vários valores do mesmo formato — várias datas, vários prazos, vários
nomes, vários valores. Formato igual não significa mesmo papel. Antes de preencher, confira que o
trecho encontrado desempenha exatamente o papel descrito em \`description\`. Proximidade no texto não
é evidência.`;
}

function confidentialityExtractionHints(): string {
  return `
DOCUMENTO DE CONFIDENCIALIDADE / NDA — instruções obrigatórias:
1. Sua prioridade máxima é identificar as PESSOAS ou EMPRESAS de cada parte.
2. Procure nomes no preâmbulo, qualificação das partes, cabeçalho e bloco de assinaturas.
3. Padrões comuns nos trechos:
   - "PARTE REVELADORA:" ou "REVELADOR:" seguido de nome/razão social
   - "PARTE RECEPTORA:" ou "RECEPTOR:" seguido de nome/razão social
   - "de um lado, [NOME COMPLETO ou RAZÃO SOCIAL], ... e de outro, [NOME COMPLETO ou RAZÃO SOCIAL]"
   - "CONTRATANTE:" / "CONTRATADA:" com nomes logo após os dois pontos
4. Use nomes próprios ou razão social (ex.: "Sidnei Almeida", "Paulão Comércio Ltda", "ACME S.A.").
5. NÃO preencha parte_reveladora nem parte_receptora com:
   - título do documento ("ACORDO DE CONFIDENCIALIDADE", "NDA", etc.)
   - cláusulas, objeto, vigência, foro, multa ou texto jurídico genérico
   - rótulos soltos ("RECEPTOR", "REVELADOR", "ao receptor", "no contexto de negociações")
6. Se não encontrar o nome de uma parte nos trechos, use null — não invente nem copie o título.
7. CPF/CNPJ servem só para confirmar a parte; o value deve ser o NOME, não o documento.
8. Havendo dúvida entre duas datas para a assinatura, prefira a de assinatura/celebração do
   instrumento à data de emissão de um anexo.
   (O restante do tratamento de datas, prazos e cálculo de validade está no contrato de padronização
   acima — vale para todo tipo documental, não só para este.)

Exemplo de metadados corretos para NDA:
{"parte_reveladora":{"value":"Paulão Comércio Ltda","normalizedValue":"Paulão Comércio Ltda","confidence":0.92,"evidence":{"snippet":"PARTE REVELADORA: Paulão Comércio Ltda"}},"parte_receptora":{"value":"Cliente Beta S.A.","normalizedValue":"Cliente Beta S.A.","confidence":0.9,"evidence":{"snippet":"PARTE RECEPTORA: Cliente Beta S.A."}},"data_assinatura":{"value":"2024-03-10","normalizedValue":"2024-03-10","confidence":0.9,"evidence":{"snippet":"assinado em 10 de março de 2024"}},"prazo_vigencia":{"value":"5 anos","normalizedValue":"5 anos","confidence":0.88,"evidence":{"snippet":"vigência de 5 anos"}},"data_validade":{"value":"2029-03-10","normalizedValue":"2029-03-10","confidence":0.86,"evidence":{"snippet":"Calculado: 2024-03-10 + 5 anos"}}}`;
}

/**
 * Tudo que não muda entre documentos vem antes dos trechos, de propósito: o cache de prompt da
 * Groq casa por prefixo e desconta 50% do que reaproveitar. Como instruções, campos da classe e
 * formato de resposta são idênticos para todo documento da mesma classe, deixá-los no início
 * transforma essa parte em prefixo cacheável; o texto do documento, que é sempre diferente,
 * fica no fim.
 */
export function buildCompactExtractorPrompt(
  chunks: RetrievedChunk[],
  selectedClass: DocumentClassRule,
): { prompt: string; compactChunks: RetrievedChunk[] } {
  const compactChunks = limitExtractorChunks(chunks);
  const fields = toCompactFields(selectedClass);
  const ndaHints = isConfidentialityClassRule(selectedClass) ? confidentialityExtractionHints() : '';

  const prompt = `Você extrai metadados estruturados de documentos para o DOQYN.

Tarefa: preencher os campos listados em "fields" usando SOMENTE os trechos fornecidos.

Trabalhe em duas etapas, nesta ordem:
ETAPA 1 — localizar. Para cada campo, encontre nos trechos a passagem literal que o comprova. Sem
passagem, o campo é null. O texto pode vir de OCR, com erro de caractere, quebra de linha no meio da
frase e ordem de leitura trocada — isso exige ler o trecho inteiro antes de concluir que a
informação não está lá, mas não autoriza adivinhar.
ETAPA 2 — preencher. Só então escreva o valor, derivado da passagem localizada. Todo value precisa
ser sustentado pelo seu snippet.

Regras gerais:
1. Extraia apenas os campos em fields — respeite key, label, type e aliases de cada um.
2. Leia description e aliases de cada campo para saber ONDE e O QUE buscar no texto.
3. Não invente valores. Se o dado não aparecer nos trechos, use null.
4. Para cada valor preenchido, inclua evidence.snippet com o trecho literal que comprova o dado.
5. missingFields = keys dos campos required que ficaram null.
6. requiresReview=true se faltar campo obrigatório ou se a confiança for baixa.
7. Responda APENAS com JSON válido, sem markdown.
${normalizationContract()}
${ndaHints}

Classe documental: ${selectedClass.name}
Descrição: ${selectedClass.description?.trim() || '—'}

fields (ordem de prioridade):
${JSON.stringify(fields, null, 2)}

Formato de resposta (repare em value × normalizedValue nos dois exemplos):
{"documentType":"string","version":"v1.0","metadata":{"data_exemplo":{"label":"Data de assinatura","value":"09 de junho de 2026","normalizedValue":"2026-06-09","confidence":0.93,"source":"document_text","evidence":{"pageNumber":1,"snippet":"Caxias do Sul/RS, 09 de junho de 2026"}},"valor_exemplo":{"label":"Valor mensal","value":"R$ 27.500,00","normalizedValue":27500.00,"confidence":0.95,"source":"document_text","evidence":{"pageNumber":1,"snippet":"VALOR MENSAL: R$ 27.500,00"}}},"missingFields":[],"requiresReview":false,"reviewReasons":[]}

Trechos do documento:
${formatChunksForPrompt(compactChunks)}`;

  return { prompt, compactChunks };
}
