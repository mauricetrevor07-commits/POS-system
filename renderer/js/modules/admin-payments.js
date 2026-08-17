const AdminPayments = {
  payments: [],
  filteredPayments: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2><i class="bi bi-hourglass-split"></i> Pending Payment Approvals</h2>
        <button class="btn btn-outline btn-sm" onclick="AdminPayments.load()">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>

      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:250px;">
            <input type="text" id="pendingSearch" class="form-control" placeholder="Search by customer name, ref #, or item..." oninput="AdminPayments.applyFilter()" />
          </div>
          <div id="pendingSummaryBadge" style="font-size:0.9rem; font-weight:600; color:var(--primary);">
            Loading pending...
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body" id="pendingList" style="padding:0;">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
    await this.load();
  },

  async load() {
    try {
      this.payments = await DB._fetch('/api/pending-payments');
      this.applyFilter();
    } catch (e) {
      document.getElementById('pendingList').innerHTML = '<p style="padding:20px; color:#ef4444;">Failed to load pending payments.</p>';
    }
  },

  applyFilter() {
    const query = (document.getElementById('pendingSearch')?.value || '').toLowerCase();
    this.filteredPayments = this.payments.filter(p => {
      if (!query) return true;
      const id = (p.id || '').toLowerCase();
      const customer = (p.customer_name || '').toLowerCase();
      const ref = (p.payment_reference || '').toLowerCase();
      const items = (p.items || []).map(i => (i.productname || '').toLowerCase()).join(' ');
      return id.includes(query) || customer.includes(query) || ref.includes(query) || items.includes(query);
    });

    let totalPendingAmount = 0;
    this.filteredPayments.forEach(p => totalPendingAmount += parseFloat(p.total || 0));

    const badge = document.getElementById('pendingSummaryBadge');
    if (badge) {
      badge.innerHTML = `<strong>${this.filteredPayments.length}</strong> Pending Sales (Total: <strong>KES ${Utils.formatCurrency(totalPendingAmount)}</strong>)`;
    }

    const html = this.filteredPayments.map(p => {
      const itemsStr = (p.items || []).map(i => `${Utils.escapeHtml(i.productname)} (x${i.quantity})`).join(', ');
      return `
        <div style="padding:18px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div style="flex:2; min-width:280px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <strong style="font-size:1.1rem; color:#0f172a;">Sale #${p.id.slice(0, 8).toUpperCase()}</strong>
              <span class="badge badge-warning">Awaiting Approval</span>
              <span style="font-size:0.8rem; color:#64748b;">${new Date(p.timestamp).toLocaleString()}</span>
            </div>
            <div style="font-size:0.95rem; color:#1e293b; margin-bottom:4px;">
              <strong>Customer:</strong> ${Utils.escapeHtml(p.customer_name || 'Walk-in Customer')}
            </div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:4px;">
              <strong>Items:</strong> ${itemsStr || 'No items listed'}
            </div>
            <div style="font-size:0.85rem; color:#475569; background:#f1f5f9; padding:4px 8px; border-radius:6px; display:inline-block;">
              <strong>Payment:</strong> ${(p.paymentMethod || 'Mobile Money').toUpperCase()} | Ref: <strong>${Utils.escapeHtml(p.payment_reference || 'N/A')}</strong>
            </div>
          </div>

          <div style="text-align:right; min-width:200px;">
            <div style="font-size:1.4rem; font-weight:700; color:var(--primary); margin-bottom:10px;">
              KES ${Utils.formatCurrency(p.total)}
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button class="btn btn-sm btn-outline" onclick="Utils.showPrintDialog(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Print Preview">
                <i class="bi bi-printer"></i> Docs
              </button>
              <button class="btn btn-sm btn-success" onclick="AdminPayments.approve('${p.id}')">
                <i class="bi bi-check-lg"></i> Approve & Release Stock
              </button>
              <button class="btn btn-sm btn-danger" onclick="AdminPayments.reject('${p.id}')">
                <i class="bi bi-x-lg"></i> Reject
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const list = document.getElementById('pendingList');
    if (list) {
      list.innerHTML = html || '<div style="padding:40px; text-align:center; color:#64748b;"><i class="bi bi-check-circle" style="font-size:2.5rem; color:var(--success); display:block; margin-bottom:8px;"></i>All payments have been reviewed and approved. No pending sales!</div>';
    }
  },

  async approve(saleId) {
    try {
      await DB._fetch(`/api/payments/${saleId}/approve`, { method: 'PUT' });
      Utils.toast('Payment approved! Stock deducted and sale confirmed.', 'success');
      this.load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  async reject(saleId) {
    if (!confirm('Reject this sale and payment reference?')) return;
    try {
      await DB._fetch(`/api/payments/${saleId}/reject`, { method: 'PUT' });
      Utils.toast('Sale and payment rejected', 'warning');
      this.load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }
};