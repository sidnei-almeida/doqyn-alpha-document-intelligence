import { Shield, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DoqynLogo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { TaxIdInput } from '@/components/ui/TaxIdInput';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/features/auth/useAuth';
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
  const [taxId, setTaxId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formValues = useMemo<IndividualSignupFormValues>(
    () => ({
      firstName,
      lastName,
      email,
      whatsapp,
      taxId,
      password,
      confirmPassword,
      acceptedTerms,
    }),
    [firstName, lastName, email, whatsapp, taxId, password, confirmPassword, acceptedTerms],
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

      <div className="w-full max-w-lg flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="lg" align="center" showSubtitle subtitle="Pessoa física" />
          <p className="mt-4 max-w-md text-sm text-doqyn-muted">
            Para clientes CPF que precisam acessar documentos pessoais no DOQYN.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-doqyn-text">
            <User className="h-4 w-4" strokeWidth={1.5} />
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
            <WhatsappInput
              id="whatsapp"
              label="WhatsApp"
              value={whatsapp}
              onChange={setWhatsapp}
              required
            />
            <TaxIdInput
              id="taxId"
              kind="CPF"
              label="CPF"
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

          {error && <p className="form-error mt-4 text-center">{error}</p>}

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

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
          Documentos pessoais protegidos
        </p>
      </div>
    </main>
  );
}
