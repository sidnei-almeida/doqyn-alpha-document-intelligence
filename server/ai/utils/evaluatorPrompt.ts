import type {
  DocumentClassRule,
  DocumentNamingRoles,
  ExtractedMetadataField,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import type { TriageFinding } from './extractionTriage.js';

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
  for (const finding of input.findings) {
    byKey.set(finding.key, [...(byKey.get(finding.key) ?? []), finding.detail]);
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
1. Formato igual não é papel igual. Um documento tem várias datas, vários nomes, vários números.
   Confira que o trecho encontrado desempenha o papel da description, não que ele se pareça.
2. Trecho citado que você não encontra no texto é invenção — o campo é "valor_errado" ou
   "buscar_de_novo", nunca "ok".
3. Campo não obrigatório vazio não precisa de veredito de busca: marque "ausente_de_fato".
4. "complete" é true apenas se nenhum campo obrigatório ficou em "buscar_de_novo" ou "valor_errado".
5. Julgue também os papéis de nomeação em "naming": "tipo" é o que o documento É (uma a três
   palavras, MAIÚSCULAS, com espaço), "sujeitos" são uma ou duas entidades que o distinguem de
   outro do mesmo tipo, "dataReferencia" é a data que o identifica em yyyy-mm-dd. Use as mesmas
   quatro decisões, com as chaves "naming.tipo", "naming.sujeitos" e "naming.dataReferencia".
6. Responda APENAS com JSON válido, sem markdown.

Formato da resposta:
{"complete":false,"fields":[{"key":"fornecedor","verdict":"valor_errado","reason":"pegou o banco emissor do boleto, que só transporta o pagamento","hint":"procure o BENEFICIÁRIO ou CEDENTE, não o nome no topo","where":["beneficiário","cedente"]},{"key":"numero_nota","verdict":"ausente_de_fato","reason":"recibo avulso sem numeração fiscal"},{"key":"data_emissao","verdict":"ok"},{"key":"naming.sujeitos","verdict":"buscar_de_novo","reason":"o bloco de assinaturas traz dois nomes que não foram lidos","hint":"leia o fecho do documento","where":["outorgado","assinatura"]}]}

Classe documental: ${input.selectedClass.name}
Descrição: ${input.selectedClass.description?.trim() || '—'}

Campos auditados (valorExtraido null significa que ficou vazio; sintomas vêm de conferência automática):
${JSON.stringify(input.fields, null, 2)}

Papéis de nomeação:
${JSON.stringify(namingBrief({ naming: input.naming, findings: input.findings }), null, 2)}

Trechos do documento:
${formatChunksForPrompt(input.chunks)}`;
}
