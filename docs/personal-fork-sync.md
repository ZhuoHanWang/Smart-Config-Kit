# 个人 Fork 与上游同步

本仓库适合使用两个 Git remote：

- `upstream`：源作者 `https://github.com/IvanSolis1989/Smart-Config-Kit.git`，只用于拉取更新。
- `origin`：你的 GitHub Fork，用于发布个人 JS 和 jsDelivr 地址。

## 首次迁移

如果还没有创建个人仓库，先安装 GitHub CLI，完成一次登录，然后运行仓库内脚本：

```bash
gh auth login
bash tools/setup-personal-fork.sh
```

脚本会检查或创建 `Smart-Config-Kit` Fork，并把当前 `origin`（若仍指向源作者）改成个人 Fork；它不会提交、推送或合并当前工作区。当前环境没有 GitHub CLI 或登录凭据时，无法替你完成这个外部账号操作。

当前工作区有本地未提交改动时，先保存补丁和临时分支：

```bash
git diff --binary > /tmp/scki-local.patch
git stash push -u -m "local changes before upstream migration"
git branch backup/local-before-upstream-sync
```

配置 remote（把 URL 换成你的 Fork）：

```bash
git remote rename origin upstream
git remote add origin git@github.com:<你的用户名>/<你的仓库>.git
git fetch upstream
git switch main
git merge upstream/main
git stash pop
```

若 `stash pop` 或合并产生冲突，Clash Party / FlClash 的同一段代码需要人工合并；规则集和其他客户端产物通常接受 upstream。解决后运行 JS 验证命令再推送：

```bash
node tools/validate-js-overwrites.js --target flclash
git add .
git commit -m "feat(subscription): add Sub-Store JMS AI group"
git push -u origin main
```

## 日常同步

```bash
git fetch upstream
git switch main
git merge upstream/main
node tools/validate-js-overwrites.js --target flclash
git push origin main
```

`upstream/main` 只保存源作者状态；你的修改提交在 `main` 或 `feature/*`。不要把个人 Fork 的 `origin` 当成 upstream 拉取。

## 手机端 URL

FlClash 使用这个 Fork：

```text
https://cdn.jsdelivr.net/gh/ZhuoHanWang/Smart-Config-Kit@main/FlClash/FlClash%28mihomo%29.js
```

规则集 URL 仍指向源作者仓库，这是有意设计的：源作者更新融合规则后，你的 JS 不需要复制整套生成产物。需要固定版本时，把 `@main` 改为你的 release tag，例如 `@personal-v1`。

## JMS AI 节点

实际 JMS 订阅 URL、节点参数与凭据保存在你自己的 Sub-Store Source / Collection 中。把 JMS Source 加入组合 Collection，并让该来源的节点名称带独立 `JMS` 标识；Clash Party Smart/Normal 与 FlClash JS 会在订阅缺少 `AI专属` 组时自动生成该组并完成隔离与业务组接入。可选的 [`scki-jms-ai-mihomo.json`](../SubStore/templates/scki-jms-ai-mihomo.json) 模板可导入 Worker `/api/templates` 并绑定 Collection，用于显式提供节点池，JS 优先使用该组。Admin token 只用于管理 API，客户端下载链接使用 public download token。
