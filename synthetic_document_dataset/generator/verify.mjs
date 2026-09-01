#!/usr/bin/env node
/**
 * Confere o gabarito contra os arquivos gerados.
 *
 *   node synthetic_document_dataset/generator/verify.mjs
 *
 * Duas perguntas, e as duas já erraram sozinhas antes de existir este script:
 *
 * 1. Todo valor declarado como esperado aparece mesmo no texto do PDF digital?
 *    Um gabarito com erro de digitação transforma acerto do modelo em falha
 *    registrada, e ninguém desconfia do gabarito.
 * 2. Os PDFs escaneados estão realmente sem camada de texto? Se o texto vazar,
 *    o caso deixa de exercitar o OCR sem avisar, e o número de acerto sobe por
 *    motivo errado.
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET_ROOT = join(HERE, '..');

async function pdfText(path) {
  // `txtwrite` do Ghostscript basta e evita mais uma dependência: o que
  // importa aqui é haver ou não texto, e não a fidelidade da extração.
  const { stdout } = await run('gs', [
    '-q',
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=txtwrite',
    '-sOutputFile=-',
    path,
  ]);
  return stdout;
}

/** Compara ignorando acento, caixa e o espaçamento que a extração embaralha. */
function loose(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function collectExpectedLiterals(entry) {
  const literals = [];
  for (const [key, field] of Object.entries(entry.expectedFields ?? {})) {
    if (!field || field.expected === null) continue;
    if (field.value) literals.push({ key, text: field.value });
  }
  return literals;
}

async function main() {
  const groundTruth = JSON.parse(
    await readFile(join(DATASET_ROOT, 'hard', 'GROUND_TRUTH.json'), 'utf8'),
  );

  let failures = 0;
  let checked = 0;

  for (const entry of groundTruth.cases) {
    const digital = entry.artifacts.find((artifact) => artifact.kind === 'pdf_digital');
    const text = loose(await pdfText(join(DATASET_ROOT, digital.path)));

    for (const literal of collectExpectedLiterals(entry)) {
      checked += 1;
      if (!text.includes(loose(literal.text))) {
        failures += 1;
        console.log(
          `✗ ${entry.id} · ${literal.key}: gabarito diz "${literal.text}", ` +
            'e esse texto não está no PDF',
        );
      }
    }

    for (const scanned of entry.artifacts.filter((a) => a.kind === 'pdf_escaneado')) {
      checked += 1;
      const scannedText = (await pdfText(join(DATASET_ROOT, scanned.path))).trim();
      if (scannedText.length > 40) {
        failures += 1;
        console.log(
          `✗ ${entry.id} · ${scanned.path} tem camada de texto (${scannedText.length} chars) ` +
            '— não vai exercitar o OCR',
        );
      }
    }
  }

  console.log(
    failures === 0
      ? `\n✓ ${checked} verificações, nenhuma divergência entre gabarito e arquivos.`
      : `\n${failures} divergência(s) em ${checked} verificações.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
