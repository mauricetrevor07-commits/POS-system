const { title } = require("node:process");

const Customers = {
  allCustomers: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div style="padding:40px; text-align:center;">Loading customers...</div>';

    try {
      const response = await fetch('/templates/customers.html');
      if (!response.ok) throw new Error('Customers template not found');

      container.innerHTML = await response.text();
      this.attachEvents();
      await this.loadList();
    } catch (error) {
      console.error(error);
      container.innerHTML =`<p style="color:red; padding:20px;">Failed to load Customers: ${error.message}</p>`;
    }
  },

  attachEvents() {
    document.getElementById('btnAddCustomer')?.addEventListener('click', () => this.showForm());
    document.getElementById('customerSearchInput')?.addEventListener('input', () => this.filter());
    document.getElementById('customersTableBody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const name = btn.dataset.name;

      if (action === 'edit') this.editForm(id);
      if (action === 'prices') this.managePrices(id);
      if (action === 'delete') this.deleteCustomer(id, name);
    });
  },

  async loadList() {
    try {
      this.allCustomers = await DB._fetch('/api/customers');
      this.filter();
    } catch (e) {
      document.getElementById('customersList').innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px; color:var(--danger);">Failed to load customers: ${e.message}</td></tr>';
    }
  },

  filter() {
    const query = (document.getElementById('customerSearchInput')?.value || '').toLowerCase();
    const filtered = this.allCustomers.filter(c => {
      if (!query) return true;
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const contact = (c.contact_person || '').toLowerCase();
      const kra = (c.kra_pin || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || contact.includes(query) || kra.includes(query) || address.includes(query);
    });

    const badge = document.getElementById('custCountBadge');
    if (badge) badge.textContent = `${filtered.length} customers`;

    this.renderTable(filtered);
  },

  renderTable(customers) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td> colspan="6" class="text-center" style="padding:24px; color:var(--text-muted);">No customers found.</td></tr>';
      return;
    }

    const isAdmin = (typeof currentUser !== 'undefined' && currentUser?.role === 'admin') || localStorage.getItem('userRole') === 'admin';

    tbody.innerHTML = customers.map(c => {
      const kraDisplay = c.kra_pin
        ? `<code style="font-size:0.9rem; font-weight:600; color:var(--text-main);">${Utils.escapeHtml(c.kra_pin)}</code>`
        : '<span class="text-muted"">None</span>';

      const cType = (c.customer_type || 'retailer').toLowerCase();
      let typeBadge = '<span class="badge badge-neutral">Retailer</span>';
      if (cType === 'distributor') {
        typeBadge = '<span class="badge" style="background:rgba(124,58,237,0.15); color:#7c3aed; font-weight:600;"><i class="bi bi-diagram-3"></i> Distributor</span>';
      } else if (cType === 'wholesaler') {
        typeBadge = '<span class="badge" style="background:rgba(2,132,199,0.15); color:#0284c7; font-weight:600;"><i class="bi bi-box-seam"></i> Wholesaler</span>';
      }

      return `
        <tr>
          <td>
            <strong>${Utils.escapeHtml(c.name)}</strong>
            ${c.address ? `<div style="font-size:0.75rem; color:var(--text-muted);"><i class="bi bi-geo-alt"></i> ${Utils.escapeHtml(c.address)}</div>` : ''}
          </td>
          <td>${typeBadge}</td>
          <td>${Utils.escapeHtml(c.contact_person || '-')}</td>
          <td>${Utils.escapeHtml(c.phone || '-')}</td>
          <td>${kraDisplay}</td>
          <td class="text-right">
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn btn-sm btn-outline" data-action="edit" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline" data-action="prices" data-id="${c.id}"><i class="bi bi-tag"></i></button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${c.id}" data-name="${Utils.escapeHtml(c.name)}"><i class="bi bi-trash"></i></button
            ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  showForm(customer = null) {
    const isEdit = !!customer;
    const currentType = (customer?.customer_type || 'retailer').toLowerCase();
    const { close } = Utils.showModal({
      title: isEdit ? 'Edit Customer' : 'Add New Customer',
      content: `
      <div style="padding:10px 0;">
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Customer / Company Name *</label>
            <input id="custName" class="form-control" value="${Utils.escapeHtml(customer?.name || '')}" placeholder="e.g. Autopak Ltd" />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Customer Category *</label>
            <select id="custType" class="form-control">
              <option value="retailer" ${currentType === 'retailer' ? 'selected' : ''}>Retailer</option>
              <option value="wholesaler" ${currentType === 'wholesaler' ? 'selected' : ''}>Wholesaler</option>
              <option value="distributor" ${currentType === 'distributor' ? 'selected' : ''}>Distributor</option>
            </select>
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Contact Person</label>
            <input id="custContact" class="form-control" value="${Utils.escapeHtml(customer?.contact_person || '')}" />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Phone Number</label>
            <input id="custPhone" class="form-control" value="${Utils.escapeHtml(customer?.phone || '')}" placeholder="+254 7..." />
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Email Address</label>
            <input id="custEmail" type="email" class="form-control" value="${Utils.escapeHtml(customer?.email || '')}" placeholder="account@company.com" />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Physical / Delivery Address</label>
            <input id="custAddress" class="form-control" value="${Utils.escapeHtml(customer?.address || '')}" placeholder="Street Address" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label"> KRA Tax PIN </label>
          <input id="custKraPin" class="form-control" value="${Utils.escapeHtml(customer?.kra_pin || '')} />
        </div>
      </div>
    `,
    footer: `
    <button class="btn btn-secondary" id="btnCancelCustomer">Cancel</button>
    <button class="btn btn-primary" id="btnSaveCustomer">Save Customer</button>
    `
    });
    document.getElementById('btnCancelCustomer')?.addEventListener('click', close);
    document.getElementById('btnSaveCustomer')?.addEventListener('click', async(e) => {
      const btn = e.target;
      btn.innerHTML = '<span class="spinner"></span> Saving...';
      btn.disabled = true;

      const data = {
        name: document.getElementById('custName')?.value.trim(),
        customer_type: document.getElementById('custType')?.value || 'retailer',
        contact_person: document.getElementById('custContact')?.value.trim(),
        phone: document.getElementById('custPhone')?.value.trim(),
        email: document.getElementById('custEmail')?.value.trim(),
        address: document.getElementById('custAddress')?.value.trim(),
        kra_pin: document.getElementById('custKraPin')?.value.trim()
      };

      if (!data.name) {
        Utils.toast('Customer Name is required', 'warning');
        btn.innerHTML = 'Save Customer';
        btn.disabled = false;
        return;
      } 

      try {
        if (isEdit) {
          await DB._fetch(`/api/customers/${customer.id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
          await DB._fetch('/api/customers', { method: 'POST', body: JSON.stringify(data) });
        }
        Utils.toast('Customer saved successfully', 'success');
        close();
        this.loadList();
      } catch (e) {
        Utils.toast(e.message, 'danger');
        btn.innerHTML = 'Save Customer';
        btn.disabled = false;
      }
    });
  },

  editForm(id) {
    const customer = this.allCustomers.find(c => c.id === id);
    if (customer) this.showForm(customer);
  },

  async managePrices(customerId) {
    try {
    const [products, prices] = await Promise.all([
      DB._fetch('/api/products'),
      DB._fetch(`/api/customer-prices/${customerId}`)
    ]);

    const priceMap = {};
    prices.forEach(p => priceMap[p.product_id] = p.custom_price);
    const rows = products.map(p => {
      const custom = priceMap[p.id] || '';
      return `<tr>
        <td>${Utils.escapeHtml(p.name)}</td>
        <td>KES ${Utils.formatCurrency(p.price)}</td>
        <td><input type="number" step="0.01" id="price-${p.id}" class="form-control" value="${custom}" placeholder="Standard (KES ${p.price})" /></td>
      </tr>`;
    }).join('');

    const { close } = Utils.showModal({
      title: 'Customer Custom Pricing',
      content: `
      <div style="max-height:350px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Std Price</th>
              <th>Special Negotiated Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    footer:`
    <button class="btn btn-secondary" id="btnCancelPrices">Cancel</button>
    <button class="btn btn-primary" id="btnSavePrices">Save Custom Prices</button>
    `
    });

    document.getElementById('btnCancelPrices')?.addEventListener('click', close);
    document.getElementById('btnSavePrices').addEventListener('click', async () => {
      const btn = e.target;
      btn.innerHTML = '<span class="spinner"></span> Saving...';
      btn.disabled = true;

      const updates = products.map(p => ({
        customer_id: customerId,
        product_id: p.id,
        custom_price: parseFloat(document.getElementById(`price-${p.id}`).value) || p.price
      }));

      try {
      for (const u of updates) {
        await DB._fetch('/api/customer-prices', { method: 'POST', body: JSON.stringify(u) });
      }
      Utils.toast('Customer pricing updated', 'success');
      close();
    } catch (err) {
      Utils.toast(err.message, 'danger');
      btn.innerHTML = 'Save Custom Prices';
      btn.disabled = false;
    }
    });
  } catch (e) {
    Utils.toast('Failed to load pricing data', 'danger');
  }
},

  deleteCustomer(id, name) {
    const { close } = Utils.showModal({
      title: `<i class="bi bi-exclamation-triangle-fill text-danger"></i> Delete Customer`,
      content: `
        <div style="padding:10px 0;">
          <p>Are you sure you want to delete customer <strong>${Utils.escapeHtml(name)}</strong>?</p>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:8px;">
            This will remove their profile and negotiated custom price list. Historic sales records will be preserved.
          </p>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="btnCancelDelete">Cancel</button>
        <button class="btn btn-danger" id="confirmDelete"><i class="bi bi-trash"></i> Delete Customer</button>
      `
    });

    document.getElementById('btnCancelDelete')?.addEventListener('click', close);
    document.getElementById('btnConfirmDelete')?.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.innerHTML = '<span class="spinner"></span> Deleting...';
      btn.disabled = true;

      try {
        await DB.fetch(`/api/customers/${id}`, { method:'DELETE' });
        Utils.toast('Customer deleted', 'success');
        close();
        this.loadList();
      } catch (err) {
        Utils.toast(e.message, 'danger');
        btn.innerHTML = 'DELETE Customer';
        btn.disabled = false;
      }
    });
  }
};

window.Customers = Customers;