// ==========================================================================
// WORKFORCE DYNAMICS & HEADCOUNT REPORT MODULE (BÁO CÁO BIẾN ĐỘNG NHÂN SỰ)
// ==========================================================================

const appReports = {
  initialized: false,
  fluctuationList: [],
  filteredList: [],
  currentPage: 1,
  pageSize: 20,
  monthlyChart: null,
  deptChart: null,

  init() {
    this.populateDeptDropdown();
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.render();
  },

  populateDeptDropdown() {
    const deptSelect = document.getElementById('report-filter-dept');
    if (deptSelect && appData.departments) {
      deptSelect.innerHTML = '<option value="">-- Tất cả Phòng Ban --</option>' +
        appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
    }
  },

  attachEventListeners() {
    // Period filter change
    const periodSelect = document.getElementById('report-filter-period');
    const customGroup = document.getElementById('report-custom-date-group');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        if (customGroup) {
          customGroup.style.display = e.target.value === 'custom' ? 'inline-flex' : 'none';
        }
        this.currentPage = 1;
        this.render();
      });
    }

    // Custom date inputs
    const dateFrom = document.getElementById('report-date-from');
    const dateTo = document.getElementById('report-date-to');
    if (dateFrom) dateFrom.addEventListener('change', () => { this.currentPage = 1; this.render(); });
    if (dateTo) dateTo.addEventListener('change', () => { this.currentPage = 1; this.render(); });

    // Department filter
    const deptSelect = document.getElementById('report-filter-dept');
    if (deptSelect) deptSelect.addEventListener('change', () => { this.currentPage = 1; this.render(); });

    // Movement type filter
    const typeSelect = document.getElementById('report-filter-type');
    if (typeSelect) typeSelect.addEventListener('change', () => { this.currentPage = 1; this.render(); });

    // Search input
    const searchInput = document.getElementById('report-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyTableFilter();
      });
    }

    // Reset button
    const resetBtn = document.getElementById('btn-reset-report-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (periodSelect) periodSelect.value = 'this_year';
        if (customGroup) customGroup.style.display = 'none';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (deptSelect) deptSelect.value = '';
        if (typeSelect) typeSelect.value = 'ALL';
        if (searchInput) searchInput.value = '';
        this.currentPage = 1;
        this.render();
      });
    }

    // Page size dropdown
    const pageSizeSelect = document.getElementById('report-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 20;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    }

    // Export Excel Button
    const exportBtn = document.getElementById('btn-export-report-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportExcel());
    }
  },

  // Calculate Date Range based on Period Filter
  getDateRange() {
    const period = document.getElementById('report-filter-period')?.value || 'this_year';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    let startDate = null;
    let endDate = null;

    if (period === 'this_month') {
      startDate = new Date(currentYear, currentMonth, 1);
      endDate = new Date(currentYear, currentMonth + 1, 0);
    } else if (period === 'last_month') {
      startDate = new Date(currentYear, currentMonth - 1, 1);
      endDate = new Date(currentYear, currentMonth, 0);
    } else if (period === 'this_quarter') {
      const q = Math.floor(currentMonth / 3);
      startDate = new Date(currentYear, q * 3, 1);
      endDate = new Date(currentYear, (q + 1) * 3, 0);
    } else if (period === 'this_year') {
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31);
    } else if (period === 'last_year') {
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear - 1, 11, 31);
    } else if (period === 'custom') {
      const fromVal = document.getElementById('report-date-from')?.value;
      const toVal = document.getElementById('report-date-to')?.value;
      if (fromVal) startDate = new Date(fromVal);
      if (toVal) endDate = new Date(toVal);
    }

    return { startDate, endDate, period };
  },

  // Compute Fluctuation Dataset (New Hires vs Resignations)
  computeFluctuations() {
    const { startDate, endDate } = this.getDateRange();
    const deptFilter = document.getElementById('report-filter-dept')?.value || '';
    const typeFilter = document.getElementById('report-filter-type')?.value || 'ALL';

    const employees = appData.employees || [];
    const list = [];

    employees.forEach(emp => {
      // Check department filter
      if (deptFilter && emp.department_id !== deptFilter) return;

      const isResigned = emp.employment_status === 'Đã nghỉ việc' || emp.employment_status === 'Nghỉ việc';
      
      // Determine effective date
      let joinDate = null;
      if (emp.join_date) joinDate = new Date(emp.join_date);
      else if (emp.probation_start_date) joinDate = new Date(emp.probation_start_date);

      // Resignation date (from contract or fallback joinDate + 1 year)
      let resignDate = null;
      if (isResigned) {
        if (emp.resigned_date) resignDate = new Date(emp.resigned_date);
        else if (emp.contract_end_date) resignDate = new Date(emp.contract_end_date);
        else if (joinDate) {
          resignDate = new Date(joinDate);
          resignDate.setMonth(resignDate.getMonth() + 6);
        } else {
          resignDate = new Date();
        }
      }

      // Check New Hire within Range
      if (typeFilter !== 'RESIGNED' && joinDate && (!startDate || joinDate >= startDate) && (!endDate || joinDate <= endDate)) {
        list.push({
          type: 'NEW',
          type_label: 'Tuyển Mới',
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          gender: emp.gender || 'Nam',
          department_id: emp.department_id,
          department_name: appData.deptMap[emp.department_id] || emp.department_name || emp.department_id,
          position_name: appData.posMap[emp.position_id] || emp.job_title || emp.position_id,
          effective_date: joinDate.toISOString().slice(0, 10),
          status: emp.employment_status || 'Chính thức',
          color: 'green'
        });
      }

      // Check Resignation within Range
      if (typeFilter !== 'NEW' && isResigned && resignDate && (!startDate || resignDate >= startDate) && (!endDate || resignDate <= endDate)) {
        list.push({
          type: 'RESIGNED',
          type_label: 'Nghỉ Việc',
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          gender: emp.gender || 'Nam',
          department_id: emp.department_id,
          department_name: appData.deptMap[emp.department_id] || emp.department_name || emp.department_id,
          position_name: appData.posMap[emp.position_id] || emp.job_title || emp.position_id,
          effective_date: resignDate.toISOString().slice(0, 10),
          status: 'Đã chấm dứt HĐ',
          color: 'red'
        });
      }
    });

    // Sort by effective date descending
    list.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    this.fluctuationList = list;
  },

  render() {
    this.computeFluctuations();
    this.renderKPIs();
    this.renderCharts();
    this.applyTableFilter();
  },

  renderKPIs() {
    const totalActive = (appData.employees || []).filter(e => e.employment_status !== 'Đã nghỉ việc').length;
    const newCount = this.fluctuationList.filter(f => f.type === 'NEW').length;
    const resignedCount = this.fluctuationList.filter(f => f.type === 'RESIGNED').length;
    const netGrowth = newCount - resignedCount;
    const turnoverRate = totalActive > 0 ? ((resignedCount / totalActive) * 100).toFixed(1) : '0.0';

    const totalEl = document.getElementById('kpi-report-total');
    if (totalEl) totalEl.textContent = `${totalActive} người`;

    const newEl = document.getElementById('kpi-report-new');
    if (newEl) newEl.textContent = `+${newCount} người`;

    const resignedEl = document.getElementById('kpi-report-resigned');
    if (resignedEl) resignedEl.textContent = `-${resignedCount} người`;

    const netEl = document.getElementById('kpi-report-net');
    if (netEl) {
      netEl.textContent = netGrowth >= 0 ? `+${netGrowth} người` : `${netGrowth} người`;
      netEl.style.color = netGrowth >= 0 ? '#059669' : '#DC2626';
    }

    const rateEl = document.getElementById('kpi-report-rate');
    if (rateEl) {
      rateEl.innerHTML = `<i class="fa-solid fa-chart-line"></i> Biến động nghỉ việc: <strong>${turnoverRate}%</strong>`;
    }
  },

  applyTableFilter() {
    const searchVal = (document.getElementById('report-search-input')?.value || '').toLowerCase().trim();

    this.filteredList = this.fluctuationList.filter(item => {
      if (!searchVal) return true;
      return (
        item.employee_id.toLowerCase().includes(searchVal) ||
        item.full_name.toLowerCase().includes(searchVal) ||
        item.department_name.toLowerCase().includes(searchVal) ||
        item.position_name.toLowerCase().includes(searchVal)
      );
    });

    const badge = document.getElementById('report-table-summary-badge');
    if (badge) badge.textContent = `${this.filteredList.length} bản ghi biến động`;

    this.renderTable();
    this.renderPagination();
  },

  renderTable() {
    const tbody = document.getElementById('report-tbody');
    if (!tbody) return;

    if (this.filteredList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 10px; color: #CBD5E1; display: block;"></i>
            <span>Không tìm thấy bản ghi biến động nhân sự nào trong khoảng thời gian đã chọn</span>
          </td>
        </tr>
      `;
      return;
    }

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const pageItems = this.filteredList.slice(startIdx, endIdx);

    tbody.innerHTML = pageItems.map((item, idx) => {
      const isNew = item.type === 'NEW';
      const typeBadge = isNew
        ? '<span class="badge badge-green"><i class="fa-solid fa-user-plus"></i> Tuyển Mới</span>'
        : '<span class="badge badge-red"><i class="fa-solid fa-user-xmark"></i> Nghỉ Việc</span>';

      return `
        <tr>
          <td style="text-align: center; color: var(--text-secondary); font-size: 12px;">${startIdx + idx + 1}</td>
          <td><strong style="color: var(--primary-navy);">${item.employee_id}</strong></td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${item.full_name}</div>
          </td>
          <td>${item.gender}</td>
          <td>${item.department_name}</td>
          <td>${item.position_name}</td>
          <td style="text-align: center;">${typeBadge}</td>
          <td><strong>${item.effective_date}</strong></td>
          <td><span class="badge ${isNew ? 'badge-blue' : 'badge-amber'}">${item.status}</span></td>
          <td style="text-align: center;">
            <button class="btn btn-secondary btn-sm" onclick="appEmployees.openDetailModal('${item.employee_id}')" title="Xem chi tiết hồ sơ" style="height: 28px; padding: 0 8px;">
              <i class="fa-regular fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination() {
    const infoEl = document.getElementById('report-pagination-info');
    const controlsEl = document.getElementById('report-pagination-controls');
    if (!controlsEl) return;

    const total = this.filteredList.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;

    if (infoEl) {
      const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
      const end = Math.min(this.currentPage * this.pageSize, total);
      infoEl.textContent = `Hiển thị ${start} - ${end} của ${total} biến động`;
    }

    let html = '';
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appReports.goToPage(1)" title="Trang đầu"><i class="fa-solid fa-angles-left"></i></button>`;
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appReports.goToPage(${this.currentPage - 1})" title="Trang trước"><i class="fa-solid fa-angle-left"></i></button>`;

    html += '<div class="pagination-pages" style="display: flex; flex-direction: row; align-items: center; gap: 4px;">';
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="pagination-btn ${p === this.currentPage ? 'active' : ''}" onclick="appReports.goToPage(${p})">${p}</button>`;
    }
    html += '</div>';

    html += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appReports.goToPage(${this.currentPage + 1})" title="Trang sau"><i class="fa-solid fa-angle-right"></i></button>`;
    html += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appReports.goToPage(${totalPages})" title="Trang cuối"><i class="fa-solid fa-angles-right"></i></button>`;

    controlsEl.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredList.length / this.pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  },

  // Render Visual Analytics (Charts)
  renderCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Monthly Trend (New Hires vs Resignations)
    const monthlyCtx = document.getElementById('report-monthly-chart')?.getContext('2d');
    if (monthlyCtx) {
      const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      const newHires = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const resigns = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      this.fluctuationList.forEach(item => {
        const d = new Date(item.effective_date);
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          if (item.type === 'NEW') newHires[m]++;
          else resigns[m]++;
        }
      });

      if (this.monthlyChart) this.monthlyChart.destroy();
      this.monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Tuyển Mới',
              data: newHires,
              backgroundColor: '#10B981',
              borderRadius: 3,
              barPercentage: 0.6
            },
            {
              label: 'Nghỉ Việc',
              data: resigns,
              backgroundColor: '#EF4444',
              borderRadius: 3,
              barPercentage: 0.6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { mode: 'index', intersect: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    // 2. Department Fluctuations Distribution
    const deptCtx = document.getElementById('report-dept-chart')?.getContext('2d');
    if (deptCtx) {
      const deptCounts = {};
      this.fluctuationList.forEach(item => {
        const dName = item.department_name.substring(0, 20);
        deptCounts[dName] = (deptCounts[dName] || 0) + 1;
      });

      const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const labels = sortedDepts.map(d => d[0]);
      const data = sortedDepts.map(d => d[1]);

      if (this.deptChart) this.deptChart.destroy();
      this.deptChart = new Chart(deptCtx, {
        type: 'doughnut',
        data: {
          labels: labels.length > 0 ? labels : ['Không có biến động'],
          datasets: [{
            data: data.length > 0 ? data : [1],
            backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#94A3B8'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
          }
        }
      });
    }
  },

  // Export to Excel
  exportExcel() {
    try {
      if (this.filteredList.length === 0) {
        utils.showToast('Không có dữ liệu biến động nào để xuất', 'warning');
        return;
      }

      const rows = this.filteredList.map((item, idx) => ({
        "STT": idx + 1,
        "Mã Nhân Viên": item.employee_id,
        "Họ và Tên": item.full_name,
        "Giới Tính": item.gender,
        "Phòng Ban / Đơn Vị": item.department_name,
        "Vị Trí Công Việc": item.position_name,
        "Loại Biến Động": item.type_label,
        "Ngày Hiệu Lực": item.effective_date,
        "Trạng Thái / Ghi Chú": item.status
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BienDongNhanSu");
      
      const fileName = `Bao_Cao_Bien_Dong_Nhan_Su_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      utils.showToast('Xuất báo cáo biến động nhân sự Excel thành công!', 'success');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi xuất báo cáo Excel: ' + e.message, 'error');
    }
  }
};
