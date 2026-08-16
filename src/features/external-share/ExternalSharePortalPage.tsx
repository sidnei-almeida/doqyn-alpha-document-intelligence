import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DoqynLogo } from '@/components/brand';
import { Badge } from '@/components/ui/Badge';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TruncatedText } from '@/components/ui/TruncatedText';
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
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Icon
        name="progress_activity"
        size={ICON_SIZE.md}
        className="animate-spin text-doqyn-muted"
      />
      <p className="text-sm text-doqyn-subtle">Carregando convite…</p>
    </div>
  );
}

function InviteErrorState({ message, code }: { message: string; code?: string }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface p-8 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-doqyn-card/70 text-doqyn-muted">
        <Icon name="link_off" size={ICON_SIZE.md} />
      </div>
      <h1 className="text-base font-semibold text-doqyn-text">Compartilhamento indisponível</h1>
      <p className="mt-2 text-sm leading-relaxed text-doqyn-subtle">{message}</p>
      {code ? <p className="mt-3 text-xs text-doqyn-muted">Código: {code}</p> : null}
    </div>
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
  return (
    <section className="mx-auto w-full max-w-xl rounded-xl border border-doqyn-border bg-doqyn-surface p-6 sm:p-8">
      <p className="text-eyebrow uppercase text-doqyn-subtle">
        Compartilhado por {payload.ownerTenantName}
      </p>
      <p className="mt-1 text-xs text-doqyn-muted">
        {payload.sharedByName}
        {payload.recipientOrganizationName ? ` · ${payload.recipientOrganizationName}` : ''}
      </p>

      <div className="mt-4 flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-doqyn-card/70 text-doqyn-muted">
          <Icon name="description" size={ICON_SIZE.xs} />
        </span>
        <div className="min-w-0 flex-1">
          <TruncatedText as="h2" className="text-base font-semibold text-doqyn-text sm:text-lg">
            {payload.document.displayName}
          </TruncatedText>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="neutral">{payload.document.categoryName}</Badge>
            {payload.document.versionLabel ? (
              <VersionBadge version={payload.document.versionLabel} isCurrent size="sm" />
            ) : null}
            <Badge variant="pending">Aguardando aceite</Badge>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-1 text-sm text-doqyn-subtle">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-doqyn-muted">Compartilhado em</dt>
          <dd>{formatShareDate(payload.sharedAt)}</dd>
        </div>
        {expiresLabel ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-doqyn-muted">Expira em</dt>
            <dd className="text-doqyn-warning">{expiresLabel}</dd>
          </div>
        ) : null}
      </dl>

      {payload.message ? (
        <blockquote className="mt-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-card px-4 py-3 text-sm leading-relaxed text-doqyn-text">
          {payload.message}
        </blockquote>
      ) : null}

      <p className="mt-5 text-sm leading-relaxed text-doqyn-subtle">
        Você recebeu acesso somente a este documento. Aceite o convite para visualizar o conteúdo
        compartilhado.
      </p>

      <Button
        type="button"
        onClick={onAccept}
        disabled={accepting}
        className="mt-5 w-full sm:w-auto"
        data-testid="external-share-accept"
      >
        {accepting ? 'Aceitando…' : 'Aceitar e visualizar'}
      </Button>
    </section>
  );
}

export function ExternalSharePortalPage() {
  const { token = '' } = useParams();
  const [portal, setPortal] = useState<PortalState>({ kind: 'loading' });
  const [downloading, setDownloading] = useState(false);

  const pageMeta = useMemo(() => {
    if (portal.kind !== 'ready') {
      return {
        title: 'Compartilhamento · DOQYN',
        description: 'Acesse um documento compartilhado com segurança no DOQYN.',
        imagePath: '/og/portal-default.webp',
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
          ? `${payload.sharedByName} convidou você a acessar um documento em ${payload.ownerTenantName}.`
          : `${payload.sharedByName} compartilhou um documento com você via ${payload.ownerTenantName}.`,
      imagePath:
        payload.status === 'active' && payload.permissions?.canView
          ? `/api/og/guest/share/${encodeURIComponent(token)}/image`
          : '/og/portal-default.webp',
    };
  }, [portal, token]);

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
    <div
      className="flex min-h-screen flex-col bg-doqyn-bg text-doqyn-text"
      data-testid="external-share-portal"
    >
      <header className="shrink-0 border-b border-doqyn-border bg-doqyn-bg px-4 py-3 sm:px-6">
        <div className="flex w-full items-center justify-between gap-4">
          <DoqynLogo size="sm" variant="horizontal" subtitle="Acesso seguro a documento" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-10 sm:px-6">
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
      </main>

      <footer className="shrink-0 border-t border-doqyn-border px-4 py-3 text-center sm:px-6">
        <p className="text-micro leading-relaxed text-doqyn-muted">
          Acesso limitado a este documento. O link pode ser revogado a qualquer momento pelo
          responsável.
        </p>
      </footer>
    </div>
  );
}
