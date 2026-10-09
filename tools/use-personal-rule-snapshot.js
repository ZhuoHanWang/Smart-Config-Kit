#!/usr/bin/env node
'use strict';

// Copies compiled upstream assets; never runs the shared all-client generators.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_ROOT = 'Clash Party/rulesets';
const ACTIVE_FILE = path.join(REPO_ROOT, SNAPSHOT_ROOT, 'active.json');
const CLIENT_FILES = [
  'Clash Party/ClashParty(mihomo-smart).js',
  'Clash Party/ClashParty(mihomo).js',
  'FlClash/FlClash(mihomo).js',
];
const LOCAL_GEMINI_FILE = 'Clash Party/ClashParty(mihomo-smart)-ai-gemini.js';
const GEMINI_SOURCES = {
  gemini: {
    file: 'gemini-bm7.yaml',
    url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Gemini/Gemini.yaml',
  },
  'acc-gemini': {
    file: 'gemini-acc.yaml',
    url: 'https://raw.githubusercontent.com/Accademia/Additional_Rule_For_Clash/main/Gemini/Gemini.yaml',
  },
};

function read(relative) { return fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8'); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function jsonLine(source, name) {
  const match = source.match(new RegExp(`^const ${name} = (.+?);?$`, 'm'));
  assert.ok(match, `missing ${name}`);
  return JSON.parse(match[1]);
}
function safeRevision(value) {
  assert.match(value, /^v\d+\.\d+\.\d+-fork\.\d+$/, 'snapshot must be vX.Y.Z-fork.N');
  return value;
}
function localAsset(url) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/gh\/[^/]+\/Smart-Config-Kit@main\/(.+)$/);
  assert.ok(match, `not a compiled Smart-Config-Kit asset: ${url}`);
  const relative = decodeURIComponent(match[1]);
  assert.ok(relative.startsWith('rulesets/generated/fused/mihomo/') || relative.startsWith(`${SNAPSHOT_ROOT}/`), 'unexpected source asset directory');
  assert.ok(!relative.split('/').includes('..'), 'unsafe source path');
  return relative;
}
function assetUrl(active, file) {
  assert.match(file, /^[A-Za-z0-9._-]+$/, 'unsafe snapshot filename');
  const relative = `${SNAPSHOT_ROOT}/${active.snapshot}/${file}`.split('/').map(encodeURIComponent).join('/');
  return `https://fastly.jsdelivr.net/gh/${active.repository}@main/${relative}?scki=${active.snapshot}`;
}
function cachePath(active, file) { return `./ruleset/personal/${active.snapshot}/${file}`; }

function loadSnapshot() {
  const active = JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8'));
  safeRevision(active.snapshot);
  assert.match(active.repository, /^[A-Za-z0-9_.-]+\/Smart-Config-Kit$/, 'invalid personal repository');
  const manifest = JSON.parse(read(`${SNAPSHOT_ROOT}/${active.snapshot}/manifest.json`));
  assert.equal(manifest.snapshot, active.snapshot);
  assert.ok(Object.keys(manifest.providers).length > 0 && manifest.rules.length > 0, 'empty snapshot');
  assert.equal(Object.keys(manifest.gemini).length, 2, 'missing Gemini snapshots');
  for (const [file, receipt] of Object.entries(manifest.files)) {
    assert.match(file, /^[A-Za-z0-9._-]+$/, 'unsafe manifest filename');
    const bytes = fs.readFileSync(path.join(REPO_ROOT, SNAPSHOT_ROOT, active.snapshot, file));
    assert.equal(bytes.length, receipt.bytes, `${file}: size changed`);
    assert.equal(sha256(bytes), receipt.sha256, `${file}: content changed`);
  }
  for (const provider of [...Object.values(manifest.providers), ...Object.values(manifest.gemini)]) {
    assert.ok(manifest.files[provider.file], `missing snapshot file: ${provider.file}`);
  }
  return { active, manifest };
}
function personalProviders(active, manifest) {
  return Object.fromEntries(Object.entries(manifest.providers).map(([id, entry]) => [id, {
    ...entry.provider,
    url: assetUrl(active, entry.file),
    path: cachePath(active, entry.file),
  }]));
}
function geminiProviderSource(source, id) {
  const matcher = id === 'gemini' ? /(?:providers\.gemini|config\['rule-providers'\]\['gemini'\])\s*=\s*\{[^}]+\}/ : /(?:providers\['acc-gemini'\]|config\['rule-providers'\]\['acc-gemini'\])\s*=\s*\{[^}]+\}/;
  const match = source.match(matcher);
  assert.ok(match, `missing ${id} overlay`);
  return match[0];
}
function assertClientSnapshot(relativeFile, snapshot = loadSnapshot()) {
  const { active, manifest } = snapshot;
  const source = read(relativeFile);
  assert.deepEqual(jsonLine(source, 'MIHOMO_FUSED_RULE_PROVIDERS'), personalProviders(active, manifest), `${relativeFile}: restore the personal provider snapshot`);
  assert.deepEqual(jsonLine(source, 'MIHOMO_FUSED_RULES'), manifest.rules, `${relativeFile}: rules no longer match the snapshot`);
  for (const [id, entry] of Object.entries(manifest.gemini)) {
    const provider = geminiProviderSource(source, id);
    assert.ok(provider.includes(assetUrl(active, entry.file)), `${relativeFile}: ${id} URL is not frozen`);
    assert.ok(provider.includes(cachePath(active, entry.file)), `${relativeFile}: ${id} cache path is not isolated`);
  }
}
function applySnapshot(includeLocalGemini = false) {
  const snapshot = loadSnapshot();
  const { active, manifest } = snapshot;
  // Prepare all three edits before writing; preserve the surrounding personal logic.
  const clientFiles = includeLocalGemini ? [...CLIENT_FILES, LOCAL_GEMINI_FILE] : CLIENT_FILES;
  const edits = clientFiles.map((file) => {
    let source = read(file);
    jsonLine(source, 'MIHOMO_FUSED_RULE_PROVIDERS');
    jsonLine(source, 'MIHOMO_FUSED_RULES');
    source = source.replace(/^const MIHOMO_FUSED_RULE_PROVIDERS = .+$/m, `const MIHOMO_FUSED_RULE_PROVIDERS = ${JSON.stringify(personalProviders(active, manifest))}`);
    source = source.replace(/^const MIHOMO_FUSED_RULES = .+$/m, `const MIHOMO_FUSED_RULES = ${JSON.stringify(manifest.rules)}`);
    for (const [id, entry] of Object.entries(manifest.gemini)) {
      const previous = geminiProviderSource(source, id);
      const updated = previous.replace(/url:\s*'[^']+'/g, `url: '${assetUrl(active, entry.file)}'`)
        .replace(/path:\s*'[^']+'/g, `path: '${cachePath(active, entry.file)}'`);
      source = source.replace(previous, updated);
    }
    source = source.replace('// Generated by tools/build-fused-rule-sets.js from rulesets/source/routing-graph.js.',
      '// Personal compiled snapshot; restore with node tools/use-personal-rule-snapshot.js.');
    return [file, source];
  });
  for (const [file, source] of edits) if (read(file) !== source) fs.writeFileSync(path.join(REPO_ROOT, file), source);
  for (const file of clientFiles) assertClientSnapshot(file, snapshot);
  console.log(`Personal rule snapshot ${active.snapshot}: ${Object.keys(manifest.providers).length} fused + 2 Gemini providers; ${clientFiles.length} JS clients synchronized.`);
}

async function download(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Smart-Config-Kit-Personal-Snapshot' } });
    assert.ok(response.ok, `${url}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    // curl also honors HTTPS_PROXY on Node versions without env proxy support.
    try {
      return execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--connect-timeout', '10', '--max-time', '30', url], { timeout: 35000, maxBuffer: 20 * 1024 * 1024 });
    } catch { throw new Error(`cannot capture ${url}: ${error.message}`); }
  }
}

async function createSnapshot(revision, includeLocalGemini = false) {
  safeRevision(revision);
  const destination = path.join(REPO_ROOT, SNAPSHOT_ROOT, revision);
  assert.ok(!fs.existsSync(destination), 'snapshot already exists; use a new revision');
  const source = read(CLIENT_FILES[0]);
  const providers = jsonLine(source, 'MIHOMO_FUSED_RULE_PROVIDERS');
  const rules = jsonLine(source, 'MIHOMO_FUSED_RULES');
  for (const file of CLIENT_FILES.slice(1)) {
    assert.deepEqual(jsonLine(read(file), 'MIHOMO_FUSED_RULE_PROVIDERS'), providers, `${file}: merge matching upstream provider blocks first`);
    assert.deepEqual(jsonLine(read(file), 'MIHOMO_FUSED_RULES'), rules, `${file}: merge matching upstream rule blocks first`);
  }
  const baselineVersion = JSON.parse(read('rulesets/generated/fused/manifest.json')).baseline_version;
  assert.ok(revision.startsWith(`${baselineVersion}-fork.`), 'snapshot version must match the compiled baseline');
  const stagedFiles = new Map();
  const receipts = {};
  const entries = {};
  function addFile(file, bytes, sourceUrl) {
    assert.ok(!stagedFiles.has(file), `duplicate snapshot file: ${file}`);
    stagedFiles.set(file, bytes);
    receipts[file] = { bytes: bytes.length, sha256: sha256(bytes), source_url: sourceUrl };
  }
  for (const [id, provider] of Object.entries(providers)) {
    const relative = localAsset(provider.url);
    const file = path.basename(relative);
    addFile(file, fs.readFileSync(path.join(REPO_ROOT, relative)), provider.url);
    entries[id] = { file, provider };
  }
  const gemini = {};
  for (const [id, spec] of Object.entries(GEMINI_SOURCES)) {
    const bytes = await download(spec.url);
    assert.match(bytes.toString('utf8'), /^payload:\s*$/m, `${id}: expected a YAML payload`);
    assert.ok(bytes.length > 20 && bytes.length < 20 * 1024 * 1024, `${id}: invalid rule asset size`);
    addFile(spec.file, bytes, spec.url);
    gemini[id] = { file: spec.file };
  }
  const manifest = { snapshot: revision, baseline_version: baselineVersion, captured_at: new Date().toISOString(), providers: entries, rules, gemini, files: receipts };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(destination), '.snapshot-'));
  try {
    for (const [file, bytes] of stagedFiles) fs.writeFileSync(path.join(staging, file), bytes);
    fs.writeFileSync(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.renameSync(staging, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  const repository = fs.existsSync(ACTIVE_FILE) ? JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8')).repository : 'ZhuoHanWang/Smart-Config-Kit';
  fs.writeFileSync(ACTIVE_FILE, `${JSON.stringify({ repository, snapshot: revision }, null, 2)}\n`);
  applySnapshot(includeLocalGemini);
}

async function main() {
  const includeLocalGemini = process.argv.includes('--include-local-gemini');
  const args = process.argv.slice(2).filter((arg) => arg !== '--include-local-gemini');
  if (args.length === 0) return applySnapshot(includeLocalGemini);
  if (args.length === 1 && args[0] === '--check') {
    const snapshot = loadSnapshot();
    const clientFiles = includeLocalGemini ? [...CLIENT_FILES, LOCAL_GEMINI_FILE] : CLIENT_FILES;
    for (const file of clientFiles) assertClientSnapshot(file, snapshot);
    console.log(`Personal rule snapshot ${snapshot.active.snapshot}: all ${Object.keys(snapshot.manifest.files).length} assets and ${clientFiles.length} JS references verified.`);
    return;
  }
  if (args.length === 2 && args[0] === '--create') return createSnapshot(args[1], includeLocalGemini);
  throw new Error('Usage: node tools/use-personal-rule-snapshot.js [--check | --create vX.Y.Z-fork.N] [--include-local-gemini]');
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { CLIENT_FILES, loadSnapshot, assertClientSnapshot };
