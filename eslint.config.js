import js from '@eslint/js';
import globals from 'globals';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  /**
   * O freio da internacionalização (Fase 0 do `.planning/I18N-PLANO.md`).
   *
   * Enquanto a Fase 6 extrai as telas uma a uma, o desenvolvimento normal continua — e sem
   * este aviso ele acrescenta strings cravadas mais rápido do que a migração as remove. É a
   * única parte do plano cujo custo cresce a cada dia que não é feita.
   *
   * Nasce em `warn` porque hoje o app é inteiro em português: subir para `error` agora
   * bloquearia todo mundo por um passivo conhecido. Cada onda da Fase 6 promove a **sua**
   * pasta para `error` ao terminar, e aí o que foi limpo não volta a sujar.
   */
  {
    files: ['src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': {
            include: ['label', 'title', 'placeholder', 'alt', 'aria-label', 'description'],
          },
        },
      ],
    },
  },
  /**
   * Onda 6.1 concluída: `components/` não volta a ganhar string cravada.
   *
   * A promoção para `error` é o que dá sentido a terminar uma onda. Sem ela, a pasta limpa hoje
   * volta a sujar amanhã e a migração vira trabalho de Sísifo. Cada onda seguinte acrescenta a
   * sua pasta a esta lista ao fechar.
   */
  {
    files: ['src/components/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': {
            include: ['label', 'title', 'placeholder', 'alt', 'aria-label', 'description'],
          },
        },
      ],
    },
  },
);
