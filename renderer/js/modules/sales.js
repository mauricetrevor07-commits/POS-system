const Sales = {
  allSales: [],
  filteredSales: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div style="padding:40px; text-align:center;">Loading Sales History...</div>';

    try{
      const response = await fetch('/template/sales.html');
      if (!response.ok) throw new Error('Sales template not found');

      container.innerHTML = await response.text();

      this.attachEvents();

      await this.load();

    } catch (error) {
      console.error(error);
      container.innerHTML = `<p style="color:red; padding:20px;">Failed to load sales history: ${error.message}</p>`;
    } 
  },

  attachEvents() {
    const filters = [
      'salesSearchInput',
      'salesFromDate',
      'salesToDate',
      'salesStatusFilter',
      'salesMethodFilter'
    ];

    filters.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.applyFilters());
      document.getElementById(id)?.addEventListener('change', () => this.applyFilters());      
    });
  },

  async load() {
    try {

      const response = await DB._fetch('/api/sales');
      this.allSales = response || [];
      this.applyFilters();
    } catch (e) {
      document.getElementById('salesList').innerHTML = '<p style="padding:20px; color: var(--danger);">Failed to load sales.</p>';
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

    this.renderList();
  },

renderList() {
    const badge = document.getElementById('salesCountBadge');
    if (badge) badge.textContent = `${this.filteredSales.length} records`;

    const list = document.getElementById('salesList');
    if (!list) return;

    if (this.filteredSales.length === 0) {
      list.innerHTML = '<p style="text-align:center; padding: 30px; color:var(--text-muted);">No sales match the specified filters.</p>';
      return;
    }

    const role = (typeof currentUser !== 'undefined' && currentUser?.role) || localStorage.getItem('userRole') || 'staff';
    list.innerHTML = this.filteredSales.map(s => {
      const isApproved = (s.payment_status || 'approved') === 'approved';
      const isPending = s.payment_status === 'pending_payment';

      const itemsStr = (s.items || []).map(i => `${Utils.escapeHtml(i.productName || i.productname)} (x${i.quantity})`).join(', ');
      const subtotalVal = s.subtotal !== null && s.subtotal !== undefined ? parseFloat(s.subtotal) : parseFloat(s.total || 0);
      const vatVal = s.vat_amount !== null && s.sub_amount !== undefined ? parseFloat(s.vat_amount) : 0;

      return `
      <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div style="flex:2; min-width:280px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
      <strong style="font-size: 1.05rem; color:var(--text-main);">Sale #${s.id.slice(0, 8).toUpperCase()}</strong>
      <span class="badge ${isApproved ? 'badge-success' : isPending ? 'badge-warning' : 'badge-danger'}">${isPending ? 'Pending Approval' : (s.payment_status || 'approved').toUpperCase()}</span>
      <span style="font-size:0.8rem; color:var(--text-muted);">${new Date(s.timestamp).toLocaleString()}</span>
      </div>
            
            <div style="font-size:0.9rem; color:var(--text-main); margin-bottom:4px;">
              <strong>Customer:</strong> ${Utils.escapeHtml(s.customer_name || 'Walk-in Customer')}
              ${s.customer_kra_pin ? `<span style="color:var(--text-muted); font-size:0.8rem; margin-left:6px;">(KRA: ${Utils.escapeHtml(s.customer_kra_pin)})</span>` : ''}
            </div>
            
            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:2px;">
              <strong>Items:</strong> ${itemsStr || 'No items listed'}
            </div>
            
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Subtotal: KES ${Utils.formatCurrency(subtotalVal)} | VAT: KES ${Utils.formatCurrency(vatVal)}
            </div>
          </div>

          <div style="text-align:right; min-width:180px;">
            <div style="font-size:1.25rem; font-weight:700; color:var(--primary);">KES ${Utils.formatCurrency(s.total)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
              ${(s.paymentMethod || 'CASH').replace('_', ' ').toUpperCase()} | Ref: <strong>${Utils.escapeHtml(s.payment_reference || 'N/A')}</strong>
            </div>
            
            <div style="margin-top:8px; display:flex; gap:6px; justify-content:flex-end;">
              ${(role !== 'admin' && !isApproved) ? `
                <button class="btn btn-sm btn-outline" style="border-color:var(--accent); color:var(--accent); cursor:not-allowed;" disabled>
                  <i class="bi bi-lock-fill"></i> Awaiting Approval
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" onclick='Utils.showPrintDialog(${JSON.stringify(s).replace(/'/g, "&#39;")})'>
                  <i class="bi bi-printer"></i> Print Docs
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
};

// Ensure app.js can find it
window.Sales = Sales;