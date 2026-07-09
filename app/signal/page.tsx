"use client";

import { useState } from "react";
import { ApiError, getSmartSignal, type SmartSignal } from "@/lib/api";
import { LoadingState } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";

const PRESETS = ["AAPL.NASDAQ", "MSFT.NASDAQ", "SPY.ARCA", "005930.XKRX", "000660.XKRX"];

const VERDICT_STYLE: Record<string, string> = {
  BUY: "text-pos border-pos/50 bg-pos/10",
  HOLD: "text-warn border-warn/40 bg-warn/10",
  AVOID: "text-neg border-neg/50 bg-neg/10",
};

function regimeLabel(r: string): string {
  return { bull_low_vol: "강세·저변동", bull_high_vol: "강세·고변동", bear_low_vol: "약세·저변동", bear_high_vol: "약세·고변동" }[r] ?? r;
}
function regimeCls(r: string): string {
  return r.startsWith("bull") ? "text-pos" : r === "bear_high_vol" ? "text-neg" : "text-warn";
}
function retTintCls(v: number | null | undefined) {
  if (v == null) return "text-text-2";
  if (v > 0) return "px-1 font-bold bg-pos/20 text-pos";
  if (v < 0) return "px-1 font-bold bg-neg/20 text-neg";
  return "text-text-2";
}

export default function SmartSignalPage() {
  const [instrument, setInstrument] = useState("AAPL.NASDAQ");
  const [data, setData] = useState<SmartSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(iid: string) {
    setInstrument(iid);
    setLoading(true); setError(null); setData(null);
    try { setData(await getSmartSignal(iid)); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">스마트 시그널</h1>
        <p className="text-text-3 text-sm mt-0.5">
          <span className="text-text-2">레짐(HMM)</span> 게이트 + <span className="text-text-2">모멘텀</span> 팩터 + <span className="text-text-2">Kelly</span> 사이징 결합 판단. 약세·고변동엔 회피, 강세+모멘텀에만 매수하고 Kelly½(상한 25%)로 비중 제안. <span className="text-text-3">(참고용 — 보장 아님)</span>
        </p>
      </div>

      <div className="flex items-center gap-2 bg-panel border border-border rounded-lg px-4 py-3 flex-wrap">
        <input value={instrument} onChange={e => setInstrument(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && run(instrument)}
          placeholder="AAPL.NASDAQ"className="w-48 bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        <button onClick={() => run(instrument)} className="text-sm px-4 py-1.5 rounded bg-accent text-black font-medium">분석</button>
        <div className="flex gap-1.5 ml-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p} onClick={() => run(p)}
              className="text-[11px] px-2 py-1 rounded border border-border text-text-3 hover:text-accent hover:border-accent font-data">
              {p.split(".")[0]}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="레짐·모멘텀·Kelly 계산 중…" />
        : data && (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
            {/* 판정 카드 */}
            <div className={`border rounded-lg p-5 flex flex-col items-center justify-center ${VERDICT_STYLE[data.verdict]}`}>
              <div className="text-3xl font-bold">
                {data.verdict === "BUY" ? "매수" : data.verdict === "AVOID" ? "회피" : "관망"}
              </div>
              <div className="text-text-3 text-xs mt-1 font-data">{data.instrument_id}</div>
              {data.verdict === "BUY" && (
                <div className="mt-3 text-center">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">제안 비중</div>
                  <div className="text-2xl font-data font-bold text-text-1">{data.suggested_position_pct}%</div>
                  {data.sizing_constraint && (
                    <div className="text-text-3 text-[10px] mt-0.5">
                      {data.sizing_constraint === "cvar" ? "CVaR(꼬리손실)" : data.sizing_constraint === "cap" ? "상한(25%)" : "Kelly·변동성"} 제약
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 근거 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-panel border border-border rounded-lg p-3">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">레짐</div>
                  <div className={`text-sm font-semibold mt-1 ${regimeCls(data.current_regime)}`}>{regimeLabel(data.current_regime)}</div>
                </div>
                <div className="bg-panel border border-border rounded-lg p-3">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">연 변동성</div>
                  <div className="text-sm font-data font-semibold mt-1 text-text-1">{data.vol_annual_pct != null ? `${data.vol_annual_pct}%` : "—"}</div>
                </div>
                <div className="bg-panel border border-border rounded-lg p-3">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">CVaR 95 (일간)</div>
                  <div className="text-sm font-data font-semibold mt-1 text-neg">{data.cvar_95_pct != null ? `${data.cvar_95_pct}%` : "—"}</div>
                </div>
                <div className="bg-panel border border-border rounded-lg p-3">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">모멘텀 60일</div>
                  <div className={`text-sm font-data font-semibold mt-1 inline-block ${retTintCls(data.momentum_60d_pct)}`}>
                    {data.momentum_60d_pct != null ? `${data.momentum_60d_pct > 0 ? "+" : ""}${data.momentum_60d_pct}%` : "—"}
                  </div>
                </div>
                <div className="bg-panel border border-border rounded-lg p-3">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">SMA50 대비</div>
                  <div className={`text-sm font-data font-semibold mt-1 inline-block ${retTintCls(data.price_vs_sma50_pct)}`}>
                    {data.price_vs_sma50_pct != null ? `${data.price_vs_sma50_pct > 0 ? "+" : ""}${data.price_vs_sma50_pct}%` : "—"}
                  </div>
                </div>
                <div className="bg-panel border border-border rounded-lg p-3">
                  <div className="text-text-3 text-[11px] uppercase tracking-wider">Kelly½</div>
                  <div className="text-sm font-data font-semibold mt-1 text-text-1">{data.kelly_half ?? "—"}</div>
                </div>
              </div>
              <Panel>
                <PanelHeader>판단 근거</PanelHeader>
                <ul className="space-y-1 p-4">
                  {data.notes.map((n, i) => <li key={i} className="text-text-2 text-sm">· {n}</li>)}
                </ul>
              </Panel>
            </div>
          </div>
        )}
    </div>
  );
}
