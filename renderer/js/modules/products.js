const Products = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2>Product Management</h2>
        <button class="btn btn-primary" onclick="Products.showForm()">+ Add Product</button>
      </div>
      <div class="card">
        <div class="card-body" id="productList">
          <div class="loading-spinner"></div>
        </div>
      </div>`;
    await this.loadList();
  },
  async loadList() {
    const products = await DB._fetch('/api/products');
    const html = products.map(p => `
      <tr>
        <td>${Utils.escapeHtml(p.name)}</td>
        <td>${Utils.formatCurrency(p.price)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="btn btn-sm" onclick="Products.editForm(${p.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="Products.deleteProduct(${p.id})">Del</button>
        </td>
      </tr>`).join('');
    document.getElementById('productList').innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>${html || '<tr><td colspan="4">No products</td></tr>'}</tbody>
      </table>`;
  },
  showForm(product = null) {
    const isEdit = !!product;
    const content = `
      <div class="form-group">
        <label>Name *</label>
        <input id="prodName" class="form-control" value="${product?.name||''}" />
      </div>
      <div class="form-group">
        <label>Price *</label>
        <input id="prodPrice" type="number" step="0.01" class="form-control" value="${product?.price||''}" />
      </div>
      <div class="form-group">
        <label>Stock</label>
        <input id="prodStock" type="number" class="form-control" value="${product?.stock||0}" />
      </div>
      <div class="form-group">
        <label>Barcode</label>
        <input id="prodBarcode" class="form-control" value="${product?.barcode||''}" />
      </div>`;
    const { close } = Utils.showModal({
      title: isEdit ? 'Edit Product' : 'Add Product',
      content,
      footer: `<button class="btn btn-primary" id="saveProduct">Save</button>`
    });
    document.getElementById('saveProduct').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('prodName').value.trim(),
        price: parseFloat(document.getElementById('prodPrice').value),
        stock: parseInt(document.getElementById('prodStock').value) || 0,
        barcode: document.getElementById('prodBarcode').value.trim()
      };
      if (!data.name || isNaN(data.price)) return Utils.toast('Name and price required', 'error');
      try {
        if (isEdit) {
          await DB._fetch(`/api/products/${product.id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
          await DB._fetch('/api/products', { method: 'POST', body: JSON.stringify(data) });
        }
        Utils.toast('Saved', 'success');
        close();
        this.loadList();
      } catch (e) { Utils.toast(e.message, 'error'); }
    });
  },
  editForm(id) {
    DB._fetch(`/api/products/${id}`).then(p => this.showForm(p));
  },
  async deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    await DB._fetch(`/api/products/${id}`, { method: 'DELETE' });
    this.loadList();
  }
};