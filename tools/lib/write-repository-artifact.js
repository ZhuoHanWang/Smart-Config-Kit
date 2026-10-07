'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');

// Replace generated output atomically: Windows can reject truncating an existing
// artifact even when creating and renaming a sibling file succeeds.
function writeRepositoryArtifact(file, text) {
  const target = path.resolve(file);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Artifact must be inside the repository');
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { writeRepositoryArtifact };
