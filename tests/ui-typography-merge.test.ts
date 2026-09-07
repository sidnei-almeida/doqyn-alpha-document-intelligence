import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../src/lib/utils.js';

describe('cn — tamanho e cor de texto não são o mesmo grupo', () => {
  it('a cor da variante sobrevive ao tamanho declarado depois', () => {
    // É a ordem que a `cva` produz: `variant` primeiro, `size` depois. Sem a escala declarada
    // ao `tailwind-merge`, `text-label` engolia `text-doqyn-new-button-text` e todo botão do app
    // ficava herdando a cor do pai — quase preto sobre o verdigris no tema claro.
    const classes = cn('bg-doqyn-new-button text-doqyn-new-button-text', 'h-8 px-3 text-label');

    assert.ok(classes.includes('text-doqyn-new-button-text'));
    assert.ok(classes.includes('text-label'));
  });

  it('dois tamanhos ainda colidem, e o último vence', () => {
    // O agrupamento não pode ficar frouxo a ponto de deixar duas medidas conviverem.
    const classes = cn('text-body', 'text-micro');

    assert.equal(classes.includes('text-body'), false);
    assert.ok(classes.includes('text-micro'));
  });

  it('duas cores ainda colidem, e a última vence', () => {
    const classes = cn('text-doqyn-muted', 'text-doqyn-text');

    assert.equal(classes.includes('text-doqyn-muted'), false);
    assert.ok(classes.includes('text-doqyn-text'));
  });
});
