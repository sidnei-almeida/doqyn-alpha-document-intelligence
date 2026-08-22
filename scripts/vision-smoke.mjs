// Prova viva do Vision OCR: gera uma imagem com texto conhecido, manda para a
// Vision API e confere que o texto volta. Existe porque
// `deploy/scripts/validate-vision-ready.sh` só valida credencial em disco — ele
// diz "pronto" mesmo quando a API recusa a chamada por billing ou permissão.
//
// Uso: node scripts/vision-smoke.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(REPO, '.env') });

const EXPECTED = 'DOQYN OCR 2026';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240">
  <rect width="900" height="240" fill="white"/>
  <text x="40" y="140" font-family="DejaVu Sans, sans-serif" font-size="72" fill="black">${EXPECTED}</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();

const { ocrImageBuffer } = await import('../server/ai/vision/visionOcrService.ts');
const { getVisionOcrHealth } = await import('../server/ai/vision/visionConfig.ts');

console.log('health:', JSON.stringify(getVisionOcrHealth()));

const startedAt = Date.now();
const page = await ocrImageBuffer(png);
const durationMs = Date.now() - startedAt;

const got = page.text.replace(/\s+/g, ' ').trim();
const ok = got.includes(EXPECTED);

console.log(`texto lido: ${JSON.stringify(got)}`);
console.log(`confianca: ${page.confidence ?? 'n/d'}`);
console.log(`latencia: ${durationMs}ms`);
console.log(ok ? 'OK — Vision respondeu e o texto bate' : `FALHOU — esperado conter ${JSON.stringify(EXPECTED)}`);

process.exit(ok ? 0 : 1);
