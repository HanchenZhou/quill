# @quill/server

Self-hosted Quill backend. Bun + Hono. Serves vault files via REST, with single-password
auth. AI agent endpoint will be wired in a follow-up step (see `docs/web-server.md`).

> Status: **skeleton** — auth + vault CRUD only. No agent, no static web frontend, no
> Docker image. Each comes in its own follow-up PR.

## Quick start

```bash
# 1. Generate a password hash
bun run apps/server/scripts/hash-password.ts hunter2
# → $2a$12$...

# 2. Drop it into apps/server/config.yaml (copy from config.example.yaml)
#    Also set a random session_secret (≥32 chars).

# 3. Start dev server with hot reload
QUILL_CONFIG=./apps/server/config.yaml bun --filter @quill/server dev
```

Default port: `3000`. Override in `config.yaml > server.port` or with `--port` if launching Bun directly.

## Endpoints

All `/api/*` except `/api/auth/login` require a session cookie obtained via login.

| Method | Path | Notes |
|---|---|---|
| GET    | `/health`                          | Liveness probe; no auth |
| POST   | `/api/auth/login`                  | Body: `{ password }`. Sets `quill-session` httpOnly cookie. |
| POST   | `/api/auth/logout`                 | Clears the cookie. |
| GET    | `/api/auth/me`                     | `{ authenticated: true }` or 401. |
| GET    | `/api/vault/index`                 | Recursive vault scan with content hashes. |
| GET    | `/api/vault/list?dir=<path>`       | Single-level listing for lazy file-tree. |
| GET    | `/api/vault/file/<path>`           | Read; `ETag: "<sha256>"`. |
| PUT    | `/api/vault/file/<path>`           | Write; optional `If-Match: "<hash>"` for optimistic concurrency (412 on mismatch). Auto-mkdir parents. |
| DELETE | `/api/vault/file/<path>`           | Delete a file (not directories). Same `If-Match` semantics. |
| POST   | `/api/vault/mkdir`                 | Body: `{ path }`. Creates nested dirs. |
| DELETE | `/api/vault/dir/<path>?recursive=1` | Remove directory; recursive must be explicit. |
| POST   | `/api/vault/move`                  | Body: `{ from, to }`. Works for files and dirs. |
| GET    | `/api/vault/resource/<path>`       | Binary directly (images etc.) with `Cache-Control: private, max-age=3600`. |

## Curl smoke test

```bash
# Login (saves cookie)
curl -c /tmp/cookies -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"hunter2"}'

# Read the vault
curl -b /tmp/cookies localhost:3000/api/vault/index | jq .

# Write a file
curl -b /tmp/cookies -X PUT localhost:3000/api/vault/file/notes/hi.md \
  --data 'hello from curl'

# Optimistic write (412 on stale hash)
curl -b /tmp/cookies -X PUT localhost:3000/api/vault/file/notes/hi.md \
  -H 'If-Match: "<some-stale-hash>"' \
  --data 'overwrite' -w '%{http_code}\n'
```

## Config schema

See `config.example.yaml`. Validated with zod at startup — a broken config refuses to
boot rather than crashing mid-request.

Env-var interpolation: any `${VAR_NAME}` in the YAML expands from `process.env` before
parsing. Use it to keep secrets out of files. Missing vars expand to empty string.

## Security notes

- `quill-session` is httpOnly + SameSite=Lax. Combine with HTTPS in production
  (terminate TLS at a reverse proxy — server speaks plain HTTP).
- Path traversal: every vault path goes through `resolveInVault` which strips leading
  slashes (treat as vault-relative) and rejects anything resolving outside the root.
  URL-encoded `..` (`%2e%2e%2f`) is decoded inside the handler and caught.
- Single-user model — no per-user vault isolation. If you need multi-user, that's
  a separate design (`docs/web-server.md` lists it as out-of-scope).
