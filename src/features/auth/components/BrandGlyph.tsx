/**
 * Glifos dos provedores de SSO, em monocromático.
 *
 * O botão usava um ícone genérico de chave para Google e Microsoft — o mesmo
 * desenho para dois provedores diferentes, o que não identificava nenhum dos
 * dois. Aqui cada um tem a própria forma, herdando `currentColor` para não
 * furar a paleta de acento único com o vermelho-amarelo-verde do Google.
 */

export function GoogleGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.17a5.28 5.28 0 0 1-2.29 3.46v2.88h3.7C21.74 18.66 23 15.76 23 12.27Z"
        fill="currentColor"
        opacity=".92"
      />
      <path
        d="M12 23.5c3.1 0 5.7-1.03 7.6-2.79l-3.71-2.88c-1.03.69-2.35 1.1-3.89 1.1-2.99 0-5.52-2.02-6.43-4.73H1.74v2.97A11.49 11.49 0 0 0 12 23.5Z"
        fill="currentColor"
        opacity=".72"
      />
      <path
        d="M5.57 14.2a6.9 6.9 0 0 1 0-4.4V6.83H1.74a11.5 11.5 0 0 0 0 10.34l3.83-2.97Z"
        fill="currentColor"
        opacity=".52"
      />
      <path
        d="M12 5.07c1.69 0 3.2.58 4.4 1.72l3.28-3.28C17.7 1.63 15.1.5 12 .5A11.49 11.49 0 0 0 1.74 6.83L5.57 9.8C6.48 7.09 9.01 5.07 12 5.07Z"
        fill="currentColor"
        opacity=".92"
      />
    </svg>
  );
}

export function MicrosoftGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="9.4" height="9.4" fill="currentColor" opacity=".92" />
      <rect x="13.1" y="1.5" width="9.4" height="9.4" fill="currentColor" opacity=".66" />
      <rect x="1.5" y="13.1" width="9.4" height="9.4" fill="currentColor" opacity=".66" />
      <rect x="13.1" y="13.1" width="9.4" height="9.4" fill="currentColor" opacity=".44" />
    </svg>
  );
}
