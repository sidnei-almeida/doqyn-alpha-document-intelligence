#!/usr/bin/env node
/**
 * Compila api/, server/, shared/ e scripts operacionais para dist/ (ESM, Node).
 * Usado em produção: node dist/server/production-server.js
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

const SOURCE_ROOTS = ['api', 'server', 'shared'];
const SCRIPT_ROOTS = ['scripts/ensure-mongodb-indexes.ts', 'scripts/lib'];

function collectTsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectTsFiles(full, acc);
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

function collectInputs() {
  const inputs = [];
  for (const root of SOURCE_ROOTS) {
    collectTsFiles(join(ROOT, root), inputs);
  }
  for (const scriptPath of SCRIPT_ROOTS) {
    const full = join(ROOT, scriptPath);
    if (existsSync(full)) {
      if (statSync(full).isDirectory()) {
        collectTsFiles(full, inputs);
      } else if (full.endsWith('.ts')) {
        inputs.push(full);
      }
    }
  }
  return inputs;
}

function copyRuntimeAssets() {
  const previewAssetsSrc = join(ROOT, 'server/preview/assets');
  const previewAssetsDest = join(DIST, 'server/preview/assets');
  if (existsSync(previewAssetsSrc)) {
    mkdirSync(join(DIST, 'server/preview'), { recursive: true });
    cpSync(previewAssetsSrc, previewAssetsDest, { recursive: true });
  }
}

function main() {
  const inputs = collectInputs();
  if (inputs.length === 0) {
    console.error('build-server: nenhum arquivo .ts encontrado.');
    process.exit(1);
  }

  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true, force: true });
  }

  esbuild.buildSync({
    entryPoints: inputs,
    outdir: DIST,
    outbase: ROOT,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    target: 'node22',
    sourcemap: true,
    logLevel: 'info',
  });

  copyRuntimeAssets();

  const productionEntry = join(DIST, 'server/production-server.js');
  if (!existsSync(productionEntry)) {
    console.error('build-server: entry de produção ausente:', relative(ROOT, productionEntry));
    process.exit(1);
  }

  console.log(`build-server: ${inputs.length} arquivos → dist/`);
}

main();
