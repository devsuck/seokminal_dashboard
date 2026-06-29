"use client";

import { useEffect, useRef } from "react";
import { getTriggeredAlerts } from "@/lib/api";
import { toast } from "@/lib/toast";

const POLL_MS = 30_000;

export function AlertPoller() {
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    async function poll() {
      try {
        const alerts = await getTriggeredAlerts();
        const isInit = !initialized.current;
        initialized.current = true;

        for (const a of alerts) {
          const key = `${a.rule_id}:${a.triggered_at}`;
          if (seenIds.current.has(key)) continue;
          seenIds.current.add(key);
          // Don't toast on first load — only new ones
          if (!isInit) {
            toast.show(`🔔 ${a.rule_label}: ${a.detail}`, "warn", 8000);
          }
        }
      } catch {
        // silent — polling failure shouldn't break UI
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
