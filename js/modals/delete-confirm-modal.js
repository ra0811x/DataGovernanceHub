/**
 * 删除确认模态框
 * 用于确认删除表格数据的危险操作
 * 从 index.html 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        pendingDeleteType: null  // 'device' 或 'merge'
    };

    /**
     * 显示删除确认对话框
     * @param {string} dataType - 数据类型 (device/merge)
     */
    function show(dataType) {
        state.pendingDeleteType = dataType;
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * 关闭删除确认对话框
     */
    function close() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.classList.remove('show');
        }
        state.pendingDeleteType = null;
    }

    /**
     * 执行删除操作
     */
    async function execute() {
        // 使用存储的数据类型
        let dataType = state.pendingDeleteType;
        if (!dataType) {
            const currentPage = document.querySelector('.page.active');
            if (currentPage) {
                dataType = currentPage.id === 'page-device' ? 'device' : 'merge';
            }
        }

        if (!dataType) {
            console.warn('DeleteModal: 无法确定数据类型');
            return;
        }

        try {
            const response = await fetch('/api/data/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: dataType
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('删除成功！', false);
                close();

                // 刷新页面数据
                if (dataType === 'device') {
                    if (typeof loadData === 'function') loadData();
                    if (typeof loadStats === 'function') loadStats();
                } else {
                    if (typeof loadMergeData === 'function') loadMergeData();
                    else if (typeof loadTableData2 === 'function') loadTableData2();
                }
            } else {
                showToast('删除失败: ' + (result.error || '未知错误'), true);
            }
        } catch (error) {
            console.error('删除数据错误:', error);
            showToast('删除失败: ' + error.message, true);
        }

        // 清除存储的数据类型
        state.pendingDeleteType = null;
    }

    // ==================== 导出模块 API ====================

    window.DeleteConfirmModal = {
        state: state,
        show: show,
        close: close,
        execute: execute
    };

    // 兼容旧的全局函数调用
    window.showDeleteDataConfirm = show;
    window.closeDeleteConfirmModal = close;
    window.executeDeleteData = execute;

})(window);
