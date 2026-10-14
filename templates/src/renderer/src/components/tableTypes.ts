export type ColumnType = "date" | "number" | "currency" | "boolean"

export interface Column {
  key: string
  label: string
  type: ColumnType
}

/** Number fields are kept as strings while editing so a half-typed value like "-" or "" is allowed. */
export type Row = { id: string; [key: string]: string | boolean }

export function makeRow(columns: Column[]): Row {
  const row: Row = { id: crypto.randomUUID() }
  for (const col of columns) row[col.key] = col.type === "boolean" ? false : ""
  return row
}