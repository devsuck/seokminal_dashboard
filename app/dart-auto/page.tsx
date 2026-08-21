"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ApiError, getDartSignals, getDartPositions, mirrorDart,
  getDartBotStatus, setDartBotConfig,
  type DartSignal, type DartPosition, type DartBotStatus,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";

const VERDICT: Record<string, string> = {
  BUY: "text-pos border-pos/40 bg-pos/10",
  AVOID: "text-neg border-neg/40 bg-neg/10",
  SKIP: "text-text-3 border-border bg-panel-2",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

export default function DartAutoPage() {
  const [signals, setSignals] = useState<DartSignal[]>([]);
  const [positions, setPositions] = useState<DartPosition[]>([]);
  const [bot, setBot] = useState<DartBotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [krw, setKrw] = useState("1000000");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const sCtrl = useRef<AbortController | null>(null);
  const pCtrl = useRef<AbortController | null>(null);
  const bCtrl = useRef<AbortController | null>(null);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2800); }

  const loadPositions = useCallback(() => {
    pCtrl.current?.abort(); const ctrl = new AbortController(); pCtrl.current = ctrl;
    getDartPositions(ctrl.signal).then(p => { if (!ctrl.signal.aborted) setPositions(p); }).catch(() => {});
  }, []);

  const loadBot = useCallback(() => {
    bCtrl.current?.abort(); const ctrl = new AbortController(); bCtrl.current = ctrl;
    getDartBotStatus(ctrl.signal)
      .then(b => { if (!ctrl.signal.aborted) { setBot(b); setKrw(String(b.budget)); } })
      .catch(() => {});
  }, []);

  const loadSignals = useCallback(() => {
    sCtrl.current?.abort(); const ctrl = new AbortController(); sCtrl.current = ctrl;
    setError(null);
    getDartSignals(14, ctrl.signal)
      .then(d => { if (!ctrl.signal.aborted) { setSignals(d); setLoading(false); } })
      .catch(e => { if (!ctrl.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    loadSignals(); loadPositions(); loadBot();
    const iv = setInterval(() => { loadSignals(); loadPositions(); loadBot(); }, 60_000);
    return () => { clearInterval(iv); sCtrl.current?.abort(); pCtrl.current?.abort(); bCtrl.current?.abort(); };
  }, [loadSignals, loadPositions, loadBot]);

  async function toggleBot() {
    const next = !(bot?.enabled ?? false);
    try {
      await setDartBotConfig({ enabled: next, budget: parseFloat(krw) || 1000000 });
      flash(next ? "서버 자동봇 ON — 브라우저 꺼도 실행" : "서버 자동봇 OFF");
      loadBot();
    } catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  async function resetSpent() {
    try {
      await setDartBotConfig({ reset_spent: true });
      flash("누적 지출 리셋 — 예산 전액 다시 사용 가능");
      loadBot();
    } catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  async function buy(s: DartSignal) {
    if (!s.ticker) { flash("종목코드 없음"); return; }
    const amt = Math.round((parseFloat(krw) || 1000000) * (s.weight || 1));
    const k = `${s.corp_name}:${s.action_type}:${s.date}`;
    setBusy(k);
    try { const r = await mirrorDart(s.ticker, amt); flash(`${s.corp_name} ${r.qty}주 모의 매수 (₩${r.price.toLocaleString()})`); loadPositions(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setBusy(null); }
  }

  const totalPl = positions.reduce((a, p) => a + (p.current - p.avg_price) * p.qty, 0);
  const on = bot?.enabled ?? false;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">DART 기업행위 오토파일럿</h1>
        <p className="text-text-3 text-sm mt-0.5">
          한국 공시 감시 → <span className="text-pos">자사주 취득·소각=매수</span>, <span className="text-neg">유상증자=회피</span>. 개인 내부자 매매는 5영업일 지연이라 제외. <span className="text-warn">KIS 모의</span>. 서버봇은 <span className="text-text-2">브라우저 꺼도</span> 로컬 서버(uvicorn)만 켜져 있으면 돎.
        </p>
      </div>

      {/* 서버 자동봇 */}
      <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={toggleBot}
          className={`text-sm font-medium px-4 py-1.5 rounded border ${on ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
          {on ? "● 서버 자동봇 ON" : "서버 자동봇 OFF"}
        </button>
        <div className="flex items-center gap-1.5">
          <label className="text-text-3 text-xs">매수 예산</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data">₩</span>
            <input value={krw} onChange={e => setKrw(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"onBlur={() => on && setDartBotConfig({ budget: parseFloat(krw) || 1000000 })}
              className="w-32 bg-panel-2 border border-border rounded pl-7 pr-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
          </div>
        </div>
        {bot && (
          <div className="flex items-center gap-3 text-[11px] text-text-3 ml-auto flex-wrap">
            <span>장 {bot.market_open ? <span className="text-pos">열림</span> : "마감"}</span>
            <span>마지막 실행 {fmtTime(bot.last_run)}</span>
            <span>주기 {Math.round(bot.interval_sec / 60)}분</span>
          </div>
        )}
      </div>
      {bot && (
        <div className="bg-panel border border-border rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap text-[11px]">
          <span className="text-text-3">누적 지출 <span className="text-text-1 font-data">₩{Math.round(bot.spent).toLocaleString()}</span> / ₩{Math.round(bot.budget).toLocaleString()}</span>
          <span className={`font-data px-1 font-bold ${bot.remaining < 1 ? "bg-neg/20 text-neg" : "bg-pos/20 text-pos"}`}>잔여 ₩{Math.round(bot.remaining).toLocaleString()}</span>
          {bot.remaining < 1 && <span className="text-warn">예산 소진 — 매도되면 자동 회수됨</span>}
          <button onClick={resetSpent} className="ml-auto text-text-3 hover:text-accent border border-border rounded px-2 py-1">누적 지출 리셋</button>
        </div>
      )}

      {/* 매도 규칙 + 봇 보유 포지션 — 규칙 충족 시 자동 매도되고 예산이 회수됨 */}
      {bot && (
        <div className="bg-panel border border-border rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap text-[11px]">
          <span className="text-text-2 font-semibold">자동 매도 규칙</span>
          <label className="text-text-3">익절%</label>
          <input defaultValue={Math.round((bot.tp_pct ?? 0.15) * 100)} inputMode="numeric"
            onBlur={e => setDartBotConfig({ tp_pct: (parseFloat(e.target.value) || 15) / 100 })}
            className="w-12 bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 font-data outline-none focus:border-accent" />
          <label className="text-text-3">손절%</label>
          <input defaultValue={Math.round((bot.sl_pct ?? 0.07) * 100)} inputMode="numeric"
            onBlur={e => setDartBotConfig({ sl_pct: (parseFloat(e.target.value) || 7) / 100 })}
            className="w-12 bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 font-data outline-none focus:border-accent" />
          <label className="text-text-3">최대보유(일)</label>
          <input defaultValue={bot.max_hold_days ?? 20} inputMode="numeric"
            onBlur={e => setDartBotConfig({ max_hold_days: parseInt(e.target.value) || 20 })}
            className="w-12 bg-panel-2 border border-border rounded px-1.5 py-1 text-text-1 font-data outline-none focus:border-accent" />
          <span className="text-text-3 ml-auto">
            봇 보유 {bot.positions?.length ?? 0}종목
            {(bot.positions?.length ?? 0) > 0 && (
              <span className="font-data"> — {bot.positions.slice(0, 6).map(p => p.corp || p.code).join(" · ")}{bot.positions.length > 6 ? " 외" : ""}</span>
            )}
          </span>
        </div>
      )}
      {on && !bot?.market_open && (
        <p className="text-text-3 text-[11px] px-1">ℹ 장 마감 중 — 자사주 신규 공시는 다음 개장 때 매수됨 (7일 내 공시 추적).</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* 공시 */}
        <Panel>
          <PanelHeader right={
            <span className="tabular-nums flex items-center gap-2">
              <span className="text-pos">매수 {signals.filter(s => s.verdict === "BUY").length}</span>
              <span className="text-neg">회피 {signals.filter(s => s.verdict === "AVOID").length}</span>
              <span className="text-text-3">중립 {signals.filter(s => s.verdict === "SKIP").length}</span>
              <span className="text-text-3">· 1분 갱신</span>
            </span>
          }>
            기업행위 공시 (최근 14일)
          </PanelHeader>
          {error ? <div className="p-2"><EmptyState message="공시 로드 실패" hint={error} /></div>
            : loading ? <LoadingState message="DART 공시 로딩 중…" />
            : signals.length === 0 ? <EmptyState message="기업행위 공시 없음" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-3 text-[11px] border-b border-border">
                    <th className="text-left font-medium px-3 py-2">기업</th>
                    <th className="text-left font-medium px-3 py-2">종목</th>
                    <th className="text-left font-medium px-3 py-2">공시</th>
                    <th className="text-left font-medium px-3 py-2">판정</th>
                    <th className="text-left font-medium px-3 py-2">접수일</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s, i) => {
                    const k = `${s.corp_name}:${s.action_type}:${s.date}:${s.ticker ?? ""}:${i}`;
                    const tint = s.verdict === "BUY" ? "bg-pos/5 hover:bg-pos/10"
                      : s.verdict === "AVOID" ? "bg-neg/5 hover:bg-neg/10"
                      : "hover:bg-panel-2";
                    return (
                      <tr key={k} className={`border-b border-border/50 transition-colors ${tint}`}>
                        <td className="px-3 py-2 text-text-2 truncate max-w-[120px]">{s.corp_name}</td>
                        <td className="px-3 py-2 font-data text-text-1">{s.ticker ?? "—"}</td>
                        <td className="px-3 py-2 text-text-3 text-xs">{s.action_label}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${VERDICT[s.verdict]}`}>
                            {s.verdict === "BUY" ? "매수" : s.verdict === "AVOID" ? "회피" : "중립"} · {s.note}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-3 font-data text-xs">{s.date}</td>
                        <td className="px-3 py-2 text-right">
                          {s.verdict === "BUY" && s.ticker ? (
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-text-3 text-[10px] font-data" title="비중 배율 (소각 1.5×/취득 1×/신탁 0.6×)">
                                {s.weight}× · ₩{Math.round((parseFloat(krw) || 0) * s.weight).toLocaleString()}
                              </span>
                              <button onClick={() => buy(s)} disabled={busy === k}
                                className="text-[11px] px-2 py-1 rounded border border-pos/40 text-pos hover:bg-pos/10 disabled:opacity-40">
                                {busy === k ? "…" : "모의 매수"}
                              </button>
                            </div>
                          ) : s.dart_url ? (
                            <a href={s.dart_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-text-3 hover:text-accent no-underline">DART ↗</a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </Panel>

        {/* 우측: 보유 + 봇 로그 */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader right={
              <span className={totalPl >= 0 ? "text-pos" : "text-neg"}>
                {totalPl >= 0 ? "+" : ""}₩{Math.round(totalPl).toLocaleString()}
              </span>
            }>
              모의 보유 (KIS)
            </PanelHeader>
            {positions.length > 0 && bot && (
              <div className="px-4 py-2 bg-panel-2 border-b border-border text-[11px] text-text-2 leading-relaxed">
                <span className="text-text-1 font-semibold">매도 정책:</span> 익절 {Math.round((bot.tp_pct ?? 0.15) * 100)}% / 손절 {Math.round((bot.sl_pct ?? 0.07) * 100)}% / 최대보유 {bot.max_hold_days ?? 20}일 충족 시 자동 매도.
                종목 누르면 차트에서 매수 위치 확인.
              </div>
            )}
            {positions.length === 0 ? (
              <div className="p-5"><EmptyState message="보유 없음" hint="공시를 매수하면 표시" /></div>
            ) : (
              <div className="divide-y divide-border/50">
                {positions.map(p => (
                  <Link key={p.code} href={`/market?symbol=${encodeURIComponent(`${p.code}.XKRX`)}`}
                    title="차트에서 매매 위치 보기"
                    className="px-4 py-2.5 flex items-center justify-between no-underline hover:bg-panel-2 transition-colors group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-1 text-sm font-semibold truncate group-hover:text-accent">{p.name || p.code}</span>
                        <span className="font-data text-text-3 text-[10px] shrink-0">{p.code}</span>
                        <span className="text-text-3 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">차트 →</span>
                      </div>
                      <div className="text-text-3 text-[10px] font-data">{p.qty}주 · 평단 ₩{p.avg_price.toLocaleString()}</div>
                    </div>
                    <div className={`text-right font-data text-sm shrink-0 px-1 font-bold ${
                      p.return_pct == null ? "text-text-3" : (p.return_pct ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                      {p.return_pct != null ? `${p.return_pct >= 0 ? "+" : ""}${p.return_pct.toFixed(2)}%` : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {/* 봇 실행 로그 */}
          <Panel>
            <PanelHeader>봇 실행 로그</PanelHeader>
            {!bot || bot.log.length === 0 ? (
              <div className="p-5"><EmptyState message="로그 없음" hint="자동봇이 매수하면 기록됨" /></div>
            ) : (
              <div className="divide-y divide-border/50 max-h-[320px] overflow-y-auto">
                {bot.log.map((l, i) => (
                  <div key={i} className="px-4 py-2 text-xs flex items-start gap-2">
                    <span className="text-text-3 font-data text-[10px] shrink-0 w-16">{fmtTime(l.ts)}</span>
                    <span className="min-w-0">
                      {l.kind === "buy" ? <span className="text-pos">매수 {l.corp} {l.code} {l.qty}주 @₩{l.price?.toLocaleString()}</span>
                        : l.kind === "sell" ? (
                          <span className={(l.pnl_pct ?? 0) >= 0 ? "text-pos" : "text-neg"}>
                            매도 {l.corp} {l.code} {l.qty}주 @₩{l.exit_price?.toLocaleString()}
                            {" "}({l.reason ?? `${(l.pnl_pct ?? 0) >= 0 ? "+" : ""}${l.pnl_pct?.toFixed(2)}%`})
                          </span>
                        )
                        : l.kind === "fail" ? <span className="text-neg">실패 {l.corp} {l.code} — {l.msg}</span>
                        : l.kind === "config" ? <span className="text-text-3">설정 변경</span>
                        : <span className="text-text-3">{l.msg ?? l.kind}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
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
