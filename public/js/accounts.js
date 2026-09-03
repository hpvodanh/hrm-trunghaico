// ==========================================================================
// ACCOUNTS & RBAC MANAGEMENT MODULE
// ==========================================================================

const appAccounts = {
  initialized: false,
  isSaving: false,
  currentPage: 1,
  pageSize: 15,
  filteredAccounts: [],
  selectedAccountId: null,

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.renderKPIs();
    this.applyFilters();
  },

  renderKPIs() {
    const accounts = appData.accounts || [];
    const total = accounts.length;
    const adminCount = accounts.filter(a => a.role === 'ADMIN').length;
    const hrCount = accounts.filter(a => a.role === 'HR_MANAGER').length;
    const mgrCount = accounts.filter(a => a.role === 'MANAGER').length;
    const empCount = accounts.filter(a => a.role === 'EMPLOYEE' || !a.role).length;

    const elTotal = document.getElementById('kpi-acc-total');
    const elAdmin = document.getElementById('kpi-acc-admin');
    const elHr = document.getElementById('kpi-acc-hr');
    const elMgr = document.getElementById('kpi-acc-mgr');
    const elEmp = document.getElementById('kpi-acc-emp');

    if (elTotal) elTotal.textContent = total;
    if (elAdmin) elAdmin.textContent = adminCount;
    if (elHr) elHr.textContent = hrCount;
    if (elMgr) elMgr.textContent = mgrCount;
    if (elEmp) elEmp.textContent = empCount;
  },

  applyFilters() {
    const searchInput = document.getElementById('acc-search-input');
    const roleFilter = document.getElementById('acc-filter-role');
    const statusFilter = document.getElementById('acc-filter-status');

    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const role = roleFilter ? roleFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';

    this.filteredAccounts = (appData.accounts || []).filter(a => {
      // Text match
      const matchText = !q || 
        (a.account_id && a.account_id.toLowerCase().includes(q)) ||
        (a.employee_id && a.employee_id.toLowerCase().includes(q)) ||
        (a.full_name && a.full_name.toLowerCase().includes(q)) ||
        (a.account_email && a.account_email.toLowerCase().includes(q));

      // Role match
      const matchRole = !role || a.role === role;

      // Status match
      const matchStatus = !status || a.account_status === status;

      return matchText && matchRole && matchStatus;
    });

    this.renderTable();
    this.renderPagination();
  },

  renderTable() {
    const tbody = document.getElementById('accounts-tbody');
    if (!tbody) return;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.filteredAccounts.slice(start, end);

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-user-slash" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy tài khoản phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(a => {
      const isAdmin = a.role === 'ADMIN';
      const roleBadge = isAdmin ? 'badge-red' : 'badge-navy';
      const roleLabel = isAdmin ? '👑 Admin' : '👤 User';

      const statusBadge = a.account_status === 'Kích hoạt' || a.account_status === 'Hoạt động' 
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> Hoạt động</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-lock"></i> Đã khóa</span>';

      return `
        <tr>
          <td><strong style="color: var(--primary-navy);">${a.account_id || ''}</strong></td>
          <td><span class="badge badge-navy">${a.employee_id || ''}</span></td>
          <td><strong>${a.full_name || ''}</strong></td>
          <td>${a.account_email || ''}</td>
          <td><span class="badge ${roleBadge}">${roleLabel}</span></td>
          <td><span style="font-family: monospace; color: var(--text-muted); letter-spacing: 2px;">••••••</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-outline-navy" title="Sửa phân quyền" onclick="appAccounts.openEditModal('${a.account_id}')">
                <i class="fa-solid fa-user-pen"></i> Sửa
              </button>
              <button class="btn btn-sm btn-secondary" title="Đổi / Reset mật khẩu" onclick="appAccounts.openResetPassModal('${a.account_id}')">
                <i class="fa-solid fa-key" style="color: #D97706;"></i>
              </button>
              <button class="btn btn-sm btn-secondary" title="Xóa tài khoản" onclick="appAccounts.openDeleteModal('${a.account_id}')" style="color: var(--accent-red);">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination() {
    const container = document.getElementById('accounts-pagination');
    if (!container) return;

    const total = this.filteredAccounts.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    container.innerHTML = `
      <span>Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> tài khoản</span>
      <div class="pagination-controls">
        <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appAccounts.goToPage(1)"><i class="fa-solid fa-angles-left"></i></button>
        <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appAccounts.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>
        <span style="padding: 0 8px; font-weight: 600;">Trang ${this.currentPage} / ${totalPages}</span>
        <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appAccounts.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>
        <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appAccounts.goToPage(${totalPages})"><i class="fa-solid fa-angles-right"></i></button>
      </div>
    `;
  },

  goToPage(page) {
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  },

  // Populate Employee Options with Realtime Search & Clean Cards
  populateEmployeeOptions(filterText = '', selectedId = null) {
    const listContainer = document.getElementById('acc-emp-picker-list');
    if (!listContainer) return;

    const q = filterText.trim().toLowerCase();
    const filtered = (appData.employees || []).filter(e => {
      if (!q) return true;
      const title = (appData.posMap[e.position_id] || e.job_title || '').toLowerCase();
      const empId = (e.employee_id || '').toLowerCase();
      const name = (e.full_name || '').toLowerCase();
      const dept = (appData.deptMap[e.department_id] || '').toLowerCase();
      return empId.includes(q) || name.includes(q) || title.includes(q) || dept.includes(q);
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="emp-picker-empty"><i class="fa-solid fa-user-slash"></i> Không tìm thấy nhân viên phù hợp</div>';
      return;
    }

    const currentSelected = selectedId || (filtered[0] ? filtered[0].employee_id : null);

    listContainer.innerHTML = filtered.map(e => {
      const title = appData.posMap[e.position_id] || e.job_title || 'Nhân viên';
      const dept = appData.deptMap[e.department_id] || '';
      const initials = e.full_name ? e.full_name.split(' ').map(n => n[0]).slice(-2).join('') : 'NV';
      const isSelected = e.employee_id === currentSelected;

      return `
        <div class="emp-picker-item ${isSelected ? 'active' : ''}" data-empid="${e.employee_id}" onclick="appAccounts.selectEmployee('${e.employee_id}')">
          <div class="emp-picker-avatar">${initials}</div>
          <div class="emp-picker-info">
            <div class="emp-picker-name-row">
              <span class="emp-picker-badge">${e.employee_id}</span>
              <span class="emp-picker-name">${e.full_name}</span>
            </div>
            <div class="emp-picker-role">${title}${dept ? ' • ' + dept : ''}</div>
          </div>
          <div class="emp-picker-check"><i class="fa-solid fa-circle-check"></i></div>
        </div>
      `;
    }).join('');

    if (currentSelected) {
      this.selectEmployee(currentSelected, false);
    }
  },

  selectEmployee(empId, updateDomSelection = true) {
    const hiddenInput = document.getElementById('acc-form-emp-id');
    if (hiddenInput) hiddenInput.value = empId;
    
    if (updateDomSelection) {
      document.querySelectorAll('.emp-picker-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-empid') === empId);
      });
    }

    // Auto-fill email
    const emp = appData.employees.find(e => e.employee_id === empId);
    if (emp) {
      const email = emp.work_email || `${empId.toLowerCase()}@trunghaico.vn`;
      document.getElementById('acc-form-email').value = email;
    }
  },

  // Open Create Modal
  openCreateModal() {
    this.selectedAccountId = null;
    document.getElementById('acc-modal-title').textContent = 'Cấp Tài Khoản Mới';
    
    // Show search wrapper and reset
    const searchWrapper = document.getElementById('acc-emp-search-wrapper');
    const searchInput = document.getElementById('acc-emp-search-input');
    if (searchWrapper) searchWrapper.style.display = 'block';
    if (searchInput) searchInput.value = '';

    // Populate employees cleanly
    this.populateEmployeeOptions('');

    document.getElementById('acc-form-role').value = 'USER';
    document.getElementById('acc-form-status').value = 'Kích hoạt';
    document.getElementById('acc-form-password').value = '123456';
    document.getElementById('acc-password-group').style.display = 'block';

    document.getElementById('modal-account-form').classList.add('active');
  },

  // Open Edit Modal
  openEditModal(accId) {
    const acc = (appData.accounts || []).find(a => a.account_id === accId || a.employee_id === accId);
    if (!acc) return;

    this.selectedAccountId = acc.account_id;
    document.getElementById('acc-modal-title').textContent = `Sửa Phân Quyền - ${acc.full_name} (${acc.employee_id})`;
    
    // Hide search wrapper in edit mode
    const searchWrapper = document.getElementById('acc-emp-search-wrapper');
    if (searchWrapper) searchWrapper.style.display = 'none';

    // Show only the selected employee
    const listContainer = document.getElementById('acc-emp-picker-list');
    if (listContainer) {
      const initials = acc.full_name ? acc.full_name.split(' ').map(n => n[0]).slice(-2).join('') : 'NV';
      listContainer.innerHTML = `
        <div class="emp-picker-item active" style="cursor: default;">
          <div class="emp-picker-avatar">${initials}</div>
          <div class="emp-picker-info">
            <div class="emp-picker-name-row">
              <span class="emp-picker-badge">${acc.employee_id}</span>
              <span class="emp-picker-name">${acc.full_name}</span>
            </div>
            <div class="emp-picker-role">Tài khoản hệ thống</div>
          </div>
          <div class="emp-picker-check"><i class="fa-solid fa-circle-check"></i></div>
        </div>
      `;
    }
    document.getElementById('acc-form-emp-id').value = acc.employee_id;

    document.getElementById('acc-form-email').value = acc.account_email || '';
    document.getElementById('acc-form-role').value = acc.role === 'ADMIN' ? 'ADMIN' : 'USER';
    document.getElementById('acc-form-status').value = acc.account_status || 'Kích hoạt';
    document.getElementById('acc-password-group').style.display = 'none'; // Only change via reset modal

    document.getElementById('modal-account-form').classList.add('active');
  },

  closeFormModal() {
    document.getElementById('modal-account-form').classList.remove('active');
  },

  // Save Account (Create or Update)
  async saveAccount(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (this.isSaving) return;

    const empId = document.getElementById('acc-form-emp-id').value;
    const email = document.getElementById('acc-form-email').value.trim();
    const role = document.getElementById('acc-form-role').value;
    const status = document.getElementById('acc-form-status').value;
    const password = document.getElementById('acc-form-password').value;

    if (!empId || !email) {
      utils.showToast('Vui lòng điền đầy đủ mã nhân viên và email', 'error');
      return;
    }

    const emp = appData.employees.find(e => e.employee_id === empId);
    const fullName = emp ? emp.full_name : '';

    this.isSaving = true;
    const submitBtn = document.querySelector('#form-account-action button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedAccountId) {
        // UPDATE
        const res = await fetch(`/api/accounts/${this.selectedAccountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_email: email,
            role: role,
            account_status: status
          })
        });
        const json = await res.json();
        if (json.success) {
          // Update in local array
          const idx = appData.accounts.findIndex(a => a.account_id === this.selectedAccountId);
          if (idx >= 0) {
            appData.accounts[idx] = { ...appData.accounts[idx], account_email: email, role, account_status: status };
          }
          this.closeFormModal();
          this.renderKPIs();
          this.applyFilters();
          utils.showToast('Cập nhật phân quyền tài khoản thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cập nhật', 'error');
        }
      } else {
        // CREATE
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: empId,
            full_name: fullName,
            account_email: email,
            role: role,
            account_status: status,
            password: password || '123456'
          })
        });
        const json = await res.json();
        if (json.success) {
          // Prevent duplicates in frontend state
          const exists = appData.accounts.some(a => a.account_id === json.account.account_id || a.employee_id === json.account.employee_id);
          if (!exists) {
            appData.accounts.unshift(json.account);
          } else {
            const idx = appData.accounts.findIndex(a => a.account_id === json.account.account_id || a.employee_id === json.account.employee_id);
            if (idx >= 0) appData.accounts[idx] = json.account;
          }
          this.closeFormModal();
          this.renderKPIs();
          this.applyFilters();
          utils.showToast('Cấp tài khoản mới thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cấp tài khoản', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + (err.message || ''), 'error');
    } finally {
      this.isSaving = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  // Open Reset Password Modal
  openResetPassModal(accId) {
    const acc = (appData.accounts || []).find(a => a.account_id === accId || a.employee_id === accId);
    if (!acc) return;

    this.selectedAccountId = acc.account_id;
    document.getElementById('reset-pass-user-info').textContent = `${acc.full_name} (${acc.employee_id} - ${acc.account_email})`;
    document.getElementById('reset-pass-new-input').value = '123456';
    document.getElementById('modal-account-reset-pass').classList.add('active');
  },

  closeResetPassModal() {
    document.getElementById('modal-account-reset-pass').classList.remove('active');
  },

  async confirmResetPassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('reset-pass-new-input').value;
    if (!newPass) {
      utils.showToast('Vui lòng nhập mật khẩu mới', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${this.selectedAccountId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPass })
      });
      const json = await res.json();
      if (json.success) {
        this.closeResetPassModal();
        utils.showToast('Đặt lại mật khẩu thành công!', 'success');
      } else {
        utils.showToast(json.message || 'Lỗi đặt lại mật khẩu', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // Open Delete Modal
  openDeleteModal(accId) {
    const acc = (appData.accounts || []).find(a => a.account_id === accId || a.employee_id === accId);
    if (!acc) return;

    this.selectedAccountId = acc.account_id;
    document.getElementById('delete-acc-user-info').textContent = `${acc.full_name} (${acc.employee_id} - ${acc.account_email})`;
    document.getElementById('modal-account-delete-confirm').classList.add('active');
  },

  closeDeleteModal() {
    document.getElementById('modal-account-delete-confirm').classList.remove('active');
  },

  async confirmDeleteAccount() {
    try {
      const res = await fetch(`/api/accounts/${this.selectedAccountId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        appData.accounts = (appData.accounts || []).filter(a => a.account_id !== this.selectedAccountId);
        this.closeDeleteModal();
        this.renderKPIs();
        this.applyFilters();
        utils.showToast('Đã xóa tài khoản khỏi hệ thống!', 'success');
      } else {
        utils.showToast(json.message || 'Lỗi xóa tài khoản', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  attachEventListeners() {
    // Search & Filter change
    const searchInput = document.getElementById('acc-search-input');
    const roleFilter = document.getElementById('acc-filter-role');
    const statusFilter = document.getElementById('acc-filter-status');

    if (searchInput) searchInput.addEventListener('input', () => { this.currentPage = 1; this.applyFilters(); });
    if (roleFilter) roleFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });
    if (statusFilter) statusFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });

    // Open add account
    const btnAdd = document.getElementById('btn-open-add-account');
    if (btnAdd) btnAdd.addEventListener('click', () => this.openCreateModal());

    // Form submit
    const accForm = document.getElementById('form-account-action');
    if (accForm) accForm.addEventListener('submit', (e) => this.saveAccount(e));

    // Reset password form submit
    const resetForm = document.getElementById('form-reset-password-action');
    if (resetForm) resetForm.addEventListener('submit', (e) => this.confirmResetPassword(e));

    // Confirm delete button
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete-account');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteAccount());

    // Search input inside create modal
    const empSearchInput = document.getElementById('acc-emp-search-input');
    if (empSearchInput) {
      empSearchInput.addEventListener('input', (e) => {
        this.populateEmployeeOptions(e.target.value);
      });
    }

    // Auto-fill email when employee selected
    const empSelect = document.getElementById('acc-form-emp-id');
    if (empSelect) {
      empSelect.addEventListener('change', () => {
        const empId = empSelect.value;
        if (empId) {
          document.getElementById('acc-form-email').value = `${empId.toLowerCase()}@trunghaico.vn`;
        }
      });
    }
  }
};
