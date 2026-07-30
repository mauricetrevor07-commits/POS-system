const Products = {
  products: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2>Product Management</h2>
        <button class="btn btn-primary" onclick="Products.openModal()">+ Add Product</button>
      </div>
      <div class="card">
        <div class="card-body" id="productList"><div class="loading-spinner"></div></div>
      </div>`;
    await this.loadList();
  },

  async loadList() {
    try {
      this.products = await DB._fetch('/api/products');
      const html = this.products.map(p => `
        <tr>
          <td>${Utils.escapeHtml(p.name)}</td>
          <td>${Utils.formatCurrency(p.price)}</td>
          <td>${p.stock}</td>
          <td>${Utils.escapeHtml(p.category || '-')}</td>
          <td>
            <button class="btn btn-sm" onclick="Products.openModal('${p.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="Products.deleteProduct('${p.id}')">Del</button>
          </td>
        </tr>`).join('');
      document.getElementById('productList').innerHTML = `
        <table>
          <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Category</th><th></th></tr></thead>
          <tbody>${html || '<tr><td colspan="5">No products</td></tr>'}</tbody>
        </table>`;
    } catch (e) {
      document.getElementById('productList').innerHTML = '<p>Failed to load products.</p>';
    }
  },

  openModal(id = null) {
    // Remove any existing modal
    const existing = document.querySelector('.product-modal-overlay');
    if (existing) existing.remove();

    const product = id ? this.products.find(p => p.id === id) : null;

    const html = `
      <div class="product-modal-overlay" onclick="if(event.target===this) this.remove()">
        <div class="product-modal-card" style="max-width: 450px; width: 90%;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #e5e7eb;">
            <h3 style="margin:0;">${product ? 'Edit Product' : 'Add Product'}</h3>
            <button style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#6b7280;" 
                    onclick="document.querySelector('.product-modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <input type="hidden" id="productId" value="${product ? product.id : ''}" />
            <div class="form-group">
              <label>Name *</label>
              <input type="text" id="prodName" class="form-control" value="${Utils.escapeHtml(product?.name || '')}" placeholder="Product name">
            </div>
            <div class="form-group">
              <label>Price *</label>
              <input type="number" step="0.01" id="prodPrice" class="form-control" value="${product?.price || ''}" placeholder="0.00">
            </div>
            <div class="form-group">
              <label>Stock</label>
              <input type="number" id="prodStock" class="form-control" value="${product?.stock || 0}" placeholder="0">
            </div>
            <div class="form-group">
              <label>Barcode</label>
              <input type="text" id="prodBarcode" class="form-control" value="${product?.barcode || ''}" placeholder="Barcode (optional)">
            </div>
            <div class="form-group">
              <label>Category</label>
              <input type="text" id="prodCategory" class="form-control" value="${product?.category || ''}" placeholder="e.g. HDPE Pipes">
            </div>
          </div>
          <div class="modal-footer" style="padding:12px 20px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn btn-outline" onclick="document.querySelector('.product-modal-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="Products.saveProduct()">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  },

  async saveProduct() {
    const id = document.getElementById('productId').value;
    const data = {
      name: document.getElementById('prodName').value.trim(),
      price: parseFloat(document.getElementById('prodPrice').value),
      stock: parseInt(document.getElementById('prodStock').value) || 0,
      barcode: document.getElementById('prodBarcode').value.trim(),
      category: document.getElementById('prodCategory').value.trim()
    };

    if (!data.name || isNaN(data.price)) return Utils.toast('Name and price required', 'error');

    try {
      if (id) {
        await DB._fetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await DB._fetch('/api/products', { method: 'POST', body: JSON.stringify(data) });
      }
      const overlay = document.querySelector('.product-modal-overlay');
      if (overlay) overlay.remove();
      Utils.toast('Product saved', 'success');
      this.loadList();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
      await DB._fetch(`/api/products/${id}`, { method: 'DELETE' });
      Utils.toast('Product deleted', 'success');
      this.loadList();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }
};