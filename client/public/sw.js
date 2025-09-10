// Service Worker для Web Push уведомлений
async function loadSwLocale() {
  try {
    // Try to infer language from navigator; default to 'ru'
    const lang = (self.navigator && self.navigator.language && self.navigator.language.startsWith('en')) ? 'en' : 'ru';
    const res = await fetch(`/locales/sw/${lang}.json`, { cache: 'no-store' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  // Fallback ru
  return {
    titleDefault: 'Side-by-Side',
    bodyDefault: 'Новое уведомление',
    actionOpen: 'Открыть',
    actionClose: 'Закрыть'
  };
}

self.addEventListener('push', function(event) {
  console.log('Push event received:', event);

  let payload = {};
  if (event.data) {
    // Prefer native JSON parsing (better compatibility e.g. Safari)
    try {
      payload = event.data.json();
    } catch (e1) {
      try {
        const text = event.data.text();
        payload = JSON.parse(text);
      } catch (e2) {
        // Fallback to raw text as body
        const raw = typeof event.data.text === 'function' ? event.data.text() : 'Новое уведомление';
        payload = { body: raw };
      }
    }
  }

  event.waitUntil((async () => {
    const L = await loadSwLocale();
    const title = payload.title || L.titleDefault;
    const url = payload.url || '/';

    const options = {
      body: payload.body || L.bodyDefault,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      data: {
        ...payload.data,
        url,
        dateOfArrival: Date.now(),
      },
      actions: [
        { action: 'open', title: L.actionOpen, icon: '/icon.svg' },
        { action: 'close', title: L.actionClose, icon: '/icon.svg' }
      ]
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received:', event);

  event.notification.close();

  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    (async () => {
      // Focus an open client if exists, else open new window
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            await client.focus();
            // Try to navigate if different URL
            if ('navigate' in client && client.url !== targetUrl) {
              await client.navigate(targetUrl);
            }
            return;
          } catch {}
        }
      }
      await clients.openWindow(targetUrl);
    })()
  );
});