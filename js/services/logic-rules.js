/**
 * 逻辑规则管理服务模块
 * 负责条件规则管理和数据样例标准管理功能
 * 从 index.html (8322行起) 迁移
 */

(function(window) {
    'use strict';

    // ==================== 模块状态 ====================
    const state = {
        // 条件规则
        currentRule: null,
        allRules: [],

        // 数据样例标准
        sampleStandardsData: null,
        allSampleStandards: [],

        // 业务系统映射
        businessSystemMappingsData: null,
        allBusinessSystemMappings: [],
        currentBusinessSystemMappingId: null
    };

    // ==================== 条件规则管理 ====================

    /**
     * 切换到条件规则管理标签
     */
    async function switchToRulesTab() {
        await loadRulesList();
    }

    /**
     * 加载规则列表
     */
    async function loadRulesList() {
        try {
            const res = await fetch(API_BASE + '/logic-rules');
            const result = await res.json();

            if (result.success && result.data) {
                state.allRules = result.data.rules || [];
                renderRulesList(state.allRules);
            } else {
                showToast('加载规则列表失败', true);
            }
        } catch (e) {
            console.error('加载规则列表失败:', e);
            showToast('加载规则列表失败: ' + e.message, true);
        }
    }

    /**
     * 渲染规则列表
     * @param {Array} rules - 规则数组
     */
    function renderRulesList(rules) {
        const container = document.getElementById('logicRulesList');
        if (!container) return;

        if (!rules || rules.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></div>
                    <div style="font-size: 16px; margin-bottom: 8px;">暂无条件规则</div>
                    <div style="font-size: 13px;">点击上方"新建规则"按钮创建第一个规则</div>
                </div>
            `;
            return;
        }

        const typeLabels = {
            'conditional': '单字段条件',
            'multi_conditional': '多字段条件',
            'lookup_ip': 'IP查询'
        };
        const typeColors = {
            'conditional': '#005fe0',
            'multi_conditional': '#17a2b8',
            'lookup_ip': '#28a745'
        };

        const html = rules.map(rule => {
            return `
                <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; transition: all 0.3s;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <h4 style="margin: 0; font-size: 16px; color: #333;">${rule.name}</h4>
                                <span style="padding: 4px 12px; background: ${typeColors[rule.type] || '#6c757d'}; color: white; border-radius: 12px; font-size: 11px; font-weight: 600;">${typeLabels[rule.type] || rule.type}</span>
                            </div>
                            <p style="margin: 0; font-size: 13px; color: #6c757d; line-height: 1.5;">${rule.description || '暂无描述'}</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="LogicRulesManager.editRule('${rule.id}')" style="padding: 6px 14px; background: #005fe0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">编辑</button>
                            <button onclick="LogicRulesManager.deleteRule('${rule.id}')" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">删除</button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 20px; font-size: 12px; color: #6c757d;">
                        <div>使用次数: <strong style="color: #333;">${rule.usage_count || 0}</strong></div>
                        <div>创建时间: <strong style="color: #333;">${rule.created_at || '-'}</strong></div>
                        ${rule.updated_at !== rule.created_at ? `<div>更新时间: <strong style="color: #333;">${rule.updated_at}</strong></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * 显示规则编辑器
     * @param {string|null} ruleId - 规则ID
     */
    function showEditor(ruleId = null) {
        const modal = document.getElementById('logicRuleEditorModal');
        const title = document.getElementById('logicRuleEditorTitle');
        if (!modal || !title) return;

        if (ruleId) {
            const rule = state.allRules.find(r => r.id === ruleId);
            if (!rule) {
                showToast('规则不存在', true);
                return;
            }
            state.currentRule = rule;
            title.textContent = '编辑条件规则';
            renderEditor(rule);
        } else {
            state.currentRule = null;
            title.textContent = '新建条件规则';
            renderEditor(null);
        }

        modal.style.display = 'flex';
    }

    /**
     * 渲染规则编辑器
     * @param {Object|null} rule - 规则对象
     */
    function renderEditor(rule) {
        const container = document.getElementById('logicRuleEditorBody');
        if (!container) return;

        const ruleId = rule ? rule.id : '';
        const ruleName = rule ? rule.name : '';
        const ruleType = rule ? rule.type : 'conditional';
        const ruleDescription = rule ? rule.description || '' : '';
        const sourceField = rule ? rule.source_field : {data_source: 'merge_results', field_index: 9, field_name: '数据分级'};
        const conditions = rule ? rule.conditions : [];
        const defaultValue = rule ? rule.default || '' : '';

        const conditionsHtml = conditions.map((cond, idx) => {
            const matchValue = cond.match || '';
            const resultValue = cond.result || '';
            const isRegex = cond.regex || false;

            return `
                <div class="logic-rule-condition-row" data-cond-idx="${idx}" style="display: flex; gap: 10px; margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                    <input type="text" class="cond-match-input" value="${matchValue}" placeholder="匹配值" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #495057;">
                        <input type="checkbox" class="cond-regex-checkbox" ${isRegex ? 'checked' : ''}> 正则
                    </label>
                    <span style="color: #6c757d;">&rarr;</span>
                    <input type="text" class="cond-result-input" value="${resultValue}" placeholder="返回值" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    <button type="button" class="btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;" onclick="LogicRulesManager.removeCondition(${idx})">删除</button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">规则名称 <span style="color: #dc3545;">*</span></label>
                    <input type="text" id="logicRuleName" value="${ruleName}" placeholder="例如：数据分级-存储状态" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">规则类型 <span style="color: #dc3545;">*</span></label>
                    <select id="logicRuleType" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" onchange="LogicRulesManager.onTypeChange(this.value)">
                        <option value="conditional" ${ruleType === 'conditional' ? 'selected' : ''}>单字段条件判断</option>
                        <option value="multi_conditional" ${ruleType === 'multi_conditional' ? 'selected' : ''}>多字段条件判断</option>
                        <option value="lookup_ip" ${ruleType === 'lookup_ip' ? 'selected' : ''}>IP查询</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">描述说明</label>
                <textarea id="logicRuleDescription" placeholder="详细描述此规则的用途和逻辑" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 60px; resize: vertical;">${ruleDescription}</textarea>
            </div>

            <div id="sourceFieldSection">
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">判断字段 <span style="color: #dc3545;">*</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 12px; color: #6c757d; margin-bottom: 5px;">数据源</label>
                        <select id="logicRuleDataSource" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                            <option value="merge_results" ${sourceField.data_source === 'merge_results' ? 'selected' : ''}>合并结果表</option>
                            <option value="assets" ${sourceField.data_source === 'assets' ? 'selected' : ''}>数据概览表</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; color: #6c757d; margin-bottom: 5px;">字段索引</label>
                        <input type="number" id="logicRuleFieldIndex" value="${sourceField.field_index || 9}" min="0" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; color: #6c757d; margin-bottom: 5px;">字段名称</label>
                        <input type="text" id="logicRuleFieldName" value="${sourceField.field_name || ''}" placeholder="例如：数据分级" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">条件列表</label>
                <div id="logicRuleConditionsList" style="max-height: 200px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                    ${conditionsHtml || '<div style="text-align: center; padding: 20px; color: #6c757d;">暂无条件</div>'}
                </div>
                <button type="button" onclick="LogicRulesManager.addCondition()" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px;">+ 添加条件</button>
            </div>

            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">默认值（所有条件都不满足时返回）</label>
                <input type="text" id="logicRuleDefaultValue" value="${defaultValue}" placeholder="默认返回值" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
            </div>
        `;
    }

    /**
     * 关闭规则编辑器
     */
    function closeEditor() {
        const modal = document.getElementById('logicRuleEditorModal');
        if (modal) {
            modal.style.display = 'none';
        }
        state.currentRule = null;
    }

    /**
     * 添加条件
     */
    function addCondition() {
        const container = document.getElementById('logicRuleConditionsList');
        if (!container) return;

        // 移除"暂无条件"提示
        if (container.querySelector('div[style*="暂无条件"]')) {
            container.innerHTML = '';
        }

        const idx = container.querySelectorAll('.logic-rule-condition-row').length;

        const newCondHtml = `
            <div class="logic-rule-condition-row" data-cond-idx="${idx}" style="display: flex; gap: 10px; margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                <input type="text" class="cond-match-input" placeholder="匹配值" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #495057;">
                    <input type="checkbox" class="cond-regex-checkbox"> 正则
                </label>
                <span style="color: #6c757d;">&rarr;</span>
                <input type="text" class="cond-result-input" placeholder="返回值" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <button type="button" class="btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;" onclick="LogicRulesManager.removeCondition(${idx})">删除</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', newCondHtml);
    }

    /**
     * 删除条件
     * @param {number} idx - 条件索引
     */
    function removeCondition(idx) {
        const row = document.querySelector(`.logic-rule-condition-row[data-cond-idx="${idx}"]`);
        if (row) {
            row.remove();
        }

        const container = document.getElementById('logicRuleConditionsList');
        if (container && container.querySelectorAll('.logic-rule-condition-row').length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">暂无条件</div>';
        }
    }

    /**
     * 保存规则
     */
    async function save() {
        const name = document.getElementById('logicRuleName').value.trim();
        const type = document.getElementById('logicRuleType').value;
        const description = document.getElementById('logicRuleDescription').value.trim();
        const dataSource = document.getElementById('logicRuleDataSource').value;
        const fieldIndex = parseInt(document.getElementById('logicRuleFieldIndex').value);
        const fieldName = document.getElementById('logicRuleFieldName').value.trim();
        const defaultValue = document.getElementById('logicRuleDefaultValue').value;

        if (!name) {
            showToast('请输入规则名称', true);
            return;
        }

        // 收集条件
        const conditions = [];
        document.querySelectorAll('.logic-rule-condition-row').forEach(row => {
            const match = row.querySelector('.cond-match-input').value.trim();
            const result = row.querySelector('.cond-result-input').value.trim();
            const isRegex = row.querySelector('.cond-regex-checkbox').checked;

            if (match && result) {
                conditions.push({
                    match: match,
                    result: result,
                    regex: isRegex
                });
            }
        });

        const ruleData = {
            name: name,
            type: type,
            description: description,
            source_field: {
                data_source: dataSource,
                field_index: fieldIndex,
                field_name: fieldName
            },
            conditions: conditions,
            default: defaultValue
        };

        try {
            let res;
            if (state.currentRule) {
                res = await fetch(API_BASE + `/logic-rules/${state.currentRule.id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(ruleData)
                });
            } else {
                res = await fetch(API_BASE + '/logic-rules', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(ruleData)
                });
            }

            const result = await res.json();

            if (result.success) {
                showToast(state.currentRule ? '规则更新成功' : '规则创建成功', false);
                closeEditor();
                await loadRulesList();
            } else {
                showToast('保存失败: ' + (result.error || '未知错误'), true);
            }
        } catch (e) {
            console.error('保存规则失败:', e);
            showToast('保存失败: ' + e.message, true);
        }
    }

    /**
     * 编辑规则
     * @param {string} ruleId - 规则ID
     */
    function editRule(ruleId) {
        showEditor(ruleId);
    }

    /**
     * 删除规则
     * @param {string} ruleId - 规则ID
     */
    async function deleteRule(ruleId) {
        const rule = state.allRules.find(r => r.id === ruleId);
        if (!rule) {
            showToast('规则不存在', true);
            return;
        }

        if (rule.usage_count > 0) {
            alert(`该规则正在被使用（使用次数：${rule.usage_count}），无法删除！`);
            return;
        }

        if (!confirm(`确认要删除规则"${rule.name}"吗？\n\n此操作不可撤销！`)) {
            return;
        }

        try {
            const res = await fetch(API_BASE + `/logic-rules/${ruleId}`, {
                method: 'DELETE'
            });

            const result = await res.json();

            if (result.success) {
                showToast('规则删除成功', false);
                await loadRulesList();
            } else {
                showToast('删除失败: ' + (result.error || '未知错误'), true);
            }
        } catch (e) {
            console.error('删除规则失败:', e);
            showToast('删除失败: ' + e.message, true);
        }
    }

    /**
     * 规则类型改变时的处理
     * @param {string} type - 规则类型
     */
    function onTypeChange(type) {
        console.log('规则类型改变:', type);
    }

    // ==================== 导出模块 API ====================

    window.LogicRulesManager = {
        // 状态
        state: state,

        // 规则管理
        switchToRulesTab: switchToRulesTab,
        loadRulesList: loadRulesList,
        renderRulesList: renderRulesList,
        showEditor: showEditor,
        closeEditor: closeEditor,
        save: save,
        editRule: editRule,
        deleteRule: deleteRule,

        // 条件管理
        addCondition: addCondition,
        removeCondition: removeCondition,
        onTypeChange: onTypeChange
    };

    // 兼容旧的全局函数调用
    window.switchToLogicRulesTab = switchToRulesTab;
    window.loadLogicRulesList = loadRulesList;
    window.renderLogicRulesList = renderRulesList;
    window.showLogicRuleEditor = showEditor;
    window.closeLogicRuleEditor = closeEditor;
    window.saveLogicRule = save;
    window.editLogicRule = editRule;
    window.deleteLogicRule = deleteRule;
    window.addLogicRuleCondition = addCondition;
    window.removeLogicRuleCondition = removeCondition;
    window.onLogicRuleTypeChange = onTypeChange;

})(window);
