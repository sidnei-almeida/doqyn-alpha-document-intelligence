import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TruncatedText } from '@/components/ui/TruncatedText';
import {
  GuestPortalShell,
  GuestRegisterRow,
  GuestSeal,
} from '@/features/guest-portal/GuestPortalShell';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import type { ExternalSharePortalPayload } from '@/features/sharing/api/externalShareApi';
import {
  acceptExternalShareInvite,
  downloadExternalShareDocument,
  fetchExternalSharePortal,
  fetchExternalSharePreviewManifest,
} from '@/features/sharing/api/externalShareApi';
import { GuestDocumentViewer } from './GuestDocumentViewer';
import { useGuestPortalPageMeta } from '@/features/guest-portal/useGuestPortalPageMeta';
import { useTranslation } from 'react-i18next';

type PortalState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; code?: string }
  | {
      kind: 'ready';
      payload: ExternalSharePortalPayload;
      manifest: DocumentPreviewManifest | null;
      accepting?: boolean;
    };

function formatShareDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InviteLoadingState() {
  const { t } = useTranslation('externalShare');

  return (
    <div className="guest-state" data-testid="external-share-loading">
      <Icon
        name="progress_activity"
        size={ICON_SIZE.md}
        className="animate-spin text-doqyn-muted"
      />
      <p className="type-caption text-doqyn-subtle">
        {t('externalSharePortalPage.abrindoOConvite')}
      </p>
    </div>
  );
}

function InviteErrorState({ message, code }: { message: string; code?: string }) {
  const { t } = useTranslation('externalShare');

  return (
    <section className="guest-card guest-card--narrow">
      <p className="register-label text-doqyn-subtle">
        {t('externalSharePortalPage.conviteIndisponivel')}
      </p>
      <h1 className="guest-title">{t('externalSharePortalPage.esteLinkNaoAbre')}</h1>
      <p className="type-body mt-3 text-doqyn-muted">{message}</p>
      {code ? (
        <p className="register-label mt-4 text-doqyn-subtle">
          {t('externalSharePortalPage.codigo')} {code}
        </p>
      ) : null}
      <p className="type-caption mt-6 text-doqyn-subtle">
        {t('externalSharePortalPage.pecaUmNovoLink')}
      </p>
    </section>
  );
}

function PendingInvitePanel({
  payload,
  expiresLabel,
  onAccept,
  accepting,
}: {
  payload: ExternalSharePortalPayload;
  expiresLabel: string | null;
  onAccept: () => void;
  accepting?: boolean;
}) {
  const { t } = useTranslation('externalShare');

  return (
    <section className="guest-card">
      <p className="register-label text-doqyn-subtle">
        {t('externalSharePortalPage.conviteDeAcesso')}
      </p>

      <TruncatedText as="h2" className="guest-title mt-2">
        {payload.document.displayName}
      </TruncatedText>

      <p className="type-body mt-2 text-doqyn-muted">
        {payload.sharedByName} {t('externalSharePortalPage.compartilhouEsteDocumentoCom')}{' '}
        {payload.ownerTenantName}.
      </p>

      <dl className="guest-register">
        <GuestRegisterRow
          label={t('externalSharePortalPage.categoria')}
          value={payload.document.categoryName || 'Sem categoria'}
        />
        {payload.document.versionLabel ? (
          <GuestRegisterRow
            label={t('externalSharePortalPage.versao')}
            value={payload.document.versionLabel}
          />
        ) : null}
        <GuestRegisterRow
          label={t('externalSharePortalPage.compartilhadoEm')}
          value={formatShareDate(payload.sharedAt)}
        />
        {expiresLabel ? (
          <GuestRegisterRow
            label={t('externalSharePortalPage.acessoAte')}
            value={expiresLabel}
            tone="warning"
          />
        ) : null}
      </dl>

      {payload.message ? <blockquote className="guest-quote">{payload.message}</blockquote> : null}

      <p className="type-caption mt-6 text-doqyn-subtle">
        {t('externalSharePortalPage.oAcessoValeSo')}
      </p>

      <div className="guest-actions">
        <Button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          data-testid="external-share-accept"
        >
          {t(
            accepting ? 'externalSharePortalPage.opening' : 'externalSharePortalPage.acceptAndOpen',
          )}
        </Button>
      </div>
    </section>
  );
}

export function ExternalSharePortalPage() {
  const { t } = useTranslation('externalShare');

  const { token = '' } = useParams();
  const [portal, setPortal] = useState<PortalState>({ kind: 'loading' });
  const [downloading, setDownloading] = useState(false);

  const pageMeta = useMemo(() => {
    if (portal.kind !== 'ready') {
      return {
        title: 'Compartilhamento · DOQYN',
        description: 'Acesse um documento compartilhado com segurança no DOQYN.',
        imagePath: '/og/portal-card-share.png',
      };
    }

    const { payload } = portal;
    const versionSuffix = payload.document.versionLabel
      ? ` · ${payload.document.versionLabel}`
      : '';
    return {
      title: `${payload.document.displayName}${versionSuffix} · DOQYN`,
      description:
        payload.status === 'pending'
          ? t('externalSharePortalPage.invitedByTenant', {
              name: payload.sharedByName,
              tenant: payload.ownerTenantName,
            })
          : t('externalSharePortalPage.sharedByTenant', {
              name: payload.sharedByName,
              tenant: payload.ownerTenantName,
            }),
      // Cartão de marca, nunca o documento: a imagem de prévia é buscada sem autenticação por
      // quem monta o card do link, e o resultado fica visível para todo o grupo onde ele for
      // colado.
      imagePath: '/og/portal-card-share.png',
    };
  }, [portal]);

  useGuestPortalPageMeta(pageMeta);

  useEffect(() => {
    if (!token) {
      setPortal({ kind: 'error', message: 'Link inválido.' });
      return;
    }

    let cancelled = false;

    async function load() {
      setPortal({ kind: 'loading' });
      try {
        const payload = await fetchExternalSharePortal(token);
        const manifest =
          payload.status === 'active'
            ? ((await fetchExternalSharePreviewManifest(token)) as DocumentPreviewManifest)
            : null;
        if (!cancelled) {
          setPortal({ kind: 'ready', payload, manifest });
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Não foi possível abrir este compartilhamento.';
        const code =
          typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;
        setPortal({ kind: 'error', message, code });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const expiresLabel = useMemo(() => {
    if (portal.kind !== 'ready' || !portal.payload.expiresAt) return null;
    return formatShareDate(portal.payload.expiresAt);
  }, [portal]);

  const handleAccept = async () => {
    if (!token || portal.kind !== 'ready' || portal.payload.status !== 'pending') return;
    setPortal({ ...portal, accepting: true });
    try {
      await acceptExternalShareInvite(token);
      const payload = await fetchExternalSharePortal(token);
      const manifest = (await fetchExternalSharePreviewManifest(token)) as DocumentPreviewManifest;
      setPortal({ kind: 'ready', payload, manifest });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível aceitar este convite.';
      const code =
        typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;
      setPortal({ kind: 'error', message, code });
    }
  };

  const handleDownload = async () => {
    if (
      portal.kind !== 'ready' ||
      portal.payload.status !== 'active' ||
      !portal.payload.permissions.canDownload
    ) {
      return;
    }
    setDownloading(true);
    try {
      const blob = await downloadExternalShareDocument(token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = portal.payload.document.displayName || 'documento';
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const isPendingInvite = portal.kind === 'ready' && portal.payload.status === 'pending';
  const isActiveWithPreview =
    portal.kind === 'ready' && portal.payload.status === 'active' && portal.manifest !== null;

  if (isActiveWithPreview && portal.kind === 'ready' && portal.manifest) {
    return (
      <div className="min-h-screen bg-doqyn-bg text-doqyn-text" data-testid="external-share-portal">
        <GuestDocumentViewer
          manifest={portal.manifest}
          payload={portal.payload}
          onClose={() => window.close()}
          onDownload={() => void handleDownload()}
          isDownloading={downloading}
        />
      </div>
    );
  }

  return (
    <div data-testid="external-share-portal">
      <GuestPortalShell
        subtitle="Acesso seguro a documento"
        headerAside={
          portal.kind === 'ready' && isPendingInvite ? (
            <GuestSeal>{t('externalSharePortalPage.aguardandoAceite')}</GuestSeal>
          ) : null
        }
        footNote="Acesso limitado a este documento. O link pode ser revogado a qualquer momento por quem compartilhou."
      >
        {portal.kind === 'loading' ? <InviteLoadingState /> : null}
        {portal.kind === 'error' ? (
          <InviteErrorState message={portal.message} code={portal.code} />
        ) : null}
        {portal.kind === 'ready' && isPendingInvite ? (
          <PendingInvitePanel
            payload={portal.payload}
            expiresLabel={expiresLabel}
            onAccept={handleAccept}
            accepting={portal.accepting}
          />
        ) : null}
      </GuestPortalShell>
    </div>
  );
}
