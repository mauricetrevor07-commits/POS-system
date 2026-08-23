const Products = {
  products: [],
  filteredProducts: [],
  searchQuery: '',
  categoryFilter: 'all',
  stockFilter: 'all',
  viewMode: 'inventory', // 'inventory' | 'matrix'
  matrixCategory: 'all',

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar no-print" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="margin-bottom:4px;">Product & Categorical Pricing Management</h2>
          <div style="font-size:0.85rem; color:#64748b;">Manage inventory stock and specific tier prices (Retail, Wholesale, Distributor) per product per category</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <div style="background:#e2e8f0; border-radius:8px; padding:3px; display:flex; gap:2px;">
            <button class="btn btn-sm ${this.viewMode === 'inventory' ? 'btn-primary' : 'btn-outline'}" onclick="Products.switchView('inventory')" style="${this.viewMode === 'inventory' ? '' : 'border:none; background:transparent; color:#475569;'}">
              <i class="bi bi-boxes"></i> Inventory View
            </button>
            <button class="btn btn-sm ${this.viewMode === 'matrix' ? 'btn-primary' : 'btn-outline'}" onclick="Products.switchView('matrix')" style="${this.viewMode === 'matrix' ? '' : 'border:none; background:transparent; color:#475569;'}">
              <i class="bi bi-tags-fill"></i> Category Price Matrix
            </button>
          </div>
          <button class="btn btn-outline" onclick="Products.exportStockTemplate()">
            <i class="bi bi-file-earmark-excel"></i> Template
          </button>
          <button class="btn btn-outline" onclick="Products.openImportModal()">
            <i class="bi bi-upload"></i> Import Stock
          </button>
          <button class="btn btn-primary" onclick="Products.openModal()">
            <i class="bi bi-plus-lg"></i> Add Product
          </button>
        </div>
      </div>

      <div id="productsViewContainer">
        <!-- Rendered dynamically depending on viewMode -->
      </div>
    `;
    await this.loadList();
  },

  switchView(mode) {
    this.viewMode = mode;
    this.render();
  },

  async loadList() {
    try {
      this.products = await DB._fetch('/api/products');
      if (this.viewMode === 'matrix') {
        this.renderMatrixView();
      } else {
        this.renderInventoryView();
      }
    } catch (e) {
      const el = document.getElementById('productsViewContainer');
      if (el) el.innerHTML = '<p style="padding:20px; color:#ef4444;">Failed to load products.</p>';
    }
  },

  renderInventoryView() {
    const container = document.getElementById('productsViewContainer');
    if (!container) return;

    container.innerHTML = `
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
    this.applyFilters();
  },

  renderMatrixView() {
    const container = document.getElementById('productsViewContainer');
    if (!container) return;

    const categories = ['All Categories', 'HDPE Pipes', 'Heavy Duty Sacks', 'Fittings & Accessories', 'General'];

    const catTabs = categories.map(cat => {
      const active = (this.matrixCategory.toLowerCase() === cat.toLowerCase() || (this.matrixCategory === 'all' && cat === 'All Categories'));
      return `
        <button class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" onclick="Products.setMatrixCategory('${cat}')">
          ${cat}
        </button>
      `;
    }).join('');

    const filtered = this.products.filter(p => {
      if (this.matrixCategory === 'all' || this.matrixCategory === 'All Categories') return true;
      return (p.category || 'General').toLowerCase() === this.matrixCategory.toLowerCase();
    });

    const rows = filtered.map((p, idx) => {
      const retail = parseFloat(p.price || 0);
      const ws = p.wholesale_price !== null && p.wholesale_price !== undefined ? parseFloat(p.wholesale_price) : '';
      const dist = p.distributor_price !== null && p.distributor_price !== undefined ? parseFloat(p.distributor_price) : '';

      return `
        <tr data-prod-id="${p.id}">
          <td style="font-size:0.85rem; font-weight:600;">
            ${Utils.escapeHtml(p.name)}
            ${p.barcode ? `<div style="font-size:0.7rem; color:#94a3b8;">${Utils.escapeHtml(p.barcode)}</div>` : ''}
          </td>
          <td><span class="badge badge-secondary" style="font-size:0.75rem;">${Utils.escapeHtml(p.category || 'General')}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:0.8rem; color:#64748b;">KES</span>
              <input type="number" step="0.01" class="form-control matrix-retail" id="mat-retail-${p.id}" value="${retail}" style="width:110px; font-weight:600;" oninput="Products.recalcRowTiers('${p.id}')" />
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:0.8rem; color:#0284c7;">KES</span>
              <input type="number" step="0.01" class="form-control matrix-ws" id="mat-ws-${p.id}" value="${ws}" placeholder="Std (${retail})" style="width:110px; color:#0284c7; font-weight:600;" />
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:0.8rem; color:#7c3aed;">KES</span>
              <input type="number" step="0.01" class="form-control matrix-dist" id="mat-dist-${p.id}" value="${dist}" placeholder="Std (${retail})" style="width:110px; color:#7c3aed; font-weight:600;" />
            </div>
          </td>
          <td class="text-right">
            <div style="display:flex; gap:4px; justify-content:flex-end;">
              <button class="btn btn-xs btn-outline" onclick="Products.setRowTierDiscount('${p.id}', 10, 20)" title="Set WS -10%, Dist -20%">
                -10% / -20%
              </button>
              <button class="btn btn-xs btn-outline" onclick="Products.setRowTierDiscount('${p.id}', 15, 25)" title="Set WS -15%, Dist -25%">
                -15% / -25%
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <!-- Category Matrix Filter Bar -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${catTabs}
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <div style="font-size:0.8rem; font-weight:600; color:#475569;">Quick Fill in Category:</div>
            <button class="btn btn-sm btn-outline" onclick="Products.bulkApplyCategoryDiscount(10, 20)">
              Set All WS -10% / Dist -20%
            </button>
            <button class="btn btn-sm btn-outline" onclick="Products.bulkApplyCategoryDiscount(15, 25)">
              Set All WS -15% / Dist -25%
            </button>
            <button class="btn btn-sm btn-success" onclick="Products.saveCategoricalPricesMatrix()" style="padding:8px 20px; font-weight:600;">
              <i class="bi bi-check-circle-fill"></i> Save Category Tier Prices
            </button>
          </div>
        </div>
      </div>

      <!-- Price Matrix Table -->
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600;"><i class="bi bi-table"></i> Categorical Tier Price Matrix (Per Product)</span>
          <span class="badge badge-secondary">${filtered.length} products listed</span>
        </div>
        <div class="card-body" style="padding:0; overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th style="width:30%;">Product Description</th>
                <th style="width:15%;">Category</th>
                <th style="width:18%;">Retailer Price</th>
                <th style="width:18%;">Wholesaler Price</th>
                <th style="width:18%;">Distributor Price</th>
                <th style="width:15%;" class="text-right">Quick Apply</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="6" class="text-center" style="padding:24px; color:#64748b;">No products in this category</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="padding:14px 20px; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.85rem; color:#64748b;">All updates saved here directly apply to New Sale when customer tier is selected.</span>
          <button class="btn btn-primary" onclick="Products.saveCategoricalPricesMatrix()" style="padding:10px 24px; font-weight:600;">
            <i class="bi bi-save"></i> Save All Tier Prices
          </button>
        </div>
      </div>
    `;
  },

  setMatrixCategory(cat) {
    this.matrixCategory = (cat === 'All Categories') ? 'all' : cat;
    this.renderMatrixView();
  },

  setRowTierDiscount(prodId, wsPct, distPct) {
    const retailInput = document.getElementById(`mat-retail-${prodId}`);
    const wsInput = document.getElementById(`mat-ws-${prodId}`);
    const distInput = document.getElementById(`mat-dist-${prodId}`);
    if (!retailInput || !wsInput || !distInput) return;

    const retail = parseFloat(retailInput.value) || 0;
    wsInput.value = (Math.round(retail * (1 - wsPct / 100) * 100) / 100).toFixed(2);
    distInput.value = (Math.round(retail * (1 - distPct / 100) * 100) / 100).toFixed(2);
  },

  recalcRowTiers(prodId) {
    // If retail price changes, update placeholder
    const retailInput = document.getElementById(`mat-retail-${prodId}`);
    const wsInput = document.getElementById(`mat-ws-${prodId}`);
    const distInput = document.getElementById(`mat-dist-${prodId}`);
    if (!retailInput) return;
    const retail = parseFloat(retailInput.value) || 0;
    if (wsInput) wsInput.placeholder = `Std (${retail})`;
    if (distInput) distInput.placeholder = `Std (${retail})`;
  },

  bulkApplyCategoryDiscount(wsPct, distPct) {
    const filtered = this.products.filter(p => {
      if (this.matrixCategory === 'all' || this.matrixCategory === 'All Categories') return true;
      return (p.category || 'General').toLowerCase() === this.matrixCategory.toLowerCase();
    });

    filtered.forEach(p => {
      this.setRowTierDiscount(p.id, wsPct, distPct);
    });

    Utils.toast(`Calculated Wholesale (-${wsPct}%) & Distributor (-${distPct}%) for ${filtered.length} products in ${this.matrixCategory}`, 'info');
  },

  async saveCategoricalPricesMatrix() {
    const rows = document.querySelectorAll('#productsViewContainer tr[data-prod-id]');
    if (!rows.length) return Utils.toast('No products to update', 'warning');

    const updates = [];
    rows.forEach(tr => {
      const id = tr.getAttribute('data-prod-id');
      const retailInput = tr.querySelector('.matrix-retail');
      const wsInput = tr.querySelector('.matrix-ws');
      const distInput = tr.querySelector('.matrix-dist');

      if (id && retailInput) {
        updates.push({
          id,
          price: parseFloat(retailInput.value) || 0,
          wholesale_price: wsInput?.value ? parseFloat(wsInput.value) : null,
          distributor_price: distInput?.value ? parseFloat(distInput.value) : null
        });
      }
    });

    try {
      const res = await DB._fetch('/api/products/bulk-tier-prices', {
        method: 'POST',
        body: JSON.stringify({ updates })
      });
      Utils.toast(`Saved tier prices for ${res.updatedCount} products successfully!`, 'success');
      // Refresh internal product list
      this.products = await DB._fetch('/api/products');
    } catch (e) {
      Utils.toast(e.message || 'Failed to save tier prices', 'error');
    }
  },

  applyFilters() {
    const query = (document.getElementById('prodSearchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('prodCatFilter')?.value || 'all';
    const stock = document.getElementById('prodStockFilter')?.value || 'all';

    this.filteredProducts = this.products.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      if (cat === 'pipe' && !(pCat.includes('pipe') || pName.includes('pipe') || pCat.includes('hdpe'))) return false;
      if (cat === 'sack' && !(pCat.includes('sack') || pName.includes('sack'))) return false;
      if (cat === 'fitting' && !(pCat.includes('fitting') || pCat.includes('accessory') || pCat.includes('coupler'))) return false;

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

    const el = document.getElementById('productList');
    if (el) {
      el.innerHTML = `
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
    }
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