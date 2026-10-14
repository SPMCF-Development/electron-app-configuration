import { useEffect, useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ButtonGroup} from "@/components/ui/button-group"
import {
  Field,
  FieldDescription,
  FieldLabel
} from "@/components/ui/field"

import { validateParams } from "../../shared/validate"
import FileDropZone from "@/components/FileDropZone"
import EditableTable from "@/components/EditableTable"
import { makeRow, type Column, type Row} from "@/components/tableTypes"
import IntField from "@/components/IntField"
import Step from "@/components/Step"
import { Params } from "../../shared/types"

// Import custom types and variables from ../../shared/types
import {
  CUSTOM_VAR1,
  CUSTOM_VAR2,
  ...
} from "../../shared/types"
import type {
  Type1,
  Type2,
  ...,
  Rows1,
  Rows2,
  ...
} from "../../shared/types"

// Define columns for editable tables
// Rename these labels to whatever the headers for that value ought to be in the rendered table
// Only change `label`; the `key`s are used in buildParams() below
const TABLE1_COLUMNS: Column[] = [
  { key: "date", label: "Date Label", type: "date" },
  { key: "v1", label: "Value1 Label", type: "number" },
  { key: "v2", label: "Value2 Label", type: "number" },
  { key: "flag", label: "Checkbox Label", type: "boolean" }
]

const TABLE2_COLUMNS: Column[] = [
  { key: "v1", label: "Value1 Label", type: "number"}
]

// Determine max lines and characters to display in the log column
const MAX_LOG_LINES = 500
const MAX_RESULT_CHARS = 200_000

// Empty strings become NaN so validation catches them
const toNumber = (v: string | boolean): number =>
  typeof v === "string" && v.trim() !== "" ? Number(v) : NaN

// Capitalize the string
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

// Begin main function (must be named `App`)
function App(): React.JSX.Element {
  // Define variables to be used in the code
  // Format is [var_name, function_to_updated_var_name]; traditionally the function name is simply the variable name preceded with `set`
  // E.g., [timeframe, setTimeframe]
  // useState can be formatted either as useState<type_name>(default_value) or useState(default_value)
  // For the latter, useState will infer the type based on what the passed default_value is
  // E.g., useState("") will infer useState<string>("")
  // Note: Variables representing paths to files ought to use useState<string | null>(null)
  // Note: Similarly, rows for tables ought to use useState<Row[]>(() => [makeRow(TABLE#_COLUMNS)])
  // Note: For any fields accepting values, always default to using string as this avoids errant entries by users
  // E.g., "2-" will be processed as 2 despite the typo
  const [var1, setVar1] = useState<Type1>(var1_default)
  const [num1, setNum1] = useState("16")
  const [num2, setNum2] = useState("32")
  const [file1, setFile1] = useState<string | null>(null)
  const [file2, setFile2] = useState<string | null>(null)
  const [table1Rows, setTable1Rows] = useState<Row[]>(() => [makeRow(TABLE1_COLUMNS)])
  const [table2Rows, setTable2Rows] = useState<Row[]>(() => [makeRow(TABLE2_COLUMNS)])

  // Do not edit these variables; these are used by the process and should remain untouched unless absolutely necessary
  const [errors, setErrors] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  // Stream Python"s log lines into the console panel.
  useEffect(() => {
    return window.api.onPythonLog((line) => {
      setLog((prev) => [...prev, line].slice(-MAX_LOG_LINES))
    })
  }, [])

  // Keep the log scrolled to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  // Build the parameters
  function buildParams(): Params {
    return {
      var1,
      num1_val: toNumber(num1),
      num2_val: toNumber(num2),
      file1_path: file1 ?? "",
      file2_patah: file2 ?? "",
      table1: table1Rows.map((r): Row1 => [
        String(r.date),
        toNumber(r.v1),
        toNumber(r.v2),
        r.flag === true
      ]),
      table2: table2Rows.map((r): Row2 => [
        toNumber(r.v1)
      ])
    }
  }

  // Handle the full run
  async function handleRun(): Promise<void> {
    const params = buildParams()
    const problems = validateParams(params)
    setErrors(problems)
    if (problems.length > 0) return

    setRunning(true)
    setLog([])
    setResult(null)
    setElapsed(null)
    const started = performance.now()
    try {
      setResult(await window.api.runPythonScript(params))
    } catch (err) {
      setResult({ ok: false, error: String(err) })
    } finally {
      setElapsed((performance.now() - started) / 1000)
      setRunning(false)
      setCancelling(false)
    }
  }
  
  // Handle the case when the run is cancelled
  async function handleCancel(): Promise<void> {
    setCancelling(true)
    // handleRun's pending runPythonScript call resolves once Python has stopped.
    await window.api.cancelPythonScript()
  }
  
  // Define cancel, result, and preclass variables for use in output
  const wasCancelled = result !== null && !result.ok && result.cancelled === true

  let resultText = ""
  if (result?.ok) {
    resultText = JSON.stringify(result.result, null, 2) ?? "null"
    if (resultText.length > MAX_RESULT_CHARS) {
      resultText = resultText.slice(0, MAX_RESULT_CHARS) + "\n… (truncated for display)"
    }
  }

  const preClasses = "overflow-auto rounded-md border bg-muted p-3 font-mono text-xs"

  // Return the React code, using the necessary shadcn/ui elements
  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-background p-6 text-foreground">
      {/* Build the header for the project*/}
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Name of Tool</h1>
        <p className="text-sm text-muted-foreground">Fill in each section, then run the model.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Build the main column */}
        <main className="space-y-6">
          {/*
          Every step is formatted as
          <Step n={step_num} title="Step Description"
            <div className="...">
              ...
            </div>
            <div className="...">
              ...
            </div>
          </Step>
          Note: Putting <div>...</div> one after another results in them being, ideally, stacked
          Note: Putting mutiple elements inside <div>...</div> results in the elementst being, ideally, set side-by-side
          */}
          <Step n={1} title="First Step">
            <div className="space-y-2">
              {/* This builds a field containing a button group which are horizontally-connected buttons with options where only one can be selected at a time */}
              <Field>
                <FieldLabel id="var1-label">Variable1 Name</FieldLabel>
                <ButtonGroup aria-labelledby="var1-label">
                  {CUSTOM_VAR1.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={var1 === t ? "default" : "outline"}
                      aria-pressed={var1 === t}
                      onClick={() => setVar1(t)}
                    >
                      {capitalize(t)}
                    </Button>
                  ))}
                </ButtonGroup>
                <FieldDescription>Variable 1 Description</FieldDescription>
              </Field>
            </div>
            {/* Side-by-side integer fields which only take integers as inputs */}
            <div className="grid gap-4 sm:grid-cols-3">
              <IntField
                id="num1_id"
                label="num1-label"
                value={num1}
                onChange={setNum1}
              />
              <IntField
                id="num2_id"
                label="num2_label"
                value={num2}
                onChange={setNum2}
              />
            </div>
          </Step>

          {/* File drop zones for inputing files */}
          <Step n={2} title="Second Step">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* FileDropZone takes extensions as an input; this must be a list; if set to [], this assumes all files are accepted */}
              <FileDropZone
                label="file1_label"
                path={file1}
                onChange={setFile1}
                extensions={["xlsx", "csv"]}
              />
              <FileDropZone
                label="file2_label"
                path={file2}
                onChange={setFile2}
                extensions={["docx"]}
              />
            </div>
          </Step>

          {/* Editable tables for inputs */}
          <Step n={3} title="Third Step">
            <EditableTable
              columns={TABLE1_COLUMNS}
              rows={table1Rows}
              onChange={setTable1Rows}
              addLabel="Add table1 row"
            />
          </Step>

          <Step n={4} title="Fourth Step">
            <EditableTable
              columns={TABLE2_COLUMNS}
              rows={table2Rows}
              onChange={setTable2Rows}
              addLabel="Add table2 row"
            />
          </Step>
        </main>

        {/*
        Build the aside column for the console and run buttons
        Do NOT modify this unless absolutely necessary
        */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="flex gap-2">
            <Button type="button" onClick={handleRun} disabled={running}>
              {running && <Loader2 className="size-4 animate-spin" />}
              {running ? 'Running…' : 'Run simulation'}
            </Button>
            {running && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Stopping…' : 'Cancel'}
              </Button>
            )}
          </div>
 
          {elapsed !== null && !running && (
            <p className="text-sm text-muted-foreground">
              {wasCancelled ? 'Run cancelled after' : 'Last run took'} {elapsed.toFixed(1)} s
            </p>
          )}
 
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Fix these before running</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
 
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Python Output</h3>
            <pre
              ref={logRef}
              className={`${preClasses} h-64 whitespace-pre-wrap ${log.length ? '' : 'text-muted-foreground'}`}
            >
              {log.length ? log.join('\n') : 'Anything your script prints will show up here.'}
            </pre>
          </div>
 
          {result && !result.ok && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Run failed</AlertTitle>
              <AlertDescription>
                <pre className="whitespace-pre-wrap font-mono text-xs">{result.error}</pre>
              </AlertDescription>
            </Alert>
          )}
 
          {result?.ok && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Result</h3>
              <pre className={`${preClasses} max-h-96`}>{resultText}</pre>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default App