import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { DEFAULT_TENANT_UPLOAD_POLICY, type TenantUploadPolicy } from '@shared/uploadPolicy';
import {
  fetchUploadPolicy,
  updateUploadPolicy,
  type UploadPolicyResponse,
} from '../api/uploadPolicyApi';

export const UPLOAD_POLICY_QUERY_KEY = ['settings', 'upload-policy'] as const;

/**
 * Política de upload/IA do tenant. Quem não governa a organização lê e não altera —
 * é o que explica por que a IA renomeou o arquivo ou por que o envio parou para revisão.
 */
export function useUploadPolicy() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: UPLOAD_POLICY_QUERY_KEY,
    queryFn: fetchUploadPolicy,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<TenantUploadPolicy>) => updateUploadPolicy(patch),
    onSuccess: (data) => {
      queryClient.setQueryData<UploadPolicyResponse>(UPLOAD_POLICY_QUERY_KEY, data);
    },
  });

  const policy = query.data?.policy ?? DEFAULT_TENANT_UPLOAD_POLICY;
  const canManage = query.data?.canManage ?? false;

  const savePolicy = useCallback(
    (patch: Partial<TenantUploadPolicy>) => mutation.mutateAsync(patch),
    [mutation],
  );

  return {
    policy,
    canManage,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    savePolicy,
    refetchPolicy: query.refetch,
  };
}
