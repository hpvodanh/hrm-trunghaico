// ==========================================================================
// MAIN APPLICATION ROUTER & CONTROLLER
// ==========================================================================

const app = {
  async init() {
    console.log('Initializing TRUNG HAI HRM WebApp...');
    
    // Check if system needs Initial Setup Wizard
    try {
      const setupRes = await fetch('/api/setup/status');
      const setupData = await setupRes.json();
      if (setupData && setupData.is_setup_completed === false) {
        window.location.href = '/setup';
        return;
      }
    } catch (e) {
      console.warn('Setup status check error:', e);
    }

    // 1. Initialize Auth Session immediately (Synchronous from LocalStorage)
    appAuth.init();

    // 2. Load Data from Backend
    const loaded = await appData.init();
    if (!loaded) {
      utils.showToast('Không thể kết nối CSDL máy chủ', 'error');
    }

    // 3. Initialize Sub-modules
    appCompany.init();
    appDashboard.init();
    appEmployees.init();
    appImport.init();
    appResigned.init();
    appOrganization.init();
    appReports.init();
    appAccounts.init();
    appLogs.init();
    appTrash.init();

    // 4. Update sidebar count badges
    const sideDeptCount = document.getElementById('sidebar-dept-count');
    if (sideDeptCount) sideDeptCount.textContent = (appData.departments || []).length;
    const sidePosCount = document.getElementById('sidebar-pos-count');
    if (sidePosCount) sidePosCount.textContent = (appData.positions || []).length;
    const sideResignedCount = document.getElementById('sidebar-resigned-count');
    if (sideResignedCount) sideResignedCount.textContent = (appData.employees || []).filter(e => e.employment_status === 'Đã nghỉ việc').length;

    // 5. Navigation setup
    this.setupNavigation();
    this.setupSidebarToggle();
    this.setupGlobalSearch();
    this.setupQuickActions();

    // Window resize handler
    window.addEventListener('resize', () => {
      if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        appDashboard.renderCharts();
      }
      if (document.getElementById('view-reports')?.classList.contains('active')) {
        appReports.renderCharts();
      }
    });

    utils.showToast('Hệ thống HRM TRUNG HẢI đã sẵn sàng!', 'success');
  },

  setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
          if (document.getElementById('view-dashboard')?.classList.contains('active')) {
            appDashboard.renderCharts();
          }
          if (document.getElementById('view-reports')?.classList.contains('active')) {
            appReports.renderCharts();
          }
        }, 250);
      });
    }
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const pageTitle = document.getElementById('current-page-title');

    const titles = {
      'dashboard': '<i class="fa-solid fa-chart-pie"></i> <span>Dashboard Thống Kê</span>',
      'employees': '<i class="fa-solid fa-users"></i> <span>Quản Lý Nhân Sự</span>',
      'departments': '<i class="fa-solid fa-building"></i> <span>Danh Sách Phòng Ban</span>',
      'positions': '<i class="fa-solid fa-briefcase"></i> <span>Vị Trí Công Việc</span>',
      'contracts': '<i class="fa-solid fa-file-contract"></i> <span>Hợp Đồng & Cảnh Báo</span>',
      'resigned': '<i class="fa-solid fa-user-xmark"></i> <span>Quản Lý Nhân Sự Nghỉ Việc</span>',
      'reports': '<i class="fa-solid fa-chart-line"></i> <span>Báo Cáo Biến Động Nhân Sự</span>',
      'accounts': '<i class="fa-solid fa-user-shield"></i> <span>Tài Khoản & Phân Quyền</span>',
      'logs': '<i class="fa-solid fa-clock-rotate-left"></i> <span>Nhật Ký Hoạt Động Hệ Thống</span>',
      'trash': '<i class="fa-solid fa-trash-can"></i> <span>Thùng Rác & Khôi Phục Nhân Sự</span>'
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        if (!viewId) return;

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        viewPanels.forEach(panel => {
          panel.classList.remove('active');
          if (panel.id === `view-${viewId}`) {
            panel.classList.add('active');
          }
        });

        if (pageTitle && titles[viewId]) {
          pageTitle.innerHTML = titles[viewId];
        }

        // Trigger dynamic renders on view activation
        if (viewId === 'dashboard') {
          setTimeout(() => appDashboard.renderCharts(), 50);
        } else if (viewId === 'reports') {
          appReports.render();
        } else if (viewId === 'resigned') {
          appResigned.render();
        } else if (viewId === 'departments') {
          appOrganization.renderDepartmentsTable();
        } else if (viewId === 'positions') {
          appOrganization.renderPositionsTable();
        } else if (viewId === 'contracts') {
          appOrganization.renderContractsTable();
        } else if (viewId === 'accounts') {
          appAccounts.init();
        } else if (viewId === 'logs') {
          appLogs.fetchLogs();
        } else if (viewId === 'trash') {
          appTrash.render();
        }
      });
    });
  },

  setupGlobalSearch() {
    const globalSearch = document.getElementById('global-search-input');
    if (!globalSearch) return;

    globalSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = globalSearch.value.trim();
        if (query) {
          // Switch to employees view and search
          document.querySelector('.nav-item[data-view="employees"]').click();
          const empSearch = document.getElementById('emp-search-input');
          if (empSearch) {
            empSearch.value = query;
            appEmployees.currentPage = 1;
            appEmployees.applyFilters();
          }
        }
      }
    });
  },

  setupQuickActions() {
    const quickExportBtn = document.getElementById('btn-quick-export');
    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        appReports.exportCompleteWorkbook();
      });
    }
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
