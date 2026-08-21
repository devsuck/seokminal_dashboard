import type { CollectorKey } from "@/lib/api";

/** 수집기 키 → 한글 라벨 + 조사할 페이지. 서버 COLLECTOR_SESSIONS와 1:1. */
export const COLLECTOR_META: Record<CollectorKey, { label: string; href: string }> = {
  polymarket_tick: { label: "폴리마켓 틱 수집기", href: "/lab" },
  polymarket_arb: { label: "폴리마켓 arb 스캐너", href: "/lab" },
  hl_orderflow_tick: { label: "HL 오더플로우 틱 수집기", href: "/orderflow" },
  cross_venue_skew_tick: { label: "크로스벤뉴 스큐 수집기", href: "/orderflow" },
  polymarket_whale_tick: { label: "폴리마켓 고래 체결 수집기", href: "/orderflow" },
  polymarket_updown_arb: { label: "폴리마켓 up/down 차익 스캐너", href: "/lab" },
  polymarket_sharp_wallet_tick: { label: "폴리마켓 샤프월렛 수집기", href: "/polymarket" },
  polymarket_mlb_specialist_tick: { label: "폴리마켓 MLB 스페셜리스트", href: "/mlb" },
  polymarket_event_divergence: { label: "폴리마켓 이벤트 다이버전스", href: "/polymarket" },
  options_uoa: { label: "옵션 UOA 수집기", href: "/insider" },
  polymarket_implication_collect: { label: "함의관계 페어 발굴", href: "/polymarket" },
  polymarket_implication_watch: { label: "함의관계 위반 감시", href: "/polymarket" },
};

export function collectorMeta(key: string): { label: string; href: string } {
  return COLLECTOR_META[key as CollectorKey] ?? { label: key, href: "/lab" };
}

export type Verdict = "fresh" | "stale" | "stuck" | "dead";

export const VERDICT_LABEL: Record<Verdict, string> = {
  fresh: "정상", stale: "지연", stuck: "멈춤", dead: "죽음",
};

/** verdict → 텍스트/배경 토큰. 정도는 FreshnessBar가, 종류는 이 색이 담당. */
export const VERDICT_TONE: Record<Verdict, { text: string; bg: string; bar: string }> = {
  fresh: { text: "text-pos", bg: "bg-pos/15", bar: "bg-pos" },
  stale: { text: "text-warn", bg: "bg-warn/15", bar: "bg-warn" },
  stuck: { text: "text-neg", bg: "bg-neg/15", bar: "bg-neg" },
  dead: { text: "text-neg", bg: "bg-neg/20", bar: "bg-neg" },
};
