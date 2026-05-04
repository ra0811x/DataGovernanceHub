/**
 * 模式管理 UI 控制器
 * 处理模式设置相关的 UI 逻辑
 */

(function(window) {
    'use strict';

    /**
     * ModeUIController 构造函数
     * @param {ModesApi} modesApi - 模式 API
     * @param {ModesRepository} modesRepo - 模式仓库
     * @param {EventBus} eventBus - 事件总线
     */
    function ModeUIController(modesApi, modesRepo, eventBus) {
        this.modesApi = modesApi;
        this.modesRepo = modesRepo;
        this.eventBus = eventBus || window.EventBus;
        this.currentModePageType = '';
    }

    /**
     * 显示模式设置弹窗
     * @param {string} pageType - 页面类型 (device/merge)
     */
    ModeUIController.prototype.showSettingsModal = function(pageType) {
        this.currentModePageType = pageType;
        const modal = document.getElementById('modeSettingsModal');
        if (modal) {
            modal.classList.add('show');
        }
        this.loadModes(pageType);
    };

    /**
     * 关闭模式设置弹窗
     */
    ModeUIController.prototype.closeSettingsModal = function() {
        const modal = document.getElementById('modeSettingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentModePageType = '';
    };

    /**
     * 加载模式列表
     * @param {string} pageType - 页面类型
     */
    ModeUIController.prototype.loadModes = function(pageType) {
        return this.modesApi.list(pageType).then(modes => {
            this.renderModeList(modes);
            return modes;
        }).catch(error => {
            console.error('加载模式列表失败:', error);
            const container = document.getElementById('modeListContainer');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载失败</div>';
            }
            throw error;
        });
    };

    /**
     * 渲染模式列表
     * @param {Array} modes - 模式列表
     */
    ModeUIController.prototype.renderModeList = function(modes) {
        const container = document.getElementById('modeListContainer');
        if (!container) return;

        if (modes.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无模式</div>';
            return;
        }

        const currentCat = this.getCurrentCategory();
        const allConfigs = window.allConfigs || {};

        container.innerHTML = '<div class="file-list">' + modes.map(mode => {
            const isDefault = mode.is_default;
            const isActive = mode.mode_key === currentCat;

            const modeKey = mode.mode_key || '全部';
            const modeConfig = allConfigs[modeKey] || {};
            const modeColumns = modeConfig.columns || [];

            const visibleCount = modeColumns.filter(c => c.visible).length;
            const hiddenCount = modeColumns.length - visibleCount;

            let columnsInfo = '';
            if (modeColumns.length > 0) {
                const visibleCols = modeColumns.filter(c => c.visible).map(c => c.name).slice(0, 3);
                columnsInfo = `<div class="file-meta">显示 ${visibleCount} 列: ${visibleCols.join(', ')}`;
                if (hiddenCount > 0) {
                    columnsInfo += ` | 隐藏 ${hiddenCount} 列`;
                }
                columnsInfo += `</div>`;
            }

            return `
                <div class="file-item${isActive ? ' active' : ''}">
                    <div class="file-item-main">
                        <div class="file-name">
                            <span style="display: inline-block; width: 16px; height: 16px; background: ${mode.mode_color}; border-radius: 3px; margin-right: 8px; vertical-align: middle;"></span>
                            ${mode.mode_name}
                            ${isActive ? '<span style="font-size: 11px; color: #28a745; margin-left: 8px;">(当前)</span>' : ''}
                            ${isDefault ? '<span style="font-size: 11px; color: #999; margin-left: 8px;">(默认)</span>' : ''}
                        </div>
                        <div class="file-notes">标识: ${modeKey}</div>
                        ${columnsInfo}
                        ${mode.notes ? `<div class="file-meta">备注: ${mode.notes}</div>` : ''}
                    </div>
                    <div class="file-actions">
                        ${!isActive ? `<button class="btn btn-sm btn-success" data-action="apply" data-mode="${mode.mode_key}">应用</button>` : '<span class="btn-sm" style="color: #28a745;">已应用</span>'}
                        <button class="btn btn-sm" data-action="edit" data-id="${mode.id}">编辑</button>
                        ${!isDefault ? `<button class="btn btn-sm btn-danger" data-action="delete" data-id="${mode.id}">删除</button>` : ''}
                    </div>
                </div>
            `;
        }).join('') + '</div>';

        // 绑定事件
        this._bindModeListEvents();
    };

    /**
     * 绑定模式列表事件
     */
    ModeUIController.prototype._bindModeListEvents = function() {
        const container = document.getElementById('modeListContainer');
        if (!container) return;

        container.querySelectorAll('[data-action="apply"]').forEach(btn => {
            btn.onclick = () => {
                const modeKey = btn.dataset.mode;
                this.applyMode(modeKey);
            };
        });

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => {
                const modeId = parseInt(btn.dataset.id);
                this.showEditForm(modeId);
            };
        });

        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                const modeId = parseInt(btn.dataset.id);
                this.deleteMode(modeId);
            };
        });
    };

    /**
     * 应用模式
     * @param {string} modeKey - 模式键值
     */
    ModeUIController.prototype.applyMode = function(modeKey) {
        this.eventBus.emit('mode:changed', {
            modeKey: modeKey,
            pageType: this.currentModePageType
        });

        if (this.currentModePageType === 'device') {
            if (window.setCategory) {
                window.setCategory(modeKey);
            }
        } else {
            if (window.setCategory2) {
                window.setCategory2(modeKey);
            }
        }

        this.loadModes(this.currentModePageType);
    };

    /**
     * 获取当前分类
     * @returns {string} 当前分类
     */
    ModeUIController.prototype.getCurrentCategory = function() {
        if (this.currentModePageType === 'device') {
            return window.currentCategory || '';
        }
        return window.currentCategory2 || '';
    };

    /**
     * 显示编辑表单
     * @param {number} modeId - 模式 ID
     */
    ModeUIController.prototype.showEditForm = function(modeId) {
        // 使用现有的 ModeModals 模块
        if (window.ModeModals) {
            window.ModeModals.showEditForm(modeId);
        }
    };

    /**
     * 删除模式
     * @param {number} modeId - 模式 ID
     */
    ModeUIController.prototype.deleteMode = function(modeId) {
        if (!confirm('确定要删除此模式吗？')) return;

        this.modesApi.delete(modeId).then(() => {
            this.showToast('模式已删除', false);
            this.loadModes(this.currentModePageType);
            this.refreshCategories();
        }).catch(error => {
            this.showToast('删除失败: ' + error.message, true);
        });
    };

    /**
     * 刷新分类
     */
    ModeUIController.prototype.refreshCategories = function() {
        this.modesApi.list('device').then(modes => {
            window.categories = (modes || []).map(m => ({
                name: m.mode_name,
                value: m.mode_key,
                color: m.mode_color
            }));

            if (window.renderTabs) {
                window.renderTabs();
            }
        });
    };

    /**
     * 显示提示
     */
    ModeUIController.prototype.showToast = function(message, isError) {
        if (window.showToast) {
            window.showToast(message, isError);
        }
    };

    // ==================== 导出模块 API ====================

    window.ModeUIController = ModeUIController;

})(window);
