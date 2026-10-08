'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const MARKER = '__SCKI_PRIVATE_AI__';
const TARGETS = [
  'Clash Party/ClashParty(mihomo-smart).js',
  'Clash Party/ClashParty(mihomo).js',
  'FlClash/FlClash(mihomo).js',
];

function load(file) {
  const errors = [];
  const context = vm.createContext({ console: {
    log() {}, warn() {}, error(...args) { errors.push(args); },
  } });
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { timeout: 3000 });
  return (config) => {
    const result = context.main(config);
    assert.equal(errors.length, 0, 'overwrite must complete without caught errors');
    return result;
  };
}

function fixture(privateNames = [], publicNodes = true) {
  return {
    proxies: [
      ...(publicNodes ? [{ name: 'US public', type: 'ss', server: 'public.example.invalid',
        port: 443, cipher: 'aes-128-gcm', password: 'fixture-public' }] : []),
      ...privateNames.map(name => ({ name, type: 'vless', server: 'private.example.invalid',
        port: 443, uuid: '00000000-0000-4000-8000-000000000001', tls: true,
        'reality-opts': { 'public-key': 'fixture-only', 'short-id': '0011223344556677' } })),
    ],
    'proxy-groups': [{ name: MARKER, type: 'select', proxies: privateNames.slice() }],
    rules: ['MATCH,DIRECT'],
    'rule-providers': {},
  };
}

function assertValidGroups(config) {
  const groups = config['proxy-groups'];
  const valid = new Set(['DIRECT', 'REJECT', ...config.proxies.map(p => p.name), ...groups.map(g => g.name)]);
  assert.ok(!groups.some(g => g.name === MARKER), 'internal marker must be removed');
  for (const group of groups) {
    assert.ok(group.proxies.length > 0, `${group.name} must have a usable fallback`);
    for (const member of group.proxies) assert.ok(valid.has(member), `${group.name}: missing ${member}`);
  }
}

for (const file of TARGETS) {
  test(`${file}: private YAML nodes retain credentials and remain isolated after repeated overwrites`, () => {
    const run = load(file);
    const input = fixture(['US private AI', ' HK private AI ']);
    input['proxy-groups'][0].proxies.push('US private AI', 'missing node', 'DIRECT', null);
    const expected = JSON.parse(JSON.stringify(input.proxies.slice(1)));
    const rulesRef = input.rules;
    const groupsRef = input['proxy-groups'];
    for (let round = 0; round < 2; round++) {
      const output = run(input);
      assertValidGroups(output);
      assert.equal(output.proxies.length, 3);
      const privateNodes = output.proxies.slice(1);
      privateNodes.forEach((node, i) => {
        assert.equal(node.uuid, expected[i].uuid);
        assert.equal(node.server, expected[i].server);
        assert.deepEqual(node['reality-opts'], expected[i]['reality-opts']);
      });
      const privateGroup = output['proxy-groups'].find(g => g.name ===
        (file.startsWith('FlClash') ? 'AI专属' : '🤖 AI 服务'));
      assert.ok(privateGroup);
      expected.forEach(node => assert.ok(privateGroup.proxies.includes(node.name)));
      for (const group of output['proxy-groups']) {
        if (['smart', 'url-test'].includes(group.type) && group.name !== 'AI专属') {
          expected.forEach(node => assert.ok(!group.proxies.includes(node.name), `${group.name}: private node leak`));
        }
      }
      const allowedBusinessGroups = file.startsWith('FlClash')
        ? new Set(['🤖 AI 服务', '✨ Gemini 服务', '🔍 Google 服务'])
        : new Set(['🤖 AI 服务']);
      for (const group of output['proxy-groups']) {
        if (group.type !== 'select' || group.name === 'AI专属') continue;
        for (const node of expected) {
          if (group.proxies.includes(node.name)) {
            assert.ok(allowedBusinessGroups.has(group.name), `${group.name}: private node must stay in AI-related groups`);
          }
        }
      }
      if (file.startsWith('FlClash')) {
        assert.equal(output.rules, rulesRef, 'FlClash must preserve rule array identity');
        assert.equal(output['proxy-groups'], groupsRef, 'FlClash must preserve group array identity');
      }
    }
  });

  test(`${file}: missing/invalid private marker leaves public subscription usable`, () => {
    const run = load(file);
    const absent = fixture();
    absent['proxy-groups'] = [];
    const invalid = fixture();
    invalid['proxy-groups'][0].proxies = ['missing node', 'DIRECT', 1, null];
    const a = run(absent);
    const b = run(invalid);
    assertValidGroups(a);
    assertValidGroups(b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.ok(!a['proxy-groups'].some(g => g.name === 'AI专属'));
  });

  test(`${file}: a native AI group does not turn public nodes into private nodes`, () => {
    const run = load(file);
    const input = fixture();
    input['proxy-groups'] = [{ name: '🤖 AI 服务', type: 'select', proxies: ['US public'] }];
    const output = run(input);
    const global = output['proxy-groups'].find(g => g.name === '🌍 全球节点');
    assert.ok(global.proxies.includes('US public'));
    assert.ok(!output['proxy-groups'].some(g => g.name === 'AI专属'));
  });

  test(`${file}: an unrelated AI专属 group is not treated as private-node input`, () => {
    const run = load(file);
    const input = fixture();
    input['proxy-groups'] = [{ name: 'AI专属', type: 'url-test', proxies: ['US public'] }];
    const output = run(input);
    assert.ok(!output['proxy-groups'].some(g => g.name === 'AI专属'));
    const ai = output['proxy-groups'].find(g => g.name === '🤖 AI 服务');
    assert.ok(ai);
    assert.ok(!ai.proxies.includes('AI专属'));
    assert.ok(output['proxy-groups'].some(g => Array.isArray(g.proxies) && g.proxies.includes('US public')));
  });

  test(`${file}: a private-only config has no empty proxy groups`, () => {
    const output = load(file)(fixture(['US private AI'], false));
    assertValidGroups(output);
    assert.deepEqual(Array.from(output['proxy-groups'].find(g => g.name === '🌍 全球节点').proxies), ['REJECT']);
    assert.ok(output.rules.length > 0);
  });

  test(`${file}: private marker supports more than 64 exact node names`, () => {
    const names = Array.from({ length: 70 }, (_, i) => `US private ${i}`);
    const output = load(file)(fixture(names));
    assertValidGroups(output);
    const group = output['proxy-groups'].find(g => g.name === (file.startsWith('FlClash') ? 'AI专属' : '🤖 AI 服务'));
    names.forEach(name => assert.ok(group.proxies.includes(name)));
    const global = output['proxy-groups'].find(g => g.name === '🌍 全球节点');
    assert.deepEqual(Array.from(global.proxies), ['US public']);
  });
}
