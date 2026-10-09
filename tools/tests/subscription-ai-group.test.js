'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const TARGETS = [
  { file: 'Clash Party/ClashParty(mihomo-smart).js', regionType: 'smart' },
  { file: 'Clash Party/ClashParty(mihomo).js', regionType: 'url-test' },
  { file: 'FlClash/FlClash(mihomo).js', regionType: 'url-test' },
];
const BUSINESS_DEFAULTS = [
  ['🤖 AI 服务', 'AI专属'], ['✨ Gemini 服务', 'AI专属'],
  ['💰 加密货币', '🇭🇰 香港节点'], ['🏦 金融支付', 'DIRECT'],
  ['💬 即时通讯', '🇭🇰 香港节点'], ['📱 社交媒体', '🇯🇵 日韩节点'],
  ['🧑‍💼 会议协作', '🇯🇵 日韩节点'], ['📺 国内流媒体', 'DIRECT'],
  ['🎵 TikTok', '🇸🇬 狮城节点'], ['🎥 Netflix', '🇺🇸 美国节点'],
  ['🎬 Disney+', '🇺🇸 美国节点'], ['📡 HBO/Max', '🇺🇸 美国节点'],
  ['📺 Hulu', '🇺🇸 美国节点'], ['🎬 Prime Video', '🇺🇸 美国节点'],
  ['📹 YouTube', '🇺🇸 美国节点'], ['🎵 音乐流媒体', '🇺🇸 美国节点'],
  ['🇭🇰 香港流媒体', '🇭🇰 香港节点'], ['🇹🇼 台湾流媒体', '🇹🇼 台湾节点'],
  ['🇯🇵 日韩流媒体', '🇯🇵 日韩节点'], ['🇪🇺 欧洲流媒体', '🇪🇺 欧洲节点'],
  ['🌐 其他国外流媒体', '🌍 全球节点'], ['🕹️ 国内游戏', 'DIRECT'],
  ['🎮 国外游戏', '🇯🇵 日韩节点'], ['🔍 Google 服务', '🌍 全球节点'],
  ['🔧 工具与服务', '🌍 全球节点'], ['Ⓜ️ 微软服务', '🌍 全球节点'],
  ['🍎 苹果服务', 'DIRECT'], ['📥 下载更新', '🌍 全球节点'],
  ['🛰️ BT/PT Tracker', 'REJECT'], ['🏠 国内网站', 'DIRECT'],
  ['🚫 受限网站', '🌍 全球节点'], ['🌐 国外网站', '🌍 全球节点'],
  ['🐟 漏网之鱼', '🌍 全球节点'], ['🛑 广告拦截', 'REJECT'],
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

function proxy(name, privateNode = false) {
  return privateNode
    ? { name, type: 'vless', server: 'jms.example.invalid', port: 443,
      uuid: '00000000-0000-4000-8000-000000000001', tls: true,
      'reality-opts': { 'public-key': 'test-only', 'short-id': '0011223344556677' } }
    : { name, type: 'ss', server: 'public.example.invalid', port: 443,
      cipher: 'aes-128-gcm', password: 'fixture-only' };
}

function fixture(aiNames = []) {
  const proxies = [
    proxy('HK 01 Node'), proxy('TW 01 Node'), proxy('SG 01 Node'),
    proxy('JP 01 Node'), proxy('US 01 Node'), proxy('DE Frankfurt Node'),
    proxy('JMS US 01', true), proxy('JMS Home 02', true),
  ];
  const groups = aiNames.length ? [{ name: 'AI专属', type: 'url-test', proxies: aiNames.slice() }] : [];
  return { proxies, 'proxy-groups': groups, rules: ['MATCH,DIRECT'], 'rule-providers': {} };
}

function assertValidGroups(config) {
  const groups = config['proxy-groups'];
  const valid = new Set(['DIRECT', 'REJECT', ...config.proxies.map((item) => item.name), ...groups.map((item) => item.name)]);
  for (const group of groups) {
    assert.ok(group.proxies.length > 0, `${group.name} must have a usable fallback`);
    for (const member of group.proxies) assert.ok(valid.has(member), `${group.name}: missing ${member}`);
  }
}

for (const target of TARGETS) {
  test(`${target.file}: Sub-Store AI nodes are preserved, isolated, and business groups keep suitable defaults`, () => {
    const run = load(target.file);
    const input = fixture(['JMS US 01', 'missing node', 'JMS Home 02', 'JMS US 01', 'DIRECT', null]);
    const proxiesRef = input.proxies;
    const rulesRef = input.rules;
    const groupsRef = input['proxy-groups'];

    for (let round = 0; round < 2; round++) {
      const output = run(input);
      assertValidGroups(output);
      assert.equal(output.proxies, proxiesRef);
      const aiGroup = output['proxy-groups'].find((group) => group.name === 'AI专属');
      assert.ok(aiGroup);
      assert.equal(aiGroup.type, target.regionType);
      assert.deepEqual(Array.from(aiGroup.proxies), ['JMS US 01', 'JMS Home 02']);

      for (const group of output['proxy-groups']) {
        if (group.type === target.regionType && group.name !== 'AI专属') {
          assert.ok(!group.proxies.includes('JMS US 01'), `${group.name}: JMS node leaked into a region group`);
          assert.ok(!group.proxies.includes('JMS Home 02'), `${group.name}: JMS node leaked into a region group`);
        }
        if (group.type === 'select') assert.ok(group.proxies.includes('AI专属'), `${group.name}: AI group missing`);
      }
      for (const [name, first] of BUSINESS_DEFAULTS) {
        const group = output['proxy-groups'].find((item) => item.name === name);
        assert.ok(group, `missing business group ${name}`);
        assert.equal(group.proxies[0], first, `${name} default`);
      }
      if (target.file.startsWith('FlClash/')) {
        assert.equal(output.rules, rulesRef, 'FlClash must preserve rule array identity');
        assert.equal(output['proxy-groups'], groupsRef, 'FlClash must preserve group array identity');
      }
    }
  });

  test(`${target.file}: merged JMS nodes create an isolated AI group without a Sub-Store template`, () => {
    const run = load(target.file);
    const input = fixture();
    const jmsNames = ['JMS LA c33s2', 'JMS LA c33s3', 'JMS LA c33s4', 'JMS LA c33s5'];
    input.proxies = input.proxies.filter((item) => !item.name.startsWith('JMS'));
    input.proxies.push(...jmsNames.map((name) => proxy(name, true)));
    // These are the ordinary groups returned by a merged subscription, not an AI pool.
    input['proxy-groups'].push(
      { name: '🚀 节点选择', type: 'select', proxies: ['🚀 手动切换', 'DIRECT'] },
      { name: '🚀 手动切换', type: 'select', proxies: input.proxies.map((item) => item.name) },
      { name: '💬 AI 服务', type: 'select', proxies: ['🚀 节点选择', 'DIRECT'] },
    );
    const proxiesRef = input.proxies;
    const rulesRef = input.rules;
    const groupsRef = input['proxy-groups'];
    for (let round = 0; round < 2; round++) {
      const output = run(input);
      assertValidGroups(output);
      assert.equal(output.proxies, proxiesRef);
      const aiGroups = output['proxy-groups'].filter((group) => group.name === 'AI专属');
      assert.equal(aiGroups.length, 1);
      assert.equal(aiGroups[0].type, target.regionType);
      assert.deepEqual(Array.from(aiGroups[0].proxies), jmsNames);
      assert.equal(output['proxy-groups'][3].name, 'AI专属', 'AI pool follows the global group');
      for (const group of output['proxy-groups']) {
        if (group.name !== 'AI专属') {
          for (const name of jmsNames) assert.ok(!group.proxies.includes(name), `${group.name}: JMS node leaked`);
        }
      }
      for (const [name, first] of BUSINESS_DEFAULTS) {
        const group = output['proxy-groups'].find((item) => item.name === name);
        assert.equal(group.proxies[0], first, `${name} default`);
        assert.ok(group.proxies.includes('AI专属'), `${name}: AI candidate missing`);
      }
      if (target.file.startsWith('FlClash/')) {
        assert.equal(output.rules, rulesRef);
        assert.equal(output['proxy-groups'], groupsRef);
      }
    }
  });

  test(`${target.file}: automatic JMS matching uses name boundaries and ignores non-selectable nodes`, () => {
    const run = load(target.file);
    const input = fixture();
    input.proxies = input.proxies.filter((item) => !item.name.startsWith('JMS'));
    const names = ['jms LA 01', 'Tokyo-JMS-01', '🇺🇸JMS 02'];
    input.proxies.push(...names.map((name) => proxy(name, true)),
      proxy('ADJMS01'), proxy('JMSProxy Tokyo'), proxy('JMS1 US'), proxy('🇺🇸美国ai解锁'),
      proxy('JMS 剩余流量'),
      { name: 'JMS Direct', type: 'direct' }, { name: 'JMS Reject', type: 'reject' });
    const output = run(input);
    assertValidGroups(output);
    const aiGroup = output['proxy-groups'].find((group) => group.name === 'AI专属');
    assert.deepEqual(Array.from(aiGroup.proxies), names);
    assert.ok(!output.proxies.some((item) => item.name === 'JMS 剩余流量'));
  });

  test(`${target.file}: explicit AI pools keep their membership even when other JMS nodes exist`, () => {
    const run = load(target.file);
    const input = fixture(['US 01 Node', 'JMS US 01']);
    for (let round = 0; round < 2; round++) {
      const output = run(input);
      assertValidGroups(output);
      const aiGroup = output['proxy-groups'].find((group) => group.name === 'AI专属');
      assert.deepEqual(Array.from(aiGroup.proxies), ['US 01 Node', 'JMS US 01']);
      assert.ok(output['proxy-groups'].find((group) => group.name === '🌍 全球节点').proxies.includes('JMS Home 02'));
    }
  });

  test(`${target.file}: subscriptions without JMS and invalid explicit AI groups keep their existing behavior`, () => {
    const run = load(target.file);
    const cases = [
      fixture(),
      fixture(['missing node', 'DIRECT', null]),
      fixture(['JMS US 01']),
    ];
    cases[0].proxies = cases[0].proxies.filter((item) => !item.name.startsWith('JMS'));
    cases[2]['proxy-groups'].push({ name: 'AI专属', type: 'url-test', proxies: ['JMS Home 02'] });
    for (const input of cases) {
      const output = run(input);
      assertValidGroups(output);
      assert.ok(!output['proxy-groups'].some((group) => group.name === 'AI专属'));
      assert.ok(output['proxy-groups'].some((group) => group.name === '🌍 全球节点'));
    }
  });
}

test('Cloudflare Sub-Store template creates AI专属 from a delimited JMS node-name match', () => {
  const templatePath = path.join(ROOT, 'SubStore/templates/scki-jms-ai-mihomo.json');
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  assert.equal(template.target, 'mihomo');
  const aiGroup = template.config.proxyGroups.find((group) => group.name === 'AI专属');
  assert.ok(aiGroup);
  assert.equal(aiGroup.type, 'url-test');
  assert.equal(aiGroup.proxies, undefined, 'node names must be expanded from the filter at subscription time');
  assert.equal(aiGroup.filter, '(?i)(^|[^a-z0-9])JMS([^a-z0-9]|$)');
  const matcher = new RegExp(aiGroup.filter.replace(/^\(\?i\)/, ''), 'i');
  assert.ok(matcher.test('JMS Tokyo 01'));
  assert.ok(matcher.test('HK-JMS-Tokyo'));
  assert.ok(!matcher.test('ADJMSProxy'));
  assert.ok(!matcher.test('JMSProxy Tokyo'));
});
