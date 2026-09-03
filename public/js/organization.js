// ==========================================================================
// DEPARTMENTS, POSITIONS & CONTRACTS MODULE (QUẢN LÝ PHÒNG BAN & VỊ TRÍ)
// ==========================================================================

const appOrganization = {
  initialized: false,
  isSavingDept: false,
  isSavingPos: false,
  selectedDeptId: null,
  selectedPosId: null,
  deptSearchQuery: '',
  posSearchQuery: '',
  contractSearchQuery: '',

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.renderDepartmentsTable();
    this.renderPositionsTable();
    this.renderContractsTable();
  },

  attachEventListeners() {
    // Search Inputs
    const deptSearch = document.getElementById('dept-search-input');
    if (deptSearch) {
      deptSearch.addEventListener('input', (e) => {
        this.deptSearchQuery = e.target.value.trim().toLowerCase();
        this.renderDepartmentsTable();
      });
    }

    const posSearch = document.getElementById('pos-search-input');
    if (posSearch) {
      posSearch.addEventListener('input', (e) => {
        this.posSearchQuery = e.target.value.trim().toLowerCase();
        this.renderPositionsTable();
      });
    }

    const contractSearch = document.getElementById('contract-search-input');
    if (contractSearch) {
      contractSearch.addEventListener('input', (e) => {
        this.contractSearchQuery = e.target.value.trim().toLowerCase();
        this.renderContractsTable();
      });
    }

    // Forms Submit
    const deptForm = document.getElementById('form-dept-action');
    if (deptForm) {
      deptForm.addEventListener('submit', (e) => this.saveDept(e));
    }

    const posForm = document.getElementById('form-pos-action');
    if (posForm) {
      posForm.addEventListener('submit', (e) => this.savePos(e));
    }
  },

  // ========================================================================
  // 1. DEPARTMENTS TABLE & MANAGEMENT
  // ========================================================================
  renderDepartmentsTable() {
    const tbody = document.getElementById('departments-tbody');
    if (!tbody) return;

    const deptCounts = {};
    const activeCounts = {};

    (appData.employees || []).forEach(e => {
      deptCounts[e.department_id] = (deptCounts[e.department_id] || 0) + 1;
      if (e.employment_status === 'Đang làm việc') {
        activeCounts[e.department_id] = (activeCounts[e.department_id] || 0) + 1;
      }
    });

    const filtered = (appData.departments || []).filter(d => {
      if (!this.deptSearchQuery) return true;
      const id = (d.department_id || '').toLowerCase();
      const name = (d.department_name || '').toLowerCase();
      return id.includes(this.deptSearchQuery) || name.includes(this.deptSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-building-circle-xmark" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy phòng ban phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const count = deptCounts[d.department_id] || 0;
      const active = activeCounts[d.department_id] || 0;
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${d.department_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${d.department_name}</strong></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-users"></i> ${count} nhân sự
            </span>
          </td>
          <td style="text-align: center;">
            <span class="badge badge-active" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-circle-check"></i> ${active} đang làm
            </span>
          </td>
          <td><span class="badge badge-active">${d.status || 'Hoạt động'}</span></td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px;">
              <button class="btn btn-sm btn-outline-navy" onclick="appOrganization.filterEmployeesByDept('${d.department_id}')" title="Xem danh sách nhân viên thuộc đơn vị này">
                <i class="fa-solid fa-users"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.openEditDeptModal('${d.department_id}')" title="Chỉnh sửa phòng ban">
                <i class="fa-solid fa-pen-to-square" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.deleteDept('${d.department_id}')" title="Xóa phòng ban">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddDeptModal() {
    this.selectedDeptId = null;
    document.getElementById('dept-modal-title').textContent = 'Thêm Phòng Ban / Đơn Vị Mới';
    
    const idInput = document.getElementById('dept-form-id');
    idInput.value = '';
    idInput.disabled = false;
    
    document.getElementById('dept-form-name').value = '';
    document.getElementById('dept-form-status').value = 'Hoạt động';

    // Populate Parent Dept Dropdown
    const parentSelect = document.getElementById('dept-form-parent');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">-- Không có (Cấp cao nhất / Ban Giám Đốc) --</option>' +
        (appData.departments || []).map(d => `<option value="${d.department_id}">${d.department_name} (${d.department_id})</option>`).join('');
    }

    // Populate Managers Dropdown
    const mgrSelect = document.getElementById('dept-form-manager');
    if (mgrSelect) {
      mgrSelect.innerHTML = '<option value="">-- Chọn Trưởng phòng / Quản lý --</option>' +
        (appData.employees || []).map(e => `<option value="${e.employee_id}">${e.full_name} (${e.employee_id})</option>`).join('');
    }

    document.getElementById('modal-dept-form').classList.add('active');
  },

  openEditDeptModal(deptId) {
    const dept = (appData.departments || []).find(d => d.department_id === deptId);
    if (!dept) return;

    this.selectedDeptId = deptId;
    document.getElementById('dept-modal-title').textContent = `Chỉnh Sửa Phòng Ban (${deptId})`;

    const idInput = document.getElementById('dept-form-id');
    idInput.value = dept.department_id;
    idInput.disabled = true;

    document.getElementById('dept-form-name').value = dept.department_name || '';
    document.getElementById('dept-form-status').value = dept.status || 'Hoạt động';

    // Populate Parent Dept Dropdown (exclude current dept)
    const parentSelect = document.getElementById('dept-form-parent');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">-- Không có (Cấp cao nhất / Ban Giám Đốc) --</option>' +
        (appData.departments || []).filter(d => d.department_id !== deptId).map(d => `<option value="${d.department_id}" ${d.department_id === dept.parent_dept_id ? 'selected' : ''}>${d.department_name} (${d.department_id})</option>`).join('');
    }

    // Populate Managers Dropdown
    const mgrSelect = document.getElementById('dept-form-manager');
    if (mgrSelect) {
      mgrSelect.innerHTML = '<option value="">-- Chọn Trưởng phòng / Quản lý --</option>' +
        (appData.employees || []).map(e => `<option value="${e.employee_id}" ${e.employee_id === dept.manager_id ? 'selected' : ''}>${e.full_name} (${e.employee_id})</option>`).join('');
    }

    document.getElementById('modal-dept-form').classList.add('active');
  },

  closeDeptModal() {
    const modal = document.getElementById('modal-dept-form');
    if (modal) modal.classList.remove('active');
  },

  async saveDept(e) {
    e.preventDefault();
    if (this.isSavingDept) return;

    const id = document.getElementById('dept-form-id').value.trim().toUpperCase();
    const name = document.getElementById('dept-form-name').value.trim();
    const parentId = document.getElementById('dept-form-parent').value;
    const managerId = document.getElementById('dept-form-manager').value;
    const status = document.getElementById('dept-form-status').value;

    if (!id || !name) {
      utils.showToast('Vui lòng điền đầy đủ Mã và Tên phòng ban', 'error');
      return;
    }

    this.isSavingDept = true;
    const submitBtn = document.getElementById('btn-save-dept');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedDeptId) {
        // UPDATE
        const res = await fetch(`/api/departments/${this.selectedDeptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_name: name,
            parent_dept_id: parentId,
            manager_id: managerId,
            status,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const idx = appData.departments.findIndex(d => d.department_id === this.selectedDeptId);
          if (idx >= 0) appData.departments[idx] = json.department;
          appData.deptMap[this.selectedDeptId] = name;

          // Update department_name on local employees list
          (appData.employees || []).forEach(emp => {
            if (emp.department_id === this.selectedDeptId) emp.department_name = name;
          });

          this.updateAllDropdowns();
          this.renderDepartmentsTable();
          this.closeDeptModal();
          utils.showToast('Cập nhật phòng ban thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cập nhật phòng ban', 'error');
        }
      } else {
        // CREATE
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_id: id,
            department_name: name,
            parent_dept_id: parentId,
            manager_id: managerId,
            status,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          appData.departments.push(json.department);
          appData.deptMap[json.department.department_id] = json.department.department_name;

          this.updateAllDropdowns();
          this.renderDepartmentsTable();
          this.closeDeptModal();
          utils.showToast(`Thêm mới phòng ban ${name} thành công!`, 'success');
        } else {
          utils.showToast(json.message || 'Lỗi tạo phòng ban', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + err.message, 'error');
    } finally {
      this.isSavingDept = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async deleteDept(deptId) {
    const dept = (appData.departments || []).find(d => d.department_id === deptId);
    if (!dept) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa phòng ban "${dept.department_name}" (${deptId}) không?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/departments/${deptId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        appData.departments = appData.departments.filter(d => d.department_id !== deptId);
        delete appData.deptMap[deptId];

        this.updateAllDropdowns();
        this.renderDepartmentsTable();
        utils.showToast(`Đã xóa phòng ban "${dept.department_name}"!`, 'success');
      } else {
        utils.showToast(json.message || 'Không thể xóa phòng ban', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ========================================================================
  // 2. POSITIONS TABLE & MANAGEMENT
  // ========================================================================
  renderPositionsTable() {
    const tbody = document.getElementById('positions-tbody');
    if (!tbody) return;

    const posCounts = {};
    (appData.employees || []).forEach(e => {
      posCounts[e.position_id] = (posCounts[e.position_id] || 0) + 1;
    });

    const filtered = (appData.positions || []).filter(p => {
      if (!this.posSearchQuery) return true;
      const id = (p.position_id || '').toLowerCase();
      const name = (p.position_name || '').toLowerCase();
      return id.includes(this.posSearchQuery) || name.includes(this.posSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-briefcase" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy vị trí / chức danh phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const count = posCounts[p.position_id] || 0;
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${p.position_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${p.position_name}</strong></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-user-tag"></i> ${count} nhân sự
            </span>
          </td>
          <td><span class="badge badge-active">${p.status || 'Hoạt động'}</span></td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px;">
              <button class="btn btn-sm btn-outline-navy" onclick="appOrganization.filterEmployeesByPosition('${p.position_id}')" title="Xem danh sách nhân sự giữ chức danh này">
                <i class="fa-solid fa-users"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.openEditPosModal('${p.position_id}')" title="Chỉnh sửa vị trí chức danh">
                <i class="fa-solid fa-pen-to-square" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.deletePos('${p.position_id}')" title="Xóa vị trí chức danh">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddPosModal() {
    this.selectedPosId = null;
    document.getElementById('pos-modal-title').textContent = 'Thêm Vị Trí / Chức Danh Mới';

    const idInput = document.getElementById('pos-form-id');
    idInput.value = '';
    idInput.disabled = false;

    document.getElementById('pos-form-name').value = '';
    document.getElementById('pos-form-level').value = 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ';
    document.getElementById('pos-form-status').value = 'Hoạt động';

    // Populate Dept Dropdown
    const deptSelect = document.getElementById('pos-form-dept');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">-- Tất cả / Chung cho toàn công ty --</option>' +
        (appData.departments || []).map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
    }

    document.getElementById('modal-pos-form').classList.add('active');
  },

  openEditPosModal(posId) {
    const pos = (appData.positions || []).find(p => p.position_id === posId);
    if (!pos) return;

    this.selectedPosId = posId;
    document.getElementById('pos-modal-title').textContent = `Chỉnh Sửa Vị Trí (${posId})`;

    const idInput = document.getElementById('pos-form-id');
    idInput.value = pos.position_id;
    idInput.disabled = true;

    document.getElementById('pos-form-name').value = pos.position_name || '';
    document.getElementById('pos-form-level').value = pos.level || 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ';
    document.getElementById('pos-form-status').value = pos.status || 'Hoạt động';

    // Populate Dept Dropdown
    const deptSelect = document.getElementById('pos-form-dept');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">-- Tất cả / Chung cho toàn công ty --</option>' +
        (appData.departments || []).map(d => `<option value="${d.department_id}" ${d.department_id === pos.department_id ? 'selected' : ''}>${d.department_name}</option>`).join('');
    }

    document.getElementById('modal-pos-form').classList.add('active');
  },

  closePosModal() {
    const modal = document.getElementById('modal-pos-form');
    if (modal) modal.classList.remove('active');
  },

  async savePos(e) {
    e.preventDefault();
    if (this.isSavingPos) return;

    const id = document.getElementById('pos-form-id').value.trim().toUpperCase();
    const name = document.getElementById('pos-form-name').value.trim();
    const deptId = document.getElementById('pos-form-dept').value;
    const level = document.getElementById('pos-form-level').value;
    const status = document.getElementById('pos-form-status').value;

    if (!id || !name) {
      utils.showToast('Vui lòng điền đầy đủ Mã và Tên vị trí', 'error');
      return;
    }

    this.isSavingPos = true;
    const submitBtn = document.getElementById('btn-save-pos');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedPosId) {
        // UPDATE
        const res = await fetch(`/api/positions/${this.selectedPosId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position_name: name,
            department_id: deptId,
            level,
            status,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const idx = appData.positions.findIndex(p => p.position_id === this.selectedPosId);
          if (idx >= 0) appData.positions[idx] = json.position;
          appData.posMap[this.selectedPosId] = name;

          this.updateAllDropdowns();
          this.renderPositionsTable();
          this.closePosModal();
          utils.showToast('Cập nhật vị trí công việc thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cập nhật vị trí', 'error');
        }
      } else {
        // CREATE
        const res = await fetch('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position_id: id,
            position_name: name,
            department_id: deptId,
            level,
            status,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          appData.positions.push(json.position);
          appData.posMap[json.position.position_id] = json.position.position_name;

          this.updateAllDropdowns();
          this.renderPositionsTable();
          this.closePosModal();
          utils.showToast(`Thêm mới vị trí "${name}" thành công!`, 'success');
        } else {
          utils.showToast(json.message || 'Lỗi tạo vị trí', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + err.message, 'error');
    } finally {
      this.isSavingPos = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async deletePos(posId) {
    const pos = (appData.positions || []).find(p => p.position_id === posId);
    if (!pos) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa vị trí "${pos.position_name}" (${posId}) không?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/positions/${posId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        appData.positions = appData.positions.filter(p => p.position_id !== posId);
        delete appData.posMap[posId];

        this.updateAllDropdowns();
        this.renderPositionsTable();
        utils.showToast(`Đã xóa vị trí "${pos.position_name}"!`, 'success');
      } else {
        utils.showToast(json.message || 'Không thể xóa vị trí', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ========================================================================
  // 3. GLOBAL DROPDOWNS SYNCHRONIZER
  // ========================================================================
  updateAllDropdowns() {
    // 1. Employee Form & Filters
    if (window.appEmployees && typeof appEmployees.populateFilterDropdowns === 'function') {
      appEmployees.populateFilterDropdowns();
    }

    // 2. Resigned Filters
    if (window.appResigned && typeof appResigned.populateFilterDropdowns === 'function') {
      appResigned.populateFilterDropdowns();
    }

    // 3. Reports Dept Dropdown
    if (window.appReports && typeof appReports.populateDeptDropdown === 'function') {
      appReports.populateDeptDropdown();
    }

    // 4. Trash Filter Dropdown
    if (window.appTrash && typeof appTrash.populateFilterDropdowns === 'function') {
      appTrash.populateFilterDropdowns();
    }

    // 5. Update Sidebar Count badges
    const sideDeptCount = document.getElementById('sidebar-dept-count');
    if (sideDeptCount) sideDeptCount.textContent = (appData.departments || []).length;
    
    const sidePosCount = document.getElementById('sidebar-pos-count');
    if (sidePosCount) sidePosCount.textContent = (appData.positions || []).length;
  },

  // ========================================================================
  // 4. CONTRACTS TABLE
  // ========================================================================
  renderContractsTable() {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;

    const filtered = (appData.contracts || []).filter(c => {
      if (!this.contractSearchQuery) return true;
      const cid = (c.contract_id || '').toLowerCase();
      const eid = (c.employee_id || '').toLowerCase();
      const name = (c.full_name || '').toLowerCase();
      const type = (c.contract_type || '').toLowerCase();
      return cid.includes(this.contractSearchQuery) || 
             eid.includes(this.contractSearchQuery) || 
             name.includes(this.contractSearchQuery) ||
             type.includes(this.contractSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-file-excel" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy hợp đồng phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.slice(0, 100).map(c => {
      const isOfficial = c.contract_type && c.contract_type.includes('KXD');
      const badgeType = isOfficial ? 'badge-active' : 'badge-navy';
      const statusBadge = c.contract_status === 'HIỆU LỰC' 
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> HIỆU LỰC</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-ban"></i> HẾT HẠN</span>';

      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace;">${c.contract_id}</strong></td>
          <td>
            <span class="badge badge-navy" style="cursor: pointer;" onclick="appEmployees.openDetailModal('${c.employee_id}')" title="Xem chi tiết nhân viên">
              ${c.employee_id}
            </span>
          </td>
          <td><strong style="color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${c.employee_id}')">${c.full_name}</strong></td>
          <td><span class="badge ${badgeType}">${c.contract_type}</span></td>
          <td>${utils.formatDate(c.trial_start_date)}</td>
          <td>${utils.formatDate(c.official_date)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // 5. NAVIGATION HELPERS
  // ========================================================================
  filterEmployeesByDept(deptId) {
    const navEmp = document.querySelector('.nav-item[data-view="employees"]');
    if (navEmp) navEmp.click();
    
    setTimeout(() => {
      const select = document.getElementById('emp-filter-dept');
      if (select) {
        select.value = deptId;
        appEmployees.applyFilters();
      }
    }, 50);
  },

  filterEmployeesByPosition(posId) {
    const navEmp = document.querySelector('.nav-item[data-view="employees"]');
    if (navEmp) navEmp.click();

    setTimeout(() => {
      const search = document.getElementById('emp-search-input');
      if (search) {
        search.value = posId;
        appEmployees.applyFilters();
      }
    }, 50);
  }
};
