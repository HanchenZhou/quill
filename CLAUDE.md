# Quill

> Claude Code 项目入口规则。每次对话开场自动加载，比 skill 触发更可靠。
> 细节在 `.claude/skills/` 下的各 skill 文件里。

## 开发原则

### TDD 必须
任何 `apps/` 或 `packages/` 下的**逻辑代码**改动都按 `.claude/skills/tdd/SKILL.md` 的红-绿-重构循环走：

1. **Red** — 先写 `bun test` 失败用例，描述期望行为，看到红
2. **Green** — 用最少代码让它变绿
3. **Refactor** — 在绿灯下重构，每一步重跑测试

跳过 TDD 的场景：纯文档 / 配置 / CI / 依赖升级 / typo / 注释 / 探索性 spike（spike 落地时再补测试）。

测试就放源码同目录、同名 `.test.ts`（不建独立 `tests/` 目录）。

### Git / GitHub 流程
所有 commit / push / PR / issue 走 `.claude/skills/git-workflow/SKILL.md`：

- Conventional Commits（`<type>(<scope>): <subject>`）
- 非 trivial 改动从 issue 起步，从 main 拉 `<type>/<issue-number>-<slug>` 分支，不直接在 main 上 commit
- GitHub 相关一律走 `gh` CLI；本地 git 操作用 `git`
- **不**自动 `git push`（用户说 push 才推）；**绝不**自动 `gh pr merge`
- commit message **不加** `Co-Authored-By: Claude` trailer

### 不过度设计
功能写到刚好够用。删除未使用的代码，不写"以防万一"的预留接口、虚假的错误分支、教学式注释。代码本身能说明 _what_，注释只解释 _why_（如果非显然）。

## 技术栈

- **Electron** + **React 18** + **TypeScript**（通过 `electron-vite` 同时驱动 main / preload / renderer）
- **Bun** 1.3+（workspace + 包管理 + `bun:test` 测试运行）
- **Tailwind v4** + `@tailwindcss/typography`（预览样式）
- **CodeMirror 6**（编辑器）+ **markdown-it**（预览渲染）+ **highlight.js**（代码块高亮）
- **electron-builder**（打包，macOS arm64 dmg）

## 目录约定

```
quill/
├── apps/
│   └── desktop/        Electron 桌面端入口
│       ├── src/main/       主进程（窗口、IPC、菜单、文件 dialog、PDF 导出）
│       ├── src/preload/    contextBridge 暴露受控 API 给 renderer
│       └── src/renderer/   React + Tailwind UI
├── packages/           共享代码（预留）
├── docs/               设计文档（先看 architecture.md 与 ui-design.md）
└── sample-vault/       本地首次试运行用的示例笔记
```

## 常用命令

```bash
bun run dev:desktop          # 启动开发（electron-vite dev）
bun typecheck                # 全 workspace 类型检查
bun test                     # 运行测试
bun run dist:mac:arm64       # 打 macOS arm64 dmg（含 icon 生成）
bun --filter @quill/desktop icon   # 单独重生 build/icon.icns（改了 SVG 后）
```

## 不要做的事

- 不要在 `apps/desktop/release/` 或 `out/` 里手改文件 —— 全是构建产物
- 不要为了刷覆盖率而堆测试；测**行为**不测实现细节
- 不要把 `.env*` / 证书 / 大二进制提交进 git
- 不要 force-push 到 main；连 `--force-with-lease` 也只在必须时用

## 记忆

跨会话的"为什么这样定的"、"上次失败的尝试"等持续上下文，记在 `/Users/cheney/.claude/projects/-Users-cheney-work-code-quill/memory/`。`MEMORY.md` 是索引，每条 ≤150 字符。
