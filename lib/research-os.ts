// Research OS — Jarvis 로컬 연구 환경(P41~P45) 통합 정보구조.
// 백엔드(jarvis) integration_audit / research_navigation 이 생성한 navigation_manifest.json 을 소비하고,
// 각 섹션/항목을 이 콘솔의 기존 라우트로 연결한다. (data/research-os-manifest.json = 원본 산출물)
// 읽기전용 · 결정·거래·집행 없음.

export interface NavItemLink {
  item: string;
  moduleCount: number;
  href: string;        // 이 콘솔의 기존 라우트
  note: string;
}
export interface NavSectionView {
  section: "Research" | "Knowledge" | "Agents" | "System";
  moduleCount: number;
  items: NavItemLink[];
}

// P43 navigation_manifest.json 의 섹션/항목/모듈수(실측) + 기존 라우트 매핑.
export const RESEARCH_OS_SECTIONS: NavSectionView[] = [
  {
    section: "Research",
    moduleCount: 37,
    items: [
      { item: "Alpha", moduleCount: 32, href: "/lab", note: "AI Lab · 가설 사냥/파킹" },
      { item: "Simulation", moduleCount: 2, href: "/backtest", note: "백테스트 · 페이퍼" },
      { item: "Experiments", moduleCount: 3, href: "/quant/experiments", note: "Strategy DNA · 실험" },
    ],
  },
  {
    section: "Knowledge",
    moduleCount: 14,
    items: [
      { item: "Graph", moduleCount: 1, href: "/intel/knowledge", note: "지식 그래프" },
      { item: "Memory", moduleCount: 6, href: "/intel/knowledge", note: "연구 기억·교훈" },
      { item: "Insights", moduleCount: 7, href: "/intel/research", note: "인사이트·문헌" },
    ],
  },
  {
    section: "Agents",
    moduleCount: 11,
    items: [
      { item: "Tasks", moduleCount: 11, href: "/council/agents", note: "에이전트 · 태스크" },
      { item: "History", moduleCount: 0, href: "/council/logs", note: "에이전트 이력·로그" },
    ],
  },
  {
    section: "System",
    moduleCount: 80,
    items: [
      { item: "Monitoring", moduleCount: 9, href: "/exec/monitor", note: "모니터링·관측성·헬스" },
      { item: "Configuration", moduleCount: 71, href: "/command", note: "거버넌스·정책·설정" },
    ],
  },
];

// 매니페스트 헤드라인(실측)
export const RESEARCH_OS_META = {
  sectionCount: 4,
  itemCount: 10,
  moduleCount: 142,
  coverage: 1.0,          // 100% — 모든 모듈이 배치됨
  duplicateFamilies: 19,  // 통합 검토 후보(중복 계열)
  digest: "sha256:972006d2e34e9020",
  source: "jarvis integration_audit + research_navigation (P41·P43)",
};

// P41~P45 로컬 연구 환경 능력. 각 능력은 기존 콘솔 페이지로 연결(있으면).
export interface Capability {
  phase: string;
  name: string;
  summary: string;
  href: string;
  live: boolean;   // 이 콘솔에 대응 페이지가 있으면 true
}
export const RESEARCH_OS_CAPABILITIES: Capability[] = [
  { phase: "P41", name: "Integration Audit", live: false, href: "/command",
    summary: "기존 아키텍처 결정적 감사 — 인벤토리·의존성·중복·미사용(백엔드 산출물)." },
  { phase: "P42", name: "Local Runtime", live: true, href: "/exec/monitor",
    summary: "로컬 단일 진입점 — 시작·모듈 발견·헬스 체크(클라우드 없음)." },
  { phase: "P43", name: "Unified Navigation", live: true, href: "/intel/research-os",
    summary: "기존 페이지를 Research/Knowledge/Agents/System 로 재배치(이 페이지)." },
  { phase: "P44", name: "Research Assistant", live: true, href: "/intel/research",
    summary: "일일·실험·실패·지식 요약(분석만 · 결정/승인/집행 없음)." },
  { phase: "P45", name: "Local Automation", live: true, href: "/auto-research",
    summary: "반복 연구 작업 워크플로 보조(자동 거래·배포·배분 없음)." },
];

// 섹션/항목 → 기존 콘솔 라우트 조회(라이브 데이터에 href 를 입히기 위한 UI 매핑).
export function itemHref(section: string, item: string): string {
  const s = RESEARCH_OS_SECTIONS.find((x) => x.section === section);
  return s?.items.find((i) => i.item === item)?.href ?? "/command";
}
export function itemNote(section: string, item: string): string {
  const s = RESEARCH_OS_SECTIONS.find((x) => x.section === section);
  return s?.items.find((i) => i.item === item)?.note ?? "";
}
export function capHref(phase: string): string {
  return RESEARCH_OS_CAPABILITIES.find((c) => c.phase === phase)?.href ?? "/command";
}
