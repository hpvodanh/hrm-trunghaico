// ==========================================================================
// SYSTEM ACTIVITY LOGS MODULE (NHẬT KÝ HOẠT ĐỘNG TOÀN HỆ THỐNG)
// ==========================================================================

const appLogs = {
  initialized: false,
  logs: [],
  filteredLogs: [],
  currentPage: 1,
  pageSize: 20,

  async init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    await this.fetchLogs();
  },

  async fetchLogs() {
    try {
      const res = await fetch('/api/logs');
      const json = await res.json();
      if (json.success) {
        this.logs = json.data || [];
        this.applyFilters();
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  },

  // Record log from client-side
  async recordClientLog(action_type, module, description) {
    try {
      const user = appAuth.currentUser || { employee_id: 'SYSTEM', full_name: 'Hệ thống', role: 'ADMIN' };
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type,
          module,
          description,
          user_id: user.employee_id,
          user_name: user.full_name,
          user_role: user.role
        })
      });
      // Silent background fetch to update if on logs view
      if (document.getElementById('view-logs')?.classList.contains('active')) {
        this.fetchLogs();
      }
    } catch (e) {
      console.error('Record client log error:', e);
    }
  },

  applyFilters() {
    const searchInput = document.getElementById('logs-search-input');
    const actionFilter = document.getElementById('logs-filter-action');
    const moduleFilter = document.getElementById('logs-filter-module');
    const dateFilter = document.getElementById('logs-filter-date');

    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const action = actionFilter ? actionFilter.value : '';
    const mod = moduleFilter ? moduleFilter.value : '';
    const dateRange = dateFilter ? dateFilter.value : '';

    const now = new Date();

    this.filteredLogs = this.logs.filter(log => {
      // 1. Text Search
      const matchText = !q ||
        (log.log_id && log.log_id.toLowerCase().includes(q)) ||
        (log.user_id && log.user_id.toLowerCase().includes(q)) ||
        (log.user_name && log.user_name.toLowerCase().includes(q)) ||
        (log.description && log.description.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q));

      // 2. Action Filter
      const matchAction = !action || log.action_type === action;

      // 3. Module Filter
      const matchModule = !mod || log.module === mod;

      // 4. Date Filter
      let matchDate = true;
      if (dateRange && log.timestamp) {
        const logDate = new Date(log.timestamp);
        if (dateRange === 'today') {
          matchDate = logDate.toDateString() === now.toDateString();
        } else if (dateRange === '7days') {
          const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
          matchDate = diffDays <= 7;
        } else if (dateRange === '30days') {
          const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
          matchDate = diffDays <= 30;
        }
      }

      return matchText && matchAction && matchModule && matchDate;
    });

    this.renderTable();
    this.renderPagination();
    this.updateStats();
  },

  updateStats() {
    const totalEl = document.getElementById('logs-stat-total');
    if (totalEl) totalEl.textContent = this.logs.length;
  },

  renderTable() {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.filteredLogs.slice(start, end);

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
            <i class="fa-solid fa-clipboard-check" style="font-size: 28px; margin-bottom: 8px; display: block; color: var(--border-color);"></i>
            Không tìm thấy bản ghi nhật ký nào phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(l => {
      // Action Badge Formatting
      let actionBadge = '';
      switch (l.action_type) {
        case 'CREATE':
          actionBadge = '<span class="badge badge-active"><i class="fa-solid fa-plus"></i> Thêm mới</span>';
          break;
        case 'UPDATE':
          actionBadge = '<span class="badge badge-probation"><i class="fa-solid fa-pen-to-square"></i> Cập nhật</span>';
          break;
        case 'DELETE':
          actionBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-trash"></i> Xóa dữ liệu</span>';
          break;
        case 'LOGIN':
          actionBadge = '<span class="badge badge-navy"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</span>';
          break;
        case 'LOGIN_FAIL':
          actionBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-triangle-exclamation"></i> Đăng nhập sai</span>';
          break;
        case 'LOGOUT':
          actionBadge = '<span class="badge" style="background: #E2E8F0; color: #475569;"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</span>';
          break;
        case 'PASSWORD':
          actionBadge = '<span class="badge" style="background: #FEF3C7; color: #D97706;"><i class="fa-solid fa-key"></i> Đổi mật khẩu</span>';
          break;
        case 'EXPORT':
          actionBadge = '<span class="badge badge-active"><i class="fa-solid fa-file-excel"></i> Xuất Excel</span>';
          break;
        default:
          actionBadge = `<span class="badge badge-navy">${l.action_type || 'INFO'}</span>`;
      }

      // User role badge
      const roleBadge = l.user_role === 'ADMIN' ? 'badge-red' : 'badge-navy';
      const roleText = l.user_role === 'ADMIN' ? 'Admin' : 'Nhân sự';

      // Format Timestamp
      const formattedTime = utils.formatDateTime ? utils.formatDateTime(l.timestamp) : (l.timestamp ? new Date(l.timestamp).toLocaleString('vi-VN') : '');

      return `
        <tr>
          <td style="white-space: nowrap; font-family: monospace; font-size: 11.5px; color: var(--text-secondary);">
            <i class="fa-regular fa-clock" style="margin-right: 4px; color: var(--text-muted);"></i>${formattedTime}
          </td>
          <td>
            <strong style="color: var(--text-primary); font-size: 12.5px;">${l.user_name || 'Hệ thống'}</strong>
            <span class="badge badge-navy" style="font-size: 10px; margin-left: 4px;">${l.user_id || ''}</span>
          </td>
          <td><span class="badge ${roleBadge}" style="font-size: 11px;">${roleText}</span></td>
          <td>
            <span class="badge" style="background: #F1F5F9; color: var(--primary-navy); font-weight: 600;">
              ${l.module || 'Hệ thống'}
            </span>
          </td>
          <td>${actionBadge}</td>
          <td style="font-size: 12px; line-height: 1.4; color: var(--text-primary);">
            ${l.description || ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination() {
    const container = document.getElementById('logs-pagination');
    if (!container) return;

    const total = this.filteredLogs.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    container.innerHTML = `
      <span>Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> hoạt động</span>
      <div class="pagination-controls">
        <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appLogs.goToPage(1)"><i class="fa-solid fa-angles-left"></i></button>
        <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appLogs.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>
        <span style="padding: 0 8px; font-weight: 600;">Trang ${this.currentPage} / ${totalPages}</span>
        <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appLogs.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>
        <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appLogs.goToPage(${totalPages})"><i class="fa-solid fa-angles-right"></i></button>
      </div>
    `;
  },

  goToPage(page) {
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  },

  exportLogsToExcel() {
    if (!this.logs || this.logs.length === 0) {
      utils.showToast('Không có dữ liệu nhật ký để xuất', 'warning');
      return;
    }

    const exportData = this.logs.map((l, idx) => ({
      'STT': idx + 1,
      'Mã Nhật Ký': l.log_id,
      'Thời Gian': l.timestamp,
      'Mã Nhân Viên': l.user_id,
      'Người Thực Hiện': l.user_name,
      'Vai Trò': l.user_role,
      'Phân Hệ': l.module,
      'Hành Động': l.action_type,
      'Chi Tiết Thao Tác': l.description
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhat_Ky_Hoat_Dong');
    XLSX.writeFile(wb, `Nhat_Ky_Hoat_Dong_HRM_${new Date().toISOString().slice(0, 10)}.xlsx`);

    utils.showToast('Đã xuất file Excel nhật ký thành công!', 'success');
  },

  async clearAllLogs() {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký hoạt động không?')) {
      return;
    }

    try {
      const user = appAuth.currentUser || {};
      const res = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.employee_id,
          user_name: user.full_name
        })
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast('Đã làm trống toàn bộ nhật ký', 'success');
        await this.fetchLogs();
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi khi xóa nhật ký', 'error');
    }
  },

  attachEventListeners() {
    const searchInput = document.getElementById('logs-search-input');
    const actionFilter = document.getElementById('logs-filter-action');
    const moduleFilter = document.getElementById('logs-filter-module');
    const dateFilter = document.getElementById('logs-filter-date');
    const btnRefresh = document.getElementById('btn-refresh-logs');
    const btnExport = document.getElementById('btn-export-logs');
    const btnClear = document.getElementById('btn-clear-logs');

    if (searchInput) searchInput.addEventListener('input', () => { this.currentPage = 1; this.applyFilters(); });
    if (actionFilter) actionFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });
    if (moduleFilter) moduleFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });
    if (dateFilter) dateFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });

    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        await this.fetchLogs();
        utils.showToast('Đã làm mới nhật ký hoạt động', 'info');
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportLogsToExcel());
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearAllLogs());
    }
  }
};
