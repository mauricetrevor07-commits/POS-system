const Settings = {
    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = `
            <div class="toolbar"><h2><i class="bi bi-gear"></i> System Settings</h2></div>
            
            <div style="display:flex; flex-direction:column; gap:24px; max-width: 800px;">
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
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="bi bi-tags-fill"></i> Category Tier Pricing & Bulk Discounts</span>
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

    async load() {
        try {
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
        } catch (e) {
            Utils.toast('Failed to load settings', 'error');
        }
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
