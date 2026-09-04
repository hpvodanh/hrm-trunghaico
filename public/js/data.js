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

  // Local persistence helpers for Serverless environments (Vercel)
  getDeletedIds() {
    try {
      return JSON.parse(localStorage.getItem('hrm_deleted_emp_ids') || '[]');
    } catch (e) {
      return [];
    }
  },

  addDeletedId(empId, trashEntry) {
    try {
      const ids = this.getDeletedIds();
      if (!ids.includes(empId)) {
        ids.push(empId);
        localStorage.setItem('hrm_deleted_emp_ids', JSON.stringify(ids));
      }
      if (trashEntry) {
        const trash = this.getLocalTrash();
        const existingIdx = trash.findIndex(t => t.employee_id === empId);
        if (existingIdx >= 0) {
          trash[existingIdx] = { ...trash[existingIdx], ...trashEntry };
        } else {
          trash.unshift(trashEntry);
        }
        localStorage.setItem('hrm_local_trash', JSON.stringify(trash));
      }
      // Remove from custom local employees if present
      let customEmps = this.getLocalCustomEmployees();
      customEmps = customEmps.filter(e => e.employee_id !== empId);
      localStorage.setItem('hrm_local_custom_employees', JSON.stringify(customEmps));
    } catch (e) {}
  },

  removeDeletedId(empId) {
    try {
      let ids = this.getDeletedIds();
      ids = ids.filter(id => id !== empId);
      localStorage.setItem('hrm_deleted_emp_ids', JSON.stringify(ids));

      let trash = this.getLocalTrash();
      trash = trash.filter(t => t.employee_id !== empId);
      localStorage.setItem('hrm_local_trash', JSON.stringify(trash));
    } catch (e) {}
  },

  purgeDeletedId(empId) {
    try {
      const ids = this.getDeletedIds();
      if (!ids.includes(empId)) {
        ids.push(empId);
        localStorage.setItem('hrm_deleted_emp_ids', JSON.stringify(ids));
      }
      let trash = this.getLocalTrash();
      trash = trash.filter(t => t.employee_id !== empId);
      localStorage.setItem('hrm_local_trash', JSON.stringify(trash));
    } catch (e) {}
  },

  getLocalTrash() {
    try {
      return JSON.parse(localStorage.getItem('hrm_local_trash') || '[]');
    } catch (e) {
      return [];
    }
  },

  clearLocalTrash() {
    try {
      localStorage.removeItem('hrm_local_trash');
    } catch (e) {}
  },

  getLocalCustomEmployees() {
    try {
      return JSON.parse(localStorage.getItem('hrm_local_custom_employees') || '[]');
    } catch (e) {
      return [];
    }
  },

  saveLocalEmployee(emp) {
    try {
      if (!emp || !emp.employee_id) return;
      const customEmps = this.getLocalCustomEmployees();
      const idx = customEmps.findIndex(e => e.employee_id === emp.employee_id);
      if (idx >= 0) {
        customEmps[idx] = { ...customEmps[idx], ...emp };
      } else {
        customEmps.unshift(emp);
      }
      localStorage.setItem('hrm_local_custom_employees', JSON.stringify(customEmps));

      // Ensure not in deletedIds
      let ids = this.getDeletedIds();
      if (ids.includes(emp.employee_id)) {
        this.removeDeletedId(emp.employee_id);
      }
    } catch (e) {}
  },

  // Fetch all tables from API & apply local persistence overlay
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

        // Apply local deletion overlay
        const deletedIds = this.getDeletedIds();
        if (deletedIds.length > 0) {
          const delSet = new Set(deletedIds);
          this.employees = this.employees.filter(e => !delSet.has(e.employee_id));
          if (this.tables['03_Employees']) {
            this.tables['03_Employees'] = this.tables['03_Employees'].filter(e => !delSet.has(e.employee_id));
          }
          if (this.tables['00_Master_Profiles']) {
            this.tables['00_Master_Profiles'] = this.tables['00_Master_Profiles'].filter(m => !delSet.has(m['Mã nhân viên']) && !delSet.has(m.employee_id));
          }
          if (this.tables['04_Contacts_Addresses']) {
            this.tables['04_Contacts_Addresses'] = this.tables['04_Contacts_Addresses'].filter(c => !delSet.has(c.employee_id));
          }
          if (this.tables['08_Salaries_Banks']) {
            this.tables['08_Salaries_Banks'] = this.tables['08_Salaries_Banks'].filter(s => !delSet.has(s.employee_id));
          }
        }

        // Merge custom/edited employees
        const customEmps = this.getLocalCustomEmployees();
        if (customEmps.length > 0) {
          customEmps.forEach(ce => {
            if (!deletedIds.includes(ce.employee_id)) {
              const idx = this.employees.findIndex(e => e.employee_id === ce.employee_id);
              if (idx >= 0) {
                this.employees[idx] = { ...this.employees[idx], ...ce };
              } else {
                this.employees.unshift(ce);
              }
            }
          });
        }

        // Merge local trash
        const localTrash = this.getLocalTrash();
        if (localTrash.length > 0) {
          const trashMap = new Map();
          (this.trash || []).forEach(t => trashMap.set(t.employee_id, t));
          localTrash.forEach(t => trashMap.set(t.employee_id, t));
          this.trash = Array.from(trashMap.values());
          this.tables['13_Recycle_Bin'] = this.trash;
        }

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
