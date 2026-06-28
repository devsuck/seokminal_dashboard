"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  ApiError,
  getForexForward, getForexCarry, getForexCurve,
  type ForexForwardResponse, type ForexCarryResponse, type ForexCurveResponse,
} from "@/lib/api";

type Tab = "forward" | "curve" | "carry";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt6(v: number): string { return v.toFixed(6); }
function fmt4(v: number): string { return v.toFixed(4); }

function structureCls(s: string): string {
  if (s === "premium")  return "text-pos";
  if (s === "discount") return "text-neg";
  return "text-text-3";
}

function signCls(v: number): string {
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">ERR: {msg}</p> : null;
}

// ── Shared input row ───────────────────────────────────────────────────────────

function InputRow({
  fields,
  onCompute,
  loading,
}: {
  fields: { label: string; value: string; set: (v: string) => void }[];
  onCompute: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {fields.map(({ label, value, set }) => (
          <div key={label} className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
            <input
              type="number"
              value={value}
              onChange={e => set(e.target.value)}
              step="any"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"
            />
          </div>
        ))}
        <button
          onClick={onCompute}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {loading ? "Computing…" : "Compute"}
        </button>
      </div>
    </div>
  );
}

// ── Forward Tab ───────────────────────────────────────────────────────────────

const FORWARD_ROWS: {
  label: string;
  key: "forward" | "forward_points" | "forward_points_pct" | "annualized_differential";
  fmt: (v: number) => string;
  desc: string;
}[] = [
  { label: "Forward Rate",         key: "forward",                fmt: fmt6, desc: "F = S · e^((r_d−r_f)·T)" },
  { label: "Forward Points",       key: "forward_points",         fmt: fmt6, desc: "F − S" },
  { label: "Fwd Points %",         key: "forward_points_pct",     fmt: fmt4, desc: "(F − S) / S × 100" },
  { label: "Ann. Differential %",  key: "annualized_differential",fmt: fmt4, desc: "(r_d − r_f) × 100" },
];

function ForwardTab() {
  const [spot, setSpot]       = useState("1.10");
  const [rDom, setRDom]       = useState("0.05");
  const [rFor, setRFor]       = useState("0.03");
  const [days, setDays]       = useState("90");
  const [result, setResult]   = useState<ForexForwardResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getForexForward(
        parseFloat(spot), parseFloat(rDom), parseFloat(rFor),
        parseInt(days, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)",        value: spot, set: setSpot },
          { label: "Rate Dom. (r_d)", value: rDom, set: setRDom },
          { label: "Rate For. (r_f)", value: rFor, set: setRFor },
          { label: "Days (T)",        value: days, set: setDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">FX Forward Pricer</span>
          {result && (
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${structureCls(result.market_structure)}`}>
              {result.market_structure}
            </span>
          )}
        </div>
        <table className="border-collapse w-full">
          <tbody>
            {FORWARD_ROWS.map(row => {
              const v = result ? result[row.key] : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[240px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-36 ${
                    loading ? "text-text-3/30" : v !== null ? signCls(v) : "text-text-3"
                  }`}>
                    {loading ? "…" : v !== null ? row.fmt(v) : "—"}
                  </td>
                  <td className="px-4 py-2 text-text-3 text-xs">{row.desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Carry Tab ─────────────────────────────────────────────────────────────────

const CARRY_ROWS: {
  label: string;
  key: "forward" | "carry_rate" | "net_carry_pct" | "breakeven_move_pct" | "uip_expected_move_pct";
  fmt: (v: number) => string;
  cls: (v: number) => string;
  desc: string;
}[] = [
  { label: "Forward Rate",         key: "forward",               fmt: fmt6, cls: () => "text-text-1", desc: "F = S · e^((r_d−r_f)·T)" },
  { label: "Carry Rate (Ann.) %",  key: "carry_rate",            fmt: fmt4, cls: signCls,              desc: "(r_d − r_f) × 100" },
  { label: "Net Carry %",          key: "net_carry_pct",         fmt: fmt4, cls: signCls,              desc: "carry_rate × T" },
  { label: "Breakeven Move %",     key: "breakeven_move_pct",    fmt: fmt4, cls: () => "text-text-2",  desc: "spot move that wipes carry" },
  { label: "UIP Expected Move %",  key: "uip_expected_move_pct", fmt: fmt4, cls: (v) => v > 0 ? "text-neg" : v < 0 ? "text-pos" : "text-text-3", desc: "(F − S) / S × 100" },
];

function CarryTab() {
  const [spot, setSpot]       = useState("1.10");
  const [rDom, setRDom]       = useState("0.05");
  const [rFor, setRFor]       = useState("0.03");
  const [days, setDays]       = useState("365");
  const [result, setResult]   = useState<ForexCarryResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getForexCarry(
        parseFloat(spot), parseFloat(rDom), parseFloat(rFor),
        parseInt(days, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)",        value: spot, set: setSpot },
          { label: "Rate Dom. (r_d)", value: rDom, set: setRDom },
          { label: "Rate For. (r_f)", value: rFor, set: setRFor },
          { label: "Days (T)",        value: days, set: setDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Carry Analysis</span>
          {result && (
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${result.favorable ? "text-pos" : "text-neg"}`}>
              {result.favorable ? "FAVORABLE" : "UNFAVORABLE"}
            </span>
          )}
        </div>
        <table className="border-collapse w-full">
          <tbody>
            {CARRY_ROWS.map(row => {
              const v = result ? result[row.key] : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[240px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-36 ${
                    loading ? "text-text-3/30" : v !== null ? row.cls(v) : "text-text-3"
                  }`}>
                    {loading ? "…" : v !== null ? row.fmt(v) : "—"}
                  </td>
                  <td className="px-4 py-2 text-text-3 text-xs">{row.desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Curve Tab ─────────────────────────────────────────────────────────────────

function CurveTab() {
  const [spot, setSpot]       = useState("1.10");
  const [rDom, setRDom]       = useState("0.05");
  const [rFor, setRFor]       = useState("0.03");
  const [result, setResult]   = useState<ForexCurveResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);
  const svgRef                = useRef<SVGSVGElement | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getForexCurve(
        parseFloat(spot), parseFloat(rDom), parseFloat(rFor), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const W = 560, H = 280;
    const margin = { top: 20, right: 20, bottom: 48, left: 72 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const { rows } = result;
    const spotVal = result.spot;

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.tenor_days)!])
      .range([0, innerW]);

    const allPrices = [...rows.map(d => d.forward), spotVal];
    const yMin = d3.min(allPrices)! * 0.999;
    const yMax = d3.max(allPrices)! * 1.001;
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    // Color: premium (r_d > r_f) = green, discount = red
    const isPremium = rows[0]?.market_structure === "premium";
    const fillColor = isPremium ? "#44cc88" : "#ff4444";

    // Fill area between spot and forward curve
    const area = d3.area<typeof rows[0]>()
      .x(d => xScale(d.tenor_days))
      .y0(yScale(spotVal))
      .y1(d => yScale(d.forward))
      .curve(d3.curveCatmullRom);

    g.append("path")
      .datum(rows)
      .attr("d", area)
      .attr("fill", fillColor)
      .attr("opacity", 0.15);

    // Spot price horizontal dashed reference line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(spotVal)).attr("y2", yScale(spotVal))
      .attr("stroke", "#9AA4B2")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");

    g.append("text")
      .attr("x", -6).attr("y", yScale(spotVal) + 4)
      .attr("text-anchor", "end")
      .attr("fill", "#9AA4B2")
      .attr("font-size", 10)
      .text(`S=${spotVal}`);

    // Forward curve line
    const line = d3.line<typeof rows[0]>()
      .x(d => xScale(d.tenor_days))
      .y(d => yScale(d.forward))
      .curve(d3.curveCatmullRom);

    g.append("path")
      .datum(rows)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", fillColor)
      .attr("stroke-width", 2);

    // Dots + forward rate labels at each tenor
    rows.forEach(d => {
      g.append("circle")
        .attr("cx", xScale(d.tenor_days))
        .attr("cy", yScale(d.forward))
        .attr("r", 3.5)
        .attr("fill", fillColor);

      g.append("text")
        .attr("x", xScale(d.tenor_days))
        .attr("y", yScale(d.forward) - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "#9AA4B2")
        .attr("font-size", 9)
        .text(d.forward.toFixed(4));
    });

    // x-axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickValues(rows.map(r => r.tenor_days)).tickFormat(d => `${d}d`))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // y-axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => String(d)))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").attr("stroke", "#2a3040").attr("x2", innerW));

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2).attr("y", innerH + 38)
      .attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 11)
      .text("Tenor (days)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -58)
      .attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 11)
      .text("Forward Rate");

  }, [result]);

  const structure = result?.rows[0]?.market_structure ?? null;

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)",        value: spot, set: setSpot },
          { label: "Rate Dom. (r_d)", value: rDom, set: setRDom },
          { label: "Rate For. (r_f)", value: rFor, set: setRFor },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      {result && (
        <div className="bg-bg border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              Forward Curve — Spot {result.spot}
            </span>
            {structure && (
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${structureCls(structure)}`}>
                {structure}
              </span>
            )}
          </div>
          <div className="p-4">
            <svg ref={svgRef} width={560} height={280} className="block" />
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Configure parameters and click Compute to view the forward curve.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "forward", label: "Forward" },
  { id: "curve",   label: "Curve" },
  { id: "carry",   label: "Carry" },
];

export default function ForexPage() {
  const [tab, setTab] = useState<Tab>("forward");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Forex Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Covered Interest Rate Parity pricing, forward curve, and carry trade analysis.
        </p>
      </div>

      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-1.5 text-sm cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
              tab === t.id
                ? "border-accent text-accent font-bold"
                : "border-transparent text-text-3 font-normal hover:text-text-1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "forward" && <ForwardTab />}
      {tab === "carry"   && <CarryTab />}
      {tab === "curve"   && <CurveTab />}
    </div>
  );
}
