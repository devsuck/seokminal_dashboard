"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  getIctSymbols, runIctBacktest, getIctEvents, ApiError,
  type IctBacktestResponse, type IctEventsResponse,
} from "@/lib/api";
import { IctChart, ICT_LEGEND } from "@/components/ict/IctChart";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedToggle } from "@/components/ui";

const PRIMITIVES: { id: string; label: string; desc: string }[] = [
  { id: "killzone", label: "Kill Zone", desc: "지정 UTC 시간창 안에서만" },
  { id: "sweep", label: "Liquidity Sweep", desc: "직전 N봉 고/저 사냥 후 회복" },
  { id: "fvg", label: "Fair Value Gap", desc: "3봉 불균형(갭)" },
  { id: "order_block", label: "Order Block", desc: "변위 직전 반대봉" },
  { id: "market_structure", label: "BOS / CHoCH", desc: "swing 대비 종가 돌파" },
  { id: "ote", label: "OTE", desc: "직전 BOS 리그의 62-79% 되돌림존 터치" },
  { id: "unicorn", label: "Unicorn", desc: "Order Block ∩ FVG 컨플루언스" },
  { id: "ifvg", label: "iFVG", desc: "반대방향 FVG 관통(역전) 후 되돌림" },
  { id: "cisd", label: "CISD", desc: "연속 반대캔들열 첫시가 관통(배송전환)" },
  { id: "turtle_soup", label: "Turtle Soup", desc: "확정 swing 가짜돌파 후 반전" },
];

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

function num(v: number | null | undefined, digits = 4): string {
  return v === null || v === undefined ? "—" : v.toFixed(digits);
}

export default function IctPage() {
  const [symbols, setSymbols] = useState<Record<string, string[]>>({});
  const [liveSymbols, setLiveSymbols] = useState<string[]>([]);

  const [symbol, setSymbol] = useState("SPY");
  const [symbolQuery, setSymbolQuery] = useState("SPY");
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const symbolBoxRef = useRef<HTMLDivElement | null>(null);

  const [timeframe, setTimeframe] = useState("15m");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selected, setSelected] = useState<string[]>(["killzone", "sweep", "fvg"]);
  const [direction, setDirection] = useState<"bullish" | "bearish">("bullish");
  const [hold, setHold] = useState(8);
  const [costBps, setCostBps] = useState(5);
  const [lookback, setLookback] = useState(10);
  const [swingK, setSwingK] = useState(2);
  const [kzStart, setKzStart] = useState(13.5);
  const [kzEnd, setKzEnd] = useState(15.0);
  const [window_, setWindow_] = useState(8);
  const [near, setNear] = useState(3);
  const [minRun, setMinRun] = useState(2);
  const [confirm, setConfirm] = useState(3);
  const [result, setResult] = useState<IctBacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<IctEventsResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chartAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); chartAbortRef.current?.abort(); }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    getIctSymbols(ctrl.signal).then(r => {
      setSymbols(r.symbols);
      setLiveSymbols(r.live_symbols);
    }).catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (symbolBoxRef.current && !symbolBoxRef.current.contains(e.target as Node)) {
        setSymbolMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const allSymbols = useMemo(() => {
    const s = new Set<string>([...Object.keys(symbols), ...liveSymbols]);
    return Array.from(s).sort();
  }, [symbols, liveSymbols]);

  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toUpperCase();
    const list = q ? allSymbols.filter(s => s.includes(q)) : allSymbols;
    return list.slice(0, 40);
  }, [allSymbols, symbolQuery]);

  const pickSymbol = (s: string) => {
    setSymbol(s);
    setSymbolQuery(s);
    setSymbolMenuOpen(false);
  };

  const toggle = (id: string) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const run = useCallback(async () => {
    abortRef.current?.abort();
    chartAbortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const chartCtrl = new AbortController();
    chartAbortRef.current = chartCtrl;
    setLoading(true);
    setChartLoading(true);
    setError(null);
    setResult(null);
    setChart(null);
    const payload = {
      symbol, timeframe, start: start || undefined, end: end || undefined,
      primitives: selected,
      direction, hold, cost_bps: costBps,
      lookback, swing_k: swingK, kz_start_hour: kzStart, kz_end_hour: kzEnd,
      window: window_, near, min_run: minRun, confirm,
    };
    try {
      const res = await runIctBacktest(payload, ctrl.signal);
      setResult(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "실패");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
    try {
      const ev = await getIctEvents(payload, chartCtrl.signal);
      setChart(ev);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // 차트는 참고용 — 실패해도 통계 결과는 그대로 보여줌, 별도 에러 배너 없음
    } finally {
      if (!chartCtrl.signal.aborted) setChartLoading(false);
    }
  }, [symbol, timeframe, start, end, selected, direction, hold, costBps, lookback, swingK, kzStart, kzEnd, window_, near, minRun, confirm]);

  const isLive = liveSymbols.includes(symbol);

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">ICT 조합 백테스트</h1>
          <p className="text-text-3 text-sm mt-0.5">
            ICT 프리미티브(킬존·sweep·FVG·OB·BOS/CHoCH·OTE·Unicorn·iFVG·CISD·Turtle Soup)를 골라
            AND로 조합, 매칭random 대비 참고 통계. 실전 ICT는 여러 개를 동시에 겹쳐 쓰므로 전부
            이 하나의 빌더에서 자유 조합 가능.
          </p>
        </div>
        <Link href="/validation" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
          ← 리서치 실험 로그
        </Link>
      </div>

      <div className="text-warn text-xs bg-warn/10 border border-warn/20 rounded-md px-4 py-2.5 leading-relaxed">
        킬존+sweep+FVG(모델A) · silver bullet · OTE · unicorn · iFVG · CISD · SMT 등 표준 조합은 이미
        BH-FDR+레드팀 정식 파이프라인에서 전부 REJECT 확정(experiment_registry). 여기 결과는{" "}
        <b>탐색용 참고치</b>이며 정식 CANDIDATE 등록 파이프라인이 아님 — 새 조합을 찾아도 자동연구
        배치(BH-FDR)를 통과해야 후보가 됨.
      </div>

      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1" ref={symbolBoxRef}>
            <label className="text-text-3 text-[11px] uppercase tracking-wider">종목</label>
            <div className="relative">
              <input
                type="text"
                value={symbolQuery}
                onChange={e => { setSymbolQuery(e.target.value); setSymbolMenuOpen(true); }}
                onFocus={() => setSymbolMenuOpen(true)}
                placeholder="검색…"
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-32"
              />
              {symbolMenuOpen && filteredSymbols.length > 0 && (
                <div className="absolute z-10 mt-1 w-48 max-h-64 overflow-y-auto bg-panel-2 border border-border rounded shadow-lg">
                  {filteredSymbols.map(s => (
                    <div key={s} onClick={() => pickSymbol(s)}
                      className={`px-3 py-1.5 text-xs font-data cursor-pointer flex items-center justify-between hover:bg-accent/10 ${
                        s === symbol ? "text-accent" : "text-text-2"}`}>
                      <span>{s}</span>
                      {liveSymbols.includes(s) && <span className="text-[10px] text-info">라이브</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">타임프레임</label>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-20">
              {TIMEFRAMES.map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">시작 (선택)</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">종료 (선택)</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">방향</label>
            <SegmentedToggle
              value={direction}
              onChange={setDirection}
              size="sm"
              options={[
                { value: "bullish", label: "롱" },
                { value: "bearish", label: "숏" },
              ]}
            />
          </div>
        </div>

        {!isLive && (timeframe === "1m" || timeframe === "5m") && (
          <div className="text-[11px] text-warn">
            {symbol}: {timeframe}는 크립토(라이브)만 지원 — 주식/ETF는 15m 원본만 있어 1m/5m 데이터 없음.
          </div>
        )}

        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">프리미티브 (AND 결합)</label>
          <div className="flex gap-2 flex-wrap">
            {PRIMITIVES.map(p => (
              <button key={p.id} onClick={() => toggle(p.id)} title={p.desc}
                className={`px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
                  selected.includes(p.id) ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 bg-transparent hover:text-text-2"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">보유봉수</label>
            <input type="number" value={hold} onChange={e => setHold(Number(e.target.value))}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">비용(bps)</label>
            <input type="number" value={costBps} onChange={e => setCostBps(Number(e.target.value))}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          {selected.includes("sweep") && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Sweep 룩백</label>
              <input type="number" value={lookback} onChange={e => setLookback(Number(e.target.value))}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
            </div>
          )}
          {(selected.includes("market_structure") || selected.includes("ote") || selected.includes("turtle_soup")) && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">스윙 k</label>
              <input type="number" value={swingK} onChange={e => setSwingK(Number(e.target.value))}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
            </div>
          )}
          {(selected.includes("ote") || selected.includes("ifvg")) && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">되돌림 window</label>
              <input type="number" value={window_} onChange={e => setWindow_(Number(e.target.value))}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
            </div>
          )}
          {selected.includes("unicorn") && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Unicorn 근접</label>
              <input type="number" value={near} onChange={e => setNear(Number(e.target.value))}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
            </div>
          )}
          {selected.includes("cisd") && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">CISD 최소구간</label>
              <input type="number" value={minRun} onChange={e => setMinRun(Number(e.target.value))}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
            </div>
          )}
          {selected.includes("turtle_soup") && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">복귀확인 confirm</label>
              <input type="number" value={confirm} onChange={e => setConfirm(Number(e.target.value))}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
            </div>
          )}
          {selected.includes("killzone") && (
            <>
              <div className="space-y-1">
                <label className="text-text-3 text-[11px] uppercase tracking-wider">KZ 시작(UTC h)</label>
                <input type="number" step={0.5} value={kzStart} onChange={e => setKzStart(Number(e.target.value))}
                  className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
              </div>
              <div className="space-y-1">
                <label className="text-text-3 text-[11px] uppercase tracking-wider">KZ 끝(UTC h)</label>
                <input type="number" step={0.5} value={kzEnd} onChange={e => setKzEnd(Number(e.target.value))}
                  className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
              </div>
            </>
          )}
          <button
            onClick={run}
            disabled={loading || selected.length === 0}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "실행중…" : "백테스트 실행"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {(chart || chartLoading) && (
        <Panel>
          <PanelHeader right={
            <div className="flex gap-3 flex-wrap normal-case tracking-normal font-normal">
              {ICT_LEGEND.filter(g => selected.includes(g.id)).map(g => (
                <div key={g.id} className="flex items-center gap-1.5 text-[11px]">
                  {g.kind === "zone" ? (
                    <span className="inline-block w-3 h-3 rounded-sm border" style={{ borderColor: g.color, backgroundColor: `${g.color}33` }} />
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                  )}
                  {g.label}
                </div>
              ))}
            </div>
          }>
            차트 (프리미티브 오버레이)
          </PanelHeader>
          {chartLoading && !chart && (
            <div className="p-8 text-center text-text-3 text-sm">차트 로딩중…</div>
          )}
          {chart && chart.bars.length > 0 && (
            <IctChart bars={chart.bars} events={chart.events} />
          )}
        </Panel>
      )}

      {result && (
        <Panel>
          <PanelHeader right={result.verdict === "UNDERPOWERED" ? (
            <span className="text-[11px] px-2 py-0.5 rounded border normal-case tracking-normal font-normal text-warn border-warn bg-black/10">
              UNDERPOWERED
            </span>
          ) : undefined}>
            결과 (참고치)
          </PanelHeader>
          <div className="p-4 flex gap-6 flex-wrap text-xs">
            <div className="text-text-3">진입수: <span className="text-text-2 font-data">{result.n_entries}</span></div>
            <div className="text-text-3">유효표본: <span className="text-text-2 font-data">{result.n_eligible ?? "—"}</span></div>
            <div className="text-text-3">
              순손익: <span className={`font-data px-1 font-bold ${result.net !== null && result.net > 0 ? "bg-pos/20 text-pos" : result.net !== null && result.net < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                {num(result.net)}
              </span>
            </div>
            <div className="text-text-3">
              백분위(랜덤 대비): <span className={`font-data ${result.percentile !== null && result.percentile >= 90 ? "px-1 font-bold bg-pos/20 text-pos" : "text-text-2"}`}>
                {result.percentile !== null && result.percentile !== undefined ? `${result.percentile}%` : "—"}
              </span>
            </div>
            <div className="text-text-3">p-value: <span className="text-text-2 font-data">{num(result.p)}</span></div>
            <div className="text-text-3">랜덤 중앙값: <span className="text-text-2 font-data">{num(result.rand_median)}</span></div>
            <div className="text-text-3">
              WF1: <span className={`font-data px-1 font-bold ${result.wf_first !== null && result.wf_first > 0 ? "bg-pos/20 text-pos" : result.wf_first !== null && result.wf_first < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                {num(result.wf_first)}
              </span>
            </div>
            <div className="text-text-3">
              WF2: <span className={`font-data px-1 font-bold ${result.wf_second !== null && result.wf_second > 0 ? "bg-pos/20 text-pos" : result.wf_second !== null && result.wf_second < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                {num(result.wf_second)}
              </span>
            </div>
          </div>
          {result.n_entries > 0 && result.verdict !== "UNDERPOWERED" && (
            <div className="px-4 pb-4 text-[11px] text-text-3">
              CANDIDATE 급 판단 기준(참고): percentile≥90 & p&lt;0.05 & WF1·WF2 둘 다 양수. 이 페이지는
              단일 시도 결과일 뿐 — BH-FDR 다중검정 보정 없음(여러 조합 시도하면 우연 적중 확률 급증).
            </div>
          )}
        </Panel>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          심볼·프리미티브 선택 후 실행하면 매칭random 대비 net/percentile/p-value를 보여줌.
        </div>
      )}
    </div>
  );
}
