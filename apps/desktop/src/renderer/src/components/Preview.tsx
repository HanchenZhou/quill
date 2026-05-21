import { useMemo } from 'react'
import { render } from '../lib/markdown'

export function Preview({ value }: { value: string }) {
  const html = useMemo(() => render(value), [value])
  return (
    <div className="h-full w-full overflow-auto px-8 py-6">
      <div
        className="prose prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
