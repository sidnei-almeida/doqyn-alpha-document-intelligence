import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DoqynLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  DOQYN_TERMS_EFFECTIVE_DATE,
  DOQYN_TERMS_VERSION,
  TERMS_LEGAL_NOTICE,
  TERMS_SECTIONS,
} from '@/legal/terms';

function formatEffectiveDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function TermsPage() {
  return (
    <main className="relative min-h-screen bg-doqyn-bg px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-3xl flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="lg" align="center" showSubtitle subtitle="Termos e Condições" />
        </div>

        <article className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6 sm:p-8">
          <header className="border-b border-doqyn-border-subtle pb-6">
            <h1 className="text-xl font-semibold text-doqyn-text sm:text-2xl">
              Termos e Condições de Uso do DOQYN
            </h1>
            <p className="mt-3 text-sm text-doqyn-muted">
              Leia atentamente antes de criar uma conta, cadastrar uma empresa ou solicitar acesso a
              uma organização.
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-doqyn-muted">Versão</dt>
                <dd className="mt-0.5 font-medium text-doqyn-text">{DOQYN_TERMS_VERSION}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-doqyn-muted">Vigência</dt>
                <dd className="mt-0.5 font-medium text-doqyn-text">
                  {formatEffectiveDate(DOQYN_TERMS_EFFECTIVE_DATE)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-200/90">
              {TERMS_LEGAL_NOTICE}
            </p>
          </header>

          <div className="space-y-8 py-8">
            {TERMS_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-base font-semibold text-doqyn-text">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-doqyn-muted">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="border-t border-doqyn-border-subtle pt-6">
            <Link
              to="/acesso"
              className="inline-flex items-center gap-2 text-sm font-medium text-doqyn-text transition-colors hover:text-doqyn-primary"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Voltar
            </Link>
          </footer>
        </article>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ambiente corporativo seguro
        </p>
      </div>
    </main>
  );
}
