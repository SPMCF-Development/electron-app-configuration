import React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"

import { makeRow, type Column, type Row } from "@/components/tableTypes"

interface Props {
  columns: Column[]
  rows: Row[]
  onChange: (rows: Row[]) => void
  addLabel: string
  minRows?: number
}

export default function EditableTable({
  columns,
  rows,
  onChange,
  addLabel,
  minRows = 1
}: Props): React.JSX.Element {
  const update = (id: string, key: string, value: string | boolean): void =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)))

  const remove = (id: string): void => onChange(rows.filter((r) => r.id !== id))

  const add = (): void => onChange([...rows, makeRow(columns)])

  function renderCell(row: Row, col: Column, rowNumber: number): React.JSX.Element {
    const aria = `${col.label}, row ${rowNumber}`
    const value = row[col.key]
    const set = (v: string | boolean): void => update(row.id, col.key, v)

    switch (col.type) {
      case "boolean":
        return (
          <Checkbox
            aria-label={aria}
            checked={value === true}
            onCheckedChange={(checked) => set(checked === true)}
          />
        )
      case "date":
        return (
          <Input
            type="date"
            aria-label={aria}
            value={String(value)}
            onChange={(e) => set(e.target.value)}
          />
        )
      case "currency":
        return (
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            >
              $
            </span>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              aria-label={aria}
              className="pl-7"
              value={String(value)}
              onChange={(e) => set(e.target.value)}
            />
          </div>
        )
      default:
        return (
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            aria-label={aria}
            value={String(value)}
            onChange={(e) => set(e.target.value)}
          />
        )
    }
  }

  const atMin = rows.length <= minRows

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-10 text-center">
                #
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  scope="col"
                  className={col.type === "boolean" ? "w-20 text-center" : undefined}
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead scope="col" className="w-12">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row,i) => (
              <TableRow key={row.id}>
                <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={col.type === "boolean" ? "text-center" : undefined}
                  >
                    {renderCell(row, col, i + 1)}
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(row.id)}
                    disabled={atMin}
                    aria-label={`Remove row ${i + 1}`}
                    title={atMin ? `At least ${minRows} row(s) is required` : "Remove row"}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  )
}