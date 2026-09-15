/**
 * O único arquivo do projeto que fala uma API exclusiva do Vite.
 *
 * `import.meta.glob` não existe fora dele. Enquanto esta chamada morava em `index.ts`, qualquer
 * teste que importasse — por qualquer caminho, ainda que três módulos adiante — algo que puxasse
 * o i18n estourava no carregamento, com `(intermediate value).glob is not a function`. Foram 33
 * arquivos de teste com essa dependência transitiva, e o erro não parecia ter nada com tradução.
 *
 * Isolado aqui, o resto do i18n volta a ser TypeScript comum, que roda em Node. Quem precisa dos
 * catálogos por demanda importa este módulo dinamicamente e trata a falha: fora do Vite, o
 * resultado é um mapa vazio, e sobra o catálogo `pt-BR` que já vem embutido — que é exatamente o
 * que um teste ou um script de linha de comando precisa.
 */
export const catalogLoaders = import.meta.glob<{ default: Record<string, unknown> }>(
  './catalog/*/*.json',
);
