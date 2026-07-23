const Sync = {
  syncServer: '',

  init(url) {
    this.syncServer = url;
    if (!url) {
      console.log('Sync disabled – running offline demo.');
      return;
    }
    this.startPeriodicSync();
  },

  async pull() {
    if (!this.syncServer) return;
    try {
      const localRow = await this._getSyncTimestamps();
      const res = await fetch(`${this.syncServer}/api/sync/pull?since=${localRow.last_pull_timestamp}`, {
        headers: { 'X-Auth-Token': localStorage.getItem('authToken') || 'demo-token-12345' }
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
    if (!this.syncServer) return;
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
          'X-Auth-Token': localStorage.getItem('authToken') || 'demo-token-12345'
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
    setInterval(() => {
      this.push().then(() => this.pull());
    }, 60000);
  },

  async _getSyncTimestamps() {
    return DB._fetch('/api/sync/status');
  },

  async _applyRemoteData(data) {},
  async _applyPushResults(result) {}
};