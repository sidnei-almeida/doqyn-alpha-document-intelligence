import { Building2, Shield, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DoqynLogo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { TaxIdInput } from '@/components/ui/TaxIdInput';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { formatTaxId } from '@/lib/identifiers';
import { Textarea } from '@/components/ui/Textarea';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { usesDoqynAuth } from '@/auth/authConfig';
import { cn } from '@/lib/utils';
import { submitAccessRequest } from './api/accessRequestApi';
import {
  buildRequestAccessPayload,
  buildRequestAccessReviewSections,
  REQUEST_ACCESS_REVIEW_COPY,
  validateRequestAccessForm,
  type RequestAccessFormValues,
} from './requestAccessReview';

const CONSENT_TEXT =
  'Aceito receber notificações operacionais do DOQYN por e-mail e WhatsApp relacionadas a documentos, aprovações, assinaturas, atualizações de acesso e comunicações necessárias ao uso da plataforma.';

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
  const employeeFlow = usesDoqynAuth();
  const [personType, setPersonType] = useState<PersonType>('business');
  const [taxId, setTaxId] = useState('');
  const [tenantDisplayName, setTenantDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentText, setDepartmentText] = useState('');
  const [reason, setReason] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [informationDeclaration, setInformationDeclaration] = useState(false);
  const [consent, setConsent] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [declarationError, setDeclarationError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const taxIdKind = employeeFlow || personType === 'business' ? 'CNPJ' : 'CPF';

  const formValues = useMemo<RequestAccessFormValues>(
    () => ({
      personType,
      taxId,
      tenantDisplayName,
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      whatsapp,
      jobTitle,
      departmentText,
      reason,
      acceptedTerms,
      informationDeclaration,
      consent,
    }),
    [
      personType,
      taxId,
      tenantDisplayName,
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      whatsapp,
      jobTitle,
      departmentText,
      reason,
      acceptedTerms,
      informationDeclaration,
      consent,
    ],
  );

  const reviewSections = useMemo(
    () => buildRequestAccessReviewSections(formValues, { employeeFlow }),
    [formValues, employeeFlow],
  );

  function handlePersonTypeChange(next: PersonType) {
    setPersonType(next);
    if (taxId) {
      const nextKind = next === 'business' ? 'CNPJ' : 'CPF';
      setTaxId(formatTaxId(taxId, nextKind));
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const validation = validateRequestAccessForm(formValues, { employeeFlow });
    setTermsError(null);
    setDeclarationError(null);

    if (!validation.valid) {
      if (validation.field === 'acceptedTerms') {
        setTermsError(validation.error ?? null);
      }
      if (validation.field === 'informationDeclaration') {
        setDeclarationError(validation.error ?? null);
      }
      toast.error(validation.error ?? 'Revise os campos do formulário.');
      return;
    }

    setReviewOpen(true);
  }

  async function handleConfirmSubmit() {
    if (submitting || !formValues.acceptedTerms) {
      if (!formValues.acceptedTerms) {
        setTermsError('É necessário aceitar os Termos e Condições de Uso para continuar.');
      }
      return;
    }

    setSubmitting(true);

    try {
      const payload = buildRequestAccessPayload(formValues, { employeeFlow });
      const result = await submitAccessRequest(payload);

      setReviewOpen(false);
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
              {employeeFlow
                ? 'Sua solicitação foi enviada. Um administrador da empresa precisará aprovar seu acesso.'
                : 'Seu acesso será analisado pelo administrador responsável. Você receberá notificações quando houver atualização.'}
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
          <DoqynLogo
            size="lg"
            align="center"
            showSubtitle
            subtitle={employeeFlow ? 'Pedir acesso à empresa' : 'Solicitação de acesso'}
          />
          <p className="mt-4 max-w-md text-sm text-doqyn-muted">
            {employeeFlow
              ? 'Use esta opção se sua empresa já utiliza o DOQYN e você precisa que um administrador aprove seu acesso.'
              : 'Preencha os dados abaixo para solicitar acesso à plataforma. Um administrador revisará seu pedido e definirá seus grupos de acesso.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
        >
          <div className="space-y-8">
            <FormSection
              title={employeeFlow ? 'Empresa' : 'Dados do cliente'}
              description={
                employeeFlow
                  ? 'Informe o CNPJ da empresa que já utiliza o DOQYN.'
                  : 'Identificação da pessoa física ou jurídica que será vinculada ao acesso.'
              }
            >
              {!employeeFlow && (
                <div className="flex flex-col gap-2">
                  <span className="form-label block">Tipo de cliente</span>
                  <PersonTypeSegment value={personType} onChange={handlePersonTypeChange} />
                </div>
              )}

              <TaxIdInput
                id="taxId"
                kind={taxIdKind}
                label={employeeFlow || personType === 'business' ? 'CNPJ da empresa' : 'CPF'}
                value={taxId}
                onChange={setTaxId}
                required
              />

              {!employeeFlow && (
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
              )}
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

              {employeeFlow && (
                <Input
                  id="confirmPassword"
                  label="Confirmar senha"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              )}

              <WhatsappInput
                id="whatsapp"
                label="WhatsApp"
                value={whatsapp}
                onChange={setWhatsapp}
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

            <div className="space-y-4">
              <TermsAcceptanceCheckbox
                checked={acceptedTerms}
                onChange={(value) => {
                  setAcceptedTerms(value);
                  if (value) setTermsError(null);
                }}
                error={termsError}
                privacyHref={undefined}
                required
              />

              {employeeFlow && (
                <Checkbox
                  checked={informationDeclaration}
                  onChange={(event) => {
                    setInformationDeclaration(event.target.checked);
                    if (event.target.checked) setDeclarationError(null);
                  }}
                  required
                  wrapperClassName="rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3"
                  label={
                    <span className="text-sm leading-relaxed text-doqyn-muted">
                      Declaro que as informações fornecidas são verdadeiras e que solicito acesso à
                      empresa informada.
                    </span>
                  }
                  description={
                    declarationError ? (
                      <span className="form-error text-xs">{declarationError}</span>
                    ) : undefined
                  }
                />
              )}

              <Checkbox
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                wrapperClassName="rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3"
                label={<span className="text-sm leading-relaxed text-doqyn-muted">{CONSENT_TEXT}</span>}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-doqyn-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to={employeeFlow ? '/acesso' : '/login'}
              className="text-center text-sm text-doqyn-muted transition-colors hover:text-doqyn-text sm:text-left"
            >
              {employeeFlow ? 'Voltar' : 'Já tenho conta'}
            </Link>
            <Button type="submit" className="w-full sm:w-auto">
              Solicitar acesso
            </Button>
          </div>
        </form>

        <ReviewBeforeSubmitDialog
          open={reviewOpen}
          title={REQUEST_ACCESS_REVIEW_COPY.title}
          description={REQUEST_ACCESS_REVIEW_COPY.description}
          attentionMessage={REQUEST_ACCESS_REVIEW_COPY.attentionMessage}
          sections={reviewSections}
          submitting={submitting}
          confirmLabel={REQUEST_ACCESS_REVIEW_COPY.confirmLabel}
          onCancel={() => {
            if (!submitting) setReviewOpen(false);
          }}
          onEdit={() => {
            if (!submitting) setReviewOpen(false);
          }}
          onConfirm={handleConfirmSubmit}
        />

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ambiente corporativo seguro
        </p>
      </div>
    </main>
  );
}
