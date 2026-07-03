"use client";

import { useEffect, useRef, useState } from "react";
import { getExecutionConsole, type ExecutionConsole } from "@/lib/api";

/* 집행 콘솔 — 검증된 buyback 엣지의 라이브 준비 상태 한 화면.
   동결 config + 정직한 기대치 + 페이퍼 손익 + 실전제약 + arm 게이트(사람만).
   실주문 없음. 라이브 arm/집행은 사람 ADMIN. */

function pct(n: number | null | undefined, d = 2): string {
  if (typeof n !== "number") return "—";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(d)}%`;
}

export default function ExecutionPage() {
  const [d, setD] = useState<ExecutionConsole | null>(null);
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
    return () => { mounted = false; ctrl.abort(); };
  }, []);

  if (err) return <div className="p-6 text-xs text-neg border border-neg/30 rounded m-6">오류: {err}</div>;
  if (!d) return <div className="p-6 max-w-4xl mx-auto space-y-3">{[0, 1, 2].map(i => <div key={i} className="scan-skeleton h-20 rounded-lg" />)}</div>;

  const g = d.arm_gate;
  const lr = d.live_readiness;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-text-1 tracking-[0.1em]">집행 콘솔</h1>
          <span className="text-[11px] px-2 py-0.5 rounded border border-warn/40 text-warn bg-warn/10">{d.status}</span>
          <span className="font-data text-[11px] text-text-3">{d.strategy_id} · 동결 {d.frozen_at}</span>
        </div>
        <div className="mt-1 text-[12px] text-text-3">검증된 buyback 엣지 라이브 준비 상태 · 실주문 없음 · arm은 사람만</div>
      </div>

      {/* 동결 config */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">동결 config (튜닝 금지)</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-data text-[13px] text-text-2">
          <span>이벤트 <span className="text-text-1">{d.config.event}</span></span>
          <span>시장 <span className="text-text-1">{d.config.markets.join("·")}</span></span>
          <span>진입 <span className="text-text-1">{d.config.entry}</span></span>
          <span>보유 <span className="text-text-1">{d.config.hold_days}일</span></span>
          <span>비용 <span className="text-text-1">{d.config.cost_bps}bps</span></span>
        </div>
      </div>

      {/* 정직한 엣지 */}
      <div className="bg-panel border border-info/25 rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">엣지 (정직한 기대치)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kv k="중앙값(기대)" v={pct(d.edge.net_median)} tone={d.edge.net_median >= 0 ? "pos" : "neg"} />
          <Kv k="평균(팻테일)" v={pct(d.edge.net_mean)} tone="warn" />
          <Kv k="trimmed10%" v={pct(d.edge.trimmed10)} />
          <Kv k="승률" v={pct(d.edge.win_rate, 1)} />
          <Kv k="p(중앙값)" v={String(d.edge.p_median)} tone="pos" />
          <Kv k="WF 전/후" v={`${pct(d.edge.wf_first)} / ${pct(d.edge.wf_second)}`} />
          <Kv k="검증 거래수" v={String(d.edge.trade_count)} />
        </div>
        <div className="mt-2 text-[11px] text-warn leading-relaxed">⚠ {d.edge.honest_note}</div>
      </div>

      {/* 페이퍼 상태 */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">페이퍼 실행 (실주문 없음)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kv k="총 포지션" v={String(d.paper.total)} />
          <Kv k="보유중" v={String(d.paper.open)} />
          <Kv k="청산" v={String(d.paper.closed)} />
          <Kv k="페이퍼 승률" v={pct(d.paper.paper_win_rate, 1)} />
        </div>
      </div>

      {/* 실전 준비 제약 */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">실전 준비 제약 (Phase 122 동결)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kv k="월 수용력(소자본)" v={`${lr.monthly_capacity_eok}억`} />
          <Kv k="1일 지연 시" v={pct(lr.timing_delay_1d_pct / 100)} tone="neg" />
          <Kv k="월 이벤트" v={`${lr.monthly_events}건`} />
          <Kv k="최대 집중도" v={`${lr.concentration_pct}%`} />
          <Kv k="기대치 기준" v={lr.expectation === "median" ? "중앙값" : lr.expectation} />
          <Kv k="분산" v={lr.diversification === "required" ? "필수" : lr.diversification} />
        </div>
        <div className="mt-2 text-[11px] text-text-3">타이밍 민감 = 즉시 체결 필수(핵심 리스크). 대자본이면 슬리피지로 엣지 소멸.</div>
      </div>

      {/* arm 게이트 */}
      <div className={`rounded-lg p-4 border ${g.armed ? "border-pos/40 bg-pos/5" : "border-warn/30 bg-warn/5"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="text-sm font-semibold text-text-1 uppercase tracking-wider">라이브 arm 게이트</div>
          <span className={`text-[11px] px-2 py-0.5 rounded border ${g.armed ? "border-pos/50 text-pos bg-pos/10" : "border-neg/40 text-neg bg-neg/10"}`}>
            {g.armed ? "ARMED" : "DISARMED"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kv k="자율 레벨" v={`Lv${g.autonomy_level} / 필요 ${g.min_live_level}`} tone={g.autonomy_level >= g.min_live_level ? "pos" : "neg"} />
          <Kv k="라이브 집행" v={g.live_execution} tone={g.live_execution === "disabled" ? "neg" : "pos"} />
          <Kv k="페이퍼 관찰" v={`${g.paper_months}mo / 최소 ${g.min_paper_months}`} tone={g.paper_months >= g.min_paper_months ? "pos" : "warn"} />
          <Kv k="arm 자격" v={g.eligible ? "가능" : "불가"} tone={g.eligible ? "pos" : "neg"} />
        </div>
        {g.reasons.length > 0 && (
          <div className="mt-2 text-[11px] text-neg">차단 사유: {g.reasons.join(" · ")}</div>
        )}
        <div className="mt-3 text-[12px] text-warn border-t border-warn/20 pt-2 leading-relaxed">
          {g.human_action}
        </div>
      </div>

      {/* 금지 목록 */}
      <div className="bg-panel-2 border border-border rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1.5">금지 (동결 위반)</div>
        <div className="flex flex-wrap gap-1.5">
          {d.forbidden.map((f, i) => (
            <span key={i} className="text-[10px] px-2 py-1 rounded border border-border text-text-3">{f}</span>
          ))}
        </div>
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
