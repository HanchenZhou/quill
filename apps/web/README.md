# @quill/web

Browser client for Quill. Vite + React 18 + React Router + Tailwind v4. One responsive
codebase serves both PC and H5 — sidebar collapses to a drawer below `md`.

> Status: **read-only browser** — login → file tree → Markdown preview. Editor, sync
> status icons, and AI agent are planned follow-ups (see `docs/web-server.md`).

## Visual identity

The Paper theme (tokens, typography, prose styles, hljs colors) lives in
`packages/core/styles` and is shared with `apps/desktop`. Web and desktop are
pixel-identical for the same content modulo layout (no native title bar in browser).

## Dev

You need two processes side by side:

```bash
# Terminal 1 — backend (Bun + Hono)
QUILL_CONFIG=./apps/server/config.yaml bun --filter @quill/server dev

# Terminal 2 — frontend (Vite)
bun --filter @quill/web dev
```

Then open <http://localhost:5173>. Vite proxies `/api/*` to the Bun server on `:3000`
with cookies passed through, so the session cookie sticks on `localhost:5173` and you
can stay logged in across reloads.

## Production

```bash
bun --filter @quill/web build           # → apps/web/dist
QUILL_WEB_DIST=./apps/web/dist \
QUILL_CONFIG=./config.yaml \
  bun --filter @quill/server start      # one process, serves both UI + API
```

The server's catch-all route checks disk for the requested asset and falls back to
`index.html` for client-side routes (history-mode SPA).

## H5 considerations

Handled in this skeleton:

- **Inputs ≥16px** in `src/index.css` to avoid iOS Safari's auto-zoom-on-focus.
- **`100dvh`** for full-height containers (avoids the iOS Safari toolbar offset).
- **Drawer sidebar** below `md` — overlay dim layer + ☰ trigger.
- **`viewport-fit=cover`** in `index.html` for notch / dynamic island.

Still TODO (next PR): PWA manifest + theme-color sync with `--paper` on theme change,
service worker for offline shell.

## Layout

```
src/
├── App.tsx           Top-level router + auth guard
├── main.tsx          Entry; mounts BrowserRouter, applies system theme
├── index.css         Tailwind + @quill/core CSS imports + web-only tweaks
├── pages/
│   ├── Login.tsx     POST /api/auth/login form
│   └── Vault.tsx     Layout: sidebar + main pane
├── components/
│   ├── FileTree.tsx  Lazy-loaded tree, click-to-expand directories
│   └── Preview.tsx   markdown-it → .prose-paper
└── lib/
    ├── auth.ts          login / logout / isAuthenticated
    ├── remote-vault.ts  VaultProvider implementation hitting /api/vault/*
    ├── markdown.ts      markdown-it + highlight.js setup
    └── theme.ts         prefers-color-scheme → data-theme attr
```

## Why no `react-query` / `zustand` / other state libs yet

Read-only browsing has trivial data flow: load list, click → load file. `useState` +
`useEffect` is enough. Caching, optimistic mutations, conflict resolution will land
together with editing & sync UI — that's the right time to introduce a state library
(and pick deliberately based on what we need then).
