# FORKING.md — 个人 Fork 维护指南

> 面向需要 Fork 本仓库、发布个人 JS 到 jsDelivr，并在自己的 Sub-Store 中管理 JMS 节点与 AI 组的用户。
> 如果你只是想使用源作者的配置，不需要 Fork——直接导入源仓库的 jsDelivr 地址即可。

---

## 1. 三层架构

将仓库拆成三层，各司其职：

```
upstream (源作者仓库)    只读镜像，仅用于获取更新
origin   (你的 GitHub Fork)   公开发布个人 JS 与脱敏模板
你的 Sub-Store                私有保存订阅凭据、节点与 JMS Collection
```

FlClash 手机端加载你的 JS：

```
https://cdn.jsdelivr.net/gh/<你的用户名>/<你的仓库>@main/FlClash/FlClash%28mihomo%29.js
```

规则集继续使用源作者仓库的 jsDelivr 地址，无需自己同步生成物。

---

## 2. Sub-Store JMS 组设计

### 2.1 模板与私有数据

仓库模板只定义公开的策略组和名称过滤条件：

```
SubStore/templates/scki-jms-ai-mihomo.json
```

将 JMS Source 加入 Collection 并保留独立 `JMS` 名称标识，JS 即可自动生成专属组。若需要在订阅中显式提供节点池，可通过 `/api/templates` 导入模板，再绑定 Collection。订阅 URL、admin token、节点参数与凭据只保存在自己的 Sub-Store，不应导出到公开仓库。

### 2.2 职责划分

**Sub-Store 负责：**

- 管理机场和 JMS Sources、订阅 URL 与凭据
- 可选：按独立 `JMS` 名称标识展开显式 `AI专属` 代理组
- 输出一条供客户端使用的 Mihomo 组合订阅

**JS 负责：**

- 优先读取显式 `AI专属` 组；缺少该组时自动收集名称带独立 `JMS` 标识的节点
- 清理机场原有策略组
- 让 JMS 节点不参与区域/家宽分类
- 将 `AI专属` 加入全部业务组，AI/Gemini 默认优先
- 根据业务给出合适的首选项（国内业务 `DIRECT`、对应地区业务优先其地区组）

更新公开 JS 不会影响私有订阅凭据；更换 JMS 节点也不需要修改或重新发布 JS。

---

## 3. Git 结构

### 3.1 首次迁移前保护工作区

```bash
git diff --binary > /tmp/scki-local.patch
git stash push -u -m "local changes before upstream migration"
git branch backup/local-before-upstream-sync
```

### 3.2 调整 remote

```bash
git remote rename origin upstream
git remote add origin git@github.com:<你的用户名>/<你的仓库>.git
git fetch upstream
```

### 3.3 分支职责

```
upstream/main   源作者最新代码，只读镜像
main            你的公开发布分支
feature/*       本地功能开发分支
```

当前仓库没有领先源作者的已提交 commit，只有本地未提交改动，因此可以先以 `upstream/main` 作为新的基础，再恢复本地修改。

---

## 4. 日常同步流程

```bash
git fetch upstream
git switch main
git merge upstream/main
```

### 4.1 冲突处理策略

| 冲突场景 | 处理方式 |
|----------|----------|
| 源作者修改其他客户端或生成规则集 | **优先接受 upstream** |
| 源作者修改 Clash Party / FlClash 同一区域 | **人工合并**，保留你的本地行为 |
| Sub-Store 私有配置 | 只在你自己的 Worker / 管理界面维护，不参与 Git 合并 |
| `.gitignore` | 保留对本地遗留节点文件和实验文件的忽略规则 |

合并完成后运行 JS 合同检查（见 §6）。

### 4.2 提交规范

建议把个人定制拆成独立提交，便于以后区分 upstream 提交和个人修改：

```
feat(subscription): add Sub-Store JMS AI group
fix(flclash): preserve local AI routing behavior
docs: add personal jsdelivr import instructions
```

使用 `git log` 或 `git rebase` 时可以清楚区分来源。

---

## 5. 发布策略

| 场景 | 使用地址 |
|------|----------|
| 开发测试 | `@main` |
| 稳定使用 | `@personal-v1`（版本 tag） |

手机端固定使用 tag 地址，确认测试通过后再移动 tag 或创建新 tag，避免源作者同步后 JS 突然变化。

### 5.1 公开与私有分离

**公开仓库中只发布：**

- Clash Party JS
- FlClash JS
- 脱敏 Sub-Store 模板（`SubStore/templates/scki-jms-ai-mihomo.json`）
- 使用说明

**不发布（`.gitignore` + 本地保存）：**

- Sub-Store Source URL、Collection 数据和管理 Token
- 节点订阅 URL
- UUID、密码、Reality 密钥
- `.bak` 和实验脚本

---

## 6. 验证标准

### 6.1 JS 合同检查

```bash
node tools/validate-js-overwrites.js --target smart
node tools/validate-js-overwrites.js --target normal
node tools/validate-js-overwrites.js --target flclash
```

### 6.2 安全检查确认清单

- [ ] 公开 JS 中不存在 `uuid`、`reality-opts`、私有服务器地址
- [ ] Sub-Store Collection 包含带独立 `JMS` 标识的节点，或显式输出 `AI专属` 节点池
- [ ] Clash Party Smart / Normal 与 FlClash 都能生成专属组，并隔离其节点与区域组
- [ ] 没有显式节点池且没有 JMS 节点时，普通订阅仍能正常生成
- [ ] `git fetch upstream && git merge upstream/main` 不会读取或覆盖 Sub-Store 私有数据
- [ ] jsDelivr 地址返回的是纯 JavaScript，而不是 GitHub HTML 页面

### 6.3 节点泄露扫描（建议加入 CI）

```bash
# 扫描公开 JS 中是否残留敏感字段
rg -n "uuid:|reality-opts:|private-key:|short-id:" \
  "Clash Party/ClashParty(mihomo-smart).js" \
  "Clash Party/ClashParty(mihomo).js" \
  "FlClash/FlClash(mihomo).js"
# 期望：无输出
```

---

## 7. 默认假设

- 实际节点订阅与凭据保存在自己的 Sub-Store 中，**不通过公开 GitHub / jsDelivr 发布**
- 个人 Fork 只负责公开 JS 和同步源作者代码
- 定期从 upstream 拉取更新，保持规则集和客户端支持不落后

---

## 8. 项目简化：哪些是上游噪声

源仓库是一个 **14 客户端 + 规则生成管线** 的完整工程。作为个人 Fork 用户，你只用到其中 ~2%。下面标注每个目录/文件的性质，帮你快速判断"哪些跟我有关、哪些可以完全忽略"。

### 8.1 噪声地图

| 路径 | 性质 | 个人 Fork 需要？ | 说明 |
|------|------|:---:|------|
| `Clash Party/` | 客户端产物 | ✅ **核心** | 你的 JS 定制主战场 |
| `FlClash/` | 客户端产物 | ✅ **核心** | FlClash 手机端 JS |
| `FORKING.md` | 个人文档 | ✅ 本文件 | 你正在读 |
| `MERGE-PLAN.md` | 个人文档 | ✅ 保留 | 你的定制合并记录（已在 `.gitignore`） |
| `docs/personal-fork-sync.md` | 个人文档 | ✅ 保留 | 与 FORKING.md 互补的实操笔记 |
| `.gitignore` | 配置 | ✅ 保留 | 保护本地遗留节点文件和实验文件 |
| `tools/validate-js-overwrites.js` | 验证工具 | ✅ 需要 | 每次合并后跑 JS 合同检查 |
| `tools/validate-process-name-direct.js` | 验证工具 | ✅ 需要 | PROCESS-NAME 白名单验证 |
| `tools/setup-personal-fork.sh` | 辅助脚本 | ✅ 一次性 | 首次创建 Fork 时用 |
| | | | |
| `AGENTS.md` | 上游维护契约 | ❌ 噪声 | 798 行的 14 客户端联动规则，**跟你无关**。你只需要对齐 Clash Party / FlClash 两个 JS，不需要管 CMFA/OpenClash/SingBox 等 12 个客户端是否同步 |
| `README.md`（根） | 上游文档 | ❌ 噪声 | 面向 14 客户端用户的项目介绍 |
| `CHANGELOG.md`（根） | 上游日志 | ❌ 噪声 | 仓库级发版记录 |
| | | | |
| `Clash Meta For Android/` | 客户端产物 | ❌ 噪声 | CMFA YAML，你不需要 |
| `OpenClash/` | 客户端产物 | ❌ 噪声 | OpenClash shell 脚本 |
| `Shadowrocket/` | 客户端产物 | ❌ 噪声 | iOS Shadowrocket conf |
| `SingBox/` | 客户端产物 | ❌ 噪声 | sing-box JSON + 生成器 |
| `v2rayN/` | 客户端产物 | ❌ 噪声 | v2rayN Xray 路由 |
| `Surge/` | 客户端产物 | ❌ 噪声 | iOS/macOS Surge conf |
| `Loon/` | 客户端产物 | ❌ 噪声 | iOS Loon conf |
| `Quantumult X/` | 客户端产物 | ❌ 噪声 | iOS QX conf |
| `Stash/` | 客户端产物 | ❌ 噪声 | Stash YAML |
| `Egern/` | 客户端产物 | ❌ 噪声 | Egern YAML |
| `Passwall/` | 客户端产物 | ❌ 噪声 | OpenWrt Passwall 脚本 |
| `Passwall2/` | 客户端产物 | ❌ 噪声 | OpenWrt Passwall2 脚本 |
| | | | |
| `rulesets/` | 规则生成管线 | ❌ 噪声 | ~几千个文件。源规则图 + `.mrs` + fused + supplemental。你的 JS 通过 URL 引用源作者的 jsDelivr 融合规则集，**本地不需要这些** |
| `.github/workflows/` | CI/CD | ❌ 噪声 | 6 个 workflow：全客户端验证、AI Issue 回复、规则定时同步。你的 Fork 不需要跑这些 |
| `.github/ISSUE_TEMPLATE/` | Issue 模板 | ❌ 噪声 | 上游 Issue 分类模板 |
| | | | |
| `tools/`（除上述 3 个） | 上游工具链 | ❌ 噪声 | 50+ 个脚本：`.mrs` 同步、融合编译、Stash/Egern/SingBox 生成器、fallback 产物、流量选项同步、节点过滤同步、20 个测试文件。**你只需要 validate-js-overwrites.js 和 validate-process-name-direct.js** |
| `docs/`（除 personal-fork-sync.md） | 上游文档 | ❌ 噪声 | GEOSITE 台账、PROCESS-NAME 兼容性、捐款二维码、客户端能力矩阵、订阅节点过滤、流量选项、研究笔记 |
| `mirrors/` | 规则镜像 | ❌ 噪声 | 上游 rule-provider 备用源 |
| `SubStore/` | 独立脚本 | ❌ 噪声 | Sub-Store 脚本模板，独立于主产物 |

### 8.2 为什么不能直接删除

如果你 `rm -rf` 这些噪声目录并提交，下次 `git merge upstream/main` 时：

- 如果 upstream 没动这些文件 → 合并干净，但你的 commit 历史里会有一个巨大的 "删除噪声" commit
- 如果 upstream 改了这些文件 → **合并冲突**，你需要逐个文件决定保留删除还是接受 upstream

**推荐做法：不删除，心里有数即可。** 把它们当作"上游维护所需的脚手架"，你的工作区只在 `Clash Party/`、`FlClash/`、`FORKING.md`、`MERGE-PLAN.md` 这四个地方。

### 8.3 可选：Git 稀疏检出（真正瘦身）

如果你真的想在本地只看相关文件，可以用 `git sparse-checkout`：

```bash
# 启用稀疏检出
git sparse-checkout init --cone

# 只检出你关心的目录
git sparse-checkout set \
  "Clash Party" \
  "FlClash" \
  "tools/validate-js-overwrites.js" \
  "tools/validate-process-name-direct.js" \
  "tools/lib" \
  "FORKING.md" \
  "MERGE-PLAN.md" \
  ".gitignore"

# 验证：工作区现在只有这些文件
ls
```

**注意**：稀疏检出后 `node tools/validate-js-overwrites.js` 可能因缺少 `tools/lib/` 依赖而报错，需要把 `tools/lib/` 也加入检出列表。如果验证脚本依赖 `rulesets/` 下的文件，则需要额外检出对应路径，或改用 CI 验证。

更简单的替代方案：**不做稀疏检出**，只在心里忽略噪声目录。磁盘空间占用 ~100MB，对现代设备可以忽略不计。

### 8.4 你应该关心的文件（一览）

```
Smart-Config-Kit/
├── Clash Party/          ← 你的 JS 定制（核心）
│   ├── ClashParty(mihomo-smart).js
│   ├── ClashParty(mihomo).js
├── FlClash/              ← FlClash 手机端 JS
│   ├── FlClash(mihomo).js
├── SubStore/templates/   ← JMS `AI专属` 组合订阅模板
├── FORKING.md            ← 本指南
├── MERGE-PLAN.md         ← 你的定制合并记录
├── .gitignore            ← 私有文件排除规则
└── tools/
    ├── validate-js-overwrites.js       ← 合并后必跑
    └── validate-process-name-direct.js ← 合并后必跑
```

其余所有目录和文件都是上游维护脚手架，跟你无关。
