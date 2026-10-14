import { app, shell, BrowserWindow, ipcMain, dialog } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import icon from "../../resources/icon.png?asset"
import { cancelPython, runPython } from "./python"
import { validateParams } from "../shared/validate"
import { Params, Result } from "../shared/types"
import { mkdirSync } from "fs"

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

/**
 * Documents/<app name>: where Python saves files the user should be able to find.
 * The app name comes from productName in package.json. Characters Windows doesn"t allow in
 * folder names are replaced, so any product name works. Called on every run, so a folder
 * the user deleted is recreated.
 */
function outputDirectory(): string {
  const folderName = app.name.replace(/[<>:"/\\|?*]/g, "-")
  const dir = join(app.getPath("documents"), folderName)
  mkdirSync(dir, { recursive: true }) // no error if it already exists
  return dir
}
 
function registerIpcHandlers(): void {
  // Native "Open file" dialog, used when the user clicks a drop zone.
  ipcMain.handle("dialog:openFile", async (event, title: string, extensions: string[]): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title,
      properties: ["openFile"],
      filters: extensions.length
        ? [{ name: "Allowed files", extensions }]
        : [{ name: "All files", extensions: ["*"] }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })
 
  // Validate again here, work out where output goes, then hand everything to Python.
  ipcMain.handle("python:run", async (event, params: unknown): Promise<Result> => {
    const errors = validateParams(params)
    if (errors.length > 0) return { ok: false, error: errors.join("\n") }
 
    let outputDir: string
    try {
      outputDir = outputDirectory()
    } catch (err) {
      return { ok: false, error: `Couldn"t create the output folder: ${(err as Error).message}` }
    }
 
    return runPython(params as Params, { outputDir }, (line) => {
      if (!event.sender.isDestroyed()) event.sender.send("python:log", line)
    })
  })
 
  // Stops the run in progress; the pending "python:run" call then resolves as cancelled.
  ipcMain.handle("python:cancel", () => cancelPython())
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron")

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on("ping", () => console.log("pong"))

  registerIpcHandlers()
  createWindow()

  app.on("activate", function () {
    // On macOS it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it"s common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// Closing the app doesn"t stop a child process by itself; without this, a long run would
// keep going invisibly in the background.
app.on("will-quit", () => cancelPython())

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
