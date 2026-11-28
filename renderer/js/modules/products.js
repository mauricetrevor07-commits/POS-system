const Products = {
  products: [],
  filteredProducts: [],
  viewMode: 'inventory',
  matrixCategory: 'all',
  parsedImportRows: [],
  categories: [],

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
    document.getElementById('btnViewInventory')?.addEventListener('click', () => this.switchView('inventory'));
    document.getElementById('btnViewMatrix')?.addEventListener('click', () => this.switchView('matrix'));
    document.getElementById('btnExportTemplate')?.addEventListener('click', () => this.exportStockTemplate());
    document.getElementById('btnImportStock')?.addEventListener('click', () => this.openImportModal());
    document.getElementById('btnAddProduct')?.addEventListener('click', () => this.openModal());
    document.getElementById('btnManageCategories')?.addEventListener('click', () => this.openCategoryModal());

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
    const tbody = document.getElementById('productListBody');

    try {
      const [prodRes, catRes] = await Promise.all([
        DB._fetch('/api/products'),
        DB._fetch('/api/products/categories').catch(() => [])
      ]);
      this.products = Array.isArray(prodRes) ? prodRes : [];
      this.categories = Array.isArray(catRes) ? catRes : [];

      this.populateCategoryFilter();
      this.applyFilters();

    } catch (e) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--danger); padding:20px; font-weight:bold;">
        Failed to load products: ${e.message}
        </td></tr>`;
      }
    }
  },

  populateCategoryFilter() {
    const select = document.getElementById('prodCatFilter');
    if (!select) return;
    const currentVal = select.value || 'all';
    const names = new Set(this.categories.map(c => c.name));
    this.products.forEach(p => {if (p.category) names.add(p.category); });

    select.innerHTML = '<option value="all">All Categories</option>' +
    Array.from(names).sort().map(n => `<option value="${Utils.escapeHtml(n)}">${Utils.escapeHtml(n)}</option>`).join(' ');
    select.value = currentVal;
  },

  formatAttributesSummary(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';
    const entries = Object.entries(attrs).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${Utils.escapeHtml(String(v))}`).join(' &bull; ');
  },

  applyFilters() {
    const query = (document.getElementById('prodSearchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('prodCatFilter')?.value || 'all';
    const stock = document.getElementById('prodStockFilter')?.value || 'all';

    const safeProducts = Array.isArray(this.products) ? this.products : [];

    this.filteredProducts = safeProducts.filter(p => {
      const pCat = p.category || '';
      const pName = (p.name || '').toLowerCase();
      
      if (cat !== 'all' && pCat.toLowerCase() !== cat.toLowerCase()) return false;

      const s = parseFloat(p.stock || 0);
      if (stock === 'in_stock' && s <= 0) return false;
      if (stock === 'low_stock' && (s > 10 || s <= 0)) return false;
      if (stock === 'out_of_stock' && s > 0) return false;

      if (query) {
        const barcode = (p.barcode || '').toLowerCase();
        const attrStr = JSON.stringify(p.attributes || {}).toLowerCase();
        if (!pName.includes(query) && !pCat.includes(query) && !barcode.includes(query) && !attrStr.includes(query)) {
          return false;
      }
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
        const specs = this.formatAttributesSummary(p.attributes);
        
        return `
          <tr>
            <td>
              <strong>${Utils.escapeHtml(p.name)}</strong>
              ${specs ? `<div style="font-size:0.78rem; color:#0284c7;">${specs}</div>` : ''}
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
    const names = new Set(this.categories.map(c => c.name));
    this.products.forEach(p => {if (p.category) names.add(p.category); });

    const catButtons = ['all', ...Array.from(names).sort()].map(c => {
      const active = this.matrixCategory.toLowerCase() === c.toLowerCase();
      const label = c === 'all' ? 'All Categories' : Utils.escapeHtml(c);
      return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" onclick="Products.setMatrixCategory('${Utils.escapeHtml(c)}')">${label}</button>`;
    }).join('');
    
    // Build the matrix table HTML dynamically
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">${catButtons}</div>
          <div style="display:flex; gap: 10px;">
            <button class="btn btn-sm btn-outline" onclick="Products.bulkApplyCategoryDiscount(10, 20)">Set All -10%/ -20%</button>
            <button class="btn btn-sm btn-success" onclick="Products.saveCategoricalPriceMatrix()">Save Matrix</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0; overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product & Specs</th>
                <th>Category</th>
                <th>Retailer Price</th>
                <th>Wholesaler Price</th>
                <th>Distributor Price</th>
              </tr>
            </thead>
            <tbody>
              ${this.products.filter(p => this.matrixCategory === 'all' || (p.category || '').toLowerCase() === this.matrixCategory.toLowerCase()).map(p => {
                const specs = this.formatAttributesSummary(p.attributes);
              return `
                <tr data-prod-id="${p.id}">
                  <td>
                  <strong>${Utils.escapeHtml(p.name)}</strong>
                  ${specs ? `<div style="font-size:0.75rem; color:var(--text-muted);">${specs}</div>` : '' }
                  </td>
                  <td><span class="badge badge-neutral">${Utils.escapeHtml(p.category || 'General')}</span></td>
                  <td><input type="number" class="form-control matrix-retail" value="${p.price}" style="width:110px;" /></td>
                  <td><input type="number" class="form-control matrix-ws" value="${p.wholesale_price || ''}" placeholder="${p.price}" style="width:110px; color:#0284c7;" /></td>
                  <td><input type="number" class="form-control matrix-dist" value="${p.distributor_price || ''}" placeholder="${p.price}" style="width:110px; color:#7c3aed;" /></td>
                </tr>
              `;
              }).join('')}
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
    const catNames = new Set(this.categories.map(c => c.name));
    if (product?.category) catNames.add(product.category);
    catNames.add('General');

    const catOptions = Array.from(catNames).sort().map(name =>
      `<option value="${Utils.escapeHtml(name)}" ${product?.category === name ? 'selected' : ''}>${Utils.escapeHtml(name)}</option>`
    ).join('');
    
    Utils.showModal({
      title: product ? 'Edit Product' : 'Add New Product',
      content: `
        <input type="hidden" id="productId" value="${product ? product.id : ''}" />
        <div class="form-group">
        <label class="form-label">Category</label>
        <select id="prodCategory" class="form-control">${catOptions}</select>
        </div>

        <div id="dynamicAttributesContainer" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;"></div>

        <div class="form-group">
          <label class="form-label">Product Name * <small style="color:var(--text-muted);">(leave blank to auto-build from specs)</small></label>
          <input type="text" id="prodName" class="form-control" value="${product ? Utils.escapeHtml(product.name) : ''}" placeholder="e.g. Pipe 20mm 0.5 in PN8 SDR21" />
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

    const renderAttrFields = (catName, existingAttrs = {}) => {
      const box = document.getElementById('dynamicAttributesContainer');
      const cat = this.categories.find(c => c.name.toLowerCase() === (catName || '').toLowerCase());
      const schema = cat?.attributes_schema || [];

      if (!schema.length) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
      }

      box.style.display = 'grid';
      box.innerHTML = schema.map(field => {
        const val = existingAttrs[field.key] ?? '';
        return `
        <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.8rem;">${Utils.escapeHtml(field.label)}</label>
        <input type="${field.type === 'number' ? 'number' : 'text'}"
          step="any"
          class="form-control dynamic-attr-input"
          data-attr-key="${Utils.escapeHtml(field.key)}"
          value="${Utils.escapeHtml(String(val))}" />
        </div>
        `;
      }).join('');
    };

    const catSelect = document.getElementById('prodCategory');
    renderAttrFields(catSelect.value, product?.attributes || {});
    catSelect.addEventListener('change', () => renderAttrFields(catSelect.value, {}));

    document.getElementById('btnSaveProduct').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.innerHTML = '<span class="spinner"></span> Saving...';
      btn.disabled = true;

      const category = document.getElementById('prodCategory').value;
      const attributes = {};
      const attrValues = [];
      document.querySelectorAll('.dynamic-attr-input').forEach(inp => {
        const key = inp.dataset.attrKey;
        const val = inp.value.trim();
        if (val !== '') {
          attributes[key] = inp.type === 'number' ? parseFloat(val) : val;
          attrValues.push(val);
        } 
      });

      let name = document.getElementById('prodName').value.trim();
      if (!name && attrValues.length) {
        name = `${category} (${attrValues.join(' / ')})`;
      }

      const data = {
        name,
        category,
        attributes,
        price: parseFloat(document.getElementById('prodPrice').value),
        wholesale_price: parseFloat(document.getElementById('prodWholesalePrice').value) || null,
        distributor_price: parseFloat(document.getElementById('prodDistributorPrice').value) || null,
        stock: parseFloat(document.getElementById('prodStock').value) || 0,
        barcode: document.getElementById('prodBarcode').value.trim()
      };

      if (!data.name || isNaN(data.price)) {
        Utils.toast('Product Name (or specs) and Retail Price are required', 'warning');
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
  },

  openCategoryModal() {
    Utils.showModal({
      title : 'Manage Product Categories & Parameters',
      content: `
      <div class="form-group">
        <label class="form-label">Category Name *</label>
        <input type="text" id="catParamsInput" class="form-control" placeholder="e.g. Pipes, Water Tanks, Hardware" />
      </div>
      <div class="form-group">
        <label class="form-label">Parameters (comma-separated, leave blank if none)</label>
        <input type="text" id="catParamsInput" class="form-control" placeholders="e.g. Outer Diameter (mm), Nominal Size (in), PN, SDR" />
      </div>
      <div style="margin-top:14px;">
        <strong>Existing Categories:</strong>
        <ul style="margin-top:6px; padding-left:18px; font-size:0.85rem;">
          ${this.categories.map(c => `
            <li>
              <strong>${Utils.escapeHtml(c.name)}</strong>:
              ${(c.attributes_schema || []).map(a => Utils.escapeHtml(a.label)).join(', ') || 'No custom parameters'}
        </li>
      `).join('')}
      </ul>
      </div>
    `,
    footer: `
    <button class=:btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()>CLose</button>
    <button class="btn btn-primary" id="btnSaveCategory">Save Category</button>
    `
          });
          document.getElementById('btnSaveCategory').addEventListener('click', async () => {
            const name = document.getElementById('catNameInput').value.trim();
            const rawParams = document.getElementById('catParamsInput').value.trim();
            if (!name) return Utils.toast('Category name is required', 'warning');

            const attributes_schema = rawParams
              ? rawParams.split(',').map(s => s.trim()).filter(Boolean).map(label => ({
                key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
                label,
                type: 'text'
              }))
              : [];

              try {
                await DB._fetch('/api/products/categories', {
                  method: 'POST',
                  body: JSON.stringify({ name, attributes_schema })
                });
                document.querySelector('.modal-overlay').remove();
                Utils.toast('Category saved!', 'success');
                this.loadList();
              } catch (e) {
                Utils.toast(e.message, 'danger');
              }
          });
        },
      }
window.Products = Products;