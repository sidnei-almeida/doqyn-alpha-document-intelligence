import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { isPipelineDebugEnabled } from '../server/ai/utils/pipelineDebug.js';

const original = { node: process.env.NODE_ENV, debug: process.env.AI_PIPELINE_DEBUG };

afterEach(() => {
  process.env.NODE_ENV = original.node;
  process.env.AI_PIPELINE_DEBUG = original.debug;
});

describe('rastro do pipeline — onde pode aparecer', () => {
  it('liga em desenvolvimento com a variável', () => {
    process.env.NODE_ENV = 'development';
    process.env.AI_PIPELINE_DEBUG = 'true';
    assert.equal(isPipelineDebugEnabled(), true);
  });

  it('fica desligado em produção mesmo com a variável ligada', () => {
    // O rastro imprime trecho do documento e valor de campo. Em produção isso é dado de cliente
    // escrito no log da máquina — a variável não pode ser a única barreira.
    process.env.NODE_ENV = 'production';
    process.env.AI_PIPELINE_DEBUG = 'true';
    assert.equal(isPipelineDebugEnabled(), false);
  });

  it('desligado por padrão quando ninguém pediu', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AI_PIPELINE_DEBUG;
    assert.equal(isPipelineDebugEnabled(), false);
  });
});
