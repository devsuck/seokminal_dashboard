"use client";

import { useState } from "react";

interface Props {
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
}

function kellyFraction(winRate: number, avgWin: number, avgLoss: number): number | null {
  if (avgLoss === 0) return null;
  const b = Math.abs(avgWin / avgLoss);
  const p = winRate;
  const q = 1 - p;
  const k = (p * b - q) / b;
  return k;
}

function terminalValue(capital: number, fraction: number, winRate: number, avgWin: number, avgLoss: number, nTrades: number): number {
  // geometric mean approximation
  const p = winRate;
  const q = 1 - p;
  const rWin = fraction * Math.abs(avgWin / 100);
  const rLoss = fraction * Math.abs(avgLoss / 100);
  const gMean = Math.pow((1 + rWin), p) * Math.pow((1 - rLoss), q);
  return capital * Math.pow(gMean, nTrades);
}

const FRACTIONS = [
  { label: "Kelly", color: "text-warn" },
  { label: "Half-Kelly", color: "text-pos" },
  { label: "1% Fixed", color: "text-text-2" },
  { label: "2% Fixed", color: "text-text-2" },
  { label: "5% Fixed", color: "text-text-2" },
] as const;

export function PositionSizingPanel({ winRate, avgWin, avgLoss }: Props) {
  const [capital, setCapital] = useState(10000);
  const [nTrades, setNTrades] = useState(50);

  if (winRate == null || avgWin == null || avgLoss == null) return null;
  if (avgLoss === 0) return null;

  const kelly = kellyFraction(winRate, avgWin, Math.abs(avgLoss));
  const halfKelly = kelly != null ? kelly / 2 : null;

  const fractions: { label: string; frac: number; color: string }[] = [];
  if (kelly != null) fractions.push({ label: "Kelly", frac: Math.max(0, Math.min(kelly, 1)), color: "text-warn" });
  if (halfKelly != null) fractions.push({ label: "Half-Kelly", frac: Math.max(0, Math.min(halfKelly, 1)), color: "text-pos" });
  fractions.push({ label: "1% Fixed", frac: 0.01, color: "text-text-2" });
  fractions.push({ label: "2% Fixed", frac: 0.02, color: "text-text-2" });
  fractions.push({ label: "5% Fixed", frac: 0.05, color: "text-text-2" });

  const rows = fractions.map(f => ({
    ...f,
    terminal: terminalValue(capital, f.frac, winRate, avgWin, Math.abs(avgLoss), nTrades),
    pctReturn: (terminalValue(capital, f.frac, winRate, avgWin, Math.abs(avgLoss), nTrades) / capital - 1) * 100,
  }));

  const fmt$ = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div>
        <p className="text-text-1 text-sm font-medium">포지션 사이징 계산기</p>
        <p className="text-text-3 text-xs mt-0.5">
          Kelly Criterion으로 최적 베팅 비율을 구하고, 각 전략의 기대 수익을 비교합니다.
        </p>
      </div>

      {/* Inputs */}
      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-text-3 text-xs">초기 자본</label>
          <input
            type="number"
            value={capital}
            onChange={e => setCapital(Math.max(1, Number(e.target.value)))}
            className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs font-data w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-3 text-xs">거래 횟수</label>
          <input
            type="number"
            value={nTrades}
            onChange={e => setNTrades(Math.max(1, Math.min(500, Number(e.target.value))))}
            className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs font-data w-20"
          />
        </div>
        <div className="text-text-3 text-xs pb-1.5">
          승률 {(winRate * 100).toFixed(1)}% · 평균수익 {avgWin.toFixed(2)}% · 평균손실 {Math.abs(avgLoss).toFixed(2)}%
        </div>
      </div>

      {/* Kelly badge */}
      {kelly != null && (
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-xs">Full Kelly:</span>
          <span className={`text-xs font-data font-medium ${kelly <= 0 ? "text-neg" : kelly > 0.5 ? "text-warn" : "text-pos"}`}>
            {(kelly * 100).toFixed(1)}%
          </span>
          {kelly <= 0 && (
            <span className="text-neg text-xs">(음수 — 이 전략은 수학적으로 베팅 불가)</span>
          )}
          {kelly > 0.5 && (
            <span className="text-warn text-xs">(50% 초과 — 실제로는 Half-Kelly 권장)</span>
          )}
        </div>
      )}

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">전략</th>
              <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">비율</th>
              <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">기대 최종자산</th>
              <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">수익률</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
                <td className={`px-3 py-2 text-xs font-medium ${row.color}`}>{row.label}</td>
                <td className="px-3 py-2 text-right text-xs font-data text-text-2">
                  {(row.frac * 100).toFixed(1)}%
                </td>
                <td className={`px-3 py-2 text-right text-xs font-data ${
                  row.terminal > capital ? "text-pos" : row.terminal < capital ? "text-neg" : "text-text-3"
                }`}>
                  {fmt$(row.terminal)}
                </td>
                <td className={`px-3 py-2 text-right text-xs font-data ${
                  row.pctReturn > 0 ? "text-pos" : row.pctReturn < 0 ? "text-neg" : "text-text-3"
                }`}>
                  {row.pctReturn > 0 ? "+" : ""}{row.pctReturn.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-text-3 text-[10px]">
        * 기하평균 근사값. 실제 결과는 다를 수 있습니다. Half-Kelly 사용이 일반적으로 권장됩니다.
      </p>
    </div>
  );
}
