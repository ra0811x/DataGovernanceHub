/**
 * 系统日志页面模块
 * 负责日志数据的加载、筛选、展示和分页。
 */

(function(window) {
    'use strict';

    const state = {
        currentPage: 1,
        pageSize: 50,
        totalRecords: 0,
        controlsBound: false
    };

    function getOperationLabel(operationType) {
        return {
            data_import: '数据导入',
            data_export: '数据导出',
            data_delete: '数据删除',
            data_process: '数据处理',
            data_switch: '数据切换',
            file_upload: '文件上传',
            file_delete: '文件删除',
            settings_update: '配置更新'
        }[operationType] || operationType;
    }

    function getOperationBadgeClass(operationType) {
        return {
            data_import: 'log-type-import',
            data_export: 'log-type-export',
            data_delete: 'log-type-settings',
            data_process: 'log-type-switch',
            data_switch: 'log-type-switch',
            file_upload: 'log-type-import',
            file_delete: 'log-type-settings',
            settings_update: 'log-type-settings'
        }[operationType] || '';
    }

    function getPageTypeLabel(pageType) {
        return {
            device: '数据概览',
            merge: '合并结果上报',
            database: '合并结果',
            reporting: '填报数据',
            report: '报表管理',
            dataProcess: '数据处理',
            file_manage: '文件管理',
            settings: '系统日志'
        }[pageType] || '-';
    }

    function parseLogOperationTime(value) {
        if (!value) return null;
        if (value instanceof Date) return value;

        const text = String(value).trim();
        if (!text) return null;

        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
            return new Date(text.replace(' ', 'T') + 'Z');
        }

        const parsed = new Date(text);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatLogOperationTime(value) {
        const parsed = parseLogOperationTime(value);
        return parsed ? parsed.toLocaleString('zh-CN') : '-';
    }

    function getLocalDateString(date = new Date()) {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function escapeLogHtml(text) {
        return String(text ?? '').replace(/[&<>"']/g, function(char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char] || char;
        });
    }

    function renderLogTableState(message) {
        return `<tr><td colspan="6" class="logs-empty-cell">${escapeLogHtml(message)}</td></tr>`;
    }

    async function loadLogs() {
        const logTypeFilter = document.getElementById('logTypeFilter');
        const logPageFilter = document.getElementById('logPageFilter');
        const logStartDate = document.getElementById('logStartDate');
        const logEndDate = document.getElementById('logEndDate');
        const logsBody = document.getElementById('logsBody');

        if (!logTypeFilter || !logPageFilter || !logStartDate || !logEndDate || !logsBody) {
            return;
        }

        const params = new URLSearchParams({
            page: state.currentPage,
            pageSize: state.pageSize,
            operationType: logTypeFilter.value,
            pageType: logPageFilter.value,
            startDate: logStartDate.value,
            endDate: logEndDate.value
        });

        try {
            const res = await fetch(API_BASE + '/logs?' + params);
            const result = await res.json();

            state.totalRecords = result.total;
            renderLogs(result.data);
            updatePagination();
            updateStats();
        } catch (e) {
            console.error('加载日志失败:', e);
            logsBody.innerHTML = renderLogTableState('加载失败');
        }
    }

    async function updateStats() {
        try {
            const res = await fetch(API_BASE + '/logs/stats');
            const stats = await res.json();

            const logTotalCount = document.getElementById('logTotalCount');
            const logTodayCount = document.getElementById('logTodayCount');
            if (!logTotalCount || !logTodayCount) {
                return;
            }

            logTotalCount.textContent = stats.total || 0;

            const today = getLocalDateString();
            const todayCount = (typeof stats.today_total === 'number')
                ? stats.today_total
                : (stats.recent || []).filter(log => log.operation_time.startsWith(today)).length;
            logTodayCount.textContent = todayCount;
        } catch (e) {
            console.error('获取统计失败:', e);
        }
    }

    function renderLogs(logs) {
        const tbody = document.getElementById('logsBody');
        if (!tbody) {
            return;
        }

        if (!logs || logs.length === 0) {
            tbody.innerHTML = renderLogTableState('暂无日志记录');
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const typeClass = getOperationBadgeClass(log.operation_type);
            const typeName = getOperationLabel(log.operation_type);
            const pageName = getPageTypeLabel(log.page_type);
            const time = formatLogOperationTime(log.operation_time);
            const desc = log.operation_desc || '-';
            const fileName = log.file_name || '-';
            const recordCount = log.record_count ?? '-';

            return `
                <tr>
                    <td class="logs-cell logs-cell--time">${escapeLogHtml(time)}</td>
                    <td class="logs-cell"><span class="log-type-badge ${typeClass}">${escapeLogHtml(typeName)}</span></td>
                    <td class="logs-cell"><span class="log-page-pill">${escapeLogHtml(pageName)}</span></td>
                    <td class="logs-cell logs-cell--desc">${escapeLogHtml(desc)}</td>
                    <td class="logs-cell logs-cell--file" title="${escapeLogHtml(fileName)}"><span class="logs-file-name">${escapeLogHtml(fileName)}</span></td>
                    <td class="logs-cell logs-cell--count">${escapeLogHtml(String(recordCount))}</td>
                </tr>
            `;
        }).join('');
    }

    function updatePagination() {
        const logPaginationInfo = document.getElementById('logPaginationInfo');
        const logPrevBtn = document.getElementById('logPrevBtn');
        const logNextBtn = document.getElementById('logNextBtn');
        if (!logPaginationInfo || !logPrevBtn || !logNextBtn) {
            return;
        }

        const totalPages = Math.ceil(state.totalRecords / state.pageSize) || 1;
        logPaginationInfo.textContent = `第 ${state.currentPage} / ${totalPages} 页，共 ${state.totalRecords} 条`;
        logPrevBtn.disabled = state.currentPage === 1;
        logNextBtn.disabled = state.currentPage >= totalPages;
    }

    function filterLogs() {
        state.currentPage = 1;
        loadLogs();
    }

    function clearLogFilters() {
        const logTypeFilter = document.getElementById('logTypeFilter');
        const logPageFilter = document.getElementById('logPageFilter');
        const logStartDate = document.getElementById('logStartDate');
        const logEndDate = document.getElementById('logEndDate');
        if (!logTypeFilter || !logPageFilter || !logStartDate || !logEndDate) {
            return;
        }

        logTypeFilter.value = '';
        logPageFilter.value = '';
        logStartDate.value = '';
        logEndDate.value = '';
        state.currentPage = 1;
        loadLogs();
    }

    function prevPage() {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadLogs();
        }
    }

    function nextPage() {
        const totalPages = Math.ceil(state.totalRecords / state.pageSize) || 1;
        if (state.currentPage < totalPages) {
            state.currentPage++;
            loadLogs();
        }
    }

    function bindPaginationControls() {
        if (state.controlsBound) {
            return;
        }

        const logPrevBtn = document.getElementById('logPrevBtn');
        const logNextBtn = document.getElementById('logNextBtn');
        if (!logPrevBtn || !logNextBtn) {
            return;
        }

        logPrevBtn.onclick = prevPage;
        logNextBtn.onclick = nextPage;
        state.controlsBound = true;
    }

    function init() {
        bindPaginationControls();
        loadLogs();
    }

    function bootstrap() {
        bindPaginationControls();

        const logsPage = document.getElementById('page-settings');
        if (logsPage && logsPage.classList.contains('active')) {
            init();
        }
    }

    window.LogsPage = {
        init: init,
        loadLogs: loadLogs,
        filterLogs: filterLogs,
        clearLogFilters: clearLogFilters,
        state: state
    };

    window.loadLogs = loadLogs;
    window.filterLogs = filterLogs;
    window.clearLogFilters = clearLogFilters;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})(window);
