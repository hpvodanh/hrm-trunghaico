// ==========================================================================
// EMPLOYEE MANAGEMENT MODULE (Đã tích hợp Xóa hàng loạt chuẩn xác)
// ==========================================================================

const appEmployees = {
  initialized: false,
  currentPage: 1,
  pageSize: 25,
  filteredList: [],
  selectedEmployee: null,
  selectedIds: new Set(), // Quản lý danh sách ID nhân viên được tích chọn hàng loạt
  isSelectMode: false, // Chế độ chọn: mặc định ẩn các ô tích, chỉ hiện khi bấm "Chọn"

  init() {
    this.populateFilterDropdowns();
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.applyFilters();
  },

  populateFilterDropdowns() {
    const deptSelect = document.getElementById('emp-filter-dept');
    const formDeptSelect = document.getElementById('form-dept-id');
    if (deptSelect && formDeptSelect) {
      const opts = appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
      deptSelect.innerHTML = `<option value="">-- Tất cả Đơn vị / Phòng ban --</option>` + opts;
      formDeptSelect.innerHTML = `<option value="">-- Chọn Đơn vị / Phòng ban --</option>` + opts;
    }

    const posSelect = document.getElementById('emp-filter-pos');
    const formPosSelect = document.getElementById('form-pos-id');
    if (posSelect && formPosSelect) {
      const opts = appData.positions.map(p => `<option value="${p.position_id}">${p.position_name}</option>`).join('');
      posSelect.innerHTML = `<option value="">-- Tất cả Vị trí --</option>` + opts;
      formPosSelect.innerHTML = `<option value="">-- Chọn Vị trí Công việc --</option>` + opts;
    }

    const formMgrSelect = document.getElementById('form-direct-mgr');
    if (formMgrSelect) {
      const activeEmps = appData.employees.filter(e => e.employment_status === 'Đang làm việc');
      const opts = activeEmps.map(e => `<option value="${e.employee_id}">${e.full_name} (${e.employee_id})</option>`).join('');
      formMgrSelect.innerHTML = `<option value="">-- Không có / Tự quản lý --</option>` + opts;
    }
  },

  attachEventListeners() {
    const searchInput = document.getElementById('emp-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    ['emp-filter-dept', 'emp-filter-pos', 'emp-filter-status', 'emp-filter-nature'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.currentPage = 1;
          this.applyFilters();
        });
      }
    });

    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('emp-search-input').value = '';
        document.getElementById('emp-filter-dept').value = '';
        document.getElementById('emp-filter-pos').value = '';
        document.getElementById('emp-filter-status').value = '';
        document.getElementById('emp-filter-nature').value = '';
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Detail Modal Tabs Navigation
    document.querySelectorAll('#modal-employee-detail .modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('#modal-employee-detail .modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#modal-employee-detail .tab-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    document.querySelectorAll('.form-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.form-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.form-tab-pane').forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) {
          pane.classList.add('active');
          pane.style.display = 'block';
        }
      });
    });

    const addBtn = document.getElementById('btn-open-add-modal');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    const form = document.getElementById('employee-crud-form');
    if (form) form.addEventListener('submit', (e) => this.handleFormSubmit(e));

    const editFromDetBtn = document.getElementById('btn-edit-from-detail');
    if (editFromDetBtn) {
      editFromDetBtn.addEventListener('click', () => {
        if (this.selectedEmployee) {
          this.closeDetailModal();
          this.openEditModal(this.selectedEmployee.employee_id);
        }
      });
    }

    const pageSizeSelect = document.getElementById('emp-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 25;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    }

    const exportFilteredBtn = document.getElementById('btn-export-filtered-emp');
    if (exportFilteredBtn) {
      exportFilteredBtn.addEventListener('click', () => this.exportFilteredExcel());
    }
  },

  applyFilters() {
    const searchVal = (document.getElementById('emp-search-input')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('emp-filter-dept')?.value || '';
    const posVal = document.getElementById('emp-filter-pos')?.value || '';
    const statusVal = document.getElementById('emp-filter-status')?.value || '';
    const natureVal = document.getElementById('emp-filter-nature')?.value || '';

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    this.filteredList = appData.employees.filter(e => {
      if (deptVal && e.department_id !== deptVal) return false;
      if (posVal && e.position_id !== posVal) return false;
      if (statusVal && e.employment_status !== statusVal) return false;
      if (natureVal && e.labor_nature !== natureVal) return false;

      if (searchVal) {
        const c = contactMap[e.employee_id] || {};
        const idDoc = idMap[e.employee_id] || {};
        const dName = (appData.deptMap[e.department_id] || '').toLowerCase();
        const pName = (appData.posMap[e.position_id] || '').toLowerCase();

        const match = (
          (e.employee_id || '').toLowerCase().includes(searchVal) ||
          (e.full_name || '').toLowerCase().includes(searchVal) ||
          (c.mobile_phone || '').includes(searchVal) ||
          (c.work_email || '').toLowerCase().includes(searchVal) ||
          (idDoc.id_number || '').includes(searchVal) ||
          dName.includes(searchVal) ||
          pName.includes(searchVal)
        );
        if (!match) return false;
      }

      return true;
    });

    this.filteredList.sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }));

    this.renderTable();
    this.renderPagination();
    this.updateBulkDeleteBar();
  },

  renderTable() {
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) return;

    if (this.filteredList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 32px; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>
        Không tìm thấy nhân sự phù hợp với điều kiện lọc.
      </td></tr>`;
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);

    tbody.innerHTML = paginated.map((e, index) => {
      const stt = start + index + 1;
      const c = contactMap[e.employee_id] || {};
      const isChecked = this.selectedIds.has(e.employee_id);

      const statusBadge = e.employment_status === 'Đang làm việc'
        ? '<span class="badge badge-active"><i class="fa-solid fa-check"></i> Đang làm việc</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-xmark"></i> Đã nghỉ việc</span>';

      const natureBadge = e.labor_nature === 'Chính thức'
        ? '<span class="badge badge-navy">Chính thức</span>'
        : e.labor_nature === 'Thử việc'
        ? '<span class="badge badge-probation">Thử việc</span>'
        : `<span class="badge" style="background:#F1F5F9; color:#475569;">${e.labor_nature || '-'}</span>`;

      return `
        <tr class="${isChecked ? 'row-selected' : ''}">
          <td class="col-select">
            <input type="checkbox" class="emp-checkbox" value="${e.employee_id}" ${isChecked ? 'checked' : ''} onchange="appEmployees.toggleRowSelect('${e.employee_id}', this.checked)">
          </td>
          <td class="col-sticky-stt" style="color: var(--text-muted); font-size: 12px; font-weight: 500;">${stt}</td>
          <td class="col-sticky-id"><strong style="color: var(--primary-navy); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.employee_id}</strong></td>
          <td class="col-sticky-name">
            <div style="font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.full_name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${e.time_attendance_code ? 'MCC: ' + e.time_attendance_code : ''}</div>
          </td>
          <td>${e.gender || '-'}</td>
          <td>${appData.posMap[e.position_id] || e.position_id || '-'}</td>
          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${appData.deptMap[e.department_id] || e.department_id}">
            ${appData.deptMap[e.department_id] || e.department_id}
          </td>
          <td>${c.mobile_phone || '-'}</td>
          <td>${c.work_email ? `<a href="mailto:${c.work_email}" style="color: var(--primary-navy); text-decoration: none;">${c.work_email}</a>` : '-'}</td>
          <td>${natureBadge}</td>
          <td>${statusBadge}</td>
          <td class="col-sticky-action">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-icon btn-sm" title="Xem Chi Tiết 8 Tab" onclick="appEmployees.openDetailModal('${e.employee_id}')">
                <i class="fa-solid fa-eye" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Chỉnh Sửa 34 Cột" onclick="appEmployees.openEditModal('${e.employee_id}')">
                <i class="fa-solid fa-pen-to-square" style="color: #2563EB;"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Xóa Nhân Viên" onclick="appEmployees.showDeletePopover(event, '${e.employee_id}')">
                <i class="fa-solid fa-trash" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Đồng bộ trạng thái checkbox "Chọn tất cả" trên header bảng
    const selectAllCheck = document.getElementById('select-all-emp');
    if (selectAllCheck && paginated.length > 0) {
      selectAllCheck.checked = paginated.every(e => this.selectedIds.has(e.employee_id));
    }
  },

  // Đóng mở Menu Hành Động
  toggleActionMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('menu-emp-actions');
    if (!menu) return;
    const isShowing = menu.style.display === 'block';
    menu.style.display = isShowing ? 'none' : 'block';

    if (!isShowing) {
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && !document.getElementById('btn-emp-action-menu')?.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }
  },

  closeActionMenu() {
    const menu = document.getElementById('menu-emp-actions');
    if (menu) menu.style.display = 'none';
  },

  // Bật chế độ chọn (Hiện các ô tích trước tên nhân sự)
  enableSelectMode(selectAll = false) {
    this.closeActionMenu();
    this.isSelectMode = true;

    const table = document.getElementById('emp-main-table');
    if (table) table.classList.add('selection-active');

    if (selectAll) {
      const start = (this.currentPage - 1) * this.pageSize;
      const paginated = this.filteredList.slice(start, start + this.pageSize);
      paginated.forEach(e => this.selectedIds.add(e.employee_id));
    }

    this.renderTable();
    this.updateBulkDeleteBar();
    utils.showToast(selectAll ? 'Đã hiện ô tích và chọn tất cả trang này' : 'Đã hiện các ô tích chọn nhân sự', 'info');
  },

  // Tắt chế độ chọn (Ẩn các ô tích)
  disableSelectMode() {
    this.isSelectMode = false;
    this.selectedIds.clear();

    const table = document.getElementById('emp-main-table');
    if (table) table.classList.remove('selection-active');

    const selectAllCheck = document.getElementById('select-all-emp');
    if (selectAllCheck) selectAllCheck.checked = false;

    this.renderTable();
    this.updateBulkDeleteBar();
  },

  // Chọn toàn bộ nhân sự theo bộ lọc
  selectAllFiltered() {
    this.closeActionMenu();
    this.isSelectMode = true;

    const table = document.getElementById('emp-main-table');
    if (table) table.classList.add('selection-active');

    this.filteredList.forEach(e => this.selectedIds.add(e.employee_id));

    this.renderTable();
    this.updateBulkDeleteBar();
    utils.showToast(`Đã chọn toàn bộ ${this.selectedIds.size} nhân sự trong danh sách lọc!`, 'success');
  },

  // Chọn / Bỏ chọn toàn bộ nhân sự trong trang hiện tại
  toggleSelectAllCurrentPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);
    const allSelected = paginated.every(e => this.selectedIds.has(e.employee_id));

    paginated.forEach(e => {
      if (allSelected) {
        this.selectedIds.delete(e.employee_id);
      } else {
        this.selectedIds.add(e.employee_id);
      }
    });

    this.renderTable();
    this.updateBulkDeleteBar();
  },

  // Bỏ chọn tất cả
  clearSelection() {
    this.selectedIds.clear();
    const selectAllCheck = document.getElementById('select-all-emp');
    if (selectAllCheck) selectAllCheck.checked = false;
    this.renderTable();
    this.updateBulkDeleteBar();
  },

  // Chọn / Bỏ chọn qua master checkbox ở tiêu đề bảng
  toggleSelectAll(masterCheckbox) {
    if (!this.isSelectMode) {
      this.enableSelectMode(false);
    }
    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);
    paginated.forEach(e => {
      if (masterCheckbox.checked) {
        this.selectedIds.add(e.employee_id);
      } else {
        this.selectedIds.delete(e.employee_id);
      }
    });
    this.renderTable();
    this.updateBulkDeleteBar();
  },

  toggleRowSelect(empId, isChecked) {
    if (isChecked) {
      this.selectedIds.add(empId);
    } else {
      this.selectedIds.delete(empId);
    }
    this.updateBulkDeleteBar();
  },

  // Hiển thị / Cập nhật thanh thao tác hàng loạt
  updateBulkDeleteBar() {
    let bar = document.getElementById('bulk-delete-bar');
    if (!bar) {
      const tableControls = document.querySelector('.table-controls');
      if (tableControls && tableControls.parentNode) {
        bar = document.createElement('div');
        bar.id = 'bulk-delete-bar';
        bar.className = 'bulk-delete-toolbar';
        tableControls.parentNode.insertBefore(bar, tableControls.nextSibling);
      }
    }

    if (!bar) return;

    if (!this.isSelectMode) {
      bar.style.display = 'none';
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);
    const count = this.selectedIds.size;
    const pageCount = paginated.length;
    const totalCount = this.filteredList.length;

    bar.style.display = 'flex';
    bar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #2563EB; color: #FFFFFF; font-size: 11px;">
          <i class="fa-solid fa-check"></i>
        </span>
        <span style="font-size: 12.5px; font-weight: 600; color: #1E3A8A;">
          Đã chọn: <strong style="color: #DC2626; font-size: 14px;">${count}</strong> / ${totalCount} nhân sự
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <button type="button" class="btn btn-sm btn-secondary" onclick="appEmployees.toggleSelectAllCurrentPage()" style="font-size: 11.5px;">
          <i class="fa-solid fa-check-double" style="color: #10B981;"></i> Chọn trang này (${pageCount})
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="appEmployees.selectAllFiltered()" style="font-size: 11.5px;">
          <i class="fa-solid fa-users-viewfinder" style="color: #2563EB;"></i> Chọn tất cả (${totalCount})
        </button>
        ${count > 0 ? `
          <button type="button" class="btn btn-sm btn-secondary" onclick="appEmployees.clearSelection()" style="font-size: 11.5px;">
            <i class="fa-solid fa-rotate-left"></i> Bỏ chọn
          </button>
        ` : ''}
        <button type="button" class="btn btn-sm" onclick="appEmployees.bulkDeleteEmployees()" style="background: #DC2626; color: #FFFFFF; border: none; font-size: 11.5px; font-weight: 600; padding: 4px 10px; cursor: pointer; ${count === 0 ? 'opacity: 0.5; pointer-events: none;' : ''}">
          <i class="fa-solid fa-trash-can"></i> Xóa đã chọn (${count})
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="appEmployees.disableSelectMode()" style="font-size: 11.5px; color: #64748B;" title="Ẩn ô tích & thoát">
          <i class="fa-solid fa-xmark"></i> Hủy
        </button>
      </div>
    `;
  },

  // Thực hiện xóa hàng loạt chuyển vào Thùng rác và render lại ngay lập tức
  async bulkDeleteEmployees() {
    const employeeIds = Array.from(this.selectedIds);
    if (employeeIds.length === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn chuyển ${employeeIds.length} nhân sự đã chọn vào Thùng rác không?`)) {
      return;
    }

    try {
      let successCount = 0;
      const user = (typeof appAuth !== 'undefined' && appAuth.currentUser) ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' };

      for (const empId of employeeIds) {
        const res = await fetch(`/api/employees/${empId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operator_id: user.employee_id,
            operator_name: user.full_name,
            operator_role: user.role
          })
        });
        const json = await res.json();
        if (json.success) {
          successCount++;
          const emp = appData.empMap[empId];
          const trashEntry = {
            trash_id: json.trash_id || `TRASH-${empId}-${Date.now()}`,
            employee_id: empId,
            full_name: emp ? emp.full_name : empId,
            gender: emp ? emp.gender : '',
            department_id: emp ? emp.department_id : '',
            position_id: emp ? emp.position_id : '',
            job_title: emp ? emp.job_title : '',
            work_email: emp ? emp.work_email : '',
            mobile_phone: emp ? emp.mobile_phone : '',
            deleted_at: new Date().toISOString(),
            deleted_by_name: user?.full_name || 'Huỳnh Thanh Long'
          };
          appData.addDeletedId(empId, trashEntry);
        }
      }

      utils.showToast(`Đã chuyển thành công ${successCount}/${employeeIds.length} nhân sự vào Thùng rác!`, 'success');
      
      // Xóa sạch danh sách ID đã chọn và ẩn thanh công cụ
      this.selectedIds.clear();
      this.disableSelectMode();

      // Đồng bộ lại dữ liệu từ server và cập nhật giao diện ngay lập tức
      await appData.init();
      appDashboard.init();
      if (typeof appTrash !== 'undefined') appTrash.render();
      
      this.currentPage = 1;
      this.applyFilters();
      if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
        appSheets.autoSync();
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi khi thực hiện xóa hàng loạt: ' + err.message, 'error');
    }
  },

  renderPagination() {
    const total = this.filteredList.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    const infoEl = document.getElementById('pagination-info');
    if (infoEl) {
      infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> nhân sự`;
    }

    const container = document.getElementById('pagination-controls');
    if (!container) return;

    let html = '';
    html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="appEmployees.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="appEmployees.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="appEmployees.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>`;
    container.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredList.length / this.pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  },

  // Các hàm chi tiết, thêm, sửa, xóa đơn lẻ...
  async openDetailModal(empId) {
    try {
      const res = await fetch(`/api/employees/${empId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        utils.showToast('Không thể tải chi tiết nhân viên', 'error');
        return;
      }

      const { employee, contact, identity, emergency, education, salary, insurance, contracts, account } = json.data;
      this.selectedEmployee = employee;

      document.getElementById('detail-modal-emp-name').textContent = `Hồ Sơ Nhân Viên: ${employee.full_name} (${employee.employee_id})`;
      document.getElementById('det-emp-id').textContent = employee.employee_id || '-';
      document.getElementById('det-time-code').textContent = employee.time_attendance_code || '-';
      document.getElementById('det-full-name').textContent = employee.full_name || '-';
      document.getElementById('det-gender').textContent = employee.gender || '-';
      document.getElementById('det-dob').textContent = utils.formatDate(employee.date_of_birth);
      document.getElementById('det-birth-place').textContent = employee.birth_place || '-';
      document.getElementById('det-native-place').textContent = employee.native_place || '-';
      document.getElementById('det-ethnicity-rel').textContent = `${employee.ethnicity || 'Kinh'} / ${employee.religion || 'Không'}`;
      document.getElementById('det-marital-children').textContent = `${employee.marital_status || 'Độc thân'} (Số con: ${employee.children_count !== undefined ? employee.children_count : 0})`;
      document.getElementById('det-dept-name').textContent = employee.department_name || employee.department_id || '-';
      document.getElementById('det-pos-name').textContent = employee.position_name || employee.position_id || '-';
      document.getElementById('det-job-rank').textContent = employee.job_rank || (salary.salary_grade ? `Cấp ${salary.salary_grade}` : 'Cấp 3');
      document.getElementById('det-job-title').textContent = employee.job_title || employee.position_name || '-';
      document.getElementById('det-work-loc').textContent = employee.work_location || 'Trụ sở Tổng công ty';
      document.getElementById('det-direct-mgr').textContent = employee.direct_manager_name ? `${employee.direct_manager_name} (${employee.direct_manager_id || ''})` : '-';
      document.getElementById('det-indirect-mgr').textContent = employee.indirect_manager_name ? `${employee.indirect_manager_name} (${employee.indirect_manager_id || ''})` : '-';
      document.getElementById('det-labor-nature').textContent = employee.labor_nature || '-';
      document.getElementById('det-emp-status').textContent = employee.employment_status || '-';
      document.getElementById('det-start-date').textContent = utils.formatDate(employee.start_date || employee.trial_start_date);
      document.getElementById('det-end-date').textContent = employee.end_date === 'Không xác định' ? 'Không xác định' : utils.formatDate(employee.end_date);
      document.getElementById('det-official-date').textContent = utils.formatDate(employee.official_date) || utils.formatDate(employee.trial_start_date);
      document.getElementById('det-seniority').textContent = employee.seniority_text || '-';
      document.getElementById('det-other-certs').textContent = employee.other_certificates || (education && education[0] ? education[0].other_certificates : '') || 'Chứng chỉ An toàn Lao động';

      document.getElementById('det-mobile').textContent = contact.mobile_phone || '-';
      document.getElementById('det-home-phone').textContent = contact.home_phone || '-';
      document.getElementById('det-work-email').textContent = contact.work_email || '-';
      document.getElementById('det-personal-email').textContent = contact.personal_email || '-';
      document.getElementById('det-perm-addr').textContent = contact.permanent_address_full || '-';
      document.getElementById('det-curr-addr').textContent = contact.current_address_full || '-';

      document.getElementById('det-id-type').textContent = identity.doc_type || 'CCCD';
      document.getElementById('det-id-num').textContent = identity.id_number || '-';
      document.getElementById('det-id-date').textContent = utils.formatDate(identity.id_issue_date);
      document.getElementById('det-id-place').textContent = identity.id_issue_place || '-';
      document.getElementById('det-id-exp').textContent = utils.formatDate(identity.id_expiry_date);
      document.getElementById('det-tax-code').textContent = employee.tax_code || '-';
      document.getElementById('det-passport-num').textContent = identity.passport_number || '-';
      document.getElementById('det-passport-date').textContent = utils.formatDate(identity.passport_issue_date);

      const emContainer = document.getElementById('det-emergency-container');
      if (emergency && emergency.length > 0) {
        emContainer.innerHTML = emergency.map(em => `
          <div class="info-item"><span class="info-label">Họ và Tên Thân Nhân</span><span class="info-value">${em.contact_name || '-'}</span></div>
          <div class="info-item"><span class="info-label">Mối Quan Hệ</span><span class="info-value">${em.relationship || '-'}</span></div>
          <div class="info-item"><span class="info-label">Số ĐT Liên Hệ</span><span class="info-value">${em.mobile_phone || '-'}</span></div>
          <div class="info-item"><span class="info-label">Email Thân Nhân</span><span class="info-value">${em.email || '-'}</span></div>
          <div class="info-item" style="grid-column: 1 / -1;"><span class="info-label">Địa Chỉ</span><span class="info-value">${em.address || '-'}</span></div>
        `).join('');
      } else {
        emContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 20px;">Chưa có thông tin người liên hệ khẩn cấp.</div>`;
      }

      const eduContainer = document.getElementById('det-education-container');
      if (education && education.length > 0) {
        eduContainer.innerHTML = education.map(ed => `
          <div class="info-item"><span class="info-label">Trình Độ Văn Hóa</span><span class="info-value">${ed.education_level || 'Đại học'}</span></div>
          <div class="info-item"><span class="info-label">Trình Độ Đào Tạo</span><span class="info-value">${ed.degree_type || 'Chính quy'}</span></div>
          <div class="info-item"><span class="info-label">Cơ Sở Đào Tạo (Trường)</span><span class="info-value">${ed.institution || '-'}</span></div>
          <div class="info-item"><span class="info-label">Khoa / Bộ Môn</span><span class="info-value">${ed.faculty || '-'}</span></div>
          <div class="info-item"><span class="info-label">Chuyên Ngành Tốt Nghiệp</span><span class="info-value">${ed.major || '-'}</span></div>
          <div class="info-item"><span class="info-label">Năm Tốt Nghiệp / Xếp Loại</span><span class="info-value">${ed.graduation_year || '-'} (${ed.classification || '-'})</span></div>
          <div class="info-item" style="grid-column: 1 / -1;"><span class="info-label">Bằng Cấp Chuyên Môn Khác</span><span class="info-value" style="color: #059669;">${ed.other_certificates || employee.other_certificates || '-'}</span></div>
        `).join('');
      } else {
        eduContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 20px;">Chưa có thông tin văn bằng / học vị.</div>`;
      }

      document.getElementById('det-salary-grade').textContent = salary.salary_grade || '1';
      document.getElementById('det-base-salary').textContent = utils.formatCurrency(salary.base_salary);
      document.getElementById('det-total-salary').textContent = utils.formatCurrency(salary.total_salary);
      document.getElementById('det-ins-salary').textContent = utils.formatCurrency(salary.insurance_salary);
      document.getElementById('det-bank-acc').textContent = salary.bank_account_number || '-';
      document.getElementById('det-bank-name').textContent = salary.bank_name || '-';
      document.getElementById('det-bank-branch').textContent = salary.bank_branch || '-';

      document.getElementById('det-has-ins').textContent = insurance.has_insurance || 'Không tham gia';
      document.getElementById('det-bhxh-code').textContent = insurance.social_insurance_code || '-';
      document.getElementById('det-bhxh-book').textContent = insurance.social_insurance_book_no || '-';
      document.getElementById('det-ins-date').textContent = utils.formatDate(insurance.insurance_join_date);
      document.getElementById('det-ins-rate').textContent = '10.5% (BHXH 8%, BHYT 1.5%, BHTN 1%)';
      document.getElementById('det-hospital').textContent = insurance.hospital_registered || '-';
      document.getElementById('det-union').textContent = insurance.union_member || 'Không';

      const firstContract = contracts && contracts.length > 0 ? contracts[0] : {};
      document.getElementById('det-contract-id').textContent = firstContract.contract_id || '-';
      document.getElementById('det-contract-type').textContent = firstContract.contract_type || employee.contract_type || 'Hợp đồng lao động';
      document.getElementById('det-contract-status').textContent = firstContract.contract_status || 'HIỆU LỰC';
      document.getElementById('det-acc-email').textContent = account.account_email || `${employee.employee_id.toLowerCase()}@trunghaico.vn`;
      document.getElementById('det-acc-role').textContent = account.role || 'USER';
      document.getElementById('det-acc-status').textContent = account.account_status || 'Đã kích hoạt';

      document.querySelector('#modal-employee-detail .modal-tab-btn[data-tab="tab-general"]').click();
      document.getElementById('modal-employee-detail').classList.add('active');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi mở hồ sơ nhân viên', 'error');
    }
  },

  closeDetailModal() {
    document.getElementById('modal-employee-detail').classList.remove('active');
  },

  openAddModal() {
    document.getElementById('form-is-edit').value = '0';
    document.getElementById('form-modal-title').textContent = 'Thêm Nhân Viên Mới (Đầy Đủ 34 Cột)';
    document.getElementById('form-modal-icon').className = 'fa-solid fa-user-plus';
    document.getElementById('form-emp-id').value = '';
    document.getElementById('form-emp-id').readOnly = false;
    document.getElementById('employee-crud-form').reset();

    document.getElementById('form-gender').value = 'Nam';
    document.getElementById('form-ethnicity').value = 'Kinh';
    document.getElementById('form-religion').value = 'Không';
    document.getElementById('form-marital-status').value = 'Độc thân';
    document.getElementById('form-children-count').value = '0';
    document.getElementById('form-job-rank').value = 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ';
    document.getElementById('form-labor-nature').value = 'Chính thức';
    document.getElementById('form-emp-status').value = 'Đang làm việc';
    document.getElementById('form-contract-type').value = 'Hợp đồng lao động không xác định thời hạn';
    document.getElementById('form-id-place').value = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
    document.getElementById('form-bank-name').value = 'Vietcombank';
    document.getElementById('form-education-level').value = 'Đại học';
    document.getElementById('form-emergency-relation').value = 'Vợ';

    document.querySelector('.form-tab-btn[data-tab="form-tab-personal"]').click();
    document.getElementById('modal-employee-form').classList.add('active');
  },

  async openEditModal(empId) {
    try {
      const res = await fetch(`/api/employees/${empId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        utils.showToast('Không thể tải chi tiết nhân viên để sửa', 'error');
        return;
      }

      const { employee, contact, identity, emergency, education, salary, insurance, contracts } = json.data;
      const firstContract = contracts && contracts.length > 0 ? contracts[0] : {};
      const firstEmerg = emergency && emergency.length > 0 ? emergency[0] : {};
      const firstEdu = education && education.length > 0 ? education[0] : {};

      document.getElementById('form-is-edit').value = '1';
      document.getElementById('form-modal-title').textContent = `Chỉnh Sửa Hồ Sơ: ${employee.full_name} (${empId})`;
      document.getElementById('form-modal-icon').className = 'fa-solid fa-user-pen';
      
      document.getElementById('form-emp-id').value = employee.employee_id || '';
      document.getElementById('form-emp-id').readOnly = true;
      document.getElementById('form-full-name').value = employee.full_name || '';
      document.getElementById('form-gender').value = employee.gender || 'Nam';
      document.getElementById('form-dob').value = employee.date_of_birth || '';
      document.getElementById('form-birth-place').value = employee.birth_place || '';
      document.getElementById('form-native-place').value = employee.native_place || '';
      document.getElementById('form-ethnicity').value = employee.ethnicity || 'Kinh';
      document.getElementById('form-religion').value = employee.religion || 'Không';
      document.getElementById('form-marital-status').value = employee.marital_status || 'Độc thân';
      document.getElementById('form-children-count').value = employee.children_count !== undefined ? employee.children_count : 0;
      document.getElementById('form-tax-code').value = employee.tax_code || '';

      document.getElementById('form-dept-id').value = employee.department_id || '';
      document.getElementById('form-pos-id').value = employee.position_id || '';
      document.getElementById('form-job-rank').value = employee.job_rank || (salary.salary_grade ? `Cấp ${salary.salary_grade} - Kỹ sư Chính` : 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ');
      document.getElementById('form-job-title').value = employee.job_title || '';
      document.getElementById('form-work-location').value = employee.work_location || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội';
      document.getElementById('form-direct-mgr').value = employee.direct_manager_id || '';
      document.getElementById('form-labor-nature').value = employee.labor_nature || 'Chính thức';
      document.getElementById('form-emp-status').value = employee.employment_status || 'Đang làm việc';
      document.getElementById('form-contract-type').value = firstContract.contract_type || employee.contract_type || 'Hợp đồng lao động không xác định thời hạn';
      document.getElementById('form-start-date').value = employee.start_date || employee.trial_start_date || '';
      document.getElementById('form-end-date').value = employee.end_date || firstContract.end_date || 'Không xác định';

      document.getElementById('form-mobile').value = contact.mobile_phone || '';
      document.getElementById('form-email').value = contact.work_email || '';
      document.getElementById('form-personal-email').value = contact.personal_email || '';
      document.getElementById('form-perm-address').value = contact.permanent_address_full || '';
      document.getElementById('form-curr-address').value = contact.current_address_full || '';
      document.getElementById('form-id-num').value = identity.id_number || '';
      document.getElementById('form-id-date').value = identity.id_issue_date || '';
      document.getElementById('form-id-place').value = identity.id_issue_place || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
      document.getElementById('form-passport-num').value = identity.passport_number || '';
      document.getElementById('form-emergency-name').value = firstEmerg.contact_name || '';
      document.getElementById('form-emergency-relation').value = firstEmerg.relationship || 'Vợ';
      document.getElementById('form-emergency-phone').value = firstEmerg.mobile_phone || '';

      document.getElementById('form-salary').value = salary.base_salary || 0;
      document.getElementById('form-total-salary').value = salary.total_salary || salary.base_salary || 0;
      document.getElementById('form-bank-acc').value = salary.bank_account_number || '';
      document.getElementById('form-bank-name').value = salary.bank_name || 'Vietcombank';
      document.getElementById('form-bank-branch').value = salary.bank_branch || '';
      document.getElementById('form-bhxh-book').value = insurance.social_insurance_book_no || insurance.social_insurance_code || '';
      document.getElementById('form-hospital').value = insurance.hospital_registered || '';
      document.getElementById('form-education-level').value = firstEdu.education_level || 'Đại học';
      document.getElementById('form-major').value = firstEdu.major || '';
      document.getElementById('form-other-certs').value = employee.other_certificates || firstEdu.other_certificates || '';

      document.querySelector('.form-tab-btn[data-tab="form-tab-personal"]').click();
      document.getElementById('modal-employee-form').classList.add('active');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi mở form chỉnh sửa', 'error');
    }
  },

  closeFormModal() {
    document.getElementById('modal-employee-form').classList.remove('active');
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const isEdit = document.getElementById('form-is-edit').value === '1';
    const empId = document.getElementById('form-emp-id').value.trim();

    const payload = {
      employee_id: empId,
      full_name: document.getElementById('form-full-name').value.trim(),
      gender: document.getElementById('form-gender').value,
      date_of_birth: document.getElementById('form-dob').value || null,
      birth_place: document.getElementById('form-birth-place').value.trim(),
      native_place: document.getElementById('form-native-place').value.trim(),
      ethnicity: document.getElementById('form-ethnicity').value.trim(),
      religion: document.getElementById('form-religion').value.trim(),
      marital_status: document.getElementById('form-marital-status').value,
      children_count: parseInt(document.getElementById('form-children-count').value, 10) || 0,
      tax_code: document.getElementById('form-tax-code').value.trim(),

      department_id: document.getElementById('form-dept-id').value,
      position_id: document.getElementById('form-pos-id').value,
      job_rank: document.getElementById('form-job-rank').value,
      job_title: document.getElementById('form-job-title').value.trim(),
      work_location: document.getElementById('form-work-location').value.trim(),
      direct_manager_id: document.getElementById('form-direct-mgr').value || null,
      labor_nature: document.getElementById('form-labor-nature').value,
      employment_status: document.getElementById('form-emp-status').value,
      contract_type: document.getElementById('form-contract-type').value,
      start_date: document.getElementById('form-start-date').value || null,
      end_date: document.getElementById('form-end-date').value.trim() || 'Không xác định',

      mobile_phone: document.getElementById('form-mobile').value.trim(),
      work_email: document.getElementById('form-email').value.trim(),
      personal_email: document.getElementById('form-personal-email').value.trim(),
      permanent_address_full: document.getElementById('form-perm-address').value.trim(),
      current_address_full: document.getElementById('form-curr-address').value.trim(),

      id_number: document.getElementById('form-id-num').value.trim(),
      id_issue_date: document.getElementById('form-id-date').value || null,
      id_issue_place: document.getElementById('form-id-place').value.trim(),
      passport_number: document.getElementById('form-passport-num').value.trim() || null,

      emergency_name: document.getElementById('form-emergency-name').value.trim(),
      emergency_relation: document.getElementById('form-emergency-relation').value,
      emergency_phone: document.getElementById('form-emergency-phone').value.trim(),

      base_salary: parseFloat(document.getElementById('form-salary').value) || 0,
      total_salary: parseFloat(document.getElementById('form-total-salary').value) || parseFloat(document.getElementById('form-salary').value) || 0,
      bank_account_number: document.getElementById('form-bank-acc').value.trim(),
      bank_name: document.getElementById('form-bank-name').value,
      bank_branch: document.getElementById('form-bank-branch').value.trim(),

      social_insurance_book_no: document.getElementById('form-bhxh-book').value.trim(),
      hospital_registered: document.getElementById('form-hospital').value.trim(),

      education_level: document.getElementById('form-education-level').value,
      major: document.getElementById('form-major').value.trim(),
      other_certificates: document.getElementById('form-other-certs').value.trim()
    };

    try {
      const url = isEdit ? `/api/employees/${empId}` : '/api/employees';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        appData.saveLocalEmployee(payload);
        utils.showToast(isEdit ? 'Cập nhật nhân viên thành công!' : 'Thêm nhân viên mới thành công!', 'success');
        this.closeFormModal();
        await appData.init();
        appDashboard.init();
        this.applyFilters();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Lỗi khi lưu dữ liệu', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi kết nối tới máy chủ', 'error');
    }
  },

  showDeletePopover(event, empId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.hideDeletePopover();

    const emp = appData.empMap[empId];
    const name = emp ? emp.full_name : empId;
    const triggerBtn = event.currentTarget || event.target.closest('button');

    const popover = document.createElement('div');
    popover.id = 'hrm-emp-delete-popover';
    popover.className = 'hrm-delete-popover';
    popover.innerHTML = `
      <div class="hrm-popover-header">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); font-size: 13px;"></i>
        <span>Xác nhận xóa nhân sự</span>
      </div>
      <div class="hrm-popover-body">
        Chuyển nhân viên <strong style="color: var(--primary-navy);">${name}</strong> (<span style="color: var(--accent-red); font-weight: 600;">${empId}</span>) vào <strong>Thùng rác</strong>? Bạn có thể khôi phục bất cứ lúc nào.
      </div>
      <div class="hrm-popover-actions">
        <button type="button" class="btn btn-secondary hrm-popover-btn-cancel" onclick="appEmployees.hideDeletePopover()">Hủy</button>
        <button type="button" class="btn btn-accent hrm-popover-btn-confirm" id="btn-popover-confirm-del-${empId}">
          <i class="fa-solid fa-trash-can"></i> Xóa
        </button>
      </div>
      <div class="hrm-popover-arrow"></div>
    `;

    document.body.appendChild(popover);

    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = popover.offsetHeight || 135;

      let left = rect.left - popoverWidth - 10;
      let top = rect.top + (rect.height / 2) - (popoverHeight / 2);
      let placement = 'left';

      if (left < 10) {
        left = rect.right + 10;
        placement = 'right';
      }

      if (top < 10) top = 10;
      if (top + popoverHeight > window.innerHeight - 10) {
        top = window.innerHeight - popoverHeight - 10;
      }

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.setAttribute('data-placement', placement);
    }

    const confirmBtn = document.getElementById(`btn-popover-confirm-del-${empId}`);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmDelete(empId, confirmBtn);
      });
    }

    const outsideClickListener = (e) => {
      if (!popover.contains(e.target) && triggerBtn && !triggerBtn.contains(e.target)) {
        this.hideDeletePopover();
      }
    };
    const escListener = (e) => {
      if (e.key === 'Escape') {
        this.hideDeletePopover();
      }
    };
    const scrollListener = () => {
      this.hideDeletePopover();
    };

    this._popoverCleanup = () => {
      document.removeEventListener('click', outsideClickListener);
      document.removeEventListener('keydown', escListener);
      window.removeEventListener('scroll', scrollListener, true);
    };

    setTimeout(() => {
      document.addEventListener('click', outsideClickListener);
      document.addEventListener('keydown', escListener);
      window.addEventListener('scroll', scrollListener, true);
    }, 10);
  },

  hideDeletePopover() {
    const existing = document.getElementById('hrm-emp-delete-popover');
    if (existing) {
      existing.remove();
    }
    if (this._popoverCleanup) {
      this._popoverCleanup();
      this._popoverCleanup = null;
    }
  },

  async confirmDelete(empId, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa...';
    }

    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' });

      const res = await fetch(`/api/employees/${empId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        const emp = appData.empMap[empId];
        const trashEntry = {
          trash_id: json.trash_id || `TRASH-${empId}-${Date.now()}`,
          employee_id: empId,
          full_name: emp ? emp.full_name : empId,
          gender: emp ? emp.gender : '',
          department_id: emp ? emp.department_id : '',
          position_id: emp ? emp.position_id : '',
          job_title: emp ? emp.job_title : '',
          work_email: emp ? emp.work_email : '',
          mobile_phone: emp ? emp.mobile_phone : '',
          deleted_at: new Date().toISOString(),
          deleted_by_name: user?.full_name || 'Huỳnh Thanh Long'
        };
        appData.addDeletedId(empId, trashEntry);

        utils.showToast(json.message || `Đã chuyển nhân sự ${empId} vào Thùng rác`, 'success');
        this.hideDeletePopover();
        await appData.init();
        appDashboard.init();
        if (typeof appTrash !== 'undefined') appTrash.render();
        this.applyFilters();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Không thể xóa nhân viên', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi khi xóa nhân viên: ' + e.message, 'error');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
      }
    }
  },

  async deleteEmployee(empId) {
    this.showDeletePopover(window.event, empId);
  },

  exportFilteredExcel() {
    if (this.filteredList.length === 0) {
      utils.showToast('Không có dữ liệu để xuất', 'error');
      return;
    }

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const salMap = {};
    appData.salaries.forEach(s => salMap[s.employee_id] = s);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    const exportData = this.filteredList.map((e, idx) => ({
      "STT": idx + 1,
      "Mã nhân viên": e.employee_id,
      "Họ và tên": e.full_name,
      "Giới tính": e.gender,
      "Ngày sinh": e.date_of_birth,
      "Vị trí công việc": appData.posMap[e.position_id] || e.position_id,
      "Đơn vị công tác": appData.deptMap[e.department_id] || e.department_id,
      "Quản lý trực tiếp": e.direct_manager_name || '',
      "Tính chất lao động": e.labor_nature,
      "Trạng thái lao động": e.employment_status,
      "Số ĐT di động": contactMap[e.employee_id]?.mobile_phone || '',
      "Email công việc": contactMap[e.employee_id]?.work_email || '',
      "Số CMND/CCCD": idMap[e.employee_id]?.id_number || '',
      "Lương cơ bản": salMap[e.employee_id]?.base_salary || 0,
      "Số TK ngân hàng": salMap[e.employee_id]?.bank_account_number || '',
      "Ngân hàng": salMap[e.employee_id]?.bank_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
    XLSX.writeFile(wb, `Danh_Sach_Nhan_Su_Trung_Hai_${new Date().toISOString().slice(0,10)}.xlsx`);
    utils.showToast('Xuất danh sách nhân sự Excel thành công!', 'success');
  }
};