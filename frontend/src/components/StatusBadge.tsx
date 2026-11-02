import { Badge } from "@/components/ui/badge"
import type { Status } from "@/types"

const VARIANTS = {
  interested: "outline",
  applied: "secondary",
  interview: "default",
  offer: "default",
  rejected: "destructive",
} as const

interface StatusBadgeProps {
  status: Status
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={VARIANTS[status]} className="capitalize">
      {status}
    </Badge>
  )
}
