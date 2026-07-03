import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAnchorRefFactory,
  resolveAnchorUpdate,
} from '../src/features/rules/utils/governanceAnchorRegistry.js';

describe('resolveAnchorUpdate', () => {
  it('skip quando o node não mudou', () => {
    const el = {} as HTMLElement;
    assert.equal(resolveAnchorUpdate(el, el), 'skip');
    assert.equal(resolveAnchorUpdate(null, null), 'skip');
    assert.equal(resolveAnchorUpdate(undefined, null), 'skip');
  });

  it('assign quando recebe node novo', () => {
    const el = {} as HTMLElement;
    assert.equal(resolveAnchorUpdate(null, el), 'assign');
    assert.equal(resolveAnchorUpdate(undefined, el), 'assign');
  });

  it('remove quando node vira null e havia elemento', () => {
    const el = {} as HTMLElement;
    assert.equal(resolveAnchorUpdate(el, null), 'remove');
  });
});

describe('createAnchorRefFactory', () => {
  it('getRef retorna callback estável por id', () => {
    const anchors = { current: {} as Record<string, HTMLElement | null> };
    const factory = createAnchorRefFactory(anchors, () => undefined);

    const refA1 = factory.getRef('category-1');
    const refA2 = factory.getRef('category-1');
    assert.equal(refA1, refA2);
  });

  it('não notifica quando o mesmo node é registrado novamente', () => {
    const anchors = { current: {} as Record<string, HTMLElement | null> };
    let updates = 0;
    const factory = createAnchorRefFactory(anchors, () => {
      updates += 1;
    });
    const el = {} as HTMLElement;
    const ref = factory.getRef('category-1');

    ref(el);
    assert.equal(updates, 1);
    ref(el);
    assert.equal(updates, 1);
  });

  it('prune remove anchors órfãos e notifica uma vez', () => {
    const anchors = { current: { 'category-old': {} as HTMLElement } };
    let updates = 0;
    const factory = createAnchorRefFactory(anchors, () => {
      updates += 1;
    });

    factory.prune(new Set(['category-new']));
    assert.equal(anchors.current['category-old'], undefined);
    assert.equal(updates, 1);
    factory.prune(new Set(['category-new']));
    assert.equal(updates, 1);
  });
});
