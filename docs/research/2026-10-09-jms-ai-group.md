# JMS 聚合后缺少 AI专属组：审计与验证

日期：2026-10-09。规则源：`rulesets/source/routing-graph.js` v6.0.15。

## 触发与修复范围

用户提供的 Cloudflare Sub-Store 默认模板输出包含 193 个节点，其中四个名称为 `JMS LA c33s2`～`JMS LA c33s5`。原始策略只有普通的 `💬 AI 服务`，没有 `AI专属`。三个 JS 的 `collectSubscriptionAiGroup` 只读取已有专属组，因而覆写成功后仍不创建该池。

修改仅适配现有个人 JS 可选节点池的输入：没有同名组时，从节点预检后可参与选择的代理中按 `/(^|[^a-z0-9])JMS([^a-z0-9]|$)/i` 收集名字。显式组仍优先，空/重复/无效组保留原拒绝行为。随后复用既有组生成、节点隔离、业务候选与 UI 排序。没有新增或重命名业务/区域组，没有修改规则目标、provider、规则顺序或 DNS，因此规则图与 MRS/fused/派生生成链路无需重建。

## §1.5 逐端同构审计

实际打开每个产物的分类/过滤、订阅清理或出站位置，核对是否存在同样的可选专属池输入。

| 产物 | 检查位置与结论 | 动作 |
| --- | --- | --- |
| Clash Party Smart | `collectSubscriptionAiGroup` / `cleanupSubscription` / 分类前隔离；缺少组直接返回 null | 修复、回归 |
| Clash Party Normal | 与 Smart 同构 | 同步修复、回归 |
| FlClash | 同构收集/清理/分类；额外要求保留数组引用 | 同步修复、回归 |
| CMFA | `proxy-groups` 的原生 filter，不读取订阅中的个人专属池 | 不适用；保留正式 YAML |
| Stash | CMFA 裁剪产物的原生 filter，没有专属池输入 | 不适用；无需重新生成 |
| OpenClash Normal | Ruby `REGIONS` 与 `config["proxy-groups"]` 重建，使用正式区域/业务组，不消费个人 JS 可选池 | 不适用；不改变普通节点分类 |
| OpenClash Smart | 同样的 Ruby 正式组重建，无个人专属池收集 | 不适用；不改变普通节点分类 |
| Shadowrocket | `policy-regex-filter` 原生区域组，不消费 Sub-Store 中的可选池 | 不适用 |
| Surge | 原生 `policy-regex-filter`，无个人池输入 | 不适用 |
| Loon | `[Remote Filter]` 的 `NameRegex/FilterKey`，无个人池输入 | 不适用 |
| Quantumult X | `[policy]` 的 `server-tag-regex`，无个人池输入 | 不适用 |
| Egern | 从 CMFA 生成的原生 selector/filter，无个人池输入 | 不适用；无需重新生成 |
| SingBox | 生成器的静态 selector/outbounds；无订阅组收集 | 不适用；无需重新生成 |
| v2rayN Xray | 只有 routing RuleObject，proxy/direct/block 出站 | 不适用 |
| Passwall | UCI/shunt_rules，引用 fused SRS，无节点池选择器 | 不适用 |
| Passwall2 | 同源 shunt_rules，无节点池选择器 | 不适用 |

## 官方兼容依据

2026-10-09 实时读取 Mihomo [代理组通用配置](https://wiki.metacubex.one/config/proxy-groups/) 与 [url-test](https://wiki.metacubex.one/config/proxy-groups/url-test/)：`proxies` 是代理/代理组名数组，`url`、`interval`、`tolerance` 属于原有测速字段。自动池只展开名称，沿用已存在的 Smart/url-test 构造器，无新增字段。页面 Last-Modified 为 2026-10-03；本地参考已补充本次核对。

FlClash 官方 [latest release](https://api.github.com/repos/chen08209/FlClash/releases/latest) 仍为 [v0.8.99](https://github.com/chen08209/FlClash/releases/tag/v0.8.99)，发布于 2026-10-03，相对 2026-10-08 的本地参考无新版本。本次继续使用其既有 `main(config)` 执行边界，见[脚本教程](https://github.com/chen08209/FlClash/issues/1510)与本地 `REFERENCE-flclash.md` 的 getProfile/makeRealProfileTask 源码链接。

## 验证

- `node --test tools/tests/subscription-ai-group.test.js`：三个实际 `main()` 的无模板四节点输入、双次覆写、节点隔离、业务首选、名称边界、显式池优先与 FlClash 数组身份；测试只使用虚构凭据。
- 用户提供的完整 YAML 仅在内存中解析并运行三个 JS：预检剔除 6 个信息节点，保留 187 个代理，生成 57 个有效组；专属池包含四个 JMS 节点，连续两次覆写的成员与隔离均正确。实际凭据未写入仓库。
- 专属组回归 16 项、节点筛选/测速选项 91 项、融合去重/预算 26 项通过；三个同步器 `--check`、JS 覆写、PROCESS-NAME 与远程资产大小检查通过。
- `validate-artifact-contracts.js --strict-ruby` 完成 2321 项检查，19 份产物通过。环境原先没有 Ruby，使用临时目录中的 Ruby 3.0.2 + Psych 4.0.6 解析，没有改动系统或仓库依赖。既有 OpenClash `.conf` 版本提示与本次无关，正式 `.sh` 合同通过。
