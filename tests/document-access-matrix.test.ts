import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MongoDocumentClass } from '../server/db/types.js';

function readPermissionsForGroup(docClass: MongoDocumentClass, groupId: string) {
  const perms = docClass.permissions ?? {
    view: [],
    download: [],
    update: [],
    audit: [],
    share: [],
  };

  return {
    view: perms.view.includes(groupId),
    download: perms.download.includes(groupId),
    upload: perms.update.includes(groupId),
    share: perms.share.includes(groupId),
    manage: perms.audit.includes(groupId),
  };
}

describe('document access matrix permissions', () => {
  const sampleClass = {
    permissions: {
      view: ['group_juridico'],
      download: ['group_juridico'],
      update: ['group_financeiro'],
      audit: ['group_diretoria'],
      share: [],
    },
  } as MongoDocumentClass;

  it('mapeia upload para update e manage para audit', () => {
    const juridico = readPermissionsForGroup(sampleClass, 'group_juridico');
    assert.equal(juridico.view, true);
    assert.equal(juridico.download, true);
    assert.equal(juridico.upload, false);
    assert.equal(juridico.manage, false);

    const financeiro = readPermissionsForGroup(sampleClass, 'group_financeiro');
    assert.equal(financeiro.upload, true);

    const diretoria = readPermissionsForGroup(sampleClass, 'group_diretoria');
    assert.equal(diretoria.manage, true);
  });

  it('sem permissões retorna flags falsas', () => {
    const flags = readPermissionsForGroup(sampleClass, 'group_inexistente');
    assert.deepEqual(flags, {
      view: false,
      download: false,
      upload: false,
      share: false,
      manage: false,
    });
  });
});
