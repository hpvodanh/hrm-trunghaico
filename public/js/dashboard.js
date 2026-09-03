// ==========================================================================
// DASHBOARD MODULE - 4 CHARTS (DONUT DEPT, DONUT CONTRACT, TURNOVER LINE, HEADCOUNT BAR)
// ==========================================================================

const appDashboard = {
  charts: {},

  init() {
    this.renderKPIs();
    this.renderCharts();
    this.renderProbationAlerts();
  },

  renderKPIs() {
    const total = appData.employees.length;
    const active = appData.employees.filter(e => e.employment_status === 'Đang làm việc').length;
    const probation = appData.employees.filter(e => e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc').length;
    const depts = appData.departments.length;
    const positions = appData.positions.length;

    const resigned = appData.employees.filter(e => e.employment_status === 'Đã nghỉ việc').length;

    document.getElementById('kpi-total-emp').textContent = utils.formatNumber(total);
    document.getElementById('kpi-active-emp').textContent = utils.formatNumber(active);
    document.getElementById('kpi-probation-emp').textContent = utils.formatNumber(probation);
    document.getElementById('kpi-total-dept').textContent = utils.formatNumber(depts);

    document.getElementById('sidebar-emp-count').textContent = total;
    document.getElementById('sidebar-dept-count').textContent = depts;
    document.getElementById('sidebar-pos-count').textContent = positions;
    const sidebarResignedEl = document.getElementById('sidebar-resigned-count');
    if (sidebarResignedEl) sidebarResignedEl.textContent = resigned;
  },

  renderCharts() {
    this.renderDeptDonutChart();
    this.renderContractDonutChart();
    this.renderTurnoverLineChart();
    this.renderHeadcountBarChart();
  },

  // 1. Donut Chart: Cơ cấu nhân sự theo phòng ban / đơn vị
  renderDeptDonutChart() {
    const ctx = document.getElementById('chart-dept-donut');
    const legendContainer = document.getElementById('donut-dept-legend');
    const totalEl = document.getElementById('donut-dept-total');
    if (!ctx) return;

    // Group employees by Department
    const deptCounts = {};
    appData.employees.forEach(e => {
      const dName = appData.deptMap[e.department_id] || e.department_id || 'Khác';
      deptCounts[dName] = (deptCounts[dName] || 0) + 1;
    });

    const total = appData.employees.length;
    if (totalEl) totalEl.textContent = total;

    // Sort descending
    const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
    const topItems = sorted.slice(0, 5);
    const otherCount = sorted.slice(5).reduce((sum, item) => sum + item[1], 0);
    if (otherCount > 0) {
      topItems.push(['Các đơn vị khác', otherCount]);
    }

    const palette = [
      '#2563EB', // Blue
      '#F59E0B', // Amber
      '#10B981', // Green
      '#8B5CF6', // Purple
      '#E52125', // Red
      '#64748B'  // Slate
    ];

    const labels = topItems.map(item => item[0]);
    const data = topItems.map(item => item[1]);
    const bgColors = topItems.map((_, i) => palette[i % palette.length]);

    if (this.charts.deptDonut) this.charts.deptDonut.destroy();
    this.charts.deptDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const count = item.raw;
                const pct = ((count / total) * 100).toFixed(1);
                return ` ${item.label}: ${count} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Populate Right Legend List
    if (legendContainer) {
      legendContainer.innerHTML = topItems.map((item, idx) => {
        const name = item[0];
        const count = item[1];
        const pct = ((count / total) * 100).toFixed(1);
        const color = bgColors[idx];
        return `
          <div class="donut-legend-item">
            <span class="donut-legend-color" style="background: ${color};"></span>
            <div class="donut-legend-info">
              <span class="donut-legend-name" title="${name}">${name}</span>
              <span class="donut-legend-count" style="color: ${color};">${count} (${pct}%)</span>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  // 2. Donut Chart: Thống kê hợp đồng theo loại
  renderContractDonutChart() {
    const ctx = document.getElementById('chart-contract-donut');
    const legendContainer = document.getElementById('donut-contract-legend');
    const totalEl = document.getElementById('donut-contract-total');
    if (!ctx) return;

    const contractCounts = {};
    appData.contracts.forEach(c => {
      const type = c.contract_type || 'Hợp đồng xác định thời hạn';
      contractCounts[type] = (contractCounts[type] || 0) + 1;
    });

    const total = appData.contracts.length || appData.employees.length;
    if (totalEl) totalEl.textContent = total;

    const sorted = Object.entries(contractCounts).sort((a, b) => b[1] - a[1]);
    const palette = [
      '#2563EB', // Blue
      '#F59E0B', // Amber
      '#10B981', // Green
      '#8B5CF6', // Purple
      '#E52125'  // Red
    ];

    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => item[1]);
    const bgColors = sorted.map((_, i) => palette[i % palette.length]);

    if (this.charts.contractDonut) this.charts.contractDonut.destroy();
    this.charts.contractDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const count = item.raw;
                const pct = ((count / total) * 100).toFixed(1);
                return ` ${item.label}: ${count} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Populate Right Legend List
    if (legendContainer) {
      legendContainer.innerHTML = sorted.map((item, idx) => {
        const name = item[0];
        const count = item[1];
        const pct = ((count / total) * 100).toFixed(1);
        const color = bgColors[idx];
        return `
          <div class="donut-legend-item">
            <span class="donut-legend-color" style="background: ${color};"></span>
            <div class="donut-legend-info">
              <span class="donut-legend-name" title="${name}">${name}</span>
              <span class="donut-legend-count" style="color: ${color};">${count} (${pct}%)</span>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  // 3. Line Chart: Biến động nhân sự (Năm 2026)
  renderTurnoverLineChart() {
    const ctx = document.getElementById('chart-turnover-line');
    if (!ctx) return;

    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const tiepNhanData = [4, 3, 19, 14, 9, 11, 9, 0, 0, 0, 0, 0];
    const nghiViecData = [0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0];

    if (this.charts.turnoverLine) this.charts.turnoverLine.destroy();
    this.charts.turnoverLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Tiếp nhận',
            data: tiepNhanData,
            borderColor: '#0284C7', // Sky Blue
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.45,
            pointBackgroundColor: '#0284C7',
            pointRadius: 3,
            pointHoverRadius: 6
          },
          {
            label: 'Nghỉ việc',
            data: nghiViecData,
            borderColor: '#DC2626', // Red
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.45,
            pointBackgroundColor: '#DC2626',
            pointRadius: 3,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 14,
              usePointStyle: true,
              pointStyle: 'line',
              font: { size: 11.5, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: '#1E293B',
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 4
          }
        },
        scales: {
          y: {
            min: 0,
            max: 22,
            ticks: {
              stepSize: 5,
              color: '#94A3B8',
              font: { size: 11 }
            },
            grid: {
              color: '#F1F5F9'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748B',
              font: { size: 11.5, weight: '500' }
            }
          }
        }
      }
    });
  },

  // 4. Bar Chart: Số lượng nhân sự (Năm 2026)
  renderHeadcountBarChart() {
    const ctx = document.getElementById('chart-headcount-bar');
    if (!ctx) return;

    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const headcountData = [710, 715, 740, 755, 765, 775, 785, 785, 0, 0, 0, 0];

    if (this.charts.headcountBar) this.charts.headcountBar.destroy();
    this.charts.headcountBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Số lượng nhân sự',
          data: headcountData,
          backgroundColor: '#6366F1', // Indigo Purple matching reference
          borderRadius: 4,
          barThickness: 16
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1E293B',
            padding: 10,
            cornerRadius: 4,
            callbacks: {
              label: (item) => ` Số lượng: ${item.raw} nhân sự`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 1000,
            ticks: {
              stepSize: 250,
              color: '#94A3B8',
              font: { size: 11 }
            },
            grid: {
              color: '#F1F5F9'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748B',
              font: { size: 11.5, weight: '500' }
            }
          }
        }
      }
    });
  },

  renderProbationAlerts() {
    const tbody = document.getElementById('dashboard-probation-tbody');
    if (!tbody) return;

    const probations = appData.employees
      .filter(e => e.employment_status === 'Đang làm việc' && (e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc'))
      .slice(0, 6);

    if (probations.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Không có nhân viên thử việc cần xử lý.</td></tr>`;
      return;
    }

    tbody.innerHTML = probations.map(e => `
      <tr>
        <td><strong style="color: var(--primary-navy);">${e.employee_id}</strong></td>
        <td><strong>${e.full_name}</strong></td>
        <td>${appData.posMap[e.position_id] || e.position_id}</td>
        <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${appData.deptMap[e.department_id] || e.department_id}">
          ${appData.deptMap[e.department_id] || e.department_id}
        </td>
        <td><span class="badge badge-probation">${utils.formatDate(e.trial_start_date || e.probation_start_date)}</span></td>
        <td style="text-align: center;">
          <button class="btn btn-sm btn-outline-navy" onclick="appEmployees.openDetailModal('${e.employee_id}')">
            <i class="fa-solid fa-eye"></i> Xem Hồ Sơ
          </button>
        </td>
      </tr>
    `).join('');
  }
};
