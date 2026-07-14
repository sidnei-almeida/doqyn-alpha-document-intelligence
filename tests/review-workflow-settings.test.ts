import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  AUTO_DELAY_STORAGE_KEY,
  AUTO_MODE_STORAGE_KEY,
} from '../src/features/document-send/uploadConstants';
import {
  REVIEW_SETTINGS_STORAGE_KEY,
} from '../src/features/document-send/types/reviewWorkflowSettings';
import {
  canAutoAcceptWithSettings,
  DEFAULT_WORKFLOW_REVIEW_SETTINGS,
  loadReviewWorkflowSettings,
  policyRequiresPerItemChoice,
  resolveEffectiveNamingForItem,
  resolveFinalFileNameForConfirm,
  saveReviewWorkflowSettings,
  shouldPauseForReview,
} from '../src/features/document-send/utils/reviewWorkflowSettings';

const memoryStorage = new Map<string, string>();

describe('reviewWorkflowSettings', () => {
  const originalStorage = globalThis.localStorage;

  beforeEach(() => {
    memoryStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoryStorage.set(key, value);
        },
        removeItem: (key: string) => {
          memoryStorage.delete(key);
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalStorage,
    });
  });

  it('carrega defaults quando storage vazio', () => {
    const settings = loadReviewWorkflowSettings();
    assert.equal(settings.autoReviewEnabled, false);
    assert.equal(settings.defaultNamingPolicy, 'ai_suggested');
    assert.equal(settings.preventSensitiveDataInFileName, true);
  });

  it('migra chaves legadas do modo auto', () => {
    memoryStorage.set(AUTO_MODE_STORAGE_KEY, 'true');
    memoryStorage.set(AUTO_DELAY_STORAGE_KEY, '15');
    const settings = loadReviewWorkflowSettings();
    assert.equal(settings.autoReviewEnabled, true);
    assert.equal(settings.autoAcceptDelaySeconds, 15);
  });

  it('persiste objeto versionado e espelha chaves legadas', () => {
    saveReviewWorkflowSettings({
      ...DEFAULT_WORKFLOW_REVIEW_SETTINGS,
      autoReviewEnabled: true,
      autoAcceptDelaySeconds: 20,
      defaultNamingPolicy: 'original',
    });

    const raw = memoryStorage.get(REVIEW_SETTINGS_STORAGE_KEY);
    assert.ok(raw?.includes('"version"'));
    assert.equal(memoryStorage.get(AUTO_MODE_STORAGE_KEY), 'true');
    assert.equal(memoryStorage.get(AUTO_DELAY_STORAGE_KEY), '20');
  });

  it('permite delay auto de 0 segundos', () => {
    saveReviewWorkflowSettings({
      ...DEFAULT_WORKFLOW_REVIEW_SETTINGS,
      autoReviewEnabled: true,
      autoAcceptDelaySeconds: 0,
    });
    const settings = loadReviewWorkflowSettings();
    assert.equal(settings.autoAcceptDelaySeconds, 0);
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
    assert.equal(
      resolveEffectiveNamingForItem({ ...base, aiRenameEnabled: false }),
      'original',
    );
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
