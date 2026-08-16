import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AuthBrandLogo } from '@/components/brand/AuthBrandLogo';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

const WIDTH_CLASS = {
  sm: 'max-w-[400px]',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
} as const;

type AuthShellProps = {
  children: ReactNode;
  width?: keyof typeof WIDTH_CLASS;
  eyebrow?: string;
  title?: string;
  description?: string;
  footer?: ReactNode;
  showSecureBadge?: boolean;
  className?: string;
};

/**
 * Layout minimalista compartilhado por login, cadastro e primeiro acesso.
 */
export function AuthShell({
  children,
  width = 'sm',
  eyebrow,
  title,
  description,
  footer,
  showSecureBadge = false,
  className,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-10">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className={cn('flow-enter w-full', WIDTH_CLASS[width], className)}>
        <header className="mb-8 flex flex-col items-center text-center">
          <AuthBrandLogo subtitle={eyebrow} />
          {title ? (
            <h1 className="mt-5 text-body font-semibold tracking-tight text-doqyn-text">{title}</h1>
          ) : null}
          {description ? (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-doqyn-muted">{description}</p>
          ) : null}
        </header>

        {children}

        {showSecureBadge ? (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-micro text-doqyn-subtle">
            <Icon name="shield" size={ICON_SIZE.xs} />
            Ambiente corporativo seguro
          </p>
        ) : null}

        {footer ? <div className="mt-4 text-center text-sm">{footer}</div> : null}
      </div>
    </main>
  );
}

export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-doqyn-border bg-doqyn-surface', className)}>
      {children}
    </div>
  );
}
