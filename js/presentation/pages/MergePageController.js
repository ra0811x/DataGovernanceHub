/**
 * 合并结果页面控制器
 * 协调视图和业务逻辑，处理用户操作
 */

(function(window) {
    'use strict';

    /**
     * MergePageController 构造函数
     * @param {MergeService} mergeService - 合并业务服务
     * @param {ColumnService} columnService - 列配置业务服务
     * @param {EventBus} eventBus - 事件总线
     */
    function MergePageController(mergeService, columnService, eventBus) {
        this.mergeService = mergeService;
        this.columnService = columnService;
        this.eventBus = eventBus || window.EventBus;

        // 页面状态
        this.state = {
            currentPage: 1,
            pageSize: 100,
            totalRecords: 0,
            currentCategory: '',
            searchValue: '',
            columns: [],
            currentData: []
        };

        // DOM 元素缓存
        this.elements = {};
    }

    /**
     * 初始化控制器
     * @param {Object} options - 配置选项
     */
    MergePageController.prototype.init = function(options) {
        options = options || {};

        // 缓存 DOM 元素
        this._cacheElements(options.selectors);

        // 绑定事件
        this._bindEvents();

        // 加载初始数据
        this._loadInitialData();

        // 监听事件总线
        this._subscribeToEvents();

        // 发布初始化完成事件
        this.eventBus.emit('merge:page:initialized', {
            controller: this
        });
    };

    /**
     * 加载数据
     * @param {Object} options - 加载选项
     */
    MergePageController.prototype.loadData = function(options) {
        options = options || {};

        // 更新状态
        if (options.page !== undefined) {
            this.state.currentPage = options.page;
        }
        if (options.pageSize !== undefined) {
            this.state.pageSize = options.pageSize;
        }
        if (options.category !== undefined) {
            this.state.currentCategory = options.category;
        }
        if (options.search !== undefined) {
            this.state.searchValue = options.search;
        }

        // 显示加载状态
        this._showLoading();

        // 调用业务服务
        return this.mergeService.searchResults({
            page: this.state.currentPage,
            pageSize: this.state.pageSize,
            keyword: this.state.searchValue,
            category: this.state.currentCategory
        }).then(result => {
            this.state.totalRecords = result.total || 0;
            this.state.currentData = result.data || [];

            // 渲染数据
            this._renderData(this.state.currentData);
            this._updatePagination();
            this._updateStats();

            // 发布数据加载完成事件
            this.eventBus.emit('merge:data:loaded', {
                data: this.state.currentData,
                total: this.state.totalRecords
            });

            return result;
        }).catch(error => {
            this._showError(error);
            throw error;
        });
    };

    /**
     * 刷新数据
     */
    MergePageController.prototype.refresh = function() {
        this.state.currentPage = 1;
        return this.loadData();
    };

    /**
     * 切换分类
     * @param {string} category - 分类名称
     */
    MergePageController.prototype.switchCategory = function(category) {
        this.state.currentCategory = category || '';
        this.state.currentPage = 1;
        return this.loadData();
    };

    /**
     * 搜索
     * @param {string} keyword - 搜索关键词
     */
    MergePageController.prototype.search = function(keyword) {
        this.state.searchValue = keyword || '';
        this.state.currentPage = 1;
        return this.loadData();
    };

    /**
     * 翻页
     * @param {number} page - 页码
     */
    MergePageController.prototype.goToPage = function(page) {
        const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize) || 1;
        if (page >= 1 && page <= totalPages) {
            this.state.currentPage = page;
            return this.loadData();
        }
    };

    /**
     * 上一页
     */
    MergePageController.prototype.prevPage = function() {
        if (this.state.currentPage > 1) {
            return this.goToPage(this.state.currentPage - 1);
        }
    };

    /**
     * 下一页
     */
    MergePageController.prototype.nextPage = function() {
        const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize) || 1;
        if (this.state.currentPage < totalPages) {
            return this.goToPage(this.state.currentPage + 1);
        }
    };

    /**
     * 编辑行
     * @param {number} id - 数据 ID
     */
    MergePageController.prototype.editRow = function(id) {
        this.mergeService.getResultById(id).then(data => {
            // 发布编辑事件，由模态框处理
            this.eventBus.emit('merge:edit:requested', {
                id: id,
                data: data
            });
        }).catch(error => {
            this._showError(error);
        });
    };

    /**
     * 删除行
     * @param {number} id - 数据 ID
     */
    MergePageController.prototype.deleteRow = function(id) {
        this.mergeService.deleteResult(id).then(() => {
            // 刷新数据
            return this.refresh();
        }).then(() => {
            // 发布删除成功事件
            this.eventBus.emit('merge:delete:success', { id: id });
            this._showToast('删除成功', false);
        }).catch(error => {
            this._showError(error);
        });
    };

    /**
     * 保存列配置
     * @param {Object} config - 列配置
     */
    MergePageController.prototype.saveColumnSettings = function(config) {
        return this.columnService.saveMergeColumns(config).then(() => {
            // 刷新数据
            return this.refresh();
        }).then(() => {
            this._showToast('列设置已保存', false);
        }).catch(error => {
            this._showError(error);
        });
    };

    /**
     * 销毁控制器
     */
    MergePageController.prototype.destroy = function() {
        // 取消事件订阅
        if (this._unsubscribeFunctions) {
            this._unsubscribeFunctions.forEach(fn => fn());
        }

        // 清空 DOM 元素缓存
        this.elements = {};

        // 发布销毁事件
        this.eventBus.emit('merge:page:destroyed', {
            controller: this
        });
    };

    // ==================== 私有方法 ====================

    /**
     * 缓存 DOM 元素
     * @param {Object} selectors - 选择器配置
     */
    MergePageController.prototype._cacheElements = function(selectors) {
        selectors = selectors || {
            tableBody: 'tableBody2',
            tableHeader: 'tableHeader2',
            searchInput: 'searchInput2',
            paginationInfo: 'paginationInfo2',
            prevBtn: 'prevBtn2',
            nextBtn: 'nextBtn2',
            displayCount: 'displayCount2'
        };

        Object.keys(selectors).forEach(key => {
            const selector = selectors[key];
            if (typeof selector === 'string') {
                this.elements[key] = document.getElementById(selector);
            } else {
                this.elements[key] = selector;
            }
        });
    };

    /**
     * 绑定事件
     */
    MergePageController.prototype._bindEvents = function() {
        // 搜索输入
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', this._debounce((e) => {
                this.search(e.target.value);
            }, 300));
        }

        // 分页按钮
        if (this.elements.prevBtn) {
            this.elements.prevBtn.onclick = () => this.prevPage();
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.onclick = () => this.nextPage();
        }
    };

    /**
     * 加载初始数据
     */
    MergePageController.prototype._loadInitialData = function() {
        // 加载列配置
        this.columnService.getMergeColumns().then(config => {
            this.state.columns = config.columns || [];
            this.state.pageSize = config.pageSize || 100;
            return this.loadData();
        }).catch(error => {
            console.error('加载列配置失败:', error);
            // 即使列配置加载失败，也尝试加载数据
            return this.loadData();
        });
    };

    /**
     * 订阅事件总线
     */
    MergePageController.prototype._subscribeToEvents = function() {
        this._unsubscribeFunctions = [];

        // 监听模式切换事件
        const unsub1 = this.eventBus.on('mode:changed', (data) => {
            if (data.pageType === 'merge') {
                this.switchCategory(data.modeKey);
            }
        });
        this._unsubscribeFunctions.push(unsub1);

        // 监听数据刷新事件
        const unsub2 = this.eventBus.on('merge:data:refresh', () => {
            this.refresh();
        });
        this._unsubscribeFunctions.push(unsub2);

        // 监听数据导入完成事件
        const unsub3 = this.eventBus.on('merge:data:imported', () => {
            this.refresh();
        });
        this._unsubscribeFunctions.push(unsub3);
    };

    /**
     * 渲染数据
     * @param {Array} data - 数据数组
     */
    MergePageController.prototype._renderData = function(data) {
        if (!this.elements.tableBody) return;

        if (!data || data.length === 0) {
            const colspan = this.state.columns.filter(c => c.visible).length + 1;
            this.elements.tableBody.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">暂无数据</td></tr>';
            return;
        }

        // 渲染数据行
        this.elements.tableBody.innerHTML = data.map(row => {
            return '<tr>' + this.state.columns.map(col => {
                if (!col.visible) return '';
                const width = col.width || 120;
                const cellValue = row[col.name];
                const cellContent = (cellValue !== undefined && cellValue !== null && cellValue !== '') ? cellValue : '-';
                return '<td style="width:' + width + 'px;max-width:' + width + 'px;" class="' + (!cellValue ? 'empty' : '') + '" title="' + cellContent + '">' + cellContent + '</td>';
            }).join('') + '<td class="col-actions">' +
                '<button class="btn btn-sm" data-action="edit" data-id="' + row.id + '">编辑</button>' +
                '</td></tr>';
        }).join('');

        // 绑定行操作按钮事件
        this._bindRowActions();
    };

    /**
     * 绑定行操作按钮事件
     */
    MergePageController.prototype._bindRowActions = function() {
        const editButtons = this.elements.tableBody.querySelectorAll('[data-action="edit"]');
        editButtons.forEach(btn => {
            btn.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                this.editRow(id);
            };
        });
    };

    /**
     * 更新分页控件
     */
    MergePageController.prototype._updatePagination = function() {
        if (!this.elements.paginationInfo) return;

        const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize) || 1;
        this.elements.paginationInfo.textContent = '第 ' + this.state.currentPage + ' / ' + totalPages + ' 页，共 ' + this.state.totalRecords + ' 条';

        if (this.elements.prevBtn) {
            this.elements.prevBtn.disabled = this.state.currentPage === 1;
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.disabled = this.state.currentPage >= totalPages;
        }
    };

    /**
     * 更新统计信息
     */
    MergePageController.prototype._updateStats = function() {
        if (this.elements.displayCount) {
            this.elements.displayCount.textContent = this.state.totalRecords;
        }
    };

    /**
     * 显示加载状态
     */
    MergePageController.prototype._showLoading = function() {
        if (this.elements.tableBody) {
            this.elements.tableBody.innerHTML = '<tr><td colspan="22" class="loading">加载中...</td></tr>';
        }
    };

    /**
     * 显示错误
     * @param {Error} error - 错误对象
     */
    MergePageController.prototype._showError = function(error) {
        this._showToast(error.message || '操作失败', true);
    };

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {boolean} isError - 是否为错误消息
     */
    MergePageController.prototype._showToast = function(message, isError) {
        if (window.showToast) {
            window.showToast(message, isError);
        } else {
            console.log('[Toast]' + (isError ? ' [ERROR]' : '') + ' ' + message);
        }
    };

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间
     * @returns {Function} 防抖后的函数
     */
    MergePageController.prototype._debounce = function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // ==================== 导出模块 API ====================

    window.MergePageController = MergePageController;

})(window);
