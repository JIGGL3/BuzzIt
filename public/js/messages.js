document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    let currentUser = null;
    let currentConvId = null;
    let currentOtherUser = null;
    let pollInterval = null;

    // ── Dark Mode ─────────────────────────────────────────
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-theme', savedTheme);
    const darkBtn = document.getElementById('dark-mode-toggle');
    darkBtn.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    darkBtn.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        darkBtn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });

    // ── Logout ────────────────────────────────────────────
    document.getElementById('sidebar-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // ── Navbar Search ─────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResultsEl = document.getElementById('search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResultsEl.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const users = await res.json();
                searchResultsEl.innerHTML = users.filter(u => u.username).map(u => `
                    <div class="search-result-item" onclick="window.location.href='/user/${u.username}'">
                        <div class="sr-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">${u.avatar ? '' : u.name[0].toUpperCase()}</div>
                        <div class="sr-info"><span class="sr-name">${u.name}</span><span class="sr-username">@${u.username}</span></div>
                        <span class="sr-followers">${u.followersCount} followers</span>
                    </div>`).join('') || '<div class="no-results">No users found</div>';
                searchResultsEl.style.display = 'block';
            } catch { searchResultsEl.style.display = 'none'; }
        }, 300);
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) searchResultsEl.style.display = 'none';
    });

    // ── Load Current User ─────────────────────────────────
    async function loadUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) { window.location.href = '/login.html'; return; }
            currentUser = await res.json();

            ['profile-initial', 'sidebar-avatar'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (currentUser.avatar) {
                    el.style.backgroundImage = `url(${currentUser.avatar})`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                    el.style.color = 'transparent';
                    el.textContent = '';
                } else {
                    el.textContent = currentUser.name[0].toUpperCase();
                }
            });

            document.getElementById('sidebar-name').textContent = currentUser.name;
            document.getElementById('sidebar-username').textContent = `@${currentUser.username}`;
        } catch (err) { console.error(err); }
    }

    // ── Load Conversations ────────────────────────────────
    async function loadConversations(selectId = null) {
        try {
            const res = await fetch('/api/conversations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const convs = await res.json();
            renderConversations(convs, selectId);
        } catch (err) { console.error(err); }
    }

    function renderConversations(convs, selectId = null) {
        const list = document.getElementById('conv-list');

        if (!convs.length) {
            list.innerHTML = `
                <div class="conv-empty">
                    <i class="fas fa-comment-slash"></i>
                    <p>No conversations yet.<br>Start one!</p>
                </div>`;
            return;
        }

        list.innerHTML = convs.map(conv => {
            const other = conv.participants.find(p => p._id !== currentUser._id);
            if (!other) return '';
            const avatarStyle = other.avatar
                ? `background-image:url(${other.avatar});background-size:cover;color:transparent`
                : '';
            const lastMsg = conv.lastMessage
                ? (conv.lastMessage.sender === currentUser._id ? 'You: ' : '') + conv.lastMessage.content.substring(0, 35) + (conv.lastMessage.content.length > 35 ? '...' : '')
                : 'No messages yet';
            const time = conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : '';
            const isActive = conv._id === currentConvId ? 'active' : '';

            return `
                <div class="conv-item ${isActive}" data-conv-id="${conv._id}" data-user-id="${other._id}">
                    <div class="conv-avatar" style="${avatarStyle}">${other.avatar ? '' : other.name[0].toUpperCase()}</div>
                    <div class="conv-info">
                        <h4>${other.name}</h4>
                        <span class="conv-last-msg">${lastMsg}</span>
                    </div>
                    <div class="conv-meta">
                        <span class="conv-time">${time}</span>
                    </div>
                </div>`;
        }).join('');

        list.querySelectorAll('.conv-item').forEach(item => {
            item.addEventListener('click', () => {
                const convId = item.dataset.convId;
                const userId = item.dataset.userId;
                const conv = convs.find(c => c._id === convId);
                const other = conv.participants.find(p => p._id !== currentUser._id);
                openChat(convId, other);
            });
        });

        if (selectId) {
            const item = list.querySelector(`[data-conv-id="${selectId}"]`);
            if (item) item.click();
        }
    }

    // ── Open Chat ─────────────────────────────────────────
    function openChat(convId, otherUser) {
        currentConvId = convId;
        currentOtherUser = otherUser;

        // Mark active
        document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
        const activeItem = document.querySelector(`[data-conv-id="${convId}"]`);
        if (activeItem) activeItem.classList.add('active');

        // Show chat UI
        document.getElementById('chat-empty').style.display = 'none';
        document.getElementById('chat-header').style.display = 'flex';
        document.getElementById('chat-input-area').style.display = 'block';

        // Set header
        const chatAvatar = document.getElementById('chat-avatar');
        if (otherUser.avatar) {
            chatAvatar.style.backgroundImage = `url(${otherUser.avatar})`;
            chatAvatar.style.backgroundSize = 'cover';
            chatAvatar.style.color = 'transparent';
            chatAvatar.textContent = '';
        } else {
            chatAvatar.style.backgroundImage = 'none';
            chatAvatar.textContent = otherUser.name[0].toUpperCase();
        }
        document.getElementById('chat-name').textContent = otherUser.name;
        document.getElementById('chat-username').textContent = `@${otherUser.username || ''}`;
        document.getElementById('view-profile-btn').href = `/user/${otherUser.username}`;

        // Load messages
        loadMessages(convId);

        // Start polling for new messages
        clearInterval(pollInterval);
        pollInterval = setInterval(() => loadMessages(convId, true), 3000);
    }

    // ── Load Messages ─────────────────────────────────────
    async function loadMessages(convId, silent = false) {
        try {
            const res = await fetch(`/api/conversations/${convId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const messages = await res.json();
            renderMessages(messages, silent);
        } catch (err) { console.error(err); }
    }

    function renderMessages(messages, silent = false) {
        const container = document.getElementById('chat-messages');
        const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

        if (!messages.length) {
            container.innerHTML = `<div class="msg-loading" style="color:var(--text3)">No messages yet. Say hello! 👋</div>`;
            return;
        }

        container.innerHTML = messages.map((msg, i) => {
            const isMine = msg.sender._id === currentUser._id || msg.sender === currentUser._id;
            const showDate = i === 0 || !sameDay(new Date(messages[i - 1].createdAt), new Date(msg.createdAt));

            return `
                ${showDate ? `<div class="msg-date-divider">${formatDate(msg.createdAt)}</div>` : ''}
                <div class="message ${isMine ? 'mine' : 'theirs'}">
                    <div class="msg-bubble">${escapeHTML(msg.content)}</div>
                    <span class="msg-time">${formatMsgTime(msg.createdAt)}</span>
                </div>`;
        }).join('');

        // Auto scroll to bottom
        if (!silent || wasAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }

    // ── Send Message ──────────────────────────────────────
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    async function sendMessage() {
        const content = chatInput.value.trim();
        if (!content || !currentConvId) return;

        sendBtn.disabled = true;
        chatInput.value = '';
        chatInput.style.height = 'auto';

        try {
            await fetch(`/api/conversations/${currentConvId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content })
            });
            await loadMessages(currentConvId);
            await loadConversations();
        } catch (err) { console.error(err); }
        finally { sendBtn.disabled = false; }
    }

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    // ── New Message Modal ─────────────────────────────────
    const modal = document.getElementById('new-msg-modal');
    const modalOverlay = document.getElementById('modal-overlay');
    const userSearchInput = document.getElementById('user-search-input');
    const newMsgResults = document.getElementById('new-msg-results');

    function openModal() {
        modal.style.display = 'flex';
        modalOverlay.classList.add('active');
        userSearchInput.value = '';
        newMsgResults.innerHTML = '<div class="new-msg-empty">Search for a user to message</div>';
        setTimeout(() => userSearchInput.focus(), 100);
    }

    function closeModal() {
        modal.style.display = 'none';
        modalOverlay.classList.remove('active');
    }

    document.getElementById('new-msg-btn').addEventListener('click', openModal);
    document.getElementById('start-chat-btn').addEventListener('click', openModal);
    document.getElementById('close-modal').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    let userSearchTimeout = null;
    userSearchInput.addEventListener('input', () => {
        clearTimeout(userSearchTimeout);
        const q = userSearchInput.value.trim();
        if (!q) {
            newMsgResults.innerHTML = '<div class="new-msg-empty">Search for a user to message</div>';
            return;
        }
        userSearchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const users = await res.json();
                if (!users.length) {
                    newMsgResults.innerHTML = '<div class="new-msg-empty">No users found</div>';
                    return;
                }
                newMsgResults.innerHTML = users.filter(u => u.username).map(u => `
                    <div class="new-msg-user" data-user-id="${u._id}" data-user-name="${u.name}" data-user-username="${u.username}" data-user-avatar="${u.avatar || ''}">
                        <div class="new-msg-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">${u.avatar ? '' : u.name[0].toUpperCase()}</div>
                        <div class="new-msg-info">
                            <h4>${u.name}</h4>
                            <span>@${u.username}</span>
                        </div>
                    </div>`).join('');

                newMsgResults.querySelectorAll('.new-msg-user').forEach(item => {
                    item.addEventListener('click', async () => {
                        const userId = item.dataset.userId;
                        closeModal();
                        await startConversation(userId, {
                            _id: userId,
                            name: item.dataset.userName,
                            username: item.dataset.userUsername,
                            avatar: item.dataset.userAvatar || null
                        });
                    });
                });
            } catch (err) { console.error(err); }
        }, 300);
    });

    // ── Start or Get Conversation ─────────────────────────
    async function startConversation(userId, otherUser) {
        try {
            const res = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ participantId: userId })
            });
            const conv = await res.json();
            await loadConversations(conv._id);
            openChat(conv._id, otherUser);
        } catch (err) { console.error(err); }
    }

    // ── Conv search filter ────────────────────────────────
    document.getElementById('conv-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.conv-item').forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            item.style.display = name.includes(q) ? 'flex' : 'none';
        });
    });

    // ── Helpers ───────────────────────────────────────────
    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        if (days > 6) return d.toLocaleDateString();
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (mins > 0) return `${mins}m`;
        return 'now';
    }

    function formatMsgTime(ts) {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(ts) {
        const d = new Date(ts);
        const now = new Date();
        if (sameDay(d, now)) return 'Today';
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        if (sameDay(d, yesterday)) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function escapeHTML(text) {
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                   .replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/\n/g,'<br>');
    }

    // ── Check for URL param (open conv with user) ─────────
    const urlParams = new URLSearchParams(window.location.search);
    const msgUser = urlParams.get('user');

    // ── Init ──────────────────────────────────────────────
    await loadUser();
    await loadConversations();

    if (msgUser) {
        // Open conversation with specific user from URL param
        try {
            const res = await fetch(`/api/users/${msgUser}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                await startConversation(user._id, user);
            }
        } catch (err) { console.error(err); }
    }

    // Cleanup on page leave
    window.addEventListener('beforeunload', () => clearInterval(pollInterval));
});