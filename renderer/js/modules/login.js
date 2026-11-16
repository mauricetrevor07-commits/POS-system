const Login = {
    render() {
        const container = document.getElementById('login-container');
        const template = document.getElementById('login-template');

        if (!container) {
            console.error("Login Error: #login-container not found in html");
         return; // Prevent crashing
        }

        if(!template) {
            console.error("Login Error: #login-template not found in html");
            return;
        }

        
        container.innerHTML = '';
        const clone = template.content.cloneNode(true);
        container.appendChild(clone);

        // Attach event listener to the form (Handles both button click and Enter key)
        const form = document.getElementById('loginForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent page reload
                Login.submit();
            });
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