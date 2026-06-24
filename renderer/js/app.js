let currentBranch = { id: 1, name: 'Branch 1' };

document.addEventListener('DOMContentLoaded', async () => {
  // Fetch branch info
  try {
    currentBranch = await DB._fetch('/api/branch');
  } catch (e) {
    console.warn('Could not fetch branch info, using defaults');
  }
  document.getElementById('branchBadge').textContent = currentBranch.name;

  // Init sync
  Sync.init(process.env.SYNC_SERVER_URL || 'http://localhost:3002');

  const loadPage = async (page) => {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '';

    switch(page) {
      case 'pos': await POS.render(); break;
      case 'orders': await Orders.render(); break;
      case 'products': await Products.render(); break;
      case 'customers': await Customers.render(); break;
      case 'sales': await Sales.render(); break;
      default: await POS.render();
    }

    document.querySelectorAll('.nav-item a').forEach(a => a.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  };

  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      loadPage(e.target.getAttribute('data-page'));
    });
  });

  loadPage('pos');
});