import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'

function highlight(str: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const out = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      return `<pre class="hljs"><code class="hljs language-${lang}">${out}</code></pre>`
    } catch {
      /* fall through */
    }
  }
  if (!lang) {
    try {
      const auto = hljs.highlightAuto(str)
      if (auto.language) {
        return `<pre class="hljs"><code class="hljs language-${auto.language}">${auto.value}</code></pre>`
      }
    } catch {
      /* fall through */
    }
  }
  const escaped = md.utils.escapeHtml(str)
  return `<pre class="hljs"><code class="hljs">${escaped}</code></pre>`
}

export const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true,
  highlight
})

export function render(source: string): string {
  return md.render(source)
}

export function countWords(source: string): number {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[*_~#>!\[\](){}]/g, ' ')
    .trim()
  if (!text) return 0
  const cjk = text.match(/[一-鿿぀-ヿ가-힯]/g)?.length ?? 0
  const latin = text.replace(/[一-鿿぀-ヿ가-힯]/g, ' ').match(/\b\w+\b/g)?.length ?? 0
  return cjk + latin
}
