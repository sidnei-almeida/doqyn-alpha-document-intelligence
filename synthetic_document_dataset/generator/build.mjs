#!/usr/bin/env node
/**
 * Gera o conjunto difícil de documentos sintéticos.
 *
 *   node synthetic_document_dataset/generator/build.mjs
 *
 * Escreve em `hard/pdf`, `hard/scanned_pdf`, `hard/images` e produz
 * `hard/GROUND_TRUTH.json` — sem o gabarito os arquivos são só papel bonito, e
 * medir extração a olho não escala além do terceiro documento.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToPdf } from './lib/render.mjs';
import { degradeToScannedPdf, degradeToPng, pdfPageCount } from './lib/degrade.mjs';
import { JURIDICO_CASES } from './cases/juridico.mjs';
import { CONTRATOS_CASES } from './cases/contratos.mjs';
import { FINANCEIRO_CASES } from './cases/financeiro.mjs';
import { OPERACAO_CASES } from './cases/operacao.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET_ROOT = join(HERE, '..');
const OUT_ROOT = join(DATASET_ROOT, 'hard');

const ALL_CASES = [
  ...JURIDICO_CASES,
  ...CONTRATOS_CASES,
  ...FINANCEIRO_CASES,
  ...OPERACAO_CASES,
];

/** Campos que cada classe declara no seed de governança do app. */
const CLASS_FIELDS = {
  'Jurídico': ['parte_reveladora', 'parte_receptora', 'data_assinatura'],
  'Contratos': ['fornecedor', 'data_assinatura'],
  'Financeiro': ['fornecedor', 'numero_nota', 'data_emissao'],
  'Recursos Humanos': ['titulo', 'referencia', 'data_assinatura'],
  'Compras': ['titulo', 'referencia', 'data_assinatura'],
  'Operacional': ['titulo', 'referencia', 'data_assinatura'],
};

function groundTruthFor(testCase) {
  const fields = testCase.className ? (CLASS_FIELDS[testCase.className] ?? []) : [];
  const expected = {};

  for (const key of fields) {
    if (testCase.expectNull?.includes(key)) {
      expected[key] = { expected: null, reason: 'abstenção — o dado não está no documento' };
      continue;
    }
    const declared = testCase.expected?.[key];
    expected[key] = declared
      ? {
          value: declared.value,
          normalizedValue: declared.normalized,
          acceptableValues: declared.acceptable ?? [],
          nullAcceptable: declared.nullAcceptable ?? false,
          note: declared.note,
        }
      : { expected: null, reason: 'campo não presente neste documento' };
  }

  return expected;
}

async function main() {
  await mkdir(join(OUT_ROOT, 'pdf'), { recursive: true });
  await mkdir(join(OUT_ROOT, 'scanned_pdf'), { recursive: true });
  await mkdir(join(OUT_ROOT, 'images'), { recursive: true });

  const manifest = [];

  for (const testCase of ALL_CASES) {
    const pdfPath = join(OUT_ROOT, 'pdf', testCase.file);
    process.stdout.write(`→ ${testCase.id} … `);

    await htmlToPdf(testCase.html(), pdfPath);
    const pages = await pdfPageCount(pdfPath);

    const artifacts = [{ path: `hard/pdf/${testCase.file}`, kind: 'pdf_digital', pages }];

    if (testCase.scanned) {
      const scannedName = testCase.file.replace(/\.pdf$/, `__${testCase.scanned}.pdf`);
      const scannedPath = join(OUT_ROOT, 'scanned_pdf', scannedName);
      await degradeToScannedPdf(pdfPath, scannedPath, testCase.scanned);
      artifacts.push({
        path: `hard/scanned_pdf/${scannedName}`,
        kind: 'pdf_escaneado',
        pages,
        profile: testCase.scanned,
        note: 'Sem camada de texto — força o caminho de OCR.',
      });

      const pngName = testCase.file.replace(/\.pdf$/, `__${testCase.scanned}.png`);
      const pngPath = join(OUT_ROOT, 'images', pngName);
      await degradeToPng(pdfPath, pngPath, testCase.scanned);
      artifacts.push({
        path: `hard/images/${pngName}`,
        kind: 'imagem',
        pages: 1,
        profile: testCase.scanned,
        note: 'Primeira página apenas — testa o upload de imagem solta.',
      });
    }

    manifest.push({
      id: testCase.id,
      artifacts,
      expectedClass: testCase.className,
      ambiguousClasses: testCase.ambiguousClasses,
      difficulty: testCase.difficulty,
      expectsReview: testCase.expectReview ?? false,
      expectsLowConfidence: testCase.expectLowConfidence ?? false,
      traps: testCase.traps ?? [],
      expectedFields: groundTruthFor(testCase),
      forbiddenValues: testCase.mustNotContain ?? {},
    });

    process.stdout.write(`${artifacts.length} arquivo(s), ${pages} pág.\n`);
  }

  const groundTruth = {
    generatedAt: new Date().toISOString().slice(0, 10),
    description:
      'Gabarito do conjunto difícil. Cada caso declara a classe esperada, o valor de cada campo ' +
      'nas duas formas (literal e normalizada), os valores que caracterizam erro, e a armadilha ' +
      'que o documento exercita.',
    fieldContract: {
      value: 'O que está literalmente escrito no documento.',
      normalizedValue:
        'A forma padronizada: data em yyyy-mm-dd, moeda como número com ponto decimal, ' +
        'CPF/CNPJ só com dígitos.',
      acceptableValues: 'Alternativas igualmente corretas — não contam como erro.',
      nullAcceptable: 'Abster-se também é resposta correta neste campo.',
    },
    classFields: CLASS_FIELDS,
    cases: manifest,
  };

  await writeFile(
    join(OUT_ROOT, 'GROUND_TRUTH.json'),
    `${JSON.stringify(groundTruth, null, 2)}\n`,
    'utf8',
  );

  const counts = manifest.reduce(
    (acc, item) => {
      acc.files += item.artifacts.length;
      acc.scanned += item.artifacts.filter((a) => a.kind === 'pdf_escaneado').length;
      acc.images += item.artifacts.filter((a) => a.kind === 'imagem').length;
      return acc;
    },
    { files: 0, scanned: 0, images: 0 },
  );

  console.log(
    `\n${manifest.length} casos · ${counts.files} arquivos ` +
      `(${manifest.length} PDF digital, ${counts.scanned} escaneado, ${counts.images} imagem)`,
  );
  console.log(`Gabarito: hard/GROUND_TRUTH.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
