const Settings = {
    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = `
            <div class="toolbar"><h2><i class="bi bi-gear"></i> Settings</h2></div>
            <div class="card" style="max-width: 600px;">
                <div class="card-header">WhatsApp Notification</div>
                <div class="card-body" style="padding: 24px;">
                    <p style="color: #64748b; margin-bottom: 16px; font-size: 0.9rem;">
                        When a cashier submits a sale, the payment reference will be sent to this WhatsApp number for admin approval.
                    </p>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">Admin WhatsApp Number</label>
                        <input id="settingsWhatsApp" class="form-control" placeholder="+254700000000"
                            style="padding: 10px 14px; font-size: 1rem; border-radius: 8px; border: 1px solid #cbd5e1;" />
                        <small style="color: #94a3b8; display: block; margin-top: 6px;">Include country code, e.g. +254 for Kenya</small>
                    </div>
                    <button class="btn btn-primary" onclick="Settings.save()" style="padding: 10px 28px;">
                        <i class="bi bi-check-lg"></i> Save Changes
                    </button>
                </div>
            </div>`;
        await this.load();
    },
    async load() {
        try {
            const settings = await DB._fetch('/api/settings');
            const input = document.getElementById('settingsWhatsApp');
            if (settings.admin_whatsapp_number) {
                input.value = settings.admin_whatsapp_number;
            }
        } catch (e) {
            Utils.toast('Failed to load settings', 'error');
        }
    },
    async save() {
        const value = document.getElementById('settingsWhatsApp').value.trim();
        if (!value) return Utils.toast('Please enter a WhatsApp number', 'warning');
        // Basic validation: must start with + and contain digits
        if (!/^\+\d{7,15}$/.test(value)) {
            return Utils.toast('Enter a valid number with country code (e.g. +254712345678)', 'warning');
        }
        try {
            await DB._fetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify({ key: 'admin_whatsapp_number', value })
            });
            // Update the in-memory branch config so checkout uses the new number immediately
            if (window.currentBranch) {
                window.currentBranch.whatsapp = value;
            }
            Utils.toast('WhatsApp number updated successfully', 'success');
        } catch (e) {
            Utils.toast(e.message, 'error');
        }
    }
};
