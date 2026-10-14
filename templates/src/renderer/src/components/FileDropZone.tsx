import { useId, useState } from "react"
import type { DragEvent } from "react"
 
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldLabel
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
 
interface Props {
  label: string
  path: string | null
  onChange: (path: string | null) => void
  extensions: string[]
}

// Reformats ".CSV" and "csv" to "csv".
const normalize = (exts: string[]): string[] => exts.map((e) => e.trim().replace(/^\./, "").toLowerCase())

// Formats [".xlsx", ".csv", ".json"] to ".xlsx, .csv, or .json".
const listFormat = new Intl.ListFormat("en", { type: "disjunction"})
 
const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p
 
export default function FileDropZone({ label, path, onChange, extensions = [] }: Props): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelId = useId()

  const exts = normalize(extensions)
  const anyFile = exts.length === 0
  const list = listFormat.format(exts.map((e) => `.${e}`))
 
  function accept(filePath: string): void {
    const lower = filePath.toLowerCase()
    if (!anyFile && !exts.some((e) => lower.endsWith(`.${e}`))) {
      setError(`That file type isn"t supported. Use a file ending ${list}.`)
      return
    }
    setError(null)
    onChange(filePath)
  }
 
  function handleDrop(e: DragEvent<HTMLButtonElement>): void {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const filePath = window.api.getPathForFile(file)
    if (!filePath) {
      setError("Could not read where that file lives. Click the box to browse for it instead.")
      return
    }
    accept(filePath)
  }
 
  async function browse(): Promise<void> {
    const filePath = await window.api.openFileDialog(`Choose ${label.toLowerCase()} file`, exts)
    if (filePath) accept(filePath)
  }
 
  return (
    <div className="space-y-2">
      <Field>
        <FieldLabel id={labelId}>{label}</FieldLabel>
        <Button
          type="button"
          variant="outline"
          aria-describedby={labelId}
          className={cn(
            "h-auto w-full flex-col gap-1 whitespace-normal px-4 py-6 text-center",
            path ? "border-solid" : "border-dashed",
            dragging && "border-primary bg-accent"
          )}
          onClick={browse}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={handleDrop}
        >
          {path ? (
            <>
              <span className="font-medium">{fileName(path)}</span>
              <span className="break-all text-xs font-normal text-muted-foreground">{path}</span>
              <span className="text-xs font-normal text-muted-foreground">
                Drop or click to replace
              </span>
            </>
          ) : (
            <>
              <span className="font-medium">Drop a file here</span>
              <span className="text-xs font-normal text-muted-foreground">
                {anyFile ? "or click to browse for a file" : `or click to browse for ${list}`}
              </span>
            </>
          )}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {path && !error && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => onChange(null)}
          >
            Remove file
          </Button>
        )}
      </Field>
    </div>
  )
}