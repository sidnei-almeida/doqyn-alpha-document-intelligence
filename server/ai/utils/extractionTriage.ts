/**
 * Triagem determinística do resultado da extração — a camada que não gasta token.
 *
 * Ela não decide nada sozinha. O trabalho dela é montar o dossiê que o Avaliador vai julgar:
 * apontar, campo a campo, qual sintoma o resultado apresenta. Um `null` num campo obrigatório é
 * sintoma, não veredito — o caso que motivou este agente é justamente o campo que voltou vazio
 * com o dado presente no papel, e nenhuma regra consegue distinguir "não achei" de "não existe".
 * Quem faz essa distinção é o modelo, relendo os trechos.
 *
 * O que a regra resolve por conta própria são as falhas verificáveis: snippet que não aparece no
 * documento, data que ficou fora de `yyyy-mm-dd`, valor com símbolo de moeda no `normalizedValue`.
 * Essas não precisam de opinião, precisam de conferência.
 *
 * Documento sem sintoma nenhum não chega ao modelo. É o que mantém o refino barato: o custo cai
 * sobre o documento problemático, não sobre a fila inteira.
 */
import { MIN_FIELD_CONFIDENCE } from '../constants.js';
import type {
  DocumentClassRule,
  DocumentNamingRoles,
  DocumentRuleField,
  ExtractedMetadataField,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { isUsableNamingSubject } from '../services/documentNaming.js';
import { findFieldCandidates } from './fieldCandidates.js';
import { isConfidentialityClassRule, hasFinancialRoleFields } from './documentClassHeuristics.js';

export type TriageSymptom =
  /** Campo obrigatório voltou vazio. Pode ser abstenção correta ou leitura falha — o modelo decide. */
  | 'ausente'
  /** Preenchido sem o trecho que comprova. O prompt exige evidence.snippet em todo valor. */
  | 'sem_evidencia'
  /** O snippet citado não existe no texto do documento. Invenção, não leitura. */
  | 'evidencia_nao_confere'
  | 'confianca_baixa'
  /** `normalizedValue` não obedece o `type` declarado do campo. */
  | 'normalizacao_invalida'
  /** O documento tem mais de um valor deste formato: escolher é onde o erro mora. */
  | 'valor_disputado'
  | 'tipo_ausente'
  | 'tipo_generico'
  | 'tipo_igual_a_classe'
  | 'tipo_palavra_colada'
  | 'sujeitos_ausentes'
  | 'data_referencia_invalida';

export type TriageFinding = {
  /** Chave do campo, ou `naming.tipo` / `naming.sujeitos` / `naming.dataReferencia`. */
  key: string;
  label: string;
  symptom: TriageSymptom;
  /** Frase curta em pt-BR que entra no dossiê do prompt. */
  detail: string;
  /** Os outros valores do mesmo formato presentes no documento. Só em `valor_disputado`. */
  candidates?: string[];
};

export type ExtractionTriage = {
  findings: TriageFinding[];
  /** Classe com valor plausível e errado conhecido — julga mesmo sem sintoma. */
  errorProneClass: boolean;
  /** Chaves de campo com sintoma — as que valem re-busca focada. */
  suspectFieldKeys: string[];
  /** Papéis de nomeação com sintoma. */
  suspectNamingKeys: string[];
  clean: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Uma palavra em caixa alta com mais de 12 letras e sem espaço é rótulo colado: ORDEMDECOMPRA. */
const GLUED_WORD = /^[A-ZÀ-Ý]{13,}$/;

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * O texto do documento como uma agulha procura o palheiro.
 *
 * Comparação frouxa de propósito: o snippet vem do modelo, que colapsa espaço, corrige quebra de
 * linha do OCR e às vezes troca acentuação. Exigir igualdade literal transformaria conferência em
 * falso positivo, e falso positivo aqui manda re-buscar campo que estava certo — gasta token para
 * piorar.
 */
function buildHaystack(chunks: RetrievedChunk[]): string {
  return normalizeForCompare(chunks.map((chunk) => chunk.text).join(' \n '));
}

function snippetIsPresent(haystack: string, snippet: string): boolean {
  const needle = normalizeForCompare(snippet);
  if (needle.length < 8) return true; // curto demais para provar ausência
  if (haystack.includes(needle)) return true;

  // OCR troca caractere no meio da frase. Um trecho longo cujo miolo bate já é evidência de que
  // o modelo estava lendo o documento, e não inventando.
  const words = needle.split(' ').filter((word) => word.length > 3);
  if (words.length < 4) return false;
  const found = words.filter((word) => haystack.includes(word)).length;
  return found / words.length >= 0.7;
}

function normalizedValueMatchesType(
  field: DocumentRuleField,
  extracted: ExtractedMetadataField,
): { ok: true } | { ok: false; detail: string } {
  const normalized = extracted.normalizedValue ?? extracted.value;
  if (normalized === null || normalized === undefined || normalized === '') return { ok: true };

  if (field.type === 'date') {
    return ISO_DATE.test(String(normalized))
      ? { ok: true }
      : { ok: false, detail: `data em "${normalized}" em vez de yyyy-mm-dd` };
  }

  if (field.type === 'currency' || field.type === 'number') {
    const asNumber = typeof normalized === 'number' ? normalized : Number(normalized);
    return Number.isFinite(asNumber)
      ? { ok: true }
      : { ok: false, detail: `valor "${normalized}" não é número puro` };
  }

  if (field.type === 'boolean') {
    return typeof normalized === 'boolean' || /^(true|false)$/i.test(String(normalized))
      ? { ok: true }
      : { ok: false, detail: `booleano em "${normalized}"` };
  }

  return { ok: true };
}

function isEmptyValue(extracted: ExtractedMetadataField | undefined): boolean {
  if (!extracted) return true;
  const value = extracted.normalizedValue ?? extracted.value;
  return value === null || value === undefined || String(value).trim() === '';
}

function triageNamingRoles(input: {
  roles: DocumentNamingRoles | undefined;
  selectedClass: DocumentClassRule;
}): TriageFinding[] {
  const findings: TriageFinding[] = [];
  const roles = input.roles;
  const tipo = roles?.tipo?.trim() ?? '';

  if (!tipo) {
    findings.push({
      key: 'naming.tipo',
      label: 'Tipo do documento',
      symptom: 'tipo_ausente',
      detail: 'o extrator não disse o que o documento é',
    });
  } else {
    if (normalizeForCompare(tipo) === normalizeForCompare(input.selectedClass.name)) {
      findings.push({
        key: 'naming.tipo',
        label: 'Tipo do documento',
        symptom: 'tipo_igual_a_classe',
        detail: `repetiu o nome da pasta ("${tipo}") em vez de dizer o tipo`,
      });
    } else if (['documento', 'arquivo', 'anexo'].includes(normalizeForCompare(tipo))) {
      findings.push({
        key: 'naming.tipo',
        label: 'Tipo do documento',
        symptom: 'tipo_generico',
        detail: `"${tipo}" não distingue nada`,
      });
    }

    if (GLUED_WORD.test(tipo)) {
      findings.push({
        key: 'naming.tipo',
        label: 'Tipo do documento',
        symptom: 'tipo_palavra_colada',
        detail: `"${tipo}" saiu sem espaço entre as palavras`,
      });
    }
  }

  /**
   * Sujeito vazio é o que quebrou o nome de `juridico_04` nas variantes escaneadas: o modelo leu
   * PROCURAÇÃO corretamente, mas sem sujeito `rolesNameIsSpecific` dá false e o nome cai no
   * resgate da classe, saindo como `NDA_2026-04-16`. Recuperar o sujeito conserta o nome por
   * construção — não há o que julgar na string final.
   */
  const usableSubjects = (roles?.sujeitos ?? []).filter((subject) =>
    isUsableNamingSubject(subject),
  );
  if (usableSubjects.length === 0) {
    findings.push({
      key: 'naming.sujeitos',
      label: 'Sujeitos do documento',
      symptom: 'sujeitos_ausentes',
      detail:
        (roles?.sujeitos ?? []).length > 0
          ? `só vieram rótulos genéricos (${roles?.sujeitos.join(', ')}), não entidades`
          : 'nenhuma entidade que distinga este documento de outro do mesmo tipo',
    });
  }

  const dataReferencia = roles?.dataReferencia?.trim();
  if (dataReferencia && !ISO_DATE.test(dataReferencia)) {
    findings.push({
      key: 'naming.dataReferencia',
      label: 'Data de referência',
      symptom: 'data_referencia_invalida',
      detail: `"${dataReferencia}" não está em yyyy-mm-dd`,
    });
  }

  return findings;
}

/**
 * Classes onde o repositório já sabe que existe valor plausível e errado esperando.
 *
 * Documento financeiro tem o banco emissor no topo do boleto e o pagador na primeira linha do
 * recibo; NDA tem o título e os rótulos de papel disputando o campo das partes. O prompt do
 * extrator carrega dicas específicas para os dois casos justamente porque metade das falhas
 * medidas mora ali — e ainda assim erra. Aqui isso vira gatilho: nessas classes o julgamento
 * acontece mesmo sem sintoma, porque a ausência de sintoma é o próprio problema.
 */
function classIsErrorProne(selectedClass: DocumentClassRule): boolean {
  return hasFinancialRoleFields(selectedClass) || isConfidentialityClassRule(selectedClass);
}

export function triageExtraction(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
  naming?: DocumentNamingRoles;
  chunks: RetrievedChunk[];
}): ExtractionTriage {
  const haystack = buildHaystack(input.chunks);
  const findings: TriageFinding[] = [];

  for (const field of input.selectedClass.fields) {
    const extracted = input.metadata[field.key];

    if (isEmptyValue(extracted)) {
      // Campo opcional vazio é resultado esperado, não sintoma. Insistir nele gastaria o
      // orçamento no que ninguém pediu.
      if (field.required) {
        findings.push({
          key: field.key,
          label: field.label,
          symptom: 'ausente',
          detail: 'campo obrigatório voltou vazio',
        });
      }
      continue;
    }

    const snippet = extracted.evidence?.snippet?.trim();
    if (!snippet) {
      findings.push({
        key: field.key,
        label: field.label,
        symptom: 'sem_evidencia',
        detail: `preencheu "${extracted.value}" sem citar o trecho que comprova`,
      });
    } else if (!snippetIsPresent(haystack, snippet)) {
      findings.push({
        key: field.key,
        label: field.label,
        symptom: 'evidencia_nao_confere',
        detail: `o trecho citado ("${snippet.slice(0, 80)}") não aparece no documento`,
      });
    }

    if (extracted.confidence < MIN_FIELD_CONFIDENCE) {
      findings.push({
        key: field.key,
        label: field.label,
        symptom: 'confianca_baixa',
        detail: `confiança ${extracted.confidence.toFixed(2)} abaixo de ${MIN_FIELD_CONFIDENCE}`,
      });
    }

    const typeCheck = normalizedValueMatchesType(field, extracted);
    if (!typeCheck.ok) {
      findings.push({
        key: field.key,
        label: field.label,
        symptom: 'normalizacao_invalida',
        detail: typeCheck.detail,
      });
    }

    /**
     * Formato válido não é papel certo.
     *
     * Este é o sintoma que faltava. `juridico_04` traz quatro datas e o extrator pegou o selo de
     * reconhecimento de firma em vez da lavratura; `operacional_01` traz cinco e pegou o carimbo
     * de tempo do ICP-Brasil em vez da emissão. Nos dois o snippet era real, a data era válida e a
     * confiança era alta — nenhuma conferência mecânica tinha o que apontar. O que existe para
     * apontar é a disputa: quando o documento traz um candidato só, escolher é trivial; quando traz
     * quatro, a escolha é exatamente onde o erro mora.
     */
    const candidates = findFieldCandidates({ field, chunks: input.chunks });
    if (candidates.length >= 2) {
      findings.push({
        key: field.key,
        label: field.label,
        symptom: 'valor_disputado',
        detail: `o documento tem ${candidates.length} valores deste formato — confirme que o escolhido faz o papel pedido`,
        candidates,
      });
    }
  }

  findings.push(...triageNamingRoles({ roles: input.naming, selectedClass: input.selectedClass }));

  const suspectFieldKeys = [
    ...new Set(findings.filter((f) => !f.key.startsWith('naming.')).map((f) => f.key)),
  ];
  const suspectNamingKeys = [
    ...new Set(findings.filter((f) => f.key.startsWith('naming.')).map((f) => f.key)),
  ];

  return {
    findings,
    suspectFieldKeys,
    suspectNamingKeys,
    errorProneClass: classIsErrorProne(input.selectedClass),
    clean: findings.length === 0 && !classIsErrorProne(input.selectedClass),
  };
}
