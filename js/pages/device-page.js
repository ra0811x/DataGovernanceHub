/**
 * 数据概览页面模块（增强版）
 * 包含列配置管理、编辑、分页等完整功能
 * 深化迁移版本
 */

(function(window) {
    'use strict';

    // ==================== 页面状态 ====================
    const state = {
        currentPage: 1,
        pageSize: 50,
        pendingPageSize: 50,
        totalRecords: 0,
        currentCategory: '',
        searchValue: '',
        dataRequestId: 0,
        currentData: [],
        editingId: null,

        // 列配置
        columns: [],
        allConfigs: {},
        sourceFile: '',
        headerHeight: 40,
        pendingHeaderHeight: 40,
        actionColumnConfig: { width: 120, color: '#495057' }
    };

    // ==================== DOM 元素缓存 ====================
    const elements = {
        tableHeader: null,
        tableBody: null,
        searchInput: null,
        paginationInfo: null,
        prevBtn: null,
        nextBtn: null,
        displayCount: null,
        columnPanel: null
    };

    function resetWorkspaceView() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
        }
        if (window.advancedFilterState && window.advancedFilterState.device) {
            window.advancedFilterState.device = null;
            if (typeof window.renderAdvancedFilterSummary === 'function') {
                window.renderAdvancedFilterSummary('device');
            }
        }
        state.currentPage = 1;
        loadData();
    }

    function updateEmptyState(options) {
        const emptyState = document.getElementById('deviceEmptyState');
        const badgeEl = document.getElementById('deviceEmptyStateBadge');
        const titleEl = document.getElementById('deviceEmptyStateTitle');
        const descEl = document.getElementById('deviceEmptyStateDesc');
        const auxBtn = document.getElementById('deviceEmptyStateAuxBtn');
        const tableContainer = document.getElementById('deviceTableContainer');
        const pagination = document.getElementById('devicePagination');

        if (!emptyState || !badgeEl || !titleEl || !descEl || !auxBtn || !tableContainer || !pagination) {
            return;
        }

        if (options && options.hasData) {
            emptyState.hidden = true;
            tableContainer.hidden = false;
            pagination.hidden = false;
            auxBtn.hidden = true;
            auxBtn.onclick = null;
            return;
        }

        let badge = '数据概览';
        let title = '当前还没有导入任何资产数据';
        let desc = '可点击“导入Excel”批量导入数据，或点击“新增资产”先录入一条记录。';
        let auxLabel = '';
        let auxHandler = null;

        if (options && options.error) {
            badge = '加载失败';
            title = '暂时无法读取数据概览';
            desc = options.message || '请确认后端服务已经启动，再点击“重新加载”重试。';
            auxLabel = '重新加载';
            auxHandler = loadData;
        } else if (options && (options.hasSearch || options.hasFilter)) {
            badge = '无匹配结果';
            title = '当前条件下没有找到数据';
            desc = options.hasFilter
                ? '请调整关键词或高级筛选条件后重试，也可以直接清空当前条件恢复全量视图。'
                : '请调整搜索关键词后重试，也可以直接清空当前条件恢复全量视图。';
            auxLabel = '清空条件';
            auxHandler = resetWorkspaceView;
        } else if (options && options.noColumns) {
            badge = '等待配置';
            title = '当前还没有可显示的列表列';
            desc = '请先确认列配置或导入一份数据源，随后页面会自动显示可用字段。';
            auxLabel = '重新加载';
            auxHandler = loadData;
        }

        badgeEl.textContent = badge;
        titleEl.textContent = title;
        descEl.textContent = desc;
        emptyState.hidden = false;
        tableContainer.hidden = true;
        pagination.hidden = true;

        if (auxLabel && auxHandler) {
            auxBtn.hidden = false;
            auxBtn.textContent = auxLabel;
            auxBtn.onclick = auxHandler;
        } else {
            auxBtn.hidden = true;
            auxBtn.onclick = null;
        }
    }

    // ==================== 列配置管理 ====================

    /**
     * 渲染列切换面板
     */
    function renderColumnToggles() {
        const container = document.getElementById('columnToggles');
        if (!container) return;

        container.innerHTML = state.columns.map((col, index) => {
            const statusClass = col.visible ? 'active' : 'inactive';
            const statusText = col.visible ? '显示' : '隐藏';
            const row = `
                <div class="col-toggle-row ${statusClass}" data-index="${index}">
                    <span class="col-toggle-name">${col.name}</span>
                    <div class="col-toggle-actions">
                        <button class="btn-toggle" onclick="DevicePage.toggleColumn(${index})">${statusText}</button>
                        <button class="btn-delete" onclick="DevicePage.removeColumn(${index})">删除</button>
                    </div>
                </div>
            `;
            return row;
        }).join('');
    }

    /**
     * 切换列显示/隐藏
     * @param {number} index - 列索引
     */
    function toggleColumn(index) {
        state.columns[index].visible = !state.columns[index].visible;
        renderColumnToggles();
        renderTable();
    }

    /**
     * 删除列
     * @param {number} index - 列索引
     */
    function removeColumn(index) {
        if (!confirm('确认要删除此列吗？')) return;

        state.columns.splice(index, 1);
        renderColumnToggles();
        showToast('列已删除，请点击保存按钮生效', false);
    }

    /**
     * 显示/隐藏列面板
     */
    function toggleColumnPanel() {
        const panel = document.getElementById('columnPanel');
        if (panel) {
            panel.classList.toggle('show');
        }
    }

    /**
     * 保存列设置
     */
    async function saveColumnSettings() {
        try {
            const modeKey = state.currentCategory || '全部';
            const modeColor = document.getElementById('headerColorInput')?.value;

            // 统一所有列的颜色
            state.columns.forEach(col => col.color = modeColor);

            // 获取操作列配置
            const actionWidth = parseInt(document.getElementById('actionWidthInput')?.value) || 120;
            state.actionColumnConfig.width = actionWidth;
            state.actionColumnConfig.color = document.getElementById('actionColorInput')?.value || '#495057';

            // 更新配置
            state.allConfigs[modeKey] = {
                columns: state.columns,
                pageSize: state.pendingPageSize,
                sourceFile: state.sourceFile,
                headerHeight: state.pendingHeaderHeight,
                actionColumn: state.actionColumnConfig
            };

            const response = await fetch(API_BASE + '/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.allConfigs)
            });

            const result = await response.json();

            if (result.success) {
                state.pageSize = state.pendingPageSize;
                state.headerHeight = state.pendingHeaderHeight;
                state.currentPage = 1;
                await loadData();
                showToast('列设置已保存', false);
            } else {
                showToast(result.error || '保存失败', true);
            }
        } catch (e) {
            console.error('保存列设置失败:', e);
            showToast('保存失败', true);
        }
    }

    /**
     * 预览每页显示数量
     * @param {number} value - 页面大小
     */
    function previewPageSize(value) {
        state.pendingPageSize = parseInt(value);
    }

    /**
     * 获取实际页面大小
     * @returns {number}
     */
    function getActualPageSize() {
        return state.pageSize === -1 ? 999999 : state.pageSize;
    }

    /**
     * 获取待保存的页面大小
     * @returns {number}
     */
    function getActualPendingPageSize() {
        return state.pendingPageSize === -1 ? 999999 : state.pendingPageSize;
    }

    // ==================== 数据加载 ====================

    /**
     * 加载数据
     */
    async function loadData() {
        const requestId = ++state.dataRequestId;

        const search = elements.searchInput?.value || '';
        const actualPageSize = getActualPageSize();

        const params = new URLSearchParams({
            page: state.currentPage,
            pageSize: actualPageSize,
            search: search,
            category: state.currentCategory
        });

        try {
            const res = await fetch(API_BASE + '/assets?' + params);
            const result = await res.json();

            // 只处理最新的请求响应
            if (requestId !== state.dataRequestId) {
                return;
            }

            state.totalRecords = result.total || 0;
            state.currentData = result.data || [];
            renderTable();
            updatePagination();
            updateStats();
        } catch (e) {
            // 只处理最新的请求错误
            if (requestId === state.dataRequestId) {
                showToast('加载数据失败，请确保后端服务已启动', true);
                if (elements.tableBody) {
                    elements.tableBody.innerHTML = '<tr><td colspan="22" class="loading">无法连接到后端服务，请先运行: 启动数管系统.bat 或 python core/app.py</td></tr>';
                }
            }
        }
    }

    /**
     * 刷新数据
     */
    function refresh() {
        state.currentPage = 1;
        loadData();
    }

    // ==================== 渲染函数 ====================

    /**
     * 渲染表格
     * @param {Array} data - 数据数组
     */
    function renderTable(data) {
        if (!data) data = state.currentData;
        else state.currentData = data;

        const visibleCols = state.columns.filter(c => c.visible);
        const modeColor = getCurrentModeColor();

        // 渲染表头
        if (elements.tableHeader) {
            elements.tableHeader.innerHTML = visibleCols.map(c => {
                const width = c.width || 120;
                return '<th style="width:' + width + 'px;max-width:' + width + 'px;height:' + state.pendingHeaderHeight + 'px;vertical-align:middle;background-color:' + modeColor + ';" title="' + c.name + '">' + c.name + '</th>';
            }).join('') + '<th class="col-actions" style="width:' + state.actionColumnConfig.width + 'px;max-width:' + state.actionColumnConfig.width + 'px;height:' + state.pendingHeaderHeight + 'px;vertical-align:middle;background-color:' + state.actionColumnConfig.color + ';">操作</th>';
        }

        // 渲染数据
        if (elements.tableBody) {
            if (!data || data.length === 0) {
                elements.tableBody.innerHTML = '<tr><td colspan="22" class="loading">暂无数据</td></tr>';
                return;
            }

            // 按序号列排序
            data.sort((a, b) => {
                const seqA = parseFloat(a['序号']) || 0;
                const seqB = parseFloat(b['序号']) || 0;
                return seqA - seqB;
            });

            elements.tableBody.innerHTML = data.map(row => {
                return '<tr>' + visibleCols.map(c => {
                    const width = c.width || 120;
                    let v = row[c.name];
                    const cellContent = (v || '-');
                    return '<td style="width:' + width + 'px;max-width:' + width + 'px;" class="' + (!v ? 'empty' : '') + '" title="' + cellContent + '">' + cellContent + '</td>';
                }).join('') + '<td class="col-actions" style="width:' + state.actionColumnConfig.width + 'px;max-width:' + state.actionColumnConfig.width + 'px;">' +
                    '<button class="btn btn-sm" onclick="DevicePage.editRow(' + row.id + ')">编辑</button>' +
                    '</td></tr>';
            }).join('');
        }
    }

    /**
     * 更新分页控件
     */
    function updatePagination() {
        if (state.pageSize === -1) {
            // 全部显示模式
            if (elements.paginationInfo) {
                elements.paginationInfo.textContent = '全部显示，共 ' + state.totalRecords + ' 条';
            }
            if (elements.prevBtn) elements.prevBtn.disabled = true;
            if (elements.nextBtn) elements.nextBtn.disabled = true;
        } else {
            const totalPages = Math.ceil(state.totalRecords / state.pageSize) || 1;
            if (elements.paginationInfo) {
                elements.paginationInfo.textContent = '第 ' + state.currentPage + ' / ' + totalPages + ' 页，共 ' + state.totalRecords + ' 条';
            }
            if (elements.prevBtn) elements.prevBtn.disabled = state.currentPage === 1;
            if (elements.nextBtn) elements.nextBtn.disabled = state.currentPage >= totalPages;
        }
    }

    /**
     * 更新统计信息
     */
    function updateStats() {
        if (elements.displayCount) {
            elements.displayCount.textContent = state.totalRecords;
        }
    }

    /**
     * 获取当前模式颜色
     * @returns {string}
     */
    function getCurrentModeColor() {
        const modeKey = state.currentCategory || '全部';
        const mode = window.categories?.find(c => c.value === modeKey);
        return mode?.color || '#005fe0';
    }

    // ==================== 编辑功能 ====================

    /**
     * 编辑行
     * @param {number} id - 数据ID
     */
    async function editRow(id) {
        state.editingId = id;
        try {
            const res = await fetch(API_BASE + '/assets/' + id);
            const row = await res.json();

            const modal = document.getElementById('editModal');
            const title = document.getElementById('modalTitle');
            const deleteBtnArea = document.getElementById('deleteBtnArea');
            const form = document.getElementById('editForm');

            if (title) {
                title.textContent = '编辑资产 - ' + (row['数据资产名称'] || row['业务系统']);
            }
            if (deleteBtnArea) {
                deleteBtnArea.style.display = 'block';
            }

            if (form) {
                form.innerHTML = state.columns.map(col => `
                    <div class="form-group">
                        <label>${col.name}</label>
                        <input type="text" id="edit_${col.name}" value="${row[col.name] || ''}">
                    </div>
                `).join('');
            }

            if (modal) {
                modal.classList.add('show');
            }
        } catch (e) {
            showToast('加载资产信息失败', true);
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 上一页
     */
    function prevPage() {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadData();
        }
    }

    /**
     * 下一页
     */
    function nextPage() {
        const totalPages = Math.ceil(state.totalRecords / state.pageSize);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            loadData();
        }
    }

    /**
     * 跳转到指定页
     */
    function jumpToPage(page) {
        const totalPages = Math.ceil(state.totalRecords / state.pageSize) || 1;
        if (page >= 1 && page <= totalPages) {
            state.currentPage = page;
            loadData();
        }
    }

    /**
     * 搜索处理
     */
    function handleSearch() {
        state.currentPage = 1;
        loadData();
    }

    /**
     * 切换分类
     * @param {string} category - 分类名称
     */
    function switchCategory(category) {
        state.currentCategory = category;
        state.currentPage = 1;
        loadData();
    }

    // ==================== 初始化 ====================

    /**
     * 初始化页面模块
     */
    function init() {
        // 缓存 DOM 元素
        elements.tableHeader = document.getElementById('tableHeader');
        elements.tableBody = document.getElementById('tableBody');
        elements.searchInput = document.getElementById('searchInput');
        elements.paginationInfo = document.getElementById('paginationInfo');
        elements.prevBtn = document.getElementById('prevBtn');
        elements.nextBtn = document.getElementById('nextBtn');
        elements.displayCount = document.getElementById('displayCount');
        elements.columnPanel = document.getElementById('columnPanel');

        // 绑定事件
        bindEvents();

        // 加载初始数据
        loadData();
    }

    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 搜索输入
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // 分页按钮
        if (elements.prevBtn) {
            elements.prevBtn.onclick = prevPage;
        }
        if (elements.nextBtn) {
            elements.nextBtn.onclick = nextPage;
        }

        // 跳转按钮
        const jumpBtn = document.getElementById('jumpPageBtn');
        const jumpInput = document.getElementById('jumpPageInput');
        if (jumpBtn) {
            jumpBtn.onclick = () => {
                const page = parseInt(jumpInput?.value);
                jumpToPage(page);
            };
        }
        if (jumpInput) {
            jumpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const page = parseInt(jumpInput.value);
                    jumpToPage(page);
                }
            });
        }
    }

    /**
     * 防抖函数
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== 导出模块 API ====================

    window.DevicePage = {
        init: init,
        loadData: loadData,
        refresh: refresh,
        switchCategory: switchCategory,
        editRow: editRow,
        state: state,

        // 列配置管理
        renderColumnToggles: renderColumnToggles,
        toggleColumn: toggleColumn,
        removeColumn: removeColumn,
        toggleColumnPanel: toggleColumnPanel,
        saveColumnSettings: saveColumnSettings,
        previewPageSize: previewPageSize,

        // 分页
        prevPage: prevPage,
        nextPage: nextPage,
        jumpToPage: jumpToPage
    };

    // 兼容旧的全局函数调用
    window.renderColumnToggles = renderColumnToggles;
    window.toggleColumn = toggleColumn;
    window.removeColumn = removeColumn;
    window.toggleColumnPanel = toggleColumnPanel;
    window.saveColumnSettings = saveColumnSettings;
    window.previewPageSize = previewPageSize;
    window.editRow = editRow;

})(window);
