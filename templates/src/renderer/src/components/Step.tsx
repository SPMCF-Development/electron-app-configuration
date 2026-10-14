import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from "@/components/ui/card"

interface StepProps {
  n: number
  title: string
  children: React.ReactNode
}
 
/** One numbered section of the form. */
export default function Step({ n, title, children }: StepProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {n}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}