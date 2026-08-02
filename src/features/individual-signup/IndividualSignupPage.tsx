import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { useDetectedCountry } from '@/hooks/useDetectedCountry';
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
  getIndividualSignupReviewCopy,
  validateIndividualSignupForm,
  type IndividualSignupFormValues,
} from './individualSignupReview';

export function IndividualSignupPage() {
  const { t } = useTranslation('auth');
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
  const countryTouched = useRef(false);
  const phoneCountryTouched = useRef(false);
  const detectedCountry = useDetectedCountry();

  useEffect(() => {
    if (!detectedCountry) return;
    if (!countryTouched.current) {
      setCountry(detectedCountry);
      // Documento já digitado é do país anterior (ex.: locale default) — limpa
      // igual ao handleCountryChange, senão fica reinterpretado sob o spec errado.
      setTaxId('');
    }
    if (!phoneCountryTouched.current) setPhoneCountry(detectedCountry);
  }, [detectedCountry]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCountryChange(next: CountryCode) {
    countryTouched.current = true;
    setCountry(next);
    setTaxId('');
  }

  function handlePhoneCountryChange(next: CountryCode) {
    phoneCountryTouched.current = true;
    setPhoneCountry(next);
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
    () => buildIndividualSignupReviewSections(formValues, t),
    [formValues, t],
  );

  const reviewCopy = useMemo(() => getIndividualSignupReviewCopy(t), [t]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const validation = validateIndividualSignupForm(formValues, t);
    setTermsError(null);

    if (!validation.valid) {
      if (validation.field === 'acceptedTerms') {
        setTermsError(validation.error ?? null);
      }
      setError(validation.error ?? t('signup.common.reviewFormFields'));
      return;
    }

    setReviewOpen(true);
  }

  async function handleConfirmSubmit() {
    if (submitting || !formValues.acceptedTerms) {
      if (!formValues.acceptedTerms) {
        setTermsError(t('signup.common.acceptTermsRequired'));
      }
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitIndividualSignup(buildIndividualSignupPayload(formValues));

      setReviewOpen(false);
      toast.success(result.message ?? t('signup.individual.successToast'));
      await refreshUser();
      navigate('/upload', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('signup.individual.errorFallback');
      setError(message);
      showApiErrorToast(err, message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      width="md"
      eyebrow={t('signup.individual.eyebrow')}
      description={t('signup.individual.description')}
      showSecureBadge
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-doqyn-text">
          <Icon name="person" size={ICON_SIZE.xs} />
          {t('signup.individual.sectionTitle')}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="firstName"
              label={t('signup.common.firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              id="lastName"
              label={t('signup.common.lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Input
            id="email"
            label={t('signup.common.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PhoneInput
            id="whatsapp"
            label={t('signup.common.whatsapp')}
            value={whatsapp}
            onChange={setWhatsapp}
            country={phoneCountry}
            onCountryChange={handlePhoneCountryChange}
            required
          />
          <CountrySelect
            id="country"
            label={t('signup.common.country')}
            value={country}
            onChange={handleCountryChange}
          />
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
            label={t('signup.common.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Input
            id="confirmPassword"
            label={t('signup.common.confirmPassword')}
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
            {t('signup.common.back')}
          </Link>
          <Button type="submit" className="w-full sm:w-auto">
            {t('signup.individual.submit')}
          </Button>
        </div>
      </form>

      <ReviewBeforeSubmitDialog
        open={reviewOpen}
        title={reviewCopy.title}
        description={reviewCopy.description}
        attentionMessage={reviewCopy.attentionMessage}
        sections={reviewSections}
        submitting={submitting}
        confirmLabel={reviewCopy.confirmLabel}
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
