import type { ReactNode } from "react";

export function CardHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-ap-surface border-b border-ap-line px-3 py-2">
      <span className="text-ap-ink-1 text-[13px] font-semibold">{children}</span>
      {right && <span className="text-ap-ink-2 text-[11px] font-data">{right}</span>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
