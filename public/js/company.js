// ==========================================================================
// COMPANY BRANDING & SETTINGS MODULE (CÀI ĐẶT THƯƠNG HIỆU DOANH NGHIỆP)
// ==========================================================================

const appCompany = {
  initialized: false,
  isSaving: false,
  tempLogoBase64: null,
  currentCompany: {
    brand_name: "TRUNG HẢI",
    full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
    subtitle: "HRM ENTERPRISE",
    logo_url: "assets/logo.png",
    tax_code: "0101234567",
    phone: "024.1234.5678",
    email: "contact@trunghaico.vn",
    address: "Tòa nhà Trung Hải, Hà Nội",
    website: "https://trunghaico.vn"
  },

  async init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }

    if (window.appData && appData.company && Object.keys(appData.company).length > 0) {
      this.currentCompany = { ...this.currentCompany, ...appData.company };
      this.applyBranding(this.currentCompany);
    } else {
      await this.fetchCompanyInfo();
    }
  },

  async fetchCompanyInfo() {
    try {
      const res = await fetch('/api/company/info');
      const json = await res.json();
      if (json.success && json.company) {
        this.currentCompany = { ...this.currentCompany, ...json.company };
        if (window.appData) appData.company = this.currentCompany;
        this.applyBranding(this.currentCompany);
      }
    } catch (e) {
      console.warn('Could not fetch company info:', e);
    }
  },

  applyBranding(company) {
    if (!company) return;

    const brandName = company.brand_name || 'TRUNG HẢI';
    const fullName = company.full_name || 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI';
    const subtitle = company.subtitle || 'HRM ENTERPRISE';
    const logoUrl = company.logo_url || 'assets/logo.png';

    // 1. Sidebar Brand Logo & Text
    document.querySelectorAll('.brand-logo-img').forEach(img => {
      img.src = logoUrl;
    });
    document.querySelectorAll('.brand-title').forEach(el => {
      el.textContent = brandName;
    });
    document.querySelectorAll('.brand-subtitle').forEach(el => {
      el.textContent = subtitle;
    });

    // 2. Login Screen Brand Logo & Text
    const loginLogo = document.querySelector('.login-logo');
    if (loginLogo) loginLogo.src = logoUrl;

    const loginSubtitle = document.querySelector('.login-subtitle');
    if (loginSubtitle) loginSubtitle.textContent = fullName;

    // 3. Document Title
    document.title = `HRM ENTERPRISE - ${brandName}`;
  },

  attachEventListeners() {
    // Open Modal from Topbar button or Brand click
    const btnOpen = document.getElementById('btn-company-settings');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => this.openModal());
    }

    const brandWrapper = document.querySelector('.brand-wrapper');
    if (brandWrapper) {
      brandWrapper.addEventListener('click', (e) => {
        if (window.appAuth && appAuth.isAdmin()) {
          e.preventDefault();
          this.openModal();
        }
      });
    }

    // Logo File Upload Input
    const logoInput = document.getElementById('company-logo-file-input');
    if (logoInput) {
      logoInput.addEventListener('change', (e) => this.handleLogoSelect(e));
    }

    // Logo Dropzone Drag & Drop
    const logoDropzone = document.getElementById('company-logo-dropzone');
    if (logoDropzone && logoInput) {
      logoDropzone.addEventListener('click', () => logoInput.click());
      logoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoDropzone.style.borderColor = 'var(--primary-navy)';
      });
      logoDropzone.addEventListener('dragleave', () => {
        logoDropzone.style.borderColor = 'var(--border-color)';
      });
      logoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        logoDropzone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.readLogoFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Form Submit
    const form = document.getElementById('form-company-settings');
    if (form) {
      form.addEventListener('submit', (e) => this.saveSettings(e));
    }
  },

  openModal() {
    this.tempLogoBase64 = null;
    const c = this.currentCompany;

    const brandInput = document.getElementById('company-input-brand');
    const fullnameInput = document.getElementById('company-input-fullname');
    const subtitleInput = document.getElementById('company-input-subtitle');
    const taxInput = document.getElementById('company-input-tax');
    const phoneInput = document.getElementById('company-input-phone');
    const emailInput = document.getElementById('company-input-email');
    const addressInput = document.getElementById('company-input-address');
    const websiteInput = document.getElementById('company-input-website');
    const logoPreview = document.getElementById('modal-company-logo-preview');

    if (brandInput) brandInput.value = c.brand_name || '';
    if (fullnameInput) fullnameInput.value = c.full_name || '';
    if (subtitleInput) subtitleInput.value = c.subtitle || '';
    if (taxInput) taxInput.value = c.tax_code || '';
    if (phoneInput) phoneInput.value = c.phone || '';
    if (emailInput) emailInput.value = c.email || '';
    if (addressInput) addressInput.value = c.address || '';
    if (websiteInput) websiteInput.value = c.website || '';
    if (logoPreview) logoPreview.src = c.logo_url || 'assets/logo.png';

    const modal = document.getElementById('modal-company-settings');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('modal-company-settings');
    if (modal) modal.classList.remove('active');
  },

  handleLogoSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      this.readLogoFile(file);
    }
  },

  readLogoFile(file) {
    if (!file.type.startsWith('image/')) {
      utils.showToast('Vui lòng chọn file hình ảnh (PNG, JPG, SVG, WebP)', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      utils.showToast('Kích thước ảnh tối đa là 5MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      this.tempLogoBase64 = evt.target.result;
      const preview = document.getElementById('modal-company-logo-preview');
      if (preview) preview.src = this.tempLogoBase64;
      utils.showToast('Đã tải ảnh xem trước Logo', 'info');
    };
    reader.readAsDataURL(file);
  },

  resetDefaultLogo() {
    this.tempLogoBase64 = 'DEFAULT';
    const preview = document.getElementById('modal-company-logo-preview');
    if (preview) preview.src = 'assets/logo.png';
    utils.showToast('Đã chuyển về Logo mặc định. Hãy nhấn "Lưu Thay Đổi" để áp dụng.', 'info');
  },

  async saveSettings(e) {
    e.preventDefault();
    if (this.isSaving) return;

    this.isSaving = true;
    const submitBtn = document.getElementById('btn-save-company-settings');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }

    try {
      let finalLogoUrl = this.currentCompany.logo_url;

      // 1. Upload Logo if changed
      if (this.tempLogoBase64 === 'DEFAULT') {
        finalLogoUrl = 'assets/logo.png';
      } else if (this.tempLogoBase64) {
        const uploadRes = await fetch('/api/company/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: this.tempLogoBase64,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.success && uploadJson.logo_url) {
          finalLogoUrl = uploadJson.logo_url;
        } else {
          utils.showToast(uploadJson.message || 'Lỗi khi tải logo lên máy chủ', 'error');
        }
      }

      // 2. Save Company Info
      const payload = {
        brand_name: document.getElementById('company-input-brand')?.value.trim() || 'TRUNG HẢI',
        full_name: document.getElementById('company-input-fullname')?.value.trim() || '',
        subtitle: document.getElementById('company-input-subtitle')?.value.trim() || 'HRM ENTERPRISE',
        tax_code: document.getElementById('company-input-tax')?.value.trim() || '',
        phone: document.getElementById('company-input-phone')?.value.trim() || '',
        email: document.getElementById('company-input-email')?.value.trim() || '',
        address: document.getElementById('company-input-address')?.value.trim() || '',
        website: document.getElementById('company-input-website')?.value.trim() || '',
        logo_url: finalLogoUrl,
        operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
        operator_name: appAuth.currentUser?.full_name || 'Admin',
        operator_role: appAuth.currentUser?.role || 'ADMIN'
      };

      const res = await fetch('/api/company/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        this.currentCompany = json.company;
        if (window.appData) appData.company = json.company;
        this.applyBranding(json.company);
        this.closeModal();
        utils.showToast('Cập nhật nhận diện doanh nghiệp thành công!', 'success');
      } else {
        utils.showToast(json.message || 'Lỗi khi lưu thông tin doanh nghiệp', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ khi lưu cấu hình', 'error');
    } finally {
      this.isSaving = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Nhận Diện Doanh Nghiệp';
      }
    }
  }
};
