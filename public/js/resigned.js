// ==========================================================================
// RESIGNED EMPLOYEES MODULE - QUẢN LÝ NHÂN SỰ ĐÃ NGHỈ VIỆC
// ==========================================================================

const appResigned = {
  initialized: false,
  resignedList: [],
  filteredList: [],
  currentPage: 1,
  pageSize: 25,

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.populateFilterDropdowns();
    this.render();
  },

  populateFilterDropdowns() {
    const deptSelect = document.getElementById('resigned-filter-dept');
    if (deptSelect && appData.departments) {
      deptSelect.innerHTML = '<option value="">-- Tất cả Phòng Ban / Đơn vị --</option>' +
        appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
    }

    const posSelect = document.getElementById('resigned-filter-pos');
    if (posSelect && appData.positions) {
      posSelect.innerHTML = '<option value="">-- Tất cả Vị Trí / Chức Danh --</option>' +
        appData.positions.map(p => `<option value="${p.position_id}">${p.position_name}</option>`).join('');
    }
  },

  attachEventListeners() {
    // Search input with debounce / enter
    const searchInput = document.getElementById('resigned-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Filter dropdowns
    const deptFilter = document.getElementById('resigned-filter-dept');
    if (deptFilter) {
      deptFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    const posFilter = document.getElementById('resigned-filter-pos');
    if (posFilter) {
      posFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Reset filters button
    const resetBtn = document.getElementById('btn-reset-resigned-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (deptFilter) deptFilter.value = '';
        if (posFilter) posFilter.value = '';
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Page size dropdown
    const pageSizeSelect = document.getElementById('resigned-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 25;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    }

    // Export Excel Button
    const exportBtn = document.getElementById('btn-export-resigned-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportExcel());
    }
  },

  render() {
    this.populateFilterDropdowns();
    this.applyFilters();
    this.renderKPIs();
  },

  renderKPIs() {
    const totalCompany = appData.employees.length || 1000;
    const allResigned = appData.employees.filter(e => e.employment_status === 'Đã nghỉ việc');
    const resignedCount = allResigned.length;
    const turnoverRate = ((resignedCount / totalCompany) * 100).toFixed(1);

    const totalEl = document.getElementById('kpi-resigned-total');
    if (totalEl) totalEl.textContent = `${resignedCount} người`;

    const rateEl = document.getElementById('kpi-resigned-rate');
    if (rateEl) rateEl.textContent = `${turnoverRate}%`;

    const handoverEl = document.getElementById('kpi-resigned-handover');
    if (handoverEl) handoverEl.textContent = `${resignedCount}/${resignedCount} (100%)`;

    const bhxhEl = document.getElementById('kpi-resigned-bhxh');
    if (bhxhEl) bhxhEl.textContent = `${resignedCount} sổ`;

    const badgeSidebar = document.getElementById('sidebar-resigned-count');
    if (badgeSidebar) badgeSidebar.textContent = resignedCount;
  },

  applyFilters() {
    const searchVal = (document.getElementById('resigned-search-input')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('resigned-filter-dept')?.value || '';
    const posVal = document.getElementById('resigned-filter-pos')?.value || '';

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    this.resignedList = appData.employees.filter(e => e.employment_status === 'Đã nghỉ việc');

    this.filteredList = this.resignedList.filter(e => {
      if (deptVal && e.department_id !== deptVal) return false;
      if (posVal && e.position_id !== posVal) return false;

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

    this.renderTable();
    this.renderPagination();
  },

  calculateSeniority(startDate, endDate) {
    if (!startDate) return '-';
    const start = new Date(startDate);
    const end = (endDate && endDate !== 'Không xác định') ? new Date(endDate) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years > 0 && months > 0) {
      return `${years} năm ${months} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else if (months > 0) {
      return `${months} tháng`;
    } else {
      return '< 1 tháng';
    }
  },

  renderTable() {
    const tbody = document.getElementById('resigned-tbody');
    if (!tbody) return;

    if (this.filteredList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px; color: #94A3B8;"><i class="fa-solid fa-user-check"></i></div>
            <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">Không có nhân sự nào trong danh sách nghỉ việc thỏa mãn điều kiện lọc.</div>
          </td>
        </tr>
      `;
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);

    tbody.innerHTML = paginated.map((e, index) => {
      const stt = start + index + 1;
      const c = contactMap[e.employee_id] || {};
      const resignDate = e.resignation_date || e.end_date || '-';
      const seniority = this.calculateSeniority(e.start_date || e.trial_start_date, resignDate);

      return `
        <tr>
          <td class="col-sticky-stt" style="color: var(--text-muted); font-size: 12px; font-weight: 500;">${stt}</td>
          <td class="col-sticky-id">
            <strong style="color: var(--accent-red); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.employee_id}</strong>
          </td>
          <td class="col-sticky-name">
            <div style="font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.full_name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${c.mobile_phone || '-'}</div>
          </td>
          <td>${e.gender || '-'}</td>
          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${appData.deptMap[e.department_id] || e.department_id}">
            ${appData.deptMap[e.department_id] || e.department_id}
          </td>
          <td>${appData.posMap[e.position_id] || e.position_id || '-'}</td>
          <td>${utils.formatDate(e.start_date || e.trial_start_date)}</td>
          <td><strong style="color: var(--accent-red);">${utils.formatDate(resignDate)}</strong></td>
          <td><span class="badge" style="background: #F1F5F9; color: #334155; font-weight: 600;">${seniority}</span></td>
          <td><span class="badge badge-resigned"><i class="fa-solid fa-ban"></i> Đã nghỉ việc</span></td>
          <td class="col-sticky-action" style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-icon btn-sm" title="Xem Toàn Bộ 8 Tab Hồ Sơ" onclick="appEmployees.openDetailModal('${e.employee_id}')">
                <i class="fa-solid fa-eye" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Chỉnh Sửa Hồ Sơ (34 Cột)" onclick="appEmployees.openEditModal('${e.employee_id}')">
                <i class="fa-solid fa-pen-to-square" style="color: #2563EB;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination() {
    const total = this.filteredList.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    const infoEl = document.getElementById('resigned-pagination-info');
    if (infoEl) {
      infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> nhân sự đã nghỉ việc`;
    }

    const container = document.getElementById('resigned-pagination-controls');
    if (!container) return;

    let html = '';
    html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="appResigned.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="appResigned.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="appResigned.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>`;
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

  exportExcel() {
    if (this.filteredList.length === 0) {
      utils.showToast('Không có nhân sự nghỉ việc để xuất file', 'error');
      return;
    }

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);
    const salMap = {};
    appData.salaries.forEach(s => salMap[s.employee_id] = s);
    const insMap = {};
    appData.insurance.forEach(i => insMap[i.employee_id] = i);

    const exportData = this.filteredList.map((e, idx) => {
      const c = contactMap[e.employee_id] || {};
      const idDoc = idMap[e.employee_id] || {};
      const s = salMap[e.employee_id] || {};
      const ins = insMap[e.employee_id] || {};
      const resignDate = e.resignation_date || e.end_date || '';

      return {
        "STT": idx + 1,
        "Mã nhân viên": e.employee_id,
        "Họ và tên": e.full_name,
        "Giới tính": e.gender || '',
        "Ngày sinh": e.date_of_birth || '',
        "Số CCCD": idDoc.id_number || '',
        "Điện thoại": c.mobile_phone || '',
        "Email": c.work_email || '',
        "Đơn vị công tác trước khi nghỉ": appData.deptMap[e.department_id] || e.department_id,
        "Vị trí chức danh": appData.posMap[e.position_id] || e.position_id,
        "Ngày bắt đầu làm việc": e.start_date || e.trial_start_date || '',
        "Ngày nghỉ việc chính thức": resignDate,
        "Thâm niên công tác": this.calculateSeniority(e.start_date || e.trial_start_date, resignDate),
        "Số sổ BHXH": ins.social_insurance_book_no || '',
        "Mã số thuế": e.tax_code || '',
        "Trạng thái": e.employment_status
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NhanSu_DaNghiViec");
    XLSX.writeFile(wb, `Danh_Sach_Nhan_Su_Nghi_Viec_TrungHai_${new Date().toISOString().split('T')[0]}.xlsx`);
    utils.showToast(`Đã xuất file Excel cho ${this.filteredList.length} nhân sự đã nghỉ việc!`, 'success');
  }
};
