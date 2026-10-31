// ==================== KONFIGURASI ====================
const CONFIG = {
    WEBHOOK_URL: "https://n8n.nuscode.id/webhook/d4bfa857-4667-4d0f-ad67-7d80dbd9d624",
    SESSION_KEY: 'mahad_chat_session',
    HISTORY_KEY: 'mahad_chat_history',
    CHAT_WINDOW_ID: 'mahadChatbotWindow',
    MESSAGES_ID: 'mahadChatbotMessages',
    INPUT_ID: 'mahadChatbotInput',
    SEND_BUTTON_ID: 'mahadChatbotSend',
    STATUS_TEXT_ID: 'mahadChatbotStatusText'
};

// ==================== STATE MANAGEMENT ====================
const state = {
    sessionId: null,
    messageCount: 0,
    isTyping: false,
    isConnected: true,
    isChatOpen: false,
    unreadMessages: 0
};

// ==================== DOM ELEMENTS ====================
const elements = {
    chatButton: document.getElementById('chatButton'),
    messageBadge: document.getElementById('messageBadge'),
    chatbotContainer: document.getElementById('mahadChatbotContainer')
};

// ==================== SECURITY HELPER FUNCTIONS ====================
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function escapeAttribute(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==================== WHATSAPP DETECTION FUNCTIONS ====================
function formatWhatsAppNumber(phoneNumber) {
    // Pastikan hanya angka yang diproses
    let cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.startsWith('0')) {
        return '62' + cleanNumber.substring(1);
    } else if (cleanNumber.startsWith('62')) {
        return cleanNumber;
    } else if (cleanNumber.startsWith('8')) {
        return '62' + cleanNumber;
    } else if (cleanNumber.startsWith('+62')) {
        return cleanNumber.substring(1);
    }
    
    return '62' + cleanNumber;
}

function createWhatsAppButton(phoneNumber, displayText = null) {
    // Pastikan hanya angka yang digunakan untuk URL
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = formatWhatsAppNumber(cleanNumber);
    
    // Escape display text untuk mencegah XSS
    const display = escapeHtml(displayText || cleanNumber);
    
    // Validasi nomor minimal 8 digit
    if (cleanNumber.length < 8) {
        return escapeHtml(phoneNumber);
    }
    
    return `
        <a href="https://wa.me/${escapeAttribute(formattedNumber)}" 
           class="mahad-chatbot-whatsapp-btn" 
           target="_blank" 
           rel="noopener noreferrer">
            <i class="fab fa-whatsapp"></i>
            <span>${display}</span>
        </a>
    `;
}

function detectAndFormatWhatsAppNumbers(text) {
    // Pattern yang lebih aman, hanya mencari angka
    const phonePatterns = [
        /(0[1-9]\d{7,12})/g,           // 08xxxxxxxx
        /(\+62[1-9]\d{7,12})/g,        // +62xxxxxxxxxx
        /(62[1-9]\d{7,12})/g,          // 62xxxxxxxxxx
        /(8[1-9]\d{7,12})/g,           // 8xxxxxxxx
        /(0[1-9][\d\s\-\.]{7,15})/g    // 08xxx-xxx-xxx
    ];
    
    let formattedText = text;
    
    phonePatterns.forEach(pattern => {
        formattedText = formattedText.replace(pattern, (match) => {
            // Cek jika sudah dalam format link WhatsApp
            const numbersOnly = match.replace(/\D/g, '');
            const formattedNumber = formatWhatsAppNumber(numbersOnly);
            
            // Escape regex special characters
            const escapedFormattedNumber = formattedNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            if (formattedText.includes(`href="https://wa.me/${escapedFormattedNumber}"`)) {
                return match;
            }
            
            // Validasi panjang nomor
            if (numbersOnly.length < 8 || numbersOnly.length > 15) {
                return escapeHtml(match);
            }
            
            return createWhatsAppButton(numbersOnly, match);
        });
    });
    
    return formattedText;
}

function formatMessage(text) {
    if (!text) return '';
    
    // ==================== 1. BASIC HTML ESCAPE TERLEBIH DAHULU ====================
    let formatted = escapeHtml(text);
    
    // ==================== 2. MARKDOWN PARSER (AMAN KARENA SUDAH DI-ESCAPE) ====================
    
    // Bold **text** - cari text yang sudah di-escape
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic *text* - hati-hati dengan regex lookbehind
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Inline code `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Heading ### Heading
    formatted = formatted.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    
    // Bullet list (- item) - hanya untuk formatting visual
    formatted = formatted.replace(/^\s*-\s+(.+)$/gm, '• $1');
    
    // ==================== 3. LINE BREAK ====================
    formatted = formatted.replace(/\n/g, '<br>');
    
    // ==================== 4. URL LINK (AMAN KARENA SUDAH DI-ESCAPE) ====================
    formatted = formatted.replace(
        /(https?:\/\/[^\s<]+)/g,
        (url) => {
            const escapedUrl = escapeAttribute(url);
            const displayUrl = escapeHtml(url);
            return `<a href="${escapedUrl}" target="_blank" rel="noopener" style="color: var(--primary-bot); text-decoration: underline;">${displayUrl}</a>`;
        }
    );
    
    // ==================== 5. WHATSAPP DETECTION (SETELAH SEMUA PROSES LAIN) ====================
    formatted = detectAndFormatWhatsAppNumbers(formatted);
    
    return formatted;
}

// ==================== RENDER CHAT WINDOW ====================
function renderChatWindow() {
    if (document.getElementById(CONFIG.CHAT_WINDOW_ID)) {
        return document.getElementById(CONFIG.CHAT_WINDOW_ID);
    }
    
    const chatWindow = document.createElement('div');
    chatWindow.id = CONFIG.CHAT_WINDOW_ID;
    chatWindow.className = 'mahad-chatbot-window';
    
    // Gunakan string template biasa (aman karena tidak ada user input)
    chatWindow.innerHTML = `
        <!-- HEADER -->
        <div class="mahad-chatbot-header">
            <div class="mahad-chatbot-header-left">
                <div class="mahad-chatbot-logo">
                    <i class="fas fa-mosque"></i>
                </div>
                <div class="mahad-chatbot-header-info">
                    <p class="mahad-chatbot-title">Asisten Mahad Al Yusro</p>
                </div>
            </div>
            <div class="mahad-chatbot-status">
                <div class="mahad-chatbot-dot"></div>
                <span id="${CONFIG.STATUS_TEXT_ID}">Online</span>
            </div>
        </div>
        
        <!-- MESSAGES CONTAINER -->
        <div class="mahad-chatbot-messages-container">
            <div class="mahad-chatbot-messages" id="${CONFIG.MESSAGES_ID}">
                <!-- Messages will be added here -->
            </div>
        </div>
        
        <!-- INPUT AREA -->
        <div class="mahad-chatbot-input-area">
            <div class="mahad-chatbot-input-wrapper">
                <input type="text" id="${CONFIG.INPUT_ID}" 
                       class="mahad-chatbot-input" 
                       placeholder="Tulis pesan..." 
                       autocomplete="off">
                <button class="mahad-chatbot-send-btn" 
                        id="${CONFIG.SEND_BUTTON_ID}" 
                        onclick="sendMessage()" 
                        aria-label="Kirim pesan">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
    
    elements.chatbotContainer.appendChild(chatWindow);
    setupChatWindowElements();
    return chatWindow;
}

// ==================== SETUP CHAT WINDOW ELEMENTS ====================
function setupChatWindowElements() {
    window.chatElements = {
        messages: document.getElementById(CONFIG.MESSAGES_ID),
        input: document.getElementById(CONFIG.INPUT_ID),
        sendButton: document.getElementById(CONFIG.SEND_BUTTON_ID),
        statusText: document.getElementById(CONFIG.STATUS_TEXT_ID),
        footerText: document.getElementById('mahadChatbotFooterText')
    };
    
    setupChatWindowEventListeners();
    initializeChat();
}

// ==================== CHAT WINDOW EVENT LISTENERS ====================
function setupChatWindowEventListeners() {
    if (!window.chatElements) return;
    
    window.chatElements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    window.chatElements.sendButton.addEventListener('click', sendMessage);
}

// ==================== CHAT FUNCTIONS ====================
function initializeChat() {
    state.sessionId = localStorage.getItem(CONFIG.SESSION_KEY) || 
                      `mahad_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(CONFIG.SESSION_KEY, state.sessionId);
    
    loadChatHistory();
    
    if (window.chatElements.messages.children.length === 0) {
        showWelcomeMessage();
    }
    
    setTimeout(() => {
        if (window.chatElements && window.chatElements.input) {
            window.chatElements.input.focus();
        }
    }, 500);
}

function loadChatHistory() {
    const history = localStorage.getItem(CONFIG.HISTORY_KEY);
    if (!history) return;
    
    try {
        const data = JSON.parse(history);
        data.messages.forEach(msg => {
            // Pastikan teks dari history aman
            const safeText = escapeHtml(msg.text);
            addMessageToUI(msg.sender, safeText, msg.time, false);
            if (msg.sender === 'user') state.messageCount++;
        });
        scrollToBottom();
        updateFooterText();
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function saveChatHistory() {
    if (!window.chatElements || !window.chatElements.messages) return;
    
    const messages = [];
    window.chatElements.messages.querySelectorAll('.mahad-chatbot-message').forEach(msg => {
        // Ambil text content langsung (aman dari HTML)
        const textContent = msg.querySelector('p').textContent;
        messages.push({
            sender: msg.classList.contains('user') ? 'user' : 'bot',
            text: textContent, // Simpan sebagai plain text
            time: msg.querySelectorAll('.mahad-chatbot-meta span')[1]?.textContent || getCurrentTime()
        });
    });
    
    const history = {
        timestamp: new Date().toISOString(),
        sessionId: state.sessionId,
        messageCount: state.messageCount,
        messages: messages
    };
    
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(history));
}

function showWelcomeMessage() {
    const welcomeText = `Assalamualaikum warahmatullahi wabarakatuh. 

Ada yang bisa kami bantu, Abu/Ummu?`;
    addMessageToUI('bot', welcomeText, getCurrentTime(), false);
}

function addMessageToUI(sender, text, time = null, save = true) {
    if (!window.chatElements || !window.chatElements.messages) return null;
    
    const messageEl = document.createElement('div');
    messageEl.className = `mahad-chatbot-message ${sender}`;
    
    const senderName = sender === 'user' ? 'Anda' : 'Asisten Mahad';
    const displayTime = time || getCurrentTime();
    
    // Format hanya untuk pesan bot
    const formattedText = sender === 'bot' ? formatMessage(text) : escapeHtml(text);
    
    // Escape nama pengirim dan waktu
    const safeSenderName = escapeHtml(senderName);
    const safeDisplayTime = escapeHtml(displayTime);
    
    messageEl.innerHTML = `
        <div class="mahad-chatbot-meta">
            <span>${safeSenderName}</span>
            <span>${safeDisplayTime}</span>
        </div>
        <p style="margin: 0; padding: 0;">${formattedText}</p>
    `;
    
    window.chatElements.messages.appendChild(messageEl);
    scrollToBottom();
    
    if (save) {
        setTimeout(saveChatHistory, 100);
    }
    
    return messageEl;
}

function scrollToBottom() {
    if (!window.chatElements || !window.chatElements.messages) return;
    
    setTimeout(() => {
        window.chatElements.messages.scrollTop = window.chatElements.messages.scrollHeight;
    }, 100);
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateFooterText() {
    if (window.chatElements && window.chatElements.footerText) {
        const shortId = state.sessionId ? state.sessionId.substring(0, 10) + '...' : 'new';
        window.chatElements.footerText.textContent = 
            `Tugas Data Mining - ${state.messageCount} pesan | ID: ${shortId}`;
    }
}

// ==================== SEND MESSAGE ====================
async function sendMessage() {
    if (!window.chatElements || !window.chatElements.input) return;
    
    const text = window.chatElements.input.value.trim();
    if (!text || state.isTyping) return;
    
    window.chatElements.input.value = '';
    
    // Pesan user langsung di-escape
    addMessageToUI('user', text);
    state.messageCount++;
    updateFooterText();
    
    showTypingIndicator();
    
    try {
        const response = await fetch(CONFIG.WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': state.sessionId
            },
            body: JSON.stringify({
                session_id: state.sessionId,
                message: text,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const reply = await response.text();
        
        setTimeout(() => {
            hideTypingIndicator();
            // Reply dari bot akan diformat dengan aman di addMessageToUI
            addMessageToUI('bot', reply);
            
            if (!state.isChatOpen) {
                state.unreadMessages++;
                updateBadge();
            }
        }, 800);
        
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        
        setTimeout(() => {
            addMessageToUI('bot', 'Maaf, terjadi kesalahan. Silakan coba lagi atau periksa koneksi internet Anda.');
        }, 800);
    }
}

// ==================== TYPING INDICATOR ====================
function showTypingIndicator() {
    if (!window.chatElements || !window.chatElements.messages) return;
    
    state.isTyping = true;
    
    let typingIndicator = document.getElementById('mahadChatbotTyping');
    
    if (!typingIndicator) {
        typingIndicator = document.createElement('div');
        typingIndicator.id = 'mahadChatbotTyping';
        typingIndicator.className = 'mahad-chatbot-typing';
        
        // Template aman (tidak ada user input)
        typingIndicator.innerHTML = `
            <div class="mahad-chatbot-typing-content">
                <div class="mahad-chatbot-typing-dots">
                    <span class="mahad-chatbot-typing-dot"></span>
                    <span class="mahad-chatbot-typing-dot"></span>
                    <span class="mahad-chatbot-typing-dot"></span>
                </div>
                <div class="mahad-chatbot-typing-text">Mengetik...</div>
            </div>
        `;
        
        window.chatElements.messages.appendChild(typingIndicator);
    }
    
    typingIndicator.style.display = 'block';
    window.chatElements.sendButton.disabled = true;
    scrollToBottom();
}

function hideTypingIndicator() {
    state.isTyping = false;
    const typingIndicator = document.getElementById('mahadChatbotTyping');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
    
    if (window.chatElements && window.chatElements.sendButton) {
        window.chatElements.sendButton.disabled = false;
    }
}

// ==================== BADGE MANAGEMENT ====================
function updateBadge() {
    if (state.unreadMessages > 0) {
        elements.messageBadge.textContent = state.unreadMessages;
        elements.messageBadge.style.display = 'flex';
    } else {
        elements.messageBadge.style.display = 'none';
    }
}

function clearBadge() {
    state.unreadMessages = 0;
    updateBadge();
}

// ==================== UPDATE CHAT BUTTON ICON ====================
function updateChatButtonIcon() {
    if (state.isChatOpen) {
        elements.chatButton.innerHTML = '<i class="ysr-logout"></i><span class="badge" id="messageBadge">0</span>';
    } else {
        elements.chatButton.innerHTML = '<i class="ysr-komen"></i><span class="badge" id="messageBadge">0</span>';
    }
    
    elements.messageBadge = document.getElementById('messageBadge');
    updateBadge();
}

// ==================== CHAT WINDOW TOGGLE ====================
function toggleChatWindow() {
    state.isChatOpen = !state.isChatOpen;
    const chatWindow = document.getElementById(CONFIG.CHAT_WINDOW_ID);
    
    if (state.isChatOpen) {
        if (!chatWindow) {
            renderChatWindow();
        }
        
        document.getElementById(CONFIG.CHAT_WINDOW_ID).classList.add('active');
        clearBadge();
        
        updateChatButtonIcon();
        
        setTimeout(() => {
            if (window.chatElements && window.chatElements.input) {
                window.chatElements.input.focus();
            }
        }, 300);
    } else {
        if (chatWindow) {
            chatWindow.classList.remove('active');
        }
        
        updateChatButtonIcon();
    }
}

// ==================== FIX UNCLICKABLE ICON ISSUE ====================
function fixClickableButton() {
    elements.chatButton.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleChatWindow();
    });
    
    elements.chatButton.style.cursor = 'pointer';
    
    elements.chatButton.addEventListener('mousedown', function() {
        this.style.transform = 'scale(0.95)';
    });
    
    elements.chatButton.addEventListener('mouseup', function() {
        this.style.transform = '';
    });
    
    elements.chatButton.addEventListener('mouseleave', function() {
        this.style.transform = '';
    });
    
    elements.chatButton.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.95)';
    });
    
    elements.chatButton.addEventListener('touchend', function() {
        this.style.transform = '';
    });
}

// ==================== INITIALIZE ====================
function init() {
    fixClickableButton();
    
    document.addEventListener('click', (e) => {
        const chatWindow = document.getElementById(CONFIG.CHAT_WINDOW_ID);
        if (state.isChatOpen && chatWindow && 
            !chatWindow.contains(e.target) && 
            !elements.chatButton.contains(e.target)) {
            toggleChatWindow();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.isChatOpen) {
            toggleChatWindow();
        }
    });
    
    state.sessionId = localStorage.getItem(CONFIG.SESSION_KEY);
    if (!state.sessionId) {
        state.sessionId = `mahad_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(CONFIG.SESSION_KEY, state.sessionId);
    }
    
    updateBadge();
    
    console.log('Chatbot Asisten Mahad siap digunakan!');
}

// ==================== START APP ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}