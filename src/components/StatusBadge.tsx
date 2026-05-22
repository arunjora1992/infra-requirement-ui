import { cn } from "@/lib/utils";

const dot: Record<string, string> = {
  DRAFT: "bg-muted",
  SUBMITTED: "bg-accent",
  IN_REVIEW: "bg-accent-2",
  APPROVED: "bg-success",
  REJECTED: "bg-danger",
  PROVISIONED: "bg-success",
  EXPIRED: "bg-warning",
  SHUTDOWN: "bg-danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("chip", `status-${status}`)}>
      <span className={cn("chip-dot", dot[status] ?? "bg-muted")} />
      {status}
    </span>
  );
}
