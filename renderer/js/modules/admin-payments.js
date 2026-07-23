const AdminPayments = {
    async render() {
        const container = document.getElementById('page-content');
        container.innerHTML = `<div class="toolbar"><h2>Pending Payments</h2></div><div class="card"><div class="card-body" id="pendingList"></div></div>`;
        await this.load();
    },
    async load() {
        const payments = await DB._fetch('/api/pending-payments');
        const html = payments.map(p => `
            <div style="border:1px solid #ccc; margin-bottom:10px; padding:10px;">
                <strong>Sale #${p.id.slice(0,8)}</strong> – ${new Date(p.timestamp).toLocaleString()}<br/>
                Customer: ${p.customer_name || 'Walk-in'}<br/>
                Total: ${Utils.formatCurrency(p.total)} – Method: ${p.paymentMethod}<br/>
                Reference: ${p.payment_reference || 'N/A'}<br/>
                Items: ${p.items.map(i => `${i.productName} x${i.quantity}`).join(', ')}
                <div style="margin-top:5px;">
                    <button class="btn btn-sm btn-success" onclick="AdminPayments.approve('${p.id}')">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="AdminPayments.reject('${p.id}')">Reject</button>
                </div>
            </div>`).join('');
        document.getElementById('pendingList').innerHTML = html || '<p>No pending payments.</p>';
    },
    async approve(saleId) {
        await DB._fetch(`/api/payments/${saleId}/approve`, { method: 'PUT' });
        Utils.toast('Payment approved – stock released', 'success');
        this.load();
    },
    async reject(saleId) {
        await DB._fetch(`/api/payments/${saleId}/reject`, { method: 'PUT' });
        Utils.toast('Payment rejected', 'error');
        this.load();
    }
};