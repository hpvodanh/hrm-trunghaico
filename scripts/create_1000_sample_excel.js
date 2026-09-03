const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const OUTPUT_EXCEL_PATH = path.join(__dirname, '..', 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
const PUBLIC_EXCEL_PATH = path.join(__dirname, '..', 'public', 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
const DB_JSON_PATH = path.join(__dirname, '..', 'database_schema.json');

console.log('🔄 Bắt đầu sinh 1,000 dữ liệu nhân sự mẫu chuẩn hóa đầy đủ 64 cột...');

// Load existing DB for reference tables (01_Departments, 02_Positions)
let originalDb = { tables: {} };
if (fs.existsSync(DB_JSON_PATH)) {
    try {
        originalDb = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
    } catch (e) {
        console.error('Lỗi đọc database_schema.json:', e);
    }
}

const depts = originalDb.tables['01_Departments'] || [
    { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự' },
    { department_id: 'KT', department_name: 'Phòng Kế Toán Tài Chính' },
    { department_id: 'KD', department_name: 'Phòng Kinh Doanh & Tiếp Thị' },
    { department_id: 'KTGS', department_name: 'Phòng Kỹ Thuật & Giám Sát' },
    { department_id: 'TC-HC', department_name: 'Phòng Tổ Chức Hành Chính' },
    { department_id: 'IT', department_name: 'Phòng Công Nghệ Thông Tin' },
    { department_id: 'QLDA', department_name: 'Ban Quản Lý Dự Án' }
];

const positions = originalDb.tables['02_Positions'] || [
    { position_id: 'POS-01', position_name: 'Chuyên viên Nhân sự' },
    { position_id: 'POS-02', position_name: 'Kế toán viên' },
    { position_id: 'POS-03', position_name: 'Kỹ sư Kỹ thuật' },
    { position_id: 'POS-04', position_name: 'Chuyên viên Kinh doanh' },
    { position_id: 'POS-05', position_name: 'Kỹ sư CNTT' },
    { position_id: 'POS-06', position_name: 'Trưởng phòng' },
    { position_id: 'POS-07', position_name: 'Phó phòng' },
    { position_id: 'POS-08', position_name: 'Giám sát Công trình' }
];

// Names Pool
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
    { name: 'Hà Nội', code: '001', hospital: 'Bệnh viện Bạch Mai - Hà Nội', location: 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội' },
    { name: 'TP. Hồ Chí Minh', code: '079', hospital: 'Bệnh viện Chợ Rẫy - TP.HCM', location: 'Chi nhánh Miền Nam - TP. Hồ Chí Minh' },
    { name: 'Đà Nẵng', code: '048', hospital: 'Bệnh viện Đa khoa Đà Nẵng', location: 'Chi nhánh Miền Trung - TP. Đà Nẵng' },
    { name: 'Hải Phòng', code: '031', hospital: 'Bệnh viện Việt Tiệp - Hải Phòng', location: 'Văn phòng Đại diện Hải Phòng' },
    { name: 'Cần Thơ', code: '092', hospital: 'Bệnh viện Đa khoa Cần Thơ', location: 'Chi nhánh Tây Nam Bộ - Cần Thơ' },
    { name: 'Bình Dương', code: '074', hospital: 'Bệnh viện Đa khoa Bình Dương', location: 'Khu Công Nghiệp VSIP - Bình Dương' },
    { name: 'Đồng Nai', code: '075', hospital: 'Bệnh viện Đa khoa Đồng Nai', location: 'Khu Công Nghiệp Biên Hòa - Đồng Nai' },
    { name: 'Bắc Ninh', code: '027', hospital: 'Bệnh viện Đa khoa Bắc Ninh', location: 'Chi nhánh Bắc Ninh' },
    { name: 'Quảng Nam', code: '049', hospital: 'Bệnh viện Đa khoa Quảng Nam', location: 'Văn phòng Dự án Chu Lai' },
    { name: 'Nghệ An', code: '040', hospital: 'Bệnh viện Hữu nghị Đa khoa Nghệ An', location: 'Văn phòng Dự án Vinh' }
];

const universities = [
    { name: 'Đại học Bách Khoa Hà Nội', major: 'Kỹ thuật Máy tính & CNTT' },
    { name: 'Đại học Kinh Tế Quốc Dân', major: 'Quản trị Kinh doanh' },
    { name: 'Đại học Ngoại Thương', major: 'Kinh tế Quốc tế' },
    { name: 'Học viện Tài Chính', major: 'Tài chính Ngân hàng' },
    { name: 'Đại học Khoa học Xã hội & Nhân văn', major: 'Quản trị Nhân lực' },
    { name: 'Đại học Quốc Gia TP.HCM', major: 'Khoa học Máy tính' },
    { name: 'Đại học Kinh Tế TP.HCM (UEH)', major: 'Kế toán Kiểm toán' },
    { name: 'Đại học Bách Khoa TP.HCM', major: 'Kỹ thuật Xây dựng & Giám sát' },
    { name: 'Đại học Luật Hà Nội', major: 'Luật Kinh tế' },
    { name: 'Đại học Mở TP.HCM', major: 'Quản trị Kinh doanh Tổng hợp' }
];

const banks = [
    'Vietcombank', 'MBBank', 'Techcombank', 'BIDV', 'VietinBank', 'ACB', 'VPBank', 'TPBank', 'Agribank', 'Sacombank'
];

function removeVietnameseTones(str) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
}

const rows = [];

// Header Row (64 Columns)
const headers = [
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
    'Số ĐT di động (*)',
    'Số ĐT bàn / Khác',
    'Email công việc',
    'Email cá nhân',
    'Địa chỉ thường trú',
    'Địa chỉ tạm trú / Hiện tại',
    'Số CCCD / CMND',
    'Ngày cấp CCCD (DD/MM/YYYY)',
    'Nơi cấp CCCD',
    'Ngày hết hạn CCCD',
    'Số hộ chiếu (Passport)',
    'Ngày cấp hộ chiếu',
    'Mã số thuế cá nhân',
    'Bậc lương',
    'Lương cơ bản (VNĐ) (*)',
    'Tổng lương / Thu nhập (VNĐ)',
    'Lương đóng BHXH (VNĐ)',
    'Số tài khoản ngân hàng',
    'Tên ngân hàng',
    'Chi nhánh ngân hàng',
    'Tham gia BHXH',
    'Số sổ / Mã số BHXH',
    'Ngày tham gia BHXH',
    'Nơi ĐK khám chữa bệnh ban đầu',
    'Đoàn viên công đoàn',
    'Trình độ học vấn',
    'Hình thức đào tạo',
    'Trường / Cơ sở đào tạo',
    'Chuyên ngành đào tạo',
    'Năm tốt nghiệp',
    'Xếp loại tốt nghiệp',
    'Bằng cấp chuyên môn khác & Chứng chỉ',
    'Họ tên người liên hệ khẩn cấp',
    'Mối quan hệ khẩn cấp',
    'Số ĐT khẩn cấp'
];

rows.push(headers);

// Generate exactly 1,000 distinct employees (TH-1001 to TH-2000)
for (let i = 1; i <= 1000; i++) {
    const empNum = 1000 + i;
    const empId = `TH-${empNum}`;
    const timeAttendanceCode = `${empNum}`;

    const isMale = i % 2 === 1;
    const gender = isMale ? 'Nam' : 'Nữ';
    const lName = lastNames[i % lastNames.length];
    const mName = isMale ? maleMiddleNames[(i * 3) % maleMiddleNames.length] : femaleMiddleNames[(i * 3) % femaleMiddleNames.length];
    const fName = isMale ? maleFirstNames[(i * 7) % maleFirstNames.length] : femaleFirstNames[(i * 7) % femaleFirstNames.length];
    const fullName = `${lName} ${mName} ${fName}`;

    // Birth date (age between 22 and 55)
    const birthYear = 1970 + (i % 33);
    const birthMonth = (i % 12) + 1;
    const birthDay = (i % 28) + 1;
    const dobFormatted = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}/${birthYear}`;

    const prov = provinces[i % provinces.length];
    const birthPlace = prov.name;
    const nativePlace = provinces[(i * 3) % provinces.length].name;
    const ethnicity = (i % 25 === 0) ? 'Tày' : (i % 40 === 0 ? 'Mường' : 'Kinh');
    const religion = 'Không';
    const nationality = 'Việt Nam';
    const isMarried = birthYear < 1998;
    const maritalStatus = isMarried ? 'Đã kết hôn' : 'Độc thân';
    const childrenCount = isMarried ? (i % 3) : 0;

    // Organization
    const deptObj = depts[i % depts.length];
    const posObj = positions[i % positions.length];
    const deptId = deptObj.department_id;
    const posId = posObj.position_id;
    const posTitle = posObj.position_name;

    let jobRank = 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ';
    if (i % 15 === 0) jobRank = 'Cấp 2 - Quản lý Cấp trung / Trưởng phòng';
    else if (i % 30 === 0) jobRank = 'Cấp 1 - Ban Lãnh đạo / Giám đốc';
    else if (i % 8 === 0) jobRank = 'Cấp 4 - Nhân viên Sơ cấp / Tập sự';

    const workLocation = prov.location;
    const workArea = (prov.name === 'Hà Nội') ? 'Khối Văn phòng Tổng công ty' : `Khối Chi nhánh ${prov.name}`;
    const directMgrId = (i <= 5) ? 'TH-0001' : `TH-${1000 + ((i % 20) + 1)}`;
    const directMgrName = (i <= 5) ? 'Huỳnh Thanh Long' : 'Quản lý Trực tiếp';
    const indirectMgrId = 'TH-0001';
    const indirectMgrName = 'Huỳnh Thanh Long';

    // Labor nature & Status
    const laborNature = (i % 20 === 0) ? 'Thử việc' : 'Chính thức';
    const empStatus = (i % 50 === 0) ? 'Đã nghỉ việc' : (i % 60 === 0 ? 'Nghỉ thai sản' : 'Đang làm việc');

    // Work dates
    const startYear = 2018 + (i % 8);
    const startMonth = ((i * 2) % 12) + 1;
    const startDay = ((i * 3) % 28) + 1;
    const startDate = `${String(startDay).padStart(2, '0')}/${String(startMonth).padStart(2, '0')}/${startYear}`;
    const endDate = empStatus === 'Đã nghỉ việc' ? `30/06/2026` : 'Không xác định';

    let contractType = 'Hợp đồng lao động không xác định thời hạn';
    if (laborNature === 'Thử việc') contractType = 'Hợp đồng thử việc';
    else if (startYear >= 2025) contractType = 'Hợp đồng lao động xác định thời hạn (12 tháng)';

    const trialStartDate = startDate;
    const officialDate = laborNature === 'Thử việc' ? `01/04/2026` : startDate;

    // Contact
    const cleanFirstName = removeVietnameseTones(fName).toLowerCase();
    const cleanLastName = removeVietnameseTones(lName).toLowerCase();
    const cleanMiddleName = removeVietnameseTones(mName).toLowerCase().substring(0, 1);
    const workEmail = `${cleanFirstName}.${cleanLastName}${empNum}@trunghaico.vn`;
    const personalEmail = `${cleanFirstName}${cleanMiddleName}${birthYear}${empNum}@gmail.com`;

    const phonePrefix = ['090', '091', '093', '094', '097', '098', '086', '088', '077', '079'][i % 10];
    const phone = `${phonePrefix}${String(1000000 + i).substring(1)}`;
    const homePhone = (i % 4 === 0) ? `024${String(3000000 + i).substring(1)}` : '';

    const permAddress = `Số ${10 + (i % 90)} Đường ${prov.name === 'Hà Nội' ? 'Giải Phóng' : 'Nguyễn Huệ'}, TP. ${prov.name}`;
    const currAddress = permAddress;

    // Unique CCCD (12 digits)
    const genderDigit = isMale ? (birthYear < 2000 ? '0' : '2') : (birthYear < 2000 ? '1' : '3');
    const year2Digits = String(birthYear).substring(2);
    const cccd = `${prov.code}${genderDigit}${year2Digits}${String(100000 + i).substring(1)}`;
    const cccdIssueDate = `10/05/2021`;
    const cccdIssuePlace = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
    const cccdExpiryDate = `10/05/${birthYear + 40}`;
    const passportNumber = (i % 3 === 0) ? `P0${String(1000000 + i).substring(1)}` : '';
    const passportIssueDate = passportNumber ? `15/08/2022` : '';
    const taxCode = `8${String(100000000 + i).substring(1)}`;

    // Salaries
    const salaryGrade = (i % 6) + 1;
    const baseSalary = 10000000 + (salaryGrade * 2500000) + ((i % 5) * 500000);
    const totalSalary = Math.round(baseSalary * 1.25);
    const insuranceSalary = Math.min(baseSalary, 23400000);

    const bankName = banks[i % banks.length];
    const bankAccount = `10${String(1000000000 + i).substring(1)}`;
    const bankBranch = `Chi nhánh ${prov.name}`;

    // Insurance & Union
    const hasInsurance = 'Tham gia đầy đủ';
    const socialInsuranceBook = `04${String(10000000 + i).substring(1)}`;
    const insuranceJoinDate = startDate;
    const hospitalRegistered = prov.hospital;
    const unionMember = 'Đoàn viên';

    // Education
    const uni = universities[i % universities.length];
    const eduLevel = (i % 10 === 0) ? 'Thạc sĩ' : ((i % 15 === 0) ? 'Cao đẳng' : 'Đại học');
    const degreeType = 'Chính quy';
    const institution = uni.name;
    const major = uni.major;
    const gradYear = birthYear + 22;
    const classification = (i % 5 === 0) ? 'Xuất sắc' : ((i % 3 === 0) ? 'Giỏi' : 'Khá');
    const otherCerts = (i % 4 === 0) ? 'Chứng chỉ TOEIC 750, Chứng chỉ Tin học Quốc tế MOS' : 'Chứng chỉ Ngoại ngữ B2';

    // Emergency Contact
    const emergRelation = isMarried ? (isMale ? 'Vợ' : 'Chồng') : 'Bố';
    const emergName = isMarried ? `${lastNames[(i + 3) % lastNames.length]} Thị Hoa` : `${lName} Văn Hùng`;
    const emergPhone = `091${String(2000000 + i).substring(1)}`;

    rows.push([
        empId,
        timeAttendanceCode,
        fullName,
        gender,
        dobFormatted,
        birthPlace,
        nativePlace,
        ethnicity,
        religion,
        nationality,
        maritalStatus,
        childrenCount,
        deptId,
        posId,
        jobRank,
        posTitle,
        workLocation,
        workArea,
        directMgrId,
        directMgrName,
        indirectMgrId,
        indirectMgrName,
        laborNature,
        empStatus,
        startDate,
        endDate,
        contractType,
        trialStartDate,
        officialDate,
        phone,
        homePhone,
        workEmail,
        personalEmail,
        permAddress,
        currAddress,
        cccd,
        cccdIssueDate,
        cccdIssuePlace,
        cccdExpiryDate,
        passportNumber,
        passportIssueDate,
        taxCode,
        salaryGrade,
        baseSalary,
        totalSalary,
        insuranceSalary,
        bankAccount,
        bankName,
        bankBranch,
        hasInsurance,
        socialInsuranceBook,
        insuranceJoinDate,
        hospitalRegistered,
        unionMember,
        eduLevel,
        degreeType,
        institution,
        major,
        gradYear,
        classification,
        otherCerts,
        emergName,
        emergRelation,
        emergPhone
    ]);
}

const wb = XLSX.utils.book_new();

// Sheet 1: Danh_Sach_Nhan_Su
const ws1 = XLSX.utils.aoa_to_sheet(rows);
ws1['!cols'] = headers.map(() => ({ wch: 22 }));
ws1['!cols'][0] = { wch: 16 }; // Mã NV
ws1['!cols'][2] = { wch: 24 }; // Họ tên
ws1['!cols'][31] = { wch: 28 }; // Email công việc
ws1['!cols'][33] = { wch: 36 }; // Thường trú
ws1['!cols'][34] = { wch: 36 }; // Tạm trú
ws1['!cols'][35] = { wch: 18 }; // CCCD

XLSX.utils.book_append_sheet(wb, ws1, 'Danh_Sach_Nhan_Su');

// Sheet 2: Danh_Muc_Tham_Chieu
const refData = [
    ['=== DANH MỤC THAM CHIẾU HỆ THỐNG QUẢN TRỊ NHÂN SỰ TRUNG HẢI ===', ''],
    ['(Sử dụng các giá trị chuẩn trong sheet này để tra cứu thông tin)', ''],
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

// Write to both workspace root and public folder
XLSX.writeFile(wb, OUTPUT_EXCEL_PATH);
XLSX.writeFile(wb, PUBLIC_EXCEL_PATH);

console.log(`✅ Đã xuất thành công file Excel 1,000 nhân sự mẫu:`);
console.log(`📁 Đường dẫn gốc: ${OUTPUT_EXCEL_PATH}`);
console.log(`📁 Đường dẫn web public: ${PUBLIC_EXCEL_PATH}`);
