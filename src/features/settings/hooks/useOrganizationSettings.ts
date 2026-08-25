import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTrashRetentionSettings } from '@/features/library/hooks/useTrashMutations';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { showAppToast } from '@/shared/feedback/appFeedback';
import { tenantEmailApi, type TenantOutboundEmailConfig } from '../api/tenantEmailApi';
import { useUploadPolicy } from './useUploadPolicy';

export type RetentionDraft = {
  mode: 'days' | 'manual';
  days: number;
};

export type OutboundEmailDraft = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  enabled: boolean;
};

const EMPTY_EMAIL_DRAFT: OutboundEmailDraft = {
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  enabled: true,
};

const TENANT_EMAIL_QUERY_KEY = ['tenant-outbound-email'] as const;

function signature(value: unknown): string {
  return JSON.stringify(value);
}

function emailDraftFromConfig(config: TenantOutboundEmailConfig | undefined): OutboundEmailDraft {
  if (!config?.configured) return EMPTY_EMAIL_DRAFT;
  return {
    smtpHost: config.smtpHost ?? '',
    smtpPort: config.smtpPort ?? 587,
    smtpSecure: Boolean(config.smtpSecure),
    smtpUser: config.smtpUser ?? '',
    smtpPassword: '',
    enabled: config.enabled ?? true,
  };
}

/**
 * Rascunho da tela inteira de Organização. A regra de salvamento é uma só: nada vale
 * até confirmar, e uma barra no fim da coluna salva os blocos que mudaram.
 */
export function useOrganizationSettings({ governs }: { governs: boolean }) {
  const queryClient = useQueryClient();

  const uploadPolicy = useUploadPolicy();
  const [uploadDraft, setUploadDraft] = useState<WorkflowReviewSettings>(uploadPolicy.policy);
  useEffect(() => {
    setUploadDraft(uploadPolicy.policy);
  }, [uploadPolicy.policy]);

  const retention = useTrashRetentionSettings();
  const retentionSettings = retention.data;
  const [retentionDraft, setRetentionDraft] = useState<RetentionDraft>({
    mode: 'days',
    days: 30,
  });
  useEffect(() => {
    if (!retentionSettings) return;
    setRetentionDraft({
      mode: retentionSettings.trashRetentionMode,
      days: retentionSettings.trashRetentionDays,
    });
  }, [retentionSettings]);

  const emailQuery = useQuery({
    queryKey: TENANT_EMAIL_QUERY_KEY,
    queryFn: async () => (await tenantEmailApi.get()).outboundEmail,
    enabled: governs,
  });
  const emailConfig = emailQuery.data;
  const [emailDraft, setEmailDraft] = useState<OutboundEmailDraft>(EMPTY_EMAIL_DRAFT);
  useEffect(() => {
    setEmailDraft(emailDraftFromConfig(emailConfig));
  }, [emailConfig]);

  const emailTest = useMutation({
    mutationFn: () =>
      tenantEmailApi.test(
        emailDraft.smtpPassword
          ? {
              smtpHost: emailDraft.smtpHost,
              smtpPort: emailDraft.smtpPort,
              smtpSecure: emailDraft.smtpSecure,
              smtpUser: emailDraft.smtpUser,
              smtpPassword: emailDraft.smtpPassword,
            }
          : undefined,
      ),
    onSuccess: (result) =>
      showAppToast({ type: 'success', title: 'Teste enviado', message: result.message }),
    onError: (error: Error) =>
      showAppToast({
        type: 'error',
        title: 'Falha no envio de teste',
        message: error.message || 'Verifique host, conta e senha.',
      }),
  });

  const uploadDirty =
    uploadPolicy.canManage && signature(uploadDraft) !== signature(uploadPolicy.policy);

  const retentionDirty =
    governs &&
    Boolean(retentionSettings) &&
    (retentionDraft.mode !== retentionSettings?.trashRetentionMode ||
      retentionDraft.days !== retentionSettings?.trashRetentionDays);

  const emailDirty =
    governs && signature(emailDraft) !== signature(emailDraftFromConfig(emailConfig));

  const emailComplete =
    emailDraft.smtpHost.length > 0 &&
    emailDraft.smtpUser.length > 0 &&
    (emailDraft.smtpPassword.length > 0 || Boolean(emailConfig?.hasPassword));

  const [saving, setSaving] = useState(false);

  const dirty = uploadDirty || retentionDirty || emailDirty;

  const discard = useCallback(() => {
    setUploadDraft(uploadPolicy.policy);
    if (retentionSettings) {
      setRetentionDraft({
        mode: retentionSettings.trashRetentionMode,
        days: retentionSettings.trashRetentionDays,
      });
    }
    setEmailDraft(emailDraftFromConfig(emailConfig));
  }, [emailConfig, retentionSettings, uploadPolicy.policy]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;

    if (emailDirty && !emailComplete) {
      showAppToast({
        type: 'error',
        title: 'E-mail de saída incompleto',
        message: 'Informe servidor, conta e senha antes de salvar.',
      });
      return;
    }

    setSaving(true);
    try {
      if (uploadDirty) {
        await uploadPolicy.savePolicy(uploadDraft);
      }
      if (retentionDirty) {
        await retention.updateSettingsAsync({
          trashRetentionMode: retentionDraft.mode,
          trashRetentionDays: retentionDraft.days,
        });
      }
      if (emailDirty) {
        await tenantEmailApi.save(emailDraft);
        setEmailDraft((current) => ({ ...current, smtpPassword: '' }));
        await queryClient.invalidateQueries({ queryKey: TENANT_EMAIL_QUERY_KEY });
      }
      showAppToast({
        type: 'success',
        title: 'Configurações da organização salvas',
        message: 'As mudanças já valem para toda a organização.',
      });
    } catch (error) {
      showAppToast({
        type: 'error',
        title: 'Não foi possível salvar',
        message: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }, [
    dirty,
    emailComplete,
    emailDirty,
    emailDraft,
    queryClient,
    retention,
    retentionDirty,
    retentionDraft,
    saving,
    uploadDirty,
    uploadDraft,
    uploadPolicy,
  ]);

  const upload = useMemo(
    () => ({
      draft: uploadDraft,
      setDraft: setUploadDraft,
      canManage: uploadPolicy.canManage,
      isLoading: uploadPolicy.isLoading,
      dirty: uploadDirty,
    }),
    [uploadDirty, uploadDraft, uploadPolicy.canManage, uploadPolicy.isLoading],
  );

  const trashRetention = useMemo(
    () => ({
      draft: retentionDraft,
      setDraft: setRetentionDraft,
      isLoading: retention.isLoading,
    }),
    [retention.isLoading, retentionDraft],
  );

  const outboundEmail = useMemo(
    () => ({
      draft: emailDraft,
      setDraft: setEmailDraft,
      config: emailConfig,
      isLoading: emailQuery.isLoading,
      isError: emailQuery.isError,
      refetch: emailQuery.refetch,
      test: () => emailTest.mutate(),
      testing: emailTest.isPending,
      canTest: Boolean(emailConfig?.configured) && !emailDirty,
    }),
    [emailConfig, emailDirty, emailDraft, emailQuery, emailTest],
  );

  return { upload, trashRetention, outboundEmail, dirty, saving, save, discard };
}
