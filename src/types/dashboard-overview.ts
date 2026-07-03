import type { DocumentListItem } from '@/types/document-library';

export type DashboardPeriodKey = '7d' | '30d' | '90d';

export type DashboardOverviewResponse = {
  generatedAt: string;
  mode: 'full' | 'operational';
  tenant: {
    tenantId: string;
    tenantType: string;
    displayName: string;
  };
  period: {
    from: string;
    to: string;
    key: DashboardPeriodKey;
  };
  summary: {
    totalDocuments: number;
    documentsUploadedToday: number;
    documentsUploadedInPeriod: number;
    documentsInAnalysis: number;
    documentsAwaitingReview: number;
    documentsProcessed: number;
    documentsWithErrors: number;
    totalVersions: number;
    previewReady: number;
    previewFailed: number;
    downloadsInPeriod: number;
    viewsInPeriod: number;
    trackingEventsInPeriod: number;
  };
  governance: {
    documentCategories: number;
    documentGroups: number;
    activeExtractionRules: number;
    activeAccessRules: number;
    documentsWithoutCategory: number;
    usersActive: number;
    usersPending: number;
    accessRequestsPending: number;
  } | null;
  storage: {
    originalFiles: number;
    previewFiles: number;
    totalSizeBytes: number;
    originalSizeBytes: number;
    previewSizeBytes: number;
    bucketNameMasked: string | null;
  } | null;
  documentsByStatus: Array<{ status: string; label: string; count: number }>;
  documentsByCategory: Array<{ categoryId: string; categoryName: string; count: number }>;
  recentDocuments: DocumentListItem[];
  recentTrackingEvents: Array<{
    id: string;
    action: string;
    label: string;
    documentId?: string | null;
    documentName?: string;
    actorName?: string;
    severity: string;
    occurredAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    action: string;
    documentName?: string;
    message: string;
    occurredAt: string;
  }>;
  health: {
    analysisReady: boolean;
    hasActiveCategories: boolean;
    hasActiveExtractionRules: boolean;
    hasStorageConfigured: boolean;
    warnings: string[];
  };
};
