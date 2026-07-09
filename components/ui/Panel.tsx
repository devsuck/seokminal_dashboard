import type { ReactNode } from "react";

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-accent px-2 py-1">
      <span className="text-black text-[10px] font-bold uppercase tracking-wider">{children}</span>
      {right && <span className="text-black text-[10px] font-data">{right}</span>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border border-border bg-panel overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
