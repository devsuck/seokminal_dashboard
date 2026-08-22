"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, getCopyTraders, getCopyPositions, mirrorCopyTrade,
  closeCopyPosition, copyAutoExit, getCopytradeBotStatus, setCopytradeBotConfig,
  type TraderCard, type CopyPosition,
} from "@/lib/api";
import { EmptyState, LoadingState, Button } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";

const NOTIONAL_KEY = "copytrade-notional";
const TOTAL_BUDGET_KEY = "copytrade-total-budget";

// 이름 → 안정적 색상 (아바타 배경)
const AVATAR_COLORS = [
  "bg-info/20 text-info", "bg-pos/20 text-pos", "bg-accent/20 text-accent",
  "bg-warn/20 text-warn", "bg-neg/20 text-neg",
];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function retStr(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function round2(n: number): number { return Math.round(n * 100) / 100; }

export default function CopyTradePage() {
  const [traders, setTraders] = useState<TraderCard[]>([]);
  const [positions, setPositions] = useState<CopyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notional, setNotional] = useState("500");
  const [totalBudget, setTotalBudget] = useState("5000");
  const [autoExit, setAutoExit] = useState(false);
  const [tpPct, setTpPct] = useState("15");
  const [slPct, setSlPct] = useState("7");
  const [botLastRun, setBotLastRun] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"return" | "recent">("return");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const tCtrl = useRef<AbortController | null>(null);
  const pCtrl = useRef<AbortController | null>(null);
  const sCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const n = localStorage.getItem(NOTIONAL_KEY); if (n) setNotional(n);
    const b = localStorage.getItem(TOTAL_BUDGET_KEY); if (b) setTotalBudget(b);
  }, []);

  // 자동청산 설정 = 서버 상시 루프의 설정(브라우저 무관하게 동작). 진실 소스는 서버.
  const loadBotStatus = useCallback(() => {
    sCtrl.current?.abort();
    const ctrl = new AbortController(); sCtrl.current = ctrl;
    getCopytradeBotStatus(ctrl.signal)
      .then(s => {
        if (ctrl.signal.aborted) return;
        setAutoExit(s.enabled); setTpPct(String(s.tp_pct)); setSlPct(String(s.sl_pct));
        setBotLastRun(s.last_run);
      })
      .catch(e => { if (!(e instanceof DOMException && e.name === "AbortError")) { /* 백엔드 미기동 — 무시 */ } });
  }, []);

  useEffect(() => {
    loadBotStatus();
    const iv = setInterval(loadBotStatus, 60_000);
    return () => { clearInterval(iv); sCtrl.current?.abort(); };
  }, [loadBotStatus]);

  const loadPositions = useCallback(() => {
    pCtrl.current?.abort();
    const ctrl = new AbortController(); pCtrl.current = ctrl;
    getCopyPositions(ctrl.signal)
      .then(p => { if (!ctrl.signal.aborted) setPositions(p); })
      .catch(() => { /* 페이퍼 계좌 없으면 무시 */ });
  }, []);

  const loadTraders = useCallback(() => {
    tCtrl.current?.abort();
    const ctrl = new AbortController(); tCtrl.current = ctrl;
    setError(null);
    getCopyTraders(120, ctrl.signal)
      .then(d => { if (!ctrl.signal.aborted) { setTraders(d); setLoading(false); } })
      .catch(e => { if (!ctrl.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    loadTraders(); loadPositions();
    const iv = setInterval(loadPositions, 60_000);
    return () => { clearInterval(iv); tCtrl.current?.abort(); pCtrl.current?.abort(); };
  }, [loadTraders, loadPositions]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  // 트레이더 포트폴리오 전체를 페이퍼로 팔로우 — 총 예산을 보유 종목 수로 나눠 배분
  // (종목당 고정 금액이 아님 — 종목 수만큼 곱해져 총예산을 초과하지 않게).
  async function follow(t: TraderCard) {
    const budget = parseFloat(totalBudget) || 5000;
    const amt = t.holdings.length > 0 ? round2(budget / t.holdings.length) : 0;
    setBusy(t.source + t.name);
    let ok = 0;
    for (const h of t.holdings) {
      try { await mirrorCopyTrade(h.ticker, amt); ok++; } catch { /* skip */ }
    }
    setBusy(null);
    flash(`${t.name} 팔로우 — ${ok}/${t.holdings.length}종목 페이퍼 매수 (총 $${budget} ÷ ${t.holdings.length}종목 = $${amt}씩)`);
    loadPositions();
  }

  async function mirrorOne(ticker: string) {
    const amt = parseFloat(notional) || 500;
    setBusy(ticker);
    try { await mirrorCopyTrade(ticker, amt); flash(`${ticker} $${amt} 페이퍼 매수`); loadPositions(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setBusy(null); }
  }

  async function closeOne(ticker: string) {
    setBusy(`close:${ticker}`);
    try { await closeCopyPosition(ticker); flash(`${ticker} 전량 청산 주문`); loadPositions(); }
    catch (e) { flash(`청산 실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setBusy(null); }
  }

  const runAutoExit = useCallback(async () => {
    try {
      const r = await copyAutoExit(parseFloat(tpPct) || 15, parseFloat(slPct) || 7);
      if (r.count > 0) {
        flash(`자동청산 ${r.count}건: ${r.closed.map(c => `${c.ticker}(${c.reason})`).join(", ")}`);
        loadPositions();
      }
    } catch { /* 다음 주기에 재시도 */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpPct, slPct, loadPositions]);

  async function toggleAutoExit() {
    const v = !autoExit;
    setAutoExit(v);
    try { await setCopytradeBotConfig({ enabled: v }); }
    catch { flash("설정 저장 실패 — 백엔드 확인"); setAutoExit(!v); }
  }
  async function saveTpSl(next: { tp?: string; sl?: string }) {
    try {
      await setCopytradeBotConfig({
        tp_pct: parseFloat(next.tp ?? tpPct) || 15,
        sl_pct: parseFloat(next.sl ?? slPct) || 7,
      });
    } catch { /* 다음 blur 시 재시도 */ }
  }

  const totalPl = positions.reduce((a, p) => a + p.unrealized_pl, 0);

  const latestDate = (t: TraderCard) =>
    t.holdings.reduce((m, h) => (h.date > m ? h.date : m), "");

  const shown = traders
    .filter(t => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sortBy === "recent"? latestDate(b).localeCompare(latestDate(a))
        : (b.avg_return_pct ?? -999) - (a.avg_return_pct ?? -999),
    );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">카피트레이드 오토파일럿</h1>
        <p className="text-text-3 text-sm mt-0.5">
          의회·내부자의 <span className="text-text-2">공개 매수</span>를 매수자별로 묶어 트랙레코드 표시. 거래일 종가로 진입했다 가정한 현재 수익률. 팔로우하면 그 포트폴리오를 <span className="text-warn">페이퍼</span>로 복제. <span className="text-text-3">(공시 지연 有 — 검증용)</span>
        </p>
      </div>

      <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3 flex-wrap">
        <label className="text-text-3 text-xs">총 팔로우 예산</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data">$</span>
          <input value={totalBudget}
            onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setTotalBudget(v); localStorage.setItem(TOTAL_BUDGET_KEY, v); }}
            inputMode="decimal" className="w-28 bg-panel-2 border border-border rounded pl-6 pr-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        </div>
        <span className="text-text-3 text-[11px]">팔로우 = 이 총액을 보유 종목 수로 나눠 각각 페이퍼 매수 (종목 수와 무관하게 총액 고정)</span>

        <div className="flex items-center gap-1.5">
          <label className="text-text-3 text-xs">개별 미러 금액</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data">$</span>
            <input value={notional}
              onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setNotional(v); localStorage.setItem(NOTIONAL_KEY, v); }}
              inputMode="decimal" className="w-24 bg-panel-2 border border-border rounded pl-6 pr-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* 이름 검색 */}
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="이름 검색 (예: Pelosi)"className="w-44 bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-xs outline-none focus:border-accent" />
          {/* 정렬 */}
          <div className="flex rounded overflow-hidden border border-border">
            {([["return", "수익률순"], ["recent", "최신순"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setSortBy(v)}
                className={`px-3 py-1.5 text-xs ${sortBy === v ? "bg-accent/15 text-accent" : "bg-panel-2 text-text-3 hover:text-text-2"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* 트레이더 카드 그리드 */}
        <div>
          {error ? <EmptyState message="트레이더 로드 실패" hint={error} />
            : loading ? <LoadingState message="수익률 계산 중… (거래일 종가 조회)" />
            : traders.length === 0 ? <EmptyState message="트레이더 없음" />
            : shown.length === 0 ? <EmptyState message="검색 결과 없음" hint={`"${query}"`} />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shown.map(t => {
                  const key = t.source + t.name;
                  const isOpen = expanded === key;
                  return (
                    <div key={key} className="bg-panel border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold font-data shrink-0 ${colorFor(t.name)}`}>
                          {t.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-text-1 text-sm font-medium truncate">{t.name}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded border border-border text-text-3 shrink-0">
                              {t.source === "congress" ? " 의회" : " 내부자"}
                            </span>
                          </div>
                          <div className="text-text-3 text-[11px] truncate">{t.role ?? "—"}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`inline-block text-lg font-data font-bold leading-none px-1 rounded ${t.avg_return_pct == null ? "text-text-3" : t.avg_return_pct > 0 ? "bg-pos/20 text-pos" : t.avg_return_pct < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>{retStr(t.avg_return_pct)}</div>
                          <div className="text-text-3 text-[10px] mt-0.5">{t.num_buys}종목</div>
                        </div>
                      </div>

                      {/* 보유 종목 (최대 3개, 펼치면 전체) */}
                      <div className="mt-3 space-y-1">
                        {(isOpen ? t.holdings : t.holdings.slice(0, 3)).map(h => (
                          <div key={h.ticker} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-data text-accent font-semibold w-14 shrink-0 no-underline hover:underline">{h.ticker}</span>
                              <span className="text-text-3 font-data text-[10px]">{h.date}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-data px-1 font-bold ${h.return_pct == null ? "text-text-3" : h.return_pct > 0 ? "bg-pos/20 text-pos" : h.return_pct < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>{retStr(h.return_pct)}</span>
                              <button onClick={() => mirrorOne(h.ticker)} disabled={busy === h.ticker}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-3 hover:text-pos hover:border-pos/40 disabled:opacity-40">
                                미러
                              </button>
                            </div>
                          </div>
                        ))}
                        {t.holdings.length > 3 && (
                          <button onClick={() => setExpanded(isOpen ? null : key)}
                            className="text-text-3 text-[10px] hover:text-text-2">
                            {isOpen ? "접기" : `+${t.holdings.length - 3}개 더`}
                          </button>
                        )}
                      </div>

                      <Button variant="primary" size="sm" onClick={() => follow(t)} disabled={busy === key} className="w-full mt-3">
                        {busy === key ? "팔로우 중…" : `팔로우 (${t.num_buys}종목 페이퍼 복제)`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* 내 페이퍼 포트폴리오 */}
        <Panel className="h-fit">
          <PanelHeader right={
            <span className={totalPl >= 0 ? "text-pos" : "text-neg"}>
              {totalPl >= 0 ? "+" : ""}${totalPl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          }>
            내 페이퍼 포트폴리오
          </PanelHeader>
          {/* 자동청산 규칙 — TP/SL 넘으면 자동 매도, 예산 회수 */}
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
            <button onClick={toggleAutoExit}
              title="서버 상시 루프 — 브라우저를 닫아도 계속 동작"
              className={`text-[11px] px-2.5 py-1 rounded border ${autoExit ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
              {autoExit ? "● 자동청산 ON (서버)" : "자동청산 OFF"}
            </button>
            <label className="text-text-3 text-[10px]">익절%</label>
            <input value={tpPct} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setTpPct(v); }}
              onBlur={e => saveTpSl({ tp: e.target.value })}
              inputMode="decimal" className="w-12 bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 text-xs font-data outline-none focus:border-accent" />
            <label className="text-text-3 text-[10px]">손절%</label>
            <input value={slPct} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setSlPct(v); }}
              onBlur={e => saveTpSl({ sl: e.target.value })}
              inputMode="decimal" className="w-12 bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 text-xs font-data outline-none focus:border-accent" />
            {botLastRun && <span className="text-text-3 text-[10px]" title={botLastRun}>마지막 실행 {new Date(botLastRun).toLocaleTimeString()}</span>}
            <button onClick={runAutoExit}
              className="text-[10px] px-2 py-1 rounded border border-border text-text-3 hover:text-accent hover:border-accent ml-auto">
              지금 적용
            </button>
          </div>
          {positions.length === 0 ? (
            <div className="p-6"><EmptyState message="보유 없음" hint="트레이더를 팔로우하면 여기 표시" /></div>
          ) : (
            <div className="divide-y divide-border/50">
              {positions.map(p => (
                <div key={p.ticker} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-data text-text-1 text-sm font-semibold">{p.ticker}</div>
                    <div className="text-text-3 text-[10px] font-data">{p.qty.toFixed(4)}주 · 평단 ${p.avg_price.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-data text-sm px-1 font-bold ${p.unrealized_pl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                      {p.unrealized_pl >= 0 ? "+" : ""}${p.unrealized_pl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-data px-1 font-bold ${p.unrealized_plpc >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                      {p.unrealized_plpc >= 0 ? "+" : ""}{p.unrealized_plpc.toFixed(2)}%
                    </div>
                  </div>
                  <button onClick={() => closeOne(p.ticker)} disabled={busy === `close:${p.ticker}`}
                    className="text-[10px] px-2 py-1 rounded border border-neg/30 text-neg hover:bg-neg/10 disabled:opacity-40 shrink-0">
                    청산
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-text-1 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
