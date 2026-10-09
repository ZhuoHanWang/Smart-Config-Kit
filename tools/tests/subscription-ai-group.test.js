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

  test(`${target.file}: missing, empty, or duplicate AI groups do not alter public subscription behavior`, () => {
    const run = load(target.file);
    const cases = [
      fixture(),
      fixture(['missing node', 'DIRECT', null]),
      fixture(['JMS US 01']),
    ];
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
