"use client";

import { useState, useRef, useEffect } from "react";
import {
  getRisk,
  getBeta,
  getTimeSeries,
  getRollingBeta,
  ApiError,
  type RiskMetricsResponse,
  type BetaResponse,
  type TimeSeriesPoint,
  type RollingBetaResponse,
} from "@/lib/api";
import { MetricCard } from "@/components/ui/MetricCard";
import { DrawdownChart } from "@/components/risk/DrawdownChart";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PageBanner } from "@/components/PageBanner";

const BENCHMARKS = [
  { value: "SPY.ARCA", label: "SPY" },
  { value: "QQQ.NASDAQ", label: "QQQ" },
  { value: "KOSPI.KRX", label: "KOSPI" },
];

const TABS = ["Metrics", "Drawdown", "Rolling Beta"] as const;
type Tab = (typeof TABS)[number];

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtNum(v: number | null | undefined, digits = 3): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}
function colCls(v: number | null | undefined): string {
  if (v == null) return "text-text-3";
  return v >= 0 ? "text-pos" : "text-neg";
}

export default function RiskPage() {
  const [tab, setTab] = useState<Tab>("Metrics");
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [benchmarkId, setBenchmarkId] = useState("SPY.ARCA");
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2026-06-01");
  const [betaWindow, setBetaWindow] = useState(30);

  const [riskData, setRiskData] = useState<RiskMetricsResponse | null>(null);
  const [betaData, setBetaData] = useState<BetaResponse | null>(null);
  const [tsPoints, setTsPoints] = useState<TimeSeriesPoint[]>([]);
  const [rollingData, setRollingData] = useState<RollingBetaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const [risk, beta, ts, rolling] = await Promise.all([
        getRisk(instrumentId, start, end, benchmarkId, ctrl.signal),
        getBeta(instrumentId, benchmarkId, start, end, ctrl.signal),
        getTimeSeries(instrumentId, start, end, benchmarkId, 60, ctrl.signal),
        getRollingBeta(instrumentId, benchmarkId, start, end, betaWindow, ctrl.signal),
      ]);
      setRiskData(risk);
      setBetaData(beta);
      setTsPoints(ts.points);
      setRollingData(rolling);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Fetch failed");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const betaSeries: RollingSeries[] = rollingData
    ? [
        {
          label: "Beta",
          color: "#FF9F1C",
          points: rollingData.points.map((p) => ({ ts_ns: p.ts_ns, value: p.beta })),
        },
        {
          label: "Correlation",
          color: "#60A5FA",
          points: rollingData.points.map((p) => ({ ts_ns: p.ts_ns, value: p.correlation })),
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-bg p-6">
      <PageBanner pageKey="risk" />

      {/* Config panel */}
      <div className="bg-panel border border-border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
        <span className="text-text-3 text-xs uppercase tracking-wider">Instrument</span>
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-text-3 text-xs uppercase tracking-wider">Benchmark</span>
        <select
          value={benchmarkId}
          onChange={(e) => setBenchmarkId(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
        >
          {BENCHMARKS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
        <span className="text-text-3 text-xs uppercase tracking-wider">β Window</span>
        <input
          type="number"
          value={betaWindow}
          min={5}
          onChange={(e) => setBetaWindow(Number(e.target.value))}
          className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm font-data w-16"
        />
        <button
          onClick={run}
          disabled={loading}
          className="bg-accent text-black rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {error && <p className="text-neg text-sm mb-3">{error}</p>}

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-accent text-accent bg-accent/10"
                : "border-transparent text-text-3 hover:text-text-2"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Metrics tab ── */}
      {tab === "Metrics" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
            <MetricCard
              label="Ann. Return"
              value={fmtPct(riskData?.annualized_return)}
              colorClass={colCls(riskData?.annualized_return)}
            />
            <MetricCard
              label="Volatility"
              value={fmtPct(riskData?.volatility)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="Sharpe"
              value={fmtNum(riskData?.sharpe_ratio)}
              colorClass={colCls(riskData?.sharpe_ratio)}
            />
            <MetricCard
              label="Sortino"
              value={fmtNum(riskData?.sortino_ratio)}
              colorClass={colCls(riskData?.sortino_ratio)}
            />
            <MetricCard
              label="Max Drawdown"
              value={fmtPct(riskData?.max_drawdown)}
              colorClass={riskData?.max_drawdown != null ? "text-neg" : "text-text-3"}
            />
            <MetricCard
              label="VaR 95% (1d)"
              value={fmtPct(riskData?.var_95, 3)}
              colorClass={riskData?.var_95 != null ? "text-neg" : "text-text-3"}
            />
            <MetricCard
              label="Calmar"
              value={fmtNum(riskData?.calmar_ratio)}
              colorClass={colCls(riskData?.calmar_ratio)}
            />
            <MetricCard
              label="Alpha (Ann.)"
              value={fmtPct(riskData?.alpha)}
              colorClass={colCls(riskData?.alpha)}
            />
            <MetricCard
              label="Beta"
              value={fmtNum(betaData?.beta)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="Correlation"
              value={fmtNum(betaData?.correlation)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="R²"
              value={fmtNum(riskData?.r_squared)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="Observations"
              value={riskData ? String(riskData.observation_count) : "—"}
              colorClass="text-text-3"
            />
          </div>
          {!riskData && !loading && (
            <p className="text-text-3 text-sm">
              Configure inputs above and click Run to see metrics.
            </p>
          )}
        </div>
      )}

      {/* ── Drawdown tab ── */}
      {tab === "Drawdown" && (
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-accent inline-block rounded" />
              <span className="text-text-2 text-xs">Instrument</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-px inline-block" style={{ backgroundColor: "#4B5563" }} />
              <span className="text-text-2 text-xs">Benchmark</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-2.5 bg-neg/20 border border-neg inline-block rounded-sm" />
              <span className="text-text-2 text-xs">Drawdown</span>
            </span>
          </div>
          {tsPoints.length >= 2 ? (
            <DrawdownChart points={tsPoints} height={320} />
          ) : (
            <div
              className="flex items-center justify-center text-text-3 text-sm border border-border rounded"
              style={{ height: 320 }}
            >
              {loading ? "Loading…" : "Click Run to load chart."}
            </div>
          )}
        </div>
      )}

      {/* ── Rolling Beta tab ── */}
      {tab === "Rolling Beta" && (
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 inline-block rounded" style={{ backgroundColor: "#FF9F1C" }} />
              <span className="text-text-2 text-xs">Beta</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 inline-block rounded" style={{ backgroundColor: "#60A5FA" }} />
              <span className="text-text-2 text-xs">Correlation</span>
            </span>
          </div>
          {betaSeries.length > 0 && betaSeries[0].points.length > 0 ? (
            <RollingChart
              series={betaSeries}
              height={300}
              yFormat={(v) => v.toFixed(3)}
            />
          ) : (
            <div
              className="flex items-center justify-center text-text-3 text-sm border border-border rounded"
              style={{ height: 300 }}
            >
              {loading ? "Loading…" : "Click Run to load chart."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
