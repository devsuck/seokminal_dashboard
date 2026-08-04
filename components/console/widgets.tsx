"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Panel, Dot } from "@/components/console/primitives";
import type { AgentNode } from "@/lib/console-api";

// ── generic fetch hook (옵션: pollMs 마다 조용히 자동 새로고침) ────
export function useConsole<T>(fn: (s: AbortSignal) => Promise<T>, deps: unknown[] = [], pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    let first = tick === 0;
    if (first) setLoading(true);
    fn(ac.signal)
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => { if ((e as Error).name !== "AbortError") setErr((e as Error).message); })
      .finally(() => setLoading(false));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => setTick((t) => t + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);
  return { data, err, loading };
}

// ── page header ───────────────────────────────────────────────────
export function PageHeader({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 h-12 px-5 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-bg)_85%,transparent)] backdrop-blur">
      <div className="flex items-baseline gap-2.5">
        {kicker && <span className="text-[9px] font-semibold tracking-[0.24em] text-[var(--c-hud)] uppercase">{kicker}</span>}
        <span className="text-[13px] font-semibold tracking-[0.14em] text-[var(--c-text-1)] uppercase">{title}</span>
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}

// ── status pill ───────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  live: "pos", micro_live: "pos", constrained_live: "pos", paper_active: "hud", live_candidate: "hud",
  candidate: "hud", watchlist: "info", draft: "mute", analysis: "info",
  rejected: "neg", blocked_by_data: "warn", underpowered: "warn", weak: "warn", no_effect: "mute",
  active: "pos", "dry-run": "hud", gated: "warn", closed: "warn", disabled: "warn",
  PASS: "pos", MATCHED: "pos", WARNING: "warn", FAILED: "neg", BLOCK: "warn", ALLOW: "pos",
  CLEARED: "pos", CLOSED: "warn", READY: "pos", BLOCKED: "warn",
};
const TONEHEX: Record<string, string> = {
  pos: "var(--c-pos)", neg: "var(--c-neg)", warn: "var(--c-warn)", hud: "var(--c-hud)",
  info: "var(--c-info)", mute: "var(--c-text-3)",
};
export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_MAP[status] ?? "mute";
  const c = TONEHEX[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.1em] uppercase c-num whitespace-nowrap"
      style={{ color: c, border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: c }} />
      {status}
    </span>
  );
}

// ── key-value row ─────────────────────────────────────────────────
export function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--c-border)] last:border-0">
      <span className="text-[11px] text-[var(--c-text-3)]">{k}</span>
      <span className={`text-[11.5px] text-[var(--c-text-1)] text-right truncate ${mono ? "c-num" : ""}`}>{v}</span>
    </div>
  );
}

// ── empty / loading / error ───────────────────────────────────────
export function StateBlock({ loading, err, empty, emptyNote, children }:
  { loading: boolean; err: string | null; empty?: boolean; emptyNote?: string; children: ReactNode }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-[var(--c-text-3)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)] animate-pulse" />
      <span className="text-[11px] tracking-wider">로딩 중…</span>
    </div>
  );
  if (err) return (
    <div className="m-5 c-panel p-4 text-[12px] text-[var(--c-neg)]">
      백엔드 연결 실패: {err} · <span className="text-[var(--c-text-3)]">api_server(:8000) 기동 확인</span>
    </div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Dot tone="mute" />
      <div className="mt-3 text-[12px] text-[var(--c-text-2)]">데이터 없음</div>
      {emptyNote && <div className="mt-1 text-[10.5px] text-[var(--c-text-3)] max-w-md">{emptyNote}</div>}
    </div>
  );
  return <>{children}</>;
}

// ── data table ────────────────────────────────────────────────────
export function DataTable<T>({ cols, rows, keyFn, onRow }:
  { cols: { key: string; label: string; render?: (r: T) => ReactNode; w?: string; align?: "l" | "r" }[];
    rows: T[]; keyFn: (r: T, i: number) => string; onRow?: (r: T) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--c-border)]">
            {cols.map((c) => (
              <th key={c.key} className={`text-[9px] font-semibold tracking-[0.16em] text-[var(--c-text-3)] uppercase px-3 py-2 ${c.align === "r" ? "text-right" : "text-left"}`} style={{ width: c.w }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={keyFn(r, i)}
              onClick={onRow ? () => onRow(r) : undefined}
              className={`border-b border-[var(--c-border)] transition-colors ${onRow ? "cursor-pointer hover:bg-[var(--c-panel-2)]" : ""}`}
            >
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-[11.5px] text-[var(--c-text-2)] ${c.align === "r" ? "text-right c-num" : ""}`}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── AI Council org tree (재귀) ────────────────────────────────────
export function AgentTree({ node, depth = 0 }: { node: AgentNode; depth?: number }) {
  const tone = STATUS_MAP[node.status] ?? "mute";
  const c = TONEHEX[tone];
  const isRoot = depth === 0;
  return (
    <div className={depth > 0 ? "pl-5 border-l border-[var(--c-border)] ml-3" : ""}>
      <div className={`relative flex items-start gap-3 py-2 ${isRoot ? "" : "before:content-[''] before:absolute before:left-[-20px] before:top-[18px] before:w-4 before:h-px before:bg-[var(--c-border)]"}`}>
        <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {node.role && <span className="text-[9px] font-semibold tracking-[0.18em] text-[var(--c-hud)] uppercase">{node.role}</span>}
            <span className={`${isRoot ? "text-[14px]" : "text-[12.5px]"} font-medium text-[var(--c-text-1)]`}>{node.name}</span>
            <StatusPill status={node.status} />
          </div>
          {node.detail && <div className="text-[10.5px] c-num text-[var(--c-text-3)] mt-0.5">{node.detail}</div>}
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="mt-0.5">
          {node.children.map((ch) => <AgentTree key={ch.id} node={ch} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export { Panel };
