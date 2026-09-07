import type { DocumentRuleField } from '../types/documentAi.types.js';

/**
 * Deriva data final a partir de data âncora + prazo relativo, em código.
 *
 * Por que não pedir ao LLM: medido em 2026-08-13 contra o NDA de teste
 * (`docs/ESTUDO-PROMPTS-EXTRACAO-2026-08-12.md`), `llama-3.1-8b-instant` não faz a aritmética nem
 * com o pedido explícito no prompt — `data_validade` ficou vazia em 16 de 16 execuções. O
 * `llama-3.3-70b-versatile` calcula certo. Ou seja: a resposta dependia do modelo configurado.
 *
 * Somar prazo a uma data é operação determinística. Em código ela é exata, gratuita, testável e
 * igual em qualquer modelo — inclusive nos pagos que venham a substituir o atual. O LLM continua
 * responsável pelo que só ele sabe fazer: achar a âncora e o prazo no texto.
 *
 * Nada aqui é específico de um tipo documental. Os termos reconhecidos (vigência, validade,
 * vencimento, garantia, carência) aparecem em contrato, apólice, licença, certificado e afins.
 */

const ANCHOR_HINTS = [
  'assinatura',
  'assinado',
  'celebracao',
  'celebrado',
  'emissao',
  'emitido',
  'inicio',
  'vigencia_inicio',
  'partida',
  'firmado',
  /**
   * `referencia`, `documento` e `lavratura` entraram depois de um caso real: uma classe "Contratos"
   * com os campos `data_referencia`, `data_vencimento` e `partes_envolvidas`. O vencimento saía
   * vazio com tudo à vista no papel — não por falha de leitura, mas porque a data que existia não
   * era reconhecida como ponto de partida. A lista descrevia o vocabulário de quem escreveu o
   * módulo, não o de quem cadastra campo no produto.
   *
   * O filtro por `type === 'date'` é o que torna isso seguro: um campo `referencia` que guarda
   * número de processo nunca chega aqui.
   */
  'referencia',
  'documento',
  'lavratura',
];

const TARGET_HINTS = [
  'validade',
  'vencimento',
  'expiracao',
  'expira',
  'termino',
  'fim',
  'final',
  'vigencia_fim',
  'caducidade',
];

/**
 * Número, o parêntese por extenso que o jurídico gosta de usar, e a unidade — nessa ordem e perto.
 *
 * A versão anterior aceitava qualquer distância entre o número e a unidade (`[^)]*?` sem teto).
 * Em valor de campo isso passava, porque o valor é curto. Sobre o texto do documento vira veneno:
 * "celebrado em 09 de junho de 2026 … NÃO ALICIAMENTO (3 ANOS)" era lido como **9 anos**, juntando
 * o dia de uma data com a unidade de outra frase. O prazo saía plausível, redondo e errado.
 */
const DURATION_RE =
  /(\d{1,4})\s*(?:\([^)]{0,24}\)\s*)?(dias?|semanas?|quinzenas?|mes(?:es)?|meses|anos?)\b/i;

/**
 * Termos que dizem que um prazo governa a duração do documento.
 *
 * Sem eles, varrer o texto atrás de "número + unidade" pegaria o primeiro prazo que aparecesse —
 * "pagamento em 30 dias", "entrega em 15 dias", "aviso prévio de 60 dias" — e produziria uma data
 * de vencimento com cara de certa e origem errada. Data errada em campo de vencimento é pior que
 * campo vazio: o vazio pede conferência, a data errada dispensa.
 *
 * A ordem importa: quanto mais alto na lista, mais o termo governa o documento inteiro em vez de
 * uma cláusula isolada.
 */
const VALIDITY_CONTEXT_TERMS = [
  'vigencia',
  'vigorara',
  'vigorar',
  'vigor',
  'validade',
  'valido',
  'valida',
  'confidencialidade',
  'sigilo',
  'garantia',
  'carencia',
  'nao aliciamento',
  'nao concorrencia',
  'exclusividade',
];

/** Quantos caracteres depois do termo ainda contam como "perto". */
const CONTEXT_WINDOW = 90;

/** Um prazo pertence à frase em que está escrito. Além do ponto final começa outro assunto. */
function cutAtSentenceEnd(window: string): string {
  const stop = window.indexOf('.');
  return stop === -1 ? window : window.slice(0, stop);
}

const deaccent = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function fieldMentions(field: DocumentRuleField, hints: string[]): boolean {
  const haystack = deaccent(
    [field.key, field.label, field.description ?? '', ...(field.aliases ?? [])].join(' '),
  );
  return hints.some((h) => haystack.includes(h));
}

export type ParsedDuration = { amount: number; unit: 'day' | 'week' | 'month' | 'year' };

/** Interpreta prazo relativo escrito em português. `null` quando não houver prazo reconhecível. */
export function parseRelativeDuration(raw: unknown): ParsedDuration | null {
  if (typeof raw !== 'string') return null;
  const match = DURATION_RE.exec(deaccent(raw));
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unitRaw = match[2];
  if (unitRaw.startsWith('ano')) return { amount, unit: 'year' };
  if (unitRaw.startsWith('mes')) return { amount, unit: 'month' };
  if (unitRaw.startsWith('semana')) return { amount: amount * 7, unit: 'day' };
  if (unitRaw.startsWith('quinzena')) return { amount: amount * 15, unit: 'day' };
  return { amount, unit: 'day' };
}

/** Soma o prazo à âncora `yyyy-mm-dd`. `null` se a âncora não for uma data ISO válida. */
export function addDuration(anchorIso: string, duration: ParsedDuration): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchorIso.trim());
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const base = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(base.getTime()) || base.getUTCDate() !== day) return null;

  if (duration.unit === 'day') {
    base.setUTCDate(base.getUTCDate() + duration.amount);
    return base.toISOString().slice(0, 10);
  }

  const monthsToAdd = duration.unit === 'year' ? duration.amount * 12 : duration.amount;
  const targetMonthIndex = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // 31/01 + 1 mês não existe em fevereiro: fixa no último dia do mês de destino,
  // que é a leitura usual de prazo contratual e nunca escorrega para o mês seguinte.
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTarget);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10);
}

const MONTHS_PT: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function buildIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Converte data escrita em português para `yyyy-mm-dd`.
 *
 * Existe porque `applyFieldNormalization` cobria currency, cpf e cnpj e nada para data — então o
 * ISO que o modelo produzia era descartado, já que a validação recalcula `normalizedValue` a partir
 * do `value` cru. Sem isto, o campo de data chegava ao banco por extenso e a derivação de data
 * final não tinha âncora com que trabalhar.
 *
 * Ano de 2 dígitos é rejeitado de propósito: "01/02/26" é ambíguo demais para adivinhar em
 * documento jurídico, e chutar o século seria pior do que deixar o valor cru.
 */
export function normalizeDateValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = deaccent(raw).trim();
  if (!text) return null;

  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(text);
  if (numeric) return buildIso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  // "09 de junho de 2026", "9 junho 2026", "aos 09 dias do mes de junho de 2026"
  const byExtenso = /(\d{1,2})\s*(?:de\s+|\s+)([a-z]+)\.?\s*(?:de\s+|\s+)(\d{4})/.exec(text);
  if (byExtenso) {
    const month = MONTHS_PT[byExtenso[2]];
    if (month) return buildIso(Number(byExtenso[3]), month, Number(byExtenso[1]));
  }

  // "junho de 2026" — sem dia, assume o primeiro. Quem chama decide se baixa a confiança.
  const monthYear = /([a-z]+)\s*(?:de\s+|\/)\s*(\d{4})/.exec(text);
  if (monthYear) {
    const month = MONTHS_PT[monthYear[1]];
    if (month) return buildIso(Number(monthYear[2]), month, 1);
  }

  return null;
}

export type DerivedDate = {
  targetKey: string;
  value: string;
  anchorKey: string;
  anchorValue: string;
  /** Chave do campo que trouxe o prazo, ou `texto` quando ele foi lido direto do documento. */
  durationKey: string;
  durationValue: string;
};

export type TextDuration = {
  parsed: ParsedDuration;
  /** O trecho literal que sustenta o prazo, para virar evidência do campo derivado. */
  snippet: string;
  /** Qual termo de validade ancorou a leitura. Quanto mais alto na lista, mais governa. */
  contextTerm: string;
  contextRank: number;
};

/**
 * Procura no texto do documento um prazo que governe a validade.
 *
 * Existe porque a derivação dependia de o prazo ter sido extraído para um campo configurado — e a
 * classe do tenant simplesmente pode não ter esse campo. Foi o caso real que originou isto: uma
 * classe "Contratos" com `data_referencia`, `data_vencimento` e `partes_envolvidas`, e um NDA
 * dizendo "Pelo prazo de 3 (três) anos" no corpo. O prazo estava escrito, legível, e não tinha
 * onde pousar. O campo saía FALTANDO com tudo à vista.
 *
 * A varredura é ancorada de propósito. Documento tem muitos prazos — pagamento em 30 dias, aviso
 * prévio de 60, entrega em 15 — e pegar o primeiro produziria uma data de vencimento com cara de
 * certa e origem errada. Data errada em campo de vencimento é pior que campo vazio: o vazio pede
 * conferência, a data errada dispensa.
 */
export function findDurationInText(text: string): TextDuration | null {
  const flat = deaccent(text).replace(/\s+/g, ' ');
  const candidates: TextDuration[] = [];

  VALIDITY_CONTEXT_TERMS.forEach((term, rank) => {
    let from = 0;
    for (;;) {
      const at = flat.indexOf(term, from);
      if (at === -1) break;
      from = at + term.length;

      /**
       * Depois do termo primeiro, antes só como recurso — e nunca atravessando ponto final.
       *
       * A janela que abria antes do termo em todos os casos fazia a segunda "vigência" de um
       * documento enxergar o prazo da primeira frase. As duas ocorrências viravam o mesmo número, o
       * empate desaparecia, e a ambiguidade que deveria mandar o documento para revisão virava uma
       * resposta confiante. Cortar no ponto final é o que mantém cada leitura dentro da sua frase.
       */
      const after = cutAtSentenceEnd(flat.slice(from, from + CONTEXT_WINDOW));
      let parsed = parseRelativeDuration(after);
      let start = from;
      let end = from + after.length;

      if (!parsed) {
        // "3 anos de vigência": o número vem antes do termo.
        const beforeRaw = flat.slice(Math.max(0, at - 40), at);
        const lastStop = beforeRaw.lastIndexOf('.');
        const before = lastStop === -1 ? beforeRaw : beforeRaw.slice(lastStop + 1);
        parsed = parseRelativeDuration(before);
        start = at - before.length;
        end = at + term.length;
      }

      if (!parsed) continue;

      candidates.push({
        parsed,
        snippet: text.slice(Math.max(0, start), Math.min(text.length, end)).trim(),
        contextTerm: term,
        contextRank: rank,
      });
    }
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.contextRank - b.contextRank);
  const best = candidates[0];

  /**
   * Empate entre prazos diferentes com o mesmo peso de contexto não vira escolha.
   *
   * Um NDA pode dizer cinco anos de confidencialidade e três de não aliciamento. As duas leituras
   * são defensáveis e só uma está certa — e o módulo não tem como saber qual. Devolver `null`
   * mantém o campo vazio e o documento em revisão, que é a resposta honesta quando há dúvida
   * genuína.
   */
  const sameRank = candidates.filter((c) => c.contextRank === best.contextRank);
  const distinct = new Set(sameRank.map((c) => `${c.parsed.amount}-${c.parsed.unit}`));
  if (distinct.size > 1) return null;

  return best;
}

type MetadataLike = Record<string, { value?: unknown; normalizedValue?: unknown } | undefined>;

const readValue = (entry: MetadataLike[string]): string | null => {
  const v = entry?.normalizedValue ?? entry?.value;
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Encontra campos de data final vazios que podem ser calculados e devolve o cálculo.
 *
 * Conservador de propósito: só preenche campo cujo nome, rótulo, descrição ou alias indique data
 * FINAL, e só quando existe âncora ISO e prazo relativo já extraídos. Na ausência de qualquer um
 * dos três, não inventa nada — deixar vazio é a resposta correta.
 */
export function deriveEndDates(
  fields: DocumentRuleField[],
  metadata: MetadataLike,
  /** Texto do documento, para achar o prazo quando nenhum campo configurado o carrega. */
  documentText?: string,
): DerivedDate[] {
  const anchors = fields
    .filter((f) => f.type === 'date' && fieldMentions(f, ANCHOR_HINTS))
    .map((f) => ({ key: f.key, value: readValue(metadata[f.key]) }))
    .filter(
      (a): a is { key: string; value: string } => a.value !== null && ISO_DATE_RE.test(a.value),
    );

  if (anchors.length === 0) return [];

  const durations = fields
    .map((f) => ({ key: f.key, raw: readValue(metadata[f.key]) }))
    .map((d) => ({ ...d, parsed: parseRelativeDuration(d.raw) }))
    .filter((d): d is { key: string; raw: string; parsed: ParsedDuration } => d.parsed !== null);

  /**
   * O texto é o segundo lugar onde procurar, nunca o primeiro.
   *
   * Campo extraído passou pelo modelo e pela validação; prazo lido do corpo é heurística ancorada.
   * Quando os dois existem, o campo vence — ele foi escolhido por alguém que leu o documento
   * inteiro, e a varredura só olha uma janela em volta de um termo.
   */
  const fromText = durations.length === 0 && documentText ? findDurationInText(documentText) : null;
  if (durations.length === 0 && !fromText) return [];

  const derived: DerivedDate[] = [];

  for (const field of fields) {
    if (field.type !== 'date') continue;
    if (!fieldMentions(field, TARGET_HINTS)) continue;
    if (readValue(metadata[field.key]) !== null) continue; // já veio preenchido: respeita o texto

    const anchor = anchors[0];
    const duration = durations[0];
    const parsed = duration?.parsed ?? fromText?.parsed;
    if (!parsed) continue;

    const value = addDuration(anchor.value, parsed);
    if (!value) continue;

    derived.push({
      targetKey: field.key,
      value,
      anchorKey: anchor.key,
      anchorValue: anchor.value,
      durationKey: duration?.key ?? 'texto',
      durationValue: duration?.raw ?? fromText?.snippet ?? '',
    });
  }

  return derived;
}
