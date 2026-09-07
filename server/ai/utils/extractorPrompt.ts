import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import { MAX_CHARS_PER_EXTRACTOR_CHUNK, MAX_EXTRACTOR_FIELDS_IN_PROMPT } from '../constants.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import {
  augmentConfidentialityClassForExtraction,
  hasFinancialRoleFields,
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
    const partyBoost = Number(PARTY_FIELD_KEYS.has(b.key)) - Number(PARTY_FIELD_KEYS.has(a.key));
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
export function normalizationContract(): string {
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

VALORES DERIVADOS — o campo mais esquecido, e o que mais dá trabalho depois:
Data final quase nunca está escrita. O que o documento traz é uma data âncora e um prazo, em
lugares diferentes, e cabe a você juntar os dois. Não desista de um campo de vencimento, validade
ou término só porque não achou uma data escrita para ele.

Procure em duas etapas:
1. A âncora — a data que identifica o documento: assinatura, celebração, emissão, referência,
   lavratura, início de vigência.
2. O prazo — em qualquer lugar do texto, inclusive no meio de uma cláusula que trata de outro
   assunto. "Pelo prazo de 3 (três) anos", "vigorará por 5 anos", "válido por 90 dias", "garantia
   de 24 meses". O prazo raramente está perto do rótulo do campo.

Some os dois e escreva a data final em yyyy-mm-dd. Exemplo: âncora 2026-06-09 + "3 (três) anos" →
2029-06-09. Registre no evidence.snippet os DOIS trechos que sustentam a conta — o da âncora e o do
prazo.

Cuidado com o prazo errado: um documento traz vários. Pagamento em 30 dias, aviso prévio de 60,
entrega em 15 — nenhum desses governa a validade do documento. Use o prazo ligado a vigência,
validade, confidencialidade, garantia ou ao objeto principal.

Quando mais de um prazo parecer governar, vale o da obrigação central DESTE documento — a que dá
nome ao que ele é, não a de uma cláusula acessória. Num acordo de confidencialidade é o prazo de
sigilo, e não o de não aliciamento ou não concorrência, que são obrigações dentro dele. Num termo
de garantia é o prazo de garantia; numa apólice, o da cobertura; num contrato de prestação, o da
vigência. Leia o documento antes de escolher: o mesmo raciocínio dá respostas diferentes conforme
o que ele é. Havendo dois prazos igualmente centrais, deixe o campo null e explique em
reviewReasons: é melhor que alguém decida do que escolher no par ou ímpar.

Sem âncora explícita no texto, o campo é null. Nunca use a data de hoje, de upload ou de criação do
arquivo como âncora.

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

/**
 * Documento financeiro — quem paga, quem recebe e quem só intermedeia.
 *
 * Metade das falhas de extração medidas no conjunto de teste está aqui, e todas
 * do mesmo feitio: o modelo pega a razão social mais destacada da página. Num
 * boleto isso é o banco, que está no topo em caixa alta e não prestou serviço
 * nenhum; num recibo é o pagador, que aparece primeiro na frase. Não é falta de
 * leitura, é falta de dizer qual papel o campo pede.
 */
function financialExtractionHints(): string {
  return `
DOCUMENTO FINANCEIRO — quem é quem:
1. \`fornecedor\` é quem ENTREGOU o produto ou o serviço e tem a receber. Nunca é o banco, a
   operadora de cartão ou a plataforma de cobrança: essas só transportam o dinheiro.
   - Em boleto: o BENEFICIÁRIO / CEDENTE. O nome no alto do boleto é o banco emissor — ignore-o.
   - Em nota fiscal / DANFE: o EMITENTE. O DESTINATÁRIO é quem compra, e costuma estar em caixa
     maior — tamanho não indica papel.
   - Em recibo: quem ASSINA o recibo e dá quitação. Quem aparece depois de "Recebi de" é o pagador,
     e é o oposto do que este campo pede.
   - Em fatura: o emissor da fatura, não o sacado nem o tomador.
2. \`numero_nota\` é o número do próprio documento fiscal. Não confunda com:
   - chave de acesso da NF-e (44 dígitos), "nosso número" ou linha digitável do boleto;
   - número do pedido de compra, do contrato, do processo ou do talão impresso no bloco.
   Recibo avulso e comprovante sem numeração fiscal: o campo é null, mesmo havendo um número
   impresso na folha.
3. \`data_emissao\` é quando o documento foi emitido — não o vencimento, não a data de saída da
   mercadoria, não a data de processamento no banco, não a competência do serviço.`;
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
 * As dicas que valem para esta classe, concatenadas.
 *
 * Exportado porque o Avaliador precisa exatamente das mesmas: ele audita um extrator que já teve
 * essas instruções na mão e errou mesmo assim, então conferir sem elas seria conferir contra um
 * critério mais frouxo que o da própria tarefa.
 */
export function classExtractionHints(selectedClass: DocumentClassRule): string {
  const nda = isConfidentialityClassRule(selectedClass) ? confidentialityExtractionHints() : '';
  const financial = hasFinancialRoleFields(selectedClass) ? financialExtractionHints() : '';
  return `${nda}${financial}`;
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
  const ndaHints = isConfidentialityClassRule(selectedClass)
    ? confidentialityExtractionHints()
    : '';
  // As dicas financeiras seguem os campos, não o nome da pasta: o tenant pode
  // chamá-la de "Fiscal", "Contas a pagar" ou "Documentos Financeiros", e o que
  // identifica o caso é o campo `numero_nota` ao lado de `fornecedor`.
  const financialHints = hasFinancialRoleFields(selectedClass) ? financialExtractionHints() : '';

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

Além dos campos, preencha "naming" com o que VOCÊ entendeu do documento — não se limite à
classe informada, que é apenas a pasta onde ele será arquivado:
- naming.tipo: o que o documento É, em uma a três palavras, em MAIÚSCULAS, com espaço entre elas.
  Use o termo que a pessoa usaria ao procurá-lo: NDA, RECEITA, NOTA FISCAL, ORDEM DE COMPRA,
  REEMBOLSO, DESENHO TECNICO, LAUDO, CURRICULO, PROPOSTA, PROCURACAO, ATESTADO MEDICO.
  Escreva "ORDEM DE COMPRA", nunca "ORDEMDECOMPRA": palavra colada vira nome de arquivo ilegível.
  Nunca use o nome da classe nem palavras vazias como DOCUMENTO ou ARQUIVO.
- naming.sujeitos: uma ou duas entidades que distinguem ESTE documento de outro do mesmo tipo —
  as partes de um contrato, o paciente e quem prescreve numa receita, o fornecedor de uma nota,
  a peça de um desenho. Nomes próprios ou razão social, sem qualificação nem documento fiscal.
- naming.dataReferencia: a data que identifica o documento (assinatura, emissão, validade ou
  revisão), em yyyy-mm-dd. Use null se o documento não trouxer data.
${normalizationContract()}
${ndaHints}${financialHints}

Classe documental: ${selectedClass.name}
Descrição: ${selectedClass.description?.trim() || '—'}

fields (ordem de prioridade):
${JSON.stringify(fields, null, 2)}

Formato de resposta (repare em value × normalizedValue nos dois exemplos):
{"documentType":"string","version":"v1.0","naming":{"tipo":"NDA","sujeitos":["Cristiano Baldissera","Sidnei Almeida"],"dataReferencia":"2026-06-09"},"metadata":{"data_exemplo":{"label":"Data de assinatura","value":"09 de junho de 2026","normalizedValue":"2026-06-09","confidence":0.93,"source":"document_text","evidence":{"pageNumber":1,"snippet":"Caxias do Sul/RS, 09 de junho de 2026"}},"valor_exemplo":{"label":"Valor mensal","value":"R$ 27.500,00","normalizedValue":27500.00,"confidence":0.95,"source":"document_text","evidence":{"pageNumber":1,"snippet":"VALOR MENSAL: R$ 27.500,00"}}},"missingFields":[],"requiresReview":false,"reviewReasons":[]}

Trechos do documento:
${formatChunksForPrompt(compactChunks)}`;

  return { prompt, compactChunks };
}
