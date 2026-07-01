"use client";

import { useState } from "react";
import { ApiError, getPairsBacktest, type PairsResult } from "@/lib/api";
import { LoadingState } from "@/components/ui";

const PRESETS: [string, string][] = [
  ["AAPL.NASDAQ", "MSFT.NASDAQ"],
  ["005930.XKRX", "000660.XKRX"],
  ["SPY.ARCA", "QQQ.NASDAQ"],
];

function Metric({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="text-text-3 text-[11px] uppercase tracking-wider">{label}</div>
      <div className={`text-base font-data font-bold mt-1 ${cls ?? "text-text-1"}`}>{value}</div>
    </div>
  );
}

function ZChart({ z }: { z: number[] }) {
  const W = 900, H = 140, P = 20;
  const lo = Math.min(-3, ...z), hi = Math.max(3, ...z);
  const x = (i: number) => P + (i / Math.max(z.length - 1, 1)) * (W - 2 * P);
  const y = (v: number) => H / 2 - (v / Math.max(hi, -lo, 1)) * (H / 2 - P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "140px" }}>
      {[2, -2].map(t => <line key={t} x1={P} x2={W - P} y1={y(t)} y2={y(t)} stroke="var(--color-neg)" strokeDasharray="3 3" opacity="0.5" />)}
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="var(--color-border)" />
      <polyline points={z.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      <text x={4} y={y(2)} fill="var(--color-text-3)" fontSize="9">+2</text>
      <text x={4} y={y(-2)} fill="var(--color-text-3)" fontSize="9">-2</text>
    </svg>
  );
}

export default function PairsPage() {
  const [a, setA] = useState("SPY.ARCA");
  const [b, setB] = useState("QQQ.NASDAQ");
  const [data, setData] = useState<PairsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(x = a, y = b) {
    setA(x); setB(y); setLoading(true); setError(null); setData(null);
    try { setData(await getPairsBacktest(x, y, 5)); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">페어 트레이딩 (시장중립)</h1>
        <p className="text-text-3 text-sm mt-0.5">
          공적분된 두 종목의 스프레드가 벌어지면 회귀 베팅(롱/숏). 방향성과 저상관 = <span className="text-text-2">분산</span>. 속도 무관·저빈도라 개인 적합. <span className="text-text-3">공적분 안 되면 부적합으로 걸러냄 (대부분 그럼).</span>
        </p>
      </div>

      <div className="flex items-center gap-2 bg-panel border border-border rounded-lg px-4 py-3 flex-wrap">
        <input value={a} onChange={e => setA(e.target.value.toUpperCase())}
          className="w-40 bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        <span className="text-text-3">/</span>
        <input value={b} onChange={e => setB(e.target.value.toUpperCase())}
          className="w-40 bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        <button onClick={() => run()} className="text-sm px-4 py-1.5 rounded bg-accent text-black font-medium">분석</button>
        <div className="flex gap-1.5 ml-2 flex-wrap">
          {PRESETS.map(([x, y]) => (
            <button key={x + y} onClick={() => run(x, y)}
              className="text-[11px] px-2 py-1 rounded border border-border text-text-3 hover:text-accent hover:border-accent font-data">
              {x.split(".")[0]}/{y.split(".")[0]}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="공적분 검정 + 스프레드 백테스트 중…" />
        : data && (
          <>
            <div className={`border rounded-lg px-4 py-3 ${data.tradeable ? "border-pos/50 bg-pos/10" : "border-warn/40 bg-warn/10"}`}>
              <span className={`text-sm font-semibold ${data.tradeable ? "text-pos" : "text-warn"}`}>
                {data.tradeable ? "✓ 페어 적합" : "⚠ 페어 부적합"}
              </span>
              <span className="text-text-2 text-sm ml-2">{data.note}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="공적분 p값" value={`${data.eg_pvalue}`} cls={data.eg_pvalue < 0.05 ? "text-pos" : "text-neg"} />
              <Metric label="반감기(일)" value={`${data.half_life_days}`} />
              <Metric label="헤지비율" value={`${data.hedge_ratio}`} />
              <Metric label="거래수" value={`${data.num_trades}`} />
              <Metric label="수익률(비용반영)" value={data.total_return_pct != null ? `${data.total_return_pct}%` : "—"}
                cls={(data.total_return_pct ?? 0) > 0 ? "text-pos" : "text-neg"} />
              <Metric label="Sharpe" value={data.sharpe_ratio != null ? `${data.sharpe_ratio}` : "—"}
                cls={(data.sharpe_ratio ?? 0) >= 1 ? "text-pos" : "text-text-1"} />
              <Metric label="MDD" value={data.max_drawdown_pct != null ? `${data.max_drawdown_pct}%` : "—"} cls="text-neg" />
              <Metric label="승률" value={data.win_rate != null ? `${(data.win_rate * 100).toFixed(0)}%` : "—"} />
            </div>

            <div className="bg-panel border border-border rounded-lg p-4">
              <div className="text-text-3 text-[11px] uppercase tracking-wider mb-1">스프레드 z-score (±2 진입 / 0.5 청산)</div>
              {data.zscore.length > 1 ? <ZChart z={data.zscore} /> : <p className="text-text-3 text-sm">데이터 없음</p>}
            </div>
            <p className="text-text-3 text-[11px]">
              ※ 공적분 p&lt;0.05 + 반감기 1~60일이어야 적합. 그래도 실전 검증(페이퍼) 필수 — 과거 공적분이 미래 보장 아님.
            </p>
          </>
        )}
    </div>
  );
}
