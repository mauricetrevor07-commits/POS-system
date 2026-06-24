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
  toast(msg, type='info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
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
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(`<html><head><title>${title}</title></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }
};