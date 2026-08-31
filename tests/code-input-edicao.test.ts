import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const source = readFileSync(
  join(ROOT, 'src/features/email-verification/components/CodeInput.tsx'),
  'utf8',
);

/**
 * Reproduz a aritmética de `handleChange` e `commit` sem montar React — o que se guarda aqui é a
 * regra, e ela cabe em duas linhas.
 */
const LENGTH = 6;

function type(value: string, index: number, typed: string) {
  const at = Math.min(index, value.length);
  const next = (value.slice(0, at) + typed + value.slice(at + typed.length)).slice(0, LENGTH);
  return { next, completes: next.length === LENGTH && value.length < LENGTH };
}

describe('campo de código — editar casa preenchida', () => {
  it('corrigir um dígito no meio substitui, e não dispara envio', () => {
    // O cenário do review: cinco dígitos, a pessoa volta e corrige o terceiro.
    const { next, completes } = type('12345', 2, '9');

    assert.equal(next, '12945', 'o dígito substitui a casa em vez de empurrar o resto');
    assert.equal(next.length, 5, 'o código não pode crescer ao corrigir');
    assert.equal(
      completes,
      false,
      'inserindo, o valor ia a seis e mandava ao servidor um código que ninguém escolheu — ' +
        'queimando uma das cinco tentativas',
    );
  });

  it('digitar na primeira casa vazia continua acrescentando', () => {
    assert.deepEqual(type('12', 2, '3').next, '123');
    assert.deepEqual(type('12945', 5, '6'), { next: '129456', completes: true });
  });

  it('colar por cima de casas preenchidas substitui todas elas', () => {
    assert.equal(type('123456', 0, '987').next, '987456');
  });

  it('o componente não voltou a inserir', () => {
    assert.ok(source.includes('value.slice(at + typed.length)'));
    assert.equal(source.includes('typed + value.slice(at))'), false);
  });
});
