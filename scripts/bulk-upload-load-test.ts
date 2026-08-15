/**
 * Ensaio de carga do envio em lote, pelo caminho HTTP real do produto.
 *
 * Faz login, manda N cópias do mesmo arquivo com a paralelidade pedida, acompanha cada análise até
 * o fim e confirma o documento — exatamente a sequência que o navegador executa. Serve para medir
 * o que a aritmética da auditoria não prova: onde a fila enche, quanto o limitador de vazão segura,
 * e o que o usuário sentiria.
 *
 * Grava documentos de verdade no banco apontado pelo `.env`. Rode contra desenvolvimento.
 *
 *   npx tsx scripts/bulk-upload-load-test.ts --files 20 --parallel 5
 *   npx tsx scripts/bulk-upload-load-test.ts --files 50 --parallel 10 --pdf caminho.pdf
 */
import 'dotenv/config';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const AUTH_BASE = process.env.LOAD_TEST_AUTH_BASE ?? 'http://127.0.0.1:4100';
const API_BASE = process.env.LOAD_TEST_API_BASE ?? 'http://127.0.0.1:3001';
const EMAIL = process.env.LOAD_TEST_EMAIL ?? 'rafael.mendes@doqyn.dev';
const PASSWORD = process.env.LOAD_TEST_PASSWORD ?? 'DevDoqyn@123';

function readFlag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const fileCount = Number(readFlag('files', '20'));
const parallel = Number(readFlag('parallel', '5'));
const pdfPath = readFlag('pdf', '/home/sidnei-almeida/Downloads/NDA_-_ACORDO_DE_CONFIDENCIALIDADE_2.pdf');
/** Com `--dir`, o lote circula por todos os arquivos da pasta em vez de repetir um só. */
const dirPath = readFlag('dir', '');

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

type SourceFile = { name: string; buffer: Buffer; mimeType: string };

function loadSources(): SourceFile[] {
  const paths = dirPath
    ? readdirSync(dirPath)
        .map((entry) => join(dirPath, entry))
        .filter((entry) => statSync(entry).isFile() && MIME_BY_EXT[extname(entry).toLowerCase()])
    : [pdfPath];

  if (paths.length === 0) throw new Error(`nenhum arquivo suportado em ${dirPath}`);

  return paths.map((path) => ({
    name: basename(path),
    buffer: readFileSync(path),
    mimeType: MIME_BY_EXT[extname(path).toLowerCase()] ?? 'application/pdf',
  }));
}

type ItemResult = {
  index: number;
  fileName: string;
  ok: boolean;
  analyzeMs: number;
  waitMs: number;
  confirmMs: number;
  totalMs: number;
  status?: string;
  error?: string;
};

async function login(): Promise<string> {
  const response = await fetch(`${AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!response.ok) throw new Error(`login falhou: ${response.status}`);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mesma cadência do navegador hoje: consulta a cada 2s. */
async function waitForJob(
  jobId: string,
  cookie: string,
  pollUrl: string,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await sleep(2000);
    const response = await fetch(`${API_BASE}${pollUrl}`, { headers: { cookie } });
    const body = (await response.json()) as Record<string, unknown>;
    const status = String(body.status);

    if (['completed', 'requires_review', 'ai_unavailable', 'failed'].includes(status)) {
      return (body.result as Record<string, unknown>) ?? body;
    }
  }
  throw new Error(`job ${jobId} não terminou em 10 minutos`);
}

async function sendOne(index: number, cookie: string, source: SourceFile): Promise<ItemResult> {
  const startedAt = Date.now();
  const result: ItemResult = {
    index,
    fileName: source.name,
    ok: false,
    analyzeMs: 0,
    waitMs: 0,
    confirmMs: 0,
    totalMs: 0,
  };

  try {
    const form = new FormData();
    form.append(
      'file',
      new Blob([source.buffer], { type: source.mimeType }),
      `carga-${index}-${source.name}`,
    );

    const analyzeStartedAt = Date.now();
    const analyze = await fetch(`${API_BASE}/api/ai/analyze-pdf`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    result.analyzeMs = Date.now() - analyzeStartedAt;

    let payload = (await analyze.json()) as Record<string, unknown>;

    if (!analyze.ok) {
      result.error = `analyze ${analyze.status}: ${String(payload.code ?? payload.message)}`;
      result.totalMs = Date.now() - startedAt;
      return result;
    }

    // 202 = foi para a fila; 200 = analisou dentro do request (fallback síncrono).
    if (analyze.status === 202) {
      const waitStartedAt = Date.now();
      payload = await waitForJob(
        String(payload.jobId),
        cookie,
        String(payload.pollUrl ?? `/api/ai/jobs/${payload.jobId}`),
      );
      result.waitMs = Date.now() - waitStartedAt;
    }

    result.status = String(payload.status);

    const extraction = payload.extraction ?? {
      documentType: (payload.classification as Record<string, unknown>)?.className,
      version: 'v1.0',
      metadata: {},
      missingFields: [],
      requiresReview: true,
      reviewReasons: [],
    };

    const confirmStartedAt = Date.now();
    const confirm = await fetch(`${API_BASE}/api/documents/confirm-analysis`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        extraction,
        // Equivale ao usuário abrindo a revisão e confirmando: é o que interessa medir aqui.
        manualReviewConfirmed: result.status === 'requires_review',
        namingMode: payload.recommendedFileName ? 'ai_suggested' : 'original',
        aiSuggestedFileName: payload.recommendedFileName,
      }),
    });
    result.confirmMs = Date.now() - confirmStartedAt;

    if (!confirm.ok) {
      const body = (await confirm.json().catch(() => ({}))) as Record<string, unknown>;
      result.error = `confirm ${confirm.status}: ${String(body.code ?? body.message)}`;
      result.totalMs = Date.now() - startedAt;
      return result;
    }

    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'erro desconhecido';
  }

  result.totalMs = Date.now() - startedAt;
  return result;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

async function main(): Promise<void> {
  const sources = loadSources();
  const cookie = await login();

  console.log(
    `${sources.length} arquivo(s) de origem · ${fileCount} envios · ${parallel} em paralelo`,
  );
  for (const source of sources) {
    console.log(`  ${source.name} (${(source.buffer.length / 1024).toFixed(0)} KB)`);
  }
  console.log('');

  const results: ItemResult[] = [];
  const startedAt = Date.now();
  let next = 0;

  // Trabalhadores em paralelo puxando da mesma lista: é assim que N abas do produto se comportam.
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (;;) {
        const index = next++;
        if (index >= fileCount) return;
        const result = await sendOne(index, cookie, sources[index % sources.length]);
        results.push(result);
        const marca = result.ok ? 'ok  ' : 'FALHA';
        console.log(
          `  ${marca} #${String(index).padStart(3)} ${result.fileName.slice(0, 28).padEnd(28)} ` +
            `total ${String(result.totalMs).padStart(6)}ms ` +
            `(envio ${result.analyzeMs}ms, fila ${result.waitMs}ms, confirm ${result.confirmMs}ms)` +
            (result.status ? ` · ${result.status}` : '') +
            (result.error ? ` · ${result.error}` : ''),
        );
      }
    }),
  );

  const elapsedMs = Date.now() - startedAt;
  const ok = results.filter((item) => item.ok);
  const totals = ok.map((item) => item.totalMs);

  console.log('\n— resumo —');
  console.log(`concluídos: ${ok.length}/${results.length} em ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`vazão: ${((ok.length / elapsedMs) * 60_000).toFixed(1)} documentos/minuto`);
  console.log(
    `tempo por documento: mediana ${percentile(totals, 50)}ms · p95 ${percentile(totals, 95)}ms · ` +
      `pior ${Math.max(0, ...totals)}ms`,
  );
  console.log(
    `média por etapa: envio ${Math.round(ok.reduce((sum, i) => sum + i.analyzeMs, 0) / (ok.length || 1))}ms · ` +
      `fila ${Math.round(ok.reduce((sum, i) => sum + i.waitMs, 0) / (ok.length || 1))}ms · ` +
      `confirm ${Math.round(ok.reduce((sum, i) => sum + i.confirmMs, 0) / (ok.length || 1))}ms`,
  );

  const falhas = results.filter((item) => !item.ok);
  if (falhas.length > 0) {
    console.log('\nfalhas:');
    const porMotivo = new Map<string, number>();
    for (const falha of falhas) {
      const motivo = falha.error ?? 'desconhecido';
      porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
    }
    for (const [motivo, quantidade] of porMotivo) console.log(`  ${quantidade}x ${motivo}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
