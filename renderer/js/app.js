let currentBranch = { id: 1, name: 'Branch 1' };
let currentUser = null;

async function initApp() {
  const token = localStorage.getItem('authToken');
  const role = localStorage.getItem('userRole');
  if (!token || !role) {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
    Login.render();
    return;
  }
  // Validate token
  try {
    const res = await fetch('/api/branch', { headers: { 'X-Auth-Token': token } });
    if (!res.ok) throw new Error('invalid token');
    currentBranch = await res.json();
    window.currentBranch = currentBranch;
    currentUser = { token, role, username: localStorage.getItem('username') };
    document.getElementById('branchBadge').textContent = currentBranch.name;
  } catch (e) {
    localStorage.clear();
    location.reload();
    return;
  }
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
  Sync.init(window.SYNC_SERVER_URL || '');
  buildSidebar();
  loadPage('pos');
}

function buildSidebar() {
  const nav = document.getElementById('mainNav');
  nav.innerHTML = '';
  const items = [
    { page: 'pos', label: 'New Sale', icon: 'bi-cart3' },
  ];
  if (currentUser.role === 'admin') {
    items.push({ page: 'pending-payments', label: 'Pending Payments', icon: 'bi-hourglass-split' });
    items.push({ page: 'reports', label: 'Reports', icon: 'bi-bar-chart' });
  }
  items.push({ page: 'products', label: 'Products', icon: 'bi-box-seam' });
  items.push({ page: 'customers', label: 'Customers', icon: 'bi-people' });
  items.push({ page: 'sales', label: 'Sales History', icon: 'bi-receipt' });
  if (currentUser.role === 'admin') {
    items.push({ page: 'users', label: 'Users', icon: 'bi-people-fill' });
    items.push({ page: 'settings', label: 'Settings', icon: 'bi-gear' });
  }
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<a href="#" data-page="${item.page}"><i class="${item.icon}"></i> ${item.label}</a>`;
    nav.appendChild(li);
  });
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      loadPage(e.target.closest('a').getAttribute('data-page'));
    });
  });
}

async function loadPage(page) {
  const main = document.getElementById('page-content');
  main.innerHTML = '';
  switch(page) {
    case 'pos': await POS.render(); break;
    case 'pending-payments': if (currentUser.role === 'admin') await AdminPayments.render(); else loadPage('pos'); break;
    case 'reports': if (currentUser.role === 'admin') await Reports.render(); else loadPage('pos'); break;
    case 'products': await Products.render(); break;
    case 'customers': await Customers.render(); break;
    case 'sales': await Sales.render(); break;
    case 'users': if (currentUser.role === 'admin') await Users.render(); else loadPage('pos'); break;
    case 'settings': if (currentUser.role === 'admin') await Settings.render(); else loadPage('pos'); break;
    default: await POS.render();
  }
  document.querySelectorAll('.nav-item a').forEach(a => a.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', initApp);