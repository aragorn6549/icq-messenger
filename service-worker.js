// === НАСТРОЙКИ ДЛЯ PUSH-УВЕДОМЛЕНИЙ ===

// ВСТАВЬ СЮДА СВОЙ PUBLIC KEY который ты скопировал
const VAPID_PUBLIC_KEY = 'BHX3bIZ-0cN2e6JHITJDlZz7A5gBqLrT9Db34tGSkla1UH0-yJxtBmEFcT07L4S_hIKOUlm8C0V0xPWlzM47UDA';

// Функция для преобразования ключа (просто копируй)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Функция для сохранения "адреса друга" в базе данных
async function saveSubscriptionToDatabase(subscription, userId) {
    try {
        // Отправляем данные в Supabase
        const { data, error } = await supabaseClient
            .from('push_subscriptions')
            .insert([{
                user_id: userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Ошибка сохранения подписки:', error);
        return false;
    }
}



const CACHE_NAME = 'icq-messenger-v2';
const APP_NAME = 'ICQ Messenger';

// Ресурсы для кэширования
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
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
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Сохраняем в кэш для оффлайн-работы
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                return response;
            })
            .catch(() => {
                // Если нет интернета, ищем в кэше
                return caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        // Для страниц показываем главную
                        return caches.match('/');
                    });
            })
    );
});

// Обработка push-уведомлений
// Пуш-уведомление пришло (даже когда приложение закрыто!)
self.addEventListener('push', event => {
    console.log('📨 Получено push-уведомление!');

    let notificationData = {
        title: 'ICQ Messenger',
        body: 'Новое сообщение! 📩',
        icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
        badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
        vibrate: [200, 100, 200], // Телефон вибрирует
        requireInteraction: true, // Уведомление не пропадет само
        data: { 
            url: window.location.origin,
            timestamp: new Date().toISOString()
        }
    };

    // Если пришло сообщение с данными
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || 'ICQ Messenger',
                body: data.body || 'Новое сообщение',
                icon: data.icon || 'https://img.icons8.com/color/96/000000/speech-bubble.png',
                badge: data.badge || 'https://img.icons8.com/color/96/000000/speech-bubble.png',
                data: data.data || { 
                    url: window.location.origin,
                    sender_id: data.sender_id,
                    sender_name: data.sender_name 
                },
                vibrate: [200, 100, 200],
                requireInteraction: true
            };
        } catch (error) {
            // Если данные пришли как текст
            notificationData.body = event.data.text() || 'Новое сообщение';
        }
    }

    // Показываем уведомление!
    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    const notification = event.notification;
    notification.close();

    if (event.action === 'close') {
        return; // Просто закрыть уведомление
    }

    const urlToOpen = notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(windowClients => {
            // Проверяем, есть ли уже открытое окно с нужным URL
            for (const client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Если нет, открываем новое окно
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Фоновая синхронизация при восстановлении соединения
self.addEventListener('sync', event => {
    console.log(`${APP_NAME}: Фоновая синхронизация:`, event.tag);
    if (event.tag === 'send-messages') {
        event.waitUntil(sendPendingMessages());
    }
});

// Функция синхронизации сообщений
async function sendPendingMessages() {
    console.log(`${APP_NAME}: Отправка отложенных сообщений`);
    // Здесь можно реализовать отправку сообщений, которые не удалось отправить
    // Например, сохраняя их в IndexedDB при потере соединения
    // Пока что просто возвращаем Promise.resolve()
    return Promise.resolve();
}

// Добавим фоновую периодическую синхронизацию (поддерживается не всеми браузерами)
// self.addEventListener('periodicsync', event => {
//     if (event.tag === 'check-new-messages') {
//         console.log(`${APP_NAME}: Фоновая проверка новых сообщений`);
//         event.waitUntil(checkForNewMessages());
//     }
// });

// Заглушка для проверки новых сообщений
async function checkForNewMessages() {
    // Здесь можно добавить логику проверки новых сообщений
    // через API Supabase с использованием последнего известного времени
    console.log(`${APP_NAME}: Проверка новых сообщений...`);
    // Пример: получаем последние сообщения
    const lastCheckTime = await getLastCheckTime();
    const now = new Date().toISOString();
    // Сохраняем время последней проверки
    await setLastCheckTime(now);
    return Promise.resolve();
}

async function getLastCheckTime() {
    // Реализация получения времени последней проверки из IndexedDB или другого хранилища
    // Пока что возвращаем null
    return null;
}

async function setLastCheckTime(time) {
    // Реализация сохранения времени последней проверки
    // Пока что ничего не делаем
}

// Обработка сообщений от клиента (например, SKIP_WAITING)
self.addEventListener('message', event => {
    console.log(`${APP_NAME}: Получено сообщение от клиента:`, event.data);
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
// Обработка оффлайн режима
self.addEventListener('fetch', event => {
    // Для сообщений - пробуем отправить при восстановлении соединения
    if (event.request.url.includes('/rest/v1/messages') && event.request.method === 'POST') {
        // Для отправки сообщений - используем стратегию "сначала сеть"
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // Сохраняем сообщение в IndexedDB для отправки позже
                    return saveMessageForLater(event.request);
                })
        );
        return;
    }
    
    // Для других запросов - стандартная стратегия
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Если есть в кэше и оффлайн
                if (response && !navigator.onLine) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        // Кэшируем GET запросы
                        if (event.request.method === 'GET' && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return response;
                    })
                    .catch(error => {
                        // Если оффлайн и нет в кэше - показываем страницу оффлайн
                        if (event.request.destination === 'document') {
                            return caches.match('/offline.html');
                        }
                        throw error;
                    });
            })
    );
});

// Функция для сохранения сообщения для последующей отправки
async function saveMessageForLater(request) {
    const messageData = await request.clone().json();
    
    // Сохраняем в IndexedDB
    const db = await openMessageDB();
    await saveMessageToDB(db, messageData);
    
    // Возвращаем фейковый ответ
    return new Response(JSON.stringify({ 
        success: false, 
        message: 'Сообщение сохранено для отправки позже',
        offline: true 
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Функции для работы с IndexedDB
function openMessageDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('icq_messages', 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending_messages')) {
                db.createObjectStore('pending_messages', { keyPath: 'id', autoIncrement: true });
            }
        };
        
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function saveMessageToDB(db, message) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pending_messages'], 'readwrite');
        const store = transaction.objectStore('pending_messages');
        const request = store.add({
            ...message,
            timestamp: new Date().toISOString()
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Обработка push-уведомлений
self.addEventListener('push', event => {
    console.log(`${APP_NAME}: Получено push-уведомление`);

    let notificationData = {
        title: 'ICQ Messenger',
        body: 'Новое сообщение',
        icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
        badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
        tag: 'icq-message',
        data: { 
            url: '/',
            timestamp: new Date().toISOString()
        },
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Открыть чат'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || 'ICQ Messenger',
                body: data.body || 'Новое сообщение',
                icon: data.icon || 'https://img.icons8.com/color/96/000000/speech-bubble.png',
                badge: data.badge || 'https://img.icons8.com/color/96/000000/speech-bubble.png',
                tag: data.tag || 'icq-message',
                data: data.data || { url: '/', timestamp: new Date().toISOString() },
                vibrate: [200, 100, 200],
                requireInteraction: true,
                actions: [
                    {
                        action: 'open',
                        title: 'Открыть чат'
                    },
                    {
                        action: 'close',
                        title: 'Закрыть'
                    }
                ]
            };
        } catch (error) {
            // Если данные не JSON, используем как текст
            notificationData.body = event.data.text() || 'Новое сообщение';
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log(`${APP_NAME}: Клик по уведомлению:`, event.action);
    
    const notification = event.notification;
    notification.close();

    if (event.action === 'close') {
        return;
    }

    // Основное действие - открыть приложение
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(windowClients => {
            // Проверяем, есть ли уже открытое окно
            for (const client of windowClients) {
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus().then(() => {
                        // Отправляем сообщение об активации
                        return client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            data: notification.data
                        });
                    });
                }
            }
            
            // Если нет открытых окон, открываем новое
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Обработка сообщений от клиента
self.addEventListener('message', event => {
    console.log(`${APP_NAME}: Сообщение от клиента:`, event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Обработка запроса на показ уведомления
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon } = event.data;
        
        self.registration.showNotification(title, {
            body: body,
            icon: icon || 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            tag: 'icq-message',
            vibrate: [200, 100, 200]
        });
    }
});
