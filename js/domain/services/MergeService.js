/**
 * 合并业务服务
 * 封装合并结果业务逻辑，与 UI 无关的纯业务处理
 */

(function(window) {
    'use strict';

    /**
     * MergeService 构造函数
     * @param {MergeRepository} repository - 合并仓库
     */
    function MergeService(repository) {
        this.repository = repository;
    }

    /**
     * 搜索合并结果
     * @param {Object} criteria - 搜索条件
     * @param {string} criteria.keyword - 关键词
     * @param {string} criteria.category - 分类
     * @param {number} criteria.page - 页码
     * @param {number} criteria.pageSize - 每页数量
     * @returns {Promise<{data: Array, total: number}>} 搜索结果
     */
    MergeService.prototype.searchResults = function(criteria) {
        const validatedCriteria = this._validateSearchCriteria(criteria);

        const params = {
            page: validatedCriteria.page || 1,
            pageSize: validatedCriteria.pageSize || 100,
            search: validatedCriteria.keyword || '',
            category: validatedCriteria.category || ''
        };

        return this.repository.findAll(params);
    };

    /**
     * 获取合并结果详情
     * @param {number} id - 合并结果 ID
     * @returns {Promise<Object>} 合并结果详情
     */
    MergeService.prototype.getResultById = function(id) {
        if (!id || id <= 0) {
            return Promise.reject(new Error('无效的 ID'));
        }
        return this.repository.findById(id);
    };

    /**
     * 创建合并结果
     * @param {Object} data - 合并结果数据
     * @returns {Promise<Object>} 创建结果
     */
    MergeService.prototype.createResult = function(data) {
        const validation = this._validateData(data);
        if (!validation.valid) {
            return Promise.reject(new Error(validation.message));
        }

        const processedData = this._applyBusinessRules(data);
        return this.repository.create(processedData);
    };

    /**
     * 更新合并结果
     * @param {number} id - 合并结果 ID
     * @param {Object} data - 合并结果数据
     * @returns {Promise<Object>} 更新结果
     */
    MergeService.prototype.updateResult = function(id, data) {
        if (!id || id <= 0) {
            return Promise.reject(new Error('无效的 ID'));
        }

        const validation = this._validateData(data);
        if (!validation.valid) {
            return Promise.reject(new Error(validation.message));
        }

        const processedData = this._applyBusinessRules(data);
        return this.repository.update(id, processedData);
    };

    /**
     * 删除合并结果
     * @param {number} id - 合并结果 ID
     * @returns {Promise<Object>} 删除结果
     */
    MergeService.prototype.deleteResult = function(id) {
        if (!id || id <= 0) {
            return Promise.reject(new Error('无效的 ID'));
        }
        return this.repository.remove(id);
    };

    /**
     * 批量删除合并结果
     * @param {Array<number>} ids - 合并结果 ID 数组
     * @returns {Promise<Object>} 删除结果
     */
    MergeService.prototype.batchDeleteResults = function(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return Promise.reject(new Error('请选择要删除的数据'));
        }
        return this.repository.batchRemove(ids);
    };

    /**
     * 获取列配置
     * @returns {Promise<Object>} 列配置
     */
    MergeService.prototype.getColumnConfig = function() {
        return this.repository.getColumns();
    };

    /**
     * 保存列配置
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    MergeService.prototype.saveColumnConfig = function(config) {
        const validation = this._validateColumnConfig(config);
        if (!validation.valid) {
            return Promise.reject(new Error(validation.message));
        }

        const processedConfig = this._processColumnConfig(config);
        return this.repository.saveColumns(processedConfig);
    };

    /**
     * 获取统计数据
     * @param {Object} filter - 筛选条件
     * @returns {Promise<Object>} 统计数据
     */
    MergeService.prototype.getStatistics = function(filter) {
        return this.repository.getStatistics(filter);
    };

    /**
     * 按分类筛选
     * @param {string} category - 分类
     * @param {Object} options - 筛选选项
     * @returns {Promise<Array>} 筛选结果
     */
    MergeService.prototype.filterByCategory = function(category, options) {
        if (!category) {
            return this.searchResults(options || {});
        }
        return this.repository.findByCategory(category, options);
    };

    /**
     * 导入合并结果数据
     * @param {FormData} formData - 包含文件的表单数据
     * @returns {Promise<Object>} 导入结果
     */
    MergeService.prototype.importData = function(formData) {
        if (!formData || !formData.has('file')) {
            return Promise.reject(new Error('请选择要导入的文件'));
        }
        return this.repository.import(formData);
    };

    /**
     * 导出合并结果数据
     * @param {Object} params - 导出参数
     * @returns {Promise<Blob>} 导出文件
     */
    MergeService.prototype.exportData = function(params) {
        return this.repository.export(params);
    };

    // ==================== 私有方法 ====================

    /**
     * 验证搜索条件
     * @param {Object} criteria - 搜索条件
     * @returns {Object} 验证后的条件
     */
    MergeService.prototype._validateSearchCriteria = function(criteria) {
        const validated = {
            page: 1,
            pageSize: 100,
            keyword: '',
            category: ''
        };

        if (!criteria) return validated;

        if (criteria.page && criteria.page > 0) {
            validated.page = criteria.page;
        }
        if (criteria.pageSize && criteria.pageSize > 0 && criteria.pageSize <= 1000) {
            validated.pageSize = criteria.pageSize;
        }
        if (typeof criteria.keyword === 'string') {
            validated.keyword = criteria.keyword.trim();
        }
        if (typeof criteria.category === 'string') {
            validated.category = criteria.category;
        }

        return validated;
    };

    /**
     * 验证数据
     * @param {Object} data - 数据
     * @returns {Object} 验证结果
     */
    MergeService.prototype._validateData = function(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, message: '数据无效' };
        }
        return { valid: true };
    };

    /**
     * 验证列配置
     * @param {Object} config - 列配置
     * @returns {Object} 验证结果
     */
    MergeService.prototype._validateColumnConfig = function(config) {
        if (!config || typeof config !== 'object') {
            return { valid: false, message: '列配置无效' };
        }

        if (!Array.isArray(config.columns)) {
            return { valid: false, message: '列配置格式错误' };
        }

        return { valid: true };
    };

    /**
     * 应用业务规则
     * @param {Object} data - 原始数据
     * @returns {Object} 处理后的数据
     */
    MergeService.prototype._applyBusinessRules = function(data) {
        const processed = { ...data };

        // 数据清洗
        Object.keys(processed).forEach(key => {
            if (typeof processed[key] === 'string') {
                processed[key] = processed[key].trim();
            }
        });

        return processed;
    };

    /**
     * 处理列配置
     * @param {Object} config - 原始列配置
     * @returns {Object} 处理后的列配置
     */
    MergeService.prototype._processColumnConfig = function(config) {
        const processed = { ...config };

        // 确保每列都有默认属性
        if (Array.isArray(processed.columns)) {
            processed.columns = processed.columns.map(col => ({
                name: col.name || '',
                width: col.width || 120,
                visible: col.visible !== undefined ? col.visible : true,
                ...col
            }));
        }

        return processed;
    };

    // ==================== 导出模块 API ====================

    window.MergeService = MergeService;

})(window);
