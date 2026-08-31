const AdminPayments = {
  payments: [],
  filteredPayments: [],
  creditAlerts: null,
  activeTab: 'pending', // 'pending' or 'credit'

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2><i class="bi bi-shield-check"></i> Admin Payment Approvals & Credit Alerts</h2>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="AdminPayments.refresh()">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      <!-- Overdue Alert Banner (if any) -->
      <div id="creditAlertBanner" style="display:none; margin-bottom:16px;"></div>

      <!-- Navigation Tabs -->
      <div class="no-print" style="display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:8px;">
        <button id="tabPendingBtn" class="btn ${this.activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}" onclick="AdminPayments.switchTab('pending')">
          <i class="bi bi-hourglass-split"></i> Pending Payment Approvals
          <span id="pendingCountBadge" class="badge badge-warning" style="margin-left:6px;">0</span>
        </button>
        <button id="tabCreditBtn" class="btn ${this.activeTab === 'credit' ? 'btn-primary' : 'btn-outline'}" onclick="AdminPayments.switchTab('credit')">
          <i class="bi bi-exclamation-triangle"></i> Credit Sales Due Alerts
          <span id="creditOverdueBadge" class="badge badge-danger" style="margin-left:6px; display:none;">0</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="adminPaymentsTabContent">
        <div class="loading-spinner"></div>
      </div>
    `;

    await this.refresh();
  },

  async refresh() {
    await Promise.all([this.loadPending(), this.loadCreditAlerts()]);
    this.renderCurrentTab();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.getElementById('tabPendingBtn')?.classList.toggle('btn-primary', tab === 'pending');
    document.getElementById('tabPendingBtn')?.classList.toggle('btn-outline', tab !== 'pending');
    document.getElementById('tabCreditBtn')?.classList.toggle('btn-primary', tab === 'credit');
    document.getElementById('tabCreditBtn')?.classList.toggle('btn-outline', tab !== 'credit');
    this.renderCurrentTab();
  },

  async loadPending() {
    try {
      this.payments = await DB._fetch('/api/pending-payments');
      const badge = document.getElementById('pendingCountBadge');
      if (badge) badge.textContent = this.payments.length;
    } catch (e) {
      console.error('Failed to load pending payments:', e);
    }
  },

  async loadCreditAlerts() {
    try {
      this.creditAlerts = await DB._fetch('/api/credit-alerts');
      const banner = document.getElementById('creditAlertBanner');
      const overdueBadge = document.getElementById('creditOverdueBadge');

      if (this.creditAlerts && this.creditAlerts.overdue_count > 0) {
        if (overdueBadge) {
          overdueBadge.textContent = `${this.creditAlerts.overdue_count} Overdue`;
          overdueBadge.style.display = 'inline-block';
        }
        if (banner) {
          banner.style.display = 'block';
          banner.innerHTML = `
            <div style="background:#fef2f2; border:1px solid #f87171; border-radius:8px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; color:#991b1b;">
              <div style="display:flex; align-items:center; gap:12px;">
                <i class="bi bi-exclamation-octagon-fill" style="font-size:1.6rem; color:#dc2626;"></i>
                <div>
                  <strong style="font-size:1rem;">Credit Payment Alert: ${this.creditAlerts.overdue_count} sale(s) have passed their due date!</strong>
                  <div style="font-size:0.85rem; color:#b91c1c; margin-top:2px;">Immediate follow-up required with customers. Click tab to review and record settlements.</div>
                </div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="AdminPayments.switchTab('credit')">View Credit Due</button>
            </div>
          `;
        }
      } else if (this.creditAlerts && this.creditAlerts.due_today_count > 0) {
        if (banner) {
          banner.style.display = 'block';
          banner.innerHTML = `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 18px; display:flex; align-items:center; justify-content:space-between; color:#92400e;">
              <div style="display:flex; align-items:center; gap:12px;">
                <i class="bi bi-clock-history" style="font-size:1.4rem; color:#d97706;"></i>
                <div>
                  <strong>${this.creditAlerts.due_today_count} Credit Sale(s) are due TODAY.</strong>
                </div>
              </div>
              <button class="btn btn-sm btn-warning" onclick="AdminPayments.switchTab('credit')">View</button>
            </div>
          `;
        }
      } else if (banner) {
        banner.style.display = 'none';
      }
    } catch (e) {
      console.error('Failed to load credit alerts:', e);
    }
  },

  renderCurrentTab() {
    const content = document.getElementById('adminPaymentsTabContent');
    if (!content) return;

    if (this.activeTab === 'pending') {
      this.renderPendingTab(content);
    } else {
      this.renderCreditTab(content);
    }
  },

  renderPendingTab(container) {
    let totalPendingAmount = 0;
    this.payments.forEach(p => totalPendingAmount += parseFloat(p.total || 0));

    const html = this.payments.map(p => {
      const itemsStr = (p.items || []).map(i => `${Utils.escapeHtml(i.productname)} (x${i.quantity})`).join(', ');
      const branchStr = p.branch_name || `Branch ${p.branch_id || 1}`;
      return `
        <div style="padding:18px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div style="flex:2; min-width:280px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <strong style="font-size:1.1rem; color:#0f172a;">Sale #${p.id.slice(0, 8).toUpperCase()}</strong>
              <span class="badge badge-warning">Awaiting Approval</span>
              <span class="badge badge-secondary"><i class="bi bi-geo-alt"></i> ${Utils.escapeHtml(branchStr)}</span>
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

    container.innerHTML = `
      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:0.95rem; font-weight:600; color:var(--primary);">
            <strong>${this.payments.length}</strong> Pending Orders (Total: <strong>KES ${Utils.formatCurrency(totalPendingAmount)}</strong>)
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0;">
          ${html || '<div style="padding:40px; text-align:center; color:#64748b;"><i class="bi bi-check-circle" style="font-size:2.5rem; color:var(--success); display:block; margin-bottom:8px;"></i>All payments have been reviewed and approved. No pending sales!</div>'}
        </div>
      </div>
    `;
  },

  renderCreditTab(container) {
    if (!this.creditAlerts || !this.creditAlerts.all || !this.creditAlerts.all.length) {
      container.innerHTML = `
        <div class="card">
          <div class="card-body" style="padding:40px; text-align:center; color:#64748b;">
            <i class="bi bi-check2-all" style="font-size:3rem; color:var(--success); display:block; margin-bottom:10px;"></i>
            <h3>No Outstanding Credit Sales</h3>
            <p>All credit sales have either been paid or none are due at this time.</p>
          </div>
        </div>
      `;
      return;
    }

    const rows = this.creditAlerts.all.map(sale => {
      const dueDate = sale.due_date ? new Date(sale.due_date).toLocaleDateString() : 'Not Set';
      let statusBadge = '<span class="badge badge-secondary">Upcoming</span>';
      let rowBg = '#fff';

      if (sale.alert_level === 'overdue') {
        statusBadge = `<span class="badge badge-danger" style="background:#ef4444; color:#fff; font-weight:700;"><i class="bi bi-exclamation-diamond-fill"></i> OVERDUE (${Math.abs(Math.floor(sale.days_until_due))} days)</span>`;
        rowBg = '#fff5f5';
      } else if (sale.alert_level === 'due_today') {
        statusBadge = '<span class="badge badge-warning" style="background:#f59e0b; color:#fff; font-weight:700;"><i class="bi bi-clock-fill"></i> DUE TODAY</span>';
        rowBg = '#fffbeb';
      } else if (sale.alert_level === 'due_soon') {
        statusBadge = `<span class="badge" style="background:#fef08a; color:#854d0e; font-weight:700;"><i class="bi bi-hourglass-top"></i> Due in ${Math.floor(sale.days_until_due)} days</span>`;
      }

      const branchName = sale.branch_name || `Branch ${sale.branch_id || 1}`;

      return `
        <tr style="background:${rowBg};">
          <td>
            <strong>Sale #${sale.id.slice(0, 8).toUpperCase()}</strong>
            <div style="font-size:0.75rem; color:#64748b;">${new Date(sale.timestamp).toLocaleString()}</div>
            <div style="font-size:0.75rem; color:#0284c7;"><i class="bi bi-geo-alt"></i> ${Utils.escapeHtml(branchName)}</div>
          </td>
          <td>
            <strong>${Utils.escapeHtml(sale.customer_name || 'Walk-in Customer')}</strong>
            ${sale.customer_phone ? `<div style="font-size:0.8rem; color:#475569;"><i class="bi bi-telephone"></i> <a href="tel:${Utils.escapeHtml(sale.customer_phone)}">${Utils.escapeHtml(sale.customer_phone)}</a></div>` : ''}
            ${sale.customer_kra_pin ? `<div style="font-size:0.75rem; color:#64748b;">PIN: ${Utils.escapeHtml(sale.customer_kra_pin)}</div>` : ''}
          </td>
          <td>
            <div style="font-size:0.85rem; font-weight:600; color:#1e293b;">${Utils.escapeHtml(sale.credit_terms || 'Standard Credit')}</div>
            <div style="font-size:0.8rem; color:#64748b;">Due Date: <strong>${dueDate}</strong></div>
          </td>
          <td>${statusBadge}</td>
          <td class="text-right" style="font-size:1.1rem; font-weight:700; color:var(--primary);">
            KES ${Utils.formatCurrency(sale.total)}
          </td>
          <td class="text-right">
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-sm btn-outline" onclick="Utils.showPrintDialog(${JSON.stringify(sale).replace(/"/g, '&quot;')})" title="Print Invoice / Delivery Note">
                <i class="bi bi-printer"></i>
              </button>
              <button class="btn btn-sm btn-success" onclick="AdminPayments.showSettleModal('${sale.id}', '${Utils.escapeHtml(sale.customer_name || 'Customer').replace(/'/g, "\\'")}', ${parseFloat(sale.total)})">
                <i class="bi bi-cash-coin"></i> Settle / Mark Paid
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="card">
        <div class="card-body" style="padding:0; overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Sale ID & Branch</th>
                <th>Customer & Contact</th>
                <th>Credit Terms & Due Date</th>
                <th>Due Status</th>
                <th class="text-right">Amount (KES)</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  showSettleModal(saleId, customerName, amount) {
    const content = `
      <div style="padding:10px 0;">
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px; margin-bottom:16px;">
          <div style="font-size:0.85rem; color:#166534;">Settle Credit Sale</div>
          <div style="font-size:1.2rem; font-weight:700; color:#15803d; margin-top:2px;">Customer: ${Utils.escapeHtml(customerName)}</div>
          <div style="font-size:1rem; font-weight:600; color:#166534; margin-top:4px;">Total Amount: KES ${Utils.formatCurrency(amount)}</div>
        </div>
        <div class="form-group">
          <label style="font-weight:600; margin-bottom:4px; display:block;">Payment / Settlement Reference *</label>
          <input id="settlePaymentRef" class="form-control" placeholder="e.g. MPESA Ref / Bank Cheque No. / Cash Receipt" value="SETTLED-MPESA-${new Date().toISOString().slice(0,10)}" />
          <small style="color:#64748b; font-size:0.75rem;">This reference will be permanently recorded against this sale invoice.</small>
        </div>
      </div>
    `;

    const { close } = Utils.showModal({
      title: '<i class="bi bi-cash-coin" style="color:#16a34a;"></i> Settle Credit Payment',
      content,
      footer: `
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
        <button class="btn btn-success" id="confirmSettleCreditBtn"><i class="bi bi-check-circle"></i> Confirm Full Payment</button>
      `
    });

    document.getElementById('confirmSettleCreditBtn')?.addEventListener('click', async () => {
      const ref = document.getElementById('settlePaymentRef')?.value.trim();
      if (!ref) return Utils.toast('Payment Reference is required to settle credit', 'error');

      try {
        await DB._fetch(`/api/sales/${saleId}/settle-credit`, {
          method: 'PUT',
          body: JSON.stringify({ payment_reference: ref })
        });
        Utils.toast('Credit sale settled and marked paid successfully', 'success');
        close();
        this.refresh();
      } catch (e) {
        Utils.toast(e.message, 'error');
      }
    });
  },

  async approve(saleId) {
    try {
      await DB._fetch(`/api/payments/${saleId}/approve`, { method: 'PUT' });
      Utils.toast('Payment approved! Stock deducted and sale confirmed.', 'success');
      this.refresh();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  async reject(saleId) {
    if (!confirm('Reject this sale and payment reference?')) return;
    try {
      await DB._fetch(`/api/payments/${saleId}/reject`, { method: 'PUT' });
      Utils.toast('Sale and payment rejected', 'warning');
      this.refresh();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }
};