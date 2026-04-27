document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const pathParts = window.location.pathname.split('/');
    const username = pathParts[pathParts.length - 1];
    if (!username) { window.location.href = '/index.html'; return; }

    let targetUserId = null;
    let currentUser = null;

    // ── Load current logged-in user ───────────────────────
    try {
        const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            currentUser = await res.json();
            const profileInitial = document.getElementById('profile-initial');
            if (currentUser.avatar) {
                profileInitial.style.backgroundImage = `url(${currentUser.avatar})`;
                profileInitial.style.backgroundSize = 'cover';
                profileInitial.style.color = 'transparent';
                profileInitial.textContent = '';
            } else {
                profileInitial.textContent = currentUser.name[0].toUpperCase();
            }
        }
    } catch (err) { console.error(err); }

    // ── Search bar ────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResults.style.display = 'none'; searchResults.innerHTML = ''; return; }
        searchTimeout = setTimeout(() => doSearch(q), 300);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) searchResults.style.display = 'none';
    });

    async function doSearch(q) {
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await res.json();
            renderSearchResults(users);
        } catch { searchResults.style.display = 'none'; }
    }

    function renderSearchResults(users) {
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

            // Only show follow button if viewing someone else's profile
            const followBtn = document.getElementById('follow-btn');
            if (currentUser && currentUser._id !== data._id) {
                followBtn.style.display = 'inline-block';
                updateFollowBtn(followBtn, data.isFollowing);
                followBtn.addEventListener('click', () => handleFollow(followBtn));
            }

            renderPosts(data.posts);
        } catch (err) {
            console.error(err);
        }
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
        } catch (err) {
            console.error(err);
            btn.textContent = 'Error';
        } finally {
            btn.disabled = false;
        }
    }

    function renderPosts(posts) {
        const container = document.getElementById('up-posts');
        if (!posts.length) {
            container.innerHTML = '<p class="no-posts">No posts yet.</p>';
            return;
        }
        container.innerHTML = posts.map(post => `
            <div class="post">
                <div class="post-header" style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;${post.user.avatar ? `background-image:url(${post.user.avatar});background-size:cover;color:transparent` : ''}">
                        ${post.user.avatar ? '' : post.user.name[0].toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600;font-size:0.95em;color:#1a1a2e">${post.user.name}</div>
                        <div style="font-size:0.78em;color:#667eea">@${post.user.username || ''} · ${formatTime(post.createdAt)}</div>
                    </div>
                </div>
                <div class="post-content">
                    ${post.content ? `<p style="margin-bottom:10px;line-height:1.6;color:#333">${escapeHTML(post.content)}</p>` : ''}
                    ${post.media
                        ? /\.(mp4|webm|ogg)$/i.test(post.media)
                            ? `<video controls muted loop class="post-video" style="width:100%;border-radius:10px;max-height:400px"><source src="${post.media}" type="video/mp4"></video>`
                            : `<img src="${post.media}" alt="Post media" class="post-image" style="width:100%;border-radius:10px;max-height:400px;object-fit:cover">`
                        : ''}
                </div>
                <div style="border-top:1px solid #eee;padding-top:10px;margin-top:10px;display:flex;gap:20px;color:#888;font-size:0.85em">
                    <span><i class="far fa-heart"></i> ${post.likes.length} Likes</span>
                    <span><i class="far fa-comment"></i> ${post.comments.length} Comments</span>
                </div>
            </div>
        `).join('');
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

    loadProfile();
});
