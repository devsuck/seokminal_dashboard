"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  ApiError,
  getOptionsGreeks, getOptionsChain, getOptionsIvSurface,
  type OptionsGreeksResponse, type OptionsChainResponse, type OptionsChainRow,
  type OptionsIvSurfaceResponse,
} from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedToggle } from "@/components/ui";
import { TOKEN } from "@/lib/chart-colors";

type Tab = "greeks" | "chain" | "surface";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt4(v: number): string { return v.toFixed(4); }
function fmt6(v: number): string { return v.toFixed(6); }

function signCls(v: number): string {
  return v > 0 ? "bg-pos/20 text-pos" : v < 0 ? "bg-neg/20 text-neg" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">오류: {msg}</p> : null;
}

// ── Greeks Tab ───────────────────────────────────────────────────────────────

const GREEK_ROWS: { label: string; key: keyof OptionsGreeksResponse; fmt: (v: number) => string; desc: string }[] = [
  { label: "가격",     key: "price",           fmt: fmt4, desc: "옵션의 이론가" },
  { label: "내재가치", key: "intrinsic_value", fmt: fmt4, desc: "콜은 max(S-K, 0), 풋은 max(K-S, 0)" },
  { label: "시간가치", key: "time_value",      fmt: fmt4, desc: "가격에서 내재가치를 뺀 값" },
  { label: "Delta (Δ)",       key: "delta",           fmt: fmt4, desc: "현물가격이 $1 움직일 때 가격 변화" },
  { label: "Gamma (Γ)",       key: "gamma",           fmt: fmt6, desc: "현물가격이 $1 움직일 때 델타 변화" },
  { label: "Theta (Θ)",       key: "theta",           fmt: fmt4, desc: "하루 경과에 따른 가격 변화" },
  { label: "Vega (ν)",        key: "vega",            fmt: fmt4, desc: "변동성이 1% 변할 때 가격 변화" },
  { label: "Rho (ρ)",         key: "rho",             fmt: fmt4, desc: "금리가 1% 변할 때 가격 변화" },
];

function GreeksTab() {
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [spot, setSpot] = useState("100");
  const [strike, setStrike] = useState("100");
  const [expiryDays, setExpiryDays] = useState("30");
  const [rate, setRate] = useState("0.05");
  const [vol, setVol] = useState("0.20");
  const [result, setResult] = useState<OptionsGreeksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getOptionsGreeks(
        optionType,
        parseFloat(spot), parseFloat(strike),
        parseInt(expiryDays), parseFloat(rate), parseFloat(vol),
        ctrl.signal
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
      {/* Toolbar */}
      <Panel className="p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {/* Option type */}
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">유형</label>
            <SegmentedToggle
              value={optionType}
              onChange={setOptionType}
              size="sm"
              options={[
                { value: "call", label: "콜" },
                { value: "put", label: "풋" },
              ]}
            />
          </div>
          {[
            { label: "현물가 (S)", value: spot, set: setSpot },
            { label: "행사가 (K)", value: strike, set: setStrike },
            { label: "만기 (일)", value: expiryDays, set: setExpiryDays },
            { label: "금리 (r)", value: rate, set: setRate },
            { label: "변동성 (σ)", value: vol, set: setVol },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
              <input
                type="number"value={value}
                onChange={e => set(e.target.value)}
                step="any"className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"/>
            </div>
          ))}
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end">
            {loading ? "계산 중…" : "계산"}
          </button>
        </div>
      </Panel>

      <Err msg={error} />

      {/* Results table */}
      <Panel>
        <PanelHeader>
          {optionType === "call" ? "콜" : "풋"} 옵션 결과
        </PanelHeader>
        <table className="border-collapse w-full">
          <tbody>
            {GREEK_ROWS.map(row => {
              const v = result ? (result[row.key] as number) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[180px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-32 ${loading ? "text-text-3/30" : v !== null ? signCls(v) : "text-text-3"}`}>
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

// ── Chain Tab ─────────────────────────────────────────────────────────────────

function ChainTab() {
  const [spot, setSpot] = useState("100");
  const [expiryDays, setExpiryDays] = useState("30");
  const [rate, setRate] = useState("0.05");
  const [vol, setVol] = useState("0.20");
  const [result, setResult] = useState<OptionsChainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getOptionsChain(
        parseFloat(spot), parseInt(expiryDays), parseFloat(rate), parseFloat(vol),
        ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "실패");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const spotNum = parseFloat(spot) || 100;

  function atmCls(row: OptionsChainRow): string {
    const moneyness = row.strike / spotNum;
    return moneyness > 0.98 && moneyness < 1.02 ? "bg-accent/5" : "";
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {[
            { label: "현물가 (S)", value: spot, set: setSpot },
            { label: "만기 (일)", value: expiryDays, set: setExpiryDays },
            { label: "금리 (r)", value: rate, set: setRate },
            { label: "변동성 (σ)", value: vol, set: setVol },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
              <input
                type="number"value={value}
                onChange={e => set(e.target.value)}
                step="any"className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"/>
            </div>
          ))}
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end">
            {loading ? "계산 중…" : "계산"}
          </button>
        </div>
      </Panel>

      <Err msg={error} />

      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border">
                <th colSpan={5} className="px-3 py-2 text-pos text-center border-r border-border">콜</th>
                <th className="px-3 py-2 text-text-3 text-center font-medium">행사가</th>
                <th colSpan={5} className="px-3 py-2 text-neg text-center border-l border-border">풋</th>
              </tr>
              <tr className="border-b border-border text-text-3">
                {["가격", "Δ", "Γ", "Θ", "ν"].map(h => (
                  <th key={`c-${h}`} className="px-3 py-1.5 text-right font-medium">{h}</th>
                ))}
                <th className="px-3 py-1.5 text-center font-semibold text-text-2 border-x border-border">K</th>
                {["가격", "Δ", "Γ", "Θ", "ν"].map(h => (
                  <th key={`p-${h}`} className="px-3 py-1.5 text-right font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map(row => (
                <tr key={row.strike} className={`border-b border-border hover:bg-panel-2 ${atmCls(row)}`}>
                  <td className="px-3 py-1.5 text-right text-pos">{fmt4(row.call_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.call_delta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmt6(row.call_gamma)}</td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.call_theta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.call_vega)}</td>
                  <td className="px-3 py-1.5 text-center font-semibold text-accent border-x border-border">
                    {row.strike}
                  </td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.put_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.put_delta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmt6(row.put_gamma)}</td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.put_theta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.put_vega)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          파라미터를 설정하고 계산 버튼을 눌러 옵션체인을 확인하세요.
        </div>
      )}
    </div>
  );
}

// ── IV Surface Tab ────────────────────────────────────────────────────────────

function IvSurfaceTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [atmVol, setAtmVol] = useState("0.20");
  const [result, setResult] = useState<OptionsIvSurfaceResponse | null>(null);
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
      setResult(await getOptionsIvSurface(
        parseFloat(spot), parseFloat(rate), parseFloat(atmVol),
        undefined, undefined, ctrl.signal
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

    const W = 560, H = 300;
    const margin = { top: 30, right: 80, bottom: 50, left: 64 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const { strikes, expiry_days, iv_surface } = result;
    const nS = strikes.length;   // 9 strikes (rows)
    const nE = expiry_days.length; // 7 expiries (columns)

    // x-axis: expiry days
    const xScale = d3.scaleBand<number>()
      .domain(expiry_days)
      .range([0, innerW])
      .padding(0.05);

    // y-axis: strikes (displayed top-to-bottom as low to high)
    const yScale = d3.scaleBand<number>()
      .domain([...strikes].reverse())
      .range([0, innerH])
      .padding(0.05);

    // Flat IV array for color domain
    const allIvs = iv_surface.flat();
    const minIv = d3.min(allIvs)!;
    const maxIv = d3.max(allIvs)!;

    // Color scale: blue (low) → white (mid) → red (high)
    const colorScale = d3.scaleSequential<string>()
      .domain([minIv, maxIv])
      .interpolator(d3.interpolateRdYlBu);
    // Reverse so blue = low, red = high
    const color = (v: number) => colorScale(maxIv - v + minIv);

    // Draw heatmap cells
    for (let si = 0; si < nS; si++) {
      for (let ei = 0; ei < nE; ei++) {
        const iv = iv_surface[si][ei];
        const K = strikes[si];
        const E = expiry_days[ei];
        g.append("rect")
          .attr("x", xScale(E)!)
          .attr("y", yScale(K)!)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("fill", color(iv))
          .attr("rx", 2);

        // IV label inside cell
        g.append("text")
          .attr("x", xScale(E)! + xScale.bandwidth() / 2)
          .attr("y", yScale(K)! + yScale.bandwidth() / 2 + 4)
          .attr("text-anchor", "middle")
          .attr("font-size", 9)
          .attr("fill", iv > (minIv + maxIv) / 2 ? TOKEN.bg : TOKEN.text1)
          .text(`${(iv * 100).toFixed(1)}%`);
      }
    }

    // x-axis (expiry labels)
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3.axisBottom<number>(xScale)
          .tickFormat(d => `${d}d`)
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", TOKEN.text2).attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // y-axis (strike labels)
    g.append("g")
      .call(
        d3.axisLeft<number>(yScale)
          .tickFormat(d => String(d))
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", TOKEN.text2).attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .attr("fill", TOKEN.text2)
      .attr("font-size", 11)
      .text("만기(일)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -48)
      .attr("text-anchor", "middle")
      .attr("fill", TOKEN.text2)
      .attr("font-size", 11)
      .text("행사가");

    // Color legend (right side)
    const legendH = innerH;
    const legendX = innerW + 16;
    const legendSteps = 20;
    const stepH = legendH / legendSteps;

    for (let i = 0; i < legendSteps; i++) {
      const v = minIv + (i / (legendSteps - 1)) * (maxIv - minIv);
      g.append("rect")
        .attr("x", legendX)
        .attr("y", legendH - (i + 1) * stepH)
        .attr("width", 14)
        .attr("height", stepH)
        .attr("fill", color(v));
    }

    g.append("text").attr("x", legendX + 7).attr("y", -4).attr("text-anchor", "middle").attr("fill", TOKEN.text2).attr("font-size", 9).text(`${(maxIv * 100).toFixed(0)}%`);
    g.append("text").attr("x", legendX + 7).attr("y", legendH + 12).attr("text-anchor", "middle").attr("fill", TOKEN.text2).attr("font-size", 9).text(`${(minIv * 100).toFixed(0)}%`);

  }, [result]);

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {[
            { label: "현물가 (S)", value: spot, set: setSpot },
            { label: "금리 (r)", value: rate, set: setRate },
            { label: "ATM 변동성 (σ)", value: atmVol, set: setAtmVol },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
              <input
                type="number"value={value}
                onChange={e => set(e.target.value)}
                step="any"className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"/>
            </div>
          ))}
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end">
            {loading ? "계산 중…" : "계산"}
          </button>
        </div>
      </Panel>

      <Err msg={error} />

      {result && (
        <Panel>
          <PanelHeader>
            내재변동성 표면 — 현물 {result.spot} · ATM 변동성 {(result.atm_vol * 100).toFixed(0)}%
          </PanelHeader>
          <div className="p-4">
            <svg ref={svgRef} width={560} height={300} className="block" />
          </div>
        </Panel>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          파라미터를 설정하고 계산 버튼을 눌러 IV 표면을 확인하세요.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "greeks",  label: "그릭스" },
  { id: "chain",   label: "체인" },
  { id: "surface", label: "IV 표면" },
];

export default function OptionsPage() {
  const [tab, setTab] = useState<Tab>("greeks");

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div className="mb-4">
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">옵션 체인</h1>
        <p className="text-text-3 text-sm mt-0.5">옵션 체인, 내재변동성 서피스, 그릭스(델타·감마·세타·베가)를 분석합니다.</p>
      </div>

      {/* Tab bar */}
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

      {tab === "greeks"&& <GreeksTab />}
      {tab === "chain"&& <ChainTab />}
      {tab === "surface" && <IvSurfaceTab />}
    </div>
  );
}
