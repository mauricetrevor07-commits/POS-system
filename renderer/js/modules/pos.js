const POS = {
  cart: [],
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
            <div class="card-body" id="productGrid" style="max-height:450px; overflow-y:auto;">
              <div class="loading-spinner"></div>
            </div>
          </div>
        </div>
        <div style="flex:1;">
          <div class="card">
            <div class="card-header">Cart</div>
            <div class="card-body" id="cartSection">
              <div id="cartItems"></div>
              <hr/>
              <div style="display:flex; justify-content:space-between; font-weight:bold;">
                <span>Total:</span>
                <span id="cartTotal">0.00</span>
              </div>
              <select id="paymentMethod" class="form-control" style="margin:5px 0;">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile">Mobile Money</option>
              </select>
              <button class="btn btn-success btn-block" onclick="POS.checkout()">Checkout</button>
              <button class="btn btn-outline btn-block" onclick="POS.clearCart()">Clear</button>
            </div>
          </div>
        </div>
      </div>`;
    await this.loadProducts();
    this.updateCartDisplay();
  },
  async loadProducts(query = '') {
    const products = await DB._fetch('/api/products');
    const filtered = query ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : products;
    const html = filtered.map(p => `
      <tr>
        <td>${Utils.escapeHtml(p.name)}</td>
        <td>${Utils.formatCurrency(p.price)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="POS.addToCart(${p.id},'${Utils.escapeHtml(p.name)}',${p.price})" ${p.stock<=0?'disabled':''}>Add</button>
        </td>
      </tr>`).join('');
    document.getElementById('productGrid').innerHTML = `
      <table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>${html||'<tr><td colspan="4">No products</td></tr>'}</tbody></table>`;
  },
  search() {
    this.loadProducts(document.getElementById('searchProducts').value);
  },
  addToCart(id, name, price) {
    const exist = this.cart.find(i => i.productId === id);
    if (exist) exist.quantity++;
    else this.cart.push({ productId: id, name, price, quantity: 1 });
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
    try {
      const sale = await DB._fetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: this.cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod
        })
      });
      this.printReceipt(sale);
      this.clearCart();
      this.loadProducts(); // refresh stock
      Utils.toast('Sale completed', 'success');
    } catch (e) { Utils.toast(e.message, 'error'); }
  },
  printReceipt(sale) {
    const itemsHtml = this.cart.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.price.toFixed(2)}</td><td>${(i.price*i.quantity).toFixed(2)}</td></tr>`).join('');
    const html = `
      <html><head><title>Receipt</title>
        <style>
          body { font-family: Arial; width: 80mm; margin:0 auto; }
          .header { text-align:center; border-bottom:2px solid #000; }
          table { width:100%; border-collapse:collapse; }
          th,td { border-bottom:1px solid #eee; padding:2px 0; }
        </style>
      </head><body>
        <div class="header">
          <h2>${Utils.company.name}</h2>
          <p>${Utils.company.address}<br>Tel: ${Utils.company.phone}</p>
        </div>
        <p>Date: ${new Date(sale.timestamp).toLocaleString()}</p>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <hr/>
        <p style="text-align:right; font-size:1.2em;"><strong>Total: ${sale.total.toFixed(2)}</strong></p>
        <p>Payment: ${sale.paymentMethod}</p>
        <p style="text-align:center;">Thank you!</p>
      </body></html>`;
    Utils.printHTML(html, 'Receipt');
  }
};