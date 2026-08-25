/**
 * Paleta dos grupos documentais.
 *
 * As cinco cores antigas eram um empréstimo dos tokens de estado: um grupo "vermelho" pegava
 * o vermelho de erro e parecia um alerta, "azul" e "roxo" caíam no neutro e ficavam iguais.
 * Esta paleta é própria — doze tons com o mesmo peso, escolhidos para conviver com o grafite
 * do sistema e legíveis nos dois temas. A cor identifica, não classifica.
 *
 * O valor guardado é a chave, nunca o hexadecimal: assim o tema claro e o escuro desenham
 * cada tom do seu jeito, e trocar a paleta depois não invalida o que já está no banco.
 */
export const GROUP_PALETTE = [
  { key: 'ardosia', label: 'Ardósia' },
  { key: 'azul', label: 'Azul' },
  { key: 'indigo', label: 'Índigo' },
  { key: 'violeta', label: 'Violeta' },
  { key: 'magenta', label: 'Magenta' },
  { key: 'carmim', label: 'Carmim' },
  { key: 'telha', label: 'Telha' },
  { key: 'ambar', label: 'Âmbar' },
  { key: 'oliva', label: 'Oliva' },
  { key: 'musgo', label: 'Musgo' },
  { key: 'esmeralda', label: 'Esmeralda' },
  { key: 'turquesa', label: 'Turquesa' },
] as const;

export type GroupColor = (typeof GROUP_PALETTE)[number]['key'];

export const DEFAULT_GROUP_COLOR: GroupColor = 'ardosia';

const KEYS = new Set<string>(GROUP_PALETTE.map((entry) => entry.key));

/** Cores antigas continuam abrindo: o que está no banco não vira lixo por causa de uma paleta nova. */
const LEGACY_COLORS: Record<string, GroupColor> = {
  blue: 'azul',
  green: 'esmeralda',
  amber: 'ambar',
  red: 'carmim',
  purple: 'violeta',
};

export function normalizeGroupColor(value?: string | null): GroupColor {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return DEFAULT_GROUP_COLOR;
  if (KEYS.has(trimmed)) return trimmed as GroupColor;
  return LEGACY_COLORS[trimmed] ?? DEFAULT_GROUP_COLOR;
}

export function groupColorLabel(value: GroupColor): string {
  return GROUP_PALETTE.find((entry) => entry.key === value)?.label ?? value;
}
