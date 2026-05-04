/**
 * 模式设置相关模态框
 * 包含模式设置弹窗和模式编辑弹窗的功能
 * 从 index.html 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模式设置弹窗 ====================

    /**
     * 显示模式设置弹窗
     * @param {string} pageType - 页面类型 (device/merge)
     */
    function showSettingsModal(pageType) {
        // 调用 ModeManager 中的方法
        if (window.ModeManager) {
            ModeManager.showSettingsModal(pageType);
        } else {
            const modal = document.getElementById('modeSettingsModal');
            if (modal) {
                modal.classList.add('show');
            }
        }
    }

    /**
     * 关闭模式设置弹窗
     */
    function closeSettingsModal() {
        const modal = document.getElementById('modeSettingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
        if (window.ModeManager) {
            ModeManager.closeSettingsModal();
        }
    }

    // ==================== 模式编辑弹窗 ====================

    /**
     * 显示模式编辑表单
     * @param {number|null} modeId - 模式ID
     */
    function showEditForm(modeId) {
        // 调用 ModeManager 中的方法
        if (window.ModeManager) {
            ModeManager.showForm(modeId);
        } else {
            const modal = document.getElementById('modeEditModal');
            if (modal) {
                modal.classList.add('show');
            }
        }
    }

    /**
     * 关闭编辑弹窗
     */
    function closeEditForm() {
        const modal = document.getElementById('modeEditModal');
        if (modal) {
            modal.classList.remove('show');
        }
        if (window.ModeManager) {
            ModeManager.closeFormModal();
        }
    }

    /**
     * 保存模式
     */
    async function save() {
        // 调用 ModeManager 中的方法
        if (window.ModeManager) {
            await ModeManager.save();
        }
    }

    // ==================== 隐藏列显示更新 ====================

    /**
     * 更新隐藏列显示
     * @param {number} modeId - 模式ID
     */
    function updateHiddenColumnsDisplay(modeId) {
        // 调用 ModeManager 中的方法
        if (window.ModeManager) {
            ModeManager.updateHiddenColumnsDisplay(modeId);
        }
    }

    // ==================== 导出模块 API ====================

    window.ModeModals = {
        // 模式设置
        showSettingsModal: showSettingsModal,
        closeSettingsModal: closeSettingsModal,

        // 模式编辑
        showEditForm: showEditForm,
        closeEditForm: closeEditForm,
        save: save,

        // 工具方法
        updateHiddenColumnsDisplay: updateHiddenColumnsDisplay
    };

    // 兼容旧的全局函数调用
    window.showModeSettingsModal = showSettingsModal;
    window.closeModeSettingsModal = closeSettingsModal;
    window.showModeForm = showEditForm;
    window.closeModeEditModal = closeEditForm;
    window.saveMode = save;

})(window);
