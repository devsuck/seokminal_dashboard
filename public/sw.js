// 설치 가능성(installability)만 충족. API/페이지 데이터는 캐싱하지 않는다 —
// 실거래 대시보드에서 stale 가격/포지션 데이터를 보여주는 위험을 피하기 위함.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // no-op: 브라우저 기본 네트워크 요청 그대로 통과
});

self.addEventListener("push", (event) => {
  let payload = { title: "SEOKMINAL", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "SEOKMINAL", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/");
    })
  );
});
