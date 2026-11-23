/**
 * Reports Module
 * Handles Financial and Inventory reporting.
 */
const Reports = {
  currentReportData: null,
  currentFilterRange: { from: '', to: '' },

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
      // 1. Fetch the HTML template
      const response = await fetch('/templates/reports.html');
      if (!response.ok) throw new Error('Reports template not found');
      
      container.innerHTML = await response.text();

      // 2. Setup initial state (dates)
      this.setDefaultDates();
      
      // 3. Attach event listeners
      this.attachEvents();

      // 4. Auto-generate the report on load
      await this.generate();

    } catch (error) {
      console.error('Failed to render Reports:', error);
      container.innerHTML = `<p style="color:var(--danger); padding:20px;">Failed to load Reports: ${error.message}</p>`;
    }
  },

  setDefaultDates() {
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    
    const fromInput = document.getElementById('reportFrom');
    const toInput = document.getElementById('reportTo');
    
    if (fromInput) fromInput.value = startOfMonth;
    if (toInput) toInput.value = today;
  },

  attachEvents() {
    // Filter buttons
    document.getElementById('btnRangeToday')?.addEventListener('click', () => this.setRange('today'));
    document.getElementById('btnRangeMonth')?.addEventListener('click', () => this.setRange('this_month'));
    document.getElementById('btnRangeAll')?.addEventListener('click', () => this.setRange('all'));
    
    // Generate button
    document.getElementById('btnGenerateReport')?.addEventListener('click', () => this.generate());

    // PDF button
    document.getElementById('downloadPdfBtn')?.addEventListener('click', () => this.downloadPDF());
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
    const branchId = document.getElementById('reportBranchSelect')?.value || '';
    
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (branchId) params.append('branch_id', branchId);

    // Show loading state
    const emptyState = document.getElementById('emptyReportState');
    const printableReport = document.getElementById('printableReportSection');
    const pdfBtn = document.getElementById('downloadPdfBtn');
    
    if (emptyState) emptyState.style.display = 'none';
    if (printableReport) printableReport.style.display = 'block';
    if (pdfBtn) pdfBtn.style.display = 'inline-flex';

    try {
      const data = await DB._fetch(`/api/reports/sales-summary?${params.toString()}`);
      this.currentReportData = data;
      this.currentFilterRange = { from, to };

      this.updateKpis(data);
      this.renderProductsSoldTable(data.products_sold || []);
      this.renderStockRemainingTable(data.stock_remaining || []);
      this.updateReportMeta(from, to);

    } catch (e) {
      console.error('Failed to generate report:', e);
      if (printableReport) printableReport.innerHTML = `<p style="color:var(--danger); padding:20px;">Failed to generate report: ${e.message}</p>`;
    }
  },

  updateKpis(data) {
    const totalRevenue = parseFloat(data.total_amount || 0);
    const totalSales = parseInt(data.total_sales || 0, 10);
    const pipesSold = parseFloat(data.total_pipes_sold || 0);
    const sacksSold = parseFloat(data.total_sacks_sold || 0);
    
    document.getElementById('kpiTotalRevenue').textContent = `KES ${Utils.formatCurrency(totalRevenue)}`;
    document.getElementById('kpiTotalSales').textContent = `${totalSales} Orders`;
    document.getElementById('kpiPipesSold').textContent = `${pipesSold} meters`;
    document.getElementById('kpiSacksSold').textContent = `${sacksSold} units`;

    // Calculate total stock valuation
    const stockRemaining = data.stock_remaining || [];
    let totalStockValue = 0;
    stockRemaining.forEach(s => {
      totalStockValue += parseFloat(s.stock || 0) * parseFloat(s.price || 0);
    });
    document.getElementById('kpiStockValue').textContent = `KES ${Utils.formatCurrency(totalStockValue)}`;
  },

  renderProductsSoldTable(products) {
    const tbody = document.getElementById('productsSoldBody');
    const template = document.getElementById('tpl-product-sold-row');
    const fragment = document.createDocumentFragment();
    tbody.innerHTML = ''; // Clear previous

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px; color:#64748b;">No products sold during this period.</td></tr>';
      return;
    }

    products.forEach((p, idx) => {
      const clone = template.content.cloneNode(true);
      clone.querySelector('.data-index').textContent = idx + 1;
      clone.querySelector('.data-name').textContent = p.productname || 'Item';
      clone.querySelector('.data-category').textContent = p.category || 'General';
      clone.querySelector('.data-qty').textContent = p.quantity_sold;
      clone.querySelector('.data-avg-price').textContent = `KES ${Utils.formatCurrency(p.avg_price)}`;
      clone.querySelector('.data-revenue').textContent = `KES ${Utils.formatCurrency(p.total_revenue)}`;
      fragment.appendChild(clone);
    });

    tbody.appendChild(fragment);
  },

  renderStockRemainingTable(stockItems) {
    const tbody = document.getElementById('stockRemainingBody');
    const template = document.getElementById('tpl-stock-row');
    const fragment = document.createDocumentFragment();
    tbody.innerHTML = ''; // Clear previous

    if (stockItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px; color:#64748b;">No products in database.</td></tr>';
      return;
    }

    stockItems.forEach((s, idx) => {
      const qty = parseFloat(s.stock || 0);
      const price = parseFloat(s.price || 0);
      const isLow = qty <= 10;

      const clone = template.content.cloneNode(true);
      clone.querySelector('.data-index').textContent = idx + 1;
      clone.querySelector('.data-name').textContent = s.name;
      clone.querySelector('.data-category').textContent = s.category || 'General';
      clone.querySelector('.data-price').textContent = `KES ${Utils.formatCurrency(price)}`;
      
      const badge = clone.querySelector('.data-stock-badge');
      badge.textContent = qty;
      if (qty <= 0) {
        badge.className = 'badge badge-danger data-stock-badge';
      } else if (isLow) {
        badge.className = 'badge badge-warning data-stock-badge';
      } else {
        badge.className = 'badge badge-success data-stock-badge';
      }

      clone.querySelector('.data-valuation').textContent = `KES ${Utils.formatCurrency(qty * price)}`;
      fragment.appendChild(clone);
    });

    tbody.appendChild(fragment);
  },

  updateReportMeta(from, to) {
    const periodText = from && to
      ? `From <strong>${from}</strong> to <strong>${to}</strong>`
      : from
        ? `Since <strong>${from}</strong>`
        : to
          ? `Up to <strong>${to}</strong>`
          : `All Time Cumulative`;

    document.getElementById('reportPeriodText').innerHTML = `Period: ${periodText}`;
    document.getElementById('reportGeneratedTime').textContent = `Generated: ${new Date().toLocaleString()}`;
    document.getElementById('reportPreparedBy').textContent = currentUser?.username || 'Administrator';
    document.getElementById('reportYear').textContent = new Date().getFullYear();
  },

  downloadPDF() {
    const el = document.getElementById('printableReportSection');
    if (!el || !this.currentReportData) return Utils.toast('No report to download', 'warning');

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

// Expose globally for app.js
window.Reports = Reports;