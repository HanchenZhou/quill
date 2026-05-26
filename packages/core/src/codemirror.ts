/**
 * Shared CodeMirror 6 language selection — one source of truth for both
 * desktop and web editors. `languageExtension(lang)` returns the CM
 * extension for a given FileLanguage, falling back to an empty extension
 * (no highlighting, no syntax tree) for unknown / plain-text files.
 *
 * Lang packs live in this package so adding a new language only touches
 * here + the `FileLanguage` union in @quill/shared-types. Apps still
 * import @codemirror/{state,view,commands,language,search,theme-one-dark}
 * directly to compose the rest of their editor — those are app-level
 * decisions (line numbers, keymaps, theme switching) we don't want to
 * standardise prematurely.
 */
import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { xml } from '@codemirror/lang-xml'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { cpp } from '@codemirror/lang-cpp'
import { sql } from '@codemirror/lang-sql'
import { php } from '@codemirror/lang-php'
import { yaml } from '@codemirror/lang-yaml'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { r } from '@codemirror/legacy-modes/mode/r'
import { diff } from '@codemirror/legacy-modes/mode/diff'
import type { FileLanguage } from '@quill/shared-types'

export function languageExtension(lang: FileLanguage | null): Extension {
  switch (lang) {
    case 'markdown':
      return markdown()
    case 'javascript':
      // Covers js/ts/jsx/tsx — lang-javascript handles all four under flags.
      return javascript({ typescript: true, jsx: true })
    case 'json':
      return json()
    case 'html':
      return html()
    case 'css':
      return css()
    case 'xml':
      return xml()
    case 'python':
      return python()
    case 'java':
      return java()
    case 'go':
      return go()
    case 'rust':
      return rust()
    case 'cpp':
      return cpp()
    case 'sql':
      return sql()
    case 'php':
      return php()
    case 'yaml':
      return yaml()
    case 'shell':
      return StreamLanguage.define(shell)
    case 'ruby':
      return StreamLanguage.define(ruby)
    case 'toml':
      return StreamLanguage.define(toml)
    case 'lua':
      return StreamLanguage.define(lua)
    case 'powershell':
      return StreamLanguage.define(powerShell)
    case 'r':
      return StreamLanguage.define(r)
    case 'diff':
      return StreamLanguage.define(diff)
    default:
      return []
  }
}
