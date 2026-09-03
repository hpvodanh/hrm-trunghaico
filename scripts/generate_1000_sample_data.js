const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const DB_JSON_PATH = path.join(__dirname, '..', 'database_schema.json');
const EXCEL_PATH = path.join(__dirname, '..', 'HRM_Database_Normalized.xlsx');
const SQL_SEED_PATH = path.join(__dirname, '..', 'seed_data.sql');

console.log('🔄 Bắt đầu quy trình tạo 1,000 dữ liệu mẫu nhân sự chuẩn hóa Trung Hải (Đầy đủ 34 cột trường)...');

// Load existing DB for reference tables (00_Data_Dictionary, 01_Departments, 02_Positions)
let originalDb = { tables: {} };
if (fs.existsSync(DB_JSON_PATH)) {
    try {
        originalDb = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
    } catch (e) {
        console.error('Lỗi đọc database_schema.json cũ:', e);
    }
}

const dataDictionary = originalDb.tables['00_Data_Dictionary'] || [];
const departments = originalDb.tables['01_Departments'] || [];
const positions = originalDb.tables['02_Positions'] || [];

if (departments.length === 0 || positions.length === 0) {
    console.error('❌ Lỗi: Không tìm thấy danh mục phòng ban hoặc chức vụ.');
    process.exit(1);
}

// -------------------------------------------------------------
// VIETNAMESE DATA POOLS & GENERATORS
// -------------------------------------------------------------
const lastNames = [
    'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
    'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Đoàn', 'Lâm', 'Trịnh',
    'Mai', 'Đào', 'Cao', 'Hà', 'Lưu', 'Lương', 'Thái', 'Châu', 'Tạ', 'Phùng'
];

const maleMiddleNames = [
    'Văn', 'Đức', 'Minh', 'Hữu', 'Đình', 'Quang', 'Thanh', 'Hải', 'Quốc', 'Tuấn',
    'Ngọc', 'Xuân', 'Thế', 'Thành', 'Huy', 'Hoàng', 'Khắc', 'Trọng', 'Duy', 'Nhật',
    'Tiến', 'Bảo', 'Công', 'Phúc', 'Việt', 'Mạnh', 'Gia', 'Vĩnh', 'Đăng', 'Chí'
];

const maleFirstNames = [
    'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Đức', 'Giang', 'Hà', 'Hải', 'Hào',
    'Hậu', 'Hiếu', 'Hiệp', 'Hòa', 'Hoàng', 'Hùng', 'Hưng', 'Huy', 'Khánh', 'Khoa',
    'Kiên', 'Lâm', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Nhân', 'Nhật', 'Phát', 'Phong',
    'Phú', 'Phúc', 'Quân', 'Quang', 'Sang', 'Sơn', 'Tài', 'Tâm', 'Tân', 'Thắng',
    'Thành', 'Thịnh', 'Thông', 'Thuận', 'Tiến', 'Toàn', 'Trí', 'Trung', 'Trọng', 'Trường',
    'Tú', 'Tuấn', 'Tùng', 'Việt', 'Vinh', 'Vũ', 'Vương', 'Vượng', 'Yên', 'Bảo'
];

const femaleMiddleNames = [
    'Thị', 'Ngọc', 'Thu', 'Thanh', 'Phương', 'Mai', 'Kim', 'Mỹ', 'Thúy', 'Hồng',
    'Bích', 'Ánh', 'Quỳnh', 'Cẩm', 'Diệu', 'Khánh', 'Tuyết', 'Lan', 'Hương', 'Hoài',
    'Tường', 'Bảo', 'Thảo', 'Yến', 'Minh', 'Trúc', 'Gia', 'Hải', 'Như', 'Diễm'
];

const femaleFirstNames = [
    'An', 'Anh', 'Ánh', 'Bình', 'Châu', 'Chi', 'Cúc', 'Diệp', 'Dung', 'Duyên',
    'Giang', 'Hà', 'Hân', 'Hằng', 'Hạnh', 'Hiền', 'Hoa', 'Hoài', 'Hương', 'Hường',
    'Huyền', 'Khánh', 'Lan', 'Linh', 'Loan', 'Ly', 'Mai', 'Mi', 'My', 'Nga',
    'Ngân', 'Ngọc', 'Nhung', 'Oanh', 'Phương', 'Quyên', 'Quỳnh', 'Tâm', 'Thảo', 'Thi',
    'Thu', 'Thư', 'Thương', 'Thúy', 'Thủy', 'Tiên', 'Trang', 'Trâm', 'Trinh', 'Trúc',
    'Tú', 'Tuyết', 'Uyên', 'Vân', 'Vi', 'Vy', 'Xuân', 'Yến', 'Đan', 'Nhi'
];

const provinces = [
    { name: 'Hà Nội', code: '001', districts: ['Ba Đình', 'Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Hoàn Kiếm', 'Thanh Xuân', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Hà Đông', 'Hoàng Mai'] },
    { name: 'TP. Hồ Chí Minh', code: '079', districts: ['Quận 1', 'Quận 3', 'Quận 7', 'Quận 10', 'Bình Thạnh', 'Tân Bình', 'Gò Vấp', 'Phú Nhuận', 'Thành phố Thủ Đức', 'Bình Tân'] },
    { name: 'Đà Nẵng', code: '048', districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang'] },
    { name: 'Hải Phòng', code: '031', districts: ['Hồng Bàng', 'Ngô Quyền', 'Lê Chân', 'Hải An', 'Kiến An', 'Thủy Nguyên'] },
    { name: 'Cần Thơ', code: '092', districts: ['Ninh Kiều', 'Bình Thủy', 'Cái Răng', 'Ô Môn', 'Thốt Nốt'] },
    { name: 'Phú Yên', code: '054', districts: ['Tuy Hòa', 'Sông Cầu', 'Đông Hòa', 'Tuy An', 'Tây Hòa', 'Phú Hòa'] },
    { name: 'Đắk Lắk', code: '066', districts: ['Buôn Ma Thuột', 'Buôn Đôn', 'Cư M\'gar', 'Ea Kar', 'Krông Pắc'] },
    { name: 'Quảng Nam', code: '049', districts: ['Tam Kỳ', 'Hội An', 'Điện Bàn', 'Núi Thành', 'Thăng Bình', 'Duy Xuyên'] },
    { name: 'Bình Dương', code: '074', districts: ['Thủ Dầu Một', 'Thuận An', 'Dĩ An', 'Bến Cát', 'Tân Uyên'] },
    { name: 'Đồng Nai', code: '075', districts: ['Biên Hòa', 'Long Khánh', 'Nhơn Trạch', 'Long Thành', 'Trảng Bom'] },
    { name: 'Nghệ An', code: '040', districts: ['Vinh', 'Cửa Lò', 'Diễn Châu', 'Quỳnh Lưu', 'Nghi Lộc', 'Đô Lương'] },
    { name: 'Thanh Hóa', code: '038', districts: ['TP. Thanh Hóa', 'Sầm Sơn', 'Bỉm Sơn', 'Hoằng Hóa', 'Quảng Xương', 'Nga Sơn'] },
    { name: 'Khánh Hòa', code: '056', districts: ['Nha Trang', 'Cam Ranh', 'Ninh Hòa', 'Diên Khánh', 'Vạn Ninh'] },
    { name: 'Bình Định', code: '052', districts: ['Quy Nhơn', 'An Nhơn', 'Hoài Nhơn', 'Tuy Phước', 'Phù Cát'] },
    { name: 'Thừa Thiên Huế', code: '046', districts: ['TP. Huế', 'Hương Thủy', 'Hương Trà', 'Phú Vang', 'Quảng Điền'] },
    { name: 'Quảng Ngãi', code: '051', districts: ['TP. Quảng Ngãi', 'Bình Sơn', 'Sơn Tịnh', 'Tư Nghĩa', 'Mộ Đức'] },
    { name: 'Lâm Đồng', code: '068', districts: ['Đà Lạt', 'Bảo Lộc', 'Đức Trọng', 'Di Linh', 'Đơn Dương'] },
    { name: 'Gia Lai', code: '064', districts: ['Pleiku', 'An Khê', 'Ayun Pa', 'Chư Sê', 'Đak Đoa'] },
    { name: 'Bắc Ninh', code: '027', districts: ['TP. Bắc Ninh', 'Từ Sơn', 'Yên Phong', 'Quế Võ', 'Tiên Du'] },
    { name: 'Hải Dương', code: '030', districts: ['TP. Hải Dương', 'Chí Linh', 'Kinh Môn', 'Cẩm Giàng', 'Nam Sách'] }
];

const streetNames = [
    'Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Phan Chu Trinh', 'Hai Bà Trưng',
    'Lý Thường Kiệt', 'Điện Biên Phủ', 'Võ Nguyên Giáp', 'Phạm Văn Đồng', 'Nguyễn Trãi',
    'Ngô Quyền', 'Hùng Vương', 'Trường Chinh', 'Giải Phóng', 'Kim Mã',
    'Cầu Giấy', 'Hoàng Hoa Thám', 'Nguyễn Thái Học', 'Lê Duẩn', 'Bạch Đằng',
    'Cách Mạng Tháng Tám', 'Nguyễn Đình Chiểu', 'Pasteur', 'Nam Kỳ Khởi Nghĩa', 'Võ Văn Kiệt'
];

const universities = [
    { name: 'Đại học Bách Khoa Hà Nội', faculty: 'Viện Cơ khí - Động lực', major: 'Kỹ thuật Cơ khí & Máy xây dựng' },
    { name: 'Đại học Bách Khoa Hà Nội', faculty: 'Viện Điện - Tự động hóa', major: 'Kỹ thuật Điện tử & Tự động hóa' },
    { name: 'Đại học Xây Dựng Hà Nội', faculty: 'Khoa Xây dựng Cầu đường', major: 'Kỹ thuật Xây dựng Công trình Giao thông' },
    { name: 'Đại học Xây Dựng Hà Nội', faculty: 'Khoa Xây dựng Dân dụng', major: 'Kỹ thuật Xây dựng Dân dụng & Công nghiệp' },
    { name: 'Đại học Xây Dựng Hà Nội', faculty: 'Khoa Kinh tế & Quản lý Xây dựng', major: 'Kinh tế và Quản lý Xây dựng' },
    { name: 'Đại học Giao Thông Vận Tải', faculty: 'Khoa Công trình', major: 'Kỹ thuật Xây dựng Đường bộ & Cầu' },
    { name: 'Đại học Giao Thông Vận Tải', faculty: 'Khoa Vận tải - Kinh tế', major: 'Kinh tế Vận tải & Logistics' },
    { name: 'Đại học Kinh Tế Quốc Dân', faculty: 'Khoa Quản trị Kinh doanh', major: 'Quản trị Kinh doanh Tổng hợp' },
    { name: 'Đại học Kinh Tế Quốc Dân', faculty: 'Khoa Kế toán - Kiểm toán', major: 'Kế toán - Kiểm toán Doanh nghiệp' },
    { name: 'Đại học Kinh Tế Quốc Dân', faculty: 'Viện Quản lý & Tổ chức', major: 'Quản trị Nhân lực' },
    { name: 'Đại học Ngoại Thương', faculty: 'Khoa Kinh tế Quốc tế', major: 'Thương mại Quốc tế & Chuỗi cung ứng' },
    { name: 'Đại học Luật Hà Nội', faculty: 'Khoa Pháp luật Kinh tế', major: 'Luật Kinh tế & Hợp đồng' },
    { name: 'Đại học Bách Khoa - ĐHQG TP.HCM', faculty: 'Khoa Kỹ thuật Xây dựng', major: 'Kỹ thuật Công trình Xây dựng' },
    { name: 'Đại học Kiến Trúc TP.HCM', faculty: 'Khoa Xây dựng', major: 'Kỹ thuật Hạ tầng & Xây dựng' },
    { name: 'Đại học Kinh Tế TP.HCM', faculty: 'Khoa Tài chính', major: 'Tài chính Doanh nghiệp & Đầu tư' },
    { name: 'Đại học Kinh Tế TP.HCM', faculty: 'Khoa Kế toán', major: 'Kế toán Doanh nghiệp' },
    { name: 'Đại học Luật TP.HCM', faculty: 'Khoa Luật Thương mại', major: 'Luật Thương mại & Doanh nghiệp' },
    { name: 'Đại học Mỏ - Địa Chất', faculty: 'Khoa Trắc địa - Bản đồ', major: 'Kỹ thuật Trắc địa & Địa chất Công trình' },
    { name: 'Cao đẳng Xây Dựng Số 1', faculty: 'Khoa Kỹ thuật Thi công', major: 'Thi công Xây dựng Công trình' },
    { name: 'Cao đẳng Giao Thông Vận Tải', faculty: 'Khoa Cơ khí Giao thông', major: 'Vận hành & Bảo dưỡng Máy thi công' }
];

const certificatesList = [
    'Chứng chỉ Hành nghề Giám sát Thi công Xây dựng Hạng I',
    'Chứng chỉ Hành nghề Quản lý Dự án Hạng I',
    'Chứng chỉ Chỉ huy trưởng Công trình Cấp I',
    'Chứng chỉ An toàn Lao động & Vệ sinh Môi trường Nhóm 2',
    'Chứng chỉ An toàn Lao động Nhóm 3 (Thao tác máy chuyên dụng)',
    'Chứng chỉ Kế toán Trưởng Doanh nghiệp',
    'Chứng chỉ Thẩm định giá & Đấu thầu Qua mạng Quốc gia',
    'Chứng chỉ Quản lý Dự án Quốc tế PMP',
    'Chứng chỉ Hành nghề Luật sư & Pháp chế Doanh nghiệp',
    'Chứng chỉ Giám sát Khảo sát Địa chất & Trắc đạc',
    'Chứng chỉ Thử nghiệm Vật liệu Xây dựng Las-XD',
    'Chứng chỉ Tiếng Anh TOEIC 750+',
    'Chứng chỉ Vận hành Máy Đào, Máy Xúc, Xe Lu Hạng Nặng',
    'Chứng chỉ Kỹ thuật Nổ mìn & An toàn Vật liệu nổ Công nghiệp',
    'Chứng chỉ Đấu thầu & Quản lý Chi phí Đầu tư Xây dựng'
];

const banks = [
    { name: 'Vietcombank', branches: ['Chi nhánh Hoàn Kiếm', 'Chi nhánh Sở Giao Dịch 1', 'Chi nhánh Ba Đình', 'Chi nhánh Tân Bình', 'Chi nhánh Đà Nẵng', 'Chi nhánh Phú Yên', 'Chi nhánh Thủ Đức'] },
    { name: 'BIDV', branches: ['Chi nhánh Quang Trung', 'Chi nhánh Hà Thành', 'Chi nhánh Bến Thành', 'Chi nhánh Đà Nẵng', 'Chi nhánh Nam Sài Gòn', 'Chi nhánh Tây Đô'] },
    { name: 'VietinBank', branches: ['Chi nhánh TP. Hà Nội', 'Chi nhánh TP. Hồ Chí Minh', 'Chi nhánh Đống Đa', 'Chi nhánh Bắc Đà Nẵng', 'Chi nhánh KCN Bình Dương'] },
    { name: 'MBBank', branches: ['Chi nhánh Trung tâm', 'Chi nhánh Trần Duy Hưng', 'Chi nhánh Nam Sài Gòn', 'Chi nhánh Hùng Vương', 'Chi nhánh Cầu Giấy'] },
    { name: 'Techcombank', branches: ['Chi nhánh Hội Sở', 'Chi nhánh Sài Gòn', 'Chi nhánh Thăng Long', 'Chi nhánh An Phú', 'Chi nhánh Đà Nẵng'] },
    { name: 'ACB', branches: ['Chi nhánh Hà Nội', 'Chi nhánh Sài Gòn', 'Chi nhánh Phú Nhuận', 'Chi nhánh Phan Chu Trinh', 'Chi nhánh Ngô Quyền'] },
    { name: 'Agribank', branches: ['Chi nhánh Trung tâm', 'Chi nhánh Tây Hồ', 'Chi nhánh Đông Sài Gòn', 'Chi nhánh Tuy Hòa', 'Chi nhánh Buôn Ma Thuột'] }
];

const hospitals = [
    'Bệnh viện Bạch Mai - Hà Nội',
    'Bệnh viện Đại học Y Hà Nội',
    'Bệnh viện Hữu nghị Việt Đức - Hà Nội',
    'Bệnh viện Trung ương Quân đội 108',
    'Bệnh viện E Hà Nội',
    'Bệnh viện Đa khoa Xanh Pôn - Hà Nội',
    'Bệnh viện Chợ Rẫy - TP.HCM',
    'Bệnh viện Thống Nhất - TP.HCM',
    'Bệnh viện Nhân dân 115 - TP.HCM',
    'Bệnh viện Đại học Y Dược TP.HCM',
    'Bệnh viện C Đà Nẵng',
    'Bệnh viện Đa khoa Đà Nẵng',
    'Bệnh viện Đa khoa Tỉnh Phú Yên',
    'Bệnh viện Đa khoa Vùng Tây Nguyên (Đắk Lắk)',
    'Bệnh viện Đa khoa Tỉnh Quảng Nam',
    'Bệnh viện Đa khoa Quốc tế Hồng Ngọc'
];

// Helper to remove accents for email slug
function removeAccents(str) {
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function padZero(num, size = 2) {
    let s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
}

// -------------------------------------------------------------
// CORE GENERATION
// -------------------------------------------------------------
const TOTAL_EMPLOYEES = 1000;

const tables = {
    '00_Master_Profiles': [], // Unified 34-column Master Sheet
    '00_Data_Dictionary': dataDictionary,
    '01_Departments': departments,
    '02_Positions': positions,
    '03_Employees': [],
    '04_Contacts_Addresses': [],
    '05_Identity_Docs': [],
    '06_Emergency_Contacts': [],
    '07_Education': [],
    '08_Salaries_Banks': [],
    '09_Insurance_Welfare': [],
    '10_Contracts': [],
    '11_System_Accounts': [],
    '12_System_Logs': []
};

// Department Map
const deptMap = {};
departments.forEach(d => { deptMap[d.department_id] = d.department_name; });

// Position Map
const posMap = {};
positions.forEach(p => { posMap[p.position_id] = p.position_name; });

// Helper to classify roles, rank and salaries
function getPositionCategory(posId, deptId) {
    const p = (posId || '').toUpperCase();
    const d = (deptId || '').toUpperCase();

    if (p.includes('CT_HDQT') || p.includes('PCT_HDQT')) {
        return { rank: 'Cấp 10 - Ban Lãnh đạo Cấp cao (Chủ tịch / Phó Chủ tịch)', level: 'DIRECTOR', baseSalary: randomInt(55, 65) * 1000000, grade: 10 };
    }
    if (p.includes('TGD') || p.includes('PTGD') || p.includes('GD')) {
        return { rank: 'Cấp 9 - Ban Tổng Giám đốc Điều hành', level: 'DIRECTOR', baseSalary: randomInt(45, 55) * 1000000, grade: 9 };
    }
    if (p.includes('GD_BDHDA') || p.includes('PGD_BDH') || p.includes('TB_') || p.includes('TP_') || p.includes('CHT')) {
        return { rank: 'Cấp 8 - Trưởng ban / Giám đốc Ban Điều hành Dự án / Chỉ huy trưởng', level: 'MANAGER', baseSalary: randomInt(30, 42) * 1000000, grade: 8 };
    }
    if (p.includes('CHP') || p.includes('PB_') || p.includes('PP_') || p.includes('TBP_') || p.includes('CHTC')) {
        return { rank: 'Cấp 7 - Phó ban / Phó Giám đốc BĐH / Chỉ huy phó', level: 'DEPUTY_MANAGER', baseSalary: randomInt(22, 30) * 1000000, grade: 7 };
    }
    if (p.includes('KS_') || p.includes('KTTH') || p.includes('CB_KT') || p.includes('CB_HT') || p.includes('CB_NN') || p.includes('KSCL') || p.includes('QC') || p.includes('CV_TC')) {
        return { rank: 'Cấp 5 - Kỹ sư Chính / Chuyên viên Quản lý Nghiệp vụ', level: 'ENGINEER', baseSalary: randomInt(16, 24) * 1000000, grade: 5 };
    }
    if (p.includes('NV_') || p.includes('THU_KHO') || p.includes('QLC')) {
        return { rank: 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ', level: 'STAFF', baseSalary: randomInt(11, 16) * 1000000, grade: 3 };
    }
    if (p.includes('TTS_') || p.includes('HV_')) {
        return { rank: 'Cấp 1 - Học việc / Thực tập sinh', level: 'INTERN', baseSalary: randomInt(6, 9) * 1000000, grade: 1 };
    }
    if (p.includes('LX_') || p.includes('LM') || p.includes('T_') || p.includes('VHT') || p.includes('CA_TRUONG') || p.includes('DT_AN')) {
        return { rank: 'Cấp 4 - Đội trưởng / Thợ Máy Chính / Lái máy Chuyên dụng', level: 'OPERATOR', baseSalary: randomInt(12, 18) * 1000000, grade: 4 };
    }
    return { rank: 'Cấp 2 - Nhân viên Kỹ thuật / Lao động', level: 'WORKER', baseSalary: randomInt(9, 13) * 1000000, grade: 2 };
}

// Work location map by Department
function getWorkLocation(deptId) {
    if (deptId.includes('.PM') || deptId.includes('PHUMINH')) return { loc: 'Ban Điều hành Dự án Phú Minh (Tỉnh Phú Yên)', area: 'Dự án Phú Minh' };
    if (deptId.includes('.TN') || deptId.includes('TRUNGNAM')) return { loc: 'Ban Điều hành Dự án Trung Nam (Tỉnh Đắk Lắk)', area: 'Dự án Trung Nam' };
    if (deptId.includes('.TP') || deptId.includes('THANHPHAT')) return { loc: 'Ban Điều hành Dự án Thành Phát (Tỉnh Quảng Nam)', area: 'Dự án Thành Phát' };
    if (deptId.includes('TRUCTIEP')) return { loc: 'Hiện trường Thi công Tuyến cao tốc & Cầu hầm', area: 'Khối Trực tiếp Hiện trường' };
    if (deptId.includes('GIANTIEP')) return { loc: 'Văn phòng Hiện trường Ban Điều hành', area: 'Khối Gián tiếp Hiện trường' };
    return { loc: 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội', area: 'Khối Văn phòng Tổng công ty' };
}

// Fixed Key Staff
const fixedStaff = [
    {
        id: 'TH-1948',
        name: 'Huỳnh Thanh Long',
        gender: 'Nam',
        dob: '1990-05-18',
        pob: 'Hà Nội',
        deptId: 'BTCHC.TH',
        posId: 'TB_TCHC',
        jobTitle: 'Trưởng ban Tổ chức Hành chính kiêm Quản trị Hệ thống',
        workEmail: 'longht@trunghaico.vn',
        phone: '0909194888',
        role: 'ADMIN',
        baseSalary: 45000000,
        allowance: 10000000,
        eduLevel: 'Đại học',
        uni: 'Đại học Bách Khoa Hà Nội',
        major: 'Công nghệ Thông tin & Quản trị Hệ thống',
        cert: 'Chứng chỉ Quản trị Dự án Quốc tế PMP, Chứng chỉ Quản trị Nhân sự SHRM-SCP',
        childrenCount: 2,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1864',
        name: 'Nguyễn Minh Tân',
        gender: 'Nam',
        dob: '1988-11-22',
        pob: 'TP. Hồ Chí Minh',
        deptId: 'BPC.TH',
        posId: 'TB_PC',
        jobTitle: 'Trưởng ban Pháp Chế Trung Hải',
        workEmail: 'tannm@trunghaico.vn',
        phone: '0988186444',
        role: 'ADMIN',
        baseSalary: 42000000,
        allowance: 8000000,
        eduLevel: 'Đại học',
        uni: 'Đại học Luật TP.HCM',
        major: 'Luật Kinh tế & Hợp đồng Thương mại',
        cert: 'Chứng chỉ Hành nghề Luật sư & Pháp chế Doanh nghiệp',
        childrenCount: 2,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1001',
        name: 'Nguyễn Văn Hải',
        gender: 'Nam',
        dob: '1972-04-12',
        pob: 'Hà Nội',
        deptId: 'CTY',
        posId: 'CT_HDQT',
        jobTitle: 'Chủ tịch Hội đồng Quản trị',
        workEmail: 'hainv@trunghaico.vn',
        phone: '0913201001',
        role: 'ADMIN',
        baseSalary: 65000000,
        allowance: 20000000,
        eduLevel: 'Thạc sĩ',
        uni: 'Đại học Xây Dựng Hà Nội',
        major: 'Kỹ thuật Xây dựng Công trình Giao thông',
        cert: 'Chứng chỉ Hành nghề Quản lý Dự án Hạng I, Chứng chỉ Chỉ huy trưởng Cấp I',
        childrenCount: 2,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1002',
        name: 'Trần Quốc Cường',
        gender: 'Nam',
        dob: '1975-08-25',
        pob: 'Đà Nẵng',
        deptId: 'BTGD.TH',
        posId: 'TGD',
        jobTitle: 'Tổng Giám đốc Điều hành',
        workEmail: 'cuongtq@trunghaico.vn',
        phone: '0913201002',
        role: 'ADMIN',
        baseSalary: 60000000,
        allowance: 18000000,
        eduLevel: 'Thạc sĩ',
        uni: 'Đại học Bách Khoa - ĐHQG TP.HCM',
        major: 'Quản trị Dự án Xây dựng Quốc tế',
        cert: 'Chứng chỉ Hành nghề Quản lý Dự án Hạng I, PMP',
        childrenCount: 2,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1003',
        name: 'Lê Hoàng Nam',
        gender: 'Nam',
        dob: '1978-02-14',
        pob: 'Quảng Nam',
        deptId: 'BTGD.TH',
        posId: 'PTGD',
        jobTitle: 'Phó Tổng Giám đốc Kỹ thuật & Thi công',
        workEmail: 'namlh@trunghaico.vn',
        phone: '0913201003',
        role: 'ADMIN',
        baseSalary: 52000000,
        allowance: 14000000,
        eduLevel: 'Đại học',
        uni: 'Đại học Giao Thông Vận Tải',
        major: 'Kỹ thuật Cầu hầm & Đường cao tốc',
        cert: 'Chứng chỉ Hành nghề Giám sát Thi công Xây dựng Hạng I',
        childrenCount: 2,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1004',
        name: 'Phạm Thu Trang',
        gender: 'Nữ',
        dob: '1982-09-30',
        pob: 'Hải Phòng',
        deptId: 'BTCKT.TH',
        posId: 'TB_TCKT',
        jobTitle: 'Trưởng Ban Tài chính Kế toán',
        workEmail: 'trangpt@trunghaico.vn',
        phone: '0913201004',
        role: 'HR',
        baseSalary: 40000000,
        allowance: 8000000,
        eduLevel: 'Đại học',
        uni: 'Đại học Kinh Tế Quốc Dân',
        major: 'Tài chính Doanh nghiệp & Kiểm toán',
        cert: 'Chứng chỉ Kế toán Trưởng Doanh nghiệp, CPA Việt Nam',
        childrenCount: 1,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1005',
        name: 'Đặng Hữu Phúc',
        gender: 'Nam',
        dob: '1980-06-19',
        pob: 'Nghệ An',
        deptId: 'BKHTH.TH',
        posId: 'TB_KHKT',
        jobTitle: 'Trưởng ban Kế hoạch Tổng hợp',
        workEmail: 'phucdh@trunghaico.vn',
        phone: '0913201005',
        role: 'HR',
        baseSalary: 38000000,
        allowance: 7000000,
        eduLevel: 'Đại học',
        uni: 'Đại học Xây Dựng Hà Nội',
        major: 'Kinh tế & Quản lý Xây dựng',
        cert: 'Chứng chỉ Đấu thầu & Quản lý Chi phí Đầu tư Xây dựng',
        childrenCount: 2,
        marital: 'Đã có gia đình'
    },
    {
        id: 'TH-1006',
        name: 'Vũ Đình Trọng',
        gender: 'Nam',
        dob: '1981-12-05',
        pob: 'Thanh Hóa',
        deptId: 'BDHDA.PM',
        posId: 'GD_BDHDA',
        jobTitle: 'Giám đốc Ban Điều hành Dự án Phú Minh',
        workEmail: 'trongvd@trunghaico.vn',
        phone: '0913201006',
        role: 'USER',
        baseSalary: 42000000,
        allowance: 12000000,
        eduLevel: 'Đại học',
        uni: 'Đại học Giao Thông Vận Tải',
        major: 'Kỹ thuật Xây dựng Công trình Giao thông',
        cert: 'Chứng chỉ Chỉ huy trưởng Công trình Cấp I, Giám sát Hạng I',
        childrenCount: 3,
        marital: 'Đã có gia đình'
    }
];

const fixedMap = {};
fixedStaff.forEach(s => { fixedMap[s.id] = s; });

// Pre-define managers list for hierarchy
const managerHierarchy = [
    { id: 'TH-1001', name: 'Nguyễn Văn Hải' },
    { id: 'TH-1002', name: 'Trần Quốc Cường' },
    { id: 'TH-1003', name: 'Lê Hoàng Nam' },
    { id: 'TH-1004', name: 'Phạm Thu Trang' },
    { id: 'TH-1005', name: 'Đặng Hữu Phúc' },
    { id: 'TH-1006', name: 'Vũ Đình Trọng' },
    { id: 'TH-1948', name: 'Huỳnh Thanh Long' },
    { id: 'TH-1864', name: 'Nguyễn Minh Tân' }
];

const usedEmails = new Set();
const usedPhones = new Set();
const usedIdNumbers = new Set();

for (let i = 1; i <= TOTAL_EMPLOYEES; i++) {
    const empNum = 1000 + i;
    const empId = `TH-${empNum}`;

    let isFixed = !!fixedMap[empId];
    let fData = fixedMap[empId] || {};

    // 1. Full Name & Gender
    let gender = isFixed ? fData.gender : (Math.random() < 0.65 ? 'Nam' : 'Nữ');
    let lastName = isFixed ? fData.name.split(' ')[0] : randomChoice(lastNames);
    let middleName = isFixed ? fData.name.split(' ').slice(1, -1).join(' ') : (gender === 'Nam' ? randomChoice(maleMiddleNames) : randomChoice(femaleMiddleNames));
    let firstName = isFixed ? fData.name.split(' ').slice(-1)[0] : (gender === 'Nam' ? randomChoice(maleFirstNames) : randomChoice(femaleFirstNames));
    let fullName = isFixed ? fData.name : `${lastName} ${middleName} ${firstName}`.trim();

    // 2. Department & Position
    let deptId = isFixed ? fData.deptId : randomChoice(departments).department_id;
    let deptName = deptMap[deptId] || deptId;
    
    // Pick realistic position based on department type
    let posId;
    if (isFixed) {
        posId = fData.posId;
    } else {
        const isSiteDirect = deptId.includes('TRUCTIEP');
        const isSiteIndirect = deptId.includes('GIANTIEP') || deptId.includes('BDHDA');
        const isOffice = deptId.includes('BTCHC') || deptId.includes('BTCKT') || deptId.includes('BPC') || deptId.includes('BKHTH') || deptId.includes('PHCNS') || deptId.includes('PTCKT') || deptId.includes('PKHTH');

        if (isSiteDirect) {
            const directPos = ['LX_BEN', 'LX_LU', 'LX_XUCLAT', 'LX_DK', 'LMX', 'LMU', 'LMC', 'T_BOM', 'T_DIEN', 'T_HAN', 'T_KHOAN', 'T_MIN', 'T_PHUN', 'T_SC', 'VHT', 'LDPT', 'CA_TRUONG', 'DT_AN', 'GC_NEO'];
            posId = randomChoice(directPos);
        } else if (isSiteIndirect) {
            const indirectPos = ['CB_HT', 'CB_KT', 'CB_KTHT', 'CB_NN', 'KSCL', 'KS_XDCB', 'CHP', 'CHT', 'CHTC', 'NV_QC-QA', 'NV_TD', 'QC', 'QC-DC', 'TBP_KSVT', 'THU_KHO', 'ATLD'];
            posId = randomChoice(indirectPos);
        } else if (isOffice) {
            const officePos = ['KTTH', 'NV_HC', 'NV_HCNS', 'NV_IT', 'NV_KD', 'NV_KT', 'NV_MS', 'NV_NS', 'NV_PC', 'NV_Tuyendung', 'PP_HCNS', 'PP_TCKT', 'PP_KHKT', 'PTB_PC', 'CV_TC', 'QLC'];
            posId = randomChoice(officePos);
        } else {
            posId = randomChoice(positions).position_id;
        }
    }
    let posName = posMap[posId] || posId;
    let jobTitle = isFixed ? fData.jobTitle : posName;

    // 3. Date of Birth & Age
    let birthYear = isFixed ? parseInt(fData.dob.split('-')[0]) : randomInt(1970, 2003);
    let birthMonth = isFixed ? parseInt(fData.dob.split('-')[1]) : randomInt(1, 12);
    let birthDay = isFixed ? parseInt(fData.dob.split('-')[2]) : randomInt(1, 28);
    let dob = isFixed ? fData.dob : `${birthYear}-${padZero(birthMonth)}-${padZero(birthDay)}`;
    let age = 2026 - birthYear;

    // 4. Marital Status & Children Count
    let maritalStatus = isFixed ? fData.marital : (age > 26 ? (Math.random() < 0.78 ? 'Đã có gia đình' : 'Độc thân') : 'Độc thân');
    let childrenCount = isFixed ? fData.childrenCount : (maritalStatus === 'Đã có gia đình' ? randomChoice([1, 2, 2, 2, 3]) : (maritalStatus === 'Ly hôn' ? randomChoice([0, 1, 2]) : 0));

    // 5. Province & Addresses
    let prov = randomChoice(provinces);
    let birthPlace = isFixed ? fData.pob : prov.name;
    let nativePlace = isFixed ? fData.pob : prov.name;
    let permDistrict = randomChoice(prov.districts);
    let permStreet = `${randomInt(12, 450)} Đường ${randomChoice(streetNames)}`;
    let permWard = `Phường ${randomChoice(['Trần Phú', 'Bến Nghé', 'Thống Nhất', 'Lê Đại Hành', 'Hòa Cường', 'Vĩnh Ninh', 'An Phú', 'Tân Lập', 'Phước Long', 'Phan Chu Trinh'])}`;
    let permFull = `${permStreet}, ${permWard}, ${permDistrict}, ${prov.name}`;

    let currProv = (deptId.includes('.PM') || deptId.includes('PHUMINH')) ? provinces.find(p => p.name === 'Phú Yên') || prov :
                   (deptId.includes('.TN') || deptId.includes('TRUNGNAM')) ? provinces.find(p => p.name === 'Đắk Lắk') || prov :
                   (deptId.includes('.TP') || deptId.includes('THANHPHAT')) ? provinces.find(p => p.name === 'Quảng Nam') || prov :
                   provinces.find(p => p.name === 'Hà Nội') || prov;
    let currDistrict = randomChoice(currProv.districts);
    let currStreet = `${randomInt(1, 290)} Đường ${randomChoice(streetNames)}`;
    let currWard = `Phường ${randomChoice(['Trung Hòa', 'Dịch Vọng', 'Xuân Thủy', 'Láng Hạ', 'Hòa Minh', 'Bình Trưng', 'Phú Hòa', 'Tân Hòa'])}`;
    let currFull = `${currStreet}, ${currWard}, ${currDistrict}, ${currProv.name}`;

    // 6. Contact Info
    let phonePrefix = randomChoice(['090', '091', '093', '094', '097', '098', '086', '088', '038', '039', '079', '077']);
    let phoneSuffix = padZero(randomInt(100000, 999999), 6);
    let mobilePhone = isFixed ? fData.phone : `${phonePrefix}${phoneSuffix}`;
    while (usedPhones.has(mobilePhone)) {
        mobilePhone = `${phonePrefix}${padZero(randomInt(100000, 999999), 6)}`;
    }
    usedPhones.add(mobilePhone);

    let nameSlug = removeAccents(`${firstName}${lastName.substring(0, 1)}${middleName.substring(0, 1)}`);
    let workEmail = isFixed ? fData.workEmail : `${nameSlug}.${empNum}@trunghaico.vn`;
    if (usedEmails.has(workEmail)) {
        workEmail = `${nameSlug}${empNum}@trunghaico.vn`;
    }
    usedEmails.add(workEmail);
    let personalEmail = `${nameSlug}.${birthYear}@gmail.com`;

    // 7. Identity Document (CCCD)
    let genderDigit = gender === 'Nam' ? (birthYear < 2000 ? '0' : '2') : (birthYear < 2000 ? '1' : '3');
    let yearShort = padZero(birthYear % 100);
    let cccdSuffix = padZero(randomInt(100000, 999999), 6);
    let cccdNumber = `${prov.code}${genderDigit}${yearShort}${cccdSuffix}`;
    while (usedIdNumbers.has(cccdNumber)) {
        cccdNumber = `${prov.code}${genderDigit}${yearShort}${padZero(randomInt(100000, 999999), 6)}`;
    }
    usedIdNumbers.add(cccdNumber);
    let idIssueDate = `${randomInt(2018, 2023)}-${padZero(randomInt(1, 12))}-${padZero(randomInt(1, 28))}`;
    let idExpiryDate = `${birthYear + (age < 25 ? 25 : age < 40 ? 40 : 60)}-${padZero(birthMonth)}-${padZero(birthDay)}`;
    let passportNumber = (age > 28 && Math.random() < 0.35) ? `P${randomInt(1000000, 9999999)}` : null;
    let passportIssueDate = passportNumber ? `${randomInt(2020, 2024)}-${padZero(randomInt(1, 12))}-${padZero(randomInt(1, 28))}` : null;

    // 8. Employment, Contract & Dates
    let status = (i <= 920) ? 'Đang làm việc' : (i <= 965 ? 'Thử việc' : (i <= 980 ? 'Tạm hoãn HĐ' : 'Đã nghỉ việc'));
    let laborNature = (status === 'Thử việc') ? 'Thử việc' : (status === 'Đã nghỉ việc' ? 'Nghỉ việc' : (i > 950 ? 'Thời vụ' : 'Chính thức'));
    let joinYear = randomInt(2018, 2025);
    let joinMonth = randomInt(1, 12);
    let joinDay = randomInt(1, 28);
    let startDate = `${joinYear}-${padZero(joinMonth)}-${padZero(joinDay)}`; // Ngày bắt đầu làm việc
    let trialStartDate = startDate;
    
    let officialDate = null;
    if (laborNature === 'Chính thức') {
        let offMonth = joinMonth + 2;
        let offYear = joinYear;
        if (offMonth > 12) { offMonth -= 12; offYear += 1; }
        officialDate = `${offYear}-${padZero(offMonth)}-${padZero(joinDay)}`;
    }

    let contractType = (laborNature === 'Thử việc') ? 'Hợp đồng thử việc' : 
                       (laborNature === 'Thời vụ') ? 'Hợp đồng lao động thời vụ' :
                       (joinYear <= 2022 ? 'Hợp đồng lao động không xác định thời hạn' : 'Hợp đồng lao động xác định thời hạn (36 tháng)');

    let endDate = (status === 'Đã nghỉ việc') ? `2026-06-${padZero(randomInt(1, 28))}` :
                  (contractType.includes('36 tháng') ? `${joinYear + 3}-${padZero(joinMonth)}-${padZero(joinDay)}` : 
                  (contractType.includes('thử việc') ? `${joinYear}-${padZero(Math.min(joinMonth + 2, 12))}-${padZero(joinDay)}` : 'Không xác định'));

    let resignationDate = (status === 'Đã nghỉ việc') ? endDate : null;
    let retirementYear = gender === 'Nam' ? birthYear + 62 : birthYear + 60;
    let expectedRetirementDate = `${retirementYear}-${padZero(birthMonth)}-${padZero(birthDay)}`;

    let seniorityMonths = (2026 - joinYear) * 12 + (8 - joinMonth);
    if (seniorityMonths < 0) seniorityMonths = 1;
    let seniorityY = Math.floor(seniorityMonths / 12);
    let seniorityM = seniorityMonths % 12;
    let seniorityText = seniorityY > 0 ? `${seniorityY} năm ${seniorityM} tháng` : `${seniorityM} tháng`;

    // 9. Position Category & Rank
    const posCat = getPositionCategory(posId, deptId);
    let jobRank = posCat.rank;
    let otherCert = isFixed ? fData.cert : (age > 25 ? randomChoice(certificatesList) : 'Chứng chỉ An toàn Lao động Nhóm 3');

    // 10. Management Hierarchy
    let directManager = null;
    let indirectManager = { id: 'TH-1002', name: 'Trần Quốc Cường' }; // General Director

    if (empId === 'TH-1001') {
        directManager = null;
        indirectManager = null;
    } else if (empId === 'TH-1002') {
        directManager = { id: 'TH-1001', name: 'Nguyễn Văn Hải' };
        indirectManager = null;
    } else {
        let targetMgr = managerHierarchy.find(m => m.id !== empId);
        if (deptId.includes('.PM')) targetMgr = managerHierarchy.find(m => m.id === 'TH-1006') || targetMgr;
        else if (deptId.includes('BTCHC')) targetMgr = managerHierarchy.find(m => m.id === 'TH-1948') || targetMgr;
        else if (deptId.includes('BPC')) targetMgr = managerHierarchy.find(m => m.id === 'TH-1864') || targetMgr;
        else if (deptId.includes('BTCKT')) targetMgr = managerHierarchy.find(m => m.id === 'TH-1004') || targetMgr;
        else if (deptId.includes('BKHTH')) targetMgr = managerHierarchy.find(m => m.id === 'TH-1005') || targetMgr;

        directManager = targetMgr || { id: 'TH-1002', name: 'Trần Quốc Cường' };
    }

    const workLoc = getWorkLocation(deptId);

    // 11. Emergency Contact
    let relativeType = gender === 'Nam' ? (age > 26 ? 'Vợ' : 'Mẹ') : (age > 26 ? 'Chồng' : 'Bố');
    let relLastName = (relativeType === 'Bố' || relativeType === 'Mẹ') ? lastName : randomChoice(lastNames);
    let relMiddleName = (relativeType === 'Vợ' || relativeType === 'Mẹ') ? randomChoice(femaleMiddleNames) : randomChoice(maleMiddleNames);
    let relFirstName = (relativeType === 'Vợ' || relativeType === 'Mẹ') ? randomChoice(femaleFirstNames) : randomChoice(maleFirstNames);
    let relFullName = `${relLastName} ${relMiddleName} ${relFirstName}`;
    let relPhone = `09${randomChoice(['0', '1', '6', '7', '8'])}${padZero(randomInt(1000000, 9999999), 7)}`;
    let emergencyContactString = `${relFullName} (${relativeType}) - ${relPhone}`;

    // 12. Education
    let uniInfo = isFixed ? { name: fData.uni, faculty: 'Khoa Chuyên ngành', major: fData.major } : randomChoice(universities);
    let eduLevel = isFixed ? fData.eduLevel : (uniInfo.name.includes('Cao đẳng') ? 'Cao đẳng' : (age > 35 && Math.random() < 0.25 ? 'Thạc sĩ' : 'Đại học'));
    let gradYear = birthYear + 22 + (isFixed && fData.eduLevel === 'Thạc sĩ' ? 3 : 0);
    if (gradYear > 2025) gradYear = 2025;

    // 13. Salaries & Banks
    let baseSalary = isFixed ? fData.baseSalary : posCat.baseSalary;
    let allowance = isFixed ? fData.allowance : Math.round(baseSalary * randomChoice([0.15, 0.2, 0.25, 0.3]));
    let totalSalary = baseSalary + allowance;
    let insSalary = Math.min(baseSalary, 23400000);
    const bank = randomChoice(banks);
    const bankBranch = randomChoice(bank.branches);
    const bankAccount = `${randomInt(100, 999)}${padZero(randomInt(1000000, 9999999), 7)}`;

    // 14. Insurance & Welfare
    let hasIns = (status === 'Đang làm việc' || laborNature === 'Chính thức') ? 'Tham gia đầy đủ' : (status === 'Thử việc' ? 'Không tham gia' : 'Tạm dừng đóng');
    let bhCode = `${padZero(randomInt(1000000000, 9999999999), 10)}`;
    let hospitalName = randomChoice(hospitals);
    let taxCode = `8${padZero(randomInt(100000000, 999999999), 9)}`;

    // =========================================================================
    // 34 COLUMNS COMPLETE MASTER ROW
    // =========================================================================
    tables['00_Master_Profiles'].push({
        'Mã nhân viên': empId,
        'Họ và tên': fullName,
        'Ngày bắt đầu làm việc': startDate,
        'Ngày kết thúc': endDate,
        'Loại hợp đồng': contractType,
        'Phòng/Ban': deptName,
        'Cấp bậc': jobRank,
        'Chức danh': jobTitle,
        'Điện thoại': mobilePhone,
        'Email': workEmail,
        'Địa điểm làm việc': workLoc.loc,
        'Ngày tháng năm sinh': dob,
        'Giới tính': gender,
        'Nơi sinh': birthPlace,
        'Tình trạng hôn nhân': maritalStatus,
        'Số con': childrenCount,
        'Nguyên quán': nativePlace,
        'Dân tộc': 'Kinh',
        'Tôn giáo': 'Không',
        'Số CCCD/Hộ chiếu': cccdNumber,
        'Ngày cấp': idIssueDate,
        'Nơi cấp': 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
        'Địa chỉ thường trú': permFull,
        'Địa chỉ tạm trú': currFull,
        'Số sổ BHXH': (hasIns === 'Tham gia đầy đủ' ? bhCode : 'Chưa có'),
        'Nơi đăng ký khám, chữa bệnh ban đầu': (hasIns === 'Tham gia đầy đủ' ? hospitalName : 'Chưa đăng ký'),
        'Mã số thuế cá nhân': taxCode,
        'Số tài khoản': bankAccount,
        'Tên ngân hàng': bank.name,
        'Tên chi nhánh/Phòng Giao dịch': bankBranch,
        'Trình độ học vấn': eduLevel,
        'Trình độ chuyên môn: Chuyên ngành học': uniInfo.major,
        'Bằng cấp chuyên môn khác': otherCert,
        'Liên lạc khẩn cấp (họ tên, mối quan hệ, số điện thoại)': emergencyContactString
    });

    // --- PUSH TO TABLE: 03_Employees ---
    tables['03_Employees'].push({
        employee_id: empId,
        time_attendance_code: `${empNum}`,
        full_name: fullName,
        gender: gender,
        date_of_birth: dob,
        birth_place: birthPlace,
        native_place: nativePlace,
        ethnicity: randomChoice(['Kinh', 'Kinh', 'Kinh', 'Kinh', 'Kinh', 'Tày', 'Mường', 'Thái', 'Hoa', 'Khmer']),
        religion: randomChoice(['Không', 'Không', 'Không', 'Không', 'Phật giáo', 'Công giáo']),
        nationality: 'Việt Nam',
        marital_status: maritalStatus,
        children_count: childrenCount,
        tax_code: taxCode,
        department_id: deptId,
        position_id: posId,
        job_rank: jobRank,
        job_title: jobTitle,
        direct_manager_id: directManager ? directManager.id : null,
        direct_manager_name: directManager ? directManager.name : null,
        indirect_manager_id: indirectManager ? indirectManager.id : null,
        indirect_manager_name: indirectManager ? indirectManager.name : null,
        work_location: workLoc.loc,
        work_area: workLoc.area,
        employment_status: status,
        labor_nature: laborNature,
        start_date: startDate,
        end_date: endDate,
        contract_type: contractType,
        probation_start_date: trialStartDate,
        trial_start_date: trialStartDate,
        official_date: officialDate,
        resignation_date: resignationDate,
        expected_retirement_date: expectedRetirementDate,
        other_certificates: otherCert,
        seniority_text: seniorityText,
        is_blacklisted: false
    });

    // --- PUSH TO TABLE: 04_Contacts_Addresses ---
    tables['04_Contacts_Addresses'].push({
        employee_id: empId,
        full_name: fullName,
        mobile_phone: mobilePhone,
        home_phone: `024${padZero(randomInt(3100000, 3999999), 7)}`,
        other_phone: '',
        work_email: workEmail,
        personal_email: personalEmail,
        permanent_address_full: permFull,
        permanent_country: 'Việt Nam',
        permanent_province: prov.name,
        permanent_district: permDistrict,
        permanent_ward: permWard,
        permanent_street: permStreet,
        current_address_full: currFull,
        current_country: 'Việt Nam',
        current_province: currProv.name,
        current_district: currDistrict,
        current_ward: currWard,
        current_street: currStreet
    });

    // --- PUSH TO TABLE: 05_Identity_Docs ---
    tables['05_Identity_Docs'].push({
        employee_id: empId,
        full_name: fullName,
        doc_type: 'CCCD',
        id_number: cccdNumber,
        id_issue_date: idIssueDate,
        id_issue_place: 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
        id_expiry_date: idExpiryDate,
        passport_number: passportNumber,
        passport_issue_date: passportIssueDate
    });

    // --- PUSH TO TABLE: 06_Emergency_Contacts ---
    tables['06_Emergency_Contacts'].push({
        employee_id: empId,
        full_name: fullName,
        contact_name: relFullName,
        relationship: relativeType,
        mobile_phone: relPhone,
        email: `${removeAccents(relFirstName)}.${removeAccents(relLastName)}@gmail.com`,
        address: permFull
    });

    // --- PUSH TO TABLE: 07_Education ---
    tables['07_Education'].push({
        employee_id: empId,
        full_name: fullName,
        education_level: eduLevel,
        degree_type: 'Chính quy',
        institution: uniInfo.name,
        faculty: uniInfo.faculty,
        major: uniInfo.major,
        other_certificates: otherCert,
        graduation_year: gradYear,
        classification: randomChoice(['Giỏi', 'Khá', 'Khá', 'Khá', 'Xuất sắc', 'Trung bình khá'])
    });

    // --- PUSH TO TABLE: 08_Salaries_Banks ---
    tables['08_Salaries_Banks'].push({
        employee_id: empId,
        full_name: fullName,
        salary_grade: posCat.grade,
        base_salary: baseSalary,
        total_salary: totalSalary,
        insurance_salary: insSalary,
        bank_account_number: bankAccount,
        bank_name: bank.name,
        bank_branch: bankBranch
    });

    // --- PUSH TO TABLE: 09_Insurance_Welfare ---
    tables['09_Insurance_Welfare'].push({
        employee_id: empId,
        full_name: fullName,
        has_insurance: hasIns,
        social_insurance_book_no: hasIns === 'Tham gia đầy đủ' ? bhCode : null,
        social_insurance_code: hasIns === 'Tham gia đầy đủ' ? bhCode : null,
        insurance_join_date: hasIns === 'Tham gia đầy đủ' ? (officialDate || trialStartDate) : null,
        total_insurance_rate: 0.105,
        social_insurance_rate: 8,
        health_insurance_rate: 1.5,
        unemployment_insurance_rate: 1,
        hospital_registered: hasIns === 'Tham gia đầy đủ' ? hospitalName : null,
        union_member: hasIns === 'Tham gia đầy đủ' ? 'Đoàn viên' : 'Không tham gia'
    });

    // --- PUSH TO TABLE: 10_Contracts ---
    let contractStatus = (status === 'Đã nghỉ việc') ? 'ĐÃ THANH LÝ' : 'HIỆU LỰC';

    tables['10_Contracts'].push({
        contract_id: `HD-${empId.replace('-', '')}-01`,
        employee_id: empId,
        full_name: fullName,
        contract_type: contractType,
        start_date: startDate,
        end_date: endDate,
        trial_start_date: trialStartDate,
        official_date: officialDate || trialStartDate,
        contract_status: contractStatus
    });

    // --- PUSH TO TABLE: 11_System_Accounts ---
    if (isFixed || posCat.level === 'DIRECTOR' || posCat.level === 'MANAGER' || posCat.level === 'DEPUTY_MANAGER' || deptId.includes('BTCHC') || deptId.includes('PHCNS') || i <= 50) {
        let accountRole = (isFixed && fData.role) ? fData.role : (posCat.level === 'DIRECTOR' ? 'ADMIN' : (deptId.includes('BTCHC') || deptId.includes('PHCNS') ? 'HR' : 'USER'));

        tables['11_System_Accounts'].push({
            account_id: `ACC-${empId.replace('-', '')}`,
            employee_id: empId,
            full_name: fullName,
            account_email: workEmail,
            role: accountRole,
            account_status: 'Kích hoạt',
            password: '123456'
        });
    }
}

// --- 12_System_Logs: Initial Seed Logs ---
tables['12_System_Logs'].push(
    {
        log_id: `LOG-${Date.now()}-01`,
        timestamp: new Date().toISOString(),
        user_id: 'TH-1948',
        user_name: 'Huỳnh Thanh Long',
        user_role: 'ADMIN',
        action_type: 'SEED_DATA',
        module: 'Hệ thống CSDL',
        description: `Đã làm mới cơ sở dữ liệu và tạo 1,000 hồ sơ nhân sự chuẩn hóa đầy đủ 34 cột trường thông tin (TH-1001 đến TH-2000)`,
        ip_address: '127.0.0.1'
    },
    {
        log_id: `LOG-${Date.now()}-02`,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user_id: 'TH-1864',
        user_name: 'Nguyễn Minh Tân',
        user_role: 'ADMIN',
        action_type: 'BACKUP',
        module: 'Hệ thống CSDL',
        description: 'Sao lưu cơ sở dữ liệu định kỳ chuẩn 3NF & Master Profile',
        ip_address: '127.0.0.1'
    }
);

console.log('📊 Thống kê các bảng đã tạo:');
for (const [tName, rows] of Object.entries(tables)) {
    console.log(`  - [${tName}]: ${rows.length} bản ghi`);
}

// -------------------------------------------------------------
// SAVE TO JSON DATABASE
// -------------------------------------------------------------
const outputDb = { tables };
fs.writeFileSync(DB_JSON_PATH, JSON.stringify(outputDb, null, 2), 'utf-8');
console.log(`✅ Đã lưu CSDL JSON hoàn tất vào: ${DB_JSON_PATH}`);

// -------------------------------------------------------------
// SAVE TO EXCEL DATABASE
// -------------------------------------------------------------
try {
    const wb = XLSX.utils.book_new();
    for (const [sheetName, rows] of Object.entries(tables)) {
        const safeSheetName = sheetName.substring(0, 31);
        const ws = XLSX.utils.json_to_sheet(rows || []);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    }
    XLSX.writeFile(wb, EXCEL_PATH);
    console.log(`✅ Đã xuất đồng bộ 13 Sheet Excel (kèm Master Sheet 34 cột) hoàn tất vào: ${EXCEL_PATH}`);
} catch (e) {
    console.warn('⚠️ Ghi chú ghi file Excel (Có thể file đang mở):', e.message);
}

// -------------------------------------------------------------
// GENERATE SQL SEED SCRIPT (seed_data.sql)
// -------------------------------------------------------------
function escapeSql(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${String(val).replace(/'/g, "''")}'`;
}

let sqlScript = `-- =========================================================================\n`;
sqlScript += `-- SEED DATA HRM TRUNG HAI: 1,000 EMPLOYEES & 34 COMPLETE PROFILE COLUMNS\n`;
sqlScript += `-- Generated At: ${new Date().toISOString()}\n`;
sqlScript += `-- =========================================================================\n\n`;

// 1. Departments
sqlScript += `-- 1. DEPARTMENTS\n`;
for (const d of tables['01_Departments']) {
    sqlScript += `INSERT INTO departments (department_id, department_name, status) VALUES (${escapeSql(d.department_id)}, ${escapeSql(d.department_name)}, ${escapeSql(d.status)}) ON CONFLICT (department_id) DO UPDATE SET department_name = EXCLUDED.department_name;\n`;
}
sqlScript += `\n`;

// 2. Positions
sqlScript += `-- 2. POSITIONS\n`;
for (const p of tables['02_Positions']) {
    sqlScript += `INSERT INTO positions (position_id, position_name, status) VALUES (${escapeSql(p.position_id)}, ${escapeSql(p.position_name)}, ${escapeSql(p.status)}) ON CONFLICT (position_id) DO UPDATE SET position_name = EXCLUDED.position_name;\n`;
}
sqlScript += `\n`;

// 3. Employees
sqlScript += `-- 3. EMPLOYEES (1,000 Records with 34 Complete Fields)\n`;
for (const e of tables['03_Employees']) {
    sqlScript += `INSERT INTO employees (employee_id, time_attendance_code, full_name, gender, date_of_birth, birth_place, native_place, ethnicity, religion, nationality, marital_status, children_count, tax_code, department_id, position_id, job_rank, job_title, direct_manager_id, indirect_manager_id, work_location, work_area, employment_status, labor_nature, start_date, end_date, contract_type, probation_start_date, trial_start_date, official_date, resignation_date, expected_retirement_date, other_certificates, seniority_text, is_blacklisted) VALUES (${escapeSql(e.employee_id)}, ${escapeSql(e.time_attendance_code)}, ${escapeSql(e.full_name)}, ${escapeSql(e.gender)}, ${escapeSql(e.date_of_birth)}, ${escapeSql(e.birth_place)}, ${escapeSql(e.native_place)}, ${escapeSql(e.ethnicity)}, ${escapeSql(e.religion)}, ${escapeSql(e.nationality)}, ${escapeSql(e.marital_status)}, ${escapeSql(e.children_count)}, ${escapeSql(e.tax_code)}, ${escapeSql(e.department_id)}, ${escapeSql(e.position_id)}, ${escapeSql(e.job_rank)}, ${escapeSql(e.job_title)}, ${escapeSql(e.direct_manager_id)}, ${escapeSql(e.indirect_manager_id)}, ${escapeSql(e.work_location)}, ${escapeSql(e.work_area)}, ${escapeSql(e.employment_status)}, ${escapeSql(e.labor_nature)}, ${escapeSql(e.start_date)}, ${escapeSql(e.end_date)}, ${escapeSql(e.contract_type)}, ${escapeSql(e.probation_start_date)}, ${escapeSql(e.trial_start_date)}, ${escapeSql(e.official_date)}, ${escapeSql(e.resignation_date)}, ${escapeSql(e.expected_retirement_date)}, ${escapeSql(e.other_certificates)}, ${escapeSql(e.seniority_text)}, ${escapeSql(e.is_blacklisted)});\n`;
}
sqlScript += `\n`;

// 4. Contacts
sqlScript += `-- 4. CONTACTS & ADDRESSES\n`;
for (const c of tables['04_Contacts_Addresses']) {
    sqlScript += `INSERT INTO employee_contacts (employee_id, mobile_phone, home_phone, work_email, personal_email, permanent_address_full, permanent_province, permanent_district, permanent_ward, permanent_street, current_address_full, current_province, current_district, current_ward, current_street) VALUES (${escapeSql(c.employee_id)}, ${escapeSql(c.mobile_phone)}, ${escapeSql(c.home_phone)}, ${escapeSql(c.work_email)}, ${escapeSql(c.personal_email)}, ${escapeSql(c.permanent_address_full)}, ${escapeSql(c.permanent_province)}, ${escapeSql(c.permanent_district)}, ${escapeSql(c.permanent_ward)}, ${escapeSql(c.permanent_street)}, ${escapeSql(c.current_address_full)}, ${escapeSql(c.current_province)}, ${escapeSql(c.current_district)}, ${escapeSql(c.current_ward)}, ${escapeSql(c.current_street)});\n`;
}
sqlScript += `\n`;

// 5. Identity Docs
sqlScript += `-- 5. IDENTITY DOCS\n`;
for (const idDoc of tables['05_Identity_Docs']) {
    sqlScript += `INSERT INTO employee_identity_docs (employee_id, doc_type, id_number, id_issue_date, id_issue_place, id_expiry_date, passport_number, passport_issue_date) VALUES (${escapeSql(idDoc.employee_id)}, ${escapeSql(idDoc.doc_type)}, ${escapeSql(idDoc.id_number)}, ${escapeSql(idDoc.id_issue_date)}, ${escapeSql(idDoc.id_issue_place)}, ${escapeSql(idDoc.id_expiry_date)}, ${escapeSql(idDoc.passport_number)}, ${escapeSql(idDoc.passport_issue_date)});\n`;
}
sqlScript += `\n`;

// 6. Salaries
sqlScript += `-- 6. SALARIES & BANKS\n`;
for (const s of tables['08_Salaries_Banks']) {
    sqlScript += `INSERT INTO employee_salaries_banks (employee_id, salary_grade, base_salary, total_salary, insurance_salary, bank_account_number, bank_name, bank_branch) VALUES (${escapeSql(s.employee_id)}, ${escapeSql(s.salary_grade)}, ${escapeSql(s.base_salary)}, ${escapeSql(s.total_salary)}, ${escapeSql(s.insurance_salary)}, ${escapeSql(s.bank_account_number)}, ${escapeSql(s.bank_name)}, ${escapeSql(s.bank_branch)});\n`;
}
sqlScript += `\n`;

// 7. Accounts
sqlScript += `-- 7. SYSTEM ACCOUNTS\n`;
for (const a of tables['11_System_Accounts']) {
    sqlScript += `INSERT INTO system_accounts (account_id, employee_id, full_name, account_email, role, account_status, password) VALUES (${escapeSql(a.account_id)}, ${escapeSql(a.employee_id)}, ${escapeSql(a.full_name)}, ${escapeSql(a.account_email)}, ${escapeSql(a.role)}, ${escapeSql(a.account_status)}, ${escapeSql(a.password)});\n`;
}

fs.writeFileSync(SQL_SEED_PATH, sqlScript, 'utf-8');
console.log(`✅ Đã xuất script SQL thành công vào: ${SQL_SEED_PATH}`);
console.log(`🎉 QUY TRÌNH TẠO 1,000 DỮ LIỆU MẪU ĐẦY ĐỦ 34 CỘT ĐÃ HOÀN TẤT THÀNH CÔNG!`);
