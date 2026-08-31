const Transfers = {
  transfers: [],
  branches: [],
  products: [],

  async render() {
    const container = document.getElementById('page-content');
    const role = (typeof currentUser !== 'undefined' && currentUser?.role) || localStorage.getItem('userRole') || 'staff';
    const userBranch = (typeof currentUser !== 'undefined' && currentUser?.branch_id) || parseInt(localStorage.getItem('userBranchId') || '1');

    container.innerHTML = `
      <div class="toolbar no-print">
        <div>
          <h2><i class="bi bi-arrow-left-right"></i> Inter-Branch Stock Transfers</h2>
          <div style="font-size:0.85rem; color:#64748b; margin-top:2px;">
            Transfer inventory between Branch 1 (Nairobi - KPCU Godowns) and Branch 2 with tracking.
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="Transfers.load()">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
          <button class="btn btn-primary" onclick="Transfers.showNewTransferModal()">
            <i class="bi bi-plus-circle"></i> New Stock Transfer
          </button>
        </div>
      </div>

      <!-- Summary KPI Row -->
      <div class="no-print" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:20px;">
        <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px 18px; box-shadow:var(--shadow-sm);">
          <span style="font-size:0.75rem; font-weight:700; color:#64748b; text-transform:uppercase;">Total Transfers</span>
          <div id="kpiTotalTransfers" style="font-size:1.5rem; font-weight:700; color:var(--primary); margin-top:4px;">0</div>
        </div>
        <div style="background:#fff; border:1px solid #fed7aa; border-radius:10px; padding:14px 18px; box-shadow:var(--shadow-sm);">
          <span style="font-size:0.75rem; font-weight:700; color:#c2410c; text-transform:uppercase;">In Transit / Pending</span>
          <div id="kpiPendingTransfers" style="font-size:1.5rem; font-weight:700; color:#ea580c; margin-top:4px;">0</div>
        </div>
        <div style="background:#fff; border:1px solid #bbf7d0; border-radius:10px; padding:14px 18px; box-shadow:var(--shadow-sm);">
          <span style="font-size:0.75rem; font-weight:700; color:#15803d; text-transform:uppercase;">Received & Completed</span>
          <div id="kpiReceivedTransfers" style="font-size:1.5rem; font-weight:700; color:#16a34a; margin-top:4px;">0</div>
        </div>
        <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px 18px; box-shadow:var(--shadow-sm);">
          <span style="font-size:0.75rem; font-weight:700; color:#64748b; text-transform:uppercase;">Cancelled</span>
          <div id="kpiCancelledTransfers" style="font-size:1.5rem; font-weight:700; color:#94a3b8; margin-top:4px;">0</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:12px 18px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <input type="text" id="transferSearch" class="form-control" placeholder="Search by transfer #, item name, branch or staff..." oninput="Transfers.applyFilter()" />
          </div>
          <div style="min-width:150px;">
            <select id="transferStatusFilter" class="form-control" onchange="Transfers.applyFilter()">
              <option value="">All Statuses</option>
              <option value="pending">In Transit (Pending)</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body" id="transfersListContainer" style="padding:0; overflow-x:auto;">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;

    await this.load();
  },

  async load() {
    try {
      const [transfers, branches, products] = await Promise.all([
        DB._fetch('/api/transfers'),
        DB._fetch('/api/branches').catch(() => [{ id: 1, name: 'Branch 1 (Nairobi - KPCU Godowns)' }, { id: 2, name: 'Branch 2' }]),
        DB._fetch('/api/products')
      ]);
      this.transfers = transfers || [];
      this.branches = branches || [];
      this.products = products || [];

      this.updateKPIs();
      this.applyFilter();
    } catch (e) {
      document.getElementById('transfersListContainer').innerHTML = `<p style="padding:20px; color:#ef4444;">Failed to load transfers: ${e.message}</p>`;
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
        <div style="padding:40px; text-align:center; color:#64748b;">
          <i class="bi bi-arrow-left-right" style="font-size:2.5rem; color:#94a3b8; display:block; margin-bottom:8px;"></i>
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

      let statusBadge = '<span class="badge badge-secondary">Pending</span>';
      if (isPending) {
        statusBadge = '<span class="badge badge-warning" style="background:#fef3c7; color:#b45309; font-weight:700;"><i class="bi bi-truck"></i> In Transit</span>';
      } else if (isReceived) {
        statusBadge = '<span class="badge badge-success" style="background:#dcfce7; color:#15803d; font-weight:700;"><i class="bi bi-check-circle-fill"></i> Received</span>';
      } else if (isCancelled) {
        statusBadge = '<span class="badge badge-danger" style="background:#fee2e2; color:#b91c1c; font-weight:600;"><i class="bi bi-x-circle"></i> Cancelled</span>';
      }

      const itemsSummary = (t.items || []).map(i => `<strong>${Utils.escapeHtml(i.product_name || 'Item')}</strong> &times; ${i.quantity}`).join('<br>');
      const canReceive = isPending && (role === 'admin' || userBranch === t.to_branch_id);
      const canCancel = isPending && (role === 'admin' || userBranch === t.from_branch_id);

      return `
        <tr>
          <td>
            <strong>TRF-${t.id.slice(0, 8).toUpperCase()}</strong>
            <div style="font-size:0.75rem; color:#64748b;">${new Date(t.created_at).toLocaleString()}</div>
          </td>
          <td>
            <div style="font-weight:600; color:#0284c7;"><i class="bi bi-box-arrow-up-right"></i> ${Utils.escapeHtml(t.from_branch_name || `Branch ${t.from_branch_id}`)}</div>
            <div style="font-size:0.75rem; color:#64748b;">By: ${Utils.escapeHtml(t.created_by || 'Staff')}</div>
          </td>
          <td>
            <div style="font-weight:600; color:#166534;"><i class="bi bi-box-arrow-in-down-left"></i> ${Utils.escapeHtml(t.to_branch_name || `Branch ${t.to_branch_id}`)}</div>
            ${t.received_by ? `<div style="font-size:0.75rem; color:#64748b;">Received By: ${Utils.escapeHtml(t.received_by)}</div>` : ''}
          </td>
          <td style="font-size:0.85rem;">
            ${itemsSummary || 'No items'}
            ${t.notes ? `<div style="font-size:0.75rem; color:#64748b; margin-top:2px;"><em>Note: ${Utils.escapeHtml(t.notes)}</em></div>` : ''}
          </td>
          <td>${statusBadge}</td>
          <td class="text-right">
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-sm btn-outline" onclick="Transfers.printVoucher('${t.id}')" title="Print Stock Transfer Voucher">
                <i class="bi bi-printer"></i> Voucher
              </button>
              ${canReceive ? `
                <button class="btn btn-sm btn-success" onclick="Transfers.receiveTransfer('${t.id}')" title="Confirm Receipt at Destination Branch">
                  <i class="bi bi-box-arrow-in-down"></i> Receive Stock
                </button>
              ` : ''}
              ${canCancel ? `
                <button class="btn btn-sm btn-danger" onclick="Transfers.cancelTransfer('${t.id}')" title="Cancel Transfer and Return Stock">
                  <i class="bi bi-x-circle"></i> Cancel
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
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
        <tbody>
          ${rows}
        </tbody>
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
         <div class="form-control" style="background:#f1f5f9; font-weight:600;">
           Branch ${userBranch} (${userBranch === 1 ? 'Nairobi - KPCU Godowns' : 'Branch 2'})
         </div>`;

    const destDefault = userBranch === 1 ? 2 : 1;

    const content = `
      <div style="padding:10px 0;">
        <div style="display:flex; gap:16px; margin-bottom:16px;">
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Source Branch (Origin) *</label>
            ${fromBranchSelect}
          </div>
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Destination Branch *</label>
            <select id="modalToBranch" class="form-control">
              <option value="1" ${destDefault === 1 ? 'selected' : ''}>Branch 1 (Nairobi - KPCU Godowns)</option>
              <option value="2" ${destDefault === 2 ? 'selected' : ''}>Branch 2</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label style="font-weight:600; margin-bottom:4px; display:block;">Transfer Reason / Notes</label>
          <input id="modalTransferNotes" class="form-control" placeholder="e.g. Stock replenishment, customer request transfer..." />
        </div>

        <div style="border-top:1px solid var(--border); padding-top:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-weight:700; color:#1e293b;">Items to Transfer</label>
            <button type="button" class="btn btn-sm btn-outline" onclick="Transfers.addItemRow()">
              <i class="bi bi-plus-lg"></i> Add Another Item
            </button>
          </div>
          <div id="transferItemsRows" style="display:flex; flex-direction:column; gap:10px;">
            <!-- Initial item row -->
          </div>
        </div>
      </div>
    `;

    const { close } = Utils.showModal({
      title: '<i class="bi bi-truck" style="color:var(--primary);"></i> Initiate Stock Transfer',
      content,
      size: 'large',
      footer: `
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
        <button class="btn btn-primary" id="submitTransferBtn"><i class="bi bi-arrow-right-circle"></i> Dispatch Transfer</button>
      `
    });

    Transfers.addItemRow();

    document.getElementById('submitTransferBtn')?.addEventListener('click', async () => {
      const fromBranch = parseInt(document.getElementById('modalFromBranch')?.value || userBranch);
      const toBranch = parseInt(document.getElementById('modalToBranch')?.value);
      const notes = document.getElementById('modalTransferNotes')?.value.trim();

      if (fromBranch === toBranch) {
        return Utils.toast('Source and destination branches cannot be the same', 'error');
      }

      const rows = document.querySelectorAll('.transfer-item-row');
      const items = [];
      for (const r of rows) {
        const prodSelect = r.querySelector('.transfer-prod-select');
        const qtyInput = r.querySelector('.transfer-qty-input');
        const prodId = prodSelect?.value;
        const qty = parseFloat(qtyInput?.value || 0);

        if (!prodId) continue;
        if (qty <= 0) {
          return Utils.toast('Transfer quantity must be greater than 0', 'error');
        }
        items.push({ product_id: prodId, quantity: qty });
      }

      if (!items.length) {
        return Utils.toast('Please select at least one item to transfer', 'error');
      }

      try {
        const res = await DB._fetch('/api/transfers', {
          method: 'POST',
          body: JSON.stringify({
            from_branch_id: fromBranch,
            to_branch_id: toBranch,
            notes,
            items
          })
        });

        Utils.toast('Stock transfer dispatched successfully!', 'success');
        close();
        await this.load();
      } catch (e) {
        Utils.toast(e.message, 'error');
      }
    });
  },

  addItemRow() {
    const container = document.getElementById('transferItemsRows');
    if (!container) return;

    const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const row = document.createElement('div');
    row.className = 'transfer-item-row';
    row.id = rowId;
    row.style.cssText = 'display:flex; gap:10px; align-items:center; background:#f8fafc; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0;';

    const prodOptions = (this.products || []).map(p => {
      const stock = p.stock || 0;
      return `<option value="${p.id}">${Utils.escapeHtml(p.name)} (Avail: ${stock})</option>`;
    }).join('');

    row.innerHTML = `
      <div style="flex:3;">
        <select class="form-control transfer-prod-select">
          <option value="">-- Select Product to Transfer --</option>
          ${prodOptions}
        </select>
      </div>
      <div style="flex:1;">
        <input type="number" min="0.1" step="any" class="form-control transfer-qty-input" placeholder="Quantity" />
      </div>
      <div>
        <button type="button" class="btn btn-sm btn-outline text-danger" onclick="document.getElementById('${rowId}')?.remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    container.appendChild(row);
  },

  async receiveTransfer(id) {
    if (!confirm('Confirm receipt of these items into your branch inventory?')) return;
    try {
      await DB._fetch(`/api/transfers/${id}/receive`, { method: 'PUT' });
      Utils.toast('Transfer received and local inventory updated successfully!', 'success');
      this.load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  async cancelTransfer(id) {
    if (!confirm('Cancel this transfer and return items to source branch inventory?')) return;
    try {
      await DB._fetch(`/api/transfers/${id}/cancel`, { method: 'PUT' });
      Utils.toast('Transfer cancelled and stock refunded to source branch', 'warning');
      this.load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  printVoucher(id) {
    const t = this.transfers.find(item => item.id === id);
    if (!t) return Utils.toast('Transfer details not found', 'error');

    const html = Utils.generateTransferNoteHTML(t, 2);
    const win = window.open('', '_blank');
    if (!win) {
      return Utils.toast('Please allow popups to print transfer voucher', 'warning');
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Transfer Voucher - TRF-${t.id.slice(0,8).toUpperCase()}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; }
            .doc-container { max-width: 800px; margin: 0 auto 30px auto; border: 1px solid #cbd5e1; padding: 24px; border-radius: 8px; }
            .header-table { width: 100%; margin-bottom: 16px; border-bottom: 2px solid #0284c7; padding-bottom: 12px; }
            .company-title { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
            .company-sub { font-size: 0.8rem; color: #64748b; line-height: 1.4; margin-top: 4px; }
            .meta-box { width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
            .meta-box td { padding: 8px 12px; vertical-align: top; }
            .meta-label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .meta-value { font-size: 0.95rem; font-weight: 600; color: #0f172a; margin-top: 2px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .items-table th { background: #f1f5f9; padding: 8px 10px; font-size: 0.8rem; font-weight: 700; text-align: left; border: 1px solid #cbd5e1; }
            .items-table td { padding: 8px 10px; font-size: 0.85rem; border: 1px solid #e2e8f0; }
            .sign-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 24px; }
            .sign-box { border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; font-size: 0.8rem; min-height: 70px; background: #fafafa; }
            .page-break { page-break-after: always; margin-bottom: 40px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
};
