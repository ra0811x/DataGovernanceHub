/**
 * 导入模式选择模态框
 * 处理 Excel 文件导入、进度显示、预览摘要等功能
 * 从 index.html (2316行起) 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        pendingFile: null,
        pendingData: null,
        pendingPageType: null,
        progressInterval: null
    };

    // ==================== 工具函数 ====================

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string}
     */
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    // ==================== 导入对话框控制 ====================

    /**
     * 显示导入对话框
     * @param {File} file - 要导入的文件
     * @param {string} pageType - 页面类型 (device/merge)
     */
    function showDialog(file, pageType) {
        state.pendingFile = file;
        state.pendingPageType = pageType;

        const modal = document.getElementById('importModeModal');
        const fileInfo = document.getElementById('importFileInfo');
        const statusArea = document.getElementById('importStatusArea');
        const summary = document.getElementById('importPreviewSummary');
        const title = document.getElementById('importModalTitle');
        const actions = document.getElementById('importModalActions');

        if (!modal) return;

        // 显示模态框
        modal.style.display = 'flex';

        // 显示文件信息
        if (fileInfo) {
            fileInfo.style.display = 'block';
            const fileName = document.getElementById('importFileName');
            const fileSize = document.getElementById('importFileSize');
            if (fileName) fileName.textContent = file.name;
            if (fileSize) fileSize.textContent = formatFileSize(file.size);
        }

        // 显示状态：正在导入
        if (statusArea) {
            statusArea.style.display = 'block';
            const statusText = document.getElementById('importStatusText');
            const progressBarWrapper = document.getElementById('importProgressBarWrapper');
            const progressBar = document.getElementById('importProgressBar');
            const progressText = document.getElementById('importProgressText');
            const progressDetail = document.getElementById('importProgressDetail');

            if (statusText) {
                statusText.textContent = '正在导入数据...';
                statusText.style.color = '#667eea';
            }
            if (progressBarWrapper) {
                progressBarWrapper.style.display = 'block';
            }
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.style.animation = 'progress-stripes 1s linear infinite';
            }
            if (progressText) {
                progressText.textContent = '0%';
            }
            if (progressDetail) {
                progressDetail.textContent = '正在准备导入...';
            }
        }

        // 隐藏操作按钮
        if (actions) {
            actions.style.display = 'none';
        }

        // 隐藏预览摘要
        if (summary) {
            summary.innerHTML = '';
        }

        if (title) {
            title.textContent = '正在导入';
        }

        // 开始导入
        startImport(pageType);
    }

    /**
     * 开始导入
     * @param {string} pageType - 页面类型
     */
    async function startImport(pageType) {
        if (!state.pendingFile) {
            showError('没有选择文件');
            return;
        }

        const formData = new FormData();
        formData.append('file', state.pendingFile);
        formData.append('page_type', pageType);

        try {
            const response = await fetch(API_BASE + '/' + pageType + '/import', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showComplete(result);
                // 刷新页面数据
                if (pageType === 'device') {
                    if (typeof loadData === 'function') loadData();
                } else {
                    if (typeof loadMergeData === 'function') loadMergeData();
                }
            } else {
                showError(result.error || '导入失败');
            }
        } catch (e) {
            console.error('导入错误:', e);
            showError(e.message || '导入失败');
        }
    }

    /**
     * 显示导入完成
     * @param {Object} result - 导入结果
     */
    function showComplete(result) {
        const statusArea = document.getElementById('importStatusArea');
        const actions = document.getElementById('importModalActions');
        const title = document.getElementById('importModalTitle');

        if (statusArea) {
            const statusText = document.getElementById('importStatusText');
            const progressBar = document.getElementById('importProgressBar');
            const progressText = document.getElementById('importProgressText');
            const progressDetail = document.getElementById('importProgressDetail');

            if (statusText) {
                statusText.textContent = '导入完成！';
                statusText.style.color = '#28a745';
            }
            if (progressBar) {
                progressBar.style.animation = 'none';
                progressBar.style.width = '100%';
                progressBar.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
            }
            if (progressText) {
                progressText.textContent = '100%';
            }
            if (progressDetail) {
                progressDetail.textContent = `共导入 ${result.total_rows || 0} 条记录`;
            }
        }

        // 显示关闭按钮
        if (actions) {
            actions.style.display = 'flex';
        }
        const cancelBtn = document.getElementById('importCancelButton');
        if (cancelBtn) {
            cancelBtn.textContent = '关闭';
            cancelBtn.style.display = 'block';
            cancelBtn.onclick = closeModal;
        }

        if (title) {
            title.textContent = '导入成功';
        }
    }

    /**
     * 显示导入错误
     * @param {string} error - 错误信息
     */
    function showError(error) {
        const statusArea = document.getElementById('importStatusArea');
        const actions = document.getElementById('importModalActions');
        const title = document.getElementById('importModalTitle');

        if (statusArea) {
            const statusText = document.getElementById('importStatusText');
            const progressBar = document.getElementById('importProgressBar');
            const progressText = document.getElementById('importProgressText');
            const progressDetail = document.getElementById('importProgressDetail');

            if (statusText) {
                statusText.textContent = '导入失败';
                statusText.style.color = '#dc3545';
            }
            if (progressBar) {
                progressBar.style.background = '#dc3545';
                progressBar.style.animation = 'none';
            }
            if (progressText) {
                progressText.textContent = '失败';
            }
            if (progressDetail) {
                progressDetail.textContent = error || '未知错误';
            }
        }

        // 显示关闭按钮
        if (actions) {
            actions.style.display = 'flex';
        }
        const cancelBtn = document.getElementById('importCancelButton');
        if (cancelBtn) {
            cancelBtn.textContent = '关闭';
            cancelBtn.style.display = 'block';
            cancelBtn.onclick = closeModal;
        }

        if (title) {
            title.textContent = '导入失败';
        }
    }

    /**
     * 关闭导入模态框
     */
    function closeModal() {
        const modal = document.getElementById('importModeModal');
        if (modal) {
            modal.style.display = 'none';
        }

        // 重置状态
        state.pendingFile = null;
        state.pendingData = null;
        state.pendingPageType = null;

        // 清除进度轮询
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }

        // 重置UI
        const progressBar = document.getElementById('importProgressBar');
        const progressText = document.getElementById('importProgressText');
        const progressDetail = document.getElementById('importProgressDetail');
        const statusText = document.getElementById('importStatusText');
        const cancelBtn = document.getElementById('importCancelButton');

        if (progressBar) {
            progressBar.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
            progressBar.style.width = '0%';
        }
        if (progressText) {
            progressText.textContent = '0%';
        }
        if (progressDetail) {
            progressDetail.textContent = '';
        }
        if (statusText) {
            statusText.style.color = '#667eea';
        }
        if (cancelBtn) {
            cancelBtn.textContent = '关闭';
        }
    }

    // ==================== 导出模块 API ====================

    window.ImportModal = {
        // 状态
        state: state,

        // 控制
        showDialog: showDialog,
        closeModal: closeModal,
        showComplete: showComplete,
        showError: showError,
        formatFileSize: formatFileSize
    };

    // 兼容旧的全局函数调用
    window.showImportDialog = showDialog;
    window.closeImportModeModal = closeModal;
    window.showImportComplete = showComplete;
    window.showImportError = showError;

})(window);
