"use client";

import { useEffect, useRef, useState } from "react";
import { getKRXIndex, type KRXIndexRow } from "@/lib/api";

function defaultDate(): string {
  const d = new Date();
  // if Saturday (6) go back 1, if Sunday (0) go back 2
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1);
  if (day === 0) d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

type IndexType = "KOSPI" | "KOSDAQ" | "KRX";

export function KRMarketsTab() {
  const [dateInput, setDateInput] = useState<string>(defaultDate);
  const [indexType, setIndexType] = useState<IndexType>("KOSPI");
  const [rows, setRows] = useState<KRXIndexRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setRows([]);
    getKRXIndex(dateInput.replace(/-/g, ""), indexType, ctrl.signal)
      .then(res => { if (!ctrl.signal.aborted) setRows(res.rows); })
      .catch(err => { if (err?.name !== "AbortError" && !ctrl.signal.aborted) setError(String(err)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => { abortRef.current?.abort(); };
  }, [dateInput, indexType]);

  return (
    <div className="p-4 space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Index type buttons */}
        <div className="flex gap-1">
          {(["KOSPI", "KOSDAQ", "KRX"] as IndexType[]).map(type => (
            <button
              key={type}
              onClick={() => setIndexType(type)}
              className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                indexType === type
                  ? "border-accent text-accent bg-accent/10": "text-text-3 hover:text-text-1 border border-transparent"}`}
            >
              {type}
            </button>
          ))}
        </div>
        {/* Date input */}
        <input
          type="date"value={dateInput}
          onChange={e => setDateInput(e.target.value)}
          className="bg-panel-2 border border-border rounded px-2 py-1 text-text-1 text-xs font-data"/>
      </div>

      {/* Table or status */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {loading && (
          <div className="p-4 text-text-3 text-sm">로딩 중…</div>
        )}
        {!loading && error && (
          <div className="p-4 text-neg text-sm">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="p-4 text-text-3 text-sm">데이터 없음 (장 마감일 또는 공휴일)</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left px-4 py-2 text-text-3 uppercase tracking-wider text-[10px]">지수명</th>
                <th className="text-right px-4 py-2 text-text-3 uppercase tracking-wider text-[10px]">종가</th>
                <th className="text-right px-4 py-2 text-text-3 uppercase tracking-wider text-[10px]">전일대비</th>
                <th className="text-right px-4 py-2 text-text-3 uppercase tracking-wider text-[10px]">등락률</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const fltRt = row.flt_rt ?? 0;
                const fltColor =
                  fltRt > 0 ? "text-pos" : fltRt < 0 ? "text-neg" : "text-text-3";
                const vs = row.vs ?? 0;
                const vsSign = vs > 0 ? "+" : "";
                return (
                  <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
                    <td className="px-4 py-2 text-text-1">{row.idx_nm ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-text-1 font-data">
                      {row.clpr != null ? row.clpr.toLocaleString() : "—"}
                    </td>
                    <td className={`px-4 py-2 text-right font-data ${fltColor}`}>
                      {row.vs != null ? `${vsSign}${vs.toLocaleString()}` : "—"}
                    </td>
                    <td className={`px-4 py-2 text-right font-data ${fltColor}`}>
                      {row.flt_rt != null ? `${fltRt > 0 ? "+" : ""}${fltRt.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
