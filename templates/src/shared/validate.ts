import type { Params } from "./types"

// Import custom types and variables from ./types
import { CUSTOM_VAR1 } from "./types"
import type { Type1 } from "./types"

// Define standard checks for different variables
// If more are needed, follow the formatting here
// Do NOT provide a check for file paths as this is automatically handled by FileDropZone
const isPositiveInt = (v: unknown): boolean => typeof v === "number" && Number.isInteger(v) && v > 0

const isFiniteNumber = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v)

/** True for a real calendar date in YYYY-MM-DD form (rejects things like 2024-02-30 [false date]). */
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

  // Check provided input from button group against the custom variable
  if (!CUSTOM_VAR12.includes(p.var1 as Type1)) {
    errors.push("Error message for button group options.")
  }

  // Check positive integer values are actually positive integers
  if (!isPositiveInt(p.num1_val)) {
    errors.push("Numerical value 1 must be a whole number greater than 0.")
  }
  if (!isPositiveInt(p.num2_val)) {
    errors.push("Numerical value 2 must be a whole number greater than 0.")
  }

  // Check the tables are functioning as expected and returning arrays of arrays and has at least one row
  // Also checks the types of the values in the arrays
  // Requires entering the proper length of the rows in `row.length !== ...`
  // This sample code uses the actual length for the dummy rows
  if (!Array.isArray(p.table1) || p.table1.length === 0) {
    errors.push("Table 1 needs at least one row.")
  } else {
    p.table1.forEach((row, i) => {
      const n = i + 1
      if (!Array.isArray(row) || row.length !== 4) {
        errors.push(`Spending policy row ${n} is malformed.`)
        return
      }
      const [date, a, b, flag] = row
      if (!isIsoDate(date)) errors.push(`Table 1 row ${n}: enter a date.`)
      if (![a, b].every(isFiniteNumber))
        errors.push(`Table 1 row ${n}: fill in all numbers.`)
      if (typeof flag !== "boolean")
        errors.push(`Table 1 row ${n}: the checkbox value is invalid.`)
    })
  }

  if (!Array.isArray(p.table2) || p.table2.length === 0) {
    errors.push("Table 2 needs at least one row.")
  } else {
    p.table2.forEach((row, i) => {
      const n = i + 1
      if (!Array.isArray(row) || row.length !== 1) {
        errors.push(`Table 2 row ${n} is malformed.`)
        return
      }
      const [a] = row
      if (!isFiniteNumber(a)) errors.push(`Table 2 row ${n}: enter an amount.`)
    })
  }

  return errors
}