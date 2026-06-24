const Sales = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print"><h2>Sales History</h2></div>
      <div class="card">
        <div class="card-body" id="salesList"><div class="loading-spinner"></div></div>
      </div>`;
    await this.load();
  },
  async load() {
    const sales = await DB._fetch('/api/sales');
    const html = sales.map(s => `
      <div style="border-bottom:1px solid #ccc; padding:10px 0;">
        <strong>Sale #${s.id}</strong> - ${new Date(s.timestamp).toLocaleString()}<br/>
        Total: ${Utils.formatCurrency(s.total)} (${s.paymentMethod})<br/>
        Items: ${s.items.map(i => `${i.productName} x${i.quantity}`).join(', ')}
      </div>`).join('');
    document.getElementById('salesList').innerHTML = html || '<p>No sales yet.</p>';
  }
};