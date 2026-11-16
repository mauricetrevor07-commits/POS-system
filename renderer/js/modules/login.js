const Login = {
    render() {
        const container = document.getElementById('login-container');
        if (!container) return; // Prevent crash if container is missing

        // Clean HTML structure using our Design System classes
        container.innerHTML = `
            <div class="login-wrapper">
                <div class="login-card">
                    <div class="login-header">
                        <h2>Welcome Back</h2>
                        <p>Point of Sale & Inventory Portal</p>
                    </div>
                    
                    <form id="loginForm">
                        <div class="form-group">
                            <label class="form-label" for="loginUsername">Username</label>
                            <input id="loginUsername" type="text" class="form-control" placeholder="Enter username" required autocomplete="username">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="loginPassword">Password</label>
                            <input id="loginPassword" type="password" class="form-control" placeholder="••••••••" required autocomplete="current-password">
                        </div>
                        
                        <button type="submit" id="loginSubmitBtn" class="btn btn-primary btn-block">
                            Sign In
                        </button>
                        
                        <p id="loginError" class="login-error"></p>
                    </form>
                </div>
            </div>
        `;

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

        // Reset error message
        errorMsg.textContent = '';

        // UI Loading State
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Signing in...';
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