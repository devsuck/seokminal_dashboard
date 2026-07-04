"use client";

import { useLanguage, type Lang } from "@/lib/i18n";

const LANGS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-0.5">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors duration-150 bg-transparent cursor-pointer ${
            lang === code
              ? "border border-accent text-accent bg-accent/10": "text-text-3 hover:text-text-1"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
