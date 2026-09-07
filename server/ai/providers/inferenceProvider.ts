/**
 * Qual endpoint de inferência atende as chamadas de texto.
 *
 * Não confundir com `DOCUMENT_ANALYSIS_PROVIDER`, que escolhe o **pipeline** (`groq` faz
 * classificação e extração com LLM; `google_vision` é outro caminho inteiro). Aqui a pergunta é
 * outra e mais estreita: dado que o pipeline de LLM está em uso, contra qual API ele fala. São
 * dois eixos independentes, e juntá-los num só faria "trocar de fornecedor de inferência" parecer
 * "trocar de arquitetura".
 *
 * O Fireworks expõe a API no formato da OpenAI, e o `groq-sdk` é um cliente desse mesmo formato —
 * ele aceita `baseURL`. Então trocar de fornecedor é trocar endereço, chave e ID de modelo, e tudo
 * que vive em volta da chamada continua valendo: o limitador de vazão, a calibração por cabeçalho,
 * a repetição de JSON inválido, o orçamento de tokens e o tratamento de saturação. Escrever um
 * cliente HTTP novo jogaria fora essas quatro coisas para ganhar nada.
 *
 * **Tudo aqui é lido preguiçosamente.** Nenhuma variável `FIREWORKS_*` é tocada no carregamento do
 * módulo: sem chave e sem crédito, este caminho não pode impedir a API nem o worker de subir.
 */
import { DEFAULT_GROQ_MODEL } from '../utils/aiConfig.js';

export type InferenceProviderName = 'groq' | 'fireworks';

/**
 * O mesmo modelo tem ID diferente em cada fornecedor: `openai/gpt-oss-120b` na Groq,
 * `accounts/fireworks/models/gpt-oss-120b` no Fireworks. Um default global de modelo, como havia
 * antes, garante 404 no dia da troca — por isso o default é por fornecedor.
 */
const DEFAULT_FIREWORKS_MODEL = 'accounts/fireworks/models/gpt-oss-120b';
const DEFAULT_FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1';

export type InferenceRole = 'classifier' | 'extractor' | 'evaluator' | 'default';

export type InferenceConfig = {
  provider: InferenceProviderName;
  apiKey: string | null;
  /** `null` mantém o endereço padrão do SDK, que é o da Groq. */
  baseURL: string | null;
  /** Nome da variável de ambiente da chave, para a mensagem de erro apontar o lugar certo. */
  apiKeyEnvName: string;
};

export function getInferenceProviderName(): InferenceProviderName {
  const configured = process.env.INFERENCE_PROVIDER?.trim().toLowerCase();
  return configured === 'fireworks' ? 'fireworks' : 'groq';
}

export function getInferenceConfig(): InferenceConfig {
  if (getInferenceProviderName() === 'fireworks') {
    return {
      provider: 'fireworks',
      apiKey: process.env.FIREWORKS_API_KEY?.trim() || null,
      baseURL: process.env.FIREWORKS_BASE_URL?.trim() || DEFAULT_FIREWORKS_BASE_URL,
      apiKeyEnvName: 'FIREWORKS_API_KEY',
    };
  }

  return {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY?.trim() || null,
    baseURL: null,
    apiKeyEnvName: 'GROQ_API_KEY',
  };
}

export function isInferenceConfigured(): boolean {
  return Boolean(getInferenceConfig().apiKey);
}

/**
 * O modelo de um papel, no fornecedor ativo.
 *
 * A ordem é a mesma dos dois lados: variável do papel, variável geral do fornecedor, default do
 * fornecedor. Manter `GROQ_CLASSIFIER_MODEL` e companhia funcionando exatamente como antes não é
 * detalhe — é o que garante que ligar o Fireworks um dia não mude nada enquanto ele estiver
 * desligado.
 */
export function resolveInferenceModel(role: InferenceRole): string {
  if (getInferenceProviderName() === 'fireworks') {
    const general = process.env.FIREWORKS_MODEL?.trim() || DEFAULT_FIREWORKS_MODEL;
    if (role === 'classifier') return process.env.FIREWORKS_CLASSIFIER_MODEL?.trim() || general;
    if (role === 'extractor') return process.env.FIREWORKS_EXTRACTOR_MODEL?.trim() || general;
    if (role === 'evaluator') return process.env.FIREWORKS_EVALUATOR_MODEL?.trim() || general;
    return general;
  }

  const general = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  if (role === 'classifier') return process.env.GROQ_CLASSIFIER_MODEL?.trim() || general;
  if (role === 'extractor') return process.env.GROQ_EXTRACTOR_MODEL?.trim() || general;
  if (role === 'evaluator') return process.env.GROQ_EVALUATOR_MODEL?.trim() || general;
  return general;
}
