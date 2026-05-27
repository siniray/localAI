class ChatApp {
    constructor() {
        this.chats = new Map();
        this.currentChatId = 'default';
        this.isGenerating = false;
        this.abortController = null;
        this.nextChatNumber = 2;
        this.reasoningBuffer = '';
        
        this.elements = {
            messagesContainer: document.getElementById('messages'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            stopBtn: document.getElementById('stop-btn'),
            modelSelect: document.getElementById('model-select'),
            streamMode: document.getElementById('stream-mode'),
            newChat: document.getElementById('new-chat'),
            messageCount: document.getElementById('message-count'),
            tokenCount: document.getElementById('token-count'),
            charCount: document.getElementById('char-count'),
            currentModelName: document.getElementById('current-model-name'),
            connectionStatus: document.getElementById('connection-status'),
            chatTabs: document.getElementById('chat-tabs'),
            newTabBtn: document.getElementById('new-tab-btn')
        };
        
        this.init();
    }
    
    init() {
        this.chats.set('default', {
            id: 'default',
            name: 'Чат 1',
            messages: [],
            messageCount: 0,
            totalTokens: 0
        });
        
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.stopBtn.addEventListener('click', () => this.stopGeneration());
        this.elements.newChat.addEventListener('click', () => this.createNewChat());
        this.elements.newTabBtn.addEventListener('click', () => this.createNewChat());
        
        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.elements.userInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeTextarea();
        });
        
        this.elements.modelSelect.addEventListener('change', () => {
            this.updateCurrentModel();
        });
        
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.elements.userInput.value = prompt;
                this.updateCharCount();
                this.autoResizeTextarea();
                this.sendMessage();
            });
        });
        
        this.updateCurrentModel();
        this.updateStats();
        this.setupTabEvents();
        this.checkHealth();
    }
    
    async checkHealth() {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            if (data.lm_studio === 'ok') {
                this.updateConnectionStatus('connected');
                console.log(`✅ LM Studio: ${data.models_count} моделей доступно`);
            } else {
                this.updateConnectionStatus('disconnected');
            }
        } catch {
            this.updateConnectionStatus('disconnected');
        }
    }
    
    setupTabEvents() {
        this.elements.chatTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.chat-tab');
            const closeBtn = e.target.closest('.tab-close');
            
            if (closeBtn) {
                e.stopPropagation();
                const chatId = closeBtn.dataset.chatId;
                this.closeChat(chatId);
            } else if (tab) {
                const chatId = tab.dataset.chatId;
                this.switchToChat(chatId);
            }
        });
    }
    
    createNewChat() {
        const chatId = `chat_${Date.now()}`;
        const chatName = `Чат ${this.nextChatNumber++}`;
        
        this.chats.set(chatId, {
            id: chatId,
            name: chatName,
            messages: [],
            messageCount: 0,
            totalTokens: 0
        });
        
        const tab = document.createElement('div');
        tab.className = 'chat-tab';
        tab.dataset.chatId = chatId;
        tab.innerHTML = `
            <span class="tab-name">${chatName}</span>
            <span class="tab-close" data-chat-id="${chatId}">×</span>
        `;
        this.elements.chatTabs.appendChild(tab);
        
        this.switchToChat(chatId);
        this.showToast(`Создан ${chatName}`);
    }
    
    switchToChat(chatId) {
        if (!this.chats.has(chatId)) return;
        
        this.saveCurrentChat();
        
        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.chatId === chatId);
        });
        
        this.currentChatId = chatId;
        const chat = this.chats.get(chatId);
        
        this.renderMessages(chat.messages);
        this.hideReasoningPanel();
        this.updateStats();
        
        this.elements.userInput.value = '';
        this.updateCharCount();
        
        this.showToast(`Переключено на ${chat.name}`);
    }
    
    closeChat(chatId) {
        if (this.chats.size <= 1) {
            this.showToast('Нельзя закрыть последний чат');
            return;
        }
        
        const tab = document.querySelector(`.chat-tab[data-chat-id="${chatId}"]`);
        if (tab) tab.remove();
        
        this.chats.delete(chatId);
        
        if (this.currentChatId === chatId) {
            const firstChatId = Array.from(this.chats.keys())[0];
            this.switchToChat(firstChatId);
        }
        
        this.showToast('Чат закрыт');
    }
    
    saveCurrentChat() {
        const chat = this.chats.get(this.currentChatId);
        if (!chat) return;
        
        const messages = [];
        const messageElements = this.elements.messagesContainer.querySelectorAll('.message');
        
        messageElements.forEach(el => {
            const isUser = el.classList.contains('user');
            const content = el.querySelector('.message-content').innerHTML;
            const plainContent = this.unformatMessage(content);
            messages.push({
                role: isUser ? 'user' : 'assistant',
                content: plainContent
            });
        });
        
        chat.messages = messages;
    }
    
    renderMessages(messages) {
        this.elements.messagesContainer.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            this.elements.messagesContainer.innerHTML = `
                <div class="welcome-screen">
                    <div class="welcome-icon"><i class="fas fa-comment-dots"></i></div>
                    <h1 class="welcome-title">Новый чат</h1>
                    <p class="welcome-subtitle">Начните общение с AI</p>
                    <div class="quick-actions">
                        <button class="quick-action-btn" data-prompt="Привет! Как дела?">
                            <i class="fas fa-hand-wave"></i> Приветствие
                        </button>
                        <button class="quick-action-btn" data-prompt="Объясни что такое искусственный интеллект простыми словами">
                            <i class="fas fa-lightbulb"></i> Что такое AI?
                        </button>
                        <button class="quick-action-btn" data-prompt="Напиши код функции для расчёта факториала на Python">
                            <i class="fas fa-code"></i> Код на Python
                        </button>
                        <button class="quick-action-btn" data-prompt="Придумай креативную идею для стартапа">
                            <i class="fas fa-rocket"></i> Идея стартапа
                        </button>
                    </div>
                </div>
            `;
            document.querySelectorAll('.quick-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const prompt = btn.dataset.prompt;
                    this.elements.userInput.value = prompt;
                    this.updateCharCount();
                    this.autoResizeTextarea();
                    this.sendMessage();
                });
            });
        } else {
            messages.forEach(msg => {
                this.addMessageToDOM(msg.role, msg.content);
            });
        }
        this.scrollToBottom();
    }
    
    addMessageToDOM(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = this.formatMessage(content);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.elements.messagesContainer.appendChild(messageDiv);
        
        contentDiv.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') hljs.highlightElement(block);
        });
    }
    
    unformatMessage(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
    
    async sendMessage() {
        const content = this.elements.userInput.value.trim();
        if (!content || this.isGenerating) return;
        
        const welcomeScreen = this.elements.messagesContainer.querySelector('.welcome-screen');
        if (welcomeScreen) welcomeScreen.remove();
        
        const chat = this.chats.get(this.currentChatId);
        
        this.addMessage('user', content);
        chat.messages.push({ role: 'user', content });
        chat.messageCount++;
        
        this.elements.userInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        
        const typingIndicator = this.addTypingIndicator();
        this.setGeneratingState(true);
        this.reasoningBuffer = '';
        console.log('Отправляю:', JSON.stringify(chat.messages));
        try {
            if (this.elements.streamMode.checked) {
                await this.streamResponse(typingIndicator, chat);
            } else {
                await this.normalResponse(typingIndicator, chat);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                typingIndicator.remove();
                this.showToast(error.message);
            }
        } finally {
            this.setGeneratingState(false);
            this.updateStats();
        }
        console.log('Отправляю:', JSON.stringify(chat.messages));
    }
    
    async normalResponse(typingIndicator, chat) {
        this.abortController = new AbortController();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chat.messages,
                    model: this.elements.modelSelect.value
                }),
                signal: this.abortController.signal
            });
            
            const data = await response.json();
            typingIndicator.remove();
            
            if (data.success) {
                this.addMessage('assistant', data.response);
                chat.messages.push({ role: 'assistant', content: data.response });
                chat.messageCount++;
                if (data.usage) {
                    chat.totalTokens += data.usage.total_tokens || 0;
                }
            } else {
                this.showToast(data.error);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.showToast(error.message);
            }
            throw error;
        } finally {
            this.abortController = null;
        }
    }
    
    async streamResponse(typingIndicator, chat) {
        this.abortController = new AbortController();
        typingIndicator.remove();
        
        const streamingContent = this.addStreamingMessage();
        let fullContent = '';
        
        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chat.messages,
                    model: this.elements.modelSelect.value
                }),
                signal: this.abortController.signal
            });
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') break;
                        
                        try {
                            const parsed = JSON.parse(dataStr);
                            
                            if (parsed.type === 'error' && parsed.data) {
                                this.showToast(parsed.data);
                                break;
                            }
                            
                            // 🔧 Обработка финального ответа
                            if (parsed.type === 'content' && parsed.data) {
                                if (fullContent === '') {
                                    parsed.data = parsed.data.trimStart();  // 👈 вот здесь
                                }
                                fullContent += parsed.data;
                                this.updateStreamingMessage(streamingContent, fullContent);
                            }
                            // 🔧 Обработка "мыслей" модели
                            else if (parsed.type === 'reasoning' && parsed.data) {
                                this.reasoningBuffer += parsed.data;
                                this.updateReasoningPanel(this.reasoningBuffer);
                            }
                            // Обратная совместимость со старым форматом
                            else if (parsed.content) {
                                if (fullContent === '') {
                                    parsed.content = parsed.content.trimStart();
                                }
                                fullContent += parsed.content;
                                this.updateStreamingMessage(streamingContent, fullContent);
                            }
                        } catch (e) {
                            console.warn('Parse error:', e);
                        }
                    }
                }
            }
            
            if (fullContent) {
                chat.messages.push({ role: 'assistant', content: fullContent });
                chat.messageCount++;
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                if (fullContent) {
                    chat.messages.push({ role: 'assistant', content: fullContent });
                    chat.messageCount++;
                }
            } else {
                this.showToast(error.message);
            }
        } finally {
            this.abortController = null;
        }
    }
    
    addMessage(role, content) {
        this.addMessageToDOM(role, content);
        this.scrollToBottom();
    }
    
    addStreamingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        return contentDiv;
    }
    
    updateStreamingMessage(element, content) {
        element.innerHTML = this.formatMessage(content);
        element.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') hljs.highlightElement(block);
        });
        this.scrollToBottom();
    }
    
    // 🔧 Методы для панели "мыслей"
    updateReasoningPanel(text) {
        let panel = document.getElementById('reasoning-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'reasoning-panel';
            panel.className = 'reasoning-panel';
            panel.innerHTML = `
                <div class="reasoning-header" onclick="document.getElementById('reasoning-panel').classList.toggle('collapsed')">
                    <i class="fas fa-brain"></i>
                    <span>Ход мыслей модели</span>
                    <i class="fas fa-chevron-up toggle-icon"></i>
                </div>
                <div class="reasoning-content"></div>
            `;
            this.elements.messagesContainer.parentNode.insertBefore(panel, this.elements.messagesContainer);
        }
        
        const content = panel.querySelector('.reasoning-content');
        content.textContent = text;
        content.scrollTop = content.scrollHeight;
        panel.classList.remove('collapsed');
    }
    
    hideReasoningPanel() {
        const panel = document.getElementById('reasoning-panel');
        if (panel) panel.remove();
        this.reasoningBuffer = '';
    }
    
    addTypingIndicator() {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'message assistant';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        
        indicatorDiv.appendChild(avatar);
        indicatorDiv.appendChild(typingDiv);
        this.elements.messagesContainer.appendChild(indicatorDiv);
        this.scrollToBottom();
        
        return indicatorDiv;
    }
    
    formatMessage(content) {
        let formatted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        const codeBlocks = [];
        formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const id = `code-block-${codeBlocks.length}`;
            const language = lang || 'plaintext';
            codeBlocks.push({ id, language, code: code.trim() });
            return id;
        });
        
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/\n+$/, '').replace(/\n/g, '<br>');
        
        codeBlocks.forEach(({ id, language, code }) => {
            const escapedCode = this.escapeHtml(code);
            const codeBlock = `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-language">${language}</span>
                        <button class="copy-code-btn" onclick="window.copyCode(this, '${id}')">
                            <i class="far fa-copy"></i> <span>Копировать</span>
                        </button>
                    </div>
                    <pre><code class="language-${language}" id="${id}">${escapedCode}</code></pre>
                </div>`;
            formatted = formatted.replace(id, codeBlock);
        });
        
        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas fa-info-circle"></i><span class="toast-message">${message}</span><i class="fas fa-times toast-close"></i>`;
        
        container.appendChild(toast);
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.setGeneratingState(false);
        this.showToast('Генерация остановлена');
    }
    
    setGeneratingState(generating) {
        this.isGenerating = generating;
        if (generating) {
            this.elements.sendBtn.style.display = 'none';
            this.elements.stopBtn.style.display = 'flex';
            this.elements.userInput.disabled = true;
            this.updateConnectionStatus('generating');
        } else {
            this.elements.sendBtn.style.display = 'flex';
            this.elements.stopBtn.style.display = 'none';
            this.elements.userInput.disabled = false;
            this.elements.userInput.focus();
            this.updateConnectionStatus('connected');
        }
    }
    
    updateConnectionStatus(status) {
        const statusDot = this.elements.connectionStatus.querySelector('.status-dot');
        const statusText = this.elements.connectionStatus.querySelector('.status-text');
        
        if (status === 'generating') {
            statusDot.style.background = '#f59e0b';
            statusText.textContent = 'Генерация...';
        } else if (status === 'connected') {
            statusDot.style.background = '#10b981';
            statusText.textContent = 'Подключено';
        } else {
            statusDot.style.background = '#ef4444';
            statusText.textContent = 'Нет связи';
        }
    }
    
    updateCurrentModel() {
        const selectedOption = this.elements.modelSelect.selectedOptions[0];
        this.elements.currentModelName.textContent = selectedOption.text;
    }
    
    updateCharCount() {
        this.elements.charCount.textContent = this.elements.userInput.value.length;
    }
    
    autoResizeTextarea() {
        this.elements.userInput.style.height = 'auto';
        this.elements.userInput.style.height = Math.min(this.elements.userInput.scrollHeight, 150) + 'px';
    }
    
    updateStats() {
        const chat = this.chats.get(this.currentChatId);
        if (chat) {
            this.elements.messageCount.textContent = chat.messageCount;
            this.elements.tokenCount.textContent = this.formatNumber(chat.totalTokens);
        }
    }
    
    formatNumber(num) {
        return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString();
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 100);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});

// Глобальная функция для копирования кода
window.copyCode = function(button, codeId) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;
    
    navigator.clipboard.writeText(codeElement.textContent).then(() => {
        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i><span>Скопировано!</span>';
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = '<i class="far fa-copy"></i><span>Копировать</span>';
        }, 2000);
    }).catch(err => console.error('Ошибка копирования:', err));
};