/**
 * Data Process Page (UTF-8 safe)
 */
(function(window) {
    'use strict';

    const api = new DataProcessApi({ baseURL: window.API_BASE || '/api' });
    let currentMode = 'allinone';

    const STORAGE_KEYS = {
        allinoneDirPath: 'dataProcess_lastDirPath',
        splitDirPath: 'dataProcess_lastSplitDirPath',
        csvDirPath: 'dataProcess_lastCsvDirPath',
        dedupDirPath: 'dataProcess_lastDedupDirPath'
    };

    const CN = {
        waiting: '\u7b49\u5f85\u5f00\u59cb\u5904\u7406...',
        statusOk: '\u6210\u529f',
        statusFail: '\u5931\u8d25',
        statusLabel: '\u5904\u7406\u72b6\u6001:',
        errLabel: '\u9519\u8bef\u4fe1\u606f:',
        processing: '\u6b63\u5728\u5904\u7406...',
        initing: '\u521d\u59cb\u5316\u4e2d...',
        done: '\u5904\u7406\u5b8c\u6210',
        downloadable: '\u53ef\u4e0b\u8f7d\u7ed3\u679c',
        loading: '\u52a0\u8f7d\u4e2d...',
        loadFailed: '\u52a0\u8f7d\u5931\u8d25',
        notFound: '\u672a\u627e\u5230\u6587\u4ef6',
        splitNotFound: '\u672a\u627e\u5230\u53ef\u62c6\u5206\u6587\u4ef6',
        chooseFile: '\u8bf7\u9009\u62e9\u6587\u4ef6',
        splitNeed2: '\u62c6\u5206\u6570\u91cf\u81f3\u5c11\u4e3a2',
        needDir: '\u8bf7\u8f93\u5165\u76ee\u5f55\u8def\u5f84',
        needZipDir: '\u8bf7\u5148\u8f93\u5165\u538b\u7f29\u5305\u76ee\u5f55\u5b8c\u6574\u8def\u5f84',
        noExcelFound: '\u76ee\u5f55\u4e2d\u672a\u627e\u5230 Excel \u6587\u4ef6',
        needSelectExcel: '\u8bf7\u81f3\u5c11\u52fe\u9009\u4e00\u4e2a Excel \u6587\u4ef6',
        previewDone: '\u9884\u89c8\u5b8c\u6210',
        refreshDone: '\u62c6\u5206\u6587\u4ef6\u5217\u8868\u5df2\u5237\u65b0',
        logDone: '\u65e5\u5fd7\u5df2\u5bfc\u51fa',
        logFail: '\u5bfc\u51fa\u5931\u8d25',
        previewFail: '\u9884\u89c8\u5931\u8d25'
    };

    const EXCEL_SELECTION_MODES = ['split', 'csv', 'dedup'];
    const excelSelectionState = EXCEL_SELECTION_MODES.reduce((acc, mode) => {
        acc[mode] = createExcelSelectionState();
        return acc;
    }, {});

    function statusBoxId(mode) {
        return mode + 'RealTimeStatus';
    }

    function normalizeText(text, fallback) {
        const s = String(text == null ? '' : text).trim();
        if (!s) return fallback || '';
        if (/^[?\uff1f\s]+$/.test(s)) return fallback || '';
        return s;
    }

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderTablePlaceholder(text, colspan) {
        return `<tr><td colspan="${colspan}" class="file-list-table__placeholder">${escapeHtml(text)}</td></tr>`;
    }

    function createExcelSelectionState() {
        return {
            dirPath: '',
            files: [],
            selectedRelPaths: new Set(),
            loaded: false
        };
    }

    function formatSizeMb(sizeBytes) {
        const value = Number(sizeBytes || 0) / 1024 / 1024;
        return `${value.toFixed(2)} MB`;
    }

    function getExcelSelectionDom(mode) {
        return {
            section: document.getElementById(`${mode}SelectedFilesSection`),
            list: document.getElementById(`${mode}SelectedFilesList`),
            summary: document.getElementById(`${mode}SelectedFilesSummary`),
            size: document.getElementById(`${mode}SelectedFilesSize`)
        };
    }

    function getSelectedExcelFiles(mode) {
        const state = excelSelectionState[mode];
        if (!state || !state.loaded) {
            return [];
        }
        return state.files
            .filter(file => state.selectedRelPaths.has(file.rel_path))
            .map(file => file.rel_path);
    }

    function updateExcelSelectionSummary(mode) {
        const state = excelSelectionState[mode];
        const dom = getExcelSelectionDom(mode);
        if (!state || !dom.summary || !dom.size) {
            return;
        }

        const totalCount = state.files.length;
        const selectedFiles = state.files.filter(file => state.selectedRelPaths.has(file.rel_path));
        const selectedCount = selectedFiles.length;
        const totalBytes = state.files.reduce((sum, file) => sum + Number(file.size || 0), 0);
        const selectedBytes = selectedFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);

        dom.summary.textContent = `已选 ${selectedCount} / ${totalCount} 个文件`;
        dom.size.textContent = `大小 ${formatSizeMb(selectedBytes)} / ${formatSizeMb(totalBytes)}`;
    }

    function renderExcelSelectionTable(mode) {
        const state = excelSelectionState[mode];
        const dom = getExcelSelectionDom(mode);
        if (!state || !dom.section || !dom.list) {
            return;
        }

        dom.section.style.display = 'block';

        if (!state.files.length) {
            dom.list.innerHTML = renderTablePlaceholder(CN.noExcelFound, 4);
            updateExcelSelectionSummary(mode);
            return;
        }

        dom.list.innerHTML = state.files.map((file, index) => {
            const relPath = file.rel_path || '';
            const checked = state.selectedRelPaths.has(relPath) ? 'checked' : '';
            return `
                <tr>
                    <td class="file-list-table__cell--check">
                        <input
                            type="checkbox"
                            class="file-list-table__checkbox data-process-file-checkbox"
                            data-mode="${escapeHtml(mode)}"
                            data-rel-path="${escapeHtml(relPath)}"
                            ${checked}
                        />
                    </td>
                    <td class="file-list-table__cell--index">${index + 1}</td>
                    <td class="file-list-table__cell--path">${escapeHtml(relPath || file.name || '')}</td>
                    <td class="file-list-table__cell--size">${escapeHtml(String(file.size_mb ?? 0))} MB</td>
                </tr>
            `;
        }).join('');

        updateExcelSelectionSummary(mode);
    }

    function setExcelSelectionLoading(mode) {
        const state = excelSelectionState[mode];
        const dom = getExcelSelectionDom(mode);
        if (!state || !dom.section || !dom.list) {
            return;
        }
        state.dirPath = '';
        state.files = [];
        state.selectedRelPaths = new Set();
        state.loaded = false;
        dom.section.style.display = 'block';
        dom.list.innerHTML = renderTablePlaceholder(CN.loading, 4);
        if (dom.summary) dom.summary.textContent = '正在读取文件列表';
        if (dom.size) dom.size.textContent = '大小 0.00 MB / 0.00 MB';
    }

    function clearExcelSelection(mode, hideSection) {
        const state = excelSelectionState[mode];
        const dom = getExcelSelectionDom(mode);
        if (!state) {
            return;
        }

        state.dirPath = '';
        state.files = [];
        state.selectedRelPaths = new Set();
        state.loaded = false;

        if (dom.list) {
            dom.list.innerHTML = '';
        }
        if (dom.summary) {
            dom.summary.textContent = '已选 0 / 0 个文件';
        }
        if (dom.size) {
            dom.size.textContent = '大小 0.00 MB / 0.00 MB';
        }
        if (dom.section) {
            dom.section.style.display = hideSection === false ? 'block' : 'none';
        }
    }

    function applyExcelPreview(mode, dirPath, res) {
        const state = excelSelectionState[mode];
        const files = Array.isArray(res?.files) ? res.files : [];
        if (!state) {
            return;
        }

        state.dirPath = dirPath;
        state.files = files;
        state.selectedRelPaths = new Set(files.map(file => file.rel_path).filter(Boolean));
        state.loaded = true;
        renderExcelSelectionTable(mode);
    }

    function handleExcelSelectionChange(event) {
        const checkbox = event.target.closest('.data-process-file-checkbox');
        if (!checkbox) {
            return;
        }

        const mode = checkbox.dataset.mode;
        const relPath = checkbox.dataset.relPath || '';
        const state = excelSelectionState[mode];
        if (!state) {
            return;
        }

        if (checkbox.checked) {
            state.selectedRelPaths.add(relPath);
        } else {
            state.selectedRelPaths.delete(relPath);
        }
        updateExcelSelectionSummary(mode);
    }

    function previewExcelFilesByMode(mode, dirPath) {
        if (!dirPath) {
            throw new Error(CN.needDir);
        }
        setExcelSelectionLoading(mode);
        return api.listExcelFiles(dirPath).then(res => {
            if (!res.success) {
                throw new Error(res.error || CN.loadFailed);
            }
            applyExcelPreview(mode, dirPath, res);
            showToast(`${CN.previewDone}\uff0c\u5171 ${res.count || 0} \u4e2aExcel\u6587\u4ef6`, false);
            return res;
        }).catch(err => {
            clearExcelSelection(mode, false);
            const dom = getExcelSelectionDom(mode);
            if (dom.list) {
                dom.list.innerHTML = renderTablePlaceholder(`${CN.previewFail}: ${err.message}`, 4);
            }
            if (dom.summary) {
                dom.summary.textContent = CN.loadFailed;
            }
            throw err;
        });
    }

    function selectAllExcelFiles(mode) {
        const state = excelSelectionState[mode];
        if (!state || !state.files.length) {
            return;
        }
        state.selectedRelPaths = new Set(state.files.map(file => file.rel_path).filter(Boolean));
        renderExcelSelectionTable(mode);
    }

    function clearExcelFileSelection(mode) {
        const state = excelSelectionState[mode];
        if (!state) {
            return;
        }
        state.selectedRelPaths = new Set();
        renderExcelSelectionTable(mode);
    }

    function renderExcelPreviewStatus(res) {
        const files = Array.isArray(res?.files) ? res.files : [];
        const rows = files.slice(0, 8).map((f, i) =>
            `<div class="data-process-preview-item">${i + 1}. ${escapeHtml(f.rel_path || '')} (${escapeHtml(String(f.size_mb ?? 0))} MB)</div>`
        ).join('');

        return `
            <div class="data-process-preview-panel">
                <div class="data-process-preview-summary">共 ${files.length} 个 Excel 文件，总计 ${escapeHtml(String(res?.total_size_mb ?? 0))} MB</div>
                <div class="data-process-preview-list">
                    ${rows || `<div class="data-process-preview-empty">${CN.notFound}</div>`}
                </div>
            </div>
        `;
    }

    function setActiveTab(mode) {
        document.querySelectorAll('.data-process-category-tab').forEach(tab => {
            const active = tab.id === 'dataProcessCategory-' + mode;
            tab.classList.toggle('active', active);
        });
    }

    function renderStatus(mode, percent, message, detail) {
        const el = document.getElementById(statusBoxId(mode));
        if (!el) return;
        const safeMessage = normalizeText(message, CN.processing);
        const safeDetail = normalizeText(detail, '');
        el.innerHTML = `
            <div class="data-process-status-card">
                <div class="data-process-status-card__header">
                    <div class="data-process-status-card__title">${escapeHtml(safeMessage)}</div>
                    <div class="data-process-status-card__percent">${Math.max(0, Math.min(100, percent || 0))}%</div>
                </div>
                <div class="data-process-status-card__detail">${escapeHtml(safeDetail || CN.initing)}</div>
            </div>
        `;
    }

    function resetStatusPanels() {
        ['allinone', 'split', 'csv', 'dedup'].forEach(mode => {
            const el = document.getElementById(statusBoxId(mode));
            if (el) el.innerHTML = `<div class="data-process-status-placeholder">${CN.waiting}</div>`;
        });
    }

    function hideAllResults() {
        ['allinone', 'split', 'csv', 'dedup'].forEach(mode => {
            const result = document.getElementById(mode + 'Result');
            const progress = document.getElementById(mode + 'ProgressContainer');
            if (result) result.style.display = 'none';
            if (progress) progress.style.display = 'none';
        });
        resetStatusPanels();
    }

    function switchMode(mode) {
        currentMode = mode;
        api.stopProgressPolling();
        setActiveTab(mode);
        document.querySelectorAll('.data-process-mode-content').forEach(c => {
            c.classList.toggle('active', c.id === mode + '-mode');
        });
        hideAllResults();
    }

    function showProgress(mode, percent, message, detail) {
        // Requirement: progress is shown in left realtime panel, not under buttons.
        renderStatus(mode, percent, message, detail);
        const progress = document.getElementById(mode + 'ProgressContainer');
        if (progress) progress.style.display = 'none';
    }

    function showToast(msg, isError) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.style.background = isError ? '#dc3545' : '#28a745';
        el.style.display = 'block';
        setTimeout(() => {
            el.style.display = 'none';
        }, 2500);
    }

    function showError(mode, msg) {
        const box = document.getElementById(mode + 'Result');
        const body = document.getElementById(mode + 'ResultContent');
        if (!box || !body) return;
        const safeMsg = normalizeText(msg, '\u8bf7\u67e5\u770b\u540e\u7aef\u65e5\u5fd7');
        body.innerHTML =
            `<div class="result-item"><span class="result-label">${CN.statusLabel}</span><span class="result-value error">${CN.statusFail}</span></div>` +
            `<div class="result-item"><span class="result-label">${CN.errLabel}</span><span class="result-value error">${safeMsg}</span></div>`;
        box.style.display = 'block';
    }

    function showResult(mode, result) {
        const box = document.getElementById(mode + 'Result');
        const body = document.getElementById(mode + 'ResultContent');
        if (!box || !body) return;

        if (mode === 'allinone') {
            body.innerHTML = `
                <div class="result-item"><span class="result-label">${CN.statusLabel}</span><span class="result-value success">${CN.statusOk}</span></div>
                <div class="result-item"><span class="result-label">\u538b\u7f29\u5305\u6570\u91cf:</span><span class="result-value">${result.total_zips || 0}</span></div>
                <div class="result-item"><span class="result-label">Excel\u6587\u4ef6\u603b\u6570:</span><span class="result-value">${result.total_excel_files || 0}</span></div>
                <div class="result-item"><span class="result-label">\u6700\u7ec8\u6709\u6548\u884c\u6570:</span><span class="result-value">${result.final_rows || 0}</span></div>
                <div class="result-action"><a href="${api.getDownloadUrl('allinone', result.output_file)}" class="btn btn-success" download>\u4e0b\u8f7d\u7ed3\u679c\u6587\u4ef6</a></div>
            `;
        } else if (mode === 'split') {
            body.innerHTML = `
                <div class="result-item"><span class="result-label">${CN.statusLabel}</span><span class="result-value success">${CN.statusOk}</span></div>
                <div class="result-item"><span class="result-label">\u62c6\u5206\u6587\u4ef6\u6570:</span><span class="result-value">${result.split_count || 0}</span></div>
                <div class="result-item"><span class="result-label">\u603b\u884c\u6570:</span><span class="result-value">${result.total_rows || 0}</span></div>
                <div class="result-action"><a href="${api.getDownloadUrl('split', result.output_file)}" class="btn btn-success" download>\u4e0b\u8f7d\u62c6\u5206\u7ed3\u679c</a></div>
            `;
        } else if (mode === 'csv') {
            body.innerHTML = `
                <div class="result-item"><span class="result-label">${CN.statusLabel}</span><span class="result-value success">${CN.statusOk}</span></div>
                <div class="result-item"><span class="result-label">\u6210\u529f\u8f6c\u6362:</span><span class="result-value">${result.converted || 0}</span></div>
                <div class="result-item"><span class="result-label">\u5931\u8d25\u6570\u91cf:</span><span class="result-value">${result.failed || 0}</span></div>
                <div class="result-action"><a href="${api.getDownloadUrl('csv', result.output_file)}" class="btn btn-success" download>\u4e0b\u8f7dCSV\u7ed3\u679c</a></div>
            `;
        } else if (mode === 'dedup') {
            body.innerHTML = `
                <div class="result-item"><span class="result-label">${CN.statusLabel}</span><span class="result-value success">${CN.statusOk}</span></div>
                <div class="result-item"><span class="result-label">\u539f\u59cb\u603b\u884c\u6570:</span><span class="result-value">${result.original_rows || 0}</span></div>
                <div class="result-item"><span class="result-label">\u53bb\u91cd\u540e\u603b\u884c\u6570:</span><span class="result-value">${result.dedup_rows || 0}</span></div>
                <div class="result-item"><span class="result-label">\u5220\u9664\u91cd\u590d\u884c:</span><span class="result-value">${result.removed_rows || 0}</span></div>
                <div class="result-action"><a href="${api.getDownloadUrl('dedup', result.output_file)}" class="btn btn-success" download>\u4e0b\u8f7d\u53bb\u91cd\u7ed3\u679c</a></div>
            `;
        }

        box.style.display = 'block';
    }

    function displayFileList(files, totalSizeMB) {
        const section = document.getElementById('selectedFilesSection');
        const list = document.getElementById('selectedFilesList');
        if (!section || !list) return;
        if (!files || files.length === 0) {
            list.innerHTML = renderTablePlaceholder('\u76ee\u5f55\u4e2d\u672a\u627e\u5230ZIP\u6587\u4ef6', 3);
            section.style.display = 'block';
            return;
        }
        let html = '';
        files.forEach((f, i) => {
            html += `
                <tr>
                    <td class="file-list-table__cell--index">${i + 1}</td>
                    <td>${escapeHtml(f.name || '')}</td>
                    <td class="file-list-table__cell--size">${escapeHtml(String(f.size_mb ?? 0))} MB</td>
                </tr>
            `;
        });
        html += `
            <tr class="file-list-table__summary">
                <td colspan="2">\u603b\u8ba1</td>
                <td class="file-list-table__cell--size">${files.length} \u4e2a / ${escapeHtml(String(totalSizeMB ?? 0))} MB</td>
            </tr>
        `;
        list.innerHTML = html;
        section.style.display = 'block';
    }

    function previewFileList() {
        const input = document.getElementById('allinoneDirPath');
        const dirPath = (input?.value || '').trim();
        if (!dirPath) {
            alert(CN.needZipDir);
            input?.focus();
            return;
        }
        const list = document.getElementById('selectedFilesList');
        const section = document.getElementById('selectedFilesSection');
        if (list && section) {
            list.innerHTML = renderTablePlaceholder(CN.loading, 3);
            section.style.display = 'block';
        }
        fetch(`${api.baseURL}/data-process/list-files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dirPath })
        })
            .then(r => r.json())
            .then(res => {
                if (!res.success) throw new Error(res.error || CN.loadFailed);
                displayFileList(res.files, res.total_size_mb || 0);
            })
            .catch(e => showToast(`${CN.previewFail}: ${e.message}`, true));
    }

    function processAllInOne() {
        const dirPath = (document.getElementById('allinoneDirPath')?.value || '').trim();
        const targetColumn = document.getElementById('allinoneTargetColumn')?.value || '7';
        const outputName = document.getElementById('allinoneOutputName')?.value || '\u5408\u5e76\u7ed3\u679c\u8868';
        if (!dirPath) return alert(CN.needDir);

        localStorage.setItem(STORAGE_KEYS.allinoneDirPath, dirPath);

        const startBtn = document.getElementById('allinoneStartBtn');
        const exportBtn = document.getElementById('exportLogBtn');
        if (startBtn) startBtn.disabled = true;
        if (exportBtn) exportBtn.disabled = true;

        showProgress('allinone', 0, CN.processing, CN.initing);
        api.processAllInOneByDir(
            { dirPath, targetColumn, outputName },
            (p, m, d) => showProgress('allinone', p, m, d),
            (result) => {
                showProgress('allinone', 100, CN.done, CN.downloadable);
                showResult('allinone', result);
                if (exportBtn) exportBtn.disabled = false;
            }
        ).catch(err => {
            showError('allinone', err.message);
        }).finally(() => {
            if (startBtn) startBtn.disabled = false;
        });
    }

    function exportLog(buttonEl) {
        const btn = buttonEl || document.getElementById('exportLogBtn');
        if (!btn) return;
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '\u751f\u6210\u4e2d...';
        fetch(`${api.baseURL}/data-process/export-log?mode=${encodeURIComponent(currentMode)}`)
            .then(r => r.json())
            .then(res => {
                if (!res.success) throw new Error(res.error || CN.logFail);
                const url = res.download_url || `${api.baseURL}/data-process/download/allinone/${res.filename}`;
                window.open(url, '_blank');
                showToast(CN.logDone, false);
            })
            .catch(err => showToast(`${CN.logFail}: ${err.message}`, true))
            .finally(() => {
                btn.disabled = false;
                btn.textContent = oldText;
            });
    }

    function clearDirPath() {
        const el = document.getElementById('allinoneDirPath');
        if (el) el.value = '';
        localStorage.removeItem(STORAGE_KEYS.allinoneDirPath);
    }

    function saveCsvDirPathToLocalStorage(v) {
        if (v && v.trim()) localStorage.setItem(STORAGE_KEYS.csvDirPath, v.trim());
    }

    function saveSplitDirPathToLocalStorage(v) {
        if (v && v.trim()) localStorage.setItem(STORAGE_KEYS.splitDirPath, v.trim());
    }

    function saveDedupDirPathToLocalStorage(v) {
        if (v && v.trim()) localStorage.setItem(STORAGE_KEYS.dedupDirPath, v.trim());
    }

    function clearSplitDirPath() {
        const el = document.getElementById('splitDirPath');
        if (el) el.value = '';
        localStorage.removeItem(STORAGE_KEYS.splitDirPath);
        clearExcelSelection('split');
    }

    function previewSplitFileList() {
        const dirPath = (document.getElementById('splitDirPath')?.value || '').trim();
        previewExcelFilesByMode('split', dirPath).catch(err => showToast(err.message, true));
    }

    function processSplit() {
        const dirPath = (document.getElementById('splitDirPath')?.value || '').trim();
        const splitCount = parseInt(document.getElementById('splitCount')?.value || '0', 10);
        const headerRow = parseInt(document.getElementById('splitHeaderRow')?.value || '1', 10);
        const outputName = (document.getElementById('splitOutputName')?.value || '').trim();
        const selectedFiles = getSelectedExcelFiles('split');
        if (!dirPath) return alert(CN.needDir);
        if (!splitCount || splitCount < 2) return alert(CN.splitNeed2);
        if (excelSelectionState.split.loaded && excelSelectionState.split.files.length === 0) return alert(CN.noExcelFound);
        if (excelSelectionState.split.loaded && selectedFiles.length === 0) return alert(CN.needSelectExcel);

        saveSplitDirPathToLocalStorage(dirPath);
        const startBtn = document.getElementById('splitStartBtn');
        if (startBtn) startBtn.disabled = true;

        const requestData = { dirPath, splitCount, headerRow, outputName };
        if (excelSelectionState.split.loaded) {
            requestData.selectedFiles = selectedFiles;
        }

        showProgress('split', 0, CN.processing, CN.initing);
        api.splitExcel(
            requestData,
            (p, m, d) => showProgress('split', p, m, d),
            (result) => {
                showProgress('split', 100, CN.done, CN.downloadable);
                showResult('split', result);
            }
        ).catch(err => {
            showError('split', err.message);
        }).finally(() => {
            if (startBtn) startBtn.disabled = false;
        });
    }

    function clearCsvDirPath() {
        const el = document.getElementById('csvDirPath');
        if (el) el.value = '';
        localStorage.removeItem(STORAGE_KEYS.csvDirPath);
        clearExcelSelection('csv');
    }

    function previewCsvFileList() {
        const dirPath = (document.getElementById('csvDirPath')?.value || '').trim();
        previewExcelFilesByMode('csv', dirPath).catch(err => showToast(err.message, true));
    }

    function processCsvConvert() {
        const dirPath = (document.getElementById('csvDirPath')?.value || '').trim();
        const selectedFiles = getSelectedExcelFiles('csv');
        if (!dirPath) return alert(CN.needDir);
        if (excelSelectionState.csv.loaded && excelSelectionState.csv.files.length === 0) return alert(CN.noExcelFound);
        if (excelSelectionState.csv.loaded && selectedFiles.length === 0) return alert(CN.needSelectExcel);
        saveCsvDirPathToLocalStorage(dirPath);

        const startBtn = document.getElementById('csvStartBtn');
        if (startBtn) startBtn.disabled = true;
        const requestData = { dirPath };
        if (excelSelectionState.csv.loaded) {
            requestData.selectedFiles = selectedFiles;
        }
        showProgress('csv', 0, CN.processing, CN.initing);
        api.convertToCsv(
            requestData,
            (p, m, d) => showProgress('csv', p, m, d),
            (result) => {
                showProgress('csv', 100, CN.done, CN.downloadable);
                showResult('csv', result);
            }
        ).catch(err => {
            showError('csv', err.message);
        }).finally(() => {
            if (startBtn) startBtn.disabled = false;
        });
    }

    function clearDedupDirPath() {
        const el = document.getElementById('dedupDirPath');
        if (el) el.value = '';
        localStorage.removeItem(STORAGE_KEYS.dedupDirPath);
        clearExcelSelection('dedup');
    }

    function previewDedupFileList() {
        const dirPath = (document.getElementById('dedupDirPath')?.value || '').trim();
        previewExcelFilesByMode('dedup', dirPath).catch(err => showToast(err.message, true));
    }

    function processDeduplicate() {
        const dirPath = (document.getElementById('dedupDirPath')?.value || '').trim();
        const outputName = (document.getElementById('dedupOutputName')?.value || '').trim();
        const selectedFiles = getSelectedExcelFiles('dedup');
        if (!dirPath) return alert(CN.needDir);
        if (excelSelectionState.dedup.loaded && excelSelectionState.dedup.files.length === 0) return alert(CN.noExcelFound);
        if (excelSelectionState.dedup.loaded && selectedFiles.length === 0) return alert(CN.needSelectExcel);
        saveDedupDirPathToLocalStorage(dirPath);

        const startBtn = document.getElementById('dedupStartBtn');
        if (startBtn) startBtn.disabled = true;
        const requestData = { dirPath, outputName };
        if (excelSelectionState.dedup.loaded) {
            requestData.selectedFiles = selectedFiles;
        }
        showProgress('dedup', 0, CN.processing, CN.initing);
        api.deduplicateData(
            requestData,
            (p, m, d) => showProgress('dedup', p, m, d),
            (result) => {
                showProgress('dedup', 100, CN.done, CN.downloadable);
                showResult('dedup', result);
            }
        ).catch(err => {
            showError('dedup', err.message);
        }).finally(() => {
            if (startBtn) startBtn.disabled = false;
        });
    }

    function init() {
        setActiveTab(currentMode);
        const allPath = localStorage.getItem(STORAGE_KEYS.allinoneDirPath);
        const splitPath = localStorage.getItem(STORAGE_KEYS.splitDirPath);
        const csvPath = localStorage.getItem(STORAGE_KEYS.csvDirPath);
        const dedupPath = localStorage.getItem(STORAGE_KEYS.dedupDirPath);
        if (allPath && document.getElementById('allinoneDirPath')) document.getElementById('allinoneDirPath').value = allPath;
        if (splitPath && document.getElementById('splitDirPath')) document.getElementById('splitDirPath').value = splitPath;
        if (csvPath && document.getElementById('csvDirPath')) document.getElementById('csvDirPath').value = csvPath;
        if (dedupPath && document.getElementById('dedupDirPath')) document.getElementById('dedupDirPath').value = dedupPath;

        const allInput = document.getElementById('allinoneDirPath');
        const splitInput = document.getElementById('splitDirPath');
        const csvInput = document.getElementById('csvDirPath');
        const dedupInput = document.getElementById('dedupDirPath');
        if (allInput) allInput.addEventListener('input', e => localStorage.setItem(STORAGE_KEYS.allinoneDirPath, e.target.value || ''));
        if (splitInput) splitInput.addEventListener('input', e => {
            saveSplitDirPathToLocalStorage(e.target.value || '');
            clearExcelSelection('split');
        });
        if (csvInput) csvInput.addEventListener('input', e => {
            saveCsvDirPathToLocalStorage(e.target.value || '');
            clearExcelSelection('csv');
        });
        if (dedupInput) dedupInput.addEventListener('input', e => {
            saveDedupDirPathToLocalStorage(e.target.value || '');
            clearExcelSelection('dedup');
        });

        document.addEventListener('change', handleExcelSelectionChange);

        hideAllResults();
    }

    window.DataProcessPage = {
        init: init,
        switchMode: switchMode,
        processAllInOne: processAllInOne,
        exportLog: exportLog,
        previewFileList: previewFileList,
        displayFileList: displayFileList,
        clearDirPath: clearDirPath,
        clearSplitDirPath: clearSplitDirPath,
        previewSplitFileList: previewSplitFileList,
        selectAllExcelFiles: selectAllExcelFiles,
        clearExcelFileSelection: clearExcelFileSelection,
        processSplit: processSplit,
        clearCsvDirPath: clearCsvDirPath,
        previewCsvFileList: previewCsvFileList,
        processCsvConvert: processCsvConvert,
        clearDedupDirPath: clearDedupDirPath,
        previewDedupFileList: previewDedupFileList,
        processDeduplicate: processDeduplicate
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
