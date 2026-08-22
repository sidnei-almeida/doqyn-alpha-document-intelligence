import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { TaxIdInput } from '@/components/ui/TaxIdInput';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/features/auth/useAuth';
import { useSignupSessionIdentity } from '@/features/auth/useSignupSessionIdentity';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { DEFAULT_COUNTRY, getTaxIdSpec, type CountryCode } from '@/lib/identifiers';
import { submitIndividualSignup } from './api/individualSignupApi';
import {
  buildIndividualSignupPayload,
  buildIndividualSignupReviewSections,
  INDIVIDUAL_SIGNUP_REVIEW_COPY,
  validateIndividualSignupForm,
  type IndividualSignupFormValues,
} from './individualSignupReview';

export function IndividualSignupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  /**
   * Sessão já existente — hoje, quem entrou pelo Google e ainda não tem espaço de trabalho.
   * Vem direto do servidor, e não do AuthProvider: nas rotas de cadastro ele limpa a sessão
   * de propósito, o que faria o formulário pedir uma senha que o backend descarta.
   */
  const sessionIdentity = useSignupSessionIdentity();
  const fromAuthenticatedSession = sessionIdentity.status === 'authenticated';
  const resolvingSession = sessionIdentity.status === 'loading';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [whatsapp, setWhatsapp] = useState('');
  const [taxId, setTaxId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Preenche o que o provedor já entregou. Nome fica editável — perfil de rede social muitas
   * vezes traz apelido — e o e-mail não, porque é ele que identifica a conta já verificada.
   */
  useEffect(() => {
    if (sessionIdentity.status !== 'authenticated') return;
    setEmail((current) => current || sessionIdentity.email);
    setFirstName((current) => current || sessionIdentity.firstName);
    setLastName((current) => current || sessionIdentity.lastName);
  }, [sessionIdentity]);

  /** Trocar de país muda a máscara: reformata o que já foi digitado em vez de deixar sujeira. */
  function handleCountryChange(next: CountryCode) {
    setCountry(next);
    setTaxId('');
    setWhatsapp('');
  }

  const formValues = useMemo<IndividualSignupFormValues>(
    () => ({
      firstName,
      lastName,
      email,
      country,
      whatsapp,
      taxId,
      password,
      confirmPassword,
      acceptedTerms,
      fromAuthenticatedSession,
    }),
    [
      firstName,
      lastName,
      email,
      country,
      whatsapp,
      taxId,
      password,
      confirmPassword,
      acceptedTerms,
      fromAuthenticatedSession,
    ],
  );

  const reviewSections = useMemo(
    () => buildIndividualSignupReviewSections(formValues),
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

    const validation = validateIndividualSignupForm(formValues);
    setTermsError(null);

    if (!validation.valid) {
      if (validation.field === 'acceptedTerms') {
        setTermsError(validation.error ?? null);
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
      const result = await submitIndividualSignup(buildIndividualSignupPayload(formValues));

      setReviewOpen(false);
      toast.success(result.message ?? 'Seu acesso CPF foi criado com sucesso.');
      await refreshUser();
      navigate('/upload', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao criar acesso.';
      setError(message);
      showApiErrorToast(err, message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      width="md"
      eyebrow="Pessoa física"
      description="Para clientes CPF que precisam acessar documentos pessoais no DOQYN."
      showSecureBadge
    >
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-doqyn-text">
            <Icon name="person" size={ICON_SIZE.xs} />
            Dados pessoais
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="firstName"
                label="Nome"
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

            <div className="flex flex-col gap-1.5">
              <Input
                id="email"
                label="E-mail"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={fromAuthenticatedSession}
                required={!fromAuthenticatedSession}
              />
              {fromAuthenticatedSession && (
                <p className="type-label text-doqyn-muted">
                  E-mail confirmado pela conta com que você entrou.
                </p>
              )}
            </div>
            <CountrySelect
              id="country"
              label="País"
              value={country}
              onChange={handleCountryChange}
            />
            <WhatsappInput
              id="whatsapp"
              label="WhatsApp"
              country={country}
              value={whatsapp}
              onChange={setWhatsapp}
              required
            />
            <TaxIdInput
              id="taxId"
              country={country}
              personType="individual"
              label={getTaxIdSpec(country, 'individual').label}
              value={taxId}
              onChange={setTaxId}
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
              Criar acesso CPF
            </Button>
          </div>
        </form>

        <ReviewBeforeSubmitDialog
          open={reviewOpen}
          title={INDIVIDUAL_SIGNUP_REVIEW_COPY.title}
          description={INDIVIDUAL_SIGNUP_REVIEW_COPY.description}
          attentionMessage={INDIVIDUAL_SIGNUP_REVIEW_COPY.attentionMessage}
          sections={reviewSections}
          submitting={submitting}
          confirmLabel={INDIVIDUAL_SIGNUP_REVIEW_COPY.confirmLabel}
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
