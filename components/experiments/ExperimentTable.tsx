"use client";

import { useState } from "react";
import type { Experiment } from "@/lib/experiment-storage";

interface ExperimentTableProps {
  experiments: Experiment[];
  selected: string[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNotesUpdate: (id: string, notes: string) => void;
}

type SortKey = "timestamp" | "sharpe" | "winRate" | "totalPnlPct" | "maxDrawdown";

function NoteCell({
  experiment,
  onUpdate,
}: {
  experiment: Experiment;
  onUpdate: (notes: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(experiment.notes);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { onUpdate(value); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { onUpdate(value); setEditing(false); }
          if (e.key === "Escape") { setValue(experiment.notes); setEditing(false); }
        }}
        className="w-full bg-panel-2 border border-border text-text-1 text-xs px-1.5 py-0.5 rounded outline-none focus:border-border"placeholder="메모 추가…"/>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-text-3 text-xs italic cursor-text hover:text-text-2 transition-colors block truncate max-w-[160px]">
      {value || "메모 추가…"}
    </span>
  );
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(2);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function ExperimentTable({
  experiments, selected, onSelect, onDelete, onNotesUpdate,
}: ExperimentTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(a => !a);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = experiments.filter(e =>
    search === "" ||
    e.label.toLowerCase().includes(search.toLowerCase()) ||
    e.params.instrumentId.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va: number, vb: number;
    switch (sortKey) {
      case "timestamp":   va = a.timestamp;                          vb = b.timestamp; break;
      case "sharpe":      va = a.metrics.sharpe ?? -Infinity;        vb = b.metrics.sharpe ?? -Infinity; break;
      case "winRate":     va = a.metrics.winRate ?? -Infinity;       vb = b.metrics.winRate ?? -Infinity; break;
      case "totalPnlPct": va = a.metrics.totalPnlPct ?? -Infinity;   vb = b.metrics.totalPnlPct ?? -Infinity; break;
      case "maxDrawdown": va = a.metrics.maxDrawdown ?? -Infinity;   vb = b.metrics.maxDrawdown ?? -Infinity; break;
      default:            va = 0; vb = 0;
    }
    return sortAsc ? va - vb : vb - va;
  });

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`text-left text-[10px] uppercase tracking-wider font-normal bg-transparent border-0 cursor-pointer transition-colors ${
          active ? "text-text-1" : "text-text-3 hover:text-text-2"}`}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </button>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="text-center py-12 text-text-3 text-sm">
        아직 실험이 없습니다. 백테스트를 실행하면 첫 실험이 저장됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + info */}
      <div className="flex items-center gap-3">
        <input
          type="text"value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="라벨 또는 종목으로 검색…"className="h-8 w-64 px-3 text-xs bg-panel-2 border border-border rounded-md text-text-1 placeholder:text-text-3 outline-none focus:border-border"/>
        <span className="text-text-3 text-xs font-data">{filtered.length} / {experiments.length}</span>
        {selected.length > 0 && (
          <span className="text-info text-xs">비교용으로 {selected.length}개 선택됨</span>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-panel-2 border-b border-border">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left"><SortBtn label="라벨" k="timestamp" /></th>
              <th className="px-3 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">기간</th>
              <th className="px-3 py-2 text-right"><SortBtn label="샤프" k="sharpe" /></th>
              <th className="px-3 py-2 text-right"><SortBtn label="승률" k="winRate" /></th>
              <th className="px-3 py-2 text-right"><SortBtn label="수익률" k="totalPnlPct" /></th>
              <th className="px-3 py-2 text-right"><SortBtn label="최대낙폭" k="maxDrawdown" /></th>
              <th className="px-3 py-2 text-right text-text-3 font-normal text-[10px] uppercase tracking-wider">거래수</th>
              <th className="px-3 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">메모</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(exp => {
              const isSelected = selected.includes(exp.id);
              return (
                <tr
                  key={exp.id}
                  className={`border-b border-border/40 transition-colors ${
                    isSelected ? "bg-panel-2/60" : "hover:bg-panel-2/40"}`}
                >
                  {/* Compare checkbox */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"checked={isSelected}
                      onChange={() => onSelect(exp.id)}
                      className="cursor-pointer"/>
                  </td>

                  {/* Label + timestamp */}
                  <td className="px-3 py-2">
                    <div className="text-text-1 font-medium truncate max-w-[200px]">{exp.label}</div>
                    <div className="text-text-3 text-[9px] font-data mt-0.5">{timeAgo(exp.timestamp)}</div>
                  </td>

                  {/* Period */}
                  <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">
                    {exp.params.start} – {exp.params.end}
                  </td>

                  {/* Metrics */}
                  <td className="px-3 py-2 text-right font-data">
                    <span className={exp.metrics.sharpe !== null && exp.metrics.sharpe > 0 ? "text-pos" : "text-neg"}>
                      {fmtNum(exp.metrics.sharpe)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-data text-text-2">
                    {fmtPct(exp.metrics.winRate)}
                  </td>
                  <td className="px-3 py-2 text-right font-data">
                    <span className={exp.metrics.totalPnlPct !== null && exp.metrics.totalPnlPct > 0 ? "text-pos" : "text-neg"}>
                      {fmtPct(exp.metrics.totalPnlPct)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-data text-neg">
                    {fmtPct(exp.metrics.maxDrawdown)}
                  </td>
                  <td className="px-3 py-2 text-right font-data text-text-3">
                    {exp.metrics.totalTrades}
                  </td>

                  {/* Notes */}
                  <td className="px-3 py-2">
                    <NoteCell experiment={exp} onUpdate={notes => onNotesUpdate(exp.id, notes)} />
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onDelete(exp.id)}
                      className="text-text-3 hover:text-neg text-xs bg-transparent border-0 cursor-pointer transition-colors p-0"title="실험 삭제">
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
