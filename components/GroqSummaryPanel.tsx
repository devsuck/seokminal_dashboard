"use client";

import { useEffect, useState } from "react";
import { getGroqSummary, type GroqStockPick } from "@/lib/api";
import { Button } from "@/components/ui";

interface Props {
  mode: "news" | "calendar";
  getContent: () => string;
}

const STORAGE_KEY = (mode: string) => `seokminal:groq-summary:${mode}`;

interface Cached {
  summary: string;
  picks: GroqStockPick[];
  lastRun: string; // ISO
}

function SummaryLine({ line }: { line: string }) {
  const text = line.startsWith("· ") ? line.slice(2) : line;
  const posWords = ["상승", "수혜", "강세", "긍정", "오를", "급등", "회복", "확대", "증가", "호재"];
  const negWords = ["하락", "약세", "리스크", "떨어질", "하향", "위험", "둔화", "감소", "주의", "악재"];
  const pos = posWords.some(w => text.includes(w));
  const neg = negWords.some(w => text.includes(w));
  const dotCls = pos && !neg ? "text-pos" : neg && !pos ? "text-neg" : "text-accent";
  return (
    <div className="flex gap-2 py-1.5 border-b border-border/40 last:border-0">
      <span className={`text-[11px] font-bold mt-0.5 shrink-0 ${dotCls}`}>·</span>
      <span className="text-text-2 text-[11px] leading-relaxed">{text}</span>
    </div>
  );
}

function StockCard({ pick }: { pick: GroqStockPick }) {
  const isUp = pick.direction === "up";
  return (
    <div
      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors no-underline group ${
        isUp
          ? "border-pos/30 bg-pos/5 hover:bg-pos/10": "border-neg/30 bg-neg/5 hover:bg-neg/10"}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-bold ${isUp ? "text-pos" : "text-neg"}`}>
          {isUp ? "▲" : "▼"}
        </span>
        <span className="text-text-1 text-[11px] font-semibold font-data">{pick.symbol}</span>
      </div>
      <span className="text-[9px] text-text-3 group-hover:text-accent transition-colors">
        차트 →
      </span>
    </div>
  );
}

export function GroqSummaryPanel({ mode, getContent }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [picks, setPicks]     = useState<GroqStockPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  // Load from localStorage on mount; discard stale (older than ~28h → 어제 것까지만).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(mode));
      if (!raw) return;
      const cached: Cached = JSON.parse(raw);
      const ageH = (Date.now() - new Date(cached.lastRun).getTime()) / 36e5;
      if (ageH > 28) { localStorage.removeItem(STORAGE_KEY(mode)); return; }
      setSummary(cached.summary);
      setPicks(cached.picks ?? []);
      setLastRun(new Date(cached.lastRun));
    } catch {}
  }, [mode]);

  async function handleSummarize() {
    const content = getContent();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getGroqSummary(content, mode);
      const now = new Date();
      setSummary(result.summary);
      setPicks(result.picks ?? []);
      setLastRun(now);
      const cached: Cached = { summary: result.summary, picks: result.picks ?? [], lastRun: now.toISOString() };
      localStorage.setItem(STORAGE_KEY(mode), JSON.stringify(cached));
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 실패");
    } finally {
      setLoading(false);
    }
  }

  const lines = summary
    ? summary.split("\n").map(l => l.trim()).filter(l => l.startsWith("·") || (l.length > 10 && !l.startsWith("#")))
    : [];

  const label = mode === "calendar" ? "경제지표 전략" : "뉴스 전략";

  return (
    <aside className="w-72 shrink-0">
      <div className="bg-panel border border-border rounded-lg overflow-hidden sticky top-4">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-panel-2">
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">
              AI {label}
            </span>
            <span className="text-[9px] text-text-3 border border-border rounded px-1 py-0.5">
              Groq · Llama3
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSummarize}
            disabled={loading}>
            {loading ? "분석 중…" : "AI 분석"}
          </Button>
        </div>

        {/* Summary body */}
        <div className="p-3 min-h-[140px]">
          {error && <p className="text-neg text-xs">{error}</p>}

          {!summary && !loading && !error && (
            <p className="text-text-3 text-[11px] leading-relaxed pt-1">
              AI 분석 버튼을 눌러 현재{" "}
              {mode === "calendar" ? "경제지표 일정" : "뉴스 헤드라인"}
              기반 투자 전략을 확인하세요.
            </p>
          )}

          {loading && (
            <div className="flex items-center gap-2 pt-2">
              <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
              <span className="text-text-3 text-[11px]">Groq 분석 중…</span>
            </div>
          )}

          {lines.length > 0 && !loading && (
            <div>
              {lines.map((line, i) => <SummaryLine key={i} line={line} />)}
            </div>
          )}
        </div>

        {/* Stock picks cards */}
        {picks.length > 0 && !loading && (
          <div className="px-3 pb-3 border-t border-border pt-2.5 space-y-1.5">
            <p className="text-[9px] text-text-3 uppercase tracking-wider mb-2">관련 종목</p>
            <div className="grid grid-cols-2 gap-1.5">
              {picks.map(p => <StockCard key={p.symbol} pick={p} />)}
            </div>
          </div>
        )}

        {lastRun && (
          <div className="px-3 py-2 text-[9px] text-text-3 border-t border-border/40">
            {lastRun.toLocaleTimeString("ko-KR")} 기준
          </div>
        )}
      </div>
    </aside>
  );
}
