"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getCompanyNews, getMarketNews, type NewsItem } from "@/lib/api";

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function NewsCard({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border py-2.5 px-1 -mx-1 rounded">
      {/* Clickable header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left cursor-pointer bg-transparent border-0 p-0 group">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-xs leading-snug transition-colors line-clamp-2 ${open ? "text-accent" : "text-text-1 group-hover:text-accent"}`}>
              {item.headline}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-text-3 text-[10px]">{item.source}</span>
              <span className="text-text-3 text-[10px]">·</span>
              <span className="text-text-3 text-[10px] font-data">{timeAgo(item.datetime)}</span>
              {item.related && (
                <>
                  <span className="text-text-3 text-[10px]">·</span>
                  <span className="text-accent text-[10px] font-data">{item.related}</span>
                </>
              )}
              <span className="ml-auto text-text-3 text-[10px]">{open ? "▲" : "▼"}</span>
            </div>
          </div>
          {item.image && !open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="w-12 h-12 object-cover rounded shrink-0 opacity-80" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="mt-2 bg-panel-2 rounded p-3">
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="w-full max-h-40 object-cover rounded mb-2 opacity-90" />
          )}
          {item.summary ? (
            <p className="text-text-2 text-xs leading-relaxed">{item.summary}</p>
          ) : (
            <p className="text-text-3 text-xs italic">요약 없음</p>
          )}
          <a
            href={item.url}
            target="_blank"rel="noopener noreferrer"className="inline-block mt-2 text-[11px] text-accent hover:underline no-underline">
            원문 보기 →
          </a>
        </div>
      )}
    </div>
  );
}

interface NewsPanelProps {
  ticker?: string;
  maxItems?: number;
  onHeadlinesLoaded?: (headlines: string[]) => void;
}

export function NewsPanel({ ticker, maxItems = 15, onHeadlinesLoaded }: NewsPanelProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(async (t?: string) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const data = t
        ? await getCompanyNews(t, 7, ctrl.signal)
        : await getMarketNews("general", ctrl.signal);
      if (!ctrl.signal.aborted) {
        const sliced = data.slice(0, maxItems);
        setNews(sliced);
        // 제목만 보내면 AI가 오해석할 수 있어 Finnhub summary 블러브까지 함께 전달.
        onHeadlinesLoaded?.(sliced.map(n =>
          n.summary?.trim() ? `${n.headline} — ${n.summary.trim()}` : n.headline,
        ));
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(e instanceof ApiError ? e.message : "뉴스 로드 실패 (FINNHUB_API_KEY 확인)");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [maxItems, onHeadlinesLoaded]);

  useEffect(() => {
    fetch_(ticker);
    return () => ctrlRef.current?.abort();
  }, [ticker, fetch_]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          {ticker ? `${ticker} News` : "Market News"}
        </span>
        <button
          onClick={() => fetch_(ticker)}
          disabled={loading}
          className="text-text-3 text-[10px] hover:text-text-1 disabled:opacity-40">
          {loading ? "…" : "↻"}
        </button>
      </div>

      {error && <p className="text-neg text-xs">{error}</p>}
      {loading && news.length === 0 && (
        <p className="text-text-3 text-xs">로딩 중…</p>
      )}

      <div className="overflow-y-auto flex-1 space-y-0">
        {news.map((item, i) => <NewsCard key={i} item={item} />)}
        {!loading && news.length === 0 && !error && (
          <p className="text-text-3 text-xs text-center py-6">뉴스 없음</p>
        )}
      </div>
    </div>
  );
}
