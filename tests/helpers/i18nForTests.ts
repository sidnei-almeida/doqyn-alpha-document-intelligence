/**
 * Liga o i18n no Node, com o catálogo `pt-BR` inteiro carregado de uma vez.
 *
 * Depois da extração, boa parte do que estes testes verificam deixou de ser literal no código e
 * passou a ser chave resolvida contra o catálogo. Um teste que afirma sobre a frase continua
 * sendo o teste certo — só precisa da ponta que faltava, e verificar a frase pelo catálogo é
 * mais forte do que verificá-la no código: prova a chave *e* o texto, e falha se qualquer uma
 * das duas se perder.
 *
 * Três detalhes que custaram tempo e valem registro:
 *
 * **Sem backend, a inicialização é síncrona.** `initI18n` registra o carregador por demanda, e
 * com um backend o i18next adia a inicialização para o próximo tick — `t()` chamado logo depois
 * devolveria `undefined`. Aqui todos os namespaces entram como recurso estático, e `init` termina
 * antes de retornar.
 *
 * **É a mesma instância do app.** O módulo `src/i18n` exporta um singleton, e é dele que o código
 * sob teste lê. Inicializar outro objeto não mudaria nada para quem chama `i18n.t`.
 *
 * **Chamar duas vezes não custa nada.** Vários arquivos de teste pedem o mesmo, e cada `describe`
 * pode chamar sem se coordenar com os outros.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { i18n } from '../../src/i18n';

const CATALOG_DIR = resolve(import.meta.dirname, '../../src/i18n/catalog/pt-BR');

let pronto = false;

export function initI18nForTests(): void {
  if (pronto) return;
  pronto = true;

  const resources: Record<string, Record<string, unknown>> = {};
  for (const arquivo of readdirSync(CATALOG_DIR)) {
    if (!arquivo.endsWith('.json')) continue;
    const namespace = arquivo.replace(/\.json$/, '');
    resources[namespace] = JSON.parse(readFileSync(resolve(CATALOG_DIR, arquivo), 'utf8'));
  }

  void i18n.init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'common',
    ns: Object.keys(resources),
    resources: { 'pt-BR': resources },
    interpolation: { escapeValue: false },
  });
}

/**
 * Um `t` de mentira, para quem só precisa provar que a chave certa chegou ao lugar certo.
 *
 * As funções que montam ficha de revisão passaram a receber `t` da tela. Quando o teste quer
 * verificar a estrutura — que a versão dos termos foi interpolada, que a seção de senha aparece —
 * e não a frase, este eco é mais direto do que carregar o catálogo: devolve a chave e os
 * parâmetros, e a asserção lê os dois.
 */
export function echoT(key: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return key;
  return `${key} ${Object.values(params).join(' ')}`;
}
