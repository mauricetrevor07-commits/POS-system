let currentBranch = {id: 1, name: 'Store 1'};
let currentUser = null;

const ADMIN_PAGES = [
  'pending-payments',
  'reports',
  'users',
  'settings',
  'products'
];

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  const token =localStorage.getItem('authToken');
  const role = localStorage.getItem('userRole');

if (!token || !role) {
  
  document.getElementById ('app-container').style.display = 'none';
  document.getElementById ('login-container').style.display = 'flex';

  if (typeof Login !== 'undefined') Login.render();
  return;
}

try{
  const response = await fetch('/api/branch', {
    headers: { 'X-Auth-Token': token }
  });

  if (response.status === 401) {
    throw new Error('401');
  }

  if (!response.ok) throw new Error(`Server Error: ${response.status}`);
  
  const branchData = await response.json();
  currentBranch = branchData;
  window.currentBranch = currentBranch;

  const branchbadge = document.getElementById('branchBadge');
  if (branchbadge) {
    branchbadge.textContent = currentBranch.name || 'Main Branch';
  }
  currentUser = {
    token,
    role,
    username: localStorage.getItem('username') || '',
    name: localStorage.getItem('userName') || localStorage.getItem('username') || '',
    id: localStorage.getItem('userId') || '',
    branch_id: parseInt(localStorage.getItem('userBranchId') || '1'),
  };

  document.getElementById('login-container').style.display = 'none';
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
  appContainer.classList.remove('hidden');
  appContainer.style.display = 'flex';
  }
  if (window.Sync) Sync.init(window.SYNC_SERVER_URL || '');
  buildSidebar();

  const hash = window.location.hash.replace('#', '').trim();
  const urlParams = new URLSearchParams(window.location.search);
  const targetPage = hash || urlParams.get('page') || 'pos';
  
  loadPage(targetPage);

  } catch (error) {
  console.error("Auth failed:", error);


  if (error.message === '401') {
    localStorage.clear();
    location.reload();
  } else {
    alert(`Server error (${error.message}). Please check the console.`);
  }
}

function showLogin() {
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
  if (window.Login) Login.render();
}

function buildSidebar() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  const isAdmin = currentUser.role === 'admin';

  const items = [
    {
      page: 'pos',
      label: 'New Sale',
      icon: 'bi-cart3'
    }
  ];

  if (isAdmin) {
    items.push(
    { 
      page: 'pending-payments',
      label: 'Credit Alerts',
      icon: 'bi-shield-check',
     },
    {
      page: 'reports',
      label: 'Reports',
      icon: 'bi-bar-chart'
     },
    {
      page: 'products', 
      label: 'Products',
      icon: 'bi-box-seam'
     }
    );  
  }

  items.push(
    { page: 'transfers',
      label: 'Stock Transfers',
      icon: 'bi-arrow-left-right'
   },
  
    { page: 'customers', label: 'Customers', icon: 'bi-person-lines-fill' },
    { page: 'sales', label: 'Sales History', icon: 'bi-receipt' }
  );

  if (isAdmin) {
    items.push(
      { page: 'users', label: 'Users', icon: 'bi-people-fill' },
      { page: 'settings', label: 'Settings', icon: 'bi-gear' }
    );
  }

  // Build HTML safely (No inline styles, uses our new CSS)
  let html = `
    <!-- User Profile Card -->
    <li class="user-profile-card" style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border);">
      <div class="user-avatar" style="background: ${isAdmin ? 'var(--primary)' : 'var(--success)'}">
        ${escapeHTML((currentUser.name || currentUser.username || '?')[0].toUpperCase())}
      </div>
      <div class="user-info">
        <span class="user-name">${escapeHTML(currentUser.name || currentUser.username)}</span>
        <span class="user-role">${isAdmin ? 'Admin' : 'Staff'} &bull; ${escapeHTML(currentBranch.name)}</span>
      </div>
    </li>
  `;

  // Add Nav Links
  items.forEach(item => {
    html += `
      <li class="nav-item">
        <a href="#" data-page="${item.page}">
          <i class="bi ${item.icon}"></i> ${item.label}
        </a>
      </li>
    `;
  });

  // Add Logout at the bottom
  html += `
    <li class="nav-item" style="margin-top: auto;">
      <a href="#" id="logoutBtn" style="color: var(--danger);">
        <i class="bi bi-box-arrow-right"></i> Logout
      </a>
    </li>
  `;

  // Inject everything at once (Performance boost)
  nav.innerHTML = html;

  // Attach Event Listeners
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', handleNavClick);
  });
}

// ── Routing & Navigation ───────────────────
function handleNavClick(e) {
  e.preventDefault();
  const page = e.currentTarget.getAttribute('data-page');
  
  // Close sidebar on mobile after clicking
  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar')?.classList.remove('open');
  }
  loadPage(page);
}

async function loadPage(page) {
  const main = document.getElementById('page-content');
  if (!main) return;
    main.innerHTML = '<div class="loading-state">Loading...</div>'; // Prevent blank flashes

  // Security Check: Prevent staff from accessing admin pages via URL manipulation
  if (ADMIN_PAGES.includes(page) && currentUser.role !== 'admin') {
    if (window.Utils && Utils.showToast) {
      Utils.showToast('Access denied. Admin only.', 'danger');
    } else {
      alert('Access denied. Admin only.');
    }
    page = 'pos';
  }

  // Highlight active menu link
  document.querySelectorAll('.nav-item a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Route to Module
  try {
    if (page === 'pos' && window.pos) {
      await POS.render();
    }
    else if (page === 'pending-payments' && window.AdminPayments) {
      await AdminPayments.render();
    }
    else if (page === 'reports' && window.Reports) {
      await Reports.render()
    }
    else if (page === 'products' && window.Customers) {
      await Customers.render();
    }
    else if (page === 'users' && window.Users) {
      await Users.render();
    }
    else if (page === 'settings'&& window.Settings) {
      await Settings.render();
    }
    else {
      const response = await fetch(`templates/${page}.html`);
      if (response.ok) {
        main.innerHTML = await response.text();
      } else {
        main.innerHTML = `<div class="card" style="margin:20px;"><div class="card-body">Page"${page}" is under construction.</div></div>`;
      }
    }
  } catch (error) {
    console.error(`Error loading page ${page}:`, error);
    main.innerHTML = `<div class="error-state"><p>Failed to load page: ${page}</p></div>`;
  }
}

// ── Utilities ──────────────────────────────
function handleLogout(e) {
  e.preventDefault();
  localStorage.clear();
  location.reload();
}

// Prevents XSS attacks by escaping user input
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Keep sidebar toggle global since HTML onclick uses it
window.toggleSidebar = function() {
  document.querySelector('.sidebar')?.classList.toggle('open');
};


}
