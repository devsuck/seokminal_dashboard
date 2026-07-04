"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAutoResearch, runAutoResearch, promoteToPaper,
  type AutoResearchStatus, type AutoResearchEntry, type PromotePaperResult,
} from "@/lib/api";
import { LivePulse, AnimatedNumber, ThinkingLine } from "@/components/Jarvis";
import { ArcReactor, RadialGauge } from "@/components/Hud";

/* Auto-Research 배치 뷰 — karpathy/autoresearch 정직 이식.
   밤새 후보 다량 검증 → 배치 BH-FDR(다중검정 보정) → 레드팀 → 리더보드(최종 확정).
   embedded=true → AI LAB 페이지 내 섹션(컴팩트 헤더). false → 독립 페이지. */

const VERDICT: Record<string, { label: string; cls: string }> = {
  CANDIDATE:       { label: "CANDIDATE", cls: "text-pos border-pos/50 bg-pos/10" },
  WATCHLIST:       { label: "WATCHLIST", cls: "text-warn border-warn/50 bg-warn/10" },
  REJECT_REDTEAM:  { label: "REJECT · 레드팀", cls: "text-neg border-neg/40 bg-neg/5" },
  REJECT_BH:       { label: "REJECT · BH-FDR", cls: "text-warn border-warn/40 bg-warn/5" },
};

function fnum(n: number | null | undefined, d = 4, sign = false): string {
  if (typeof n !== "number") return "—";
  return `${sign && n >= 0 ? "+" : ""}${n.toFixed(d)}`;
}

export default function AutoResearchPanel({ embedded = false }: { embedded?: boolean }) {
  const [st, setSt] = useState<AutoResearchStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteResults, setPromoteResults] = useState<Record<string, PromotePaperResult>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    getAutoResearch(ctrl.signal)
      .then(s => { if (mounted) setSt(s); })
      .catch(e => { if (!(e instanceof DOMException && e.name === "AbortError") && mounted) setErr(String(e)); });
    return () => { mounted = false; ctrl.abort(); };
  }, []);

  async function onRun() {
    setBusy(true); setErr(null);
    try { setSt(await runAutoResearch()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function onPromote(cid: string, thesis: string) {
    setPromoting(cid); setErr(null);
    try {
      const res = await promoteToPaper(cid, thesis.slice(0, 40));
      setPromoteResults(prev => ({ ...prev, [cid]: res }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPromoting(null);
    }
  }

  const lb = st?.leaderboard ?? [];
  const nCand = st?.n_candidates ?? 0;

  return (
    <div className={embedded ? "space-y-5" : "p-6 max-w-4xl mx-auto space-y-5"}>
      {embedded ? (
        /* 컴팩트 헤더 — AI LAB 내 섹션(라이브 pending의 하류 = 최종 확정) */
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-hud/15 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-1 uppercase tracking-[0.12em]">배치 리더보드 · 최종 확정</h2>
            <LivePulse tone={busy ? "accent" : nCand > 0 ? "pos" : "text-3"}
              label={busy ? "RUNNING" : "BH-FDR"} />
            <span className="text-[11px] text-text-3 font-data">
              라이브 pending의 하류 — 배치 다중검정 통과분만 확정
            </span>
          </div>
          <button onClick={onRun} disabled={busy}
            className="px-3 py-1.5 text-sm font-medium rounded border border-accent/50 text-accent bg-accent/10 disabled:opacity-40 cursor-pointer">
            {busy ? "실행중…" : "▶ 배치 실행"}
          </button>
        </div>
      ) : (
        /* 독립 페이지 헤더 — 아크리액터 HUD */
        <div className="hud-frame hud-bg tech-grid scanline-host rounded-lg border border-hud/20 p-4 overflow-hidden">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5">
              <ArcReactor size={132} active={busy}
                label={busy ? "RUN" : nCand > 0 ? "HIT" : "IDLE"} sub="batch" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-text-1 tracking-[0.12em]">Auto-Research</h1>
                  <LivePulse tone={busy ? "accent" : nCand > 0 ? "pos" : "text-3"}
                    label={busy ? "RUNNING" : st?.finished ? "IDLE" : "READY"} />
                </div>
                <div className="mt-1 h-4 font-data text-[11px] text-hud/80">
                  {busy ? <ThinkingLine text="후보 생성 · 검증 · 배치 BH-FDR · 레드팀" />
                        : "자율 가설 대량 검증 + 배치 다중검정 게이트 · p-해킹 방지"}
                </div>
              </div>
            </div>
            <button onClick={onRun} disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded bg-accent text-black disabled:opacity-40 cursor-pointer border-0">
              {busy ? "실행중…" : "▶ 배치 실행"}
            </button>
          </div>
          {st && (
            <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 mt-3 pt-3 border-t border-hud/15 flex-wrap">
              <RadialGauge size={84} pct={Math.min(100, st.n_tested * 12)} value={String(st.n_tested)} label="검증" />
              <RadialGauge size={84} pct={nCand > 0 ? 100 : 0} value={String(nCand)} label="후보" tone={nCand > 0 ? "pos" : "hud"} />
              <RadialGauge size={84} pct={Math.min(100, (st.n_underpowered ?? 0) * 20)} value={String(st.n_underpowered ?? 0)} label="저파워" tone="neg" />
              <RadialGauge size={84} pct={st.bh_threshold != null ? Math.min(100, st.bh_threshold / (st.bh_alpha ?? 0.1) * 100) : 0} value={st.bh_threshold != null ? st.bh_threshold.toFixed(3) : "—"} label="BH임계" />
            </div>
          )}
        </div>
      )}

      {err && <div className="text-xs text-neg border border-neg/30 rounded px-3 py-2">오류: {err}</div>}

      {/* 배치 요약 */}
      {st && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="검증됨" num={st.n_tested} />
          <Stat label="저파워(데이터부족)" num={st.n_underpowered ?? 0} />
          <Stat label="CANDIDATE" num={nCand} tone={nCand > 0 ? "pos" : undefined} />
          <Stat label="BH 임계 p" str={st.bh_threshold != null ? st.bh_threshold.toFixed(4) : "—"} />
        </div>
      )}

      {/* 정직 노트 */}
      {st?.honest_note && (
        <div className="bg-panel border border-info/25 rounded-lg p-3 text-[12px] text-text-2 leading-relaxed">
          <span className="text-info font-semibold">방법론</span> · {st.honest_note}
        </div>
      )}

      {/* 리더보드 */}
      {lb.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-3">리더보드 ({lb.length})</div>
          {lb.map((e, i) => (
            <LeaderRow key={e.cid} e={e} rank={i + 1} open={open === e.cid}
              onToggle={() => setOpen(open === e.cid ? null : e.cid)}
              onPromote={e.verdict === "CANDIDATE" ? () => onPromote(e.cid, e.thesis) : undefined}
              promoteResult={promoteResults[e.cid] ?? null}
              promoting={promoting === e.cid} />
          ))}
        </div>
      )}

      {/* 저파워 */}
      {st?.underpowered && st.underpowered.length > 0 && (
        <div className="bg-panel border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1.5">저파워 — 데이터 부족/커버리지 (판정 보류)</div>
          <div className="flex flex-wrap gap-1.5">
            {st.underpowered.map(u => (
              <span key={u.cid} className="text-[11px] px-2 py-1 rounded border border-border text-text-3 font-data">
                {u.cid} · n={u.n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 대기 엔진 (정직: 가짜 결과 없음) */}
      {st?.pending_engines && st.pending_engines.length > 0 && (
        <div className="bg-panel border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1.5">추가 엔진 (배선 대기 — 가짜 결과 안 만듦)</div>
          <div className="space-y-1">
            {st.pending_engines.map(p => (
              <div key={p.category} className="flex items-center gap-2 text-[12px]">
                <span className="w-2 h-2 rounded-full bg-text-3/40 animate-blink" />
                <span className="font-data text-text-2">{p.category}</span>
                <span className="text-text-3">— {p.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!st && !err && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="scan-skeleton h-14 rounded-lg" />)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, num, str, tone }: { label: string; num?: number; str?: string; tone?: "pos" }) {
  return (
    <div className="hud-frame bg-panel border border-border rounded-lg px-3 py-2.5 text-center">
      <div className={`text-lg font-semibold font-data ${tone === "pos" ? "text-pos" : "text-text-1"}`}>
        {typeof num === "number" ? <AnimatedNumber value={num} decimals={0} /> : str}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-text-3">{label}</div>
    </div>
  );
}

function LeaderRow({ e, rank, open, onToggle, onPromote, promoteResult, promoting }: {
  e: AutoResearchEntry; rank: number; open: boolean; onToggle: () => void;
  onPromote?: () => void; promoteResult?: PromotePaperResult | null; promoting?: boolean;
}) {
  const v = VERDICT[e.verdict] ?? { label: e.verdict, cls: "text-text-2 border-border" };
  const isCandidate = e.verdict === "CANDIDATE";
  const alreadyPaper = promoteResult?.status?.startsWith("paper");
  return (
    <div className={`bg-panel border rounded-lg animate-[rise_0.4s_ease-out_both] ${isCandidate ? "border-pos/40 animate-[pulse-glow_2.4s_ease-in-out_infinite]" : "border-border"}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer bg-transparent border-0 text-left">
        <span className="text-[11px] font-data text-text-3 w-5 shrink-0">{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-data text-text-1">{e.cid}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-3">{e.category}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${v.cls}`}>{v.label}</span>
            {alreadyPaper && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-info/40 text-info bg-info/10">
                {promoteResult!.status} ✓
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-3 truncate mt-0.5">{e.thesis}</div>
        </div>
        <div className="text-right shrink-0 font-data">
          <div className={`text-sm ${(e.net ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{fnum(e.net, 4, true)}</div>
          <div className="text-[11px] text-text-3">pct {e.percentile ?? "—"} · p {e.p ?? "—"}</div>
        </div>
        <span className={`text-text-3 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <Kv k="배치 BH" v={e.bh_survivor ? "생존 ✓" : "탈락"} tone={e.bh_survivor ? "pos" : "neg"} />
            <Kv k="레드팀" v={e.redteam} tone={e.redteam === "CLEARED" ? "pos" : "neg"} />
            <Kv k="WF 전/후" v={`${fnum(e.wf_first, 3, true)} / ${fnum(e.wf_second, 3, true)}`} />
            <Kv k="상위꼬리" v={fnum(e.top_tail, 2)} />
            <Kv k="median" v={fnum(e.median, 4, true)} tone={(e.median ?? 0) >= 0 ? "pos" : "neg"} />
            <Kv k="n" v={String(e.n ?? "—")} />
            {e.redteam_failed.length > 0 && (
              <div className="col-span-2 sm:col-span-4 text-[11px] text-neg">통제 실패: {e.redteam_failed.join(", ")}</div>
            )}
          </div>
          {isCandidate && onPromote && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <button onClick={e => { e.stopPropagation(); onPromote(); }} disabled={promoting || !!alreadyPaper}
                className="text-[11px] px-3 py-1.5 rounded border border-pos/50 text-pos bg-pos/10 font-medium disabled:opacity-40 hover:bg-pos/20 transition-colors">
                {alreadyPaper ? "✓ 페이퍼 등록됨" : promoting ? "등록 중…" : "🚀 페이퍼로 올리기"}
              </button>
              {promoteResult && !alreadyPaper && (
                <span className="text-[10px] text-neg">{promoteResult.deployment?.reason ?? "오류"}</span>
              )}
              {alreadyPaper && (
                <span className="text-[10px] text-text-3">
                  registry: {promoteResult!.status} · runner: {promoteResult!.deployment?.runner ?? "—"}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kv({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" }) {
  const c = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-text-1";
  return (
    <div className="bg-panel-2 border border-border rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-3">{k}</div>
      <div className={`font-data ${c}`}>{v}</div>
    </div>
  );
}
