import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { AUTH_PRIMARY_BUTTON, AUTH_QUIET_BUTTON } from '@/features/auth/components/authControls';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { TaxIdInput } from '@/components/ui/TaxIdInput';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { DEFAULT_COUNTRY, getTaxIdSpec, type CountryCode } from '@/lib/identifiers';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { useAuth } from '@/features/auth/useAuth';
import { storeVerificationTicket } from '@/features/email-verification/verificationTicket';
import { useSignupSessionIdentity } from '@/features/auth/useSignupSessionIdentity';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { suggestUsername, UsernameField } from '@/features/auth/components/UsernameField';
import { submitCompanySignup } from './api/companySignupApi';
import {
  buildCompanySignupPayload,
  buildCompanySignupReviewSections,
  COMPANY_SIGNUP_REVIEW_COPY_KEYS,
  validateCompanySignupForm,
  type CompanySignupFormValues,
} from './companySignupReview';
import { useTranslation } from 'react-i18next';

export function CompanySignupPage() {
  const { t } = useTranslation('auth');

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
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(false);
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

  // Vem do nome digitado acima, para que exigir o handle não vire atrito: quem não se importa
  // aceita o que está lá; quem se importa troca.
  const usernameSuggestion = useMemo(
    () => suggestUsername(firstName, lastName),
    [firstName, lastName],
  );

  const formValues = useMemo<CompanySignupFormValues>(
    () => ({
      companyName,
      country,
      taxId,
      firstName,
      lastName,
      username,
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
      username,
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
    () => buildCompanySignupReviewSections(formValues, t),
    [formValues, t],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // O servidor aceitaria e resolveria a colisão com sufixo numérico — que é justamente o
    // silêncio que este campo existe para acabar.
    if (!usernameAvailable) {
      setError(t('signup.usernameUnavailable'));
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
      setError(validation.error ?? t('signup.reviewFields'));
      return;
    }

    setReviewOpen(true);
  }

  async function handleConfirmSubmit() {
    if (submitting || !formValues.acceptedTerms) {
      if (!formValues.acceptedTerms) {
        setTermsError(t('signup.termsRequired'));
      }
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitCompanySignup(buildCompanySignupPayload(formValues));

      setReviewOpen(false);

      // Sem sessão até o e-mail ser confirmado: a conta existe, mas o acesso não abriu. Chamar
      // `refreshUser` aqui buscaria uma sessão que não veio, e mandar para a biblioteca só
      // devolveria a pessoa ao login sem explicar por quê.
      if (result.emailVerificationRequired && result.verificationTicket) {
        storeVerificationTicket(result.verificationTicket);
        // A frase do servidor é português e existe para log; a confirmação sai do catálogo.
        toast.success(t('companySignupPage.createdVerify'));
        navigate('/verify-email', {
          replace: true,
          state: { ticket: result.verificationTicket },
        });
        return;
      }

      toast.success(t('companySignupPage.created'));
      await refreshUser();
      navigate('/library', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('companySignupPage.failed');
      setError(message);
      showApiErrorToast(err, message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading
        title={t('companySignupPage.cadastrarMinhaEmpresa')}
        description={t('companySignupPage.useEstaOpcaoSe')}
      />

      <form onSubmit={handleSubmit}>
        <div className="mb-5 border-b border-doqyn-border-subtle pb-2.5 font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
          {t('companySignupPage.dadosDaEmpresa')}
        </div>

        <div className="space-y-4">
          <Input
            id="companyName"
            label={t('companySignupPage.nomeDaEmpresa')}
            autoComplete="organization"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
          <CountrySelect
            id="country"
            label={t('companySignupPage.pais')}
            value={country}
            onChange={handleCountryChange}
          />
          <TaxIdInput
            id="taxId"
            country={country}
            personType="company"
            label={t(getTaxIdSpec(country, 'company').labelKey)}
            value={taxId}
            onChange={setTaxId}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="firstName"
              label={t('companySignupPage.nomeDoResponsavel')}
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              id="lastName"
              label={t('companySignupPage.sobrenome')}
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <UsernameField
            value={username}
            onChange={setUsername}
            suggestion={usernameSuggestion}
            onValidityChange={setUsernameAvailable}
          />

          <Input
            id="email"
            label={t('companySignupPage.eMailCorporativo')}
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={fromAuthenticatedSession}
            required={!fromAuthenticatedSession}
          />
          {fromAuthenticatedSession && (
            <p className="type-label -mt-2 text-doqyn-muted">
              {t('companySignupPage.eMailConfirmadoPela')}
            </p>
          )}
          <WhatsappInput
            id="whatsapp"
            label={t('companySignupPage.whatsapp')}
            country={country}
            value={whatsapp}
            onChange={setWhatsapp}
            required
          />
          {!fromAuthenticatedSession && !resolvingSession && (
            <>
              <Input
                id="password"
                label={t('companySignupPage.senha')}
                autoComplete="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Input
                id="confirmPassword"
                label={t('companySignupPage.confirmarSenha')}
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
            wrapperClassName="border-0 bg-transparent px-0 py-1"
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
            wrapperClassName="border-0 bg-transparent px-0 py-1"
            label={
              <span className="text-sm leading-relaxed text-doqyn-muted">
                {t('companySignupPage.authorizationText')}
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
          <Link to="/access" className={AUTH_QUIET_BUTTON}>
            {t('companySignupPage.voltar')}
          </Link>
          <button type="submit" disabled={resolvingSession} className={AUTH_PRIMARY_BUTTON}>
            {t('companySignupPage.cadastrarEmpresa')}
          </button>
        </div>
      </form>

      <ReviewBeforeSubmitDialog
        open={reviewOpen}
        title={t(COMPANY_SIGNUP_REVIEW_COPY_KEYS.title)}
        description={t(COMPANY_SIGNUP_REVIEW_COPY_KEYS.description)}
        attentionMessage={t(COMPANY_SIGNUP_REVIEW_COPY_KEYS.attentionMessage)}
        sections={reviewSections}
        submitting={submitting}
        confirmLabel={t(COMPANY_SIGNUP_REVIEW_COPY_KEYS.confirmLabel)}
        onCancel={() => {
          if (!submitting) setReviewOpen(false);
        }}
        onEdit={() => {
          if (!submitting) setReviewOpen(false);
        }}
        onConfirm={handleConfirmSubmit}
      />

      <AuthFooterLink>
        {t('companySignupPage.jaTenhoConta')}{' '}
        <Link
          to="/login"
          className="text-doqyn-accent-active underline-offset-4 transition-colors hover:underline"
        >
          {t('companySignupPage.entrar')}
        </Link>
      </AuthFooterLink>
    </>
  );
}
