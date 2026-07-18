import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
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
import { submitCompanySignup } from './api/companySignupApi';
import {
  buildCompanySignupPayload,
  buildCompanySignupReviewSections,
  COMPANY_SIGNUP_REVIEW_COPY,
  validateCompanySignupForm,
  type CompanySignupFormValues,
} from './companySignupReview';

export function CompanySignupPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState<CountryCode>(() =>
    defaultCountryForLocale(getActiveLocale()),
  );
  const [taxId, setTaxId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() =>
    defaultPhoneCountry(getActiveLocale()),
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [companyAuthorization, setCompanyAuthorization] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCountryChange(next: CountryCode) {
    setCountry(next);
    setTaxId('');
  }

  const documentSpec = useMemo(() => getIdentifierSpec(country, 'company'), [country]);

  const formValues = useMemo<CompanySignupFormValues>(
    () => ({
      companyName,
      country,
      taxId,
      firstName,
      lastName,
      email,
      whatsapp,
      whatsappCountry: phoneCountry,
      password,
      confirmPassword,
      acceptedTerms,
      companyAuthorization,
    }),
    [
      companyName,
      country,
      taxId,
      firstName,
      lastName,
      email,
      whatsapp,
      phoneCountry,
      password,
      confirmPassword,
      acceptedTerms,
      companyAuthorization,
    ],
  );

  const reviewSections = useMemo(() => buildCompanySignupReviewSections(formValues), [formValues]);

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
      const result = await submitCompanySignup(buildCompanySignupPayload(formValues));

      setReviewOpen(false);
      toast.success(result.message ?? t('signup.company.successToast'));
      await refreshUser();
      navigate('/upload', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('signup.company.errorFallback');
      setError(message);
      showApiErrorToast(err, message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      width="md"
      eyebrow={t('signup.company.eyebrow')}
      description={t('signup.company.description')}
      showSecureBadge
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-doqyn-text">
          <Icon name="business" size={ICON_SIZE.xs} />
          {t('signup.company.sectionTitle')}
        </div>

        <div className="space-y-4">
          <Input
            id="companyName"
            label={t('signup.company.companyNameLabel')}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
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
            personType="company"
            label={documentSpec.code}
            value={taxId}
            onChange={setTaxId}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="firstName"
              label={t('signup.company.responsibleFirstNameLabel')}
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
            label={t('signup.company.emailLabel')}
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
            onCountryChange={setPhoneCountry}
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
                {t('signup.company.authorizationText')}
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
            {t('signup.common.back')}
          </Link>
          <Button type="submit" className="w-full sm:w-auto">
            {t('signup.company.submit')}
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
