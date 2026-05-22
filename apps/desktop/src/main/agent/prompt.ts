import type { Scope } from './scope'

const MAX_BUFFER_CHARS = 4000
const MAX_SELECTION_CHARS = 1000

/**
 * Pure system prompt builder — declares scope constraints, lists available
 * tools, and injects the user's current editing context as a snapshot.
 * Kept dependency-free so it's directly testable without electron stubs.
 */
export function buildSystemPrompt(
  scope: Scope,
  currentBuffer?: string,
  currentSelection?: string
): string {
  const lines: string[] = []
  lines.push("You are Quill's writing & coding agent.")
  lines.push('')

  if (scope.kind === 'workspace') {
    lines.push('Scope: workspace mode.')
    lines.push(`You may only read files within this folder: ${scope.root}`)
    lines.push(
      'Available tools: read_file, list_dir, search_in_scope, grep. Any tool call ' +
        'with a path outside scope will be rejected by the runtime.'
    )
  } else if (scope.kind === 'single-file') {
    lines.push('Scope: single-file mode.')
    lines.push(`You may only operate on this exact file: ${scope.path}`)
    lines.push(
      'Available tools: read_file (only the file above). list_dir/search/grep ' +
        'will reject sibling paths.'
    )
  } else {
    lines.push('Scope: untitled file (not yet saved to disk).')
    lines.push(
      'No file system access is available. Respond with text only — the user ' +
        "will paste your output into the editor."
    )
  }
  lines.push('')
  lines.push('Respond in the same language as the user. Keep responses focused.')
  lines.push(
    'Investigate via tool calls when needed; do not invent file contents you ' +
      'have not read.'
  )

  if (currentBuffer && currentBuffer.length > 0) {
    const truncated = currentBuffer.length > MAX_BUFFER_CHARS
    const snippet = truncated
      ? currentBuffer.slice(0, MAX_BUFFER_CHARS) + '\n…[truncated]'
      : currentBuffer
    lines.push('')
    lines.push(
      `Currently open file content${truncated ? ' (truncated)' : ''}:\n---\n${snippet}\n---`
    )
  }

  if (currentSelection && currentSelection.length > 0) {
    const sel =
      currentSelection.length > MAX_SELECTION_CHARS
        ? currentSelection.slice(0, MAX_SELECTION_CHARS) + '…'
        : currentSelection
    lines.push('')
    lines.push(`User's selection:\n---\n${sel}\n---`)
  }

  return lines.join('\n')
}
