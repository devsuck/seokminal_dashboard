"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, getPolymarketBotStatus, setPolymarketBotConfig, runPolymarketBotNow,
  getPolymarketLeaderboard, getFleet, getEdges, getSharpWalletBotStatus,
  setSharpWalletBotConfig, runSharpWalletBotNow,
  type PolymarketBotStatus, type PolymarketLeaderboard,
  type FleetResponse, type FleetCollector, type EdgesResponse, type EdgeMetaRow,
  type SharpWalletBotStatus,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { BarChart, type BarItem } from "@/components/charts/BarChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";
import { FreshnessBar } from "@/components/ui/FreshnessBar";
import { collectorMeta, VERDICT_LABEL, type Verdict } from "@/lib/collectors";
import { gradeStyle, gradeLabel, edgeStatusLabel } from "@/lib/edge-labels";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

function fleetStyle(v: string): string {
  if (v === "fresh") return "border-pos/40 text-pos bg-pos/10";
  if (v === "stale") return "border-warn/40 text-warn bg-warn/10";
  if (v === "stuck") return "border-neg/40 text-neg bg-neg/20";
  return "border-neg/40 text-neg bg-neg/10"; // dead
}
function fmtAge(s: number | null | undefined): string {
  if (typeof s !== "number") return "—";
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}
// mlb_specialist_consensus는 전용 페이지(/mlb)가 있어 링크만 걸고 상세는 중복 렌더 안 함
const POLY_HYP_LINK: Record<string, string> = { mlb_specialist_consensus: "/mlb" };

export default function PolymarketPage() {
  const [bot, setBot] = useState<PolymarketBotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState("500");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lb, setLb] = useState<PolymarketLeaderboard | null>(null);
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [edges, setEdges] = useState<EdgesResponse | null>(null);
  const [swBot, setSwBot] = useState<SharpWalletBotStatus | null>(null);
  const [swBusy, setSwBusy] = useState(false);
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

  // 고래 리더보드 — 서버가 5분 캐시하므로 느슨하게 폴링
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const load = () => getPolymarketLeaderboard(ctrl.signal).then(d => { if (mounted) setLb(d); }).catch(() => {});
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); ctrl.abort(); };
  }, []);

  // 폴리마켓 관련 수집기 헬스 + 가설 검증 현황 — 전용 페이지 없는 것들 여기서 총괄
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const load = () => {
      getFleet(ctrl.signal).then(d => { if (mounted) setFleet(d); }).catch(() => {});
      getEdges(ctrl.signal).then(d => { if (mounted) setEdges(d); }).catch(() => {});
      getSharpWalletBotStatus(ctrl.signal).then(d => { if (mounted) setSwBot(d); }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); ctrl.abort(); };
  }, []);

  const polyCollectors = (fleet?.collectors ?? []).filter((c: FleetCollector) => c.key.startsWith("polymarket"));
  const polyEdges = (edges?.edges ?? []).filter((e: EdgeMetaRow) => e.category === "polymarket" || e.key in POLY_HYP_LINK);

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

  function saveField(field: string, value: number) {
    setPolymarketBotConfig({ [field]: value }).then(loadBot).catch(e => flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`));
  }

  async function runNow() {
    setBusy(true);
    try { const r = await runPolymarketBotNow(); flash(`실행 완료 — ${JSON.stringify(r)}`); loadBot(); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }

  async function toggleSwBot() {
    try {
      await setSharpWalletBotConfig({ enabled: !(swBot?.enabled ?? false) });
      flash(swBot?.enabled ? "샤프월렛 봇 OFF" : "샤프월렛 봇 ON");
      getSharpWalletBotStatus().then(setSwBot).catch(() => {});
    } catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
  }

  async function runSwNow() {
    setSwBusy(true);
    try { await runSharpWalletBotNow(); flash("샤프월렛 봇 실행 완료"); getSharpWalletBotStatus().then(setSwBot).catch(() => {}); }
    catch (e) { flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`); }
    finally { setSwBusy(false); }
  }

  const on = bot?.enabled ?? false;

  // 실현손익 누적 곡선 — resolve 로그(창)로 최근 추이, 마지막 점을 총 realized_pnl에 앵커
  const pnlSeries: TSSeries[] = (() => {
    if (!bot) return [];
    const resolves = bot.log
      .filter(l => l.kind === "resolve" && typeof l.pnl === "number")
      .map(l => ({ t: Math.floor(new Date(l.ts).getTime() / 1000), pnl: l.pnl as number }))
      .filter(r => Number.isFinite(r.t))
      .sort((a, b) => a.t - b.t);
    if (resolves.length === 0) return [];
    const totalVisible = resolves.reduce((s, r) => s + r.pnl, 0);
    let running = bot.realized_pnl - totalVisible;
    const points = resolves.map(r => { running += r.pnl; return { time: r.t, value: Math.round(running * 100) / 100 }; });
    const last = points[points.length - 1].value;
    return [{ label: "누적 실현손익", color: last >= 0 ? TOKEN.pos : TOKEN.neg, points }];
  })();

  // 샤프월렛 봇 — 실현손익 누적 곡선(exit 로그 기반)
  const swPnlSeries: TSSeries[] = (() => {
    if (!swBot) return [];
    const exits = swBot.log
      .filter(l => l.kind === "exit" && typeof l.pnl === "number")
      .map(l => ({ t: Math.floor(new Date(l.ts).getTime() / 1000), pnl: l.pnl as number }))
      .filter(r => Number.isFinite(r.t))
      .sort((a, b) => a.t - b.t);
    if (exits.length === 0) return [];
    const totalVisible = exits.reduce((s, r) => s + r.pnl, 0);
    let running = swBot.realized_pnl - totalVisible;
    const points = exits.map(r => { running += r.pnl; return { time: r.t, value: Math.round(running * 100) / 100 }; });
    const last = points[points.length - 1].value;
    return [{ label: "누적 실현손익", color: last >= 0 ? TOKEN.pos : TOKEN.neg, points }];
  })();

  // 리더보드 상위 PnL 막대(top 12)
  const lbBars: BarItem[] = (lb?.entries ?? []).slice(0, 12).map(e => ({
    label: `#${e.rank} ${e.proxyWallet.slice(0, 6)}…`,
    value: Math.round(e.pnl),
    href: `https://polymarket.com/profile/${e.proxyWallet}`,
    sub: `$${Math.round(e.vol).toLocaleString()}`,
  }));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">Polymarket 다각화 배스킷</h1>
        <p className="text-text-3 text-sm mt-0.5">
          <span className="text-warn">알파(초과수익) 전략 아님</span> — 예측시장 이벤트는 주식/크립토와 상관관계가 낮아 <span className="text-text-2">분산 목적</span>으로만 균등 배분 후 만기까지 보유한다.
          방향성 엣지 주장 없음. 이벤트 중복 배팅 금지(같은 이벤트에 두 번 안 들어감). <span className="text-warn">Paper 전용</span>.
        </p>
      </div>

      {/* 폴리마켓 관련 전체 현황 — 이 봇(다각화) 외 다른 폴리마켓 전략/수집기 총괄. mlb는 전용 페이지로 링크 */}
      <Panel>
        <PanelHeader right={fleet && (
          <span className="text-text-3 text-[10px] font-data">
            수집기 {polyCollectors.filter(c => c.verdict === "fresh").length}/{polyCollectors.length} 정상
          </span>
        )}>폴리마켓 전략·수집기 현황</PanelHeader>
        <div className="p-3 space-y-3">
          {swBot && (
            <a href="#sharp-wallet-bot" className="flex items-center justify-between border border-text-3/15 px-2 py-1.5 text-xs hover:bg-panel-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs px-1.5 py-0.5 border shrink-0 ${swBot.enabled ? "border-pos/40 text-pos bg-pos/10" : "border-text-3/40 text-text-3 bg-black/20"}`}>
                  {swBot.enabled ? "ON" : "OFF"}
                </span>
                <span className="text-text-2">샤프월렛 컨버전스 paper 집행봇</span>
                <span className="text-text-3">(다각화 봇과 별개 — bucket1/bucket3 신호 실집행) → 상세</span>
              </div>
              <span className="text-text-3 tabular-nums shrink-0">
                {swBot.last_run ? `지출 $${swBot.spent.toLocaleString()} · 실현손익 ${swBot.realized_pnl >= 0 ? "+" : ""}$${swBot.realized_pnl.toLocaleString()}` : "실행 이력 없음"}
              </span>
            </a>
          )}
          {polyCollectors.length === 0 ? (
            <div className="text-text-3 text-xs">수집기 헬스 로딩 중…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {polyCollectors.map(c => (
                <div key={c.key} className="flex items-center justify-between border border-text-3/15 px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-1.5 py-0.5 border shrink-0 ${fleetStyle(c.verdict)}`}>
                      {VERDICT_LABEL[c.verdict as Verdict] ?? c.verdict}
                    </span>
                    <span className="text-text-2 text-xs truncate" title={`${c.key} — ${c.reason}`}>{collectorMeta(c.key).label}</span>
                    {c.flapping && (
                      <span className="text-xs px-1.5 py-0.5 border shrink-0 border-warn/40 text-warn bg-warn/10"
                        title="24h 내 반복 재기동 — 근본원인 미해결 의심">재기동×{c.restart_count_24h}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-text-3 text-xs tabular-nums shrink-0">
                    <FreshnessBar ageSec={c.age_sec} staleAfterS={c.stale_after_s} verdict={c.verdict as Verdict} />
                    {fmtAge(c.age_sec)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {polyEdges.length > 0 && (
            <div className="divide-y divide-border/50 border-t border-border pt-2">
              {polyEdges.map(e => {
                const href = POLY_HYP_LINK[e.key];
                const Row = (
                  <div className="flex items-center justify-between py-1.5 text-xs gap-2">
                    <span className="text-text-2 min-w-0 truncate">{e.title}{href && <span className="text-accent"> → 상세</span>}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 border ${gradeStyle(e.grade.status)}`}>{gradeLabel(e.grade.status)}</span>
                      <span className="text-text-3">{edgeStatusLabel(e.status)}</span>
                    </span>
                  </div>
                );
                return href ? <a key={e.key} href={href} className="block hover:bg-panel-2">{Row}</a> : <div key={e.key}>{Row}</div>;
              })}
            </div>
          )}
        </div>
      </Panel>

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

      {/* 실현손익 추이 곡선 */}
      {pnlSeries.length > 0 && (
        <Panel>
          <PanelHeader right={<span className="text-text-3 text-[10px] font-data">최근 정산 {pnlSeries[0].points.length}건</span>}>
            실현손익 추이
          </PanelHeader>
          <div className="p-2">
            <ChartFrame caption="최근 정산 이벤트 누적(총 realized_pnl 앵커) · 페이퍼 · 표본 작을수록 노이즈 큼">
              <TimeSeries series={pnlSeries} height={200} yFormat={(v) => `$${v.toFixed(0)}`} />
            </ChartFrame>
          </div>
        </Panel>
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
            { key: "max_days_to_resolution", label: "최대잔여일", val: bot.max_days_to_resolution, w: "w-12" },
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

      {/* 샤프월렛 컨버전스 paper 집행봇 — 다각화 봇과 별개, bucket1/bucket3 신호 실집행 */}
      {swBot && (
        <div id="sharp-wallet-bot" className="space-y-4 scroll-mt-4">
          <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
            <h2 className="text-text-1 text-sm font-semibold w-full">샤프월렛 컨버전스 paper 집행봇</h2>
            <button onClick={toggleSwBot}
              className={`text-sm font-medium px-4 py-1.5 rounded border ${swBot.enabled ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
              {swBot.enabled ? "● 서버 자동봇 ON" : "서버 자동봇 OFF"}
            </button>
            <button onClick={runSwNow} disabled={swBusy}
              className="text-xs px-3 py-1.5 rounded border border-border text-text-3 hover:text-accent disabled:opacity-40">
              {swBusy ? "실행중…" : "지금 실행"}
            </button>
            <div className="flex items-center gap-3 text-[11px] text-text-3 ml-auto flex-wrap">
              <span>마지막 실행 {fmtTime(swBot.last_run)}</span>
              <span>주기 {Math.round(swBot.interval_sec / 60) || swBot.interval_sec}{swBot.interval_sec >= 60 ? "분" : "초"}</span>
            </div>
          </div>

          <div className="bg-panel border border-border rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap text-[11px]">
            <span className="text-text-3">누적 지출 <span className="text-text-1 font-data">${Math.round(swBot.spent).toLocaleString()}</span> / ${Math.round(swBot.budget).toLocaleString()}</span>
            <span className={`font-data px-1 font-bold ${swBot.remaining < 1 ? "bg-neg/20 text-neg" : "bg-pos/20 text-pos"}`}>잔여 ${Math.round(swBot.remaining).toLocaleString()}</span>
            <span className={`font-data px-1 font-bold ${swBot.realized_pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>실현손익 {swBot.realized_pnl >= 0 ? "+" : ""}${swBot.realized_pnl.toLocaleString()}</span>
            <span className="text-text-3 ml-auto">동시포지션 최대 {swBot.max_concurrent_positions} · 건당 {swBot.trade_size_shares}주</span>
          </div>

          {swPnlSeries.length > 0 && (
            <Panel>
              <PanelHeader right={<span className="text-text-3 text-[10px] font-data">최근 정산 {swPnlSeries[0].points.length}건</span>}>
                실현손익 추이
              </PanelHeader>
              <div className="p-2">
                <ChartFrame caption="entry_ts+horizon_s 시점 마크아웃 청산 · 페이퍼 · 표본 작을수록 노이즈 큼">
                  <TimeSeries series={swPnlSeries} height={200} yFormat={(v) => `$${v.toFixed(0)}`} />
                </ChartFrame>
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
            <Panel>
              <PanelHeader right={<span>{swBot.positions.length}건</span>}>보유 포지션</PanelHeader>
              {swBot.positions.length === 0 ? (
                <EmptyState message="보유 포지션 없음" hint="컨버전스 신호(bucket1/3) 발생 시 자동 진입" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-3 text-[11px] border-b border-border">
                      <th className="text-left font-medium px-3 py-2">market</th>
                      <th className="text-left font-medium px-3 py-2">bucket/horizon</th>
                      <th className="text-left font-medium px-3 py-2">방향</th>
                      <th className="text-right font-medium px-3 py-2">진입가</th>
                      <th className="text-right font-medium px-3 py-2">배분$</th>
                      <th className="text-left font-medium px-3 py-2">청산예정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swBot.positions.map((p, i) => (
                      <tr key={`${p.condition_id}:${i}`} className="border-b border-border/50 hover:bg-panel-2">
                        <td className="px-3 py-2 text-text-2 font-data text-xs truncate max-w-[160px]" title={p.condition_id}>{p.condition_id.slice(0, 10)}…</td>
                        <td className="px-3 py-2 font-data text-text-2 text-xs">b{p.convergence_bucket}/{p.horizon_s}s</td>
                        <td className="px-3 py-2 font-data text-text-1">{p.direction > 0 ? "BULLISH" : "BEARISH"}</td>
                        <td className="px-3 py-2 text-right font-data text-text-2">{p.entry_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-data text-text-1">${p.usd.toLocaleString()}</td>
                        <td className="px-3 py-2 text-text-3 font-data text-xs">{fmtTime(new Date(p.exit_at * 1000).toISOString())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel>
              <PanelHeader>봇 실행 로그</PanelHeader>
              {swBot.log.filter(l => l.kind !== "wallet_snapshot").length === 0 ? (
                <div className="p-5"><EmptyState message="로그 없음" hint="봇이 진입/정산하면 기록됨" /></div>
              ) : (
                <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
                  {swBot.log.filter(l => l.kind !== "wallet_snapshot").map((l, i) => (
                    <div key={i} className="px-4 py-2 text-xs flex items-start gap-2">
                      <span className="text-text-3 font-data text-[10px] shrink-0 w-16">{fmtTime(l.ts as string)}</span>
                      <span className="min-w-0 text-text-3">
                        {l.kind === "entry" ? <span className="text-pos">진입 b{String(l.convergence_bucket)}/{String(l.horizon_s)}s @{Number(l.entry_price ?? 0).toFixed(2)} ${Number(l.usd ?? 0).toLocaleString()}</span>
                          : l.kind === "exit" ? <span className={`px-1 font-bold ${Number(l.pnl ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>정산 손익 ${Number(l.pnl ?? 0).toLocaleString()}</span>
                          : l.kind === "entry_fail" ? <span className="text-neg">진입 실패 — {String(l.msg ?? "")}</span>
                          : l.kind === "exit_fail" ? <span className="text-neg">청산 실패 — {String(l.msg ?? "")}</span>
                          : l.kind === "scan_fail" ? <span className="text-neg">스캔 실패 — {String(l.msg ?? "")}</span>
                          : l.kind === "kill" ? <span className="text-neg">킬스위치 — {String(l.msg ?? "")}</span>
                          : l.kind === "config" ? "설정 변경"
                          : String(l.kind)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <p className="text-text-3 text-[10px] px-1">{swBot.note}</p>
        </div>
      )}

      {/* 고래 리더보드 — Polymarket 공식 전체기간 PnL 상위 지갑(샤프월렛 명단과 동일 소스). 읽기 전용 */}
      <Panel className="mt-4">
        <PanelHeader right={
          <span className="text-text-3 text-[10px] font-data">
            {lb?.error ? "조회 실패" : lb ? `${lb.entries.length}명${lb.cached ? " · 캐시" : ""}` : "…"}
          </span>
        }>
          고래 리더보드 <span className="text-text-3 text-[10px] font-normal">(전체기간 PnL 상위 · 샤프월렛 명단 소스)</span>
        </PanelHeader>
        {lb && lb.entries.length > 0 && lbBars.length > 0 && (
          <div className="p-2 border-b border-border">
            <ChartFrame title="상위 PnL (상위 12개)">
              <BarChart items={lbBars} valueFmt={(v) => `$${v.toLocaleString()}`} />
            </ChartFrame>
          </div>
        )}
        {!lb ? <LoadingState message="리더보드 로딩 중…" />
          : lb.entries.length === 0 ? <EmptyState message="리더보드 비어있음" hint={lb.error ?? "Polymarket API 응답 없음"} />
          : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-3 text-[11px] border-b border-border sticky top-0 bg-panel">
                    <th className="text-right font-medium px-3 py-2 w-12">#</th>
                    <th className="text-left font-medium px-3 py-2">지갑</th>
                    <th className="text-right font-medium px-3 py-2">전체 PnL</th>
                    <th className="text-right font-medium px-3 py-2">거래량</th>
                  </tr>
                </thead>
                <tbody>
                  {lb.entries.map((e) => (
                    <tr key={e.proxyWallet} className="border-b border-border/50 hover:bg-panel-2">
                      <td className="px-3 py-1.5 text-right font-data text-text-3 tabular-nums">{e.rank}</td>
                      <td className="px-3 py-1.5">
                        <a href={`https://polymarket.com/profile/${e.proxyWallet}`} target="_blank" rel="noopener noreferrer"
                          className="font-data text-[11px] text-info hover:underline">
                          {e.proxyWallet.slice(0, 6)}…{e.proxyWallet.slice(-4)}
                        </a>
                      </td>
                      <td className={`px-3 py-1.5 text-right font-data tabular-nums font-bold ${e.pnl >= 0 ? "text-pos" : "text-neg"}`}>
                        ${Math.round(e.pnl).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right font-data tabular-nums text-text-2">
                        ${Math.round(e.vol).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

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
