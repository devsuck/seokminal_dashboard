"use client";

import { useEffect, useRef, useState } from "react";
import {
  getLabState, setLabAutopilot, getJarvisStatus, getJarvisDetail, getScanner,
  type LabState, type LabVerdict, type LabHypothesis, type LabLogLine, type JarvisStatus,
  type JarvisDetail, type JarvisAuditRow, type ScannerResult, type ScannerFamily,
} from "@/lib/api";
import { LivePulse, ThinkingLine } from "@/components/Jarvis";
import AutoResearchPanel from "@/components/AutoResearchPanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui";

// ── 진행바 폭: style={{}} 금지 → 리터럴 Tailwind 폭 클래스 룩업(10% 스텝) ──
const WIDTHS = [
  "w-[0%]", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]",
  "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-[100%]",
] as const;
function widthClass(pct: number): string {
  return WIDTHS[Math.max(0, Math.min(10, Math.round(pct / 10)))];
}

const STAGES: { key: string; label: string; sub: string }[] = [
  { key: "think", label: "자체생각", sub: "THINK" },
  { key: "review", label: "검토", sub: "REVIEW" },
  { key: "execute", label: "집행", sub: "EXECUTE" },
  { key: "learn", label: "학습", sub: "LEARN" },
];

function verdictStyle(s: string): string {
  if (s === "pending_bh") return "border-ap-note/40 text-ap-note bg-ap-note/10";
  if (s.startsWith("watchlist") || s.startsWith("candidate") || s.startsWith("paper")) return "border-ap-up/40 text-ap-up bg-ap-up/10";
  if (s.startsWith("blocked")) return "border-ap-caution/40 text-ap-caution bg-ap-caution/10";
  if (s.startsWith("weak") || s.startsWith("underpowered")) return "border-ap-note/40 text-ap-note bg-ap-note/10";
  return "border-ap-down/30 text-ap-down bg-ap-down/5";
}

function modeBadge(mode: string): { label: string; cls: string } {
  if (mode === "synthetic_demo") return { label: "합성 데모", cls: "border-ap-note/40 text-ap-note" };
  if (mode === "real_event") return { label: "실 KRX 검증", cls: "border-ap-up/40 text-ap-up" };
  if (mode === "blocked") return { label: "데이터 게이트", cls: "border-ap-caution/40 text-ap-caution" };
  return { label: "실검증", cls: "border-ap-up/40 text-ap-up" };
}

function logColor(level: string): string {
  switch (level) {
    case "accent": return "text-ap-brand";
    case "pos": return "text-ap-up";
    case "neg": return "text-ap-down";
    case "warn": return "text-ap-caution";
    case "muted": return "text-ap-ink-3";
    default: return "text-ap-ink-2";
  }
}

function fmt(n: number | null | undefined, d = 1): string {
  return typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : "—";
}

export default function LabTab() {
  const [st, setSt] = useState<LabState | null>(null);
  const [jarvis, setJarvis] = useState<JarvisStatus | null>(null);
  const [jdetail, setJdetail] = useState<JarvisDetail | null>(null);
  const [scan, setScan] = useState<ScannerResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function tick() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const s = await getLabState(ctrl.signal);
        if (mounted && !ctrl.signal.aborted) { setSt(s); setErr(null); }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (mounted) setErr(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    const iv = setInterval(tick, 700);
    // Jarvis 거버넌스 상태/상세 — 느리게 갱신(5초)
    const loadJarvis = () => {
      getJarvisStatus().then(j => { if (mounted) setJarvis(j); }).catch(() => { /* noop */ });
      getJarvisDetail().then(d => { if (mounted) setJdetail(d); }).catch(() => { /* noop */ });
    };
    loadJarvis();
    const jiv = setInterval(loadJarvis, 5000);
    // 스캐너 실 발굴 결과 — family 완료 느리니 20초 폴링
    const loadScan = () => getScanner().then(s => { if (mounted) setScan(s); }).catch(() => { /* noop */ });
    loadScan();
    const siv = setInterval(loadScan, 20000);
    return () => { mounted = false; clearInterval(iv); clearInterval(jiv); clearInterval(siv); abortRef.current?.abort(); };
  }, []);

  // 로그 자동 스크롤
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [st?.log?.length]);

  const busy = st?.busy ?? false;
  const status = st?.status ?? "idle";

  async function onToggleAuto() { try { await setLabAutopilot(!(st?.autopilot ?? false)); } catch { /* noop */ } }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header — 상태 + 컨트롤 컴팩트 스트립 (수치는 우측 StatsRow가 담당) */}
      <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-hud/20 bg-ap-surface px-4 py-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-ap-ink-1 tracking-[0.15em] uppercase">AI LAB</h1>
            <LivePulse tone={busy ? "accent" : (st?.autopilot ? "pos" : "text-3")} label={status.toUpperCase()} />
          </div>
          <div className="mt-0.5 h-4 font-data text-[11px] text-ap-ink-2">
            {busy ? <ThinkingLine text="가설 검토 중 · 검정 · 레드팀 실행" />
                  : `자율 리서치 루프 · 자체생각→검토→집행→학습 · 스테이지 ${st?.stage ?? "—"}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleAuto}
            className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors cursor-pointer ${
              st?.autopilot ? "border-ap-up/50 text-ap-up bg-ap-up/10" : "border-ap-line text-ap-ink-2 hover:text-ap-ink-1 bg-transparent"}`}>
            {st?.autopilot ? "⏸ 오토파일럿 ON" : " 오토파일럿"}
          </button>
        </div>
      </div>

      {/* Jarvis 거버넌스 스트립 */}
      {jarvis && (
        <Card>
          <CardHeader>Jarvis Quant OS</CardHeader>
          <div className="flex items-center gap-3 flex-wrap text-xs px-3 py-2">
            <span className="text-ap-ink-2">레벨 {jarvis.autonomy_level} <span className="text-ap-ink-3">{jarvis.autonomy_name}</span></span>
            <span className="text-ap-ink-3">·</span>
            <span className="text-ap-up">리서치 {jarvis.research_automation}</span>
            <span className="text-ap-up">페이퍼 {jarvis.paper_monitoring}</span>
            <span className={jarvis.live_execution === "disabled" ? "text-ap-caution" : "text-ap-down"}>
              라이브 {jarvis.live_execution}
            </span>
            <span className="text-ap-ink-3">·</span>
            <span className="text-ap-ink-2 font-data">레지스트리 {jarvis.registry_total}</span>
            <span className="text-ap-ink-3">·</span>
            <span className="text-ap-note">리스크 거버너 {jarvis.risk_governor}</span>
          </div>
        </Card>
      )}

      {!st && !err && <LoadingState message="LAB 상태 로딩 중…" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />}

      {/* Guardrail */}
      <Card>
        <CardHeader>가드레일</CardHeader>
        <div className="text-xs px-3 py-2">
          <span className="text-ap-ink-2">
            live 매매 자동 실행 없음 (guard: <span className="text-ap-caution font-data">{st?.live_guard ?? "disarmed"}</span>).
            집행은 판정·기록까지만. paper→live는 사람 승인.
          </span>
        </div>
      </Card>

      {err && <div className="text-xs text-ap-down border border-ap-down/30 rounded px-3 py-2">연결 오류: {err}</div>}

      {/* Stage flow */}
      <Card className="p-4">
        <div className="flex items-stretch gap-2 overflow-x-auto">
          {STAGES.map((sg, i) => {
            const active = st?.stage === sg.key;
            const done = st && STAGES.findIndex(x => x.key === st.stage) > i;
            return (
              <div key={sg.key} className="flex-1 flex items-center gap-2 min-w-[92px]">
                <div
                  className={`flex-1 rounded-md border px-3 py-3 transition-all duration-300 ${
                    active
                      ? "border-ap-brand bg-ap-brand/10 shadow-[0_0_0_1px_var(--color-ap-brand)]": done
                      ? "border-ap-up/30 bg-ap-up/5": "border-ap-line bg-ap-bg"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`relative flex h-2 w-2 ${active ? "text-ap-brand" : done ? "text-ap-up" : "text-ap-ink-3"}`}>
                      {active && <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-70 animate-ping" />}
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                    </span>
                    <span className={`text-sm font-semibold whitespace-nowrap ${active ? "text-ap-brand" : done ? "text-ap-up" : "text-ap-ink-2"}`}>{sg.label}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-ap-ink-3 mt-1 font-data">{sg.sub}</div>
                  {active && (
                    <div className="mt-2 h-1 rounded-full bg-ap-surface overflow-hidden">
                      <div className={`h-full bg-ap-brand rounded-full transition-all duration-300 ${widthClass(st?.progress ?? 0)}`} />
                    </div>
                  )}
                </div>
                {i < STAGES.length - 1 && (
                  <span className={`text-ap-ink-3 shrink-0 ${st && STAGES.findIndex(x => x.key === st.stage) >= i && st.stage ? "text-ap-brand" : ""}`}>→</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: current hypothesis + live log */}
        <div className="lg:col-span-2 space-y-5">
          <CurrentCard st={st} />
          <LiveLog log={st?.log ?? []} endRef={logEndRef} />
        </div>

        {/* Right: stats + verdicts + queue + knowledge */}
        <div className="space-y-5">
          <StatsRow st={st} />
          <VerdictFeed verdicts={st?.verdicts ?? []} />
          <QueueList queue={st?.queue ?? []} currentId={st?.current?.id} />
          <KnowledgePanel knowledge={st?.knowledge ?? []} />
        </div>
      </div>

      {/* 배치 리더보드 (Auto-Research 흡수) — 라이브 pending의 하류 = 최종 확정 */}
      <div className="bg-ap-surface border border-hud/20 rounded-lg p-4">
        <AutoResearchPanel embedded />
      </div>

      {/* 실 이벤트 family 스캐너 (밤샘 자율 발굴) */}
      {scan && scan.total > 0 && <ScannerPanel scan={scan} />}

      {/* Jarvis Quant OS 파이프라인 거버넌스 */}
      <JarvisPanel detail={jdetail} />
    </div>
  );
}

// ── 실 이벤트 family 스캐너 (밤샘 자율 발굴 + 레드팀) ──────────────
function rtStyle(v: string | null): string {
  if (v === "CLEARED") return "border-ap-up/50 text-ap-up bg-ap-up/10";
  if (v === "REJECTED") return "border-ap-down/40 text-ap-down bg-ap-down/5";
  return "border-ap-caution/40 text-ap-caution bg-ap-caution/5";
}

const SCAN_W = ["w-[0%]", "w-[14%]", "w-[28%]", "w-[42%]", "w-[57%]", "w-[71%]", "w-[85%]", "w-[100%]"] as const;

function statusChip(f: ScannerFamily): { label: string; cls: string } {
  if (f.status === "완료") return { label: f.redteam ?? "완료", cls: rtStyle(f.redteam) };
  if (f.status === "백테스트 대기") return { label: "pull완·검증대기", cls: "border-ap-note/40 text-ap-note bg-ap-note/10" };
  return { label: "pull 중/대기", cls: "border-ap-ink-3/30 text-ap-ink-3" };
}

function ScannerPanel({ scan }: { scan: ScannerResult }) {
  const pct = scan.total ? Math.round((scan.done / scan.total) * 7) : 0;
  return (
    <Card>
      <CardHeader right={<span>완료 {scan.done}/{scan.total} · CLEARED {scan.cleared}</span>}>이벤트 family 스캐너</CardHeader>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 text-ap-brand">
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-70 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-ap-brand/40 text-ap-brand bg-ap-brand/10">실 발굴 · 레드팀</span>
        </div>

        {/* 진행바 */}
        <div className="h-1.5 rounded-full bg-ap-bg overflow-hidden">
          <div className={`h-full bg-ap-brand rounded-full transition-all duration-500 ${SCAN_W[Math.max(0, Math.min(7, pct))]}`} />
        </div>
        {scan.current && (
          <div className="text-[11px] text-ap-brand flex items-center gap-1.5">
            <span className="animate-pulse">▶</span> 현재 <b>{scan.current}</b> pull 중 (~35분/family)
          </div>
        )}
        <p className="text-[11px] text-ap-ink-3">경제논리 family → 실데이터 → 이벤트스터디 → 레드팀 전통제. CLEARED만 진짜 후보.</p>

        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {scan.families.map(f => {
            const chip = statusChip(f);
            return (
              <div key={f.family} className={`border rounded px-3 py-2 ${f.family === scan.current ? "border-ap-brand/40 bg-ap-brand/5" : "border-ap-line bg-ap-bg"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ap-ink-1 truncate">{f.family}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${chip.cls}`}>{chip.label}</span>
                </div>
                {f.net !== null ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] font-data text-ap-ink-3">
                    <span>n{f.n}</span>
                    <span className={`px-1 font-bold ${(f.net ?? 0) >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>net {((f.net ?? 0) * 100).toFixed(2)}%</span>
                    <span>pct {f.percentile}</span>
                    <span>p {f.p}</span>
                    <span>방향 {f.direction}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-ap-ink-3 mt-0.5 truncate">{f.thesis}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ── Jarvis 거버넌스 파이프라인 (생애주기 퍼널 + 배포 + 감사) ────────
const LIFECYCLE: { key: string; label: string }[] = [
  { key: "draft", label: "draft" },
  { key: "data_audit_passed", label: "audit" },
  { key: "backtested", label: "backtest" },
  { key: "watchlist", label: "watchlist" },
  { key: "paper_candidate", label: "paper_cand" },
  { key: "paper_active", label: "paper_active" },
  { key: "live_candidate", label: "live_cand" },
  { key: "micro_live", label: "micro_live" },
];
const TERMINAL: { key: string; label: string; cls: string }[] = [
  { key: "blocked_by_data", label: "blocked", cls: "text-ap-caution" },
  { key: "rejected", label: "rejected", cls: "text-ap-down" },
  { key: "retired", label: "retired", cls: "text-ap-ink-3" },
];

function auditColor(a: JarvisAuditRow): string {
  const s = `${a.result ?? ""}${a.execution_status ?? ""}${a.risk_status ?? ""}`.toLowerCase();
  if (a.permission_granted === false || s.includes("denied") || s.includes("blocked") || s.includes("rejected")) return "text-ap-down";
  if (s.includes("armed") || s.includes("committed") || s.includes("approved") || s.includes("paper_active")) return "text-ap-up";
  if (s.includes("simulated") || s.includes("allowed")) return "text-ap-brand";
  return "text-ap-ink-3";
}

function JarvisPanel({ detail }: { detail: JarvisDetail | null }) {
  if (!detail) return null;
  const counts: Record<string, number> = {};
  for (const s of detail.strategies) counts[s.status] = (counts[s.status] ?? 0) + 1;
  return (
    <Card>
      <CardHeader right={<span>자유롭게 생각 · 냉정하게 검증 · 페이퍼가 먼저 · 승인된 것만 집행</span>}>Jarvis 파이프라인 거버넌스</CardHeader>
      <div className="p-4 space-y-4">
      {/* 생애주기 퍼널 */}
      <div className="flex items-center gap-1 flex-wrap">
        {LIFECYCLE.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`rounded border px-2 py-1.5 text-center min-w-[64px] ${
              (counts[s.key] ?? 0) > 0 ? "border-ap-brand/40 bg-ap-brand/5" : "border-ap-line bg-ap-bg"}`}>
              <div className={`text-sm font-data ${(counts[s.key] ?? 0) > 0 ? "text-ap-brand" : "text-ap-ink-3"}`}>{counts[s.key] ?? 0}</div>
              <div className="text-[9px] uppercase tracking-wide text-ap-ink-3">{s.label}</div>
            </div>
            {i < LIFECYCLE.length - 1 && <span className="text-ap-ink-3 text-xs">→</span>}
          </div>
        ))}
        <span className="text-ap-ink-3 mx-1">|</span>
        {TERMINAL.map(t => (
          <div key={t.key} className="rounded border border-ap-line bg-ap-bg px-2 py-1.5 text-center min-w-[56px]">
            <div className={`text-sm font-data ${(counts[t.key] ?? 0) > 0 ? t.cls : "text-ap-ink-3"}`}>{counts[t.key] ?? 0}</div>
            <div className="text-[9px] uppercase tracking-wide text-ap-ink-3">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Forward 배포 */}
        <div>
          <div className="text-xs uppercase tracking-wider text-ap-ink-3 font-semibold mb-1.5">Forward 배포 ({detail.deployments.length})</div>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {detail.deployments.length === 0 && <div className="text-xs text-ap-ink-3">배포 없음</div>}
            {detail.deployments.map(d => (
              <div key={d.strategy_id} className="flex items-center justify-between gap-2 text-xs bg-ap-bg border border-ap-line rounded px-2 py-1">
                <span className="text-ap-ink-2 truncate">{d.strategy_id}</span>
                <span className="text-ap-note font-data truncate shrink-0">{d.runner.split(":")[0].split(".").pop()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 감사 로그 */}
        <div>
          <div className="text-xs uppercase tracking-wider text-ap-ink-3 font-semibold mb-1.5">감사 로그 (추가 전용)</div>
          <div className="space-y-0.5 max-h-[160px] overflow-y-auto font-data text-[11px]">
            {detail.audit.slice(-14).reverse().map((a, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-ap-ink-3 shrink-0 w-12 truncate">{a.layer ?? "-"}</span>
                <span className="text-ap-ink-2 shrink-0 w-24 truncate">{a.action ?? "-"}</span>
                <span className={`truncate ${auditColor(a)}`}>{a.result ?? a.execution_status ?? a.risk_status ?? ""}{a.reason ? ` · ${a.reason}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </Card>
  );
}

// ── 현재 가설 + 메트릭 ─────────────────────────────────────────
function CurrentCard({ st }: { st: LabState | null }) {
  const h = st?.current;
  const m = st?.metrics ?? {};
  const busy = st?.busy ?? false;
  if (!h) {
    return (
      <Card className="p-6 text-center">
        <div className="text-ap-ink-2 text-sm">대기 중 — 오토파일럿이 켜지면 큐의 가설부터 자동 실행.</div>
        <div className="text-ap-ink-3 text-xs mt-1">큐의 가설을 하나씩 자체생각→검토→집행→학습으로 돌린다.</div>
      </Card>
    );
  }
  const badge = modeBadge(h.data_mode);
  const cell = (label: string, val: string, ready: boolean, color = "text-ap-ink-1") => (
    <div className="bg-ap-bg border border-ap-line rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ap-ink-3">{label}</div>
      <div className={`text-sm font-data mt-0.5 ${ready ? color : "text-ap-ink-3"} ${!ready && busy ? "animate-pulse" : ""}`}>
        {ready ? val : "···"}
      </div>
    </div>
  );
  const pct = m.percentile ?? null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-ap-ink-1">{h.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-ap-line text-ap-ink-2 font-data">{h.market}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-ap-line text-ap-ink-2">{h.family}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
      </div>
      <p className="text-ap-ink-2 text-sm mt-2 leading-relaxed">{h.thesis}</p>
      <p className="text-ap-ink-3 text-xs mt-1"><span className="text-ap-caution">사망조건:</span> {h.kill}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
        {cell("전략 net", fmt(m.net), m.net !== undefined && m.net !== null, (m.net ?? 0) >= 0 ? "bg-ap-up/20 text-ap-up px-1 font-bold" : "bg-ap-down/20 text-ap-down px-1 font-bold")}
        {cell("random pct", pct !== null ? `${pct}%` : "—", pct !== null, (pct ?? 0) >= 95 ? "text-ap-up" : (pct ?? 0) >= 80 ? "text-ap-caution" : "text-ap-ink-1")}
        {cell("p-value", fmt(m.p, 4), m.p !== undefined && m.p !== null, (m.p ?? 1) < 0.05 ? "text-ap-up" : "text-ap-ink-1")}
        {cell("WF 전반", fmt(m.wf_first), m.wf_first !== undefined && m.wf_first !== null, (m.wf_first ?? 0) >= 0 ? "bg-ap-up/20 text-ap-up px-1 font-bold" : "bg-ap-down/20 text-ap-down px-1 font-bold")}
        {cell("WF 후반", fmt(m.wf_second), m.wf_second !== undefined && m.wf_second !== null, (m.wf_second ?? 0) >= 0 ? "bg-ap-up/20 text-ap-up px-1 font-bold" : "bg-ap-down/20 text-ap-down px-1 font-bold")}
        {cell("거래수", fmt(m.n_trades, 0), m.n_trades !== undefined && m.n_trades !== null)}
      </div>
    </Card>
  );
}

// ── 라이브 로그(터미널) ────────────────────────────────────────
function LiveLog({ log, endRef }: { log: LabLogLine[]; endRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <Card>
      <CardHeader right={<span>{log.length}줄</span>}>라이브 로그</CardHeader>
      <div className="h-[340px] overflow-y-auto px-4 py-3 font-data text-xs leading-relaxed">
        {log.length === 0 && <div className="text-ap-ink-3">— 로그 없음 —</div>}
        {log.map((l, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-ap-ink-3 shrink-0">{l.ts}</span>
            <span className="text-ap-ink-3 shrink-0 uppercase w-14">{l.stage}</span>
            <span className={logColor(l.level)}>{l.msg}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </Card>
  );
}

// ── 통계 ───────────────────────────────────────────────────────
function StatsRow({ st }: { st: LabState | null }) {
  const s = st?.stats ?? { processed: 0, edges: 0, rejects: 0, blocked: 0, pending: 0 };
  const item = (label: string, val: number, color: string) => (
    <div className="bg-ap-surface border border-ap-line rounded-lg px-1.5 py-2 text-center">
      <div className={`text-lg font-semibold font-data ${color}`}>{val}</div>
      <div className="text-[10px] uppercase tracking-wider text-ap-ink-3 break-keep">{label}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {item("검토", s.processed, "text-ap-ink-1")}
      {item("엣지", s.edges, "text-ap-up")}
      {item("기각", s.rejects, "text-ap-down")}
      {item("차단", s.blocked, "text-ap-caution")}
      {item("배치대기", s.pending ?? 0, "text-ap-note")}
    </div>
  );
}

// ── 판정 피드 ──────────────────────────────────────────────────
function VerdictFeed({ verdicts }: { verdicts: LabVerdict[] }) {
  return (
    <Card>
      <CardHeader>판정 피드 (세션)</CardHeader>
      <div className="max-h-[240px] overflow-y-auto divide-y divide-ap-line">
        {verdicts.length === 0 && <div className="px-4 py-3 text-xs text-ap-ink-3">아직 판정 없음</div>}
        {verdicts.map((v, i) => (
          <div key={`${v.id}-${i}`} className="px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ap-ink-1 truncate">{v.name}</span>
              <span className="flex items-center gap-1 shrink-0">
                {v.reconciled && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-ap-brand/40 text-ap-brand bg-ap-brand/10">배치확정 ✓</span>
                )}
                {v.status === "pending_bh" && !v.reconciled && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-ap-note/40 text-ap-note bg-ap-note/10 animate-blink">배치대기</span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${verdictStyle(v.status)}`}>{v.status}</span>
              </span>
            </div>
            <div className="text-[11px] text-ap-ink-3 mt-0.5 truncate">{v.verdict}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 큐 ─────────────────────────────────────────────────────────
function QueueList({ queue, currentId }: { queue: LabHypothesis[]; currentId?: string }) {
  return (
    <Card>
      <CardHeader>가설 큐 ({queue.length})</CardHeader>
      <div className="max-h-[200px] overflow-y-auto divide-y divide-ap-line">
        {queue.length === 0 && <div className="px-4 py-3 text-xs text-ap-ink-3">큐 비어있음 (실행 시 재시드)</div>}
        {queue.map(h => (
          <div key={h.id} className={`px-4 py-2 flex items-center justify-between gap-2 ${h.id === currentId ? "bg-ap-brand/5" : ""}`}>
            <span className="text-sm text-ap-ink-2 truncate">{h.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-ap-line text-ap-ink-3 shrink-0">{h.market}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 축적 지식(실제 registry) ────────────────────────────────────
function KnowledgePanel({ knowledge }: { knowledge: { status: string }[] }) {
  const counts: Record<string, number> = {};
  for (const k of knowledge) counts[k.status] = (counts[k.status] ?? 0) + 1;
  return (
    <Card>
      <CardHeader>축적 지식 · 실제 검증 레지스트리 ({knowledge.length})</CardHeader>
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        {Object.entries(counts).map(([s, n]) => (
          <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded border ${verdictStyle(s)}`}>{s} {n}</span>
        ))}
        {knowledge.length === 0 && <span className="text-xs text-ap-ink-3">레지스트리 비어있음</span>}
      </div>
    </Card>
  );
}
