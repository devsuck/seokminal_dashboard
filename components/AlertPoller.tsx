"use client";

import { useEffect, useRef } from "react";
import { getTriggeredAlerts, getVapidPublicKey, subscribePush } from "@/lib/api";
import { toast } from "@/lib/toast";

const POLL_MS = 30_000;

function linkFor(botId: string): { href: string; label: string } {
  if (botId.startsWith("insider-convergence")) return { href: "/insider?tab=convergence", label: "내부자 컨버전스" };
  return { href: "/hud", label: "홈" };
}

// 탭이 열려있을 때만 동작 (진짜 백그라운드 푸시는 sw.js의 "push" 이벤트가 담당)
function showLocalNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // some browsers block Notification in certain contexts
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// 앱 종료/백그라운드 상태에서도 알림 받도록 실제 Web Push 구독을 등록
async function subscribeToPush() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return;
    const publicKey = await getVapidPublicKey();
    if (!publicKey) return;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await subscribePush(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
  } catch {
    // 구독 실패해도 로컬(탭 열림) 알림/토스트는 계속 동작
  }
}

async function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    await subscribeToPush();
  }
}

export function AlertPoller() {
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    requestNotificationPermission();

    async function poll() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const alerts = await getTriggeredAlerts(AbortSignal.timeout(POLL_MS));
        const isInit = !initialized.current;
        initialized.current = true;

        for (const a of alerts) {
          const key = `${a.rule_id}:${a.triggered_at}`;
          if (seenIds.current.has(key)) continue;
          seenIds.current.add(key);
          if (!isInit) {
            toast.show(`${a.rule_label}\n${a.detail}`, "warn", 8000, linkFor(a.bot_id));
            showLocalNotification(a.rule_label, a.detail);
          }
        }
      } catch {
        // silent — polling failure shouldn't break UI
      } finally {
        inFlight.current = false;
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
