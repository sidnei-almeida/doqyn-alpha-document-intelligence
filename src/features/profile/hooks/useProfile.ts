import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { fetchProfileMe, removeProfileAvatar, uploadProfileAvatar } from '../api/profileApi';

export function useProfileMe(enabled = true) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['profile-me'],
    queryFn: fetchProfileMe,
    enabled: enabled && isAuthenticated,
    staleTime: 30_000,
    retry: false,
    throwOnError: false,
  });
}

export function useProfileAvatarMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
    await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
  };

  const uploadMutation = useMutation({
    mutationFn: uploadProfileAvatar,
    onSuccess: () => void invalidate(),
  });

  const removeMutation = useMutation({
    mutationFn: removeProfileAvatar,
    onSuccess: () => void invalidate(),
  });

  return { uploadMutation, removeMutation };
}
