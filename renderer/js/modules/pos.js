const POS = {
  cart: [],
  selectedCustomer: null,
  products: [],
  customers: [],
  customerCustomPrices: {},
  selectedCategory: 'all',
  searchQuery: '',
  vatRate: 0.16,

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
            <div class="card-body" id="productGrid" style="max-height:540px; overflow-y:auto;">
              <div class="loading-spinner"></div>
            </div>
          </div>
        </div>

        <div style="flex:1; min-width:330px;">
          <div class="card" style="box-shadow:var(--shadow-md);">
            <div class="card-header" style="background:#f8fafc; padding:14px 16px;">
              <label style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block;">Select Customer</label>
              <select id="customerSelect" class="form-control" onchange="POS.selectCustomer()">
                <option value="">Walk‑in Customer [RETAIL]</option>
              </select>
              <div id="customerTierBadge" style="margin-top:6px; min-height:20px;"></div>
            </div>
            <div class="card-body" id="cartSection" style="padding:16px;">
              <div style="font-weight:600; font-size:0.85rem; color:#64748b; margin-bottom:8px; text-transform:uppercase;">Current Order</div>
              <div id="cartItems" style="min-height:100px; max-height:190px; overflow-y:auto; margin-bottom:12px;"></div>
              
              <!-- Value Added Tax (VAT) Dropdown Selection -->
              <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:0.8rem; font-weight:600; color:#475569; display:block; margin-bottom:4px;">
                  <i class="bi bi-percent"></i> Value Added Tax (VAT)
                </label>
                <select id="vatSelect" class="form-control" onchange="POS.onVatChange()" style="font-size:0.88rem; font-weight:500;">
                  <option value="0.16" ${this.vatRate === 0.16 ? 'selected' : ''}>Value Added Tax Included (16% VAT)</option>
                  <option value="0" ${this.vatRate === 0 ? 'selected' : ''}>Without Value Added Tax (0% / Exempt)</option>
                </select>
              </div>

              <!-- Cart Summary Breakdown -->
              <div style="background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#64748b; margin-bottom:4px;">
                  <span>Subtotal (Excl. VAT):</span>
                  <span>KES <span id="cartSubtotal">0.00</span></span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#0284c7; margin-bottom:6px;">
                  <span id="vatLabelText">${this.vatRate > 0 ? 'VAT (16%):' : 'VAT (0% Exempt):'}</span>
                  <span>KES <span id="cartVat">0.00</span></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:1.15rem; font-weight:700; color:var(--primary); border-top:1px dashed #cbd5e1; padding-top:6px;">
                  <span>Grand Total:</span>
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

  onVatChange() {
    this.vatRate = parseFloat(document.getElementById('vatSelect')?.value || '0.16');
    const vatLabel = document.getElementById('vatLabelText');
    if (vatLabel) {
      vatLabel.textContent = this.vatRate > 0 ? 'VAT (16%):' : 'VAT (0% Exempt):';
    }
    this.updateCartDisplay();
  },

  setCategory(cat) {
    this.selectedCategory = cat;
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

  getItemUnitPrice(p) {
    // 1. Highest priority: Specific customer negotiated custom price
    if (this.customerCustomPrices && this.customerCustomPrices[p.id] !== undefined && this.customerCustomPrices[p.id] !== null) {
      return parseFloat(this.customerCustomPrices[p.id]);
    }
    // 2. Customer tier price
    const cust = this.customers.find(c => c.id === this.selectedCustomer);
    const tier = (cust?.customer_type || 'retailer').toLowerCase();
    if (tier === 'distributor' && p.distributor_price !== null && p.distributor_price !== undefined && p.distributor_price !== '') {
      return parseFloat(p.distributor_price);
    }
    if (tier === 'wholesaler' && p.wholesale_price !== null && p.wholesale_price !== undefined && p.wholesale_price !== '') {
      return parseFloat(p.wholesale_price);
    }
    // 3. Standard Retail Price
    return parseFloat(p.price || 0);
  },

  filterAndRenderProducts() {
    const query = this.searchQuery;
    const cat = this.selectedCategory;

    const filtered = this.products.filter(p => {
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

      if (!query) return true;
      const barcode = (p.barcode || '').toLowerCase();
      return pName.includes(query) || pCat.includes(query) || barcode.includes(query);
    });

    const cust = this.customers.find(c => c.id === this.selectedCustomer);
    const tier = (cust?.customer_type || 'retailer').toLowerCase();

    const html = filtered.map(p => {
      const pCat = (p.category || '').toLowerCase();
      const isCuttable = pCat.includes('pipe');
      const isBundle = pCat.includes('bundle') || pCat.includes('sack');
      const lengthInput = isCuttable
        ? `<input type="number" step="0.5" min="0.5" id="cut-${p.id}" value="1" style="width:100%; margin-bottom:8px; text-align:center;" class="form-control" placeholder="Length (m)" />`
        : '';
      const btnLabel = isCuttable ? 'Add Length (m)' : (isBundle ? 'Add Sacks' : 'Add to Order');
      const icon = isCuttable ? '🌊' : (pCat.includes('sack') ? '📦' : '🛍️');

      const unitPrice = this.getItemUnitPrice(p);
      const hasCustomPrice = this.customerCustomPrices && this.customerCustomPrices[p.id] !== undefined;

      let tierNote = '';
      if (hasCustomPrice) {
        tierNote = '<div style="margin-top:3px;"><span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:700;"><i class="bi bi-tag-fill"></i> Custom Customer Price</span></div>';
      } else if (tier === 'distributor' && p.distributor_price) {
        tierNote = '<div style="margin-top:3px;"><span class="badge" style="background:#ede9fe; color:#7c3aed; font-size:0.7rem; font-weight:600;"><i class="bi bi-diagram-3"></i> Distributor Tier</span></div>';
      } else if (tier === 'wholesaler' && p.wholesale_price) {
        tierNote = '<div style="margin-top:3px;"><span class="badge" style="background:#e0f2fe; color:#0284c7; font-size:0.7rem; font-weight:600;"><i class="bi bi-box-seam"></i> Wholesale Tier</span></div>';
      }

      const priceDisplay = (hasCustomPrice || (tier !== 'retailer' && unitPrice !== p.price))
        ? `<div class="price" style="${hasCustomPrice ? 'color:#15803d;' : ''}">
             <span style="text-decoration:line-through; font-size:0.8rem; color:#94a3b8; margin-right:4px;">KES ${Utils.formatCurrency(p.price)}</span>
             KES ${Utils.formatCurrency(unitPrice)}
           </div>`
        : `<div class="price">KES ${Utils.formatCurrency(unitPrice)}</div>`;

      return `
        <div class="product-card">
          <div>
            <div style="font-size:2rem; margin-bottom:6px;">${icon}</div>
            <h4 style="margin-bottom:4px; font-size:1rem;">${Utils.escapeHtml(p.name)}</h4>
            <div style="font-size:0.75rem; color:#64748b; margin-bottom:6px;">${Utils.escapeHtml(p.category || 'General')}</div>
            ${priceDisplay}
            ${tierNote}
            <div class="stock" style="${p.stock <= 5 ? 'color:#ef4444; font-weight:600;' : ''}; margin-top:6px;">
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
      this.customers = customers || [];
      const sel = document.getElementById('customerSelect');
      if (!sel) return;
      sel.innerHTML = '<option value="">Walk‑in Customer [RETAIL]</option>';
      this.customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        const tier = (c.customer_type || 'retailer').toUpperCase();
        opt.textContent = `${c.name} [${tier}] ${c.kra_pin ? '(' + c.kra_pin + ')' : ''}`;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  async selectCustomer() {
    this.selectedCustomer = document.getElementById('customerSelect')?.value || null;
    this.customerCustomPrices = {};

    if (this.selectedCustomer) {
      try {
        const cpList = await DB._fetch(`/api/customer-prices/${this.selectedCustomer}`);
        (cpList || []).forEach(cp => {
          this.customerCustomPrices[cp.product_id] = parseFloat(cp.custom_price);
        });
      } catch (_) {}
    }

    const cust = this.customers.find(c => c.id === this.selectedCustomer);
    const tierBadge = document.getElementById('customerTierBadge');
    if (tierBadge) {
      if (!cust) {
        tierBadge.innerHTML = '<span class="badge badge-secondary" style="font-size:0.75rem;">Standard Retail Pricing</span>';
      } else {
        const tier = (cust.customer_type || 'retailer').toLowerCase();
        const customCount = Object.keys(this.customerCustomPrices).length;
        let customBadgeHtml = customCount > 0
          ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:700; margin-left:6px;"><i class="bi bi-tag-fill"></i> ${customCount} Custom Price(s) Active</span>`
          : '';

        if (tier === 'distributor') {
          tierBadge.innerHTML = `<span class="badge" style="background:#ede9fe; color:#7c3aed; font-size:0.75rem; font-weight:600;"><i class="bi bi-tags-fill"></i> Distributor Tier</span>${customBadgeHtml}`;
        } else if (tier === 'wholesaler') {
          tierBadge.innerHTML = `<span class="badge" style="background:#e0f2fe; color:#0284c7; font-size:0.75rem; font-weight:600;"><i class="bi bi-tags-fill"></i> Wholesale Tier</span>${customBadgeHtml}`;
        } else {
          tierBadge.innerHTML = `<span class="badge badge-secondary" style="font-size:0.75rem;">Retail Tier</span>${customBadgeHtml}`;
        }
      }
    }

    // Refresh cart item prices with the customer's custom or tier pricing
    this.cart.forEach(item => {
      const p = this.products.find(prod => prod.id === item.productId);
      if (p) {
        item.price = this.getItemUnitPrice(p);
      }
    });

    this.filterAndRenderProducts();
    this.updateCartDisplay();
  },

  addToCart(id, qtyOverride) {
    const p = this.products.find(prod => prod.id === id);
    if (!p) return;
    const isCuttable = p.category && p.category.toLowerCase().includes('pipe');
    const quantity = qtyOverride !== undefined
      ? qtyOverride
      : (isCuttable ? parseFloat(document.getElementById(`cut-${id}`)?.value) || 1 : 1);

    const unitPrice = this.getItemUnitPrice(p);

    const exist = this.cart.find(i => i.productId === id);
    if (exist) {
      exist.quantity += quantity;
      exist.price = unitPrice;
    } else {
      this.cart.push({ productId: id, name: p.name, price: unitPrice, quantity });
    }
    this.updateCartDisplay();
  },

  updateCartDisplay() {
    const itemsEl = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('cartSubtotal');
    const vatEl = document.getElementById('cartVat');
    const totalEl = document.getElementById('cartTotal');
    if (!itemsEl) return;
    
    let subtotal = 0;
    
    if (this.cart.length === 0) {
      itemsEl.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px 0; font-size:0.9rem;">Cart is empty. Select items to add.</p>';
      if (subtotalEl) subtotalEl.textContent = '0.00';
      if (vatEl) vatEl.textContent = '0.00';
      if (totalEl) totalEl.textContent = '0.00';
      return;
    }

    itemsEl.innerHTML = this.cart.map((item, idx) => {
      const sub = item.price * item.quantity;
      subtotal += sub;
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

    const vatRate = this.vatRate !== undefined ? this.vatRate : 0.16;
    const vatAmount = vatRate > 0 ? Math.round(subtotal * vatRate * 100) / 100 : 0;
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;

    if (subtotalEl) subtotalEl.textContent = Utils.formatCurrency(subtotal);
    if (vatEl) vatEl.textContent = Utils.formatCurrency(vatAmount);
    if (totalEl) totalEl.textContent = Utils.formatCurrency(grandTotal);
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
      const vatRate = this.vatRate !== undefined ? this.vatRate : 0.16;

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
          customer_id: this.selectedCustomer || null,
          vat_rate: vatRate
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
        `*Subtotal:* KES ${Utils.formatCurrency(sale.subtotal || 0)}\n` +
        `*VAT (${(sale.vat_rate || 0) * 100}%):* KES ${Utils.formatCurrency(sale.vat_amount || 0)}\n` +
        `*Grand Total:* KES ${Utils.formatCurrency(sale.total)}\n\n` +
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
        subtotal: sale.subtotal,
        vat_rate: sale.vat_rate,
        vat_amount: sale.vat_amount,
        total: sale.total,
        paymentMethod,
        payment_reference: paymentRef,
        payment_status: 'pending_payment',
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