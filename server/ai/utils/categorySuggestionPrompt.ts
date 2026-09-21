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
 *
 * O prompt pede a **família**, não o tipo. Deixado solto, o modelo devolve o nome do documento que
 * acabou de ler — um NDA virava "Acordos de Confidencialidade", um TCC virava "Trabalhos de
 * Conclusão de Curso" —, e cada documento novo inaugurava a própria pasta. O arquivo que sai disso
 * tem quarenta pastas com um documento cada, que é o mesmo que não ter arquivo nenhum. O nome
 * dessa pasta é lido por todo classificador seguinte, então ele precisa caber os vizinhos do
 * documento, não só ele.
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
1. "name" — o nome da FAMÍLIA de documentos, não o nome deste documento. Uma a três palavras, em
   ${outputLanguage}, do jeito que uma pessoa nomearia uma pasta do arquivo.

   Calibre pela pergunta: quantos tipos diferentes de documento caberiam nesta pasta?

   - Cabem menos de três tipos → específico demais, suba um nível. Uma pasta por tipo de
     documento não é arquivo, é lista de arquivos, e no mês seguinte a empresa tem quarenta
     pastas com um documento cada.
       NDA, termo de sigilo, prestação de serviços, aditivo → "Contratos"
         (NÃO "Acordos de Confidencialidade")
       boleto, fatura, recibo, nota fiscal → "Financeiro"
         (NÃO "Boletos Bancários")
       TCC, dissertação, tese, artigo → "Acadêmicos"
         (NÃO "Trabalhos de Conclusão de Curso")
       atestado, exame, laudo, ASO → "Saúde Ocupacional"
         (NÃO "Atestados Médicos")
       currículo, carta de referência, avaliação → "Recrutamento"
         (NÃO "Currículos de Candidatos")
   - Caberia qualquer documento da empresa → genérico demais, desça um nível. Palavra vazia como
     "Documentos", "Arquivos", "Outros", "Diversos" ou "Geral" não separa nada de nada.

   Substantivo de documento fica no plural ("Contratos", "Recibos"); nome de área fica no
   singular ("Financeiro", "Jurídico"). Não use o nome da empresa nem o de quem assina: a pasta
   vai receber outros documentos, de outras pessoas.
2. "description" — uma frase dizendo o que mora nesta pasta. É o que o classificador vai ler para
   decidir o próximo documento, então descreva a FAMÍLIA e cite os tipos que ela abriga, não este
   exemplar.
3. "keywords" — até 8 termos que aparecem em documentos desta família. Minúsculas, sem repetir o
   nome. Cubra a família inteira, não só este documento.
4. "reason" — uma frase para quem revisa, dizendo por que nenhuma pasta existente servia.
5. Documento ilegível, sem conteúdo aproveitável, ou que na verdade cabia numa pasta existente:
   devolva {"name": null}. Pasta errada fica para sempre; pasta faltando alguém cria depois.
6. Responda APENAS com JSON válido, sem markdown.

Formato de resposta:
{"name":"Financeiro","description":"Documentos de cobrança e pagamento: boletos, faturas, recibos, notas fiscais e comprovantes de transferência.","keywords":["boleto","fatura","recibo","nota fiscal","vencimento","valor total","comprovante","pagamento"],"reason":"As pastas existentes tratam de contratos e documentos societários; nenhuma cobre cobrança e pagamento."}

Trechos do documento:
${formatChunksForPrompt(input.chunks)}`;
}
