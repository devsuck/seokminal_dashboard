"use client";

export type LayerKey =
  | "heatmap"
  | "footprint"
  | "svp"
  | "cvp"
  | "book"
  | "bubbles"
  | "gex"
  | "imbalance"
  | "vwap"
  | "valueArea"
  | "sessionLevels"
  | "deltaHist";

export const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  heatmap: true,
  footprint: true,
  svp: true,
  cvp: true,
  book: true,
  bubbles: true,
  gex: true,
  imbalance: true,
  vwap: true,
  valueArea: true,
  sessionLevels: true,
  deltaHist: true,
};

interface LayerDef {
  key: LayerKey;
  label: string;
  /** 칩의 색 견본 — 캔버스에서 실제 그려지는 색과 일치시킬 것. */
  swatchClass: string;
  description: string;
}

const LAYER_DEFS: LayerDef[] = [
  {
    key: "heatmap",
    label: "히트맵",
    swatchClass: "bg-warn/60",
    description: "호가 잔량 히트맵 — 주황이 진할수록 그 가격대에 대기 유동성(지정가 물량)이 많음",
  },
  {
    key: "footprint",
    label: "풋프린트",
    swatchClass: "bg-gradient-to-r from-pos/60 to-neg/60",
    description: "캔들 내부 가격대별 매수/매도 체결량 — 확대(barSpacing 40px 이상) 시 숫자 표시",
  },
  {
    key: "svp",
    label: "SVP",
    swatchClass: "bg-pos/50",
    description: "세션 볼륨 프로파일 — 최근 30분 가격대별 체결량 (우측 첫째 컬럼)",
  },
  {
    key: "cvp",
    label: "CVP",
    swatchClass: "bg-pos/50",
    description: "누적 볼륨 프로파일 — 보유 중인 전체 기간 가격대별 체결량 (우측 둘째 컬럼)",
  },
  {
    key: "book",
    label: "호가래더",
    swatchClass: "bg-gradient-to-r from-pos/70 to-neg/70",
    description: "실시간 오더북 잔량 래더 (우측 끝 컬럼) — 노란 테두리는 아이스버그 의심 레벨",
  },
  {
    key: "bubbles",
    label: "대량체결",
    swatchClass: "bg-pos/80 rounded-full",
    description: "최근 체결 상위 5%(p95) 초과 대형 체결 버블 — 클수록 큰 체결",
  },
  {
    key: "gex",
    label: "GEX",
    swatchClass: "bg-info/70",
    description: "옵션 감마 레벨 점선 — 감마월(최대 |GEX| 스트라이크)은 강조 표시 (BTC/ETH 전용)",
  },
  {
    key: "imbalance",
    label: "임밸런스",
    swatchClass: "bg-gradient-to-r from-pos/80 to-neg/60",
    description: "좌상단 미니 바 — 호가 잔량/최근 체결의 매수측 비율 (우측 시그널 패널과 동일 값)",
  },
  {
    key: "vwap",
    label: "VWAP",
    swatchClass: "bg-warn/80",
    description: "거래량 가중 평균가 (노란 실선) + ±1σ/±2σ 밴드 (회색 점선) — 기관 평단 추정, 되돌림 목표가",
  },
  {
    key: "valueArea",
    label: "POC/VA",
    swatchClass: "bg-accent/70",
    description: "POC = 최다 체결가 (주황 실선), VAH/VAL = 체결량 70% 구간 상/하단 (점선) — 안이면 회귀, 밖이면 추세",
  },
  {
    key: "sessionLevels",
    label: "세션 고저",
    swatchClass: "bg-text-3/60",
    description: "금일(UTC) 고가/저가 + 전일 고가/저가 수평선 — 스탑런이 노리는 레벨",
  },
  {
    key: "deltaHist",
    label: "델타",
    swatchClass: "bg-gradient-to-r from-pos/70 to-neg/70",
    description: "캔들별 순델타(매수-매도) 히스토그램 서브페인 — CVD의 비누적 버전",
  },
];

/** 토글 불가 항목 — 캔들차트 마커라 레이어 토글 대상 아님, 설명만 제공. */
const MARKER_DEFS = [
  { label: "흡수 ↑↓", colorClass: "text-info", description: "흡수(absorption) — 우세한 체결 물량이 가격을 못 밀어낸 캔들. 파란 화살표 마커" },
  { label: "스탑런 ◼", colorClass: "text-warn", description: "스탑런(stop-run) — 최근 20봉 고/저점 이탈 후 대량 체결과 함께 반전 마감. 주황 사각 마커" },
  { label: "다이버전스 ●", colorClass: "text-[#BF5AF2]", description: "델타 다이버전스 — 신고/신저가인데 캔들 델타가 반대 방향(25% 이상 편향). 약한 고점/저점 신호. 보라 원 마커" },
] as const;

interface OrderflowLegendProps {
  layers: Record<LayerKey, boolean>;
  onToggle: (key: LayerKey) => void;
}

export function OrderflowLegend({ layers, onToggle }: OrderflowLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border text-[11px]">
      <span className="text-text-3 mr-1">레이어</span>
      {LAYER_DEFS.map((def) => {
        const on = layers[def.key];
        return (
          <button
            key={def.key}
            type="button"
            title={def.description}
            onClick={() => onToggle(def.key)}
            className={`flex items-center gap-1.5 px-2 py-0.5 border ${
              on
                ? "border-border bg-panel-2 text-text-1"
                : "border-border bg-panel text-text-3 opacity-50"
            }`}
          >
            <span className={`w-2 h-2 shrink-0 ${def.swatchClass}`} />
            {def.label}
          </button>
        );
      })}
      <span className="text-text-3 ml-2 mr-1">마커</span>
      {MARKER_DEFS.map((def) => (
        <span
          key={def.label}
          title={def.description}
          className={`px-2 py-0.5 border border-border bg-panel ${def.colorClass} cursor-help`}
        >
          {def.label}
        </span>
      ))}
    </div>
  );
}
