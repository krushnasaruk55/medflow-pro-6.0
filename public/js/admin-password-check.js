// Super Admin Password Protection
// Now uses server-side verification

async function checkPassword() {
    const input = document.getElementById('adminPassword').value;
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.querySelector('button[onclick="checkPassword()"]');

    if (!input) {
        errorMsg.textContent = 'Please enter a password';
        errorMsg.style.display = 'block';
        return;
    }

    // Disable button during request
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verifying...';
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: input })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('passwordModal').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
            if (typeof loadData === 'function') {
                loadData(); // Load admin data
            }
        } else {
            errorMsg.textContent = '❌ ' + (data.message || 'Incorrect password');
            errorMsg.style.display = 'block';
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminPassword').focus();
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMsg.textContent = '❌ Connection error';
        errorMsg.style.display = 'block';
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }
}

// Auto-focus password field on load
const pwdInput = document.getElementById('adminPassword');
if (pwdInput) {
    pwdInput.focus();
    // Allow Enter key to submit
    pwdInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
}
