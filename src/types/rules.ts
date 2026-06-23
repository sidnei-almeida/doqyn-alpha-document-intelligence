// Modelo conceitual futuro (por empresa):
// companies, members, groups, document_categories, access_rules, pending_approvals, audit_logs
// Todos os registros devem incluir companyId para isolamento.

export type UserRole = 'admin' | 'member' | 'auditor';

export type MemberStatus = 'active' | 'pending' | 'suspended';

export type GroupColor = 'blue' | 'green' | 'amber' | 'red' | 'purple';

export interface Group {
  id: string;
  companyId: string;
  name: string;
  color: GroupColor;
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
  icon: DocumentIcon;
  accessGroupIds: string[];
  notifyGroupIds: string[];
  createdAt: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
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

export interface RulesState {
  groups: Group[];
  categories: DocumentCategory[];
  members: CompanyMember[];
  pendingApprovals: PendingApproval[];
  auditEvents: AuditEvent[];
}
