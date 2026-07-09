import { useId } from 'react';

type DoqynMarkProps = {
  /** Lado do quadrado em px. */
  size?: number;
  className?: string;
};

/**
 * Marca DOQYN em SVG — documento com dobra, linhas de velocidade e selo "@",
 * gradiente azul→roxo. Funciona em dark e light (o selo usa o fundo do tema).
 */
export function DoqynMark({ size = 32, className }: DoqynMarkProps) {
  const gradientId = useId();
  const stroke = `url(#${gradientId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="8"
          y1="6"
          x2="42"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4aa8f0" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* linhas de velocidade */}
      <path d="M4 16h7M2 24h9M4 32h7" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />

      {/* folha com dobra no canto superior direito */}
      <path
        d="M20 5h11l9.5 9.5V39a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M31 5v7.5a2 2 0 0 0 2 2h7.5"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* linhas de texto */}
      <path d="M22 22.5h12M22 28.5h12" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />

      {/* selo IA sobre o canto inferior esquerdo */}
      <circle
        cx="19"
        cy="37.5"
        r="6.75"
        fill="var(--bg-sidebar, #ffffff)"
        stroke={stroke}
        strokeWidth="2.2"
      />
      <text
        x="19"
        y="40.4"
        textAnchor="middle"
        fontSize="8.5"
        fontFamily="var(--font-display)"
        fontWeight="600"
        fill={stroke}
      >
        @
      </text>
    </svg>
  );
}
