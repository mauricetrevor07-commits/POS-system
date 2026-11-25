const Settings = {
    allowedIpsList: [],
    currentIp:'',

    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

        try {
            const response = await fetch('/templates/settings.html');
            if (!response.ok) throw new Error('Settings template not found');

            container.innerHTML = await response.text();

            this.attachEvents();
            await this.loadIpSettings();

        } catch (error) {
            console.error('Failed to render settings:', error);
            container.innerHTML = `<p style="color:red; padding:20px;">Failed to load settings: ${error.message}</p>`;
        }
    },

    attachEvents() {
        // IP Security Events
        document.getElementById('btnAddCurrentIp')?.addEventListener('click', () => this.addCurrentIp());
        document.getElementById('btnAddIp')?.addEventListener('click', () => this.addIpManual());
        document.getElementById('btnSaveIpSettings')?.addEventListener('click', () => this.saveSettings());
        
        // WhatsApp Events
        document.getElementById('btnSaveWhatsApp')?.addEventListener('click', () => this.saveWhatsApp());

        // Matrix Event
        document.getElementById('btnOpenMatrix')?.addEventListener('click', () => {
            window.App.navigate('products'); 
            setTimeout(() => Products.switchView('matrix'), 100);
        });
    },


    // --- IP SECURITY ---
    async loadIpSettings() {
        try {
            const data = await DB._fetch('/api/settings/ip-security');

            this.currentIp = data.current_ip;
            this.allowedIps = data.allowed_ips || [];

            document.getElementById('currentClientIp').textContent = this.currentIp;
            document.getElementById('ipModeAllowAll').checked = !data.enabled;
            document.getElementById('ipModeRestrict').checked = data.enabled;
            
            const pill = document.getElementById('ipStatusPill');
            if (data.enabled) {
                pill.textContent = 'Restricted mode active';
                pill.className = 'badge badge-danger';
            } else {
                pill.textContent = 'Allow all mode';
                pill.className = 'badge badge-success';
            }

            this.renderIpList();
        } catch (e) {
            console.error('Failed to load IP settings: ' + e.message, 'danger');
        }
    },

    renderIpList() {
        const tbody = document.getElementById('allowedIpsTableBody');
        if (!tbody) return;

        if (!this.allowedIps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No IPs whitelisted yet. Anyone can access if mode is allow all.</td></tr>';
            return;
        }

        tbody.innerHTML = this.allowedIps.map((item, index) => `
        <tr>
        <td><strong>${Utils.escapeHtml(item.label || 'Unknown')}</strong></td>
        <td><code>${Utils.escapeHtml(item.ip)}</code></td>
        <td>${new Date(item.added_at).toLocaleString()}</td>
        <td class="text-right">
        <button class="btn btn-sm btn-danger" data-remove="${index}"><i class="bi bi-trash"></i></button>
        </td>
        <tr>
        `).join('');

        tbody.querySelectorAll('button[data-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.closest('button').dataset.remove);
                this.allowedIps.splice(idx, 1);
                this.renderIpList();
            });
        });
    },

    addCurrentIp() {
        if (!this.allowedIps.some(i => i.ip === this.currentIp)) {

        return Utils.toast('Your current Ip is already whitelisted', 'warning');
        }

        this.allowedIps.push({
            ip: this.currentIp,
            label: 'My Current Device',
            added_at: new Date().toISOString()
        });
        this.renderIpList();
        Utils.toast('IP added to list. Click save to apply.', 'info');
    },

    addIpManual() {
        const ipInput = document.getElementById('newIpAddress');
        const labelInput = document.getElementById('newIpLabel');

        const ip = ipInput.value.trim();
        const label = labelInput.value.trim() || 'Custom Location';

        if (!ip) return Utils.toast('Please enter a valid IP address', 'warning');
        if (this.allowedIpsList.some(i => i.ip === ip)) return Utils.toast('This IP is already whitelisted', 'warning');

        this.allowedIpsList.push({
            ip: ip,
            label: label,
            added_at: new Date().toISOString()
         });

         ipInput.value = '';
         labelInput.value= '';
         this.renderIpList();
         Utils.toast('IP added to list. Click save to apply.', 'info');
    },

    async saveSettings() {
        const isRestricted = document.getElementById('ipModeRestrict').checked;
        const btn = document.getElementById('btnSaveIpSettings');

        btn.innerHTML = '<span class="spinner"></span> Saving...';
        btn.disabled = true;

        try {
            await DB._fetch('/api/settings/ip-security', {
                method: 'POST',
                body: JSON.stringify({
                    enabled: isRestricted,
                    allowed_ips: this.allowedIps
                 })
            });
            Utils.toast('IP security settings saved', 'success');

            const pill = document.getElementById('ipStatusPill');
            if (isRestricted) {
                pill.textContent = 'Restricted Mode Active';
                pill.className = 'badge badge-danger';
            } else {
                pill.textContent = 'Allow All Mode';
                pill.className = 'badge badge-success';
            }
            
        } catch (e) {
            Utils.toast(e.message, 'danger');
        } finally {
            btn.innerHTML = '<i class="bi bi-shield-check"></i> Save IP Security settings';
            btn.disabled = false;
        }
    },
};

window.Settings = Settings;