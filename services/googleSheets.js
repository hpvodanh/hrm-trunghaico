const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'sheets.config.json');
const TMP_CONFIG_PATH = path.join(os.tmpdir(), 'sheets.config.json');

let inMemoryConfig = null;
let activeCredentials = null;

function setActiveCredentials(creds) {
    if (!creds) return;
    activeCredentials = typeof creds === 'string' ? JSON.parse(creds) : creds;
}

// Helper to get config
function getConfig() {
    let baseConfig = {
        keyFilePath: './config/hrm-trunghaico-507602-fd746f1db385.json',
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
        autoSyncOnSave: true
    };

    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            baseConfig = { ...baseConfig, ...fileCfg };
        }
    } catch (e) {
        console.error('Error reading sheets config:', e.message);
    }

    try {
        if (fs.existsSync(TMP_CONFIG_PATH)) {
            const tmpCfg = JSON.parse(fs.readFileSync(TMP_CONFIG_PATH, 'utf-8'));
            baseConfig = { ...baseConfig, ...tmpCfg };
        }
    } catch (e) {}

    if (inMemoryConfig) {
        baseConfig = { ...baseConfig, ...inMemoryConfig };
    }

    if (process.env.GOOGLE_SPREADSHEET_ID) {
        baseConfig.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    }

    return baseConfig;
}

// Helper to save config
function saveConfig(cfg) {
    inMemoryConfig = { ...(inMemoryConfig || getConfig()), ...cfg };
    if (cfg && cfg.spreadsheetId) {
        process.env.GOOGLE_SPREADSHEET_ID = cfg.spreadsheetId;
    }

    let saved = false;
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const current = getConfig();
        const updated = { ...current, ...cfg };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
        saved = true;
    } catch (e) {
        // Read-only filesystem (e.g. Vercel)
        console.warn('Config path read-only, attempting fallback to os.tmpdir():', e.message);
    }

    try {
        const current = getConfig();
        const updated = { ...current, ...cfg };
        fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
        saved = true;
    } catch (e) {}

    return saved || true;
}

// Get Google Sheets API Client
function getSheetsClient(customCredentials) {
    // 1. Check custom credentials argument
    if (customCredentials) {
        try {
            const credentials = typeof customCredentials === 'string'
                ? JSON.parse(customCredentials)
                : customCredentials;
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            });
            return google.sheets({ version: 'v4', auth });
        } catch (err) {
            console.error('Error with customCredentials:', err.message);
        }
    }

    // 2. Check active in-memory credentials
    if (activeCredentials) {
        try {
            const auth = new google.auth.GoogleAuth({
                credentials: activeCredentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            });
            return google.sheets({ version: 'v4', auth });
        } catch (err) {
            console.error('Error with activeCredentials:', err.message);
        }
    }

    // 3. Check for Cloud / Vercel Environment Variable
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            const credentials = typeof process.env.GOOGLE_SERVICE_ACCOUNT_JSON === 'string'
                ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
                : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            });
            return google.sheets({ version: 'v4', auth });
        } catch (err) {
            console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON env var:', err.message);
        }
    }

    // 4. Check for local key file on disk
    const cfg = getConfig();
    const candidatePaths = [];

    if (cfg.keyFilePath) {
        if (path.isAbsolute(cfg.keyFilePath)) {
            candidatePaths.push(cfg.keyFilePath);
        } else {
            candidatePaths.push(path.join(__dirname, '..', cfg.keyFilePath));
        }
    }

    // Standard fallback locations
    candidatePaths.push(path.join(os.tmpdir(), 'service-account.json'));
    candidatePaths.push(path.join(__dirname, '..', 'config', 'hrm-trunghaico-507602-fd746f1db385.json'));
    candidatePaths.push(path.join(__dirname, '..', 'config', 'service-account.json'));
    candidatePaths.push(path.join(__dirname, '..', 'hrm-trunghaico-507602-fd746f1db385.json'));

    // Scan config/ directory for any service account json file
    try {
        const configDir = path.join(__dirname, '..', 'config');
        if (fs.existsSync(configDir)) {
            const files = fs.readdirSync(configDir);
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'sheets.config.json') {
                    candidatePaths.push(path.join(configDir, file));
                }
            }
        }
    } catch (e) {}

    const foundKeyFile = candidatePaths.find(p => fs.existsSync(p));

    if (!foundKeyFile) {
        throw new Error('Khóa Service Account không tồn tại. Vui lòng hoàn tất Setup Wizard hoặc thiết lập biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON trên Vercel.');
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: foundKeyFile,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
    });

    return google.sheets({ version: 'v4', auth });
}

// Get Service Account information (email, project_id)
function getServiceAccountInfo() {
    if (activeCredentials && activeCredentials.client_email) {
        return {
            email: activeCredentials.client_email,
            projectId: activeCredentials.project_id
        };
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            const creds = typeof process.env.GOOGLE_SERVICE_ACCOUNT_JSON === 'string'
                ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
                : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
            if (creds && creds.client_email) {
                return {
                    email: creds.client_email,
                    projectId: creds.project_id
                };
            }
        } catch (e) {}
    }

    const cfg = getConfig();
    const candidatePaths = [];
    if (cfg.keyFilePath) {
        candidatePaths.push(path.isAbsolute(cfg.keyFilePath) ? cfg.keyFilePath : path.join(__dirname, '..', cfg.keyFilePath));
    }
    candidatePaths.push(path.join(os.tmpdir(), 'service-account.json'));
    candidatePaths.push(path.join(__dirname, '..', 'config', 'hrm-trunghaico-507602-fd746f1db385.json'));
    candidatePaths.push(path.join(__dirname, '..', 'config', 'service-account.json'));

    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            try {
                const creds = JSON.parse(fs.readFileSync(p, 'utf-8'));
                if (creds && creds.client_email) {
                    return { email: creds.client_email, projectId: creds.project_id };
                }
            } catch (e) {}
        }
    }
    return null;
}

// Test connection to Google Spreadsheet
async function testConnection(customSpreadsheetId) {
    const cfg = getConfig();
    const spreadsheetId = (customSpreadsheetId !== undefined ? customSpreadsheetId : cfg.spreadsheetId) || '';
    const saInfo = getServiceAccountInfo();

    if (!spreadsheetId.trim()) {
        return {
            success: false,
            message: 'Chưa cấu hình Google Spreadsheet ID',
            serviceAccountEmail: saInfo?.email || ''
        };
    }

    try {
        const sheets = getSheetsClient();
        const res = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = (res.data.sheets || []).map(s => s.properties.title);
        return {
            success: true,
            title: res.data.properties.title,
            spreadsheetId,
            sheets: sheetList,
            serviceAccountEmail: saInfo?.email || '',
            message: `Đã kết nối thành công tới "${res.data.properties.title}" (${sheetList.length} tabs)`
        };
    } catch (e) {
        return {
            success: false,
            spreadsheetId,
            serviceAccountEmail: saInfo?.email || '',
            error: e.message,
            message: e.message.includes('not supported for this document')
                ? 'File hiện tại là định dạng Excel (.xlsx). Vui lòng vào Tệp > "Lưu dưới dạng Google Trang tính" trên Google Drive và dùng ID của file Google Trang tính mới.'
                : e.message.includes('The caller does not have permission') || e.message.includes('not found')
                ? `Không tìm thấy file hoặc chưa cấp quyền chia sẻ (Editor) cho Service Account: ${saInfo?.email || 'email Service Account'}.`
                : e.message
        };
    }
}

// Test connection to Google Spreadsheet with custom credentials
async function testConnectionWithCredentials(credentials, spreadsheetId) {
    if (!spreadsheetId || !spreadsheetId.trim()) {
        return { success: false, message: 'Chưa cung cấp Google Spreadsheet ID' };
    }
    if (!credentials) {
        return { success: false, message: 'Chưa cung cấp Service Account JSON' };
    }

    try {
        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
        const auth = new google.auth.GoogleAuth({
            credentials: parsedCreds,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId.trim() });
        const sheetList = (res.data.sheets || []).map(s => s.properties.title);

        // Cache valid credentials in memory
        setActiveCredentials(parsedCreds);
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsedCreds);
        process.env.GOOGLE_SPREADSHEET_ID = spreadsheetId.trim();

        return {
            success: true,
            title: res.data.properties.title,
            spreadsheetId: spreadsheetId.trim(),
            sheets: sheetList,
            clientEmail: parsedCreds.client_email,
            projectId: parsedCreds.project_id,
            message: `Kết nối thành công tới trang tính "${res.data.properties.title}" (${sheetList.length} tabs)`
        };
    } catch (e) {
        return {
            success: false,
            spreadsheetId,
            error: e.message,
            message: e.message.includes('not supported for this document')
                ? 'File hiện tại là định dạng Excel (.xlsx). Vui lòng vào Tệp > "Lưu dưới dạng Google Trang tính" trên Google Drive và dùng ID của file Google Trang tính mới.'
                : e.message.includes('The caller does not have permission') || e.message.includes('not found')
                ? 'Không tìm thấy file hoặc chưa cấp quyền chia sẻ (Editor) cho Service Account email.'
                : e.message
        };
    }
}

// Ensure all required sheets exist in spreadsheet
async function ensureSheets(sheets, spreadsheetId, requiredNames) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = (meta.data.sheets || []).map(s => s.properties.title);
    
    const missing = requiredNames.filter(name => !existingTitles.includes(name));
    if (missing.length > 0) {
        const requests = missing.map(title => ({
            addSheet: {
                properties: { title: title.substring(0, 50) }
            }
        }));
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });
        console.log(`[Google Sheets] Đã tạo mới ${missing.length} tab thiếu:`, missing);
    }
}

// Export a single table to Google Sheet
async function exportTableToGoogleSheets(tableName, rows, customSpreadsheetId, customCredentials) {
    const cfg = getConfig();
    const spreadsheetId = customSpreadsheetId || cfg.spreadsheetId;
    if (!spreadsheetId) return false;

    const sheets = getSheetsClient(customCredentials);
    await ensureSheets(sheets, spreadsheetId, [tableName]);

    let headers = [];
    if (rows && rows.length > 0) {
        headers = Object.keys(rows[0]);
    } else {
        headers = ['id', 'status', 'note'];
    }

    const values = [
        headers,
        ...rows.map(row => headers.map(h => {
            const val = row[h];
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
        }))
    ];

    // Clear old data
    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${tableName}'!A1:ZZ50000`
        });
    } catch (e) {}

    // Write new data
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tableName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
    });

    return true;
}

// Export ALL tables from local DB to Google Sheets
async function exportAllToGoogleSheets(db, customSpreadsheetId, customCredentials) {
    const cfg = getConfig();
    const spreadsheetId = customSpreadsheetId || cfg.spreadsheetId;
    if (!spreadsheetId) {
        throw new Error('Chưa cấu hình Spreadsheet ID');
    }

    const sheets = getSheetsClient(customCredentials);
    const tableNames = Object.keys(db.tables || {});
    await ensureSheets(sheets, spreadsheetId, tableNames);

    console.log(`[Google Sheets] Bắt đầu đồng bộ ${tableNames.length} bảng lên Google Sheets...`);
    const results = [];

    for (const tableName of tableNames) {
        const rows = db.tables[tableName] || [];
        try {
            await exportTableToGoogleSheets(tableName, rows, spreadsheetId, customCredentials);
            results.push({ table: tableName, rows: rows.length, success: true });
        } catch (err) {
            console.error(`[Google Sheets] Lỗi đồng bộ bảng "${tableName}":`, err.message);
            results.push({ table: tableName, rows: rows.length, success: false, error: err.message });
        }
    }

    return { success: true, results };
}

// Import ALL tables from Google Sheets into local format
async function importAllFromGoogleSheets(customSpreadsheetId, customCredentials) {
    const cfg = getConfig();
    const spreadsheetId = customSpreadsheetId || cfg.spreadsheetId;
    if (!spreadsheetId) {
        throw new Error('Chưa cấu hình Spreadsheet ID');
    }

    const sheets = getSheetsClient(customCredentials);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitles = (meta.data.sheets || []).map(s => s.properties.title);

    const tables = {};
    for (const title of sheetTitles) {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${title}'!A1:ZZ50000`,
                valueRenderOption: 'UNFORMATTED_VALUE'
            });
            const rows = res.data.values || [];
            if (rows.length === 0) {
                tables[title] = [];
                continue;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1).map(r => {
                const obj = {};
                headers.forEach((h, idx) => {
                    if (h) {
                        obj[h] = r[idx] !== undefined ? r[idx] : null;
                    }
                });
                return obj;
            });
            tables[title] = dataRows;
        } catch (e) {
            console.error(`Lỗi đọc sheet ${title}:`, e.message);
        }
    }

    return { tables };
}

// Debounced background sync for efficient performance
let syncTimer = null;
let lastDbSnapshot = null;

function triggerBackgroundSync(db) {
    lastDbSnapshot = db;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        const cfg = getConfig();
        if (!cfg.autoSyncOnSave || !cfg.spreadsheetId) return;

        try {
            console.log('[Google Sheets] Đang đồng bộ nền lên Google Sheet...');
            if (lastDbSnapshot) {
                await exportAllToGoogleSheets(lastDbSnapshot);
                console.log('[Google Sheets] Đồng bộ nền hoàn tất.');
            }
        } catch (e) {
            console.warn('[Google Sheets Sync Warning]:', e.message);
        }
    }, 2500); // 2.5s debounce
}

module.exports = {
    getConfig,
    saveConfig,
    setActiveCredentials,
    getServiceAccountInfo,
    testConnection,
    testConnectionWithCredentials,
    exportTableToGoogleSheets,
    exportAllToGoogleSheets,
    importAllFromGoogleSheets,
    triggerBackgroundSync
};
