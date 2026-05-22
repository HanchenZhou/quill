import { type FormEvent, useState } from 'react'
import { login } from '../lib/auth'

export function Login(): JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(password)
      // Full page reload so App.tsx re-runs its isAuthenticated() check
      // with the now-set cookie. A plain react-router navigate() would
      // bounce off the auth guard because the App's local `auth` state
      // is still 'guest' from the initial mount.
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm flex flex-col gap-5"
      >
        <h1 className="font-display-wonk text-4xl text-[var(--ink)] mb-2">Quill</h1>
        <p className="text-sm text-[var(--ink-soft)] -mt-3 mb-2">
          输入访问密码以打开你的 vault。
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-[var(--ink-faint)]">
            密码
          </span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="bg-[var(--paper-dim)] border border-[var(--rule)] rounded px-3 py-2 outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
        </label>
        {error && (
          <p className="text-sm text-[var(--accent)] font-medium">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="bg-[var(--ink)] text-[var(--paper)] rounded py-2 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {busy ? '正在登录…' : '登录'}
        </button>
      </form>
    </div>
  )
}
