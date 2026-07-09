"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, getPolymarketBotStatus, setPolymarketBotConfig, runPolymarketBotNow,
  type PolymarketBotStatus,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

const SIDE_LABEL: Record<string, string> = { favorite: "페이버릿(우세)", underdog: "언더독(열세)", random: "랜덤" };

export default function PolymarketPage() {
  const [bot, setBot] = useState<PolymarketBotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState("500");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bCtrl = useRef<AbortController | null>(null);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2800); }

  const loadBot = useCallback(() => {
    bCtrl.current?.abort(); const ctrl = new AbortController(); bCtrl.current = ctrl;
    setError(null);
    getPolymarketBotStatus(ctrl.signal)
      .then(b => { if (!ctrl.signal.aborted) { setBot(b); setBudget(String(b.budget)); setLoading(false); } })
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
      await setPolymarketBotConfig({ enabled: next, budget: parseFloat(budget) || 500 });
      flash(next ? "Polymarket 봇 ON — 서버(uvicorn) 켜져 있으면 브라우저 꺼도 실행" : "Polymarket 봇 OFF");
      loadBot();
    } catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  async function resetSpent() {
    try { await setPolymarketBotConfig({ reset_spent: true }); flash("누적 지출 리셋"); loadBot(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  function setSide(side: string) {
    setPolymarketBotConfig({ side }).then(loadBot).catch(e => flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`));
  }

  function saveField(field: string, value: number) {
    setPolymarketBotConfig({ [field]: value }).then(loadBot).catch(e => flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`));
  }

  async function runNow() {
    setBusy(true);
    try { const r = await runPolymarketBotNow(); flash(`실행 완료 — ${JSON.stringify(r)}`); loadBot(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }

  const on = bot?.enabled ?? false;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">Polymarket 다각화 배스킷</h1>
        <p className="text-text-3 text-sm mt-0.5">
          <span className="text-warn">알파(초과수익) 전략 아님</span> — 예측시장 이벤트는 주식/크립토와 상관관계가 낮아 <span className="text-text-2">분산 목적</span>으로만 균등 배분 후 만기까지 보유한다.
          방향성 엣지 주장 없음. 이벤트 중복 배팅 금지(같은 이벤트에 두 번 안 들어감). <span className="text-warn">Paper 전용</span>.
        </p>
      </div>

      <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={toggleBot}
          className={`text-sm font-medium px-4 py-1.5 rounded border ${on ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
          {on ? "● 서버 자동봇 ON" : "서버 자동봇 OFF"}
        </button>
        <div className="flex items-center gap-1.5">
          <label className="text-text-3 text-xs">총 예산</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data">$</span>
            <input value={budget} onChange={e => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal"
              onBlur={() => on && setPolymarketBotConfig({ budget: parseFloat(budget) || 500 })}
              className="w-24 bg-panel-2 border border-border rounded pl-5 pr-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(["favorite", "underdog", "random"] as const).map(s => (
            <button key={s} onClick={() => setSide(s)}
              className={`text-[11px] px-2.5 py-1 rounded border ${bot?.side === s ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2"}`}>
              {SIDE_LABEL[s]}
            </button>
          ))}
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
          <span className="text-text-3">누적 지출 <span className="text-text-1 font-data">${Math.round(bot.spent).toLocaleString()}</span> / ${Math.round(bot.budget).toLocaleString()}</span>
          <span className={`font-data px-1 font-bold ${bot.remaining < 1 ? "bg-neg/20 text-neg" : "bg-pos/20 text-pos"}`}>잔여 ${Math.round(bot.remaining).toLocaleString()}</span>
          <span className={`font-data px-1 font-bold ${bot.realized_pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>실현손익 {bot.realized_pnl >= 0 ? "+" : ""}${bot.realized_pnl.toLocaleString()}</span>
          <button onClick={resetSpent} className="ml-auto text-text-3 hover:text-accent border border-border rounded px-2 py-1">누적 지출 리셋</button>
        </div>
      )}

      {bot && (
        <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap text-[11px]">
          <span className="text-text-2 font-semibold shrink-0">진입 필터</span>
          {[
            { key: "per_market_usd", label: "시장당 $", val: bot.per_market_usd, w: "w-16" },
            { key: "max_positions", label: "최대포지션", val: bot.max_positions, w: "w-12" },
            { key: "min_liquidity", label: "최소유동성$", val: bot.min_liquidity, w: "w-20" },
            { key: "min_price", label: "최소가", val: bot.min_price, w: "w-14", step: true },
            { key: "max_price", label: "최대가", val: bot.max_price, w: "w-14", step: true },
            { key: "min_days_to_resolution", label: "최소잔여일", val: bot.min_days_to_resolution, w: "w-12" },
          ].map(f => (
            <span key={f.key} className="flex items-center gap-1">
              <label className="text-text-3">{f.label}</label>
              <input defaultValue={f.step ? f.val.toFixed(2) : Math.round(f.val)} inputMode="decimal"
                onBlur={e => {
                  const raw = parseFloat(e.target.value);
                  if (Number.isNaN(raw)) return;
                  saveField(f.key, raw);
                }}
                className={`${f.w} bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 font-data outline-none focus:border-accent`} />
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <Panel>
          <PanelHeader right={<span>{bot?.positions.length ?? 0}건</span>}>보유 포지션</PanelHeader>
          {error ? <div className="p-2"><EmptyState message="상태 로드 실패" hint={error} /></div>
            : loading ? <LoadingState message="Polymarket 봇 상태 로딩 중…" />
            : !bot || bot.positions.length === 0 ? <EmptyState message="보유 포지션 없음" hint="필터 충족 시장이 있으면 자동 진입" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-3 text-[11px] border-b border-border">
                    <th className="text-left font-medium px-3 py-2">질문</th>
                    <th className="text-left font-medium px-3 py-2">사이드</th>
                    <th className="text-right font-medium px-3 py-2">진입가</th>
                    <th className="text-right font-medium px-3 py-2">배분$</th>
                    <th className="text-left font-medium px-3 py-2">만기</th>
                  </tr>
                </thead>
                <tbody>
                  {bot.positions.map((p, i) => (
                    <tr key={`${p.condition_id}:${i}`} className="border-b border-border/50 hover:bg-panel-2">
                      <td className="px-3 py-2 text-text-2 truncate max-w-[240px]" title={p.question}>{p.question}</td>
                      <td className="px-3 py-2 font-data text-text-1">{p.side}</td>
                      <td className="px-3 py-2 text-right font-data text-text-2">{p.entry_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-data text-text-1">${p.usd.toLocaleString()}</td>
                      <td className="px-3 py-2 text-text-3 font-data text-xs">{p.end_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Panel>

        <Panel>
          <PanelHeader>봇 실행 로그</PanelHeader>
          {!bot || bot.log.length === 0 ? (
            <div className="p-5"><EmptyState message="로그 없음" hint="봇이 진입/정산하면 기록됨" /></div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
              {bot.log.map((l, i) => (
                <div key={i} className="px-4 py-2 text-xs flex items-start gap-2">
                  <span className="text-text-3 font-data text-[10px] shrink-0 w-16">{fmtTime(l.ts as string)}</span>
                  <span className="min-w-0 text-text-3">
                    {l.kind === "entry" ? <span className="text-pos">진입 {String(l.side)} @{Number(l.entry_price ?? 0).toFixed(2)} ${Number(l.usd ?? 0).toLocaleString()}</span>
                      : l.kind === "resolve" ? <span className={`px-1 font-bold ${Number(l.pnl ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>정산 {String(l.side)} 손익 ${Number(l.pnl ?? 0).toLocaleString()}</span>
                      : l.kind === "scan_fail" ? <span className="text-neg">스캔 실패 — {String(l.msg ?? "")}</span>
                      : l.kind === "config" ? "설정 변경"
                      : String(l.kind)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {bot && (
        <p className="text-text-3 text-[10px] px-1">{bot.note}</p>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-text-1 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
