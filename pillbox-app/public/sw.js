self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = {
      title: 'Hora de tomar tu medicamento',
      body: 'Debes confirmar la toma.',
      data: { targetUrl: '/dashboard' },
    };
  }

  const title = payload.title || 'Hora de tomar tu medicamento';
  const body = payload.body || 'Hay una toma pendiente.';
  const options = {
    body,
    icon: payload.icon || '/favicon.ico',
    tag: payload.tag || 'pillbox-webpush',
    data: payload.data || { targetUrl: '/dashboard' },
    badge: '/favicon.ico',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetUrl = data.targetUrl || '/dashboard';
  const url = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'pillbox-notification-click', targetUrl: url, data });
          return;
        }
      }

      return clients.openWindow(url);
    })
  );
});
