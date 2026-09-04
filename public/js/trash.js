/**
 * TRUNG HẢI HRM - RECYCLE BIN (THÙNG RÁC) MODULE
 */
const appTrash = {
  initialized: false,
  trashList: [],
  filteredList: [],
  selectedIds: new Set(),
  currentPage: 1,
  pageSize: 25,
  selectedDateFilter: '',

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.populateFilterDropdowns();
    this.render();
  },

  populateFilterDropdowns() {
    const deptSelect = document.getElementById('trash-filter-dept');
    if (deptSelect && appData.departments) {
      deptSelect.innerHTML = '<option value="">-- Tất cả Phòng Ban / Đơn vị --</option>' +
        appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
    }
    const dateSelect = document.getElementById('trash-filter-date');
    if (dateSelect) {
      dateSelect.value = this.selectedDateFilter || '';
    }
  },

  parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    if (typeof dateStr === 'number') {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    
    if (typeof dateStr === 'string') {
      const trimmed = dateStr.trim();
      // Try standard parse first
      let d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
      
      // Try DD/MM/YYYY or DD-MM-YYYY (with optional HH:mm:ss)
      const parts = trimmed.split(/[\sT]+/);
      const dateParts = parts[0].split(/[/-]/);
      if (dateParts.length === 3) {
        let day, month, year;
        if (dateParts[0].length === 4) {
          // YYYY-MM-DD
          year = parseInt(dateParts[0], 10);
          month = parseInt(dateParts[1], 10) - 1;
          day = parseInt(dateParts[2], 10);
        } else {
          // DD/MM/YYYY
          day = parseInt(dateParts[0], 10);
          month = parseInt(dateParts[1], 10) - 1;
          year = parseInt(dateParts[2], 10);
        }
        let hours = 0, minutes = 0, seconds = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          hours = parseInt(timeParts[0], 10) || 0;
          minutes = parseInt(timeParts[1], 10) || 0;
          seconds = parseInt(timeParts[2], 10) || 0;
        }
        d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  },

  getPurgedTrashIds() {
    try {
      return JSON.parse(localStorage.getItem('hrm_purged_trash_ids') || '[]');
    } catch (e) {
      return [];
    }
  },

  addPurgedTrashId(empId) {
    try {
      const ids = this.getPurgedTrashIds();
      if (!ids.includes(empId)) {
        ids.push(empId);
        localStorage.setItem('hrm_purged_trash_ids', JSON.stringify(ids));
      }
    } catch (e) {}
  },

  removePurgedTrashId(empId) {
    try {
      let ids = this.getPurgedTrashIds();
      ids = ids.filter(id => id !== empId);
      localStorage.setItem('hrm_purged_trash_ids', JSON.stringify(ids));
    } catch (e) {}
  },

  attachEventListeners() {
    // Search input
    const searchInput = document.getElementById('trash-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Filter dropdown dept
    const deptFilter = document.getElementById('trash-filter-dept');
    if (deptFilter) {
      deptFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Filter dropdown date
    const dateFilter = document.getElementById('trash-filter-date');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.selectedDateFilter = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Reset filters button
    const resetBtn = document.getElementById('btn-reset-trash-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetFilters();
      });
    }

    // Page size dropdown
    const pageSizeSelect = document.getElementById('trash-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 25;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    }

    // Select All Checkbox
    const selectAllCheck = document.getElementById('trash-select-all');
    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const currentItems = this.getCurrentPageItems();
        if (isChecked) {
          currentItems.forEach(item => this.selectedIds.add(item.employee_id));
        } else {
          currentItems.forEach(item => this.selectedIds.delete(item.employee_id));
        }
        this.renderTable();
        this.updateBulkActionBar();
      });
    }

    // Bulk Restore Button
    const bulkRestoreBtn = document.getElementById('btn-trash-bulk-restore');
    if (bulkRestoreBtn) {
      bulkRestoreBtn.addEventListener('click', () => this.bulkRestore());
    }

    // Bulk Permanent Delete Button
    const bulkPurgeBtn = document.getElementById('btn-trash-bulk-purge');
    if (bulkPurgeBtn) {
      bulkPurgeBtn.addEventListener('click', () => this.bulkPurge());
    }

    // Empty Trash Button
    const emptyTrashBtn = document.getElementById('btn-trash-empty-all');
    if (emptyTrashBtn) {
      emptyTrashBtn.addEventListener('click', () => this.emptyTrash());
    }
  },

  async fetchTrashData() {
    let serverTrash = [];
    try {
      const res = await fetch('/api/trash');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        serverTrash = json.data;
      }
    } catch (e) {
      console.error('Error fetching trash data:', e);
    }

    const trashMap = new Map();
    // 1. Initial memory data
    (appData.trash || []).forEach(item => {
      if (item && item.employee_id) trashMap.set(item.employee_id, item);
    });
    // 2. Server response
    serverTrash.forEach(item => {
      if (item && item.employee_id) trashMap.set(item.employee_id, item);
    });
    // 3. LocalStorage
    const localTrash = (appData && typeof appData.getLocalTrash === 'function') ? appData.getLocalTrash() : [];
    localTrash.forEach(item => {
      if (item && item.employee_id) {
        const existing = trashMap.get(item.employee_id);
        trashMap.set(item.employee_id, { ...existing, ...item });
      }
    });

    const purgedIds = this.getPurgedTrashIds();
    this.trashList = Array.from(trashMap.values()).filter(item => !purgedIds.includes(item.employee_id));
    appData.trash = this.trashList;
  },

  async render() {
    await this.fetchTrashData();
    this.populateFilterDropdowns();
    this.applyFilters();
    this.updateBadgeCount();
  },

  updateBadgeCount() {
    const badge = document.getElementById('sidebar-trash-count');
    if (badge) {
      const count = (this.trashList || []).length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  // Toggle filter for items deleted in the last 7 days
  toggleRecentFilter() {
    if (this.selectedDateFilter === '7days') {
      this.selectedDateFilter = '';
      const dateSelect = document.getElementById('trash-filter-date');
      if (dateSelect) dateSelect.value = '';
      utils.showToast('Đã hiển thị toàn bộ nhân sự trong Thùng rác', 'info');
    } else {
      this.selectedDateFilter = '7days';
      const dateSelect = document.getElementById('trash-filter-date');
      if (dateSelect) dateSelect.value = '7days';
      utils.showToast('Đang lọc các mục đã xóa trong 7 ngày qua', 'info');
    }
    this.currentPage = 1;
    this.applyFilters();
  },

  filterByDate(val) {
    this.selectedDateFilter = val || '';
    const dateSelect = document.getElementById('trash-filter-date');
    if (dateSelect) dateSelect.value = this.selectedDateFilter;
    this.currentPage = 1;
    this.applyFilters();
    if (!val) {
      utils.showToast('Đã hiển thị toàn bộ nhân sự trong Thùng rác', 'info');
    }
  },

  resetFilters() {
    const searchInput = document.getElementById('trash-search-input');
    const deptFilter = document.getElementById('trash-filter-dept');
    const dateFilter = document.getElementById('trash-filter-date');

    if (searchInput) searchInput.value = '';
    if (deptFilter) deptFilter.value = '';
    if (dateFilter) dateFilter.value = '';

    this.selectedDateFilter = '';
    this.currentPage = 1;
    this.selectedIds.clear();

    const recentCard = document.getElementById('kpi-card-trash-recent');
    if (recentCard) recentCard.classList.remove('active-filter');

    this.applyFilters();
    utils.showToast('Đã đặt lại tất cả bộ lọc thùng rác', 'info');
  },

  applyFilters() {
    const searchVal = (document.getElementById('trash-search-input')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('trash-filter-dept')?.value || '';
    const dateVal = document.getElementById('trash-filter-date')?.value || this.selectedDateFilter || '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0);

    this.filteredList = (this.trashList || []).filter(item => {
      // Search match
      if (searchVal) {
        const matchName = (item.full_name || '').toLowerCase().includes(searchVal);
        const matchId = (item.employee_id || '').toLowerCase().includes(searchVal);
        const matchDept = (item.department_name || '').toLowerCase().includes(searchVal);
        const matchPos = (item.position_name || item.job_title || '').toLowerCase().includes(searchVal);
        const matchEmail = (item.work_email || '').toLowerCase().includes(searchVal);
        const matchPhone = (item.mobile_phone || '').includes(searchVal);
        if (!matchName && !matchId && !matchDept && !matchPos && !matchEmail && !matchPhone) {
          return false;
        }
      }

      // Dept match
      if (deptVal && item.department_id !== deptVal) {
        return false;
      }

      // Date match
      if (dateVal) {
        const itemDate = this.parseDate(item.deleted_at);
        if (!itemDate) return false;
        if (dateVal === 'today' && itemDate < startOfToday) return false;
        if (dateVal === '7days' && itemDate < sevenDaysAgo) return false;
        if (dateVal === '30days' && itemDate < thirtyDaysAgo) return false;
      }

      return true;
    });

    this.renderKPIs();
    this.renderTable();
    this.renderPagination();
    this.updateBulkActionBar();
    this.updateBadgeCount();
  },

  renderKPIs() {
    const total = this.trashList.length;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);

    const recentDeleted = this.trashList.filter(item => {
      const d = this.parseDate(item.deleted_at);
      return d && d >= sevenDaysAgo;
    }).length;

    // Dept with most deleted
    const deptCounts = {};
    this.trashList.forEach(item => {
      const dName = item.department_name || item.department_id || 'Chưa phân bổ';
      deptCounts[dName] = (deptCounts[dName] || 0) + 1;
    });

    let topDept = 'Không có';
    let maxDeptCount = 0;
    for (const [dept, count] of Object.entries(deptCounts)) {
      if (count > maxDeptCount) {
        maxDeptCount = count;
        topDept = dept;
      }
    }

    const totalEl = document.getElementById('kpi-trash-total');
    if (totalEl) totalEl.textContent = total;

    const recentEl = document.getElementById('kpi-trash-recent');
    if (recentEl) recentEl.textContent = recentDeleted;

    const topDeptEl = document.getElementById('kpi-trash-top-dept');
    if (topDeptEl) topDeptEl.textContent = total > 0 ? `${topDept} (${maxDeptCount})` : '-';

    // Update active visual indicator on KPI card
    const recentCard = document.getElementById('kpi-card-trash-recent');
    if (recentCard) {
      if (this.selectedDateFilter === '7days') {
        recentCard.classList.add('active-filter');
      } else {
        recentCard.classList.remove('active-filter');
      }
    }
  },

  getCurrentPageItems() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredList.slice(start, start + this.pageSize);
  },

  renderTable() {
    const tbody = document.getElementById('trash-table-body');
    if (!tbody) return;

    const items = this.getCurrentPageItems();

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
              <i class="fa-solid fa-trash-can" style="font-size: 36px; color: #CBD5E1;"></i>
              <span style="font-size: 13.5px; font-weight: 500;">Thùng rác hiện đang trống</span>
              <small style="color: var(--text-muted); font-size: 11.5px;">Các nhân sự bị xóa sẽ được lưu giữ tại đây để bạn có thể khôi phục hoặc xóa vĩnh viễn.</small>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isChecked = this.selectedIds.has(item.employee_id);
      const deletedDate = utils.formatDate(item.deleted_at);
      const genderBadge = item.gender === 'Nam'
        ? '<span class="badge" style="background:#EFF6FF; color:#1D4ED8;"><i class="fa-solid fa-mars"></i> Nam</span>'
        : item.gender === 'Nữ'
        ? '<span class="badge" style="background:#FDF2F8; color:#BE185D;"><i class="fa-solid fa-venus"></i> Nữ</span>'
        : '-';

      return `
        <tr class="${isChecked ? 'row-selected' : ''}">
          <td style="text-align: center; width: 36px;">
            <input type="checkbox" class="trash-row-checkbox" value="${item.employee_id}" ${isChecked ? 'checked' : ''} onchange="appTrash.toggleRowSelect('${item.employee_id}', this.checked)">
          </td>
          <td style="font-weight: 700; font-family: monospace; color: var(--accent-red);">${item.employee_id}</td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 12.5px;">${item.full_name}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${item.work_email || item.mobile_phone || '-'}</div>
          </td>
          <td>${genderBadge}</td>
          <td>
            <div style="font-weight: 500;">${item.department_name || item.department_id || '-'}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${item.position_name || item.job_title || '-'}</div>
          </td>
          <td style="font-size: 12px; color: var(--text-secondary);">
            <i class="fa-regular fa-clock" style="margin-right: 4px; font-size: 11px;"></i>${deletedDate}
          </td>
          <td>
            <span class="badge" style="background: #F1F5F9; color: var(--text-secondary); font-size: 11px;">
              ${item.deleted_by_name || 'Hệ thống'}
            </span>
          </td>
          <td class="col-sticky-action">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button class="btn btn-sm btn-secondary" title="Khôi phục nhân sự" onclick="appTrash.showRestorePopover(event, '${item.employee_id}')" style="color: #059669; border-color: #A7F3D0; background: #ECFDF5; height: 28px; padding: 0 10px;">
                <i class="fa-solid fa-rotate-left"></i> <span>Khôi phục</span>
              </button>
              <button class="btn btn-sm btn-secondary" title="Xóa vĩnh viễn" onclick="appTrash.showPurgePopover(event, '${item.employee_id}')" style="color: var(--accent-red); border-color: #FECACA; background: #FEF2F2; height: 28px; padding: 0 8px;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Update select-all checkbox state
    const selectAllCheck = document.getElementById('trash-select-all');
    if (selectAllCheck) {
      const allCurrentSelected = items.length > 0 && items.every(i => this.selectedIds.has(i.employee_id));
      selectAllCheck.checked = allCurrentSelected;
    }
  },

  toggleRowSelect(empId, isChecked) {
    if (isChecked) {
      this.selectedIds.add(empId);
    } else {
      this.selectedIds.delete(empId);
    }
    this.renderTable();
    this.updateBulkActionBar();
  },

  updateBulkActionBar() {
    const bar = document.getElementById('trash-bulk-actions-bar');
    const countEl = document.getElementById('trash-selected-count');
    const emptyBtn = document.getElementById('btn-trash-empty-all');

    if (emptyBtn) {
      emptyBtn.disabled = this.trashList.length === 0;
    }

    if (bar && countEl) {
      const count = this.selectedIds.size;
      countEl.textContent = count;
      if (count > 0) {
        bar.style.display = 'flex';
      } else {
        bar.style.display = 'none';
      }
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

    const infoEl = document.getElementById('trash-pagination-info');
    if (infoEl) {
      infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> nhân sự trong thùng rác`;
    }

    const pagesContainer = document.getElementById('trash-pagination-pages');
    if (!pagesContainer) return;

    let html = '';
    html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="appTrash.changePage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-angle-left"></i></button>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="page-btn ${p === this.currentPage ? 'active' : ''}" onclick="appTrash.changePage(${p})">${p}</button>`;
    }

    html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="appTrash.changePage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-angle-right"></i></button>`;
    pagesContainer.innerHTML = html;
  },

  changePage(newPage) {
    const totalPages = Math.ceil(this.filteredList.length / this.pageSize) || 1;
    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage;
      this.renderTable();
      this.renderPagination();
    }
  },

  // POPOVER: RESTORE EMPLOYEE
  showRestorePopover(event, empId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.hidePopover();

    const item = (this.trashList || []).find(t => t.employee_id === empId);
    const name = item ? item.full_name : empId;
    const triggerBtn = event.currentTarget || event.target.closest('button');

    const popover = document.createElement('div');
    popover.id = 'hrm-trash-popover';
    popover.className = 'hrm-delete-popover';
    popover.innerHTML = `
      <div class="hrm-popover-header" style="color: #059669;">
        <i class="fa-solid fa-rotate-left" style="font-size: 13px;"></i>
        <span>Khôi phục nhân sự</span>
      </div>
      <div class="hrm-popover-body">
        Khôi phục nhân viên <strong style="color: var(--primary-navy);">${name}</strong> (<span style="color: var(--primary-navy); font-weight: 600;">${empId}</span>) về danh sách hoạt động?
      </div>
      <div class="hrm-popover-actions">
        <button type="button" class="btn btn-secondary" onclick="appTrash.hidePopover()">Hủy</button>
        <button type="button" class="btn btn-primary" id="btn-popover-confirm-restore-${empId}" style="background: #059669; border-color: #059669;">
          <i class="fa-solid fa-rotate-left"></i> Khôi phục
        </button>
      </div>
      <div class="hrm-popover-arrow"></div>
    `;

    document.body.appendChild(popover);
    this.positionPopover(popover, triggerBtn);

    const confirmBtn = document.getElementById(`btn-popover-confirm-restore-${empId}`);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restoreEmployee(empId, confirmBtn);
      });
    }

    this.attachPopoverDismiss(popover, triggerBtn);
  },

  // POPOVER: PERMANENT DELETE EMPLOYEE
  showPurgePopover(event, empId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.hidePopover();

    const item = (this.trashList || []).find(t => t.employee_id === empId);
    const name = item ? item.full_name : empId;
    const triggerBtn = event.currentTarget || event.target.closest('button');

    const popover = document.createElement('div');
    popover.id = 'hrm-trash-popover';
    popover.className = 'hrm-delete-popover';
    popover.innerHTML = `
      <div class="hrm-popover-header" style="color: var(--accent-red);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 13px;"></i>
        <span>Xóa vĩnh viễn</span>
      </div>
      <div class="hrm-popover-body">
        Hành động này sẽ <strong>xóa vĩnh viễn</strong> <strong style="color: var(--primary-navy);">${name}</strong> (<span style="color: var(--accent-red); font-weight: 600;">${empId}</span>) và <u>không thể khôi phục</u> lại. Bạn chắc chắn chứ?
      </div>
      <div class="hrm-popover-actions">
        <button type="button" class="btn btn-secondary" onclick="appTrash.hidePopover()">Hủy</button>
        <button type="button" class="btn btn-accent" id="btn-popover-confirm-purge-${empId}">
          <i class="fa-solid fa-trash-can"></i> Xóa vĩnh viễn
        </button>
      </div>
      <div class="hrm-popover-arrow"></div>
    `;

    document.body.appendChild(popover);
    this.positionPopover(popover, triggerBtn);

    const confirmBtn = document.getElementById(`btn-popover-confirm-purge-${empId}`);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.purgeEmployee(empId, confirmBtn);
      });
    }

    this.attachPopoverDismiss(popover, triggerBtn);
  },

  positionPopover(popover, triggerBtn) {
    if (!triggerBtn) return;
    const rect = triggerBtn.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = popover.offsetHeight || 140;

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
  },

  attachPopoverDismiss(popover, triggerBtn) {
    const outsideClickListener = (e) => {
      if (!popover.contains(e.target) && triggerBtn && !triggerBtn.contains(e.target)) {
        this.hidePopover();
      }
    };
    const escListener = (e) => {
      if (e.key === 'Escape') {
        this.hidePopover();
      }
    };
    const scrollListener = () => {
      this.hidePopover();
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

  hidePopover() {
    const existing = document.getElementById('hrm-trash-popover');
    if (existing) existing.remove();
    if (this._popoverCleanup) {
      this._popoverCleanup();
      this._popoverCleanup = null;
    }
  },

  getOperatorUser() {
    if (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function') {
      return appAuth.getCurrentUser();
    }
    if (typeof appAuth !== 'undefined' && appAuth?.currentUser) {
      return appAuth.currentUser;
    }
    return { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' };
  },

  async restoreEmployee(empId, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang khôi phục...';
    }

    try {
      const user = this.getOperatorUser();
      const res = await fetch(`/api/trash/restore/${empId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        this.removePurgedTrashId(empId);
        if (appData.removeDeletedId) appData.removeDeletedId(empId);
        utils.showToast(json.message || `Đã khôi phục thành công ${empId}`, 'success');
        this.hidePopover();
        this.selectedIds.delete(empId);
        await appData.init();
        appDashboard.init();
        if (typeof appEmployees !== 'undefined') appEmployees.applyFilters();
        await this.render();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Không thể khôi phục nhân sự', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Khôi phục';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi khi khôi phục nhân sự: ' + e.message, 'error');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Khôi phục';
      }
    }
  },

  async purgeEmployee(empId, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa...';
    }

    try {
      const user = this.getOperatorUser();
      const res = await fetch(`/api/trash/permanent/${empId}`, {
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
        this.addPurgedTrashId(empId);
        if (appData.purgeDeletedId) appData.purgeDeletedId(empId);
        utils.showToast(json.message || `Đã xóa vĩnh viễn ${empId}`, 'success');
        this.hidePopover();
        this.selectedIds.delete(empId);
        await appData.init();
        await this.render();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Không thể xóa nhân sự', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa vĩnh viễn';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi khi xóa nhân sự: ' + e.message, 'error');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa vĩnh viễn';
      }
    }
  },

  async bulkRestore() {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn khôi phục ${ids.length} nhân sự đã chọn?`)) {
      return;
    }

    try {
      const user = this.getOperatorUser();
      const res = await fetch('/api/trash/restore-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_ids: ids,
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        ids.forEach(id => this.removePurgedTrashId(id));
        if (appData.removeDeletedId) ids.forEach(id => appData.removeDeletedId(id));
        utils.showToast(json.message || `Đã khôi phục thành công ${ids.length} nhân sự`, 'success');
        this.selectedIds.clear();
        await appData.init();
        appDashboard.init();
        if (typeof appEmployees !== 'undefined') appEmployees.applyFilters();
        await this.render();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Lỗi khôi phục hàng loạt', 'error');
      }
    } catch (e) {
      utils.showToast('Lỗi khi khôi phục: ' + e.message, 'error');
    }
  },

  async bulkPurge() {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${ids.length} nhân sự đã chọn? Dữ liệu sẽ không thể khôi phục lại!`)) {
      return;
    }

    try {
      const user = this.getOperatorUser();
      const res = await fetch('/api/trash/permanent-bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_ids: ids,
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        ids.forEach(id => this.addPurgedTrashId(id));
        if (appData.purgeDeletedId) ids.forEach(id => appData.purgeDeletedId(id));
        utils.showToast(json.message || `Đã xóa vĩnh viễn ${ids.length} nhân sự`, 'success');
        this.selectedIds.clear();
        await appData.init();
        await this.render();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Lỗi xóa vĩnh viễn', 'error');
      }
    } catch (e) {
      utils.showToast('Lỗi khi xóa: ' + e.message, 'error');
    }
  },

  async emptyTrash() {
    if (this.trashList.length === 0) return;

    if (!confirm(`⚠️ CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn DỌN SẠCH TOÀN BỘ Thùng rác (${this.trashList.length} nhân sự)? Toàn bộ dữ liệu này sẽ bị xóa vĩnh viễn và không thể khôi phục!`)) {
      return;
    }

    try {
      const user = this.getOperatorUser();
      const res = await fetch('/api/trash/empty', {
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
        (this.trashList || []).forEach(item => this.addPurgedTrashId(item.employee_id));
        if (appData.purgeDeletedId) (this.trashList || []).forEach(item => appData.purgeDeletedId(item.employee_id));
        if (appData.clearLocalTrash) appData.clearLocalTrash();
        utils.showToast(json.message || 'Đã dọn sạch toàn bộ Thùng rác', 'success');
        this.selectedIds.clear();
        await appData.init();
        await this.render();
        if (typeof appSheets !== 'undefined' && typeof appSheets.autoSync === 'function') {
          appSheets.autoSync();
        }
      } else {
        utils.showToast(json.message || 'Lỗi khi dọn thùng rác', 'error');
      }
    } catch (e) {
      utils.showToast('Lỗi khi dọn thùng rác: ' + e.message, 'error');
    }
  }
};
