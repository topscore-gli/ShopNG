/* ShopNG push notifications service worker (Firebase Cloud Messaging) */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js", "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js", "./firebase-config.js");
const cfg = self.SHOP_CONFIG;
if (cfg && cfg.enabled) {
  firebase.initializeApp(cfg.firebase);
  const messaging = firebase.messaging();
  // Messages are data-only, so we build the notification ourselves (title, product image, price in body)
  messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const opts = { body: d.body || "", icon: "./images/icon-192.png", badge: "./images/badge-96.png", tag: d.tag || "shopng", renotify: true, data: { url: d.url || "./" } };
    if (d.image) opts.image = d.image;
    return self.registration.showNotification(d.title || "ShopNG", opts);
  });
}
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "./", self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && "focus" in c) { if ("navigate" in c) c.navigate(url); return c.focus(); }
    }
    return clients.openWindow(url);
  }));
});
