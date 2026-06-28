"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getBars, ApiError } from "@/lib/api";

interface SourceMeta {
  source: string;
  type: string;
  coverageFrom: string;
  coverageTo: string;
  updateFreq: string;
  corpActions: string;
  notes: string;
}

const STATIC_SOURCES: SourceMeta[] = [
  {
    source: "KIS (KRX)",
    type: "Price / OHLCV",
    coverageFrom: "2020-01-01",
    coverageTo: "Present",
    updateFreq: "Daily",
    corpActions: "No",
    notes: "Korean equities. Requires KIS token.",
  },
  {
    source: "IB (US)",
    type: "Price / OHLCV",
    coverageFrom: "2020-01-01",
    coverageTo: "Present",
    updateFreq: "Daily",
    corpActions: "No",
    notes: "US equities via Interactive Brokers.",
  },
  {
    source: "FRED",
    type: "Macro",
    coverageFrom: "1960+",
    coverageTo: "Present",
    updateFreq: "Monthly / Weekly",
    corpActions: "N/A",
    notes: "14 US macro series.",
  },
  {
    source: "ECOS",
    type: "Macro",
    coverageFrom: "1960+",
    coverageTo: "Present",
    updateFreq: "Monthly",
    corpActions: "N/A",
    notes: "14 Korean macro series (Bank of Korea).",
  },
  {
    source: "SEC EDGAR",
    type: "Fundamentals",
    coverageFrom: "2000+",
    coverageTo: "Present",
    updateFreq: "Annual / Quarterly",
    corpActions: "N/A",
    notes: "US company XBRL filings. Free, no key.",
  },
  {
    source: "FSC (Corp Finance)",
    type: "Fundamentals",
    coverageFrom: "2015+",
    coverageTo: "Present",
    updateFreq: "Annual",
    corpActions: "N/A",
    notes: "Korean corp finance via 금융위원회. crno required.",
  },
  {
    source: "KSD",
    type: "Corporate Events",
    coverageFrom: "Rolling 30d",
    coverageTo: "Present",
    updateFreq: "Daily",
    corpActions: "N/A",
    notes: "Dividend, rights schedule, borrow rank.",
  },
  {
    source: "KRX OpenAPI",
    type: "Market Data",
    coverageFrom: "—",
    coverageTo: "—",
    updateFreq: "Daily",
    corpActions: "N/A",
    notes: "KRX listing, index data. Requires API key approval.",
  },
];

interface CoverageResult {
  instrumentId: string;
  barCount: number;
  firstDate: string | null;
  lastDate: string | null;
  expectedBars: number;
  missingPct: number;
  error: string | null;
}

const COVERAGE_START = "2020-01-01";
const COVERAGE_END = new Date().toISOString().slice(0, 10);
const EXPECTED_BARS = 1300; // ~252 trading days * ~5 years

function calcExpected(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const years = ms / (365.25 * 24 * 3600 * 1000);
  return Math.round(years * 252);
}

export default function DataQualityPage() {
  const [instrumentsInput, setInstrumentsInput] = useState("005930.XKRX, AAPL.NASDAQ");
  const [results, setResults] = useState<CoverageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const check = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const ids = instrumentsInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (ids.length === 0) return;

    setLoading(true);
    setChecked(false);
    setResults([]);

    const expected = calcExpected(COVERAGE_START, COVERAGE_END);

    const settled = await Promise.allSettled(
      ids.map(id => getBars(id, COVERAGE_START, COVERAGE_END, undefined, ctrl.signal))
    );

    if (ctrl.signal.aborted) return;

    const rows: CoverageResult[] = settled.map((r, i) => {
      const id = ids[i];
      if (r.status === "rejected") {
        const err = r.reason;
        return {
          instrumentId: id,
          barCount: 0,
          firstDate: null,
          lastDate: null,
          expectedBars: expected,
          missingPct: 100,
          error: err instanceof ApiError ? err.message : "Failed",
        };
      }
      const bars = r.value.bars;
      const firstDate = bars.length > 0
        ? new Date(Math.floor(bars[0].ts_event / 1e6)).toISOString().slice(0, 10)
        : null;
      const lastDate = bars.length > 0
        ? new Date(Math.floor(bars[bars.length - 1].ts_event / 1e6)).toISOString().slice(0, 10)
        : null;
      const missing = Math.max(0, expected - bars.length);
      const missingPct = expected > 0 ? (missing / expected) * 100 : 0;
      return {
        instrumentId: id,
        barCount: bars.length,
        firstDate,
        lastDate,
        expectedBars: expected,
        missingPct,
        error: null,
      };
    });

    setResults(rows);
    setChecked(true);
    setLoading(false);
  }, [instrumentsInput]);

  function missingColor(pct: number): string {
    if (pct === 0) return "bg-pos";
    if (pct < 10) return "bg-warn";
    return "bg-neg";
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Data Quality Center</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Source metadata and per-instrument bar coverage.
        </p>
      </div>

      {/* Source metadata table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Data Sources</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {["Source", "Type", "From", "To", "Freq", "Corp Actions", "Notes"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-text-3 text-[10px] uppercase tracking-wider font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STATIC_SOURCES.map((s, i) => (
                <tr
                  key={s.source}
                  className={`border-b border-border/50 ${i % 2 === 0 ? "bg-transparent" : "bg-panel-2/30"}`}
                >
                  <td className="px-4 py-2.5 text-text-1 font-medium whitespace-nowrap">{s.source}</td>
                  <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{s.type}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data whitespace-nowrap">{s.coverageFrom}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data whitespace-nowrap">{s.coverageTo}</td>
                  <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{s.updateFreq}</td>
                  <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{s.corpActions}</td>
                  <td className="px-4 py-2.5 text-text-3">{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instrument coverage checker */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">
            Instrument Coverage Check
          </label>
          <p className="text-text-3 text-[11px]">
            Checks {COVERAGE_START} → {COVERAGE_END}. Expected ~{calcExpected(COVERAGE_START, COVERAGE_END)} trading days.
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1 flex-1 min-w-[260px]">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">
              Instrument IDs (comma-separated)
            </label>
            <input
              value={instrumentsInput}
              onChange={e => setInstrumentsInput(e.target.value)}
              placeholder="005930.XKRX, AAPL.NASDAQ"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-full"
            />
          </div>
          <button
            onClick={check}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Check Coverage"}
          </button>
        </div>
      </div>

      {checked && results.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Coverage Results</span>
          </div>
          <div className="divide-y divide-border/50">
            {results.map(r => (
              <div key={r.instrumentId} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-text-1 text-xs font-data font-medium">{r.instrumentId}</span>
                  {r.error ? (
                    <span className="text-neg text-xs">{r.error}</span>
                  ) : (
                    <div className="flex gap-4 text-xs font-data text-text-3 flex-wrap">
                      <span><span className="text-text-2">{r.barCount}</span> bars</span>
                      <span>Expected <span className="text-text-2">{r.expectedBars}</span></span>
                      <span>
                        Missing{" "}
                        <span className={r.missingPct === 0 ? "text-pos" : r.missingPct < 10 ? "text-warn" : "text-neg"}>
                          {r.missingPct.toFixed(1)}%
                        </span>
                      </span>
                      {r.firstDate && (
                        <span>{r.firstDate} → {r.lastDate}</span>
                      )}
                    </div>
                  )}
                </div>
                {!r.error && (
                  <div className="h-2 bg-panel-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${missingColor(r.missingPct)}`}
                      style={{ width: `${Math.min(r.missingPct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!checked && !loading && (
        <div className="text-center py-8 text-text-3 text-sm">
          Enter instrument IDs and click Check Coverage to audit bar data completeness.
        </div>
      )}
    </div>
  );
}
