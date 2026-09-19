import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, it } from 'node:test';

/** Sobe um processo de verdade: o que se quer provar é o comportamento do sinal, não a função. */
function runGuardedProcess(script: string): {
  done: Promise<{ code: number | null; output: string }>;
  child: ReturnType<typeof spawn>;
} {
  const child = spawn(process.execPath, ['--import', 'tsx', '--eval', script], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => (output += String(chunk)));
  child.stderr?.on('data', (chunk) => (output += String(chunk)));
  const done = new Promise<{ code: number | null; output: string }>((resolve) => {
    child.on('exit', (code) => resolve({ code, output }));
  });
  return { done, child };
}

const BOOT = `
  const { installProcessGuards, onShutdown } = await import('./server/runtime/shutdown.ts');
  installProcessGuards('teste');
  onShutdown('recurso de teste', () => { console.log('FECHOU'); });
  setInterval(() => {}, 1000);
  console.log('PRONTO');
`;

async function waitForReady(child: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolve) => {
    const onData = (chunk: Buffer) => {
      if (String(chunk).includes('PRONTO')) {
        child.stdout?.off('data', onData);
        resolve();
      }
    };
    child.stdout?.on('data', onData);
  });
}

describe('desligamento do processo', () => {
  it('SIGTERM fecha os recursos registrados e sai com 0', async () => {
    const { done, child } = runGuardedProcess(BOOT);
    await waitForReady(child);
    child.kill('SIGTERM');
    const { code, output } = await done;
    assert.equal(code, 0, `saiu com ${code}: ${output}`);
    assert.ok(output.includes('FECHOU'), `não fechou o recurso: ${output}`);
  });

  it('promessa rejeitada sem dono é registrada e não derruba o processo', async () => {
    const { done, child } = runGuardedProcess(
      BOOT + `\n  Promise.reject(new Error('solta'));\n  setTimeout(() => process.exit(7), 1500);`,
    );
    const { code, output } = await done;
    assert.equal(code, 7, `o processo caiu antes da hora: ${output}`);
    assert.ok(output.includes('solta'), `a rejeição não foi registrada: ${output}`);
  });
});
