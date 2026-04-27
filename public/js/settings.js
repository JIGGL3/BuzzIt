document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    let currentUser = null;

    // ── Toast ─────────────────────────────────────────────
    function showToast(msg, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.className = 'toast', 2800);
    }

    // ── Sidebar navigation ────────────────────────────────
    document.querySelectorAll('.settings-nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`section-${item.dataset.section}`).classList.add('active');
        });
    });

    // ── Logout ────────────────────────────────────────────
    function doLogout() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
    
    document.getElementById('logout-side-btn').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
    document.getElementById('switch-logout-btn').addEventListener('click', doLogout);

    // ── Search bar ────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResults.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const users = await res.json();
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
                `).join('') || '<div class="no-results">No users found</div>';
                searchResults.style.display = 'block';
            } catch { searchResults.style.display = 'none'; }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) searchResults.style.display = 'none';
    });

    // ── Load user ─────────────────────────────────────────
    async function loadUser() {
        try {
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) { doLogout(); return; }
            currentUser = await res.json();
            populateUI();
        } catch (err) { console.error(err); }
    }

    function populateUI() {
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

        // Settings avatar
        const settingsAvatar = document.getElementById('settings-avatar');
        if (currentUser.avatar) {
            settingsAvatar.style.backgroundImage = `url(${currentUser.avatar})`;
            settingsAvatar.style.color = 'transparent';
            settingsAvatar.textContent = '';
        } else {
            settingsAvatar.textContent = currentUser.name[0].toUpperCase();
        }

        // Switch account card
        const caAvatar = document.getElementById('ca-avatar');
        if (currentUser.avatar) {
            caAvatar.style.backgroundImage = `url(${currentUser.avatar})`;
            caAvatar.style.color = 'transparent';
            caAvatar.textContent = '';
        } else {
            caAvatar.textContent = currentUser.name[0].toUpperCase();
        }
        document.getElementById('ca-name').textContent = currentUser.name;
        document.getElementById('ca-username').textContent = `@${currentUser.username}`;

        // Edit profile fields
        document.getElementById('edit-name').value = currentUser.name;
        document.getElementById('edit-username').value = currentUser.username || '';
        document.getElementById('edit-bio').value = currentUser.bio || '';

        // Privacy toggles
        if (currentUser.isPrivate !== undefined) {
            document.getElementById('private-toggle').checked = currentUser.isPrivate;
        }
        if (currentUser.searchable !== undefined) {
            document.getElementById('searchable-toggle').checked = currentUser.searchable;
        }

        loadBlockedUsers();
    }

    // ── Avatar upload ─────────────────────────────────────
    // ── Avatar crop & upload ──────────────────────────
let cropImage = null;
let cropOffsetX = 0, cropOffsetY = 0;
let cropStartX = 0, cropStartY = 0;
let isDragging = false;
let cropZoom = 1;
const CROP_SIZE = 240;
const CANVAS_W = 380, CANVAS_H = 300;

const cropModal = document.getElementById('crop-modal');
const cropCanvas = document.getElementById('crop-canvas');
const ctx = cropCanvas.getContext('2d');
const zoomSlider = document.getElementById('crop-zoom');

cropCanvas.width = CANVAS_W;
cropCanvas.height = CANVAS_H;

document.getElementById('avatar-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        cropImage = new Image();
        cropImage.onload = () => {
            cropZoom = 1;
            zoomSlider.value = 1;
            // Fit image to fill the canvas initially
const scaleX = CANVAS_W / cropImage.width;
const scaleY = CANVAS_H / cropImage.height;
cropZoom = Math.max(scaleX, scaleY);
zoomSlider.value = cropZoom;
zoomSlider.min = cropZoom;
cropOffsetX = (CANVAS_W - cropImage.width * cropZoom) / 2;
cropOffsetY = (CANVAS_H - cropImage.height * cropZoom) / 2;
            cropModal.style.display = 'flex';
            drawCrop();
        };
        cropImage.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

function drawCrop() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.translate(cropOffsetX + cropImage.width * cropZoom / 2, cropOffsetY + cropImage.height * cropZoom / 2);
    ctx.scale(cropZoom, cropZoom);
    ctx.drawImage(cropImage, -cropImage.width / 2, -cropImage.height / 2);
    ctx.restore();
}

zoomSlider.addEventListener('input', () => {
    cropZoom = parseFloat(zoomSlider.value);
    drawCrop();
});

cropCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    cropStartX = e.clientX - cropOffsetX;
    cropStartY = e.clientY - cropOffsetY;
});

cropCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    cropOffsetX = e.clientX - cropStartX;
    cropOffsetY = e.clientY - cropStartY;
    drawCrop();
});

cropCanvas.addEventListener('mouseup', () => isDragging = false);
cropCanvas.addEventListener('mouseleave', () => isDragging = false);

// Touch support
cropCanvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    cropStartX = e.touches[0].clientX - cropOffsetX;
    cropStartY = e.touches[0].clientY - cropOffsetY;
});
cropCanvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    cropOffsetX = e.touches[0].clientX - cropStartX;
    cropOffsetY = e.touches[0].clientY - cropStartY;
    drawCrop();
}, { passive: false });
cropCanvas.addEventListener('touchend', () => isDragging = false);

function closeCropModal() {
    cropModal.style.display = 'none';
    cropImage = null;
}

document.getElementById('crop-cancel').addEventListener('click', closeCropModal);
document.getElementById('crop-cancel-btn').addEventListener('click', closeCropModal);

document.getElementById('crop-save-btn').addEventListener('click', async () => {
    // Extract the circle area from canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = 300;
    outputCanvas.height = 300;
    const outCtx = outputCanvas.getContext('2d');

    const circleX = (CANVAS_W - CROP_SIZE) / 2;
    const circleY = (CANVAS_H - CROP_SIZE) / 2;

    // Draw circle clip
    outCtx.beginPath();
    outCtx.arc(150, 150, 150, 0, Math.PI * 2);
    outCtx.clip();
    outCtx.drawImage(cropCanvas, circleX, circleY, CROP_SIZE, CROP_SIZE, 0, 0, 300, 300);

    outputCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('avatar', blob, 'avatar.png');
        const btn = document.getElementById('crop-save-btn');
        btn.textContent = 'Uploading...';
        btn.disabled = true;
        try {
            const res = await fetch('/api/upload-avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                closeCropModal();
                showToast('Profile photo updated!', 'success');
                await loadUser();
            } else showToast('Upload failed.', 'error');
        } catch { showToast('Upload error.', 'error'); }
        finally { btn.textContent = 'Apply'; btn.disabled = false; }
    }, 'image/png');
});

    // ── Username availability check ───────────────────────
    const usernameInput = document.getElementById('edit-username');
    const usernameHint = document.getElementById('username-hint');
    let usernameTimeout = null;

    usernameInput.addEventListener('input', () => {
        let val = usernameInput.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        usernameInput.value = val;
        clearTimeout(usernameTimeout);

        if (!val || val === currentUser.username) {
            usernameHint.textContent = '';
            usernameHint.className = 'field-hint';
            return;
        }
        if (val.length < 3) {
            usernameHint.textContent = 'At least 3 characters required';
            usernameHint.className = 'field-hint error';
            return;
        }

        usernameHint.textContent = 'Checking...';
        usernameHint.className = 'field-hint';

        usernameTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/check-username?username=${val}`);
                const data = await res.json();
                if (data.available) {
                    usernameHint.textContent = `✓ @${val} is available`;
                    usernameHint.className = 'field-hint success';
                } else {
                    usernameHint.textContent = `✗ @${val} is already taken`;
                    usernameHint.className = 'field-hint error';
                }
            } catch { usernameHint.textContent = ''; }
        }, 500);
    });

    // ── Save profile ──────────────────────────────────────
    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const name = document.getElementById('edit-name').value.trim();
        const username = document.getElementById('edit-username').value.trim().toLowerCase();
        const bio = document.getElementById('edit-bio').value.trim();
        const btn = document.getElementById('save-profile-btn');

        if (!name) { showToast('Name cannot be empty.', 'error'); return; }
        if (username.length < 3) { showToast('Username must be at least 3 characters.', 'error'); return; }
        if (usernameHint.classList.contains('error') && username !== currentUser.username) {
            showToast('Choose a different username.', 'error'); return;
        }

        btn.textContent = 'Saving...'; btn.disabled = true;
        try {
            const res = await fetch('/api/me/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, username, bio })
            });
            if (res.ok) { showToast('Profile updated!', 'success'); await loadUser(); }
            else { const d = await res.json(); showToast(d.error || 'Failed to save.', 'error'); }
        } catch { showToast('Error saving.', 'error'); }
        finally { btn.textContent = 'Save Changes'; btn.disabled = false; }
    });

    // ── Change password ───────────────────────────────────
    document.getElementById('save-password-btn').addEventListener('click', async () => {
        const current = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-password').value;
        const btn = document.getElementById('save-password-btn');

        if (!current || !newPass || !confirm) { showToast('Fill in all fields.', 'error'); return; }
        if (newPass !== confirm) { showToast('New passwords do not match.', 'error'); return; }
        if (newPass.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

        btn.textContent = 'Updating...'; btn.disabled = true;
        try {
            const res = await fetch('/api/me/change-password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword: current, newPassword: newPass })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Password updated!', 'success');
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
            } else {
                showToast(data.error || 'Failed to update password.', 'error');
            }
        } catch { showToast('Error updating password.', 'error'); }
        finally { btn.textContent = 'Update Password'; btn.disabled = false; }
    });

    // ── Save privacy ──────────────────────────────────────
    document.getElementById('save-privacy-btn').addEventListener('click', async () => {
        const isPrivate = document.getElementById('private-toggle').checked;
        const searchable = document.getElementById('searchable-toggle').checked;
        const btn = document.getElementById('save-privacy-btn');

        btn.textContent = 'Saving...'; btn.disabled = true;
        try {
            const res = await fetch('/api/me/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ isPrivate, searchable })
            });
            if (res.ok) showToast('Privacy settings saved!', 'success');
            else showToast('Failed to save.', 'error');
        } catch { showToast('Error saving.', 'error'); }
        finally { btn.textContent = 'Save Privacy Settings'; btn.disabled = false; }
    });

    // ── Blocked users ─────────────────────────────────────
    async function loadBlockedUsers() {
        try {
            const res = await fetch('/api/me/blocked', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;
            const blocked = await res.json();
            const list = document.getElementById('blocked-list');

            if (!blocked.length) {
                list.innerHTML = `<div class="empty-state"><i class="fas fa-user-check"></i><p>You haven't blocked anyone</p></div>`;
                return;
            }

            list.innerHTML = blocked.map(u => `
                <div class="blocked-user-row" id="blocked-${u._id}">
                    <div class="blocked-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;color:transparent` : ''}">
                        ${u.avatar ? '' : u.name[0].toUpperCase()}
                    </div>
                    <div class="blocked-info">
                        <h4>${u.name}</h4>
                        <span>@${u.username}</span>
                    </div>
                    <button class="unblock-btn" data-id="${u._id}">Unblock</button>
                </div>
            `).join('');

            list.querySelectorAll('.unblock-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`/api/users/${btn.dataset.id}/block`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            document.getElementById(`blocked-${btn.dataset.id}`).remove();
                            showToast('User unblocked.', 'success');
                            if (!document.querySelectorAll('.blocked-user-row').length) {
                                list.innerHTML = `<div class="empty-state"><i class="fas fa-user-check"></i><p>You haven't blocked anyone</p></div>`;
                            }
                        }
                    } catch { showToast('Error unblocking.', 'error'); }
                });
            });
        } catch (err) { console.error(err); }
    }

    // ── Delete account ────────────────────────────────────
    document.getElementById('delete-account-btn').addEventListener('click', async () => {
        const password = document.getElementById('delete-password').value;
        const confirmText = document.getElementById('delete-confirm-text').value;
        const btn = document.getElementById('delete-account-btn');

        if (confirmText !== 'DELETE') { showToast('Type DELETE to confirm.', 'error'); return; }
        if (!password) { showToast('Enter your password.', 'error'); return; }

        btn.textContent = 'Deleting...'; btn.disabled = true;
        try {
            const res = await fetch('/api/me/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Account deleted. Goodbye!');
                setTimeout(() => {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                }, 1500);
            } else {
                showToast(data.error || 'Failed to delete.', 'error');
                btn.textContent = 'Permanently Delete Account';
                btn.disabled = false;
            }
        } catch { showToast('Error.', 'error'); btn.textContent = 'Permanently Delete Account'; btn.disabled = false; }
    });

    loadUser();
});