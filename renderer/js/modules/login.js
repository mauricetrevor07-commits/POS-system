const Login = {
    async render() {
        const container = document.getElementById('login-container');
        container.style.background = 'radial-gradient(circle at top left, #1e293b 0%, #0f172a 100%)';
        container.innerHTML = `
            <div class="login-card" style="
                width: 100%;
                max-width: 400px;
                padding: 40px;
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                color: #ffffff;
                display: flex;
                flex-direction: column;
                gap: 20px;
            ">
                <div style="text-align: center;">
                    <h2 style="font-weight: 700; font-size: 2rem; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.5px;">Welcome Back</h2>
                    <p style="color: #94a3b8; font-size: 0.95rem;">Point of Sale & Inventory Portal</p>
                </div>
                <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-weight: 500; font-size: 0.85rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Username</label>
                    <input id="loginUsername" class="form-control" placeholder="Enter username" style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #ffffff;
                        padding: 12px 16px;
                        border-radius: 10px;
                        font-size: 1rem;
                        outline: none;
                        transition: all 0.3s ease;
                    " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.25)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none';" />
                </div>
                <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-weight: 500; font-size: 0.85rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Password</label>
                    <input id="loginPassword" type="password" class="form-control" placeholder="••••••••" style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #ffffff;
                        padding: 12px 16px;
                        border-radius: 10px;
                        font-size: 1rem;
                        outline: none;
                        transition: all 0.3s ease;
                    " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.25)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none';" />
                </div>
                <button class="btn btn-primary btn-block" onclick="Login.submit()" style="
                    padding: 14px;
                    font-size: 1rem;
                    font-weight: 600;
                    border-radius: 10px;
                    background: #2563eb;
                    color: #ffffff;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
                " onmouseover="this.style.background='#1d4ed8'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#2563eb'; this.style.transform='none';">Sign In</button>
                <p id="loginError" style="color: #f87171; text-align: center; font-size: 0.9rem; margin-top: 10px; min-height: 20px; font-weight: 500;"></p>
            </div>`;

        // Bind Enter key to submit
        const fields = ['loginUsername', 'loginPassword'];
        fields.forEach(id => {
            document.getElementById(id).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') Login.submit();
            });
        });
    },
    async submit() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) throw new Error('Invalid credentials');
            const data = await res.json();
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);
            location.reload(); // reload to main app
        } catch (e) {
            document.getElementById('loginError').textContent = 'Login failed. Check credentials.';
        }
    }
};