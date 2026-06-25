import { Building2, Shield, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DoqynLogo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import { submitAccessRequest } from './api/accessRequestApi';

const CONSENT_TEXT =
  'Aceito receber notificações operacionais do DOQYN por e-mail e WhatsApp relacionadas a documentos, aprovações, assinaturas, atualizações de acesso e comunicações necessárias ao uso da plataforma.';

const CHECKBOX_CLASS =
  'mt-0.5 h-4 w-4 shrink-0 rounded border-doqyn-border-strong bg-doqyn-bg accent-doqyn-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-surface';

type PersonType = 'individual' | 'business';

function PersonTypeSegment({
  value,
  onChange,
}: {
  value: PersonType;
  onChange: (value: PersonType) => void;
}) {
  const options: Array<{ id: PersonType; label: string; icon: typeof Building2 }> = [
    { id: 'business', label: 'Pessoa Jurídica', icon: Building2 },
    { id: 'individual', label: 'Pessoa Física', icon: UserRound },
  ];

  return (
    <div
      className="flex w-full rounded-md border border-doqyn-border bg-doqyn-bg p-0.5"
      role="radiogroup"
      aria-label="Tipo de cliente"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors sm:flex-initial',
              selected
                ? 'bg-doqyn-surface text-doqyn-text shadow-sm ring-1 ring-doqyn-border'
                : 'text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-1 text-xs text-doqyn-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function RequestAccessPage() {
  const [personType, setPersonType] = useState<PersonType>('business');
  const [taxId, setTaxId] = useState('');
  const [tenantDisplayName, setTenantDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentText, setDepartmentText] = useState('');
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const result = await submitAccessRequest({
        personType,
        taxId,
        tenantDisplayName,
        firstName,
        lastName,
        email,
        password,
        whatsapp,
        jobTitle,
        departmentText,
        reason,
        operationalNotificationsConsent: consent,
      });

      setSubmitted(true);
      toast.success(result.message);

      if (import.meta.env.DEV && result.dev?.temporaryPassword) {
        toast.message('Senha temporária (dev)', {
          description: 'Use no login após aprovação do admin.',
        });
        console.info('[access-request] dev credentials', {
          memberId: result.dev.memberId,
          tenantId: result.dev.tenantId,
          hasTemporaryPassword: true,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-lg flow-enter">
          <div className="mb-8 flex flex-col items-center text-center">
            <DoqynLogo size="lg" align="center" showSubtitle subtitle="Solicitação de acesso" />
          </div>

          <div className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6 text-center">
            <h1 className="text-base font-semibold text-doqyn-text">Solicitação enviada</h1>
            <p className="mt-2 text-sm text-doqyn-muted">
              Seu acesso será analisado pelo administrador responsável. Você receberá notificações
              quando houver atualização.
            </p>
            <Link
              to="/login"
              className="mt-5 inline-flex text-sm font-medium text-doqyn-text underline-offset-4 hover:underline"
            >
              Ir para login
            </Link>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            Ambiente corporativo seguro
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="lg" align="center" showSubtitle subtitle="Solicitação de acesso" />
          <p className="mt-4 max-w-md text-sm text-doqyn-muted">
            Preencha os dados abaixo para solicitar acesso à plataforma. Um administrador revisará
            seu pedido e definirá seus grupos de acesso.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
        >
          <div className="space-y-8">
            <FormSection
              title="Dados do cliente"
              description="Identificação da pessoa física ou jurídica que será vinculada ao acesso."
            >
              <div className="flex flex-col gap-2">
                <span className="form-label block">Tipo de cliente</span>
                <PersonTypeSegment value={personType} onChange={setPersonType} />
              </div>

              <Input
                id="taxId"
                label={personType === 'business' ? 'CNPJ' : 'CPF'}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder={personType === 'business' ? '00.000.000/0000-00' : '000.000.000-00'}
                required
              />

              <Input
                id="tenantDisplayName"
                label={personType === 'business' ? 'Razão social' : 'Nome completo do cliente'}
                value={tenantDisplayName}
                onChange={(e) => setTenantDisplayName(e.target.value)}
                placeholder={
                  personType === 'business' ? 'Empresa Exemplo Ltda.' : 'Nome completo'
                }
                required
              />
            </FormSection>

            <div className="h-px bg-doqyn-border-subtle" />

            <FormSection title="Seus dados" description="Informações de contato e contexto do acesso.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="firstName"
                  label="Nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
                <Input
                  id="lastName"
                  label="Sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>

              <Input
                id="email"
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                autoComplete="email"
                required
              />

              <Input
                id="password"
                label="Senha de acesso"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
                minLength={8}
              />

              <Input
                id="whatsapp"
                label="WhatsApp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+55 11 99999-9999"
                autoComplete="tel"
                required
              />

              <Input
                id="jobTitle"
                label="Cargo ou função"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex.: Analista Financeiro"
                required
              />

              <div>
                <Input
                  id="departmentText"
                  label="Setor informado"
                  value={departmentText}
                  onChange={(e) => setDepartmentText(e.target.value)}
                  placeholder="Ex.: Financeiro, Jurídico, RH"
                  required
                />
                <p className="mt-1.5 text-xs text-doqyn-subtle">
                  Informação declarada — o administrador definirá seus grupos reais de acesso.
                </p>
              </div>

              <Textarea
                id="reason"
                label="Motivo do acesso"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Descreva brevemente por que você precisa acessar o DOQYN."
                required
              />
            </FormSection>

            <div className="h-px bg-doqyn-border-subtle" />

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span className="text-sm leading-relaxed text-doqyn-muted">{CONSENT_TEXT}</span>
            </label>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-doqyn-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/login"
              className="text-center text-sm text-doqyn-muted transition-colors hover:text-doqyn-text sm:text-left"
            >
              Já tenho conta
            </Link>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Solicitar acesso'}
            </Button>
          </div>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ambiente corporativo seguro
        </p>
      </div>
    </main>
  );
}
