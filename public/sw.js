self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data;

    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'Gateway', body: event.data ? event.data.text() : '' };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Gateway', {
            body: data.body || '',
            icon: '/images/App-Logo.png',
            badge: '/images/App-Logo.png',
            tag: data.tag,
            data: { url: data.url || '/' },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL(event.notification.data?.url || '/', self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            for (const client of windows) {
                if ('focus' in client) {
                    client.navigate(url);

                    return client.focus();
                }
            }

            return self.clients.openWindow(url);
        }),
    );
});
