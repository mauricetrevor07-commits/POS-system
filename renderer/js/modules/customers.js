const Customers = {
  allCustomers: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2><i class="bi bi-people"></i> Customer Management</h2>
        <button class="btn btn-primary" onclick="Customers.showForm()">
          <i class="bi bi-person-plus"></i> Add Customer
        </button>
      </div>

      <!-- Search and Filter Bar -->
      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; gap:12px; align-items:center;">
          <div style="flex:1;">
            <input type="text" id="customerSearch" class="form-control" placeholder="Search customer by name, contact person, phone, KRA PIN, or address..." oninput="Customers.filter()" />
          </div>
          <span id="custCountBadge" class="badge badge-secondary">0 customers</span>
        </div>
      </div>

      <div class="card">
        <div class="card-body" id="customersList" style="padding:0; overflow-x:auto;">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
    await this.loadList();
  },

  async loadList() {
    try {
      this.allCustomers = await DB._fetch('/api/customers');
      this.filter();
    } catch (e) {
      document.getElementById('customersList').innerHTML = '<p style="padding:20px; color:#ef4444;">Failed to load customers.</p>';
    }
  },

  filter() {
    const query = (document.getElementById('customerSearch')?.value || '').toLowerCase();
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

    const list = document.getElementById('customersList');
    if (!list) return;

    const html = filtered.map(c => {
      const kraDisplay = c.kra_pin
        ? `<code style="font-size:0.9rem; font-weight:600; color:#0f172a;">${Utils.escapeHtml(c.kra_pin)}</code>`
        : '<span style="color:#94a3b8;">None</span>';

      const cType = (c.customer_type || 'retailer').toLowerCase();
      let typeBadge = '<span class="badge badge-secondary">Retailer</span>';
      if (cType === 'distributor') {
        typeBadge = '<span class="badge" style="background:rgba(124,58,237,0.15); color:#7c3aed; font-weight:600;"><i class="bi bi-diagram-3"></i> Distributor</span>';
      } else if (cType === 'wholesaler') {
        typeBadge = '<span class="badge" style="background:rgba(2,132,199,0.15); color:#0284c7; font-weight:600;"><i class="bi bi-box-seam"></i> Wholesaler</span>';
      }

      const isAdmin = (typeof currentUser !== 'undefined' && currentUser?.role === 'admin') || localStorage.getItem('userRole') === 'admin';

      return `
        <tr>
          <td>
            <strong>${Utils.escapeHtml(c.name)}</strong>
            ${c.address ? `<div style="font-size:0.75rem; color:#64748b;"><i class="bi bi-geo-alt"></i> ${Utils.escapeHtml(c.address)}</div>` : ''}
          </td>
          <td>${typeBadge}</td>
          <td>${Utils.escapeHtml(c.contact_person || '-')}</td>
          <td>${Utils.escapeHtml(c.phone || '-')}</td>
          <td>${kraDisplay}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline" onclick="Customers.editForm('${c.id}')"><i class="bi bi-pencil"></i> Edit</button>
            <button class="btn btn-sm btn-outline" onclick="Customers.managePrices('${c.id}')"><i class="bi bi-tag"></i> Prices</button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-danger" onclick="Customers.deleteCustomer('${c.id}', '${Utils.escapeHtml(c.name).replace(/'/g, "\\'")}')" title="Delete Customer">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    list.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Customer / Company Name</th>
            <th>Category / Tier</th>
            <th>Contact Person</th>
            <th>Phone</th>
            <th>KRA Tax PIN</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${html || '<tr><td colspan="6" class="text-center" style="padding:24px; color:#64748b;">No customers found.</td></tr>'}
        </tbody>
      </table>
    `;
  },

  showForm(customer = null) {
    const isEdit = !!customer;
    const currentType = (customer?.customer_type || 'retailer').toLowerCase();
    const content = `
      <div style="padding:10px 0;">
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="flex:2;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Customer / Company Name *</label>
            <input id="custName" class="form-control" value="${Utils.escapeHtml(customer?.name || '')}" placeholder="e.g. Acme Constructions Ltd" />
          </div>
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Customer Category *</label>
            <select id="custType" class="form-control">
              <option value="retailer" ${currentType === 'retailer' ? 'selected' : ''}>Retailer (Standard)</option>
              <option value="wholesaler" ${currentType === 'wholesaler' ? 'selected' : ''}>Wholesaler (Wholesale Tier)</option>
              <option value="distributor" ${currentType === 'distributor' ? 'selected' : ''}>Distributor (Distributor Tier)</option>
            </select>
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Contact Person</label>
            <input id="custContact" class="form-control" value="${Utils.escapeHtml(customer?.contact_person || '')}" placeholder="Representative Name" />
          </div>
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Phone Number</label>
            <input id="custPhone" class="form-control" value="${Utils.escapeHtml(customer?.phone || '')}" placeholder="+254 7..." />
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Email Address</label>
            <input id="custEmail" type="email" class="form-control" value="${Utils.escapeHtml(customer?.email || '')}" placeholder="account@company.com" />
          </div>
          <div class="form-group" style="flex:1;">
            <label style="font-weight:600; margin-bottom:4px; display:block;">Physical / Delivery Address</label>
            <input id="custAddress" class="form-control" value="${Utils.escapeHtml(customer?.address || '')}" placeholder="Site / Street Address" />
          </div>
        </div>

        <div class="form-group" style="margin-top:8px;">
          <label style="font-size:0.85rem; font-weight:600; color:#334155; display:block; margin-bottom:4px;">
            <i class="bi bi-file-earmark-text"></i> KRA Tax PIN (Tax Identification)
          </label>
          <input id="custKraPin" class="form-control" value="${Utils.escapeHtml(customer?.kra_pin || '')}" placeholder="e.g. P051234567Z" />
          <small style="color:#64748b; font-size:0.75rem;">Printed directly on Tax Invoices and Delivery Notes for ETIMS compliance</small>
        </div>
      </div>
    `;

    const { close } = Utils.showModal({
      title: isEdit ? 'Edit Customer' : 'Add New Customer',
      content,
      footer: `
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
        <button class="btn btn-primary" id="saveCustomer"><i class="bi bi-check-lg"></i> Save Customer</button>
      `
    });

    document.getElementById('saveCustomer').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('custName')?.value.trim(),
        customer_type: document.getElementById('custType')?.value || 'retailer',
        contact_person: document.getElementById('custContact')?.value.trim(),
        phone: document.getElementById('custPhone')?.value.trim(),
        email: document.getElementById('custEmail')?.value.trim(),
        address: document.getElementById('custAddress')?.value.trim(),
        kra_pin: document.getElementById('custKraPin')?.value.trim()
      };

      if (!data.name) return Utils.toast('Customer Name is required', 'error');

      try {
        if (isEdit) {
          await DB._fetch(`/api/customers/${customer.id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
          await DB._fetch('/api/customers', { method: 'POST', body: JSON.stringify(data) });
        }
        Utils.toast('Customer profile saved successfully', 'success');
        close();
        this.loadList();
      } catch (e) {
        Utils.toast(e.message, 'error');
      }
    });
  },

  editForm(id) {
    const customer = this.allCustomers.find(c => c.id === id);
    if (customer) this.showForm(customer);
  },

  async managePrices(customerId) {
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
        <td>KES ${p.price.toFixed(2)}</td>
        <td><input type="number" step="0.01" id="price-${p.id}" class="form-control" value="${custom}" placeholder="Standard (KES ${p.price})" /></td>
      </tr>`;
    }).join('');

    const content = `
      <div style="max-height:350px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
        <table>
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
    `;

    const { close } = Utils.showModal({
      title: 'Customer Custom Pricing',
      content,
      footer: `
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
        <button class="btn btn-primary" id="savePrices"><i class="bi bi-check-lg"></i> Save Custom Prices</button>
      `
    });

    document.getElementById('savePrices').addEventListener('click', async () => {
      const updates = products.map(p => ({
        customer_id: customerId,
        product_id: p.id,
        custom_price: parseFloat(document.getElementById(`price-${p.id}`).value) || p.price
      }));
      for (const u of updates) {
        await DB._fetch('/api/customer-prices', { method: 'POST', body: JSON.stringify(u) });
      }
      Utils.toast('Customer pricing updated successfully', 'success');
      close();
    });
  },

  deleteCustomer(id, name) {
    Utils.showModal({
      title: `<i class="bi bi-exclamation-triangle-fill" style="color:#ef4444;"></i> Delete Customer`,
      content: `
        <div style="padding:10px 0;">
          <p>Are you sure you want to delete customer <strong>${Utils.escapeHtml(name)}</strong>?</p>
          <p style="font-size:0.85rem; color:#64748b; margin-top:8px;">
            This will remove their profile and negotiated custom price list. Historic sales records will be preserved.
          </p>
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancel</button>
        <button class="btn btn-danger" id="confirmDeleteCust"><i class="bi bi-trash"></i> Delete Customer</button>
      `
    });

    document.getElementById('confirmDeleteCust')?.addEventListener('click', async () => {
      try {
        await DB._fetch(`/api/customers/${id}`, { method: 'DELETE' });
        document.querySelector('.modal-overlay')?.remove();
        Utils.toast('Customer deleted successfully', 'success');
        this.loadList();
      } catch (e) {
        Utils.toast(e.message, 'error');
      }
    });
  }
};