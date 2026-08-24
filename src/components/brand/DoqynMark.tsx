type DoqynMarkProps = {
  /** Lado do quadrado em px. */
  size?: number;
  className?: string;
};

/**
 * Marca DOQYN — direção "Selo".
 *
 * A letra Q é a única com forma própria em DOQYN, e é dela que a marca sai: o
 * anel externo é a borda de um selo cunhado, o anel interno é a impressão, e a
 * cauda é a marca da batida. Nada de ícone genérico de documento — aquele
 * qualquer produto de arquivo usa.
 *
 * Herda `currentColor`, então acompanha o token de quem a desenha nos dois
 * temas. Não existe cor travada aqui.
 *
 * O traço engrossa e o anel interno some conforme o tamanho cai: em 20px ou
 * menos a impressão vira borrão, então o desenho prevê a própria simplificação
 * em vez de deixar o navegador resolver.
 */
export function DoqynMark({ size = 32, className }: DoqynMarkProps) {
  const scale = size >= 32 ? 'lg' : size >= 20 ? 'md' : 'sm';

  const ring = scale === 'lg' ? 3 : scale === 'md' ? 3.6 : 5;
  const tail = scale === 'lg' ? 4.6 : scale === 'md' ? 5.2 : 6.5;
  const press = scale === 'lg' ? 1.6 : 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* borda do selo */}
      <circle cx="22" cy="22" r="15" stroke="currentColor" strokeWidth={ring} />

      {/* impressão — só onde ainda é legível */}
      {scale !== 'sm' ? (
        <circle cx="22" cy="22" r="10" stroke="currentColor" strokeWidth={press} opacity="0.5" />
      ) : null}

      {/* A cauda nasce dentro do anel e atravessa a borda. É esse cruzamento
          que faz a forma ler como Q e não como lupa: no ícone de busca o cabo
          encosta na circunferência por fora, nunca sai de dentro dela. */}
      <path d="M25.5 25.5 L38 38" stroke="currentColor" strokeWidth={tail} strokeLinecap="round" />
    </svg>
  );
}
