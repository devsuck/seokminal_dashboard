"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, getVrpBotStatus, setVrpBotConfig, runVrpBotNow,
  type VrpBotStatus,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

export default function VrpPage() {
  const [bot, setBot] = useState<VrpBotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbols, setSymbols] = useState("SPY");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bCtrl = useRef<AbortController | null>(null);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2800); }

  const loadBot = useCallback(() => {
    bCtrl.current?.abort(); const ctrl = new AbortController(); bCtrl.current = ctrl;
    setError(null);
    getVrpBotStatus(ctrl.signal)
      .then(b => { if (!ctrl.signal.aborted) { setBot(b); setSymbols(b.symbols.join(", ")); setLoading(false); } })
      .catch(e => { if (!ctrl.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    loadBot();
    const iv = setInterval(loadBot, 60_000);
    return () => { clearInterval(iv); bCtrl.current?.abort(); };
  }, [loadBot]);

  async function toggleBot() {
    const next = !(bot?.enabled ?? false);
    try {
      await setVrpBotConfig({ enabled: next });
      flash(next ? "VRP 봇 ON — 서버(uvicorn) 켜져 있으면 브라우저 꺼도 실행" : "VRP 봇 OFF");
      loadBot();
    } catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  async function saveSymbols() {
    const list = symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (list.length === 0) return;
    try { await setVrpBotConfig({ symbols: list }); flash("감시 종목 저장됨"); loadBot(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  function saveField(field: string, value: number) {
    setVrpBotConfig({ [field]: value }).then(loadBot).catch(e => flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`));
  }

  async function runNow() {
    setBusy(true);
    try { const r = await runVrpBotNow(); flash(`실행 완료 — ${JSON.stringify(r)}`); loadBot(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }

  const on = bot?.enabled ?? false;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">VRP 아이언 콘도어 옵션 봇</h1>
        <p className="text-text-3 text-sm mt-0.5">
          IV(내재변동성)가 RV(실현변동성)보다 구조적으로 비쌀 때 <span className="text-pos">아이언 콘도어</span>(숏 스트랭글 + 보호용 윙)로 프리미엄을 판다.
          IB API는 포지션별 마진을 조회할 수 없어 <span className="text-warn">네이키드 숏은 쓰지 않고</span>, 윙 폭에서 크레딧을 뺀 최대손실을 사전 계산해 리스크 게이트를 건다. <span className="text-warn">Paper 전용</span> — 15분 지연 시세.
        </p>
      </div>

      <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={toggleBot}
          className={`text-sm font-medium px-4 py-1.5 rounded border ${on ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
          {on ? "● 서버 자동봇 ON" : "서버 자동봇 OFF"}
        </button>
        <div className="flex items-center gap-1.5">
          <label className="text-text-3 text-xs">감시 종목</label>
          <input value={symbols} onChange={e => setSymbols(e.target.value)} onBlur={saveSymbols}
            placeholder="SPY, QQQ"
            className="w-40 bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        </div>
        <button onClick={runNow} disabled={busy}
          className="text-xs px-3 py-1.5 rounded border border-border text-text-3 hover:text-accent disabled:opacity-40">
          {busy ? "실행중…" : "지금 실행"}
        </button>
        {bot && (
          <div className="flex items-center gap-3 text-[11px] text-text-3 ml-auto flex-wrap">
            <span>마지막 실행 {fmtTime(bot.last_run)}</span>
            <span>주기 {Math.round(bot.interval_sec / 60)}분</span>
          </div>
        )}
      </div>

      {bot && (
        <div className="bg-panel border border-border rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap text-[11px]">
          <span className="text-text-3">누적 최대손실 예약 <span className="text-text-1 font-data">${Math.round(bot.spent).toLocaleString()}</span></span>
          <span className={`font-data ${bot.realized_pnl >= 0 ? "text-pos" : "text-neg"}`}>
            실현손익 {bot.realized_pnl >= 0 ? "+" : ""}${bot.realized_pnl.toLocaleString()}
          </span>
        </div>
      )}

      {bot && (
        <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap text-[11px]">
          <span className="text-text-2 font-semibold shrink-0">진입/청산 규칙</span>
          {[
            { key: "target_dte_min", label: "최소 DTE", val: bot.target_dte_min, w: "w-12" },
            { key: "target_dte_max", label: "최대 DTE", val: bot.target_dte_max, w: "w-12" },
            { key: "short_delta", label: "숏 델타", val: bot.short_delta, w: "w-14", step: true },
            { key: "wing_width_pct", label: "윙 폭%", val: bot.wing_width_pct * 100, w: "w-14", pct: true },
            { key: "min_spread_pct", label: "최소 VRP%", val: bot.min_spread_pct * 100, w: "w-14", pct: true },
            { key: "profit_target_pct", label: "익절%(크레딧대비)", val: bot.profit_target_pct * 100, w: "w-14", pct: true },
            { key: "stop_multiple", label: "손절배수", val: bot.stop_multiple, w: "w-12", step: true },
            { key: "exit_dte", label: "강제청산 DTE", val: bot.exit_dte, w: "w-12" },
            { key: "max_positions", label: "최대포지션", val: bot.max_positions, w: "w-12" },
            { key: "contracts", label: "계약수", val: bot.contracts, w: "w-12" },
          ].map(f => (
            <span key={f.key} className="flex items-center gap-1">
              <label className="text-text-3">{f.label}</label>
              <input defaultValue={f.step ? f.val.toFixed(2) : Math.round(f.val)} inputMode="decimal"
                onBlur={e => {
                  const raw = parseFloat(e.target.value);
                  if (Number.isNaN(raw)) return;
                  saveField(f.key, f.pct ? raw / 100 : raw);
                }}
                className={`${f.w} bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 font-data outline-none focus:border-accent`} />
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-2 text-xs uppercase tracking-wider font-semibold">보유 콘도어</span>
            <span className="text-text-3 text-[11px]">{bot?.positions.length ?? 0}건</span>
          </div>
          {error ? <div className="p-2"><EmptyState message="상태 로드 실패" hint={error} /></div>
            : loading ? <LoadingState message="VRP 봇 상태 로딩 중…" />
            : !bot || bot.positions.length === 0 ? <EmptyState message="보유 포지션 없음" hint="VRP 조건 충족 시 자동 진입" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-3 text-[11px] border-b border-border">
                    <th className="text-left font-medium px-3 py-2">종목</th>
                    <th className="text-left font-medium px-3 py-2">만기</th>
                    <th className="text-left font-medium px-3 py-2">레그</th>
                    <th className="text-right font-medium px-3 py-2">크레딧</th>
                    <th className="text-right font-medium px-3 py-2">최대손실</th>
                    <th className="text-right font-medium px-3 py-2">진입VRP%</th>
                  </tr>
                </thead>
                <tbody>
                  {bot.positions.map((p, i) => (
                    <tr key={`${p.symbol}:${p.expiry}:${i}`} className="border-b border-border/50 hover:bg-panel-2">
                      <td className="px-3 py-2 text-text-1 font-data">{p.symbol}</td>
                      <td className="px-3 py-2 text-text-3 font-data text-xs">{p.expiry}</td>
                      <td className="px-3 py-2 text-text-3 text-[10px] font-data">
                        {p.legs.map(l => `${l.side === "BUY" ? "+" : "-"}${l.strike}${l.right}`).join(" ")}
                      </td>
                      <td className="px-3 py-2 text-right text-pos font-data">${p.credit_received.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-neg font-data">${p.max_loss.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-text-2 font-data">{p.entry_vrp_pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-2 text-xs uppercase tracking-wider font-semibold">봇 실행 로그</span>
          </div>
          {!bot || bot.log.length === 0 ? (
            <div className="p-5"><EmptyState message="로그 없음" hint="봇이 진입/청산하면 기록됨" /></div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
              {bot.log.map((l, i) => (
                <div key={i} className="px-4 py-2 text-xs flex items-start gap-2">
                  <span className="text-text-3 font-data text-[10px] shrink-0 w-16">{fmtTime(l.ts as string)}</span>
                  <span className="min-w-0 text-text-3">
                    {l.kind === "entry" ? <span className="text-pos">진입 {String(l.symbol)} 크레딧 ${Number(l.credit_received ?? 0).toLocaleString()}</span>
                      : l.kind === "exit" ? <span className="text-info">청산 {String(l.symbol)} ({String(l.reason ?? "")}) 손익 ${Number(l.pnl ?? 0).toLocaleString()}</span>
                      : l.kind === "risk_block" ? <span className="text-warn">리스크 차단 — {String(l.msg ?? "")}</span>
                      : l.kind === "entry_fail" || l.kind === "exit_fail" || l.kind === "unwind_fail" ? <span className="text-neg">실패 ({l.kind}) — {String(l.msg ?? "")}</span>
                      : l.kind === "config" ? "설정 변경"
                      : String(l.kind)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-text-1 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
