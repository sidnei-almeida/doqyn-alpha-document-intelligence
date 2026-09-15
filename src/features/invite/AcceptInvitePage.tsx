import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TermsAcceptanceCheckbox } from '@/components/ui/TermsAcceptanceCheckbox';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { ApiError } from '@/lib/apiErrors';
import { useAuth } from '@/features/auth/useAuth';
import { inviteApi, type InvitePreview } from './api/inviteApi';
import {
  ACCEPT_INVITE_REVIEW_COPY_KEYS,
  buildAcceptInvitePayload,
  buildAcceptInviteReviewSections,
  validateAcceptInviteForm,
  type AcceptInviteFormValues,
} from './inviteAcceptReview';
import { useTranslation } from 'react-i18next';

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
        {/* Régua com rótulo de registro, a mesma dos outros cadastros da antessala. Era um
            `section-title` solto, que não pertencia a nenhuma das duas linguagens. */}
        <div className="border-b border-doqyn-border-subtle pb-2.5 font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
          {title}
        </div>
        {description && <p className="mt-2 text-xs text-doqyn-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function AcceptInvitePage() {
  const { t } = useTranslation('auth');

  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
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
          title: t('acceptInvitePage.invalidTitle'),
          message: t('acceptInvitePage.incompleteLink'),
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
          title: t(inviteErrorTitleKey(code)),
          message:
            error instanceof ApiError
              ? error.friendlyMessage
              : t('acceptInvitePage.unavailableMessage'),
          code,
        });
      }
    }

    void loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

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
    () => (reviewOptions ? buildAcceptInviteReviewSections(formValues, reviewOptions, t) : []),
    [formValues, reviewOptions, t],
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
      toast.error(validation.error ?? t('signup.reviewFields'));
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
      // A frase do servidor é português e existe para log; a confirmação sai do catálogo.
      const message = t('acceptInvitePage.accepted');
      setPageState({ kind: 'success', message });
      toast.success(message);
      if (result.sessionEstablished) {
        // A área logada decide pelo usuário carregado no provedor. Sem recarregar a sessão aqui,
        // quem acabou de entrar seria mandado ao login com o cookie já válido.
        await refreshUser();
        navigate('/library', { replace: true });
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.friendlyMessage : t('acceptInvitePage.acceptFailed');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Volta ao convite depois de entrar: o login lê `state.from`, e o OAuth leva o mesmo destino.
  const returnToInvite = { from: { pathname: `/invite/${token}` } };

  async function switchAccount() {
    await logout();
    navigate('/login', { replace: true, state: returnToInvite });
  }

  /**
   * Conta que já existe só aceita convite logada nela — o token prova que o link foi aberto, não
   * de quem é a conta. Sem sessão, a página pede para entrar; logado em outra conta, pede para
   * trocar. O servidor recusa do mesmo jeito; isto é para a pessoa não preencher um formulário à toa.
   */
  const loginGate: 'login' | 'wrong_account' | null = (() => {
    if (pageState.kind !== 'ready' || !pageState.invite.requiresLogin) return null;
    if (!user?.email) return 'login';
    const invited = pageState.invite.email.trim().toLowerCase();
    return user.email.trim().toLowerCase() === invited ? null : 'wrong_account';
  })();

  return (
    <>
      {pageState.kind === 'ready' && loginGate === 'login' && (
        <>
          <AuthHeading
            title={t('acceptInvitePage.loginRequiredTitle')}
            description={t('acceptInvitePage.loginRequiredMessage', {
              email: pageState.invite.email,
              tenant: pageState.invite.tenantDisplayName,
            })}
          />
          <Button
            className="w-full"
            onClick={() => navigate('/login', { state: returnToInvite })}
          >
            {t('acceptInvitePage.loginToAccept')}
          </Button>
        </>
      )}

      {pageState.kind === 'ready' && loginGate === 'wrong_account' && (
        <>
          <AuthHeading
            title={t('acceptInvitePage.wrongAccountTitle')}
            description={t('acceptInvitePage.wrongAccountMessage', {
              current: user?.email ?? '',
              invited: pageState.invite.email,
            })}
          />
          <Button className="w-full" onClick={() => void switchAccount()}>
            {t('acceptInvitePage.switchAccount')}
          </Button>
        </>
      )}

      {pageState.kind === 'loading' && (
        <>
          <AuthHeading
            title={t('acceptInvitePage.convite')}
            description={t('acceptInvitePage.conferindoSeEsteConvite')}
          />
        </>
      )}

      {/* Sem cartão em volta. O aviso é o conteúdo da coluna, e a casca da antessala já é a
          moldura — desenhar outra dentro dela empilhava duas superfícies para dizer uma frase. */}
      {pageState.kind === 'error' && (
        <>
          <AuthHeading title={pageState.title} description={pageState.message} />
          <AuthFooterLink>
            <Link
              to="/login"
              className="text-doqyn-accent-active underline-offset-4 transition-colors hover:underline"
            >
              {t('acceptInvitePage.irParaOLogin')}
            </Link>
          </AuthFooterLink>
        </>
      )}

      {pageState.kind === 'success' && (
        <>
          <AuthHeading
            title={t('acceptInvitePage.conviteAceito')}
            description={pageState.message}
          />
          <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
            {t('acceptInvitePage.irParaOLogin2')}
          </Button>
        </>
      )}

      {pageState.kind === 'ready' && loginGate === null && (
        <>
          <AuthHeading
            title={t('acceptInvitePage.invitedTo', { tenant: pageState.invite.tenantDisplayName })}
            description={t('acceptInvitePage.completeSeuCadastroE')}
          />

          <form className="space-y-8" onSubmit={handleSubmit}>
            <FormSection
              title={t('acceptInvitePage.empresa')}
              description={t('acceptInvitePage.dadosDaEmpresaQue')}
            >
              <Input
                label={t('acceptInvitePage.empresa2')}
                value={pageState.invite.tenantDisplayName}
                readOnly
                disabled
              />
              {pageState.invite.tenantTaxIdMasked ? (
                <Input label="CNPJ" value={pageState.invite.tenantTaxIdMasked} readOnly disabled />
              ) : null}
              <Input
                label={t('acceptInvitePage.eMailDoConvite')}
                value={pageState.invite.email}
                readOnly
                disabled
              />
            </FormSection>

            <div className="h-px bg-doqyn-border-subtle" />

            <FormSection
              title={t('acceptInvitePage.seusDados')}
              description={t('acceptInvitePage.informacoesDeContatoE')}
            >
              {/* Nome só para conta nova. Conta existente aceita logada, e o nome é dela. */}
              {pageState.invite.requiresAccountCreation ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label={t('acceptInvitePage.nome')}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                    required
                  />
                  <Input
                    label={t('acceptInvitePage.sobrenome')}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </div>
              ) : null}

              {pageState.invite.requiresPassword ? (
                <>
                  <Input
                    label={t('acceptInvitePage.senhaDeAcesso')}
                    type="password"
                    revealable
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <Input
                    label={t('acceptInvitePage.confirmarSenha')}
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
                <p className="border-l-2 border-doqyn-accent-active/40 pl-3 text-sm text-doqyn-muted">
                  {t('acceptInvitePage.suaContaJaExiste')}
                </p>
              )}

              {pageState.invite.requiresWhatsapp ? (
                <WhatsappInput
                  label={t('acceptInvitePage.whatsapp')}
                  value={whatsapp}
                  onChange={setWhatsapp}
                  required
                />
              ) : null}

              <Input
                label={t('acceptInvitePage.cargoOuFuncao')}
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder={t('acceptInvitePage.exAnalistaFinanceiro')}
                required
              />

              <div>
                <Input
                  label={t('acceptInvitePage.setorInformado')}
                  value={departmentText}
                  onChange={(event) => setDepartmentText(event.target.value)}
                  placeholder={t('acceptInvitePage.exFinanceiroJuridicoRh')}
                  required
                />
                <p className="mt-1.5 text-xs text-doqyn-subtle">
                  {t('acceptInvitePage.informacaoDeclaradaOAdministrador')}
                </p>
              </div>
            </FormSection>

            <div className="h-px bg-doqyn-border-subtle" />

            <div className="space-y-4">
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
                checked={informationDeclaration}
                onChange={(event) => {
                  setInformationDeclaration(event.target.checked);
                  if (event.target.checked) setDeclarationError(null);
                }}
                required
                wrapperClassName="border-0 bg-transparent px-0 py-1"
                label={
                  <span className="text-sm leading-relaxed text-doqyn-muted">
                    {t('acceptInvitePage.declaroQueAsInformacoes')}
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
                wrapperClassName="border-0 bg-transparent px-0 py-1"
                label={
                  <span className="text-sm leading-relaxed text-doqyn-muted">
                    {t('acceptInvitePage.consentText')}
                  </span>
                }
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-doqyn-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Link
                to="/login"
                state={returnToInvite}
                className="text-center text-sm text-doqyn-muted transition-colors hover:text-doqyn-text sm:text-left"
              >
                {t('acceptInvitePage.jaTenhoConta')}
              </Link>
              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {t('acceptInvitePage.revisarEAceitar')}
              </Button>
            </div>
          </form>

          <ReviewBeforeSubmitDialog
            open={reviewOpen}
            title={t(ACCEPT_INVITE_REVIEW_COPY_KEYS.title)}
            description={t(ACCEPT_INVITE_REVIEW_COPY_KEYS.description)}
            sections={reviewSections}
            submitting={submitting}
            confirmLabel={t(ACCEPT_INVITE_REVIEW_COPY_KEYS.confirmLabel)}
            onCancel={() => {
              if (!submitting) setReviewOpen(false);
            }}
            onEdit={() => {
              if (!submitting) setReviewOpen(false);
            }}
            onConfirm={handleConfirmSubmit}
          />
        </>
      )}
    </>
  );
}

function inviteErrorTitleKey(code?: string): string {
  switch (code) {
    case 'INVITE_EXPIRED':
      return 'acceptInvitePage.errorTitle.expired';
    case 'INVITE_REVOKED':
      return 'acceptInvitePage.errorTitle.revoked';
    case 'INVITE_ALREADY_USED':
      return 'acceptInvitePage.errorTitle.used';
    case 'MEMBER_ALREADY_EXISTS':
      return 'acceptInvitePage.errorTitle.memberExists';
    default:
      return 'acceptInvitePage.errorTitle.unavailable';
  }
}
