import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const run = promisify(execFile);

/**
 * Perfis de degradação — cada um imita um jeito real de o papel chegar ruim.
 *
 * Nenhum deles é "ruído aleatório em cima do PDF". O que quebra OCR na prática
 * é específico: a inclinação do alimentador, o contraste perdido na terceira
 * fotocópia, o carimbo por cima do valor, o JPEG de 45% que o celular gerou.
 * Um perfil por causa é o que deixa a falha diagnosticável depois.
 */
export const DEGRADATION_PROFILES = {
  /** Scanner de mesa em modo rápido: leve inclinação, granulação, JPEG apertado. */
  scanner_rapido: {
    dpi: 200,
    rotate: -1.2,
    noise: 6,
    blur: 0.3,
    brightness: 1.02,
    contrast: 0.96,
    jpegQuality: 62,
  },
  /** Terceira fotocópia: contraste comido, fundo acinzentado, texto engrossado. */
  fotocopia_terceira_geracao: {
    dpi: 180,
    rotate: 0.7,
    noise: 10,
    blur: 0.7,
    brightness: 1.12,
    contrast: 0.72,
    jpegQuality: 55,
    grayscale: true,
  },
  /** Foto de celular sobre a mesa: perspectiva leve, sombra de um lado, brilho irregular. */
  foto_celular: {
    dpi: 160,
    rotate: 2.4,
    noise: 8,
    blur: 0.5,
    brightness: 1.05,
    contrast: 0.88,
    jpegQuality: 48,
    shadowGradient: true,
  },
  /** Fax / digitalização monocromática: limiar duro, serrilhado, perde tom de cinza. */
  fax_monocromatico: {
    dpi: 150,
    rotate: -0.5,
    noise: 4,
    blur: 0.3,
    threshold: 168,
    jpegQuality: 70,
  },
};

async function pdfToPngPages(pdfPath, dpi, workDir) {
  const pattern = join(workDir, 'page-%03d.png');
  await run('gs', [
    '-q',
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=png16m',
    `-r${dpi}`,
    `-sOutputFile=${pattern}`,
    pdfPath,
  ]);
  const files = (await readdir(workDir)).filter((name) => name.endsWith('.png')).sort();
  return files.map((name) => join(workDir, name));
}

/** Gradiente de sombra em SVG — o lado do papel que ficou longe da luz. */
function shadowOverlay(width, height) {
  return Buffer.from(
    `<svg width="${width}" height="${height}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="1" y2="0.35">
           <stop offset="0%" stop-color="#000" stop-opacity="0.22"/>
           <stop offset="45%" stop-color="#000" stop-opacity="0.04"/>
           <stop offset="100%" stop-color="#000" stop-opacity="0.14"/>
         </linearGradient>
       </defs>
       <rect width="${width}" height="${height}" fill="url(#g)"/>
     </svg>`,
  );
}

async function degradePage(pngPath, profile) {
  let pipeline = sharp(pngPath).rotate(profile.rotate, {
    background: { r: 246, g: 245, b: 240 },
  });

  if (profile.grayscale) pipeline = pipeline.grayscale();
  // `sharp` recusa sigma abaixo de 0.3; menos que isso não borra nada mesmo.
  if (profile.blur && profile.blur >= 0.3) pipeline = pipeline.blur(profile.blur);

  // linear(a, b) resolve a*x + b por canal. `a` é o contraste em torno do meio
  // da escala, e `b` recoloca o meio no lugar e ainda soma o desvio de brilho —
  // é assim que uma fotocópia clareia o fundo e come o preto ao mesmo tempo.
  const contrast = profile.contrast ?? 1;
  const brightnessOffset = ((profile.brightness ?? 1) - 1) * 128;
  pipeline = pipeline.linear(contrast, 128 * (1 - contrast) + brightnessOffset);

  if (profile.shadowGradient) {
    const rotated = await pipeline.png().toBuffer();
    const meta = await sharp(rotated).metadata();
    pipeline = sharp(rotated).composite([
      { input: shadowOverlay(meta.width, meta.height), blend: 'multiply' },
    ]);
  }

  if (profile.threshold) {
    pipeline = pipeline.grayscale().threshold(profile.threshold);
  }

  // O ruído entra por último: antes do blur ele seria filtrado, e é justamente
  // a granulação sobre o texto já borrado que derruba o reconhecimento.
  const base = await pipeline.png().toBuffer();
  const meta = await sharp(base).metadata();
  const grain = Buffer.alloc(meta.width * meta.height * 3);
  const amplitude = profile.noise ?? 0;
  for (let i = 0; i < grain.length; i += 3) {
    const value = 128 + Math.round((Math.random() - 0.5) * 2 * amplitude);
    grain[i] = value;
    grain[i + 1] = value;
    grain[i + 2] = value;
  }

  return sharp(base)
    .composite([
      {
        input: grain,
        raw: { width: meta.width, height: meta.height, channels: 3 },
        blend: 'overlay',
      },
    ])
    .jpeg({ quality: profile.jpegQuality ?? 60, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

/**
 * Reempacota as páginas degradadas num PDF sem camada de texto.
 *
 * É esse arquivo que exercita o caminho do OCR: `pdf-parse` não encontra texto
 * nenhum nele e o pipeline precisa cair para a visão computacional, que é o
 * ramo que quase nunca é testado porque todo PDF de teste nasce digital.
 */
export async function degradeToScannedPdf(pdfPath, outputPath, profileName) {
  const profile = DEGRADATION_PROFILES[profileName];
  if (!profile) throw new Error(`Perfil de degradação desconhecido: ${profileName}`);

  const workDir = await mkdtemp(join(tmpdir(), 'doqyn-degrade-'));
  try {
    const pages = await pdfToPngPages(pdfPath, profile.dpi, workDir);
    const pdf = await PDFDocument.create();

    for (const page of pages) {
      const jpeg = await degradePage(page, profile);
      const embedded = await pdf.embedJpg(jpeg);
      // A4 em pontos: mantém o tamanho físico e joga a perda toda na resolução,
      // que é o que acontece de verdade quando alguém digitaliza baixo.
      const sheet = pdf.addPage([595.28, 841.89]);
      sheet.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }

    await writeFile(outputPath, await pdf.save());
    return pages.length;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Primeira página degradada como PNG solto — para testar o caminho de imagem. */
export async function degradeToPng(pdfPath, outputPath, profileName) {
  const profile = DEGRADATION_PROFILES[profileName];
  if (!profile) throw new Error(`Perfil de degradação desconhecido: ${profileName}`);

  const workDir = await mkdtemp(join(tmpdir(), 'doqyn-degrade-png-'));
  try {
    const [firstPage] = await pdfToPngPages(pdfPath, profile.dpi, workDir);
    const jpeg = await degradePage(firstPage, profile);
    await sharp(jpeg).png({ compressionLevel: 9 }).toFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function pdfPageCount(pdfPath) {
  const bytes = await readFile(pdfPath);
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}
