const Settings = {
    allowedIpsList: [],
    detectedClientIp: '',

    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

        try {
            const response = await fetch('/templates/settings.html');
            if (!response.ok) throw new Error('Settings template not found');
            container.innerHTML = await response.text();

            this.attachEvents();
            this.renderCategoryRows(); // Build the static category rows
            await this.loadData();

        } catch (error) {
            console.error('Failed to render settings:', error);
            container.innerHTML = `<p style="color:var(--danger); padding:20px;">Failed to load settings: ${error.message}</p>`;
        }
    },

    attachEvents() {
        // IP Security Events
        document.getElementById('btnAddCurrentIp')?.addEventListener('click', () => this.addCurrentIp());
        document.getElementById('btnAddIp')?.addEventListener('click', () => this.addIpToList());
        document.getElementById('btnSaveIpSettings')?.addEventListener('click', () => this.saveIpSecuritySettings());
        
        // WhatsApp Events
        document.getElementById('btnSaveWhatsApp')?.addEventListener('click', () => this.saveWhatsApp());

        // Matrix Event
        document.getElementById('btnOpenMatrix')?.addEventListener('click', () => {
            window.App.navigate('products'); 
            setTimeout(() => Products.switchView('matrix'), 100);
        });
    },

    async loadData() {
        try {
            await Promise.all([this.loadGeneralSettings(), this.loadIpSecurity()]);
        } catch (e) {
            Utils.toast('Failed to load some settings', 'error');
        }
    },

    // --- IP SECURITY ---
    async loadIpSecurity() {
        try {
            const data = await DB._fetch('/api/settings/ip-security');
            this.detectedClientIp = data.client_ip || '';
            this.allowedIpsList = data.allowed_ips || [];

            const clientIpEl = document.getElementById('currentClientIp');
            if (clientIpEl) clientIpEl.textContent = this.detectedClientIp || 'Unknown';

            const enabled = !!data.enabled;
            const ipPill = document.getElementById('ipStatusPill');
            
            document.getElementById('ipModeAllowAll').checked = !enabled;
            document.getElementById('ipModeRestrict').checked = enabled;
            
            if (ipPill) {
                ipPill.className = enabled ? 'badge badge-warning' : 'badge badge-success';
                ipPill.innerHTML = enabled ? '<i class="bi bi-shield-lock"></i> Restricted' : '<i class="bi bi-globe"></i> Allow All';
            }

            this.renderAllowedIpsTable();
        } catch (e) {
            console.error('Failed to load IP security settings', e);
        }
    },

    renderAllowedIpsTable() {
        const tbody = document.getElementById('allowedIpsTableBody');
        if (!tbody) return;

        if (!this.allowedIpsList.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:20px; color:#64748b;">No specific IP addresses added yet.</td></tr>';
            return;
        }

        const template = document.getElementById('tpl-ip-row');
        const fragment = document.createDocumentFragment();
        tbody.innerHTML = '';

        this.allowedIpsList.forEach((entry, idx) => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.data-label').textContent = entry.label || 'Branch Location';
            clone.querySelector('.data-ip').textContent = entry.ip;
            clone.querySelector('.data-date').textContent = entry.added_at ? new Date(entry.added_at).toLocaleDateString() : '-';
            clone.querySelector('.btn-remove-ip').addEventListener('click', () => this.removeIpFromList(idx));
            fragment.appendChild(clone);
        });

        tbody.appendChild(fragment);
    },

    addCurrentIp() {
        if (!this.detectedClientIp) return Utils.toast('Current IP could not be detected', 'warning');
        document.getElementById('newIpAddress').value = this.detectedClientIp;
        document.getElementById('newIpLabel').value = 'Current Location';
    },

    addIpToList() {
        const ip = document.getElementById('newIpAddress')?.value.trim();
        const label = document.getElementById('newIpLabel')?.value.trim() || 'Branch Office';

        if (!ip) return Utils.toast('Please enter a valid IP address', 'warning');
        if (this.allowedIpsList.some(e => e.ip === ip)) return Utils.toast('This IP is already whitelisted', 'warning');

        this.allowedIpsList.push({ ip, label, added_at: new Date().toISOString() });
        document.getElementById('newIpAddress').value = '';
        document.getElementById('newIpLabel').value = '';
        
        this.renderAllowedIpsTable();
        Utils.toast(`Added ${ip} to list. Click Save to apply.`, 'info');
    },

    removeIpFromList(index) {
        this.allowedIpsList.splice(index, 1);
        this.renderAllowedIpsTable();
    },

    async saveIpSecuritySettings() {
        const enabled = document.getElementById('ipModeRestrict')?.checked || false;
        try {
            await DB._fetch('/api/settings/ip-security', {
                method: 'POST',
                body: JSON.stringify({ enabled, allowed_ips: this.allowedIpsList })
            });
            Utils.toast('IP security settings saved', 'success');
            this.loadIpSecurity();
        } catch (e) {
            Utils.toast(e.message, 'danger');
        }
    },

    // --- GENERAL SETTINGS & WHATSAPP ---
    async loadGeneralSettings() {
        const settings = await DB._fetch('/api/settings');
        const input = document.getElementById('settingsWhatsApp');
        if (settings.admin_whatsapp_number && input) {
            input.value = settings.admin_whatsapp_number;
        }
    },

    async saveWhatsApp() {
        const value = document.getElementById('settingsWhatsApp').value.trim();
        if (!value) return Utils.toast('Please enter a WhatsApp number', 'warning');
        if (!/^\+\d{7,15}$/.test(value)) return Utils.toast('Enter a valid number with country code', 'warning');

        try {
            await DB._fetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify({ key: 'admin_whatsapp_number', value })
            });
            Utils.toast('WhatsApp number updated', 'success');
        } catch (e) {
            Utils.toast(e.message, 'danger');
        }
    },

    // --- CATEGORY PRICING ---
    renderCategoryRows() {
        const container = document.getElementById('categoryPricingList');
        if (!container) return;

        const categories = [
            { key: 'hdpe_pipes', name: 'HDPE Pipes' },
            { key: 'heavy_duty_sacks', name: 'Heavy Duty Sacks' },
            { key: 'fittings_accessories', name: 'Fittings & Accessories' },
            { key: 'general', name: 'General' }
        ];

        const template = document.getElementById('tpl-category-row');
        const fragment = document.createDocumentFragment();

        categories.forEach(cat => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.data-cat-name').textContent = cat.name;
            
            const wsInput = clone.querySelector('.ws-input');
            const distInput = clone.querySelector('.dist-input');
            wsInput.id = `ws_pct_${cat.key}`;
            distInput.id = `dist_pct_${cat.key}`;

            clone.querySelector('.btn-apply-cat').addEventListener('click', () => this.applyCategoryPricing(cat.name, cat.key));
            
            fragment.appendChild(clone);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    },

    async applyCategoryPricing(categoryName, catKey) {
        const wsPct = parseFloat(document.getElementById(`ws_pct_${catKey}`)?.value) || 0;
        const distPct = parseFloat(document.getElementById(`dist_pct_${catKey}`)?.value) || 0;

        try {
            const res = await DB._fetch('/api/settings/apply-category-pricing', {
                method: 'POST',
                body: JSON.stringify({ category: categoryName, wholesale_discount_pct: wsPct, distributor_discount_pct: distPct })
            });
            Utils.toast(`Applied discounts to ${res.updatedProductsCount} products`, 'success');
        } catch (e) {
            Utils.toast(e.message, 'danger');
        }
    }
};

window.Settings = Settings;