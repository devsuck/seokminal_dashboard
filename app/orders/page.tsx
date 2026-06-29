"use client";

import { useEffect, useRef, useState } from "react";
import {
  placeKROrder,
  cancelKROrder,
  getKROrderStatus,
  placeUSOrder,
  cancelUSOrder,
  getAllBotsLiveStatus,
  getHLPositions,
  placeHLOrder,
  cancelHLOrder,
  closeHLPosition,
  type KROrderResponse,
  type USOrderResponse,
  type BotLiveEntry,
  type HLPositionsResponse,
  type HLOpenOrder,
  type HLAssetPosition,
} from "@/lib/api";
import {
  getOrderLog,
  addOrderEntry,
  updateOrderStatus,
  clearOrderLog,
  type OrderLogEntry,
} from "@/lib/order-storage";
import { PageBanner } from "@/components/PageBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Venue = "KR" | "US" | "HL";
type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPnl(pnl: number | null): string {
  if (pnl === null) return "—";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}`;
}

function pnlColor(pnl: number | null): string {
  if (pnl === null) return "text-text-3";
  return pnl >= 0 ? "text-pos" : "text-neg";
}

function canCancel(status: string): boolean {
  return ["SUBMITTED", "OPEN", "PendingSubmit", "PreSubmitted"].includes(status);
}

function toKRDate(isoStr: string): string {
  return isoStr.slice(0, 10).replace(/-/g, "");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Venue tab
  const [venue, setVenue] = useState<Venue>("KR");

  // Shared form
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");

  // KR form
  const [krCode, setKrCode] = useState("005930");
  const [krPrice, setKrPrice] = useState("");

  // US form
  const [usSymbol, setUsSymbol] = useState("AAPL");
  const [usLimitPrice, setUsLimitPrice] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Per-order action state: { [entryId]: { loading, error } }
  const [actionState, setActionState] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const cancelAbortRefs = useRef<Map<string, AbortController>>(new Map());

  // HL state
  const [hlPositions, setHlPositions] = useState<HLPositionsResponse | null>(null);
  const [hlLoading, setHlLoading] = useState(false);
  const [hlError, setHlError] = useState<string | null>(null);
  const [hlCoin, setHlCoin] = useState("ETH");
  const [hlSize, setHlSize] = useState("0.01");
  const [hlOrderType, setHlOrderType] = useState<"market" | "limit">("market");
  const [hlLimitPx, setHlLimitPx] = useState("");
  const [hlSide, setHlSide] = useState<"BUY" | "SELL">("BUY");
  const [hlReduceOnly, setHlReduceOnly] = useState(false);
  const [hlPaper, setHlPaper] = useState(true); // default: paper trading
  const [hlConfirm, setHlConfirm] = useState(false); // live order confirm modal
  const [hlSubmitting, setHlSubmitting] = useState(false);
  const [hlSubmitMsg, setHlSubmitMsg] = useState<string | null>(null);
  const hlAbortRef = useRef<AbortController | null>(null);

  async function loadHLPositions(paper = hlPaper) {
    hlAbortRef.current?.abort();
    const ctrl = new AbortController();
    hlAbortRef.current = ctrl;
    setHlLoading(true); setHlError(null);
    try {
      const res = await getHLPositions(paper, ctrl.signal);
      if (!ctrl.signal.aborted) setHlPositions(res);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setHlError(e instanceof Error ? e.message : "HL 조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setHlLoading(false);
    }
  }

  async function submitHLOrder() {
    setHlConfirm(false);
    setHlSubmitting(true); setHlSubmitMsg(null);
    try {
      await placeHLOrder({
        coin: hlCoin.toUpperCase(),
        is_buy: hlSide === "BUY",
        size: parseFloat(hlSize),
        order_type: hlOrderType,
        limit_px: hlOrderType === "limit" && hlLimitPx ? parseFloat(hlLimitPx) : undefined,
        reduce_only: hlReduceOnly,
        paper: hlPaper,
      });
      setHlSubmitMsg(hlPaper ? "[Paper] 주문 완료" : "주문 완료");
      loadHLPositions();
    } catch (e: unknown) {
      setHlSubmitMsg(e instanceof Error ? e.message : "주문 실패");
    } finally {
      setHlSubmitting(false);
    }
  }

  async function handleHLCancel(order: HLOpenOrder) {
    try {
      await cancelHLOrder(order.coin, order.oid, hlPaper);
      loadHLPositions();
    } catch { /* ignore */ }
  }

  async function handleHLClose(pos: HLAssetPosition) {
    try {
      await closeHLPosition(pos.position.coin, undefined, 0.05, hlPaper);
      loadHLPositions();
    } catch { /* ignore */ }
  }

  // Bot positions
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsLoading, setBotsLoading] = useState(true);
  const botsAbortRef = useRef<AbortController | null>(null);

  // Order log
  const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);

  useEffect(() => {
    setOrderLog(getOrderLog());
  }, []);

  useEffect(() => () => {
    submitAbortRef.current?.abort();
    botsAbortRef.current?.abort();
    cancelAbortRefs.current.forEach(c => c.abort());
    cancelAbortRefs.current.clear();
  }, []);

  // ── Place order ───────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    const qtyNum = parseInt(qty);
    if (qtyNum <= 0 || isNaN(qtyNum)) { setSubmitError("Qty must be > 0."); return; }

    if (venue === "KR") {
      if (!krCode.trim()) { setSubmitError("Code required."); return; }
      if (orderType === "LIMIT" && (!krPrice || isNaN(parseInt(krPrice)))) {
        setSubmitError("Price required for LIMIT."); return;
      }
    } else {
      if (!usSymbol.trim()) { setSubmitError("Symbol required."); return; }
      if (orderType === "LIMIT" && (!usLimitPrice || isNaN(parseFloat(usLimitPrice)))) {
        setSubmitError("Limit price required for LIMIT."); return;
      }
    }

    submitAbortRef.current?.abort();
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;
    setSubmitting(true); setSubmitResult(null); setSubmitError(null);

    try {
      let resultStr: string;
      if (venue === "KR") {
        const res: KROrderResponse = await placeKROrder({
          code: krCode.trim(), side, quantity: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseInt(krPrice) } : {}),
        }, ctrl.signal);
        if (submitAbortRef.current !== ctrl) return;
        resultStr = `#${res.order_id} · ${res.status}`;
        const updated = addOrderEntry({
          venue: "KR", code: krCode.trim(), side, qty: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseInt(krPrice) } : {}),
          order_id: res.order_id, status: res.status,
        });
        setOrderLog(updated);
      } else {
        const res: USOrderResponse = await placeUSOrder({
          symbol: usSymbol.trim(), side, quantity: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { limit_price: parseFloat(usLimitPrice) } : {}),
        }, ctrl.signal);
        if (submitAbortRef.current !== ctrl) return;
        resultStr = `#${res.order_id} · ${res.status}`;
        const updated = addOrderEntry({
          venue: "US", code: usSymbol.trim(), side, qty: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseFloat(usLimitPrice) } : {}),
          order_id: String(res.order_id), status: res.status,
        });
        setOrderLog(updated);
      }
      setSubmitResult(resultStr);
    } catch (e) {
      if (submitAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      if (submitAbortRef.current === ctrl) setSubmitting(false);
    }
  }

  // ── Cancel order ──────────────────────────────────────────────────────────

  async function handleCancel(entry: OrderLogEntry) {
    cancelAbortRefs.current.get(entry.id)?.abort();
    cancelAbortRefs.current.delete(entry.id);
    const ctrl = new AbortController();
    cancelAbortRefs.current.set(entry.id, ctrl);
    setActionState(s => ({ ...s, [entry.id]: { loading: true, error: null } }));
    try {
      if (entry.venue === "KR") {
        const res = await cancelKROrder(entry.order_id, { code: entry.code, quantity: entry.qty }, ctrl.signal);
        const updated = updateOrderStatus(entry.id, res.status);
        setOrderLog(updated);
      } else {
        const res = await cancelUSOrder(Number(entry.order_id), ctrl.signal);
        const updated = updateOrderStatus(entry.id, res.status);
        setOrderLog(updated);
      }
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: null } }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    } finally {
      if (cancelAbortRefs.current.get(entry.id) === ctrl) cancelAbortRefs.current.delete(entry.id);
    }
  }

  // ── Check status (KR only) ─────────────────────────────────────────────────

  async function handleCheckStatus(entry: OrderLogEntry) {
    cancelAbortRefs.current.get(entry.id)?.abort();
    cancelAbortRefs.current.delete(entry.id);
    const ctrl = new AbortController();
    cancelAbortRefs.current.set(entry.id, ctrl);
    setActionState(s => ({ ...s, [entry.id]: { loading: true, error: null } }));
    try {
      const date = toKRDate(entry.submitted_at);
      const res = await getKROrderStatus(entry.order_id, date, ctrl.signal);
      const updated = updateOrderStatus(entry.id, res.status);
      setOrderLog(updated);
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: null } }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    } finally {
      if (cancelAbortRefs.current.get(entry.id) === ctrl) cancelAbortRefs.current.delete(entry.id);
    }
  }

  // ── Refresh bots ──────────────────────────────────────────────────────────

  async function handleRefreshBots() {
    botsAbortRef.current?.abort();
    const ctrl = new AbortController();
    botsAbortRef.current = ctrl;
    setBotsLoading(true); setBotsError(null);
    try {
      const res = await getAllBotsLiveStatus(ctrl.signal);
      if (botsAbortRef.current !== ctrl) return;
      setBots(res.bots);
    } catch (e) {
      if (botsAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setBotsError(e instanceof Error ? e.message : String(e));
    } finally {
      if (botsAbortRef.current === ctrl) setBotsLoading(false);
    }
  }

  useEffect(() => { handleRefreshBots(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClearLog() { clearOrderLog(); setOrderLog([]); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <PageBanner pageKey="orders" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Order Form + Log ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">

            {/* Venue tabs */}
            <div className="flex rounded overflow-hidden border border-border w-fit mb-4">
              {(["KR", "US", "HL"] as Venue[]).map(v => (
                <button
                  key={v}
                  className={`px-5 py-1.5 text-sm font-medium ${
                    venue === v
                      ? "border-accent text-accent bg-accent/10"
                      : "bg-panel-2 text-text-2 hover:bg-panel"
                  }`}
                  onClick={() => { setVenue(v); setSubmitResult(null); setSubmitError(null); if (v === "HL") loadHLPositions(hlPaper); }}
                >
                  {v}
                </button>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              {venue === "KR" ? "KR Manual Order" : venue === "US" ? "US Manual Order" : "Hyperliquid Order"}
            </h2>

            {venue === "HL" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Coin</label>
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono uppercase"
                    placeholder="ETH"
                    value={hlCoin}
                    onChange={e => setHlCoin(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Side</label>
                  <div className="flex gap-2">
                    {(["BUY", "SELL"] as const).map(s => (
                      <button key={s} onClick={() => setHlSide(s)}
                        className={`px-4 py-1.5 rounded text-sm font-medium border ${
                          hlSide === s
                            ? s === "BUY" ? "bg-pos/20 border-pos text-pos" : "bg-neg/20 border-neg text-neg"
                            : "border-border text-text-3"
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Size</label>
                  <input
                    type="number" step="0.001"
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                    value={hlSize} onChange={e => setHlSize(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Type</label>
                  <div className="flex gap-2">
                    {(["market", "limit"] as const).map(t => (
                      <button key={t} onClick={() => setHlOrderType(t)}
                        className={`px-4 py-1.5 rounded text-sm border ${
                          hlOrderType === t ? "border-accent text-accent bg-accent/10" : "border-border text-text-3"
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
                {hlOrderType === "limit" && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-text-2 w-24 shrink-0">Limit Px</label>
                    <input
                      type="number" step="0.01"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                      value={hlLimitPx} onChange={e => setHlLimitPx(e.target.value)}
                      placeholder="2500.00"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Reduce Only</label>
                  <input type="checkbox" checked={hlReduceOnly} onChange={e => setHlReduceOnly(e.target.checked)}
                    className="w-4 h-4 accent-accent" />
                </div>

                {/* Paper / Live 토글 */}
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-sm text-text-2 w-24 shrink-0">Mode</label>
                  <div className="flex rounded overflow-hidden border border-border">
                    <button
                      onClick={() => { setHlPaper(true); loadHLPositions(true); }}
                      className={`px-4 py-1 text-xs font-medium ${hlPaper ? "bg-info/20 border-r border-border text-info" : "bg-panel-2 border-r border-border text-text-3"}`}
                    >Paper</button>
                    <button
                      onClick={() => { setHlPaper(false); loadHLPositions(false); }}
                      className={`px-4 py-1 text-xs font-medium ${!hlPaper ? "bg-warn/20 text-warn" : "bg-panel-2 text-text-3"}`}
                    >Live</button>
                  </div>
                  {!hlPaper && (
                    <span className="text-warn text-xs font-medium">실거래 모드</span>
                  )}
                </div>

                <button
                  onClick={() => hlPaper ? submitHLOrder() : setHlConfirm(true)}
                  disabled={hlSubmitting}
                  className={`w-full py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50 ${
                    hlPaper ? "bg-info/20 border border-info text-info" : "bg-accent text-black"
                  }`}
                >
                  {hlSubmitting ? "주문 중…" : hlPaper ? `[Paper] ${hlSide} ${hlCoin}` : `${hlSide} ${hlCoin}`}
                </button>
                {hlSubmitMsg && (
                  <p className={`text-sm ${hlSubmitMsg.includes("완료") ? "text-pos" : "text-neg"}`}>{hlSubmitMsg}</p>
                )}

                {/* 실거래 확인 모달 */}
                {hlConfirm && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-panel border border-warn rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
                      <h3 className="text-warn font-semibold text-base">실거래 주문 확인</h3>
                      <div className="bg-panel-2 rounded p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-3">종목</span>
                          <span className="font-data text-text-1">{hlCoin.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-3">방향</span>
                          <span className={`font-medium ${hlSide === "BUY" ? "text-pos" : "text-neg"}`}>{hlSide}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-3">수량</span>
                          <span className="font-data text-text-1">{hlSize}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-3">유형</span>
                          <span className="font-data text-text-1">{hlOrderType}</span>
                        </div>
                        {hlOrderType === "limit" && hlLimitPx && (
                          <div className="flex justify-between">
                            <span className="text-text-3">지정가</span>
                            <span className="font-data text-text-1">${hlLimitPx}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-warn text-xs">실제 USDC가 사용됩니다. 계속하시겠습니까?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setHlConfirm(false)}
                          className="flex-1 border border-border text-text-2 py-2 rounded text-sm hover:bg-panel-2"
                        >취소</button>
                        <button
                          onClick={submitHLOrder}
                          className="flex-1 bg-accent text-black py-2 rounded text-sm font-semibold hover:opacity-90"
                        >확인 · 주문</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Positions */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-3 text-xs uppercase tracking-wider">포지션</span>
                    <button onClick={() => loadHLPositions(hlPaper)} disabled={hlLoading}
                      className="text-text-3 text-xs hover:text-text-1 disabled:opacity-40">
                      {hlLoading ? "…" : "↻"}
                    </button>
                  </div>
                  {hlError && <p className="text-neg text-xs">{hlError}</p>}
                  {hlPositions && (
                    <>
                      <div className="flex gap-4 text-xs mb-3">
                        <span className="text-text-3">Account Value <span className="text-text-1 font-data">${parseFloat(hlPositions.margin_summary.accountValue || "0").toFixed(2)}</span></span>
                        <span className="text-text-3">Margin Used <span className="text-text-1 font-data">${parseFloat(hlPositions.margin_summary.totalMarginUsed || "0").toFixed(2)}</span></span>
                      </div>
                      {hlPositions.asset_positions.length === 0 ? (
                        <p className="text-text-3 text-xs">오픈 포지션 없음</p>
                      ) : (
                        <div className="space-y-2">
                          {hlPositions.asset_positions.map((ap, i) => {
                            const p = ap.position;
                            const sz = parseFloat(p.szi);
                            const pnl = parseFloat(p.unrealizedPnl);
                            const isLong = sz > 0;
                            return (
                              <div key={i} className="border border-border rounded p-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-data font-semibold text-accent">{p.coin}</span>
                                  <span className={`font-medium ${isLong ? "text-pos" : "text-neg"}`}>{isLong ? "LONG" : "SHORT"} {Math.abs(sz)}</span>
                                </div>
                                <div className="flex gap-4 mt-1 text-text-3">
                                  <span>Entry <span className="font-data text-text-2">{p.entryPx ?? "—"}</span></span>
                                  <span>Unr.PnL <span className={`font-data font-medium ${pnl >= 0 ? "text-pos" : "text-neg"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(4)}</span></span>
                                  {p.liquidationPx && <span className="text-neg">Liq <span className="font-data">{p.liquidationPx}</span></span>}
                                </div>
                                <button onClick={() => handleHLClose(ap)}
                                  className="mt-1.5 text-[10px] border border-neg/40 text-neg rounded px-2 py-0.5 hover:bg-neg/10">
                                  Close Position
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {hlPositions.open_orders.length > 0 && (
                        <div className="mt-3">
                          <span className="text-text-3 text-xs uppercase tracking-wider block mb-1">미체결 주문</span>
                          <div className="space-y-1">
                            {hlPositions.open_orders.map((o, i) => (
                              <div key={i} className="flex items-center justify-between text-xs border-b border-border/40 py-1">
                                <span className="font-data text-accent">{o.coin}</span>
                                <span className={o.side === "B" ? "text-pos" : "text-neg"}>{o.side === "B" ? "BUY" : "SELL"}</span>
                                <span className="font-data text-text-2">{o.sz} @ {o.limitPx}</span>
                                <button onClick={() => handleHLCancel(o)}
                                  className="text-[10px] text-neg border border-neg/30 rounded px-1.5 py-0.5 hover:bg-neg/10">
                                  Cancel
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            {venue !== "HL" && (
              <><div className="space-y-3">
              {/* Code / Symbol */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">
                  {venue === "KR" ? "Code" : "Symbol"}
                </label>
                {venue === "KR" ? (
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                    placeholder="005930"
                    value={krCode}
                    onChange={e => setKrCode(e.target.value)}
                  />
                ) : (
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono uppercase"
                    placeholder="AAPL"
                    value={usSymbol}
                    onChange={e => setUsSymbol(e.target.value.toUpperCase())}
                  />
                )}
              </div>

              {/* Side */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Side</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["BUY", "SELL"] as Side[]).map(s => (
                    <button
                      key={s}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        side === s
                          ? s === "BUY" ? "bg-pos text-bg" : "bg-neg text-bg"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setSide(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Qty</label>
                <input
                  type="number"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                  min="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>

              {/* Order type */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Type</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["MARKET", "LIMIT"] as OrderType[]).map(t => (
                    <button
                      key={t}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        orderType === t
                          ? "border-accent text-accent bg-accent/10"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setOrderType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price (LIMIT only) */}
              {orderType === "LIMIT" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Price</label>
                  {venue === "KR" ? (
                    <input
                      type="number"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                      placeholder="limit price (KRW)"
                      value={krPrice}
                      onChange={e => setKrPrice(e.target.value)}
                    />
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                      placeholder="limit price (USD)"
                      value={usLimitPrice}
                      onChange={e => setUsLimitPrice(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                className="bg-accent text-black text-sm font-medium rounded px-5 py-2 disabled:opacity-40"
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? "Placing…" : "Place Order"}
              </button>
              {submitResult && <span className="text-sm text-pos font-mono">{submitResult}</span>}
              {submitError && <span className="text-sm text-neg">{submitError}</span>}
            </div></>
            )}
          </div>

          {/* Order Log */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">Order Log</h2>
              {orderLog.length > 0 && (
                <button className="text-xs text-neg hover:underline" onClick={handleClearLog}>
                  Clear
                </button>
              )}
            </div>
            {orderLog.length === 0 ? (
              <p className="text-sm text-text-3">No orders placed yet.</p>
            ) : (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Venue</th>
                      <th className="py-1 text-left font-medium">Code</th>
                      <th className="py-1 text-left font-medium">Side</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-left font-medium">ID</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...orderLog].reverse().map(entry => {
                      const act = actionState[entry.id];
                      return (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="py-1.5 text-text-3">{entry.venue}</td>
                          <td className="py-1.5 text-text-1 font-mono">{entry.code}</td>
                          <td className={`py-1.5 font-medium ${entry.side === "BUY" ? "text-pos" : "text-neg"}`}>
                            {entry.side}
                          </td>
                          <td className="py-1.5 text-text-1 text-right">{entry.qty}</td>
                          <td className="py-1.5 text-text-2 font-mono">{entry.order_id}</td>
                          <td className="py-1.5 text-text-2">{entry.status}</td>
                          <td className="py-1.5">
                            <div className="flex items-center gap-1">
                              {canCancel(entry.status) && (
                                <button
                                  className="text-xs text-neg border border-neg/50 rounded px-2 py-0.5 hover:bg-neg/10 disabled:opacity-40"
                                  disabled={act?.loading}
                                  onClick={() => handleCancel(entry)}
                                >
                                  {act?.loading ? "…" : "Cancel"}
                                </button>
                              )}
                              {entry.venue === "KR" && (
                                <button
                                  className="text-xs border border-border text-text-2 rounded px-2 py-0.5 hover:bg-panel-2 disabled:opacity-40"
                                  disabled={act?.loading}
                                  onClick={() => handleCheckStatus(entry)}
                                >
                                  {act?.loading ? "…" : "Check"}
                                </button>
                              )}
                              {act?.error && (
                                <span className="text-neg text-xs ml-1">{act.error}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Right: Bot Positions ── */}
        <section>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">Bot Positions</h2>
              <button
                className="bg-accent text-black text-xs font-medium rounded px-3 py-1 disabled:opacity-40"
                onClick={handleRefreshBots}
                disabled={botsLoading}
              >
                {botsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {botsError && <p className="text-sm text-neg mb-2">{botsError}</p>}

            {bots.length === 0 && !botsLoading && !botsError ? (
              <p className="text-sm text-text-3">No bots found.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Bot</th>
                      <th className="py-1 text-left font-medium">Instrument</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Pos</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-right font-medium">Entry</th>
                      <th className="py-1 text-right font-medium">Unr. PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map(bot => (
                      <tr key={bot.bot_id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono text-xs">{bot.bot_id}</td>
                        <td className="py-1.5 text-text-2">{bot.instrument_id}</td>
                        <td className="py-1.5">
                          <span className={`font-medium ${bot.running ? "text-pos" : "text-text-3"}`}>
                            {bot.running ? "RUNNING" : "STOPPED"}
                          </span>
                        </td>
                        <td className={`py-1.5 font-medium ${
                          bot.position === "LONG" ? "text-pos"
                            : bot.position === "SHORT" ? "text-neg"
                            : "text-text-3"
                        }`}>
                          {bot.position}
                        </td>
                        <td className="py-1.5 text-text-1 text-right">{bot.qty}</td>
                        <td className="py-1.5 text-text-1 text-right font-mono">
                          {bot.last_price != null ? bot.last_price.toFixed(2) : "—"}
                        </td>
                        <td className="py-1.5 text-text-2 text-right font-mono">
                          {bot.entry_price != null ? bot.entry_price.toFixed(2) : "—"}
                        </td>
                        <td className={`py-1.5 text-right font-mono font-medium ${pnlColor(bot.unrealized_pnl)}`}>
                          {fmtPnl(bot.unrealized_pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bots.some(b => b.error) && (
              <div className="mt-3 space-y-1">
                {bots.filter(b => b.error).map(b => (
                  <p key={b.bot_id} className="text-xs text-neg">{b.bot_id}: {b.error}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
