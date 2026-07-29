// 콘솔 라우트 레이아웃 — 레일·console-shell은 루트 레이아웃이 담당(전 페이지 통일).
// 콘솔 페이지는 자체 min-h-full 컨테이너를 가지므로 pass-through.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
