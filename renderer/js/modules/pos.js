const POS = {
  cart: [],
  selectedCustomer: null,
  products: [],
  selectedCategory: 'all',
  searchQuery: '',

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      ${Utils.companyPrintHeaderHTML}
      <div class="toolbar no-print">
        <h2>New Sale Terminal</h2>
      </div>

      <!-- Category Filter Tabs -->
      <div class="pos-category-bar no-print" id="posCategoryBar" style="display:flex; gap:8px; margin-bottom:16px; overflow-x:auto; padding-bottom:4px;">
        <button class="btn btn-sm ${this.selectedCategory === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="POS.setCategory('all')">
          <i class="bi bi-grid-fill"></i> All Products
        </button>
        <button class="btn btn-sm ${this.selectedCategory === 'pipe' ? 'btn-primary' : 'btn-outline'}" onclick="POS.setCategory('pipe')">
          <i class="bi bi-water"></i> HDPE Pipes
        </button>
        <button class="btn btn-sm ${this.selectedCategory === 'sack' ? 'btn-primary' : 'btn-outline'}" onclick="POS.setCategory('sack')">
          <i class="bi bi-box-seam"></i> Heavy Duty Sacks
        </button>
        <button class="btn btn-sm ${this.selectedCategory === 'fittings' ? 'btn-primary' : 'btn-outline'}" onclick="POS.setCategory('fittings')">
          <i class="bi bi-wrench"></i> Fittings & Accessories
        </button>
      </div>

      <div class="pos-layout no-print" style="display:flex; gap:1.5rem; align-items:flex-start;">
        <div style="flex:2;">
          <div class="card">
            <div class="card-header" style="display:flex; gap:12px; align-items:center;">
              <div style="flex:1; position:relative;">
                <input type="text" id="searchProducts" class="form-control" placeholder="Search product by name, barcode, or category..." oninput="POS.search()" />
              </div>
            </div>
            <div class="card-body" id="productGrid" style="max-height:520px; overflow-y:auto;">
              <div class="loading-spinner"></div>
            </div>
          </div>
        </div>

        <div style="flex:1; min-width:320px;">
          <div class="card" style="box-shadow:var(--shadow-md);">
            <div class="card-header" style="background:#f8fafc;">
              <label style="font-weight:600; font-size:0.9rem; margin-bottom:4px; display:block;">Select Customer</label>
              <select id="customerSelect" class="form-control" onchange="POS.selectCustomer()">
                <option value="">Walk‑in Customer</option>
              </select>
            </div>
            <div class="card-body" id="cartSection" style="padding:16px;">
              <div style="font-weight:600; font-size:0.85rem; color:#64748b; margin-bottom:8px; text-transform:uppercase;">Current Order</div>
              <div id="cartItems" style="min-height:120px; max-height:220px; overflow-y:auto; margin-bottom:12px;"></div>
              
              <div style="border-top:1.5px solid var(--border); padding-top:10px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:1.25rem; font-weight:700; color:var(--primary);">
                  <span>Total Due:</span>
                  <span>KES <span id="cartTotal">0.00</span></span>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:0.8rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Payment Method</label>
                <select id="paymentMethod" class="form-control">
                  <option value="mobile_money">M-Pesa / Mobile Money</option>
                  <option value="bank_transfer">Bank Transfer / EFT</option>
                  <option value="cheque">Cheque Deposit</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:0.8rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Payment Reference (e.g. M-Pesa Code)</label>
                <input type="text" id="paymentRef" class="form-control" placeholder="Enter Transaction Ref #" />
              </div>

              <button class="btn btn-success btn-block" onclick="POS.checkout()" style="padding:12px; font-size:1rem;">
                <i class="bi bi-send-check"></i> Submit Sale for Approval
              </button>
              <button class="btn btn-outline btn-block" onclick="POS.clearCart()" style="margin-top:6px;">
                <i class="bi bi-trash"></i> Clear Order
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadProducts();
    await this.loadCustomers();
    this.updateCartDisplay();
  },

  setCategory(cat) {
    this.selectedCategory = cat;
    // update button styles
    const bar = document.getElementById('posCategoryBar');
    if (bar) {
      bar.querySelectorAll('button').forEach(btn => {
        btn.className = 'btn btn-sm btn-outline';
      });
      event?.target?.closest('button')?.classList?.remove('btn-outline');
      event?.target?.closest('button')?.classList?.add('btn-primary');
    }
    this.filterAndRenderProducts();
  },

  search() {
    this.searchQuery = (document.getElementById('searchProducts')?.value || '').toLowerCase();
    this.filterAndRenderProducts();
  },

  async loadProducts() {
    try {
      this.products = await DB._fetch('/api/products');
      this.filterAndRenderProducts();
    } catch (e) {
      document.getElementById('productGrid').innerHTML = '<p style="color:#ef4444; padding:20px;">Failed to load products.</p>';
    }
  },

  filterAndRenderProducts() {
    const query = this.searchQuery;
    const cat = this.selectedCategory;

    const filtered = this.products.filter(p => {
      // Category match
      const pCat = (p.category || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      
      let matchesCat = true;
      if (cat === 'pipe') {
        matchesCat = pCat.includes('pipe') || pName.includes('pipe') || pCat.includes('hdpe');
      } else if (cat === 'sack') {
        matchesCat = pCat.includes('sack') || pName.includes('sack');
      } else if (cat === 'fittings') {
        matchesCat = pCat.includes('fitting') || pCat.includes('accessory') || pCat.includes('coupler');
      }

      if (!matchesCat) return false;

      // Text match
      if (!query) return true;
      const barcode = (p.barcode || '').toLowerCase();
      return pName.includes(query) || pCat.includes(query) || barcode.includes(query);
    });

    const html = filtered.map(p => {
      const pCat = (p.category || '').toLowerCase();
      const isCuttable = pCat.includes('pipe');
      const isBundle = pCat.includes('bundle') || pCat.includes('sack');
      const lengthInput = isCuttable
        ? `<input type="number" step="0.5" min="0.5" id="cut-${p.id}" value="1" style="width:100%; margin-bottom:8px; text-align:center;" class="form-control" placeholder="Length (m)" />`
        : '';
      const btnLabel = isCuttable ? 'Add Length (m)' : (isBundle ? 'Add Sacks' : 'Add to Order');
      const icon = isCuttable ? '🌊' : (pCat.includes('sack') ? '📦' : '🛍️');

      return `
        <div class="product-card">
          <div>
            <div style="font-size:2rem; margin-bottom:6px;">${icon}</div>
            <h4 style="margin-bottom:4px; font-size:1rem;">${Utils.escapeHtml(p.name)}</h4>
            <div style="font-size:0.75rem; color:#64748b; margin-bottom:8px;">${Utils.escapeHtml(p.category || 'General')}</div>
            <div class="price">KES ${Utils.formatCurrency(p.price)}</div>
            <div class="stock" style="${p.stock <= 5 ? 'color:#ef4444; font-weight:600;' : ''}">
              Stock: ${p.stock} ${isCuttable ? 'm' : 'units'}
            </div>
          </div>
          <div style="margin-top:10px;">
            ${lengthInput}
            <button class="btn btn-primary btn-block" 
              onclick="POS.addToCart('${p.id}')" 
              ${p.stock <= 0 ? 'disabled' : ''}>
              <i class="bi bi-cart-plus"></i> ${btnLabel}
            </button>
          </div>
        </div>`;
    }).join('');

    const grid = document.getElementById('productGrid');
    if (grid) {
      grid.innerHTML = `
        <div class="product-grid">
          ${html || '<div style="grid-column: 1/-1; text-align:center; padding: 2.5rem; color: #64748b;"><i class="bi bi-search" style="font-size:2rem; display:block; margin-bottom:8px;"></i>No products found in this category</div>'}
        </div>
      `;
    }
  },

  async loadCustomers() {
    try {
      const customers = await DB._fetch('/api/customers');
      this.customers = customers;
      const sel = document.getElementById('customerSelect');
      if (!sel) return;
      customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} ${c.kra_pin ? '(' + c.kra_pin + ')' : ''}`;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  selectCustomer() {
    this.selectedCustomer = document.getElementById('customerSelect')?.value || null;
  },

  addToCart(id, qtyOverride) {
    const p = this.products.find(prod => prod.id === id);
    if (!p) return;
    const isCuttable = p.category && p.category.toLowerCase().includes('pipe');
    const quantity = qtyOverride !== undefined
      ? qtyOverride
      : (isCuttable ? parseFloat(document.getElementById(`cut-${id}`)?.value) || 1 : 1);

    const exist = this.cart.find(i => i.productId === id);
    if (exist) {
      exist.quantity += quantity;
    } else {
      this.cart.push({ productId: id, name: p.name, price: p.price, quantity });
    }
    this.updateCartDisplay();
  },

  updateCartDisplay() {
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!itemsEl) return;
    let total = 0;
    
    if (this.cart.length === 0) {
      itemsEl.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px 0; font-size:0.9rem;">Cart is empty. Select items to add.</p>';
      if (totalEl) totalEl.textContent = '0.00';
      return;
    }

    itemsEl.innerHTML = this.cart.map((item, idx) => {
      const sub = item.price * item.quantity;
      total += sub;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9;">
          <div style="flex:1; padding-right:8px;">
            <div style="font-weight:600; font-size:0.85rem;">${Utils.escapeHtml(item.name)}</div>
            <div style="font-size:0.75rem; color:#64748b;">${item.quantity} × KES ${Utils.formatCurrency(item.price)}</div>
          </div>
          <span style="font-weight:600; font-size:0.85rem; margin-right:8px;">KES ${Utils.formatCurrency(sub)}</span>
          <button class="btn btn-xs btn-danger" onclick="POS.removeFromCart(${idx})" title="Remove item">×</button>
        </div>`;
    }).join('');

    if (totalEl) totalEl.textContent = Utils.formatCurrency(total);
  },

  removeFromCart(idx) {
    this.cart.splice(idx, 1);
    this.updateCartDisplay();
  },

  clearCart() {
    this.cart = [];
    this.updateCartDisplay();
  },

  async checkout() {
    if (this.cart.length === 0) return Utils.toast('Cart is empty. Add products first.', 'warning');

    const paymentMethod = document.getElementById('paymentMethod')?.value || 'mobile_money';
    const paymentRef = document.getElementById('paymentRef')?.value.trim() || '';

    if (!paymentRef) return Utils.toast('Enter payment transaction reference number', 'warning');

    try {
      const customerObj = this.customers?.find(c => c.id === this.selectedCustomer);
      const customerName = customerObj?.name || 'Walk-in Customer';

      const sale = await DB._fetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: this.cart.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            productName: i.name,
            price: i.price
          })),
          paymentMethod,
          payment_reference: paymentRef,
          customer_id: this.selectedCustomer || null
        })
      });

      const adminPhone = window.currentBranch?.whatsapp || '+254700000000';
      const cleanPhone = adminPhone.replace(/[^0-9]/g, '');
      const branchName = window.currentBranch?.name || 'Main Branch';
      const dateTime = new Date().toLocaleString();

      let itemsText = '';
      for (const item of this.cart) {
        const sub = item.price * item.quantity;
        itemsText += `  • ${item.name} ×${item.quantity} @ ${item.price.toFixed(2)} = ${sub.toFixed(2)}\n`;
      }

      // Deep link to pending payments screen
      const pendingUrl = `${window.location.origin}/#pending-payments`;

      const fullMessage = encodeURIComponent(
        `*New Sale Submitted for Approval*\n\n` +
        `*Sale ID:* ${sale.id.slice(0, 8)}\n` +
        `*Branch:* ${branchName}\n` +
        `*Date:* ${dateTime}\n` +
        `*Customer:* ${customerName}\n` +
        `*Payment Method:* ${paymentMethod.replace('_', ' ').toUpperCase()}\n` +
        `*Reference No:* ${paymentRef}\n` +
        `*Total:* KES ${Utils.formatCurrency(sale.total)}\n\n` +
        `*Order Items:*\n${itemsText}\n` +
        `*Approve or Reject Sale Here:*\n${pendingUrl}`
      );
      
      const waUrl = `https://wa.me/${cleanPhone}?text=${fullMessage}`;
      window.open(waUrl, '_blank');

      // Preserve ordered items for immediate printing
      const orderedItems = [...this.cart];
      const completedSale = {
        id: sale.id,
        timestamp: new Date().toISOString(),
        total: sale.total,
        paymentMethod,
        payment_reference: paymentRef,
        customer_name: customerName,
        customer_kra_pin: customerObj?.kra_pin,
        customer_address: customerObj?.address,
        created_by: currentUser?.username || 'Cashier',
        items: orderedItems
      };

      this.clearCart();
      this.loadProducts(); // refresh stock display

      Utils.toast(`Sale submitted! Ref: ${paymentRef}`, 'success');

      // Prompt for print options immediately
      Utils.showModal({
        title: `<i class="bi bi-check2-circle" style="color:var(--success);"></i> Sale Submitted for Approval`,
        content: `
          <div style="padding:10px 0;">
            <p>Sale <strong>#${sale.id.slice(0,8)}</strong> has been recorded and submitted to the admin via WhatsApp.</p>
            <p style="margin-top:10px; color:#475569;">Would you like to print a <strong>Tax Invoice</strong> or <strong>Delivery Note</strong> for this customer?</p>
          </div>
        `,
        footer: `
          <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Done</button>
          <button class="btn btn-primary" onclick="document.querySelector('.modal-overlay')?.remove(); Utils.showPrintDialog(${JSON.stringify(completedSale).replace(/"/g, '&quot;')})">
            <i class="bi bi-printer"></i> Print Invoice / Delivery Note
          </button>
        `
      });

    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }
};