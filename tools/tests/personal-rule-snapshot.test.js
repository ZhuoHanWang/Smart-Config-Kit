'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { chooseSnapshotAssetBytes } = require('../use-personal-rule-snapshot');

test('new snapshots retain matching assets and only adopt receipt-bound supplemental changes', () => {
  const original = Buffer.from('baseline');
  const changed = Buffer.from('personal supplement');
  assert.equal(chooseSnapshotAssetBytes({ file: 'unchanged.mrs', snapshotBytes: original,
    generatedBytes: Buffer.from(original), patchableFiles: new Set() }), original);
  assert.throws(() => chooseSnapshotAssetBytes({ file: 'other.mrs', snapshotBytes: original,
    generatedBytes: changed, patchableFiles: new Set(['direct.mrs']) }), /outside a declared supplemental patch/);
  assert.equal(chooseSnapshotAssetBytes({ file: 'direct.mrs', snapshotBytes: original,
    generatedBytes: changed, patchableFiles: new Set(['direct.mrs']) }), changed);
});
