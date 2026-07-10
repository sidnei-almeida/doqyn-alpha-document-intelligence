// Modelo da tela Regras — alinhado ao MongoDB (Etapa 4).

export type UserRole = 'admin' | 'manager' | 'member' | 'auditor';

export type MemberStatus = 'active' | 'pending' | 'blocked';

export type GroupColor = 'blue' | 'green' | 'amber' | 'red' | 'purple';

export interface Group {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  color: GroupColor;
  active: boolean;
  memberCount?: number;
  linkedClassCount?: number;
  createdAt: string;
}

export type DocumentIcon =
  | 'file-text'
  | 'receipt'
  | 'file-invoice'
  | 'users'
  | 'chart-bar'
  | 'shield-check'
  | 'folder';

export interface DocumentCategory {
  id: string;
  companyId: string;
  name: string;
  slug?: string;
  description?: string;
  icon: DocumentIcon;
  iconKey?: string;
  color?: string;
  active: boolean;
  /** IDs de grupos documentais (`document_groups`) com regra nesta categoria. */
  documentGroupIds: string[];
  notifyGroupIds: string[];
  notifyOnUpdate: boolean;
  permissions?: {
    view: string[];
    download: string[];
    update: string[];
    audit: string[];
    share: string[];
  };
  keywords: string[];
  negativeKeywords: string[];
  createdAt: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId?: string;
  name: string;
  email: string;
  position?: string;
  role: UserRole;
  status: MemberStatus;
  groupIds: string[];
  lastAccessAt?: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export type ApprovalMethod = 'invite' | 'access_request';

export interface PendingApproval {
  id: string;
  companyId: string;
  name: string;
  email: string;
  domain: string;
  requestedAt: string;
  method: ApprovalMethod;
  requestedGroups: string[];
  position?: string;
  role?: UserRole;
}

export interface AuditEvent {
  id: string;
  companyId: string;
  action: string;
  actor: string;
  target: string;
  createdAt: string;
}

export type FieldType = 'string' | 'date' | 'number' | 'currency' | 'boolean';

export interface ExtractionField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  aliases?: string[];
  description?: string;
}

export interface DocumentExtractionRule {
  id: string;
  classId: string;
  version: number;
  active: boolean;
  fields: ExtractionField[];
  namingTemplate: string;
  minimumConfidence: number;
}

export interface RulesState {
  groups: Group[];
  categories: DocumentCategory[];
  members: CompanyMember[];
  pendingApprovals: PendingApproval[];
  auditEvents: AuditEvent[];
  rules: DocumentExtractionRule[];
}
