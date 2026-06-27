export type StatusState = "online" | "error" | "checking";

export function statusColor(state: StatusState): string {
  if (state === "online") return "text-pos";
  if (state === "error") return "text-neg";
  return "text-warn";
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}
