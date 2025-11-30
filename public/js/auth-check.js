// Client-side authentication check
// Include this script in protected pages (reception.html, doctor.html, pharmacy.html)

(function () {
    // Check if user is authenticated
    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();

            if (!data.authenticated) {
                // Not authenticated, redirect to login
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // On error, redirect to login for safety
            window.location.href = '/login.html';
        }
    }

    // Add logout button to header if it doesn't exist
    function addLogoutButton() {
        const header = document.querySelector('.site-header .container');
        if (header && !document.getElementById('logout-btn')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logout-btn';
            logoutBtn.className = 'btn btn-sm btn-secondary';
            logoutBtn.innerHTML = '🔒 Logout';
            logoutBtn.style.marginLeft = 'auto';
            logoutBtn.onclick = logout;
            header.appendChild(logoutBtn);
        }
    }

    // Logout function
    async function logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            sessionStorage.clear();
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
            window.location.href = '/login.html';
        }
    }

    // Run auth check on page load
    if (window.location.pathname !== '/login.html' &&
        window.location.pathname !== '/admin-password.html' &&
        window.location.pathname !== '/index.html' &&
        window.location.pathname !== '/') {
        checkAuth();

        // Add logout button when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addLogoutButton);
        } else {
            addLogoutButton();
        }
    }
})();
