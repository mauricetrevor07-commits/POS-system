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

    // Build currentUser from localStorage
    currentUser = {
      token,
      role,
      username: localStorage.getItem('username') || '',
      name: localStorage.getItem('userName') || localStorage.getItem('username') || '',
      id: localStorage.getItem('userId') || '',
      branch_id: parseInt(localStorage.getItem('userBranchId') || '1')
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

  // Support deep links like #pending-payments from WhatsApp
  const hash = window.location.hash.replace('#', '').trim();
  const urlParams = new URLSearchParams(window.location.search);
  const targetPage = hash || urlParams.get('page') || 'pos';
  loadPage(targetPage);
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && currentUser) {
    loadPage(hash);
  }
});

function buildSidebar() {
  const nav = document.getElementById('mainNav');
  nav.innerHTML = '';

  const isAdmin = currentUser.role === 'admin';

  // ── Navigation items based on role ──────────
  const items = [
    { page: 'pos', label: 'New Sale', icon: 'bi-cart3' },
  ];

  if (isAdmin) {
    items.push({ page: 'pending-payments', label: 'Pending & Credit Alerts', icon: 'bi-shield-check' });
    items.push({ page: 'reports',          label: 'Reports',          icon: 'bi-bar-chart' });
    items.push({ page: 'products',         label: 'Products',         icon: 'bi-box-seam' });
  }

  items.push({ page: 'transfers', label: 'Stock Transfers', icon: 'bi-arrow-left-right' });
  items.push({ page: 'customers', label: 'Customers',       icon: 'bi-person-lines-fill' });
  items.push({ page: 'sales',     label: 'Sales History',   icon: 'bi-receipt' });

  if (isAdmin) {
    items.push({ page: 'users',    label: 'Users',    icon: 'bi-people-fill' });
    items.push({ page: 'settings', label: 'Settings', icon: 'bi-gear' });
  }

  // User info badge at top of nav
  const userLi = document.createElement('li');
  userLi.className = 'nav-item';
  userLi.style.cssText = 'padding: 10px 16px; margin-bottom:8px; background:rgba(255,255,255,0.06); border-radius:8px; cursor:default;';
  const branchLabel = isAdmin ? 'All Branches' : (currentUser.branch_id === 2 ? 'Branch 2' : 'Nairobi Branch');
  userLi.innerHTML = `
    <span style="display:flex;align-items:center;gap:10px;">
      <span style="width:34px;height:34px;border-radius:50%;background:${isAdmin ? '#2563eb' : '#059669'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0;">${(currentUser.name || currentUser.username || '?')[0].toUpperCase()}</span>
      <span>
        <div style="font-weight:600;font-size:0.85rem;color:#f1f5f9;">${currentUser.name || currentUser.username}</div>
        <div style="font-size:0.72rem;color:${isAdmin ? '#93c5fd' : '#6ee7b7'};text-transform:uppercase;letter-spacing:0.5px;">${isAdmin ? 'Administrator' : 'Staff'} &bull; ${branchLabel}</div>
      </span>
    </span>`;
  nav.appendChild(userLi);

  // Add nav items
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<a href="#" data-page="${item.page}"><i class="bi ${item.icon}"></i> ${item.label}</a>`;
    nav.appendChild(li);
  });

  // ── Logout button (always at the bottom) ──
  const logoutLi = document.createElement('li');
  logoutLi.className = 'nav-item';
  logoutLi.style.marginTop = 'auto';
  logoutLi.innerHTML = `<a href="#" id="logoutBtn" style="color:#ef4444;"><i class="bi bi-box-arrow-right"></i> Logout</a>`;
  nav.appendChild(logoutLi);

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    location.reload();
  });

  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar')?.classList.remove('open');
      }
      loadPage(page);
    });
  });
}

async function loadPage(page) {
  const main = document.getElementById('page-content');
  main.innerHTML = '';

  // Force redirect if a non‑admin tries to access an admin-only page
  const adminPages = ['pending-payments', 'reports', 'users', 'settings', 'products'];
  if (adminPages.includes(page) && currentUser.role !== 'admin') {
    Utils.showToast('Access denied. Admin only.', 'danger');
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
    case 'transfers':
      await Transfers.render();
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
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('open');
}
document.addEventListener('DOMContentLoaded', initApp);