document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    let currentUser = null;
    let currentPostId = null;

    // ── Dark Mode ─────────────────────────────────────────
    const html = document.documentElement;
    const darkBtn = document.getElementById('dark-mode-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-theme', savedTheme);
    updateDarkIcon(savedTheme);

    darkBtn.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateDarkIcon(next);
    });

    function updateDarkIcon(theme) {
        darkBtn.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }

    // ── Comment Panel ─────────────────────────────────────
    const commentPanel = document.querySelector('.comment-panel');
    const overlay = document.querySelector('.overlay');

    function openCommentPanel(postId) {
        currentPostId = postId;
        commentPanel.classList.add('active');
        overlay.classList.add('active');
        loadComments(postId);
    }

    function closeCommentPanel() {
        commentPanel.classList.remove('active');
        overlay.classList.remove('active');
        currentPostId = null;
    }

    document.querySelector('.close-comments').addEventListener('click', closeCommentPanel);
    overlay.addEventListener('click', closeCommentPanel);

    const commentTextarea = commentPanel.querySelector('textarea');
    const submitCommentBtn = commentPanel.querySelector('.submit-comment');

    submitCommentBtn.addEventListener('click', async () => {
        const content = commentTextarea.value.trim();
        if (!content || !currentPostId) return;
        try {
            const res = await fetch(`/api/posts/${currentPostId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                commentTextarea.value = '';
                await loadComments(currentPostId);
                await loadPosts();
            }
        } catch (err) { console.error(err); }
    });

    async function loadComments(postId) {
        try {
            const res = await fetch(`/api/posts/${postId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const post = await res.json(); displayComments(post.comments); }
        } catch (err) { console.error(err); }
    }

    function displayComments(comments) {
        const commentContent = commentPanel.querySelector('.comment-panel-content');
        if (!comments.length) {
            commentContent.innerHTML = '<p class="no-comments">No comments yet. Be the first!</p>';
            return;
        }
        commentContent.innerHTML = comments.map(c => `
            <div class="comment">
                <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85em;flex-shrink:0;overflow:hidden;${c.user.avatar ? `background-image:url(${c.user.avatar});background-size:cover;color:transparent` : ''}">
                    ${c.user.avatar ? '' : c.user.name[0].toUpperCase()}
                </div>
                <div class="comment-content">
                    <h4>${c.user.name} <span style="color:var(--text3);font-weight:400;font-size:0.8em">@${c.user.username || ''}</span></h4>
                    <p>${escapeHTML(c.content)}</p>
                    <span class="comment-time">${formatTime(c.createdAt)}</span>
                </div>
            </div>
        `).join('');
    }

    // ── Sidebar logout ────────────────────────────────────
    document.getElementById('sidebar-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // ── Search ────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResults.style.display = 'none'; return; }
        searchTimeout = setTimeout(() => doSearch(q), 300);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) searchResults.style.display = 'block';
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

    // ── Suggested Users ───────────────────────────────────
    async function loadSuggestions() {
        try {
            const res = await fetch('/api/users/suggestions/list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await res.json();
            const list = document.getElementById('suggestions-list');
            if (!users.length) {
                list.innerHTML = '<p style="color:var(--text3);font-size:0.82em;padding:8px 0">No suggestions right now.</p>';
                return;
            }
            list.innerHTML = users.map(u => `
                <div class="user-suggestion" id="sug-${u._id}">
                    <a href="/user/${u.username}" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex:1;min-width:0">
                        <div class="sug-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">
                            ${u.avatar ? '' : u.name[0].toUpperCase()}
                        </div>
                        <div class="user-info" style="min-width:0">
                            <h4 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</h4>
                            <span>@${u.username}</span>
                        </div>
                    </a>
                    <button class="follow-btn" data-id="${u._id}">Follow</button>
                </div>
            `).join('');

            list.querySelectorAll('.follow-btn').forEach(btn => {
                btn.addEventListener('click', () => handleSuggestionFollow(btn));
            });
        } catch (err) { console.error(err); }
    }

    async function handleSuggestionFollow(btn) {
        const userId = btn.dataset.id;
        try {
            btn.disabled = true;
            const res = await fetch(`/api/users/${userId}/follow`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.isFollowing) {
                btn.textContent = 'Unfollow';
                btn.style.background = 'transparent';
                btn.style.color = 'var(--primary)';
                btn.style.border = '1.5px solid var(--primary)';
            } else {
                btn.textContent = 'Follow';
                btn.style.background = 'var(--primary)';
                btn.style.color = 'white';
                btn.style.border = 'none';
            }
        } catch (err) { console.error(err); }
        finally { btn.disabled = false; }
    }

    // ── Create Post ───────────────────────────────────────
    const postTextarea = document.getElementById('post-textarea');
    const postBtn = document.getElementById('post-btn');
    const uploadMediaBtn = document.querySelector('.upload-media');
    const mediaPreview = document.getElementById('cp-media-preview');
    let currentMediaFile = null;

    uploadMediaBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            currentMediaFile = file;
            mediaPreview.textContent = `📎 ${file.name.substring(0, 22)}`;
        };
        input.click();
    });

    postBtn.addEventListener('click', async () => {
        const content = postTextarea.value.trim();
        if (!content && !currentMediaFile) return;
        const formData = new FormData();
        formData.append('content', content);
        if (currentMediaFile) formData.append('media', currentMediaFile);

        postBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
        postBtn.disabled = true;
        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                postTextarea.value = '';
                currentMediaFile = null;
                mediaPreview.textContent = '';
                loadPosts();
            }
        } catch (err) { console.error(err); }
        finally { postBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post'; postBtn.disabled = false; }
    });

    // ── Load Posts ────────────────────────────────────────
    async function loadPosts() {
        try {
            const res = await fetch('/api/posts', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const posts = await res.json();
                displayPosts(posts);
                setupVideoObservers();
            }
        } catch (err) { console.error(err); }
    }

    function displayPosts(posts) {
        const container = document.querySelector('.posts-container');
        container.innerHTML = '';
        if (!posts.length) {
            container.innerHTML = `
                <div style="text-align:center;padding:50px 20px;color:var(--text3)">
                    <i class="fas fa-wind" style="font-size:2.5em;margin-bottom:12px;display:block"></i>
                    <p>No posts yet. Be the first to buzz!</p>
                </div>`;
            return;
        }
        posts.forEach(post => container.appendChild(createPostElement(post)));
    }

    // ── Current User ──────────────────────────────────────
    async function fetchCurrentUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { currentUser = await res.json(); updateUI(); }
        } catch (err) { console.error(err); }
    }

    function updateUI() {
        if (!currentUser) return;

        const navAvatar = document.getElementById('profile-initial');
        setAvatar(navAvatar, currentUser, true);

        const cpAvatar = document.getElementById('cp-avatar');
        setAvatar(cpAvatar, currentUser, true);

        const sideAvatar = document.getElementById('sidebar-avatar');
        setAvatar(sideAvatar, currentUser, true);
        document.getElementById('sidebar-name').textContent = currentUser.name;
        document.getElementById('sidebar-username').textContent = `@${currentUser.username || ''}`;
    }

    function setAvatar(el, user, useBackground = false) {
        if (!el || !user) return;
        if (user.avatar) {
            if (useBackground) {
                el.style.backgroundImage = `url(${user.avatar})`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.style.color = 'transparent';
                el.textContent = '';
            } else {
                el.style.backgroundImage = `url(${user.avatar})`;
                el.style.backgroundSize = 'cover';
                el.style.color = 'transparent';
                el.textContent = '';
            }
        } else {
            el.style.backgroundImage = 'none';
            el.style.color = 'white';
            el.textContent = user.name[0].toUpperCase();
        }
    }

    // ── Post Element ──────────────────────────────────────
    function createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';

        const isOwn = currentUser && post.user && post.user._id === currentUser._id;
        const isLiked = currentUser && post.likes.includes(currentUser._id);
        const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '[]');
        const isSaved = savedPosts.includes(post._id);

        const avatarStyle = post.user.avatar
            ? `background-image:url(${post.user.avatar});background-size:cover;background-position:center;color:transparent`
            : `background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center`;

        postDiv.innerHTML = `
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
                <div class="post-top-actions">
                    <button class="post-icon-btn save-btn ${isSaved ? 'saved' : ''}" title="${isSaved ? 'Unsave' : 'Save'} post">
                        <i class="${isSaved ? 'fas' : 'far'} fa-bookmark"></i>
                    </button>
                    ${isOwn ? `<button class="post-icon-btn delete-btn" title="Delete post"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
            <div class="post-content">
                ${post.content ? `<p class="post-text">${escapeHTML(post.content)}</p>` : ''}
                ${post.media
                    ? /\.(mp4|webm|ogg)$/i.test(post.media)
                        ? `<video controls muted loop class="post-video"><source src="${post.media}" type="video/mp4"></video>`
                        : `<img src="${post.media}" alt="Post media" class="post-image">`
                    : ''}
            </div>
            <div class="post-actions">
                <button class="action-btn like ${isLiked ? 'liked' : ''}" data-post-id="${post._id}"><i class="${isLiked ? 'fas' : 'far'} fa-heart"></i><span>${post.likes.length}</span></button>
                <button class="action-btn comment" data-post-id="${post._id}"><i class="far fa-comment"></i><span>${post.comments.length}</span></button>
                <button class="action-btn share" data-post-id="${post._id}"><i class="far fa-share-square"></i><span>Share</span></button>
            </div>
        `;

        postDiv.querySelector('.like').addEventListener('click', () => handleLike(post._id));
        postDiv.querySelector('.comment').addEventListener('click', () => openCommentPanel(post._id));
        postDiv.querySelector('.share').addEventListener('click', () => handleShare(post._id));

        postDiv.querySelector('.save-btn').addEventListener('click', () => handleSave(post._id, postDiv.querySelector('.save-btn')));

        const deleteBtn = postDiv.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Delete this post?')) return;
                try {
                    const res = await fetch(`/api/posts/${post._id}`, {
                        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) loadPosts();
                } catch (err) { console.error(err); }
            });
        }

        return postDiv;
    }

    function setupVideoObservers() {
        const videos = document.querySelectorAll('.post-video');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                entry.isIntersecting ? entry.target.play().catch(() => {}) : entry.target.pause();
            });
        }, { threshold: 0.4 });
        videos.forEach(v => observer.observe(v));
    }

    async function handleLike(postId) {
        try {
            const res = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) loadPosts();
        } catch (err) { console.error(err); }
    }

    // ── Save ──────────────────────────────────────────────
    function handleSave(postId, btn) {
        const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '[]');
        const idx = savedPosts.indexOf(postId);
        if (idx === -1) {
            savedPosts.push(postId);
            btn.classList.add('saved');
            btn.querySelector('i').className = 'fas fa-bookmark';
            showToast('Post saved!');
        } else {
            savedPosts.splice(idx, 1);
            btn.classList.remove('saved');
            btn.querySelector('i').className = 'far fa-bookmark';
            showToast('Post unsaved');
        }
        localStorage.setItem('savedPosts', JSON.stringify(savedPosts));
    }

    function handleShare(postId) {
        const url = `${window.location.protocol}//${window.location.host}/post/${postId}`;
        navigator.clipboard.writeText(url)
            .then(() => showToast('Link copied!'))
            .catch(() => showToast('Could not copy link'));
    }

    // ── Toast ─────────────────────────────────────────────
    function showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
                position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);
                background:#1a1a2e;color:white;padding:10px 22px;border-radius:25px;
                font-size:0.85em;opacity:0;transition:all 0.3s;z-index:9999;
                pointer-events:none;white-space:nowrap;font-family:'Poppins',sans-serif;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2500);
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

    // ── Init ──────────────────────────────────────────────
    fetchCurrentUser();
    loadPosts();
    loadSuggestions();
});