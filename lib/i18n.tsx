"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type { Lang, Translations } from "./i18n-utils";
export { TRANSLATIONS, getLangFromStorage, saveLangToStorage, getTranslation } from "./i18n-utils";
import { getLangFromStorage, saveLangToStorage, getTranslation } from "./i18n-utils";
import type { Lang } from "./i18n-utils";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "ko",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    setLangState(getLangFromStorage());
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    saveLangToStorage(l);
  }

  const t = (key: string) => getTranslation(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
