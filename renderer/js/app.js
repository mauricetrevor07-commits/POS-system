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

  try {
    const res = await fetch('/api/branch', { headers: { 'X-Auth-Token': token } });
    if (!res.ok) throw new Error('invalid token');
    currentBranch = await res.json();
    window.currentBranch = currentBranch;
    document.getElementById('branchBadge').textContent = currentBranch.name;

    // Build currentUser with id from localStorage
    currentUser = {
      token,
      role,
      username: localStorage.getItem('username') || '',
      id: localStorage.getItem('userId') || ''
    };
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
  items.push({ page: 'customers', label: 'Customers', icon: 'bi-person-lines-fill' });
  items.push({ page: 'sales', label: 'Sales History', icon: 'bi-receipt' });

  if (currentUser.role === 'admin') {
    items.push({ page: 'users', label: 'Users', icon: 'bi-people-fill' });
    items.push({ page: 'settings', label: 'Settings', icon: 'bi-gear' });
  }

  // Build the navigation items
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<a href="#" data-page="${item.page}"><i class="${item.icon}"></i> ${item.label}</a>`;
    nav.appendChild(li);
  });

  // ─── Logout button at the bottom ─────
  const logoutLi = document.createElement('li');
  logoutLi.className = 'nav-item';
  logoutLi.style.marginTop = 'auto';          // pushes it to the bottom
  logoutLi.innerHTML = `<a href="#" id="logoutBtn" style="color:#ef4444;"><i class="bi bi-box-arrow-right"></i> Logout</a>`;
  nav.appendChild(logoutLi);

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    location.reload();
  });

  // Attach click events for normal page links
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      loadPage(page);
    });
  });
}

async function loadPage(page) {
  const main = document.getElementById('page-content');
  main.innerHTML = '';

  // Force redirect if a non‑admin tries to access an admin page
  const adminPages = ['pending-payments', 'reports', 'users', 'settings'];
  if (adminPages.includes(page) && currentUser.role !== 'admin') {
    page = 'pos';
  }

  switch(page) {
    case 'pos':
      await POS.render();
      break;
    case 'pending-payments':
      await AdminPayments.render();
      break;
    case 'reports':
      await Reports.render();
      break;
    case 'users':
      if (typeof Users !== 'undefined') await Users.render();
      else main.innerHTML = '<p>Users module not loaded.</p>';
      break;
    case 'settings':
      if (typeof Settings !== 'undefined') await Settings.render();
      else main.innerHTML = '<p>Settings module not loaded.</p>';
      break;
    case 'products':
      await Products.render();
      break;
    case 'customers':
      await Customers.render();
      break;
    case 'sales':
      await Sales.render();
      break;
    default:
      await POS.render();
  }

  // Highlight active menu
  document.querySelectorAll('.nav-item a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');
}
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}
document.addEventListener('DOMContentLoaded', initApp);