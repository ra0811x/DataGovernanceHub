/**
 * 合并结果页面模块（增强版）
 * 包含列配置管理、编辑、分页等完整功能
 * 深化迁移版本
 */

(function(window) {
    'use strict';

    // ==================== 页面状态 ====================
    const state = {
        currentPage: 1,
        pageSize: 100,
        pendingPageSize: 100,
        totalRecords: 0,
        currentCategory: '',
        searchValue: '',
        dataRequestId: 0,
        currentData: [],
        editingId: null,

        // 列配置
        columns: [],
        sourceFile: '',
        headerHeight: 40,
        pendingHeaderHeight: 40,
        headerColor: '#6c757d',
        actionColumnConfig: { width: 120, color: '#6c757d' },
        isColumnsLoaded: false
    };

    // ==================== DOM 元素缓存 ====================
    const elements = {
        tableBody: null,
        tableHeader: null,
        searchInput: null,
        paginationInfo: null,
        prevBtn: null,
        nextBtn: null,
        displayCount: null,
        columnPanel: null,
        columnToggles: null,
        sourceFileDisplay: null
    };

    // ==================== 初始化 ====================

    /**
     * 初始化合并结果页面
     */
    function init() {
        // 缓存 DOM 元素
        cacheElements();

        // 绑定事件
        bindEvents();

        // 加载初始数据
        loadData();
    }

    /**
     * 缓存 DOM 元素
     */
    function cacheElements() {
        elements.tableBody = document.getElementById('tableBody2');
        elements.tableHeader = document.getElementById('tableHeader2');
        elements.searchInput = document.getElementById('searchInput2');
        elements.paginationInfo = document.getElementById('paginationInfo2');
        elements.prevBtn = document.getElementById('prevBtn2');
        elements.nextBtn = document.getElementById('nextBtn2');
        elements.displayCount = document.getElementById('displayCount2');
        elements.columnPanel = document.getElementById('columnPanel2');
        elements.columnToggles = document.getElementById('columnToggles2');
        elements.sourceFileDisplay = document.getElementById('sourceFileDisplay2');
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
            elements.prevBtn.addEventListener('click', prevPage);
        }
        if (elements.nextBtn) {
            elements.nextBtn.addEventListener('click', nextPage);
        }

        // 跳转按钮
        const jumpBtn = document.getElementById('jumpPageBtn2');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', jumpToPage);
        }

        // 跳转输入框回车
        const jumpInput = document.getElementById('jumpPageInput2');
        if (jumpInput) {
            jumpInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') jumpToPage();
            });
        }
    }

    // ==================== 列配置管理 ====================

    /**
     * 加载列配置
     */
    async function loadColumnConfig() {
        if (state.isColumnsLoaded) return;

        try {
            const res = await fetch(API_BASE + '/merge/columns');
            const config = await res.json();

            state.columns = config.columns || [];
            state.pageSize = config.pageSize || 100;
            state.pendingPageSize = state.pageSize;
            state.sourceFile = config.sourceFile || '';
            state.headerHeight = config.headerHeight || 40;
            state.pendingHeaderHeight = state.headerHeight;
            state.headerColor = config.headerColor || '#6c757d';
            state.actionColumnConfig = config.actionColumn || { width: 120, color: '#6c757d' };

            state.isColumnsLoaded = true;
            renderColumnToggles();
            updateSourceFileDisplay();
        } catch (e) {
            console.error('加载合并结果列配置失败:', e);
            state.columns = [];
            state.pageSize = 100;
            state.pendingPageSize = 100;
            state.sourceFile = '';
            state.headerHeight = 40;
            state.pendingHeaderHeight = 40;
            state.headerColor = '#6c757d';
            state.actionColumnConfig = { width: 120, color: '#6c757d' };
            state.isColumnsLoaded = true;
            renderColumnToggles();
            updateSourceFileDisplay();
        }
    }

    /**
     * 渲染列切换面板
     */
    function renderColumnToggles() {
        if (!elements.columnToggles) return;

        if (!state.columns || state.columns.length === 0) {
            elements.columnToggles.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无列配置，请导入Excel文件</div>';
            return;
        }

        elements.columnToggles.innerHTML = state.columns.map((col, i) => {
            return '<label class="column-toggle' + (col.visible ? '' : ' hidden') + '">' +
                '<div class="column-toggle-top">' +
                '<input type="checkbox" ' + (col.visible ? 'checked' : '') + ' onchange="MergePage.toggleColumn(' + i + ')"> ' +
                '<span class="column-toggle-name" contenteditable="true" onblur="MergePage.updateColumnName(' + i + ', this.textContent)">' + col.name + '</span>' +
                '</div>' +
                '<div class="column-toggle-bottom">' +
                '<label>宽度:</label>' +
                '<input type="number" min="50" max="500" step="10" value="' + (col.width || 120) + '" onchange="MergePage.changeColumnWidth(' + i + ', this.value)">' +
                '<button class="column-toggle-btn delete" onclick="MergePage.removeColumn(' + i + ')">删除</button>' +
                '</div>' +
                '</label>';
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
     * 修改列宽
     * @param {number} index - 列索引
     * @param {number} width - 列宽
     */
    function changeColumnWidth(index, width) {
        state.columns[index].width = parseInt(width) || 120;
        renderTable();
    }

    /**
     * 更新列名
     * @param {number} index - 列索引
     * @param {string} newName - 新列名
     */
    function updateColumnName(index, newName) {
        newName = newName.trim();
        if (!newName) {
            renderColumnToggles();
            return;
        }
        if (newName !== state.columns[index].name) {
            if (state.columns.some((col, i) => i !== index && col.name === newName)) {
                showToast('列名已存在', true);
                renderColumnToggles();
                return;
            }
            state.columns[index].name = newName;
            renderTable();
            showToast('列名已修改，请点击保存按钮生效', false);
        }
    }

    /**
     * 删除列
     * @param {number} index - 列索引
     */
    function removeColumn(index) {
        if (!confirm('确定要删除列 "' + state.columns[index].name + '" 吗？')) return;
        state.columns.splice(index, 1);
        renderColumnToggles();
        showToast('列已删除，请点击保存按钮生效', false);
    }

    /**
     * 显示/隐藏列面板
     */
    function toggleColumnPanel() {
        if (elements.columnPanel) {
            elements.columnPanel.classList.toggle('show');
        }
    }

    /**
     * 保存列设置
     */
    async function saveColumnSettings() {
        try {
            const config = {
                columns: state.columns,
                pageSize: state.pendingPageSize,
                sourceFile: state.sourceFile,
                headerHeight: state.pendingHeaderHeight,
                headerColor: state.headerColor,
                actionColumn: state.actionColumnConfig
            };

            const response = await fetch(API_BASE + '/merge/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
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
     * 更新源文件显示
     */
    function updateSourceFileDisplay() {
        if (elements.sourceFileDisplay) {
            elements.sourceFileDisplay.textContent = state.sourceFile || '未导入';
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
     * 预览表头高度
     * @param {number} value - 表头高度
     */
    function previewHeaderHeight(value) {
        state.pendingHeaderHeight = parseInt(value);
    }

    /**
     * 获取实际页面大小
     * @returns {number}
     */
    function getActualPageSize() {
        return state.pageSize === -1 ? 999999 : state.pageSize;
    }

    // ==================== 数据加载 ====================

    /**
     * 加载合并结果数据
     */
    async function loadData() {
        const requestId = ++state.dataRequestId;

        const params = {
            page: state.currentPage,
            pageSize: getActualPageSize(),
            search: state.searchValue,
            category: state.currentCategory
        };

        try {
            const result = await DataService.getMergeResults(params);

            // 只处理最新的请求响应
            if (requestId !== state.dataRequestId) {
                return;
            }

            state.totalRecords = result.total || 0;
            renderTable(result.data || []);
            updatePagination();
            updateStats();
        } catch (e) {
            if (requestId === state.dataRequestId) {
                showToast('加载数据失败', true);
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

        // 渲染表头
        if (elements.tableHeader) {
            elements.tableHeader.innerHTML = visibleCols.map(c => {
                const width = c.width || 120;
                return '<th style="width:' + width + 'px;max-width:' + width + 'px;height:' + state.pendingHeaderHeight + 'px;vertical-align:middle;background-color:' + state.headerColor + ';" title="' + c.name + '">' + c.name + '</th>';
            }).join('') + '<th class="col-actions" style="width:' + state.actionColumnConfig.width + 'px;max-width:' + state.actionColumnConfig.width + 'px;height:' + state.pendingHeaderHeight + 'px;vertical-align:middle;background-color:' + state.actionColumnConfig.color + ';">操作</th>';
        }

        // 渲染数据
        if (elements.tableBody) {
            if (!data || data.length === 0) {
                const colspan = visibleCols.length + 1;
                elements.tableBody.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">暂无数据</td></tr>';
                return;
            }

            elements.tableBody.innerHTML = data.map(row => {
                return '<tr>' + visibleCols.map(c => {
                    const width = c.width || 120;
                    const cellValue = row[c.name];
                    const cellContent = (cellValue !== undefined && cellValue !== null && cellValue !== '') ? cellValue : '-';
                    return '<td style="width:' + width + 'px;max-width:' + width + 'px;" class="' + (!cellValue ? 'empty' : '') + '" title="' + cellContent + '">' + cellContent + '</td>';
                }).join('') + '<td class="col-actions" style="width:' + state.actionColumnConfig.width + 'px;max-width:' + state.actionColumnConfig.width + 'px;">' +
                    '<button class="btn btn-sm" onclick="MergePage.editRow(' + row.id + ')">编辑</button>' +
                    '</td></tr>';
            }).join('');
        }
    }

    /**
     * 更新分页控件
     */
    function updatePagination() {
        if (!elements.paginationInfo) return;

        const totalPages = Math.ceil(state.totalRecords / state.pageSize) || 1;
        elements.paginationInfo.textContent = '第 ' + state.currentPage + ' / ' + totalPages + ' 页，共 ' + state.totalRecords + ' 条';

        if (elements.prevBtn) {
            elements.prevBtn.disabled = state.currentPage === 1;
        }
        if (elements.nextBtn) {
            elements.nextBtn.disabled = state.currentPage >= totalPages;
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

    // ==================== 事件处理 ====================

    /**
     * 搜索处理
     */
    function handleSearch() {
        if (elements.searchInput) {
            state.searchValue = elements.searchInput.value;
        }
        state.currentPage = 1;
        loadData();
    }

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
    function jumpToPage() {
        const input = document.getElementById('jumpPageInput2');
        if (!input) return;

        const page = parseInt(input.value);
        const totalPages = Math.ceil(state.totalRecords / state.pageSize);

        if (page >= 1 && page <= totalPages) {
            state.currentPage = page;
            loadData();
            input.value = '';
        } else {
            showToast('请输入有效的页码', true);
        }
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

    // ==================== 编辑功能 ====================

    /**
     * 编辑行
     * @param {number} id - 数据ID
     */
    async function editRow(id) {
        try {
            // 调用全局编辑模态框函数
            if (window.showMergeEditModal) {
                window.showMergeEditModal(id);
            }
        } catch (e) {
            showToast('加载信息失败', true);
        }
    }

    // ==================== 工具函数 ====================

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

    window.MergePage = {
        init: init,
        loadData: loadData,
        loadColumnConfig: loadColumnConfig,
        refresh: refresh,
        switchCategory: switchCategory,
        editRow: editRow,
        state: state,

        // 列配置管理
        renderColumnToggles: renderColumnToggles,
        toggleColumn: toggleColumn,
        changeColumnWidth: changeColumnWidth,
        updateColumnName: updateColumnName,
        removeColumn: removeColumn,
        toggleColumnPanel: toggleColumnPanel,
        saveColumnSettings: saveColumnSettings,
        updateSourceFileDisplay: updateSourceFileDisplay,
        previewPageSize: previewPageSize,
        previewHeaderHeight: previewHeaderHeight,

        // 分页
        prevPage: prevPage,
        nextPage: nextPage,
        jumpToPage: jumpToPage
    };

    // 兼容旧的全局函数调用
    window.loadMergeData = loadData;
    window.loadMergeColumnConfig = loadColumnConfig;
    window.renderMergeTable = renderTable;
    window.renderColumnToggles2 = renderColumnToggles;
    window.toggleColumn2 = toggleColumn;
    window.changeColumnWidth2 = changeColumnWidth;
    window.updateColumnName2 = updateColumnName;
    window.deleteColumn2 = removeColumn;

})(window);
