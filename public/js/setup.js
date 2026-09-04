// ==========================================================================
// SETUP WIZARD CONTROLLER - HRM TRUNG HAI
// ==========================================================================

const appSetup = {
  currentStep: 1,
  totalSteps: 5,
  credentials: null,
  spreadsheetId: '',
  dataOption: 'SAMPLE',
  isVerified: false,

  init() {
    this.attachEventListeners();
    this.checkExistingSetup();
  },

  async checkExistingSetup() {
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      if (data && data.is_setup_completed) {
        // Already setup, prompt or allow reconfiguration
        console.log('System is already configured.');
      }
    } catch (e) {
      console.warn('Status check:', e);
    }
  },

  attachEventListeners() {
    // Stepper Navigation Buttons
    const btnNext = document.getElementById('btn-next-step');
    const btnPrev = document.getElementById('btn-prev-step');
    if (btnNext) btnNext.addEventListener('click', () => this.handleNextStep());
    if (btnPrev) btnPrev.addEventListener('click', () => this.goToStep(this.currentStep - 1));

    // Step 2: Dropzone & File Input
    const dropzone = document.getElementById('key-dropzone');
    const fileInput = document.getElementById('file-key-input');
    const btnReselect = document.getElementById('btn-reselect-file');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFile(e.target.files[0]);
        }
      });
    }

    if (btnReselect && fileInput) {
      btnReselect.addEventListener('click', () => fileInput.click());
    }

    // Step 3: Copy Email & Test Connection
    const btnCopyEmail = document.getElementById('btn-copy-email');
    if (btnCopyEmail) {
      btnCopyEmail.addEventListener('click', () => this.copyServiceEmail());
    }

    const btnTestConn = document.getElementById('btn-test-connection');
    if (btnTestConn) {
      btnTestConn.addEventListener('click', () => this.testConnection());
    }

    // Step 6: Enter App button
    const btnEnterApp = document.getElementById('btn-enter-app');
    if (btnEnterApp) {
      btnEnterApp.addEventListener('click', () => {
        window.location.href = '/';
      });
    }
  },

  goToStep(step) {
    if (step < 1 || step > 6) return;
    this.currentStep = step;

    // Update Stepper Navigation Items
    for (let i = 1; i <= 5; i++) {
      const navItem = document.getElementById(`step-nav-${i}`);
      const panel = document.getElementById(`step-panel-${i}`);

      if (navItem) {
        navItem.classList.remove('active', 'completed');
        if (i === step) {
          navItem.classList.add('active');
        } else if (i < step) {
          navItem.classList.add('completed');
        }
      }

      if (panel) {
        panel.classList.remove('active');
        if (i === step) {
          panel.classList.add('active');
        }
      }
    }

    // Panel 6 is the final completion panel
    const panel6 = document.getElementById('step-panel-6');
    if (panel6) {
      panel6.classList.remove('active');
      if (step === 6) panel6.classList.add('active');
    }

    // Update Footer Buttons
    const btnPrev = document.getElementById('btn-prev-step');
    const btnNext = document.getElementById('btn-next-step');
    const footer = document.getElementById('setup-footer');

    if (step === 6) {
      if (footer) footer.style.display = 'none';
      return;
    } else {
      if (footer) footer.style.display = 'flex';
    }

    if (btnPrev) {
      btnPrev.style.display = step > 1 ? 'inline-flex' : 'none';
    }

    if (btnNext) {
      if (step === 5) {
        btnNext.innerHTML = '<i class="fa-solid fa-rocket"></i> Hoàn Tất & Khởi Chạy';
        btnNext.className = 'btn-setup btn-setup-success';
      } else {
        btnNext.innerHTML = 'Tiếp tục <i class="fa-solid fa-arrow-right"></i>';
        btnNext.className = 'btn-setup btn-setup-primary';
      }
    }
  },

  async handleNextStep() {
    // Validation before leaving Step 2 (Must have uploaded JSON)
    if (this.currentStep === 2) {
      if (!this.credentials) {
        this.showToast('Vui lòng tải lên file Service Account JSON hợp lệ để tiếp tục', 'error');
        return;
      }
    }

    // Validation before leaving Step 3 (Must have valid Sheet connection)
    if (this.currentStep === 3) {
      const sheetInput = document.getElementById('input-sheet-id').value.trim();
      const sheetId = this.extractSheetId(sheetInput);
      if (!sheetId) {
        this.showToast('Vui lòng nhập Link hoặc ID Google Sheet của bạn', 'error');
        return;
      }
      this.spreadsheetId = sheetId;

      if (!this.isVerified) {
        const ok = await this.testConnection();
        if (!ok) return;
      }
    }

    // Execution on Step 5 (Submit complete setup)
    if (this.currentStep === 5) {
      await this.completeSetup();
      return;
    }

    this.goToStep(this.currentStep + 1);
  },

  // Read & Validate JSON file
  handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      this.showToast('Vui lòng chọn file có định dạng .json', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);

        // Send to backend validation
        const res = await fetch('/api/setup/validate-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentials: parsed })
        });
        const data = await res.json();

        if (data.success) {
          this.credentials = parsed;
          this.showToast('Đã xác thực file JSON thành công!', 'success');

          // Update UI
          const badge = document.getElementById('file-info-badge');
          const dropzone = document.getElementById('key-dropzone');
          const badgeFileName = document.getElementById('badge-file-name');
          const badgeEmail = document.getElementById('badge-client-email');
          const displayEmail = document.getElementById('display-service-email');

          if (badge) badge.style.display = 'flex';
          if (dropzone) dropzone.style.display = 'none';
          if (badgeFileName) badgeFileName.textContent = file.name;
          if (badgeEmail) badgeEmail.textContent = `Email: ${parsed.client_email} (${parsed.project_id})`;
          if (displayEmail) displayEmail.textContent = parsed.client_email;
          this.isVerified = false;
        } else {
          this.showToast(data.message || 'File JSON không hợp lệ', 'error');
        }
      } catch (err) {
        this.showToast('Lỗi đọc nội dung file JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  extractSheetId(input) {
    if (!input) return '';
    let str = input.trim();
    const match = str.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return str.split('/')[0].split('?')[0].split('#')[0].trim();
  },

  copyServiceEmail() {
    const email = this.credentials?.client_email;
    if (!email) {
      this.showToast('Chưa có email Service Account. Vui lòng tải file JSON ở Bước 2 trước.', 'error');
      return;
    }
    navigator.clipboard.writeText(email).then(() => {
      this.showToast('Đã sao chép email Service Account vào bộ nhớ tạm!', 'success');
    }).catch(() => {
      this.showToast('Email: ' + email, 'info');
    });
  },

  copyVercelEnv() {
    if (!this.credentials) {
      this.showToast('Chưa có dữ liệu Service Account JSON. Vui lòng tải file lên trước.', 'error');
      return;
    }
    const jsonStr = JSON.stringify(this.credentials);
    navigator.clipboard.writeText(jsonStr).then(() => {
      this.showToast('Đã sao chép! Bạn có thể dán vào biến GOOGLE_SERVICE_ACCOUNT_JSON trên Vercel.', 'success');
    }).catch(() => {
      this.showToast('Không thể tự động sao chép, vui lòng sao chép thủ công.', 'error');
    });
  },

  async testConnection() {
    const sheetInput = document.getElementById('input-sheet-id').value.trim();
    const sheetId = this.extractSheetId(sheetInput);
    const badge = document.getElementById('connection-health-badge');
    const badgeText = document.getElementById('connection-health-text');

    if (!this.credentials) {
      this.showToast('Vui lòng hoàn thành bước 2 tải file JSON trước', 'error');
      return false;
    }
    if (!sheetId) {
      this.showToast('Vui lòng nhập Link hoặc ID Google Spreadsheet', 'error');
      return false;
    }

    if (badge) {
      badge.className = 'connection-badge loading';
      badgeText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kết nối tới Google Spreadsheet...';
    }

    try {
      const res = await fetch('/api/setup/verify-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: this.credentials,
          spreadsheetId: sheetId
        })
      });
      const data = await res.json();

      if (data.success) {
        this.isVerified = true;
        this.spreadsheetId = sheetId;
        if (badge) {
          badge.className = 'connection-badge success';
          badgeText.innerHTML = `<i class="fa-solid fa-circle-check"></i> Kết nối thành công tới Google Sheet: <strong>${data.title}</strong> (${data.sheets?.length || 0} tabs)`;
        }
        this.showToast('Xác thực kết nối Google Sheet thành công!', 'success');
        return true;
      } else {
        this.isVerified = false;
        if (badge) {
          badge.className = 'connection-badge error';
          badgeText.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${data.message || 'Không thể kết nối'}`;
        }
        this.showToast(data.message || 'Kết nối thất bại. Vui lòng kiểm tra quyền chia sẻ Editor.', 'error');
        return false;
      }
    } catch (e) {
      this.isVerified = false;
      if (badge) {
        badge.className = 'connection-badge error';
        badgeText.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Lỗi: ${e.message}`;
      }
      this.showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
      return false;
    }
  },

  selectDataOption(option) {
    this.dataOption = option;
    const cardSample = document.getElementById('choice-card-sample');
    const cardClean = document.getElementById('choice-card-clean');

    if (option === 'SAMPLE') {
      cardSample?.classList.add('selected');
      cardClean?.classList.remove('selected');
      const radio = cardSample?.querySelector('.choice-radio');
      if (radio) radio.checked = true;
    } else {
      cardClean?.classList.add('selected');
      cardSample?.classList.remove('selected');
      const radio = cardClean?.querySelector('.choice-radio');
      if (radio) radio.checked = true;
    }
  },

  async completeSetup() {
    const adminFullName = document.getElementById('admin-fullname').value.trim();
    const adminJobTitle = document.getElementById('admin-jobtitle').value.trim();
    const adminUsername = document.getElementById('admin-username').value.trim();
    const adminPassword = document.getElementById('admin-password').value;
    const adminEmail = document.getElementById('admin-email').value.trim();
    const adminPhone = document.getElementById('admin-phone').value.trim();

    if (!adminFullName || !adminUsername || !adminPassword) {
      this.showToast('Vui lòng điền đầy đủ Họ tên, Tên đăng nhập và Mật khẩu Quản trị', 'error');
      return;
    }

    // Move to progress panel
    this.goToStep(6);
    const loadingBox = document.getElementById('complete-loading-box');
    const successBox = document.getElementById('complete-success-box');
    const statusText = document.getElementById('complete-loading-status');

    if (statusText) statusText.textContent = 'Đang khởi tạo 14 bảng cấu trúc và đồng bộ lên Google Sheets của bạn...';

    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: this.credentials,
          spreadsheetId: this.spreadsheetId,
          dataOption: this.dataOption,
          admin: {
            full_name: adminFullName,
            job_title: adminJobTitle,
            username: adminUsername,
            password: adminPassword,
            email: adminEmail,
            phone: adminPhone
          }
        })
      });

      const data = await res.json();

      if (data.success) {
        // Save initial login session for seamless entry
        if (data.admin) {
          localStorage.setItem('hrm_trunghai_user_session', JSON.stringify({
            employee_id: 'TH-0001',
            username: data.admin.username,
            full_name: data.admin.full_name,
            role: 'ADMIN'
          }));
        }

        if (loadingBox) loadingBox.style.display = 'none';
        if (successBox) successBox.style.display = 'block';
        this.showToast('Khởi tạo hệ thống thành công!', 'success');
      } else {
        if (statusText) {
          statusText.innerHTML = `
            <div style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 14px 18px; margin: 16px auto; max-width: 540px; text-align: left;">
              <div style="color: #B91C1C; font-weight: 700; font-size: 13.5px; margin-bottom: 6px;">
                <i class="fa-solid fa-circle-exclamation"></i> Lỗi trong quá trình khởi tạo:
              </div>
              <div style="color: #991B1B; font-size: 12.5px; line-height: 1.5; margin-bottom: 12px;">
                ${data.message}
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-setup btn-setup-secondary" onclick="appSetup.goToStep(5)" style="height: 32px; font-size: 12px; padding: 0 14px;">
                  <i class="fa-solid fa-arrow-left"></i> Quay lại Bước 5
                </button>
                <button type="button" class="btn-setup btn-setup-primary" onclick="appSetup.completeSetup()" style="height: 32px; font-size: 12px; padding: 0 14px;">
                  <i class="fa-solid fa-rotate-right"></i> Thử lại
                </button>
              </div>
            </div>
          `;
        }
        this.showToast(data.message || 'Lỗi khi khởi tạo hệ thống', 'error');
      }
    } catch (e) {
      if (statusText) {
        statusText.innerHTML = `
          <div style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 14px 18px; margin: 16px auto; max-width: 540px; text-align: left;">
            <div style="color: #B91C1C; font-weight: 700; font-size: 13.5px; margin-bottom: 6px;">
              <i class="fa-solid fa-circle-exclamation"></i> Lỗi kết nối máy chủ:
            </div>
            <div style="color: #991B1B; font-size: 12.5px; line-height: 1.5; margin-bottom: 12px;">
              ${e.message}
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-setup btn-setup-secondary" onclick="appSetup.goToStep(5)" style="height: 32px; font-size: 12px; padding: 0 14px;">
                <i class="fa-solid fa-arrow-left"></i> Quay lại Bước 5
              </button>
              <button type="button" class="btn-setup btn-setup-primary" onclick="appSetup.completeSetup()" style="height: 32px; font-size: 12px; padding: 0 14px;">
                <i class="fa-solid fa-rotate-right"></i> Thử lại
              </button>
            </div>
          </div>
        `;
      }
      this.showToast('Lỗi: ' + e.message, 'error');
    }
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('setup-toast');
    if (!toast) return;

    const icons = {
      success: '<i class="fa-solid fa-circle-check" style="color: #10B981;"></i>',
      error: '<i class="fa-solid fa-circle-exclamation" style="color: #EF4444;"></i>',
      info: '<i class="fa-solid fa-circle-info" style="color: #3B82F6;"></i>'
    };

    toast.className = `setup-toast ${type}`;
    toast.innerHTML = `${icons[type] || ''} <span>${message}</span>`;
    toast.style.display = 'flex';

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 4000);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  appSetup.init();
});
