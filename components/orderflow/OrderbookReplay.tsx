"use client";

import { useOrderbookReplay } from "@/hooks/useOrderbookReplay";
import { ReplayLadder } from "@/components/orderflow/ReplayLadder";

function formatClockFromEpoch(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("ko-KR", { hour12: false });
}

export function OrderbookReplay({ symbol }: { symbol: string }) {
  const { dates, selectedDate, setSelectedDate, snapshots, truncated, loading, index, setIndex, current, playing, play, pause } =
    useOrderbookReplay(symbol);

  return (
    <div className="bg-panel border border-border rounded flex flex-col h-[560px]">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0">
        <select
          className="bg-panel-2 border border-border rounded px-2 py-1 text-xs text-text-1"
          value={selectedDate ?? ""}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={dates.length === 0}
        >
          {dates.length === 0 && <option value="">저장된 날짜 없음</option>}
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="px-2 py-1 rounded border border-border text-xs text-text-1 disabled:opacity-40"
          onClick={playing ? pause : play}
          disabled={snapshots.length === 0}
        >
          {playing ? "일시정지" : "재생"}
        </button>
        <input
          type="range"
          className="flex-1"
          min={0}
          max={Math.max(0, snapshots.length - 1)}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          disabled={snapshots.length === 0}
        />
        <span className="text-text-3 text-xs w-24 text-right shrink-0">
          {current ? `${formatClockFromEpoch(current.ts)} (${index + 1}/${snapshots.length})` : "-"}
        </span>
      </div>
      {truncated && (
        <div className="px-3 py-1 text-xs text-warn border-b border-border shrink-0">
          해당 날짜 스냅샷이 많아 일부만 불러왔습니다.
        </div>
      )}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-3 text-xs">불러오는 중...</div>
        ) : (
          <ReplayLadder snapshot={current} />
        )}
      </div>
    </div>
  );
}
