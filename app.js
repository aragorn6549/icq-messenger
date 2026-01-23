// Конфигурация Supabase
const SUPABASE_URL = 'https://zvmxjimysdqzawbaoeas.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RveECL_xVyjSNE1WqyBy_A_Ho1biYYH';

// Получить эти значения можно в настройках проекта Supabase:
// Settings -> API -> Project URL и anon public key

// Создаем клиент Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let currentUser = null;
let selectedContact = null;
let messagesSubscription = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, вошел ли пользователь
    checkAuth();
    
    // Инициализируем Service Worker для PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('Service Worker зарегистрирован'))
            .catch(err => console.log('Ошибка Service Worker:', err));
    }
});

// ==================== АВТОРИЗАЦИЯ ====================

// Проверка авторизации
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showMainScreen();
    } else {
        showAuthScreen();
    }
}

// Показать экран авторизации
function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
}

// Показать главный экран
function showMainScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'flex';
    
    // Загружаем контакты
    loadContacts();
    
    // Начинаем отслеживать статус онлайн
    trackOnlineStatus();
}

// Переключение между вкладками
function showTab(tabName) {
    document.getElementById('login-form').style.display = 
        tabName === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = 
        tabName === 'register' ? 'block' : 'none';
    
    // Обновляем активные кнопки
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Вход
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    errorElement.textContent = '';
    
    if (!email || !password) {
        errorElement.textContent = 'Заполните все поля';
        return;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        errorElement.textContent = error.message;
    } else {
        currentUser = data.user;
        await loadUserProfile();
        showMainScreen();
    }
}

// Регистрация
async function register() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const displayName = document.getElementById('reg-display-name').value;
    const errorElement = document.getElementById('register-error');
    
    errorElement.textContent = '';
    
    if (!email || !password) {
        errorElement.textContent = 'Заполните обязательные поля';
        return;
    }
    
    if (password.length < 6) {
        errorElement.textContent = 'Пароль должен быть минимум 6 символов';
        return;
    }
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: displayName || 'Пользователь'
            }
        }
    });
    
    if (error) {
        errorElement.textContent = error.message;
    } else {
        errorElement.textContent = 'Регистрация успешна! Проверьте email для подтверждения.';
        showTab('login');
    }
}

// Выход
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    currentUser = null;
    showAuthScreen();
});

// ==================== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ====================

// Загрузка профиля пользователя
async function loadUserProfile() {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (profile) {
        document.getElementById('user-uin').textContent = `UIN: ${profile.uin}`;
        updateStatusDisplay(profile.status);
    }
}

// Обновление статуса онлайн
async function trackOnlineStatus() {
    // При входе ставим статус "online"
    await updateUserStatus('online');
    
    // При бездействии меняем на "away"
    let inactivityTimer;
    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(async () => {
            await updateUserStatus('away');
        }, 300000); // 5 минут
    }
    
    // Слушаем события активности
    ['mousemove', 'keypress', 'click', 'scroll'].forEach(event => {
        document.addEventListener(event, resetTimer);
    });
    
    resetTimer();
    
    // При закрытии страницы ставим "offline"
    window.addEventListener('beforeunload', async () => {
        await updateUserStatus('offline');
    });
}

// Обновление статуса в базе
async function updateUserStatus(status) {
    if (!currentUser) return;
    
    await supabase
        .from('profiles')
        .update({ 
            status: status,
            last_seen: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    
    updateStatusDisplay(status);
}

// Обновление отображения статуса
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
}

// ==================== СИСТЕМА КОНТАКТОВ ====================

// Показать модальное окно добавления контакта
function showAddContact() {
    document.getElementById('add-contact-modal').style.display = 'flex';
    document.getElementById('uin-input').focus();
}

// Скрыть модальное окно
function hideModal() {
    document.getElementById('add-contact-modal').style.display = 'none';
    document.getElementById('uin-input').value = '';
    document.getElementById('add-contact-error').textContent = '';
}

// Добавить контакт
async function addContact() {
    const uin = document.getElementById('uin-input').value;
    const errorElement = document.getElementById('add-contact-error');
    
    errorElement.textContent = '';
    
    if (!uin) {
        errorElement.textContent = 'Введите UIN';
        return;
    }
    
    // Ищем пользователя по UIN
    const { data: contactProfile, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .eq('uin', uin)
        .single();
    
    if (findError || !contactProfile) {
        errorElement.textContent = 'Пользователь с таким UIN не найден';
        return;
    }
    
    if (contactProfile.id === currentUser.id) {
        errorElement.textContent = 'Нельзя добавить самого себя';
        return;
    }
    
    // Проверяем, есть ли уже контакт
    const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .or(`and(user_id.eq.${currentUser.id},contact_id.eq.${contactProfile.id}),and(user_id.eq.${contactProfile.id},contact_id.eq.${currentUser.id})`)
        .single();
    
    if (existingContact) {
        errorElement.textContent = 'Этот пользователь уже у вас в контактах';
        return;
    }
    
    // Добавляем контакт
    const { error: insertError } = await supabase
        .from('contacts')
        .insert([
            {
                user_id: currentUser.id,
                contact_id: contactProfile.id,
                status: 'pending'
            }
        ]);
    
    if (insertError) {
        errorElement.textContent = 'Ошибка при добавлении контакта';
    } else {
        errorElement.textContent = '✅ Запрос на добавление отправлен!';
        setTimeout(() => {
            hideModal();
            loadContacts();
        }, 1500);
    }
}

// Загрузка списка контактов
async function loadContacts() {
    const { data: contacts, error } = await supabase
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
    
    if (contacts.length === 0) {
        contactsList.innerHTML = '<div class="contact-item">Контактов пока нет</div>';
        return;
    }
    
    contacts.forEach(contact => {
        // Определяем, кто из двух пользователей не текущий
        const otherUser = contact.user_id === currentUser.id 
            ? contact.contact 
            : contact.user;
        
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        contactElement.innerHTML = `
            <div>
                <strong>${otherUser.display_name}</strong>
                <div class="contact-uin">UIN: ${otherUser.uin} • ${getStatusText(otherUser.status)}</div>
            </div>
        `;
        
        contactElement.addEventListener('click', () => {
            selectContact(otherUser);
        });
        
        contactsList.appendChild(contactElement);
    });
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

// Выбор контакта для чата
async function selectContact(contact) {
    selectedContact = contact;
    
    // Обновляем заголовок чата
    document.getElementById('chat-header').innerHTML = `
        <h3>${contact.display_name}</h3>
        <div class="contact-uin">UIN: ${contact.uin} • ${getStatusText(contact.status)}</div>
    `;
    
    // Активируем поле ввода
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    
    // Загружаем историю сообщений
    await loadMessages();
    
    // Подписываемся на новые сообщения
    subscribeToMessages();
    
    // Помечаем активный контакт в списке
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.contact-item').classList.add('active');
}

// Загрузка истории сообщений
async function loadMessages() {
    if (!selectedContact) return;
    
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Ошибка загрузки сообщений:', error);
        return;
    }
    
    displayMessages(messages);
}

// Отображение сообщений
function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const isSent = message.sender_id === currentUser.id;
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
        
        const time = new Date(message.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageElement.innerHTML = `
            <div>${message.content}</div>
            <div class="message-time">${time}</div>
        `;
        
        container.appendChild(messageElement);
    });
    
    // Прокручиваем вниз
    container.scrollTop = container.scrollHeight;
}

// Подписка на новые сообщения
function subscribeToMessages() {
    // Отписываемся от предыдущей подписки
    if (messagesSubscription) {
        supabase.removeChannel(messagesSubscription);
    }
    
    if (!selectedContact) return;
    
    messagesSubscription = supabase
        .channel('messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id}))`
        }, async (payload) => {
            // Перезагружаем сообщения при новом сообщении
            await loadMessages();
            
            // Показываем уведомление, если сообщение не от нас
            if (payload.new.sender_id !== currentUser.id) {
                showNotification('Новое сообщение', selectedContact.display_name);
            }
        })
        .subscribe();
}

// Отправка сообщения
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message || !selectedContact) return;
    
    const { error } = await supabase
        .from('messages')
        .insert([
            {
                sender_id: currentUser.id,
                receiver_id: selectedContact.id,
                content: message
            }
        ]);
    
    if (!error) {
        input.value = '';
        await loadMessages();
    }
}

// ==================== PUSH-УВЕДОМЛЕНИЯ ====================

// Запрос разрешения на уведомления
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Разрешение на уведомления получено');
        }
    }
}

// Показать уведомление
function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png'
        });
    }
}

// Запрашиваем разрешение при загрузке
requestNotificationPermission();

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Форматирование времени
function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Обновление статуса каждые 30 секунд
setInterval(async () => {
    if (currentUser) {
        await updateUserStatus('online');
    }
}, 30000);