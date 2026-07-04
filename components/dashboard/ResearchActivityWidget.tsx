"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecentActivity, type ResearchActivity, type ActivityType } from "@/lib/dashboard-storage";

const TYPE_LABEL: Record<ActivityType, string> = {
  backtest:   "Backtest",
  strategy:   "Strategy",
  experiment: "Experiment",
  portfolio:  "Portfolio",
  bot:        "Bot",
};

const TYPE_COLOR: Record<ActivityType, string> = {
  backtest:   "text-info",
  strategy:   "text-warn",
  experiment: "text-text-2",
  portfolio:  "text-pos",
  bot:        "text-text-3",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ResearchActivityWidget() {
  const [activities, setActivities] = useState<ResearchActivity[]>([]);

  useEffect(() => {
    setActivities(getRecentActivity(8));
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Research Activity
      </span>

      {activities.length === 0 ? (
        <div className="text-text-3 text-xs py-6 text-center leading-relaxed">
          No recent activity.<br />
          Run a backtest or experiment to see it here.
        </div>
      ) : (
        <div className="space-y-0.5">
          {activities.map(a => (
            <Link
              key={a.id}
              href={a.href}
              className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 no-underline group">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${TYPE_COLOR[a.type]}`}>
                  {TYPE_LABEL[a.type]}
                </span>
                <span className="text-text-2 text-xs truncate group-hover:text-text-1 transition-colors">
                  {a.label}
                </span>
              </div>
              <span className="text-text-3 text-[10px] font-data shrink-0 ml-3">{timeAgo(a.timestamp)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
