const Sales = {
  allSales: [],
  filteredSales: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2><i class="bi bi-receipt"></i> Sales History</h2>
      </div>

      <!-- Filters Card -->
      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:16px 20px;">
          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
            <div style="flex:2; min-width:200px;">
              <input type="text" id="salesSearchInput" class="form-control" placeholder="Search by ID, customer, reference, or item..." oninput="Sales.applyFilters()" />
            </div>
            <div style="flex:1; min-width:140px;">
              <input type="date" id="salesFromDate" class="form-control" title="From Date" onchange="Sales.applyFilters()" />
            </div>
            <div style="flex:1; min-width:140px;">
              <input type="date" id="salesToDate" class="form-control" title="To Date" onchange="Sales.applyFilters()" />
            </div>
            <div style="flex:1; min-width:140px;">
              <select id="salesStatusFilter" class="form-control" onchange="Sales.applyFilters()">
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending_payment">Pending Approval</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div style="flex:1; min-width:140px;">
              <select id="salesMethodFilter" class="form-control" onchange="Sales.applyFilters()">
                <option value="all">All Methods</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600;">Sales Records</span>
          <span id="salesCountBadge" class="badge badge-secondary">0 records</span>
        </div>
        <div class="card-body" id="salesList" style="padding:0; overflow-x:auto;">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
    await this.load();
  },

  async load() {
    try {
      this.allSales = await DB._fetch('/api/sales');
      this.applyFilters();
    } catch (e) {
      document.getElementById('salesList').innerHTML = '<p style="padding:20px; color:#ef4444;">Failed to load sales.</p>';
    }
  },

  applyFilters() {
    const query = (document.getElementById('salesSearchInput')?.value || '').toLowerCase();
    const from = document.getElementById('salesFromDate')?.value || '';
    const to = document.getElementById('salesToDate')?.value || '';
    const status = document.getElementById('salesStatusFilter')?.value || 'all';
    const method = document.getElementById('salesMethodFilter')?.value || 'all';

    this.filteredSales = this.allSales.filter(s => {
      // Date filter
      if (from) {
        const sDate = s.timestamp?.slice(0, 10);
        if (sDate && sDate < from) return false;
      }
      if (to) {
        const sDate = s.timestamp?.slice(0, 10);
        if (sDate && sDate > to) return false;
      }

      // Status filter
      if (status !== 'all' && (s.payment_status || 'approved') !== status) return false;

      // Method filter
      if (method !== 'all' && (s.paymentMethod || s.paymentmethod) !== method) return false;

      // Query search
      if (query) {
        const id = (s.id || '').toLowerCase();
        const customer = (s.customer_name || '').toLowerCase();
        const ref = (s.payment_reference || '').toLowerCase();
        const items = (s.items || []).map(i => (i.productname || i.productName || '').toLowerCase()).join(' ');
        if (!id.includes(query) && !customer.includes(query) && !ref.includes(query) && !items.includes(query)) {
          return false;
        }
      }
      return true;
    });

    const badge = document.getElementById('salesCountBadge');
    if (badge) badge.textContent = `${this.filteredSales.length} records`;

    const html = this.filteredSales.map(s => {
      const isApproved = (s.payment_status || 'approved') === 'approved';
      const isPending = s.payment_status === 'pending_payment';
      const isRejected = s.payment_status === 'rejected';
      const role = (typeof currentUser !== 'undefined' && currentUser?.role) || localStorage.getItem('userRole') || 'staff';

      const itemsStr = (s.items || []).map(i => `${Utils.escapeHtml(i.productname || i.productName)} (x${i.quantity})`).join(', ');

      const subtotalVal = s.subtotal !== null && s.subtotal !== undefined ? parseFloat(s.subtotal) : parseFloat(s.total || 0);
      const vatVal = s.vat_amount !== null && s.vat_amount !== undefined ? parseFloat(s.vat_amount) : 0;

      return `
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="flex:2; min-width:280px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <strong style="font-size:1.05rem; color:#0f172a;">Sale #${s.id.slice(0, 8).toUpperCase()}</strong>
              <span class="badge ${isApproved ? 'badge-success' : isPending ? 'badge-warning' : 'badge-danger'}">
                ${isPending ? 'Pending Approval' : (s.payment_status || 'approved').toUpperCase()}
              </span>
              <span style="font-size:0.8rem; color:#64748b;">${new Date(s.timestamp).toLocaleString()}</span>
            </div>
            <div style="font-size:0.9rem; color:#334155; margin-bottom:4px;">
              <strong>Customer:</strong> ${Utils.escapeHtml(s.customer_name || 'Walk-in Customer')}
              ${s.customer_kra_pin ? `<span style="color:#64748b; font-size:0.8rem; margin-left:6px;">(KRA: ${Utils.escapeHtml(s.customer_kra_pin)})</span>` : ''}
            </div>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:2px;">
              <strong>Items:</strong> ${itemsStr || 'No items listed'}
            </div>
            <div style="font-size:0.75rem; color:#64748b;">
              Subtotal: KES ${Utils.formatCurrency(subtotalVal)} | 16% VAT: KES ${Utils.formatCurrency(vatVal)}
            </div>
          </div>

          <div style="text-align:right; min-width:180px;">
            <div style="font-size:1.25rem; font-weight:700; color:var(--primary);">KES ${Utils.formatCurrency(s.total)}</div>
            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
              ${(s.paymentMethod || 'CASH').replace('_', ' ').toUpperCase()} | Ref: <strong>${Utils.escapeHtml(s.payment_reference || 'N/A')}</strong>
            </div>
            <div style="margin-top:8px; display:flex; gap:6px; justify-content:flex-end;">
              ${(role !== 'admin' && !isApproved) ? `
                <button class="btn btn-sm btn-outline" style="border-color:#f59e0b; color:#d97706;" onclick="Utils.showPrintDialog(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                  <i class="bi bi-lock-fill"></i> Awaiting Approval
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" onclick="Utils.showPrintDialog(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                  <i class="bi bi-printer"></i> Print Docs
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const list = document.getElementById('salesList');
    if (list) {
      list.innerHTML = html || '<p style="text-align:center; padding:30px; color:#64748b;">No sales match the specified filters.</p>';
    }
  }
};