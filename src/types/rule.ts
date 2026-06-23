export type RuleStatus = 'active' | 'inactive' | 'draft';

export interface Rule {
  id: string;
  tenantId: string;
  name: string;
  documentType: string;
  expectedFields: string[];
  accessGroups: string[];
  actions: string[];
  status: RuleStatus;
  createdAt: string;
  updatedAt: string;
}
