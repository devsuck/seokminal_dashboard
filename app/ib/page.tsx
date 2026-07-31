"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import { ApiError, getIBBars, IB_BAR_SIZES, type IBBarsResponse, type IBBarSize } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TOKEN } from "@/lib/chart-colors";

type AssetTab = "stock" | "forex" | "future" | "option" | "crypto";

const TABS: { id: AssetTab; label: string }[] = [
  { id: "stock",  label: "주식"},
  { id: "forex",  label: "외환"},
  { id: "future", label: "선물" },
  { id: "option", label: "옵션" },
  { id: "crypto", label: "크립토" },
];

const DURATIONS = ["1 W", "1 M", "3 M", "6 M", "1 Y", "2 Y", "5 Y"] as const;

// Default duration per bar size (IB constraints)
const BAR_SIZE_DEFAULT_DURATION: Record<IBBarSize, string> = {
  "1 min":   "1 W",
  "5 mins":  "1 M",
  "15 mins": "3 M",
  "30 mins": "3 M",
  "1 hour":  "6 M",
  "4 hours": "1 Y",
  "1 day":   "1 Y",
  "1 week":  "2 Y",
  "1 month": "5 Y",
};

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mb-3">오류: {msg}</p> : null;
}

function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6);
}

// ── Shared chart component ────────────────────────────────────────────────────

function CandleChart({ result }: { result: IBBarsResponse }) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current || !result.bars.length) return;
    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TOKEN.text2,
      },
      grid: {
        vertLines: { color: TOKEN.border },
        horzLines: { color: TOKEN.border },
      },
      width: chartRef.current.clientWidth,
      height: 320,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: TOKEN.pos,
      downColor: TOKEN.neg,
      borderVisible: false,
      wickUpColor: TOKEN.pos,
      wickDownColor: TOKEN.neg,
    });
    series.setData(
      result.bars.map(b => ({
        time: Math.floor(b.ts_ms / 1000) as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );
    chart.timeScale().fitContent();
    return () => { chart.remove(); };
  }, [result]);

  const last = result.bars.at(-1);

  return (
    <Panel>
      <PanelHeader right={last && (
        <span className="font-data">
          최근가: {fmtPrice(last.close)}
        </span>
      )}>
        {result.symbol} · {result.count}개 봉
      </PanelHeader>
      <div className="p-3">
        <div ref={chartRef} style={{ height: "320px" }} />
      </div>
    </Panel>
  );
}

// ── Tab forms ─────────────────────────────────────────────────────────────────

interface FormShellProps {
  children: React.ReactNode;
  onLoad: () => void;
  loading: boolean;
}

function FormShell({ children, onLoad, loading }: FormShellProps) {
  return (
    <Panel className="p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {children}
        <button
          onClick={onLoad}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end">
          {loading ? "불러오는 중…" : "조회"}
        </button>
      </div>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-text-3 text-[11px] uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data";

function BarSizeButtons({ value, onChange }: { value: IBBarSize; onChange: (v: IBBarSize) => void }) {
  const groups = [
    { label: "인트라데이", sizes: ["1 min", "5 mins", "15 mins", "30 mins"] as IBBarSize[] },
    { label: "일봉 이상",   sizes: ["1 hour", "4 hours", "1 day", "1 week", "1 month"] as IBBarSize[] },
  ];
  return (
    <Field label="봉 크기">
      <div className="flex gap-1 flex-wrap">
        {groups.map(g => (
          <div key={g.label} className="flex rounded overflow-hidden border border-border">
            {g.sizes.map(s => (
              <button
                key={s}
                onClick={() => onChange(s)}
                className={`px-2 py-1 text-[11px] font-medium border-r border-border last:border-r-0 ${
                  value === s
                    ? "bg-accent text-black": "bg-panel-2 text-text-3 hover:text-text-1 hover:bg-panel"}`}
              >{s}</button>
            ))}
          </div>
        ))}
      </div>
    </Field>
  );
}

function DurationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="기간">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} cursor-pointer`}
      >
        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </Field>
  );
}

function EndDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="종료일 (선택)">
      <input
        type="text"value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="20250101"className={`${inputCls} w-28`}
      />
    </Field>
  );
}

// ── Per-tab load hooks ─────────────────────────────────────────────────────────

function useIBBars() {
  const [result, setResult]   = useState<IBBarsResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function load(params: Parameters<typeof getIBBars>[0]) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getIBBars(params, ctrl.signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "실패");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { result, error, loading, load };
}

// ── Tab implementations ───────────────────────────────────────────────────────

function StockTab() {
  const [symbol, setSymbol]     = useState("AAPL");
  const [barSize, setBarSize]   = useState<IBBarSize>("1 day");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate]   = useState("");
  const { result, error, loading, load } = useIBBars();

  function handleBarSizeChange(v: IBBarSize) {
    setBarSize(v);
    setDuration(BAR_SIZE_DEFAULT_DURATION[v]);
  }

  return (
    <div className="space-y-4">
      <FormShell onLoad={() => { if (!symbol.trim()) return; load({ symbol, asset_type: "stock", end_date: endDate, duration, bar_size: barSize }); }} loading={loading}>
        <Field label="종목">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-20 uppercase`} />
        </Field>
        <BarSizeButtons value={barSize} onChange={handleBarSizeChange} />
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function ForexTab() {
  const [pair, setPair]         = useState("EURUSD");
  const [barSize, setBarSize]   = useState<IBBarSize>("1 day");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate]   = useState("");
  const { result, error, loading, load } = useIBBars();

  function handleBarSizeChange(v: IBBarSize) {
    setBarSize(v);
    setDuration(BAR_SIZE_DEFAULT_DURATION[v]);
  }

  return (
    <div className="space-y-4">
      <FormShell onLoad={() => { if (!pair.trim()) return; load({ symbol: pair, asset_type: "forex", end_date: endDate, duration, bar_size: barSize }); }} loading={loading}>
        <Field label="통화쌍 (예: EURUSD)">
          <input type="text" value={pair} onChange={e => setPair(e.target.value.toUpperCase())} className={`${inputCls} w-24 uppercase`} />
        </Field>
        <BarSizeButtons value={barSize} onChange={handleBarSizeChange} />
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function FutureTab() {
  const [symbol, setSymbol]     = useState("ES");
  const [exchange, setExchange] = useState("CME");
  const [expiry, setExpiry]     = useState("202509");
  const [barSize, setBarSize]   = useState<IBBarSize>("1 day");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate]   = useState("");
  const { result, error, loading, load } = useIBBars();

  function handleBarSizeChange(v: IBBarSize) {
    setBarSize(v);
    setDuration(BAR_SIZE_DEFAULT_DURATION[v]);
  }

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => { if (!symbol.trim() || !exchange.trim() || !expiry.trim()) return; load({ symbol, asset_type: "future", exchange, expiry, end_date: endDate, duration, bar_size: barSize }); }}
        loading={loading}
      >
        <Field label="종목">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="거래소">
          <input type="text" value={exchange} onChange={e => setExchange(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="만기 (YYYYMM)">
          <input type="text" value={expiry} onChange={e => setExpiry(e.target.value)} className={`${inputCls} w-24`} />
        </Field>
        <BarSizeButtons value={barSize} onChange={handleBarSizeChange} />
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function OptionTab() {
  const [symbol, setSymbol]     = useState("SPY");
  const [expiry, setExpiry]     = useState("20271219");
  const [strike, setStrike]     = useState("500");
  const [right, setRight]       = useState<"C" | "P">("C");
  const [barSize, setBarSize]   = useState<IBBarSize>("1 day");
  const [duration, setDuration] = useState("3 M");
  const [endDate, setEndDate]   = useState("");
  const { result, error, loading, load } = useIBBars();

  function handleBarSizeChange(v: IBBarSize) {
    setBarSize(v);
    setDuration(BAR_SIZE_DEFAULT_DURATION[v]);
  }

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => {
          if (!symbol.trim() || !expiry.trim()) return;
          load({ symbol, asset_type: "option", expiry, strike: parseFloat(strike), right, end_date: endDate, duration, bar_size: barSize });
        }}
        loading={loading}
      >
        <Field label="종목">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="만기 (YYYYMMDD)">
          <input type="text" value={expiry} onChange={e => setExpiry(e.target.value)} className={`${inputCls} w-24`} />
        </Field>
        <Field label="행사가">
          <input type="number" value={strike} onChange={e => setStrike(e.target.value)} className={`${inputCls} w-20`} />
        </Field>
        <Field label="콜/풋">
          <select value={right} onChange={e => setRight(e.target.value as "C" | "P")} className={`${inputCls} cursor-pointer`}>
            <option value="C">콜</option>
            <option value="P">풋</option>
          </select>
        </Field>
        <BarSizeButtons value={barSize} onChange={handleBarSizeChange} />
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function CryptoTab() {
  const [symbol, setSymbol]     = useState("BTC");
  const [barSize, setBarSize]   = useState<IBBarSize>("1 day");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate]   = useState("");
  const { result, error, loading, load } = useIBBars();

  function handleBarSizeChange(v: IBBarSize) {
    setBarSize(v);
    setDuration(BAR_SIZE_DEFAULT_DURATION[v]);
  }

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => { if (!symbol.trim()) return; load({ symbol, asset_type: "crypto", end_date: endDate, duration, bar_size: barSize }); }}
        loading={loading}
      >
        <Field label="종목 (BTC/ETH/SOL…)">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <BarSizeButtons value={barSize} onChange={handleBarSizeChange} />
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <p className="text-text-3 text-[11px]">
        PAXOS를 통해 지원: BTC · ETH · LTC · BCH · XRP · SOL
      </p>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IBPage() {
  const [tab, setTab] = useState<AssetTab>("stock");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div className="mb-4">
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">IB 시장 데이터</h1>
        <p className="text-text-3 text-sm mt-0.5">Interactive Brokers TWS를 통해 주식·선물·옵션의 히스토리컬 바 데이터를 조회합니다.</p>
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

      {tab === "stock"&& <StockTab />}
      {tab === "forex"&& <ForexTab />}
      {tab === "future" && <FutureTab />}
      {tab === "option" && <OptionTab />}
      {tab === "crypto" && <CryptoTab />}
    </div>
  );
}
