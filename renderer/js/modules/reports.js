const Reports = {
  currentReportData: null,

  async render() {
    const container = document.getElementById('page-content');
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    container.innerHTML = `
      <div class="toolbar no-print">
        <h2><i class="bi bi-bar-chart-line"></i> Financial & Inventory Reports</h2>
        <button class="btn btn-primary" id="downloadPdfBtn" onclick="Reports.downloadPDF()" style="display:none;">
          <i class="bi bi-file-earmark-pdf"></i> Download PDF Report
        </button>
      </div>

      <!-- Filters Card -->
      <div class="card no-print" style="margin-bottom:20px;">
        <div class="card-body" style="padding:16px 20px;">
          <div style="display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:150px;">
              <label style="font-weight:600; font-size:0.85rem; color:#475569; display:block; margin-bottom:4px;">From Date</label>
              <input type="date" id="reportFrom" class="form-control" value="${startOfMonth}" />
            </div>
            <div style="flex:1; min-width:150px;">
              <label style="font-weight:600; font-size:0.85rem; color:#475569; display:block; margin-bottom:4px;">To Date</label>
              <input type="date" id="reportTo" class="form-control" value="${today}" />
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline btn-sm" onclick="Reports.setRange('today')">Today</button>
              <button class="btn btn-outline btn-sm" onclick="Reports.setRange('this_month')">This Month</button>
              <button class="btn btn-outline btn-sm" onclick="Reports.setRange('all')">All Time</button>
            </div>
            <div>
              <button class="btn btn-primary" onclick="Reports.generate()" style="padding:10px 24px;">
                <i class="bi bi-lightning-charge"></i> Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Report View Container -->
      <div id="reportContainer">
        <div class="card">
          <div class="card-body" style="text-align:center; padding:40px; color:#64748b;">
            <i class="bi bi-clipboard-data" style="font-size:3rem; display:block; margin-bottom:12px; color:var(--primary);"></i>
            <h3>No Report Generated Yet</h3>
            <p>Select a date range above and click <strong>Generate Report</strong> to view sales and inventory analytics.</p>
          </div>
        </div>
      </div>
    `;

    await this.generate();
  },

  setRange(preset) {
    const today = new Date().toISOString().slice(0, 10);
    const fromInput = document.getElementById('reportFrom');
    const toInput = document.getElementById('reportTo');

    if (preset === 'today') {
      fromInput.value = today;
      toInput.value = today;
    } else if (preset === 'this_month') {
      fromInput.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      toInput.value = today;
    } else if (preset === 'all') {
      fromInput.value = '';
      toInput.value = '';
    }
    this.generate();
  },

  async generate() {
    const from = document.getElementById('reportFrom')?.value || '';
    const to = document.getElementById('reportTo')?.value || '';
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const reportBox = document.getElementById('reportContainer');
    reportBox.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
      const data = await DB._fetch(`/api/reports/sales-summary?${params.toString()}`);
      this.currentReportData = data;
      this.currentFilterRange = { from, to };

      document.getElementById('downloadPdfBtn').style.display = 'inline-flex';

      const totalRevenue = parseFloat(data.total_amount || 0);
      const totalSales = parseInt(data.total_sales || 0, 10);
      const pipesSold = parseFloat(data.total_pipes_sold || 0);
      const sacksSold = parseFloat(data.total_sacks_sold || 0);

      const productsSold = data.products_sold || [];
      const stockRemaining = data.stock_remaining || [];

      // Calculate total stock remaining count and value
      let totalStockUnits = 0;
      let totalStockValue = 0;
      stockRemaining.forEach(s => {
        const qty = parseFloat(s.stock || 0);
        totalStockUnits += qty;
        totalStockValue += qty * parseFloat(s.price || 0);
      });

      const productsSoldRows = productsSold.map((p, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td><strong>${Utils.escapeHtml(p.productname || 'Item')}</strong></td>
          <td><span class="badge badge-secondary">${Utils.escapeHtml(p.category || 'General')}</span></td>
          <td class="text-center" style="font-weight:700; color:var(--primary);">${p.quantity_sold}</td>
          <td class="text-right">KES ${Utils.formatCurrency(p.avg_price)}</td>
          <td class="text-right" style="font-weight:700;">KES ${Utils.formatCurrency(p.total_revenue)}</td>
        </tr>
      `).join('');

      const stockRemainingRows = stockRemaining.map((s, idx) => {
        const qty = parseFloat(s.stock || 0);
        const price = parseFloat(s.price || 0);
        const isLow = qty <= 10;
        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${Utils.escapeHtml(s.name)}</strong></td>
            <td><span class="badge badge-secondary">${Utils.escapeHtml(s.category || 'General')}</span></td>
            <td class="text-right">KES ${Utils.formatCurrency(price)}</td>
            <td class="text-center">
              <span class="badge ${qty <= 0 ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}" style="${qty <= 0 ? 'background:rgba(239,68,68,0.15); color:#ef4444;' : isLow ? 'background:rgba(245,158,11,0.15); color:#d97706;' : ''}">
                ${qty}
              </span>
            </td>
            <td class="text-right">KES ${Utils.formatCurrency(qty * price)}</td>
          </tr>
        `;
      }).join('');

      const periodText = from && to
        ? `From <strong>${from}</strong> to <strong>${to}</strong>`
        : from
          ? `Since <strong>${from}</strong>`
          : to
            ? `Up to <strong>${to}</strong>`
            : `All Time Cumulative`;

      reportBox.innerHTML = `
        <div id="printableReportSection" style="background:#fff; border-radius:12px; padding:30px; box-shadow:var(--shadow-md); border:1px solid var(--border);">
          <!-- Report Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--border); padding-bottom:20px; margin-bottom:24px;">
            <div>
              <h2 style="color:var(--primary); font-size:1.6rem; font-weight:700; margin-bottom:4px;">AUTOPAK INTERNATIONAL</h2>
              <p style="color:#64748b; font-size:0.85rem; margin-bottom:2px;">Manufacturers of Quality HDPE Pipes, Fittings & Heavy Duty Sacks</p>
              <p style="color:#64748b; font-size:0.85rem;">Plot 123, Industrial Area, Nairobi | Tel: +254 700 000 000</p>
            </div>
            <div style="text-align:right;">
              <h3 style="font-size:1.3rem; font-weight:700; color:#0f172a; text-transform:uppercase; margin-bottom:4px;">Sales & Inventory Report</h3>
              <p style="font-size:0.85rem; color:#64748b; margin-bottom:2px;">Period: ${periodText}</p>
              <p style="font-size:0.8rem; color:#94a3b8;">Generated: ${new Date().toLocaleString()}</p>
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:28px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; text-align:center;">
              <span style="font-size:0.8rem; font-weight:600; color:#64748b; text-transform:uppercase;">Total Revenue</span>
              <div style="font-size:1.6rem; font-weight:700; color:var(--primary); margin-top:4px;">KES ${Utils.formatCurrency(totalRevenue)}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; text-align:center;">
              <span style="font-size:0.8rem; font-weight:600; color:#64748b; text-transform:uppercase;">Approved Sales</span>
              <div style="font-size:1.6rem; font-weight:700; color:var(--success); margin-top:4px;">${totalSales} Orders</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; text-align:center;">
              <span style="font-size:0.8rem; font-weight:600; color:#64748b; text-transform:uppercase;">Total Pipes Sold</span>
              <div style="font-size:1.6rem; font-weight:700; color:#0284c7; margin-top:4px;">${pipesSold} meters</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; text-align:center;">
              <span style="font-size:0.8rem; font-weight:600; color:#64748b; text-transform:uppercase;">Total Sacks Sold</span>
              <div style="font-size:1.6rem; font-weight:700; color:#d97706; margin-top:4px;">${sacksSold} units</div>
            </div>
          </div>

          <!-- Section 1: Products Sold Breakdown -->
          <div style="margin-bottom:32px;">
            <h4 style="font-size:1.1rem; font-weight:700; color:#0f172a; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
              <i class="bi bi-cart-check" style="color:var(--primary);"></i> Products Sold Breakdown
            </h4>
            <div style="overflow-x:auto; border:1px solid var(--border); border-radius:8px;">
              <table>
                <thead>
                  <tr>
                    <th style="width:5%;" class="text-center">#</th>
                    <th style="width:40%;">Product Name</th>
                    <th style="width:15%;">Category</th>
                    <th style="width:12%;" class="text-center">Qty Sold</th>
                    <th style="width:13%;" class="text-right">Avg Price</th>
                    <th style="width:15%;" class="text-right">Revenue (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsSoldRows || '<tr><td colspan="6" class="text-center" style="padding:20px; color:#64748b;">No products sold during this period.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 2: Stock Remaining -->
          <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h4 style="font-size:1.1rem; font-weight:700; color:#0f172a; margin:0; display:flex; align-items:center; gap:8px;">
                <i class="bi bi-box-seam" style="color:var(--success);"></i> Current Stock Remaining
              </h4>
              <span style="font-size:0.85rem; font-weight:600; color:#64748b;">Total Inventory Value: <strong>KES ${Utils.formatCurrency(totalStockValue)}</strong></span>
            </div>
            <div style="overflow-x:auto; border:1px solid var(--border); border-radius:8px;">
              <table>
                <thead>
                  <tr>
                    <th style="width:5%;" class="text-center">#</th>
                    <th style="width:40%;">Product Name</th>
                    <th style="width:15%;">Category</th>
                    <th style="width:12%;" class="text-right">Unit Price</th>
                    <th style="width:13%;" class="text-center">Stock Balance</th>
                    <th style="width:15%;" class="text-right">Valuation (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  ${stockRemainingRows || '<tr><td colspan="6" class="text-center" style="padding:20px; color:#64748b;">No products in database.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer Stamp -->
          <div style="display:flex; justify-content:space-between; margin-top:40px; padding-top:20px; border-top:1px dashed #cbd5e1; font-size:0.85rem; color:#64748b;">
            <div>Prepared By: <strong>${currentUser?.username || 'Administrator'}</strong></div>
            <div>Approved By: <strong>Management</strong></div>
            <div>AUTOPAK INTERNATIONAL © ${new Date().getFullYear()}</div>
          </div>
        </div>
      `;
    } catch (e) {
      reportBox.innerHTML = `<p style="color:#ef4444; padding:20px;">Failed to generate report: ${e.message}</p>`;
    }
  },

  downloadPDF() {
    const el = document.getElementById('printableReportSection');
    if (!el) return Utils.toast('No report to download', 'warning');

    const from = this.currentFilterRange?.from || 'start';
    const to = this.currentFilterRange?.to || 'end';
    const filename = `Autopak_Report_${from}_to_${to}.pdf`;

    if (typeof html2pdf !== 'undefined') {
      Utils.toast('Generating PDF document...', 'info');
      const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(el).save().then(() => {
        Utils.toast('PDF report downloaded successfully!', 'success');
      }).catch(err => {
        Utils.toast('PDF export fallback: opening print window', 'warning');
        Utils.printHTML(el.outerHTML, filename);
      });
    } else {
      Utils.printHTML(el.outerHTML, filename);
    }
  }
};