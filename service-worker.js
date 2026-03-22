const CACHE_NAME = 'camera-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// Service Worker インストール
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache).catch(err => {
                console.log('キャッシュ追加に失敗:', err);
                // エラーが発生しても続行
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// Service Worker アクティベート
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// キャッシュ優先戦略
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }

            return fetch(event.request).then(response => {
                // ストリーミングレスポンスはキャッシュできないのでチェック
                if (!response || response.status !== 200 || response.type === 'basic' || response.type === 'cors') {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            }).catch(() => {
                // オフライン時はキャッシュから返す
                return caches.match('/index.html');
            });
        })
    );
});
