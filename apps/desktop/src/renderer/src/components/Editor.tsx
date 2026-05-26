import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap
} from '@codemirror/language'
import { search } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { languageExtension } from '@quill/core/codemirror'
import { getFileType, type FileLanguage } from '@quill/shared-types'
import type { Theme } from '../types'
import { usePrefs } from '../state/prefs'

type Props = {
  value: string
  onChange: (next: string) => void
  theme: Theme
  /** Used to pick the syntax highlighter. When absent the editor falls back
   *  to markdown — preserves the legacy behaviour for callers that haven't
   *  threaded the path through yet. */
  filePath?: string
  onViewChange?: (view: EditorView | null) => void
}

function langOf(filePath: string | undefined): FileLanguage | null {
  return filePath ? getFileType(filePath).language : 'markdown'
}

export function Editor({ value, onChange, theme, filePath, onViewChange }: Props) {
  const { prefs } = usePrefs()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onViewChangeRef = useRef(onViewChange)
  const filePathRef = useRef(filePath)
  // Persist a single Compartment across renders so `reconfigure` can swap
  // the language extension without rebuilding the whole EditorState.
  const langCompartmentRef = useRef<Compartment>(new Compartment())
  onChangeRef.current = onChange
  onViewChangeRef.current = onViewChange
  filePathRef.current = filePath

  // Rebuild on theme OR showLineNumbers change — both affect the extension
  // list and CM6 needs a fresh state.create. Font size lives on a CSS var
  // (see index.css .cm-editor), so it reflows without a rebuild. filePath
  // is intentionally NOT a dep — language swaps go through reconfigure
  // below to preserve undo history and cursor position.
  useEffect(() => {
    if (!hostRef.current) return
    const langCompartment = langCompartmentRef.current
    const initialLang = langOf(filePathRef.current)

    const extensions = [
      history(),
      ...(prefs.showLineNumbers ? [lineNumbers()] : []),
      // foldGutter sits next to lineNumbers when both are on; with line
      // numbers off it floats alone on the left. CM6 reads fold ranges
      // from each language pack's syntax tree, so no per-language wiring
      // needed — plain-text files just show no fold markers.
      foldGutter(),
      highlightActiveLine(),
      // Search state + match decorations. Driven by our own React panel; we
      // never call `openSearchPanel`, so CM6's built-in panel never shows up.
      search(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab
      ]),
      langCompartment.of(languageExtension(initialLang)),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current(u.state.doc.toString())
      }),
      ...(theme === 'dark' ? [oneDark] : [])
    ]

    const state = EditorState.create({ doc: value, extensions })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    onViewChangeRef.current?.(view)
    return () => {
      onViewChangeRef.current?.(null)
      view.destroy()
      viewRef.current = null
    }
    // value sync handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, prefs.showLineNumbers])

  // Swap the syntax highlighter when the open file changes.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: langCompartmentRef.current.reconfigure(
        languageExtension(langOf(filePath))
      )
    })
  }, [filePath])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value }
      })
    }
  }, [value])

  return <div ref={hostRef} className="h-full w-full" />
}
