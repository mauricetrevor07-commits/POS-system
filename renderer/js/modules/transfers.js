const Transfers = {
  transfers: [],
  branches: [],
  products: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div style="padding:40px; text-align:center;">Loading Transfers...</div>';

    try {
      const response = await fetch('/templates/transfers.html');
      if (!response.ok) throw new Error('Transfers template not found');
      
      container.innerHTML = await response.text();
      
      this.attachEvents();
      await this.load();
      
    } catch (error) {
      console.error(error);
      container.innerHTML = `<p style="color:red; padding:20px;">Failed to load Transfers: ${error.message}</p>`;
    }
  },

  attachEvents() {
    // Top Toolbar
    document.getElementById('btnRefreshTransfers')?.addEventListener('click', () => this.load());
    document.getElementById('btnNewTransfer')?.addEventListener('click', () => this.showNewTransferModal());

    // Filters
    document.getElementById('transferSearch')?.addEventListener('input', () => this.applyFilter());
    document.getElementById('transferStatusFilter')?.addEventListener('change', () => this.applyFilter());

    // Table Buttons (Event Delegation)
    document.getElementById('transfersListContainer')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'print') this.printVoucher(id);
      if (action === 'receive') this.receiveTransfer(id);
      if (action === 'cancel') this.cancelTransfer(id);
    });
  },

  async load() {
    const container = document.getElementById('transfersListContainer');
    if (container) container.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';

    try {
      const [transfers, branches, products] = await Promise.all([
        DB._fetch('/api/transfers'),
        DB._fetch('/api/branches').catch(() => [{ id: 1, name: 'Branch 1' }, { id: 2, name: 'Branch 2' }]),
        DB._fetch('/api/products')
      ]);
      
      this.transfers = transfers || [];
      this.branches = branches || [];
      this.products = products || [];

      this.updateKPIs();
      this.applyFilter();
    } catch (e) {
      if (container) container.innerHTML = `<p style="padding:20px; color:var(--danger);">Failed to load transfers: ${e.message}</p>`;
    }
  },

  updateKPIs() {
    const total = this.transfers.length;
    const pending = this.transfers.filter(t => t.status === 'pending').length;
    const received = this.transfers.filter(t => t.status === 'received').length;
    const cancelled = this.transfers.filter(t => t.status === 'cancelled').length;

    const elTotal = document.getElementById('kpiTotalTransfers');
    const elPending = document.getElementById('kpiPendingTransfers');
    const elReceived = document.getElementById('kpiReceivedTransfers');
    const elCancelled = document.getElementById('kpiCancelledTransfers');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elReceived) elReceived.textContent = received;
    if (elCancelled) elCancelled.textContent = cancelled;
  },

  applyFilter() {
    const query = (document.getElementById('transferSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('transferStatusFilter')?.value || '';

    const filtered = this.transfers.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!query) return true;

      const id = (t.id || '').toLowerCase();
      const fromName = (t.from_branch_name || '').toLowerCase();
      const toName = (t.to_branch_name || '').toLowerCase();
      const createdBy = (t.created_by || '').toLowerCase();
      const itemsStr = (t.items || []).map(i => (i.product_name || '').toLowerCase()).join(' ');

      return id.includes(query) || fromName.includes(query) || toName.includes(query) || createdBy.includes(query) || itemsStr.includes(query);
    });

    this.renderTable(filtered);
  },

  renderTable(list) {
    const container = document.getElementById('transfersListContainer');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--text-muted);">
          <i class="bi bi-arrow-left-right" style="font-size:2.5rem; color:var(--text-muted); display:block; margin-bottom:8px;"></i>
          <h4>No Stock Transfers Found</h4>
          <p>Click "New Stock Transfer" above to dispatch items from one branch to another.</p>
        </div>
      `;
      return;
    }

    const role = (typeof currentUser !== 'undefined' && currentUser?.role) || localStorage.getItem('userRole') || 'staff';
    const userBranch = (typeof currentUser !== 'undefined' && currentUser?.branch_id) || parseInt(localStorage.getItem('userBranchId') || '1');

    const rows = list.map(t => {
      const isPending = t.status === 'pending';
      const isReceived = t.status === 'received';
      const isCancelled = t.status === 'cancelled';

      let statusBadge = '<span class="badge badge-neutral">Pending</span>';
      if (isPending) statusBadge = '<span class="badge badge-warning"><i class="bi bi-truck"></i> In Transit</span>';
      else if (isReceived) statusBadge = '<span class="badge badge-success"><i class="bi bi-check-circle-fill"></i> Received</span>';
      else if (isCancelled) statusBadge = '<span class="badge badge-danger"><i class="bi bi-x-circle"></i> Cancelled</span>';

      const itemsSummary = (t.items || []).map(i => `<strong>${Utils.escapeHtml(i.product_name || 'Item')}</strong> &times; ${i.quantity}`).join('<br>');
      
      const canReceive = isPending && (role === 'admin' || userBranch === t.to_branch_id);
      const canCancel = isPending && (role === 'admin' || userBranch === t.from_branch_id);

      return `
        <tr>
          <td>
            <strong>TRF-${t.id.slice(0, 8).toUpperCase()}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(t.created_at).toLocaleString()}</div>
          </td>
          <td>
            <div style="font-weight:600; color:#0284c7;"><i class="bi bi-box-arrow-up-right"></i> ${Utils.escapeHtml(t.from_branch_name || `Branch ${t.from_branch_id}`)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">By: ${Utils.escapeHtml(t.created_by || 'Staff')}</div>
          </td>
          <td>
            <div style="font-weight:600; color:#166534;"><i class="bi bi-box-arrow-in-down-left"></i> ${Utils.escapeHtml(t.to_branch_name || `Branch ${t.to_branch_id}`)}</div>
            ${t.received_by ? `<div style="font-size:0.75rem; color:var(--text-muted);">Received By: ${Utils.escapeHtml(t.received_by)}</div>` : ''}
          </td>
          <td style="font-size:0.85rem;">
            ${itemsSummary || 'No items'}
            ${t.notes ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;"><em>Note: ${Utils.escapeHtml(t.notes)}</em></div>` : ''}
          </td>
          <td>${statusBadge}</td>
          <td class="text-right">
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-sm btn-outline" data-action="print" data-id="${t.id}" title="Print">
                <i class="bi bi-printer"></i>
              </button>
              ${canReceive ? `
                <button class="btn btn-sm btn-success" data-action="receive" data-id="${t.id}">
                  <i class="bi bi-box-arrow-in-down"></i> Receive
                </button>
              ` : ''}
              ${canCancel ? `
                <button class="btn btn-sm btn-danger" data-action="cancel" data-id="${t.id}">
                  <i class="bi bi-x-circle"></i> Cancel
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Transfer # / Date</th>
            <th>Source Branch</th>
            <th>Destination Branch</th>
            <th>Transferred Items & Qty</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  showNewTransferModal() {
    const role = (typeof currentUser !== 'undefined' && currentUser?.role) || localStorage.getItem('userRole') || 'staff';
    const userBranch = (typeof currentUser !== 'undefined' && currentUser?.branch_id) || parseInt(localStorage.getItem('userBranchId') || '1');

    const fromBranchSelect = role === 'admin'
      ? `<select id="modalFromBranch" class="form-control" onchange="Transfers.onSourceBranchChange()">
          <option value="1" ${userBranch === 1 ? 'selected' : ''}>Branch 1 (Nairobi - KPCU Godowns)</option>
          <option value="2" ${userBranch === 2 ? 'selected' : ''}>Branch 2</option>
        </select>`
      : `<input type="hidden" id="modalFromBranch" value="${userBranch}" />
         <div class="form-control" style="background:var(--bg-body); font-weight:600; border-color:transparent;">
           Branch ${userBranch} (${userBranch === 1 ? 'Nairobi - KPCU Godowns' : 'Branch 2'})
         </div>`;

    const destDefault = userBranch === 1 ? 2 : 1;

    Utils.showModal({
      title: '<i class="bi bi-truck" style="color:var(--primary);"></i> Initiate Stock Transfer',
      size: 'large',
      content: `
        <div style="padding:10px 0;">
          <div style="display:flex; gap:16px; margin-bottom:16px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Source Branch (Origin) *</label>
              ${fromBranchSelect}
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Destination Branch *</label>
              <select id="modalToBranch" class="form-control">
                <option value="1" ${destDefault === 1 ? 'selected' : ''}>Branch 1 (Nairobi - KPCU Godowns)</option>
                <option value="2" ${destDefault === 2 ? 'selected' : ''}>Branch 2</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Transfer Reason / Notes</label>
            <input id="modalTransferNotes" class="form-control" placeholder="e.g. Stock replenishment..." />
          </div>

          <div style="border-top:1px solid var(--border); padding-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <label style="font-weight:700; color:var(--text-main);">Items to Transfer</label>
              <button type="button" class="btn btn-sm btn-outline" id="btnAddAnotherItem">
                <i class="bi bi-plus-lg"></i> Add Another Item
              </button>
            </div>
            <div id="transferItemsRows" style="display:flex; flex-direction:column; gap:10px;">
              <!-- Rows injected here -->
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
        <button class="btn btn-primary" id="submitTransferBtn"><i class="bi bi-arrow-right-circle"></i> Dispatch Transfer</button>
      `
    });

    // Attach dynamic events for the modal
    document.getElementById('btnAddAnotherItem')?.addEventListener('click', () => this.addItemRow());
    
    // Add the first row
    this.addItemRow();

    document.getElementById('submitTransferBtn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      const fromBranch = parseInt(document.getElementById('modalFromBranch')?.value || userBranch);
      const toBranch = parseInt(document.getElementById('modalToBranch')?.value);
      const notes = document.getElementById('modalTransferNotes')?.value.trim();

      if (fromBranch === toBranch) return Utils.toast('Source and destination branches cannot be the same', 'warning');

      const rows = document.querySelectorAll('.transfer-item-row');
      const items = [];
      for (const r of rows) {
        const prodId = r.querySelector('.transfer-prod-select')?.value;
        const qty = parseFloat(r.querySelector('.transfer-qty-input')?.value || 0);
        if (!prodId) continue;
        if (qty <= 0) return Utils.toast('Transfer quantity must be greater than 0', 'warning');
        items.push({ product_id: prodId, quantity: qty });
      }

      if (!items.length) return Utils.toast('Please select at least one item to transfer', 'warning');

      btn.innerHTML = '<span class="spinner"></span> Processing...';
      btn.disabled = true;

      try {
        await DB._fetch('/api/transfers', {
          method: 'POST',
          body: JSON.stringify({ from_branch_id: fromBranch, to_branch_id: toBranch, notes, items })
        });
        
        document.querySelector('.modal-overlay')?.remove();
        Utils.toast('Stock transfer dispatched successfully!', 'success');
        await this.load();
      } catch (error) {
        Utils.toast(error.message, 'danger');
        btn.innerHTML = '<i class="bi bi-arrow-right-circle"></i> Dispatch Transfer';
        btn.disabled = false;
      }
    });
  },

  addItemRow() {
    const container = document.getElementById('transferItemsRows');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'transfer-item-row';
    row.style.cssText = 'display:flex; gap:10px; align-items:center; background:var(--bg-body); padding:10px 12px; border-radius:8px; border:1px solid var(--border);';

    const prodOptions = (this.products || []).map(p => {
      return `<option value="${p.id}">${Utils.escapeHtml(p.name)} (Avail: ${p.stock || 0})</option>`;
    }).join('');

    row.innerHTML = `
      <div style="flex:3;">
        <select class="form-control transfer-prod-select">
          <option value="">-- Select Product --</option>
          ${prodOptions}
        </select>
      </div>
      <div style="flex:1;">
        <input type="number" min="0.1" step="any" class="form-control transfer-qty-input" placeholder="Qty" />
      </div>
      <div>
        <button type="button" class="btn btn-danger btn-sm btn-remove-row">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    // Attach event to the trash button safely
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
  },

  async receiveTransfer(id) {
    if (!confirm('Confirm receipt of these items into your branch inventory?')) return;
    try {
      await DB._fetch(`/api/transfers/${id}/receive`, { method: 'PUT' });
      Utils.toast('Transfer received and inventory updated!', 'success');
      this.load();
    } catch (e) {
      Utils.toast(e.message, 'danger');
    }
  },

  async cancelTransfer(id) {
    if (!confirm('Cancel this transfer and return items to source branch?')) return;
    try {
      await DB._fetch(`/api/transfers/${id}/cancel`, { method: 'PUT' });
      Utils.toast('Transfer cancelled and stock refunded', 'warning');
      this.load();
    } catch (e) {
      Utils.toast(e.message, 'danger');
    }
  },

  printVoucher(id) {
    const t = this.transfers.find(item => item.id === id);
    if (!t) return Utils.toast('Transfer details not found', 'danger');

    // Assuming Utils has a generateTransferNoteHTML function
    const html = Utils.generateTransferNoteHTML(t, 2);
    const win = window.open('', '_blank');
    if (!win) return Utils.toast('Please allow popups to print voucher', 'warning');
    
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transfer Voucher - ${t.id.slice(0,8)}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }
};

window.Transfers = Transfers;