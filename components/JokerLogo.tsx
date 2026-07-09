export function JokerLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#E6EAF0" stroke="#242A35" strokeWidth="0.75" />
      <path d="M4 7.5 Q6 4 8 7" fill="none" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7 Q14 4 16 7.5" fill="none" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="9.5" r="1" fill="#0F131A" />
      <circle cx="13" cy="9.5" r="1" fill="#0F131A" />
      <path d="M5.5 12.5 Q10 17 14.5 12.5" fill="none" stroke="#C026D3" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
