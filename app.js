// Конфигурация Supabase
const SUPABASE_URL = 'hhttps://dcxdpieejeuhyeybfbff.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1mKGAaO6CgUbkIObl7-O0A_YBoE8fxq';

// Инициализация Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let currentUser = null;
let selectedContact = null;
let messagesSubscription = null;
let deferredPrompt = null;

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
    
    // Проверяем, нужно ли показывать кнопку установки PWA
    if (deferredPrompt) {
        document.getElementById('install-btn').style.display = 'block';
    }
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

function validateEmail(email) {
    // Простая проверка email
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
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
    
    // Простейшая валидация
    if (!email || !password) {
        errorElement.textContent = 'Заполните все поля';
        return;
    }
    
    if (password.length < 6) {
        errorElement.textContent = 'Пароль должен быть минимум 6 символов';
        return;
    }
    
    try {
        showLoading('Регистрация...');
        
        console.log('ПРОСТАЯ РЕГИСТРАЦИЯ: Пытаемся зарегистрировать:', email);
        
        // САМАЯ ПРОСТАЯ РЕГИСТРАЦИЯ - без дополнительных опций
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });
        
        console.log('ПРОСТАЯ РЕГИСТРАЦИЯ: Результат:', { data, error });
        
        if (error) {
            hideLoading();
            errorElement.textContent = error.message;
            console.error('Ошибка:', error);
        } else if (data.user) {
            // Если пользователь создан
            currentUser = data.user;
            
            // Пробуем создать профиль
            try {
                const uin = await createUserProfile(data.user.id, displayName || email.split('@')[0]);
                console.log('Профиль создан с UIN:', uin);
                
                hideLoading();
                showMainScreen();
                showToast('✅ Регистрация успешна!');
            } catch (profileError) {
                console.error('Ошибка создания профиля:', profileError);
                hideLoading();
                errorElement.textContent = 'Пользователь создан, но профиль не создался. Попробуйте войти.';
            }
        } else {
            hideLoading();
            errorElement.textContent = '✅ Регистрация отправлена. Проверьте email.';
            errorElement.style.color = 'green';
        }
        
    } catch (error) {
        hideLoading();
        console.error('Неожиданная ошибка:', error);
        errorElement.textContent = 'Ошибка: ' + error.message;
    }
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
        // Генерируем уникальный UIN (10 цифр)
        const uin = generateUIN();
        
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
                setTimeout(() => createUserProfile(userId, displayName), 100);
            }
        } else {
            console.log('Профиль создан с UIN:', uin);
            return uin;
        }
    } catch (error) {
        console.error('Неожиданная ошибка при создании профиля:', error);
    }
}

function generateUIN() {
    // Генерируем 10-значный UIN, начиная с 1
    return Math.floor(1000000000 + Math.random() * 9000000000);
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
    document.getElementById('uin-input').focus();
}

function hideModal() {
    document.getElementById('add-contact-modal').style.display = 'none';
}

async function addContact() {
    const uinInput = document.getElementById('uin-input').value.trim();
    const errorElement = document.getElementById('add-contact-error');
    
    errorElement.textContent = '';
    
    if (!uinInput) {
        errorElement.textContent = 'Введите UIN';
        return;
    }
    
    const uin = parseInt(uinInput);
    if (isNaN(uin) || uin.toString().length !== 10) {
        errorElement.textContent = 'UIN должен состоять из 10 цифр';
        return;
    }
    
    try {
        showLoading('Поиск пользователя...');
        
        // Ищем пользователя по UIN
        const { data: contactProfile, error: searchError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('uin', uin)
            .single();
        
        hideLoading();
        
        if (searchError || !contactProfile) {
            errorElement.textContent = 'Пользователь с таким UIN не найден';
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
            errorElement.textContent = '✅ Запрос на добавление отправлен!';
            errorElement.style.color = 'green';
            
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

async function loadContacts() {
    if (!currentUser) return;
    
    console.log('Загрузка контактов...');
    
    try {
        const { data: contacts, error } = await supabaseClient
            .from('contacts')
            .select(`
                *,
                contact:contact_id (*),
                user:user_id (*)
            `)
            .or(`user_id.eq.${currentUser.id},contact_id.eq.${currentUser.id}`)
            .eq('status', 'accepted');
        
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
                    <button onclick="showAddContact()" class="add-first-contact">Добавить первый контакт</button>
                </div>
            `;
            return;
        }
        
        // Сортируем контакты по статусу (онлайн первые) и по имени
        contacts.sort((a, b) => {
            const userA = a.user_id === currentUser.id ? a.contact : a.user;
            const userB = b.user_id === currentUser.id ? b.contact : b.user;
            
            // Сначала онлайн пользователи
            if (userA.status === 'online' && userB.status !== 'online') return -1;
            if (userA.status !== 'online' && userB.status === 'online') return 1;
            
            // Затем по алфавиту
            return userA.display_name.localeCompare(userB.display_name);
        });
        
        contacts.forEach(contact => {
            const otherUser = contact.user_id === currentUser.id 
                ? contact.contact 
                : contact.user;
            
            const contactElement = document.createElement('div');
            contactElement.className = 'contact-item';
            contactElement.dataset.userId = otherUser.id;
            
            // Получаем последнее сообщение для этого контакта
            getLastMessage(otherUser.id).then(lastMessage => {
                contactElement.innerHTML = `
                    <div class="contact-avatar">${otherUser.display_name.charAt(0).toUpperCase()}</div>
                    <div class="contact-info">
                        <div class="contact-name">${otherUser.display_name}</div>
                        <div class="contact-details">
                            <span class="contact-uin">UIN: ${otherUser.uin}</span>
                            <span class="contact-status ${otherUser.status}">${getStatusText(otherUser.status)}</span>
                        </div>
                        ${lastMessage ? `<div class="last-message">${lastMessage.content.substring(0, 30)}${lastMessage.content.length > 30 ? '...' : ''}</div>` : ''}
                    </div>
                `;
            });
            
            contactElement.addEventListener('click', () => {
                selectContact(otherUser);
                
                // Добавляем активный класс
                document.querySelectorAll('.contact-item').forEach(item => {
                    item.classList.remove('active');
                });
                contactElement.classList.add('active');
            });
            
            contactsList.appendChild(contactElement);
        });
    } catch (error) {
        console.error('Неожиданная ошибка при загрузке контактов:', error);
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
            
            await loadMessages();
            
            // Показываем уведомление, если сообщение от другого пользователя
            if (payload.new.sender_id !== currentUser.id) {
                const contactName = selectedContact.display_name;
                const messageText = payload.new.content.length > 50 
                    ? payload.new.content.substring(0, 50) + '...' 
                    : payload.new.content;
                
                showNotification('Новое сообщение', `${contactName}: ${messageText}`);
                
                // Виброотклик (если поддерживается)
                if ('vibrate' in navigator) {
                    navigator.vibrate([100, 50, 100]);
                }
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

// Чтобы вызвать тест, введи в консоли браузера: testRegistration()
// Открой консоль: F12 → вкладка Console

// Обновление статуса каждые 30 секунд
setInterval(async () => {
    if (currentUser) {
        await updateUserStatus('online');
    }
}, 30000);