const POS = {
  cart: [],
  selectedCustomer: null,
  products: [],
  customers: [],
  customerCustomPrices: {},
  selectedCategory: 'all',
  searchQuery: '',
  vatRate: 0.16,
  categoryPricing: {},

  async render() {
    const container = document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = '"text-align:center;">Loading Terminal...</div>';

    try {
      const response = await fetch('templates/pos.html');
      if (!response.ok) throw new Error('Template not found on server');

      const html = await response.text();
      container.innerHTML =html;

      this.attachEvents();
   
    await this.loadCategoryPricing();
    await this.loadProducts();
    await this.loadCustomers();
    this.updateCartDisplay();
  } catch (error) {
    console.error(error);
    container.innerHTML = `<p style="color=red; padding:20px;">Error: ${error.message}</p>`;
  }
},

  attachEvents() {
    const catBar = document.getElementById('posCategoryBar');
    if (catBar) {
      catBar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        catBar.querySelectorAll('button').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline');
        });
          btn.classList.add('btn-outline');
          btn.classList.add('btn-primary');

          this.setCategory(btn.dataset.category);
        });
      }

    const searchInput = document.getElementById('searchProducts');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.filterAndRenderProducts();
      });
    }

    const custSelect = document.getElementById('customerSelect');
    if (custSelect) {
      custSelect.addEventListener('change', () => {
        this.selectedCustomer = custSelect.value || null;
        this.selectCustomer();
      });
    }

    const vatSelect = document.getElementById('vatSelect');
    if (vatSelect) {
      vatSelect.addEventListener('change', (e) => {
        this.vatRate = parseFloat(e.target.value);
        this.updateCartDisplay();
      });
    }

    const payMethod = document.getElementById('paymentMethod');
    if (payMethod) {
      payMethod.addEventListener('change', () => this.onPaymentMethodChange());
    }
    
    document.getElementById('btnCheckout')?.addEventListener('click', () => this.checkout());
    document.getElementById('btnClearCart')?.addEventListener('click', () => this.clearCart());
  },

  setCategory(cat) {
    this.selectedCategory = cat;
    this.filterAndRenderProducts();
  },

  onPaymentMethodChange() {
    const method = document.getElementById('paymentMethod')?.value;
    const creditSec = document.getElementById('creditTermsSection');

    if (creditSec) {
      creditSec.style.display = (method === 'credit')? 'block' : 'none';
    }
  },

  getItemUnitPrice(p) {
    if (this.customerCustomPrices[p.id] !== undefined && this.customerCustomPrices[p.id] !==null) {
      return parseFloat(this.customerCustomPrices[p.id]);
    }
    const cust = this.customers.find(c => c.id === this.selectedCustomer);
    const tier = (cust?.customer_type || 'retailer').toLowerCase();

    if (tier === 'distributor' && p.distributor_price) return parseFloat(p.distributor_price);
    if (tier === 'wholesaler' && p.wholesale_price) return parseFloat(p.wholesale_price);

    return parseFloat(p.price || 0);
  },

  filterAndRenderProducts() {
    const grid = document.getElementById('productGrid');
    if(!grid) return;

    const filtered = this.products.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();

      let matchesCat = true;
      if (this.selectedCategory === 'pipe') matchesCat = pCat.includes('pipe') || pName.includes('pipe');
      else if (this.selectedCategory === 'sack') matchesCat = pCat.includes('sack') || pNname.includes('sack');
      else if (this.selectedCategory === 'fittings') matchesCat = pCat.includes('fitting') || pCat.includes('coupler');

      if (!matchesCat) return false;
      if (!this.searchQuery) return true;

      return pName.includes(this.searchQuery) || pCat.includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="text-align-center; padding:20px; color:#64748b;">No products found.</p>';
      return;
    }

    grid.innerHTML = `<div class="product-grid">${filtered.map(p => {
      const unitPrice = this.getItemUnitPrice(p);
      const pName = Utils.escapeHtml(p.name);
      const pCat = utils.escapeHtml(p.category || 'General');

      return `
      <div class="product-card">
        <h4>${pName}</h4>
        <span class="stock">${pCat}</span>
          <span class="price">KES ${Utils.formatCurrency(unitPrice)}</span>
          <span class="stock" style="${p.stock <= 5 ? 'color:var(--danger);' : ''}">Stock: ${p.stock}</span>
          
          <button class="btn btn-primary btn-sm" style="margin-top:10px; width:100%;" 
            data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
            Add to Order
          </button>
        </div>
      `;
    }).join('')}</div>`;

    // Attach click events to the new buttons safely
    grid.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => this.addToCart(btn.dataset.id));
    });
  },

  addToCart(id) {
    const p = this.products.find(prod => prod.id === id);
    if (!p) return;

    const unitPrice = this.getItemUnitPrice(p);
    const exist = this.cart.find(i => i.productId === id);
    
    if (exist) {
      exist.quantity += 1;
    } else {
      this.cart.push({ productId: id, name: p.name, price: unitPrice, quantity: 1 });
    }
    this.updateCartDisplay();
  },

  updateCartDisplay() {
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!itemsEl || !totalEl) return;

    if (this.cart.length === 0) {
      itemsEl.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Cart is empty.</p>';
      totalEl.textContent = 'KES 0.00';
      return;
    }

    let subtotal = 0;
    itemsEl.innerHTML = this.cart.map((item, idx) => {
      const sub = item.price * item.quantity;
      subtotal += sub;
      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <span class="cart-item-title">${Utils.escapeHtml(item.name)}</span>
            <span class="cart-item-qty">${item.quantity} x KES ${Utils.formatCurrency(item.price)}</span>
          </div>
          <span class="cart-item-price">KES ${Utils.formatCurrency(sub)}</span>
          <button class="btn btn-danger btn-sm" data-remove="${idx}">&times;</button>
        </div>
      `;
    }).join('');

    // Attach remove events
    itemsEl.querySelectorAll('button[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.cart.splice(parseInt(btn.dataset.remove), 1);
        this.updateCartDisplay();
      });
    });

    const vatAmount = subtotal * this.vatRate;
    const grandTotal = subtotal + vatAmount;
    totalEl.textContent = `KES ${Utils.formatCurrency(grandTotal)}`;
  },

  async checkout() {
    if (this.cart.length === 0) return Utils.toast('Cart is empty.', 'warning');

    const paymentMethod = document.getElementById('paymentMethod')?.value;
    const paymentRef = document.getElementById('paymentRef')?.value.trim();
    const btn = document.getElementById('btnCheckout');

    if (paymentMethod !== 'credit' && !paymentRef) {
      return Utils.toast('Enter payment transaction reference.', 'warning');
    }

    // Set Loading state
    const originalBtn = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Processing...';
    btn.disabled = true;

    try {
      // 🔥 CRITICAL SECURITY NOTE: 
      // We send productIds and quantities. 
      // The backend MUST calculate the price. Do not trust `item.price` from the client.
      const payload = {
        items: this.cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
        payment_reference: paymentRef,
        customer_id: this.selectedCustomer || null,
        vat_rate: this.vatRate,
      };

      const sale = await DB._fetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      Utils.toast(`Sale submitted! Ref: ${sale.id.slice(0,8)}`, 'success');
      this.clearCart();
      await this.loadProducts(); // Refresh stock

    } catch (error) {
      Utils.toast(error.message || 'Checkout failed', 'danger');
    } finally {
      btn.innerHTML = originalBtn;
      btn.disabled = false;
    }
  },

  clearCart() {
    this.cart = [];
    this.updateCartDisplay();
  },

  // ... [Keep loadProducts, loadCustomers, selectCustomer, and loadCategoryPricing methods mostly the same, but ensure they use Utils.escapeHtml when injecting names] ...
  async loadProducts() {
    try {
      this.products = await DB._fetch('/api/products');
      this.filterAndRenderProducts();
    } catch (e) {
      Utils.toast('Failed to load products', 'danger');
    }
  },

  async loadCustomers() {
    try {
      this.customers = await DB._fetch('/api/customers') || [];
      const sel = document.getElementById('customerSelect');
      if (!sel) return;
      
      sel.innerHTML = '<option value="">Walk-in Customer [RETAIL]</option>';
      this.customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        const tier = (c.customer_type || 'retailer').toUpperCase();
        opt.textContent = `${c.name} [${tier}]`;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  async selectCustomer() {
    this.customerCustomPrices = {};
    if (this.selectedCustomer) {
      try {
        const cpList = await DB._fetch(`/api/customer-prices/${this.selectedCustomer}`);
        (cpList || []).forEach(cp => {
          this.customerCustomPrices[cp.product_id] = parseFloat(cp.custom_price);
        });
      } catch (_) {}
    }
    this.filterAndRenderProducts();
    this.updateCartDisplay();
  },

  async loadCategoryPricing() {
    try {
      const rows = await DB._fetch('/api/category-pricing');
      (rows || []).forEach(r => {
        this.categoryPricing[(r.category || '').toLowerCase()] = r;
      });
    } catch (_) {}
  }
};