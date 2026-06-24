const Sync = {
  syncServer: '',

  init(url) {
    this.syncServer = url;
    this.startPeriodicSync();
  },

  async pull() {
    try {
      const localRow = await this._getSyncTimestamps();
      const res = await fetch(`${this.syncServer}/api/sync/pull?since=${localRow.last_pull_timestamp}`, {
        headers: { 'X-Auth-Token': localStorage.getItem('authToken') }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      await this._applyRemoteData(data);
      await DB._fetch('/api/sync/update-pull-timestamp', {
        method: 'POST',
        body: JSON.stringify({ timestamp: data.server_timestamp })
      });
    } catch (e) {
      console.warn('Sync pull failed:', e);
    }
  },

  async push() {
    try {
      const [pendingSales, newProducts, newCustomers] = await Promise.all([
        DB._fetch('/api/sync/pending-sales'),
        DB._fetch('/api/sync/pending-products'),
        DB._fetch('/api/sync/pending-customers')
      ]);

      if (pendingSales.length === 0 && newProducts.length === 0 && newCustomers.length === 0) return;

      const payload = {
        branch_id: currentBranch.id,
        sales: pendingSales,
        products: newProducts,
        customers: newCustomers
      };

      const res = await fetch(`${this.syncServer}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': localStorage.getItem('authToken')
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();

      await this._applyPushResults(result);
      Utils.toast('Sync successful', 'success');
    } catch (e) {
      Utils.toast('Sync push failed: ' + e.message, 'error');
    }
  },

  startPeriodicSync() {
    const interval = parseInt(new URLSearchParams(location.search).get('syncInterval')) || 60000;
    setInterval(() => {
      this.push().then(() => this.pull());
    }, interval);
  },

  async _getSyncTimestamps() {
    const res = await fetch('/api/sync/status', {
      headers: { 'X-Auth-Token': localStorage.getItem('authToken') }
    });
    return res.json();
  },

  async _applyRemoteData(data) {
    for (const p of data.products || []) {
      await DB._fetch('/api/sync/upsert-product', { method: 'POST', body: JSON.stringify(p) });
    }
    for (const c of data.customers || []) {
      await DB._fetch('/api/sync/upsert-customer', { method: 'POST', body: JSON.stringify(c) });
    }
    if (data.stock_updates) {
      for (const stock of data.stock_updates) {
        await DB._fetch('/api/sync/update-stock', { method: 'POST', body: JSON.stringify(stock) });
      }
    }
  },

  async _applyPushResults(result) {
    for (const saleResult of result.sales || []) {
      if (saleResult.status === 'rejected') {
        await DB._fetch(`/api/sync/sale-status/${saleResult.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'rejected', error: saleResult.error })
        });
        // Reverse local stock deduction
        const sale = await DB._fetch(`/api/sales/${saleResult.id}`);
        for (const item of sale.items) {
          await DB._fetch('/api/sync/update-stock', {
            method: 'POST',
            body: JSON.stringify({ product_id: item.productId, stock: item.quantity }) // add back
          });
        }
        alert(`Sale ${saleResult.id} rejected: ${saleResult.error}. Stock corrected.`);
      } else {
        await DB._fetch(`/api/sync/sale-status/${saleResult.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'synced' })
        });
      }
    }
  }
};