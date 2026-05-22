import type { FileNode, FileStat } from '@quill/shared-types'

export type VaultProviderKind = 'local' | 'remote' | 'fs-access'

/**
 * Storage backend abstraction for a Quill vault.
 *
 * Today only LocalProvider is implemented. RemoteProvider (HTTP/WebSocket
 * against apps/server) and FileSystemAccessProvider (PC web local mode)
 * are planned — see docs/web-server.md.
 *
 * The current shape covers what the desktop IPC already exposes. Directory
 * create/delete, existence checks, sync status, and resource-URL resolution
 * are intentionally NOT in this interface yet — they'll be added when their
 * consumers (workspace tree edits, remote sync UI) land. Adding them later
 * is non-breaking because nothing depends on their absence.
 */
export interface VaultProvider {
  readonly kind: VaultProviderKind

  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  list(path: string): Promise<FileNode[]>
  stat(path: string): Promise<FileStat>
}
