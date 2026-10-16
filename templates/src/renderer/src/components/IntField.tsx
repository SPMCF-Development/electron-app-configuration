import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldLabel
} from "@/components/ui/field"

interface IntFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}

export default function IntField({ id, label, value, onChange }: IntFieldProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          id={id}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className="bg-background"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    </div>
  )
}
