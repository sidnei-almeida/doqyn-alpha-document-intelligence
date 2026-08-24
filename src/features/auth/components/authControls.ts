/**
 * Anatomia dos controles da antessala.
 *
 * Existe para que as telas parem de improvisar altura e canto. Enquanto cada
 * uma decidia sozinha, o login ficou com canto de 4px e os cadastros com 8px, e
 * a mesma família visual passou a ter dois cantos.
 *
 * Canto de 4px e superfície chapada: canto seco lê como instrumento, não como
 * aplicativo de consumo. O acento preenchido é raro — sobra só para a ação
 * principal de cada tela. Tudo o mais é contorno ou texto.
 */

const CONTROL_BASE =
  'inline-flex h-11 items-center justify-center gap-2.5 rounded-[4px] text-label font-medium ' +
  'transition-colors duration-[var(--transition-duration-fast)] ease-[var(--ease-standard)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg ' +
  'disabled:pointer-events-none disabled:opacity-45';

/** Ação principal da tela. Uma por tela — se houver duas, nenhuma é principal. */
export const AUTH_PRIMARY_BUTTON =
  CONTROL_BASE +
  ' px-5 bg-doqyn-accent-active text-doqyn-on-accent hover:bg-doqyn-accent-hover ' +
  'disabled:bg-doqyn-card disabled:text-doqyn-subtle';

/** Ação secundária: contorno fino, sem preenchimento. */
export const AUTH_SECONDARY_BUTTON =
  CONTROL_BASE +
  ' px-5 border border-doqyn-border bg-transparent text-doqyn-text ' +
  'hover:border-doqyn-border-strong hover:bg-doqyn-hover';

/** Sair sem concluir. Texto puro — voltar não é uma ação que se anuncia. */
export const AUTH_QUIET_BUTTON =
  CONTROL_BASE + ' px-1 text-doqyn-muted underline-offset-4 hover:text-doqyn-text hover:underline';

/**
 * Entrada de uma lista de escolha — a régua, não a caixa.
 *
 * Os cards com borda, preenchimento e ícone em quadradinho quebravam a
 * linguagem que os campos já tinham estabelecido: linha, não caixa. Aqui a
 * entrada é uma linha de registro, separada por fio, e o acento entra como uma
 * régua na borda esquerda quando a pessoa passa por cima — a mesma reação que a
 * régua do campo tem no foco.
 */
export const AUTH_CHOICE_ROW =
  'group relative flex w-full items-baseline gap-4 border-b border-doqyn-border-subtle ' +
  'py-4 pl-4 pr-2 text-left transition-colors ' +
  'before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent ' +
  'before:transition-colors hover:before:bg-doqyn-accent-active ' +
  'hover:bg-doqyn-hover/40 ' +
  'focus-visible:outline-none focus-visible:before:bg-doqyn-accent-active ' +
  'focus-visible:bg-doqyn-hover/40';
