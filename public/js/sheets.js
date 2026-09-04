/**
 * TRUNG HẢI HRM - Google Sheets Cloud Sync Module
 */
const appSheets = (() => {
    let currentConfig = null;
    let connectionStatus = null;

    async function loadStatus() {
        try {
            const res = await fetch('/api/sheets/config');
            const data = await res.json();
            if (data.success) {
                currentConfig = data.config;
                connectionStatus = data.connection;
                updateUI();
            }
        } catch (e) {
            console.error('Error fetching sheets config:', e);
        }
    }

    function updateUI() {
        const badge = document.getElementById('sheets-status-badge');
        const inputId = document.getElementById('sheets-spreadsheet-id-input');
        const autoSyncCheck = document.getElementById('sheets-auto-sync-check');
        const statusBox = document.getElementById('sheets-connection-box');
        const btnLink = document.getElementById('sheets-open-link-btn');

        if (inputId && currentConfig) {
            inputId.value = currentConfig.spreadsheetId || '';
        }
        if (autoSyncCheck && currentConfig) {
            autoSyncCheck.checked = currentConfig.autoSyncOnSave !== false;
        }

        if (btnLink && currentConfig && currentConfig.spreadsheetId) {
            btnLink.href = `https://docs.google.com/spreadsheets/d/${currentConfig.spreadsheetId}/edit`;
            btnLink.style.display = 'inline-flex';
        } else if (btnLink) {
            btnLink.style.display = 'none';
        }

        if (badge) {
            if (connectionStatus && connectionStatus.success) {
                badge.className = 'badge badge-green';
                badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Google Sheets (Đã kết nối)';
            } else {
                badge.className = 'badge badge-yellow';
                badge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Google Sheets (Chưa kết nối)';
            }
        }

        if (statusBox) {
            const saEmail = connectionStatus?.serviceAccountEmail || currentConfig?.serviceAccountEmail || '';
            const emailHtml = saEmail ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(0,0,0,0.12); font-size: 11.5px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <i class="fa-solid fa-envelope"></i> Service Account: <strong>${saEmail}</strong>
                    </span>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="appSheets.copyEmail('${saEmail}')" style="height: 24px; font-size: 11px; padding: 0 8px; flex-shrink: 0;">
                        <i class="fa-regular fa-copy"></i> Sao chép
                    </button>
                </div>
            ` : '';

            if (connectionStatus && connectionStatus.success) {
                statusBox.className = 'sheets-status-card success';
                statusBox.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <i class="fa-solid fa-circle-check" style="color: #10B981; font-size: 20px;"></i>
                        <div>
                            <strong style="color: #065F46; font-size: 13.5px;">${connectionStatus.title || 'Google Sheet đã kết nối'}</strong>
                            <div style="font-size: 11.5px; color: #047857;">ID: ${connectionStatus.spreadsheetId}</div>
                        </div>
                    </div>
                    <div style="font-size: 11.5px; color: #065F46;">
                        ✓ Đã xác thực 14 bảng dữ liệu (${connectionStatus.sheets ? connectionStatus.sheets.length : 0} tabs sẵn sàng)
                    </div>
                    ${emailHtml}
                `;
            } else {
                statusBox.className = 'sheets-status-card warning';
                statusBox.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <i class="fa-solid fa-triangle-exclamation" style="color: #D97706; font-size: 18px;"></i>
                        <strong style="color: #92400E; font-size: 13px;">Chưa kết nối tới Google Sheet</strong>
                    </div>
                    <div style="font-size: 11.5px; color: #B45309; line-height: 1.4;">
                        ${connectionStatus?.message || 'Vui lòng dán Link hoặc ID của Google Trang tính và nhấn "Lưu & Kết nối".'}
                    </div>
                    ${emailHtml}
                `;
            }
        }
    }

    function openModal() {
        const modal = document.getElementById('modal-google-sheets');
        if (modal) {
            modal.classList.add('active');
            loadStatus();
        }
    }

    function closeModal() {
        const modal = document.getElementById('modal-google-sheets');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async function saveConfig() {
        const inputId = document.getElementById('sheets-spreadsheet-id-input');
        const autoSyncCheck = document.getElementById('sheets-auto-sync-check');
        const btn = document.getElementById('btn-sheets-save');

        const spreadsheetId = inputId ? inputId.value.trim() : '';
        const autoSyncOnSave = autoSyncCheck ? autoSyncCheck.checked : true;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra...';
        }

        try {
            const res = await fetch('/api/sheets/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheetId, autoSyncOnSave })
            });
            const data = await res.json();

            if (data.success) {
                utils.showToast('Kết nối Google Sheets thành công!', 'success');
            } else {
                utils.showToast(data.status?.message || 'Không thể kết nối tới Google Sheet.', 'warning');
            }

            await loadStatus();
        } catch (e) {
            utils.showToast('Lỗi khi lưu cấu hình: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-link"></i> Lưu & Kết Nối';
            }
        }
    }

    async function syncToCloud() {
        const btn = document.getElementById('btn-sheets-sync-now');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ...';
        }

        try {
            const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
                ? appAuth.getCurrentUser()
                : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' };

            const res = await fetch('/api/sheets/sync-to-cloud', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.employee_id || 'TH-1948',
                    user_name: user?.full_name || 'Huỳnh Thanh Long',
                    user_role: user?.role || 'ADMIN'
                })
            });
            const data = await res.json();

            if (data.success) {
                utils.showToast(data.message || 'Đồng bộ toàn bộ dữ liệu lên Google Sheets thành công!', 'success');
                await loadStatus();
            } else {
                utils.showToast(data.message || 'Lỗi đồng bộ lên Google Sheets', 'error');
            }
        } catch (e) {
            utils.showToast('Lỗi đồng bộ: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Đẩy Lên Google Sheet (Sync All)';
            }
        }
    }

    async function pullFromCloud() {
        if (!confirm('Hành động này sẽ ghi đè dữ liệu hiện tại bằng dữ liệu mới nhất trên Google Sheets. Bạn có chắc chắn muốn tiếp tục?')) {
            return;
        }

        const btn = document.getElementById('btn-sheets-pull-now');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
        }

        try {
            const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
                ? appAuth.getCurrentUser()
                : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' };

            const res = await fetch('/api/sheets/pull-from-cloud', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.employee_id || 'TH-1948',
                    user_name: user?.full_name || 'Huỳnh Thanh Long',
                    user_role: user?.role || 'ADMIN'
                })
            });
            const data = await res.json();

            if (data.success) {
                utils.showToast(data.message || 'Nạp dữ liệu từ Google Sheets thành công!', 'success');
                // Reload local database and UI
                if (typeof appData !== 'undefined' && appData.init) {
                    await appData.init();
                    appDashboard.init();
                    appEmployees.init();
                    if (typeof appTrash !== 'undefined') appTrash.render();
                }
                closeModal();
            } else {
                utils.showToast(data.message || 'Lỗi tải dữ liệu từ Google Sheets', 'error');
            }
        } catch (e) {
            utils.showToast('Lỗi nạp dữ liệu: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Tải Về Từ Google Sheet (Pull All)';
            }
        }
    }

    function copyEmail(email) {
        if (!email) return;
        navigator.clipboard.writeText(email).then(() => {
            utils.showToast('Đã sao chép email Service Account!', 'success');
        }).catch(() => {
            utils.showToast('Email: ' + email, 'info');
        });
    }

    return {
        init: loadStatus,
        openModal,
        closeModal,
        saveConfig,
        syncToCloud,
        pullFromCloud,
        copyEmail
    };
})();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(appSheets.init, 1000);
});
