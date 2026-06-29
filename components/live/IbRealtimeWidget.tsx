"use client";

import { useLanguage } from "@/lib/i18n";

export function IbRealtimeWidget() {
  const { t } = useLanguage();

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          {t("ib.live.title")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse shrink-0" />
          <span className="text-warn text-[11px] font-data">{t("ib.live.status")}</span>
        </div>
      </div>

      <p className="text-text-3 text-xs mb-4">{t("ib.live.desc")}</p>

      {/* Placeholder ticker row */}
      <div className="space-y-2 mb-4">
        {["AAPL", "SPY", "QQQ"].map(ticker => (
          <div key={ticker} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
            <span className="text-text-2 text-xs font-data">{ticker}</span>
            <div className="flex items-center gap-3">
              <div className="w-16 h-3 bg-panel-2 rounded animate-pulse" />
              <div className="w-10 h-3 bg-panel-2 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder mini chart */}
      <div className="w-full bg-panel-2 rounded flex items-center justify-center" style={{ height: "64px" }}>
        <span className="text-text-3 text-[11px]">{t("ib.live.coming_soon")}</span>
      </div>
    </div>
  );
}
