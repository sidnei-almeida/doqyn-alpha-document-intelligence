// Bancada de prompts do pipeline de IA — classificação + extração.
//
// PREMISSAS (aprendidas na marra, não invente outras):
//
// 1. O prompt tem que ser GENERALISTA. O DOQYN recebe qualquer tipo de documento,
//    então nenhuma variante aqui contém vocabulário de um tipo específico. Todo
//    conhecimento sobre o tipo entra pelos DADOS da classe documental — description,
//    aliases, keywords, negativeKeywords — que o tenant configura nas regras.
//
// 2. O pipeline real tem DUAS ETAPAS: classifica contra as classes do tenant e só
//    então extrai com os campos da classe escolhida. Classificação errada contamina
//    a extração inteira, então a bancada mede a cascata.
//
// 3. A entrada real vem de OCR (Google Vision), não de texto limpo. Sem credencial
//    do Vision aqui, degradamos o texto de forma controlada — ver `degradeAsOcr`.
//    É APROXIMAÇÃO declarada, não OCR real.
//
// 4. O prompt nunca recebe o documento inteiro: o pipeline fatia e limita. Mandar
//    tudo estoura o limite de request do modelo pequeno (413) e não representa
//    produção. As constantes abaixo espelham server/ai/constants.ts.
//
// Uso:
//   node scripts/bench-extractor-prompts.mjs
//   BENCH_MODELS=llama-3.3-70b-versatile BENCH_REPS=2 BENCH_INPUTS=limpo,ocr node scripts/...
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(REPO, '.env') });

const DIR = process.env.BENCH_DIR || join(REPO, 'logs/bench');
mkdirSync(DIR, { recursive: true });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// espelham server/ai/constants.ts
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;
const MAX_CLASSIFIER_CHUNKS = 5;
const MAX_CHARS_PER_CLASSIFIER_CHUNK = 1200;
const MAX_EXTRACTOR_CHUNKS = 6;

// ── classes do tenant (o que o usuário configura nas regras) ────────────────
// Duas delas são distratores: nenhum documento do corpus pertence a elas.
const CLASSES = [
  {
    classId: 'cls_confidencialidade', className: 'Acordo de confidencialidade',
    description: 'Instrumento em que uma parte se compromete a manter sigilo sobre informações recebidas de outra.',
    keywords: ['confidencialidade', 'sigilo', 'informações confidenciais', 'não divulgação'],
    negativeKeywords: ['nota fiscal', 'boleto'],
    fields: [
      { key: 'parte_reveladora', label: 'Parte reveladora', type: 'string', required: true,
        description: 'Pessoa ou empresa que divulga as informações protegidas.', aliases: ['revelador', 'divulgador'] },
      { key: 'parte_receptora', label: 'Parte receptora', type: 'string', required: true,
        description: 'Pessoa ou empresa que recebe as informações protegidas.', aliases: ['receptor'] },
      { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: true,
        description: 'Data em que o instrumento foi firmado pelas partes.', aliases: ['firmado em', 'celebrado em'] },
      { key: 'prazo_vigencia', label: 'Prazo de vigência do acordo', type: 'string', required: true,
        description: 'Por quanto tempo o próprio acordo permanece válido. Não confundir com prazos de obrigações específicas previstas dentro dele.',
        aliases: ['vigência', 'sobrevivência'] },
      { key: 'data_validade', label: 'Data de validade', type: 'date', required: false,
        description: 'Data final de validade. Havendo data âncora e prazo relativo, calcule.' },
      { key: 'foro', label: 'Foro eleito', type: 'string', required: false, description: 'Comarca escolhida para dirimir controvérsias.' },
      { key: 'multa', label: 'Multa por infração', type: 'string', required: false, description: 'Valor da penalidade por descumprimento.' },
    ],
  },
  {
    classId: 'cls_contrato_servicos', className: 'Contrato de prestação de serviços',
    description: 'Instrumento em que uma parte contrata a outra para executar serviços mediante remuneração.',
    keywords: ['prestação de serviços', 'contratante', 'contratada', 'objeto'],
    negativeKeywords: ['confidencialidade'],
    fields: [
      { key: 'contratante', label: 'Contratante', type: 'string', required: true, description: 'Parte que contrata e paga pelo serviço.', aliases: ['cliente', 'tomador'] },
      { key: 'contratada', label: 'Contratada', type: 'string', required: true, description: 'Parte que presta o serviço.', aliases: ['fornecedor', 'prestador'] },
      { key: 'vigencia_inicio', label: 'Início da vigência', type: 'date', required: true, description: 'Data em que o contrato passa a valer.' },
      { key: 'vigencia_fim', label: 'Fim da vigência', type: 'date', required: true, description: 'Data em que o contrato deixa de valer.' },
      { key: 'valor', label: 'Valor', type: 'string', required: true, description: 'Valor contratado, com a periodicidade quando houver.' },
      { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: false, description: 'Data em que o instrumento foi firmado.' },
    ],
  },
  // distratores
  {
    classId: 'cls_nota_fiscal', className: 'Nota fiscal',
    description: 'Documento fiscal que registra a venda de mercadoria ou a prestação de serviço.',
    keywords: ['nota fiscal', 'nfe', 'emitente', 'destinatário', 'icms'], negativeKeywords: [],
    fields: [
      { key: 'emitente', label: 'Emitente', type: 'string', required: true, description: 'Quem emitiu a nota.' },
      { key: 'destinatario', label: 'Destinatário', type: 'string', required: true, description: 'Para quem a nota foi emitida.' },
      { key: 'valor_total', label: 'Valor total', type: 'string', required: true, description: 'Valor total da nota.' },
    ],
  },
  {
    classId: 'cls_procuracao', className: 'Procuração',
    description: 'Instrumento em que alguém outorga poderes de representação a outra pessoa.',
    keywords: ['procuração', 'outorgante', 'outorgado', 'poderes'], negativeKeywords: [],
    fields: [
      { key: 'outorgante', label: 'Outorgante', type: 'string', required: true, description: 'Quem concede os poderes.' },
      { key: 'outorgado', label: 'Outorgado', type: 'string', required: true, description: 'Quem recebe os poderes.' },
      { key: 'poderes', label: 'Poderes', type: 'string', required: true, description: 'Poderes concedidos.' },
    ],
  },
];

const classById = Object.fromEntries(CLASSES.map((c) => [c.classId, c]));

// ── corpus ───────────────────────────────────────────────────────────────────
const CORPUS = [
  {
    id: 'nda', file: 'nda.txt', expectedClassId: 'cls_confidencialidade',
    truth: {
      parte_reveladora: ['cristiano rafael baldissera'],
      parte_receptora: ['sidnei alves de almeida'],
      data_assinatura: ['2026-06-09'],
      prazo_vigencia: ['7 anos', '7 (sete) anos', 'sete anos'],
      data_validade: ['2033-06-09'],
      foro: ['comarca de caxias do sul/rs', 'caxias do sul'],
      multa: ['r$ 500.000,00', '500.000,00', '500000'],
    },
  },
  {
    id: 'contrato', file: 'contrato.txt', expectedClassId: 'cls_contrato_servicos',
    truth: {
      contratante: ['empresa alpha ltda'],
      contratada: ['fornecedor beta servicos ltda', 'fornecedor beta serviços ltda'],
      vigencia_inicio: ['2026-01-01', '01/01/2026'],
      vigencia_fim: ['2026-12-31', '31/12/2026'],
      valor: ['r$ 27.500,00', '27.500,00', '27500'],
      data_assinatura: ['2026-01-15', '15/01/2026'],
    },
  },
  {
    // NEGATIVO: relatório técnico. Não pertence a nenhuma classe do tenant.
    // A resposta certa da classificação é `null` (abster-se).
    id: 'relatorio_negativo', file: 'relatorio.txt', expectedClassId: null, truth: {},
  },
];

// ── chunking (espelha o pipeline) ────────────────────────────────────────────
function chunkText(text) {
  const out = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    out.push(text.slice(i, i + CHUNK_SIZE));
    if (i + CHUNK_SIZE >= text.length) break;
  }
  return out;
}

const classifierInput = (text) =>
  chunkText(text).slice(0, MAX_CLASSIFIER_CHUNKS)
    .map((c, i) => `[trecho ${i + 1}]\n${c.slice(0, MAX_CHARS_PER_CLASSIFIER_CHUNK)}`).join('\n\n');

const extractorInput = (text) =>
  chunkText(text).slice(0, MAX_EXTRACTOR_CHUNKS)
    .map((c, i) => `[trecho ${i + 1}]\n${c}`).join('\n\n');

// ── degradação de OCR (aproximação declarada) ────────────────────────────────
// Reproduz os defeitos que o Vision realmente comete em documento escaneado:
// confusão de caractere visualmente próximo, quebra de linha no meio da frase,
// perda de acento e inversão de ordem entre blocos vizinhos.
function degradeAsOcr(text) {
  const confusions = [[/0/g, 'O'], [/1/g, 'l'], [/rn/g, 'm'], [/º/g, 'o'], [/§/g, 'S']];
  let t = text;
  // aplica confusão só em parte das ocorrências, para não virar outro idioma
  for (const [re, sub] of confusions) {
    let n = 0;
    t = t.replace(re, (m) => (++n % 3 === 0 ? sub : m));
  }
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, (m) => (Math.random() < 0.35 ? '' : m)).normalize('NFC');
  // quebra de linha no meio das frases
  t = t.replace(/ /g, (m, i) => (i % 47 === 0 ? '\n' : m));
  // inverte pares de linhas vizinhas ocasionalmente (ordem de leitura errada)
  const lines = t.split('\n');
  for (let i = 0; i + 1 < lines.length; i += 11) {
    [lines[i], lines[i + 1]] = [lines[i + 1], lines[i]];
  }
  return lines.join('\n');
}

// ── prompts ──────────────────────────────────────────────────────────────────
const classListForPrompt = () =>
  JSON.stringify(CLASSES.map(({ classId, className, description, keywords, negativeKeywords }) =>
    ({ classId, className, description, keywords, negativeKeywords })), null, 2);

const CLASSIFIER_SHAPE = '{"classId":"...|null","confidence":0.0,"requiresReview":false,"evidence":["trecho literal"]}';
const EXTRACTOR_SHAPE =
  '{"metadata":{"<key>":{"value":"...","confidence":0.0,"evidence":{"snippet":"..."}}},"missingFields":[],"requiresReview":false}';

const CLASSIFIER_PROMPTS = {
  generico: (text) => `Classifique o documento em UMA das classes disponíveis.

Regras:
1. Use description, keywords e negativeKeywords de cada classe para decidir.
2. Se o documento não pertencer a nenhuma classe, responda classId null. Isso é uma resposta correta e esperada.
3. Cite em evidence os trechos literais que sustentam a escolha.
4. Responda APENAS JSON.

classes:
${classListForPrompt()}

Documento:
${text}

Formato: ${CLASSIFIER_SHAPE}`,

  evidencia_primeiro: (text) => `Classifique o documento em UMA das classes disponíveis.

Trabalhe nesta ordem:
1. Leia o documento e anote os trechos que indicam a NATUREZA do instrumento — o que ele faz,
   não os assuntos que ele menciona de passagem.
2. Para cada classe, confira se esses trechos correspondem à description dela.
3. Só então escolha. Se nenhuma classe corresponder à natureza do documento, classId null —
   é resposta correta e esperada, preferível a forçar a classe menos errada.
4. Mencionar um assunto não é ser daquele tipo: um relatório que fala sobre contratos não é
   um contrato. Decida pelo que o documento É, não pelo que ele CITA.

classes:
${classListForPrompt()}

Documento:
${text}

Responda APENAS JSON: ${CLASSIFIER_SHAPE}`,
};

const EXTRACTOR_PROMPTS = {
  minimo: (cls, text) => `Extraia os campos do documento e responda só JSON.

fields:
${JSON.stringify(cls.fields, null, 2)}

Documento:
${text}

Formato: ${EXTRACTOR_SHAPE}`,

  generico: (cls, text) => `Você extrai metadados estruturados de documentos para o DOQYN.

Tarefa: preencher os campos listados em "fields" usando SOMENTE o texto fornecido.

Regras:
1. Extraia apenas os campos em fields — respeite key, label e type de cada um.
2. Não invente valores. Se o dado não aparecer no texto, use null.
3. Para cada valor preenchido, inclua evidence.snippet com o trecho literal que o comprova.
4. missingFields = keys dos campos required que ficaram null.
5. Responda APENAS com JSON válido, sem markdown.

Classe documental: ${cls.className}

fields:
${JSON.stringify(cls.fields, null, 2)}

Documento:
${text}

Formato: ${EXTRACTOR_SHAPE}`,

  evidencia_primeiro: (cls, text) => `Você extrai metadados de documentos. Trabalhe em duas etapas, nesta ordem.

ETAPA 1 — localizar. Para cada campo, encontre no texto o trecho literal que o comprova.
Se não existir trecho, o campo é null. Não avance sem ter feito isto.

ETAPA 2 — preencher. Só então escreva o valor, derivado do trecho localizado.
Todo value precisa ser sustentado pelo seu snippet. Se o snippet não sustenta, o campo é null.

O texto pode vir de OCR: com erro de caractere, quebra de linha no meio da frase e ordem de
leitura trocada. Isso não autoriza adivinhar — mas exige que você leia o trecho inteiro antes
de concluir que a informação não está lá.

Classe documental: ${cls.className}

fields:
${JSON.stringify(cls.fields, null, 2)}

Documento:
${text}

Responda APENAS JSON: ${EXTRACTOR_SHAPE}`,

  desambiguacao: (cls, text) => `Você extrai metadados de documentos.

CUIDADO COM VALORES PARECIDOS. Um documento costuma conter vários valores do mesmo formato —
várias datas, vários prazos, vários nomes, vários valores em dinheiro. Formato igual não
significa mesmo papel. Antes de preencher, confira que o trecho encontrado desempenha
exatamente o papel descrito em description — e não outro papel próximo. Proximidade no texto
não é evidência. Na dúvida entre dois candidatos, prefira o que a description descreve
literalmente; se nenhum descreve, use null.

Todo valor preenchido precisa de evidence.snippet literal.

Classe documental: ${cls.className}

fields:
${JSON.stringify(cls.fields, null, 2)}

Documento:
${text}

Responda APENAS JSON: ${EXTRACTOR_SHAPE}`,
};

// ── pontuação ────────────────────────────────────────────────────────────────
const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const isEmpty = (v) => ['', 'null', 'undefined', 'n/a'].includes(norm(v));

function scoreExtraction(doc, parsed) {
  const md = parsed?.metadata ?? {};
  let correct = 0, wrong = 0, missed = 0;
  const per = {};
  for (const [key, accepted] of Object.entries(doc.truth)) {
    const raw = md[key]?.value ?? md[key]?.normalizedValue ?? null;
    if (isEmpty(raw)) { per[key] = { v: 'faltou' }; missed++; continue; }
    const got = norm(raw);
    if (accepted.some((a) => got.includes(norm(a)) || norm(a).includes(got))) {
      per[key] = { v: 'ok', got: raw }; correct++;
    } else { per[key] = { v: 'errado', got: raw, esperado: accepted[0] }; wrong++; }
  }
  return { correct, wrong, missed, total: Object.keys(doc.truth).length, per };
}

function parseJson(raw) {
  if (!raw) return null;
  let t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i >= 0 && j > i) t = t.slice(i, j + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function call(model, prompt, attempt = 0) {
  try {
    const t0 = Date.now();
    const res = await groq.chat.completions.create({
      model, messages: [{ role: 'user', content: prompt }],
      temperature: 0, response_format: { type: 'json_object' },
    });
    return { ms: Date.now() - t0, parsed: parseJson(res.choices?.[0]?.message?.content ?? ''), usage: res.usage ?? {} };
  } catch (e) {
    const msg = String(e.message ?? '');
    // 429 é esperado ao varrer variantes; espera e tenta de novo em vez de
    // registrar um zero que a média depois interpretaria como prompt ruim.
    if (msg.includes('429') && attempt < 4) {
      const waitMs = 20000 * (attempt + 1);
      process.stderr.write(`    rate limit — aguardando ${waitMs / 1000}s\n`);
      await new Promise((r) => setTimeout(r, waitMs));
      return call(model, prompt, attempt + 1);
    }
    throw e;
  }
}

// ── execução ─────────────────────────────────────────────────────────────────
const MODELS = (process.env.BENCH_MODELS || 'llama-3.1-8b-instant').split(',');
const REPS = Number(process.env.BENCH_REPS || 2);
const INPUTS = (process.env.BENCH_INPUTS || 'limpo,ocr').split(',');
const results = [];

for (const doc of CORPUS) {
  const p = join(DIR, doc.file);
  if (!existsSync(p)) { console.error(`faltando ${p}`); process.exit(1); }
  doc.clean = readFileSync(p, 'utf8');
  doc.ocr = degradeAsOcr(doc.clean);
}

for (const model of MODELS) {
  for (const input of INPUTS) {
    for (const [cName, cBuild] of Object.entries(CLASSIFIER_PROMPTS)) {
      for (const [eName, eBuild] of Object.entries(EXTRACTOR_PROMPTS)) {
        for (const doc of CORPUS) {
          for (let rep = 0; rep < REPS; rep++) {
            const text = input === 'ocr' ? doc.ocr : doc.clean;
            const row = { model, input, classifier: cName, extractor: eName, doc: doc.id, rep };
            try {
              const c = await call(model, cBuild(classifierInput(text)));
              // O modelo abstém-se devolvendo ora `null` JSON, ora a string "null",
              // ora "none"/"". Tratar tudo como abstenção — comparar cru marcaria
              // abstenção correta como erro e inverteria a leitura do teste negativo.
              const rawClass = c.parsed?.classId;
              const gotClass = isEmpty(rawClass) || rawClass === 'none' ? null : rawClass;
              row.classMs = c.ms;
              row.gotClass = gotClass;
              row.classOk = gotClass === doc.expectedClassId;

              if (!row.classOk) {
                // cascata: classificação errada invalida a extração inteira
                row.cascadeFail = true;
                row.correct = 0; row.wrong = 0; row.missed = Object.keys(doc.truth).length;
                row.total = Object.keys(doc.truth).length;
              } else if (gotClass === null) {
                row.correct = 0; row.wrong = 0; row.missed = 0; row.total = 0; // negativo, nada a extrair
              } else {
                const e = await call(model, eBuild(classById[gotClass], extractorInput(text)));
                row.extractMs = e.ms;
                Object.assign(row, e.parsed ? scoreExtraction(doc, e.parsed) : { correct: 0, wrong: 0, missed: Object.keys(doc.truth).length, total: Object.keys(doc.truth).length, jsonFail: true });
              }
              process.stderr.write(
                `${model} · ${input} · c:${cName} e:${eName} · ${doc.id} #${rep} → ` +
                `classe ${row.classOk ? 'ok' : 'ERRO(' + gotClass + ')'} · ${row.correct}/${row.total}\n`);
            } catch (err) {
              row.error = String(err.message).slice(0, 140);
              process.stderr.write(`${model} · ${input} · ${doc.id} #${rep} → ERRO ${row.error}\n`);
            }
            results.push(row);
            await new Promise((r) => setTimeout(r, 2500));
          }
        }
      }
    }
  }
}

writeFileSync(join(DIR, 'bench-results.json'), JSON.stringify(results, null, 2));
console.log(`\nOK — ${results.length} execuções em ${join(DIR, 'bench-results.json')}`);
