const Users = {
  users: [],

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="toolbar">
        <h2>User Management</h2>
        <button class="btn btn-primary" onclick="Users.openModal()">+ Add User</button>
      </div>
      <div class="card">
        <div class="card-header">All Users</div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="usersTableBody"><tr><td colspan="6">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>`;
    await this.loadUsers();
  },

  async loadUsers() {
    try {
      this.users = await DB._fetch('/api/users');
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = this.users.map(u => `
        <tr>
          <td>${Utils.escapeHtml(u.name || '-')}</td>
          <td>${Utils.escapeHtml(u.username)}</td>
          <td><span class="badge badge-${u.role === 'admin' ? 'primary' : 'secondary'}">${u.role}</span></td>
          <td>${u.branch_id || '-'}</td>
          <td>${new Date(u.created_at).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="Users.openModal('${u.id}')">Edit</button>
            ${u.id !== (currentUser?.id || '') ? `<button class="btn btn-sm btn-danger" onclick="Users.deleteUser('${u.id}')">Delete</button>` : ''}
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6">No users found.</td></tr>';
    } catch (err) {
      Utils.toast('Failed to load users: ' + err.message, 'error');
    }
  },

  openModal(id = null) {
    // Remove any existing modal
    const existing = document.querySelector('.user-modal-overlay');
    if (existing) existing.remove();

    const user = id ? this.users.find(u => u.id === id) : null;

    // Build the modal HTML
    const html = `
      <div class="user-modal-overlay" onclick="if(event.target===this) this.remove()">
        <div class="user-modal-card" style="max-width: 450px; width: 90%;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #e5e7eb;">
            <h3 style="margin:0;">${user ? 'Edit User' : 'Add User'}</h3>
            <button style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#6b7280;" 
                    onclick="document.querySelector('.user-modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <input type="hidden" id="userId" value="${user ? user.id : ''}" />
            <div class="form-group">
              <label>Name</label>
              <input type="text" id="userName" class="form-control" value="${Utils.escapeHtml(user?.name || '')}" placeholder="Full name">
            </div>
            <div class="form-group">
              <label>Username *</label>
              <input type="text" id="userUsername" class="form-control" value="${user?.username || ''}" placeholder="Username">
            </div>
            <div class="form-group">
              <label>Password ${user ? '<small>(leave blank to keep current)</small>' : '<span style="color:red;">*</span>'}</label>
              <input type="password" id="userPassword" class="form-control" placeholder="Password">
            </div>
            <div class="form-group">
              <label>Role</label>
              <select id="userRole" class="form-control">
                <option value="staff" ${user?.role === 'staff' ? 'selected' : ''}>Staff</option>
                <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label>Branch ID</label>
              <input type="number" id="userBranch" class="form-control" value="${user?.branch_id || ''}" placeholder="e.g. 1">
            </div>
          </div>
          <div class="modal-footer" style="padding:12px 20px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn btn-outline" onclick="document.querySelector('.user-modal-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="Users.saveUser()">Save</button>
          </div>
        </div>
      </div>
    `;

    // Append to body so it's on top of everything
    document.body.insertAdjacentHTML('beforeend', html);
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

    try {
      await DB._fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ id, name, username, password, role, branch_id })
      });
      // Close the modal
      const overlay = document.querySelector('.user-modal-overlay');
      if (overlay) overlay.remove();
      Utils.toast('User saved successfully', 'success');
      this.loadUsers();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  },

  async deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await DB._fetch('/api/users/' + id, { method: 'DELETE' });
      Utils.toast('User deleted', 'success');
      this.loadUsers();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }
};