document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    let currentUser = null;

    // ── Toast ─────────────────────────────────────────────
    function showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2800);
    }

    // ── Logout ────────────────────────────────────────────
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // ── Search bar ────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResults.style.display = 'none'; return; }
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

    // ── Load current user ─────────────────────────────────
    async function fetchUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) { window.location.href = '/login.html'; return; }
            currentUser = await res.json();
            renderProfile();
            loadUserPosts();
        } catch (err) { console.error(err); }
    }

    function renderProfile() {
        // Navbar avatar
        const navAvatar = document.getElementById('nav-avatar');
        if (currentUser.avatar) {
            navAvatar.style.backgroundImage = `url(${currentUser.avatar})`;
            navAvatar.style.backgroundSize = 'cover';
            navAvatar.style.color = 'transparent';
            navAvatar.textContent = '';
        } else {
            navAvatar.textContent = currentUser.name[0].toUpperCase();
        }

        // Big avatar
        const bigAvatar = document.getElementById('profile-avatar');
        if (currentUser.avatar) {
            bigAvatar.style.backgroundImage = `url(${currentUser.avatar})`;
            bigAvatar.style.color = 'transparent';
            bigAvatar.textContent = '';
        } else {
            bigAvatar.textContent = currentUser.name[0].toUpperCase();
        }

        document.getElementById('profile-name').textContent = currentUser.name;
        document.getElementById('profile-username').textContent = `@${currentUser.username || ''}`;
        document.getElementById('profile-bio-display').textContent = currentUser.bio || '';
        document.getElementById('stat-followers').textContent = currentUser.followersCount || 0;
        document.getElementById('stat-following').textContent = currentUser.followingCount || 0;

        // Pre-fill edit modal
        document.getElementById('edit-name').value = currentUser.name;
        document.getElementById('edit-bio').value = currentUser.bio || '';
    }

    // ── Avatar upload ─────────────────────────────────────
    document.getElementById('avatar-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            showToast('Uploading photo...');
            const res = await fetch('/api/upload-avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                showToast('Profile photo updated!');
                await fetchUser();
            } else {
                showToast('Upload failed. Try again.');
            }
        } catch { showToast('Error uploading photo.'); }
    });

    // ── Edit Profile Modal ────────────────────────────────
    const editModal = document.getElementById('edit-modal');
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
        editModal.style.display = 'flex';
    });
    document.getElementById('modal-close').addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) editModal.style.display = 'none';
    });

    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const name = document.getElementById('edit-name').value.trim();
        const bio = document.getElementById('edit-bio').value.trim();
        if (!name) { showToast('Name cannot be empty.'); return; }

        const btn = document.getElementById('save-profile-btn');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/me/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, bio })
            });
            if (res.ok) {
                editModal.style.display = 'none';
                showToast('Profile updated!');
                await fetchUser();
            } else {
                showToast('Failed to save. Try again.');
            }
        } catch { showToast('Error saving profile.'); }
        finally { btn.textContent = 'Save Changes'; btn.disabled = false; }
    });

    // ── Load posts ────────────────────────────────────────
    async function loadUserPosts() {
        const grid = document.getElementById('profile-posts-grid');
        try {
            const res = await fetch('/api/posts', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;
            const all = await res.json();
            const mine = all.filter(p => p.user._id === currentUser._id);
            document.getElementById('stat-posts').textContent = mine.length;

            if (!mine.length) {
                grid.innerHTML = `<div class="no-posts-msg"><i class="far fa-images"></i>No posts yet. Share something!</div>`;
                return;
            }

            grid.innerHTML = mine.map(post => `
                <div class="profile-post-card">
                    <div class="post-card-header">
                        <span class="post-card-time"><i class="far fa-clock"></i> ${formatTime(post.createdAt)}</span>
                        <button class="post-card-delete" data-id="${post._id}" title="Delete post">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    ${post.content ? `<p class="post-card-text">${escapeHTML(post.content)}</p>` : ''}
                    ${post.media ? `
                        <div class="post-card-media">
                            ${/\.(mp4|webm|ogg)$/i.test(post.media)
                                ? `<video controls muted loop><source src="${post.media}" type="video/mp4"></video>`
                                : `<img src="${post.media}" alt="Post media">`}
                        </div>` : ''}
                    <div class="post-card-footer">
                        <span><i class="far fa-heart"></i> ${post.likes.length} Likes</span>
                        <span><i class="far fa-comment"></i> ${post.comments.length} Comments</span>
                    </div>
                </div>
            `).join('');

            // Delete buttons
            grid.querySelectorAll('.post-card-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this post?')) return;
                    try {
                        const res = await fetch(`/api/posts/${btn.dataset.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) { showToast('Post deleted.'); loadUserPosts(); }
                    } catch { showToast('Error deleting post.'); }
                });
            });

        } catch (err) { console.error(err); }
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

    fetchUser();
});
