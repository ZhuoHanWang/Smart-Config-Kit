# AGENTS.md — 个人 Fork 最小维护约定

本仓库是 Smart-Config-Kit 的个人 Fork，只维护 **Clash Party、FlClash 与 SubStore 的个人配置**。本文件是唯一代理维护入口，替代原作者面向全部客户端的维护契约；用户当前指令优先。

## 范围与阅读

| 范围 | 入口 |
| --- | --- |
| Clash Party Smart / Normal | `Clash Party/ClashParty(mihomo-smart).js`、`Clash Party/ClashParty(mihomo).js` |
| FlClash | `FlClash/FlClash(mihomo).js` |
| SubStore | `SubStore/scripts/`、`SubStore/templates/` 及脱敏配置示例 |
| 配套文件 | 与本次修改有关的验证工具、共享运行时、文档和 `.gitignore` |

- 默认只读本文件和目标代码。Git 同步/发布时读 [FORKING.md](FORKING.md)；导入或字段问题才读对应目录 README / REFERENCE 的相关段落。
- 其余客户端、`rulesets/` 生成链路与上游工作流保留用于合并和验证依赖，默认不修改、不重新生成，也不要求全客户端联动。用户明确要求扩大范围时再处理。
- 根 README、历史 CHANGELOG、研究笔记和本地 `MERGE-PLAN.md` 按需查阅，不是当前维护契约；旧变体移植步骤不能代替现有代码。
- 不新增 `CLAUDE.md` 等重复契约，不把大段上游手册或任务流水账塞回本文件。

## 修改约定

- 共用的节点分类、过滤、订阅清理、fallback、DNS 和业务分流修改，检查并同步上述三份 JS；平台差异只改对应入口。SubStore 独立脚本/模板修改无需联动其他客户端。
- 保留现有 Gemini 独立组、俄罗斯区域、AI 排除港台澳俄、业务组首选项及个人直连规则，除非本次任务要求调整。组名与 emoji 引用必须一致，候选组不得悬空或为空。
- `AI专属` 优先采用订阅提供的显式节点池；仅在显式组缺失时按独立 `JMS` 标识自动识别。显式空组/无效组不擅自回退。专属节点不参与普通区域/家宽分类；有效组接入全部业务组，AI/Gemini 默认优先；无专属节点时普通订阅正常工作。
- Smart / LightGBM 仅用于 Clash Party Smart；Normal 与 FlClash 使用 `url-test`。FlClash 的 TUN/端口由 App UI 管理，脚本兼容 QuickJS，保持客户端要求的数组引用并保护 `console` 调用。
- 三份正式 JS 的融合规则与 Gemini provider 指向个人 Fork 的 `Clash Party/rulesets/<快照版本>/`；快照与匹配的主规则一起保存，不修改已发布快照。合并上游后用 `node tools/use-personal-rule-snapshot.js` 恢复个人引用；有意升级才用 `--create vX.Y.Z-fork.N` 复制已编译文件并捕获 Gemini。无需运行全端编译；保留规则相对顺序和最后的 `MATCH`。旧 `ai-gemini.js` 是被忽略的本地副本，需同步时追加 `--include-local-gemini`。
- 修改带生成标记的共享代码块时，先定位对应 `tools/runtime/` / `tools/lib/` 源文件与验证依赖，再更新三份 JS 的嵌入块；运行同步脚本前核对写入范围，避免覆盖个人定制或重写无关客户端。
- DNS 修改保留 `fake-ip-filter` 清理逻辑，避免引用已被覆写删除的 provider。Clash Party 的原始订阅 DNS guard 与 JS 执行分开核对，以最终配置为准。
- 涉及新字段、客户端 API 或兼容性时，只核对目标平台的官方文档/源码并注明依据：[Mihomo](https://wiki.metacubex.one/config/)、[Clash Party](https://github.com/mihomo-party-org/clash-party)、[FlClash](https://github.com/chen08209/FlClash)、[Sub-Store](https://github.com/sub-store-org/Sub-Store)、[Cloudflare 兼容版](https://github.com/realchendahuang/sub-store-cloudflare)。纯文档修改无需刷新所有 REFERENCE。

## 验证（Node.js ≥ 18）

三份 JS 的共用逻辑修改或 upstream 合并后运行：

```bash
node tools/validate-js-overwrites.js
node tools/use-personal-rule-snapshot.js --check
```

单平台修改可用 `--target smart`、`--target normal` 或 `--target flclash`。按改动补充检查：

```bash
# JMS / AI专属 / 业务默认项
node --test tools/tests/subscription-ai-group.test.js
# SubStore 流量合并
node --test SubStore/scripts/local/merge-subscription-userinfo.test.js
# 进程分流（此检查会读取上游各端产物）
node tools/validate-process-name-direct.js
```

其他 SubStore 脚本用 `node --check <脚本路径>` 并用脱敏输入验证；模板检查 JSON 合法性和节点池输出。纯 Markdown 修改只检查 diff、链接和说明一致性。验证工具依赖的 `rulesets/`、`tools/lib/` 等文件需保留；上游全端检查失败不自动授权改写无关产物，说明具体原因。

## 记录与同步

- 修改已发布 JS 时，更新受影响文件的 `VERSION` / Build 日期及对应目录 CHANGELOG，保留上游基线标识；纯文档修改不抬客户端版本。README 只写使用说明，行为或导入方式变化时才更新。
- 向用户提供 JS 导入链接时，必须使用与脚本 `VERSION` 对应且已推送的固定 Git tag（jsDelivr `@<版本号>`）；不要使用会移动的 `@main`。若标签尚不存在，先发布对应标签再给链接。
- `upstream` 是源作者只读来源，`origin` 是个人 Fork。合并上游时保留本文件和个人定制；其他客户端/生成物通常接受上游。不要删除无关目录来瘦身，不覆盖工作区已有改动。
- 仓库只保存公开 JS、脱敏脚本/模板和说明。真实订阅 URL、节点凭据、UUID/密码/密钥、SubStore Source/Collection 数据及管理 token 留在私有服务或被忽略的本地文件中；输出和日志也需脱敏。
- 完成后简要报告改动范围、验证结果和未解决问题；不要求列出全部客户端矩阵、生成物统计或为未改动的产物更新日志。
