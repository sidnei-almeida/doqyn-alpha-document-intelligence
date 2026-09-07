import type {
  DocumentClassRule,
  DocumentNamingRoles,
  ExtractedMetadataField,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import type { TriageFinding } from './extractionTriage.js';
import { classExtractionHints } from './extractorPrompt.js';
import { getExtractionMaxChunks } from './aiConfig.js';

/**
 * Quantos trechos o Avaliador lê, e por que isso acompanha o extrator.
 *
 * O Avaliador recebia a seleção inteira do extrator. Com `EXTRACTION_MAX_CHUNKS` no default de 40
 * isso são 72.000 caracteres, uns 18.400 tokens numa chamada só — num documento longo estourava
 * sozinho o orçamento do refino, e o passe focado nunca chegava a caber. O laço virava avaliação
 * sem ação.
 *
 * Um teto fixo consertava o custo e criava outro problema: o Avaliador julgando sobre menos texto
 * do que o extrator usou. Para CONFERIR o que foi afirmado bastam os trechos que carregam a
 * evidência citada, e a seleção abaixo garante que eles entrem. Mas para DESCOBRIR que faltou algo
 * ele precisa ver o que o extrator viu — senão declara ausência sobre um recorte mais estreito que
 * o da própria extração, que é exatamente o exagero que a prova de ausência veio corrigir.
 *
 * Por isso segue o extrator, com um teto próprio para o caso em que alguém configure um valor
 * enorme: 24 trechos são ~43.000 caracteres, ~11.000 tokens, o limite do que cabe no orçamento de
 * refino sem consumi-lo inteiro na primeira chamada.
 */
const HARD_CAP_CHUNKS_FOR_EVALUATOR = 24;

function maxChunksForEvaluator(): number {
  return Math.min(getExtractionMaxChunks(), HARD_CAP_CHUNKS_FOR_EVALUATOR);
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Os trechos que o juiz precisa ver, e só eles.
 *
 * Primeiro os que carregam alguma evidência citada: sem eles o Avaliador não consegue conferir o
 * que o extrator afirmou, e julgar sem poder conferir é adivinhar. Depois os mais bem pontuados,
 * até o teto — são os que o retriever considerou mais próximos dos campos da classe.
 */
export function selectEvaluatorChunks(input: {
  chunks: RetrievedChunk[];
  metadata: Record<string, ExtractedMetadataField>;
}): RetrievedChunk[] {
  const limit = maxChunksForEvaluator();
  if (input.chunks.length <= limit) return input.chunks;

  const snippets = Object.values(input.metadata)
    .map((field) => field.evidence?.snippet?.trim())
    .filter((snippet): snippet is string => Boolean(snippet && snippet.length >= 8))
    .map(normalizeForMatch);

  const carryingEvidence = new Set<string>();
  for (const chunk of input.chunks) {
    const haystack = normalizeForMatch(chunk.text);
    if (snippets.some((snippet) => haystack.includes(snippet))) {
      carryingEvidence.add(chunk.id);
    }
  }

  const withEvidence = input.chunks.filter((chunk) => carryingEvidence.has(chunk.id));
  const rest = input.chunks
    .filter((chunk) => !carryingEvidence.has(chunk.id))
    .sort((a, b) => b.score - a.score);

  return [...withEvidence, ...rest].slice(0, limit);
}

export type EvaluatorFieldBrief = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  aliases?: string[];
  /** O que a extração devolveu — null quando ficou vazio. */
  valorExtraido: string | number | null;
  trechoCitado: string | null;
  confianca: number | null;
  /** Sintomas que a triagem determinística apontou. */
  sintomas: string[];
  /**
   * Outros valores do mesmo formato presentes no documento. Presente só quando há disputa — e é
   * a informação que decide o caso: o modelo não precisa achar a data, precisa escolher entre as
   * quatro que já estão listadas.
   */
  outrosCandidatosNoDocumento?: string[];
};

function briefValue(extracted: ExtractedMetadataField | undefined): string | number | null {
  if (!extracted) return null;
  const value = extracted.normalizedValue ?? extracted.value;
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return value;
}

export function buildEvaluatorFieldBriefs(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
  findings: TriageFinding[];
}): EvaluatorFieldBrief[] {
  const byKey = new Map<string, string[]>();
  const candidatesByKey = new Map<string, string[]>();
  for (const finding of input.findings) {
    byKey.set(finding.key, [...(byKey.get(finding.key) ?? []), finding.detail]);
    if (finding.candidates?.length) candidatesByKey.set(finding.key, finding.candidates);
  }

  return input.selectedClass.fields
    .filter((field) => field.required || byKey.has(field.key))
    .map((field) => {
      const extracted = input.metadata[field.key];
      return {
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        description: field.description,
        aliases: field.aliases?.slice(0, 10),
        valorExtraido: briefValue(extracted),
        trechoCitado: extracted?.evidence?.snippet?.trim() || null,
        confianca: extracted?.confidence ?? null,
        sintomas: byKey.get(field.key) ?? [],
        ...(candidatesByKey.has(field.key)
          ? { outrosCandidatosNoDocumento: candidatesByKey.get(field.key) }
          : {}),
      };
    });
}

function namingBrief(input: {
  naming: DocumentNamingRoles | undefined;
  findings: TriageFinding[];
}): Record<string, unknown> {
  const sintomas = input.findings
    .filter((finding) => finding.key.startsWith('naming.'))
    .map((finding) => `${finding.key}: ${finding.detail}`);

  return {
    tipo: input.naming?.tipo ?? null,
    sujeitos: input.naming?.sujeitos ?? [],
    dataReferencia: input.naming?.dataReferencia ?? null,
    sintomas,
  };
}

/**
 * O prompt do juiz.
 *
 * Mesma disposição do extrator e pela mesma razão: instruções, contrato de resposta e campos vêm
 * antes dos trechos, porque o cache de prefixo da Groq desconta metade do que reaproveitar e essa
 * parte é idêntica para todo documento da mesma classe. O que muda a cada documento — o dossiê e o
 * texto — fica no fim.
 *
 * A pergunta central não é "isto está completo?". É "o campo vazio está vazio porque o dado não
 * existe no documento, ou porque a leitura falhou?". A primeira encerra o assunto; a segunda
 * justifica gastar mais uma chamada. Confundir as duas custa caro nos dois sentidos: aceitar
 * ausência falsa manda documento bom para revisão manual, e insistir em ausência verdadeira queima
 * o orçamento contra uma folha que realmente não tem a informação.
 */
export function buildEvaluatorPrompt(input: {
  selectedClass: DocumentClassRule;
  fields: EvaluatorFieldBrief[];
  naming: DocumentNamingRoles | undefined;
  findings: TriageFinding[];
  chunks: RetrievedChunk[];
}): string {
  // As mesmas dicas que o extrator recebe. Ele erra com elas na mão; o Avaliador precisa das
  // mesmas para saber o que conferir, e duplicá-las aqui garantiria que as duas cópias
  // divergissem na primeira correção.
  const hints = classExtractionHints(input.selectedClass);

  return `Você audita a extração de metadados de um documento no DOQYN.

Outro agente já leu o documento e preencheu os campos abaixo. Seu trabalho não é extrair de novo:
é decidir, campo a campo, se o resultado dele se sustenta nos trechos, e o que fazer quando não se
sustenta.

A pergunta que importa em campo vazio:
O dado NÃO EXISTE no documento, ou EXISTE e a leitura falhou? São respostas diferentes e levam a
caminhos diferentes. Documento pode legitimamente não trazer a informação — recibo sem nota fiscal,
minuta sem data de assinatura, folha de rosto sem conteúdo. Nesse caso o vazio está certo e o
assunto se encerra. Mas o dado também pode estar no texto escrito de forma que a primeira leitura
não reconheceu: data por extenso, valor calculado a partir de âncora e prazo, nome no bloco de
assinaturas em vez do preâmbulo, rótulo em outro idioma. Nesse caso vale procurar de novo.
Antes de dizer que não existe, releia os trechos inteiros procurando a informação SEM depender do
rótulo esperado.

Veredito por campo, escolha exatamente um:
- "ok" — o valor se sustenta no trecho citado e desempenha o papel que a description pede.
- "ausente_de_fato" — releu e o documento realmente não traz esse dado. Encerra a busca.
- "buscar_de_novo" — o dado provavelmente está no documento e a leitura falhou. Escreva em "hint"
  o que procurar e em "where" as palavras ou expressões que devem aparecer perto do dado.
- "valor_errado" — está preenchido, mas com o valor de outro papel. É o caso do campo que pede
  quem prestou o serviço e recebeu o nome do banco que só cobra, ou da data de emissão que pegou
  o vencimento. Escreva em "hint" como distinguir o valor certo do que foi pego.

Regras:
1. Formato igual não é papel igual, e é aqui que a auditoria ganha o dia. Quando um campo traz
   "outrosCandidatosNoDocumento", o documento tem mais de um valor daquele formato e o extrator
   escolheu um deles. Não confirme a escolha por ela ser plausível: percorra a lista e diga qual
   candidato desempenha o papel que a description pede. Selo de cartório, carimbo de tempo de
   assinatura digital, data de impressão, data de processamento no banco e data de saída da
   mercadoria são datas reais e quase nunca são a data que o campo pede.
   **A lista traz apenas os valores escritos em algarismos.** Data por extenso — "aos treze dias do
   mês de abril do ano de dois mil e vinte e seis" — não aparece nela, e em documento notarial ou
   contratual costuma ser justamente a data que vale. Se nenhum candidato da lista faz o papel
   pedido, procure a data por extenso no texto antes de concluir qualquer coisa: a resposta certa
   pode estar fora da lista.
2. Valor que existe no documento não é prova de que o campo deve ser preenchido. Um recibo avulso
   pode trazer numeração de talão impressa sem ser nota fiscal; uma folha pode trazer protocolo de
   outro processo. Quando o dado que o campo pede não existe, o veredito é "ausente_de_fato" mesmo
   havendo um número plausível na página — e o valor atual deve sair.
3. Trecho citado que você não encontra no texto é invenção — o campo é "valor_errado" ou
   "buscar_de_novo", nunca "ok".
4. Campo não obrigatório vazio não precisa de veredito de busca: marque "ausente_de_fato".
5. "complete" é true apenas se nenhum campo obrigatório ficou em "buscar_de_novo" ou "valor_errado".
6. Julgue também os papéis de nomeação em "naming": "tipo" é o que o documento É (uma a três
   palavras, MAIÚSCULAS, com espaço), "sujeitos" são uma ou duas entidades que o distinguem de
   outro do mesmo tipo, "dataReferencia" é a data que o identifica em yyyy-mm-dd. Use as mesmas
   quatro decisões, com as chaves "naming.tipo", "naming.sujeitos" e "naming.dataReferencia".
7. Responda APENAS com JSON válido, sem markdown.

Formato da resposta:
{"complete":false,"fields":[{"key":"fornecedor","verdict":"valor_errado","reason":"pegou o banco emissor do boleto, que só transporta o pagamento","hint":"procure o BENEFICIÁRIO ou CEDENTE, não o nome no topo","where":["beneficiário","cedente"]},{"key":"numero_nota","verdict":"ausente_de_fato","reason":"recibo avulso sem numeração fiscal"},{"key":"data_emissao","verdict":"ok"},{"key":"naming.sujeitos","verdict":"buscar_de_novo","reason":"o bloco de assinaturas traz dois nomes que não foram lidos","hint":"leia o fecho do documento","where":["outorgado","assinatura"]}]}

${hints}
Classe documental: ${input.selectedClass.name}
Descrição: ${input.selectedClass.description?.trim() || '—'}

Campos auditados (valorExtraido null significa que ficou vazio; sintomas vêm de conferência automática):
${JSON.stringify(input.fields, null, 2)}

Papéis de nomeação:
${JSON.stringify(namingBrief({ naming: input.naming, findings: input.findings }), null, 2)}

Trechos do documento:
${formatChunksForPrompt(input.chunks)}`;
}
