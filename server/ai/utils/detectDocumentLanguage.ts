/**
 * Em que idioma o documento está escrito — decisão de roteamento, não de conteúdo.
 *
 * Sem chamada de modelo de propósito: roda antes da classificação, em todo documento, e precisa ser
 * barata e sempre igual para o mesmo texto. Um detector que responde diferente a cada execução
 * trocaria o prompt entre duas análises do mesmo arquivo, e a variação apareceria como instabilidade
 * do classificador — que já é instável na margem por conta própria.
 *
 * O método é contagem de palavras funcionais: artigos, preposições e conjunções que cada idioma usa
 * o tempo todo e os outros dois quase nunca. Português e espanhol dividem muita coisa ("de", "que",
 * "para", "por"), então essas ficam de fora — só entra o que separa. Os sinais gráficos ajudam onde
 * a palavra não ajuda: `ã`, `õ` e `ç` são português; `ñ`, `¿` e `¡` são espanhol.
 *
 * Na dúvida responde `und`. Quem usa trata `und` como "não sei" e mantém o comportamento de sempre —
 * chutar um idioma mudaria o prompt de um documento português por engano, e português é o idioma que
 * não pode regredir.
 */

export type DocumentLanguage = 'pt' | 'en' | 'es' | 'und';

/** O que viaja no contexto da análise para os prompts saberem com que idiomas lidam. */
export type DocumentLanguageContext = {
  documentLanguage?: DocumentLanguage;
  /** Idioma de quem enviou o arquivo: resumo e tipo do nome sugerido saem nele. */
  outputLocale?: string;
};

/** Nome do idioma como o prompt, escrito em português, o menciona. Desconhecido é português. */
export function languageNameForPrompt(value: string | undefined): string {
  const primary = value?.split('-')[0]?.toLowerCase();
  if (primary === 'en') return 'inglês';
  if (primary === 'es') return 'espanhol';
  return 'português';
}

/** Só inglês e espanhol mudam prompt: português e `und` seguem o caminho medido de sempre. */
export function isForeignDocumentLanguage(language: DocumentLanguage | undefined): boolean {
  return language === 'en' || language === 'es';
}

/** Quanto do começo do documento basta. Idioma não muda na página 30. */
const SAMPLE_CHARS = 4000;
/** Abaixo disso a contagem é ruído: um atestado de cinco linhas não diz nada confiável. */
const MIN_WORDS = 25;
/** Fração mínima de palavras funcionais do idioma vencedor. */
const MIN_SCORE = 0.06;
/** O vencedor precisa vencer com folga — bilíngue ou texto técnico empata, e empate é `und`. */
const MIN_LEAD = 1.6;

const FUNCTION_WORDS: Record<Exclude<DocumentLanguage, 'und'>, ReadonlySet<string>> = {
  pt: new Set([
    'do',
    'da',
    'dos',
    'das',
    'ao',
    'aos',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'um',
    'uma',
    'uns',
    'umas',
    'com',
    'nao',
    'pelo',
    'pela',
    'pelos',
    'pelas',
    'seu',
    'sua',
    'seus',
    'suas',
    'ele',
    'ela',
    'eles',
    'elas',
    'isso',
    'este',
    'esta',
    'estes',
    'estas',
    'sao',
    'foi',
    'ser',
    'ate',
    'apos',
    'tambem',
    'entao',
    'mediante',
    'qualquer',
    'demais',
    'bem',
    'onde',
    'quando',
  ]),
  es: new Set([
    'el',
    'los',
    'las',
    'del',
    'al',
    'en',
    'con',
    'una',
    'unos',
    'unas',
    'y',
    'lo',
    'su',
    'sus',
    'es',
    'son',
    'fue',
    'ser',
    'pero',
    'hasta',
    'despues',
    'tambien',
    'entonces',
    'cualquier',
    'dicho',
    'dicha',
    'dichos',
    'dichas',
    'mismo',
    'misma',
    'cual',
    'cuales',
    'donde',
    'cuando',
    'usted',
    'ustedes',
    'mediante',
    'segun',
    'ella',
    'ellos',
    'ellas',
    'este',
    'esta',
    'estos',
  ]),
  en: new Set([
    'the',
    'and',
    'of',
    'to',
    'in',
    'is',
    'that',
    'for',
    'this',
    'with',
    'by',
    'shall',
    'be',
    'on',
    'as',
    'or',
    'are',
    'any',
    'such',
    'which',
    'will',
    'from',
    'its',
    'their',
    'an',
    'at',
    'it',
    'not',
    'have',
    'has',
    'been',
    'under',
    'herein',
    'hereby',
    'thereof',
    'whereas',
    'party',
  ]),
};

function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function detectDocumentLanguage(text: string): DocumentLanguage {
  const sample = text.slice(0, SAMPLE_CHARS).toLowerCase();
  const words = deaccent(sample).match(/[a-z]+/g) ?? [];
  if (words.length < MIN_WORDS) return 'und';

  const scores = { pt: 0, es: 0, en: 0 };
  for (const word of words) {
    if (FUNCTION_WORDS.pt.has(word)) scores.pt += 1;
    if (FUNCTION_WORDS.es.has(word)) scores.es += 1;
    if (FUNCTION_WORDS.en.has(word)) scores.en += 1;
  }

  // Sinal gráfico vale como algumas palavras funcionais: é raro, mas quando aparece não mente.
  const graphic = (pattern: RegExp) => (sample.match(pattern) ?? []).length;
  scores.pt += Math.min(graphic(/[ãõç]/g), 20) * 0.5;
  scores.es += Math.min(graphic(/[ñ¿¡]/g), 20) * 0.5;

  const ranked = (Object.entries(scores) as Array<[Exclude<DocumentLanguage, 'und'>, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const [best, second] = ranked;
  if (!best || best[1] / words.length < MIN_SCORE) return 'und';
  if (second && second[1] > 0 && best[1] / second[1] < MIN_LEAD) return 'und';
  return best[0];
}
