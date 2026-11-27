const { array } = require("node:stream/iter");

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
            await this.loadDevices();
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
        document.getElementById('btnGenerateDeviceCode')?.addEventListener('click', () => this.generateDeviceCode());
        
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

            this.currentIp = data.current_ip || 'Unknown';
            this.allowedIps = data.allowed_ips || [];

            const ipDisplay = document.getElementById('currentClientIp');
            if (ipDisplay) ipDisplay.textContent = this.currentIp;

            const allowAllRadio = document.getElementById('ipModeAllowAll');
            const restrictRadio = document.getElementById('ipModeRestrict');
            if (allowAllRadio) allowAllRadio.checked = !data.enabled;
            if (restrictRadio) restrictRadio.checked = data.enabled;
            
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
            console.error('Failed to load IP settings: ', e);
            Utils.toast('Failed to load IP settings', 'danger');
        }
    },

    renderIpList() {
        const tbody = document.getElementById('allowedIpsTableBody');
        const template = document.getElementById('tpl-ip-row');
        if (!tbody || !template) return;

        tbody.innerHTML = '';

        if (!this.allowedIps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No IPs whitelisted yet. Anyone can access if mode is allow all.</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();

        this.allowedIpsList.forEach((item, index) => {
            const clone = template.content.cloneNode(true);

            clone.querySelector('.data-label').textContent = item.ip;
            clone.querySelector('.data-date').textContent = new Date(item.added_at).toLocaleString();

            const removeBtn = clone.querySelector('.btn-remove-ip');
            removeBtn.addEventListener('click', () => {
                this.allowedIpsList.splice(index, 1);
                this.renderIpList();
            });

            fragment.appendChild(clone);
        });

        tbody.appendChild(fragment);
    },

    addCurrentIp() {
        if (!this.currentIp || this.currentIp === 'Unknown') {
            return Utils.toast('Your current IP could not br detected', 'warning');
        }

        if(this.allowedIpsList.some(i => i.ip === this.currentIp)) {
            return Utils.toast('Your current IP is already whitelisted', 'warning');
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
                    allowed_ips: this.allowedIpsList
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

    async saveWhatsApp() {
        const value = document.getElementById('settingsWhastapp').value.trim();
        if (!value) return Utils.toast('Please enter a whatsapp number', 'warning');

        try {
            await DB._fetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify({ key: 'admin_whatsapp_number', value })
            });
            Utils.toast('Whatsapp number updated', 'success');
        } catch (e) {
            Utils.toast(e.message, 'danger');
        }
    },

    async loadDevices() {
        try {
            const [devData, branchData] = await Promise.all([
                DB._fetch('/api/devices'),
                DB._fetch('/api/branch')
            ]);

            const select = document.getElementById('deviceBranchSelect');
            if (select && Array.isArray(branchData.branches || branchData)) {;
                select.innerHTML = branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
            }

            const tbody = document.getElementById('devicesTableBody');
            if (!tbody) return;

            tbody.innerHTML = (devData.devices || []).map(d => `
                <tr>
                    <td>${d.device_label} ${d.is_current ? '<span class="badge badge-info">This PC</span>' : ''}</td>
                    <td>${d.branch_name || 'All Branches'}</td>
                    <td>${d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '-'}</td>
                    <td>${d.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Revoked</span>'}</td>
                    <td>
                        ${d.is_active && !d.is_current
                            ? `<button class="btn btn-sm btn-danger" onclick="settings.revokeDevice(${d.id})">Revoke</button`
                            : '-'}
                    </td>
                <tr>
                    `).join('');
        } catch (e) {
            console.error('Failed to load devices:', e);
        }
    },

    async generateDeviceCode() {
        const branch_id = document.getElementById('deviceBranchSelect')?.value;
        const device_label = document.getElementById('newDeviceLabel')?.value.trim();
        if (!device_label) return Utils.toast('Enter a terminal name first', 'warning');

        const admin_password = prompt('confirm your admin password to generate an enrollment code:');
        if (!admin_password) return;

        try{
            const data = await DB._fetch('/api/devices/codes', {
                method: 'POST',
                body: JSON.stringify({ branch_id, device_label, admin_password })
            });
            document.getElementById('generatedCodeValue').textContent = data.code;
            document.getElementById('generatedCodeBox').style.display = 'block';
            document.getElementById('newDeviceLabel').value = '';
            Utils.toast('one-time code generated', 'success');
        } catch (e) {
            Utils.toast(e.message, 'danger');
        }
    },

    async revokeDevice(id) {
        const admin_password = prompt('confirm your admin password to revoke this terminal:');
        if (!admin_password) return;

        try {
            await DB._fetch(`/api/devices/${id}/revoke`, {
                method: 'PATCH',
                body: JSON.stringify({ admin_password })
            });
            Utils.toast('Terminal revoked', 'success');
            await this.loadDevices();
        } catch (e) {
            Utils.toast(e.message, 'danger');
        }
    },

};

window.Settings = Settings;