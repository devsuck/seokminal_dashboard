"use client";

import { useEffect, useRef, useState } from "react";
import {
  getExecutionConsole, getExecutionEdge, getLabPortfolio,
  type ExecutionConsole, type ExecutionEdge, type PortfolioBook,
} from "@/lib/api";
import { ArcReactor, RadialGauge } from "@/components/Hud";
import { LivePulse } from "@/components/Jarvis";

/* 집행 콘솔 — buyback 엣지 라이브 준비 + 엣지 생존(OOS) + 생존자 포트폴리오. Jarvis HUD.
   엣지 생존은 series 로드 무거움 → 별도 async fetch(콘솔 즉시, 엣지 카드 프로그레시브). */

function pct(n: number | null | undefined, d = 2): string {
  if (typeof n !== "number") return "—";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(d)}%`;
}

const EDGE: Record<string, { label: string; tone: "pos" | "accent" | "info" | "neg" | "text-3"; note: string }> = {
  warming:      { label: "워밍 중", tone: "text-3", note: "엣지 생존 배경 계산 중(service 워밍) — 곧 채워짐." },
  no_oos_yet:   { label: "OOS 대기", tone: "info",   note: "동결 후 완결 월 0 — 카운트다운 시작 전. 무엇도 arm하지 마라." },
  accumulating: { label: "누적 중",  tone: "accent", note: "OOS 월이 envelope 안에서 쌓이는 중. 아직 월 부족." },
  drifting:     { label: "이탈 경고", tone: "neg",    note: "OOS 과반이 envelope 밖 — 엣지 소멸 신호. arm 금지." },
  confirmed:    { label: "생존 확인", tone: "pos",    note: "충분한 OOS + envelope 안 = 엣지 살아있음. 승격 검토." },
  unavailable:  { label: "데이터 대기", tone: "text-3", note: "forward 계산 불가(데이터/series)." },
};

export default function ExecutionPage() {
  const [d, setD] = useState<ExecutionConsole | null>(null);
  const [ea, setEa] = useState<ExecutionEdge | null>(null);
  const [book, setBook] = useState<PortfolioBook | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    getExecutionConsole(ctrl.signal)
      .then(s => { if (mounted) setD(s); })
      .catch(e => { if (!(e instanceof DOMException && e.name === "AbortError") && mounted) setErr(String(e)); });
    getExecutionEdge(ctrl.signal)   // 무거움 → 콘솔과 병렬, 늦게 도착
      .then(e => { if (mounted) setEa(e); })
      .catch(() => { /* 엣지 카드만 로딩 유지 */ });
    getLabPortfolio(ctrl.signal)
      .then(b => { if (mounted) setBook(b); })
      .catch(() => { /* 선택적 */ });
    return () => { mounted = false; ctrl.abort(); };
  }, []);

  if (err) return <div className="p-6 text-xs text-neg border border-neg/30 rounded m-6">오류: {err}</div>;
  if (!d) return <div className="p-6 max-w-4xl mx-auto space-y-3">{[0, 1, 2].map(i => <div key={i} className="scan-skeleton h-20 rounded-lg" />)}</div>;

  const g = d.arm_gate, lr = d.live_readiness;
  const warming = !ea || ea.status === "warming";
  const edge = ea ? (EDGE[ea.status] ?? EDGE.unavailable) : EDGE.warming;
  const oosPct = ea && ea.oos_months > 0 ? Math.round((ea.oos_in_envelope / ea.oos_months) * 100) : 0;
  const countdownPct = ea ? Math.min(100, (ea.oos_months / Math.max(1, ea.need_months)) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* HUD 헤더 */}
      <div className="hud-frame hud-bg tech-grid scanline-host rounded-lg border border-hud/20 p-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5">
            <ArcReactor size={132} active={ea?.status === "confirmed"} label={edge.label} sub="edge" />
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-text-1 tracking-[0.1em] uppercase">집행 콘솔</h1>
                <LivePulse tone={edge.tone === "text-3" ? "text-3" : edge.tone} label={edge.label} />
                <span className="text-[11px] px-2 py-0.5 rounded border border-warn/40 text-warn bg-warn/10">{d.status}</span>
              </div>
              <div className="mt-1 font-data text-[11px] text-hud/80">
                {d.strategy_id} · 동결 {d.frozen_at} · 검증된 buyback 엣지 · arm은 사람만
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 mt-3 pt-3 border-t border-hud/15 flex-wrap">
          <RadialGauge size={84} pct={countdownPct} value={!warming && ea ? `${ea.oos_months}/${ea.need_months}` : "…"} label="OOS 월" tone={ea && ea.oos_months >= ea.need_months ? "pos" : "hud"} />
          <RadialGauge size={84} pct={oosPct} value={!warming ? `${oosPct}%` : "…"} label="envelope 내" tone={oosPct >= 50 ? "pos" : "neg"} />
          <RadialGauge size={84} pct={d.edge.win_rate * 100} value={pct(d.edge.win_rate, 0)} label="승률" />
          <RadialGauge size={84} pct={g.autonomy_level / g.min_live_level * 100} value={`Lv${g.autonomy_level}`} label="자율" tone="neg" />
          <RadialGauge size={84} pct={Math.min(100, lr.monthly_capacity_eok)} value={`${lr.monthly_capacity_eok}억`} label="수용력" />
        </div>
      </div>

      {/* 엣지 생존 (OOS vs envelope) */}
      <div className={`hud-frame rounded-lg border p-4 ${
        edge.tone === "pos" ? "border-pos/40 bg-pos/5" : edge.tone === "neg" ? "border-neg/40 bg-neg/5" : "border-hud/20 bg-panel"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="text-sm font-semibold text-text-1 uppercase tracking-wider">엣지 생존 모니터</div>
          <LivePulse tone={edge.tone === "text-3" ? "text-3" : edge.tone} label={edge.label} />
        </div>
        {warming || !ea ? (
          <div className="scan-skeleton h-14 rounded" />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kv k="OOS 월(동결후)" v={`${ea.oos_months} / ${ea.need_months}`} tone={ea.oos_months >= ea.need_months ? "pos" : "warn"} />
              <Kv k="envelope 내" v={`${ea.oos_in_envelope}/${ea.oos_months}`} tone={oosPct >= 50 ? "pos" : ea.oos_months ? "neg" : undefined} />
              <Kv k="in-sample 월" v={String(ea.in_sample_months)} />
              <Kv k="envelope p10~p90" v={`${pct(ea.envelope.p10)} ~ ${pct(ea.envelope.p90)}`} />
            </div>
            {ea.oos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ea.oos.map(m => (
                  <span key={m.month} className={`text-[10px] px-1.5 py-0.5 rounded border font-data ${
                    m.in_envelope ? "border-pos/40 text-pos bg-pos/10" : "border-neg/40 text-neg bg-neg/10"}`}>
                    {m.month} {pct(m.median)}
                  </span>
                ))}
              </div>
            )}
            {ea.event_level && (
              <div className="mt-2 pt-2 border-t border-border/50 text-[11px] font-data text-text-3">
                이벤트 레벨(조기 신호): OOS {ea.event_level.n_oos}건
                {ea.event_level.powered ? (
                  <>
                    {" "}· median {pct(ea.event_level.oos_median)} vs in-sample {pct(ea.event_level.in_sample_median)}
                    {" "}· p_worse{" "}
                    <span className={ea.event_level.p_worse != null && ea.event_level.p_worse < 0.05 ? "text-neg" : "text-pos"}>
                      {ea.event_level.p_worse ?? "—"}
                    </span>
                    {ea.event_level.p_worse != null && ea.event_level.p_worse < 0.05 && <span className="text-neg"> ← 소멸 조기경보</span>}
                  </>
                ) : (
                  <span> / {ea.event_level.min_events}건 필요 — 판단 보류(월 코호트보다 ~2개월 빠른 보조 신호)</span>
                )}
              </div>
            )}
          </>
        )}
        <div className={`mt-2 text-[11px] leading-relaxed ${edge.tone === "neg" ? "text-neg" : edge.tone === "pos" ? "text-pos" : "text-text-3"}`}>
          {edge.note}
        </div>
      </div>

      {/* 정직한 엣지 (기대치) */}
      <div className="hud-frame bg-panel border border-info/25 rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">엣지 기대치 (정직)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kv k="중앙값(기대)" v={pct(d.edge.net_median)} tone={d.edge.net_median >= 0 ? "pos" : "neg"} />
          <Kv k="평균(팻테일)" v={pct(d.edge.net_mean)} tone="warn" />
          <Kv k="trimmed10%" v={pct(d.edge.trimmed10)} />
          <Kv k="p(중앙값)" v={String(d.edge.p_median)} tone="pos" />
        </div>
        <div className="mt-2 text-[11px] text-warn leading-relaxed">⚠ {d.edge.honest_note}</div>
      </div>

      {/* 생존자 포트폴리오 (돈=조합) */}
      {book && book.combined && (
        <div className="hud-frame bg-panel border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-text-3">생존자 포트폴리오 (무상관 조합)</div>
            {/* 북 상세 카드는 Lab Task 페이지에 있음 — /lab/portfolio는 백엔드 endpoint(페이지 아님) */}
            <a href="/lab/tasks" className="text-[11px] text-accent hover:underline">전체 →</a>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {book.sleeves.map(s => (
              <span key={s.name} className="text-[11px] px-2 py-1 rounded border border-border font-data text-text-2">
                {s.name} <span className="text-text-1">Sh {s.sharpe.toFixed(2)}</span> <span className="text-neg">MDD {pct(s.mdd, 0)}</span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Kv k="상관" v={typeof book.correlation === "number" ? book.correlation.toFixed(2) : "—"} tone="pos" />
            <Kv k="등가중 Sharpe" v={book.combined.equal_weight.sharpe.toFixed(2)} tone="pos" />
            <Kv k="등가중 MDD" v={pct(book.combined.equal_weight.mdd, 0)} tone="neg" />
          </div>
        </div>
      )}

      {/* 실전 준비 제약 */}
      <div className="hud-frame bg-panel border border-border rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">실전 준비 제약 (동결)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kv k="월 수용력(소자본)" v={`${lr.monthly_capacity_eok}억`} />
          <Kv k="1일 지연 시" v={pct(lr.timing_delay_1d_pct / 100)} tone="neg" />
          <Kv k="분산" v={lr.diversification === "required" ? "필수" : lr.diversification} />
        </div>
        <div className="mt-2 text-[11px] text-text-3">타이밍 민감 = 즉시 체결 필수. 대자본이면 슬리피지로 엣지 소멸.</div>
      </div>

      {/* arm 게이트 */}
      <div className={`hud-frame rounded-lg p-4 border ${g.armed ? "border-pos/40 bg-pos/5" : "border-warn/30 bg-warn/5"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="text-sm font-semibold text-text-1 uppercase tracking-wider">라이브 ARM 게이트</div>
          <span className="flex items-center gap-1.5">
            {d.arm_decision && (
              <span className={`text-[11px] px-2 py-0.5 rounded border font-data ${
                d.arm_decision.decision === "GO" ? "border-pos/50 text-pos bg-pos/10" :
                d.arm_decision.decision === "KILL" ? "border-neg/50 text-neg bg-neg/10 animate-blink" :
                "border-info/40 text-info bg-info/10"}`}>
                {d.arm_decision.decision === "GO" ? "GO — 소액 arm 검토" :
                 d.arm_decision.decision === "KILL" ? "KILL — 엣지 소멸" : "WAIT"}
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded border ${g.armed ? "border-pos/50 text-pos bg-pos/10" : "border-neg/40 text-neg bg-neg/10"}`}>
              {g.armed ? "ARMED" : "DISARMED"}
            </span>
          </span>
        </div>
        {d.arm_decision && (
          <div className="mb-2 text-[11px] text-text-3">
            사전등록 {d.arm_decision.version} (동결 {d.arm_decision.frozen_at}) · 첫 arm 상한 {(d.arm_decision.first_tranche_krw_max / 10_000).toLocaleString()}만원
            {d.arm_decision.reasons.length > 0 && <span> · {d.arm_decision.reasons.join(" · ")}</span>}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kv k="자율 레벨" v={`Lv${g.autonomy_level} / 필요 ${g.min_live_level}`} tone={g.autonomy_level >= g.min_live_level ? "pos" : "neg"} />
          <Kv k="라이브 집행" v={g.live_execution} tone={g.live_execution === "disabled" ? "neg" : "pos"} />
          <Kv k="페이퍼 관찰" v={`${g.paper_months}mo / 최소 ${g.min_paper_months}`} tone={g.paper_months >= g.min_paper_months ? "pos" : "warn"} />
          <Kv k="arm 자격" v={g.eligible ? "가능" : "불가"} tone={g.eligible ? "pos" : "neg"} />
        </div>
        {g.reasons.length > 0 && <div className="mt-2 text-[11px] text-neg">차단 사유: {g.reasons.join(" · ")}</div>}
        <div className="mt-3 text-[12px] text-warn border-t border-warn/20 pt-2 leading-relaxed">{g.human_action}</div>
      </div>
    </div>
  );
}

function Kv({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" | "warn" }) {
  const c = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "warn" ? "text-warn" : "text-text-1";
  return (
    <div className="bg-panel-2 border border-border rounded px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-3">{k}</div>
      <div className={`font-data text-sm ${c}`}>{v}</div>
    </div>
  );
}
