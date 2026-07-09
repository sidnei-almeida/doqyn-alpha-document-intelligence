export type ProfileAvatar = {
  status: 'active' | 'removed' | null;
  version: number;
  updatedAt?: string;
  url?: string;
};

export type ProfileMe = {
  userId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  authProvider?: string;
  avatar: ProfileAvatar;
  tenant: {
    tenantId: string;
    displayName: string;
    tenantType?: string;
  };
  roles: string[];
};
