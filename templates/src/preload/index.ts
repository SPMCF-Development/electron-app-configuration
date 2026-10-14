import { contextBridge, ipcRenderer, webUtils } from "electron"
import type { IpcRendererEvent } from "electron"
import type { Api } from "../shared/types"
import { electronAPI } from "@electron-toolkit/preload"

// Custom APIs for renderer
const api: Api = {
  getPathForFile: (file) => webUtils.getPathForFile(file),

  openFileDialog: (title: string, extensions: string[]) => ipcRenderer.invoke("dialog:openFile", title, extensions),

  runPythonScript: (params) => ipcRenderer.invoke("python:run", params),
  
  cancelPythonScript: () =>ipcRenderer.invoke("python:cancel"),

  onPythonLog: (callback) => {
    const listener = (_event: IpcRendererEvent, line: string): void => callback(line)
    ipcRenderer.on("python:log", listener)
    return () => {
      ipcRenderer.removeListener("python:log", listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
