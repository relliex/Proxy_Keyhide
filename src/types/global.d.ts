import type { IpcApi, ToastMessage } from '../../electron/shared/types'

interface ExtraApi {
  createPlatform: () => Promise<any>
  createKey: (keyValue: string, label: string) => Promise<any>
  regenerateMaskedKey: () => Promise<any>
  clipboardWrite: (text: string) => Promise<void>
  saveFileDialog: (defaultName: string, content: string) => Promise<{ success: boolean; path: string }>
  openFileDialog: () => Promise<{ success: boolean; content: string }>
}

declare global {
  interface Window {
    api: IpcApi
    extraApi: ExtraApi
  }
}

export {}
