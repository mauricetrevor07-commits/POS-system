const Users = {
    async render() {
      const container = document.getElementById('page-content');
      container.innerHTML = `
        <div class="toolbar">
          <h2><i class="bi bi-people"></i> User Management</h2>
          <button class="btn btn-primary" onclick="Users.showUserModal()"><i class="bi bi-person-plus"></i> Add User</button>
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
                  <th>Branch ID</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="usersTableBody"><tr><td colspan="6">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      `;
      await this.loadUsers();
    },
  
    async loadUsers() {
      try {
        const users = await DB._fetch('/api/users');
        this.users = users;
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(u => `
          <tr>
            <td>${Utils.escapeHtml(u.name || '-')}</td>
            <td>${Utils.escapeHtml(u.username)}</td>
            <td><span class="badge badge-${u.role === 'admin' ? 'primary' : 'secondary'}">${u.role}</span></td>
            <td>${u.branch_id || '-'}</td>
            <td>${new Date(u.created_at).toLocaleString()}</td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="Users.showUserModal('${u.id}')">Edit</button>
              ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="Users.deleteUser('${u.id}')">Delete</button>` : ''}
            </td>
          </tr>
        `).join('') || '<tr><td colspan="6">No users found.</td></tr>';
      } catch (err) {
        Utils.toast('Failed to load users: ' + err.message, 'error');
      }
    },
  
    showUserModal(id = null) {
      const user = id ? this.users.find(u => u.id === id) : null;
      const html = `
        <div class="modal show">
          <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
              <h3>${user ? 'Edit User' : 'Add User'}</h3>
              <button class="close-btn" onclick="Utils.closeModal()">×</button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="userId" value="${user ? user.id : ''}" />
              <div class="form-group" style="margin-bottom:10px;">
                <label>Name</label>
                <input type="text" id="userName" class="form-control" value="${user?.name || ''}" placeholder="e.g. John Doe">
              </div>
              <div class="form-group" style="margin-bottom:10px;">
                <label>Username</label>
                <input type="text" id="userUsername" class="form-control" value="${user?.username || ''}" placeholder="e.g. john">
              </div>
              <div class="form-group" style="margin-bottom:10px;">
                <label>Password ${user ? '<small>(Leave blank to keep current)</small>' : ''}</label>
                <input type="password" id="userPassword" class="form-control" placeholder="Password">
              </div>
              <div class="form-group" style="margin-bottom:10px;">
                <label>Role</label>
                <select id="userRole" class="form-control">
                  <option value="cashier" ${user?.role === 'cashier' ? 'selected' : ''}>Cashier</option>
                  <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:10px;">
                <label>Branch ID</label>
                <input type="number" id="userBranch" class="form-control" value="${user?.branch_id || ''}" placeholder="e.g. 1">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="Users.saveUser()">Save</button>
            </div>
          </div>
        </div>
      `;
      Utils.showModal(html);
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
        Utils.closeModal();
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
  
