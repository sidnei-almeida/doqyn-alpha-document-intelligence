import { Link } from 'react-router-dom';

/**
 * Biblioteca vazia — o primeiro dia de quem acabou de entrar.
 *
 * **Sem botão no meio.** Enviar documento já mora na barra lateral e no menu de contexto, e um
 * botão central repetindo isso é uma terceira porta para o mesmo cômodo: ocupa o lugar mais nobre
 * da tela para dizer o que já está dito dois cliques acima. O que falta aqui não é um caminho a
 * mais, é saber **o que acontece** quando o primeiro arquivo chega.
 *
 * A folha é desenhada, e não um ícone de nuvem: é a mesma gramática do painel da antessala e da
 * fila — linhas de texto e o fio da leitura atravessando. Parada, porque aqui não há leitura
 * acontecendo; o fio está no lugar onde ela começaria.
 */
export function ExplorerRootEmpty() {
  return (
    <div
      className="flex min-h-[min(420px,55vh)] flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="library-root-empty"
    >
      <svg
        viewBox="0 0 72 96"
        width={72}
        height={96}
        fill="none"
        aria-hidden
        className="mb-6 text-doqyn-border-strong"
      >
        {/* A folha: contorno, nunca preenchimento. */}
        <rect
          x="0.75"
          y="0.75"
          width="70.5"
          height="94.5"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* A margem, como na página da antessala. */}
        <path d="M14 8 V88" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
          <path d="M24 22h34" />
          <path d="M24 32h26" />
          <path d="M24 42h31" />
          <path d="M24 62h29" />
          <path d="M24 72h20" />
        </g>
        {/* O fio da leitura, parado onde ela começaria. */}
        <path d="M6 52h60" stroke="var(--accent-active)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <p className="text-[15px] font-medium text-doqyn-text">
        A biblioteca começa no primeiro documento
      </p>
      <p className="mt-2 max-w-[46ch] text-[13px] leading-relaxed text-doqyn-muted">
        Envie pela barra lateral, ou arraste arquivos para esta janela. Cada um é lido, classificado
        e guardado na pasta que a classificação indicar.
      </p>
      <p className="mt-4 text-[12px] text-doqyn-subtle">
        As pastas inteligentes saem das suas categorias. Ajuste em{' '}
        <Link to="/rules" className="text-doqyn-accent-active hover:underline">
          Regras
        </Link>
        .
      </p>
    </div>
  );
}
