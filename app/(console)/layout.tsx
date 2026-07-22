import { CommandRail } from "@/components/console/CommandRail";

// 콘솔 셸: 좌측 커맨드 레일 + 스크롤 콘텐츠. .console-shell 스코프로 리파인 팔레트 적용.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="console-shell flex h-full min-h-full overflow-hidden">
      <CommandRail />
      <div className="flex-1 min-w-0 h-full overflow-y-auto">{children}</div>
    </div>
  );
}
