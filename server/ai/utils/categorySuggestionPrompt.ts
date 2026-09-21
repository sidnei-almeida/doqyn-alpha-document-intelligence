import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import { languageNameForPrompt } from './detectDocumentLanguage.js';

/**
 * Pede ao modelo a pasta que falta.
 *
 * Os dois passes anteriores perguntam "qual destas pastas serve?". Quando os dois recusam, a
 * resposta honesta do produto não é "sem categoria" — é dizer qual pasta deveria existir. O modelo
 * já leu o documento inteiro e já declarou o tipo (`documentType`); o que falta é transformar isso
 * em algo que a governança consiga usar: um nome de pasta, uma descrição que o classificador vai
 * ler no próximo documento, e os termos que identificam o tipo.
 *
 * As classes existentes entram no prompt para ele NÃO propor duplicata. Sem essa lista, o modelo
 * propõe "Contratos" para um tenant que já tem "Contratos" — e a criação seria recusada pelo slug
 * duplicado, depois de uma chamada paga.
 */
export function buildCategorySuggestionPrompt(input: {
  chunks: RetrievedChunk[];
  classes: DocumentClassRule[];
  /** O que o primeiro classificador disse que o documento é, antes de não achar pasta. */
  documentType?: string | null;
  /** Por que a classificação recusou — o modelo precisa saber o que já foi descartado. */
  firstReason: string;
  /** Idioma de quem vai ler a pasta na tela. O nome da categoria sai nele. */
  outputLocale?: string;
}): string {
  const existing = input.classes.map((entry) => ({
    nome: entry.name,
    descricao: entry.description,
  }));

  const outputLanguage = languageNameForPrompt(input.outputLocale);

  const declaredType = input.documentType?.trim()
    ? `\nO classificador leu este documento e disse que ele é: "${input.documentType.trim()}".\n` +
      'Use isso. Ele leu o documento inteiro; você está vendo só os trechos selecionados.\n'
    : '';

  const existingBlock =
    existing.length > 0
      ? `Pastas que JÁ existem nesta empresa — nenhuma serviu:\n${JSON.stringify(existing, null, 2)}\n\n` +
        'Não proponha nenhuma delas de novo, nem sinônimo delas ("Contrato" para quem já tem\n' +
        '"Contratos", "Fiscal" para quem já tem "Documentos Fiscais"). Se alguma delas na verdade\n' +
        'servia, devolva `name: null` — dizer que servia é melhor que criar a décima pasta parecida.'
      : 'Esta empresa ainda não tem nenhuma pasta configurada. Esta será a primeira.';

  return `Você organiza o arquivo documental de uma empresa no DOQYN.

Nenhuma pasta configurada serviu para o documento abaixo. Motivo da recusa: "${input.firstReason}".
${declaredType}
Sua tarefa: propor a pasta que está faltando.

${existingBlock}

Regras da proposta:
1. "name" — uma a três palavras, em ${outputLanguage}, do jeito que uma pessoa nomearia a pasta:
   "Boletos", "Atestados Médicos", "Notas Fiscais", "Procurações", "Currículos".
   Prefira o plural, porque é uma pasta e não um documento. Nunca use palavra vazia como
   "Documentos", "Arquivos", "Outros", "Diversos" ou "Geral" — elas não separam nada de nada.
   Não use o nome da empresa nem o nome de quem assina: a pasta vai receber outros documentos.
2. "description" — uma frase dizendo o que mora nesta pasta. É o que o classificador vai ler para
   decidir o próximo documento, então descreva o TIPO, não este exemplar.
3. "keywords" — até 8 termos que aparecem em documentos deste tipo. Minúsculas, sem repetir o nome.
4. "reason" — uma frase para quem revisa, dizendo por que nenhuma pasta existente servia.
5. Documento ilegível, sem conteúdo aproveitável, ou que na verdade cabia numa pasta existente:
   devolva {"name": null}. Pasta errada fica para sempre; pasta faltando alguém cria depois.
6. Responda APENAS com JSON válido, sem markdown.

Formato de resposta:
{"name":"Boletos","description":"Boletos bancários e faturas de cobrança com código de barras, linha digitável e data de vencimento.","keywords":["boleto","código de barras","linha digitável","cedente","sacado","vencimento","nosso número"],"reason":"As pastas existentes tratam de contratos e documentos societários; nenhuma cobre cobrança bancária."}

Trechos do documento:
${formatChunksForPrompt(input.chunks)}`;
}
