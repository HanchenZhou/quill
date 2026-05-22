import type { FileNode } from '@quill/shared-types'
import type { VaultProvider } from '@quill/vault-adapter'

export type UploadItem = {
  file: File
  /** Destination path under the vault root, no leading slash. */
  destPath: string
}

export type UploadResult = {
  destPath: string
  ok: boolean
  error?: string
}

const MD_EXT = /\.(md|markdown|mdown|mkd)$/i

function joinPath(dir: string, name: string): string {
  const d = dir.replace(/^\/+/, '').replace(/\/+$/, '')
  return d ? `${d}/${name}` : name
}

/** Sniff out files that already exist in the destination directory by
 *  comparing names. The caller uses this to drive a confirm dialog before
 *  the actual PUTs go out. Returns the *items* (not just names) that
 *  collide, so the caller can build skip/overwrite subsets directly. */
export async function detectCollisions(
  vault: VaultProvider,
  destDir: string,
  files: File[]
): Promise<UploadItem[]> {
  let existing: FileNode[] = []
  try {
    existing = await vault.list(destDir)
  } catch {
    // Empty dir / not-yet-created — no collisions possible.
    existing = []
  }
  const existingNames = new Set(existing.filter((e) => !e.isDirectory).map((e) => e.name))
  return files
    .filter((f) => existingNames.has(f.name))
    .map((f) => ({ file: f, destPath: joinPath(destDir, f.name) }))
}

/** Build the upload plan: each file → its target path under destDir. */
export function planUpload(destDir: string, files: File[]): UploadItem[] {
  return files.map((file) => ({ file, destPath: joinPath(destDir, file.name) }))
}

export function isMarkdownFile(file: File): boolean {
  return MD_EXT.test(file.name)
}

async function readAsText(file: File): Promise<string> {
  // Prefer the Blob.text() API (universally supported in evergreens we
  // target). Falls back to FileReader for paranoid cases.
  if (typeof file.text === 'function') {
    return file.text()
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('file read failed'))
    r.readAsText(file)
  })
}

/** Upload each item sequentially. Returns one result per item with the
 *  outcome so the caller can show "ok 3 / fail 1" to the user. Sequential
 *  (not parallel) so the server's single-user fs doesn't see a thundering
 *  herd, and so onProgress fires in deterministic order. */
export async function uploadFiles(
  vault: VaultProvider,
  items: UploadItem[],
  onProgress?: (done: number, total: number, current: UploadItem) => void
): Promise<UploadResult[]> {
  const out: UploadResult[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    onProgress?.(i, items.length, item)
    try {
      const content = await readAsText(item.file)
      await vault.write(item.destPath, content)
      out.push({ destPath: item.destPath, ok: true })
    } catch (err) {
      out.push({
        destPath: item.destPath,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
  onProgress?.(items.length, items.length, items[items.length - 1])
  return out
}
