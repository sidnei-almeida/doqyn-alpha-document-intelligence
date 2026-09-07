import type { ReactNode } from 'react';
import { DoqynLogo } from '@/components/brand';
import { cn } from '@/lib/utils';

export type GuestPortalShellProps = {
  /** Legenda ao lado da marca: o que esta porta é. */
  subtitle: string;
  /** Canto direito do cabeçalho — quem pediu, selo de estado. */
  headerAside?: ReactNode;
  /** Nota de rodapé; some quando ausente. */
  footNote?: ReactNode;
  /** `stage` centraliza a antessala; `work` entrega a largura ao documento. */
  layout?: 'stage' | 'work';
  children: ReactNode;
  className?: string;
};

/**
 * Casca das telas que um convidado vê sem ter conta: convite de acesso e portal de
 * assinatura. É a mesma porta da frente da antessala — fio no topo, fio no rodapé,
 * marca à esquerda e o estado do documento à direita.
 */
export function GuestPortalShell({
  subtitle,
  headerAside,
  footNote,
  layout = 'stage',
  children,
  className,
}: GuestPortalShellProps) {
  return (
    <div className={cn('guest-shell', className)} data-layout={layout}>
      <header className="guest-shell__header">
        <DoqynLogo size="sm" variant="horizontal" subtitle={subtitle} />
        {headerAside ? <div className="guest-shell__header-aside">{headerAside}</div> : null}
      </header>

      <main className="guest-shell__main">{children}</main>

      {footNote ? (
        <footer className="guest-shell__footer">
          <p className="type-caption text-doqyn-subtle">{footNote}</p>
        </footer>
      ) : null}
    </div>
  );
}

/** Selo de atestação — contorno de latão, nunca preenchido. */
export function GuestSeal({ children }: { children: ReactNode }) {
  return <span className="guest-seal">{children}</span>;
}

/** Linha de registro: rótulo em mono à esquerda, valor em corpo à direita. */
export function GuestRegisterRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="guest-register__row">
      <dt className="register-label text-doqyn-subtle">{label}</dt>
      <dd
        className={cn('type-body min-w-0 break-words', tone === 'warning' && 'text-doqyn-warning')}
      >
        {value}
      </dd>
    </div>
  );
}
