self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const fallbackPayload = {
    title: 'เตือนมื้ออาหาร',
    body: 'ถึงเวลาทานอาหารแล้วค่ะ',
    tag: 'meal-reminder',
  };

  let payload = fallbackPayload;
  if (event.data) {
    try {
      payload = { ...fallbackPayload, ...event.data.json() };
    } catch (_error) {
      payload = fallbackPayload;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [180, 120, 180],
      data: {
        url: payload.url || '/',
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
