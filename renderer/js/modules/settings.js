const Settings = {
    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = `
            <div class="toolbar"><h2><i class="bi bi-gear"></i> System Settings</h2></div>
            
            <div style="display:flex; flex-direction:column; gap:24px; max-width: 800px;">
                <!-- Branch Location & IP Security Card -->
                <div class="card">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="bi bi-shield-lock-fill"></i> Branch Location & IP Security</span>
                        <span id="ipStatusPill" class="badge badge-secondary">Loading...</span>
                    </div>
                    <div class="card-body" style="padding: 24px;">
                        <p style="color: #64748b; margin-bottom: 16px; font-size: 0.9rem;">
                            Control where staff can log in to the POS system. You can allow all IP addresses or restrict access exclusively to authorized branch location internet connections.
                        </p>

                        <!-- Restriction Mode Selection -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;">
                            <label style="font-weight:700; color:#1e293b; display:block; margin-bottom:10px;">Access Policy</label>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:0.95rem;">
                                    <input type="radio" name="ipAccessMode" value="false" id="ipModeAllowAll" onchange="Settings.toggleIpModeUI()" />
                                    <span><strong>Allow All IP Addresses</strong> <span style="color:#64748b; font-size:0.85rem;">(Accessible from any location / remote networks)</span></span>
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:0.95rem;">
                                    <input type="radio" name="ipAccessMode" value="true" id="ipModeRestrict" onchange="Settings.toggleIpModeUI()" />
                                    <span><strong style="color:#dc2626;">Restrict to Branch Locations</strong> <span style="color:#64748b; font-size:0.85rem;">(Staff can ONLY log in from whitelisted branch IPs below)</span></span>
                                </label>
                            </div>
                        </div>

                        <!-- Current IP and Add Section -->
                        <div id="ipWhitelistSection">
                            <div style="display:flex; justify-content:space-between; align-items:center; background:#e0f2fe; border:1px solid #bae6fd; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
                                <div>
                                    <span style="font-size:0.8rem; color:#0369a1; font-weight:600; text-transform:uppercase;">Your Current Connection IP</span>
                                    <div style="font-size:1.1rem; font-weight:700; color:#0c4a6e;" id="currentClientIp">Detecting...</div>
                                </div>
                                <button class="btn btn-sm btn-outline" onclick="Settings.addCurrentIp()" style="background:#fff;">
                                    <i class="bi bi-plus-circle"></i> Add My IP to Whitelist
                                </button>
                            </div>

                            <!-- Add IP Form -->
                            <div style="display:flex; gap:12px; margin-bottom:16px; align-items:flex-end; flex-wrap:wrap;">
                                <div style="flex:2; min-width:180px;">
                                    <label style="font-size:0.8rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">IP Address or Subnet *</label>
                                    <input id="newIpAddress" class="form-control" placeholder="e.g. 197.232.10.45 or 192.168.1.0/24" />
                                </div>
                                <div style="flex:2; min-width:180px;">
                                    <label style="font-size:0.8rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Branch / Location Label</label>
                                    <input id="newIpLabel" class="form-control" placeholder="e.g. Nairobi Branch - Main Router" />
                                </div>
                                <div>
                                    <button class="btn btn-primary" onclick="Settings.addIpToList()">
                                        <i class="bi bi-plus-lg"></i> Add IP
                                    </button>
                                </div>
                            </div>

                            <!-- Whitelisted IPs Table -->
                            <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:20px;">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Branch / Label</th>
                                            <th>Allowed IP / Network</th>
                                            <th>Added On</th>
                                            <th class="text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="allowedIpsTableBody">
                                        <tr><td colspan="4" class="text-center" style="padding:20px; color:#64748b;">Loading allowed IPs...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <button class="btn btn-primary" onclick="Settings.saveIpSecuritySettings()" style="padding:10px 24px;">
                            <i class="bi bi-shield-check"></i> Save IP Security Settings
                        </button>
                    </div>
                </div>

                <!-- WhatsApp Notification Card -->
                <div class="card">
                    <div class="card-header"><i class="bi bi-whatsapp"></i> WhatsApp Notifications</div>
                    <div class="card-body" style="padding: 24px;">
                        <p style="color: #64748b; margin-bottom: 16px; font-size: 0.9rem;">
                            When a cashier submits a sale, the payment reference and order details will be sent to this WhatsApp number for admin approval.
                        </p>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-weight: 600; margin-bottom: 6px; display: block;">Admin WhatsApp Number</label>
                            <input id="settingsWhatsApp" class="form-control" placeholder="+254700000000"
                                style="padding: 10px 14px; font-size: 1rem; border-radius: 8px; border: 1px solid #cbd5e1;" />
                            <small style="color: #94a3b8; display: block; margin-top: 6px;">Include country code, e.g. +254 for Kenya</small>
                        </div>
                        <button class="btn btn-primary" onclick="Settings.saveWhatsApp()" style="padding: 10px 24px;">
                            <i class="bi bi-check-lg"></i> Save WhatsApp Number
                        </button>
                    </div>
                </div>

                <!-- Category Tier Pricing Settings -->
                <div class="card">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span><i class="bi bi-tags-fill"></i> Category Tier Pricing & Bulk Discounts</span>
                        <button class="btn btn-sm btn-primary" onclick="App.navigate('products'); setTimeout(() => Products.switchView('matrix'), 100);">
                            <i class="bi bi-grid-3x3"></i> Open Full Category Price Matrix
                        </button>
                    </div>
                    <div class="card-body" style="padding: 24px;">
                        <p style="color: #64748b; margin-bottom: 20px; font-size: 0.9rem;">
                            Set automatic percentage discounts for <strong>Wholesale</strong> and <strong>Distributor</strong> customer tiers per product category. Clicking <em>"Apply to Products"</em> will automatically calculate and update the tiered prices for all items in that category.
                        </p>

                        <div style="display:flex; flex-direction:column; gap:16px;">
                            ${this.renderCategoryRow('HDPE Pipes', 'hdpe_pipes')}
                            ${this.renderCategoryRow('Heavy Duty Sacks', 'heavy_duty_sacks')}
                            ${this.renderCategoryRow('Fittings & Accessories', 'fittings_accessories')}
                            ${this.renderCategoryRow('General', 'general')}
                        </div>
                    </div>
                </div>
            </div>`;
        await this.load();
    },

    renderCategoryRow(catName, catKey) {
        return `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="min-width:180px;">
                        <strong style="font-size:0.95rem; color:#1e293b;"><i class="bi bi-box-seam"></i> ${catName}</strong>
                        <div style="font-size:0.75rem; color:#64748b;">Pricing Tier Rules</div>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <label style="font-size:0.8rem; font-weight:600; color:#0284c7;">Wholesale Disc %:</label>
                            <input type="number" step="0.5" min="0" max="100" id="ws_pct_${catKey}" class="form-control" style="width:80px; text-align:center;" placeholder="10%" />
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <label style="font-size:0.8rem; font-weight:600; color:#7c3aed;">Distributor Disc %:</label>
                            <input type="number" step="0.5" min="0" max="100" id="dist_pct_${catKey}" class="form-control" style="width:80px; text-align:center;" placeholder="15%" />
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="Settings.applyCategoryPricing('${catName}', '${catKey}')" style="white-space:nowrap;">
                            <i class="bi bi-magic"></i> Apply to Products
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    allowedIpsList: [],
    detectedClientIp: '',

    async load() {
        try {
            await Promise.all([this.loadGeneralSettings(), this.loadIpSecurity()]);
        } catch (e) {
            Utils.toast('Failed to load settings', 'error');
        }
    },

    async loadGeneralSettings() {
        const settings = await DB._fetch('/api/settings');
        const input = document.getElementById('settingsWhatsApp');
        if (settings.admin_whatsapp_number && input) {
            input.value = settings.admin_whatsapp_number;
        }

        const categories = [
            { key: 'hdpe_pipes', name: 'HDPE Pipes' },
            { key: 'heavy_duty_sacks', name: 'Heavy Duty Sacks' },
            { key: 'fittings_accessories', name: 'Fittings & Accessories' },
            { key: 'general', name: 'General' }
        ];

        categories.forEach(cat => {
            const settingKey = `tier_rule_${cat.key}`;
            if (settings[settingKey]) {
                try {
                    const parsed = JSON.parse(settings[settingKey]);
                    const wsInput = document.getElementById(`ws_pct_${cat.key}`);
                    const distInput = document.getElementById(`dist_pct_${cat.key}`);
                    if (wsInput && parsed.wholesale_discount_pct !== undefined) wsInput.value = parsed.wholesale_discount_pct;
                    if (distInput && parsed.distributor_discount_pct !== undefined) distInput.value = parsed.distributor_discount_pct;
                } catch (_) {}
            }
        });
    },

    async loadIpSecurity() {
        try {
            const data = await DB._fetch('/api/settings/ip-security');
            this.detectedClientIp = data.client_ip || '';
            this.allowedIpsList = data.allowed_ips || [];

            const ipPill = document.getElementById('ipStatusPill');
            const clientIpEl = document.getElementById('currentClientIp');
            if (clientIpEl) clientIpEl.textContent = this.detectedClientIp || 'Unknown';

            const enabled = !!data.enabled;
            const radioAllow = document.getElementById('ipModeAllowAll');
            const radioRestrict = document.getElementById('ipModeRestrict');
            if (radioAllow) radioAllow.checked = !enabled;
            if (radioRestrict) radioRestrict.checked = enabled;

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
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:20px; color:#64748b;">No specific IP addresses added yet. (Localhost & LAN are permitted by default)</td></tr>';
            return;
        }

        tbody.innerHTML = this.allowedIpsList.map((entry, idx) => `
            <tr>
                <td><strong>${Utils.escapeHtml(entry.label || 'Branch Location')}</strong></td>
                <td><code>${Utils.escapeHtml(entry.ip)}</code></td>
                <td>${entry.added_at ? new Date(entry.added_at).toLocaleDateString() : '-'}</td>
                <td class="text-right">
                    <button class="btn btn-sm btn-danger" onclick="Settings.removeIpFromList(${idx})">
                        <i class="bi bi-trash"></i> Remove
                    </button>
                </td>
            </tr>
        `).join('');
    },

    addCurrentIp() {
        if (!this.detectedClientIp) return Utils.toast('Current IP could not be detected', 'warning');
        document.getElementById('newIpAddress').value = this.detectedClientIp;
        document.getElementById('newIpLabel').value = 'Current Location / Admin Office';
    },

    addIpToList() {
        const ip = document.getElementById('newIpAddress')?.value.trim();
        const label = document.getElementById('newIpLabel')?.value.trim() || 'Branch Office';

        if (!ip) return Utils.toast('Please enter a valid IP address', 'error');

        // Check if already in list
        if (this.allowedIpsList.some(e => e.ip === ip)) {
            return Utils.toast('This IP is already in the whitelist', 'warning');
        }

        this.allowedIpsList.push({
            ip,
            label,
            added_at: new Date().toISOString()
        });

        document.getElementById('newIpAddress').value = '';
        document.getElementById('newIpLabel').value = '';
        this.renderAllowedIpsTable();
        Utils.toast(`Added ${ip} to list. Click "Save IP Security Settings" to apply.`, 'info');
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
                body: JSON.stringify({
                    enabled,
                    allowed_ips: this.allowedIpsList
                })
            });
            Utils.toast('Branch IP security settings saved successfully', 'success');
            this.loadIpSecurity();
        } catch (e) {
            Utils.toast(e.message, 'error');
        }
    },

    toggleIpModeUI() {
        // Optional UI animation or state updates
    },

    async saveWhatsApp() {
        const value = document.getElementById('settingsWhatsApp').value.trim();
        if (!value) return Utils.toast('Please enter a WhatsApp number', 'warning');
        if (!/^\+\d{7,15}$/.test(value)) {
            return Utils.toast('Enter a valid number with country code (e.g. +254712345678)', 'warning');
        }
        try {
            await DB._fetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify({ key: 'admin_whatsapp_number', value })
            });
            if (window.currentBranch) {
                window.currentBranch.whatsapp = value;
            }
            Utils.toast('WhatsApp number updated successfully', 'success');
        } catch (e) {
            Utils.toast(e.message, 'error');
        }
    },

    async applyCategoryPricing(categoryName, catKey) {
        const wsPct = parseFloat(document.getElementById(`ws_pct_${catKey}`)?.value) || 0;
        const distPct = parseFloat(document.getElementById(`dist_pct_${catKey}`)?.value) || 0;

        try {
            const res = await DB._fetch('/api/settings/apply-category-pricing', {
                method: 'POST',
                body: JSON.stringify({
                    category: categoryName,
                    wholesale_discount_pct: wsPct,
                    distributor_discount_pct: distPct
                })
            });
            Utils.toast(`Applied tier discounts (${wsPct}% WS / ${distPct}% Dist) to ${res.updatedProductsCount} products in ${categoryName}`, 'success');
        } catch (e) {
            Utils.toast(e.message, 'error');
        }
    }
};
