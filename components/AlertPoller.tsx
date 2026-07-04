"use client";

import { useEffect, useRef } from "react";
import { getTriggeredAlerts } from "@/lib/api";
import { toast } from "@/lib/toast";

const POLL_MS = 30_000;

function sendPushNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // some browsers block Notification in certain contexts
  }
}

async function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function AlertPoller() {
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    requestNotificationPermission();

    async function poll() {
      try {
        const alerts = await getTriggeredAlerts();
        const isInit = !initialized.current;
        initialized.current = true;

        for (const a of alerts) {
          const key = `${a.rule_id}:${a.triggered_at}`;
          if (seenIds.current.has(key)) continue;
          seenIds.current.add(key);
          if (!isInit) {
            toast.show(` ${a.rule_label}: ${a.detail}`, "warn", 8000);
            sendPushNotification("NAUTILUS Alert", `${a.rule_label}: ${a.detail}`);
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
