const Sales = {
  allSales: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2>Sales History</h2>
        <input type="text" id="salesSearch" class="form-control" placeholder="Search by ID, customer, reference..." style="max-width:350px;" oninput="Sales.filter()" />
      </div>
      <div class="card">
        <div class="card-body" id="salesList"><div class="loading-spinner"></div></div>
      </div>`;
    await this.load();
  },

  async load() {
    try {
      this.allSales = await DB._fetch('/api/sales');
      this.filter();
    } catch (e) {
      document.getElementById('salesList').innerHTML = '<p>Failed to load sales.</p>';
    }
  },

  filter() {
    const query = (document.getElementById('salesSearch')?.value || '').toLowerCase();
    const filtered = this.allSales.filter(s => {
      if (!query) return true;
      const id = (s.id || '').toLowerCase();
      const customer = (s.customer_name || '').toLowerCase();
      const reference = (s.payment_reference || '').toLowerCase();
      const method = (s.paymentMethod || '').toLowerCase();
      return id.includes(query) || customer.includes(query) || reference.includes(query) || method.includes(query);
    });

    const list = document.getElementById('salesList');
    if (!list) return;

    list.innerHTML = filtered.length
      ? filtered.map(s => `
          <div style="border-bottom:1px solid #ccc; padding:10px 0;">
            <strong>${s.payment_status === 'pending_payment' ? 'PENDING' : 'Sale'} #${s.id.slice(0,8)}</strong>
            – ${new Date(s.timestamp).toLocaleString()}<br/>
            Customer: ${s.customer_name || 'Walk-in'}<br/>
            Total: KES ${Utils.formatCurrency(s.total)} (${s.paymentMethod})<br/>
            Ref: ${s.payment_reference || 'N/A'}<br/>
            Items: ${(s.items || []).map(i => `${i.productName} x${i.quantity}`).join(', ')}
          </div>`).join('')
      : '<p>No sales found.</p>';
  }
};