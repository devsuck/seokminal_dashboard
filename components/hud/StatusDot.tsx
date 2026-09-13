export type Tone = "pos" | "accent" | "info" | "neg" | "warn" | "text-3";
export const TONE: Record<Tone, { solid: string; text: string }> = {
  pos:      { solid: "bg-ap-up",    text: "text-ap-up" },
  accent:   { solid: "bg-ap-brand", text: "text-ap-brand" },
  info:     { solid: "bg-ap-note",   text: "text-ap-note" },
  neg:      { solid: "bg-ap-down",    text: "text-ap-down" },
  warn:     { solid: "bg-ap-caution",   text: "text-ap-caution" },
  "text-3": { solid: "bg-ap-ink-3", text: "text-ap-ink-3" },
};

export function StatusDot({ tone, label, size = "sm" }: { tone: Tone; label?: string; size?: "sm" | "md" }) {
  const c = TONE[tone];
  const dot = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  const text = size === "md" ? "text-sm font-ui" : "text-[11px] font-data";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${dot} rounded-full inline-block shrink-0 ${c.solid}`} />
      {label && <span className={`${text} ${c.text}`}>{label}</span>}
    </span>
  );
}
