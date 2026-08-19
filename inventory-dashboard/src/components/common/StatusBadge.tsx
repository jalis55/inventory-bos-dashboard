import { Badge } from "@/components/ui/badge"

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "secondary"}>{active ? "Active" : "Inactive"}</Badge>
}
