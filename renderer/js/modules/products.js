console.log("🔥 products.js loaded into browser!");

const Products = {
  products: [],
  filteredProducts: [],
  viewMode: 'inventory',
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
    document.getElementById('btnViewInventory')?.addEventListener('click', () => this.switchView('inventory'));
    document.getElementById('btnViewMatrix')?.addEventListener('click', () => this.switchView('matrix'));
    document.getElementById('btnExportTemplate')?.addEventListener('click', () => this.exportStockTemplate());
    document.getElementById('btnImportStock')?.addEventListener('click', () => this.openImportModal());
    document.getElementById('btnAddProduct')?.addEventListener('click', () => this.openModal());

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
    console.log("1. Starting LoadList...");
    const tbody = document.getElementById('productListBody');

    try {
      const response = await DB._fetch('/api/products');
      // FIXED: Array must be capitalized
      console.log("2. API response received. Is it an Array?", Array.isArray(response)); 
      console.log("3. Number of items:", response.length);

      this.products = Array.isArray(response) ? response : [];
      console.log("4. calling apply filters()...");
      this.applyFilters();

    } catch (e) {
      console.error("🔥 Error loading products:", e);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--danger); padding:20px; font-weight:bold;">
        Failed to load products: ${e.message}
        </td></tr>`;
      }
    }
  },

  applyFilters() {
    console.log("5. inside apply filters. total products:", this.products.length);
    const query = (document.getElementById('prodSearchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('prodCatFilter')?.value || 'all';
    const stock = document.getElementById('prodStockFilter')?.value || 'all';

    const safeProducts = Array.isArray(this.products) ? this.products : [];

    this.filteredProducts = safeProducts.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      
      if (cat === 'pipe' && !(pCat.includes('pipe') || pName.includes('pipe'))) return false;
      if (cat === 'sack' && !(pCat.includes('sack') || pName.includes('sack'))) return false;
      if (cat === 'fitting' && !(pCat.includes('fitting') || pName.includes('coupler'))) return false;

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

    console.log("6. Filtered products count:", this.filteredProducts.length);
    console.log("7. calling renderInventoryTable()...");
    this.renderInventoryTable();
  },

  renderInventoryTable() {
    console.log("8. Inside renderInventoryTable...");
    const badge = document.getElementById('prodCountBadge');
    if (badge) badge.textContent = `${this.filteredProducts.length} of ${this.products.length} items`;

    const tbody = document.getElementById('productListBody');
    if (!tbody) {
      console.error("DOM Error: #productListBody not found in the HTML.");
      return;
    }

    if (this.filteredProducts.length === 0) {
      console.log("10. no products found after filter. rendering empty state.");
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:24px; color:var(--text-muted);">No products found.</td></tr>';
      return;
    }

    console.log("10. rendering rows...");
    try {
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
      console.log("11. rows rendered successfully!");

    } catch (err) {
      console.error("🔥 error rendering html:", err);
      // FIXED: Extra > removed
      tbody.innerHTML = `<tr><td colspan="7" style="color:red; padding:20px;">HTML render error: ${err.message}</td></tr>`;
    }
  },

  // ... (Keep the rest of the file exactly the same for Matrix, Modal, Export, Import) ...
  // Paste your renderMatrixView, setMatrixCategory, bulkApplyCategoryDiscount, saveCategoricalPricesMatrix, openModal, deleteProduct, exportStockTemplate, and openImportModal here.
};

window.Products = Products;