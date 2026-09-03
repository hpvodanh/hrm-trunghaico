// ==========================================================================
// EXCEL IMPORT MODULE (NHẬP DANH SÁCH NHÂN SỰ TỪ FILE EXCEL & KIỂM TRA TRÙNG LẶP)
// ==========================================================================

const appImport = {
  initialized: false,
  isImporting: false,
  currentStep: 1,
  currentFilter: 'all',
  parsedEmployees: [],
  validEmployees: [],
  overwriteEmployees: [],
  conflictEmployees: [],

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
  },

  attachEventListeners() {
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    const dropzone = document.getElementById('excel-dropzone');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary-navy)';
        dropzone.style.background = '#EFF6FF';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#FFFFFF';
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#FFFFFF';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processExcelFile(e.dataTransfer.files[0]);
        }
      });
    }

    const btnDownload = document.getElementById('btn-download-import-template');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.downloadTemplate());
    }

    const btnDownload1000 = document.getElementById('btn-download-sample-1000');
    if (btnDownload1000) {
      btnDownload1000.addEventListener('click', () => {
        window.location.href = '/api/employees/sample-1000';
      });
    }

    const btnSubmit = document.getElementById('btn-submit-excel-import');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitImport());
    }

    const chkOverwrite = document.getElementById('import-chk-overwrite');
    if (chkOverwrite) {
      chkOverwrite.addEventListener('change', () => this.reValidate());
    }

    const chkSkipErrors = document.getElementById('import-chk-skip-errors');
    if (chkSkipErrors) {
      chkSkipErrors.addEventListener('change', () => this.updateSubmitButtonState());
    }
  },

  openModal() {
    this.resetState();
    const modal = document.getElementById('modal-import-employees');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('modal-import-employees');
    if (modal) modal.classList.remove('active');
  },

  resetState() {
    this.currentStep = 1;
    this.currentFilter = 'all';
    this.parsedEmployees = [];
    this.validEmployees = [];
    this.overwriteEmployees = [];
    this.conflictEmployees = [];

    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';

    this.setStepUI(1);

    const submitBtn = document.getElementById('btn-submit-excel-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Xác Nhận Nhập Dữ Liệu';
    }
  },

  setStepUI(step) {
    this.currentStep = step;
    const step1Banner = document.getElementById('import-step1-banner');
    const dropzone = document.getElementById('excel-dropzone');
    const previewContainer = document.getElementById('import-preview-container');
    const stepHeader1 = document.getElementById('import-stepper-1');
    const stepHeader2 = document.getElementById('import-stepper-2');

    if (step === 1) {
      if (step1Banner) step1Banner.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'block';
      if (previewContainer) previewContainer.style.display = 'none';

      if (stepHeader1) {
        stepHeader1.style.color = 'var(--primary-navy)';
        stepHeader1.style.fontWeight = '700';
        stepHeader1.style.borderBottom = '2px solid var(--primary-navy)';
      }
      if (stepHeader2) {
        stepHeader2.style.color = 'var(--text-muted)';
        stepHeader2.style.fontWeight = '500';
        stepHeader2.style.borderBottom = 'none';
      }
    } else {
      if (step1Banner) step1Banner.style.display = 'none';
      if (dropzone) dropzone.style.display = 'none';
      if (previewContainer) previewContainer.style.display = 'block';

      if (stepHeader1) {
        stepHeader1.style.color = 'var(--text-muted)';
        stepHeader1.style.fontWeight = '500';
        stepHeader1.style.borderBottom = 'none';
      }
      if (stepHeader2) {
        stepHeader2.style.color = '#047857';
        stepHeader2.style.fontWeight = '700';
        stepHeader2.style.borderBottom = '2px solid #10B981';
      }
    }
  },

  downloadTemplate() {
    window.location.href = '/api/employees/template';
  },

  handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      this.processExcelFile(file);
    }
  },

  processExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      utils.showToast('Vui lòng chọn file định dạng Excel (.xlsx hoặc .xls)', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });

        // Prefer sheet named "Danh_Sach_Nhan_Su", otherwise take first sheet
        let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('danh_sach') || s.toLowerCase().includes('nhan_su')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
        if (!jsonRows || jsonRows.length === 0) {
          utils.showToast('File Excel không có dữ liệu nhân sự!', 'warning');
          return;
        }

        this.rawJsonRows = jsonRows;
        this.parseAndValidate(jsonRows);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        utils.showToast('Không thể đọc file Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  reValidate() {
    if (this.rawJsonRows && this.rawJsonRows.length > 0) {
      this.parseAndValidate(this.rawJsonRows);
    }
  },

  parseAndValidate(rawRows) {
    this.parsedEmployees = [];
    this.validEmployees = [];
    this.overwriteEmployees = [];
    this.conflictEmployees = [];

    const overwrite = document.getElementById('import-chk-overwrite')?.checked ?? true;

    // Build DB Lookup Maps for Primary / Unique Key checking
    const dbEmpById = new Map();
    const dbEmpByTimeCode = new Map();
    const dbEmpByIdNumber = new Map();
    const dbEmpByEmail = new Map();

    (appData.employees || []).forEach(e => {
      if (e.employee_id) dbEmpById.set(e.employee_id.toUpperCase(), e);
      if (e.time_attendance_code) dbEmpByTimeCode.set(e.time_attendance_code.toString().trim(), e);
    });

    (appData.identity || []).forEach(i => {
      if (i.id_number) dbEmpByIdNumber.set(i.id_number.toString().trim(), i);
    });

    (appData.contacts || []).forEach(c => {
      if (c.work_email) dbEmpByEmail.set(c.work_email.toLowerCase().trim(), c);
    });

    // 1. Initial normalizations & collection for internal duplication check
    const normalizedRows = [];
    const fileEmpIdCounts = new Map();
    const fileIdNumCounts = new Map();
    const fileEmailCounts = new Map();
    const fileTimeCodeCounts = new Map();

    rawRows.forEach((row, idx) => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.replace(/\(\*\)/g, '').trim();
        normalized[cleanKey] = row[key];
      });

      const fullName = (normalized['Họ và tên'] || normalized['full_name'] || normalized['Họ tên'] || '').toString().trim();
      if (!fullName) return; // Skip empty rows

      const empId = (normalized['Mã nhân viên'] || normalized['employee_id'] || normalized['Mã NV'] || '').toString().trim().toUpperCase();
      const timeAttendanceCode = (normalized['Mã chấm công'] || normalized['time_attendance_code'] || '').toString().trim();
      const idNumber = (normalized['Số CCCD / CMND'] || normalized['Số CCCD / Hộ chiếu'] || normalized['Số CCCD'] || normalized['CCCD'] || normalized['id_number'] || '').toString().trim();
      const email = (normalized['Email công việc'] || normalized['Email'] || normalized['work_email'] || '').toString().toLowerCase().trim();

      if (empId) {
        fileEmpIdCounts.set(empId, (fileEmpIdCounts.get(empId) || 0) + 1);
      }
      if (idNumber) {
        fileIdNumCounts.set(idNumber, (fileIdNumCounts.get(idNumber) || 0) + 1);
      }
      if (email && email.includes('@')) {
        fileEmailCounts.set(email, (fileEmailCounts.get(email) || 0) + 1);
      }
      if (timeAttendanceCode) {
        fileTimeCodeCounts.set(timeAttendanceCode, (fileTimeCodeCounts.get(timeAttendanceCode) || 0) + 1);
      }

      normalizedRows.push({ rowIdx: idx + 1, normalized, empId, timeAttendanceCode, idNumber, email, fullName });
    });

    // 2. Comprehensive validation pass
    normalizedRows.forEach(({ rowIdx, normalized, empId, timeAttendanceCode, idNumber, email, fullName }) => {
      const gender = (normalized['Giới tính'] || normalized['gender'] || 'Nam').toString().trim();
      const dob = normalized['Ngày sinh (DD/MM/YYYY)'] || normalized['Ngày sinh'] || normalized['date_of_birth'] || '';
      const birthPlace = (normalized['Nơi sinh'] || normalized['birth_place'] || '').toString().trim();
      const nativePlace = (normalized['Nguyên quán'] || normalized['native_place'] || '').toString().trim();
      const ethnicity = (normalized['Dân tộc'] || normalized['ethnicity'] || 'Kinh').toString().trim();
      const religion = (normalized['Tôn giáo'] || normalized['religion'] || 'Không').toString().trim();
      const nationality = (normalized['Quốc tịch'] || normalized['nationality'] || 'Việt Nam').toString().trim();
      const maritalStatus = (normalized['Tình trạng hôn nhân'] || normalized['marital_status'] || 'Độc thân').toString().trim();
      const childrenCount = parseInt(normalized['Số con'] || normalized['children_count'] || 0, 10) || 0;

      const dept = (normalized['Mã phòng ban'] || normalized['Phòng/Ban'] || normalized['department_id'] || normalized['Phòng ban'] || '').toString().trim();
      const pos = (normalized['Mã chức danh / Vị trí'] || normalized['Mã chức danh'] || normalized['Chức danh'] || normalized['Vị trí'] || normalized['position_id'] || '').toString().trim();
      const jobRank = (normalized['Cấp bậc nhân sự'] || normalized['Cấp bậc'] || normalized['job_rank'] || 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ').toString().trim();
      const professionalTitle = (normalized['Chức danh chuyên môn'] || normalized['job_title'] || '').toString().trim();
      const workLocation = (normalized['Địa điểm làm việc'] || normalized['work_location'] || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội').toString().trim();
      const workArea = (normalized['Khối / Khu vực làm việc'] || normalized['Khối làm việc'] || normalized['work_area'] || 'Khối Văn phòng Tổng công ty').toString().trim();
      const directMgrId = (normalized['Mã quản lý trực tiếp'] || normalized['direct_manager_id'] || '').toString().trim();
      const directMgrName = (normalized['Họ tên quản lý trực tiếp'] || normalized['direct_manager_name'] || '').toString().trim();
      const indirectMgrId = (normalized['Mã quản lý gián tiếp'] || normalized['indirect_manager_id'] || '').toString().trim();
      const indirectMgrName = (normalized['Họ tên quản lý gián tiếp'] || normalized['indirect_manager_name'] || '').toString().trim();

      const laborNature = (normalized['Tính chất lao động'] || normalized['Tính chất'] || normalized['labor_nature'] || 'Chính thức').toString().trim();
      const status = (normalized['Trạng thái làm việc'] || normalized['Trạng thái'] || normalized['employment_status'] || 'Đang làm việc').toString().trim();
      const startDate = normalized['Ngày bắt đầu làm việc'] || normalized['Ngày vào làm'] || normalized['start_date'] || '';
      const endDate = normalized['Ngày kết thúc (HĐ/Nghỉ)'] || normalized['Ngày kết thúc'] || normalized['end_date'] || 'Không xác định';
      const contractType = (normalized['Loại hợp đồng'] || normalized['contract_type'] || 'Hợp đồng lao động không xác định thời hạn').toString().trim();
      const trialStartDate = normalized['Ngày bắt đầu thử việc'] || normalized['trial_start_date'] || startDate;
      const officialDate = normalized['Ngày ký HĐ chính thức'] || normalized['official_date'] || startDate;

      const phone = (normalized['Số ĐT di động'] || normalized['Số điện thoại'] || normalized['Điện thoại'] || normalized['mobile_phone'] || '').toString().trim();
      const homePhone = (normalized['Số ĐT bàn / Khác'] || normalized['Số ĐT bàn'] || normalized['home_phone'] || '').toString().trim();
      const personalEmail = (normalized['Email cá nhân'] || normalized['personal_email'] || '').toString().trim();
      const permAddress = (normalized['Địa chỉ thường trú'] || normalized['Thường trú'] || normalized['permanent_address_full'] || '').toString().trim();
      const currAddress = (normalized['Địa chỉ tạm trú / Hiện tại'] || normalized['Địa chỉ hiện tại'] || normalized['Địa chỉ tạm trú'] || normalized['current_address_full'] || permAddress).toString().trim();

      const idIssueDate = normalized['Ngày cấp CCCD (DD/MM/YYYY)'] || normalized['Ngày cấp CCCD'] || normalized['Ngày cấp'] || normalized['id_issue_date'] || '';
      const idIssuePlace = (normalized['Nơi cấp CCCD'] || normalized['Nơi cấp'] || normalized['id_issue_place'] || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội').toString().trim();
      const idExpiryDate = normalized['Ngày hết hạn CCCD'] || normalized['id_expiry_date'] || '';
      const passportNumber = (normalized['Số hộ chiếu (Passport)'] || normalized['Số hộ chiếu'] || normalized['passport_number'] || '').toString().trim();
      const passportIssueDate = normalized['Ngày cấp hộ chiếu'] || normalized['passport_issue_date'] || '';
      const taxCode = (normalized['Mã số thuế cá nhân'] || normalized['Mã số thuế'] || normalized['tax_code'] || '').toString().trim();

      const salaryGrade = parseInt(normalized['Bậc lương'] || normalized['salary_grade'] || 3, 10) || 3;
      const baseSalary = parseFloat((normalized['Lương cơ bản (VNĐ)'] || normalized['Lương cơ bản'] || normalized['base_salary'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
      const totalSalary = parseFloat((normalized['Tổng lương / Thu nhập (VNĐ)'] || normalized['Tổng lương'] || normalized['total_salary'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
      const insuranceSalary = parseFloat((normalized['Lương đóng BHXH (VNĐ)'] || normalized['Lương đóng BHXH'] || normalized['insurance_salary'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
      const bankAccount = (normalized['Số tài khoản ngân hàng'] || normalized['Số tài khoản'] || normalized['STK'] || normalized['bank_account_number'] || '').toString().trim();
      const bankName = (normalized['Tên ngân hàng'] || normalized['Ngân hàng'] || normalized['bank_name'] || 'Vietcombank').toString().trim();
      const bankBranch = (normalized['Chi nhánh ngân hàng'] || normalized['Chi nhánh'] || normalized['bank_branch'] || 'Chi nhánh Hà Nội').toString().trim();

      const hasInsurance = (normalized['Tham gia BHXH'] || normalized['has_insurance'] || 'Tham gia đầy đủ').toString().trim();
      const socialInsuranceBook = (normalized['Số sổ / Mã số BHXH'] || normalized['Số sổ BHXH'] || normalized['Mã số BHXH'] || normalized['social_insurance_book_no'] || '').toString().trim();
      const insuranceJoinDate = normalized['Ngày tham gia BHXH'] || normalized['insurance_join_date'] || startDate;
      const hospitalRegistered = (normalized['Nơi ĐK khám chữa bệnh ban đầu'] || normalized['Nơi ĐK KCB ban đầu'] || normalized['hospital_registered'] || 'Bệnh viện Bạch Mai - Hà Nội').toString().trim();
      const unionMember = (normalized['Đoàn viên công đoàn'] || normalized['union_member'] || 'Đoàn viên').toString().trim();

      const eduLevel = (normalized['Trình độ học vấn'] || normalized['Trình độ'] || normalized['education_level'] || 'Đại học').toString().trim();
      const degreeType = (normalized['Hình thức đào tạo'] || normalized['degree_type'] || 'Chính quy').toString().trim();
      const institution = (normalized['Trường / Cơ sở đào tạo'] || normalized['Trường'] || normalized['institution'] || 'Đại học').toString().trim();
      const eduMajor = (normalized['Chuyên ngành đào tạo'] || normalized['Chuyên ngành'] || normalized['major'] || '').toString().trim();
      const gradYear = parseInt(normalized['Năm tốt nghiệp'] || normalized['graduation_year'] || 2020, 10) || 2020;
      const gradClassification = (normalized['Xếp loại tốt nghiệp'] || normalized['Xếp loại'] || normalized['classification'] || 'Khá').toString().trim();
      const otherCerts = (normalized['Bằng cấp chuyên môn khác & Chứng chỉ'] || normalized['Bằng cấp khác'] || normalized['other_certificates'] || '').toString().trim();

      const emergName = (normalized['Họ tên người liên hệ khẩn cấp'] || normalized['Người liên hệ khẩn cấp'] || normalized['Người khẩn cấp'] || normalized['emergency_name'] || '').toString().trim();
      const emergRelation = (normalized['Mối quan hệ khẩn cấp'] || normalized['Quan hệ khẩn cấp'] || normalized['Quan hệ'] || normalized['emergency_relation'] || 'Người thân').toString().trim();
      const emergPhone = (normalized['Số ĐT khẩn cấp'] || normalized['SĐT khẩn cấp'] || normalized['emergency_phone'] || '').toString().trim();

      const errors = [];
      const warnings = [];
      let rowStatus = 'VALID'; // 'VALID' | 'OVERWRITE' | 'CONFLICT'

      // Check 1: Required Fields
      if (!fullName) errors.push('Thiếu Họ và tên (*)');
      if (!dept) warnings.push('Chưa có Mã phòng ban (sẽ dùng mặc định)');
      if (!pos) warnings.push('Chưa có Mã vị trí (sẽ dùng mặc định)');

      // Check 2: Internal Duplicate in File
      if (empId && fileEmpIdCounts.get(empId) > 1) {
        errors.push(`Trùng Mã nhân viên ${empId} với dòng khác trong file Excel`);
      }
      if (idNumber && fileIdNumCounts.get(idNumber) > 1) {
        errors.push(`Trùng số CCCD ${idNumber} với dòng khác trong file Excel`);
      }
      if (email && fileEmailCounts.get(email) > 1) {
        errors.push(`Trùng Email ${email} với dòng khác trong file Excel`);
      }

      // Check 3: Cross-check against Database Records
      const dbEmpWithId = empId ? dbEmpById.get(empId) : null;
      if (dbEmpWithId) {
        if (overwrite) {
          rowStatus = 'OVERWRITE';
        } else {
          errors.push(`Mã NV ${empId} đã tồn tại trong hệ thống (Đang tắt chế độ ghi đè)`);
        }
      }

      // Check 4: CCCD uniqueness against DB
      if (idNumber) {
        const existingCCCD = dbEmpByIdNumber.get(idNumber);
        if (existingCCCD && (!empId || existingCCCD.employee_id !== empId)) {
          errors.push(`Số CCCD ${idNumber} trùng với NV ${existingCCCD.employee_id} (${existingCCCD.full_name}) trong hệ thống`);
        }
      }

      // Check 5: Work Email uniqueness against DB
      if (email && email.includes('@')) {
        const existingEmail = dbEmpByEmail.get(email);
        if (existingEmail && (!empId || existingEmail.employee_id !== empId)) {
          errors.push(`Email ${email} trùng với NV ${existingEmail.employee_id} (${existingEmail.full_name}) trong hệ thống`);
        }
      }

      // Final status assignment
      if (errors.length > 0) {
        rowStatus = 'CONFLICT';
      } else if (rowStatus !== 'OVERWRITE') {
        rowStatus = 'VALID';
      }

      const item = {
        stt: rowIdx,
        employee_id: empId,
        time_attendance_code: timeAttendanceCode,
        full_name: fullName,
        gender,
        date_of_birth: dob,
        birth_place: birthPlace,
        native_place: nativePlace,
        ethnicity,
        religion,
        nationality,
        marital_status: maritalStatus,
        children_count: childrenCount,
        department_id: dept,
        position_id: pos,
        job_rank: jobRank,
        job_title: professionalTitle,
        work_location: workLocation,
        work_area: workArea,
        direct_manager_id: directMgrId,
        direct_manager_name: directMgrName,
        indirect_manager_id: indirectMgrId,
        indirect_manager_name: indirectMgrName,
        labor_nature: laborNature,
        employment_status: status,
        start_date: startDate,
        end_date: endDate,
        contract_type: contractType,
        trial_start_date: trialStartDate,
        official_date: officialDate,
        mobile_phone: phone,
        home_phone: homePhone,
        work_email: email,
        personal_email: personalEmail,
        permanent_address_full: permAddress,
        current_address_full: currAddress,
        id_number: idNumber,
        id_issue_date: idIssueDate,
        id_issue_place: idIssuePlace,
        id_expiry_date: idExpiryDate,
        passport_number: passportNumber,
        passport_issue_date: passportIssueDate,
        tax_code: taxCode,
        salary_grade: salaryGrade,
        base_salary: baseSalary,
        total_salary: totalSalary,
        insurance_salary: insuranceSalary,
        bank_account_number: bankAccount,
        bank_name: bankName,
        bank_branch: bankBranch,
        has_insurance: hasInsurance,
        social_insurance_book_no: socialInsuranceBook,
        insurance_join_date: insuranceJoinDate,
        hospital_registered: hospitalRegistered,
        union_member: unionMember,
        education_level: eduLevel,
        degree_type: degreeType,
        institution: institution,
        major: eduMajor,
        graduation_year: gradYear,
        classification: gradClassification,
        other_certificates: otherCerts,
        emergency_name: emergName,
        emergency_relation: emergRelation,
        emergency_phone: emergPhone,
        status: rowStatus,
        errors,
        warnings
      };

      this.parsedEmployees.push(item);
      if (rowStatus === 'VALID') {
        this.validEmployees.push(item);
      } else if (rowStatus === 'OVERWRITE') {
        this.overwriteEmployees.push(item);
      } else {
        this.conflictEmployees.push(item);
      }
    });

    this.setStepUI(2);
    this.renderPreview();
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.renderPreviewTable();

    // Update active tab style
    ['all', 'valid', 'overwrite', 'conflict'].forEach(f => {
      const tab = document.getElementById(`import-tab-${f}`);
      if (tab) {
        if (f === filter) {
          tab.style.background = 'var(--primary-navy)';
          tab.style.color = '#FFFFFF';
          tab.style.borderColor = 'var(--primary-navy)';
        } else {
          tab.style.background = '#FFFFFF';
          tab.style.color = 'var(--text-secondary)';
          tab.style.borderColor = 'var(--border-color)';
        }
      }
    });
  },

  renderPreview() {
    const total = this.parsedEmployees.length;
    const validCount = this.validEmployees.length;
    const overwriteCount = this.overwriteEmployees.length;
    const conflictCount = this.conflictEmployees.length;

    // Summary Stat Badges
    const statSummary = document.getElementById('import-stat-summary');
    if (statSummary) {
      statSummary.innerHTML = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button type="button" id="import-tab-all" onclick="appImport.setFilter('all')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'all' ? 'background: var(--primary-navy); color: #fff; border-color: var(--primary-navy);' : 'background: #fff; color: var(--text-secondary); border: 1px solid var(--border-color);'}">
            <i class="fa-solid fa-list"></i> Tất cả (${total})
          </button>
          <button type="button" id="import-tab-valid" onclick="appImport.setFilter('valid')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'valid' ? 'background: #059669; color: #fff; border-color: #059669;' : 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;'}">
            <i class="fa-solid fa-circle-check"></i> Hợp lệ mới (${validCount})
          </button>
          <button type="button" id="import-tab-overwrite" onclick="appImport.setFilter('overwrite')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'overwrite' ? 'background: #D97706; color: #fff; border-color: #D97706;' : 'background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;'}">
            <i class="fa-solid fa-arrows-rotate"></i> Trùng Mã NV (${overwriteCount})
          </button>
          <button type="button" id="import-tab-conflict" onclick="appImport.setFilter('conflict')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'conflict' ? 'background: #DC2626; color: #fff; border-color: #DC2626;' : 'background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA;'}">
            <i class="fa-solid fa-triangle-exclamation"></i> Xung đột / Lỗi (${conflictCount})
          </button>
        </div>
      `;
    }

    this.renderPreviewTable();
    this.updateSubmitButtonState();
  },

  renderPreviewTable() {
    const tbody = document.getElementById('import-preview-tbody');
    if (!tbody) return;

    let itemsToRender = this.parsedEmployees;
    if (this.currentFilter === 'valid') itemsToRender = this.validEmployees;
    else if (this.currentFilter === 'overwrite') itemsToRender = this.overwriteEmployees;
    else if (this.currentFilter === 'conflict') itemsToRender = this.conflictEmployees;

    if (itemsToRender.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 6px; display: block;"></i>
            Không có dòng dữ liệu nào trong danh mục này.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = itemsToRender.slice(0, 100).map(e => {
      let statusBadge = '';
      let errorMsgHtml = '';

      if (e.status === 'VALID') {
        statusBadge = '<span class="badge badge-active" style="font-size: 10.5px;"><i class="fa-solid fa-check"></i> Hợp lệ (Mới)</span>';
      } else if (e.status === 'OVERWRITE') {
        statusBadge = '<span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 10.5px; border: 1px solid #FDE68A;"><i class="fa-solid fa-arrows-rotate"></i> Ghi đè (Mã NV)</span>';
      } else {
        statusBadge = '<span class="badge badge-resigned" style="font-size: 10.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Xung đột Primary Key</span>';
      }

      if (e.errors && e.errors.length > 0) {
        errorMsgHtml = `<div style="font-size: 11px; color: #DC2626; margin-top: 4px; font-weight: 500;"><i class="fa-solid fa-circle-xmark"></i> ${e.errors.join('; ')}</div>`;
      } else if (e.warnings && e.warnings.length > 0) {
        errorMsgHtml = `<div style="font-size: 11px; color: #D97706; margin-top: 4px;"><i class="fa-solid fa-circle-exclamation"></i> ${e.warnings.join('; ')}</div>`;
      }

      const hasIdError = e.errors.some(err => err.toLowerCase().includes('mã') || err.toLowerCase().includes('id'));
      const hasCccdError = e.errors.some(err => err.toLowerCase().includes('cccd'));
      const hasEmailError = e.errors.some(err => err.toLowerCase().includes('email'));

      const idStyle = hasIdError ? 'color: #DC2626; font-weight: 700; background: #FEF2F2; padding: 2px 4px; border-radius: 3px;' : 'color: var(--primary-navy); font-weight: 600;';
      const cccdStyle = hasCccdError ? 'color: #DC2626; font-weight: 700; background: #FEF2F2; padding: 2px 4px; border-radius: 3px;' : '';
      const emailStyle = hasEmailError ? 'color: #DC2626; font-weight: 700; background: #FEF2F2; padding: 2px 4px; border-radius: 3px;' : '';

      return `
        <tr style="${e.status === 'CONFLICT' ? 'background: #FFF5F5;' : ''}">
          <td style="text-align: center; color: var(--text-secondary); font-size: 11.5px;">${e.stt}</td>
          <td style="text-align: center;">${statusBadge}</td>
          <td><span style="${idStyle}; font-family: monospace;">${e.employee_id || '(Tự tạo)'}</span></td>
          <td>
            <strong>${e.full_name}</strong>
            ${errorMsgHtml}
          </td>
          <td>${e.gender}</td>
          <td><span style="${cccdStyle}">${e.id_number || '-'}</span></td>
          <td><span style="${emailStyle}">${e.work_email || '-'}</span></td>
          <td><span class="badge badge-navy">${e.department_id || 'Mặc định'}</span></td>
          <td>${e.position_id || 'Mặc định'}</td>
        </tr>
      `;
    }).join('');
  },

  updateSubmitButtonState() {
    const submitBtn = document.getElementById('btn-submit-excel-import');
    const chkSkipErrors = document.getElementById('import-chk-skip-errors')?.checked ?? true;
    if (!submitBtn) return;

    const readyCount = this.validEmployees.length + this.overwriteEmployees.length;
    const conflictCount = this.conflictEmployees.length;

    if (conflictCount > 0 && !chkSkipErrors) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Có ${conflictCount} Dòng Xung Đột (Cần xử lý hoặc chọn bỏ qua)`;
      submitBtn.style.background = '#94A3B8';
      submitBtn.style.borderColor = '#64748B';
    } else if (readyCount === 0) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Không có dòng dữ liệu hợp lệ để nhập';
      submitBtn.style.background = '#94A3B8';
      submitBtn.style.borderColor = '#64748B';
    } else {
      submitBtn.disabled = false;
      submitBtn.style.background = '#10B981';
      submitBtn.style.borderColor = '#059669';
      if (conflictCount > 0) {
        submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Xác Nhận Nhập ${readyCount} Nhân Sự (Bỏ qua ${conflictCount} dòng lỗi)`;
      } else {
        submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Xác Nhận Nhập ${readyCount} Nhân Sự Hợp Lệ`;
      }
    }
  },

  async submitImport() {
    if (this.isImporting) return;

    const overwrite = document.getElementById('import-chk-overwrite')?.checked ?? true;
    const chkSkipErrors = document.getElementById('import-chk-skip-errors')?.checked ?? true;

    const toImport = [...this.validEmployees, ...this.overwriteEmployees];
    if (toImport.length === 0) {
      utils.showToast('Không có dữ liệu hợp lệ để nhập vào hệ thống', 'warning');
      return;
    }

    this.isImporting = true;
    const submitBtn = document.getElementById('btn-submit-excel-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đối soát và lưu CSDL...';
    }

    try {
      const res = await fetch('/api/employees/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees: toImport,
          overwrite: overwrite,
          skip_errors: chkSkipErrors,
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });

      const json = await res.json();
      if (json.success) {
        utils.showToast(json.message || 'Nhập Excel thành công!', 'success');
        this.closeModal();

        // Reload all data
        await appData.init();
        appEmployees.applyFilters();
        appDashboard.renderCharts();
        appOrganization.updateAllDropdowns();
        if (window.appReports) appReports.render();
      } else {
        utils.showToast(json.message || 'Lỗi kiểm tra xung đột dữ liệu từ Excel', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ khi nhập Excel: ' + err.message, 'error');
    } finally {
      this.isImporting = false;
      this.updateSubmitButtonState();
    }
  }
};
