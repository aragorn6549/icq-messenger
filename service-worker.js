const CACHE_NAME = 'icq-messenger-v2';
const APP_NAME = 'ICQ Messenger';

// Ресурсы для кэширования
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    'https://unpkg.com/@supabase/supabase-js@2',
    'https://img.icons8.com/color/96/000000/speech-bubble.png',
    'https://img.icons8.com/color/192/000000/speech-bubble.png',
    'https://img.icons8.com/color/512/000000/speech-bubble.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log(`${APP_NAME}: Service Worker устанавливается`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`${APP_NAME}: Кэширование ресурсов`);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log(`${APP_NAME}: Все ресурсы закэшированы`);
                return self.skipWaiting();
            })
            .catch(error => {
                console.error(`${APP_NAME}: Ошибка кэширования:`, error);
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log(`${APP_NAME}: Service Worker активирован`);
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`${APP_NAME}: Удаляем старый кэш:`, cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log(`${APP_NAME}: Очистка старых кэшей завершена`);
            return self.clients.claim();
        })
    );
});

// Стратегия: Сначала сеть, потом кэш (Network First)
self.addEventListener('fetch', event => {
    // Пропускаем не-GET запросы и chrome-extension
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    // Для Supabase API используем сетевой запрос
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Кэшируем успешные ответы от API
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна, пробуем кэш
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Для статических ресурсов: сначала кэш, потом сеть
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Возвращаем кэшированный ответ, если он есть
                if (cachedResponse) {
                    // Обновляем кэш в фоне
                    fetchAndCache(event.request);
                    return cachedResponse;
                }
                
                // Иначе загружаем из сети
                return fetch(event.request)
                    .then(response => {
                        // Проверяем валидность ответа
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Клонируем ответ для кэширования
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.log(`${APP_NAME}: Ошибка загрузки:`, error);
                        
                        // Для страниц: показываем offline страницу
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/');
                        }
                        
                        return new Response('Нет подключения к интернету', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Функция для обновления кэша в фоне
function fetchAndCache(request) {
    return fetch(request)
        .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }
            
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
                .then(cache => {
                    cache.put(request, responseToCache);
                });
            
            return response;
        })
        .catch(() => {
            // Игнорируем ошибки при фоновом обновлении
        });
}

// Обработка push-уведомлений
self.addEventListener('push', event => {
    console.log(`${APP_NAME}: Получено push-уведомление`);
    
    if (!event.data) {
        return;
    }
    
    try {
        const data = event.data.json();
        const title = data.title || 'ICQ Messenger';
        const options = {
            body: data.body || 'Новое сообщение',
            icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            tag: 'icq-message',
            vibrate: [200, 100, 200],
            data: {
                url: data.url || '/',
                timestamp: Date.now()
            },
            actions: [
                {
                    action: 'open',
                    title: 'Открыть'
                },
                {
                    action: 'close',
                    title: 'Закрыть'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (error) {
        console.error(`${APP_NAME}: Ошибка обработки push-уведомления:`, error);
        
        // Простое уведомление в случае ошибки
        const options = {
            body: 'У вас новое сообщение',
            icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png'
        };
        
        event.waitUntil(
            self.registration.showNotification('ICQ Messenger', options)
        );
    }
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log(`${APP_NAME}: Клик по уведомлению:`, event.action);
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    const urlToOpen = event.notification.data.url || '/';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then(windowClients => {
            // Проверяем, есть ли уже открытое окно
            for (const client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Открываем новое окно
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Фоновая синхронизация
self.addEventListener('sync', event => {
    console.log(`${APP_NAME}: Фоновая синхронизация:`, event.tag);
    
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

// Функция синхронизации сообщений
function syncMessages() {
    // Здесь можно добавить логику синхронизации
    // например, отправку отложенных сообщений
    console.log(`${APP_NAME}: Синхронизация сообщений...`);
    return Promise.resolve();
}

// Периодическая синхронизация (только для установленных PWA)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-contacts') {
        console.log(`${APP_NAME}: Периодическая синхронизация контактов`);
        event.waitUntil(updateContacts());
    }
});

function updateContacts() {
    // Обновление списка контактов
    return Promise.resolve();
}