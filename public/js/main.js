document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    let currentUser = null;
    let currentPostId = null;

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
            commentContent.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
            return;
        }
        commentContent.innerHTML = comments.map(c => `
            <div class="comment">
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;${c.user.avatar ? `background-image:url(${c.user.avatar});background-size:cover;color:transparent` : ''}">
                    ${c.user.avatar ? '' : c.user.name[0].toUpperCase()}
                </div>
                <div class="comment-content">
                    <h4>${c.user.name} <span style="color:#888;font-weight:400;font-size:0.8em">@${c.user.username || ''}</span></h4>
                    <p>${c.content}</p>
                    <span class="comment-time">${formatTime(c.createdAt)}</span>
                </div>
            </div>
        `).join('');
    }

    // ── Nav buttons ───────────────────────────────────────
    document.getElementById('profile-btn').addEventListener('click', (e) => {
        e.preventDefault(); window.location.href = 'profile.html';
    });
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault(); localStorage.removeItem('token'); window.location.href = '/login.html';
    });

    // ── Search ────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResults.style.display = 'none'; searchResults.innerHTML = ''; return; }
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
                list.innerHTML = '<p style="color:#888;font-size:0.85em;">No suggestions right now.</p>';
                return;
            }
            list.innerHTML = users.map(u => `
                <div class="user-suggestion" id="sug-${u._id}">
                    <a href="/user/${u.username}" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex:1">
                        <div class="sug-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">
                            ${u.avatar ? '' : u.name[0].toUpperCase()}
                        </div>
                        <div class="user-info">
                            <h4>${u.name}</h4>
                            <span>@${u.username}</span>
                        </div>
                    </a>
                    <button class="follow-btn" data-id="${u._id}" data-following="false">Follow</button>
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
                btn.style.background = 'white';
                btn.style.color = '#667eea';
                btn.style.border = '1px solid #667eea';
                btn.dataset.following = 'true';
            } else {
                btn.textContent = 'Follow';
                btn.style.background = '#667eea';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.dataset.following = 'false';
            }
        } catch (err) { console.error(err); }
        finally { btn.disabled = false; }
    }

    // ── Create post ───────────────────────────────────────
    const createPostForm = document.querySelector('.create-post-form');
    const postTextarea = createPostForm.querySelector('textarea');
    const postBtn = createPostForm.querySelector('.post-btn');
    const uploadMediaBtn = createPostForm.querySelector('.upload-media');
    let currentMediaFile = null;

    uploadMediaBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            currentMediaFile = file;
            uploadMediaBtn.innerHTML = `<i class="fas fa-check"></i> ${file.name.substring(0,20)}`;
        };
        input.click();
    });

    postBtn.addEventListener('click', async () => {
        const content = postTextarea.value.trim();
        if (!content && !currentMediaFile) return;
        const formData = new FormData();
        formData.append('content', content);
        if (currentMediaFile) formData.append('media', currentMediaFile);

        postBtn.textContent = 'Posting...';
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
                uploadMediaBtn.innerHTML = '<i class="fas fa-image"></i> Add Photo/Video';
                loadPosts();
            }
        } catch (err) { console.error(err); }
        finally { postBtn.textContent = 'Post'; postBtn.disabled = false; }
    });

    // ── Load posts ────────────────────────────────────────
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
        const postsContainer = document.querySelector('.posts-container');
        postsContainer.innerHTML = '';
        posts.forEach(post => postsContainer.appendChild(createPostElement(post)));
    }

    // ── Current user ──────────────────────────────────────
    async function fetchCurrentUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { currentUser = await res.json(); updateProfileIcon(); }
        } catch (err) { console.error(err); }
    }

    function updateProfileIcon() {
        const profileInitial = document.getElementById('profile-initial');
        if (!profileInitial || !currentUser) return;
        if (currentUser.avatar) {
            profileInitial.style.backgroundImage = `url(${currentUser.avatar})`;
            profileInitial.style.backgroundSize = 'cover';
            profileInitial.style.color = 'transparent';
            profileInitial.textContent = '';
        } else {
            profileInitial.style.backgroundImage = 'none';
            profileInitial.style.color = '#fff';
            profileInitial.textContent = currentUser.name[0].toUpperCase();
        }
    }

    // ── Post element ──────────────────────────────────────
    function createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';

        const isOwn = currentUser && post.user && post.user._id === currentUser._id;
        const deleteBtnHTML = isOwn
            ? `<button class="action-btn delete" data-post-id="${post._id}"><i class="fas fa-trash"></i></button>`
            : '';

        const avatarStyle = post.user.avatar
            ? `background-image:url(${post.user.avatar});background-size:cover;color:transparent`
            : `background:linear-gradient(135deg,#667eea,#764ba2);color:white`;

        postDiv.innerHTML = `
            <div class="post-header">
                <a href="/user/${post.user.username || ''}" style="display:flex;align-items:center;gap:10px;text-decoration:none">
                    <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1em;flex-shrink:0;${avatarStyle}">
                        ${post.user.avatar ? '' : post.user.name[0].toUpperCase()}
                    </div>
                    <div class="post-info">
                        <h3 style="color:#1a1a2e">${post.user.name}</h3>
                        <span style="color:#667eea;font-size:0.8em">@${post.user.username || ''}</span>
                        <span class="post-time" style="margin-left:6px">${formatTime(post.createdAt)}</span>
                    </div>
                </a>
                ${deleteBtnHTML}
            </div>
            <div class="post-content">
                <p class="post-text">${escapeHTML(post.content || '')}</p>
                ${post.media
                    ? /\.(mp4|webm|ogg)$/i.test(post.media)
                        ? `<video controls autoplay muted loop class="post-video"><source src="${post.media}" type="video/mp4"></video>`
                        : `<img src="${post.media}" alt="Post media" class="post-image">`
                    : ''}
            </div>
            <div class="post-actions">
                <button class="action-btn like" data-post-id="${post._id}">
                    <i class="far fa-heart"></i>
                    <span>${post.likes.length} Like</span>
                </button>
                <button class="action-btn comment" data-post-id="${post._id}">
                    <i class="far fa-comment"></i>
                    <span>${post.comments.length} Comment</span>
                </button>
                <button class="action-btn share" data-post-id="${post._id}">
                    <i class="far fa-share-square"></i>
                    <span>Share</span>
                </button>
            </div>
        `;

        postDiv.querySelector('.like').addEventListener('click', () => handleLike(post._id));
        postDiv.querySelector('.comment').addEventListener('click', () => openCommentPanel(post._id));
        postDiv.querySelector('.share').addEventListener('click', () => handleShare(post._id));

        const deleteBtn = postDiv.querySelector('.delete');
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
                entry.isIntersecting ? entry.target.play() : entry.target.pause();
            });
        }, { threshold: 0.3 });
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

    function handleShare(postId) {
        const shareUrl = `${window.location.protocol}//${window.location.host}/post/${postId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => alert('Post link copied to clipboard!'))
            .catch(() => alert('Failed to copy link.'));
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
