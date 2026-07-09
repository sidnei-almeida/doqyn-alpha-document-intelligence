import { formatDate } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatWhatsapp } from '@/lib/identifiers';
import type { CompanyMemberDto } from '@/features/users/api/usersApi';

type AccessRequestDetailsPanelProps = {
  member?: CompanyMemberDto | null;
  requestedAccess?: CompanyMemberDto['requestedAccess'];
  whatsapp?: string;
  consent?: {
    textVersion?: string;
    acceptedAt?: string;
    operationalNotificationsConsent?: boolean;
  };
  terms?: {
    accepted?: boolean;
    version?: string | null;
    acceptedAt?: string;
  };
  notificationPreferences?: CompanyMemberDto['notificationPreferences'];
  showFullWhatsapp?: boolean;
  className?: string;
};

const NOTIFICATION_LABELS: Record<string, string> = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  documentCreated: 'Documento criado',
  documentUpdated: 'Documento atualizado',
  documentRequiresSignature: 'Assinatura necessária',
  accessApproved: 'Acesso aprovado',
  accessRejected: 'Acesso rejeitado',
};

function display(value: string | undefined | null): string {
  return value?.trim() ? value : '—';
}

function formatPersonType(value: string | undefined): string {
  if (value === 'business') return 'Pessoa jurídica';
  if (value === 'individual') return 'Pessoa física';
  return display(value);
}

export function AccessRequestDetailsPanel({
  member,
  requestedAccess,
  whatsapp,
  consent,
  terms,
  notificationPreferences,
  showFullWhatsapp = true,
  className,
}: AccessRequestDetailsPanelProps) {
  const access = requestedAccess ?? member?.requestedAccess;
  const resolvedWhatsapp = whatsapp ?? member?.whatsapp;
  const resolvedConsent = consent ?? member?.consent;
  const resolvedTerms = terms ?? member?.terms;
  const resolvedPrefs = notificationPreferences ?? member?.notificationPreferences;

  const whatsappDisplay =
    resolvedWhatsapp && showFullWhatsapp
      ? formatWhatsapp(resolvedWhatsapp)
      : resolvedWhatsapp
        ? '***'
        : undefined;

  const enabledPrefs = resolvedPrefs
    ? Object.entries(resolvedPrefs)
        .filter(([, enabled]) => enabled)
        .map(([key]) => NOTIFICATION_LABELS[key] ?? key)
    : [];

  const consentLabel = resolvedConsent?.operationalNotificationsConsent
    ? 'Aceito'
    : resolvedConsent?.textVersion
      ? `Versão ${resolvedConsent.textVersion}`
      : '—';

  const termsLabel = resolvedTerms?.accepted
    ? 'Aceito'
    : resolvedTerms?.version
      ? 'Não confirmado'
      : '—';

  return (
    <div className={className}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-doqyn-muted">
        Detalhes da solicitação
      </p>
      <dl className="detail-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3">
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Documento (CNPJ/CPF)</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {display(access?.taxIdMasked)}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Tipo de pessoa</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {formatPersonType(access?.personType)}
          </dd>
        </div>
        <div className="detail-item min-w-0 sm:col-span-2">
          <dt className="text-xs text-doqyn-muted">Empresa informada</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {access?.tenantDisplayName ? (
              <Tooltip label={access.tenantDisplayName}>
                <span>{display(access.tenantDisplayName)}</span>
              </Tooltip>
            ) : (
              display(access?.tenantDisplayName)
            )}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Cargo</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {display(access?.jobTitle)}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Setor</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {display(access?.departmentText)}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">WhatsApp</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {display(whatsappDisplay)}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Data da solicitação</dt>
          <dd className="detail-value mt-0.5 text-sm text-doqyn-text">
            {access?.requestedAt ? formatDate(access.requestedAt) : '—'}
          </dd>
        </div>
        <div className="detail-item min-w-0 sm:col-span-2">
          <dt className="text-xs text-doqyn-muted">Motivo do acesso</dt>
          <dd className="detail-value mt-0.5 whitespace-pre-wrap break-words text-sm text-doqyn-text">
            {display(access?.reason)}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Notificações operacionais</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {consentLabel}
            {resolvedConsent?.acceptedAt
              ? ` · ${formatDate(resolvedConsent.acceptedAt)}`
              : ''}
          </dd>
        </div>
        <div className="detail-item min-w-0">
          <dt className="text-xs text-doqyn-muted">Preferências de notificação</dt>
          <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
            {enabledPrefs.length > 0 ? enabledPrefs.join(', ') : '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-doqyn-border-subtle pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-doqyn-muted">
          Conformidade
        </p>
        <dl className="detail-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3">
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">Termos de uso</dt>
            <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">{termsLabel}</dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">Versão dos termos</dt>
            <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
              {display(resolvedTerms?.version)}
            </dd>
          </div>
          <div className="detail-item min-w-0 sm:col-span-2">
            <dt className="text-xs text-doqyn-muted">Aceite registrado em</dt>
            <dd className="detail-value mt-0.5 break-words text-sm text-doqyn-text">
              {resolvedTerms?.acceptedAt ? formatDate(resolvedTerms.acceptedAt) : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
