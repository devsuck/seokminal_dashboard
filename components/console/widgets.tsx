"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApDot } from "@/components/ui/ApPrimitives";
import type { AgentNode } from "@/lib/console-api";

// ── manually-triggered fetch hook (검색창 등 사용자 입력으로 재실행, in-flight 요청 취소) ──
export function useAbortableRun<T, A>(fetcher: (arg: A, signal: AbortSignal) => Promise<T>, initialArg: NoInfer<A>) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback((arg: A) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    fetcher(arg, ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) setData(d); })
      .catch((e) => { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { run(initialArg); return () => abortRef.current?.abort(); }, [run]);
  return { data, err, loading, run };
}

// ── tab bar (URL 쿼리 파라미터 기반 탭 전환) ────────────────────────
export function TabBar<K extends string>({ tabs, active, onSelect }: { tabs: { key: K; label: string }[]; active: K; onSelect: (k: K) => void }) {
  return (
    <div className="flex gap-1 border-b border-ap-line px-5 pt-3 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          className={`px-3 h-9 text-ap-body font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
            active === t.key
              ? "border-ap-brand text-ap-brand bg-ap-brand/10"
              : "border-transparent text-ap-ink-2 hover:text-ap-ink-1"
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

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
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 min-h-12 py-2 px-5 border-b border-ap-line bg-[color-mix(in_srgb,var(--color-ap-bg)_85%,transparent)] backdrop-blur">
      <div className="flex items-baseline gap-2.5 flex-wrap min-w-0">
        {kicker && <span className="text-ap-micro font-semibold tracking-[0.24em] text-ap-brand uppercase">{kicker}</span>}
        <span className="text-ap-title font-semibold tracking-[0.14em] text-ap-ink-1 uppercase">{title}</span>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
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
  pos: "var(--color-ap-up)", neg: "var(--color-ap-down)", warn: "var(--color-ap-caution)", hud: "var(--color-ap-brand)",
  info: "var(--color-ap-note)", mute: "var(--color-ap-ink-3)",
};
export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_MAP[status] ?? "mute";
  const c = TONEHEX[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-ap-body font-semibold tracking-[0.1em] uppercase c-num whitespace-nowrap"
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
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-ap-line last:border-0">
      <span className="text-ap-body text-ap-ink-3">{k}</span>
      <span className={`text-ap-title text-ap-ink-1 text-right truncate ${mono ? "c-num" : ""}`}>{v}</span>
    </div>
  );
}

// ── empty / loading / error ───────────────────────────────────────
export function StateBlock({ loading, err, empty, emptyNote, children }:
  { loading: boolean; err: string | null; empty?: boolean; emptyNote?: string; children: ReactNode }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-ap-ink-3">
      <span className="h-1.5 w-1.5 rounded-full bg-ap-brand animate-pulse" />
      <span className="text-ap-body tracking-wider">로딩 중…</span>
    </div>
  );
  if (err) return (
    <div className="m-5 c-panel p-4 text-ap-title text-ap-down">
      백엔드 연결 실패: {err} · <span className="text-ap-ink-3">api_server(:8000) 기동 확인</span>
    </div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ApDot tone="mute" />
      <div className="mt-3 text-ap-title text-ap-ink-2">데이터 없음</div>
      {emptyNote && <div className="mt-1 text-ap-body text-ap-ink-3 max-w-md">{emptyNote}</div>}
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
          <tr className="border-b border-ap-line">
            {cols.map((c) => (
              <th key={c.key} className={`text-ap-micro font-semibold tracking-[0.16em] text-ap-ink-3 uppercase px-3 py-2 ${c.align === "r" ? "text-right" : "text-left"}`} style={{ width: c.w }}>
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
              className={`border-b border-ap-line transition-colors ${onRow ? "cursor-pointer hover:bg-ap-bg" : ""}`}
            >
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-ap-title text-ap-ink-2 ${c.align === "r" ? "text-right c-num" : ""}`}>
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
export function AgentTree({
  node, depth = 0, tone = "console",
}: { node: AgentNode; depth?: number; tone?: "console" | "ap" }) {
  const statusTone = STATUS_MAP[node.status] ?? "mute";
  const c = TONEHEX[statusTone];
  const isRoot = depth === 0;
  const [expanded, setExpanded] = useState(tone !== "ap" || depth === 0);
  const borderCls = tone === "ap" ? "border-ap-line" : "border-ap-line";
  const connectorCls = tone === "ap" ? "before:bg-ap-line" : "before:bg-ap-line";
  const roleCls = tone === "ap" ? "text-ap-brand" : "text-ap-brand";
  const nameCls = tone === "ap" ? "text-ap-ink-1" : "text-ap-ink-1";
  const detailCls = tone === "ap" ? "text-ap-ink-3" : "text-ap-ink-3";
  const toggleCls = tone === "ap" ? "text-ap-brand" : "text-ap-brand";
  const hasChildren = !!node.children && node.children.length > 0;
  return (
    <div className={depth > 0 ? `pl-5 border-l ${borderCls} ml-3` : ""}>
      <div className={`relative flex items-start gap-3 py-2 ${isRoot ? "" : `before:content-[''] before:absolute before:left-[-20px] before:top-[18px] before:w-4 before:h-px ${connectorCls}`}`}>
        <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {node.role && <span className={`text-ap-micro font-semibold tracking-[0.18em] uppercase ${roleCls}`}>{node.role}</span>}
            <span className={`text-ap-title font-medium ${nameCls}`}>{node.name}</span>
            <StatusPill status={node.status} />
          </div>
          {node.detail && <div className={`text-ap-body c-num mt-0.5 ${detailCls}`}>{node.detail}</div>}
          {hasChildren && depth === 1 && !expanded && (
            <button onClick={() => setExpanded(true)}
              className={`mt-1 text-ap-body border-0 bg-transparent cursor-pointer ${toggleCls}`}>
              하위 {node.children!.length}개 보기 ›
            </button>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {node.children!.map((ch) => <AgentTree key={ch.id} node={ch} depth={depth + 1} tone={tone} />)}
        </div>
      )}
    </div>
  );
}

