/**
 * 列配置业务服务
 * 封装列配置业务逻辑，处理列显示/隐藏、列宽调整等
 */

(function(window) {
    'use strict';

    /**
     * ColumnService 构造函数
     * @param {ColumnsRepository} columnsRepo - 列配置仓库
     * @param {ModesRepository} modesRepo - 模式仓库（可选）
     */
    function ColumnService(columnsRepo, modesRepo) {
        this.columnsRepo = columnsRepo;
        this.modesRepo = modesRepo;
    }

    /**
     * 获取数据概览列配置
     * @param {string} modeKey - 模式键值（可选）
     * @returns {Promise<Object>} 列配置
     */
    ColumnService.prototype.getDeviceColumns = function(modeKey) {
        if (modeKey && modeKey !== '全部') {
            return this._getColumnsByMode(modeKey, 'device');
        }
        return this.columnsRepo.getDeviceColumns();
    };

    /**
     * 保存数据概览列配置
     * @param {Object} config - 列配置
     * @param {string} modeKey - 模式键值（可选）
     * @returns {Promise<Object>} 保存结果
     */
    ColumnService.prototype.saveDeviceColumns = function(config, modeKey) {
        const processedConfig = this._processConfig(config);

        if (modeKey && modeKey !== '全部') {
            return this._saveColumnsByMode(modeKey, processedConfig, 'device');
        }
        return this.columnsRepo.saveDeviceColumns(processedConfig);
    };

    /**
     * 获取合并结果列配置
     * @returns {Promise<Object>} 列配置
     */
    ColumnService.prototype.getMergeColumns = function() {
        return this.columnsRepo.getMergeColumns();
    };

    /**
     * 保存合并结果列配置
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ColumnService.prototype.saveMergeColumns = function(config) {
        const processedConfig = this._processConfig(config);
        return this.columnsRepo.saveMergeColumns(processedConfig);
    };

    /**
     * 获取所有模式的列配置
     * @returns {Promise<Object>} 所有列配置
     */
    ColumnService.prototype.getAllConfigs = function() {
        return this.columnsRepo.getAllConfigs();
    };

    /**
     * 切换列显示/隐藏
     * @param {number} columnIndex - 列索引
     * @param {Array} columns - 列配置数组
     * @returns {Array} 更新后的列配置
     */
    ColumnService.prototype.toggleColumnVisibility = function(columnIndex, columns) {
        if (!Array.isArray(columns) || columnIndex < 0 || columnIndex >= columns.length) {
            throw new Error('无效的列索引');
        }

        const updatedColumns = [...columns];
        updatedColumns[columnIndex] = {
            ...updatedColumns[columnIndex],
            visible: !updatedColumns[columnIndex].visible
        };

        return updatedColumns;
    };

    /**
     * 更新列宽
     * @param {number} columnIndex - 列索引
     * @param {number} width - 新列宽
     * @param {Array} columns - 列配置数组
     * @returns {Array} 更新后的列配置
     */
    ColumnService.prototype.updateColumnWidth = function(columnIndex, width, columns) {
        if (!Array.isArray(columns) || columnIndex < 0 || columnIndex >= columns.length) {
            throw new Error('无效的列索引');
        }

        const validatedWidth = this._validateColumnWidth(width);
        const updatedColumns = [...columns];
        updatedColumns[columnIndex] = {
            ...updatedColumns[columnIndex],
            width: validatedWidth
        };

        return updatedColumns;
    };

    /**
     * 更新列名
     * @param {number} columnIndex - 列索引
     * @param {string} newName - 新列名
     * @param {Array} columns - 列配置数组
     * @returns {Array} 更新后的列配置
     */
    ColumnService.prototype.updateColumnName = function(columnIndex, newName, columns) {
        if (!Array.isArray(columns) || columnIndex < 0 || columnIndex >= columns.length) {
            throw new Error('无效的列索引');
        }

        const trimmedName = (newName || '').trim();
        if (!trimmedName) {
            throw new Error('列名不能为空');
        }

        // 检查重名
        const existingIndex = columns.findIndex((col, i) =>
            i !== columnIndex && col.name === trimmedName
        );
        if (existingIndex !== -1) {
            throw new Error('列名已存在');
        }

        const updatedColumns = [...columns];
        updatedColumns[columnIndex] = {
            ...updatedColumns[columnIndex],
            name: trimmedName
        };

        return updatedColumns;
    };

    /**
     * 删除列
     * @param {number} columnIndex - 列索引
     * @param {Array} columns - 列配置数组
     * @returns {Array} 更新后的列配置
     */
    ColumnService.prototype.removeColumn = function(columnIndex, columns) {
        if (!Array.isArray(columns) || columnIndex < 0 || columnIndex >= columns.length) {
            throw new Error('无效的列索引');
        }

        const updatedColumns = [...columns];
        updatedColumns.splice(columnIndex, 1);

        return updatedColumns;
    };

    /**
     * 添加新列
     * @param {string} columnName - 列名
     * @param {Array} columns - 列配置数组
     * @returns {Array} 更新后的列配置
     */
    ColumnService.prototype.addColumn = function(columnName, columns) {
        const trimmedName = (columnName || '').trim();
        if (!trimmedName) {
            throw new Error('列名不能为空');
        }

        // 检查重名
        if (columns.some(col => col.name === trimmedName)) {
            throw new Error('列名已存在');
        }

        return [
            ...columns,
            {
                name: trimmedName,
                width: 120,
                visible: true
            }
        ];
    };

    /**
     * 获取可见列
     * @param {Array} columns - 列配置数组
     * @returns {Array} 可见列配置
     */
    ColumnService.prototype.getVisibleColumns = function(columns) {
        if (!Array.isArray(columns)) {
            return [];
        }
        return columns.filter(col => col.visible !== false);
    };

    /**
     * 设置表头高度
     * @param {number} height - 表头高度
     * @returns {number} 验证后的表头高度
     */
    ColumnService.prototype.validateHeaderHeight = function(height) {
        const numHeight = parseInt(height) || 40;
        return Math.max(20, Math.min(200, numHeight));
    };

    /**
     * 设置每页数量
     * @param {number} pageSize - 每页数量
     * @returns {number} 验证后的每页数量
     */
    ColumnService.prototype.validatePageSize = function(pageSize) {
        const numSize = parseInt(pageSize) || 50;
        return Math.max(10, Math.min(1000, numSize));
    };

    // ==================== 私有方法 ====================

    /**
     * 根据模式获取列配置
     * @param {string} modeKey - 模式键值
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object>} 列配置
     */
    ColumnService.prototype._getColumnsByMode = function(modeKey, pageType) {
        return this.columnsRepo.getByMode(modeKey).then(config => {
            if (config) {
                return config;
            }
            // 如果模式没有配置，返回默认配置
            return pageType === 'merge'
                ? this.columnsRepo.getMergeColumns()
                : this.columnsRepo.getDeviceColumns();
        });
    };

    /**
     * 保存模式的列配置
     * @param {string} modeKey - 模式键值
     * @param {Object} config - 列配置
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object>} 保存结果
     */
    ColumnService.prototype._saveColumnsByMode = function(modeKey, config, pageType) {
        return this.columnsRepo.saveByMode(modeKey, config);
    };

    /**
     * 处理列配置
     * @param {Object} config - 原始配置
     * @returns {Object} 处理后的配置
     */
    ColumnService.prototype._processConfig = function(config) {
        const processed = { ...config };

        // 处理列配置
        if (Array.isArray(processed.columns)) {
            processed.columns = processed.columns.map(col => ({
                name: col.name || '',
                width: this._validateColumnWidth(col.width),
                visible: col.visible !== undefined ? col.visible : true
            }));
        }

        // 处理表头高度
        if (processed.headerHeight !== undefined) {
            processed.headerHeight = this.validateHeaderHeight(processed.headerHeight);
        }

        // 处理每页数量
        if (processed.pageSize !== undefined) {
            processed.pageSize = this.validatePageSize(processed.pageSize);
        }

        // 处理操作列配置
        if (processed.actionColumn) {
            processed.actionColumn = {
                width: this._validateColumnWidth(processed.actionColumn.width || 120),
                color: processed.actionColumn.color || '#495057'
            };
        }

        return processed;
    };

    /**
     * 验证列宽
     * @param {number} width - 列宽
     * @returns {number} 验证后的列宽
     */
    ColumnService.prototype._validateColumnWidth = function(width) {
        const numWidth = parseInt(width) || 120;
        return Math.max(50, Math.min(500, numWidth));
    };

    // ==================== 导出模块 API ====================

    window.ColumnService = ColumnService;

})(window);
