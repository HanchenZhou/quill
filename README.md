# Quill

Markdown 编辑预览桌面端。Electron + React + Bun。

## 快速开始

```bash
bun install
bun run dev:desktop     # 启动桌面端开发模式（electron-vite dev）
```

## 常用命令

```bash
bun run dev:desktop      # 开发模式
bun run build:desktop    # 构建到 apps/desktop/out
bun run dist:desktop     # 构建并打包安装包到 apps/desktop/release
bun typecheck            # 全 workspace 类型检查
bun test                 # 测试（bun test）
```

## 目录

- `apps/desktop` — 桌面端（Electron 主/preload/渲染层）
- `packages/*` — 共享代码（预留）
- `docs/` — 设计文档
  - [`architecture.md`](docs/architecture.md) — 工程结构
  - [`ui-design.md`](docs/ui-design.md) — UI 设计
- `sample-vault/` — 示例笔记，第一次跑可以拿它当 Workspace

## 试用

启动后点 Empty 面板的"打开文件夹"，选 `sample-vault/`。
