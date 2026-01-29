// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let supabaseClient = null;
let currentUser = null;
let selectedContact = null;
let messagesSubscription = null;
let globalMessagesSubscription = null;
let deferredPrompt = null;
let isMobileMenuOpen = false;
let touchStartX = 0;

// === ИНИЦИАЛИЗАЦИЯ SUPABASE ===
function initSupabase() {
    const supabaseUrl = 'https://dcxdpieejeuhyeybfbff.supabase.co'; // ЗАМЕНИТЬ НА ВАШ РЕАЛЬНЫЙ URL
    const supabaseAnonKey = 'sb_publishable_1mKGAaO6CgUbkIObl7-O0A_YBoE8fxq'; // ЗАМЕНИТЬ НА ВАШ РЕАЛЬНЫЙ КЛЮЧ
    const { createClient } = window.supabase || window.Supabase;
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase инициализирован.');
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
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

function showTab(tabName) {
    document.getElementById('login-form').style.display = tabName === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tabName === 'register' ? 'block' : 'none';
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (tabName === 'login') {
        document.getElementById('login-tab').classList.add('active');
    } else {
        document.getElementById('register-tab').classList.add('active');
    }
}

// === ФУНКЦИИ АВТОРИЗАЦИИ ===
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
            showAuthScreen();
        }
    } catch (error) {
        console.error('Неожиданная ошибка при проверке авторизации:', error);
        showAuthScreen();
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
    
    if (!validateEmail(email)) {
        errorElement.textContent = 'Введите корректный email';
        return;
    }
    
    try {
        showLoading('Вход в систему...');
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            console.error('Ошибка входа:', error);
            if (error.code === 'invalid_credentials') {
                errorElement.textContent = 'Неверный email или пароль';
            } else {
                errorElement.textContent = 'Ошибка входа: ' + error.message;
            }
        } else {
            console.log('Вход успешен:', data.user.email);
            currentUser = data.user;
            await loadUserProfile();
            showMainScreen();
            showToast('✅ Вход выполнен успешно');
            await updateUserStatus('online'); // Обновляем статус после входа
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
    const displayName = document.getElementById('reg-display-name').value.trim() || email.split('@')[0];
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
                    display_name: displayName
                }
            }
        });
        
        if (signUpError) {
            console.error('Ошибка регистрации:', signUpError);
            if (signUpError.code === 'user_already_exists') {
                errorElement.textContent = 'Пользователь с таким email уже существует. Попробуйте войти.';
            } else {
                errorElement.textContent = 'Ошибка регистрации: ' + signUpError.message;
            }
            hideLoading();
            return;
        }
        
        // 2. Если регистрация успешна, создаем профиль
        if (signUpData.user) {
            console.log('Регистрация успешна, создаем профиль...');
            currentUser = signUpData.user;
            
            // Ждем немного, чтобы пользователь был создан в Auth
            setTimeout(async () => {
                try {
                    await createUserProfile(signUpData.user.id, displayName);
                    await loadUserProfile(); // Загружаем профиль после создания
                    showMainScreen();
                    showToast('✅ Регистрация успешна!');
                    await updateUserStatus('online'); // Обновляем статус после регистрации и входа
                } catch (createProfileError) {
                    console.error('Ошибка создания профиля:', createProfileError);
                    errorElement.textContent = 'Профиль создан, но произошла ошибка. Попробуйте войти.';
                    
                    // Пробуем войти
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
                hideLoading();
            }, 2000); // Ждем 2 секунды
        } else {
            // Если пользователь не нуждается в подтверждении, он сразу вошел
            if (signUpData.session) {
                currentUser = signUpData.user;
                await loadUserProfile();
                await updateUserStatus('online');
                showMainScreen();
                showToast('✅ Регистрация и вход выполнены успешно!');
            }
            hideLoading();
        }
    } catch (error) {
        hideLoading();
        console.error('Неожиданная ошибка при регистрации:', error);
        errorElement.textContent = 'Произошла ошибка при регистрации';
    }
}

async function logout() {
    try {
        showLoading('Выход из системы...');
        
        const { error } = await supabaseClient.auth.signOut();
        hideLoading();
        
        if (error) {
            console.error('Ошибка выхода:', error);
            showToast('Ошибка при выходе', 'error');
        } else {
            console.log('Выход выполнен успешно');
            // Обновляем статус на offline ТОЛЬКО ПОСЛЕ успешного выхода
            if (currentUser) {
                await updateUserStatus('offline');
            }
            
            // Остальная логика очистки
            currentUser = null;
            selectedContact = null;
            
            if (messagesSubscription) {
                supabaseClient.removeChannel(messagesSubscription);
            }
            
            if (globalMessagesSubscription) {
                supabaseClient.removeChannel(globalMessagesSubscription);
            }
            
            showAuthScreen();
        }
    } catch (error) {
        hideLoading();
        console.error('Ошибка при выходе:', error);
        showToast('Ошибка при выходе', 'error');
    }
}

// === ФУНКЦИИ ПРОФИЛЯ ===
async function loadUserProfile() {
    if (!currentUser) return;
    
    try {
        console.log('Загрузка профиля для пользователя:', currentUser.id);
        
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля:', error);
            if (error.code === 'PGRST116') { // Ресурс не найден
                // Профиль не существует, нужно создать
                await createUserProfile(currentUser.id, currentUser.email.split('@')[0]);
                // Повторно загружаем профиль
                await loadUserProfile();
                return;
            }
            return;
        }
        
        console.log('Профиль загружен:', profile);
        
        // Обновляем UI
        document.getElementById('user-uin').textContent = `UIN: ${profile.uin}`;
        document.getElementById('user-display-name').textContent = profile.display_name;
        document.getElementById('user-email').textContent = currentUser.email;
        
        // Устанавливаем статус в select
        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.value = profile.status;
        }
        
        updateStatusDisplay(profile.status);
        
        // Обновляем UIN в модальном окне
        document.getElementById('my-uin').textContent = profile.uin;
        
        // ОБНОВЛЯЕМ МОБИЛЬНОЕ МЕНЮ С ПЕРЕДАННЫМИ ДАННЫМИ
        updateMobileUserInfo(profile);
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function createUserProfile(userId, displayName) {
    console.log('Создание профиля для пользователя:', userId);
    
    try {
        // Генерируем уникальный 9-значный UIN
        let uin;
        let profileCreated = false;
        
        while (!profileCreated) {
            uin = Math.floor(Math.random() * 900000000) + 100000000; // 100000000 - 999999999
            
            const { error } = await supabaseClient
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
                if (error.code === '23505') { // unique_violation
                    console.log('UIN занят, генерируем новый...');
                    continue; // Пробуем снова
                } else {
                    throw error; // Другая ошибка, выходим
                }
            } else {
                profileCreated = true;
            }
        }
        
        console.log('Профиль успешно создан с UIN:', uin);
    } catch (error) {
        console.error('Ошибка при создании профиля:', error);
        throw error;
    }
}

async function updateUserStatus(newStatus) {
    if (!currentUser) return;
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ status: newStatus, last_seen: new Date().toISOString() })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        console.log('Статус пользователя обновлен на:', newStatus);
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
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
    updateStatusDisplay(newStatus);
    showToast(`Статус изменен на: ${getStatusText(newStatus)}`);
    
    // ОБНОВЛЯЕМ МОБИЛЬНОЕ МЕНЮ
    updateMobileUserInfo({ status: newStatus });
}

// === ФУНКЦИИ КОНТАКТОВ ===
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
                // Показываем список найденных пользователей
                showUserList(users);
                hideLoading();
                return;
            }
        }
        
        if (!contactProfile) {
            errorElement.textContent = 'Пользователь не найден';
            hideLoading();
            return;
        }
        
        // Проверяем, не является ли пользователь самим собой
        if (contactProfile.id === currentUser.id) {
            errorElement.textContent = 'Вы не можете добавить себя в контакты';
            hideLoading();
            return;
        }
        
        // Проверяем, не добавлен ли контакт уже
        const { data: existingContact, error: existingError } = await supabaseClient
            .from('contacts')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('contact_id', contactProfile.id)
            .single();
        
        if (!existingError && existingContact) {
            errorElement.textContent = 'Контакт уже добавлен';
            hideLoading();
            return;
        }
        
        // Добавляем контакт
        const { error: insertError } = await supabaseClient
            .from('contacts')
            .insert([{ user_id: currentUser.id, contact_id: contactProfile.id }]);
        
        if (insertError) throw insertError;
        
        messageElement.textContent = `Контакт ${contactProfile.display_name} добавлен!`;
        messageElement.style.color = 'green';
        hideLoading();
        
        await loadContacts(); // Обновляем список контактов
        setTimeout(hideModal, 1500); // Закрываем модальное окно через 1.5 сек
    } catch (error) {
        hideLoading();
        console.error('Ошибка добавления контакта:', error);
        errorElement.textContent = 'Ошибка при добавлении контакта';
    }
}

async function searchUsers(searchTerm) {
    try {
        // Убираем опасные символы из поиска
        const safeTerm = searchTerm.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, '');
        
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, display_name, uin, status')
            .ilike('display_name', `%${safeTerm}%`)
            .limit(10);
        
        if (error) throw error;
        
        return data || [];
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        return [];
    }
}

function showUserList(users) {
    const modalBody = document.getElementById('add-contact-modal').querySelector('.modal-body');
    
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
                                <span class="user-list-status status-${user.status}">${getStatusEmoji(user.status)}</span>
                            </div>
                        </div>
                        <button class="btn-primary small" onclick="confirmAddContact('${user.id}')">Добавить</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function getStatusEmoji(status) {
    const emojis = {
        'online': '🟢',
        'away': '🟡',
        'dnd': '🔴',
        'invisible': '⚫',
        'offline': '⚪'
    };
    return emojis[status] || '⚪';
}

async function confirmAddContact(contactUserId) {
    try {
        // Находим профиль по ID
        const { data: contactProfile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', contactUserId)
            .single();
        
        if (error || !contactProfile) {
            showToast('Ошибка: профиль не найден', 'error');
            return;
        }
        
        // Проверяем, не добавлен ли контакт уже
        const { data: existingContact, error: existingError } = await supabaseClient
            .from('contacts')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('contact_id', contactProfile.id)
            .single();
        
        if (!existingError && existingContact) {
            showToast('Контакт уже добавлен', 'warning');
            return;
        }
        
        // Добавляем контакт
        const { error: insertError } = await supabaseClient
            .from('contacts')
            .insert([{ user_id: currentUser.id, contact_id: contactProfile.id }]);
        
        if (insertError) throw insertError;
        
        showToast(`Контакт ${contactProfile.display_name} добавлен!`);
        await loadContacts(); // Обновляем список контактов
        hideModal(); // Закрываем модальное окно
    } catch (error) {
        console.error('Ошибка подтверждения добавления контакта:', error);
        showToast('Ошибка при добавлении контакта', 'error');
    }
}

async function loadContacts() {
    if (!currentUser) return;
    
    try {
        console.log('Загрузка списка контактов...');
        
        // Используем правильный синтаксис для связи с профилями
        const { data: contacts, error } = await supabaseClient
            .from('contacts')
            .select(`
                contact_id,
                profiles!contacts_contact_id_fkey (
                    id, display_name, uin, status, last_seen
                )
            `)
            .eq('user_id', currentUser.id);
        
        if (error) {
            console.error('Ошибка загрузки контактов:', error);
            showToast('Ошибка загрузки контактов', 'error');
            return;
        }
        
        // Обрабатываем данные
        displayContacts(contacts);
    } catch (error) {
        console.error('Ошибка загрузки контактов:', error);
        showToast('Ошибка загрузки контактов', 'error');
    }
}

function displayContacts(contactsData) {
    const contactsList = document.getElementById('contacts-list');
    contactsList.innerHTML = ''; // Очищаем список
    
    if (!contactsData || contactsData.length === 0) {
        contactsList.innerHTML = `
            <div class="no-contacts">
                <div>👋 Начните общение!</div>
                <p>Добавьте контакты по UIN, чтобы начать переписку</p>
                <button onclick="showAddContact()" class="add-first-contact">Добавить первый контакт</button>
            </div>
        `;
        return;
    }
    
    // Подготавливаем данные для отображения
    const contacts = contactsData.map(item => {
        // Проверяем разные форматы ответа
        if (item.profiles) {
            return {
                id: item.profiles.id,
                display_name: item.profiles.display_name,
                uin: item.profiles.uin,
                status: item.profiles.status,
                last_seen: item.profiles.last_seen
            };
        } else if (item.profiles) { // альтернативный формат
            return {
                id: item.profiles.id,
                display_name: item.profiles.display_name,
                uin: item.profiles.uin,
                status: item.profiles.status,
                last_seen: item.profiles.last_seen
            };
        }
        return null;
    }).filter(Boolean);
    
    // Сортировка: онлайн -> оффлайн -> по имени
    contacts.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.display_name.localeCompare(b.display_name);
    });
    
    contacts.forEach(contact => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.onclick = () => selectContact(contact);
        
        contactItem.innerHTML = `
            <div class="contact-avatar">${contact.display_name.charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.display_name}</div>
                <div class="contact-details">
                    <span class="contact-uin">UIN: ${contact.uin}</span>
                    <span class="contact-status status-${contact.status}">${getStatusEmoji(contact.status)}</span>
                </div>
            </div>
        `;
        
        contactsList.appendChild(contactItem);
    });
}

function selectContact(contact) {
    selectedContact = contact;
    console.log('Выбран контакт:', contact.display_name);
    
    // Обновляем UI чата
    document.getElementById('chat-title').textContent = contact.display_name;
    document.getElementById('chat-uin').textContent = `UIN: ${contact.uin}`;
    document.getElementById('chat-status').className = `chat-contact-status status-${contact.status}`;
    document.getElementById('chat-status').textContent = getStatusEmoji(contact.status);
    
    const avatar = document.getElementById('chat-avatar');
    avatar.textContent = contact.display_name.charAt(0).toUpperCase();
    avatar.style.display = 'flex';
    document.getElementById('chat-details').style.display = 'flex';
    
    // Скрываем приветственное сообщение
    document.getElementById('welcome-message').style.display = 'none';
    
    // На мобильных скрываем меню
    if (window.innerWidth <= 768) {
        hideMobileMenu();
    }
    
    // Активируем поле ввода
    const messageInput = document.getElementById('message-input');
    messageInput.disabled = false;
    messageInput.placeholder = 'Введите сообщение...';
    document.getElementById('send-btn').disabled = false;
    
    // Загружаем сообщения и подписываемся на новые
    loadMessages();
    subscribeToMessages();
    
    // Отмечаем сообщения как прочитанные
    markMessagesAsRead(contact.id);
}

// === ФУНКЦИИ СООБЩЕНИЙ ===
async function loadMessages() {
    if (!selectedContact || !currentUser) return;
    
    console.log('Загрузка сообщений с:', selectedContact.display_name);
    
    try {
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // Отображаем сообщения
        displayMessages(messages || []);
        
        // Отмечаем сообщения как прочитанные
        markMessagesAsRead(selectedContact.id);
    } catch (error) {
        console.error('Неожиданная ошибка при загрузке сообщений:', error);
        showToast('Ошибка загрузки сообщений', 'error');
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    // Очищаем контейнер от приветствия и старых сообщений
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
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateText = '';
        
        if (messageDate.toDateString() === today.toDateString()) {
            dateText = 'Сегодня';
        } else if (messageDate.toDateString() === yesterday.toDateString()) {
            dateText = 'Вчера';
        } else {
            dateText = messageDate.toLocaleDateString('ru-RU');
        }
        
        // Добавляем разделитель даты, если день изменился
        if (lastDate !== messageDate.toDateString()) {
            const dateElement = document.createElement('div');
            dateElement.className = 'message-date';
            dateElement.textContent = dateText;
            container.appendChild(dateElement);
            lastDate = messageDate.toDateString();
        }
        
        // Создаем элемент сообщения
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
        
        const time = messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-time">${time} ${isSent ? '✓' : ''}</div>
        `;
        
        container.appendChild(messageElement);
    });
    
    // Прокручиваем к последнему сообщению
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

async function sendMessage() {
    if (!selectedContact || !currentUser) return;
    
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        showLoading('Отправка...');
        
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                sender_id: currentUser.id,
                receiver_id: selectedContact.id,
                content: content,
                read: false
            }]);
        
        if (error) throw error;
        
        input.value = '';
        hideLoading();
        
        // Сообщение появится в чате через подписку
        // loadMessages(); // Не вызываем напрямую, подписка обновит UI
    } catch (error) {
        hideLoading();
        console.error('Ошибка отправки сообщения:', error);
        showToast('Ошибка отправки сообщения', 'error');
    }
}

function subscribeToMessages() {
    if (messagesSubscription) {
        supabaseClient.removeChannel(messagesSubscription);
    }
    
    if (!selectedContact || !currentUser) return;
    
    messagesSubscription = supabaseClient
        .channel(`private-chat-${Math.min(currentUser.id, selectedContact.id)}-${Math.max(currentUser.id, selectedContact.id)}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `or(sender_id.eq.${selectedContact.id},receiver_id.eq.${selectedContact.id})`
            },
            async (payload) => {
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
                    const messageText = payload.new.content;
                    
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(`Сообщение от ${contactName}`, {
                            body: messageText,
                            icon: 'https://img.icons8.com/color/96/000000/speech-bubble.png'
                        });
                    }
                }
            }
        )
        .subscribe();
}

async function markMessagesAsRead(contactId) {
    if (!currentUser) return;
    
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ read: true })
            .eq('sender_id', contactId)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);
        
        if (error) throw error;
        
        console.log('Сообщения помечены как прочитанные');
    } catch (error) {
        console.error('Ошибка при пометке сообщений как прочитанных:', error);
    }
}

// === ФУНКЦИИ РЕДАКТИРОВАНИЯ ИМЕНИ ===
function showEditNameModal() {
    document.getElementById('edit-name-modal').style.display = 'flex';
    document.getElementById('new-display-name').value = currentUser?.user_metadata?.display_name || currentUser?.email.split('@')[0] || '';
}

function hideEditNameModal() {
    document.getElementById('edit-name-modal').style.display = 'none';
    document.getElementById('edit-name-error').textContent = '';
    document.getElementById('edit-name-message').textContent = '';
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
        
        // 1. Обновляем в таблице profiles
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

// === PWA И УВЕДОМЛЕНИЯ ===
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

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

// === ФУНКЦИИ ДЛЯ МОБИЛЬНОГО МЕНЮ ===

// Показываем мобильное меню
function showMobileMenu() {
    console.log("Открываем мобильное меню");
    
    // 1. Добавляем класс для анимации кнопки (перемещение вниз)
    const menuButton = document.getElementById('menu-toggle');
    if (menuButton) {
        menuButton.classList.add('menu-open');
    }
    
    // 2. Добавляем класс для сдвига шапки
    const mobileHeader = document.querySelector('.mobile-header');
    if (mobileHeader) {
        mobileHeader.classList.add('menu-open');
    }
    
    // 3. Показываем меню
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const menuIcon = document.querySelector('.menu-icon');
    const closeIcon = document.querySelector('.close-icon');
    
    if (sidebar) sidebar.classList.add('show');
    if (overlay) overlay.classList.add('show');
    if (menuIcon) menuIcon.style.opacity = '0';
    if (closeIcon) closeIcon.style.opacity = '1';
    
    // 4. Обновляем информацию о пользователе
    updateMobileUserInfo();
    
    // 5. Загружаем контакты
    setTimeout(loadMobileContacts, 100);
}

// Скрываем мобильное меню
function hideMobileMenu() {
    console.log("Закрываем мобильное меню");
    
    // 1. Убираем класс для анимации кнопки
    const menuButton = document.getElementById('menu-toggle');
    if (menuButton) {
        menuButton.classList.remove('menu-open');
    }
    
    // 2. Убираем класс для сдвига шапки
    const mobileHeader = document.querySelector('.mobile-header');
    if (mobileHeader) {
        mobileHeader.classList.remove('menu-open');
    }
    
    // 3. Скрываем меню
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const menuIcon = document.querySelector('.menu-icon');
    const closeIcon = document.querySelector('.close-icon');
    
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
    if (menuIcon) menuIcon.style.opacity = '1';
    if (closeIcon) closeIcon.style.opacity = '0';
}

// Переключаем мобильное меню
function toggleMobileMenu() {
    const sidebar = document.querySelector('.mobile-sidebar');
    if (sidebar && sidebar.classList.contains('show')) {
        hideMobileMenu();
    } else {
        showMobileMenu();
    }
}

// Загрузка контактов для мобильного меню
async function loadMobileContacts() {
    if (!currentUser) return;
    
    try {
        console.log('Загрузка контактов для мобильного меню...');
        
        const { data: contacts, error } = await supabaseClient
            .from('contacts')
            .select(`
                contact_id,
                profiles!contacts_contact_id_fkey (
                    id, display_name, uin, status
                )
            `)
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        displayMobileContacts(contacts);
    } catch (error) {
        console.error('Ошибка загрузки контактов для мобильного меню:', error);
    }
}

// Отображение контактов в мобильном меню
function displayMobileContacts(contactsData) {
    const contactsList = document.getElementById('mobile-contacts-list');
    contactsList.innerHTML = '';
    
    if (!contactsData || contactsData.length === 0) {
        contactsList.innerHTML = `
            <div class="no-contacts">
                <div>👋 Начните общение!</div>
                <p>Добавьте контакты по UIN</p>
                <button onclick="showAddContact(); hideMobileMenu();" class="add-first-contact">Добавить контакт</button>
            </div>
        `;
        return;
    }
    
    const contacts = contactsData.map(item => {
        if (item.profiles) {
            return {
                id: item.profiles.id,
                display_name: item.profiles.display_name,
                uin: item.profiles.uin,
                status: item.profiles.status
            };
        }
        return null;
    }).filter(Boolean);
    
    // Сортировка
    contacts.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.display_name.localeCompare(b.display_name);
    });
    
    contacts.forEach(contact => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.setAttribute('data-contact-id', contact.id);
        contactItem.onclick = () => selectMobileContact(contact);
        
        contactItem.innerHTML = `
            <div class="contact-avatar">${contact.display_name.charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.display_name}</div>
                <div class="contact-details">
                    <span class="contact-uin">UIN: ${contact.uin}</span>
                    <span class="contact-status status-${contact.status}">${getStatusEmoji(contact.status)}</span>
                </div>
            </div>
        `;
        
        contactsList.appendChild(contactItem);
    });
}

// Выбор контакта в мобильном меню
function selectMobileContact(contact) {
    selectedContact = contact;
    console.log('Выбран контакт:', contact.display_name);
    
    // Обновляем шапку телефона
    document.getElementById('mobile-title').style.display = 'none';
    document.getElementById('mobile-contact-info').style.display = 'flex';
    document.getElementById('mobile-chat-title').textContent = contact.display_name;
    document.getElementById('mobile-chat-avatar').textContent = contact.display_name.charAt(0).toUpperCase();
    document.getElementById('mobile-chat-status').textContent = getStatusEmoji(contact.status);
    
    // Обновляем основной чат
    document.getElementById('chat-title').textContent = contact.display_name;
    document.getElementById('chat-uin').textContent = `UIN: ${contact.uin}`;
    document.getElementById('chat-status').className = `chat-contact-status status-${contact.status}`;
    document.getElementById('chat-status').textContent = getStatusEmoji(contact.status);
    
    const avatar = document.getElementById('chat-avatar');
    avatar.textContent = contact.display_name.charAt(0).toUpperCase();
    avatar.style.display = 'flex';
    document.getElementById('chat-details').style.display = 'flex';
    
    // Скрываем приветствие
    document.getElementById('welcome-message').style.display = 'none';
    
    // Активируем поле ввода
    const messageInput = document.getElementById('message-input');
    messageInput.disabled = false;
    messageInput.placeholder = 'Введите сообщение...';
    document.getElementById('send-btn').disabled = false;
    
    // Загружаем сообщения
    loadMessages();
    subscribeToMessages();
    markMessagesAsRead(contact.id);
    
    // Закрываем меню
    hideMobileMenu();
}

// Обновлённая функция для обновления информации о пользователе
function updateMobileUserInfo() {
    if (!currentUser) return;
    
    try {
        // Получаем данные из основной шапки
        const uinElement = document.getElementById('user-uin');
        const nameElement = document.getElementById('user-display-name');
        const statusSelect = document.getElementById('status-select');
        
        if (!uinElement || !nameElement || !statusSelect) return;
        
        const uin = uinElement.textContent.replace('UIN: ', '');
        const displayName = nameElement.textContent || currentUser.email.split('@')[0];
        const status = statusSelect.value;
        
        // Обновляем мобильное меню
        const avatarText = document.getElementById('mobile-user-avatar-text');
        const userName = document.getElementById('mobile-user-name');
        const userUin = document.getElementById('mobile-user-uin');
        const userStatus = document.getElementById('mobile-user-status');
        const mobileStatusSelect = document.getElementById('mobile-status-select');
        
        if (avatarText) avatarText.textContent = displayName.charAt(0).toUpperCase();
        if (userName) userName.textContent = displayName;
        if (userUin) userUin.textContent = `UIN: ${uin}`;
        if (userStatus) userStatus.textContent = getStatusText(status);
        if (mobileStatusSelect) mobileStatusSelect.value = status;
        
        console.log("Мобильная информация обновлена:", { displayName, uin, status });
    } catch (error) {
        console.error('Ошибка обновления мобильной информации:', error);
    }
}

// Функция для получения текста статуса
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

// Изменение статуса из мобильного меню
function changeMobileStatus(newStatus) {
    changeStatus(newStatus);
}

// === ИНИЦИАЛИЗАЦИЯ МОБИЛЬНОГО ИНТЕРФЕЙСА ===
function initMobileInterface() {
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Оверлей для закрытия меню
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', hideMobileMenu);
    }
    
    // Обработчики свайпа
    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchmove', handleTouchMove, false);
    document.addEventListener('touchend', handleTouchEnd, false);
    
    // Обновляем приветственное сообщение
    updateWelcomeMessage();
}

// Функции свайпа
function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
}

function handleTouchMove(event) {
    if (Math.abs(event.changedTouches[0].screenX - touchStartX) > 10) {
        event.preventDefault();
    }
}

function handleTouchEnd(event) {
    const touchEndX = event.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    
    // Свайп справа налево (открыть меню)
    if (diff > 50) {
        const sidebar = document.querySelector('.mobile-sidebar');
        if (!sidebar.classList.contains('show')) {
            toggleMobileMenu();
        }
    }
    
    // Свайп слева направо (закрыть меню)
    if (diff < -50) {
        const sidebar = document.querySelector('.mobile-sidebar');
        if (sidebar.classList.contains('show')) {
            toggleMobileMenu();
        }
    }
}

// Обновление приветственного сообщения
function updateWelcomeMessage() {
    const welcomeMessage = document.getElementById('welcome-message');
    
    if (window.innerWidth <= 768) {
        welcomeMessage.innerHTML = `
            <div class="welcome-icon">💬</div>
            <h3>ICQ Messenger</h3>
            <p>Нажмите на ☰ вверху слева, чтобы открыть контакты</p>
            <div class="tips">
                <div class="tip">📱 <strong>Совет:</strong> Установите приложение для удобного доступа</div>
            </div>
        `;
    } else {
        welcomeMessage.innerHTML = `
            <div class="welcome-icon">💬</div>
            <h3>ICQ Messenger</h3>
            <p>Нажмите на ☰ вверху слева, чтобы открыть контакты</p>
            <div class="tips">
                <div class="tip">💡 <strong>Совет:</strong> Свайпните справа для быстрого открытия контактов</div>
                <div class="tip">📱 <strong>Совет:</strong> Установите приложение для удобного доступа</div>
            </div>
        `;
    }
}

// === ИНИЦИАЛИЗАЦИЯ ===
function initEventListeners() {
    // Обработчики для вкладок
    document.getElementById('login-tab').addEventListener('click', () => showTab('login'));
    document.getElementById('register-tab').addEventListener('click', () => showTab('register'));
    
    // Обработчики для кнопок
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('install-btn').addEventListener('click', installPWA);
    
    // Обработчики для модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('add-contact-modal').style.display = 'none';
            document.getElementById('edit-name-modal').style.display = 'none';
        });
    });
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('add-contact-modal');
        const editModal = document.getElementById('edit-name-modal');
        
        if (event.target === modal) modal.style.display = 'none';
        if (event.target === editModal) editModal.style.display = 'none';
    });
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('user-info').style.display = 'flex';
    loadContacts();
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('Приложение инициализируется...');
    
    // Инициализация Supabase
    initSupabase();
    
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
    
    // Обработчик события установки PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt сработал');
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('install-btn').style.display = 'inline-block';
        document.getElementById('mobile-install-btn').style.display = 'inline-block';
    });
    
    // Обработчик успешной установки PWA
    window.addEventListener('appinstalled', () => {
        console.log('PWA успешно установлено');
        showToast('Приложение установлено!');
        deferredPrompt = null;
        document.getElementById('install-btn').style.display = 'none';
        document.getElementById('mobile-install-btn').style.display = 'none';
    });
});
