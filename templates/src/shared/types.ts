// Types shared by the main process, the preload script, and the React UI.

// Define custom variables if you need a list of options, for example with a button group
// Type1 results in the type `option1 | option2 | ...` for use in `App.tsx`
export const CUSTOM_VAR1 = ["option1", "option2", ...] as const
export type Type1 = (typeof CUSTOM_VAR1)[number]

// Define the required type of elements in table columns
// Dates must be formatted as YYYY-MM-DD
export type Table1Row = [
  date: string,
  value1: number,
  value2: number,
  flag: boolean
]

export type Table2Row = [value1: number]

/** Exactly what gets sent to Python as JSON. */
export interface Params {
  var1: Type1
  num1_val: number
  num2_val: number
  file1_path: string
  file2_path: string
  table1: Table1Row[]
  table2: Table2Row[]
}

/**
 * Locations the main process chooses and sends to Python alongside the user"s inputs.
 * Kept separate from SParams: the user never supplies these, so they aren"t validated.
 */
export interface RunContext {
  /** Writable folder for files the user should be able to find: Documents/<app name>. */
  outputDir: string
}

export type Result = { ok: true; result: unknown } | { ok: false; error: string, cancelled?: boolean }

/** The functions the preload script exposes to the UI as `window.api`. */
export interface Api {
  /** Turns a dropped File into its absolute path on disk. */
  getPathForFile(file: File): string
  /** Opens a native file picker filtered to .xlsx/.csv. Resolves to null if cancelled. */
  openFileDialog(title: string, extensions: string[]): Promise<string | null>
  /** Runs the Python script and resolves with its result. */
  runPythonScript(params: Params): Promise<Result>
  /** Stops the running Python script. The pending runPythonScript call then resolves. */
  cancelPythonScript(): Promise<void>
  /** Subscribes to Python"s log output. Returns an unsubscribe function. */
  onPythonLog(callback: (line: string) => void): () => void
}
