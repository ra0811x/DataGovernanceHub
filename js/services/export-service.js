/**
 * 填报数据导出服务模块
 * 负责填报数据导出功能的实现
 * 从 index.html (7990行起) 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        currentCategory: 'yeji',
        selectedFile: null,
        progressInterval: null
    };

    // ==================== 导出文件配置 ====================
    const exportFilesConfig = {
        yeji: [
            { code: '10001', name: '数据库资产信息表', status: 'completed', records: 484, size: '55KB' },
            { code: '10002', name: '数据资产字段信息表', status: 'completed', records: 330010, size: '40MB' },
            { code: '10003', name: '重要数据分类表', status: 'pending', records: 0, size: '-' },
            { code: '10004', name: '数据脱敏政策表', status: 'pending', records: 1452, size: '-' },
            { code: '10005', name: '数据对外合作表', status: 'pending', records: 0, size: '-' },
            { code: '10006', name: '信息表', status: 'pending', records: 0, size: '-' }
        ],
        smc: [
            { code: '附件三', name: '数据资产清单', status: 'completed', records: 0, size: '-' },
            { code: '附件五', name: '涉敏资产梳理汇总表', status: 'completed', records: 0, size: '-' },
            { code: '附件四-A', name: '客户信息对外接口清单', status: 'completed', records: 0, size: '-' },
            { code: '附件四-B', name: '数管平台对外接口清单', status: 'completed', records: 0, size: '-' }
        ],
        xinan: [
            { code: '00000', name: '数据资产汇总表', status: 'pending', records: 402, size: '-' },
            { code: '10001-001', name: '网管域数据资产表(O域)', status: 'pending', records: 0, size: '-' },
            { code: '10001-002~014', name: '业支域数据资产表(M/B域)', status: 'pending', records: 0, size: '-' }
        ]
    };

    // ==================== 导出API映射 ====================
    const exportApiMapping = {
        '10001': '/export/yeji/i_10600_10001',
        '10002': '/export/yeji/i_10600_10002',
        '10004': '/export/yeji/i_10600_10004',
        '附件三': '/export/smc/attachment_3',
        '附件五': '/export/smc/attachment_5',
        '00000': '/export/xinan/i_10600_00000',
        '10001-001': '/export/xinan/10001'
    };

    // ==================== 公共函数 ====================

    /**
     * 显示导出弹窗
     */
    function showExportModal() {
        // 切换到报表导出tab
        const reportsTab = document.querySelector('.tab-button[onclick*="reports"]');
        if (reportsTab) {
            reportsTab.click();
        }
    }

    /**
     * 关闭导出弹窗
     */
    function closeExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.remove('show');
        }
        state.selectedFile = null;

        const executeBtn = document.getElementById('exportExecuteBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
        }

        const progressInfo = document.getElementById('exportProgressInfo');
        if (progressInfo) {
            progressInfo.textContent = '请选择要导出的报表';
        }

        // 停止进度轮询
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
    }

    /**
     * 切换导出类别
     * @param {string} category - 类别 (yeji/smc/xinan)
     * @param {HTMLElement} element - 点击的元素
     */
    function switchExportCategory(category, element) {
        state.currentCategory = category;
        state.selectedFile = null;

        // 更新标签样式
        document.querySelectorAll('.export-category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        if (element) {
            element.classList.add('active');
        }

        // 渲染文件列表
        renderExportFiles(category);
    }

    /**
     * 渲染导出文件列表
     * @param {string} category - 类别
     */
    function renderExportFiles(category) {
        const files = exportFilesConfig[category] || [];
        const grid = document.getElementById('exportFilesGrid');

        if (!grid) return;

        grid.innerHTML = files.map(file => {
            const isCompleted = file.status === 'completed';
            const cardId = `export-card-${file.code}`;
            const btnId = `export-btn-${file.code}`;

            return `
                <div class="export-file-card ${category} ${isCompleted ? '' : 'disabled'}" id="${cardId}">
                    <div class="export-file-info">
                        <div class="export-file-main">
                            <div class="export-file-code">${file.code}</div>
                            <div class="export-file-name">${file.name}</div>
                        </div>
                        <div class="export-file-meta">
                            <span class="export-file-status ${file.status}">
                                ${isCompleted ? '✓ 已实现' : '⏳ 待开发'}
                            </span>
                            ${file.records > 0 ? `<span>${file.records} 条</span>` : ''}
                            ${file.size !== '-' ? `<span>${file.size}</span>` : ''}
                        </div>
                    </div>
                    <div class="export-file-action">
                        <div class="export-status-icon" id="${btnId}-icon"></div>
                        ${isCompleted ? `
                            <button class="export-card-btn" onclick="ExportService.execute('${file.code}', '${category}', this)" id="${btnId}">
                                导出
                            </button>
                        ` : `
                            <button class="export-card-btn" disabled>
                                待开发
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 执行导出
     * @param {string} fileCode - 文件代码
     * @param {string} category - 类别
     * @param {HTMLElement} button - 点击的按钮
     */
    async function execute(fileCode, category, button) {
        const cardId = `export-card-${fileCode}`;
        const btnId = `export-btn-${fileCode}`;
        const card = document.getElementById(cardId);
        const icon = document.getElementById(`${btnId}-icon`);

        if (!card || !icon) return;

        // 更新按钮状态
        button.disabled = true;
        button.textContent = '导出中...';
        button.classList.add('exporting');
        card.classList.add('exporting');
        icon.textContent = '⏳';

        try {
            // 检查是否支持该报表
            const apiUrl = exportApiMapping[fileCode];
            if (!apiUrl) {
                showToast('该报表暂未实现导出功能', true);
                resetButton(button, card, icon);
                return;
            }

            // 调用导出API
            const response = await fetch(API_BASE + apiUrl);
            const result = await response.json();

            if (result.success) {
                // 导出成功
                button.textContent = '已完成';
                button.classList.remove('exporting');
                button.classList.add('success');
                card.classList.remove('exporting');
                card.classList.add('export-success');
                icon.textContent = '✅';

                showToast(`导出成功! 文件: ${result.filename}，共 ${result.total_rows || 0} 条记录`, false);

                // 3秒后重置按钮
                setTimeout(() => {
                    resetButton(button, card, icon);
                }, 3000);
            } else {
                // 导出失败
                handleExportError(button, card, icon, result.error || '未知错误');
            }
        } catch (e) {
            console.error('导出错误:', e);
            handleExportError(button, card, icon, e.message);
        }
    }

    /**
     * 处理导出错误
     */
    function handleExportError(button, card, icon, errorMessage) {
        button.textContent = '导出失败';
        button.classList.remove('exporting');
        button.classList.add('error');
        card.classList.remove('exporting');
        card.classList.add('export-error');
        icon.textContent = '❌';

        showToast('导出失败: ' + errorMessage, true);

        // 3秒后重置按钮
        setTimeout(() => {
            resetButton(button, card, icon);
        }, 3000);
    }

    /**
     * 重置导出按钮状态
     * @param {HTMLElement} button - 按钮
     * @param {HTMLElement} card - 卡片
     * @param {HTMLElement} icon - 图标
     */
    function resetButton(button, card, icon) {
        button.disabled = false;
        button.textContent = '导出';
        button.classList.remove('exporting', 'success', 'error');
        card.classList.remove('exporting', 'export-success', 'export-error');
        icon.textContent = '';
    }

    /**
     * 获取指定类别的报表配置
     * @param {string} category - 类别
     * @returns {Array}
     */
    function getReportsConfig(category) {
        return exportFilesConfig[category] || [];
    }

    /**
     * 更新报表状态
     * @param {string} category - 类别
     * @param {string} code - 报表代码
     * @param {Object} updates - 更新内容
     */
    function updateReportStatus(category, code, updates) {
        const reports = exportFilesConfig[category];
        if (!reports) return;

        const report = reports.find(r => r.code === code);
        if (report) {
            Object.assign(report, updates);
        }
    }

    // ==================== 导出模块 API ====================

    window.ExportService = {
        // 状态
        state: state,

        // 配置
        exportFilesConfig: exportFilesConfig,

        // 方法
        showExportModal: showExportModal,
        closeExportModal: closeExportModal,
        switchExportCategory: switchExportCategory,
        renderExportFiles: renderExportFiles,
        execute: execute,
        resetButton: resetButton,
        getReportsConfig: getReportsConfig,
        updateReportStatus: updateReportStatus
    };

    // 兼容旧的全局函数调用
    window.showExportModal = showExportModal;
    window.closeExportModal = closeExportModal;
    window.switchExportCategory = switchExportCategory;
    window.renderExportFiles = renderExportFiles;
    window.executeExport = execute;
    window.resetExportButton = resetButton;

})(window);
