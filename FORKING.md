# 个人 Fork 维护指南

这个 Fork 用于定制 Clash Party、FlClash 和 SubStore。代理维护规则集中在 [AGENTS.md](AGENTS.md)，本指南只说明订阅、同步和发布流程。

## 三层职责

| 层 | 职责 |
| --- | --- |
| `upstream`：源作者仓库 | 获取客户端更新与已经编译好的规则文件，按需升级 |
| `origin`：个人 GitHub Fork | 发布个人 JS、配套规则快照、脱敏 SubStore 脚本/模板及说明 |
| 私有 SubStore | 保存真实订阅、节点凭据和 Source / Collection 数据，输出组合订阅 |

主要工作目录是 `Clash Party/`、`FlClash/` 和 `SubStore/`；`tools/` 中的相关验证工具与依赖也要保留。其他客户端、规则生成管线和上游文档保留供后续合并，按需查看，无需为了个人 JS 修改同步全部产物。

## 订阅与 JMS

1. 在自己的 SubStore 中管理机场和 JMS Sources，加入同一个 Collection，输出 Mihomo 订阅。
2. JMS 来源的节点名保留独立 `JMS` 标识，例如 `JMS Tokyo 01`；`JMSProxy` 不算独立标识。
3. 三份 JS 可自动生成 `AI专属`；需要显式节点池时，可导入 [公开模板](SubStore/templates/scki-jms-ai-mihomo.json) 并绑定 Collection。完整行为约定见 [AGENTS.md](AGENTS.md)。
4. 客户端导入私有组合订阅，再加载个人 Fork 的 JS。Cloudflare 兼容版下载链接使用 public download token，管理 token 仅用于管理 API。

部署和导入步骤见 [SubStore README](SubStore/README.md)；脚本执行顺序见 [scripts README](SubStore/scripts/README.md)。仓库模板及示例保持脱敏，真实 URL、节点参数和 token 不提交到 Git，也不发布到 jsDelivr。

## 首次配置

先用 `git status` 确认工作区，保存尚未提交的改动。可在 GitHub 完成 Fork 后配置 remote，或使用仓库提供的辅助脚本：

```bash
gh auth login
bash tools/setup-personal-fork.sh
```

脚本只处理 Fork / remote，不提交、推送或合并当前工作区。手动配置时先检查 `git remote -v`：如果 `origin` 仍指向源作者且没有 `upstream`，执行：

```bash
git remote rename origin upstream
git remote add origin git@github.com:<你的用户名>/<你的仓库>.git
git fetch upstream
```

已经配置好两个 remote 时，跳过这一步。`upstream/main` 用于获取上游状态，`main` 用于个人发布；功能开发可使用独立分支。

## 日常同步

保存工作区改动后执行：

```bash
git fetch upstream
git switch main
git merge upstream/main
```

冲突处理：

- Clash Party / FlClash、SubStore 脚本/模板及相关验证工具：逐段合并，保留个人行为与上游修复。
- `AGENTS.md`、本指南及 `.gitignore`：保留个人维护范围和私有文件忽略规则。
- 其他客户端和规则生成物：通常接受 upstream；无需重建完整生成链路。

Clash Party Smart/Normal 与 FlClash 共用 `Clash Party/rulesets/active.json` 指定的个人规则快照。该目录保存复制的 `.mrs` / residual YAML、两份 Gemini YAML 和文件哈希清单；URL 指向 `ZhuoHanWang/Smart-Config-Kit@main` 下独立的版本目录。保持该目录不变时，客户端定时下载仍取得同一份规则。GeoX 数据库不属于此快照，继续沿用客户端原配置。

合并后若暂不升级规则，恢复这三个脚本的配套规则块：

```bash
node tools/use-personal-rule-snapshot.js
```

有意升级时，先合并三份正式 JS 中配套的上游融合 provider/rules 块及其 `rulesets/generated/fused/mihomo/` 文件，再创建新目录（例如下一个版本 `v6.0.15-fork.2`）：

```bash
node tools/use-personal-rule-snapshot.js --create v6.0.15-fork.2
```

该命令复制本地已编译资产、下载两份 Gemini YAML 并更新三个 JS，不运行全端编译；已存在的快照禁止覆盖。仍使用本地旧 `ClashParty(mihomo-smart)-ai-gemini.js` 时，在上述命令追加 `--include-local-gemini`，该文件继续被 Git 忽略。规则内容升级后同步更新受影响 JS 的版本号和目录 CHANGELOG。

Fork 的全量上游生成工作流会跳过运行，避免每周重写个人脚本；规则快照检查会在个人 Fork 的 JS CI 中执行。

私有 SubStore 数据不参与 Git 合并。本地 `MERGE-PLAN.md` 是旧变体移植记录，只有需要追溯旧定制时才查阅。

合并或修改共用 JS 后运行：

```bash
node tools/validate-js-overwrites.js
node tools/use-personal-rule-snapshot.js --check
node --test tools/tests/subscription-ai-group.test.js
```

单平台及其他修改的检查见 [AGENTS.md](AGENTS.md)。验证器会读取本地 `rulesets/`、共享运行时和 fixture，因此保留完整检出即可；默认不使用稀疏检出，也不删除无关文件。

## 发布与导入

确认 diff 和验证结果后，将个人定制单独提交到 `origin`，便于以后与上游区分。开发测试使用 `@main`，稳定使用可创建新的版本 tag（例如 `@personal-v1`），客户端固定到已验证的 tag。

当前个人 Fork 的 FlClash 地址：

```text
https://cdn.jsdelivr.net/gh/ZhuoHanWang/Smart-Config-Kit@main/FlClash/FlClash%28mihomo%29.js
```

其他 Fork 替换用户名和仓库名；Clash Party 使用同一前缀下的 `Clash%20Party/ClashParty%28mihomo-smart%29.js` 或 `Clash%20Party/ClashParty%28mihomo%29.js`。确认地址返回纯 JavaScript，刷新客户端后检查最终策略组及默认选项。

发布时将个人 JS、`Clash Party/rulesets/active.json` 和对应快照目录一起提交、推送；只上传 JS 会导致新的规则 URL 返回 404。后续升级保留旧快照，以便旧客户端继续使用；无需自行编译作者已经生成的规则。更换私有 JMS 节点不需要重新发布 JS。
