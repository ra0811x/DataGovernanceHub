/**
 * 业务系统名称映射字典管理服务模块
 * 负责合并结果表与数据概览表之间的业务系统名称映射管理
 * 从 index.html (9207行起) 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        mappingsData: null,
        allMappings: [],
        currentMappingId: null
    };

    // ==================== 业务系统映射管理 ====================

    /**
     * 加载业务系统映射列表
     */
    async function loadMappings() {
        try {
            const res = await fetch(API_BASE + '/public-configs/business-system-name-mappings');
            const result = await res.json();

            if (result.success && result.data) {
                state.mappingsData = result.data;
                state.allMappings = result.data.mappings || [];
                renderMappings(state.allMappings);
            }
        } catch (e) {
            console.error('加载业务系统映射失败:', e);
            showToast('加载失败', true);
        }
    }

    /**
     * 渲染业务系统映射列表
     * @param {Array} mappings - 映射数组
     */
    function renderMappings(mappings) {
        const container = document.getElementById('businessSystemMappingsList');
        const countSpan = document.getElementById('businessSystemMappingCount');

        if (!container) return;

        if (!mappings || mappings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;">&#128193;</div>
                    <div>暂无映射规则</div>
                    <div style="font-size: 13px; margin-top: 10px;">点击"新增映射"添加第一条规则</div>
                </div>
            `;
            if (countSpan) countSpan.textContent = '0';
            return;
        }

        if (countSpan) {
            countSpan.textContent = mappings.length;
        }

        container.innerHTML = mappings.map(mapping => `
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1; display: flex; align-items: center; gap: 30px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; background: #e8f4fd; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 20px;">&#10132;</span>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">原名称（合并结果表）</div>
                            <div style="font-size: 14px; color: #333; font-weight: 500;">${escapeHtml(mapping.source)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; background: #e8f5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 20px;">&#10132;</span>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">目标名称（数据概览表）</div>
                            <div style="font-size: 14px; color: #333; font-weight: 500;">${escapeHtml(mapping.target)}</div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="padding: 4px 10px; border-radius: 12px; font-size: 12px; background: ${mapping.enabled ? '#d4edda' : '#f8d7da'}; color: ${mapping.enabled ? '#155724' : '#721c24'};">
                        ${mapping.enabled ? '启用' : '禁用'}
                    </span>
                    <button onclick="BusinessSystemMappingsManager.edit(${mapping.id})" style="padding: 6px 12px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">编辑</button>
                    <button onclick="BusinessSystemMappingsManager.remove(${mapping.id})" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">删除</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 筛选业务系统映射
     */
    function filterMappings() {
        const searchInput = document.getElementById('businessSystemMappingSearch');
        const statusFilter = document.getElementById('businessSystemMappingStatusFilter');

        const searchValue = (searchInput?.value || '').toLowerCase();
        const statusFilterValue = statusFilter?.value || '';

        let filtered = state.allMappings.filter(m => {
            const matchSearch = !searchValue ||
                m.source.toLowerCase().includes(searchValue) ||
                m.target.toLowerCase().includes(searchValue);

            const matchStatus = !statusFilterValue ||
                (statusFilterValue === 'enabled' && m.enabled) ||
                (statusFilterValue === 'disabled' && !m.enabled);

            return matchSearch && matchStatus;
        });

        renderMappings(filtered);
    }

    /**
     * 显示新增/编辑映射弹窗
     * @param {number|null} mappingId - 映射ID
     */
    function showEditor(mappingId = null) {
        state.currentMappingId = mappingId;

        const title = mappingId ? '编辑映射规则' : '新增映射规则';
        const mapping = mappingId ? state.allMappings.find(m => m.id === mappingId) : null;

        const modalHtml = `
            <div id="businessSystemMappingEditorModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 8px; width: 600px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                    <div style="padding: 20px 25px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 18px;">${title}</h3>
                        <button onclick="BusinessSystemMappingsManager.closeEditor()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
                    </div>
                    <div style="padding: 25px;">
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <div>
                                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 8px;">原名称（合并结果表）<span style="color: #dc3545;">*</span></label>
                                <input type="text" id="mappingSource" value="${mapping ? escapeHtml(mapping.source) : ''}" placeholder="如：4A系统、安全系统" style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 8px;">目标名称（数据概览表）<span style="color: #dc3545;">*</span></label>
                                <input type="text" id="mappingTarget" value="${mapping ? escapeHtml(mapping.target) : ''}" placeholder="如：中国移动湖北公司业务支撑系统4A安全管理平台" style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="checkbox" id="mappingEnabled" ${mapping && mapping.enabled ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                                <label for="mappingEnabled" style="font-size: 14px; color: #333; cursor: pointer;">启用此映射规则</label>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 15px 25px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 10px;">
                        <button onclick="BusinessSystemMappingsManager.closeEditor()" style="padding: 8px 20px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
                        <button onclick="BusinessSystemMappingsManager.save()" style="padding: 8px 20px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>
                    </div>
                </div>
            </div>
        `;

        // 移除旧弹窗
        const oldModal = document.getElementById('businessSystemMappingEditorModal');
        if (oldModal) oldModal.remove();

        // 添加新弹窗
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * 关闭映射编辑弹窗
     */
    function closeEditor() {
        const modal = document.getElementById('businessSystemMappingEditorModal');
        if (modal) modal.remove();
        state.currentMappingId = null;
    }

    /**
     * 显示业务系统名称映射字典说明
     */
    function showHelp() {
        const oldModal = document.getElementById('businessSystemMappingHelpModal');
        if (oldModal) oldModal.remove();

        const modalHtml = `
            <div id="businessSystemMappingHelpModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.45); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;" onclick="BusinessSystemMappingsManager.closeHelp(event)">
                <div style="background: white; border-radius: 10px; width: 680px; max-width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.18);" onclick="event.stopPropagation()">
                    <div style="padding: 20px 24px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #005fe0 0%, #0047b3 100%); color: white;">
                        <div>
                            <h3 style="margin: 0; font-size: 18px;">公共配置说明</h3>
                            <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">用于处理合并结果表与数据概览表之间名称不一致的问题</div>
                        </div>
                        <button onclick="BusinessSystemMappingsManager.closeHelp()" style="background: transparent; border: none; color: white; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
                    </div>
                    <div style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
                        <div style="padding: 16px 18px; background: #f8fbff; border: 1px solid #d8e8ff; border-radius: 8px;">
                            <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">这页是做什么的</div>
                            <div style="font-size: 14px; line-height: 1.8; color: #4b5563;">
                                当合并结果表里的业务系统名称，与数据概览表里的标准业务系统名称不一致时，系统会先按这里维护的映射关系把名称转换成标准名称，再继续做跨表查询。
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">生效方式</div>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <div style="padding: 12px 14px; background: #f8f9fa; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #495057;">1. 先读取合并结果表中的业务系统名称。</div>
                                <div style="padding: 12px 14px; background: #f8f9fa; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #495057;">2. 如果该字段配置了“带映射的跨表查询”，系统会先应用本页映射字典。</div>
                                <div style="padding: 12px 14px; background: #f8f9fa; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #495057;">3. 再用转换后的标准名称去数据概览表查询所属系统类型等字段。</div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <div style="padding: 16px; border: 1px solid #d1fae5; background: #f0fdf4; border-radius: 8px;">
                                <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px;">会影响什么</div>
                                <div style="font-size: 13px; line-height: 1.8; color: #166534;">
                                    会影响已配置为“带映射查询”的导出字段，例如所属系统类型这类需要跨表查回的列。
                                </div>
                            </div>
                            <div style="padding: 16px; border: 1px solid #fee2e2; background: #fef2f2; border-radius: 8px;">
                                <div style="font-size: 13px; font-weight: 700; color: #991b1b; margin-bottom: 8px;">不会影响什么</div>
                                <div style="font-size: 13px; line-height: 1.8; color: #991b1b;">
                                    不是所有导出都会自动使用本字典。只有配置里明确启用了映射查询的字段才会使用；禁用的映射规则也不会参与。
                                </div>
                            </div>
                        </div>
                        <div style="padding: 16px 18px; background: #fffbea; border: 1px solid #fde68a; border-radius: 8px;">
                            <div style="font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 8px;">维护建议</div>
                            <div style="font-size: 13px; line-height: 1.8; color: #92400e;">
                                原名称填写合并结果表中的实际名称，目标名称填写数据概览表中的标准名称。只有“启用”状态的映射会在导出时参与匹配。
                            </div>
                        </div>
                    </div>
                    <div style="padding: 14px 24px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; background: #f8f9fa;">
                        <button onclick="BusinessSystemMappingsManager.closeHelp()" style="padding: 8px 20px; background: #005fe0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">我知道了</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * 关闭业务系统名称映射字典说明
     * @param {Event} event - 点击事件
     */
    function closeHelp(event) {
        if (event && event.target && event.target.id !== 'businessSystemMappingHelpModal') {
            return;
        }

        const modal = document.getElementById('businessSystemMappingHelpModal');
        if (modal) modal.remove();
    }

    /**
     * 保存映射
     */
    async function save() {
        const sourceInput = document.getElementById('mappingSource');
        const targetInput = document.getElementById('mappingTarget');
        const enabledInput = document.getElementById('mappingEnabled');

        if (!sourceInput || !targetInput) {
            showToast('表单元素未找到', true);
            return;
        }

        const source = sourceInput.value.trim();
        const target = targetInput.value.trim();
        const enabled = enabledInput.checked;

        if (!source || !target) {
            showToast('请填写原名称和目标名称', true);
            return;
        }

        try {
            const data = { source, target, enabled };

            let url = API_BASE + '/public-configs/business-system-name-mappings';
            let method = 'POST';

            if (state.currentMappingId) {
                url += '/' + state.currentMappingId;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (result.success) {
                showToast(state.currentMappingId ? '更新成功' : '添加成功', false);
                closeEditor();
                await loadMappings();
            } else {
                showToast(result.error || '保存失败', true);
            }
        } catch (e) {
            console.error('保存失败:', e);
            showToast('保存失败', true);
        }
    }

    /**
     * 编辑映射
     * @param {number} id - 映射ID
     */
    function edit(id) {
        showEditor(id);
    }

    /**
     * 删除映射
     * @param {number} id - 映射ID
     */
    async function remove(id) {
        if (!confirm('确定要删除这条映射规则吗？')) return;

        try {
            const res = await fetch(API_BASE + '/public-configs/business-system-name-mappings/' + id, {
                method: 'DELETE'
            });

            const result = await res.json();

            if (result.success) {
                showToast('删除成功', false);
                await loadMappings();
            } else {
                showToast(result.error || '删除失败', true);
            }
        } catch (e) {
            console.error('删除失败:', e);
            showToast('删除失败', true);
        }
    }

    /**
     * 下载模板
     */
    async function downloadTemplate() {
        try {
            const response = await fetch(API_BASE + '/public-configs/business-system-name-mappings/template');

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '公共配置_导入模板.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showToast('模板下载成功', false);
            } else {
                showToast('模板下载失败', true);
            }
        } catch (e) {
            console.error('下载模板失败:', e);
            showToast('下载模板失败', true);
        }
    }

    /**
     * 导入映射
     */
    function importMappings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                showToast('正在导入...', false);

                const response = await fetch(API_BASE + '/public-configs/business-system-name-mappings/import', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    showToast(result.message || '导入成功', false);
                    await loadMappings();
                } else {
                    showToast(result.error || '导入失败', true);
                }
            } catch (e) {
                console.error('导入失败:', e);
                showToast('导入失败', true);
            }
        };

        input.click();
    }

    /**
     * 导出映射
     */
    async function exportMappings() {
        try {
            showToast('正在导出...', false);

            const response = await fetch(API_BASE + '/public-configs/business-system-name-mappings/export');

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '公共配置_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showToast('导出成功', false);
            } else {
                const result = await response.json();
                showToast(result.error || '导出失败', true);
            }
        } catch (e) {
            console.error('导出失败:', e);
            showToast('导出失败', true);
        }
    }

    /**
     * HTML转义辅助函数
     * @param {string} text - 要转义的文本
     * @returns {string}
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== 导出模块 API ====================

    window.BusinessSystemMappingsManager = {
        // 状态
        state: state,

        // 映射管理
        loadMappings: loadMappings,
        renderMappings: renderMappings,
        filterMappings: filterMappings,
        showEditor: showEditor,
        closeEditor: closeEditor,
        showHelp: showHelp,
        closeHelp: closeHelp,
        save: save,
        edit: edit,
        remove: remove,

        // 导入导出
        downloadTemplate: downloadTemplate,
        importMappings: importMappings,
        exportMappings: exportMappings
    };

    // 兼容旧的全局函数调用
    window.loadBusinessSystemMappings = loadMappings;
    window.renderBusinessSystemMappings = renderMappings;
    window.filterBusinessSystemMappings = filterMappings;
    window.showBusinessSystemMappingEditor = showEditor;
    window.closeBusinessSystemMappingEditor = closeEditor;
    window.showBusinessSystemMappingHelp = showHelp;
    window.closeBusinessSystemMappingHelp = closeHelp;
    window.saveBusinessSystemMapping = save;
    window.editBusinessSystemMapping = edit;
    window.deleteBusinessSystemMapping = remove;
    window.downloadBusinessSystemMappingTemplate = downloadTemplate;
    window.importBusinessSystemMappings = importMappings;
    window.exportBusinessSystemMappings = exportMappings;

})(window);
