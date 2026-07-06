import type { TradingAgent } from "@/lib/api";

// 레벨 재편: 1=조건식(백테스트 승격) / 2=AI 전략가(구2·3·4 통합) / 3=자가학습(구Lv5).
// raw===4는 구DB의 "Lv4 공급망 전략가"(구2/3/4와 기능 동일) → 병합 Lv2로, raw>=5는
// 구Lv5(자가학습) → 새 Lv3로 표시 정규화한다. 데이터 마이그레이션 없이 표시만 정규화.
export function displayLevel(a: TradingAgent): 1 | 2 | 3 {
  const raw = a.autonomy ?? 2;
  if (a.type === "autonomous" || a.type === "kr_macro") return 3;
  if (raw <= 1) return 1;
  if (raw === 3 || raw >= 5) return 3;
  return 2;
}
