import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DoqynLogo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { ApiError } from '@/lib/apiErrors';
import { inviteApi, type InvitePreview } from './api/inviteApi';
import {
  ACCEPT_INVITE_REVIEW_COPY,
  buildAcceptInvitePayload,
  buildAcceptInviteReviewSections,
  validateAcceptInviteForm,
  type AcceptInviteFormValues,
} from './inviteAcceptReview';

const CONSENT_TEXT =
  'Aceito receber notificações operacionais do DOQYN por e-mail e WhatsApp relacionadas a documentos, aprovações, assinaturas, atualizações de acesso e comunicações necessárias ao uso da plataforma.';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; invite: InvitePreview }
  | { kind: 'error'; title: string; message: string; code?: string }
  | { kind: 'success'; message: string };

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

export function AcceptInvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentText, setDepartmentText] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [informationDeclaration, setInformationDeclaration] = useState(false);
  const [consent, setConsent] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [declarationError, setDeclarationError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      if (!token) {
        setPageState({
          kind: 'error',
          title: 'Convite inválido',
          message: 'O link de convite está incompleto.',
        });
        return;
      }

      try {
        const data = await inviteApi.getByToken(token);
        if (cancelled) return;
        setFirstName(data.invite.firstName ?? '');
        setLastName(data.invite.lastName ?? '');
        setPageState({ kind: 'ready', invite: data.invite });
      } catch (error) {
        if (cancelled) return;
        const code = error instanceof ApiError ? error.code : undefined;
        setPageState({
          kind: 'error',
          title: mapInviteErrorTitle(code),
          message: error instanceof ApiError ? error.friendlyMessage : 'Convite inválido ou indisponível.',
          code,
        });
      }
    }

    void loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const formValues = useMemo<AcceptInviteFormValues>(
    () => ({
      firstName,
      lastName,
      password,
      confirmPassword,
      whatsapp,
      jobTitle,
      departmentText,
      acceptedTerms,
      informationDeclaration,
      consent,
    }),
    [
      firstName,
      lastName,
      password,
      confirmPassword,
      whatsapp,
      jobTitle,
      departmentText,
      acceptedTerms,
      informationDeclaration,
      consent,
    ],
  );

  const reviewOptions = useMemo(() => {
    if (pageState.kind !== 'ready') {
      return null;
    }

    return {
      requiresAccountCreation: pageState.invite.requiresAccountCreation,
      requiresPassword: pageState.invite.requiresPassword,
      requiresWhatsapp: pageState.invite.requiresWhatsapp,
      email: pageState.invite.email,
      tenantDisplayName: pageState.invite.tenantDisplayName,
      tenantTaxIdMasked: pageState.invite.tenantTaxIdMasked,
    };
  }, [pageState]);

  const reviewSections = useMemo(
    () => (reviewOptions ? buildAcceptInviteReviewSections(formValues, reviewOptions) : []),
    [formValues, reviewOptions],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pageState.kind !== 'ready' || !reviewOptions) return;

    const validation = validateAcceptInviteForm(formValues, reviewOptions);
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
    if (submitting || pageState.kind !== 'ready' || !reviewOptions) return;

    setSubmitting(true);
    try {
      const result = await inviteApi.accept(
        token,
        buildAcceptInvitePayload(formValues, reviewOptions),
      );
      setReviewOpen(false);
      setPageState({ kind: 'success', message: result.message });
      toast.success(result.message);
      if (result.sessionEstablished) {
        navigate('/', { replace: true });
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.friendlyMessage : 'Não foi possível aceitar o convite.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="login" variant="horizontal" align="center" showSubtitle subtitle="Convite" />
        </div>

        {pageState.kind === 'loading' && (
          <p className="text-center text-sm text-doqyn-muted">Validando convite…</p>
        )}

        {pageState.kind === 'error' && (
          <div className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6 text-center">
            <h1 className="text-lg font-semibold text-doqyn-text">{pageState.title}</h1>
            <p className="mt-2 text-sm text-doqyn-muted">{pageState.message}</p>
            <Link to="/login" className="mt-4 inline-block text-sm text-doqyn-primary hover:underline">
              Ir para o login
            </Link>
          </div>
        )}

        {pageState.kind === 'success' && (
          <div className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6 text-center">
            <h1 className="text-lg font-semibold text-doqyn-text">Convite aceito</h1>
            <p className="mt-2 text-sm text-doqyn-muted">{pageState.message}</p>
            <Button className="mt-4 w-full" onClick={() => navigate('/login', { replace: true })}>
              Ir para o login
            </Button>
          </div>
        )}

        {pageState.kind === 'ready' && (
          <div className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6">
            <h1 className="text-lg font-semibold text-doqyn-text">Aceitar convite</h1>
            <p className="mt-2 text-sm text-doqyn-muted">
              Complete seu cadastro para acessar <strong>{pageState.invite.tenantDisplayName}</strong>.
            </p>

            <form className="mt-6 space-y-8" onSubmit={handleSubmit}>
              <FormSection
                title="Empresa"
                description="Dados da empresa que convidou você — não é necessário informar o CNPJ novamente."
              >
                <Input
                  label="Empresa"
                  value={pageState.invite.tenantDisplayName}
                  readOnly
                  disabled
                />
                {pageState.invite.tenantTaxIdMasked ? (
                  <Input
                    label="CNPJ"
                    value={pageState.invite.tenantTaxIdMasked}
                    readOnly
                    disabled
                  />
                ) : null}
                <Input label="E-mail do convite" value={pageState.invite.email} readOnly disabled />
              </FormSection>

              <div className="h-px bg-doqyn-border-subtle" />

              <FormSection
                title="Seus dados"
                description="Informações de contato e contexto do seu acesso."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Nome"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                    required
                  />
                  <Input
                    label="Sobrenome"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </div>

                {pageState.invite.requiresPassword ? (
                  <>
                    <Input
                      label="Senha de acesso"
                      type="password"
                      revealable
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <Input
                      label="Confirmar senha"
                      type="password"
                      revealable
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </>
                ) : (
                  <p className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-2 text-sm text-doqyn-muted">
                    Sua conta já existe no DOQYN. Ao continuar, o acesso à empresa será vinculado ao
                    seu usuário atual. Use a senha que você já utiliza no login.
                  </p>
                )}

                {pageState.invite.requiresWhatsapp ? (
                  <WhatsappInput
                    label="WhatsApp"
                    value={whatsapp}
                    onChange={setWhatsapp}
                    required
                  />
                ) : null}

                <Input
                  label="Cargo ou função"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Ex.: Analista Financeiro"
                  required
                />

                <div>
                  <Input
                    label="Setor informado"
                    value={departmentText}
                    onChange={(event) => setDepartmentText(event.target.value)}
                    placeholder="Ex.: Financeiro, Jurídico, RH"
                    required
                  />
                  <p className="mt-1.5 text-xs text-doqyn-subtle">
                    Informação declarada — o administrador definirá seus grupos reais de acesso.
                  </p>
                </div>
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
                      Declaro que as informações fornecidas são verdadeiras e que aceito o convite
                      para acessar a empresa informada.
                    </span>
                  }
                  description={
                    declarationError ? (
                      <span className="form-error text-xs">{declarationError}</span>
                    ) : undefined
                  }
                />

                <Checkbox
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                  wrapperClassName="rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3"
                  label={<span className="text-sm leading-relaxed text-doqyn-muted">{CONSENT_TEXT}</span>}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-doqyn-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  to="/login"
                  className="text-center text-sm text-doqyn-muted transition-colors hover:text-doqyn-text sm:text-left"
                >
                  Já tenho conta
                </Link>
                <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                  Revisar e aceitar
                </Button>
              </div>
            </form>

            <ReviewBeforeSubmitDialog
              open={reviewOpen}
              title={ACCEPT_INVITE_REVIEW_COPY.title}
              description={ACCEPT_INVITE_REVIEW_COPY.description}
              sections={reviewSections}
              submitting={submitting}
              confirmLabel={ACCEPT_INVITE_REVIEW_COPY.confirmLabel}
              onCancel={() => {
                if (!submitting) setReviewOpen(false);
              }}
              onEdit={() => {
                if (!submitting) setReviewOpen(false);
              }}
              onConfirm={handleConfirmSubmit}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function mapInviteErrorTitle(code?: string): string {
  switch (code) {
    case 'INVITE_EXPIRED':
      return 'Convite expirado';
    case 'INVITE_REVOKED':
      return 'Convite revogado';
    case 'INVITE_ALREADY_USED':
      return 'Convite já utilizado';
    case 'MEMBER_ALREADY_EXISTS':
      return 'Acesso já existente';
    default:
      return 'Convite indisponível';
  }
}
