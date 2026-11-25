const Users = {
  users: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
      const response = await fetch('/templates/users.html');
      if (!response.ok) throw new Error('Users template not found');

      container.innerHTML = await response.text();

      this.attachEvents();
      await this.loadUsers();
    } catch (error) {
      console.error('Failed to render Users;', error);
      container.innerHTML = `<p style="color:var(--danger); padding:20px;">Failed to load Users: ${error.message}</p>`;
    }
  },

  attachEvents() {
    document.getElementById('btnAddUser')?.addEventListener('click', () => this.openModal());
  },

  async loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    try {
      this.users = await DB._fetch('/api/users');
      this.renderUsersTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:20px; color:var(--danger);">Failed to load users: ${err.message}</td></tr>`;
    }
  },

  renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const template = document.getElementById('tpl-user-row');
    const fragment = document.createDocumentFragment();
    tbody.innerHTML = '';

    if (!this.users.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px;">No users found.</td></tr>';
      return;
    }

    this.users.forEach (u => {
      const clone = template.content.cloneNode(true);

      clone.querySelector('.data-name').textContent = u.name || '-';
      clone.querySelector('.data-username').textContent = u.username;

      const roleBadge = clone.querySelector('.data-role');
      roleBadge.textContent = u.role.toUpperCase();
      roleBadge.className = `badge data-role ${u.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`;

      const branchBadge = clone.querySelector('.data-branch');
      let bLabel = 'All Branches (admin)';
      if (u.branch_id === 1) bLabel = 'Branch 1';
      else if (u.branch_id === 2) bLabel = 'Branch 2';
      else if (u.branch_id) bLabel = `Branch ${u.branch_id}`;
      branchBadge.innerHTML = `<i class="bi bi-geo-alt"></i> ${bLabel}`;

      clone.querySelector('.data-created').textContent = new Date(u.created_at).toLocaleString();

      clone.querySelector('.btn-edit').addEventListener('click', () => this.openModal(u.id));

      const currentUserId = currentUser?.id || localStorage.getItem('userId');
      if (u.id !== currentUserId) {
        clone.querySelector('.btn-delete').addEventListener('click', () => this.deleteUser(u.id));
      } else {
        clone.querySelector('.btn-delete').remove();
      }

      fragment.appendChild(clone);
    });
    tbody.appendChild(fragment);
  },

  openModal(id = null) {
    const user = id ? this.users.find(u => u.id === id) : null;
    const template = document.getElementById('tpl-user-modal');
    const clone = template.content.cloneNode(true);
   
    clone.querySelector('.modal-title').textContent = user ? 'Edit User' : 'Add User';
    clone.querySelector('#passwordLabel').innerHTML = user ? 'password <small>(leave blank to keep current)</small>' : 'password <span style="color:red;">*</span>';

    if (user) {
      clone.querySelector('#userId').value = user.id;
      clone.querySelector('#userName').value = user.name || '';
      clone.querySelector('#userUsername').value = user.username || '';
      clone.querySelector('#userRole').value = user.role || 'staff';
      clone.querySelector('#userBranch').value = user.branch_id ? String(user.branch_id) : '';
    }

    document.body.appendChild(clone);

    document.getElementById('btnCloseModal').addEventListener('click', () => this.closeModal());
    document.getElementById('btnCancelModal').addEventListener('click', () => this.closeModal());
    document.getElementById('btnSaveUser').addEventListener('click', () => this.saveUser());
    },

    closeModal() {
      const overlay = document.getElementById('userModalOverlay');
      if (overlay) overlay.remove();
    },

  async saveUser() {
    const id = document.getElementById('userId').value;
    const name = document.getElementById('userName').value.trim();
    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const branch_id = document.getElementById('userBranch').value || null;

    if (!username) return Utils.toast('Username is required', 'warning');
    if (!id && !password) return Utils.toast('Password is required for new users', 'warning');

    const btn = document.getElementById('btnSaveUser');
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    btn.disabled = true;

    try {
      await DB._fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ id, name, username, password, role, branch_id })
      });
      this.closeModal();
      Utils.toast('User saved successfully', 'success')
      this.loadUsers();
    } catch (err) {
      Utils.toast(err.message, 'danger');
      btn.innerHTML = 'Save User';
      btn.disabled = false;
    }
  },

  async deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await DB._fetch('/api/users/' + id, { method: 'DELETE' });
      Utils.toast('User deleted', 'success');
      this.loadUsers();
    } catch (err) {
      Utils.toast(err.message, 'danger');
    }
  }
};

window.Users = Users;