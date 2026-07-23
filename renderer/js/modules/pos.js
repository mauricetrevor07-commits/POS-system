const POS = {
  cart: [],
  selectedCustomer: null,
  products: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      ${Utils.companyPrintHeaderHTML}
      <div class="toolbar no-print"><h2>New Sale</h2></div>
      <div class="pos-layout no-print" style="display:flex; gap:1rem;">
        <div style="flex:2;">
          <div class="card">
            <div class="card-header">
              <input type="text" id="searchProducts" class="form-control" placeholder="Search product..." oninput="POS.search()" />
            </div>
            <div class="card-body" id="productGrid" style="max-height:450px; overflow-y:auto;"></div>
          </div>
        </div>
        <div style="flex:1;">
          <div class="card">
            <div class="card-header">
              Customer:
              <select id="customerSelect" onchange="POS.selectCustomer()" style="width:100%; margin-top:5px;">
                <option value="">Walk‑in</option>
              </select>
            </div>
            <div class="card-body" id="cartSection">
              <div id="cartItems"></div>
              <hr/>
              <div style="display:flex; justify-content:space-between; font-weight:bold;">
                <span>Total:</span>
                <span id="cartTotal">0.00</span>
              </div>
              <select id="paymentMethod" class="form-control" style="margin:5px 0;">
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
              <input type="text" id="paymentRef" class="form-control" placeholder="Payment Reference Number (e.g., MPESA code)" style="margin-bottom:5px;" />
              <button class="btn btn-success btn-block" onclick="POS.checkout()">Submit for Approval</button>
              <button class="btn btn-outline btn-block" onclick="POS.clearCart()">Clear</button>
            </div>
          </div>
        </div>
      </div>`;
    await this.loadProducts();
    await this.loadCustomers();
    this.updateCartDisplay();
  },

  async loadProducts(query = '') {
    const products = await DB._fetch('/api/products');
    this.products = products;
    const filtered = query ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : products;
    
    const html = filtered.map(p => {
      const isCuttable = p.category && p.category.toLowerCase().includes('pipe');
      const isBundle = p.category && p.category.toLowerCase().includes('bundle');
      const lengthInput = isCuttable ? `<input type="number" step="0.01" id="cut-${p.id}" value="1" style="width:100%; margin-bottom:8px;" class="form-control" placeholder="Length (m)" />` : '';
      const btnLabel = isCuttable ? 'Add (m)' : (isBundle ? 'Add Bundle' : 'Add to Cart');
      const icon = isBundle ? '📦' : '🛍️';
      
      return `
        <div class="product-card">
          <div>
            <div style="font-size:2rem; margin-bottom:8px;">${icon}</div>
            <h4>${Utils.escapeHtml(p.name)}</h4>
            <div class="price">${Utils.formatCurrency(p.price)}</div>
            <div class="stock">Stock: ${p.stock}</div>
          </div>
          <div>
            ${lengthInput}
            <button class="btn btn-primary btn-block" 
              onclick="POS.addToCart('${p.id}')" 
              ${p.stock <= 0 ? 'disabled' : ''}>
              <i class="bi bi-cart-plus"></i> ${btnLabel}
            </button>
          </div>
        </div>`;
    }).join('');
    
    document.getElementById('productGrid').innerHTML = `
      <div class="product-grid">
        ${html || '<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: #64748b;">No products found</div>'}
      </div>
    `;
  },

  async loadCustomers() {
    try {
      const customers = await DB._fetch('/api/customers');
      const sel = document.getElementById('customerSelect');
      customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  selectCustomer() {
    this.selectedCustomer = document.getElementById('customerSelect').value || null;
  },

  search() {
    this.loadProducts(document.getElementById('searchProducts').value);
  },

  addToCart(id, qtyOverride) {
    const p = this.products.find(prod => prod.id === id);
    if (!p) return;
    const isCuttable = p.category && p.category.toLowerCase().includes('pipe');
    const quantity = qtyOverride !== undefined ? qtyOverride : (isCuttable ? parseFloat(document.getElementById(`cut-${id}`).value) || 1 : 1);
    const exist = this.cart.find(i => i.productId === id);
    if (exist) exist.quantity += quantity;
    else this.cart.push({ productId: id, name: p.name, price: p.price, quantity });
    this.updateCartDisplay();
  },

  updateCartDisplay() {
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!itemsEl) return;
    let total = 0;
    itemsEl.innerHTML = this.cart.map((item, idx) => {
      const sub = item.price * item.quantity;
      total += sub;
      return `<div style="display:flex; justify-content:space-between; padding:2px 0;">
        <span>${item.name} (x${item.quantity})</span>
        <span>${sub.toFixed(2)}</span>
        <button class="btn btn-xs" onclick="POS.removeFromCart(${idx})">×</button>
      </div>`;
    }).join('');
    totalEl.textContent = total.toFixed(2);
  },

  removeFromCart(idx) {
    this.cart.splice(idx,1);
    this.updateCartDisplay();
  },

  clearCart() {
    this.cart = [];
    this.updateCartDisplay();
  },

  async checkout() {
    if (this.cart.length === 0) return Utils.toast('Cart empty', 'warning');

    const paymentMethod = document.getElementById('paymentMethod').value;
    const paymentRef = document.getElementById('paymentRef').value.trim();

    if (!paymentRef) return Utils.toast('Enter payment reference number', 'warning');
    if (!['mobile_money','bank_transfer','cheque'].includes(paymentMethod)) {
      return Utils.toast('Invalid payment method', 'error');
    }

    try {
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
      const branchName = window.currentBranch?.name || 'Unknown Branch';
      const dateTime = new Date().toLocaleString();
      const customerSelect = document.getElementById('customerSelect');
      const customerName = customerSelect.options[customerSelect.selectedIndex]?.text || 'Walk-in';

      let itemsText = '';
      for (const item of this.cart) {
        const sub = item.price * item.quantity;
        itemsText += `  • ${item.name} ×${item.quantity} @ ${item.price.toFixed(2)} = ${sub.toFixed(2)}\n`;
      }

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
        `Please log in to approve or reject this sale.`
      );
      
      const waUrl = `https://wa.me/${cleanPhone}?text=${fullMessage}`;
      window.open(waUrl, '_blank');

      // Save a copy of the cart items before clearing
      const orderedItems = [...this.cart];
      this.clearCart();
      this.loadProducts(); // refresh stock display

      Utils.toast(`Sale submitted. Awaiting admin approval. Ref: ${paymentRef}`, 'info');

    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }
};