const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const googleSheets = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hrm-trunghai-enterprise-jwt-key-2026-super-secure';
const SALT_ROUNDS = 10;

// ==========================================
// 1. SECURITY HEADERS & MIDDLEWARES
// ==========================================

// Helmet HTTP Security Headers (CSP configured for CDN FontAwesome, Chart.js & inline handlers)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            styleSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://docs.google.com", "https://sheets.googleapis.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://*.jsdelivr.net"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors());

// Rate Limiter for Login (100 attempts per 15 mins to prevent Brute-force while allowing development/testing)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Đã vượt quá số lần thử đăng nhập cho phép. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false
});

// General API Rate Limiter (1200 requests per 5 minutes per IP)
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 1200,
    message: { success: false, message: 'Tần suất gửi yêu cầu quá cao. Vui lòng thử lại sau giây lát.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ==========================================
// 2. SECURITY & AUTH HELPERS
// ==========================================

// Verify password with Bcrypt and auto-upgrade from plain-text
async function verifyPassword(inputPassword, storedPassword) {
    if (!storedPassword || !inputPassword) return false;

    // Check if stored password is a bcrypt hash
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
        return await bcrypt.compare(inputPassword, storedPassword);
    }

    // Legacy plain-text fallback
    return inputPassword === storedPassword;
}

// Hash password with Bcrypt
async function hashPassword(plainPassword) {
    if (!plainPassword) plainPassword = 'password@123';
    // If already hashed, don't rehash
    if (plainPassword.startsWith('$2a$') || plainPassword.startsWith('$2b$')) {
        return plainPassword;
    }
    return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thực hiện thao tác này' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
        }
        req.user = user;
        next();
    });
}

// Optional Auth (for smooth client transition)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next();
    }
}

// Path to JSON database & uploads directory
const DB_PATH = path.join(__dirname, 'database_schema.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'database_schema.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
let inMemoryDb = null;

// Ensure default admin & demo accounts exist in database
function ensureDefaultAccounts(db) {
    if (!db || typeof db !== 'object') return;
    if (!db.tables) db.tables = {};
    if (!db.tables['11_System_Accounts']) db.tables['11_System_Accounts'] = [];

    const accounts = db.tables['11_System_Accounts'];
    const adminHash = bcrypt.hashSync('123456', SALT_ROUNDS);

    // 1. Ensure Super Admin account (Huỳnh Thanh Long)
    let adminAcc = accounts.find(a =>
        (a.employee_id && (a.employee_id === 'TH-0001' || a.employee_id === 'TH-1948')) ||
        (a.account_email && (a.account_email.toLowerCase() === 'longht@trunghaico.vn' || a.account_email.toLowerCase() === 'admin@trunghai.vn')) ||
        (a.username && (a.username.toLowerCase() === 'longht' || a.username.toLowerCase() === 'admin'))
    );

    if (adminAcc) {
        adminAcc.account_id = adminAcc.account_id || 'ACC-TH0001';
        adminAcc.employee_id = adminAcc.employee_id || 'TH-0001';
        adminAcc.username = adminAcc.username || 'longht';
        adminAcc.full_name = adminAcc.full_name || 'Huỳnh Thanh Long';
        adminAcc.account_email = adminAcc.account_email || 'longht@trunghaico.vn';
        adminAcc.role = 'ADMIN';
        adminAcc.account_status = 'Kích hoạt';
        if (!adminAcc.password) {
            adminAcc.password = adminHash;
        }
    } else {
        accounts.unshift({
            account_id: 'ACC-TH0001',
            employee_id: 'TH-0001',
            username: 'longht',
            full_name: 'Huỳnh Thanh Long',
            account_email: 'longht@trunghaico.vn',
            role: 'ADMIN',
            account_status: 'Kích hoạt',
            password: adminHash,
            created_at: new Date().toISOString()
        });
    }

    // 2. Ensure Standard User demo account (Trần Minh Đức)
    let userAcc = accounts.find(a =>
        (a.employee_id && a.employee_id === 'TH-0003') ||
        (a.account_email && a.account_email.toLowerCase() === 'test@trunghaico.vn')
    );

    if (userAcc) {
        userAcc.account_email = userAcc.account_email || 'test@trunghaico.vn';
        userAcc.role = userAcc.role || 'USER';
        userAcc.account_status = 'Kích hoạt';
    } else {
        accounts.push({
            account_id: 'ACC-TH0003',
            employee_id: 'TH-0003',
            username: 'test',
            full_name: 'Trần Minh Đức',
            account_email: 'test@trunghaico.vn',
            role: 'USER',
            account_status: 'Kích hoạt',
            password: adminHash,
            created_at: new Date().toISOString()
        });
    }
}

// Helper to load DB
function loadDatabase() {
    if (inMemoryDb && inMemoryDb.tables && Object.keys(inMemoryDb.tables).length > 0) {
        return inMemoryDb;
    }
    try {
        if (fs.existsSync(TMP_DB_PATH)) {
            const raw = fs.readFileSync(TMP_DB_PATH, 'utf-8');
            const db = JSON.parse(raw);
            ensureDefaultAccounts(db);
            inMemoryDb = db;
            return db;
        }
    } catch (e) { }

    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            const db = JSON.parse(raw);
            ensureDefaultAccounts(db);
            inMemoryDb = db;
            return db;
        }
    } catch (e) {
        console.error('Error reading database_schema.json:', e);
    }
    const db = { tables: {} };
    ensureDefaultAccounts(db);
    inMemoryDb = db;
    return db;
}

// Path to Excel database
const EXCEL_DB_PATH = path.join(__dirname, 'HRM_Database_Normalized.xlsx');

// Helper to sync JSON tables to Excel file in real-time
function syncToExcelFile(db) {
    try {
        const wb = XLSX.utils.book_new();
        for (const [sheetName, rows] of Object.entries(db.tables || {})) {
            const safeSheetName = sheetName.substring(0, 31);
            const ws = XLSX.utils.json_to_sheet(rows || []);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        }
        XLSX.writeFile(wb, EXCEL_DB_PATH);
    } catch (e) {
        // Handle lock if file is open in Microsoft Excel or on read-only system
        console.warn('⚠️ Ghi chú đồng bộ Excel (file đang mở hoặc môi trường read-only):', e.message);
    }
}

// Helper to save DB
function saveDatabase(data) {
    inMemoryDb = data;
    let saved = false;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        saved = true;
    } catch (e) {
        // Read-only filesystem (e.g. Vercel)
    }

    try {
        fs.writeFileSync(TMP_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        saved = true;
    } catch (e) { }

    // Tự động đồng bộ cập nhật vào file Excel HRM_Database_Normalized.xlsx
    setTimeout(() => syncToExcelFile(data), 10);
    // Tự động đồng bộ cập nhật lên Google Sheets (nếu đã kết nối)
    googleSheets.triggerBackgroundSync(data);
    return saved;
}

// ==========================================
// SYSTEM ACTIVITY LOGGER HELPER
// ==========================================
function recordLog(db, { action_type, module, description, user_id, user_name, user_role, ip }) {
    if (!db.tables['12_System_Logs']) {
        db.tables['12_System_Logs'] = [];
    }
    const logEntry = {
        log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        user_id: user_id || 'TH-1948',
        user_name: user_name || 'Huỳnh Thanh Long',
        user_role: user_role || 'ADMIN',
        action_type: action_type || 'INFO',
        module: module || 'Hệ thống',
        description: description || '',
        ip_address: ip || '127.0.0.1'
    };
    db.tables['12_System_Logs'].unshift(logEntry);
    if (db.tables['12_System_Logs'].length > 3000) {
        db.tables['12_System_Logs'] = db.tables['12_System_Logs'].slice(0, 3000);
    }
    return logEntry;
}

// Auto-sync specific tables to Google Sheets directly
async function autoSyncToSheets(db, tableNames) {
    try {
        const cfg = googleSheets.getConfig();
        if (!cfg.autoSyncOnSave || !cfg.spreadsheetId) return;
        await googleSheets.exportTablesToGoogleSheets(db, tableNames);
    } catch (e) {
        console.warn('[AutoSync to Sheets Warning]:', e.message);
    }
}

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. GET FULL DATABASE
app.get('/api/data', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        tables: db.tables,
        company: db.company_info || {
            brand_name: "TRUNG HẢI",
            full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
            subtitle: "HRM ENTERPRISE",
            logo_url: "assets/logo.png",
            tax_code: "0101234567",
            phone: "024.1234.5678",
            email: "contact@trunghaico.vn",
            address: "Tòa nhà Trung Hải, Hà Nội",
            website: "https://trunghaico.vn"
        }
    });
});

// 2. GET DASHBOARD STATS
app.get('/api/stats', (req, res) => {
    const db = loadDatabase();
    const employees = db.tables['03_Employees'] || [];
    const departments = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.employment_status === 'Đang làm việc').length;
    const probationEmployees = employees.filter(e => e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc').length;
    const officialEmployees = employees.filter(e => e.labor_nature === 'Chính thức').length;
    const resignedEmployees = employees.filter(e => e.employment_status === 'Đã nghỉ việc').length;
    const maleCount = employees.filter(e => e.gender === 'Nam').length;
    const femaleCount = employees.filter(e => e.gender === 'Nữ').length;

    // Headcount by department
    const deptCounts = {};
    employees.forEach(e => {
        const dId = e.department_id || 'UNKNOWN';
        deptCounts[dId] = (deptCounts[dId] || 0) + 1;
    });

    const deptStats = departments.map(d => ({
        department_id: d.department_id,
        department_name: d.department_name,
        count: deptCounts[d.department_id] || 0
    })).sort((a, b) => b.count - a.count);

    // Salary total
    let totalBaseSalary = 0;
    let salaryCount = 0;
    salaries.forEach(s => {
        if (s.base_salary && s.base_salary > 0) {
            totalBaseSalary += s.base_salary;
            salaryCount++;
        }
    });
    const avgBaseSalary = salaryCount > 0 ? Math.round(totalBaseSalary / salaryCount) : 0;

    // Upcoming probation ends / contract review
    const now = new Date('2026-08-24');
    const upcomingProbations = employees.filter(e => {
        if (e.employment_status === 'Đang làm việc' && (e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc')) {
            return true;
        }
        return false;
    }).slice(0, 10);

    res.json({
        success: true,
        stats: {
            totalEmployees,
            activeEmployees,
            probationEmployees,
            officialEmployees,
            resignedEmployees,
            maleCount,
            femaleCount,
            totalDepartments: departments.length,
            totalPositions: positions.length,
            avgBaseSalary,
            totalPayrollEstimate: totalBaseSalary,
            departmentBreakdown: deptStats,
            upcomingProbations
        }
    });
});

// 3. GET EMPLOYEES (With Filtering, Search, Pagination)
app.get('/api/employees', (req, res) => {
    const db = loadDatabase();
    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const edu = db.tables['07_Education'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];

    const deptMap = {};
    depts.forEach(d => deptMap[d.department_id] = d.department_name);
    const posMap = {};
    pos.forEach(p => posMap[p.position_id] = p.position_name);

    const contactMap = {};
    contacts.forEach(c => contactMap[c.employee_id] = c);
    const salaryMap = {};
    salaries.forEach(s => salaryMap[s.employee_id] = s);
    const identityMap = {};
    identity.forEach(i => identityMap[i.employee_id] = i);
    const insMap = {};
    insurance.forEach(i => insMap[i.employee_id] = i);
    const eduMap = {};
    edu.forEach(ed => eduMap[ed.employee_id] = ed);
    const contractMap = {};
    contracts.forEach(ct => contractMap[ct.employee_id] = ct);
    const emergMap = {};
    emergency.forEach(em => emergMap[em.employee_id] = em);

    // Merge full row with all 34 fields
    let result = employees.map(e => {
        const c = contactMap[e.employee_id] || {};
        const s = salaryMap[e.employee_id] || {};
        const idDoc = identityMap[e.employee_id] || {};
        const ins = insMap[e.employee_id] || {};
        const ed = eduMap[e.employee_id] || {};
        const ct = contractMap[e.employee_id] || {};
        const em = emergMap[e.employee_id] || {};

        return {
            ...e,
            department_name: deptMap[e.department_id] || e.department_id,
            position_name: posMap[e.position_id] || e.position_id,
            job_rank: e.job_rank || (s.salary_grade ? `Cấp ${s.salary_grade}` : 'Cấp 3'),
            children_count: e.children_count !== undefined ? e.children_count : 0,
            start_date: e.start_date || e.trial_start_date || e.probation_start_date || '',
            end_date: e.end_date || e.resignation_date || 'Không xác định',
            contract_type: e.contract_type || ct.contract_type || 'Hợp đồng lao động',
            mobile_phone: c.mobile_phone || '',
            home_phone: c.home_phone || '',
            work_email: c.work_email || '',
            personal_email: c.personal_email || '',
            permanent_address_full: c.permanent_address_full || '',
            current_address_full: c.current_address_full || '',
            doc_type: idDoc.doc_type || 'CCCD',
            id_number: idDoc.id_number || '',
            id_issue_date: idDoc.id_issue_date || '',
            id_issue_place: idDoc.id_issue_place || '',
            id_expiry_date: idDoc.id_expiry_date || '',
            passport_number: idDoc.passport_number || '',
            salary_grade: s.salary_grade || 1,
            base_salary: s.base_salary || 0,
            total_salary: s.total_salary || s.base_salary || 0,
            insurance_salary: s.insurance_salary || 0,
            bank_account_number: s.bank_account_number || '',
            bank_name: s.bank_name || '',
            bank_branch: s.bank_branch || '',
            has_insurance: ins.has_insurance || 'Không tham gia',
            social_insurance_book_no: ins.social_insurance_book_no || '',
            social_insurance_code: ins.social_insurance_code || '',
            hospital_registered: ins.hospital_registered || '',
            education_level: ed.education_level || e.education_level || 'Đại học',
            major: ed.major || e.major || '',
            other_certificates: e.other_certificates || ed.other_certificates || '',
            emergency_contact_name: em.contact_name || '',
            emergency_contact_relation: em.relationship || '',
            emergency_contact_phone: em.mobile_phone || '',
            emergency_contact_full: em.contact_name ? `${em.contact_name} (${em.relationship || ''}) - ${em.mobile_phone || ''}` : ''
        };
    });

    // Query parameters
    const { search, department_id, position_id, employment_status, labor_nature, gender, page = 1, limit = 25 } = req.query;

    if (search) {
        const q = search.toLowerCase().trim();
        result = result.filter(e =>
            (e.employee_id && e.employee_id.toLowerCase().includes(q)) ||
            (e.full_name && e.full_name.toLowerCase().includes(q)) ||
            (e.mobile_phone && e.mobile_phone.includes(q)) ||
            (e.work_email && e.work_email.toLowerCase().includes(q)) ||
            (e.id_number && e.id_number.includes(q)) ||
            (e.department_name && e.department_name.toLowerCase().includes(q)) ||
            (e.position_name && e.position_name.toLowerCase().includes(q))
        );
    }

    if (department_id) {
        result = result.filter(e => e.department_id === department_id);
    }
    if (position_id) {
        result = result.filter(e => e.position_id === position_id);
    }
    if (employment_status) {
        result = result.filter(e => e.employment_status === employment_status);
    }
    if (labor_nature) {
        result = result.filter(e => e.labor_nature === labor_nature);
    }
    if (gender) {
        result = result.filter(e => e.gender === gender);
    }

    const total = result.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const start = (pageNum - 1) * limitNum;
    const paginated = limitNum > 0 ? result.slice(start, start + limitNum) : result;

    res.json({
        success: true,
        total,
        page: pageNum,
        totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
        data: paginated
    });
});

// ==========================================
// EXCEL IMPORT & TEMPLATE GENERATION
// ==========================================

// ==========================================
// EXCEL IMPORT & TEMPLATE GENERATION
// ==========================================

// 1. DOWNLOAD COMPREHENSIVE EXCEL TEMPLATE (FULL 55+ ATTRIBUTES)
app.get('/api/employees/template', (req, res) => {
    const db = loadDatabase();
    const depts = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];

    const wb = XLSX.utils.book_new();

    // Sheet 1: Comprehensive Data Entry Form
    const sampleHeaders = [
        // 1. Thông tin định danh & Nhân thân
        'Mã nhân viên (*)',
        'Mã chấm công',
        'Họ và tên (*)',
        'Giới tính (*)',
        'Ngày sinh (DD/MM/YYYY)',
        'Nơi sinh',
        'Nguyên quán',
        'Dân tộc',
        'Tôn giáo',
        'Quốc tịch',
        'Tình trạng hôn nhân',
        'Số con',

        // 2. Tổ chức & Công tác
        'Mã phòng ban (*)',
        'Mã chức danh / Vị trí (*)',
        'Cấp bậc nhân sự',
        'Chức danh chuyên môn',
        'Địa điểm làm việc',
        'Khối / Khu vực làm việc',
        'Mã quản lý trực tiếp',
        'Họ tên quản lý trực tiếp',
        'Mã quản lý gián tiếp',
        'Họ tên quản lý gián tiếp',
        'Tính chất lao động (*)',
        'Trạng thái làm việc (*)',
        'Ngày bắt đầu làm việc (*)',
        'Ngày kết thúc (HĐ/Nghỉ)',
        'Loại hợp đồng (*)',
        'Ngày bắt đầu thử việc',
        'Ngày ký HĐ chính thức',

        // 3. Liên hệ & Cư trú
        'Số ĐT di động (*)',
        'Số ĐT bàn / Khác',
        'Email công việc',
        'Email cá nhân',
        'Địa chỉ thường trú',
        'Địa chỉ tạm trú / Hiện tại',

        // 4. Giấy tờ tùy thân & Thuế
        'Số CCCD / CMND',
        'Ngày cấp CCCD (DD/MM/YYYY)',
        'Nơi cấp CCCD',
        'Ngày hết hạn CCCD',
        'Số hộ chiếu (Passport)',
        'Ngày cấp hộ chiếu',
        'Mã số thuế cá nhân',

        // 5. Lương & Ngân hàng
        'Bậc lương',
        'Lương cơ bản (VNĐ) (*)',
        'Tổng lương / Thu nhập (VNĐ)',
        'Lương đóng BHXH (VNĐ)',
        'Số tài khoản ngân hàng',
        'Tên ngân hàng',
        'Chi nhánh ngân hàng',

        // 6. Bảo hiểm & Công đoàn
        'Tham gia BHXH',
        'Số sổ / Mã số BHXH',
        'Ngày tham gia BHXH',
        'Nơi ĐK khám chữa bệnh ban đầu',
        'Đoàn viên công đoàn',

        // 7. Học vấn & Bằng cấp
        'Trình độ học vấn',
        'Hình thức đào tạo',
        'Trường / Cơ sở đào tạo',
        'Chuyên ngành đào tạo',
        'Năm tốt nghiệp',
        'Xếp loại tốt nghiệp',
        'Bằng cấp chuyên môn khác & Chứng chỉ',

        // 8. Thân nhân khẩn cấp
        'Họ tên người liên hệ khẩn cấp',
        'Mối quan hệ khẩn cấp',
        'Số ĐT khẩn cấp'
    ];

    const sampleRows = [
        sampleHeaders,
        [
            'TH-2001',
            '2001',
            'Nguyễn Văn An',
            'Nam',
            '15/08/1992',
            'Hà Nội',
            'Nam Định',
            'Kinh',
            'Không',
            'Việt Nam',
            'Đã kết hôn',
            1,
            depts[0]?.department_id || 'HR',
            positions[0]?.position_id || 'POS-01',
            'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ',
            'Chuyên viên Nhân sự cấp cao',
            'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội',
            'Khối Văn phòng Tổng công ty',
            'TH-0001',
            'Huỳnh Thanh Long',
            'TH-0002',
            'Trần Minh Đức',
            'Chính thức',
            'Đang làm việc',
            '01/03/2026',
            'Không xác định',
            'Hợp đồng lao động không xác định thời hạn',
            '01/03/2026',
            '01/05/2026',
            '0987654321',
            '02438888999',
            'an.nv@trunghaico.vn',
            'annguyen92@gmail.com',
            'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội',
            'Tòa nhà Trung Hải, Cầu Giấy, Hà Nội',
            '001092012345',
            '10/05/2021',
            'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
            '15/08/2032',
            'P01234567',
            '12/04/2022',
            '8456123890',
            3,
            16000000,
            20000000,
            16000000,
            '1903456789012',
            'Vietcombank',
            'Chi nhánh Hà Nội',
            'Tham gia đầy đủ',
            '0123456789',
            '01/03/2026',
            'Bệnh viện Bạch Mai - Hà Nội',
            'Đoàn viên',
            'Đại học',
            'Chính quy',
            'Đại học Kinh Tế Quốc Dân',
            'Quản trị Nhân lực',
            2014,
            'Giỏi',
            'Chứng chỉ Quản trị Nhân sự Quốc tế SHRM-CP, TOEIC 850',
            'Nguyễn Thị Bình',
            'Vợ',
            '0912345678'
        ],
        [
            'TH-2002',
            '2002',
            'Trần Thị Mai',
            'Nữ',
            '20/11/1995',
            'Đà Nẵng',
            'Quảng Nam',
            'Kinh',
            'Không',
            'Việt Nam',
            'Độc thân',
            0,
            depts[1]?.department_id || 'KT',
            positions[1]?.position_id || 'POS-02',
            'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ',
            'Chuyên viên Kế toán Tổng hợp',
            'Chi nhánh Miền Trung - Đà Nẵng',
            'Khối Kế toán Tài chính',
            'TH-0001',
            'Huỳnh Thanh Long',
            '',
            '',
            'Thử việc',
            'Đang làm việc',
            '15/02/2026',
            '15/04/2026',
            'Hợp đồng thử việc',
            '15/02/2026',
            '15/04/2026',
            '0912987654',
            '',
            'mai.tt@trunghaico.vn',
            'maitt95@yahoo.com',
            'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
            'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
            '034195009876',
            '15/12/2022',
            'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
            '20/11/2035',
            '',
            '',
            '8590123456',
            2,
            12000000,
            15000000,
            12000000,
            '1029384756',
            'Techcombank',
            'Chi nhánh Đà Nẵng',
            'Tham gia đầy đủ',
            '0481234567',
            '15/02/2026',
            'Bệnh viện Đa khoa Đà Nẵng',
            'Đoàn viên',
            'Đại học',
            'Chính quy',
            'Đại học Kinh Tế - ĐH Đà Nẵng',
            'Tài chính Kế toán',
            2017,
            'Khá',
            'Chứng chỉ Kế toán Trưởng, Chứng chỉ ACCA F1-F3',
            'Trần Văn Cường',
            'Bố',
            '0905123456'
        ],
        [
            '', // Blank for auto-generate employee_id test
            '',
            'Lê Hoàng Long',
            'Nam',
            '05/04/1998',
            'TP.HCM',
            'Bình Dương',
            'Kinh',
            'Không',
            'Việt Nam',
            'Độc thân',
            0,
            depts[0]?.department_id || 'HR',
            positions[0]?.position_id || 'POS-01',
            'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ',
            'Chuyên viên Tuyển dụng & Đào tạo',
            'Chi nhánh Miền Nam - TP. Hồ Chí Minh',
            'Khối Văn phòng Chi nhánh',
            'TH-0001',
            'Huỳnh Thanh Long',
            '',
            '',
            'Chính thức',
            'Đang làm việc',
            '01/01/2026',
            'Không xác định',
            'Hợp đồng lao động xác định thời hạn (12 tháng)',
            '01/01/2026',
            '01/03/2026',
            '0933112233',
            '',
            'long.lh@trunghaico.vn',
            'longle98@gmail.com',
            'Số 88 Nguyễn Đình Chiểu, P. Đa Kao, Q.1, TP.HCM',
            'Số 88 Nguyễn Đình Chiểu, P. Đa Kao, Q.1, TP.HCM',
            '079098001122',
            '01/08/2023',
            'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
            '05/04/2038',
            'P09876543',
            '20/09/2023',
            '8765432109',
            2,
            14000000,
            17500000,
            14000000,
            '0491000123456',
            'MBBank',
            'Chi nhánh TP.HCM',
            'Tham gia đầy đủ',
            '0799887766',
            '01/01/2026',
            'Bệnh viện Chợ Rẫy - TP.HCM',
            'Đoàn viên',
            'Đại học',
            'Chính quy',
            'Đại học Mở TP.HCM',
            'Quản trị Kinh doanh',
            2020,
            'Khá',
            'Chứng chỉ Chuyên viên Tuyển dụng Cao cấp, IELTS 7.0',
            'Lê Văn Hùng',
            'Anh trai',
            '0933445566'
        ]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sampleRows);
    ws1['!cols'] = [
        { wch: 16 }, // Mã NV
        { wch: 14 }, // Mã chấm công
        { wch: 22 }, // Họ tên
        { wch: 10 }, // Giới tính
        { wch: 16 }, // Ngày sinh
        { wch: 18 }, // Nơi sinh
        { wch: 18 }, // Nguyên quán
        { wch: 12 }, // Dân tộc
        { wch: 12 }, // Tôn giáo
        { wch: 14 }, // Quốc tịch
        { wch: 16 }, // Tình trạng hôn nhân
        { wch: 10 }, // Số con
        { wch: 16 }, // Mã phòng ban
        { wch: 20 }, // Mã vị trí
        { wch: 30 }, // Cấp bậc nhân sự
        { wch: 26 }, // Chức danh chuyên môn
        { wch: 36 }, // Địa điểm làm việc
        { wch: 28 }, // Khối làm việc
        { wch: 18 }, // Mã QLTT
        { wch: 22 }, // Tên QLTT
        { wch: 18 }, // Mã QLGT
        { wch: 22 }, // Tên QLGT
        { wch: 16 }, // Tính chất lao động
        { wch: 16 }, // Trạng thái làm việc
        { wch: 18 }, // Ngày bắt đầu làm việc
        { wch: 18 }, // Ngày kết thúc
        { wch: 35 }, // Loại HĐ
        { wch: 18 }, // Ngày thử việc
        { wch: 18 }, // Ngày chính thức
        { wch: 15 }, // SĐT di động
        { wch: 15 }, // SĐT bàn
        { wch: 25 }, // Email công việc
        { wch: 25 }, // Email cá nhân
        { wch: 40 }, // Thường trú
        { wch: 40 }, // Tạm trú
        { wch: 18 }, // CCCD
        { wch: 16 }, // Ngày cấp CCCD
        { wch: 32 }, // Nơi cấp CCCD
        { wch: 16 }, // Hạn CCCD
        { wch: 16 }, // Passport
        { wch: 16 }, // Ngày cấp Passport
        { wch: 16 }, // Mã số thuế
        { wch: 12 }, // Bậc lương
        { wch: 18 }, // Lương CB
        { wch: 18 }, // Tổng lương
        { wch: 18 }, // Lương BHXH
        { wch: 20 }, // STK ngân hàng
        { wch: 18 }, // Ngân hàng
        { wch: 24 }, // Chi nhánh NH
        { wch: 18 }, // Tham gia BHXH
        { wch: 18 }, // Sổ BHXH
        { wch: 18 }, // Ngày tham gia BHXH
        { wch: 32 }, // Nơi KCB
        { wch: 16 }, // Công đoàn
        { wch: 16 }, // Trình độ học vấn
        { wch: 16 }, // Hình thức đào tạo
        { wch: 28 }, // Trường đào tạo
        { wch: 24 }, // Chuyên ngành
        { wch: 14 }, // Năm tốt nghiệp
        { wch: 14 }, // Xếp loại
        { wch: 36 }, // Bằng cấp khác
        { wch: 22 }, // Người khẩn cấp
        { wch: 14 }, // Quan hệ
        { wch: 15 }  // SĐT khẩn cấp
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Danh_Sach_Nhan_Su');

    // Sheet 2: Reference Guide & Code Dictionary (Comprehensive Reference Tables)
    const refData = [
        ['=== DANH MỤC THAM CHIẾU HỆ THỐNG QUẢN TRỊ NHÂN SỰ TRUNG HẢI ===', ''],
        ['(Sử dụng các giá trị chuẩn trong sheet này để điền vào sheet "Danh_Sach_Nhan_Su")', ''],
        ['', ''],
        ['1. DANH SÁCH MÃ PHÒNG BAN (*)', 'TÊN PHÒNG BAN / ĐƠN VỊ CÔNG TÁC'],
        ...depts.map(d => [d.department_id, d.department_name]),
        ['', ''],
        ['2. DANH SÁCH MÃ VỊ TRÍ / CHỨC DANH (*)', 'TÊN VỊ TRÍ CÔNG VIỆC'],
        ...positions.map(p => [p.position_id, p.position_name]),
        ['', ''],
        ['3. CẤP BẬC NHÂN SỰ', 'MÔ TẢ CẤP BẬC'],
        ['Cấp 1 - Ban Lãnh đạo / Giám đốc', 'Tổng Giám đốc, Phó TGĐ, Giám đốc khối'],
        ['Cấp 2 - Quản lý Cấp trung / Trưởng phòng', 'Trưởng/Phó phòng ban, Chỉ huy trưởng'],
        ['Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ', 'Chuyên viên, Nhân viên nghiệp vụ chính thức'],
        ['Cấp 4 - Nhân viên Sơ cấp / Tập sự', 'Nhân viên mới, Tập sự, Học việc'],
        ['Cấp 5 - Công nhân / Lao động trực tiếp', 'Công nhân hiện trường, Lao động trực tiếp'],
        ['', ''],
        ['4. TÍNH CHẤT LAO ĐỘNG HỢP LỆ (*)', 'GHI CHÚ ÁP DỤNG'],
        ['Chính thức', 'Đã ký hợp đồng lao động chính thức'],
        ['Thử việc', 'Đang trong thời gian thử việc'],
        ['Học việc', 'Đang trong thời gian học việc'],
        ['Thực tập', 'Sinh viên thực tập tốt nghiệp'],
        ['Thời vụ', 'Hợp đồng theo mùa vụ / dự án ngắn hạn'],
        ['', ''],
        ['5. TRẠNG THÁI LÀM VIỆC (*)', 'Ý NGHĨA'],
        ['Đang làm việc', 'Đang công tác hoạt động bình thường'],
        ['Đã nghỉ việc', 'Đã thôi việc, thanh lý hợp đồng lao động'],
        ['Nghỉ thai sản', 'Đang nghỉ chế độ thai sản'],
        ['Nghỉ không lương', 'Đang tạm hoãn hợp đồng lao động'],
        ['', ''],
        ['6. LOẠI HỢP ĐỒNG LAO ĐỘNG (*)', 'GHI CHÚ'],
        ['Hợp đồng lao động không xác định thời hạn', 'Hợp đồng không thời hạn'],
        ['Hợp đồng lao động xác định thời hạn (12 tháng)', 'Hợp đồng 12 tháng'],
        ['Hợp đồng lao động xác định thời hạn (24 tháng)', 'Hợp đồng 24 tháng'],
        ['Hợp đồng lao động xác định thời hạn (36 tháng)', 'Hợp đồng 36 tháng'],
        ['Hợp đồng thử việc', 'Hợp đồng thử việc 1 - 2 tháng'],
        ['Hợp đồng lao động thời vụ', 'Hợp đồng ngắn hạn dưới 12 tháng'],
        ['', ''],
        ['7. TRÌNH ĐỘ HỌC VẤN & HÌNH THỨC ĐÀO TẠO', 'HÌNH THỨC'],
        ['Đại học', 'Chính quy'],
        ['Thạc sĩ', 'Tại chức'],
        ['Tiến sĩ', 'Liên thông'],
        ['Cao đẳng', 'Từ xa / Vừa học vừa làm'],
        ['Trung cấp', ''],
        ['THPT', ''],
        ['', ''],
        ['8. DANH SÁCH NGÂN HÀNG PHỔ BIẾN', ''],
        ['Vietcombank', 'MBBank'],
        ['Techcombank', 'BIDV'],
        ['VietinBank', 'ACB'],
        ['Agribank', 'VPBank'],
        ['TPBank', 'Sacombank'],
        ['', ''],
        ['9. QUAN HỆ KHẨN CẤP', ''],
        ['Vợ', 'Chồng'],
        ['Bố', 'Mẹ'],
        ['Anh trai', 'Chị gái'],
        ['Em trai', 'Em gái'],
        ['Người thân khác', '']
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(refData);
    ws2['!cols'] = [{ wch: 45 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Danh_Muc_Tham_Chieu');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Mau_Nhap_Lieu_Nhan_Su.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

// 1.1 DOWNLOAD 1,000 SAMPLE EMPLOYEES EXCEL FILE
app.get('/api/employees/sample-1000', (req, res) => {
    const filePath = path.join(__dirname, 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
    if (fs.existsSync(filePath)) {
        res.download(filePath, 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
    } else {
        res.status(404).json({ success: false, message: 'File 1000 nhân sự mẫu chưa được tạo' });
    }
});

// 2. IMPORT EMPLOYEES FROM EXCEL BATCH (WITH PRIMARY KEY DUPLICATE VALIDATION)
app.post('/api/employees/import-excel', (req, res) => {
    try {
        const db = loadDatabase();
        const { employees: importedList, overwrite, skip_errors, operator_id, operator_name, operator_role } = req.body;

        if (!Array.isArray(importedList) || importedList.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách nhân sự cần nhập rỗng' });
        }

        const employees = db.tables['03_Employees'] || [];
        const contacts = db.tables['04_Contacts_Addresses'] || [];
        const identity = db.tables['05_Identity_Docs'] || [];
        const emergency = db.tables['06_Emergency_Contacts'] || [];
        const education = db.tables['07_Education'] || [];
        const salaries = db.tables['08_Salaries_Banks'] || [];
        const insurance = db.tables['09_Insurance_Welfare'] || [];
        const contracts = db.tables['10_Contracts'] || [];
        const masterProfiles = db.tables['00_Master_Profiles'] || [];
        const depts = db.tables['01_Departments'] || [];
        const pos = db.tables['02_Positions'] || [];

        // Build lookup maps for fast resolution
        const deptMapById = {};
        const deptMapByName = {};
        depts.forEach(d => {
            deptMapById[(d.department_id || '').toUpperCase()] = d;
            deptMapByName[(d.department_name || '').toLowerCase().trim()] = d;
        });

        const posMapById = {};
        const posMapByName = {};
        pos.forEach(p => {
            posMapById[(p.position_id || '').toUpperCase()] = p;
            posMapByName[(p.position_name || '').toLowerCase().trim()] = p;
        });

        // Build DB maps for primary key validation
        const dbEmpById = {};
        const dbEmpByTimeCode = {};
        const dbEmpByIdNumber = {};
        const dbEmpByWorkEmail = {};

        employees.forEach(e => {
            if (e.employee_id) dbEmpById[e.employee_id.toUpperCase()] = e;
            if (e.time_attendance_code) dbEmpByTimeCode[e.time_attendance_code.toString().trim()] = e;
        });

        identity.forEach(i => {
            if (i.id_number) dbEmpByIdNumber[i.id_number.toString().trim()] = i;
        });

        contacts.forEach(c => {
            if (c.work_email) dbEmpByWorkEmail[c.work_email.toLowerCase().trim()] = c;
        });

        // Determine next ID seed
        let maxNum = 2000;
        employees.forEach(e => {
            const match = (e.employee_id || '').match(/TH-(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const processedIds = new Set();
        const seenFileEmpIds = new Map();
        const seenFileIdNumbers = new Map();
        const seenFileEmails = new Map();
        const conflictErrors = [];

        // 1. First Pass: Validate batch for duplicates
        importedList.forEach((item, idx) => {
            const rowNum = idx + 1;
            const empId = (item.employee_id || item['Mã nhân viên'] || item['Mã NV'] || '').trim().toUpperCase();
            const idNumber = (item.id_number || item['Số CCCD / CMND'] || item['Số CCCD / Hộ chiếu'] || item['Số CCCD'] || item['CCCD'] || '').toString().trim();
            const email = (item.work_email || item['Email công việc'] || item['Email'] || '').toString().toLowerCase().trim();
            const fullName = (item.full_name || item['Họ và tên'] || item['Họ tên'] || '').trim();

            if (!fullName) {
                conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Thiếu Họ và tên (*)` });
                return;
            }

            // Check duplicate ID in file
            if (empId) {
                if (seenFileEmpIds.has(empId)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Trùng Mã nhân viên ${empId} với dòng ${seenFileEmpIds.get(empId)} trong file Excel` });
                } else {
                    seenFileEmpIds.set(empId, rowNum);
                }
            }

            // Check duplicate CCCD in file
            if (idNumber) {
                if (seenFileIdNumbers.has(idNumber)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Trùng số CCCD ${idNumber} với dòng ${seenFileIdNumbers.get(idNumber)} trong file Excel` });
                } else {
                    seenFileIdNumbers.set(idNumber, rowNum);
                }

                // Check duplicate CCCD with DB on a DIFFERENT employee
                const existingWithCCCD = dbEmpByIdNumber[idNumber];
                if (existingWithCCCD && (!empId || existingWithCCCD.employee_id !== empId)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Số CCCD ${idNumber} đã thuộc về nhân sự khác (${existingWithCCCD.employee_id} - ${existingWithCCCD.full_name}) trong hệ thống` });
                }
            }

            // Check duplicate Email with DB on a DIFFERENT employee
            if (email && email.includes('@')) {
                if (seenFileEmails.has(email)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Trùng Email công việc ${email} với dòng ${seenFileEmails.get(email)} trong file Excel` });
                } else {
                    seenFileEmails.set(email, rowNum);
                }

                const existingWithEmail = dbEmpByWorkEmail[email];
                if (existingWithEmail && (!empId || existingWithEmail.employee_id !== empId)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Email ${email} đã được sử dụng bởi nhân sự (${existingWithEmail.employee_id} - ${existingWithEmail.full_name}) trong hệ thống` });
                }
            }
        });

        // If there are conflict errors and skip_errors is false, reject batch
        if (conflictErrors.length > 0 && !skip_errors) {
            return res.status(400).json({
                success: false,
                has_conflicts: true,
                conflict_count: conflictErrors.length,
                errors: conflictErrors,
                message: `Phát hiện ${conflictErrors.length} lỗi trùng lặp / xung đột dữ liệu Primary Key. Vui lòng kiểm tra lại!`
            });
        }

        const conflictRowSet = new Set(conflictErrors.map(e => e.row));

        // 2. Second Pass: Process valid rows
        for (let i = 0; i < importedList.length; i++) {
            const rowNum = i + 1;
            if (conflictRowSet.has(rowNum)) {
                skippedCount++;
                continue;
            }

            const item = importedList[i];
            const fullName = (item.full_name || item['Họ và tên'] || item['Họ tên'] || '').trim();
            if (!fullName) continue;

            // Resolve Department
            const rawDept = (item.department_id || item['Mã phòng ban'] || item['Phòng/Ban'] || item['Phòng ban'] || '').trim();
            let deptObj = deptMapById[rawDept.toUpperCase()] || deptMapByName[rawDept.toLowerCase()] || depts[0] || { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự' };
            const deptId = deptObj.department_id;
            const deptName = deptObj.department_name;

            // Resolve Position
            const rawPos = (item.position_id || item['Mã chức danh / Vị trí'] || item['Mã chức danh'] || item['Vị trí'] || item['Chức danh'] || '').trim();
            let posObj = posMapById[rawPos.toUpperCase()] || posMapByName[rawPos.toLowerCase()] || pos[0] || { position_id: 'POS-01', position_name: 'Chuyên viên' };
            const posId = posObj.position_id;
            const posTitle = posObj.position_name;

            // Resolve or generate Employee ID
            let empId = (item.employee_id || item['Mã nhân viên'] || item['Mã NV'] || '').trim().toUpperCase();
            if (!empId || processedIds.has(empId)) {
                maxNum++;
                empId = `TH-${maxNum}`;
            }
            processedIds.add(empId);

            const timeAttendanceCode = (item.time_attendance_code || item['Mã chấm công'] || empId.replace('TH-', '')).toString().trim();
            const gender = (item.gender || item['Giới tính'] || 'Nam').trim();
            const dob = item.date_of_birth || item['Ngày sinh (DD/MM/YYYY)'] || item['Ngày sinh'] || null;
            const birthPlace = (item.birth_place || item['Nơi sinh'] || '').trim();
            const nativePlace = (item.native_place || item['Nguyên quán'] || '').trim();
            const ethnicity = (item.ethnicity || item['Dân tộc'] || 'Kinh').trim();
            const religion = (item.religion || item['Tôn giáo'] || 'Không').trim();
            const nationality = (item.nationality || item['Quốc tịch'] || 'Việt Nam').trim();
            const maritalStatus = (item.marital_status || item['Tình trạng hôn nhân'] || 'Độc thân').trim();
            const childrenCount = parseInt(item.children_count || item['Số con'] || 0, 10) || 0;

            const jobRank = (item.job_rank || item['Cấp bậc nhân sự'] || item['Cấp bậc'] || 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ').trim();
            const professionalTitle = (item.job_title || item['Chức danh chuyên môn'] || posTitle).trim();
            const workLocation = (item.work_location || item['Địa điểm làm việc'] || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội').trim();
            const workArea = (item.work_area || item['Khối / Khu vực làm việc'] || item['Khối làm việc'] || 'Khối Văn phòng Tổng công ty').trim();
            const directMgrId = (item.direct_manager_id || item['Mã quản lý trực tiếp'] || null);
            const directMgrName = (item.direct_manager_name || item['Họ tên quản lý trực tiếp'] || '').trim();
            const indirectMgrId = (item.indirect_manager_id || item['Mã quản lý gián tiếp'] || null);
            const indirectMgrName = (item.indirect_manager_name || item['Họ tên quản lý gián tiếp'] || '').trim();

            const laborNature = (item.labor_nature || item['Tính chất lao động'] || 'Chính thức').trim();
            const empStatus = (item.employment_status || item['Trạng thái làm việc'] || item['Trạng thái'] || 'Đang làm việc').trim();
            const startDate = item.start_date || item['Ngày bắt đầu làm việc'] || new Date().toISOString().split('T')[0];
            const endDate = item.end_date || item['Ngày kết thúc (HĐ/Nghỉ)'] || item['Ngày kết thúc'] || 'Không xác định';
            const contractType = (item.contract_type || item['Loại hợp đồng'] || 'Hợp đồng lao động không xác định thời hạn').trim();
            const trialStartDate = item.trial_start_date || item['Ngày bắt đầu thử việc'] || startDate;
            const officialDate = item.official_date || item['Ngày ký HĐ chính thức'] || startDate;

            const phone = (item.mobile_phone || item['Số ĐT di động'] || item['Số điện thoại'] || item['Điện thoại'] || '').toString().trim();
            const homePhone = (item.home_phone || item['Số ĐT bàn / Khác'] || item['Số ĐT bàn'] || '').toString().trim();
            const email = (item.work_email || item['Email công việc'] || item['Email'] || `${empId.toLowerCase()}@trunghaico.vn`).trim();
            const personalEmail = (item.personal_email || item['Email cá nhân'] || '').trim();
            const permAddress = (item.permanent_address_full || item['Địa chỉ thường trú'] || '').trim();
            const currAddress = (item.current_address_full || item['Địa chỉ tạm trú / Hiện tại'] || item['Địa chỉ hiện tại'] || item['Địa chỉ tạm trú'] || permAddress).trim();

            const idNumber = (item.id_number || item['Số CCCD / CMND'] || item['Số CCCD / Hộ chiếu'] || item['Số CCCD'] || item['CCCD'] || '').toString().trim();
            const idIssueDate = item.id_issue_date || item['Ngày cấp CCCD (DD/MM/YYYY)'] || item['Ngày cấp CCCD'] || item['Ngày cấp'] || null;
            const idIssuePlace = (item.id_issue_place || item['Nơi cấp CCCD'] || item['Nơi cấp'] || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội').trim();
            const idExpiryDate = item.id_expiry_date || item['Ngày hết hạn CCCD'] || null;
            const passportNumber = (item.passport_number || item['Số hộ chiếu (Passport)'] || item['Số hộ chiếu'] || '').toString().trim();
            const passportIssueDate = item.passport_issue_date || item['Ngày cấp hộ chiếu'] || null;
            const taxCode = (item.tax_code || item['Mã số thuế cá nhân'] || item['Mã số thuế'] || '').toString().trim();

            const salaryGrade = parseInt(item.salary_grade || item['Bậc lương'] || 3, 10) || 3;
            const baseSalary = parseFloat(item.base_salary || item['Lương cơ bản (VNĐ)'] || item['Lương cơ bản']) || 0;
            const totalSalary = parseFloat(item.total_salary || item['Tổng lương / Thu nhập (VNĐ)'] || item['Tổng lương']) || (baseSalary > 0 ? baseSalary * 1.25 : 0);
            const insuranceSalary = parseFloat(item.insurance_salary || item['Lương đóng BHXH (VNĐ)'] || item['Lương đóng BHXH']) || Math.min(baseSalary, 23400000);
            const bankAccount = (item.bank_account_number || item['Số tài khoản ngân hàng'] || item['Số tài khoản'] || item['STK'] || '').toString().trim();
            const bankName = (item.bank_name || item['Tên ngân hàng'] || item['Ngân hàng'] || 'Vietcombank').trim();
            const bankBranch = (item.bank_branch || item['Chi nhánh ngân hàng'] || item['Chi nhánh'] || 'Chi nhánh Hà Nội').trim();

            const hasInsurance = (item.has_insurance || item['Tham gia BHXH'] || 'Tham gia đầy đủ').trim();
            const socialInsuranceBook = (item.social_insurance_book_no || item['Số sổ / Mã số BHXH'] || item['Số sổ BHXH'] || item['Mã số BHXH'] || '').toString().trim();
            const insuranceJoinDate = item.insurance_join_date || item['Ngày tham gia BHXH'] || startDate;
            const hospitalRegistered = (item.hospital_registered || item['Nơi ĐK khám chữa bệnh ban đầu'] || item['Nơi ĐK KCB ban đầu'] || 'Bệnh viện Bạch Mai - Hà Nội').trim();
            const unionMember = (item.union_member || item['Đoàn viên công đoàn'] || 'Đoàn viên').trim();

            const eduLevel = (item.education_level || item['Trình độ học vấn'] || 'Đại học').trim();
            const degreeType = (item.degree_type || item['Hình thức đào tạo'] || 'Chính quy').trim();
            const institution = (item.institution || item['Trường / Cơ sở đào tạo'] || 'Đại học').trim();
            const eduMajor = (item.major || item['Chuyên ngành đào tạo'] || item['Chuyên ngành'] || '').trim();
            const gradYear = parseInt(item.graduation_year || item['Năm tốt nghiệp'] || 2020, 10) || 2020;
            const gradClassification = (item.classification || item['Xếp loại tốt nghiệp'] || 'Khá').trim();
            const otherCerts = (item.other_certificates || item['Bằng cấp chuyên môn khác & Chứng chỉ'] || item['Bằng cấp khác'] || '').trim();

            const emergName = (item.emergency_name || item['Họ tên người liên hệ khẩn cấp'] || item['Người liên hệ khẩn cấp'] || item['Người khẩn cấp'] || '').trim();
            const emergRelation = (item.emergency_relation || item['Mối quan hệ khẩn cấp'] || item['Quan hệ khẩn cấp'] || 'Người thân').trim();
            const emergPhone = (item.emergency_phone || item['Số ĐT khẩn cấp'] || item['SĐT khẩn cấp'] || '').toString().trim();

            const existingIdx = employees.findIndex(e => e.employee_id === empId);

            if (existingIdx >= 0 && overwrite) {
                // UPDATE RECORD
                employees[existingIdx] = {
                    ...employees[existingIdx],
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
                    tax_code: taxCode,
                    department_id: deptId,
                    department_name: deptName,
                    position_id: posId,
                    job_rank: jobRank,
                    job_title: professionalTitle,
                    work_location: workLocation,
                    work_area: workArea,
                    direct_manager_id: directMgrId,
                    direct_manager_name: directMgrName,
                    indirect_manager_id: indirectMgrId,
                    indirect_manager_name: indirectMgrName,
                    employment_status: empStatus,
                    labor_nature: laborNature,
                    start_date: startDate,
                    end_date: endDate,
                    contract_type: contractType,
                    probation_start_date: trialStartDate,
                    trial_start_date: trialStartDate,
                    official_date: officialDate,
                    resignation_date: empStatus === 'Đã nghỉ việc' ? (endDate !== 'Không xác định' ? endDate : startDate) : null,
                    other_certificates: otherCerts
                };

                // Update contact
                const cIdx = contacts.findIndex(c => c.employee_id === empId);
                if (cIdx >= 0) {
                    contacts[cIdx] = {
                        ...contacts[cIdx],
                        full_name: fullName,
                        mobile_phone: phone,
                        home_phone: homePhone,
                        work_email: email,
                        personal_email: personalEmail,
                        permanent_address_full: permAddress,
                        current_address_full: currAddress
                    };
                }

                // Update identity
                const iIdx = identity.findIndex(i => i.employee_id === empId);
                if (iIdx >= 0) {
                    identity[iIdx] = {
                        ...identity[iIdx],
                        full_name: fullName,
                        id_number: idNumber,
                        id_issue_date: idIssueDate,
                        id_issue_place: idIssuePlace,
                        id_expiry_date: idExpiryDate,
                        passport_number: passportNumber || null,
                        passport_issue_date: passportIssueDate || null
                    };
                }

                // Update salary
                const sIdx = salaries.findIndex(s => s.employee_id === empId);
                if (sIdx >= 0) {
                    salaries[sIdx] = {
                        ...salaries[sIdx],
                        full_name: fullName,
                        salary_grade: salaryGrade,
                        base_salary: baseSalary,
                        total_salary: totalSalary,
                        insurance_salary: insuranceSalary,
                        bank_account_number: bankAccount,
                        bank_name: bankName,
                        bank_branch: bankBranch
                    };
                }

                // Update insurance
                const insIdx = insurance.findIndex(ins => ins.employee_id === empId);
                if (insIdx >= 0) {
                    insurance[insIdx] = {
                        ...insurance[insIdx],
                        full_name: fullName,
                        has_insurance: hasInsurance,
                        social_insurance_book_no: socialInsuranceBook,
                        social_insurance_code: socialInsuranceBook,
                        insurance_join_date: insuranceJoinDate,
                        hospital_registered: hospitalRegistered,
                        union_member: unionMember
                    };
                }

                // Update education
                const eduIdx = education.findIndex(ed => ed.employee_id === empId);
                if (eduIdx >= 0) {
                    education[eduIdx] = {
                        ...education[eduIdx],
                        full_name: fullName,
                        education_level: eduLevel,
                        degree_type: degreeType,
                        institution: institution,
                        major: eduMajor,
                        graduation_year: gradYear,
                        classification: gradClassification,
                        other_certificates: otherCerts
                    };
                }

                // Update master profiles
                const mpIdx = masterProfiles.findIndex(m => m['Mã nhân viên'] === empId);
                if (mpIdx >= 0) {
                    masterProfiles[mpIdx] = {
                        ...masterProfiles[mpIdx],
                        'Họ và tên': fullName,
                        'Ngày bắt đầu làm việc': startDate,
                        'Ngày kết thúc': endDate,
                        'Loại hợp đồng': contractType,
                        'Phòng/Ban': deptName,
                        'Cấp bậc': jobRank,
                        'Chức danh': professionalTitle,
                        'Điện thoại': phone,
                        'Email': email,
                        'Địa điểm làm việc': workLocation,
                        'Ngày tháng năm sinh': dob || '',
                        'Giới tính': gender,
                        'Nơi sinh': birthPlace,
                        'Tình trạng hôn nhân': maritalStatus,
                        'Số con': childrenCount,
                        'Nguyên quán': nativePlace,
                        'Dân tộc': ethnicity,
                        'Tôn giáo': religion,
                        'Số CCCD/Hộ chiếu': idNumber,
                        'Ngày cấp': idIssueDate || '',
                        'Nơi cấp': idIssuePlace,
                        'Địa chỉ thường trú': permAddress,
                        'Địa chỉ tạm trú': currAddress,
                        'Số sổ BHXH': socialInsuranceBook,
                        'Mã số BHXH': socialInsuranceBook,
                        'Ngày tham gia BHXH': insuranceJoinDate,
                        'Nơi ĐK KCB ban đầu': hospitalRegistered,
                        'Mã số thuế cá nhân': taxCode,
                        'Tên tài khoản ngân hàng': fullName,
                        'Số tài khoản ngân hàng': bankAccount,
                        'Tên ngân hàng': bankName,
                        'Tên chi nhánh/Phòng Giao dịch': bankBranch,
                        'Trình độ học vấn': eduLevel,
                        'Trình độ chuyên môn: Chuyên ngành học': eduMajor,
                        'Bằng cấp chuyên môn khác': otherCerts,
                        'Liên lạc khẩn cấp (họ tên, mối quan hệ, số điện thoại)': emergName ? `${emergName} (${emergRelation}) - ${emergPhone}` : ''
                    };
                }

                updatedCount++;
            } else if (existingIdx === -1) {
                // INSERT NEW RECORD
                const newEmp = {
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
                    tax_code: taxCode,
                    department_id: deptId,
                    department_name: deptName,
                    position_id: posId,
                    job_rank: jobRank,
                    job_title: professionalTitle,
                    direct_manager_id: directMgrId,
                    direct_manager_name: directMgrName,
                    indirect_manager_id: indirectMgrId,
                    indirect_manager_name: indirectMgrName,
                    work_location: workLocation,
                    work_area: workArea,
                    employment_status: empStatus,
                    labor_nature: laborNature,
                    start_date: startDate,
                    end_date: endDate,
                    contract_type: contractType,
                    probation_start_date: trialStartDate,
                    trial_start_date: trialStartDate,
                    official_date: officialDate,
                    resignation_date: empStatus === 'Đã nghỉ việc' ? (endDate !== 'Không xác định' ? endDate : startDate) : null,
                    expected_retirement_date: null,
                    other_certificates: otherCerts,
                    seniority_text: 'Mới gia nhập',
                    is_blacklisted: false
                };
                employees.unshift(newEmp);

                contacts.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    mobile_phone: phone,
                    home_phone: homePhone,
                    other_phone: '',
                    work_email: email,
                    personal_email: personalEmail,
                    permanent_address_full: permAddress,
                    permanent_country: 'Việt Nam',
                    permanent_province: '',
                    permanent_district: '',
                    permanent_ward: '',
                    permanent_street: '',
                    current_address_full: currAddress,
                    current_country: 'Việt Nam',
                    current_province: '',
                    current_district: '',
                    current_ward: '',
                    current_street: ''
                });

                identity.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    doc_type: 'CCCD',
                    id_number: idNumber,
                    id_issue_date: idIssueDate,
                    id_issue_place: idIssuePlace,
                    id_expiry_date: idExpiryDate,
                    passport_number: passportNumber || null,
                    passport_issue_date: passportIssueDate || null
                });

                if (emergName) {
                    emergency.unshift({
                        employee_id: empId,
                        full_name: fullName,
                        contact_name: emergName,
                        relationship: emergRelation,
                        mobile_phone: emergPhone,
                        email: '',
                        address: permAddress
                    });
                }

                education.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    education_level: eduLevel,
                    degree_type: degreeType,
                    institution: institution,
                    faculty: '',
                    major: eduMajor || 'Chuyên ngành',
                    other_certificates: otherCerts,
                    graduation_year: gradYear,
                    classification: gradClassification
                });

                salaries.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    salary_grade: salaryGrade,
                    base_salary: baseSalary,
                    total_salary: totalSalary,
                    insurance_salary: insuranceSalary,
                    bank_account_number: bankAccount,
                    bank_name: bankName,
                    bank_branch: bankBranch
                });

                insurance.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    has_insurance: hasInsurance,
                    social_insurance_book_no: socialInsuranceBook,
                    social_insurance_code: socialInsuranceBook,
                    insurance_join_date: insuranceJoinDate,
                    total_insurance_rate: 0.105,
                    social_insurance_rate: 8,
                    health_insurance_rate: 1.5,
                    unemployment_insurance_rate: 1,
                    hospital_registered: hospitalRegistered,
                    union_member: unionMember
                });

                contracts.unshift({
                    contract_id: `HD-${empId.replace('-', '')}-01`,
                    employee_id: empId,
                    full_name: fullName,
                    contract_type: contractType,
                    start_date: startDate,
                    end_date: endDate,
                    trial_start_date: trialStartDate,
                    official_date: officialDate,
                    contract_status: 'HIỆU LỰC'
                });

                masterProfiles.unshift({
                    'Mã nhân viên': empId,
                    'Họ và tên': fullName,
                    'Ngày bắt đầu làm việc': startDate,
                    'Ngày kết thúc': endDate,
                    'Loại hợp đồng': contractType,
                    'Phòng/Ban': deptName,
                    'Cấp bậc': jobRank,
                    'Chức danh': professionalTitle,
                    'Điện thoại': phone,
                    'Email': email,
                    'Địa điểm làm việc': workLocation,
                    'Ngày tháng năm sinh': dob || '',
                    'Giới tính': gender,
                    'Nơi sinh': birthPlace,
                    'Tình trạng hôn nhân': maritalStatus,
                    'Số con': childrenCount,
                    'Nguyên quán': nativePlace,
                    'Dân tộc': ethnicity,
                    'Tôn giáo': religion,
                    'Số CCCD/Hộ chiếu': idNumber,
                    'Ngày cấp': idIssueDate || '',
                    'Nơi cấp': idIssuePlace,
                    'Địa chỉ thường trú': permAddress,
                    'Địa chỉ tạm trú': currAddress,
                    'Số sổ BHXH': socialInsuranceBook,
                    'Mã số BHXH': socialInsuranceBook,
                    'Ngày tham gia BHXH': insuranceJoinDate,
                    'Nơi ĐK KCB ban đầu': hospitalRegistered,
                    'Mã số thuế cá nhân': taxCode,
                    'Tên tài khoản ngân hàng': fullName,
                    'Số tài khoản ngân hàng': bankAccount,
                    'Tên ngân hàng': bankName,
                    'Tên chi nhánh/Phòng Giao dịch': bankBranch,
                    'Trình độ học vấn': eduLevel,
                    'Trình độ chuyên môn: Chuyên ngành học': eduMajor,
                    'Bằng cấp chuyên môn khác': otherCerts,
                    'Liên lạc khẩn cấp (họ tên, mối quan hệ, số điện thoại)': emergName ? `${emergName} (${emergRelation}) - ${emergPhone}` : ''
                });

                insertedCount++;
            }
        }

        db.tables['03_Employees'] = employees;
        db.tables['04_Contacts_Addresses'] = contacts;
        db.tables['05_Identity_Docs'] = identity;
        db.tables['06_Emergency_Contacts'] = emergency;
        db.tables['07_Education'] = education;
        db.tables['08_Salaries_Banks'] = salaries;
        db.tables['09_Insurance_Welfare'] = insurance;
        db.tables['10_Contracts'] = contracts;
        db.tables['00_Master_Profiles'] = masterProfiles;

        recordLog(db, {
            action_type: 'IMPORT',
            module: 'Nhân sự',
            description: `Nhập danh sách ${insertedCount + updatedCount} nhân sự từ file Excel (Thêm mới: ${insertedCount}, Cập nhật: ${updatedCount}, Bỏ qua lỗi: ${skippedCount})`,
            user_id: operator_id || 'TH-0001',
            user_name: operator_name || 'Huỳnh Thanh Long',
            user_role: operator_role || 'ADMIN',
            ip: req.ip
        });

        saveDatabase(db);

        res.json({
            success: true,
            count: insertedCount + updatedCount,
            inserted: insertedCount,
            updated: updatedCount,
            skipped: skippedCount,
            errors: conflictErrors,
            message: `Nhập Excel thành công! Đã thêm mới ${insertedCount} nhân sự, cập nhật ${updatedCount} nhân sự${skippedCount > 0 ? `, bỏ qua ${skippedCount} dòng xung đột/lỗi` : ''}.`
        });
    } catch (err) {
        console.error('Error importing employees:', err);
        res.status(500).json({ success: false, message: 'Lỗi xử lý file Excel: ' + err.message });
    }
});

// 4. GET EMPLOYEE DETAIL BY ID (Full 8 Tabs)
app.get('/api/employees/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;

    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const employee = employees.find(e => e.employee_id === id);
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    const dept = depts.find(d => d.department_id === employee.department_id) || {};
    const position = pos.find(p => p.position_id === employee.position_id) || {};

    const contact = contacts.find(c => c.employee_id === id) || {};
    const idDoc = identity.find(i => i.employee_id === id) || {};
    const emerg = emergency.filter(e => e.employee_id === id);
    const edu = education.filter(e => e.employee_id === id);
    const sal = salaries.find(s => s.employee_id === id) || {};
    const ins = insurance.find(i => i.employee_id === id) || {};
    const cont = contracts.filter(c => c.employee_id === id);
    const acc = accounts.find(a => a.employee_id === id) || {};

    res.json({
        success: true,
        data: {
            employee: {
                ...employee,
                department_name: dept.department_name || employee.department_id,
                position_name: position.position_name || employee.position_id
            },
            contact,
            identity: idDoc,
            emergency: emerg,
            education: edu,
            salary: sal,
            insurance: ins,
            contracts: cont,
            account: acc
        }
    });
});

// 5. CREATE NEW EMPLOYEE (FULL 34 ATTRIBUTES)
app.post('/api/employees', async (req, res) => {
    const db = loadDatabase();
    const body = req.body;

    if (!body.full_name || !body.department_id || !body.position_id) {
        return res.status(400).json({ success: false, message: 'Họ tên, phòng ban và vị trí là bắt buộc' });
    }

    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];
    const deptObj = depts.find(d => d.department_id === body.department_id) || {};
    const posObj = pos.find(p => p.position_id === body.position_id) || {};

    // Auto-generate employee_id if not provided
    let newId = body.employee_id;
    if (!newId) {
        let maxNum = 2000;
        employees.forEach(e => {
            const match = (e.employee_id || '').match(/TH-(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });
        newId = `TH-${maxNum + 1}`;
    }

    // Check duplicate
    if (employees.some(e => e.employee_id === newId)) {
        return res.status(400).json({ success: false, message: `Mã nhân viên ${newId} đã tồn tại` });
    }

    const baseSal = parseFloat(body.base_salary) || 0;
    const totSal = parseFloat(body.total_salary) || (baseSal * 1.25);
    const startDate = body.start_date || body.trial_start_date || new Date().toISOString().split('T')[0];
    const endDate = body.end_date || 'Không xác định';

    const newEmp = {
        employee_id: newId,
        time_attendance_code: body.time_attendance_code || newId.replace('TH-', ''),
        full_name: body.full_name,
        gender: body.gender || 'Nam',
        date_of_birth: body.date_of_birth || null,
        birth_place: body.birth_place || '',
        native_place: body.native_place || '',
        ethnicity: body.ethnicity || 'Kinh',
        religion: body.religion || 'Không',
        nationality: body.nationality || 'Việt Nam',
        marital_status: body.marital_status || 'Độc thân',
        children_count: parseInt(body.children_count, 10) || 0,
        tax_code: body.tax_code || '',
        department_id: body.department_id,
        position_id: body.position_id,
        job_rank: body.job_rank || 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ',
        job_title: body.job_title || posObj.position_name || '',
        direct_manager_id: body.direct_manager_id || null,
        direct_manager_name: body.direct_manager_name || '',
        indirect_manager_id: body.indirect_manager_id || null,
        indirect_manager_name: body.indirect_manager_name || '',
        work_location: body.work_location || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội',
        work_area: body.work_area || 'Khối Văn phòng Tổng công ty',
        employment_status: body.employment_status || 'Đang làm việc',
        labor_nature: body.labor_nature || 'Chính thức',
        start_date: startDate,
        end_date: endDate,
        contract_type: body.contract_type || 'Hợp đồng lao động không xác định thời hạn',
        probation_start_date: startDate,
        trial_start_date: startDate,
        official_date: body.official_date || startDate,
        resignation_date: body.resignation_date || (body.employment_status === 'Đã nghỉ việc' ? endDate : null),
        expected_retirement_date: body.expected_retirement_date || null,
        other_certificates: body.other_certificates || '',
        seniority_text: 'Mới gia nhập',
        is_blacklisted: false
    };

    employees.unshift(newEmp);
    db.tables['03_Employees'] = employees;

    // Contacts
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    contacts.unshift({
        employee_id: newId,
        full_name: body.full_name,
        mobile_phone: body.mobile_phone || '',
        home_phone: body.home_phone || '',
        other_phone: '',
        work_email: body.work_email || `${newId.toLowerCase()}@trunghaico.vn`,
        personal_email: body.personal_email || '',
        permanent_address_full: body.permanent_address_full || '',
        permanent_country: 'Việt Nam',
        permanent_province: body.permanent_province || '',
        permanent_district: body.permanent_district || '',
        permanent_ward: body.permanent_ward || '',
        permanent_street: body.permanent_street || '',
        current_address_full: body.current_address_full || '',
        current_country: 'Việt Nam',
        current_province: body.current_province || '',
        current_district: body.current_district || '',
        current_ward: body.current_ward || '',
        current_street: body.current_street || ''
    });
    db.tables['04_Contacts_Addresses'] = contacts;

    // Identity Docs
    const identity = db.tables['05_Identity_Docs'] || [];
    identity.unshift({
        employee_id: newId,
        full_name: body.full_name,
        doc_type: body.doc_type || 'CCCD',
        id_number: body.id_number || '',
        id_issue_date: body.id_issue_date || null,
        id_issue_place: body.id_issue_place || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
        id_expiry_date: body.id_expiry_date || null,
        passport_number: body.passport_number || null,
        passport_issue_date: body.passport_issue_date || null
    });
    db.tables['05_Identity_Docs'] = identity;

    // Emergency Contacts
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    if (body.emergency_name || body.emergency_contact_name) {
        emergency.unshift({
            employee_id: newId,
            full_name: body.full_name,
            contact_name: body.emergency_name || body.emergency_contact_name || '',
            relationship: body.emergency_relation || body.emergency_contact_relation || 'Vợ',
            mobile_phone: body.emergency_phone || body.emergency_contact_phone || '',
            email: '',
            address: body.permanent_address_full || ''
        });
        db.tables['06_Emergency_Contacts'] = emergency;
    }

    // Education
    const education = db.tables['07_Education'] || [];
    education.unshift({
        employee_id: newId,
        full_name: body.full_name,
        education_level: body.education_level || 'Đại học',
        degree_type: 'Chính quy',
        institution: body.institution || 'Đại học Xây Dựng Hà Nội',
        faculty: 'Khoa Chuyên ngành',
        major: body.major || 'Kỹ thuật Xây dựng',
        other_certificates: body.other_certificates || '',
        graduation_year: 2020,
        classification: 'Khá'
    });
    db.tables['07_Education'] = education;

    // Salaries
    const salaries = db.tables['08_Salaries_Banks'] || [];
    salaries.unshift({
        employee_id: newId,
        full_name: body.full_name,
        salary_grade: body.salary_grade || 3,
        base_salary: baseSal,
        total_salary: totSal,
        insurance_salary: Math.min(baseSal, 23400000),
        bank_account_number: body.bank_account_number || '',
        bank_name: body.bank_name || 'Vietcombank',
        bank_branch: body.bank_branch || ''
    });
    db.tables['08_Salaries_Banks'] = salaries;

    // Insurance
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    insurance.unshift({
        employee_id: newId,
        full_name: body.full_name,
        has_insurance: body.has_insurance || 'Tham gia đầy đủ',
        social_insurance_book_no: body.social_insurance_book_no || '',
        social_insurance_code: body.social_insurance_code || body.social_insurance_book_no || '',
        insurance_join_date: startDate,
        total_insurance_rate: 0.105,
        social_insurance_rate: 8,
        health_insurance_rate: 1.5,
        unemployment_insurance_rate: 1,
        hospital_registered: body.hospital_registered || 'Bệnh viện Bạch Mai - Hà Nội',
        union_member: 'Đoàn viên'
    });
    db.tables['09_Insurance_Welfare'] = insurance;

    // Contract
    const contracts = db.tables['10_Contracts'] || [];
    contracts.unshift({
        contract_id: `HD-${newId.replace('-', '')}-01`,
        employee_id: newId,
        full_name: body.full_name,
        contract_type: body.contract_type || 'Hợp đồng lao động không xác định thời hạn',
        start_date: startDate,
        end_date: endDate,
        trial_start_date: startDate,
        official_date: startDate,
        contract_status: 'HIỆU LỰC'
    });
    db.tables['10_Contracts'] = contracts;

    // Master Profiles Sheet (34 Columns)
    if (db.tables['00_Master_Profiles']) {
        const emergStr = (body.emergency_name || body.emergency_contact_name)
            ? `${body.emergency_name || body.emergency_contact_name} (${body.emergency_relation || 'Người thân'}) - ${body.emergency_phone || ''}`
            : '';
        db.tables['00_Master_Profiles'].unshift({
            'Mã nhân viên': newId,
            'Họ và tên': body.full_name,
            'Ngày bắt đầu làm việc': startDate,
            'Ngày kết thúc': endDate,
            'Loại hợp đồng': body.contract_type || 'Hợp đồng lao động không xác định thời hạn',
            'Phòng/Ban': deptObj.department_name || body.department_id,
            'Cấp bậc': body.job_rank || 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ',
            'Chức danh': body.job_title || posObj.position_name || '',
            'Điện thoại': body.mobile_phone || '',
            'Email': body.work_email || `${newId.toLowerCase()}@trunghaico.vn`,
            'Địa điểm làm việc': body.work_location || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội',
            'Ngày tháng năm sinh': body.date_of_birth || '',
            'Giới tính': body.gender || 'Nam',
            'Nơi sinh': body.birth_place || '',
            'Tình trạng hôn nhân': body.marital_status || 'Độc thân',
            'Số con': parseInt(body.children_count, 10) || 0,
            'Nguyên quán': body.native_place || '',
            'Dân tộc': body.ethnicity || 'Kinh',
            'Tôn giáo': body.religion || 'Không',
            'Số CCCD/Hộ chiếu': body.id_number || '',
            'Ngày cấp': body.id_issue_date || '',
            'Nơi cấp': body.id_issue_place || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
            'Địa chỉ thường trú': body.permanent_address_full || '',
            'Địa chỉ tạm trú': body.current_address_full || '',
            'Số sổ BHXH': body.social_insurance_book_no || '',
            'Nơi đăng ký khám, chữa bệnh ban đầu': body.hospital_registered || '',
            'Mã số thuế cá nhân': body.tax_code || '',
            'Số tài khoản': body.bank_account_number || '',
            'Tên ngân hàng': body.bank_name || 'Vietcombank',
            'Tên chi nhánh/Phòng Giao dịch': body.bank_branch || '',
            'Trình độ học vấn': body.education_level || 'Đại học',
            'Trình độ chuyên môn: Chuyên ngành học': body.major || '',
            'Bằng cấp chuyên môn khác': body.other_certificates || '',
            'Liên lạc khẩn cấp (họ tên, mối quan hệ, số điện thoại)': emergStr
        });
    }

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Nhân sự',
        description: `Thêm mới hồ sơ nhân sự ${newId} - ${body.full_name} (${body.job_title || posObj.position_name || ''})`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['00_Master_Profiles', '03_Employees', '04_Contacts_Addresses', '05_Identity_Docs', '06_Emergency_Contacts', '07_Education', '08_Salaries_Banks', '09_Insurance_Welfare', '10_Contracts', '11_System_Accounts', '12_System_Logs']);

    res.status(201).json({
        success: true,
        message: 'Thêm nhân viên thành công',
        employee_id: newId
    });
});



// 6. UPDATE EMPLOYEE (FULL 34 ATTRIBUTES)
app.put('/api/employees/:id', async (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const body = req.body;

    const employees = db.tables['03_Employees'] || [];
    const empIdx = employees.findIndex(e => e.employee_id === id);
    if (empIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];
    const targetDeptId = body.department_id || employees[empIdx].department_id;
    const targetPosId = body.position_id || employees[empIdx].position_id;
    const deptObj = depts.find(d => d.department_id === targetDeptId) || {};
    const posObj = pos.find(p => p.position_id === targetPosId) || {};

    // 1. Update core employee
    employees[empIdx] = {
        ...employees[empIdx],
        ...body,
        employee_id: id,
        children_count: body.children_count !== undefined ? parseInt(body.children_count, 10) : employees[empIdx].children_count
    };
    db.tables['03_Employees'] = employees;

    // 2. Update contact
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const cIdx = contacts.findIndex(c => c.employee_id === id);
    if (cIdx >= 0) {
        contacts[cIdx] = {
            ...contacts[cIdx],
            full_name: body.full_name || contacts[cIdx].full_name,
            mobile_phone: body.mobile_phone !== undefined ? body.mobile_phone : contacts[cIdx].mobile_phone,
            work_email: body.work_email !== undefined ? body.work_email : contacts[cIdx].work_email,
            personal_email: body.personal_email !== undefined ? body.personal_email : contacts[cIdx].personal_email,
            permanent_address_full: body.permanent_address_full !== undefined ? body.permanent_address_full : contacts[cIdx].permanent_address_full,
            current_address_full: body.current_address_full !== undefined ? body.current_address_full : contacts[cIdx].current_address_full,
            employee_id: id
        };
        db.tables['04_Contacts_Addresses'] = contacts;
    }

    // 3. Update identity
    const identity = db.tables['05_Identity_Docs'] || [];
    const iIdx = identity.findIndex(i => i.employee_id === id);
    if (iIdx >= 0) {
        identity[iIdx] = {
            ...identity[iIdx],
            full_name: body.full_name || identity[iIdx].full_name,
            id_number: body.id_number !== undefined ? body.id_number : identity[iIdx].id_number,
            id_issue_date: body.id_issue_date !== undefined ? body.id_issue_date : identity[iIdx].id_issue_date,
            id_issue_place: body.id_issue_place !== undefined ? body.id_issue_place : identity[iIdx].id_issue_place,
            passport_number: body.passport_number !== undefined ? body.passport_number : identity[iIdx].passport_number,
            employee_id: id
        };
        db.tables['05_Identity_Docs'] = identity;
    }

    // 4. Update emergency
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const emIdx = emergency.findIndex(em => em.employee_id === id);
    if (emIdx >= 0) {
        emergency[emIdx] = {
            ...emergency[emIdx],
            full_name: body.full_name || emergency[emIdx].full_name,
            contact_name: (body.emergency_name || body.emergency_contact_name) !== undefined ? (body.emergency_name || body.emergency_contact_name) : emergency[emIdx].contact_name,
            relationship: (body.emergency_relation || body.emergency_contact_relation) !== undefined ? (body.emergency_relation || body.emergency_contact_relation) : emergency[emIdx].relationship,
            mobile_phone: (body.emergency_phone || body.emergency_contact_phone) !== undefined ? (body.emergency_phone || body.emergency_contact_phone) : emergency[emIdx].mobile_phone,
            address: body.permanent_address_full || emergency[emIdx].address
        };
        db.tables['06_Emergency_Contacts'] = emergency;
    } else if (body.emergency_name || body.emergency_contact_name) {
        emergency.push({
            employee_id: id,
            full_name: body.full_name || employees[empIdx].full_name,
            contact_name: body.emergency_name || body.emergency_contact_name,
            relationship: body.emergency_relation || body.emergency_contact_relation || 'Vợ',
            mobile_phone: body.emergency_phone || body.emergency_contact_phone || '',
            email: '',
            address: body.permanent_address_full || ''
        });
        db.tables['06_Emergency_Contacts'] = emergency;
    }

    // 5. Update education
    const education = db.tables['07_Education'] || [];
    const eduIdx = education.findIndex(ed => ed.employee_id === id);
    if (eduIdx >= 0) {
        education[eduIdx] = {
            ...education[eduIdx],
            full_name: body.full_name || education[eduIdx].full_name,
            education_level: body.education_level !== undefined ? body.education_level : education[eduIdx].education_level,
            major: body.major !== undefined ? body.major : education[eduIdx].major,
            other_certificates: body.other_certificates !== undefined ? body.other_certificates : education[eduIdx].other_certificates
        };
        db.tables['07_Education'] = education;
    }

    // 6. Update salary
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const sIdx = salaries.findIndex(s => s.employee_id === id);
    if (sIdx >= 0) {
        const base = body.base_salary !== undefined ? parseFloat(body.base_salary) : salaries[sIdx].base_salary;
        const total = body.total_salary !== undefined ? parseFloat(body.total_salary) : salaries[sIdx].total_salary;
        salaries[sIdx] = {
            ...salaries[sIdx],
            full_name: body.full_name || salaries[sIdx].full_name,
            base_salary: base,
            total_salary: total,
            bank_account_number: body.bank_account_number !== undefined ? body.bank_account_number : salaries[sIdx].bank_account_number,
            bank_name: body.bank_name !== undefined ? body.bank_name : salaries[sIdx].bank_name,
            bank_branch: body.bank_branch !== undefined ? body.bank_branch : salaries[sIdx].bank_branch,
            employee_id: id
        };
        db.tables['08_Salaries_Banks'] = salaries;
    }

    // 7. Update insurance
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const insIdx = insurance.findIndex(i => i.employee_id === id);
    if (insIdx >= 0) {
        insurance[insIdx] = {
            ...insurance[insIdx],
            full_name: body.full_name || insurance[insIdx].full_name,
            social_insurance_book_no: body.social_insurance_book_no !== undefined ? body.social_insurance_book_no : insurance[insIdx].social_insurance_book_no,
            social_insurance_code: body.social_insurance_code !== undefined ? body.social_insurance_code : insurance[insIdx].social_insurance_code,
            hospital_registered: body.hospital_registered !== undefined ? body.hospital_registered : insurance[insIdx].hospital_registered,
            employee_id: id
        };
        db.tables['09_Insurance_Welfare'] = insurance;
    }

    // 8. Update contracts
    const contracts = db.tables['10_Contracts'] || [];
    const ctIdx = contracts.findIndex(ct => ct.employee_id === id);
    if (ctIdx >= 0) {
        contracts[ctIdx] = {
            ...contracts[ctIdx],
            full_name: body.full_name || contracts[ctIdx].full_name,
            contract_type: body.contract_type !== undefined ? body.contract_type : contracts[ctIdx].contract_type,
            start_date: body.start_date !== undefined ? body.start_date : contracts[ctIdx].start_date,
            end_date: body.end_date !== undefined ? body.end_date : contracts[ctIdx].end_date
        };
        db.tables['10_Contracts'] = contracts;
    }

    // 9. Update Master Profiles Sheet
    if (db.tables['00_Master_Profiles']) {
        const mIdx = db.tables['00_Master_Profiles'].findIndex(m => m['Mã nhân viên'] === id);
        if (mIdx >= 0) {
            const row = db.tables['00_Master_Profiles'][mIdx];
            if (body.full_name) row['Họ và tên'] = body.full_name;
            if (body.start_date) row['Ngày bắt đầu làm việc'] = body.start_date;
            if (body.end_date) row['Ngày kết thúc'] = body.end_date;
            if (body.contract_type) row['Loại hợp đồng'] = body.contract_type;
            if (deptObj.department_name) row['Phòng/Ban'] = deptObj.department_name;
            if (body.job_rank) row['Cấp bậc'] = body.job_rank;
            if (body.job_title || posObj.position_name) row['Chức danh'] = body.job_title || posObj.position_name;
            if (body.mobile_phone) row['Điện thoại'] = body.mobile_phone;
            if (body.work_email) row['Email'] = body.work_email;
            if (body.work_location) row['Địa điểm làm việc'] = body.work_location;
            if (body.date_of_birth) row['Ngày tháng năm sinh'] = body.date_of_birth;
            if (body.gender) row['Giới tính'] = body.gender;
            if (body.birth_place) row['Nơi sinh'] = body.birth_place;
            if (body.marital_status) row['Tình trạng hôn nhân'] = body.marital_status;
            if (body.children_count !== undefined) row['Số con'] = parseInt(body.children_count, 10);
            if (body.native_place) row['Nguyên quán'] = body.native_place;
            if (body.ethnicity) row['Dân tộc'] = body.ethnicity;
            if (body.religion) row['Tôn giáo'] = body.religion;
            if (body.id_number) row['Số CCCD/Hộ chiếu'] = body.id_number;
            if (body.id_issue_date) row['Ngày cấp'] = body.id_issue_date;
            if (body.id_issue_place) row['Nơi cấp'] = body.id_issue_place;
            if (body.permanent_address_full) row['Địa chỉ thường trú'] = body.permanent_address_full;
            if (body.current_address_full) row['Địa chỉ tạm trú'] = body.current_address_full;
            if (body.social_insurance_book_no) row['Số sổ BHXH'] = body.social_insurance_book_no;
            if (body.hospital_registered) row['Nơi đăng ký khám, chữa bệnh ban đầu'] = body.hospital_registered;
            if (body.tax_code) row['Mã số thuế cá nhân'] = body.tax_code;
            if (body.bank_account_number) row['Số tài khoản'] = body.bank_account_number;
            if (body.bank_name) row['Tên ngân hàng'] = body.bank_name;
            if (body.bank_branch) row['Tên chi nhánh/Phòng Giao dịch'] = body.bank_branch;
            if (body.education_level) row['Trình độ học vấn'] = body.education_level;
            if (body.major) row['Trình độ chuyên môn: Chuyên ngành học'] = body.major;
            if (body.other_certificates) row['Bằng cấp chuyên môn khác'] = body.other_certificates;
            if (body.emergency_name || body.emergency_contact_name) {
                row['Liên lạc khẩn cấp (họ tên, mối quan hệ, số điện thoại)'] = `${body.emergency_name || body.emergency_contact_name} (${body.emergency_relation || 'Người thân'}) - ${body.emergency_phone || ''}`;
            }
        }
    }

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Nhân sự',
        description: `Cập nhật hồ sơ nhân sự ${id} - ${employees[empIdx].full_name}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['00_Master_Profiles', '03_Employees', '04_Contacts_Addresses', '05_Identity_Docs', '06_Emergency_Contacts', '07_Education', '08_Salaries_Banks', '09_Insurance_Welfare', '10_Contracts', '11_System_Accounts', '12_System_Logs']);

    res.json({
        success: true,
        message: 'Cập nhật hồ sơ nhân viên thành công'
    });
});

// 7. SOFT DELETE EMPLOYEE (MOVE TO RECYCLE BIN)
app.delete('/api/employees/:id', async (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;

    if (!db.tables['13_Recycle_Bin']) {
        db.tables['13_Recycle_Bin'] = [];
    }

    const employees = db.tables['03_Employees'] || [];
    const emp = employees.find(e => e.employee_id === id);
    if (!emp) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại trong hệ thống' });
    }

    const empName = emp.full_name || '';
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const master = (db.tables['00_Master_Profiles'] || []).find(m => m['Mã nhân viên'] === id) || null;

    const contact = contacts.find(c => c.employee_id === id) || null;
    const idDoc = identity.find(i => i.employee_id === id) || null;
    const emerg = emergency.find(em => em.employee_id === id) || null;
    const edu = education.find(ed => ed.employee_id === id) || null;
    const sal = salaries.find(s => s.employee_id === id) || null;
    const ins = insurance.find(i => i.employee_id === id) || null;
    const ct = contracts.find(c => c.employee_id === id) || null;
    const acc = accounts.find(a => a.employee_id === id) || null;

    // Create Recycle Bin entry
    const trashEntry = {
        trash_id: `TRASH-${id}-${Date.now()}`,
        employee_id: id,
        full_name: empName,
        gender: emp.gender || '',
        department_id: emp.department_id || '',
        position_id: emp.position_id || '',
        job_title: emp.job_title || '',
        work_email: (contact && contact.work_email) || '',
        mobile_phone: (contact && contact.mobile_phone) || '',
        deleted_at: new Date().toISOString(),
        deleted_by_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        deleted_by_id: req.body?.operator_id || 'TH-1948',
        backup_data: JSON.stringify({
            employee: emp,
            contact,
            identity: idDoc,
            emergency: emerg,
            education: edu,
            salary: sal,
            insurance: ins,
            contract: ct,
            account: acc,
            master
        })
    };

    // Add to 13_Recycle_Bin
    db.tables['13_Recycle_Bin'].unshift(trashEntry);

    // Remove from active tables
    const tableKeysToClean = [
        '03_Employees',
        '04_Contacts_Addresses',
        '05_Identity_Docs',
        '06_Emergency_Contacts',
        '07_Education',
        '08_Salaries_Banks',
        '09_Insurance_Welfare',
        '10_Contracts',
        '11_System_Accounts'
    ];

    for (const key of tableKeysToClean) {
        if (Array.isArray(db.tables[key])) {
            db.tables[key] = db.tables[key].filter(item => item.employee_id !== id);
        }
    }

    if (Array.isArray(db.tables['00_Master_Profiles'])) {
        db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(item => item['Mã nhân viên'] !== id);
    }

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Thùng rác',
        description: `Đã chuyển hồ sơ nhân sự ${id} (${empName}) vào Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['00_Master_Profiles', '03_Employees', '13_Recycle_Bin', '12_System_Logs']);
    res.json({
        success: true,
        message: `Đã chuyển nhân viên ${empName} (${id}) vào Thùng rác`,
        trash_id: trashEntry.trash_id
    });
});

// 7b. BULK SOFT DELETE EMPLOYEES (MOVE MULTIPLE TO RECYCLE BIN)
app.post('/api/employees/delete-bulk', async (req, res) => {
    const db = loadDatabase();
    const { employee_ids } = req.body;

    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách mã nhân sự cần xóa không hợp lệ' });
    }

    if (!db.tables['13_Recycle_Bin']) {
        db.tables['13_Recycle_Bin'] = [];
    }

    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const masterProfiles = db.tables['00_Master_Profiles'] || [];

    const idSet = new Set(employee_ids);
    const movedItems = [];
    const nowStr = new Date().toISOString();
    const opName = req.body?.operator_name || 'Huỳnh Thanh Long';
    const opId = req.body?.operator_id || 'TH-1948';

    for (const id of employee_ids) {
        const emp = employees.find(e => e.employee_id === id);
        if (!emp) continue;

        const contact = contacts.find(c => c.employee_id === id) || null;
        const idDoc = identity.find(i => i.employee_id === id) || null;
        const emerg = emergency.find(em => em.employee_id === id) || null;
        const edu = education.find(ed => ed.employee_id === id) || null;
        const sal = salaries.find(s => s.employee_id === id) || null;
        const ins = insurance.find(i => i.employee_id === id) || null;
        const ct = contracts.find(c => c.employee_id === id) || null;
        const acc = accounts.find(a => a.employee_id === id) || null;
        const master = masterProfiles.find(m => m['Mã nhân viên'] === id || m.employee_id === id) || null;

        const trashEntry = {
            trash_id: `TRASH-${id}-${Date.now()}`,
            employee_id: id,
            full_name: emp.full_name || id,
            gender: emp.gender || '',
            department_id: emp.department_id || '',
            position_id: emp.position_id || '',
            job_title: emp.job_title || '',
            work_email: (contact && contact.work_email) || '',
            mobile_phone: (contact && contact.mobile_phone) || '',
            deleted_at: nowStr,
            deleted_by_name: opName,
            deleted_by_id: opId,
            backup_data: JSON.stringify({
                employee: emp,
                contact,
                identity: idDoc,
                emergency: emerg,
                education: edu,
                salary: sal,
                insurance: ins,
                contract: ct,
                account: acc,
                master
            })
        };

        db.tables['13_Recycle_Bin'].unshift(trashEntry);
        movedItems.push(trashEntry);
    }

    if (movedItems.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên nào hợp lệ để xóa' });
    }

    const tableKeysToClean = [
        '03_Employees',
        '04_Contacts_Addresses',
        '05_Identity_Docs',
        '06_Emergency_Contacts',
        '07_Education',
        '08_Salaries_Banks',
        '09_Insurance_Welfare',
        '10_Contracts',
        '11_System_Accounts'
    ];

    for (const key of tableKeysToClean) {
        if (Array.isArray(db.tables[key])) {
            db.tables[key] = db.tables[key].filter(item => !idSet.has(item.employee_id));
        }
    }

    if (Array.isArray(db.tables['00_Master_Profiles'])) {
        db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(item => !idSet.has(item['Mã nhân viên']) && !idSet.has(item.employee_id));
    }

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Thùng rác',
        description: `Đã chuyển hàng loạt ${movedItems.length} nhân sự vào Thùng rác`,
        user_id: opId,
        user_name: opName,
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['00_Master_Profiles', '03_Employees', '13_Recycle_Bin', '12_System_Logs']);

    res.json({
        success: true,
        message: `Đã chuyển thành công ${movedItems.length} nhân sự vào Thùng rác`,
        count: movedItems.length,
        items: movedItems
    });
});

// ==========================================
// RECYCLE BIN (THÙNG RÁC) ENDPOINTS
// ==========================================

// GET ALL ITEMS IN RECYCLE BIN
app.get('/api/trash', (req, res) => {
    const db = loadDatabase();
    const trash = db.tables['13_Recycle_Bin'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const deptMap = {};
    depts.forEach(d => deptMap[d.department_id] = d.department_name);
    const posMap = {};
    pos.forEach(p => posMap[p.position_id] = p.position_name);

    const enriched = trash.map(item => ({
        ...item,
        department_name: deptMap[item.department_id] || item.department_id,
        position_name: posMap[item.position_id] || item.position_id
    }));

    res.json({
        success: true,
        total: enriched.length,
        data: enriched
    });
});

// RESTORE EMPLOYEE FROM RECYCLE BIN
app.post('/api/trash/restore/:id', async (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const trash = db.tables['13_Recycle_Bin'] || [];
    const trashIdx = trash.findIndex(t => t.employee_id === id);

    if (trashIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân sự không tìm thấy trong Thùng rác' });
    }

    const trashItem = trash[trashIdx];
    let backup = {};
    try {
        backup = JSON.parse(trashItem.backup_data || '{}');
    } catch (e) {
        console.error('Error parsing backup_data:', e);
    }

    // Restore into respective tables
    if (backup.employee) {
        if (!db.tables['03_Employees']) db.tables['03_Employees'] = [];
        // Prevent duplicate
        db.tables['03_Employees'] = db.tables['03_Employees'].filter(e => e.employee_id !== id);
        db.tables['03_Employees'].unshift(backup.employee);
    }
    if (backup.contact) {
        if (!db.tables['04_Contacts_Addresses']) db.tables['04_Contacts_Addresses'] = [];
        db.tables['04_Contacts_Addresses'] = db.tables['04_Contacts_Addresses'].filter(c => c.employee_id !== id);
        db.tables['04_Contacts_Addresses'].unshift(backup.contact);
    }
    if (backup.identity) {
        if (!db.tables['05_Identity_Docs']) db.tables['05_Identity_Docs'] = [];
        db.tables['05_Identity_Docs'] = db.tables['05_Identity_Docs'].filter(i => i.employee_id !== id);
        db.tables['05_Identity_Docs'].unshift(backup.identity);
    }
    if (backup.emergency) {
        if (!db.tables['06_Emergency_Contacts']) db.tables['06_Emergency_Contacts'] = [];
        db.tables['06_Emergency_Contacts'] = db.tables['06_Emergency_Contacts'].filter(em => em.employee_id !== id);
        db.tables['06_Emergency_Contacts'].unshift(backup.emergency);
    }
    if (backup.education) {
        if (!db.tables['07_Education']) db.tables['07_Education'] = [];
        db.tables['07_Education'] = db.tables['07_Education'].filter(ed => ed.employee_id !== id);
        db.tables['07_Education'].unshift(backup.education);
    }
    if (backup.salary) {
        if (!db.tables['08_Salaries_Banks']) db.tables['08_Salaries_Banks'] = [];
        db.tables['08_Salaries_Banks'] = db.tables['08_Salaries_Banks'].filter(s => s.employee_id !== id);
        db.tables['08_Salaries_Banks'].unshift(backup.salary);
    }
    if (backup.insurance) {
        if (!db.tables['09_Insurance_Welfare']) db.tables['09_Insurance_Welfare'] = [];
        db.tables['09_Insurance_Welfare'] = db.tables['09_Insurance_Welfare'].filter(i => i.employee_id !== id);
        db.tables['09_Insurance_Welfare'].unshift(backup.insurance);
    }
    if (backup.contract) {
        if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
        db.tables['10_Contracts'] = db.tables['10_Contracts'].filter(c => c.employee_id !== id);
        db.tables['10_Contracts'].unshift(backup.contract);
    }
    if (backup.account) {
        if (!db.tables['11_System_Accounts']) db.tables['11_System_Accounts'] = [];
        db.tables['11_System_Accounts'] = db.tables['11_System_Accounts'].filter(a => a.employee_id !== id);
        db.tables['11_System_Accounts'].unshift(backup.account);
    }
    if (backup.master) {
        if (!db.tables['00_Master_Profiles']) db.tables['00_Master_Profiles'] = [];
        db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(m => m['Mã nhân viên'] !== id);
        db.tables['00_Master_Profiles'].unshift(backup.master);
    }

    // Remove from 13_Recycle_Bin
    trash.splice(trashIdx, 1);
    db.tables['13_Recycle_Bin'] = trash;

    recordLog(db, {
        action_type: 'RESTORE',
        module: 'Thùng rác',
        description: `Đã khôi phục hồ sơ nhân sự ${id} (${trashItem.full_name}) về danh sách hoạt động`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['00_Master_Profiles', '03_Employees', '13_Recycle_Bin', '12_System_Logs']);
    res.json({
        success: true,
        message: `Đã khôi phục thành công nhân viên ${trashItem.full_name} (${id})`
    });
});

// BULK RESTORE
app.post('/api/trash/restore-bulk', async (req, res) => {
    const db = loadDatabase();
    const { employee_ids } = req.body;
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách mã nhân sự không hợp lệ' });
    }

    const trash = db.tables['13_Recycle_Bin'] || [];
    let restoredCount = 0;

    employee_ids.forEach(id => {
        const trashIdx = trash.findIndex(t => t.employee_id === id);
        if (trashIdx !== -1) {
            const trashItem = trash[trashIdx];
            let backup = {};
            try {
                backup = JSON.parse(trashItem.backup_data || '{}');
            } catch (e) { }

            if (backup.employee) {
                if (!db.tables['03_Employees']) db.tables['03_Employees'] = [];
                db.tables['03_Employees'] = db.tables['03_Employees'].filter(e => e.employee_id !== id);
                db.tables['03_Employees'].unshift(backup.employee);
            }
            if (backup.contact) {
                if (!db.tables['04_Contacts_Addresses']) db.tables['04_Contacts_Addresses'] = [];
                db.tables['04_Contacts_Addresses'] = db.tables['04_Contacts_Addresses'].filter(c => c.employee_id !== id);
                db.tables['04_Contacts_Addresses'].unshift(backup.contact);
            }
            if (backup.identity) {
                if (!db.tables['05_Identity_Docs']) db.tables['05_Identity_Docs'] = [];
                db.tables['05_Identity_Docs'] = db.tables['05_Identity_Docs'].filter(i => i.employee_id !== id);
                db.tables['05_Identity_Docs'].unshift(backup.identity);
            }
            if (backup.emergency) {
                if (!db.tables['06_Emergency_Contacts']) db.tables['06_Emergency_Contacts'] = [];
                db.tables['06_Emergency_Contacts'] = db.tables['06_Emergency_Contacts'].filter(em => em.employee_id !== id);
                db.tables['06_Emergency_Contacts'].unshift(backup.emergency);
            }
            if (backup.education) {
                if (!db.tables['07_Education']) db.tables['07_Education'] = [];
                db.tables['07_Education'] = db.tables['07_Education'].filter(ed => ed.employee_id !== id);
                db.tables['07_Education'].unshift(backup.education);
            }
            if (backup.salary) {
                if (!db.tables['08_Salaries_Banks']) db.tables['08_Salaries_Banks'] = [];
                db.tables['08_Salaries_Banks'] = db.tables['08_Salaries_Banks'].filter(s => s.employee_id !== id);
                db.tables['08_Salaries_Banks'].unshift(backup.salary);
            }
            if (backup.insurance) {
                if (!db.tables['09_Insurance_Welfare']) db.tables['09_Insurance_Welfare'] = [];
                db.tables['09_Insurance_Welfare'] = db.tables['09_Insurance_Welfare'].filter(i => i.employee_id !== id);
                db.tables['09_Insurance_Welfare'].unshift(backup.insurance);
            }
            if (backup.contract) {
                if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
                db.tables['10_Contracts'] = db.tables['10_Contracts'].filter(c => c.employee_id !== id);
                db.tables['10_Contracts'].unshift(backup.contract);
            }
            if (backup.account) {
                if (!db.tables['11_System_Accounts']) db.tables['11_System_Accounts'] = [];
                db.tables['11_System_Accounts'] = db.tables['11_System_Accounts'].filter(a => a.employee_id !== id);
                db.tables['11_System_Accounts'].unshift(backup.account);
            }
            if (backup.master) {
                if (!db.tables['00_Master_Profiles']) db.tables['00_Master_Profiles'] = [];
                db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(m => m['Mã nhân viên'] !== id);
                db.tables['00_Master_Profiles'].unshift(backup.master);
            }

            trash.splice(trashIdx, 1);
            restoredCount++;
        }
    });

    db.tables['13_Recycle_Bin'] = trash;

    recordLog(db, {
        action_type: 'RESTORE',
        module: 'Thùng rác',
        description: `Khôi phục hàng loạt ${restoredCount} nhân sự từ Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['00_Master_Profiles', '03_Employees', '13_Recycle_Bin', '12_System_Logs']);
    res.json({
        success: true,
        message: `Đã khôi phục thành công ${restoredCount} nhân sự`,
        restoredCount
    });
});

// PERMANENT DELETE FROM RECYCLE BIN
app.delete('/api/trash/permanent/:id', async (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const trash = db.tables['13_Recycle_Bin'] || [];
    const trashIdx = trash.findIndex(t => t.employee_id === id);

    if (trashIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân sự không tìm thấy trong Thùng rác' });
    }

    const trashItem = trash[trashIdx];
    trash.splice(trashIdx, 1);
    db.tables['13_Recycle_Bin'] = trash;

    recordLog(db, {
        action_type: 'PURGE',
        module: 'Thùng rác',
        description: `Xóa vĩnh viễn hồ sơ nhân sự ${id} (${trashItem.full_name}) khỏi Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['13_Recycle_Bin', '12_System_Logs']);
    res.json({
        success: true,
        message: `Đã xóa vĩnh viễn nhân viên ${trashItem.full_name} (${id}) khỏi hệ thống`
    });
});

// BULK PERMANENT DELETE
app.delete('/api/trash/permanent-bulk', async (req, res) => {
    const db = loadDatabase();
    const { employee_ids } = req.body;
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách mã nhân sự không hợp lệ' });
    }

    const trash = db.tables['13_Recycle_Bin'] || [];
    const initialLen = trash.length;
    db.tables['13_Recycle_Bin'] = trash.filter(t => !employee_ids.includes(t.employee_id));
    const deletedCount = initialLen - db.tables['13_Recycle_Bin'].length;

    recordLog(db, {
        action_type: 'PURGE',
        module: 'Thùng rác',
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} nhân sự khỏi Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['13_Recycle_Bin', '12_System_Logs']);
    res.json({
        success: true,
        message: `Đã xóa vĩnh viễn ${deletedCount} nhân sự khỏi hệ thống`,
        deletedCount
    });
});

// EMPTY RECYCLE BIN
app.delete('/api/trash/empty', async (req, res) => {
    const db = loadDatabase();
    const trash = db.tables['13_Recycle_Bin'] || [];
    const count = trash.length;

    db.tables['13_Recycle_Bin'] = [];

    recordLog(db, {
        action_type: 'PURGE',
        module: 'Thùng rác',
        description: `Đã dọn sạch toàn bộ Thùng rác (${count} nhân sự)`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    await autoSyncToSheets(db, ['13_Recycle_Bin', '12_System_Logs']);
    res.json({
        success: true,
        message: `Đã dọn sạch toàn bộ Thùng rác (${count} nhân sự)`
    });
});

// ==========================================
// DEPARTMENTS & POSITIONS MANAGEMENT ENDPOINTS
// ==========================================

// GET DEPARTMENTS
app.get('/api/departments', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['01_Departments'] || []
    });
});

// CREATE DEPARTMENT
app.post('/api/departments', (req, res) => {
    const db = loadDatabase();
    const depts = db.tables['01_Departments'] || [];
    const body = req.body;

    const deptId = (body.department_id || '').trim().toUpperCase();
    const deptName = (body.department_name || '').trim();

    if (!deptId || !deptName) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Mã và Tên phòng ban' });
    }

    if (depts.some(d => (d.department_id || '').toUpperCase() === deptId)) {
        return res.status(400).json({ success: false, message: `Mã phòng ban "${deptId}" đã tồn tại trên hệ thống` });
    }

    const newDept = {
        department_id: deptId,
        department_name: deptName,
        parent_dept_id: body.parent_dept_id || '',
        manager_id: body.manager_id || '',
        status: body.status || 'Hoạt động'
    };

    depts.push(newDept);
    db.tables['01_Departments'] = depts;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tổ chức',
        description: `Thêm mới phòng ban: ${newDept.department_id} - ${newDept.department_name}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm mới phòng ban thành công!',
        department: newDept
    });
});

// UPDATE DEPARTMENT
app.put('/api/departments/:id', (req, res) => {
    const db = loadDatabase();
    const depts = db.tables['01_Departments'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = depts.findIndex(d => d.department_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phòng ban' });
    }

    const oldName = depts[idx].department_name;
    const newName = (body.department_name || oldName).trim();

    depts[idx] = {
        ...depts[idx],
        department_name: newName,
        parent_dept_id: body.parent_dept_id !== undefined ? body.parent_dept_id : depts[idx].parent_dept_id,
        manager_id: body.manager_id !== undefined ? body.manager_id : depts[idx].manager_id,
        status: body.status || depts[idx].status
    };

    db.tables['01_Departments'] = depts;

    // Sync updated department_name to employees table
    if (db.tables['03_Employees']) {
        db.tables['03_Employees'].forEach(emp => {
            if (emp.department_id === id) {
                emp.department_name = newName;
            }
        });
    }

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tổ chức',
        description: `Cập nhật phòng ban ${id}: ${oldName} -> ${newName}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật phòng ban thành công!',
        department: depts[idx]
    });
});

// DELETE DEPARTMENT
app.delete('/api/departments/:id', (req, res) => {
    const db = loadDatabase();
    let depts = db.tables['01_Departments'] || [];
    const employees = db.tables['03_Employees'] || [];
    const id = req.params.id;

    const target = depts.find(d => d.department_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phòng ban' });
    }

    // Check if active employees belong to this department
    const activeAssigned = employees.filter(e => e.department_id === id && e.employment_status !== 'Đã nghỉ việc');
    if (activeAssigned.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Không thể xóa phòng ban này vì đang có ${activeAssigned.length} nhân sự đang làm việc. Vui lòng chuyển nhân sự sang phòng ban khác trước.`
        });
    }

    depts = depts.filter(d => d.department_id !== id);
    db.tables['01_Departments'] = depts;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tổ chức',
        description: `Xóa phòng ban ${id} - ${target.department_name}`,
        user_id: req.body?.operator_id || 'TH-0001',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa phòng ban thành công!' });
});

// GET POSITIONS
app.get('/api/positions', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['02_Positions'] || []
    });
});

// CREATE POSITION
app.post('/api/positions', (req, res) => {
    const db = loadDatabase();
    const positions = db.tables['02_Positions'] || [];
    const body = req.body;

    const posId = (body.position_id || '').trim().toUpperCase();
    const posName = (body.position_name || '').trim();

    if (!posId || !posName) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Mã và Tên vị trí chức danh' });
    }

    if (positions.some(p => (p.position_id || '').toUpperCase() === posId)) {
        return res.status(400).json({ success: false, message: `Mã vị trí "${posId}" đã tồn tại trên hệ thống` });
    }

    const newPos = {
        position_id: posId,
        position_name: posName,
        department_id: body.department_id || '',
        level: body.level || 'Cấp 3',
        status: body.status || 'Hoạt động'
    };

    positions.push(newPos);
    db.tables['02_Positions'] = positions;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tổ chức',
        description: `Thêm mới vị trí công việc: ${newPos.position_id} - ${newPos.position_name}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm mới vị trí công việc thành công!',
        position: newPos
    });
});

// UPDATE POSITION
app.put('/api/positions/:id', (req, res) => {
    const db = loadDatabase();
    const positions = db.tables['02_Positions'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = positions.findIndex(p => p.position_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí công việc' });
    }

    const oldName = positions[idx].position_name;
    const newName = (body.position_name || oldName).trim();

    positions[idx] = {
        ...positions[idx],
        position_name: newName,
        department_id: body.department_id !== undefined ? body.department_id : positions[idx].department_id,
        level: body.level || positions[idx].level,
        status: body.status || positions[idx].status
    };

    db.tables['02_Positions'] = positions;

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tổ chức',
        description: `Cập nhật vị trí công việc ${id}: ${oldName} -> ${newName}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật vị trí công việc thành công!',
        position: positions[idx]
    });
});

// DELETE POSITION
app.delete('/api/positions/:id', (req, res) => {
    const db = loadDatabase();
    let positions = db.tables['02_Positions'] || [];
    const employees = db.tables['03_Employees'] || [];
    const id = req.params.id;

    const target = positions.find(p => p.position_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí công việc' });
    }

    // Check if active employees hold this position
    const activeAssigned = employees.filter(e => e.position_id === id && e.employment_status !== 'Đã nghỉ việc');
    if (activeAssigned.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Không thể xóa vị trí này vì đang có ${activeAssigned.length} nhân sự đảm nhiệm. Vui lòng chuyển chức danh nhân sự trước.`
        });
    }

    positions = positions.filter(p => p.position_id !== id);
    db.tables['02_Positions'] = positions;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tổ chức',
        description: `Xóa vị trí công việc ${id} - ${target.position_name}`,
        user_id: req.body?.operator_id || 'TH-0001',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa vị trí công việc thành công!' });
});

// ==========================================
// AUTHENTICATION & SESSION ENDPOINTS
// ==========================================

// LOGIN ENDPOINT
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu' });
        }

        const db = loadDatabase();
        const accounts = db.tables['11_System_Accounts'] || [];
        const employees = db.tables['03_Employees'] || [];
        const contacts = db.tables['04_Contacts_Addresses'] || [];

        const q = username.toLowerCase().trim();

        // Find account by username, employee_id, account_email, or admin aliases
        let userAcc = accounts.find(a =>
            (a.username && a.username.toLowerCase().trim() === q) ||
            (a.employee_id && a.employee_id.toLowerCase().trim() === q) ||
            (a.account_email && a.account_email.toLowerCase().trim() === q) ||
            (a.role === 'ADMIN' && ['admin', 'longht', 'longht@trunghaico.vn', 'admin@trunghai.vn', 'admin@trunghaico.vn'].includes(q))
        );

        // Fallback: match by employee profile work_email or mobile_phone
        if (!userAcc) {
            const matchedEmp = employees.find(e =>
                (e.employee_id && e.employee_id.toLowerCase().trim() === q) ||
                (e.work_email && e.work_email.toLowerCase().trim() === q)
            ) || contacts.find(c =>
                (c.employee_id && c.employee_id.toLowerCase().trim() === q) ||
                (c.work_email && c.work_email.toLowerCase().trim() === q)
            );

            if (matchedEmp) {
                userAcc = accounts.find(a => a.employee_id === matchedEmp.employee_id);
            }
        }

        if (!userAcc) {
            recordLog(db, {
                action_type: 'LOGIN_FAIL',
                module: 'Bảo mật',
                description: `Đăng nhập thất bại: Tài khoản "${username}" không tồn tại`,
                user_id: username,
                user_name: username,
                user_role: 'GUEST',
                ip: req.ip
            });
            saveDatabase(db);
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
        }

        // Check account status
        if (userAcc.account_status === 'Khóa' || userAcc.account_status === 'Tạm khóa') {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.' });
        }

        // Verify password
        const isMatch = await verifyPassword(password, userAcc.password);
        if (!isMatch) {
            recordLog(db, {
                action_type: 'LOGIN_FAIL',
                module: 'Bảo mật',
                description: `Đăng nhập thất bại: Sai mật khẩu cho tài khoản ${userAcc.employee_id} (${userAcc.full_name})`,
                user_id: userAcc.employee_id,
                user_name: userAcc.full_name,
                user_role: userAcc.role || 'HR',
                ip: req.ip
            });
            saveDatabase(db);
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
        }

        // Auto-upgrade plain-text password to bcrypt hash in database
        if (!userAcc.password.startsWith('$2a$') && !userAcc.password.startsWith('$2b$')) {
            userAcc.password = await hashPassword(password);
            saveDatabase(db);
        }

        // Generate JWT Token (Expires in 24 hours)
        const tokenPayload = {
            account_id: userAcc.account_id,
            employee_id: userAcc.employee_id,
            username: userAcc.username || userAcc.employee_id,
            full_name: userAcc.full_name,
            role: userAcc.role || 'HR'
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Record successful login in audit trail
        recordLog(db, {
            action_type: 'LOGIN',
            module: 'Bảo mật',
            description: `Đăng nhập thành công vào hệ thống (${userAcc.full_name} - Quyền: ${userAcc.role})`,
            user_id: userAcc.employee_id,
            user_name: userAcc.full_name,
            user_role: userAcc.role || 'HR',
            ip: req.ip
        });
        saveDatabase(db);

        res.json({
            success: true,
            message: `Đăng nhập thành công! Chào mừng ${userAcc.full_name}`,
            token,
            user: tokenPayload
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ trong quá trình xác thực: ' + e.message });
    }
});

// GET CURRENT AUTH PROFILE
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// CHANGE PASSWORD
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới' });
        }

        const db = loadDatabase();
        const accounts = db.tables['11_System_Accounts'] || [];
        const userAcc = accounts.find(a => a.employee_id === req.user.employee_id);

        if (!userAcc) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
        }

        const isMatch = await verifyPassword(current_password, userAcc.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
        }

        userAcc.password = await hashPassword(new_password);
        saveDatabase(db);

        recordLog(db, {
            action_type: 'PASSWORD',
            module: 'Bảo mật',
            description: `Đổi mật khẩu thành công cho tài khoản ${req.user.employee_id} (${req.user.full_name})`,
            user_id: req.user.employee_id,
            user_name: req.user.full_name,
            user_role: req.user.role,
            ip: req.ip
        });

        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==========================================
// ACCOUNTS & RBAC MANAGEMENT ENDPOINTS
// ==========================================

// GET ACCOUNTS
app.get('/api/accounts', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['11_System_Accounts'] || []
    });
});

// CREATE ACCOUNT
app.post('/api/accounts', async (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const body = req.body;

    if (!body.employee_id || !body.account_email) {
        return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên hoặc email' });
    }

    // Check duplicate
    if (accounts.some(a => a.employee_id === body.employee_id)) {
        return res.status(400).json({ success: false, message: 'Nhân viên này đã có tài khoản hệ thống' });
    }

    const hashedPassword = await hashPassword(body.password || '123456');

    const newAcc = {
        account_id: `ACC-${body.employee_id.replace('-', '')}`,
        employee_id: body.employee_id,
        full_name: body.full_name || '',
        account_email: body.account_email,
        role: body.role || 'HR',
        account_status: body.account_status || 'Kích hoạt',
        password: hashedPassword
    };

    accounts.unshift(newAcc);
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tài khoản',
        description: `Cấp tài khoản mới cho NV ${newAcc.employee_id} (${newAcc.full_name}) - Quyền: ${newAcc.role === 'ADMIN' ? 'Admin' : 'Nhân sự'}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({ success: true, message: 'Cấp tài khoản thành công', account: newAcc });
});

// UPDATE ACCOUNT (ROLE / STATUS / EMAIL)
app.put('/api/accounts/:id', async (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = accounts.findIndex(a => a.account_id === id || a.employee_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    let updatedPassword = accounts[idx].password;
    if (body.password) {
        updatedPassword = await hashPassword(body.password);
    }

    accounts[idx] = {
        ...accounts[idx],
        ...body,
        password: updatedPassword,
        account_id: accounts[idx].account_id,
        employee_id: accounts[idx].employee_id
    };

    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tài khoản',
        description: `Cập nhật tài khoản ${accounts[idx].employee_id} (${accounts[idx].full_name}) - Quyền: ${accounts[idx].role}, Trạng thái: ${accounts[idx].account_status}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Cập nhật phân quyền tài khoản thành công', account: accounts[idx] });
});

// RESET PASSWORD
app.post('/api/accounts/:id/reset-password', async (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;
    const { new_password, operator_id, operator_name, operator_role } = req.body;

    const idx = accounts.findIndex(a => a.account_id === id || a.employee_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    accounts[idx].password = await hashPassword(new_password || '123456');
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'PASSWORD',
        module: 'Tài khoản',
        description: `Đặt lại mật khẩu cho tài khoản ${accounts[idx].employee_id} (${accounts[idx].full_name})`,
        user_id: operator_id || 'TH-1948',
        user_name: operator_name || 'Huỳnh Thanh Long',
        user_role: operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Mật khẩu đã được thiết lập lại thành công' });
});

// DELETE ACCOUNT
app.delete('/api/accounts/:id', (req, res) => {
    const db = loadDatabase();
    let accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;

    const target = accounts.find(a => a.account_id === id || a.employee_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    accounts = accounts.filter(a => a.account_id !== id && a.employee_id !== id);
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tài khoản',
        description: `Xóa tài khoản đăng nhập ${target.employee_id} (${target.full_name}) khỏi hệ thống`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa tài khoản khỏi hệ thống' });
});

// ==========================================
// SYSTEM ACTIVITY LOGS API ENDPOINTS
// ==========================================

// GET LOGS
app.get('/api/logs', (req, res) => {
    const db = loadDatabase();
    const logs = db.tables['12_System_Logs'] || [];
    res.json({
        success: true,
        data: logs
    });
});

// CREATE CLIENT LOG (LOGOUT, EXPORT, REPORT ACTIONS)
app.post('/api/logs', (req, res) => {
    const db = loadDatabase();
    const { action_type, module, description, user_id, user_name, user_role } = req.body;

    const entry = recordLog(db, {
        action_type: action_type || 'INFO',
        module: module || 'Hệ thống',
        description: description || '',
        user_id,
        user_name,
        user_role,
        ip: req.ip
    });

    saveDatabase(db);
    res.status(201).json({ success: true, log: entry });
});

// CLEAR ALL LOGS (ADMIN ONLY)
app.delete('/api/logs', (req, res) => {
    const db = loadDatabase();
    db.tables['12_System_Logs'] = [];

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Hệ thống',
        description: 'Đã xóa toàn bộ lịch sử nhật ký hoạt động',
        user_id: req.body?.user_id || 'TH-1948',
        user_name: req.body?.user_name || 'Huỳnh Thanh Long',
        user_role: 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Đã làm trống toàn bộ nhật ký' });
});

// 10. EXPORT EXCEL
app.get('/api/export', (req, res) => {
    const db = loadDatabase();
    const wb = XLSX.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(db.tables)) {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="HRM_Export_TrungHai.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});
// ==========================================
// COMPANY BRANDING & SETTINGS API ENDPOINTS
// ==========================================

const DEFAULT_COMPANY_INFO = {
    brand_name: "TRUNG HẢI",
    full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
    subtitle: "HRM ENTERPRISE",
    logo_url: "assets/logo.png",
    tax_code: "0101234567",
    phone: "024.1234.5678",
    email: "contact@trunghaico.vn",
    address: "Tòa nhà Trung Hải, Hà Nội",
    website: "https://trunghaico.vn"
};

// GET COMPANY INFO
app.get('/api/company/info', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        company: db.company_info || DEFAULT_COMPANY_INFO
    });
});

// UPDATE COMPANY INFO
app.post('/api/company/info', (req, res) => {
    const db = loadDatabase();
    const body = req.body;

    db.company_info = {
        ...(db.company_info || DEFAULT_COMPANY_INFO),
        brand_name: body.brand_name || db.company_info?.brand_name || DEFAULT_COMPANY_INFO.brand_name,
        full_name: body.full_name || db.company_info?.full_name || DEFAULT_COMPANY_INFO.full_name,
        subtitle: body.subtitle !== undefined ? body.subtitle : (db.company_info?.subtitle || DEFAULT_COMPANY_INFO.subtitle),
        logo_url: body.logo_url || db.company_info?.logo_url || DEFAULT_COMPANY_INFO.logo_url,
        tax_code: body.tax_code !== undefined ? body.tax_code : (db.company_info?.tax_code || ''),
        phone: body.phone !== undefined ? body.phone : (db.company_info?.phone || ''),
        email: body.email !== undefined ? body.email : (db.company_info?.email || ''),
        address: body.address !== undefined ? body.address : (db.company_info?.address || ''),
        website: body.website !== undefined ? body.website : (db.company_info?.website || '')
    };

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Hệ thống',
        description: `Cập nhật thông tin doanh nghiệp & thương hiệu: ${db.company_info.brand_name} - ${db.company_info.full_name}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật thông tin doanh nghiệp thành công!',
        company: db.company_info
    });
});

// UPLOAD COMPANY LOGO (Base64)
app.post('/api/company/upload-logo', (req, res) => {
    try {
        const { image_base64 } = req.body;
        if (!image_base64) {
            return res.status(400).json({ success: false, message: 'Chưa có dữ liệu ảnh logo' });
        }

        const matches = image_base64.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ success: false, message: 'Định dạng ảnh Base64 không hợp lệ' });
        }

        const mimeType = matches[1].toLowerCase();
        let ext = 'png';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('svg')) ext = 'svg';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('gif')) ext = 'gif';

        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `company_logo_${Date.now()}.${ext}`;
        const uploadsDir = UPLOADS_DIR;
        const filePath = path.join(uploadsDir, fileName);
        let finalLogoUrl = `uploads/${fileName}`;

        try {
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            fs.writeFileSync(filePath, buffer);
        } catch (e) {
            console.warn('Cannot write logo to disk (Vercel read-only), using base64 URL directly:', e.message);
            finalLogoUrl = image_base64;
        }

        const db = loadDatabase();
        if (!db.company_info) db.company_info = { ...DEFAULT_COMPANY_INFO };
        db.company_info.logo_url = finalLogoUrl;

        recordLog(db, {
            action_type: 'UPDATE',
            module: 'Hệ thống',
            description: `Tải lên và đổi Logo nhận diện thương hiệu công ty (${fileName})`,
            user_id: req.body.operator_id || 'TH-0001',
            user_name: req.body.operator_name || 'Huỳnh Thanh Long',
            user_role: req.body.operator_role || 'ADMIN',
            ip: req.ip
        });

        saveDatabase(db);

        res.json({
            success: true,
            message: 'Tải lên Logo công ty thành công!',
            logo_url: db.company_info.logo_url,
            company: db.company_info
        });
    } catch (e) {
        console.error('Error uploading logo:', e);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu ảnh logo: ' + e.message });
    }
});

// ==========================================
// GOOGLE SHEETS CLOUD DATABASE ENDPOINTS
// ==========================================

// GET CONFIG & CONNECTION STATUS
app.get('/api/sheets/config', async (req, res) => {
    const cfg = googleSheets.getConfig();
    const status = await googleSheets.testConnection();
    const saInfo = googleSheets.getServiceAccountInfo ? googleSheets.getServiceAccountInfo() : null;
    res.json({
        success: true,
        config: {
            spreadsheetId: cfg.spreadsheetId || '',
            autoSyncOnSave: cfg.autoSyncOnSave !== false,
            serviceAccountEmail: saInfo?.email || status?.serviceAccountEmail || ''
        },
        connection: status
    });
});

// UPDATE CONFIG & TEST CONNECTION
app.post('/api/sheets/config', async (req, res) => {
    const { spreadsheetId, autoSyncOnSave, credentials } = req.body;
    const cleanId = googleSheets.extractSpreadsheetId(spreadsheetId);

    if (credentials) {
        try {
            const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
            googleSheets.setActiveCredentials(parsedCreds);
            process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsedCreds);
            try {
                const tmpKeyFilePath = path.join(os.tmpdir(), 'service-account.json');
                fs.writeFileSync(tmpKeyFilePath, JSON.stringify(parsedCreds, null, 2), 'utf-8');
            } catch (e) { }
        } catch (e) {
            console.error('Error handling credentials in /api/sheets/config:', e.message);
        }
    }

    googleSheets.saveConfig({
        spreadsheetId: cleanId,
        autoSyncOnSave: autoSyncOnSave !== false
    });

    const status = await googleSheets.testConnection(cleanId);
    res.json({
        success: status.success,
        spreadsheetId: cleanId,
        status
    });
});

// FORCE PUSH (SYNC ALL TO GOOGLE SHEETS)
app.post('/api/sheets/sync-to-cloud', async (req, res) => {
    try {
        const db = loadDatabase();
        const result = await googleSheets.exportAllToGoogleSheets(db);

        recordLog(db, {
            action_type: 'SYNC_CLOUD',
            module: 'Cơ sở dữ liệu',
            description: `Đã đồng bộ toàn bộ cơ sở dữ liệu lên Google Sheets`,
            user_id: req.body?.user_id || 'TH-1948',
            user_name: req.body?.user_name || 'Huỳnh Thanh Long',
            user_role: req.body?.user_role || 'ADMIN',
            ip: req.ip
        });
        saveDatabase(db);

        res.json({
            success: true,
            message: 'Đã đồng bộ toàn bộ dữ liệu lên Google Sheets thành công!',
            result
        });
    } catch (e) {
        res.status(500).json({
            success: false,
            message: `Lỗi đồng bộ Google Sheets: ${e.message}`
        });
    }
});

// FORCE PULL (IMPORT ALL FROM GOOGLE SHEETS)
app.post('/api/sheets/pull-from-cloud', async (req, res) => {
    try {
        const cloudData = await googleSheets.importAllFromGoogleSheets();
        if (!cloudData || !cloudData.tables || Object.keys(cloudData.tables).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không tìm thấy dữ liệu hợp lệ trên Google Sheets'
            });
        }

        const db = loadDatabase();
        // Merge or replace
        db.tables = { ...db.tables, ...cloudData.tables };

        recordLog(db, {
            action_type: 'PULL_CLOUD',
            module: 'Cơ sở dữ liệu',
            description: `Đã nạp lại cơ sở dữ liệu từ Google Sheets về hệ thống`,
            user_id: req.body?.user_id || 'TH-1948',
            user_name: req.body?.user_name || 'Huỳnh Thanh Long',
            user_role: req.body?.user_role || 'ADMIN',
            ip: req.ip
        });
        saveDatabase(db);

        res.json({
            success: true,
            message: 'Đã nạp toàn bộ dữ liệu từ Google Sheets về hệ thống thành công!',
            tableCount: Object.keys(cloudData.tables).length
        });
    } catch (e) {
        res.status(500).json({
            success: false,
            message: `Lỗi nạp dữ liệu từ Google Sheets: ${e.message}`
        });
    }
});

// =============================================================================
// SETUP WIZARD API ENDPOINTS
// =============================================================================

// Check setup status
app.get('/api/setup/status', (req, res) => {
    const cfg = googleSheets.getConfig();
    const isCompleted = Boolean(cfg.is_setup_completed && cfg.spreadsheetId);
    res.json({
        is_setup_completed: isCompleted,
        spreadsheetId: cfg.spreadsheetId || '',
        autoSyncOnSave: cfg.autoSyncOnSave !== false
    });
});

// Validate Google Service Account JSON payload
app.post('/api/setup/validate-json', (req, res) => {
    try {
        let { credentials } = req.body;
        if (typeof credentials === 'string') {
            credentials = JSON.parse(credentials);
        }

        if (!credentials || typeof credentials !== 'object') {
            return res.status(400).json({ success: false, message: 'Dữ liệu JSON không đúng cấu trúc đối tượng' });
        }

        if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
            return res.status(400).json({
                success: false,
                message: 'File JSON thiếu các trường bắt buộc của Service Account (client_email, private_key, project_id)'
            });
        }

        res.json({
            success: true,
            message: 'Khóa Service Account JSON hợp lệ!',
            project_id: credentials.project_id,
            client_email: credentials.client_email
        });
    } catch (e) {
        res.status(400).json({
            success: false,
            message: 'Nội dung file không phải định dạng JSON hợp lệ: ' + e.message
        });
    }
});

// Verify connection with custom credentials and spreadsheet ID
app.post('/api/setup/verify-sheet', async (req, res) => {
    try {
        const { credentials, spreadsheetId } = req.body;
        const cleanId = googleSheets.extractSpreadsheetId(spreadsheetId);
        const result = await googleSheets.testConnectionWithCredentials(credentials, cleanId);
        res.json(result);
    } catch (e) {
        res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra kết nối: ' + e.message
        });
    }
});

// Complete Setup Wizard & Initialize System
app.post('/api/setup/complete', async (req, res) => {
    try {
        let { credentials, spreadsheetId, dataOption, admin } = req.body;
        spreadsheetId = googleSheets.extractSpreadsheetId(spreadsheetId);
        if (!spreadsheetId || !spreadsheetId.trim()) {
            return res.status(400).json({ success: false, message: 'Chưa cung cấp Google Spreadsheet ID' });
        }
        if (!credentials) {
            return res.status(400).json({ success: false, message: 'Chưa cung cấp Service Account JSON' });
        }

        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;

        // 1. Cache & Set in-memory credentials immediately
        googleSheets.setActiveCredentials(parsedCreds);
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsedCreds);
        process.env.GOOGLE_SPREADSHEET_ID = spreadsheetId.trim();

        let chosenKeyPath = './config/hrm-trunghaico-507602-fd746f1db385.json';

        // Try writing to config/ directory (works on local machine/VPS)
        try {
            const keyFilePath = path.join(__dirname, 'config', 'service-account.json');
            const configDir = path.join(__dirname, 'config');
            if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
            fs.writeFileSync(keyFilePath, JSON.stringify(parsedCreds, null, 2), 'utf-8');
            chosenKeyPath = './config/service-account.json';
        } catch (err) {
            console.warn('[Setup Complete] Config directory is read-only (Vercel Serverless environment):', err.message);
        }

        // Always write to os.tmpdir() as fallback for Serverless
        try {
            const tmpKeyFilePath = path.join(os.tmpdir(), 'service-account.json');
            fs.writeFileSync(tmpKeyFilePath, JSON.stringify(parsedCreds, null, 2), 'utf-8');
        } catch (err) {
            console.warn('[Setup Complete] Cannot write to tmp directory:', err.message);
        }

        // 2. Save sheets configuration
        googleSheets.saveConfig({
            keyFilePath: chosenKeyPath,
            spreadsheetId: spreadsheetId.trim(),
            autoSyncOnSave: true,
            is_setup_completed: true
        });

        // 3. Prepare Database
        let db = loadDatabase();

        // Handle Super Admin Profile & Account
        const adminId = admin?.employee_id || 'TH-0001';
        const adminName = admin?.full_name || 'Quản Trị Viên';
        const adminEmail = admin?.email || 'admin@trunghai.vn';
        const adminPass = admin?.password || 'admin@123';
        const adminPhone = admin?.phone || '0901234567';
        const adminTitle = admin?.job_title || 'Giám Đốc Quản Trị Hệ Thống';

        if (dataOption === 'CLEAN') {
            // Clean database: reset tables and create 1 admin
            db.tables = {
                '00_Master_Profiles': [{
                    employee_id: adminId,
                    full_name: adminName,
                    work_email: adminEmail,
                    mobile_phone: adminPhone,
                    job_title: adminTitle,
                    department_id: 'BGD',
                    department_name: 'Ban Giám Đốc',
                    employment_status: 'Đang làm việc',
                    labor_nature: 'Chính thức',
                    gender: 'Nam',
                    join_date: new Date().toISOString().split('T')[0]
                }],
                '01_Departments': [
                    { department_id: 'BGD', department_name: 'Ban Giám Đốc', parent_dept_id: '', manager_id: adminId, status: 'Hoạt động' },
                    { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự', parent_dept_id: 'BGD', manager_id: '', status: 'Hoạt động' },
                    { department_id: 'KT', department_name: 'Phòng Tài Chính Kế Toán', parent_dept_id: 'BGD', manager_id: '', status: 'Hoạt động' }
                ],
                '02_Positions': [
                    { position_id: 'POS-01', position_name: 'Tổng Giám Đốc', department_id: 'BGD', level: 'Cấp 10' },
                    { position_id: 'POS-02', position_name: 'Trưởng Phòng Nhân Sự', department_id: 'HR', level: 'Cấp 8' }
                ],
                '03_Employees': [{
                    employee_id: adminId,
                    full_name: adminName,
                    work_email: adminEmail,
                    mobile_phone: adminPhone,
                    job_title: adminTitle,
                    department_id: 'BGD',
                    department_name: 'Ban Giám Đốc',
                    employment_status: 'Đang làm việc',
                    labor_nature: 'Chính thức',
                    gender: 'Nam',
                    join_date: new Date().toISOString().split('T')[0]
                }],
                '04_Contacts_Addresses': [],
                '05_Identity_Docs': [],
                '06_Emergency_Contacts': [],
                '07_Education': [],
                '08_Salaries_Banks': [],
                '09_Insurance_Welfare': [],
                '10_Contracts': [],
                '11_System_Accounts': [{
                    account_id: 'ACC-001',
                    employee_id: adminId,
                    username: admin?.username || adminEmail.split('@')[0] || 'admin',
                    full_name: adminName,
                    role: 'ADMIN',
                    account_status: 'Kích hoạt',
                    password: adminPass,
                    created_at: new Date().toISOString()
                }],
                '12_Activity_Logs': [{
                    log_id: 'LOG-001',
                    action_type: 'SETUP',
                    module: 'Hệ thống',
                    description: `Khởi tạo hệ thống HRM và tạo tài khoản Quản trị viên cấp cao (${adminName})`,
                    user_id: adminId,
                    user_name: adminName,
                    user_role: 'ADMIN',
                    ip: req.ip || '127.0.0.1',
                    created_at: new Date().toISOString()
                }],
                '13_Recycle_Bin': []
            };
        } else {
            // Keep sample data & ensure Super Admin is registered
            const accounts = db.tables['11_System_Accounts'] || [];
            const existingAdminIdx = accounts.findIndex(a => a.username === (admin?.username || 'admin') || a.role === 'ADMIN');
            const adminAcc = {
                account_id: 'ACC-ADMIN',
                employee_id: adminId,
                username: admin?.username || 'admin',
                full_name: adminName,
                role: 'ADMIN',
                account_status: 'Kích hoạt',
                password: adminPass,
                created_at: new Date().toISOString()
            };

            if (existingAdminIdx >= 0) {
                accounts[existingAdminIdx] = { ...accounts[existingAdminIdx], ...adminAcc };
            } else {
                accounts.unshift(adminAcc);
            }
            db.tables['11_System_Accounts'] = accounts;
        }

        saveDatabase(db);

        // 4. Export all 14 tables directly to Google Sheets (passing credentials directly to avoid disk dependency)
        console.log('[Setup Wizard] Đang đẩy 14 bảng dữ liệu lên Google Sheets...');
        await googleSheets.exportAllToGoogleSheets(db, spreadsheetId.trim(), parsedCreds);
        console.log('[Setup Wizard] Đã đồng bộ Google Sheets thành công!');

        res.json({
            success: true,
            message: 'Khởi tạo hệ thống và đồng bộ Google Sheets thành công!',
            admin: {
                username: admin?.username || 'admin',
                full_name: adminName,
                role: 'ADMIN'
            }
        });
    } catch (e) {
        console.error('Setup Complete Error:', e);
        res.status(500).json({
            success: false,
            message: 'Lỗi trong quá trình hoàn tất thiết lập: ' + e.message
        });
    }
});

// Reset setup (For reconfiguration)
app.post('/api/setup/reset', (req, res) => {
    try {
        googleSheets.saveConfig({ is_setup_completed: false });
        res.json({ success: true, message: 'Đã chuyển hệ thống về chế độ cấu hình Setup Wizard' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Setup page route
app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Fallback to SPA index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 HRM WebApp Server running on: http://localhost:${PORT}`);
        console.log(`🏢 TRUNG HAI Human Resource Management System`);
        console.log(`====================================================`);
    });
}

module.exports = app;
