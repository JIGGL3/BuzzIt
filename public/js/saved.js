document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    let currentUser = null;

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

    // ── Search ────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResultsEl = document.getElementById('search-results');
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResultsEl.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { 'Authorization': `Bearer ${token}` } });
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
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-container')) searchResultsEl.style.display = 'none'; });

    // ── Load user ─────────────────────────────────────────
    async function loadUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) { window.location.href = '/login.html'; return; }
            currentUser = await res.json();

            const navAvatar = document.getElementById('profile-initial');
            const sideAvatar = document.getElementById('sidebar-avatar');

            [navAvatar, sideAvatar].forEach(el => {
                if (currentUser.avatar) {
                    el.style.backgroundImage = `url(${currentUser.avatar})`;
                    el.style.backgroundSize = 'cover';
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

    // ── Load Suggestions ──────────────────────────────────
    async function loadSuggestions() {
        try {
            const res = await fetch('/api/users/suggestions/list', { headers: { 'Authorization': `Bearer ${token}` } });
            const users = await res.json();
            const list = document.getElementById('suggestions-list');
            if (!users.length) { list.innerHTML = '<p style="color:var(--text3);font-size:0.82em">No suggestions right now.</p>'; return; }
            list.innerHTML = users.map(u => `
                <div class="user-suggestion">
                    <a href="/user/${u.username}" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex:1;min-width:0">
                        <div class="sug-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">${u.avatar ? '' : u.name[0].toUpperCase()}</div>
                        <div class="user-info"><h4>${u.name}</h4><span>@${u.username}</span></div>
                    </a>
                    <button class="follow-btn" data-id="${u._id}">Follow</button>
                </div>`).join('');
        } catch (err) { console.error(err); }
    }

    // ── Load Saved Posts ──────────────────────────────────
    async function loadSavedPosts() {
        const container = document.getElementById('saved-posts-container');
        const savedIds = JSON.parse(localStorage.getItem('savedPosts') || '[]');

        document.getElementById('saved-count').textContent = `${savedIds.length} saved post${savedIds.length !== 1 ? 's' : ''}`;

        if (!savedIds.length) {
            container.innerHTML = `
                <div class="saved-empty">
                    <i class="fas fa-bookmark"></i>
                    <h3>Nothing saved yet</h3>
                    <p>When you save posts, they'll appear here</p>
                    <a href="/index.html">Browse Feed</a>
                </div>`;
            return;
        }

        try {
            const res = await fetch('/api/posts', { headers: { 'Authorization': `Bearer ${token}` } });
            const allPosts = await res.json();
            const saved = allPosts.filter(p => savedIds.includes(p._id));

            if (!saved.length) {
                container.innerHTML = `
                    <div class="saved-empty">
                        <i class="fas fa-bookmark"></i>
                        <h3>Saved posts not found</h3>
                        <p>These posts may have been deleted</p>
                        <a href="/index.html">Browse Feed</a>
                    </div>`;
                return;
            }

            container.innerHTML = saved.map(post => {
                const avatarStyle = post.user.avatar
                    ? `background-image:url(${post.user.avatar});background-size:cover;background-position:center;color:transparent`
                    : `background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center`;

                return `
                    <div class="post" id="saved-post-${post._id}">
                        <div class="post-header">
                            <a href="/user/${post.user.username || ''}" style="display:flex;align-items:center;gap:12px;text-decoration:none;flex:1">
                                <div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1em;flex-shrink:0;overflow:hidden;${avatarStyle}">
                                    ${post.user.avatar ? '' : post.user.name[0].toUpperCase()}
                                </div>
                                <div class="post-info">
                                    <h3>${post.user.name}</h3>
                                    <span style="color:var(--primary);font-size:0.78em;font-weight:500">@${post.user.username || ''}</span>
                                    <span class="post-time" style="margin-left:6px">· ${formatTime(post.createdAt)}</span>
                                </div>
                            </a>
                            <button class="unsave-btn" data-id="${post._id}">
                                <i class="fas fa-bookmark"></i> Unsave
                            </button>
                        </div>
                        <div class="post-content">
                            ${post.content ? `<p class="post-text">${escapeHTML(post.content)}</p>` : ''}
                            ${post.media
                                ? /\.(mp4|webm|ogg)$/i.test(post.media)
                                    ? `<video controls muted loop class="post-video"><source src="${post.media}" type="video/mp4"></video>`
                                    : `<img src="${post.media}" alt="Post media" class="post-image">`
                                : ''}
                        </div>
                        
                    </div>`;
            }).join('');

            // Unsave buttons
            container.querySelectorAll('.unsave-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.id;
                    const ids = JSON.parse(localStorage.getItem('savedPosts') || '[]');
                    const updated = ids.filter(id => id !== postId);
                    localStorage.setItem('savedPosts', JSON.stringify(updated));
                    document.getElementById(`saved-post-${postId}`).remove();
                    document.getElementById('saved-count').textContent = `${updated.length} saved post${updated.length !== 1 ? 's' : ''}`;
                    if (!updated.length) loadSavedPosts();
                });
            });
        } catch (err) { console.error(err); }
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    function escapeHTML(text) {
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                   .replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/\n/g,'<br>');
    }

    loadUser();
    loadSuggestions();
    loadSavedPosts();
});