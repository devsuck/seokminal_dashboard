import type { BarOut } from "@/lib/api";

export interface EventInput {
  date: string;   // YYYY-MM-DD
  label: string;
}

export interface EventWindow {
  eventDate: string;
  label: string;
  returns: (number | null)[];   // length = 2*windowDays+1; null when bar missing
}

export interface EventStudyStats {
  eventCount: number;
  windowDays: number;
  avgReturns: (number | null)[];    // avg at each position across all non-null events
  medianReturns: (number | null)[];
  hitRate: number | null;           // fraction of events with return > 0 at last position (+windowDays)
  maxReturn: number | null;         // max return at last position
  minReturn: number | null;         // min return at last position
}

export interface EventStudyResult {
  windows: EventWindow[];
  stats: EventStudyStats;
  dayLabels: string[];   // ["-5","-4",...,"0",...,"+5"] length = 2*windowDays+1
}

export function computeEventStudy(
  bars: BarOut[],
  events: EventInput[],
  windowDays: number,
): EventStudyResult {
  // 1. Sort bars by ts_event ascending, convert ts_event to YYYY-MM-DD
  const sortedBars = [...bars].sort((a, b) => a.ts_event - b.ts_event);
  const barDates = sortedBars.map(b =>
    new Date(b.ts_event / 1e6).toISOString().slice(0, 10)
  );
  const dateToIdx = new Map(barDates.map((d, i) => [d, i]));

  // 2. Day labels array
  const len = 2 * windowDays + 1;
  const dayLabels: string[] = Array.from({ length: len }, (_, i) => {
    const d = i - windowDays;
    return d === 0 ? "0" : d > 0 ? `+${d}` : `${d}`;
  });

  // 3. For each event, compute cumulative returns
  const windows: EventWindow[] = [];
  for (const event of events) {
    const idx = dateToIdx.get(event.date);
    if (idx === undefined || idx < 1) {
      // No bar on event date or not enough history for base price
      windows.push({ eventDate: event.date, label: event.label, returns: Array(len).fill(null) });
      continue;
    }
    const basePx = sortedBars[idx - 1].close;  // close of day before event
    if (basePx === 0 || basePx === null) {
      windows.push({ eventDate: event.date, label: event.label, returns: Array(len).fill(null) });
      continue;
    }
    const returns: (number | null)[] = Array(len).fill(null);
    for (let k = -windowDays; k <= windowDays; k++) {
      const barIdx = idx + k;
      if (barIdx >= 0 && barIdx < sortedBars.length) {
        returns[k + windowDays] = (sortedBars[barIdx].close - basePx) / basePx;
      }
    }
    windows.push({ eventDate: event.date, label: event.label, returns });
  }

  // 4. Aggregate stats per position
  const avgReturns: (number | null)[] = [];
  const medianReturns: (number | null)[] = [];
  for (let pos = 0; pos < len; pos++) {
    const vals = windows.map(w => w.returns[pos]).filter((v): v is number => v !== null);
    if (vals.length === 0) { avgReturns.push(null); medianReturns.push(null); continue; }
    avgReturns.push(vals.reduce((s, v) => s + v, 0) / vals.length);
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianReturns.push(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
  }

  // 5. HitRate at last position (+windowDays)
  const lastPos = len - 1;
  const lastVals = windows.map(w => w.returns[lastPos]).filter((v): v is number => v !== null);
  const hitRate = lastVals.length === 0 ? null : lastVals.filter(v => v > 0).length / lastVals.length;
  const maxReturn = lastVals.length === 0 ? null : Math.max(...lastVals);
  const minReturn = lastVals.length === 0 ? null : Math.min(...lastVals);

  return {
    windows,
    stats: { eventCount: windows.length, windowDays, avgReturns, medianReturns, hitRate, maxReturn, minReturn },
    dayLabels,
  };
}
