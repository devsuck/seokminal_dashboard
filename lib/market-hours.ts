/** 미국 정규장 개장 여부 (평일 09:30–16:00 America/New_York). 서머타임은 Intl이 자동 처리. */
export function isUSMarketOpen(now: Date = new Date()): boolean {
  // Get wall-clock time in New York regardless of the user's local timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;

  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some engines emit "24" for midnight
  const minute = parseInt(get("minute"), 10);
  const mins = hour * 60 + minute;

  const OPEN = 9 * 60 + 30;   // 09:30 ET
  const CLOSE = 16 * 60;      // 16:00 ET
  return mins >= OPEN && mins < CLOSE;
}
