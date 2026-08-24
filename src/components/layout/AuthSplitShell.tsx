import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { DoqynMark } from '@/components/brand/DoqynMark';
import { AntechamberDocument } from '@/features/auth/components/AntechamberDocument';
import { ICON_SIZE } from '@/lib/iconDefaults';

type AuthSplitShellProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Casca da porta de entrada — "a antessala".
 *
 * À esquerda, o produto: um contrato sendo lido, com as extrações saindo em fio
 * de cabelo. À direita, o formulário. A pessoa vê o que o DOQYN faz antes de
 * decidir entrar, e o vazio da tela passa a ter trabalho.
 *
 * Abaixo de 1024px o painel some e o formulário assume a tela inteira: numa
 * largura de celular, o documento viraria enfeite ilegível.
 *
 * Separada do AuthShell de propósito. Aquele veste seis telas de fluxo
 * (solicitar acesso, cadastro, gate) que continuam certas centralizadas; esta
 * é só a porta da frente, que merece tratamento próprio.
 */
export function AuthSplitShell({ title, children, footer }: AuthSplitShellProps) {
  return (
    <main className="relative grid min-h-screen bg-doqyn-bg lg:grid-cols-[1.15fr_1fr]">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* painel do produto */}
      <section className="relative hidden overflow-hidden border-r border-doqyn-border-subtle bg-doqyn-panel lg:block">
        <AntechamberDocument />
      </section>

      {/* formulário */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[368px]">
          <span className="auth-stage auth-stage--mark flex items-center gap-2.5">
            <DoqynMark size={26} className="shrink-0 text-doqyn-accent-active" />
            <span className="font-display text-[17px] font-medium uppercase leading-none tracking-[0.16em] text-doqyn-text">
              Doqyn
            </span>
          </span>

          <h1 className="auth-stage auth-stage--title mt-9 text-balance font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.014em] text-doqyn-text">
            {title}
          </h1>

          <div className="auth-stage auth-stage--form mt-8">{children}</div>

          <div className="auth-stage auth-stage--foot mt-9 flex flex-col gap-3">
            {footer ? <div className="text-caption">{footer}</div> : null}
            <p className="flex items-center gap-1.5 text-micro text-doqyn-subtle">
              <Icon name="shield" size={ICON_SIZE.xs} />
              Ambiente corporativo seguro
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
