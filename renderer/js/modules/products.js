const Products = {
  products: [],
  filteredProducts: [],
  viewMode: 'inventory', // 'inventory' | 'matrix'
  matrixCategory: 'all',
  parsedImportRows: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div style="padding:40px; text-align:center;">Loading Products...</div>';

    try {
      const response = await fetch('/templates/products.html');
      if (!response.ok) throw new Error('Products template not found');

      container.innerHTML = await response.text();

      this.attachGlobalEvents();
      await this.loadList();

    } catch (error) {
      console.error(error);
      container.innerHTML = `<p style="color:red; padding:20px;">Failed to load Inventory: ${error.message}</p>`;
    }
  },

  attachGlobalEvents() {
    // View Toggles
    document.getElementById('btnViewInventory')?.addEventListener('click', () => this.switchView('inventory'));
    document.getElementById('btnViewMatrix')?.addEventListener('click', () => this.switchView('matrix'));
    
    // Toolbar Buttons
    document.getElementById('btnExportTemplate')?.addEventListener('click', () => this.exportStockTemplate());
    document.getElementById('btnImportStock')?.addEventListener('click', () => this.openImportModal());
    document.getElementById('btnAddProduct')?.addEventListener('click', () => this.openModal());

    // Inventory Filters
    const filters = ['prodSearchInput', 'prodCatFilter', 'prodStockFilter'];
    filters.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.applyFilters());
      document.getElementById(id)?.addEventListener('change', () => this.applyFilters());
    });
  },

  switchView(mode) {
    this.viewMode = mode;
    
    const invBtn = document.getElementById('btnViewInventory');
    const matBtn = document.getElementById('btnViewMatrix');
    
    if (mode === 'inventory') {
      document.getElementById('inventoryViewContainer').classList.remove('hidden');
      document.getElementById('matrixViewContainer').classList.add('hidden');
      invBtn.className = 'btn btn-sm btn-primary';
      matBtn.className = 'btn btn-sm btn-outline';
    } else {
      document.getElementById('inventoryViewContainer').classList.add('hidden');
      document.getElementById('matrixViewContainer').classList.remove('hidden');
      invBtn.className = 'btn btn-sm btn-outline';
      matBtn.className = 'btn btn-sm btn-primary';
      this.renderMatrixView();
    }
  },

  async loadList() {
    try {
      this.products = await DB._fetch('/api/products');
      if (this.viewMode === 'matrix') this.renderMatrixView();
      else this.applyFilters();
    } catch (e) {
      document.getElementById('productListBody').innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--danger); padding:20px;">Failed to load products.</td></tr>`;
    }
  },

  applyFilters() {
    const query = (document.getElementById('prodSearchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('prodCatFilter')?.value || 'all';
    const stock = document.getElementById('prodStockFilter')?.value || 'all';

    this.filteredProducts = this.products.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      
      if (cat === 'pipe' && !(pCat.includes('pipe') || pName.includes('pipe'))) return false;
      if (cat === 'sack' && !(pCat.includes('sack') || pName.includes('sack'))) return false;
      if (cat === 'fitting' && !(pCat.includes('fitting') || pCat.includes('coupler'))) return false;

      const s = parseFloat(p.stock || 0);
      if (stock === 'in_stock' && s <= 0) return false;
      if (stock === 'low_stock' && (s > 10 || s <= 0)) return false;
      if (stock === 'out_of_stock' && s > 0) return false;

      if (query) {
        const barcode = (p.barcode || '').toLowerCase();
        if (!pName.includes(query) && !pCat.includes(query) && !barcode.includes(query)) return false;
      }
      return true;
    });

    this.renderInventoryTable();
  },

  renderInventoryTable() {
    const badge = document.getElementById('prodCountBadge');
    if (badge) badge.textContent = `${this.filteredProducts.length} of ${this.products.length} items`;

    const tbody = document.getElementById('productListBody');
    if (!tbody) return;

    if (this.filteredProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:24px; color:var(--text-muted);">No products found.</td></tr>';
      return;
    }

    tbody.innerHTML = this.filteredProducts.map(p => {
      const isLow = p.stock <= 5;
      const isOut = p.stock <= 0;
      
      return `
        <tr>
          <td>
            <strong>${Utils.escapeHtml(p.name)}</strong>
            ${p.barcode ? `<div style="font-size:0.75rem; color:var(--text-muted);">Barcode: ${Utils.escapeHtml(p.barcode)}</div>` : ''}
          </td>
          <td><span class="badge badge-neutral">${Utils.escapeHtml(p.category || 'General')}</span></td>
          <td style="font-weight:600;">KES ${Utils.formatCurrency(p.price)}</td>
          <td style="color:#0284c7;">${p.wholesale_price ? `KES ${Utils.formatCurrency(p.wholesale_price)}` : '-'}</td>
          <td style="color:#7c3aed;">${p.distributor_price ? `KES ${Utils.formatCurrency(p.distributor_price)}` : '-'}</td>
          <td>
            <span class="badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}">
              ${p.stock} units
            </span>
          </td>
          <td class="text-right">
            <button class="btn btn-secondary btn-sm" onclick="Products.openModal('${p.id}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-danger btn-sm" onclick="Products.deleteProduct('${p.id}')"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderMatrixView() {
    const container = document.getElementById('matrixViewContainer');
    
    // Build the matrix table HTML dynamically
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary" onclick="Products.setMatrixCategory('all')">All Categories</button>
            <button class="btn btn-sm btn-outline" onclick="Products.setMatrixCategory('HDPE Pipes')">HDPE Pipes</button>
            <button class="btn btn-sm btn-outline" onclick="Products.setMatrixCategory('Fittings & Accessories')">Fittings</button>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-sm btn-outline" onclick="Products.bulkApplyCategoryDiscount(10, 20)">Set All -10% / -20%</button>
            <button class="btn btn-sm btn-success" onclick="Products.saveCategoricalPricesMatrix()">Save Matrix</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0; overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Retailer Price</th>
                <th>Wholesaler Price</th>
                <th>Distributor Price</th>
              </tr>
            </thead>
            <tbody>
              ${this.products.filter(p => this.matrixCategory === 'all' || (p.category || '').toLowerCase() === this.matrixCategory.toLowerCase()).map(p => `
                <tr data-prod-id="${p.id}">
                  <td><strong>${Utils.escapeHtml(p.name)}</strong></td>
                  <td><span class="badge badge-neutral">${p.category}</span></td>
                  <td><input type="number" class="form-control matrix-retail" value="${p.price}" style="width:110px;" /></td>
                  <td><input type="number" class="form-control matrix-ws" value="${p.wholesale_price || ''}" placeholder="${p.price}" style="width:110px; color:#0284c7;" /></td>
                  <td><input type="number" class="form-control matrix-dist" value="${p.distributor_price || ''}" placeholder="${p.price}" style="width:110px; color:#7c3aed;" /></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  setMatrixCategory(cat) {
    this.matrixCategory = cat;
    this.renderMatrixView();
  },

  bulkApplyCategoryDiscount(wsPct, distPct) {
    document.querySelectorAll('tr[data-prod-id]').forEach(tr => {
      const retailInput = tr.querySelector('.matrix-retail');
      const wsInput = tr.querySelector('.matrix-ws');
      const distInput = tr.querySelector('.matrix-dist');
      if (!retailInput) return;
      
      const retail = parseFloat(retailInput.value) || 0;
      wsInput.value = (Math.round(retail * (1 - wsPct / 100) * 100) / 100).toFixed(2);
      distInput.value = (Math.round(retail * (1 - distPct / 100) * 100) / 100).toFixed(2);
    });
  },

  async saveCategoricalPricesMatrix() {
    const rows = document.querySelectorAll('tr[data-prod-id]');
    const updates = [];
    
    rows.forEach(tr => {
      const id = tr.getAttribute('data-prod-id');
      const retail = parseFloat(tr.querySelector('.matrix-retail').value) || 0;
      const ws = parseFloat(tr.querySelector('.matrix-ws').value) || null;
      const dist = parseFloat(tr.querySelector('.matrix-dist').value) || null;
      updates.push({ id, price: retail, wholesale_price: ws, distributor_price: dist });
    });

    try {
      await DB._fetch('/api/products/bulk-tier-prices', {
        method: 'POST',
        body: JSON.stringify({ updates })
      });
      Utils.toast('Tier prices saved!', 'success');
      this.loadList();
    } catch (e) {
      Utils.toast(e.message, 'danger');
    }
  },

  openModal(id = null) {
    const product = id ? this.products.find(p => p.id === id) : null;
    
    Utils.showModal({
      title: product ? 'Edit Product' : 'Add New Product',
      content: `
        <input type="hidden" id="productId" value="${product ? product.id : ''}" />
        <div class="form-group">
          <label class="form-label">Product Name *</label>
          <input type="text" id="prodName" class="form-control" value="${product ? Utils.escapeHtml(product.name) : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="prodCategory" class="form-control">
            <option value="HDPE Pipes" ${product?.category === 'HDPE Pipes' ? 'selected' : ''}>HDPE Pipes</option>
            <option value="Fittings & Accessories" ${product?.category === 'Fittings & Accessories' ? 'selected' : ''}>Fittings & Accessories</option>
            <option value="Heavy Duty Sacks" ${product?.category === 'Heavy Duty Sacks' ? 'selected' : ''}>Heavy Duty Sacks</option>
            <option value="General" ${product?.category === 'General' ? 'selected' : ''}>General</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label" style="color:var(--text-main);">Retail Price *</label>
            <input type="number" id="prodPrice" class="form-control" value="${product?.price || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label" style="color:#0284c7;">Wholesale Price</label>
            <input type="number" id="prodWholesalePrice" class="form-control" value="${product?.wholesale_price || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label" style="color:#7c3aed;">Distributor Price</label>
            <input type="number" id="prodDistributorPrice" class="form-control" value="${product?.distributor_price || ''}" />
          </div>
        </div>
        <div style="display:flex; gap:12px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Current Stock</label>
            <input type="number" id="prodStock" class="form-control" value="${product?.stock || 0}" />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Barcode (Optional)</label>
            <input type="text" id="prodBarcode" class="form-control" value="${product?.barcode || ''}" />
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="btnSaveProduct">Save Product</button>
      `
    });

    document.getElementById('btnSaveProduct').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.innerHTML = '<span class="spinner"></span> Saving...';
      btn.disabled = true;

      const data = {
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        wholesale_price: parseFloat(document.getElementById('prodWholesalePrice').value) || null,
        distributor_price: parseFloat(document.getElementById('prodDistributorPrice').value) || null,
        stock: parseInt(document.getElementById('prodStock').value) || 0,
        barcode: document.getElementById('prodBarcode').value.trim()
      };

      if (!data.name || isNaN(data.price)) {
        Utils.toast('Name and Retail Price are required', 'warning');
        btn.innerHTML = 'Save Product';
        btn.disabled = false;
        return;
      }

      try {
        if (product) {
          await DB._fetch(`/api/products/${product.id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
          await DB._fetch('/api/products', { method: 'POST', body: JSON.stringify(data) });
        }
        document.querySelector('.modal-overlay').remove();
        Utils.toast('Product saved!', 'success');
        this.loadList();
      } catch (err) {
        Utils.toast(err.message, 'danger');
        btn.innerHTML = 'Save Product';
        btn.disabled = false;
      }
    });
  },

  async deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await DB._fetch(`/api/products/${id}`, { method: 'DELETE' });
      Utils.toast('Product deleted', 'success');
      this.loadList();
    } catch (e) {
      Utils.toast(e.message, 'danger');
    }
  },

  exportStockTemplate() {
    if (!this.products.length) return Utils.toast('No products available', 'warning');
    
    const data = this.products.map(p => ({
      'Product ID': p.id,
      'Product Name': p.name,
      'Category': p.category || 'General',
      'Unit Price': p.price,
      'Barcode': p.barcode || '',
      'Stock To Add': ''
    }));

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Update');
      XLSX.writeFile(wb, `Autopak_Stock_Template.xlsx`);
      Utils.toast('Template exported!', 'success');
    } else {
      Utils.toast('Excel library not loaded', 'danger');
    }
  },

  openImportModal() {
    Utils.showModal({
      title: 'Import Stock',
      content: `
        <p style="margin-bottom:16px; color:var(--text-muted);">Upload the completed template. Quantities in the "Stock To Add" column will be added to inventory.</p>
        <input type="file" id="stockFileInput" accept=".xlsx, .xls, .csv" class="form-control" />
        <div id="importPreview" style="margin-top:16px;"></div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-success" id="btnApplyImport" style="display:none;">Apply Additions</button>
      `
    });

    document.getElementById('stockFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        this.parsedImportRows = [];
        let previewHTML = '<table class="data-table"><thead><tr><th>Product</th><th>+ Adding</th></tr></thead><tbody>';
        
        rows.forEach(r => {
          const id = r['Product ID'] || r['id'];
          const stockToAdd = parseFloat(r['Stock To Add'] || r['stock_to_add'] || 0);
          
          if (id && stockToAdd > 0) {
            const p = this.products.find(prod => prod.id === id);
            if (p) {
              this.parsedImportRows.push({ id: p.id, stock_to_add: stockToAdd });
              previewHTML += `<tr><td>${Utils.escapeHtml(p.name)}</td><td style="color:var(--success); font-weight:bold;">+${stockToAdd}</td></tr>`;
            }
          }
        });
        
        previewHTML += '</tbody></table>';
        document.getElementById('importPreview').innerHTML = previewHTML;
        
        if (this.parsedImportRows.length > 0) {
          const btn = document.getElementById('btnApplyImport');
          btn.style.display = 'inline-flex';
          btn.textContent = `Apply to ${this.parsedImportRows.length} Products`;
        }
      };
      reader.readAsArrayBuffer(file);
    });

    document.getElementById('btnApplyImport').addEventListener('click', async () => {
      try {
        await DB._fetch('/api/products/import-stock', {
          method: 'POST',
          body: JSON.stringify({ items: this.parsedImportRows })
        });
        document.querySelector('.modal-overlay').remove();
        Utils.toast('Stock imported successfully!', 'success');
        this.loadList();
      } catch (err) {
        Utils.toast(err.message, 'danger');
      }
    });
  }
};

window.Products = Products;