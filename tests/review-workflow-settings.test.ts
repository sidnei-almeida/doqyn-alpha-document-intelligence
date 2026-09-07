import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TENANT_UPLOAD_POLICY, normalizeTenantUploadPolicy } from '../shared/uploadPolicy';
import {
  canAutoAcceptWithSettings,
  DEFAULT_WORKFLOW_REVIEW_SETTINGS,
  policyRequiresPerItemChoice,
  resolveEffectiveNamingForItem,
  resolveFinalFileNameForConfirm,
  shouldPauseForReview,
} from '../src/features/document-send/utils/reviewWorkflowSettings';

describe('reviewWorkflowSettings', () => {
  it('usa a política de fábrica compartilhada como padrão', () => {
    assert.deepEqual(DEFAULT_WORKFLOW_REVIEW_SETTINGS, DEFAULT_TENANT_UPLOAD_POLICY);
    assert.equal(DEFAULT_WORKFLOW_REVIEW_SETTINGS.autoReviewEnabled, false);
    assert.equal(DEFAULT_WORKFLOW_REVIEW_SETTINGS.defaultNamingPolicy, 'ai_suggested');
    assert.equal(DEFAULT_WORKFLOW_REVIEW_SETTINGS.preventSensitiveDataInFileName, true);
  });

  it('normaliza entrada parcial ou inválida vinda do tenant', () => {
    const normalized = normalizeTenantUploadPolicy({
      autoReviewEnabled: true,
      autoAcceptDelaySeconds: 99,
      defaultNamingPolicy: 'inexistente' as never,
    });

    assert.equal(normalized.autoReviewEnabled, true);
    assert.equal(normalized.autoAcceptDelaySeconds, 30);
    assert.equal(normalized.defaultNamingPolicy, 'ai_suggested');
    assert.equal(normalized.pauseOnLowConfidence, true);
  });

  it('aceita delay auto de 0 segundos', () => {
    assert.equal(
      normalizeTenantUploadPolicy({ autoAcceptDelaySeconds: 0 }).autoAcceptDelaySeconds,
      0,
    );
  });

  it('resolve naming efetivo por política', () => {
    const base = { ...DEFAULT_WORKFLOW_REVIEW_SETTINGS };

    assert.equal(resolveEffectiveNamingForItem(base), 'ai_suggested');
    assert.equal(
      resolveEffectiveNamingForItem({ ...base, defaultNamingPolicy: 'original' }),
      'original',
    );
    assert.equal(
      resolveEffectiveNamingForItem(
        { ...base, defaultNamingPolicy: 'ask_each_file' },
        { namingMode: 'manual', manualName: 'teste.pdf' },
      ),
      'manual',
    );
    assert.equal(resolveEffectiveNamingForItem({ ...base, aiRenameEnabled: false }), 'original');
  });

  it('policyRequiresPerItemChoice identifica políticas interativas', () => {
    assert.equal(policyRequiresPerItemChoice('ask_each_file'), true);
    assert.equal(policyRequiresPerItemChoice('manual_required'), true);
    assert.equal(policyRequiresPerItemChoice('ai_suggested'), false);
  });

  it('shouldPauseForReview respeita pauseOnLowConfidence e pauseOnConflict', () => {
    const metadata = {
      analysisStatus: 'completed',
      confidenceScore: 0.5,
      documentType: 'NDA',
      suggestedName: 'doc.pdf',
      suggestedVersion: 'v1',
      missingFields: [],
    } as const;

    const rawAnalysis = {
      status: 'completed',
      classification: {
        classId: 'class_1',
        className: 'NDA',
        confidence: 0.5,
        requiresReview: false,
        reason: '',
      },
      extraction: {
        requiresReview: false,
        missingFields: [],
        metadata: {},
        reviewReasons: [],
        version: 'v1',
      },
      recommendedFileName: 'NDA.pdf',
      originalFileName: 'upload.pdf',
    } as const;

    assert.equal(
      shouldPauseForReview(DEFAULT_WORKFLOW_REVIEW_SETTINGS, { metadata, rawAnalysis }),
      true,
    );

    assert.equal(
      shouldPauseForReview(
        { ...DEFAULT_WORKFLOW_REVIEW_SETTINGS, pauseOnLowConfidence: false },
        { metadata, rawAnalysis },
      ),
      false,
    );
  });

  it('canAutoAcceptWithSettings bloqueia ask_each_file e manual_required', () => {
    const metadata = {
      analysisStatus: 'completed',
      confidenceScore: 0.9,
      documentType: 'NDA',
      suggestedName: 'doc.pdf',
      suggestedVersion: 'v1',
      missingFields: [],
    } as const;

    const rawAnalysis = {
      status: 'completed',
      classification: {
        classId: 'class_1',
        className: 'NDA',
        confidence: 0.9,
        requiresReview: false,
        reason: '',
      },
      extraction: {
        requiresReview: false,
        missingFields: [],
        metadata: {},
        reviewReasons: [],
        version: 'v1',
      },
      recommendedFileName: 'NDA.pdf',
      originalFileName: 'upload.pdf',
    } as const;

    assert.equal(
      canAutoAcceptWithSettings(
        { ...DEFAULT_WORKFLOW_REVIEW_SETTINGS, autoReviewEnabled: true },
        { isAuthenticated: true, metadata, rawAnalysis },
      ),
      true,
    );

    assert.equal(
      canAutoAcceptWithSettings(
        {
          ...DEFAULT_WORKFLOW_REVIEW_SETTINGS,
          autoReviewEnabled: true,
          defaultNamingPolicy: 'ask_each_file',
        },
        { isAuthenticated: true, metadata, rawAnalysis },
      ),
      false,
    );
  });

  it('resolveFinalFileNameForConfirm usa preview sanitizado', () => {
    const name = resolveFinalFileNameForConfirm({
      settings: DEFAULT_WORKFLOW_REVIEW_SETTINGS,
      originalFileName: 'contrato original.pdf',
      aiSuggestedFileName: 'NDA_Acme.pdf',
      perItem: { namingMode: 'ai_suggested' },
    });

    assert.equal(name, 'NDA_Acme.pdf');
  });
});
