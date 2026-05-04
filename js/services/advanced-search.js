/**
 * 高级搜索服务模块
 * 支持多条件筛选和保存搜索条件
 */

(function(window) {
    'use strict';

    // ==================== 状态管理 ====================

    const state = {
        currentSearch: {},      // 当前搜索条件
        savedSearches: [],      // 已保存的搜索条件
        isAdvancedMode: false   // 是否显示高级搜索面板
    };

    // ==================== 列配置（用于生成筛选选项） ====================

    let assetsColumns = [];
    let mergeColumns = [];

    // ==================== 初始化 ====================

    async function init() {
        await loadColumns();
        loadSavedSearches();
        bindEvents();
    }

    async function loadColumns() {
        try {
            // 加载数据概览列配置
            const assetsRes = await fetch(API_BASE + '/assets/columns');
            const assetsResult = await assetsRes.json();
            if (assetsResult.success) {
                assetsColumns = assetsResult.columns || [];
            }

            // 加载合并结果列配置
            const mergeRes = await fetch(API_BASE + '/merge/search-columns');
            const mergeResult = await mergeRes.json();
            if (mergeResult.success) {
                mergeColumns = mergeResult.columns || [];
            }
        } catch (e) {
            console.error('加载列配置失败:', e);
        }
    }

    function loadSavedSearches() {
        const saved = localStorage.getItem('savedSearches');
        if (saved) {
            try {
                state.savedSearches = JSON.parse(saved);
            } catch (e) {
                console.error('加载保存的搜索条件失败:', e);
                state.savedSearches = [];
            }
        }
    }

    function bindEvents() {
        // 基础搜索回车事件由原有代码处理
    }

    // ==================== 高级搜索面板 ====================

    function toggleAdvancedSearch() {
        state.isAdvancedMode = !state.isAdvancedMode;
        const toggleBtn = document.getElementById('advancedSearchToggle');
        const toggleBtn2 = document.getElementById('advancedSearchToggle2');

        if (state.isAdvancedMode) {
            if (toggleBtn) toggleBtn.classList.add('active');
            if (toggleBtn2) toggleBtn2.classList.add('active');
            renderAdvancedSearchModal();
        } else {
            if (toggleBtn) toggleBtn.classList.remove('active');
            if (toggleBtn2) toggleBtn2.classList.remove('active');
            closeAdvancedSearchModal();
        }
    }

    function closeAdvancedSearchModal() {
        const modal = document.getElementById('advancedSearchModal');
        if (modal) {
            modal.remove();
        }
    }

    function renderAdvancedSearchModal() {
        // 先移除旧模态框
        closeAdvancedSearchModal();

        const isDevicePage = document.getElementById('page-device').classList.contains('active');
        const columns = isDevicePage ? assetsColumns : mergeColumns;

        const fieldOptions = columns.map(col =>
            `<option value="${col.field}">${col.name}</option>`
        ).join('');

        // 保存字段选项供 addSearchCondition 使用
        state.currentFieldOptions = fieldOptions;

        const pageTitle = isDevicePage ? '数据概览 - 高级筛选' : '合并结果 - 高级筛选';

        let html = `
            <div id="advancedSearchModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 3000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 8px; width: 700px; max-width: 90vw; max-height: 80vh; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
                    <!-- 标题栏 -->
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa;">
                        <h3 style="margin: 0; font-size: 16px;">${pageTitle}</h3>
                        <button onclick="AdvancedSearch.toggleAdvancedSearch()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1;">&times;</button>
                    </div>

                    <!-- 内容区 -->
                    <div style="padding: 20px; overflow-y: auto; flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <span style="font-weight: 600; color: #333;">筛选条件</span>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-sm btn-success" onclick="AdvancedSearch.addSearchCondition()" style="padding: 5px 12px; font-size: 13px;">+ 添加条件</button>
                                <button class="btn btn-sm" onclick="AdvancedSearch.clearAll()" style="padding: 5px 12px; font-size: 13px;">清空条件</button>
                            </div>
                        </div>

                        <div id="searchConditions" style="display: flex; flex-direction: column; gap: 10px; min-height: 60px;">
                            <div id="noConditionsHint" style="text-align: center; color: #999; padding: 30px 20px; background: #f8f9fa; border-radius: 4px; border: 1px dashed #ddd;">
                                点击"添加条件"开始筛选
                            </div>
                        </div>
                    </div>

                    <!-- 底部按钮区 -->
                    <div style="padding: 15px 20px; border-top: 1px solid #e9ecef; background: #f8f9fa; display: flex; gap: 10px;">
                        <button class="btn btn-primary" onclick="AdvancedSearch.executeSearch()" style="flex: 2;">搜索</button>
                        <button class="btn" onclick="AdvancedSearch.saveSearch()" style="flex: 1;">保存条件</button>
                        <button class="btn" onclick="AdvancedSearch.showSavedSearches()" style="flex: 1;">已保存</button>
                        <button class="btn" onclick="AdvancedSearch.toggleAdvancedSearch()" style="flex: 1;">取消</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    function addSearchCondition() {
        const container = document.getElementById('searchConditions');
        const hint = document.getElementById('noConditionsHint');
        if (hint) hint.remove();

        const conditionId = 'condition_' + Date.now();
        const fieldOptions = state.currentFieldOptions || getDefaultFieldOptions();

        const conditionHtml = `
            <div class="search-condition" id="${conditionId}" style="display: flex; gap: 8px; align-items: center; background: #f8f9fa; padding: 12px; border-radius: 4px;">
                <select class="form-select condition-field" style="flex: 2; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    ${fieldOptions}
                </select>
                <select class="form-select condition-operator" style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="contains">包含</option>
                    <option value="equals">等于</option>
                    <option value="not_contains">不包含</option>
                    <option value="not_equals">不等于</option>
                    <option value="is_empty">为空</option>
                    <option value="not_empty">不为空</option>
                </select>
                <input type="text" class="form-input condition-value" placeholder="搜索值" style="flex: 2; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                <button class="btn btn-sm btn-danger" onclick="AdvancedSearch.removeCondition('${conditionId}')" style="padding: 4px 8px;">&times;</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', conditionHtml);
    }

    function getDefaultFieldOptions() {
        return `
            <option value="business_system">业务系统</option>
            <option value="data_asset_name">数据资产名称</option>
            <option value="ip_address">IP地址</option>
            <option value="data_type">数据类型</option>
            <option value="data_level">数据分级</option>
            <option value="status">状态</option>
            <option value="responsible_person">负责人</option>
        `;
    }

    // ==================== 搜索逻辑 ====================

    function buildSearchParams() {
        const conditions = document.querySelectorAll('#advancedSearchPanel .search-condition');
        const searchParams = {
            advanced: true,
            conditions: []
        };

        conditions.forEach(condition => {
            const field = condition.querySelector('.condition-field').value;
            const operator = condition.querySelector('.condition-operator').value;
            const value = condition.querySelector('.condition-value').value;

            if (value || operator === 'is_empty' || operator === 'not_empty') {
                searchParams.conditions.push({
                    field: field,
                    operator: operator,
                    value: value
                });
            }
        });

        return searchParams;
    }

    async function executeSearch() {
        const isDevicePage = document.getElementById('page-device').classList.contains('active');
        const params = buildSearchParams();

        if (params.conditions.length === 0) {
            showToast('请先添加搜索条件', true);
            return;
        }

        // 确定API端点和分页参数
        let apiUrl, page, pageSize;
        if (isDevicePage) {
            apiUrl = API_BASE + '/assets/advanced-search';
            page = typeof currentPage !== 'undefined' ? currentPage : 1;
            pageSize = typeof getActualPageSize === 'function' ? getActualPageSize() : 20;
        } else {
            apiUrl = API_BASE + '/merge/advanced-search';
            page = typeof currentPage2 !== 'undefined' ? currentPage2 : 1;
            pageSize = typeof getActualPageSize2 === 'function' ? getActualPageSize2() : 20;
        }

        // 添加分页参数
        params.page = page;
        params.page_size = pageSize;

        // 合并结果需要添加category参数
        if (!isDevicePage) {
            params.category = typeof currentCategory2 !== 'undefined' ? currentCategory2 : '';
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });

            const result = await response.json();

            if (result.success) {
                // 更新全局数据变量
                if (isDevicePage) {
                    if (typeof tableData !== 'undefined') {
                        tableData.length = 0;
                        tableData.push(...result.data);
                    }
                    if (typeof totalRecords !== 'undefined') {
                        totalRecords = result.total;
                    }
                    renderTable();
                    renderPagination();
                } else {
                    if (typeof tableData2 !== 'undefined') {
                        tableData2.length = 0;
                        tableData2.push(...result.data);
                    }
                    if (typeof totalRecords2 !== 'undefined') {
                        totalRecords2 = result.total;
                    }
                    renderTable2();
                    renderPagination2();
                }
                showToast(`找到 ${result.total} 条匹配记录`, false);
            } else {
                showToast(result.error || '搜索失败', true);
            }
        } catch (error) {
            console.error('高级搜索失败:', error);
            showToast('搜索请求失败，请检查网络连接', true);
        }
    }

    function performSearch() {
        if (state.isAdvancedMode) {
            executeSearch();
        } else {
            // 基础搜索
            if (typeof loadData === 'function') {
                loadData();
            }
        }
    }

    function performSearchMerge() {
        if (state.isAdvancedMode) {
            executeSearch();
        } else {
            // 基础搜索
            if (typeof loadMergeData === 'function') {
                loadMergeData();
            }
        }
    }

    // ==================== 保存/加载搜索条件 ====================

    function saveSearch() {
        const params = buildSearchParams();

        if (!params.conditions || params.conditions.length === 0) {
            showToast('请先添加搜索条件', true);
            return;
        }

        const name = prompt('请输入保存名称（如：已扫描资产查询）：');
        if (!name || !name.trim()) {
            return;
        }

        const isDevicePage = document.getElementById('page-device').classList.contains('active');
        const savedSearch = {
            id: Date.now(),
            name: name.trim(),
            pageType: isDevicePage ? 'device' : 'merge',
            conditions: params,
            createdAt: new Date().toISOString()
        };

        state.savedSearches.push(savedSearch);
        localStorage.setItem('savedSearches', JSON.stringify(state.savedSearches));
        showToast('搜索条件已保存', false);
    }

    function showSavedSearches() {
        if (state.savedSearches.length === 0) {
            showToast('暂无保存的搜索条件', true);
            return;
        }

        const isDevicePage = document.getElementById('page-device').classList.contains('active');
        const filtered = state.savedSearches.filter(s => s.pageType === (isDevicePage ? 'device' : 'merge'));

        if (filtered.length === 0) {
            showToast(`当前页面暂无保存的搜索条件`, true);
            return;
        }

        // 创建模态框显示已保存的条件
        let modalHtml = `
            <div id="savedSearchesModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 3100; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 8px; width: 500px; max-height: 400px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                    <div style="padding: 15px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0;">已保存的搜索条件</h4>
                        <button onclick="document.getElementById('savedSearchesModal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
                    </div>
                    <div style="max-height: 320px; overflow-y: auto;">
        `;

        filtered.forEach((saved) => {
            modalHtml += `
                <div style="padding: 12px 15px; border-bottom: 1px solid #f8f9fa; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${escapeHtml(saved.name)}</div>
                        <div style="font-size: 11px; color: #999;">${formatDate(saved.createdAt)} · ${saved.conditions.conditions.length} 条件</div>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-sm btn-primary" onclick="AdvancedSearch.loadSavedSearch(${saved.id})">应用</button>
                        <button class="btn btn-sm btn-danger" onclick="AdvancedSearch.deleteSavedSearch(${saved.id})">删除</button>
                    </div>
                </div>
            `;
        });

        modalHtml += `
                    </div>
                </div>
            </div>
        `;

        // 移除旧模态框
        const oldModal = document.getElementById('savedSearchesModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function loadSavedSearch(id) {
        const saved = state.savedSearches.find(s => s.id === id);
        if (!saved) return;

        // 切换到正确的页面
        const isDevicePage = document.getElementById('page-device').classList.contains('active');
        if ((saved.pageType === 'device' && !isDevicePage) || (saved.pageType === 'merge' && isDevicePage)) {
            // 需要切换页面
            const targetPage = saved.pageType === 'device' ? 'page-device' : 'page-database';
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(targetPage).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            if (saved.pageType === 'device') {
                document.querySelector('.nav-item[data-page="device"]').classList.add('active');
            } else {
                document.querySelector('.nav-item[data-page="database"]').classList.add('active');
            }
        }

        // 重新渲染面板（模态框）
        if (!state.isAdvancedMode) {
            toggleAdvancedSearch();
        } else {
            renderAdvancedSearchModal();
        }

        // 等待模态框渲染完成后应用条件
        setTimeout(() => {
            const container = document.getElementById('searchConditions');
            if (container) {
                container.innerHTML = '';

                saved.conditions.conditions.forEach(cond => {
                    addSearchCondition();
                    const lastCondition = container.lastElementChild;
                    if (lastCondition) {
                        lastCondition.querySelector('.condition-field').value = cond.field;
                        lastCondition.querySelector('.condition-operator').value = cond.operator;
                        lastCondition.querySelector('.condition-value').value = cond.value || '';

                        // 如果是"为空"或"不为空"，禁用输入框
                        if (cond.operator === 'is_empty' || cond.operator === 'not_empty') {
                            lastCondition.querySelector('.condition-value').disabled = true;
                            lastCondition.querySelector('.condition-value').placeholder = '(无需输入)';
                        }
                    }
                });
            }
        }, 50);

        // 关闭已保存条件模态框
        const modal = document.getElementById('savedSearchesModal');
        if (modal) modal.remove();

        showToast(`已应用搜索条件：${saved.name}`, false);
    }

    function deleteSavedSearch(id) {
        const saved = state.savedSearches.find(s => s.id === id);
        if (!saved) return;

        if (!confirm(`确定要删除"${saved.name}"吗？`)) return;

        state.savedSearches = state.savedSearches.filter(s => s.id !== id);
        localStorage.setItem('savedSearches', JSON.stringify(state.savedSearches));

        // 刷新列表
        showSavedSearches();
        showToast('搜索条件已删除', false);
    }

    function clearAll() {
        const container = document.getElementById('searchConditions');
        if (container) {
            container.innerHTML = `
                <div id="noConditionsHint" style="text-align: center; color: #999; padding: 20px;">
                    点击"添加条件"开始筛选
                </div>
            `;
        }
    }

    function removeCondition(id) {
        const el = document.getElementById(id);
        if (el) {
            el.remove();
            // 如果没有条件了，显示提示
            const container = document.getElementById('searchConditions');
            if (container && container.children.length === 0) {
                container.innerHTML = `
                    <div id="noConditionsHint" style="text-align: center; color: #999; padding: 20px;">
                        点击"添加条件"开始筛选
                    </div>
                `;
            }
        }
    }

    // ==================== 工具函数 ====================

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString();
    }

    function showToast(message, isError = false) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, isError);
        } else {
            alert(message);
        }
    }

    // ==================== 导出API ====================

    window.AdvancedSearch = {
        init,
        toggleAdvancedSearch,
        addSearchCondition,
        removeCondition,
        clearAll,
        executeSearch,
        performSearch,
        performSearchMerge,
        saveSearch,
        showSavedSearches,
        loadSavedSearch,
        deleteSavedSearch,
        getSearchParams: buildSearchParams
    };

})(window);
