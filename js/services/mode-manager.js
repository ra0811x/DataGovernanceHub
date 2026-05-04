/**
 * 模式管理服务模块
 * 负责数据概览和合并结果页面的模式切换、配置管理等功能
 * 从 index.html (919行起) 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        allModes: { device: [], merge: [] },
        currentModePageType: '',
        editingModeId: null,
        categories: [],
        categories2: []
    };

    // ==================== 模式管理 API ====================

    /**
     * 显示模式设置弹窗
     * @param {string} pageType - 页面类型 (device/merge)
     */
    async function showSettingsModal(pageType) {
        state.currentModePageType = pageType;
        const modal = document.getElementById('modeSettingsModal');
        if (modal) {
            modal.classList.add('show');
        }
        await loadModes(pageType);
    }

    /**
     * 关闭模式设置弹窗
     */
    function closeSettingsModal() {
        const modal = document.getElementById('modeSettingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
        state.currentModePageType = '';
    }

    /**
     * 加载模式列表
     * @param {string} pageType - 页面类型
     */
    async function loadModes(pageType) {
        try {
            const res = await fetch(API_BASE + '/modes/' + pageType);
            const result = await res.json();
            state.allModes[pageType] = result.modes || [];
            renderModeList(state.allModes[pageType]);
        } catch (e) {
            console.error('加载模式列表失败:', e);
            const container = document.getElementById('modeListContainer');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载失败</div>';
            }
        }
    }

    /**
     * 渲染模式列表
     * @param {Array} modes - 模式数组
     */
    function renderModeList(modes) {
        const container = document.getElementById('modeListContainer');
        if (!container) return;

        if (modes.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无模式</div>';
            return;
        }

        // 获取当前激活的模式和列配置
        const currentCat = getCurrentCategory();
        const currentCols = getCurrentColumns();

        container.innerHTML = '<div class="file-list">' + modes.map(mode => {
            const isDefault = mode.is_default;
            const isActive = mode.mode_key === currentCat;

            // 获取该模式的列配置
            const modeKey = mode.mode_key || '全部';
            let modeColumns = [];

            // 从全局配置获取
            if (window.allConfigs && window.allConfigs[modeKey]) {
                modeColumns = window.allConfigs[modeKey].columns || [];
            }

            // 统计显示/隐藏的列
            const visibleCount = modeColumns.filter(c => c.visible).length;
            const hiddenCount = modeColumns.length - visibleCount;

            // 构建列配置显示
            let columnsInfo = '';
            if (modeColumns.length > 0) {
                const visibleCols = modeColumns.filter(c => c.visible).map(c => c.name).slice(0, 3);
                const hiddenCols = modeColumns.filter(c => !c.visible).map(c => c.name);
                columnsInfo = '<div class="file-meta">';
                columnsInfo += `显示 ${visibleCount} 列: ${visibleCols.join(', ')}`;
                if (hiddenCols.length > 0) {
                    columnsInfo += ` | 隐藏 ${hiddenCount} 列`;
                }
                columnsInfo += '</div>';
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
                        <div class="file-notes">标识: ${mode.mode_key || '全部'}</div>
                        ${columnsInfo}
                        ${mode.notes ? `<div class="file-meta">备注: ${mode.notes}</div>` : ''}
                    </div>
                    <div class="file-actions">
                        ${!isActive ? `<button class="btn btn-sm btn-success" onclick="ModeManager.apply('${mode.mode_key}')">应用</button>` : '<span class="btn-sm" style="color: #28a745;">已应用</span>'}
                        <button class="btn btn-sm" onclick="ModeManager.showForm(${mode.id})">编辑</button>
                        ${!isDefault ? `<button class="btn btn-sm btn-danger" onclick="ModeManager.deleteMode(${mode.id})">删除</button>` : ''}
                    </div>
                </div>
            `;
        }).join('') + '</div>';
    }

    /**
     * 获取当前模式类别
     * @returns {string}
     */
    function getCurrentCategory() {
        if (state.currentModePageType === 'device') {
            return window.currentCategory || '';
        } else {
            return window.currentCategory2 || '';
        }
    }

    /**
     * 获取当前列配置
     * @returns {Array}
     */
    function getCurrentColumns() {
        if (state.currentModePageType === 'device') {
            return window.columns || [];
        } else {
            return window.columns2 || [];
        }
    }

    /**
     * 应用模式切换
     * @param {string} modeKey - 模式标识
     */
    function apply(modeKey) {
        if (state.currentModePageType === 'device') {
            if (typeof window.setCategory === 'function') {
                window.setCategory(modeKey);
            }
        } else {
            if (typeof window.setCategory2 === 'function') {
                window.setCategory2(modeKey);
            }
        }
        // 刷新模式列表以更新当前状态
        loadModes(state.currentModePageType);
    }

    /**
     * 显示添加/编辑模式表单
     * @param {number|null} modeId - 模式ID（null表示新增）
     */
    async function showForm(modeId = null) {
        state.editingModeId = modeId;
        const title = document.getElementById('modeEditTitle');
        const form = document.getElementById('modeEditForm');

        if (!title || !form) return;

        if (modeId) {
            // 编辑模式
            const mode = state.allModes[state.currentModePageType].find(m => m.id === modeId);
            if (!mode) return;

            title.textContent = '编辑模式';
            document.getElementById('editModeId').value = mode.id;
            document.getElementById('editModeKey').value = mode.mode_key || '';
            document.getElementById('editModeName').value = mode.mode_name;
            document.getElementById('editModeColor').value = mode.mode_color;
            document.getElementById('editModeNotes').value = mode.notes || '';

            // 默认模式不允许修改key
            const keyInput = document.getElementById('editModeKey');
            if (keyInput) {
                keyInput.disabled = mode.is_default;
            }
        } else {
            // 新增模式
            title.textContent = '添加新模式';
            form.reset();
            document.getElementById('editModeId').value = '';
            document.getElementById('editModeColor').value = '#495057';

            const keyInput = document.getElementById('editModeKey');
            if (keyInput) {
                keyInput.disabled = false;
            }
        }

        // 显示当前模式隐藏的列
        updateHiddenColumnsDisplay(modeId);

        const editModal = document.getElementById('modeEditModal');
        if (editModal) {
            editModal.classList.add('show');
        }
    }

    /**
     * 关闭编辑弹窗
     */
    function closeFormModal() {
        const modal = document.getElementById('modeEditModal');
        if (modal) {
            modal.classList.remove('show');
        }
        state.editingModeId = null;
    }

    /**
     * 更新隐藏列显示
     * @param {number|null} modeId - 模式ID
     */
    function updateHiddenColumnsDisplay(modeId) {
        const hiddenGroup = document.getElementById('hiddenColumnsGroup');
        const hiddenList = document.getElementById('hiddenColumnsList');

        if (!hiddenGroup || !hiddenList) return;

        if (!modeId) {
            // 新增模式时，默认不显示隐藏列信息
            hiddenGroup.style.display = 'none';
            return;
        }

        try {
            // 获取当前正在编辑的模式
            const mode = state.allModes[state.currentModePageType].find(m => m.id === modeId);
            if (!mode) {
                hiddenGroup.style.display = 'none';
                return;
            }

            // 获取当前页面的列配置
            const currentColumns = getCurrentColumns();
            if (!currentColumns || currentColumns.length === 0) {
                hiddenGroup.style.display = 'none';
                return;
            }

            // 获取该模式的列配置
            const modeKey = mode.mode_key || '';
            const allConfigs = window.allConfigs || {};
            const modeConfig = allConfigs[modeKey] || allConfigs['全部'] || {};
            const modeColumns = modeConfig.columns || [];

            // 找出被隐藏的列
            const hiddenColumns = [];

            currentColumns.forEach(col => {
                // 在该模式的列配置中查找对应的列
                const modeCol = modeColumns.find(mc => mc.name === col.name);

                // 如果找不到该列，或者该列的visible为false，则认为被隐藏
                if (!modeCol || modeCol.visible === false) {
                    hiddenColumns.push(col.name);
                }
            });

            // 显示隐藏列信息
            if (hiddenColumns.length > 0) {
                hiddenList.innerHTML = hiddenColumns.map(name =>
                    `<div style="padding: 2px 0;">• ${name}</div>`
                ).join('');
                hiddenGroup.style.display = 'block';
            } else {
                hiddenList.innerHTML = '<div style="color: #28a745;">✓ 当前模式显示所有列</div>';
                hiddenGroup.style.display = 'block';
            }

        } catch (error) {
            console.error('更新隐藏列显示失败:', error);
            hiddenGroup.style.display = 'none';
        }
    }

    /**
     * 保存模式
     */
    async function save() {
        const modeId = document.getElementById('editModeId').value;
        const modeKey = document.getElementById('editModeKey').value.trim();
        const modeName = document.getElementById('editModeName').value.trim();
        const modeColor = document.getElementById('editModeColor').value;
        const notes = document.getElementById('editModeNotes').value.trim();

        if (!modeName) {
            showToast('请输入模式名称', true);
            return;
        }

        try {
            const data = {
                page_type: state.currentModePageType,
                mode_key: modeKey,
                mode_name: modeName,
                mode_color: modeColor,
                notes: notes
            };

            let res;
            if (modeId) {
                // 更新模式
                res = await fetch(API_BASE + '/modes/' + modeId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                // 创建模式
                res = await fetch(API_BASE + '/modes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }

            const result = await res.json();

            if (result.success) {
                showToast(modeId ? '模式已更新' : '模式已创建', true);
                closeFormModal();
                await loadModes(state.currentModePageType);
                await refreshCategories();
            } else {
                showToast(result.error || '操作失败', true);
            }
        } catch (e) {
            showToast('操作失败: ' + e.message, true);
        }
    }

    /**
     * 删除模式
     * @param {number} modeId - 模式ID
     */
    async function deleteMode(modeId) {
        if (!confirm('确定要删除此模式吗？')) return;

        try {
            const res = await fetch(API_BASE + '/modes/' + modeId, { method: 'DELETE' });
            const result = await res.json();

            if (result.success) {
                showToast('模式已删除', true);
                await loadModes(state.currentModePageType);
                await refreshCategories();
            } else {
                showToast(result.error || '删除失败', true);
            }
        } catch (e) {
            showToast('删除失败: ' + e.message, true);
        }
    }

    /**
     * 刷新模式标签
     */
    async function refreshCategories() {
        // 加载设备管理页面的模式
        try {
            const res1 = await fetch(API_BASE + '/modes/device');
            const result1 = await res1.json();
            state.categories = (result1.modes || []).map(m => ({
                name: m.mode_name,
                value: m.mode_key,
                color: m.mode_color
            }));

            // 更新全局变量
            if (window.categories !== undefined) {
                window.categories = state.categories;
            }

            // 确保当前模式在列表中
            const currentCategory = window.currentCategory || '';
            if (!state.categories.find(c => c.value === currentCategory)) {
                window.currentCategory = state.categories[0]?.value || '';
            }

            if (typeof window.renderTabs === 'function') {
                window.renderTabs();
            }
        } catch (e) {
            console.error('刷新设备管理模式失败:', e);
        }

        // 加载合并结果页面的模式
        try {
            const res2 = await fetch(API_BASE + '/modes/merge');
            const result2 = await res2.json();
            state.categories2 = (result2.modes || []).map(m => ({
                name: m.mode_name,
                value: m.mode_key,
                color: m.mode_color
            }));

            // 更新全局变量
            if (window.categories2 !== undefined) {
                window.categories2 = state.categories2;
            }

            // 确保当前模式在列表中
            const currentCategory2 = window.currentCategory2 || '';
            if (!state.categories2.find(c => c.value === currentCategory2)) {
                window.currentCategory2 = state.categories2[0]?.value || '';
            }

            if (typeof window.renderTabs2 === 'function') {
                window.renderTabs2();
            }
        } catch (e) {
            console.error('刷新合并结果模式失败:', e);
        }
    }

    // ==================== 导出模块 API ====================

    window.ModeManager = {
        // 状态
        state: state,

        // 模式管理
        showSettingsModal: showSettingsModal,
        closeSettingsModal: closeSettingsModal,
        loadModes: loadModes,
        renderModeList: renderModeList,
        apply: apply,

        // 模式编辑
        showForm: showForm,
        closeFormModal: closeFormModal,
        save: save,
        deleteMode: deleteMode,

        // 工具方法
        refreshCategories: refreshCategories,
        updateHiddenColumnsDisplay: updateHiddenColumnsDisplay
    };

    // 兼容旧的全局函数调用
    window.showModeSettingsModal = showSettingsModal;
    window.closeModeSettingsModal = closeSettingsModal;
    window.loadModes = loadModes;
    window.renderModeList = renderModeList;
    window.applyMode = apply;
    window.showModeForm = showForm;
    window.closeModeEditModal = closeFormModal;
    window.saveMode = save;
    window.deleteMode = deleteMode;
    window.refreshCategories = refreshCategories;

})(window);
