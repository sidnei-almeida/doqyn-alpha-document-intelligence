import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/utils/rulesHelpers';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-16 w-16 text-sm',
};

type UserAvatarProps = {
  userId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  avatarVersion?: number;
  size?: UserAvatarSize;
  className?: string;
};

export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 'md',
  className,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const displayName = name?.trim() || email?.trim() || 'Usuário';
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-doqyn-card font-medium text-doqyn-text',
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden={!showImage}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        initials
      )}
    </span>
  );
}
