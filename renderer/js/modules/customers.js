const Customers = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2>Customers</h2>
        <button class="btn btn-primary" onclick="Customers.showForm()">+ Add Customer</button>
      </div>
      <div class="card">
        <div class="card-body" id="customersList"><div class="loading-spinner"></div></div>
      </div>`;
    await this.loadList();
  },
  async loadList() {
    const customers = await DB._fetch('/api/customers');
    const html = customers.map(c => `
      <tr>
        <td>${Utils.escapeHtml(c.name)}</td>
        <td>${c.contact_person || ''}</td>
        <td>${c.phone || ''}</td>
        <td>
          <button class="btn btn-sm" onclick="Customers.editForm('${c.id}')">Edit</button>
          <button class="btn btn-sm" onclick="Customers.managePrices('${c.id}')">Prices</button>
        </td>
      </tr>`).join('');
    document.getElementById('customersList').innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th></th></tr></thead>
        <tbody>${html || '<tr><td colspan="4">No customers</td></tr>'}</tbody>
      </table>`;
  },
  showForm(customer = null) {
    const isEdit = !!customer;
    const content = `
      <div class="form-group"><label>Name *</label><input id="custName" class="form-control" value="${customer?.name||''}" /></div>
      <div class="form-group"><label>Contact Person</label><input id="custContact" class="form-control" value="${customer?.contact_person||''}" /></div>
      <div class="form-group"><label>Phone</label><input id="custPhone" class="form-control" value="${customer?.phone||''}" /></div>
      <div class="form-group"><label>Email</label><input id="custEmail" class="form-control" value="${customer?.email||''}" /></div>
      <div class="form-group"><label>Address</label><input id="custAddress" class="form-control" value="${customer?.address||''}" /></div>`;
    const { close } = Utils.showModal({
      title: isEdit ? 'Edit Customer' : 'Add Customer',
      content,
      footer: `<button class="btn btn-primary" id="saveCustomer">Save</button>`
    });
    document.getElementById('saveCustomer').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('custName').value.trim(),
        contact_person: document.getElementById('custContact').value.trim(),
        phone: document.getElementById('custPhone').value.trim(),
        email: document.getElementById('custEmail').value.trim(),
        address: document.getElementById('custAddress').value.trim()
      };
      if (!data.name) return Utils.toast('Name required', 'error');
      try {
        if (isEdit) {
          await DB._fetch(`/api/customers/${customer.id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
          await DB._fetch('/api/customers', { method: 'POST', body: JSON.stringify(data) });
        }
        Utils.toast('Saved', 'success');
        close();
        this.loadList();
      } catch (e) { Utils.toast(e.message, 'error'); }
    });
  },
  editForm(id) {
    DB._fetch(`/api/customers/${id}`).then(c => this.showForm(c));
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
        <td>${p.price.toFixed(2)}</td>
        <td><input type="number" step="0.01" id="price-${p.id}" class="form-control" value="${custom}" placeholder="Default" /></td>
      </tr>`;
    }).join('');
    const content = `<table><thead><tr><th>Product</th><th>Std Price</th><th>Custom Price</th></tr></thead><tbody>${rows}</tbody></table>`;
    const { close } = Utils.showModal({
      title: 'Custom Prices',
      content,
      footer: `<button class="btn btn-primary" id="savePrices">Save Prices</button>`
    });
    document.getElementById('savePrices').addEventListener('click', async () => {
      const updates = products.map(p => ({
        customer_id: customerId,
        product_id: p.id,
        custom_price: parseFloat(document.getElementById(`price-${p.id}`).value) || p.price
      }));
      try {
        await DB._fetch('/api/customer-prices/bulk', {
          method: 'POST',
          body: JSON.stringify({ updates })
        });
        Utils.toast('Prices updated', 'success');
        close();
      } catch (e) {
        Utils.toast(e.message, 'error');
      }
    });
  }
};