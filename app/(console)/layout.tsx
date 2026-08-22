// 콘솔 라우트 레이아웃 — 레일·console-shell은 루트 레이아웃이 담당(전 페이지 통일).
// .rail-ap 스코프로 --c-* 를 ap- 라이트 값으로 로컬 오버라이드 + 배경 페인트
// (.console-shell 자체 다크 그라디언트가 자식 스코프 오버라이드로는 안 가려져서 필요).
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="rail-ap min-h-full bg-[var(--c-bg)]">{children}</div>;
}
