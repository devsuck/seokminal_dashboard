"use client";

import { useEffect, useRef, useState } from "react";
import {
  getLabTasks, getLabPortfolio, getV2Shadow, getBuybackBot,
  type LabTask, type LabTaskMonthly, type PortfolioBook, type BookMonthly, type V2Shadow, type V2Seg,
  type BuybackBot,
} from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

// 막대 폭: style={{}} 금지 → 리터럴 Tailwind 폭 클래스(10% 스텝)
const WIDTHS = ["w-[0%]", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]",
  "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-[100%]"] as const;
function barW(mag: number): string { return WIDTHS[Math.max(0, Math.min(10, Math.round(mag * 10)))]; }

function statusStyle(s: string): string {
  if (s === "paper_active") return "border-pos/40 text-pos bg-pos/10";
  if (s.startsWith("paper_candidate")) return "border-accent/40 text-accent bg-accent/10";
  return "border-border text-text-2";
}

function pct(n: number | null | undefined, d = 2): string {
  return typeof n === "number" ? `${(n * 100).toFixed(d)}%` : "—";
}
function num(n: number | null | undefined, d = 2): string {
  return typeof n === "number" ? n.toFixed(d) : "—";
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<LabTask[] | null>(null);
  const [book, setBook] = useState<PortfolioBook | null>(null);
  const [v2, setV2] = useState<V2Shadow | null>(null);
  const [bot, setBot] = useState<BuybackBot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function tick() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const d = await getLabTasks(ctrl.signal);
        if (mounted && !ctrl.signal.aborted) { setTasks(d.tasks); setErr(null); }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (mounted) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted && !ctrl.signal.aborted) setLoading(false);
      }
    }
    tick();
    const iv = setInterval(tick, 15000);
    // 포트폴리오 북·v2 shadow는 무거워서 1회 로드
    getLabPortfolio().then(b => { if (mounted) setBook(b); }).catch(() => { /* noop */ });
    getV2Shadow().then(v => { if (mounted) setV2(v); }).catch(() => { /* noop */ });
    getBuybackBot().then(b => { if (mounted) setBot(b); }).catch(() => { /* noop */ });
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-1">Lab Task — 페이퍼 전략 모니터</h1>
        <p className="text-text-3 text-sm mt-1">
          AI LAB에서 승격된 전략의 진입/청산 규칙 · 통계 · 월별 수익. 전부 페이퍼(자본 0). live 매매 없음.
        </p>
      </div>

      {loading && <div className="text-text-3 text-sm">불러오는 중…</div>}
      {err && <div className="text-xs text-neg border border-neg/30 rounded px-3 py-2">오류: {err}</div>}
      {bot && <BuybackBotCard bot={bot} />}
      {book && <PortfolioBookCard book={book} />}
      {v2 && <V2ShadowCard v2={v2} />}

      {tasks && tasks.length === 0 && (
        <div className="bg-panel border border-border rounded-lg p-6 text-center text-text-3 text-sm">
          페이퍼 전략 없음 — AI LAB에서 paper_candidate 승격 시 여기 나타남.
        </div>
      )}

      {tasks?.map(t => <TaskCard key={t.strategy_id} task={t} />)}
    </div>
  );
}

function BuybackBotCard({ bot }: { bot: BuybackBot }) {
  return (
    <Panel>
      <PanelHeader right={
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 text-pos">
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-70 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          <span className="px-1.5 py-0.5 rounded border border-pos/40 text-pos bg-pos/10">검증된 v1 엣지</span>
          <span>live: {bot.live}</span>
        </span>
      }>
        Buyback 봇 · 페이퍼 실행
      </PanelHeader>
      <div className="p-4 space-y-3">
        <div className="text-[11px] text-text-3">
          {bot.version} · 진입 {bot.config.entry} · {bot.config.hold_days}일 보유 · {bot.config.cost_bps}bps
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <Stat label="총 포지션" val={String(bot.total)} />
          <Stat label="보유중" val={String(bot.open)} />
          <Stat label="청산" val={String(bot.closed)} />
          <Stat label="페이퍼 평균" val={pct(bot.paper_pnl_mean)} pos={(bot.paper_pnl_mean ?? 0) >= 0} />
          <Stat label="승률" val={pct(bot.paper_win_rate, 1)} />
          <Stat label="누적" val={num(bot.cum_paper_pnl)} pos={(bot.cum_paper_pnl ?? 0) >= 0} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">보유중 (다음 청산 대기)</div>
            <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
              {bot.open_positions.length === 0 && <div className="text-xs text-text-3">없음</div>}
              {bot.open_positions.map((p, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-text-2 truncate">{p.corp || p.code}</span>
                  <span className="text-text-3 font-data shrink-0">진입 {p.entry_date}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">최근 청산</div>
            <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
              {bot.recent_closed.map((p, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-text-2 truncate">{p.corp}</span>
                  <span className={`font-data px-1 font-bold shrink-0 ${p.pnl_pct >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{pct(p.pnl_pct)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-text-3 border-t border-border pt-2">
           검증된 엣지만 실행(노이즈 매매 아님) · 실주문 없음 · paper→live는 사람 게이트
        </div>
      </div>
    </Panel>
  );
}

function V2ShadowCard({ v2 }: { v2: V2Shadow }) {
  const hasForward = v2.forward.n_v2 > 0;
  return (
    <Panel>
      <PanelHeader right={
        <span className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded border border-info/40 text-info bg-info/10">SHADOW (v1 동결)</span>
          <span className="font-data">등록 {v2.frozen_date}</span>
        </span>
      }>
        buyback v2 · 레짐 필터
      </PanelHeader>
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-text-3">{v2.rule}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <V2SegBox title="in-sample (발견)" seg={v2.in_sample} sub="증거 아님 — 규율상 참고" />
          <V2SegBox title="forward (진짜 OOS)" seg={v2.forward} sub={v2.forward_note} forward />
        </div>

        <div className="text-[11px] text-warn border-t border-border pt-2">
          ⚠ {v2.discipline}
          {!hasForward && " — forward 쌓이는 중, 아직 승격 근거 없음."}
        </div>
      </div>
    </Panel>
  );
}

function V2SegBox({ title, seg, sub, forward }: { title: string; seg: V2Seg; sub: string; forward?: boolean }) {
  const empty = seg.n_v2 === 0;
  return (
    <div className={`rounded border px-3 py-2 ${forward ? "border-info/25 bg-info/5" : "border-border bg-panel-2"}`}>
      <div className="text-xs font-medium text-text-2">{title}</div>
      {empty ? (
        <div className="text-xs text-text-3 mt-2">{sub}</div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1 text-xs font-data">
            <div />
            <div className="text-text-3 text-center">net</div>
            <div className="text-text-3 text-center">승률</div>
            <div className="text-text-3">v1</div>
            <div className={`text-center px-1 font-bold ${pctBgColor(seg.v1_net)}`}>{pct(seg.v1_net)}</div>
            <div className="text-center text-text-2">{pct(seg.v1_winrate, 1)}</div>
            <div className="text-info">v2</div>
            <div className={`text-center px-1 font-bold ${pctBgColor(seg.v2_net)}`}>{pct(seg.v2_net)}</div>
            <div className="text-center text-text-1">{pct(seg.v2_winrate, 1)}</div>
          </div>
          <div className={`text-[10px] mt-1.5 px-1 ${seg.v2_improves ? "font-bold bg-pos/20 text-pos" : "text-text-3"}`}>
            {seg.v2_improves ? "✓ v2 > v1 (개선)" : "v2 개선 미확인"} · n{seg.n_v2}
          </div>
        </>
      )}
    </div>
  );
}

function PortfolioBookCard({ book }: { book: PortfolioBook }) {
  const c = book.combined;
  const monthly = book.monthly ?? [];
  const maxCum = Math.max(0.001, ...monthly.map(m => Math.abs(m.cum)));
  const finalCum = monthly.length ? monthly[monthly.length - 1].cum : null;
  const bestIndivMdd = Math.min(...book.sleeves.map(s => s.mdd));
  return (
    <Panel>
      <PanelHeader right={
        <span className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/10">A · 실제 굴릴 책</span>
          <span className="font-data">{book.range ?? ""}</span>
        </span>
      }>
        멀티엣지 포트폴리오 북
      </PanelHeader>
      <div className="p-4 space-y-3">
        {/* 슬리브 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {book.sleeves.map(s => (
            <div key={s.name} className="bg-panel-2 border border-border rounded px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-1">{s.name}</span>
                <span className="text-[10px] text-text-3">n{s.n}</span>
              </div>
              <div className="flex gap-3 mt-1 text-xs font-data">
                <span className={`px-1 font-bold ${pctBgColor(s.ann)}`}>연 {pct(s.ann)}</span>
                <span className="text-text-2">Sh {num(s.sharpe)}</span>
                <span className="px-1 font-bold bg-neg/20 text-neg">MDD {pct(s.mdd)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 상관 + 조합 */}
        {c ? (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-3">상관</span>
              <span className={`font-data font-semibold px-1 ${Math.abs(book.correlation ?? 0) < 0.3 ? "bg-pos/20 text-pos" : "bg-warn/20 text-warn"}`}>
                {typeof book.correlation === "number" ? book.correlation.toFixed(2) : "—"}
              </span>
              <span className="text-text-3">{Math.abs(book.correlation ?? 0) < 0.3 ? "(무상관 → 분산이득)" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ComboBox label="등가중 0.5/0.5" s={c.equal_weight} bestMdd={bestIndivMdd} />
              <ComboBox label={`리스크패리티 ${Math.round((c.risk_parity.weights.tsmom ?? 0) * 100)}/${Math.round((c.risk_parity.weights.buyback ?? 0) * 100)}`} s={c.risk_parity} bestMdd={bestIndivMdd} />
            </div>

            {/* 누적 곡선(등가중) */}
            {monthly.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-3 mb-1">
                  <span>누적 수익 곡선 (등가중)</span>
                  <span className={`font-data px-1 font-bold ${pctBgColor(finalCum)}`}>누적 {pct(finalCum)}</span>
                </div>
                <div className="flex items-end gap-0.5 h-16">
                  {monthly.map(m => <CumBar key={m.period} m={m} maxCum={maxCum} />)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-text-3">겹치는 기간 부족 — 조합 통계 대기(슬리브 개별만).</div>
        )}

        {/* live-readiness 제약(②) */}
        {book.constraints && (
          <div className="border-t border-border pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-text-3">live-readiness 제약</div>
            {Object.entries(book.constraints).map(([k, c]) => (
              <div key={k} className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="text-text-2 font-medium w-16">{k}</span>
                <span className="text-text-3">규모 <span className="text-text-1">{c.scale}</span></span>
                <span className="text-text-3">수용력 <span className="text-text-1">{c.capacity}</span></span>
                <span className="text-warn">{c.timing}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-text-3 border-t border-border pt-2">{book.note}</div>
      </div>
    </Panel>
  );
}

function ComboBox({ label, s, bestMdd }: { label: string; s: { ann: number; sharpe: number; mdd: number }; bestMdd: number }) {
  const halved = s.mdd > bestMdd * 0.7; // 조합 MDD가 개별보다 확실히 얕음
  return (
    <div className="bg-pos/5 border border-pos/25 rounded px-3 py-2">
      <div className="text-xs text-text-2">{label}</div>
      <div className="flex gap-3 mt-1 text-xs font-data">
        <span className={`px-1 font-bold ${pctBgColor(s.ann)}`}>연 {pct(s.ann)}</span>
        <span className="text-pos font-semibold">Sh {num(s.sharpe)}</span>
        <span className={`px-1 font-bold ${halved ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>MDD {pct(s.mdd)}{halved ? " ↓" : ""}</span>
      </div>
    </div>
  );
}

function CumBar({ m, maxCum }: { m: BookMonthly; maxCum: number }) {
  const h = Math.abs(m.cum) / maxCum;
  const up = m.cum >= 0;
  return (
    <div className="flex-1 flex flex-col justify-end h-full" title={`${m.period}: 누적 ${(m.cum * 100).toFixed(1)}% / 월 ${(m.combined * 100).toFixed(1)}%`}>
      <div className={`w-full rounded-sm ${up ? "bg-pos/60" : "bg-neg/60"} ${heightClass(h)}`} />
    </div>
  );
}

function pctBgColor(n: number | null | undefined): string {
  return typeof n === "number" ? (n >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg") : "text-text-3";
}

// 세로 막대 높이: style 금지 → 리터럴 h 클래스
const HEIGHTS = ["h-0", "h-[10%]", "h-[20%]", "h-[30%]", "h-[40%]", "h-[50%]",
  "h-[60%]", "h-[70%]", "h-[80%]", "h-[90%]", "h-full"] as const;
function heightClass(frac: number): string { return HEIGHTS[Math.max(0, Math.min(10, Math.round(frac * 10)))]; }

function TaskCard({ task }: { task: LabTask }) {
  const fw = task.forward;
  const s = fw?.stats ?? {};
  const monthly = fw?.monthly ?? [];
  const recent = monthly.slice(-14);
  const maxMag = Math.max(0.001, ...recent.map(m => Math.abs(m.return ?? 0)));

  return (
    <Panel>
      <PanelHeader right={
        <span className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded border ${statusStyle(task.status)}`}>{task.status}</span>
          <span className="font-data">{task.runner ? task.runner.split(":")[0].split(".").pop() : "미배포"}</span>
        </span>
      }>
        {task.strategy_id}
      </PanelHeader>
      <div className="p-4 space-y-3">
        {!fw && <div className="text-xs text-text-3">배포 전 — forward 러너 미연결.</div>}
        {fw?.error && <div className="text-xs text-warn">{fw.error}</div>}
        {fw?.stats_warming && !fw.error && (
          <div className="text-[11px] text-info">통계 계산 중(서버 배경 워밍) — 잠시 후 채워짐. 규칙은 아래 표시.</div>
        )}

        {fw && !fw.error && (
          <>
            {/* 규칙 */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="text-text-3">진입 <span className="text-text-1">{fw.entry ?? "—"}</span></span>
              <span className="text-text-3">청산 <span className="text-text-1">{fw.exit ?? "—"}</span></span>
              {typeof fw.cost_bps === "number" && <span className="text-text-3">비용 <span className="text-text-1 font-data">{fw.cost_bps}bps</span></span>}
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {"n_trades" in s && <Stat label="거래수" val={num(s.n_trades, 0)} />}
              {"mean_return" in s && <Stat label="평균수익" val={pct(s.mean_return)} pos={(s.mean_return ?? 0) >= 0} />}
              {"median_return" in s && <Stat label="중앙값" val={pct(s.median_return)} pos={(s.median_return ?? 0) >= 0} />}
              {"win_rate" in s && <Stat label="승률" val={pct(s.win_rate, 1)} />}
              {"sharpe" in s && <Stat label="Sharpe" val={num(s.sharpe)} pos={(s.sharpe ?? 0) >= 0} />}
              {"max_drawdown" in s && <Stat label="MDD" val={pct(s.max_drawdown)} pos={false} />}
              {"n_months" in s && <Stat label="개월" val={num(s.n_months, 0)} />}
            </div>

            {/* 월별 수익 (매매 타이밍·손익 시계열) */}
            {recent.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">월별 수익 (최근 {recent.length})</div>
                <div className="space-y-0.5">
                  {recent.map(m => <MonthlyBar key={m.period} m={m} maxMag={maxMag} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function Stat({ label, val, pos }: { label: string; val: string; pos?: boolean }) {
  const c = pos === undefined ? "text-text-1" : pos ? "text-pos" : "text-neg";
  return (
    <div className="bg-panel-2 border border-border rounded px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-3">{label}</div>
      <div className={`text-sm font-data ${c}`}>{val}</div>
    </div>
  );
}

function MonthlyBar({ m, maxMag }: { m: LabTaskMonthly; maxMag: number }) {
  const r = m.return ?? 0;
  const mag = Math.abs(r) / maxMag;
  const up = r >= 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-text-3 font-data w-16 shrink-0">{m.period}</span>
      <div className="flex-1 h-3 bg-panel-2 rounded-sm overflow-hidden flex">
        <div className={`h-full rounded-sm ${up ? "bg-pos/60" : "bg-neg/60"} ${barW(mag)}`} />
      </div>
      <span className={`font-data w-14 text-right shrink-0 px-1 font-bold ${up ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{pct(r)}</span>
      {typeof m.n === "number" && <span className="text-text-3 w-8 text-right shrink-0">n{m.n}</span>}
    </div>
  );
}
