"use client";

import { useLanguage } from "@/lib/i18n";

interface PageBannerProps {
  pageKey: string;
}

export function PageBanner({ pageKey }: PageBannerProps) {
  const { t } = useLanguage();
  const title = t(`page.${pageKey}.title`);
  const desc = t(`page.${pageKey}.desc`);

  // If no translation found, render nothing
  if (title === `page.${pageKey}.title`) return null;

  return (
    <div className="mb-4">
      <h1 className="text-text-1 text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-text-3 text-sm mt-0.5">{desc}</p>
    </div>
  );
}
