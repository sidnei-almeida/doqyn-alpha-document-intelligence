/** Tokens CSS por categoria — cores já existentes na paleta. */
const FOLDER_ACCENT_VARS: Record<string, string> = {
  juridico: 'var(--color-cat-juridico)',
  financeiro: 'var(--color-cat-financeiro)',
  rh: 'var(--color-cat-rh)',
  compras: 'var(--color-cat-compras)',
  operacional: 'var(--color-cat-operacional)',
  contratos: 'var(--color-cat-contratos)',
};

function normalizeFolderKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function resolveFolderSlug(nameOrId: string): string | null {
  const key = normalizeFolderKey(nameOrId);
  for (const slug of Object.keys(FOLDER_ACCENT_VARS)) {
    if (key.includes(slug)) return slug;
  }
  return null;
}

/** Cor de categoria para ícones de pasta e indicadores. */
export function getFolderAccentColor(nameOrId: string): string | undefined {
  const slug = resolveFolderSlug(nameOrId);
  return slug ? FOLDER_ACCENT_VARS[slug] : undefined;
}

/** @deprecated Use getFolderAccentColor — mantido para compatibilidade de token CSS. */
export function getFolderGradient(nameOrId: string): string {
  return getFolderAccentColor(nameOrId) ?? 'var(--color-cat-default)';
}
