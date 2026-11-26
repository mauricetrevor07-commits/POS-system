/**
 * Admin Payments Module
 * Handles Pending Payment Approvals and Credit Alerts.
 */
const AdminPayments = {
  payments: [],
  creditAlerts: null,
  activeTab: 'pending', // 'pending' or 'credit'

  /**
   * Entry point. Fetches the HTML template and injects it, then loads data.
   */
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div style="padding:40px; text-align:center;">Loading...</div>';

    try {
      const response = await fetch('/templates/pending-payments.html');
      if (!response.ok) throw new Error('Template not found');
      
      container.innerHTML = await response.text();

      document.getElementById('btnRefreshPayments')?.addEventListener('click', () => this.refresh());
      document.getElementById('tabPendingBtn')?.addEventListener('click', () => this.switchTab('pending'));
      document.getElementById('tabCreditBtn')?.addEventListener('click', () => this.switchTab('credit'));


      // Apply the correct tab styling and render the active tab content
      this.switchTab(this.activeTab);

    } catch (error) {
      console.error('Failed to render AdminPayments:', error);
      container.innerHTML = `<p style="color: var(--danger); padding:20px;">Failed to load credit alerts: ${error.message}</p>`;
    }
  },

  /**
   * Fetches data from the backend and updates the views.
   */
  async refresh() {
    // Show loading state in the tab content area
    const content = document.getElementById('adminPaymentsTabContent');
    if (content) content.innerHTML = '<div class="loading-spinner"></div>';

    // Fetch both endpoints concurrently for speed
    await Promise.all([this.loadPending(), this.loadCreditAlerts()]);
    
    // Re-render the currently active tab
    this.renderCurrentTab();
  },

  /**
   * Switches between 'pending' and 'credit' tabs.
   */
  switchTab(tab) {
    this.activeTab = tab;
    
    // Update button styles
    const pendingBtn = document.getElementById('tabPendingBtn');
    const creditBtn = document.getElementById('tabCreditBtn');

    if (pendingBtn && creditBtn) {
      pendingBtn.className = tab === 'pending' ? 'btn btn-primary' : 'btn btn-outline';
      creditBtn.className = tab === 'credit' ? 'btn btn-primary' : 'btn btn-outline';
    }

    // Load fresh data for the tab
    this.refresh();
  },

  /**
   * API Call: Load pending payments.
   */
  async loadPending() {
    try {
      this.payments = await DB._fetch('/api/pending');
      
      const badge = document.getElementById('pendingCountBadge');
      if (badge) badge.textContent = this.payments.length;
    } catch (e) {
      console.error('Failed to load pending payments:', e);
      Utils.toast('Failed to load pending payments', 'danger');
    }
  },

  /**
   * API Call: Load credit alerts and update the alert banner.
   */
  async loadCreditAlerts() {
    try {
      this.creditAlerts = await DB._fetch('/api/payments/credit-alerts');
      const banner = document.getElementById('creditAlertBanner');
      const overdueBadge = document.getElementById('creditOverdueBadge');

      if (!banner) return;

      // Handle Overdue Alerts
      if (this.creditAlerts?.overdue_count > 0) {
        if (overdueBadge) {
          overdueBadge.textContent = `${this.creditAlerts.overdue_count} Overdue`;
          overdueBadge.style.display = 'inline-block';
        }
        
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
            <button class="btn btn-sm btn-danger" id="btnViewOverdue">View Credit Due</button>
          </div>
        `;
        
        // Bind event listener properly
        document.getElementById('btnViewOverdue')?.addEventListener('click', () => this.switchTab('credit'));

      } 
      // Handle Due Today Alerts
      else if (this.creditAlerts?.due_today_count > 0) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 18px; display:flex; align-items:center; justify-content:space-between; color:#92400e;">
            <div style="display:flex; align-items:center; gap:12px;">
              <i class="bi bi-clock-history" style="font-size:1.4rem; color:#d97706;"></i>
              <div><strong>${this.creditAlerts.due_today_count} Credit Sale(s) are due TODAY.</strong></div>
            </div>
            <button class="btn btn-sm btn-warning" id="btnViewDueToday">View</button>
          </div>
        `;
        
        // Bind event listener properly
        document.getElementById('btnViewDueToday')?.addEventListener('click', () => this.switchTab('credit'));
      } 
      // No alerts
      else {
        banner.style.display = 'none';
      }
    } catch (e) {
      console.error('Failed to load credit alerts:', e);
    }
  },

  /**
   * Delegates rendering to the correct tab function.
   */
  renderCurrentTab() {
    const content = document.getElementById('adminPaymentsTabContent');
    if (!content) return;

    if (this.activeTab === 'pending') {
      this.renderPendingTab(content);
    } else {
      this.renderCreditTab(content);
    }
  },

  /**
   * Renders the Pending Payments tab using <template> tags.
   */
  renderPendingTab(container) {
    let totalPendingAmount = 0;
    this.payments.forEach(p => totalPendingAmount += parseFloat(p.total || 0));

    // Setup the layout
    container.innerHTML = `
      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:0.95rem; font-weight:600; color:var(--primary);">
            <strong>${this.payments.length}</strong> Pending Orders (Total: <strong>KES ${Utils.formatCurrency(totalPendingAmount)}</strong>)
          </div>
        </div>
      </div>
      <div class="card"><div class="card-body" id="pendingListContainer" style="padding:0;"></div></div>
    `;

    const listContainer = document.getElementById('pendingListContainer');
    
    if (this.payments.length === 0) {
      listContainer.innerHTML = `
        <div style="padding:40px; text-align:center; color:#64748b;">
          <i class="bi bi-check-circle" style="font-size:2.5rem; color:var(--success); display:block; margin-bottom:8px;"></i>
          All payments have been reviewed and approved. No pending sales!
        </div>`;
      return;
    }

    const template = document.getElementById('tpl-pending-row');
    const fragment = document.createDocumentFragment();

    this.payments.forEach(p => {
      const clone = template.content.cloneNode(true);
      
      // Populate text securely
      clone.querySelector('.data-sale-id').textContent = `Sale #${p.id.slice(0, 8).toUpperCase()}`;
      clone.querySelector('.data-branch').textContent = p.branch_name || `Branch ${p.branch_id || 1}`;
      clone.querySelector('.data-time').textContent = new Date(p.timestamp).toLocaleString();
      clone.querySelector('.data-customer').textContent = p.customer_name || 'Walk-in Customer';
      
      const itemsStr = (p.items || []).map(i => `${i.productname} (x${i.quantity})`).join(', ');
      clone.querySelector('.data-items').textContent = itemsStr || 'No items listed';
      clone.querySelector('.data-method').textContent = (p.paymentMethod || 'Mobile Money').toUpperCase();
      clone.querySelector('.data-ref').textContent = p.payment_reference || 'N/A';
      clone.querySelector('.data-total').textContent = `KES ${Utils.formatCurrency(p.total)}`;

      // Bind events via addEventListener (No more inline onclick)
      clone.querySelector('.btn-approve').addEventListener('click', () => this.approve(p.id));
      clone.querySelector('.btn-reject').addEventListener('click', () => this.reject(p.id));
      clone.querySelector('.btn-print').addEventListener('click', () => Utils.showPrintDialog(p));

      fragment.appendChild(clone);
    });

    listContainer.appendChild(fragment);
  },

  /**
   * Renders the Credit Alerts tab using <template> tags.
   */
  renderCreditTab(container) {
    if (!this.creditAlerts?.all?.length) {
      container.innerHTML = `
        <div class="card">
          <div class="card-body" style="padding:40px; text-align:center; color:#64748b;">
            <i class="bi bi-check2-all" style="font-size:3rem; color:var(--success); display:block; margin-bottom:10px;"></i>
            <h3>No Outstanding Credit Sales</h3>
            <p>All credit sales have either been paid or none are due at this time.</p>
          </div>
        </div>`;
      return;
    }

    // Setup the table layout
    container.innerHTML = `
      <div class="card">
        <div class="card-body" style="padding:0; overflow-x:auto;">
          <table class="data-table">
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
            <tbody id="creditListContainer"></tbody>
          </table>
        </div>
      </div>
    `;

    const listContainer = document.getElementById('creditListContainer');
    const template = document.getElementById('tpl-credit-row');
    const fragment = document.createDocumentFragment();

    this.creditAlerts.all.forEach(sale => {
      const clone = template.content.cloneNode(true);
      const tr = clone.querySelector('tr');
      
      clone.querySelector('.data-sale-id').textContent = `Sale #${sale.id.slice(0, 8).toUpperCase()}`;
      clone.querySelector('.data-time').textContent = new Date(sale.timestamp).toLocaleString();
      clone.querySelector('.data-branch').innerHTML = `<i class="bi bi-geo-alt"></i> ${Utils.escapeHtml(sale.branch_name || `Branch ${sale.branch_id}`)}`;
      
      clone.querySelector('.data-customer').textContent = sale.customer_name || 'Walk-in Customer';
      if (sale.customer_phone) {
        clone.querySelector('.data-contact').innerHTML = `<i class="bi bi-telephone"></i> <a href="tel:${Utils.escapeHtml(sale.customer_phone)}">${Utils.escapeHtml(sale.customer_phone)}</a>`;
      } else if (sale.customer_kra_pin) {
        clone.querySelector('.data-contact').textContent = `PIN: ${sale.customer_kra_pin}`;
      }

      clone.querySelector('.data-terms').textContent = sale.credit_terms || 'Standard Credit';
      clone.querySelector('.data-due-date').innerHTML = `Due Date: <strong>${sale.due_date ? new Date(sale.due_date).toLocaleDateString() : 'Not Set'}</strong>`;
      
      // Status Badge Logic
      let statusBadge = '<span class="badge badge-secondary">Upcoming</span>';
      if (sale.alert_level === 'overdue') {
        statusBadge = `<span class="badge badge-danger" style="background:#ef4444; color:#fff; font-weight:700;"><i class="bi bi-exclamation-diamond-fill"></i> OVERDUE (${Math.abs(Math.floor(sale.days_until_due))} days)</span>`;
        tr.style.background = '#fff5f5';
      } else if (sale.alert_level === 'due_today') {
        statusBadge = '<span class="badge badge-warning" style="background:#f59e0b; color:#fff; font-weight:700;"><i class="bi bi-clock-fill"></i> DUE TODAY</span>';
        tr.style.background = '#fffbeb';
      }
      
      clone.querySelector('.data-status').innerHTML = statusBadge;
      clone.querySelector('.data-total').textContent = `KES ${Utils.formatCurrency(sale.total)}`;

      // Bind events
      clone.querySelector('.btn-settle').addEventListener('click', () => this.showSettleModal(sale.id, sale.customer_name || 'Customer', sale.total));
      clone.querySelector('.btn-print').addEventListener('click', () => Utils.showPrintDialog(sale));

      fragment.appendChild(clone);
    });

    listContainer.appendChild(fragment);
  },

  /**
   * Shows a modal to confirm settling a credit sale.
   */
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
        <button class="btn btn-outline" id="btnCancelSettle">Cancel</button>
        <button class="btn btn-success" id="confirmSettleCreditBtn"><i class="bi bi-check-circle"></i> Confirm Full Payment</button>
      `
    });

    document.getElementById('btnCancelSettle')?.addEventListener('click', () =>
  {
    document.querySelector('.modal-overlay')?.remove();
  });
    document.getElementById('confirmSettleCreditBtn')?.addEventListener('click', async () => {
      const ref = document.getElementById('settlePaymentRef')?.value.trim();
      if (!ref) return Utils.toast('Payment Reference is required to settle credit', 'warning');

      try {
        await DB._fetch(`/api/sales/${saleId}/settle-credit`, {
          method: 'PUT',
          body: JSON.stringify({ payment_reference: ref })
        });
        Utils.toast('Credit sale settled and marked paid successfully', 'success');
        close();
        this.refresh();
      } catch (e) {
        Utils.toast(e.message, 'danger');
      }
    });
  },

  /**
   * Action: Approve a pending payment.
   */
  async approve(saleId) {
    try {
      await DB._fetch(`/api/payments/${saleId}/approve`, { method: 'PUT' });
      Utils.toast('Payment approved! Stock deducted and sale confirmed.', 'success');
      this.refresh();
    } catch (e) {
      Utils.toast(e.message, 'danger');
    }
  },

  /**
   * Action: Reject a pending payment.
   */
  async reject(saleId) {
    if (!confirm('Reject this sale and payment reference?')) return;
    try {
      await DB._fetch(`/api/payments/${saleId}/reject`, { method: 'PUT' });
      Utils.toast('Sale and payment rejected', 'warning');
      this.refresh();
    } catch (e) {
      Utils.toast(e.message, 'danger');
    }
  }
};

// Expose to global window so app.js can access it
window.AdminPayments = AdminPayments;