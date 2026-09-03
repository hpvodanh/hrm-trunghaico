-- ==========================================================
-- DATABASE SCHEMA: HRM System (PostgreSQL)
-- Standard 3NF Normalized Relational Database
-- ==========================================================

-- 1. Phòng ban / Đơn vị công tác
CREATE TABLE IF NOT EXISTS departments (
    department_id VARCHAR(50) PRIMARY KEY,
    department_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Vị trí công việc
CREATE TABLE IF NOT EXISTS positions (
    position_id VARCHAR(50) PRIMARY KEY,
    position_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Hồ sơ nhân viên chính
CREATE TABLE IF NOT EXISTS employees (
    employee_id VARCHAR(30) PRIMARY KEY,
    time_attendance_code VARCHAR(30),
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(10),
    date_of_birth DATE,
    birth_place VARCHAR(255),
    native_place VARCHAR(255),
    ethnicity VARCHAR(50),
    religion VARCHAR(50),
    nationality VARCHAR(50) DEFAULT 'Việt Nam',
    marital_status VARCHAR(50),
    tax_code VARCHAR(30),
    department_id VARCHAR(50) REFERENCES departments(department_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    position_id VARCHAR(50) REFERENCES positions(position_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    job_title VARCHAR(100),
    direct_manager_id VARCHAR(30) REFERENCES employees(employee_id) ON UPDATE CASCADE ON DELETE SET NULL,
    direct_manager_name VARCHAR(255),
    indirect_manager_id VARCHAR(30) REFERENCES employees(employee_id) ON UPDATE CASCADE ON DELETE SET NULL,
    indirect_manager_name VARCHAR(255),
    work_location VARCHAR(255),
    work_area VARCHAR(100),
    employment_status VARCHAR(50) DEFAULT 'Đang làm việc' NOT NULL,
    labor_nature VARCHAR(50),
    probation_start_date DATE,
    trial_start_date DATE,
    official_date DATE,
    resignation_date DATE,
    expected_retirement_date DATE,
    seniority_text VARCHAR(100),
    is_blacklisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Thông tin liên hệ & Địa chỉ
CREATE TABLE IF NOT EXISTS employee_contacts (
    employee_id VARCHAR(30) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    mobile_phone VARCHAR(20),
    home_phone VARCHAR(20),
    other_phone VARCHAR(20),
    work_email VARCHAR(255),
    personal_email VARCHAR(255),
    permanent_address_full TEXT,
    permanent_country VARCHAR(100) DEFAULT 'Việt Nam',
    permanent_province VARCHAR(100),
    permanent_district VARCHAR(100),
    permanent_ward VARCHAR(100),
    permanent_street VARCHAR(255),
    current_address_full TEXT,
    current_country VARCHAR(100) DEFAULT 'Việt Nam',
    current_province VARCHAR(100),
    current_district VARCHAR(100),
    current_ward VARCHAR(100),
    current_street VARCHAR(255)
);

-- 5. Giấy tờ tùy thân
CREATE TABLE IF NOT EXISTS employee_identity_docs (
    employee_id VARCHAR(30) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    doc_type VARCHAR(50) DEFAULT 'CCCD',
    id_number VARCHAR(30),
    id_issue_date DATE,
    id_issue_place VARCHAR(255),
    id_expiry_date DATE,
    passport_number VARCHAR(30),
    passport_issue_date DATE
);

-- 6. Người liên hệ khẩn cấp
CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(30) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    contact_name VARCHAR(255),
    relationship VARCHAR(100),
    mobile_phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT
);

-- 7. Trình độ học vấn & Chuyên môn
CREATE TABLE IF NOT EXISTS employee_education (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(30) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    education_level VARCHAR(50),
    degree_type VARCHAR(100),
    institution VARCHAR(255),
    faculty VARCHAR(255),
    major VARCHAR(255),
    graduation_year INT,
    classification VARCHAR(50)
);

-- 8. Lương & Tài khoản Ngân hàng
CREATE TABLE IF NOT EXISTS employee_salaries_banks (
    employee_id VARCHAR(30) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    salary_grade INT,
    base_salary NUMERIC(15, 2) DEFAULT 0,
    total_salary NUMERIC(15, 2) DEFAULT 0,
    insurance_salary NUMERIC(15, 2) DEFAULT 0,
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(255),
    bank_branch VARCHAR(255)
);

-- 9. Bảo hiểm & Phúc lợi xã hội
CREATE TABLE IF NOT EXISTS employee_insurance_welfare (
    employee_id VARCHAR(30) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    has_insurance VARCHAR(50) DEFAULT 'Không tham gia',
    social_insurance_book_no VARCHAR(30),
    social_insurance_code VARCHAR(30),
    insurance_join_date DATE,
    total_insurance_rate NUMERIC(6, 4) DEFAULT 0,
    social_insurance_rate NUMERIC(6, 2) DEFAULT 0,
    health_insurance_rate NUMERIC(6, 2) DEFAULT 0,
    unemployment_insurance_rate NUMERIC(6, 2) DEFAULT 0,
    hospital_registered VARCHAR(255),
    union_member VARCHAR(20) DEFAULT 'Không'
);

-- 10. Hợp đồng lao động
CREATE TABLE IF NOT EXISTS employee_contracts (
    contract_id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(30) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    contract_type VARCHAR(100) NOT NULL,
    trial_start_date DATE,
    official_date DATE,
    contract_status VARCHAR(50) DEFAULT 'HIỆU LỰC'
);

-- 11. Tài khoản người dùng hệ thống WebApp
CREATE TABLE IF NOT EXISTS system_accounts (
    account_id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(30) NOT NULL UNIQUE REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    account_email VARCHAR(255) UNIQUE NOT NULL,
    account_status VARCHAR(50) DEFAULT 'Chưa kích hoạt',
    role VARCHAR(50) DEFAULT 'EMPLOYEE' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for Query Optimization
CREATE INDEX IF NOT EXISTS idx_emp_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_emp_pos ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_emp_mgr ON employees(direct_manager_id);
CREATE INDEX IF NOT EXISTS idx_emp_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_contact_phone ON employee_contacts(mobile_phone);
CREATE INDEX IF NOT EXISTS idx_contact_email ON employee_contacts(work_email);
CREATE INDEX IF NOT EXISTS idx_identity_id ON employee_identity_docs(id_number);
