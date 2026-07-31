"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  ApiError,
  getFuturesPrice, getFuturesRoll, getFuturesCalendar,
  type FuturesPriceResponse, type FuturesRollResponse, type FuturesRollRow,
  type FuturesCalendarResponse,
} from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TOKEN } from "@/lib/chart-colors";

type Tab = "pricer" | "curve" | "roll";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt4(v: number): string { return v.toFixed(4); }
function fmt2(v: number): string { return v.toFixed(2); }

function structureCls(s: string): string {
  if (s === "contango") return "text-warn";
  if (s === "backwardation") return "text-info";
  return "text-text-3";
}

function rollCostCls(v: number): string {
  return v > 0 ? "bg-neg/20 text-neg" : v < 0 ? "bg-pos/20 text-pos" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">오류: {msg}</p> : null;
}

// ── Shared input row ──────────────────────────────────────────────────────────

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
    <Panel className="p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {fields.map(({ label, value, set }) => (
          <div key={label} className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
            <input
              type="number"value={value}
              onChange={e => set(e.target.value)}
              step="any"className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"/>
          </div>
        ))}
        <button
          onClick={onCompute}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end">
          {loading ? "계산 중…" : "계산"}
        </button>
      </div>
    </Panel>
  );
}

// ── Pricer Tab ────────────────────────────────────────────────────────────────

const PRICER_ROWS: { label: string; key: keyof FuturesPriceResponse; fmt: (v: number) => string; desc: string }[] = [
  { label: "선물 가격",         key: "price",            fmt: fmt4, desc: "F = S · e^((r-q)·T)" },
  { label: "베이시스",          key: "basis",            fmt: fmt4, desc: "F − S" },
  { label: "베이시스 %",        key: "basis_pct",        fmt: fmt2, desc: "(F − S) / S × 100" },
  { label: "연환산 캐리 %",     key: "annualized_carry", fmt: fmt2, desc: "(r − q) × 100" },
];

function PricerTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [expiryDays, setExpiryDays] = useState("30");
  const [result, setResult] = useState<FuturesPriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesPrice(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield),
        parseInt(expiryDays, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "실패");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "현물가 (S)", value: spot, set: setSpot },
          { label: "금리 (r)", value: rate, set: setRate },
          { label: "편의수익률 (q)", value: convYield, set: setConvYield },
          { label: "만기 (일)", value: expiryDays, set: setExpiryDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      <Panel>
        <PanelHeader right={result && (
          <span className={structureCls(result.market_structure)}>
            {result.market_structure}
          </span>
        )}>
          선물 가격계산기
        </PanelHeader>
        <table className="border-collapse w-full">
          <tbody>
            {PRICER_ROWS.map(row => {
              const v = result ? (result[row.key] as number) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[220px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-32 ${loading ? "text-text-3/30" : v !== null ? (v >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg") : "text-text-3"}`}>
                    {loading ? "…" : v !== null ? row.fmt(v) : "—"}
                  </td>
                  <td className="px-4 py-2 text-text-3 text-xs">{row.desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ── Roll Tab ──────────────────────────────────────────────────────────────────

function RollTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [frontDays, setFrontDays] = useState("30");
  const [result, setResult] = useState<FuturesRollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesRoll(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield),
        parseInt(frontDays, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "실패");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "현물가 (S)", value: spot, set: setSpot },
          { label: "금리 (r)", value: rate, set: setRate },
          { label: "편의수익률 (q)", value: convYield, set: setConvYield },
          { label: "근월물 (일)", value: frontDays, set: setFrontDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border text-text-3">
                <th className="px-3 py-2 text-left font-medium">롤오버</th>
                <th className="px-3 py-2 text-right font-medium">근월물 F</th>
                <th className="px-3 py-2 text-right font-medium">원월물 F</th>
                <th className="px-3 py-2 text-right font-medium">롤 비용</th>
                <th className="px-3 py-2 text-right font-medium">비용 %</th>
                <th className="px-3 py-2 text-right font-medium">연환산 수익률 %</th>
                <th className="px-3 py-2 text-right font-medium">롤까지 일수</th>
              </tr>
            </thead>
            <tbody>
              {result.rolls.map((row: FuturesRollRow) => (
                <tr key={row.back_days} className="border-b border-border hover:bg-panel-2">
                  <td className="px-3 py-1.5 text-text-2">
                    {result.front_days}d → {row.back_days}d
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmt4(row.front_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmt4(row.back_price)}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${rollCostCls(row.roll_cost)}`}>
                    {row.roll_cost > 0 ? "+" : ""}{fmt4(row.roll_cost)}
                  </td>
                  <td className={`px-3 py-1.5 text-right ${rollCostCls(row.roll_cost_pct)}`}>
                    {row.roll_cost_pct > 0 ? "+" : ""}{fmt2(row.roll_cost_pct)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${rollCostCls(-row.annualized_roll_yield)}`}>
                    {row.annualized_roll_yield > 0 ? "+" : ""}{fmt2(row.annualized_roll_yield)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-3">{row.days_to_roll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          파라미터를 입력하고 계산을 클릭하면 롤오버 비용을 확인할 수 있습니다.
        </div>
      )}
    </div>
  );
}

// ── Curve Tab ─────────────────────────────────────────────────────────────────

function CurveTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [result, setResult] = useState<FuturesCalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesCalendar(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "실패");
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
    const margin = { top: 20, right: 20, bottom: 48, left: 64 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const { rows } = result;
    const spotVal = result.spot;

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.expiry_days)!])
      .range([0, innerW]);

    const allPrices = [...rows.map(d => d.price), spotVal];
    const yMin = d3.min(allPrices)! * 0.999;
    const yMax = d3.max(allPrices)! * 1.001;
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    // Fill area between spot line and curve
    const isContango = rows[0]?.market_structure === "contango";
    const fillColor = isContango ? TOKEN.neg : TOKEN.pos;

    const area = d3.area<typeof rows[0]>()
      .x(d => xScale(d.expiry_days))
      .y0(yScale(spotVal))
      .y1(d => yScale(d.price))
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
      .attr("stroke", TOKEN.text2)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");

    g.append("text")
      .attr("x", -6).attr("y", yScale(spotVal) + 4)
      .attr("text-anchor", "end")
      .attr("fill", TOKEN.text2)
      .attr("font-size", 10)
      .text(`S=${spotVal}`);

    // Futures curve line
    const line = d3.line<typeof rows[0]>()
      .x(d => xScale(d.expiry_days))
      .y(d => yScale(d.price))
      .curve(d3.curveCatmullRom);

    g.append("path")
      .datum(rows)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", fillColor)
      .attr("stroke-width", 2);

    // Dots + labels at each expiry
    rows.forEach(d => {
      g.append("circle")
        .attr("cx", xScale(d.expiry_days))
        .attr("cy", yScale(d.price))
        .attr("r", 3.5)
        .attr("fill", fillColor);

      g.append("text")
        .attr("x", xScale(d.expiry_days))
        .attr("y", yScale(d.price) - 8)
        .attr("text-anchor", "middle")
        .attr("fill", TOKEN.text2)
        .attr("font-size", 9)
        .text(d.price.toFixed(2));
    });

    // x-axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickValues(rows.map(r => r.expiry_days)).tickFormat(d => `${d}d`))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", TOKEN.text2).attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // y-axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => String(d)))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", TOKEN.text2).attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").attr("stroke", TOKEN.border).attr("x2", innerW));

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2).attr("y", innerH + 38)
      .attr("text-anchor", "middle").attr("fill", TOKEN.text2).attr("font-size", 11)
      .text("만기 (일)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -50)
      .attr("text-anchor", "middle").attr("fill", TOKEN.text2).attr("font-size", 11)
      .text("선물 가격");

  }, [result]);

  const structure = result?.rows[0]?.market_structure ?? null;

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "현물가 (S)", value: spot, set: setSpot },
          { label: "금리 (r)", value: rate, set: setRate },
          { label: "편의수익률 (q)", value: convYield, set: setConvYield },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      {result && (
        <Panel>
          <PanelHeader right={structure && (
            <span className={structureCls(structure)}>
              {structure}
            </span>
          )}>
            기간구조 — 현물 {result.spot}
          </PanelHeader>
          <div className="p-4">
            <svg ref={svgRef} width={560} height={280} className="block" />
          </div>
        </Panel>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          파라미터를 입력하고 계산을 클릭하면 기간구조 커브를 확인할 수 있습니다.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "pricer", label: "가격계산기" },
  { id: "curve",  label: "커브" },
  { id: "roll",   label: "롤오버" },
];

export default function FuturesPage() {
  const [tab, setTab] = useState<Tab>("pricer");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div className="mb-4">
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">선물</h1>
        <p className="text-text-3 text-sm mt-0.5">선물 만기 캘린더, 롤 전략, 일별 정산가를 조회합니다.</p>
      </div>

      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-1.5 text-sm cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
              tab === t.id
                ? "border-accent text-accent font-bold": "border-transparent text-text-3 font-normal hover:text-text-1"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pricer" && <PricerTab />}
      {tab === "roll"&& <RollTab />}
      {tab === "curve"&& <CurveTab />}
    </div>
  );
}
