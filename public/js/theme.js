// Global dark mode — included on every page
(function() {
    // Apply saved theme immediately (before page renders) to avoid flash
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
})();

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('dark-mode-toggle');
    if (!btn) return;

    const html = document.documentElement;

    function updateIcon(theme) {
        btn.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
        btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }

    updateIcon(html.getAttribute('data-theme'));

    btn.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateIcon(next);
    });
});