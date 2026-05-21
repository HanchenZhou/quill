import type { QuillApi } from './index'

declare global {
  interface Window {
    quill: QuillApi
  }
}

export {}
