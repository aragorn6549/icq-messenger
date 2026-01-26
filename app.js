// Конфигурация Supabase
const SUPABASE_URL = 'https://dcxdpieejeuhyeybfbff.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1mKGAaO6CgUbkIObl7-O0A_YBoE8fxq';

// Инициализация Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let currentUser = null;
let selectedContact = null;
let messagesSubscription = null;
let deferredPrompt = null;

// ==================== МОБИЛЬНЫЙ ИНТЕРФЕЙС ====================

let touchStartX = 0;
let touchEndX = 0;
let isMobileMenuOpen = false;

function initMobileInterface() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Создаем оверлей для закрытия меню
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', hideMobileMenu);
    document.body.appendChild(overlay);
    
    // Добавляем обработчики свайпа
    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchmove', handleTouchMove, false);
    document.addEventListener('touchend', handleTouchEnd, false);
    
    // Показываем подсказку о свайпе на мобильных
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            showSwipeHint();
        }, 3000);
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (isMobileMenuOpen) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        isMobileMenuOpen = false;
    } else {
        sidebar.classList.add('show');
        overlay.classList.add('show');
        isMobileMenuOpen = true;
    }
}

function showMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.add('show');
    overlay.classList.add('show');
    isMobileMenuOpen = true;
}

function hideMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
    isMobileMenuOpen = false;
}

// Функции для свайпа
function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
}

function handleTouchMove(event) {
    // Предотвращаем скролл страницы при горизонтальном свайпе
    if (Math.abs(event.changedTouches[0].screenX - touchStartX) > 10) {
        event.preventDefault();
    }
}

function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50;
    const swipeDistance = touchEndX - touchStartX;
    
    // Если свайп достаточно большой
    if (Math.abs(swipeDistance) > swipeThreshold) {
        // Свайп вправо (открыть меню)
        if (swipeDistance > 0 && !isMobileMenuOpen && window.innerWidth <= 768) {
            showMobileMenu();
        }
        // Свайп влево (закрыть меню)
        else if (swipeDistance < 0 && isMobileMenuOpen) {
            hideMobileMenu();
        }
    }
}

function showSwipeHint() {
    // Показываем подсказку только если нет контактов
    const contactsList = document.getElementById('contacts-list');
    if (contactsList.children.length <= 1) { // Только "нет контактов"
        const hint = document.createElement('div');
        hint.className = 'swipe-hint';
        hint.textContent = '← Свайпните справа, чтобы открыть контакты';
        hint.id = 'swipe-hint';
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.style.display = 'block';
        }, 100);
        
        // Убираем подсказку через 5 секунд
        setTimeout(() => {
            hint.style.opacity = '0';
            setTimeout(() => {
                if (hint.parentNode) {
                    hint.parentNode.removeChild(hint);
                }
            }, 300);
        }, 5000);
    }
}

// Обновляем функцию selectContact для мобильных
async function selectContact(contact) {
    if (!contact || !currentUser) return;
    
    console.log('Выбран контакт:', contact.display_name);
    
    selectedContact = contact;
    
    // Обновляем заголовок чата
    document.getElementById('chat-header-content').innerHTML = `
        <div class="chat-contact-info">
            <div class="chat-contact-avatar">${contact.display_name.charAt(0).toUpperCase()}</div>
            <div>
                <h3>${contact.display_name}</h3>
                <div class="chat-contact-details">
                    <span class="chat-contact-uin">UIN: ${contact.uin}</span>
                    <span class="chat-contact-status ${contact.status}">${getStatusText(contact.status)}</span>
                </div>
            </div>
        </div>
    `;
    
    // На мобильных скрываем меню
    if (window.innerWidth <= 768) {
        hideMobileMenu();
    }
    
    // Активируем поле ввода
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').focus();
    
    // Загружаем сообщения и подписываемся на новые
    await loadMessages();
    subscribeToMessages();
    
    // Прокручиваем к последнему сообщению
    setTimeout(() => {
        const container = document.getElementById('messages-container');
        container.scrollTop = container.scrollHeight;
    }, 100);
    
    // Отмечаем сообщения как прочитанные
    markMessagesAsRead(contact.id);
}

// Инициализируем мобильный интерфейс при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('Приложение инициализируется...');
    
    // Запрос разрешения на уведомления
    requestNotificationPermission();
    
    // Инициализация Service Worker для PWA
    initServiceWorker();
    
    // Проверка авторизации
    checkAuth();
    
    // Инициализация обработчиков событий
    initEventListeners();
    
    // Инициализация мобильного интерфейса
    initMobileInterface();
    
    // Проверка интернет-соединения
    initNetworkStatus();
});

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('Приложение инициализируется...');
    
    // Запрос разрешения на уведомления
    requestNotificationPermission();
    
    // Инициализация Service Worker для PWA
    initServiceWorker();
    
    // Проверка авторизации
    checkAuth();
    
    // Инициализация обработчиков событий
    initEventListeners();
    
    // Проверка интернет-соединения
    initNetworkStatus();
});

// ==================== УЛУЧШЕННЫЕ УВЕДОМЛЕНИЯ И РЕАЛЬНОЕ ВРЕМЯ ====================

// Глобальная подписка на ВСЕ сообщения
let globalMessagesSubscription = null;

// Инициализируем глобальную подписку
function initGlobalMessagesSubscription() {
    if (!currentUser) return;
    
    console.log('Инициализация глобальной подписки на сообщения');
    
    // Отписываемся от старой подписки
    if (globalMessagesSubscription) {
        supabaseClient.removeChannel(globalMessagesSubscription);
        globalMessagesSubscription = null;
    }
    
    // Подписываемся на ВСЕ входящие сообщения
    globalMessagesSubscription = supabaseClient
        .channel('global-messages-' + currentUser.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id.eq.${currentUser.id}`
        }, async (payload) => {
            console.log('Глобальное уведомление о новом сообщении:', payload.new);
            
            const message = payload.new;
            
            // Получаем информацию об отправителе
            const { data: senderProfile } = await supabaseClient
                .from('profiles')
                .select('display_name, uin')
                .eq('id', message.sender_id)
                .single();
            
            if (!senderProfile) return;
            
            // Проверяем, открыт ли сейчас чат с этим отправителем
            const isChatOpen = selectedContact && selectedContact.id === message.sender_id;
            
            // Обновляем список контактов (для показа последнего сообщения)
            loadContacts();
            
            // Если чат не открыт, показываем уведомление
            if (!isChatOpen) {
                showMessageNotification(senderProfile, message);
            }
            
            // Если чат открыт с этим пользователем, обновляем сообщения
            if (isChatOpen) {
                await loadMessages();
                
                // Прокручиваем к последнему сообщению
                setTimeout(() => {
                    const container = document.getElementById('messages-container');
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                    }
                }, 100);
            }
        })
        .subscribe((status) => {
            console.log('Статус глобальной подписки:', status);
        });
}

// Функция показа уведомления о сообщении
function showMessageNotification(sender, message) {
    const notificationTitle = `💬 Новое сообщение от ${sender.display_name}`;
    const notificationBody = message.content.length > 100 
        ? message.content.substring(0, 100) + '...' 
        : message.content;
    
    // Проверяем, активно ли окно
    const isWindowActive = document.hasFocus();
    
    if (!isWindowActive && 'Notification' in window && Notification.permission === 'granted') {
        // Если окно не активно, показываем браузерное уведомление
        const options = {
            body: notificationBody,
            icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
            tag: 'icq-message-' + sender.id,
            data: {
                senderId: sender.id,
                messageId: message.id,
                url: window.location.href
            },
            vibrate: [100, 50, 100],
            requireInteraction: false
        };
        
        const notification = new Notification(notificationTitle, options);
        
        notification.onclick = function() {
            window.focus();
            
            // Если контакт есть в списке, открываем чат с ним
            const contactElement = document.querySelector(`.contact-item[data-user-id="${sender.id}"]`);
            if (contactElement) {
                contactElement.click();
            }
            
            notification.close();
        };
        
        // Автоматически закрываем через 5 секунд
        setTimeout(() => notification.close(), 5000);
    } else if (isWindowActive) {
        // Если окно активно, показываем тост
        showToast(`💬 ${sender.display_name}: ${notificationBody}`, 'info');
        
        // Виброотклик
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
        
        // Мигание вкладки
        flashTab(notificationTitle);
    }
}

// Функция мигания вкладки
function flashTab(title) {
    if (!document.hasFocus()) {
        const originalTitle = document.title;
        let isFlashing = false;
        let flashCount = 0;
        const maxFlashes = 5;
        
        const flashInterval = setInterval(() => {
            if (flashCount >= maxFlashes) {
                clearInterval(flashInterval);
                document.title = originalTitle;
                return;
            }
            
            isFlashing = !isFlashing;
            document.title = isFlashing ? `💬 ${title}` : originalTitle;
            
            if (!isFlashing) {
                flashCount++;
            }
        }, 500);
    }
}

// Обновляем функцию showMainScreen:
function showMainScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'flex';
    
    loadContacts();
    trackOnlineStatus();
    
    // Инициализируем глобальную подписку на сообщения
    initGlobalMessagesSubscription();
    
    // Проверяем, нужно ли показывать кнопку установки PWA
    if (deferredPrompt) {
        document.getElementById('install-btn').style.display = 'block';
    }
    
    // Показываем только контакты (скрываем чат)
    showContactsOnly();
}

// Обновляем функцию subscribeToMessages для работы в реальном времени:
function subscribeToMessages() {
    // Отписываемся от предыдущей подписки
    if (messagesSubscription) {
        supabaseClient.removeChannel(messagesSubscription);
        messagesSubscription = null;
    }
    
    if (!selectedContact || !currentUser) return;
    
    console.log('Подписка на сообщения с:', selectedContact.id);
    
    messagesSubscription = supabaseClient
        .channel('private-messages-' + selectedContact.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id}))`
        }, async (payload) => {
            console.log('Новое сообщение в чате:', payload.new);
            
            // Немедленно добавляем сообщение в интерфейс
            addMessageToChat(payload.new);
            
            // Обновляем список контактов
            loadContacts();
        })
        .subscribe((status) => {
            console.log('Статус приватной подписки:', status);
        });
}

// Новая функция: добавление сообщения в чат без перезагрузки
function addMessageToChat(message) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    const isSent = message.sender_id === currentUser.id;
    const messageDate = new Date(message.created_at);
    const today = new Date();
    
    // Проверяем, нужно ли добавить разделитель даты
    const lastDateElement = container.querySelector('.message-date:last-child');
    let lastDate = null;
    
    if (lastDateElement) {
        lastDate = lastDateElement.textContent;
    }
    
    const messageDay = messageDate.toDateString();
    const currentDay = today.toDateString();
    
    let dateText = '';
    if (messageDay === currentDay) {
        dateText = 'Сегодня';
    } else if (messageDay === new Date(today.setDate(today.getDate() - 1)).toDateString()) {
        dateText = 'Вчера';
    } else {
        dateText = messageDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    // Добавляем разделитель даты, если нужно
    if (!lastDate || lastDate !== dateText) {
        const dateElement = document.createElement('div');
        dateElement.className = 'message-date';
        dateElement.textContent = dateText;
        container.appendChild(dateElement);
    }
    
    // Создаем элемент сообщения
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
    messageElement.style.animation = 'fadeIn 0.3s ease-out';
    
    const time = messageDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-content">${escapeHtml(message.content)}</div>
        <div class="message-time">${time} ${isSent ? '✓' : ''}</div>
    `;
    
    container.appendChild(messageElement);
    
    // Прокручиваем к последнему сообщению
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// Обновляем функцию loadMessages для работы с кэшированием:
async function loadMessages() {
    if (!selectedContact || !currentUser) return;
    
    console.log('Загрузка сообщений с:', selectedContact.display_name);
    
    try {
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Ошибка загрузки сообщений:', error);
            return;
        }
        
        // Отображаем сообщения
        displayMessages(messages || []);
        
        // Отмечаем сообщения как прочитанные
        markMessagesAsRead(selectedContact.id);
        
    } catch (error) {
        console.error('Неожиданная ошибка при загрузке сообщений:', error);
    }
}

// ==================== УПРАВЛЕНИЕ ВИДИМОСТЬЮ КОНТАКТОВ И ЧАТА ====================

function showChatOnly() {
    const sidebar = document.querySelector('.sidebar');
    const chatArea = document.querySelector('.chat-area');
    const backButton = document.getElementById('back-to-contacts');
    
    // На мобильных: скрываем меню
    if (window.innerWidth <= 768) {
        hideMobileMenu();
    } else {
        // На десктопе: скрываем контакты, расширяем чат
        sidebar.classList.add('hidden');
        chatArea.classList.add('expanded');
    }
    
    // Показываем кнопку "Назад" только на мобильных
    if (backButton) {
        backButton.style.display = window.innerWidth <= 768 ? 'block' : 'none';
    }
}

function showContactsOnly() {
    const sidebar = document.querySelector('.sidebar');
    const chatArea = document.querySelector('.chat-area');
    const backButton = document.getElementById('back-to-contacts');
    
    // На мобильных: показываем меню
    if (window.innerWidth <= 768) {
        showMobileMenu();
    } else {
        // На десктопе: показываем контакты, уменьшаем чат
        sidebar.classList.remove('hidden');
        chatArea.classList.remove('expanded');
    }
    
    // Скрываем кнопку "Назад"
    if (backButton) {
        backButton.style.display = 'none';
    }
}

function initBackToContactsButton() {
    const backButton = document.getElementById('back-to-contacts');
    if (backButton) {
        backButton.addEventListener('click', () => {
            showContactsOnly();
            
            // Сбрасываем выбранный контакт
            selectedContact = null;
            
            // Скрываем поле ввода сообщений
            document.getElementById('message-input').disabled = true;
            document.getElementById('send-btn').disabled = true;
            
            // Показываем приветственное сообщение
            document.getElementById('chat-header-content').innerHTML = `
                <div class="chat-contact-info">
                    <div class="chat-contact-avatar"></div>
                    <div>
                        <h3>Выберите контакт</h3>
                        <div class="chat-contact-details">
                            <span class="chat-contact-uin">UIN: ---</span>
                            <span class="chat-contact-status"></span>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('messages-container').innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">💬</div>
                    <h3>ICQ Messenger</h3>
                    <p>Выберите контакт из списка слева, чтобы начать переписку</p>
                </div>
            `;
        });
    }
}

// Обновляем функцию selectContact:
async function selectContact(contact) {
    if (!contact || !currentUser) return;
    
    console.log('Выбран контакт:', contact.display_name);
    
    selectedContact = contact;
    
    // Показываем только чат (скрываем контакты)
    showChatOnly();
    
    // Обновляем заголовок чата
    document.getElementById('chat-header-content').innerHTML = `
        <button id="back-to-contacts" class="back-to-contacts">←</button>
        <div class="chat-contact-info">
            <div class="chat-contact-avatar">${contact.display_name.charAt(0).toUpperCase()}</div>
            <div>
                <h3>${contact.display_name}</h3>
                <div class="chat-contact-details">
                    <span class="chat-contact-uin">UIN: ${contact.uin}</span>
                    <span class="chat-contact-status ${contact.status}">${getStatusText(contact.status)}</span>
                </div>
            </div>
        </div>
    `;
    
    // Инициализируем кнопку "Назад"
    initBackToContactsButton();
    
    // Активируем поле ввода
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').focus();
    
    // Загружаем сообщения и подписываемся на новые
    await loadMessages();
    subscribeToMessages();
    
    // Отмечаем сообщения как прочитанные
    markMessagesAsRead(contact.id);
}

// Обновляем функцию initEventListeners - добавляем инициализацию кнопки:
function initEventListeners() {
    // ... существующий код ...
    
    // Инициализируем кнопку "Назад к контактам"
    initBackToContactsButton();
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration.scope);
                
                // Проверяем обновления Service Worker
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Найдено обновление Service Worker');
                    newWorker.addEventListener('statechange', () => {
                        console.log('Состояние нового Service Worker:', newWorker.state);
                    });
                });
            })
            .catch(err => console.error('Ошибка Service Worker:', err));
    }
}

function initEventListeners() {
    // Обработчики для вкладок
    document.getElementById('login-tab').addEventListener('click', () => {
        showTab('login');
    });
    
    document.getElementById('register-tab').addEventListener('click', () => {
        showTab('register');
    });
    
    // Обработчики для кнопок
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('install-btn').addEventListener('click', installPWA);
    
    // Отправка сообщения по Enter
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Закрытие модального окна
    document.getElementById('add-contact-modal').addEventListener('click', (e) => {
        if (e.target.id === 'add-contact-modal') {
            hideModal();
        }
    });
    
    // PWA установка
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.style.display = 'block';
        }
    });
}

function initNetworkStatus() {
    window.addEventListener('online', () => {
        showToast('✅ Соединение восстановлено');
        if (currentUser) {
            updateUserStatus('online');
        }
    });
    
    window.addEventListener('offline', () => {
        showToast('⚠️ Нет подключения к интернету');
        if (currentUser) {
            updateUserStatus('offline');
        }
    });
}

// ==================== РЕДАКТИРОВАНИЕ ИМЕНИ ====================

function showEditNameModal() {
    document.getElementById('edit-name-modal').style.display = 'flex';
    document.getElementById('new-display-name').value = currentUser?.user_metadata?.display_name || '';
    document.getElementById('edit-name-error').textContent = '';
    document.getElementById('edit-name-message').textContent = '';
    document.getElementById('new-display-name').focus();
}

function hideEditNameModal() {
    document.getElementById('edit-name-modal').style.display = 'none';
}

async function saveDisplayName() {
    const newName = document.getElementById('new-display-name').value.trim();
    const errorElement = document.getElementById('edit-name-error');
    const messageElement = document.getElementById('edit-name-message');
    
    errorElement.textContent = '';
    messageElement.textContent = '';
    
    if (!newName) {
        errorElement.textContent = 'Введите имя';
        return;
    }
    
    if (newName.length > 30) {
        errorElement.textContent = 'Имя не должно превышать 30 символов';
        return;
    }
    
    try {
        showLoading('Сохранение имени...');
        
        // 1. Обновляем в Supabase Auth
        const { error: authError } = await supabaseClient.auth.updateUser({
            data: { display_name: newName }
        });
        
        if (authError) throw authError;
        
        // 2. Обновляем в таблице profiles
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({ display_name: newName })
            .eq('id', currentUser.id);
        
        if (profileError) throw profileError;
        
        hideLoading();
        messageElement.textContent = '✅ Имя успешно изменено!';
        messageElement.style.color = 'green';
        
        // Обновляем отображение имени
        document.getElementById('user-display-name').textContent = newName;
        currentUser.user_metadata = { ...currentUser.user_metadata, display_name: newName };
        
        setTimeout(() => {
            hideEditNameModal();
            showToast('Имя успешно обновлено!');
        }, 1500);
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка изменения имени:', error);
        errorElement.textContent = 'Ошибка при изменении имени';
    }
}

// Обновляем функцию loadUserProfile, чтобы отображалось имя:
async function loadUserProfile() {
    if (!currentUser) return;
    
    console.log('Загрузка профиля пользователя:', currentUser.id);
    
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            console.log('Профиль не найден, создаем новый...');
            await createUserProfile(currentUser.id, currentUser.user_metadata?.display_name || 'Пользователь');
            await loadUserProfile();
            return;
        }
        
        console.log('Профиль загружен:', profile);
        
        // Обновляем UI
        document.getElementById('user-uin').textContent = `UIN: ${profile.uin}`;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-display-name').textContent = profile.display_name || 'Без имени';
        
        // Устанавливаем статус в select
        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.value = profile.status;
        }
        
        updateStatusDisplay(profile.status);
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// ==================== АВТОРИЗАЦИЯ ====================

async function checkAuth() {
    console.log('Проверка авторизации...');
    
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Ошибка получения сессии:', error);
            showAuthScreen();
            return;
        }
        
        if (session) {
            console.log('Пользователь авторизован:', session.user.email);
            currentUser = session.user;
            await loadUserProfile();
            showMainScreen();
        } else {
            console.log('Пользователь не авторизован');
            showAuthScreen();
        }
    } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('install-btn').style.display = 'none';
    
    // Сброс полей форм
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-display-name').value = '';
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

function showMainScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'flex';
    
    loadContacts();
    trackOnlineStatus();
    
    // Подписываемся на ВСЕ входящие сообщения для уведомлений
    subscribeToAllMessages();
    
    // Проверяем, нужно ли показывать кнопку установки PWA
    if (deferredPrompt) {
        document.getElementById('install-btn').style.display = 'block';
    }
}

// Новая функция: Подписка на все входящие сообщения
function subscribeToAllMessages() {
    if (!currentUser) return;
    
    console.log('Подписка на все входящие сообщения');
    
    supabaseClient
        .channel('all-incoming-messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id.eq.${currentUser.id}`
        }, async (payload) => {
            console.log('Входящее сообщение от:', payload.new.sender_id);
            
            // Если чат с этим пользователем не открыт, показываем уведомление
            if (!selectedContact || selectedContact.id !== payload.new.sender_id) {
                // Получаем информацию об отправителе
                const { data: senderProfile } = await supabaseClient
                    .from('profiles')
                    .select('display_name')
                    .eq('id', payload.new.sender_id)
                    .single();
                
                if (senderProfile) {
                    const messageText = payload.new.content.length > 50 
                        ? payload.new.content.substring(0, 50) + '...' 
                        : payload.new.content;
                    
                    showNotification('💬 Новое сообщение', `${senderProfile.display_name}: ${messageText}`);
                    
                    // Обновляем список контактов, чтобы показать новое сообщение
                    loadContacts();
                }
            }
        })
        .subscribe();
}

// Функция переключения вкладок
function showTab(tabName) {
    document.getElementById('login-form').style.display = 
        tabName === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = 
        tabName === 'register' ? 'block' : 'none';
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (tabName === 'login') {
        document.getElementById('login-tab').classList.add('active');
    } else {
        document.getElementById('register-tab').classList.add('active');
    }
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    errorElement.textContent = '';
    
    if (!email || !password) {
        errorElement.textContent = 'Заполните все поля';
        return;
    }
    
    try {
        showLoading('Вход в систему...');
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        hideLoading();
        
        if (error) {
            console.error('Ошибка входа:', error);
            errorElement.textContent = error.message;
            if (error.message.includes('Invalid login credentials')) {
                errorElement.textContent = 'Неверный email или пароль';
            }
        } else {
            console.log('Вход успешен:', data.user.email);
            currentUser = data.user;
            await loadUserProfile();
            showMainScreen();
            showToast('✅ Вход выполнен успешно');
        }
    } catch (error) {
        hideLoading();
        console.error('Неожиданная ошибка при входе:', error);
        errorElement.textContent = 'Произошла ошибка при входе';
    }
}

async function register() {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const displayName = document.getElementById('reg-display-name').value.trim();
    const errorElement = document.getElementById('register-error');
    
    errorElement.textContent = '';
    
    // Валидация
    if (!email || !password) {
        errorElement.textContent = 'Заполните все поля';
        return;
    }
    
    if (!validateEmail(email)) {
        errorElement.textContent = 'Введите корректный email';
        return;
    }
    
    if (password.length < 6) {
        errorElement.textContent = 'Пароль должен быть минимум 6 символов';
        return;
    }
    
    try {
        showLoading('Регистрация...');
        
        console.log('Пытаемся зарегистрировать:', email);
        
        // 1. Пробуем зарегистрироваться
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || email.split('@')[0]
                }
            }
        });
        
        console.log('Результат регистрации:', { signUpData, signUpError });
        
        if (signUpError) {
            hideLoading();
            console.error('Ошибка регистрации:', signUpError);
            errorElement.textContent = signUpError.message;
            
            // Если ошибка "user already registered", пробуем войти
            if (signUpError.message.includes('already registered')) {
                console.log('Пользователь уже существует, пробуем войти...');
                errorElement.textContent = 'Пользователь уже существует, пытаюсь войти...';
                
                const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (signInError) {
                    errorElement.textContent = 'Ошибка входа: ' + signInError.message;
                } else {
                    currentUser = signInData.user;
                    await loadUserProfile();
                    showMainScreen();
                    showToast('✅ Вход выполнен!');
                }
            }
            return;
        }
        
        // 2. Если регистрация успешна, создаем профиль
        if (signUpData.user) {
            console.log('Регистрация успешна, создаем профиль...');
            currentUser = signUpData.user;
            
            // Ждем немного, чтобы пользователь сохранился в базе
            setTimeout(async () => {
                const uin = await createUserProfile(signUpData.user.id, displayName || email.split('@')[0]);
                
                if (uin) {
                    hideLoading();
                    showMainScreen();
                    showToast('✅ Регистрация успешна! Добро пожаловать!');
                } else {
                    hideLoading();
                    errorElement.textContent = 'Профиль создан, но произошла ошибка. Попробуйте войти.';
                    
                    // Пробуем войти
                    const { data: signInData } = await supabaseClient.auth.signInWithPassword({
                        email,
                        password
                    });
                    
                    if (signInData.user) {
                        currentUser = signInData.user;
                        showMainScreen();
                    }
                }
            }, 2000); // Ждем 2 секунды
        
        } else {
            hideLoading();
            errorElement.textContent = '✅ Регистрация успешна! Проверьте email.';
            setTimeout(() => showTab('login'), 3000);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Неожиданная ошибка при регистрации:', error);
        errorElement.textContent = 'Произошла ошибка при регистрации: ' + error.message;
    }
}

function validateEmail(email) {
    // Простая проверка email
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

async function logout() {
    try {
        showLoading('Выход из системы...');
        
        // Обновляем статус на offline перед выходом
        if (currentUser) {
            await updateUserStatus('offline');
        }
        
        const { error } = await supabaseClient.auth.signOut();
        
        hideLoading();
        
        if (error) {
            console.error('Ошибка выхода:', error);
            showToast('Ошибка при выходе', 'error');
        } else {
            console.log('Выход выполнен успешно');
            currentUser = null;
            selectedContact = null;
            
            // Отписываемся от обновлений сообщений
            if (messagesSubscription) {
                supabaseClient.removeChannel(messagesSubscription);
                messagesSubscription = null;
            }
            
            showAuthScreen();
            showToast('Вы вышли из системы');
        }
    } catch (error) {
        hideLoading();
        console.error('Неожиданная ошибка при выходе:', error);
    }
}

// ==================== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ====================

async function loadUserProfile() {
    if (!currentUser) return;
    
    console.log('Загрузка профиля пользователя:', currentUser.id);
    
    try {
        // Пытаемся получить профиль
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            console.log('Профиль не найден, создаем новый...');
            // Создаем профиль, если он не существует
            await createUserProfile(currentUser.id, currentUser.user_metadata?.display_name || 'Пользователь');
            // Повторно загружаем профиль
            await loadUserProfile();
            return;
        }
        
        console.log('Профиль загружен:', profile);
        
        // Обновляем UI
        document.getElementById('user-uin').textContent = `UIN: ${profile.uin}`;
        document.getElementById('user-email').textContent = currentUser.email;
        
        // Устанавливаем статус в select
        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.value = profile.status;
        }
        
        updateStatusDisplay(profile.status);
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function createUserProfile(userId, displayName) {
    console.log('Создание профиля для пользователя:', userId);
    
    try {
        // Генерируем уникальный 9-значный UIN
        const uin = generateUIN();
        console.log('Сгенерирован UIN:', uin);
        
        const { data, error } = await supabaseClient
            .from('profiles')
            .insert([{
                id: userId,
                uin: uin,
                display_name: displayName,
                status: 'online',
                last_seen: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Ошибка создания профиля:', error);
            
            // Если UIN уже существует, пробуем с другим
            if (error.code === '23505') {
                console.log('UIN уже существует, генерируем новый...');
                // Рекурсивно пытаемся снова с новым UIN
                return await createUserProfile(userId, displayName);
            }
            throw error;
        } else {
            console.log('✅ Профиль создан с UIN:', uin);
            
            // Показываем UIN пользователю
            setTimeout(() => {
                showToast(`✅ Ваш UIN: ${uin}. Сохраните его для добавления в контакты!`);
            }, 1000);
            
            return uin;
        }
    } catch (error) {
        console.error('Неожиданная ошибка при создании профиля:', error);
        throw error;
    }
}

function generateUIN() {
    // Генерируем 9-значный UIN (от 100000000 до 999999999)
    // Начинаем с 1, чтобы всегда было 9 цифр
    const min = 100000000;
    const max = 999999999;
    return Math.floor(min + Math.random() * (max - min + 1));
}

async function trackOnlineStatus() {
    if (!currentUser) return;
    
    // Устанавливаем статус "онлайн"
    await updateUserStatus('online');
    
    // Таймер неактивности
    let inactivityTimer;
    
    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(async () => {
            await updateUserStatus('away');
        }, 5 * 60 * 1000); // 5 минут
    }
    
    // Отслеживаем активность пользователя
    const activityEvents = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
        window.addEventListener(event, resetTimer, { passive: true });
    });
    
    resetTimer();
    
    // Обновляем статус при закрытии страницы
    window.addEventListener('beforeunload', async () => {
        await updateUserStatus('offline');
    });
    
    // Периодическое обновление статуса
    setInterval(async () => {
        if (currentUser) {
            await updateUserStatus('online');
        }
    }, 30 * 1000); // Каждые 30 секунд
}

async function updateUserStatus(status) {
    if (!currentUser) return;
    
    console.log('Обновление статуса на:', status);
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ 
                status: status,
                last_seen: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        
        if (error) {
            console.error('Ошибка обновления статуса:', error);
        } else {
            updateStatusDisplay(status);
        }
    } catch (error) {
        console.error('Неожиданная ошибка при обновлении статуса:', error);
    }
}

function updateStatusDisplay(status) {
    const statusElement = document.getElementById('user-status');
    const statusText = {
        'online': '🟢 Онлайн',
        'away': '🟡 Отошёл',
        'dnd': '🔴 Не беспокоить',
        'invisible': '⚫ Невидимка',
        'offline': '⚪ Оффлайн'
    };
    
    statusElement.textContent = statusText[status] || '⚪ Оффлайн';
    statusElement.className = `status-${status}`;
}

async function changeStatus(newStatus) {
    if (!currentUser) return;
    
    await updateUserStatus(newStatus);
    showToast(`Статус изменен на: ${newStatus}`);
}

// ==================== СИСТЕМА КОНТАКТОВ ====================

function showAddContact() {
    document.getElementById('add-contact-modal').style.display = 'flex';
    document.getElementById('uin-input').value = '';
    document.getElementById('add-contact-error').textContent = '';
    document.getElementById('add-contact-message').textContent = '';
    document.getElementById('uin-input').focus();
}

function hideModal() {
    document.getElementById('add-contact-modal').style.display = 'none';
}

// НОВАЯ ФУНКЦИЯ: Поиск пользователей по имени или UIN
async function searchUsers(query) {
    if (!currentUser || !query || query.length < 2) return [];
    
    try {
        // Ищем по имени (частичное совпадение)
        const { data: byName, error: nameError } = await supabaseClient
            .from('profiles')
            .select('*')
            .ilike('display_name', `%${query}%`)
            .neq('id', currentUser.id)
            .limit(10);
        
        if (nameError) throw nameError;
        
        // Ищем по UIN (точное или частичное совпадение)
        let byUIN = [];
        if (!isNaN(query) && query.length >= 3) {
            const { data: uinData, error: uinError } = await supabaseClient
                .from('profiles')
                .select('*')
                .ilike('uin::text', `%${query}%`)
                .neq('id', currentUser.id)
                .limit(10);
            
            if (!uinError) byUIN = uinData || [];
        }
        
        // Объединяем результаты, убираем дубликаты
        const allUsers = [...byName, ...byUIN];
        const uniqueUsers = [];
        const seenIds = new Set();
        
        for (const user of allUsers) {
            if (!seenIds.has(user.id)) {
                seenIds.add(user.id);
                uniqueUsers.push(user);
            }
        }
        
        return uniqueUsers;
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        return [];
    }
}

async function addContact() {
    const uinInput = document.getElementById('uin-input').value.trim();
    const errorElement = document.getElementById('add-contact-error');
    const messageElement = document.getElementById('add-contact-message');
    
    errorElement.textContent = '';
    messageElement.textContent = '';
    
    if (!uinInput) {
        errorElement.textContent = 'Введите UIN или имя пользователя';
        return;
    }
    
    try {
        showLoading('Поиск пользователя...');
        
        let contactProfile = null;
        
        // Проверяем, является ли ввод числом (UIN)
        if (!isNaN(uinInput) && uinInput.length === 9) {
            // Поиск по точному UIN
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('uin', parseInt(uinInput))
                .single();
            
            if (!error && data) {
                contactProfile = data;
            }
        } else {
            // Поиск по имени
            const users = await searchUsers(uinInput);
            if (users.length === 1) {
                contactProfile = users[0];
            } else if (users.length > 1) {
                hideLoading();
                // Показать список найденных пользователей
                showUserList(users);
                return;
            }
        }
        
        hideLoading();
        
        if (!contactProfile) {
            errorElement.textContent = 'Пользователь не найден';
            return;
        }
        
        if (contactProfile.id === currentUser.id) {
            errorElement.textContent = 'Нельзя добавить самого себя';
            return;
        }
        
        // Проверяем, есть ли уже такой контакт
        const { data: existingContact } = await supabaseClient
            .from('contacts')
            .select('*')
            .or(`and(user_id.eq.${currentUser.id},contact_id.eq.${contactProfile.id}),and(user_id.eq.${contactProfile.id},contact_id.eq.${currentUser.id})`)
            .single();
        
        if (existingContact) {
            errorElement.textContent = 'Этот пользователь уже у вас в контактах';
            return;
        }
        
        showLoading('Добавление контакта...');
        
        // Добавляем контакт
        const { error: insertError } = await supabaseClient
            .from('contacts')
            .insert([{
                user_id: currentUser.id,
                contact_id: contactProfile.id,
                status: 'pending'
            }]);
        
        hideLoading();
        
        if (insertError) {
            console.error('Ошибка добавления контакта:', insertError);
            errorElement.textContent = 'Ошибка при добавлении контакта';
        } else {
            messageElement.textContent = '✅ Запрос на добавление отправлен!';
            messageElement.style.color = 'green';
            
            setTimeout(() => {
                hideModal();
                loadContacts();
                showToast('Запрос на добавление контакта отправлен');
            }, 1500);
        }
    } catch (error) {
        hideLoading();
        console.error('Неожиданная ошибка при добавлении контакта:', error);
        errorElement.textContent = 'Произошла ошибка';
    }
}

// НОВАЯ ФУНКЦИЯ: Показ списка найденных пользователей
function showUserList(users) {
    const modal = document.getElementById('add-contact-modal');
    const modalBody = modal.querySelector('.modal-body');
    const oldContent = modalBody.innerHTML;
    
    modalBody.innerHTML = `
        <div class="user-list-container">
            <h4>Найдено ${users.length} пользователей:</h4>
            <div class="user-list">
                ${users.map(user => `
                    <div class="user-list-item" data-user-id="${user.id}">
                        <div class="user-list-avatar">${user.display_name.charAt(0).toUpperCase()}</div>
                        <div class="user-list-info">
                            <div class="user-list-name">${user.display_name}</div>
                            <div class="user-list-details">
                                <span class="user-list-uin">UIN: ${user.uin}</span>
                                <span class="user-list-status ${user.status}">${getStatusText(user.status)}</span>
                            </div>
                        </div>
                        <button class="user-list-add-btn" onclick="addContactById('${user.id}')">+</button>
                    </div>
                `).join('')}
            </div>
            <button class="btn-secondary" onclick="showAddContactSearch()">← Назад к поиску</button>
        </div>
    `;
    
    // Сохраняем старый контент для кнопки "Назад"
    modalBody.dataset.oldContent = oldContent;
}

// НОВАЯ ФУНКЦИЯ: Добавление контакта по ID
async function addContactById(userId) {
    try {
        showLoading('Добавление контакта...');
        
        // Получаем информацию о пользователе
        const { data: contactProfile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error || !contactProfile) {
            throw new Error('Пользователь не найден');
        }
        
        // Проверяем, есть ли уже такой контакт
        const { data: existingContact } = await supabaseClient
            .from('contacts')
            .select('*')
            .or(`and(user_id.eq.${currentUser.id},contact_id.eq.${contactProfile.id}),and(user_id.eq.${contactProfile.id},contact_id.eq.${currentUser.id})`)
            .single();
        
        if (existingContact) {
            showToast('Этот пользователь уже у вас в контактах');
            return;
        }
        
        // Добавляем контакт
        const { error: insertError } = await supabaseClient
            .from('contacts')
            .insert([{
                user_id: currentUser.id,
                contact_id: contactProfile.id,
                status: 'pending'
            }]);
        
        hideLoading();
        
        if (insertError) {
            console.error('Ошибка добавления контакта:', insertError);
            showToast('Ошибка при добавлении контакта', 'error');
        } else {
            hideModal();
            loadContacts();
            showToast(`✅ Запрос на добавление ${contactProfile.display_name} отправлен!`);
        }
    } catch (error) {
        hideLoading();
        console.error('Ошибка:', error);
        showToast('Произошла ошибка', 'error');
    }
}

// НОВАЯ ФУНКЦИЯ: Возврат к поиску
function showAddContactSearch() {
    const modalBody = document.querySelector('#add-contact-modal .modal-body');
    if (modalBody.dataset.oldContent) {
        modalBody.innerHTML = modalBody.dataset.oldContent;
    } else {
        showAddContact();
    }
}

async function loadContacts() {
    if (!currentUser) return;
    
    console.log('Загрузка контактов...');
    
    try {
        // Загружаем ВСЕ контакты - и принятые, и запросы
        const { data: contacts, error } = await supabaseClient
            .from('contacts')
            .select(`
                *,
                contact:contact_id (*),
                user:user_id (*)
            `)
            .or(`user_id.eq.${currentUser.id},contact_id.eq.${currentUser.id}`);
        
        if (error) {
            console.error('Ошибка загрузки контактов:', error);
            return;
        }
        
        const contactsList = document.getElementById('contacts-list');
        contactsList.innerHTML = '';
        
        if (!contacts || contacts.length === 0) {
            contactsList.innerHTML = `
                <div class="no-contacts">
                    <div>📇 Контактов пока нет</div>
                    <p>Добавьте друзей по UIN или имени</p>
                    <button onclick="showAddContact()" class="add-first-contact">Добавить первый контакт</button>
                </div>
            `;
            return;
        }
        
        // Создаем мап для хранения уникальных контактов
        const uniqueContactsMap = new Map();
        
        // Обрабатываем каждый контакт
        contacts.forEach(contact => {
            const isIncoming = contact.contact_id === currentUser.id;
            const otherUser = isIncoming ? contact.user : contact.contact;
            const contactId = otherUser.id;
            
            // Если контакта еще нет в мапе, добавляем
            if (!uniqueContactsMap.has(contactId)) {
                uniqueContactsMap.set(contactId, {
                    user: otherUser,
                    contactData: contact,
                    type: contact.status === 'accepted' ? 'accepted' : 
                          isIncoming ? 'incoming' : 'outgoing'
                });
            } else {
                // Если контакт уже есть, выбираем лучший статус
                const existing = uniqueContactsMap.get(contactId);
                if (contact.status === 'accepted') {
                    // Принятый контакт имеет высший приоритет
                    existing.type = 'accepted';
                    existing.contactData = contact;
                } else if (existing.type !== 'accepted' && isIncoming) {
                    // Входящий запрос имеет приоритет над исходящим
                    existing.type = 'incoming';
                    existing.contactData = contact;
                }
            }
        });
        
        // Преобразуем мап в массивы
        const acceptedContacts = [];
        const incomingRequests = [];
        const outgoingRequests = [];
        
        uniqueContactsMap.forEach(contact => {
            if (contact.type === 'accepted') {
                acceptedContacts.push(contact);
            } else if (contact.type === 'incoming') {
                incomingRequests.push(contact);
            } else {
                outgoingRequests.push(contact);
            }
        });
        
        // Сортируем принятые контакты: онлайн первые, потом по алфавиту
        acceptedContacts.sort((a, b) => {
            if (a.user.status === 'online' && b.user.status !== 'online') return -1;
            if (a.user.status !== 'online' && b.user.status === 'online') return 1;
            return a.user.display_name.localeCompare(b.user.display_name);
        });
        
        // 1. Показываем входящие запросы
        if (incomingRequests.length > 0) {
            const requestsHeader = document.createElement('div');
            requestsHeader.className = 'requests-header';
            requestsHeader.innerHTML = `<h4>📥 Запросы на добавление (${incomingRequests.length})</h4>`;
            contactsList.appendChild(requestsHeader);
            
            incomingRequests.forEach(item => {
                const requestElement = document.createElement('div');
                requestElement.className = 'contact-request';
                requestElement.dataset.contactId = item.contactData.id;
                
                requestElement.innerHTML = `
                    <div class="request-avatar">${item.user.display_name.charAt(0).toUpperCase()}</div>
                    <div class="request-info">
                        <div class="request-name">${item.user.display_name}</div>
                        <div class="request-details">
                            <span class="request-uin">UIN: ${item.user.uin}</span>
                            <span class="request-status">Хочет добавить вас в друзья</span>
                        </div>
                    </div>
                    <div class="request-buttons">
                        <button class="btn-accept" onclick="acceptContactRequest('${item.contactData.id}', '${item.user.id}')">✓ Принять</button>
                        <button class="btn-reject" onclick="rejectContactRequest('${item.contactData.id}')">✗ Отклонить</button>
                    </div>
                `;
                
                contactsList.appendChild(requestElement);
            });
        }
        
        // 2. Показываем принятых друзей
        if (acceptedContacts.length > 0) {
            const friendsHeader = document.createElement('div');
            friendsHeader.className = 'contacts-header';
            friendsHeader.innerHTML = `<h4>✅ Мои друзья (${acceptedContacts.length})</h4>`;
            contactsList.appendChild(friendsHeader);
            
            acceptedContacts.forEach(item => {
                const contactElement = document.createElement('div');
                contactElement.className = 'contact-item';
                contactElement.dataset.userId = item.user.id;
                
                // Получаем последнее сообщение и количество непрочитанных
                getLastMessage(item.user.id).then(lastMessage => {
                    getUnreadCount(item.user.id).then(unreadCount => {
                        contactElement.innerHTML = `
                            <div class="contact-avatar">${item.user.display_name.charAt(0).toUpperCase()}</div>
                            <div class="contact-info">
                                <div class="contact-name">
                                    ${item.user.display_name}
                                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                                </div>
                                <div class="contact-details">
                                    <span class="contact-uin">UIN: ${item.user.uin}</span>
                                    <span class="contact-status ${item.user.status}">${getStatusText(item.user.status)}</span>
                                </div>
                                ${lastMessage ? `<div class="last-message">${lastMessage.content.substring(0, 30)}${lastMessage.content.length > 30 ? '...' : ''}</div>` : ''}
                            </div>
                        `;
                    });
                });
                
                contactElement.addEventListener('click', () => {
                    selectContact(item.user);
                    // На мобильных скрываем список контактов
                    if (window.innerWidth <= 768) {
                        hideContactsList();
                    }
                    
                    document.querySelectorAll('.contact-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    contactElement.classList.add('active');
                    
                    // Отмечаем сообщения как прочитанные
                    markMessagesAsRead(item.user.id);
                });
                
                contactsList.appendChild(contactElement);
            });
        }
        
        // 3. Показываем отправленные запросы
        if (outgoingRequests.length > 0) {
            const outgoingHeader = document.createElement('div');
            outgoingHeader.className = 'contacts-header';
            outgoingHeader.innerHTML = `<h4>📤 Ожидание ответа (${outgoingRequests.length})</h4>`;
            contactsList.appendChild(outgoingHeader);
            
            outgoingRequests.forEach(item => {
                const requestElement = document.createElement('div');
                requestElement.className = 'contact-request outgoing';
                
                requestElement.innerHTML = `
                    <div class="request-avatar">${item.user.display_name.charAt(0).toUpperCase()}</div>
                    <div class="request-info">
                        <div class="request-name">${item.user.display_name}</div>
                        <div class="request-details">
                            <span class="request-uin">UIN: ${item.user.uin}</span>
                            <span class="request-status">Ожидает подтверждения...</span>
                        </div>
                    </div>
                `;
                
                contactsList.appendChild(requestElement);
            });
        }
        
    } catch (error) {
        console.error('Неожиданная ошибка при загрузке контактов:', error);
    }
}

// Функция для получения количества непрочитанных сообщений
async function getUnreadCount(contactId) {
    if (!currentUser || !contactId) return 0;
    
    try {
        const { data: messages } = await supabaseClient
            .from('messages')
            .select('id')
            .eq('sender_id', contactId)
            .eq('receiver_id', currentUser.id)
            .is('read_at', null);
        
        return messages ? messages.length : 0;
    } catch (error) {
        return 0;
    }
}

// Функция для отметки сообщений как прочитанных
async function markMessagesAsRead(contactId) {
    if (!currentUser || !contactId) return;
    
    try {
        await supabaseClient
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('sender_id', contactId)
            .eq('receiver_id', currentUser.id)
            .is('read_at', null);
        
        // Обновляем список контактов (убираем бейджик)
        loadContacts();
    } catch (error) {
        console.error('Ошибка отметки сообщений как прочитанных:', error);
    }
}
async function getLastMessage(contactId) {
    if (!currentUser || !contactId) return null;
    
    try {
        const { data: messages } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        return messages;
    } catch (error) {
        return null;
    }
}

function getStatusText(status) {
    const statusMap = {
        'online': '🟢 Онлайн',
        'away': '🟡 Отошёл',
        'dnd': '🔴 Не беспокоить',
        'invisible': '⚫ Невидимка',
        'offline': '⚪ Оффлайн'
    };
    return statusMap[status] || '⚪ Оффлайн';
}

// Функция принятия запроса на дружбу
async function acceptContactRequest(contactId, otherUserId) {
    try {
        showLoading('Принятие запроса...');
        
        // 1. Обновляем статус запроса на 'accepted'
        const { error: updateError } = await supabaseClient
            .from('contacts')
            .update({ status: 'accepted' })
            .eq('id', contactId);
        
        if (updateError) throw updateError;
        
        // 2. Создаём обратную запись (чтобы друг тоже видел тебя)
        const { error: insertError } = await supabaseClient
            .from('contacts')
            .insert([{
                user_id: currentUser.id,
                contact_id: otherUserId,
                status: 'accepted'
            }])
            .select()
            .single();
        
        // Если ошибка "уже существует" - игнорируем
        if (insertError && !insertError.message.includes('duplicate key')) {
            console.error('Ошибка создания обратной записи:', insertError);
        }
        
        hideLoading();
        
        // 3. Обновляем список контактов
        loadContacts();
        showToast('✅ Запрос принят! Теперь вы друзья!');
        
        // 4. Отправляем уведомление другу
        await sendContactAcceptedNotification(otherUserId);
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка принятия запроса:', error);
        showToast('Ошибка при принятии запроса', 'error');
    }
}

// Функция отправки уведомления о принятии запроса
async function sendContactAcceptedNotification(otherUserId) {
    try {
        // Получаем информацию о друге
        const { data: friendProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', otherUserId)
            .single();
        
        if (!friendProfile) return;
        
        // Отправляем системное сообщение
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                sender_id: currentUser.id,
                receiver_id: otherUserId,
                content: `✅ ${currentUser.email} принял(а) ваш запрос на добавление в друзья! Теперь вы можете общаться.`
            }]);
        
        if (error) console.error('Ошибка отправки уведомления:', error);
        
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Функция отклонения запроса
async function rejectContactRequest(contactId) {
    try {
        showLoading('Отклонение запроса...');
        
        const { error } = await supabaseClient
            .from('contacts')
            .delete()
            .eq('id', contactId);
        
        hideLoading();
        
        if (error) {
            console.error('Ошибка отклонения запроса:', error);
            showToast('Ошибка при отклонении запроса', 'error');
        } else {
            loadContacts();
            showToast('Запрос отклонен');
        }
    } catch (error) {
        hideLoading();
        console.error('Ошибка:', error);
    }
}

// ==================== СООБЩЕНИЯ ====================

async function selectContact(contact) {
    if (!contact || !currentUser) return;
    
    console.log('Выбран контакт:', contact.display_name);
    
    selectedContact = contact;
    
    // Обновляем заголовок чата
    document.getElementById('chat-header').innerHTML = `
        <div class="chat-contact-info">
            <div class="chat-contact-avatar">${contact.display_name.charAt(0).toUpperCase()}</div>
            <div>
                <h3>${contact.display_name}</h3>
                <div class="chat-contact-details">
                    <span class="chat-contact-uin">UIN: ${contact.uin}</span>
                    <span class="chat-contact-status ${contact.status}">${getStatusText(contact.status)}</span>
                </div>
            </div>
        </div>
    `;
    
    // Активируем поле ввода
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').focus();
    
    // Загружаем сообщения и подписываемся на новые
    await loadMessages();
    subscribeToMessages();
    
    // Прокручиваем к последнему сообщению
    setTimeout(() => {
        const container = document.getElementById('messages-container');
        container.scrollTop = container.scrollHeight;
    }, 100);
}

async function loadMessages() {
    if (!selectedContact || !currentUser) return;
    
    console.log('Загрузка сообщений с:', selectedContact.display_name);
    
    try {
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Ошибка загрузки сообщений:', error);
            return;
        }
        
        displayMessages(messages || []);
    } catch (error) {
        console.error('Неожиданная ошибка при загрузке сообщений:', error);
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="no-messages">
                <div>💬 Начните общение с ${selectedContact.display_name}</div>
                <div class="hint">Отправьте первое сообщение</div>
            </div>
        `;
        return;
    }
    
    let lastDate = null;
    
    messages.forEach(message => {
        const isSent = message.sender_id === currentUser.id;
        const messageDate = new Date(message.created_at);
        const today = new Date();
        
        // Добавляем разделитель даты, если изменился день
        const messageDay = messageDate.toDateString();
        if (!lastDate || lastDate !== messageDay) {
            const dateElement = document.createElement('div');
            dateElement.className = 'message-date';
            
            let dateText;
            if (messageDate.toDateString() === today.toDateString()) {
                dateText = 'Сегодня';
            } else if (messageDate.toDateString() === new Date(today.setDate(today.getDate() - 1)).toDateString()) {
                dateText = 'Вчера';
            } else {
                dateText = messageDate.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
            
            dateElement.textContent = dateText;
            container.appendChild(dateElement);
            lastDate = messageDay;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
        
        const time = messageDate.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageElement.innerHTML = `
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-time">${time} ${isSent ? '✓' : ''}</div>
        `;
        
        container.appendChild(messageElement);
    });
    
    // Прокручиваем к последнему сообщению
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function subscribeToMessages() {
    // Отписываемся от предыдущей подписки
    if (messagesSubscription) {
        supabaseClient.removeChannel(messagesSubscription);
        messagesSubscription = null;
    }
    
    if (!selectedContact || !currentUser) return;
    
    console.log('Подписка на сообщения с:', selectedContact.id);
    
    messagesSubscription = supabaseClient
        .channel('messages-' + selectedContact.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id}))`
        }, async (payload) => {
            console.log('Новое сообщение:', payload.new);
            
            // Обновляем список сообщений
            await loadMessages();
            
            // Прокручиваем к последнему сообщению
            setTimeout(() => {
                const container = document.getElementById('messages-container');
                container.scrollTop = container.scrollHeight;
            }, 100);
            
            // Показываем уведомление, если сообщение от другого пользователя
            if (payload.new.sender_id !== currentUser.id) {
                const contactName = selectedContact.display_name;
                const messageText = payload.new.content.length > 50 
                    ? payload.new.content.substring(0, 50) + '...' 
                    : payload.new.content;
                
                // Показываем браузерное уведомление
                if (Notification.permission === 'granted') {
                    showNotification('💬 Новое сообщение', `${contactName}: ${messageText}`);
                }
                
                // Виброотклик (если поддерживается)
                if ('vibrate' in navigator) {
                    navigator.vibrate([100, 50, 100]);
                }
                
                // Обновляем список контактов, чтобы показать последнее сообщение
                loadContacts();
            }
        })
        .subscribe((status) => {
            console.log('Статус подписки на сообщения:', status);
        });
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message || !selectedContact || !currentUser) return;
    
    if (message.length > 1000) {
        showToast('Сообщение слишком длинное (макс. 1000 символов)', 'error');
        return;
    }
    
    try {
        // Блокируем кнопку отправки
        const sendBtn = document.getElementById('send-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Отправка...';
        
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                sender_id: currentUser.id,
                receiver_id: selectedContact.id,
                content: message
            }]);
        
        // Восстанавливаем кнопку
        sendBtn.disabled = false;
        sendBtn.textContent = 'Отправить';
        
        if (error) {
            console.error('Ошибка отправки сообщения:', error);
            showToast('Ошибка отправки сообщения', 'error');
        } else {
            input.value = '';
            await loadMessages();
            
            // Фокус на поле ввода
            input.focus();
        }
    } catch (error) {
        console.error('Неожиданная ошибка при отправке сообщения:', error);
        document.getElementById('send-btn').disabled = false;
        document.getElementById('send-btn').textContent = 'Отправить';
        showToast('Произошла ошибка', 'error');
    }
}

// ==================== PUSH-УВЕДОМЛЕНИЯ ====================

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Браузер не поддерживает уведомления');
        return;
    }
    
    if (Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            console.log('Разрешение на уведомления:', permission);
            
            if (permission === 'granted') {
                showToast('Уведомления включены');
            }
        } catch (error) {
            console.error('Ошибка запроса разрешения:', error);
        }
    }
}

function showNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    // Проверяем, активно ли окно
    if (document.hasFocus()) {
        // Показываем тост вместо уведомления, если окно активно
        showToast(`💬 ${title}: ${body}`);
        return;
    }
    
    const options = {
        body: body,
        icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
        badge: 'https://img.icons8.com/color/96/000000/speech-bubble.png',
        tag: 'icq-message',
        requireInteraction: false
    };
    
    const notification = new Notification(title, options);
    
    notification.onclick = function() {
        window.focus();
        notification.close();
    };
    
    // Автоматически закрываем через 5 секунд
    setTimeout(() => notification.close(), 5000);
}

// ==================== PWA ФУНКЦИОНАЛ ====================

async function installPWA() {
    if (!deferredPrompt) {
        showToast('Приложение уже установлено или установка недоступна');
        return;
    }
    
    try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log(`Пользователь ${outcome} установку приложения`);
        
        if (outcome === 'accepted') {
            showToast('Приложение устанавливается...');
            document.getElementById('install-btn').style.display = 'none';
        }
        
        deferredPrompt = null;
    } catch (error) {
        console.error('Ошибка установки PWA:', error);
        showToast('Ошибка установки приложения', 'error');
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function showLoading(message = 'Загрузка...') {
    // Удаляем старый индикатор, если есть
    const existingLoader = document.getElementById('global-loader');
    if (existingLoader) existingLoader.remove();
    
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.innerHTML = `
        <div class="loader-overlay">
            <div class="loader-spinner"></div>
            <div class="loader-text">${message}</div>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.remove();
}

function showToast(message, type = 'info') {
    // Удаляем старые тосты
    const oldToasts = document.querySelectorAll('.toast');
    oldToasts.forEach(toast => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Показываем тост
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Скрываем через 3 секунды
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Функция для быстрого тестирования
async function testRegistration() {
    console.log('Тестируем регистрацию...');
    
    // Тестовые данные
    const testEmail = `test${Date.now()}@test.com`;
    const testPassword = '123456';
    
    // Заполняем форму
    document.getElementById('reg-email').value = testEmail;
    document.getElementById('reg-password').value = testPassword;
    document.getElementById('reg-display-name').value = 'Тестовый пользователь';
    
    // Переключаемся на регистрацию
    showTab('register');
    
    // Ждем и регистрируем
    setTimeout(() => {
        register();
    }, 500);
}

// Обновление статуса каждые 30 секунд
setInterval(async () => {
    if (currentUser) {
        await updateUserStatus('online');
    }
}, 30000);
