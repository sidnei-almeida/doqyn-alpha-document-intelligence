import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getInferenceConfig,
  getInferenceProviderName,
  isInferenceConfigured,
  resolveInferenceModel,
} from '../server/ai/providers/inferenceProvider.js';
import {
  getGroqClassifierModel,
  getGroqEvaluatorModel,
  getGroqExtractorModel,
  getGroqModel,
  isGroqApiKeyConfigured,
} from '../server/ai/services/groqClient.js';

const CHAVES = [
  'INFERENCE_PROVIDER',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'GROQ_CLASSIFIER_MODEL',
  'GROQ_EXTRACTOR_MODEL',
  'GROQ_EVALUATOR_MODEL',
  'FIREWORKS_API_KEY',
  'FIREWORKS_BASE_URL',
  'FIREWORKS_MODEL',
  'FIREWORKS_CLASSIFIER_MODEL',
  'FIREWORKS_EXTRACTOR_MODEL',
  'FIREWORKS_EVALUATOR_MODEL',
] as const;

const original = new Map(CHAVES.map((chave) => [chave, process.env[chave]]));

afterEach(() => {
  for (const [chave, valor] of original) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

function limpar(): void {
  for (const chave of CHAVES) delete process.env[chave];
}

describe('o caminho Groq não muda', () => {
  it('sem INFERENCE_PROVIDER, o fornecedor é groq e o endereço é o padrão do SDK', () => {
    limpar();
    assert.equal(getInferenceProviderName(), 'groq');
    assert.equal(getInferenceConfig().baseURL, null, 'baseURL nulo mantém o endereço da Groq');
    assert.equal(getInferenceConfig().apiKeyEnvName, 'GROQ_API_KEY');
  });

  it('valor desconhecido em INFERENCE_PROVIDER cai em groq, não em erro', () => {
    limpar();
    process.env.INFERENCE_PROVIDER = 'openai';
    assert.equal(getInferenceProviderName(), 'groq');
  });

  it('as variáveis por papel da Groq continuam mandando, na mesma ordem', () => {
    limpar();
    process.env.GROQ_MODEL = 'modelo-geral';
    assert.equal(getGroqModel(), 'modelo-geral');
    assert.equal(getGroqClassifierModel(), 'modelo-geral');
    assert.equal(getGroqExtractorModel(), 'modelo-geral');
    assert.equal(getGroqEvaluatorModel(), 'modelo-geral');

    process.env.GROQ_CLASSIFIER_MODEL = 'classificador';
    process.env.GROQ_EXTRACTOR_MODEL = 'extrator';
    process.env.GROQ_EVALUATOR_MODEL = 'avaliador';
    assert.equal(getGroqClassifierModel(), 'classificador');
    assert.equal(getGroqExtractorModel(), 'extrator');
    assert.equal(getGroqEvaluatorModel(), 'avaliador');
    assert.equal(getGroqModel(), 'modelo-geral');
  });

  it('sem nenhuma variável de modelo, o default da Groq é o de sempre', () => {
    limpar();
    assert.equal(getGroqModel(), 'openai/gpt-oss-120b');
  });

  it('a configuração é medida pela GROQ_API_KEY', () => {
    limpar();
    assert.equal(isGroqApiKeyConfigured(), false);
    process.env.GROQ_API_KEY = 'gsk_falsa';
    assert.equal(isGroqApiKeyConfigured(), true);
  });

  it('chave do Fireworks presente não configura nada enquanto o fornecedor for groq', () => {
    limpar();
    process.env.FIREWORKS_API_KEY = 'fw_falsa';
    assert.equal(isInferenceConfigured(), false, 'a chave do outro fornecedor não vale aqui');
  });
});

describe('o caminho Fireworks nasce inerte', () => {
  it('selecionado, aponta para o endereço e a chave dele', () => {
    limpar();
    process.env.INFERENCE_PROVIDER = 'fireworks';
    const config = getInferenceConfig();
    assert.equal(config.provider, 'fireworks');
    assert.equal(config.baseURL, 'https://api.fireworks.ai/inference/v1');
    assert.equal(config.apiKeyEnvName, 'FIREWORKS_API_KEY');
    assert.equal(config.apiKey, null, 'sem chave, e isso não pode explodir');
  });

  it('o default de modelo é o ID do Fireworks, não o da Groq', () => {
    limpar();
    process.env.INFERENCE_PROVIDER = 'fireworks';
    // O mesmo modelo tem ID diferente nos dois: default global daria 404 no dia da troca.
    assert.equal(resolveInferenceModel('default'), 'accounts/fireworks/models/gpt-oss-120b');
    assert.equal(getGroqModel(), 'accounts/fireworks/models/gpt-oss-120b');
  });

  it('as variáveis GROQ_* são ignoradas quando o fornecedor é fireworks', () => {
    limpar();
    process.env.INFERENCE_PROVIDER = 'fireworks';
    process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
    process.env.GROQ_CLASSIFIER_MODEL = 'nao-deve-vazar';
    assert.equal(getGroqClassifierModel(), 'accounts/fireworks/models/gpt-oss-120b');
  });

  it('respeita as variáveis por papel do Fireworks', () => {
    limpar();
    process.env.INFERENCE_PROVIDER = 'fireworks';
    process.env.FIREWORKS_MODEL = 'geral-fw';
    process.env.FIREWORKS_EVALUATOR_MODEL = 'juiz-fw';
    assert.equal(getGroqExtractorModel(), 'geral-fw');
    assert.equal(getGroqEvaluatorModel(), 'juiz-fw');
  });

  it('o endereço pode ser sobrescrito, para proxy ou região', () => {
    limpar();
    process.env.INFERENCE_PROVIDER = 'fireworks';
    process.env.FIREWORKS_BASE_URL = 'https://proxy.interno/v1';
    assert.equal(getInferenceConfig().baseURL, 'https://proxy.interno/v1');
  });
});
