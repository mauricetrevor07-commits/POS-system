const Utils = {
  company: {
    name: 'AUTOPAK INTERNATIONAL',
    address: 'Plot 123, Industrial Area, Nairobi',
    phone: '+254 700 000 000',
    email: 'info@autopak.co.ke'
  },
  companyPrintHeaderHTML: `
    <div id="companyPrintHeader" style="display:none; text-align:center; border-bottom:2px solid #000; margin-bottom:10px;">
      <h2>AUTOPAK INTERNATIONAL</h2>
      <p>Plot 123, Industrial Area, Nairobi | Tel: +254 700 000 000</p>
    </div>
  `,
  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  formatCurrency(amount) {
    return Number(amount).toFixed(2);
  },

  // ── improved toast with container ─────
  toast(msg, type = 'info') {
    // ensure container exists
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i> ${msg}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  showModal({ title, content, size, footer }) {
    const id = 'modal-' + Date.now();
    const html = `
      <div class="modal-overlay" id="${id}">
        <div class="modal-dialog ${size||'modal-md'}">
          <div class="modal-header">
            <h5>${title}</h5>
            <button onclick="document.getElementById('${id}').remove()">&times;</button>
          </div>
          <div class="modal-body">${content}</div>
          ${footer?`<div class="modal-footer">${footer}</div>`:''}
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    return { close: () => document.getElementById(id).remove() };
  },

  printHTML(html, title) {
    const win = window.open('', '_blank', 'width=900,height=750');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; }
          body { padding: 20px; color: #111; font-size: 13px; line-height: 1.4; }
          .doc-container { max-width: 800px; margin: 0 auto 30px auto; padding: 25px; border: 1px solid #ddd; background: #fff; }
          .header-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
          .header-table td { vertical-align: top; border: none; padding: 0; }
          .company-title { font-size: 20px; font-weight: 700; color: #1e3a8a; letter-spacing: -0.5px; }
          .company-sub { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.4; }
          .doc-badge { text-align: right; }
          .doc-type { font-size: 18px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; }
          .copy-label { display: inline-block; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; margin-top: 4px; border: 1px solid #cbd5e1; }
          .meta-box { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 20px; background: #f8fafc; border-collapse: collapse; }
          .meta-box td { padding: 8px 12px; font-size: 12px; border: 1px solid #e2e8f0; vertical-align: top; }
          .meta-label { font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
          .meta-value { font-weight: 600; color: #0f172a; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #1e3a8a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; border: 1px solid #1e3a8a; }
          .items-table td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
          .items-table tr:nth-child(even) td { background: #fafafa; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-table { width: 45%; margin-left: auto; margin-bottom: 25px; border-collapse: collapse; }
          .totals-table td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
          .grand-total { font-size: 14px; font-weight: 700; background: #f1f5f9; color: #1e3a8a; }
          .sign-grid { display: flex; justify-content: space-between; margin-top: 30px; gap: 20px; }
          .sign-box { flex: 1; border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 11px; text-align: center; color: #475569; }
          .footer-note { text-align: center; margin-top: 25px; font-size: 11px; color: #64748b; font-style: italic; }
          @media print {
            body { padding: 0; }
            .doc-container { border: none; padding: 0; width: 100%; max-width: 100%; }
            .page-break { page-break-after: always; break-after: page; height: 0; }
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  },

  getCopyName(copyIndex) {
    switch (copyIndex) {
      case 1: return 'ORIGINAL (CUSTOMER COPY)';
      case 2: return 'DUPLICATE (ACCOUNTS / STORE COPY)';
      case 3: return 'TRIPLICATE (GATE PASS / AUDIT COPY)';
      default: return `COPY #${copyIndex}`;
    }
  },

  generateInvoiceHTML(sale, copiesCount = 1) {
    let fullHTML = '';
    const items = sale.items || [];
    const invoiceNum = `INV-${(sale.id || '').slice(0, 8).toUpperCase()}`;
    const dateStr = new Date(sale.timestamp || Date.now()).toLocaleString();
    const customerName = sale.customer_name || sale.customerName || 'Walk-in Customer';
    const customerKRA = sale.kra_pin || sale.customer_kra_pin || 'N/A';
    const paymentMethod = (sale.paymentMethod || sale.paymentmethod || 'Mobile Money').replace('_', ' ').toUpperCase();
    const paymentRef = sale.payment_reference || sale.payment_ref || 'N/A';
    const totalAmount = parseFloat(sale.total || 0);

    for (let c = 1; c <= copiesCount; c++) {
      const copyLabel = Utils.getCopyName(c);
      const rowsHTML = items.map((it, idx) => {
        const name = it.productname || it.productName || it.name || 'Item';
        const qty = parseFloat(it.quantity || it.qty || 1);
        const price = parseFloat(it.price || 0);
        const sub = qty * price;
        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${Utils.escapeHtml(name)}</strong></td>
            <td class="text-center">${qty}</td>
            <td class="text-right">KES ${Utils.formatCurrency(price)}</td>
            <td class="text-right">KES ${Utils.formatCurrency(sub)}</td>
          </tr>
        `;
      }).join('');

      fullHTML += `
        <div class="doc-container">
          <table class="header-table">
            <tr>
              <td>
                <div class="company-title">AUTOPAK INTERNATIONAL</div>
                <div class="company-sub">
                  Manufacturers of Quality HDPE Pipes, Fittings & Heavy Duty Sacks<br>
                  Plot 123, Industrial Area, Nairobi, Kenya | Tel: +254 700 000 000<br>
                  Email: info@autopak.co.ke | PIN: P051234567Z
                </div>
              </td>
              <td class="doc-badge">
                <div class="doc-type">TAX INVOICE</div>
                <div class="copy-label">${copyLabel}</div>
              </td>
            </tr>
          </table>

          <table class="meta-box">
            <tr>
              <td style="width:50%;">
                <div class="meta-label">Billed To (Customer):</div>
                <div class="meta-value">${Utils.escapeHtml(customerName)}</div>
                ${customerKRA !== 'N/A' ? `<div style="font-size:11px; margin-top:2px;"><strong>KRA PIN:</strong> ${Utils.escapeHtml(customerKRA)}</div>` : ''}
              </td>
              <td style="width:25%;">
                <div class="meta-label">Invoice No:</div>
                <div class="meta-value">${invoiceNum}</div>
                <div class="meta-label" style="margin-top:6px;">Date & Time:</div>
                <div class="meta-value" style="font-size:11px;">${dateStr}</div>
              </td>
              <td style="width:25%;">
                <div class="meta-label">Payment Method:</div>
                <div class="meta-value">${paymentMethod}</div>
                <div class="meta-label" style="margin-top:6px;">Ref No:</div>
                <div class="meta-value" style="font-size:11px;">${paymentRef}</div>
              </td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width:5%;" class="text-center">#</th>
                <th style="width:45%;">Item Description</th>
                <th style="width:15%;" class="text-center">Qty / Meters</th>
                <th style="width:15%;" class="text-right">Unit Price</th>
                <th style="width:20%;" class="text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="5" class="text-center">No items</td></tr>'}
            </tbody>
          </table>

          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td class="text-right">KES ${Utils.formatCurrency(totalAmount)}</td>
            </tr>
            <tr class="grand-total">
              <td><strong>Grand Total:</strong></td>
              <td class="text-right"><strong>KES ${Utils.formatCurrency(totalAmount)}</strong></td>
            </tr>
          </table>

          <div class="sign-grid">
            <div class="sign-box">
              <strong>Prepared / Dispatched By</strong><br><br>
              ${Utils.escapeHtml(sale.created_by || 'Cashier / Admin')}
            </div>
            <div class="sign-box">
              <strong>Customer Acknowledged</strong><br><br>
              Signature & Date
            </div>
            <div class="sign-box">
              <strong>Official Stamp & Seal</strong><br><br>
              AUTOPAK INTERNATIONAL
            </div>
          </div>

          <div class="footer-note">
            Goods once sold are not returnable without prior authorization. Thank you for your business!
          </div>
        </div>
        ${c < copiesCount ? '<div class="page-break"></div>' : ''}
      `;
    }
    return fullHTML;
  },

  generateDeliveryNoteHTML(sale, copiesCount = 1) {
    let fullHTML = '';
    const items = sale.items || [];
    const dnNum = `DN-${(sale.id || '').slice(0, 8).toUpperCase()}`;
    const invoiceNum = `INV-${(sale.id || '').slice(0, 8).toUpperCase()}`;
    const dateStr = new Date(sale.timestamp || Date.now()).toLocaleString();
    const customerName = sale.customer_name || sale.customerName || 'Walk-in Customer';

    for (let c = 1; c <= copiesCount; c++) {
      const copyLabel = Utils.getCopyName(c);
      const rowsHTML = items.map((it, idx) => {
        const name = it.productname || it.productName || it.name || 'Item';
        const qty = parseFloat(it.quantity || it.qty || 1);
        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${Utils.escapeHtml(name)}</strong></td>
            <td class="text-center"><strong>${qty}</strong></td>
            <td>Dispatched in good order</td>
          </tr>
        `;
      }).join('');

      fullHTML += `
        <div class="doc-container">
          <table class="header-table">
            <tr>
              <td>
                <div class="company-title">AUTOPAK INTERNATIONAL</div>
                <div class="company-sub">
                  Manufacturers of Quality HDPE Pipes, Fittings & Heavy Duty Sacks<br>
                  Plot 123, Industrial Area, Nairobi, Kenya | Tel: +254 700 000 000<br>
                  Email: info@autopak.co.ke
                </div>
              </td>
              <td class="doc-badge">
                <div class="doc-type">DELIVERY NOTE</div>
                <div class="copy-label">${copyLabel}</div>
              </td>
            </tr>
          </table>

          <table class="meta-box">
            <tr>
              <td style="width:50%;">
                <div class="meta-label">Deliver To Customer:</div>
                <div class="meta-value">${Utils.escapeHtml(customerName)}</div>
                <div style="font-size:11px; margin-top:2px;">Destination: Customer Premises / Site</div>
              </td>
              <td style="width:25%;">
                <div class="meta-label">Delivery Note No:</div>
                <div class="meta-value">${dnNum}</div>
                <div class="meta-label" style="margin-top:6px;">Invoice Ref:</div>
                <div class="meta-value" style="font-size:11px;">${invoiceNum}</div>
              </td>
              <td style="width:25%;">
                <div class="meta-label">Date & Time:</div>
                <div class="meta-value" style="font-size:11px;">${dateStr}</div>
                <div class="meta-label" style="margin-top:6px;">Status:</div>
                <div class="meta-value">DISPATCHED</div>
              </td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width:8%;" class="text-center">#</th>
                <th style="width:52%;">Item Description / Specification</th>
                <th style="width:20%;" class="text-center">Quantity Dispatched</th>
                <th style="width:20%;">Condition / Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="4" class="text-center">No items</td></tr>'}
            </tbody>
          </table>

          <table class="meta-box" style="margin-top:15px;">
            <tr>
              <td>
                <div class="meta-label">Vehicle Reg / Driver:</div>
                <div class="meta-value" style="font-weight:normal;">______________________________________</div>
              </td>
              <td>
                <div class="meta-label">Storekeeper / Dispatcher:</div>
                <div class="meta-value">${Utils.escapeHtml(sale.created_by || 'Store Keeper')}</div>
              </td>
            </tr>
          </table>

          <div style="margin-top:15px; font-size:11px; color:#334155; border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#f8fafc;">
            <strong>Customer Acknowledgement:</strong><br>
            I / We confirm that the above goods have been received in complete quantity, sound condition and good order.
          </div>

          <div class="sign-grid">
            <div class="sign-box">
              <strong>Received By (Full Name)</strong><br><br>
              ___________________________
            </div>
            <div class="sign-box">
              <strong>ID / Mobile Number</strong><br><br>
              ___________________________
            </div>
            <div class="sign-box">
              <strong>Signature & Official Stamp</strong><br><br>
              ___________________________
            </div>
          </div>
        </div>
        ${c < copiesCount ? '<div class="page-break"></div>' : ''}
      `;
    }
    return fullHTML;
  },

  showPrintDialog(sale) {
    const saleId = (sale.id || '').slice(0, 8).toUpperCase();
    const modalContent = `
      <div style="padding: 10px 0;">
        <p style="margin-bottom: 16px; color: #475569;">
          Select document type and number of copies to print for <strong>Sale #${saleId}</strong>.
        </p>

        <div class="form-group" style="margin-bottom: 16px;">
          <label style="font-weight:600; display:block; margin-bottom:6px;">Document Type</label>
          <div style="display:flex; gap:12px;">
            <label style="flex:1; border:1.5px solid var(--border); padding:10px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px;">
              <input type="radio" name="printDocType" value="invoice" checked />
              <div>
                <strong>Tax Invoice</strong>
                <div style="font-size:0.75rem; color:#64748b;">With pricing & totals</div>
              </div>
            </label>
            <label style="flex:1; border:1.5px solid var(--border); padding:10px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px;">
              <input type="radio" name="printDocType" value="delivery_note" />
              <div>
                <strong>Delivery Note</strong>
                <div style="font-size:0.75rem; color:#64748b;">Quantities & dispatch note</div>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label style="font-weight:600; display:block; margin-bottom:6px;">Number of Copies</label>
          <select id="printCopiesCount" class="form-control">
            <option value="1">1 Copy (Original only)</option>
            <option value="2" selected>2 Copies (Customer + Accounts/Store)</option>
            <option value="3">3 Copies (Customer + Accounts + Gate Pass)</option>
            <option value="4">4 Copies</option>
            <option value="5">5 Copies</option>
          </select>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
      <button class="btn btn-primary" onclick="Utils.executePrint(${JSON.stringify(sale).replace(/"/g, '&quot;')})">
        <i class="bi bi-printer"></i> Print Now
      </button>
    `;

    Utils.showModal({
      title: `<i class="bi bi-printer"></i> Print Document`,
      content: modalContent,
      footer
    });
  },

  executePrint(sale) {
    const docType = document.querySelector('input[name="printDocType"]:checked')?.value || 'invoice';
    const copies = parseInt(document.getElementById('printCopiesCount')?.value || '1', 10);
    
    // Close modal
    document.querySelector('.modal-overlay')?.remove();

    if (docType === 'invoice') {
      const html = Utils.generateInvoiceHTML(sale, copies);
      Utils.printHTML(html, `Invoice_${(sale.id||'').slice(0,8)}`);
    } else {
      const html = Utils.generateDeliveryNoteHTML(sale, copies);
      Utils.printHTML(html, `DeliveryNote_${(sale.id||'').slice(0,8)}`);
    }
  }
};