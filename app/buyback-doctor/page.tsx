"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBuybackAnalysis, type BuybackAnalysis } from "@/lib/api";
import { ArcReactor, RadialGauge } from "@/components/Hud";
import { LivePulse } from "@/components/Jarvis";

/* Buyback 손실 진단 — 왜 깨졌는지(결정적 진단) + 더 정교한 청산룰이 기대치를 올리나(시뮬).
   v1(hold20) 동결 → 청산룰은 v2 섀도 후보로만 평가. */

const RULE_LABEL: Record<string, string> = {
  hold20: "20일 보유 (v1)", stop8: "손절 -8%", stop12: "손절 -12%",
  trail5: "트레일링 -5%", take5trail: "+5% 후 트레일",
};
function pct(n: number | null | undefined, d = 2) {
  return typeof n === "number" ? `${n >= 0 ? "+" : ""}${(n * 100).toFixed(d)}%` : "—";
}

export default function BuybackDoctorPage() {
  const [a, setA] = useState<BuybackAnalysis | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      abortRef.current?.abort();
      const c = new AbortController();
      abortRef.current = c;
      try {
        const r = await getBuybackAnalysis(c.signal);
        if (mounted && !c.signal.aborted) { setA(r); setErr(null); }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError") && mounted) setErr(String(e));
      }
    }
    load();
    const iv = setInterval(load, 8000);   // pending이면 곧 캐시 완성 → 재폴링
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  const sim = a?.exit_sim ?? {};
  const rules = Object.keys(sim);
  const base = sim["hold20"];
  const pending = a?.pending;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header HUD */}
      <div className="hud-frame hud-bg tech-grid scanline-host flex items-center justify-between gap-4 flex-wrap rounded-lg border border-accent/20 p-4">
        <div className="flex items-center gap-5">
          <ArcReactor size={100} active={!pending} label={pending ? "…" : "DX"} sub="loss dx" />
          <div>
            <h1 className="text-2xl font-semibold text-text-1 tracking-[0.1em]">Buyback 손실 진단</h1>
            <div className="mt-1 font-data text-[11px] text-accent/80">
              왜 깨졌나(결정적 진단) + 정교한 청산룰이 기대치를 올리나(시뮬) · v1 동결→섀도 평가
            </div>
          </div>
        </div>
        {a && !pending && (
          <div className="flex gap-3">
            <RadialGauge size={72} pct={Math.min(100, (a.n_losers ?? 0) * 2)} value={String(a.n_losers ?? 0)} label="손실" tone="neg" />
            <RadialGauge size={72} pct={base?.win_rate ? base.win_rate * 100 : 0} value={base?.win_rate != null ? `${(base.win_rate * 100).toFixed(0)}%` : "—"} label="승률" tone="accent" />
          </div>
        )}
      </div>

      {err && <div className="text-xs text-neg border border-neg/30 rounded px-3 py-2">오류: {err}</div>}
      {pending && (
        <div className="bg-panel border border-info/30 rounded-lg p-4 flex items-center gap-3">
          <LivePulse tone="accent" />
          <span className="text-sm text-text-2">{a?.note ?? "가격 시리즈 빌드 중(~80s)…"} 자동 새로고침.</span>
        </div>
      )}

      {/* 핵심 결론 배너 */}
      {a && !pending && a.best_rule && (
        <div className={`rounded-lg p-4 border ${a.improves ? "border-pos/40 bg-pos/5" : "border-warn/40 bg-warn/5"}`}>
          <div className="text-sm font-semibold text-text-1 mb-1">
            결론: {a.improves ? `더 정교한 청산(${RULE_LABEL[a.best_rule]})이 기대치 개선` : "정교한 손절이 오히려 엣지를 깎음 → v1(20일 보유) 유지"}
          </div>
          <p className="text-[12px] text-text-2 leading-relaxed">
            buyback 엣지는 <b className="text-text-1">우측꼬리 의존</b>(옐로). 손절·트레일링이 그 소수 대박을 잘라 mean을 낮춤.
            개별 손실은 아파 보여도 전체에 손절 걸면 기대치 <b className="text-neg">하락</b>. {a.shadow_note}
          </p>
        </div>
      )}

      {/* 청산룰 시뮬 표 */}
      {a && !pending && rules.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-[10px] uppercase tracking-wider text-text-3">
            청산룰 시뮬 (닫힌 {base?.n ?? 0}개 · 전체 경로 재적용)
          </div>
          <table className="w-full text-[12px]">
            <thead><tr className="text-text-3 border-b border-border">
              <th className="text-left px-4 py-2 font-medium">룰</th>
              <th className="text-right px-3 py-2 font-medium">평균</th>
              <th className="text-right px-3 py-2 font-medium">중앙값</th>
              <th className="text-right px-3 py-2 font-medium">승률</th>
              <th className="text-right px-4 py-2 font-medium">누적</th>
            </tr></thead>
            <tbody className="font-data">
              {rules.map(r => {
                const s = sim[r]; const isBest = r === a.best_rule; const isBase = r === "hold20";
                return (
                  <tr key={r} className={`border-b border-border/50 ${isBest ? "bg-pos/5" : ""}`}>
                    <td className="px-4 py-2 text-text-1">
                      {RULE_LABEL[r] ?? r}
                      {isBest && <span className="ml-1.5 text-[9px] text-pos">★ 최선</span>}
                      {isBase && !isBest && <span className="ml-1.5 text-[9px] text-text-3">기준</span>}
                    </td>
                    <td className={`text-right px-3 py-2 ${(s.mean ?? 0) >= (base?.mean ?? 0) ? "text-pos" : "text-neg"}`}>{pct(s.mean)}</td>
                    <td className={`text-right px-3 py-2 ${(s.median ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{pct(s.median)}</td>
                    <td className="text-right px-3 py-2 text-text-2">{s.win_rate != null ? `${(s.win_rate * 100).toFixed(0)}%` : "—"}</td>
                    <td className="text-right px-4 py-2 text-text-2">{pct(s.cum, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 손실 포지션 진단 */}
      {a && !pending && a.losers.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-3">손실 포지션 진단 ({a.n_losers}) — 최악부터</div>
          {a.losers.map(l => (
            <Link key={`${l.code}-${l.entry_date}`} href={`/market?symbol=${encodeURIComponent(`${l.code}.XKRX`)}`}
              title="차트에서 매수 위치 보기"
              className="block bg-panel border border-border rounded-lg p-3 no-underline hover:border-neg/40 hover:bg-panel-2 transition-colors group">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-text-1 group-hover:text-accent truncate">{l.corp}</span>
                  <span className="font-data text-[10px] text-text-3">{l.code}</span>
                  <span className="text-text-3 text-[10px] opacity-0 group-hover:opacity-100">차트 →</span>
                </div>
                <span className="font-data text-sm text-neg shrink-0">{pct(l.cur_ret)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {l.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded border border-border text-text-3 font-data">{t}</span>)}
              </div>
              <div className="mt-1 text-[11px] text-text-2 leading-relaxed">{l.explain}</div>
            </Link>
          ))}
        </div>
      )}

      {a?.llm_note && !pending && (
        <div className="text-[11px] text-text-3 text-center">{a.llm_note}</div>
      )}
    </div>
  );
}
