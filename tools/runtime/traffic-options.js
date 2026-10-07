// Browser and QuickJS safe. Synchronize QUIC data from routing-graph.js with tools/sync-traffic-options.js.
var SckiTrafficOptions = (function() {
  // >>> SCKI HEALTH CHECK: BEGIN
  var HEALTH_CHECK_PROFILES = {"standard":{"intervalSeconds":300,"lazy":true},"power-save":{"intervalSeconds":900,"lazy":true}};
  // <<< SCKI HEALTH CHECK: END
  // >>> SCKI QUIC RULES: BEGIN
  var BLOCK_FOREIGN_QUIC_RULES = ["AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,youtube)),📹 YouTube","AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,google)),🔍 Google 服务","AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,microsoft)),Ⓜ️ 微软服务","AND,((DST-PORT,443),(NETWORK,UDP),(GEOSITE,apple)),🍎 苹果服务","AND,((DST-PORT,443),(NETWORK,UDP),(NOT,((GEOSITE,cn)))),REJECT"];
  // <<< SCKI QUIC RULES: END

  function validate(options) {
    if (!options || Object.prototype.toString.call(options) !== '[object Object]' ||
        (options.healthCheckProfile !== 'standard' && options.healthCheckProfile !== 'power-save') ||
        (options.quicPolicy !== 'block-foreign' && options.quicPolicy !== 'follow-rules')) {
      throw new Error('Invalid SCKI traffic options');
    }
    return options;
  }

  function applyHealthCheckProfile(config, profile, platform) {
    if (profile !== 'standard' && profile !== 'power-save') throw new Error('Invalid SCKI health check profile');
    if (platform !== 'smart' && platform !== 'normal') throw new Error('Invalid SCKI health check platform');
    var type = platform === 'smart' ? 'smart' : 'url-test';
    var settings = HEALTH_CHECK_PROFILES[profile];
    var groups = config['proxy-groups'];
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      if (!group || group.type !== type) continue;
      group.interval = settings.intervalSeconds;
      group.lazy = settings.lazy;
    }
    return config;
  }

  function applyQuicPolicy(rules, mode) {
    if (mode !== 'block-foreign' && mode !== 'follow-rules') throw new Error('Invalid SCKI QUIC policy');
    if (!Array.isArray(rules)) throw new Error('SCKI rules must be an array');
    var anchor = rules.indexOf('DST-PORT,7680,REJECT');
    if (anchor < 0) throw new Error('Missing SCKI QUIC insertion anchor');
    for (var i = rules.length - 1; i >= 0; i--) {
      if (BLOCK_FOREIGN_QUIC_RULES.indexOf(rules[i]) >= 0) rules.splice(i, 1);
    }
    if (mode === 'block-foreign') {
      anchor = rules.indexOf('DST-PORT,7680,REJECT');
      for (var j = 0; j < BLOCK_FOREIGN_QUIC_RULES.length; j++) rules.splice(anchor + j, 0, BLOCK_FOREIGN_QUIC_RULES[j]);
    }
    return rules;
  }

  return { validate: validate, applyHealthCheckProfile: applyHealthCheckProfile, applyQuicPolicy: applyQuicPolicy };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SckiTrafficOptions;
