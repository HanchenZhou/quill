# Quill Architecture

> 现状：仅搭好工程骨架，业务尚未实现。本文记录已落地的结构与未决问题。

## 项目目标
一个 Markdown 编辑预览桌面端，支持实时预览、主题切换、可扩展能力。
桌面端先行，未来可能扩展 Web 等其他形态。

## 技术栈
- **Electron + React 18 + TypeScript** — 桌面端 UI
- **Bun** — 包管理 + workspace + 测试运行（`bun test`）
- **electron-vite** — 统一驱动主进程 / preload / 渲染层的构建与 HMR
- **Tailwind CSS v4** — 样式（通过 `@tailwindcss/vite` 插件接入）
- **electron-builder** — 打包分发（mac / win / linux）

## Workspace 结构
```
quill/
├── apps/
│   └── desktop/      Electron 桌面端入口
├── packages/         共享代码（编辑器内核、Markdown 解析、IPC 协议等，未来在此拆分）
├── docs/             设计文档与决策记录
└── tsconfig.base.json
```

Bun workspaces 已在根 `package.json` 中声明 `apps/*` 与 `packages/*`，未来新增包零成本接入。

## 进程模型
- **Main**：窗口管理、文件系统、原生菜单（`apps/desktop/src/main/index.ts`）
- **Preload**：通过 `contextBridge` 暴露受控 API（命名空间 `window.quill`，见 `src/preload/`）
- **Renderer**：React + Tailwind，编辑器与预览并列布局（`src/renderer/`）

安全默认：`contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。
Renderer 不直接访问 Node API，所有特权能力都要走 preload + IPC。

## 构建产物
electron-vite 默认产出到 `apps/desktop/out/`：
- `out/main/index.js`
- `out/preload/index.js`
- `out/renderer/`（HTML + 资源）

`electron-builder` 进一步将 `out/` 打包成平台安装包，输出到 `apps/desktop/release/<version>/`。

## 待定 / 未决问题
需求未明确，以下决策**先不做**：
- 编辑器内核选型（CodeMirror 6 / Monaco / TipTap / 自研）
- Markdown 解析器（unified/remark vs markdown-it）
- 文件管理与多窗口模型
- 主题方案与扩展点（插件机制？）
- 自动更新（electron-updater）
- i18n
