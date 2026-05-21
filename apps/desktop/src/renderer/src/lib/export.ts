import type { Theme } from '../types'
import { render } from './markdown'
import { ipc } from './ipc'

/**
 * Walk all same-origin stylesheets and serialize their rules. Tailwind, our
 * custom CSS (including hljs theme), and Vite-injected dev styles all live in
 * document.styleSheets, so this picks them all up. Cross-origin sheets throw
 * on cssRules access; we skip those silently.
 */
function collectCss(): string {
  const parts: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    if (!rules) continue
    for (const rule of Array.from(rules)) {
      parts.push(rule.cssText)
    }
  }
  return parts.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

type BuildArgs = {
  markdown: string
  theme: Theme
  title: string
}

export function buildExportHtml({ markdown, theme, title }: BuildArgs): string {
  const body = render(markdown)
  const css = collectCss()

  return `<!doctype html>
<html data-theme="${theme}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
@page { margin: 18mm 16mm; }

html, body { background: var(--background, #fff); }
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  color-scheme: ${theme};
}

/* Bundled app CSS (Tailwind + hljs theme + prose) */
${css}

/* Print-specific tweaks */
.export-root { padding: 0; }
pre, blockquote, table { page-break-inside: avoid; }
h1, h2, h3, h4 { page-break-after: avoid; }
img { max-width: 100%; height: auto; }
</style>
</head>
<body data-theme="${theme}">
<div class="export-root">
  <article class="prose prose-neutral ${theme === 'dark' ? 'dark:prose-invert' : ''} max-w-none">
${body}
  </article>
</div>
</body>
</html>`
}

export type ExportArgs = {
  markdown: string
  defaultName: string
  theme: Theme
}

export async function exportToPdf(args: ExportArgs): Promise<string | null> {
  const html = buildExportHtml({
    markdown: args.markdown,
    theme: args.theme,
    title: args.defaultName.replace(/\.pdf$/i, '')
  })
  return ipc.exportPdf({ html, defaultName: args.defaultName })
}
