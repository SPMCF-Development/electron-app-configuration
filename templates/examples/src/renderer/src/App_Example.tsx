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

import { TIMEFRAMES } from "../../shared/types"
import type {
  AdditionalRow,
  Params,
  Result,
  SpendingRow,
  InflationRow,
  Timeframe
} from "../../shared/types"
import { validateParams } from "../../shared/validate"
import FileDropZone from "@/components/FileDropZone"
import EditableTable from "@/components/EditableTable"
import { makeRow, type Column, type Row} from "@/components/tableTypes"
import IntField from "@/components/IntField"
import Step from "@/components/Step"

// Rename these labels to whatever the headers for that value ought to be.
// Only change `label`; the `key`s are used in buildParams() below.
const SPENDING_COLUMNS: Column[] = [
  { key: "date", label: "Policy Start", type: "date" },
  { key: "v1", label: "Base Rate", type: "number" },
  { key: "v2", label: "Floor Rate", type: "number" },
  { key: "v3", label: "Ceiling Rate", type: "number" },
  { key: "flag", label: "Use Floor/Ceiling?", type: "boolean" }
]

const ADDITIONAL_COLUMNS: Column[] = [
  { key: "date", label: "Policy Start", type: "date" },
  { key: "amount", label: "Additional Spend", type: "currency" }
]

const INFLATION_COLUMNS: Column[] = [
  { key: "v1", label: "Inflation Rate", type: "number" }
]

const MAX_LOG_LINES = 500
const MAX_RESULT_CHARS = 200_000

/** Empty strings become NaN so validation catches them. */
const toNumber = (v: string | boolean): number =>
  typeof v === "string" && v.trim() !== "" ? Number(v) : NaN

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function App(): React.JSX.Element {
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly")
  const [timesteps, setTimesteps] = useState("60")
  const [rollingQuarters, setRollingQuarters] = useState("20")
  const [numSimulations, setNumSimulations] = useState("5000")
  const [marketFile, setMarketFile] = useState<string | null>(null)
  const [cmaFile, setCmaFile] = useState<string | null>(null)
  const [spendingRows, setSpendingRows] = useState<Row[]>(() => [makeRow(SPENDING_COLUMNS)])
  const [additionalRows, setAdditionalRows] = useState<Row[]>(() => [makeRow(ADDITIONAL_COLUMNS)])
  const [inflationRows, setInflationRows] = useState<Row[]>(() => [makeRow(INFLATION_COLUMNS)])

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

  function buildParams(): Params {
    return {
      timeframe,
      timesteps: toNumber(timesteps),
      rollingQuarters: toNumber(rollingQuarters),
      numSimulations: toNumber(numSimulations),
      marketValueFile: marketFile ?? "",
      cmaFile: cmaFile ?? "",
      spendingPolicy: spendingRows.map((r): SpendingRow => [
        String(r.date),
        toNumber(r.v1),
        toNumber(r.v2),
        toNumber(r.v3),
        r.flag === true
      ]),
      additionalPolicy: additionalRows.map((r): AdditionalRow => [
        String(r.date),
        toNumber(r.amount)
      ]),
      inflationScenarios: inflationRows.map((r): InflationRow => [
        toNumber(r.v1)
      ])
    }
  }

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
  
  async function handleCancel(): Promise<void> {
    setCancelling(true)
    // handleRun's pending runPythonScript call resolves once Python has stopped.
    await window.api.cancelPythonScript()
  }
  
  const wasCancelled = result !== null && !result.ok && result.cancelled === true

  let resultText = ""
  if (result?.ok) {
    resultText = JSON.stringify(result.result, null, 2) ?? "null"
    if (resultText.length > MAX_RESULT_CHARS) {
      resultText = resultText.slice(0, MAX_RESULT_CHARS) + "\n… (truncated for display)"
    }
  }

  const preClasses = "overflow-auto rounded-md border bg-muted p-3 font-mono text-xs"

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-background p-6 text-foreground">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Monte Carlo Simulation</h1>
        <p className="text-sm text-muted-foreground">Fill in each section, then run the model.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <main className="space-y-6">
          <Step n={1} title="Simulation Settings">
            <div className="space-y-2">
              <Field>
                <FieldLabel id="timeframe-label">Timeframe</FieldLabel>
                <ButtonGroup aria-labelledby="timeframe-label">
                  {TIMEFRAMES.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={timeframe === t ? "default" : "outline"}
                      aria-pressed={timeframe === t}
                      onClick={() => setTimeframe(t)}
                    >
                      {capitalize(t)}
                    </Button>
                  ))}
                </ButtonGroup>
                <FieldDescription>Select timeframe for analysis.</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <IntField
                id="timesteps"
                label="Timesteps"
                value={timesteps}
                onChange={setTimesteps}
              />
              <IntField
                id="rolling"
                label="Quarters in rolling average"
                value={rollingQuarters}
                onChange={setRollingQuarters}
              />
              <IntField
                id="sims"
                label="Number of simulations"
                value={numSimulations}
                onChange={setNumSimulations}
              />
            </div>
          </Step>

          <Step n={2} title="Data Files">
            <div className="grid gap-4 sm:grid-cols-2">
              <FileDropZone
                label="Market value data"
                path={marketFile}
                onChange={setMarketFile}
                extensions={["xlsx"]}
              />
              <FileDropZone
                label="Capital market assumptions"
                path={cmaFile}
                onChange={setCmaFile}
                extensions={["xlsx"]}
              />
            </div>
          </Step>

          <Step n={3} title="Spending Policy">
            <EditableTable
              columns={SPENDING_COLUMNS}
              rows={spendingRows}
              onChange={setSpendingRows}
              addLabel="Add spending row"
            />
          </Step>

          <Step n={4} title="Additional Policy">
            <EditableTable
              columns={ADDITIONAL_COLUMNS}
              rows={additionalRows}
              onChange={setAdditionalRows}
              addLabel="Add additional row"
            />
          </Step>

          <Step n={5} title="Inflation Scnearios">
            <EditableTable
              columns={INFLATION_COLUMNS}
              rows={inflationRows}
              onChange={setInflationRows}
              addLabel="Add inflation row"
            />
          </Step>
        </main>

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