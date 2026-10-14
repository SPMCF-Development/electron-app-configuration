// Types shared by the main process, the preload script, and the React UI.

export const TIMEFRAMES = ["monthly", "daily", "annual"] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

/** [date (YYYY-MM-DD), float, float, float, boolean] */
export type SpendingRow = [
  date: string,
  value1: number,
  value2: number,
  value3: number,
  flag: boolean
]

/** [date (YYYY-MM-DD), dollar amount] */
export type AdditionalRow = [date: string, amount: number]

/** [float] */
export type InflationRow = [value1: number]

/** Exactly what gets sent to Python as JSON. */
export interface Params {
  timeframe: Timeframe
  timesteps: number
  rollingQuarters: number
  numSimulations: number
  marketValueFile: string
  cmaFile: string
  spendingPolicy: SpendingRow[]
  additionalPolicy: AdditionalRow[]
  inflationScenarios: InflationRow[]
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
