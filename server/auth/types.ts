export type AuthRole = 'admin' | 'manager' | 'user' | 'viewer';

export type PlatformRole = 'company_admin' | 'individual_admin' | 'user';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  username?: string;
  firstName?: string;
  lastName?: string;

  companyId: string;
  /** Tenant canônico — igual a companyId durante migração */
  tenantId: string;
  companyName: string;

  role: AuthRole;
  area: string;
  groups: string[];

  memberId?: string;
  membershipId?: string;
  membershipStatus?: string;
  tenantType?: string;
  tenantStatus?: string;
  authUserId?: string;
  platformRoles?: PlatformRole[];
  avatarVersion?: number;
  avatarUpdatedAt?: string;
  avatarStatus?: 'active' | 'removed' | null;

  /**
   * Idioma da interface (BCP-47) e fuso (IANA), vindos do perfil no auth-service.
   *
   * Estão no `AuthUser` e não só no cliente porque quem mais precisa deles é o servidor: e-mail,
   * notificação e PDF de assinatura são renderizados por destinatário, e um mesmo evento pode
   * gerar três idiomas. `tenantDefaultLocale` é o degrau seguinte da cadeia, para quem ainda não
   * escolheu o seu.
   */
  locale?: string;
  timeZone?: string | null;
  tenantDefaultLocale?: string;
};

export type SessionPayload = AuthUser & {
  iat?: number;
  exp?: number;
};
