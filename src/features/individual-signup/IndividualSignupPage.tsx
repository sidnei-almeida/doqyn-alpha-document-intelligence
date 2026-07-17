import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { DocumentIdInput } from '@/components/ui/DocumentIdInput';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/features/auth/useAuth';
import { getActiveLocale } from '@/lib/formatLocale';
import { defaultPhoneCountry } from '@/lib/identifiers';
import {
  defaultCountryForLocale,
  getIdentifierSpec,
  type CountryCode,
} from '@/lib/identifiers/countryIdentifiers';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() =>
    defaultPhoneCountry(getActiveLocale()),
  );
  const [country, setCountry] = useState<CountryCode>(() =>
    defaultCountryForLocale(getActiveLocale()),
  );
  const [taxId, setTaxId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCountryChange(next: CountryCode) {
    setCountry(next);
    setTaxId('');
  }

  const documentSpec = useMemo(() => getIdentifierSpec(country, 'individual'), [country]);

  const formValues = useMemo<IndividualSignupFormValues>(
    () => ({
      firstName,
      lastName,
      email,
      whatsapp,
      whatsappCountry: phoneCountry,
      country,
      taxId,
      password,
      confirmPassword,
      acceptedTerms,
    }),
    [
      firstName,
      lastName,
      email,
      whatsapp,
      phoneCountry,
      country,
      taxId,
      password,
      confirmPassword,
      acceptedTerms,
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
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              id="lastName"
              label="Sobrenome"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Input
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PhoneInput
            id="whatsapp"
            label="WhatsApp"
            value={whatsapp}
            onChange={setWhatsapp}
            country={phoneCountry}
            onCountryChange={setPhoneCountry}
            required
          />
          <CountrySelect id="country" label="País" value={country} onChange={handleCountryChange} />
          <DocumentIdInput
            id="taxId"
            country={country}
            personType="individual"
            label={documentSpec.code}
            value={taxId}
            onChange={setTaxId}
            required
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Input
            id="confirmPassword"
            label="Confirmar senha"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />

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
          <Button type="submit" className="w-full sm:w-auto">
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
