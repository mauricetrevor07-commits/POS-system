const Products = {
  products: [],
  filteredProducts: [],
  searchQuery: '',
  categoryFilter: 'all',
  stockFilter: 'all',

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print">
        <h2>Product & Stock Management</h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="Products.exportStockTemplate()">
            <i class="bi bi-file-earmark-excel"></i> Export Stock Template
          </button>
          <button class="btn btn-outline" onclick="Products.openImportModal()">
            <i class="bi bi-upload"></i> Import Stock (Excel/CSV)
          </button>
          <button class="btn btn-primary" onclick="Products.openModal()">
            <i class="bi bi-plus-lg"></i> Add Product
          </button>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="card no-print" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div style="flex:2; min-width:200px;">
            <input type="text" id="prodSearchInput" class="form-control" placeholder="Search by name, barcode, or category..." oninput="Products.applyFilters()" />
          </div>
          <div style="flex:1; min-width:160px;">
            <select id="prodCatFilter" class="form-control" onchange="Products.applyFilters()">
              <option value="all">All Categories</option>
              <option value="pipe">HDPE Pipes</option>
              <option value="sack">Heavy Duty Sacks</option>
              <option value="fitting">Fittings & Accessories</option>
            </select>
          </div>
          <div style="flex:1; min-width:160px;">
            <select id="prodStockFilter" class="form-control" onchange="Products.applyFilters()">
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock (> 0)</option>
              <option value="low_stock">Low Stock (≤ 10)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600;">Product Inventory</span>
          <span id="prodCountBadge" class="badge badge-secondary">0 items</span>
        </div>
        <div class="card-body" id="productList" style="padding:0; overflow-x:auto;">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
    await this.loadList();
  },

  async loadList() {
    try {
      this.products = await DB._fetch('/api/products');
      this.applyFilters();
    } catch (e) {
      document.getElementById('productList').innerHTML = '<p style="padding:20px; color:#ef4444;">Failed to load products.</p>';
    }
  },

  applyFilters() {
    const query = (document.getElementById('prodSearchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('prodCatFilter')?.value || 'all';
    const stock = document.getElementById('prodStockFilter')?.value || 'all';

    this.filteredProducts = this.products.filter(p => {
      // Category filter
      const pCat = (p.category || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      if (cat === 'pipe' && !(pCat.includes('pipe') || pName.includes('pipe') || pCat.includes('hdpe'))) return false;
      if (cat === 'sack' && !(pCat.includes('sack') || pName.includes('sack'))) return false;
      if (cat === 'fitting' && !(pCat.includes('fitting') || pCat.includes('accessory') || pCat.includes('coupler'))) return false;

      // Stock status filter
      const s = parseFloat(p.stock || 0);
      if (stock === 'in_stock' && s <= 0) return false;
      if (stock === 'low_stock' && (s > 10 || s <= 0)) return false;
      if (stock === 'out_of_stock' && s > 0) return false;

      // Text search
      if (query) {
        const barcode = (p.barcode || '').toLowerCase();
        if (!pName.includes(query) && !pCat.includes(query) && !barcode.includes(query)) return false;
      }
      return true;
    });

    const badge = document.getElementById('prodCountBadge');
    if (badge) badge.textContent = `${this.filteredProducts.length} of ${this.products.length} items`;

    const html = this.filteredProducts.map(p => {
      const isPipe = (p.category || '').toLowerCase().includes('pipe');
      const isLow = p.stock <= 5;
      const isOut = p.stock <= 0;
      const wsPrice = p.wholesale_price !== null && p.wholesale_price !== undefined && p.wholesale_price !== ''
        ? `KES ${Utils.formatCurrency(p.wholesale_price)}`
        : `<span style="color:#94a3b8; font-size:0.75rem;">-</span>`;
      const distPrice = p.distributor_price !== null && p.distributor_price !== undefined && p.distributor_price !== ''
        ? `KES ${Utils.formatCurrency(p.distributor_price)}`
        : `<span style="color:#94a3b8; font-size:0.75rem;">-</span>`;

      return `
        <tr>
          <td>
            <strong>${Utils.escapeHtml(p.name)}</strong>
            ${p.barcode ? `<div style="font-size:0.75rem; color:#64748b;">Barcode: ${Utils.escapeHtml(p.barcode)}</div>` : ''}
          </td>
          <td><span class="badge badge-secondary">${Utils.escapeHtml(p.category || 'General')}</span></td>
          <td style="font-weight:600; color:#1e293b;">KES ${Utils.formatCurrency(p.price)}</td>
          <td style="color:#0284c7; font-weight:500;">${wsPrice}</td>
          <td style="color:#7c3aed; font-weight:500;">${distPrice}</td>
          <td>
            <span class="badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}" style="${isOut ? 'background:rgba(239,68,68,0.15); color:#ef4444;' : isLow ? 'background:rgba(245,158,11,0.15); color:#d97706;' : ''}">
              ${p.stock} ${isPipe ? 'meters' : 'units'}
            </span>
          </td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline" onclick="Products.openModal('${p.id}')"><i class="bi bi-pencil"></i> Edit</button>
            <button class="btn btn-sm btn-danger" onclick="Products.deleteProduct('${p.id}')"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('productList').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Product Description</th>
            <th>Category</th>
            <th>Retail Price</th>
            <th>Wholesale Price</th>
            <th>Distributor Price</th>
            <th>Current Stock</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>${html || '<tr><td colspan="7" class="text-center" style="padding:24px; color:#64748b;">No products matching filter</td></tr>'}</tbody>
      </table>`;
  },

  openModal(id = null) {
    const existing = document.querySelector('.product-modal-overlay');
    if (existing) existing.remove();

    const product = id ? this.products.find(p => p.id === id) : null;

    const html = `
      <div class="product-modal-overlay" onclick="if(event.target===this) this.remove()">
        <div class="product-modal-card" style="max-width: 520px; width: 90%;">
          <div class="modal-header">
            <h3>${product ? 'Edit Product' : 'Add New Product'}</h3>
            <button class="close-btn" onclick="document.querySelector('.product-modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <input type="hidden" id="productId" value="${product ? product.id : ''}" />
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-weight:600; margin-bottom:4px; display:block;">Product Name *</label>
              <input type="text" id="prodName" class="form-control" value="${Utils.escapeHtml(product?.name || '')}" placeholder="e.g. HDPE Pipe 32mm PN10">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-weight:600; margin-bottom:4px; display:block;">Category</label>
              <select id="prodCategory" class="form-control">
                <option value="HDPE Pipes" ${product?.category === 'HDPE Pipes' ? 'selected' : ''}>HDPE Pipes</option>
                <option value="Heavy Duty Sacks" ${product?.category === 'Heavy Duty Sacks' ? 'selected' : ''}>Heavy Duty Sacks</option>
                <option value="Fittings & Accessories" ${product?.category === 'Fittings & Accessories' ? 'selected' : ''}>Fittings & Accessories</option>
                <option value="General" ${(!product?.category || product?.category === 'General') ? 'selected' : ''}>General</option>
              </select>
            </div>
            
            <!-- Tiered Pricing Section -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px;">
              <div style="font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:8px; text-transform:uppercase;">
                <i class="bi bi-tags"></i> Tiered Category Pricing (KES)
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <div class="form-group">
                  <label style="font-size:0.75rem; font-weight:600; color:#1e293b; display:block; margin-bottom:4px;">Retail / Standard *</label>
                  <input type="number" step="0.01" id="prodPrice" class="form-control" value="${product?.price ?? ''}" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label style="font-size:0.75rem; font-weight:600; color:#0284c7; display:block; margin-bottom:4px;">Wholesale Price</label>
                  <input type="number" step="0.01" id="prodWholesalePrice" class="form-control" value="${product?.wholesale_price ?? ''}" placeholder="Optional">
                </div>
                <div class="form-group">
                  <label style="font-size:0.75rem; font-weight:600; color:#7c3aed; display:block; margin-bottom:4px;">Distributor Price</label>
                  <input type="number" step="0.01" id="prodDistributorPrice" class="form-control" value="${product?.distributor_price ?? ''}" placeholder="Optional">
                </div>
              </div>
              <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">
                Prices automatically apply in POS when a customer with that tier is selected.
              </div>
            </div>

            <div style="display:flex; gap:12px; margin-bottom:12px;">
              <div class="form-group" style="flex:1;">
                <label style="font-weight:600; margin-bottom:4px; display:block;">Current Stock</label>
                <input type="number" id="prodStock" class="form-control" value="${product?.stock || 0}" placeholder="0">
              </div>
              <div class="form-group" style="flex:1;">
                <label style="font-weight:600; margin-bottom:4px; display:block;">Barcode (Optional)</label>
                <input type="text" id="prodBarcode" class="form-control" value="${product?.barcode || ''}" placeholder="Scan or enter barcode">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.querySelector('.product-modal-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="Products.saveProduct()">Save Product</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  },

  async saveProduct() {
    const id = document.getElementById('productId')?.value;
    const wsVal = document.getElementById('prodWholesalePrice')?.value;
    const distVal = document.getElementById('prodDistributorPrice')?.value;
    const data = {
      name: document.getElementById('prodName')?.value.trim(),
      price: parseFloat(document.getElementById('prodPrice')?.value),
      wholesale_price: wsVal !== '' && wsVal !== null ? parseFloat(wsVal) : null,
      distributor_price: distVal !== '' && distVal !== null ? parseFloat(distVal) : null,
      stock: parseInt(document.getElementById('prodStock')?.value, 10) || 0,
      barcode: document.getElementById('prodBarcode')?.value.trim(),
      category: document.getElementById('prodCategory')?.value.trim()
    };

    if (!data.name || isNaN(data.price)) return Utils.toast('Name and Retail Price are required', 'error');

    try {
      if (id) {
        await DB._fetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await DB._fetch('/api/products', { method: 'POST', body: JSON.stringify(data) });
      }
      document.querySelector('.product-modal-overlay')?.remove();
      Utils.toast('Product saved successfully', 'success');
      this.loadList();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await DB._fetch(`/api/products/${id}`, { method: 'DELETE' });
      Utils.toast('Product deleted', 'success');
      this.loadList();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  },

  // ── Excel Export Template (No stock numbers, blank Stock to Add column) ──
  exportStockTemplate() {
    if (!this.products.length) return Utils.toast('No products available to export', 'warning');

    const data = this.products.map(p => ({
      'Product ID': p.id,
      'Product Name': p.name,
      'Category': p.category || 'General',
      'Unit Price (KES)': p.price,
      'Barcode': p.barcode || '',
      'Stock To Add': '' // left blank for the admin to type stock
    }));

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(data);
      // Auto width
      const wscols = [
        { wch: 38 }, // ID
        { wch: 35 }, // Name
        { wch: 20 }, // Category
        { wch: 15 }, // Price
        { wch: 18 }, // Barcode
        { wch: 15 }  // Stock to Add
      ];
      ws['!cols'] = wscols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Update');
      XLSX.writeFile(wb, `Autopak_Stock_Import_Template_${new Date().toISOString().slice(0,10)}.xlsx`);
      Utils.toast('Excel template exported successfully', 'success');
    } else {
      // Fallback to CSV
      let csv = 'Product ID,Product Name,Category,Unit Price (KES),Barcode,Stock To Add\n';
      data.forEach(row => {
        csv += `"${row['Product ID']}","${row['Product Name'].replace(/"/g, '""')}","${row['Category']}","${row['Unit Price (KES)']}","${row['Barcode']}",""\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Autopak_Stock_Template_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      Utils.toast('CSV template exported', 'success');
    }
  },

  // ── Excel Import Stock ───────────────────
  openImportModal() {
    const html = `
      <div class="product-modal-overlay" onclick="if(event.target===this) this.remove()">
        <div class="product-modal-card" style="max-width: 650px; width: 95%;">
          <div class="modal-header">
            <h3><i class="bi bi-file-earmark-arrow-up"></i> Import Stock from Excel / CSV</h3>
            <button class="close-btn" onclick="document.querySelector('.product-modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:16px;">
              Upload the completed stock template. The quantities in the <strong>Stock To Add</strong> column will be automatically added to the existing inventory.
            </p>

            <div style="border:2px dashed #cbd5e1; border-radius:10px; padding:25px; text-align:center; background:#f8fafc; margin-bottom:16px;">
              <input type="file" id="stockFileInput" accept=".xlsx, .xls, .csv" style="display:none;" onchange="Products.handleFileSelect(event)" />
              <i class="bi bi-cloud-arrow-up" style="font-size:2.5rem; color:var(--primary); display:block; margin-bottom:8px;"></i>
              <button class="btn btn-outline" onclick="document.getElementById('stockFileInput').click()">
                Choose Excel / CSV File
              </button>
              <div id="selectedFileName" style="margin-top:8px; font-size:0.85rem; font-weight:600; color:#0f172a;"></div>
            </div>

            <div id="importPreviewSection" style="display:none;">
              <h5 style="margin-bottom:8px;">Preview Stock Additions:</h5>
              <div style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
                <table style="font-size:0.85rem;">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th class="text-center">Current</th>
                      <th class="text-center" style="color:var(--primary);">+ Adding</th>
                      <th class="text-center" style="color:var(--success);">New Total</th>
                    </tr>
                  </thead>
                  <tbody id="importPreviewTable"></tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.querySelector('.product-modal-overlay').remove()">Cancel</button>
            <button class="btn btn-success" id="confirmImportBtn" style="display:none;" onclick="Products.confirmImport()">
              <i class="bi bi-check-lg"></i> Apply Stock Additions
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('selectedFileName').textContent = `Selected: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      let rows = [];

      if (typeof XLSX !== 'undefined') {
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet);
      } else {
        // Simple CSV parser
        const text = new TextDecoder().decode(data);
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
          const obj = {};
          headers.forEach((h, idx) => obj[h] = vals[idx]);
          rows.push(obj);
        }
      }

      this.parsedImportRows = [];
      let previewHTML = '';

      rows.forEach(r => {
        const id = r['Product ID'] || r['id'] || r['ID'];
        const name = r['Product Name'] || r['name'] || r['Name'];
        const barcode = r['Barcode'] || r['barcode'];
        const stockToAdd = parseFloat(r['Stock To Add'] || r['stock_to_add'] || r['Add Stock'] || r['quantity'] || 0);

        if (stockToAdd > 0) {
          const product = this.products.find(p => p.id === id || (barcode && p.barcode === barcode) || (name && p.name.toLowerCase() === name.toLowerCase()));
          const currStock = product ? parseFloat(product.stock || 0) : 0;
          const newTotal = currStock + stockToAdd;
          const prodName = product ? product.name : (name || 'Unknown Product');

          this.parsedImportRows.push({
            id: product ? product.id : id,
            name: prodName,
            barcode,
            stock_to_add: stockToAdd
          });

          previewHTML += `
            <tr>
              <td><strong>${Utils.escapeHtml(prodName)}</strong></td>
              <td class="text-center">${currStock}</td>
              <td class="text-center" style="font-weight:700; color:var(--primary);">+${stockToAdd}</td>
              <td class="text-center" style="font-weight:700; color:var(--success);">${newTotal}</td>
            </tr>
          `;
        }
      });

      const section = document.getElementById('importPreviewSection');
      const tbody = document.getElementById('importPreviewTable');
      const confirmBtn = document.getElementById('confirmImportBtn');

      if (this.parsedImportRows.length > 0) {
        section.style.display = 'block';
        tbody.innerHTML = previewHTML;
        confirmBtn.style.display = 'inline-flex';
        confirmBtn.innerHTML = `<i class="bi bi-check-lg"></i> Apply +${this.parsedImportRows.length} Products Stock`;
      } else {
        section.style.display = 'block';
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:#ef4444; padding:16px;">No products with positive "Stock To Add" found in file.</td></tr>';
        confirmBtn.style.display = 'none';
      }
    };

    reader.readAsArrayBuffer(file);
  },

  async confirmImport() {
    if (!this.parsedImportRows || !this.parsedImportRows.length) return;

    try {
      const res = await DB._fetch('/api/products/import-stock', {
        method: 'POST',
        body: JSON.stringify({ items: this.parsedImportRows })
      });

      document.querySelector('.product-modal-overlay')?.remove();
      Utils.toast(`Stock updated for ${res.updatedCount} products (+${res.totalStockAdded} total units/meters added)!`, 'success');
      this.loadList();
    } catch (e) {
      Utils.toast('Import failed: ' + e.message, 'error');
    }
  }
};