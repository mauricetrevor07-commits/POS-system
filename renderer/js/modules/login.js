const Login = {
    async render() {
        const container = document.getElementById('login-container');
        if (!container) return;

        try {
            const response = await fetch('templates/login.html');
            if (!response.ok) throw new Error('Failed to load login template');

            const html = await response.text();

            container.innerHTML = html;
            container.style.display = 'flex';

            const form = document.getElementById('loginForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    Login.submit();
                });
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color: red;">Error login screen.</p>';
        }
        },
    async submit() {
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const btn = document.getElementById('loginSubmitBtn');
        const errorMsg = document.getElementById('loginError');

        if (!usernameInput || !passwordInput || !btn || !errorMsg) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        errorMsg.textContent = '';
        errorMsg.style.display = 'none';

        // UI Loading State
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = '<span  class="spinner"></span> Signing in...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.status === 401) throw new Error('Invalid username or password.');
            if (!res.ok) throw new Error('Server error. Please try again later.');

            const data = await res.json();
            
            // Save auth data
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);
            localStorage.setItem('userName', data.name || data.username);
            localStorage.setItem('userId', data.id || '');
            
            // Reload to trigger app.js initApp()
            location.reload(); 

        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
            
            // Reset button state
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
            
            // Shake animation for bad password
            const card = document.querySelector('.login-card');
            if (card) {
                card.style.animation = 'shake 0.4s';
                setTimeout(() => card.style.animation = '', 400);
            }
        }
    }
};