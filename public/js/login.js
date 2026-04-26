document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.form');

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${btn.dataset.tab}-form`) form.classList.add('active');
            });
        });
    });

    // ── Username live validation ──────────────────────────
    const usernameInput = document.getElementById('signup-username');
    const uidHint = document.getElementById('uid-hint');
    let checkTimeout = null;

    usernameInput.addEventListener('input', () => {
        let val = usernameInput.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        usernameInput.value = val;
        clearTimeout(checkTimeout);

        if (!val) { uidHint.textContent = ''; uidHint.className = 'uid-hint'; return; }
        if (val.length < 3) {
            uidHint.textContent = 'At least 3 characters required';
            uidHint.className = 'uid-hint error';
            return;
        }

        uidHint.textContent = 'Checking...';
        uidHint.className = 'uid-hint checking';

        checkTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/check-username?username=${val}`);
                const data = await res.json();
                if (data.available) {
                    uidHint.textContent = `✓ @${val} is available!`;
                    uidHint.className = 'uid-hint available';
                } else {
                    uidHint.textContent = `✗ @${val} is already taken`;
                    uidHint.className = 'uid-hint error';
                }
            } catch {
                uidHint.textContent = '';
            }
        }, 500);
    });

    // ── Login ────────────────────────────────────────────
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = e.target.querySelector('.submit-btn');

        btn.textContent = 'Logging in...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                window.location.href = '/index.html';
            } else {
                alert(data.error || 'Login failed. Please check your credentials.');
            }
        } catch {
            alert('An error occurred. Please try again.');
        } finally {
            btn.textContent = 'Login';
            btn.disabled = false;
        }
    });

    // ── Signup ───────────────────────────────────────────
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const username = document.getElementById('signup-username').value.trim().toLowerCase();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const btn = e.target.querySelector('.submit-btn');

        if (!username || username.length < 3) {
            alert('Username must be at least 3 characters!'); return;
        }
        if (!/^[a-z0-9_]+$/.test(username)) {
            alert('Username can only contain letters, numbers, and underscores!'); return;
        }
        if (password !== confirm) {
            alert('Passwords do not match!'); return;
        }
        if (password.length < 6) {
            alert('Password must be at least 6 characters!'); return;
        }
        if (uidHint.classList.contains('error')) {
            alert('Please choose a different username.'); return;
        }

        btn.textContent = 'Creating account...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Account created! Your username is @${data.username}. Please login.`);
                document.querySelector('[data-tab="login"]').click();
                document.getElementById('signup-form').reset();
                uidHint.textContent = '';
                uidHint.className = 'uid-hint';
            } else {
                alert(data.error || 'Signup failed. Please try again.');
            }
        } catch {
            alert('An error occurred. Please try again.');
        } finally {
            btn.textContent = 'Create Account';
            btn.disabled = false;
        }
    });
});
