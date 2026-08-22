import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { TaxIdInput } from '@/components/ui/TaxIdInput';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { DEFAULT_COUNTRY, getTaxIdSpec, type CountryCode } from '@/lib/identifiers';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/features/auth/useAuth';
import { useSignupSessionIdentity } from '@/features/auth/useSignupSessionIdentity';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { submitCompanySignup } from './api/companySignupApi';
import {
  buildCompanySignupPayload,
  buildCompanySignupReviewSections,
  COMPANY_SIGNUP_REVIEW_COPY,
  validateCompanySignupForm,
  type CompanySignupFormValues,
} from './companySignupReview';

const COMPANY_AUTHORIZATION_TEXT =
  'Declaro que possuo autorização para cadastrar esta empresa ou atuar como administrador inicial no DOQYN.';

export function CompanySignupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  /** Ver `IndividualSignupPage`: sessão existente, resolvida direto no servidor. */
  const sessionIdentity = useSignupSessionIdentity();
  const fromAuthenticatedSession = sessionIdentity.status === 'authenticated';
  const resolvingSession = sessionIdentity.status === 'loading';

  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [taxId, setTaxId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [companyAuthorization, setCompanyAuthorization] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionIdentity.status !== 'authenticated') return;
    setEmail((current) => current || sessionIdentity.email);
    setFirstName((current) => current || sessionIdentity.firstName);
    setLastName((current) => current || sessionIdentity.lastName);
  }, [sessionIdentity]);

  function handleCountryChange(next: CountryCode) {
    setCountry(next);
    setTaxId('');
    setWhatsapp('');
  }

  const formValues = useMemo<CompanySignupFormValues>(
    () => ({
      companyName,
      country,
      taxId,
      firstName,
      lastName,
      email,
      whatsapp,
      password,
      confirmPassword,
      acceptedTerms,
      companyAuthorization,
      fromAuthenticatedSession,
    }),
    [
      companyName,
      country,
      taxId,
      firstName,
      lastName,
      email,
      whatsapp,
      password,
      confirmPassword,
      acceptedTerms,
      companyAuthorization,
      fromAuthenticatedSession,
    ],
  );

  const reviewSections = useMemo(
    () => buildCompanySignupReviewSections(formValues),
    [formValues],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const validation = validateCompanySignupForm(formValues);
    setTermsError(null);
    setAuthorizationError(null);

    if (!validation.valid) {
      if (validation.field === 'acceptedTerms') {
        setTermsError(validation.error ?? null);
      }
      if (validation.field === 'companyAuthorization') {
        setAuthorizationError(validation.error ?? null);
      }
      setError(validation.error ?? 'Revise os campos do formulário.');
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
    setError(null);

    try {
      const result = await submitCompanySignup(buildCompanySignupPayload(formValues));

      setReviewOpen(false);
      toast.success(result.message ?? 'Empresa cadastrada com sucesso.');
      await refreshUser();
      navigate('/upload', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao cadastrar empresa.';
      setError(message);
      showApiErrorToast(err, message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      width="md"
      eyebrow="Cadastrar empresa"
      description="Use esta opção se sua empresa ainda não possui um ambiente no DOQYN."
      showSecureBadge
    >
        <form onSubmit={handleSubmit} className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-doqyn-text">
            <Icon name="business" size={ICON_SIZE.xs} />
            Dados da empresa
          </div>

          <div className="space-y-4">
            <Input
              id="companyName"
              label="Nome da empresa"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <CountrySelect
              id="country"
              label="País"
              value={country}
              onChange={handleCountryChange}
            />
            <TaxIdInput
              id="taxId"
              country={country}
              personType="company"
              label={getTaxIdSpec(country, 'company').label}
              value={taxId}
              onChange={setTaxId}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="firstName"
                label="Nome do responsável"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                id="lastName"
                label="Sobrenome"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <Input
              id="email"
              label="E-mail corporativo"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={fromAuthenticatedSession}
              required={!fromAuthenticatedSession}
            />
            {fromAuthenticatedSession && (
              <p className="type-label -mt-2 text-doqyn-muted">
                E-mail confirmado pela conta com que você entrou.
              </p>
            )}
            <WhatsappInput
              id="whatsapp"
              label="WhatsApp"
              country={country}
              value={whatsapp}
              onChange={setWhatsapp}
              required
            />
            {!fromAuthenticatedSession && !resolvingSession && (
              <>
                <Input
                  id="password"
                  label="Senha"
                  autoComplete="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <Input
                  id="confirmPassword"
                  label="Confirmar senha"
                  autoComplete="new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </>
            )}

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
              checked={companyAuthorization}
              onChange={(event) => {
                setCompanyAuthorization(event.target.checked);
                if (event.target.checked) setAuthorizationError(null);
              }}
              required
              wrapperClassName="rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3"
              label={
                <span className="text-sm leading-relaxed text-doqyn-muted">
                  {COMPANY_AUTHORIZATION_TEXT}
                </span>
              }
              description={
                authorizationError ? (
                  <span className="form-error text-xs">{authorizationError}</span>
                ) : undefined
              }
            />
          </div>

          {error ? (
            <div className="mt-4">
              <AlertBanner variant="error" message={error} />
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-doqyn-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/acesso" className="text-center text-sm text-doqyn-muted hover:text-doqyn-text">
              Voltar
            </Link>
            <Button type="submit" className="w-full sm:w-auto" disabled={resolvingSession}>
              Cadastrar empresa
            </Button>
          </div>
        </form>

        <ReviewBeforeSubmitDialog
          open={reviewOpen}
          title={COMPANY_SIGNUP_REVIEW_COPY.title}
          description={COMPANY_SIGNUP_REVIEW_COPY.description}
          attentionMessage={COMPANY_SIGNUP_REVIEW_COPY.attentionMessage}
          sections={reviewSections}
          submitting={submitting}
          confirmLabel={COMPANY_SIGNUP_REVIEW_COPY.confirmLabel}
          onCancel={() => {
            if (!submitting) setReviewOpen(false);
          }}
          onEdit={() => {
            if (!submitting) setReviewOpen(false);
          }}
          onConfirm={handleConfirmSubmit}
        />
    </AuthShell>
  );
}
