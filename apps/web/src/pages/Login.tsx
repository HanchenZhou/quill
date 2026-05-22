import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/auth'

export function Login(): JSX.Element {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm flex flex-col gap-5"
      >
        <h1 className="font-display-wonk text-4xl text-[--ink] mb-2">Quill</h1>
        <p className="text-sm text-[--ink-soft] -mt-3 mb-2">
          输入访问密码以打开你的 vault。
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-[--ink-faint]">
            密码
          </span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="bg-[--paper-dim] border border-[--rule] rounded px-3 py-2 outline-none focus:border-[--accent] disabled:opacity-50"
          />
        </label>
        {error && (
          <p className="text-sm text-[--accent] font-medium">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="bg-[--ink] text-[--paper] rounded py-2 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {busy ? '正在登录…' : '登录'}
        </button>
      </form>
    </div>
  )
}
