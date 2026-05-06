document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // ── Dark Mode ─────────────────────────────────────────
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-theme', savedTheme);
    const darkBtn = document.getElementById('dark-mode-toggle');
    if (darkBtn) {
        darkBtn.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        darkBtn.addEventListener('click', () => {
            const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            darkBtn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }

    // Get username from URL
    const pathParts = window.location.pathname.split('/');
    const username = pathParts[pathParts.length - 1];
    if (!username) { window.location.href = '/index.html'; return; }

    let targetUserId = null;
    let currentUser = null;

    // ── Logout ────────────────────────────────────────────
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        });
    }

    // ── Search bar ────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const q = searchInput.value.trim();
            if (!q) { searchResults.style.display = 'none'; return; }
            searchTimeout = setTimeout(() => doSearch(q), 300);
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            if (searchResults) searchResults.style.display = 'none';
        }
    });

    async function doSearch(q) {
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await res.json();
            if (!users.length) {
                searchResults.innerHTML = '<div class="no-results">No users found</div>';
            } else {
                searchResults.innerHTML = users.filter(u => u.username).map(u => `
                    <div class="search-result-item" onclick="window.location.href='/user/${u.username}'">
                        <div class="sr-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">
                            ${u.avatar ? '' : u.name[0].toUpperCase()}
                        </div>
                        <div class="sr-info">
                            <span class="sr-name">${u.name}</span>
                            <span class="sr-username">@${u.username}</span>
                        </div>
                        <span class="sr-followers">${u.followersCount} followers</span>
                    </div>
                `).join('');
            }
            searchResults.style.display = 'block';
        } catch { searchResults.style.display = 'none'; }
    }

    // ── Load current logged-in user ───────────────────────
    async function loadCurrentUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) { window.location.href = '/login.html'; return; }
            currentUser = await res.json();

            // Nav avatar
            const navAvatar = document.getElementById('profile-initial');
            if (navAvatar) {
                if (currentUser.avatar) {
                    navAvatar.style.backgroundImage = `url(${currentUser.avatar})`;
                    navAvatar.style.backgroundSize = 'cover';
                    navAvatar.style.backgroundPosition = 'center';
                    navAvatar.style.color = 'transparent';
                    navAvatar.textContent = '';
                } else {
                    navAvatar.textContent = currentUser.name[0].toUpperCase();
                }
            }

            // Sidebar avatar
            const sideAvatar = document.getElementById('sidebar-avatar');
            if (sideAvatar) {
                if (currentUser.avatar) {
                    sideAvatar.style.backgroundImage = `url(${currentUser.avatar})`;
                    sideAvatar.style.backgroundSize = 'cover';
                    sideAvatar.style.backgroundPosition = 'center';
                    sideAvatar.style.color = 'transparent';
                    sideAvatar.textContent = '';
                } else {
                    sideAvatar.textContent = currentUser.name[0].toUpperCase();
                }
            }

            const sidebarName = document.getElementById('sidebar-name');
            const sidebarUsername = document.getElementById('sidebar-username');
            if (sidebarName) sidebarName.textContent = currentUser.name;
            if (sidebarUsername) sidebarUsername.textContent = `@${currentUser.username || ''}`;
        } catch (err) { console.error(err); }
    }

    // ── Load suggestions ──────────────────────────────────
    async function loadSuggestions() {
        try {
            const res = await fetch('/api/users/suggestions/list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await res.json();
            const list = document.getElementById('suggestions-list');
            if (!list) return;
            if (!users.length) {
                list.innerHTML = '<p style="color:var(--text3);font-size:0.82em;padding:8px 0">No suggestions right now.</p>';
                return;
            }
            list.innerHTML = users.map(u => `
                <div class="user-suggestion">
                    <a href="/user/${u.username}" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex:1;min-width:0">
                        <div class="sug-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">${u.avatar ? '' : u.name[0].toUpperCase()}</div>
                        <div class="user-info" style="min-width:0">
                            <h4 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</h4>
                            <span>@${u.username}</span>
                        </div>
                    </a>
                    <button class="follow-btn" data-id="${u._id}">Follow</button>
                </div>
            `).join('');

            list.querySelectorAll('.follow-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    try {
                        const res = await fetch(`/api/users/${btn.dataset.id}/follow`, {
                            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await res.json();
                        btn.textContent = data.isFollowing ? 'Unfollow' : 'Follow';
                    } catch (err) { console.error(err); }
                    finally { btn.disabled = false; }
                });
            });
        } catch (err) { console.error(err); }
    }

    // ── Load profile ──────────────────────────────────────
    async function loadProfile() {
        try {
            const res = await fetch(`/api/users/${username}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                document.getElementById('up-name').textContent = 'User not found';
                return;
            }
            const data = await res.json();
            targetUserId = data._id;

            // Avatar
            const avatarEl = document.getElementById('up-avatar');
            if (data.avatar) {
                avatarEl.style.backgroundImage = `url(${data.avatar})`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.color = 'transparent';
                avatarEl.textContent = '';
            } else {
                avatarEl.textContent = data.name[0].toUpperCase();
            }

            document.getElementById('up-name').textContent = data.name;
            document.getElementById('up-username').textContent = `@${data.username}`;
            document.getElementById('up-bio').textContent = data.bio || '';
            document.getElementById('up-followers-count').textContent = data.followersCount;
            document.getElementById('up-following-count').textContent = data.followingCount;
            document.getElementById('up-posts-count').textContent = data.posts.length;
            document.title = `BuzzIT - ${data.name}`;

            // Follow + Message buttons
            const followBtn = document.getElementById('follow-btn');
            const msgBtn = document.getElementById('msg-btn');

            if (currentUser && currentUser._id !== data._id) {
                followBtn.style.display = 'inline-block';
                updateFollowBtn(followBtn, data.isFollowing);
                followBtn.addEventListener('click', () => handleFollow(followBtn));

                if (msgBtn) {
                    msgBtn.style.display = 'inline-flex';
                    msgBtn.addEventListener('click', () => {
                        window.location.href = `/messages.html?user=${data.username}`;
                    });
                }
            }

            renderPosts(data.posts);
        } catch (err) { console.error(err); }
    }

    function updateFollowBtn(btn, isFollowing) {
        if (isFollowing) {
            btn.textContent = 'Unfollow';
            btn.classList.add('following');
        } else {
            btn.textContent = 'Follow';
            btn.classList.remove('following');
        }
    }

    async function handleFollow(btn) {
        if (!targetUserId) return;
        try {
            btn.disabled = true;
            btn.textContent = '...';
            const res = await fetch(`/api/users/${targetUserId}/follow`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Follow failed');
            const data = await res.json();
            updateFollowBtn(btn, data.isFollowing);
            document.getElementById('up-followers-count').textContent = data.followersCount;
        } catch (err) { console.error(err); }
        finally { btn.disabled = false; }
    }

    function renderPosts(posts) {
        const container = document.getElementById('up-posts');
        if (!posts.length) {
            container.innerHTML = '<p class="no-posts">No posts yet.</p>';
            return;
        }
        container.innerHTML = posts.map(post => {
            const avatarStyle = post.user.avatar
                ? `background-image:url(${post.user.avatar});background-size:cover;background-position:center;color:transparent`
                : `background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center`;
            return `
            <div class="post">
                <div class="post-header" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.95em;flex-shrink:0;overflow:hidden;${avatarStyle}">
                        ${post.user.avatar ? '' : post.user.name[0].toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600;font-size:0.92em;color:var(--text)">${post.user.name}</div>
                        <div style="font-size:0.75em;color:var(--primary)">@${post.user.username || ''} <span style="color:var(--text3);margin-left:4px">· ${formatTime(post.createdAt)}</span></div>
                    </div>
                </div>
                ${post.content ? `<p style="font-size:0.9em;line-height:1.6;color:var(--text);margin-bottom:10px;white-space:pre-wrap">${escapeHTML(post.content)}</p>` : ''}
                ${post.media
                    ? /\.(mp4|webm|ogg)$/i.test(post.media)
                        ? `<video controls muted loop class="post-video" style="width:100%;border-radius:10px;max-height:400px;margin-bottom:10px"><source src="${post.media}" type="video/mp4"></video>`
                        : `<img src="${post.media}" alt="Post media" class="post-image" style="width:100%;border-radius:10px;max-height:400px;object-fit:cover;margin-bottom:10px">`
                    : ''}
                <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;gap:16px;color:var(--text3);font-size:0.82em">
                    <span><i class="far fa-heart"></i> ${post.likes.length} Likes</span>
                    <span><i class="far fa-comment"></i> ${post.comments.length} Comments</span>
                </div>
            </div>`;
        }).join('');
    }

    function escapeHTML(text) {
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                   .replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/\n/g,'<br>');
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

    await loadCurrentUser();
    await loadProfile();
    loadSuggestions();
});