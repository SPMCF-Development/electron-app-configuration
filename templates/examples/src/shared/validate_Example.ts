import { TIMEFRAMES } from "./types"
import type { Params, Timeframe } from "./types"

const isPositiveInt = (v: unknown): boolean => typeof v === "number" && Number.isInteger(v) && v > 0

const isFiniteNumber = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v)

const isSpreadsheetPath = (v: unknown): boolean =>
  typeof v === "string" && /\.(xlsx|csv)$/i.test(v.trim())

/** True for a real calendar date in YYYY-MM-DD form (rejects things like 2024-02-30). */
const isIsoDate = (v: unknown): boolean => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/**
 * Returns a list of human-readable problems. An empty list means the params are valid.
 * Runs in the UI (for instant feedback) and again in the main process (never trust the renderer).
 */
export function validateParams(input: unknown): string[] {
  if (typeof input !== "object" || input === null) return ["No parameters were provided."]
  const p = input as Partial<Params>
  const errors: string[] = []

  if (!TIMEFRAMES.includes(p.timeframe as Timeframe)) {
    errors.push("Timeframe must be monthly, daily, or annual.")
  }
  if (!isPositiveInt(p.timesteps)) errors.push("Timesteps must be a whole number greater than 0.")
  if (!isPositiveInt(p.rollingQuarters)) {
    errors.push("Quarters in rolling average must be a whole number greater than 0.")
  }
  if (!isPositiveInt(p.numSimulations)) {
    errors.push("Number of simulations must be a whole number greater than 0.")
  }
  if (!isSpreadsheetPath(p.marketValueFile)) errors.push("Add a market value file (.xlsx or .csv).")
  if (!isSpreadsheetPath(p.cmaFile))
    errors.push("Add a capital market assumptions file (.xlsx or .csv).")

  if (!Array.isArray(p.spendingPolicy) || p.spendingPolicy.length === 0) {
    errors.push("Spending policy needs at least one row.")
  } else {
    p.spendingPolicy.forEach((row, i) => {
      const n = i + 1
      if (!Array.isArray(row) || row.length !== 5) {
        errors.push(`Spending policy row ${n} is malformed.`)
        return
      }
      const [date, a, b, c, flag] = row
      if (!isIsoDate(date)) errors.push(`Spending policy row ${n}: enter a date.`)
      if (![a, b, c].every(isFiniteNumber))
        errors.push(`Spending policy row ${n}: fill in all three numbers.`)
      if (typeof flag !== "boolean")
        errors.push(`Spending policy row ${n}: the checkbox value is invalid.`)
    })
  }

  if (!Array.isArray(p.additionalPolicy) || p.additionalPolicy.length === 0) {
    errors.push("Additional policy needs at least one row.")
  } else {
    p.additionalPolicy.forEach((row, i) => {
      const n = i + 1
      if (!Array.isArray(row) || row.length !== 2) {
        errors.push(`Additional policy row ${n} is malformed.`)
        return
      }
      const [date, amount] = row
      if (!isIsoDate(date)) errors.push(`Additional policy row ${n}: enter a date.`)
      if (!isFiniteNumber(amount)) errors.push(`Additional policy row ${n}: enter a dollar amount.`)
    })
  }

  if (!Array.isArray(p.inflationScenarios) || p.inflationScenarios.length === 0) {
    errors.push("Inflation scenarios needs at least one row.")
  } else {
    p.inflationScenarios.forEach((row, i) => {
      const n = i + 1
      if (!Array.isArray(row) || row.length !== 1) {
        errors.push(`Inflation scenarios row ${n} is malformed.`)
        return
      }
      const [a] = row
      if (!isFiniteNumber(a)) errors.push(`Inflation scenarios row ${n}: enter a number.`)
    })
  }

  return errors
}