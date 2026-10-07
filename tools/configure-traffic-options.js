#!/usr/bin/env node
'use strict';

// The source JSON is the selected repository preset. A successful invocation
// regenerates every artifact affected by the selected traffic behavior.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { getTrafficOptions, getQuicRules, validateTrafficOptions, buildMihomoRoutingGraph } = require('../rulesets/source/routing-graph');
const { assertTrafficOnlySourceChange, reuseSnapshotTopology, assertSnapshotBinding } = require('./build-fused-rule-sets');
const { writeRepositoryArtifact } = require('./lib/write-repository-artifact');
const { loadSnapshot: loadEgernTrafficSnapshot } = require('./lib/egern-traffic-snapshot');
const { prepareUpdates: prepareRuntimeUpdates } = require('./sync-traffic-options');

const root = path.resolve(__dirname, '..');
const configFile = path.join(root, 'rulesets/source/traffic-options.json');
const openClashFiles = [
  'OpenClash/OpenClash(mihomo).sh',
  'OpenClash/OpenClash(mihomo-smart).sh',
];
const commands = [
  ['tools/sync-traffic-options.js'],
  ['tools/build-fused-rule-sets.js', '--reuse-assets'],
  ['tools/generate-stash-from-cmfa.js'],
  ['tools/generate-egern-supplemental.js'],
  ['tools/generate-egern-from-cmfa.js', '--reuse-assets'],
  ['SingBox/SingBox(sing-box)-generator.js'],
  ['tools/generate-fused-fallback-artifacts.js'],
];

function parseArgs(args) {
  const options = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if ((arg === '--health-check-profile' || arg === '--health-check') && args[i + 1]) options.healthCheckProfile = args[++i];
    else if ((arg === '--quic-policy' || arg === '--quic') && args[i + 1]) options.quicPolicy = args[++i];
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!('healthCheckProfile' in options) && !('quicPolicy' in options)) {
    throw new Error('Specify --health-check-profile and/or --quic-policy');
  }
  return options;
}

function prepareOpenClashDefaults(options) {
  const updates = [];
  for (const relative of openClashFiles) {
    const file = path.join(root, relative);
    let source = fs.readFileSync(file, 'utf8');
    for (const [name, value] of [
      ['SCKI_DEFAULT_HEALTH_CHECK_PROFILE', options.healthCheckProfile],
      ['SCKI_DEFAULT_QUIC_POLICY', options.quicPolicy],
    ]) {
      const expression = new RegExp(`^${name}="[^"]+"$`, 'm');
      if (!expression.test(source)) throw new Error(`${relative}: missing ${name}`);
      source = source.replace(expression, `${name}="${value}"`);
    }
    const quicMap = /^SCKI_SOURCE_QUIC_RULES = .*\.freeze$/m;
    if (!quicMap.test(source)) throw new Error(`${relative}: missing SCKI_SOURCE_QUIC_RULES`);
    source = source.replace(quicMap, `SCKI_SOURCE_QUIC_RULES = ${JSON.stringify(getQuicRules('block-foreign'))}.freeze`);
    updates.push({ file, source });
  }
  return updates;
}

function main(args = process.argv.slice(2)) {
  const requested = parseArgs(args);
  const old = getTrafficOptions();
  const next = {
    healthCheckProfile: requested.healthCheckProfile || old.healthCheckProfile,
    quicPolicy: requested.quicPolicy || old.quicPolicy,
  };
  validateTrafficOptions(next);
  // Validate the planned source topology before changing the selected preset or any client.
  const originalRandom = Math.random;
  let graph;
  try { Math.random = () => 0; graph = buildMihomoRoutingGraph({ quicPolicy: next.quicPolicy }); }
  finally { Math.random = originalRandom; }
  const planned = { providers: graph['rule-providers'], rules: graph.rules, version: graph.version };
  assertTrafficOnlySourceChange(planned);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'rulesets/generated/fused/manifest.json'), 'utf8'));
  assertSnapshotBinding(snapshot);
  reuseSnapshotTopology(planned, snapshot);
  loadEgernTrafficSnapshot();
  prepareRuntimeUpdates(next);
  const openClashUpdates = prepareOpenClashDefaults(next);
  console.log(`Traffic options: ${JSON.stringify(old)} -> ${JSON.stringify(next)}`);
  if (requested.dryRun) {
    console.log(`Dry run; generation order: ${commands.map((command) => command.join(' ')).join(' -> ')}`);
    return next;
  }
  if (JSON.stringify(old) !== JSON.stringify(next)) {
    writeRepositoryArtifact(configFile, `${JSON.stringify(next, null, 2)}\n`);
  }
  for (const update of openClashUpdates) writeRepositoryArtifact(update.file, update.source);
  for (const [file, ...args] of commands) {
    console.log(`Generating: ${file} ${args.join(' ')}`.trim());
    const result = spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Generation failed at ${file} (exit ${result.status}). Source options remain ${JSON.stringify(next)}; rerun this command after fixing the cause.`);
    }
  }
  console.log(`Traffic options and artifacts generated: ${JSON.stringify(next)}`);
  return next;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parseArgs, prepareOpenClashDefaults, main };
