import { cn } from '@/lib/utils';

/** Item de menu/popover — alinhado ao design system DOQYN. */
/**
 * Item de menu — linha de registro, não pílula.
 *
 * O item era um retângulo arredondado que, quando selecionado, virava um bloco
 * preenchido. Era a última superfície do app falando a linguagem antiga: canto
 * redondo e preenchimento onde todo o resto do sistema usa canto reto e régua.
 *
 * Agora o item é uma linha de canto reto, e o escolhido ganha um fio de acento
 * na borda esquerda — a mesma reação que a régua do campo tem no foco, que a
 * linha de escolha tem no hover e que o item da sidebar tem quando está ativo.
 */
export const dropdownMenuItemClass = cn(
  'explorer-interactive type-label relative flex w-full items-center rounded-none px-3.5 py-2 text-left text-doqyn-text',
  'transition-colors duration-[var(--transition-duration-fast)]',
  'before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent',
  'hover:bg-doqyn-hover/50',
  'focus-visible:outline-none focus-visible:bg-doqyn-hover/50',
  'disabled:cursor-not-allowed disabled:opacity-40',
);

export const dropdownMenuItemSelectedClass =
  'bg-doqyn-hover/40 font-medium text-doqyn-text before:bg-doqyn-accent-active';

export const dropdownMenuItemDangerClass = 'text-doqyn-danger hover:bg-doqyn-danger-bg/30';
