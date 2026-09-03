// ==========================================================================
// DATA STORE & HELPER UTILITIES
// ==========================================================================

const appData = {
  isLoaded: false,
  tables: {},
  employees: [],
  departments: [],
  positions: [],
  contacts: [],
  identity: [],
  emergency: [],
  education: [],
  salaries: [],
  insurance: [],
  contracts: [],
  accounts: [],
  trash: [],

  company: {},

  // Lookup maps
  deptMap: {},
  posMap: {},
  empMap: {},

  // Fetch all tables from API
  async init() {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (json.success && json.tables) {
        this.tables = json.tables;
        this.company = json.company || {};
        this.employees = (json.tables['03_Employees'] || []).sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }));
        this.departments = json.tables['01_Departments'] || [];
        this.positions = json.tables['02_Positions'] || [];
        this.contacts = json.tables['04_Contacts_Addresses'] || [];
        this.identity = json.tables['05_Identity_Docs'] || [];
        this.emergency = json.tables['06_Emergency_Contacts'] || [];
        this.education = json.tables['07_Education'] || [];
        this.salaries = json.tables['08_Salaries_Banks'] || [];
        this.insurance = json.tables['09_Insurance_Welfare'] || [];
        this.contracts = json.tables['10_Contracts'] || [];
        this.accounts = json.tables['11_System_Accounts'] || [];
        this.trash = json.tables['13_Recycle_Bin'] || [];

        // Build lookup maps
        this.buildMaps();

        // Apply Company Branding
        if (window.appCompany) {
          appCompany.applyBranding(this.company);
        }

        this.isLoaded = true;
        return true;
      }
    } catch (err) {
      console.error('Error fetching data from server:', err);
    }
    return false;
  },

  buildMaps() {
    this.deptMap = {};
    this.departments.forEach(d => {
      this.deptMap[d.department_id] = d.department_name;
    });

    this.posMap = {};
    this.positions.forEach(p => {
      this.posMap[p.position_id] = p.position_name;
    });

    this.empMap = {};
    this.employees.forEach(e => {
      this.empMap[e.employee_id] = e;
    });
  }
};

// UI Utilities
const utils = {
  formatCurrency(num) {
    if (!num || isNaN(num)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  },

  formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}" style="font-size: 16px; color: ${type === 'success' ? '#10B981' : type === 'error' ? '#E52125' : '#1C3381'};"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};
