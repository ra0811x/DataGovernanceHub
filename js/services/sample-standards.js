/**
 * 数据样例标准管理服务模块
 * 负责数据分级标准样例的管理功能
 * 从 index.html (8705行起) 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        sampleStandardsData: null,
        allSampleStandards: []
    };

    // ==================== 数据样例标准管理 ====================

    /**
     * 获取样例数量（兼容新旧格式）
     */
    function getSampleCount(standard) {
        if (standard && Array.isArray(standard.samples)) {
            const validSamples = standard.samples.filter(s => s && s.trim() !== '');
            return validSamples.length;
        }
        if (standard && standard.sample) {
            return 1;
        }
        return 0;
    }

    /**
     * 格式化样例显示（兼容新旧格式）
     */
    function formatSamples(standard) {
        // 检查 samples 数组
        if (standard && Array.isArray(standard.samples) && standard.samples.length > 0) {
            // 过滤掉空值
            const validSamples = standard.samples.filter(s => s && s.trim() !== '');
            if (validSamples.length > 0) {
                const displaySamples = validSamples.slice(0, 5);
                let result = displaySamples.join('、');
                if (validSamples.length > 5) {
                    result += ` 等${validSamples.length}个`;
                }
                return result;
            }
        }
        // 兼容旧格式 sample 字段
        if (standard && standard.sample) {
            return standard.sample;
        }
        return '-';
    }

    /**
     * 加载数据样例标准
     */
    async function loadStandards() {
        try {
            const res = await fetch(API_BASE + '/data-sample-standards');
            const result = await res.json();

            if (result.success && result.data) {
                state.sampleStandardsData = result.data;
                state.allSampleStandards = result.data.standards || [];

                // 调试：检查第一条数据的格式
                if (state.allSampleStandards.length > 0) {
                    console.log('样例数据格式检查:', {
                        name: state.allSampleStandards[0].name,
                        samples: state.allSampleStandards[0].samples,
                        sample: state.allSampleStandards[0].sample,
                        samplesType: typeof state.allSampleStandards[0].samples,
                        samplesIsArray: Array.isArray(state.allSampleStandards[0].samples)
                    });
                }

                // 填充分级筛选下拉框
                populateLevelFilter();

                // 渲染列表
                renderStandards(state.allSampleStandards);
            }
        } catch (e) {
            console.error('加载数据样例标准失败:', e);
            showToast('加载失败', true);
        }
    }

    /**
     * 填充分级筛选下拉框
     */
    function populateLevelFilter() {
        const levels = [...new Set(state.allSampleStandards.map(s => s.level))].sort();
        const select = document.getElementById('sampleStandardLevelFilter');
        if (!select) return;

        select.innerHTML = '<option value="">全部</option>';
        levels.forEach(level => {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            select.appendChild(option);
        });
    }

    /**
     * 渲染数据样例标准列表
     * @param {Array} standards - 标准数组
     */
    function renderStandards(standards) {
        const container = document.getElementById('sampleStandardsList');
        const countElement = document.getElementById('sampleStandardCount');

        if (countElement) {
            countElement.textContent = standards.length;
        }

        if (!container) return;

        if (standards.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <div>暂无数据样例标准</div>
                </div>
            `;
            return;
        }

        container.innerHTML = standards.map(standard => `
            <div class="sample-standard-card" data-id="${standard.id}" style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; transition: all 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <span style="font-weight: 600; color: #333; font-size: 14px;">${standard.name}</span>
                            <span style="padding: 2px 8px; background: ${standard.enabled ? '#e8f5e9' : '#ffebee'}; color: ${standard.enabled ? '#2e7d32' : '#c62828'}; border-radius: 10px; font-size: 11px;">${standard.enabled ? '启用' : '禁用'}</span>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                            <span style="color: #999;">数据分类:</span> ${standard.category}
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            <span style="color: #999;">数据分级:</span> ${standard.level}
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="SampleStandardsManager.edit(${standard.id})" style="padding: 4px 8px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">编辑</button>
                        <button onclick="SampleStandardsManager.remove(${standard.id})" style="padding: 4px 8px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">删除</button>
                    </div>
                </div>
                <div style="background: #f8f9fa; border-radius: 4px; padding: 10px; margin-top: 8px;">
                    <div style="font-size: 11px; color: #999; margin-bottom: 4px;">数据样例 (${getSampleCount(standard)}个):</div>
                    <div style="font-family: monospace; font-size: 13px; color: #333; word-break: break-all;">${formatSamples(standard)}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 筛选标准
     */
    function filterStandards() {
        const searchText = (document.getElementById('sampleStandardSearch')?.value || '').toLowerCase();
        const levelFilter = document.getElementById('sampleStandardLevelFilter')?.value || '';
        const statusFilter = document.getElementById('sampleStandardStatusFilter')?.value || '';

        let filtered = state.allSampleStandards;

        if (searchText) {
            filtered = filtered.filter(s => {
                const nameMatch = s.name.toLowerCase().includes(searchText);
                // 兼容新旧格式的样例搜索
                let sampleMatch = false;
                if (Array.isArray(s.samples)) {
                    sampleMatch = s.samples.some(sample =>
                        sample.toLowerCase().includes(searchText)
                    );
                } else if (s.sample) {
                    sampleMatch = s.sample.toLowerCase().includes(searchText);
                }
                return nameMatch || sampleMatch;
            });
        }

        if (levelFilter) {
            filtered = filtered.filter(s => s.level === levelFilter);
        }

        if (statusFilter) {
            const isEnabled = statusFilter === 'enabled';
            filtered = filtered.filter(s => s.enabled === isEnabled);
        }

        renderStandards(filtered);
    }

    /**
     * 显示标准编辑器
     * @param {number|null} standardId - 标准ID
     */
    async function showEditor(standardId = null) {
        if (standardId) {
            // 编辑现有标准
            try {
                const res = await fetch(API_BASE + `/data-sample-standards/${standardId}`);
                const result = await res.json();

                if (result.success && result.data) {
                    renderEditor(result.data);
                } else {
                    showToast('加载标准信息失败', true);
                }
            } catch (e) {
                console.error('加载标准信息失败:', e);
                showToast('加载失败', true);
            }
        } else {
            // 新建标准
            renderEditor(null);
        }

        const modal = document.getElementById('sampleStandardEditorModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 渲染标准编辑器
     * @param {Object|null} standard - 标准对象
     */
    function renderEditor(standard) {
        const form = document.getElementById('sampleStandardEditForm');
        if (!form) return;

        const id = standard ? standard.id : '';
        const name = standard ? standard.name : '';
        const category = standard ? standard.category : '';
        const level = standard ? standard.level : '';

        // 兼容新旧格式获取样例数据
        let samplesValue = '';
        if (standard) {
            if (Array.isArray(standard.samples) && standard.samples.length > 0) {
                samplesValue = standard.samples.join('、');
            } else if (standard.sample) {
                samplesValue = standard.sample;
            }
        }

        const enabled = standard ? standard.enabled : true;
        const notes = standard ? standard.notes || '' : '';

        form.innerHTML = `
            <input type="hidden" id="sampleStandardId" value="${id}">

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">数据名称 <span style="color: #dc3545;">*</span></label>
                    <input type="text" id="sampleStandardName" value="${name}" placeholder="例如：客户姓名" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">数据分类 <span style="color: #dc3545;">*</span></label>
                    <input type="text" id="sampleStandardCategory" value="${category}" placeholder="例如：客户信息" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">数据分级 <span style="color: #dc3545;">*</span></label>
                    <select id="sampleStandardLevel" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                        <option value="">请选择</option>
                        <option value="1级" ${level === '1级' ? 'selected' : ''}>1级</option>
                        <option value="2级" ${level === '2级' ? 'selected' : ''}>2级</option>
                        <option value="3级" ${level === '3级' ? 'selected' : ''}>3级</option>
                        <option value="4级" ${level === '4级' ? 'selected' : ''}>4级</option>
                        <option value="5级" ${level === '5级' ? 'selected' : ''}>5级</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">状态</label>
                    <select id="sampleStandardEnabled" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                        <option value="true" ${enabled ? 'selected' : ''}>启用</option>
                        <option value="false" ${!enabled ? 'selected' : ''}>禁用</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">
                    数据样例 <span style="color: #dc3545;">*</span>
                    <span style="font-weight: 400; color: #6c757d; font-size: 12px; margin-left: 8px;">（多个样例用顿号"、"或逗号分隔）</span>
                </label>
                <textarea id="sampleStandardSample" placeholder="输入数据样例，多个样例用顿号或逗号分隔，例如：张三、李四、王五" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 80px; resize: vertical; font-family: monospace;">${samplesValue}</textarea>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">备注说明</label>
                <textarea id="sampleStandardNotes" placeholder="可选的备注说明" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 60px; resize: vertical;">${notes}</textarea>
            </div>
        `;
    }

    /**
     * 关闭编辑器
     */
    function closeEditor() {
        const modal = document.getElementById('sampleStandardEditorModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 保存标准
     * @param {Event} event - 事件对象
     * @param {number|null} standardId - 标准ID
     */
    async function save(event, standardId) {
        event.preventDefault();

        const id = document.getElementById('sampleStandardId').value || standardId;
        const name = document.getElementById('sampleStandardName').value.trim();
        const category = document.getElementById('sampleStandardCategory').value.trim();
        const level = document.getElementById('sampleStandardLevel').value;
        const enabled = document.getElementById('sampleStandardEnabled').value === 'true';
        const sampleValue = document.getElementById('sampleStandardSample').value.trim();
        const notes = document.getElementById('sampleStandardNotes').value.trim();

        if (!name || !category || !level || !sampleValue) {
            showToast('请填写所有必填字段', true);
            return;
        }

        // 解析样例数据（支持顿号、逗号分隔）
        const samples = sampleValue.split(/[、,，;；\n]/).map(s => s.trim()).filter(s => s);

        const data = {
            name: name,
            category: category,
            level: level,
            samples: samples,
            enabled: enabled,
            notes: notes
        };

        try {
            let res;
            if (id) {
                res = await fetch(API_BASE + `/data-sample-standards/${id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
            } else {
                res = await fetch(API_BASE + '/data-sample-standards', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
            }

            const result = await res.json();

            if (result.success) {
                showToast(id ? '标准更新成功' : '标准创建成功', false);
                closeEditor();
                await loadStandards();
            } else {
                showToast(result.error || '保存失败', true);
            }
        } catch (e) {
            console.error('保存标准失败:', e);
            showToast('保存失败: ' + e.message, true);
        }
    }

    /**
     * 编辑标准
     * @param {number} standardId - 标准ID
     */
    function edit(standardId) {
        showEditor(standardId);
    }

    /**
     * 删除标准
     * @param {number} standardId - 标准ID
     */
    async function remove(standardId) {
        if (!confirm('确认要删除此数据样例标准吗？')) {
            return;
        }

        try {
            const res = await fetch(API_BASE + `/data-sample-standards/${standardId}`, {
                method: 'DELETE'
            });

            const result = await res.json();

            if (result.success) {
                showToast('标准删除成功', false);
                await loadStandards();
            } else {
                showToast(result.error || '删除失败', true);
            }
        } catch (e) {
            console.error('删除标准失败:', e);
            showToast('删除失败: ' + e.message, true);
        }
    }

    /**
     * 下载导入模板
     */
    async function downloadImportTemplate() {
        try {
            const res = await fetch(API_BASE + '/data-sample-standards/template');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '数据样例标准导入模板.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            showToast('下载模板失败', true);
        }
    }

    /**
     * 导入标准
     */
    function importStandards() {
        const modal = document.getElementById('importStandardsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 导出标准
     */
    async function exportStandards() {
        try {
            const res = await fetch(API_BASE + '/data-sample-standards/export');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '数据样例标准_' + new Date().toISOString().slice(0, 10) + '.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('导出成功', false);
        } catch (e) {
            showToast('导出失败', true);
        }
    }

    // ==================== 导出模块 API ====================

    window.SampleStandardsManager = {
        // 状态
        state: state,

        // 标准管理
        loadStandards: loadStandards,
        renderStandards: renderStandards,
        filterStandards: filterStandards,
        showEditor: showEditor,
        closeEditor: closeEditor,
        save: save,
        edit: edit,
        remove: remove,

        // 导入导出
        downloadImportTemplate: downloadImportTemplate,
        importStandards: importStandards,
        exportStandards: exportStandards
    };

    // delete 是保留关键字，作为方法别名
    Object.defineProperty(window.SampleStandardsManager, 'delete', {
        value: remove,
        writable: false,
        enumerable: true
    });

    // 兼容旧的全局函数调用
    window.loadSampleStandards = loadStandards;
    window.renderSampleStandards = renderStandards;
    window.filterSampleStandards = filterStandards;
    window.showSampleStandardEditor = showEditor;
    window.closeSampleStandardModal = closeEditor;
    window.saveSampleStandard = save;
    window.editSampleStandard = edit;
    window.deleteSampleStandard = remove;
    window.downloadImportTemplate = downloadImportTemplate;
    window.importSampleStandards = importStandards;
    window.exportSampleStandards = exportStandards;

})(window);
