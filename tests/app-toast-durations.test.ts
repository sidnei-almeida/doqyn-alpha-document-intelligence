import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const FEEDBACK = 'src/shared/feedback/appFeedback.ts';
const TOASTER = 'src/components/ui/AppToaster.tsx';

describe('avisos não ficam presos na tela', () => {
  it('nenhum tipo de aviso usa duração infinita', () => {
    const source = read(FEEDBACK);
    const durations = source.slice(
      source.indexOf('TOAST_DURATIONS'),
      source.indexOf('export function showAppToast'),
    );

    assert.equal(durations.includes('Infinity'), false, 'aviso com Infinity volta a travar a tela');
  });

  it('todo tipo declarado tem um teto numérico', () => {
    const source = read(FEEDBACK);
    for (const type of ['success', 'info', 'warning', 'error', 'loading']) {
      assert.match(
        source,
        new RegExp(`${type}:\\s*\\d+`),
        `tipo "${type}" sem teto de tempo declarado`,
      );
    }
  });

  it('erro fica mais tempo que sucesso — é o que precisa ser lido', () => {
    const source = read(FEEDBACK);
    const valueOf = (type: string) =>
      Number(new RegExp(`${type}:\\s*(\\d+)`).exec(source)?.[1] ?? '0');

    assert.ok(valueOf('error') > valueOf('success'), 'erro deveria durar mais que sucesso');
    assert.ok(valueOf('loading') >= valueOf('error'), 'carregando é teto, não deve ser o menor');
  });

  it('o Toaster define teto para quem chama o sonner direto', () => {
    const source = read(TOASTER);
    assert.match(source, /duration=\{TOAST_DURATIONS\./);
  });
});
