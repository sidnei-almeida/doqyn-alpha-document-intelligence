import { UserAvatar } from '@/components/ui/UserAvatar';

/**
 * Uma pessoa numa lista, sempre do mesmo jeito.
 *
 * A busca por apelido e o histórico de contatos respondem à mesma pergunta — "para quem eu envio
 * isto?" — e desenhá-las diferente faria parecerem coisas distintas. Retrato, nome, e a linha de
 * baixo com o que identifica.
 */
export function ContactRow({
  name,
  email,
  username,
  avatarUrl,
  meta,
  disabled,
  onPick,
}: {
  name: string;
  email?: string;
  username?: string;
  avatarUrl?: string | null;
  /** O rodapé opcional — "12 trocas · última há 3 dias". Nunca o score, que não tem unidade. */
  meta?: string;
  disabled?: boolean;
  onPick: () => void;
}) {
  const identity = [username ? `@${username}` : null, email].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      // Régua de acento no hover, como o item de menu e o da sidebar. `surface-hover` sozinho
      // era a única linha do app marcando escolha só com preenchimento.
      className="explorer-interactive relative flex w-full items-center gap-3 rounded-none py-2 text-left before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent hover:bg-doqyn-hover/50 hover:before:bg-doqyn-accent-active"
    >
      <UserAvatar name={name} email={email} avatarUrl={avatarUrl} size="md" />
      {/* `min-w-0` porque o e-mail longo é o que estoura a linha, e truncar é melhor que empurrar
          o retrato para fora do campo. */}
      <span className="flex min-w-0 flex-col">
        <span className="type-body truncate text-doqyn-text">{name}</span>
        {identity ? <span className="truncate text-micro text-doqyn-muted">{identity}</span> : null}
        {meta ? <span className="truncate text-micro text-doqyn-subtle">{meta}</span> : null}
      </span>
    </button>
  );
}

/** "12 trocas · última há 3 dias" — a contagem crua, sem o score, que não é para ler. */
export function formatContactMeta(interactions: number, lastInteractionAt: string): string {
  const trocas = `${interactions} ${interactions === 1 ? 'troca' : 'trocas'}`;
  const dias = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000);

  if (Number.isNaN(dias)) return trocas;
  if (dias <= 0) return `${trocas} · última hoje`;
  if (dias === 1) return `${trocas} · última ontem`;
  if (dias < 30) return `${trocas} · última há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  return `${trocas} · última há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}
