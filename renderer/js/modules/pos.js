const POS = {
  cart: [],
  selectedCustomer: null,
  products: [],
  customers: [],
  vatRate: 0.16,

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div style="padding:40px; text-align:center;">Loading Terminal...</div>';

    try {
      const response = await fetch('templates/pos.html');
      if (!response.ok) throw new Error('pos.html template not found');
      
      container.innerHTML = await response.text();
      this.attachEvents();
      
      await this.loadProducts();
      this.updateCartDisplay();

    } catch (error) {
      console.error(error);
      container.innerHTML = `<p style="color:red; padding:20px;">Failed to load POS: ${error.message}</p>`;
    }
  },

  attachEvents() {
    // Category filters
    document.getElementById('posCategoryBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('#posCategoryBar button').forEach(b => {
        b.classList.remove('btn-primary'); b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline'); btn.classList.add('btn-primary');
      this.loadProducts(btn.dataset.category);
    });

    // Search
    document.getElementById('searchProducts')?.addEventListener('input', (e) => {
      this.loadProducts(null, e.target.value.toLowerCase());
    });

    // Checkout
    document.getElementById('btnCheckout')?.addEventListener('click', () => this.checkout());
    
    // Clear Cart
    document.getElementById('btnClearCart')?.addEventListener('click', () => {
      this.cart = [];
      this.updateCartDisplay();
    });
  },

  async loadProducts(category = 'all', search = '') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    try {
      // Fetch secure products from backend
      const response = await DB._fetch('/api/products');
      let filtered = response || [];

      if (category && category !== 'all') {
        filtered = filtered.filter(p => (p.category || '').toLowerCase().includes(category));
      }
      if (search) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(search));
      }

      this.products = filtered;
      this.renderProductGrid(filtered);
    } catch (err) {
      grid.innerHTML = `<p style="color:red;">Failed to load products.</p>`;
    }
  },

  renderProductGrid(products) {
    const grid = document.getElementById('productGrid');
    if (products.length === 0) {
      grid.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No products found.</p>';
      return;
    }

    grid.innerHTML = `<div class="product-grid">${products.map(p => `
      <div class="product-card">
        <h4>${Utils.escapeHtml(p.name)}</h4>
        <span class="price">KES ${Utils.formatCurrency(p.price)}</span>
        <span class="stock">Stock: ${p.stock || 0}</span>
        <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="POS.addToCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
          Add to Order
        </button>
      </div>
    `).join('')}</div>`;
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existing = this.cart.find(item => item.productId === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({ 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1 
      });
    }
    this.updateCartDisplay();
  },

  updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!cartItems || !totalEl) return;

    if (this.cart.length === 0) {
      cartItems.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Cart is empty.</p>';
      totalEl.textContent = 'KES 0.00';
      return;
    }

    let subtotal = 0;
    cartItems.innerHTML = this.cart.map((item, idx) => {
      subtotal += item.price * item.quantity;
      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <span class="cart-item-title">${Utils.escapeHtml(item.name)}</span>
            <span class="cart-item-qty">${item.quantity} x KES ${Utils.formatCurrency(item.price)}</span>
          </div>
          <span class="cart-item-price">KES ${Utils.formatCurrency(item.price * item.quantity)}</span>
          <button class="btn btn-danger btn-sm" onclick="POS.removeFromCart(${idx})" style="padding:2px 6px;">&times;</button>
        </div>
      `;
    }).join('');

    const vatRate = parseFloat(document.getElementById('vatSelect')?.value || 0.16);
    const total = subtotal + (subtotal * vatRate);
    totalEl.textContent = `KES ${Utils.formatCurrency(total)}`;
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.updateCartDisplay();
  },

  async checkout() {
    if (this.cart.length === 0) return Utils.toast('Cart is empty.', 'warning');

    const paymentMethod = document.getElementById('paymentMethod')?.value || 'cash';
    const paymentRef = document.getElementById('paymentRef')?.value.trim() || 'REF-' + Date.now();
    const btn = document.getElementById('btnCheckout');

    // SECURITY: Idempotency Key prevents double-charging
    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Processing...';
    btn.disabled = true;

    try {
      const payload = {
        idempotency_key: idempotencyKey,
        items: this.cart.map(i => ({ productId: i.productId, quantity: i.quantity })), // ONLY send ID and Qty
        paymentMethod,
        payment_reference: paymentRef,
        customer_id: this.selectedCustomer || null,
        vat_rate: this.vatRate
      };

      const sale = await DB._fetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      Utils.toast(`Sale successful! Total: KES ${sale.total}`, 'success');
      this.cart = [];
      this.updateCartDisplay();
      this.loadProducts(); // Refresh stock

    } catch (err) {
      Utils.toast(err.message, 'danger');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
};

// Ensure app.js can find it
window.POS = POS;