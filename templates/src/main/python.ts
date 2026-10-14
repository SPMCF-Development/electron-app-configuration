import { spawn } from "child_process"
import type { ChildProcess } from "child_process"
import { existsSync } from "fs"
import { dirname, join } from "path"
import { app } from "electron"
import type { RunContext, Params, Result } from "../shared/types"

/** In development: <project>/python, holding bridge.py and your script. */
function devPythonDir(): string {
  return join(app.getAppPath(), "python")
}

/** In a packaged app: the PyInstaller-built engine that electron-builder copied in to
 * resources/python/bridge (see extraResources in electron-builder.yml)*
 */
function bundledEngine(): string {
  const exe = process.platform === "win32" ? "bridge.exe" : "bridge"
  return join(process.resourcesPath, "python", "bridge", exe)
}

/**
 * Which Python to use in development, in order of preference:
 *  1. PYTHON_EXECUTABLE environment variable
 *  2. python/.venv inside the project (a real venv or a symlink to yours)
 *  3. python3 on PATH
 */
function devPythonExecutable(): string {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE

  const venvPython =
    process.platform === "win32"
      ? join(devPythonDir(), ".venv", "Scripts", "python.exe")
      : join(devPythonDir(), ".venv", "bin", "python")
  if (existsSync(venvPython)) return venvPython

  return process.platform === "win32" ? "python" : "python3"
}

/** What to launch: the bundled engine when packaged, otherwise venv Python running bridge.py. */
function launchCommand(): { command: string; args: string[]; cwd: string } {
  if (app.isPackaged) {
    const engine = bundledEngine()
    return { command: engine, args: [], cwd: dirname(engine) }
  }
  return {
    command: devPythonExecutable(),
    args: [join(devPythonDir(), "bridge.py")],
    cwd: devPythonDir()
  }
}

/**
 * The run in progress, if any. runPython() sets it and clears it when the process ends,
 * so cancelPython() can reach a process it didn"t start. The app allows one run at a time.
 */
let currentRun: { child: ChildProcess; cancelled: boolean } | null = null

/** Stops the run in progress. Does nothing if no run is in progress. */
export function cancelPython(): void {
  if (!currentRun || currentRun.cancelled) return
  currentRun.cancelled = true
  currentRun.child.kill()
}

/**
 * Runs the Python bridge. Sends {"params": ..., "context": ...}  as JSON on stdin; the result comes back as JSON on stdout.
 * Anything Python writes to stderr (including your script"s print() calls) is streamed to onLog.
 */
export function runPython(
  params: Params,
  context: RunContext,
  onLog: (line: string) => void
): Promise<Result> {
  return new Promise((resolve) => {
    if (currentRun) {
      resolve({ ok: false, error: "A run is already in progress."})
      return
    }
    
    const { command, args, cwd } = launchCommand()

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
      windowsHide: true // don"t flash a console window on Windows
    })
    const run = { child, cancelled: false }
    currentRun = run

    let stdout = ""
    let stderrTail = ""
    let partialLine = ""

    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })

    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-8000)
      partialLine += chunk
      const lines = partialLine.split(/\r?\n/)
      partialLine = lines.pop() ?? ""
      for (const line of lines) if (line.trim()) onLog(line)
    })

    child.on("error", (err) => {
      resolve({
        ok: false,
        error: app.isPackaged
          ? `The Python engine couldn"t start (${err.message}). Try reinstalling the app.`
          : `Couldn"t start Python at "${command}": ${err.message}\n` +
          "Point PYTHON_EXECUTABLE at your venv, or symlink your venv to python/.venv."
      })
    })

    child.on("close", (code) => {
	  if (currentRun === run) currentRun = null
      if (partialLine.trim()) onLog(partialLine)
      
      if (run.cancelled) {
        resolve({ ok: false, error: "Run cancelled.", cancelled: true })
        return
      }
      
      try {
        resolve(JSON.parse(stdout) as Result)
      } catch {
        resolve({
          ok: false,
          error: `Python exited with code ${code} without returning a result.\n\n${stderrTail.trim()}`
        })
      }
    })

    // Ignore EPIPE if Python exits before reading its input.
    child.stdin.on("error", () => {})
    child.stdin.end(JSON.stringify({ params, context }))
  })
}