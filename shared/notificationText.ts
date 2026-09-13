/**
 * O texto de uma notificação in-app, montado a partir do tipo e dos valores gravados.
 *
 * Mora em `shared/` porque roda dos dois lados: o servidor grava uma cópia pronta (a que o e-mail
 * usa) e a tela relê os mesmos valores no idioma de quem abre. Duas montagens divergiriam — a
 * escolha de variante (com ou sem prazo, com ou sem autor) é regra, não tradução.
 *
 * O que a pessoa escreveu (mensagem de compartilhamento, motivo de recusa) entra como está: é
 * conteúdo, não frase do produto.
 */
export type NotificationParams = Record<string, string | number | boolean>;

export type NotificationTextDeps = {
  /** `t` já preso ao namespace `notifications`. */
  t: (key: string, values?: Record<string, unknown>) => string;
  /** Data de calendário `yyyy-mm-dd` no formato do idioma. */
  formatCalendarDate: (value: string) => string;
};

export type NotificationText = { title: string; body?: string };

/** Descarta o que veio vazio: valor ausente escolhe a variante, e não pode chegar como `""`. */
export function compactNotificationParams(
  values: Record<string, string | number | boolean | null | undefined>,
): NotificationParams {
  const params: NotificationParams = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    params[key] = typeof value === 'string' ? value.trim() : value;
  }
  return params;
}

function text(params: NotificationParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function approvalSubject(params: NotificationParams, deps: NotificationTextDeps): string {
  const subject =
    text(params, 'documentName') ?? deps.t(`inApp.approvalKind.${String(params.kind)}`);
  // Compartilhar tem um segundo lado, e ele é o que o administrador precisa ver para decidir.
  const memberName = text(params, 'memberName');
  return memberName ? `${subject} → ${memberName}` : subject;
}

/** `undefined` quando o tipo não tem montagem — quem chama cai no texto gravado. */
export function renderNotificationText(
  type: string,
  params: NotificationParams,
  deps: NotificationTextDeps,
): NotificationText | undefined {
  const { t } = deps;
  const key = (leaf: string) => `inApp.${type}.${leaf}`;

  switch (type) {
    case 'document_expiring': {
      const days = Number(params.daysRemaining);
      if (!Number.isFinite(days)) return undefined;
      if (days === 0) return { title: t(key('today'), params) };
      return {
        title: t(key(days < 0 ? 'overdue' : 'upcoming'), { ...params, count: Math.abs(days) }),
      };
    }

    case 'document_created':
      return {
        title: t(key(text(params, 'categoryName') ? 'title' : 'titleNoCategory'), params),
        body: text(params, 'actorName') ? t(key('body'), params) : undefined,
      };

    case 'document_updated':
      return {
        title: t(key('title'), params),
        body: text(params, 'actorName') ? t(key('body'), params) : undefined,
      };

    case 'signature_required': {
      const deadline = text(params, 'deadline');
      const leaf = `${text(params, 'actorName') ? 'title' : 'titleNoActor'}${deadline ? 'Deadline' : ''}`;
      return {
        title: t(key(leaf), {
          ...params,
          ...(deadline ? { deadline: deps.formatCalendarDate(deadline) } : {}),
        }),
      };
    }

    case 'document_shared':
      return {
        title: t(key(text(params, 'actorName') ? 'title' : 'titleNoActor'), params),
        // O que a pessoa pode fazer é parte do aviso: "compartilhou" sem isso não diz se ela pode
        // baixar ou só ler na tela.
        body:
          text(params, 'message') ??
          t(key(params.canDownload === true ? 'bodyDownload' : 'bodyViewOnly')),
      };

    case 'access_approved':
    case 'access_rejected':
      return {
        title: t(key(text(params, 'tenantName') ? 'title' : 'titleNoTenant'), params),
        body: text(params, 'reason'),
      };

    case 'approval_requested':
      return { title: t(key('title'), params), body: approvalSubject(params, deps) };

    case 'approval_decided': {
      const subject = approvalSubject(params, deps);
      const reason = text(params, 'reason');
      return {
        title: t(key(params.approved === true ? 'titleApproved' : 'titleRejected')),
        body: reason ? `${subject} — ${reason}` : subject,
      };
    }

    case 'member_joined':
      return {
        title: t(key('title'), params),
        body: [text(params, 'email'), text(params, 'jobTitle')].filter(Boolean).join(' · '),
      };

    case 'inbound_share_received':
      return {
        title: t(key('title'), params),
        body: [text(params, 'documentName'), text(params, 'sharedByName')]
          .filter(Boolean)
          .join(' · '),
      };

    case 'inbound_share_accepted':
    case 'inbound_share_declined':
      return { title: t(key('title'), params), body: text(params, 'documentName') };

    case 'document_requested': {
      const dueDate = text(params, 'dueDate');
      return {
        title: t(key('title'), params),
        body: dueDate
          ? t(key('bodyDue'), { ...params, dueDate: deps.formatCalendarDate(dueDate) })
          : text(params, 'requestTitle'),
      };
    }

    case 'document_request_fulfilled':
      return {
        title: t(key('title')),
        body: t(key(params.crossTenant === true ? 'bodyCrossTenant' : 'body'), params),
      };

    default:
      return undefined;
  }
}
