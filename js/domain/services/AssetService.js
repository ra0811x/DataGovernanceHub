/**
 * 资产业务服务
 * 封装资产业务逻辑，与 UI 无关的纯业务处理
 */

(function(window) {
    'use strict';

    /**
     * AssetService 构造函数
     * @param {AssetsRepository} repository - 资产仓库
     */
    function AssetService(repository) {
        this.repository = repository;
    }

    /**
     * 搜索资产
     * @param {Object} criteria - 搜索条件
     * @param {string} criteria.keyword - 关键词
     * @param {string} criteria.category - 分类
     * @param {number} criteria.page - 页码
     * @param {number} criteria.pageSize - 每页数量
     * @returns {Promise<{data: Array, total: number}>} 搜索结果
     */
    AssetService.prototype.searchAssets = function(criteria) {
        // 验证搜索条件
        const validatedCriteria = this._validateSearchCriteria(criteria);

        // 构建查询参数
        const params = {
            page: validatedCriteria.page || 1,
            pageSize: validatedCriteria.pageSize || 50,
            search: validatedCriteria.keyword || '',
            category: validatedCriteria.category || ''
        };

        return this.repository.findAll(params);
    };

    /**
     * 获取资产详情
     * @param {number} id - 资产 ID
     * @returns {Promise<Object>} 资产详情
     */
    AssetService.prototype.getAssetById = function(id) {
        if (!id || id <= 0) {
            return Promise.reject(new Error('无效的资产 ID'));
        }
        return this.repository.findById(id);
    };

    /**
     * 创建资产
     * @param {Object} assetData - 资产数据
     * @returns {Promise<Object>} 创建结果
     */
    AssetService.prototype.createAsset = function(assetData) {
        // 验证数据
        const validation = this._validateAssetData(assetData);
        if (!validation.valid) {
            return Promise.reject(new Error(validation.message));
        }

        // 应用业务规则
        const processedData = this._applyBusinessRules(assetData);

        return this.repository.create(processedData);
    };

    /**
     * 更新资产
     * @param {number} id - 资产 ID
     * @param {Object} assetData - 资产数据
     * @returns {Promise<Object>} 更新结果
     */
    AssetService.prototype.updateAsset = function(id, assetData) {
        if (!id || id <= 0) {
            return Promise.reject(new Error('无效的资产 ID'));
        }

        // 验证数据
        const validation = this._validateAssetData(assetData);
        if (!validation.valid) {
            return Promise.reject(new Error(validation.message));
        }

        // 应用业务规则
        const processedData = this._applyBusinessRules(assetData);

        return this.repository.update(id, processedData);
    };

    /**
     * 删除资产
     * @param {number} id - 资产 ID
     * @returns {Promise<Object>} 删除结果
     */
    AssetService.prototype.deleteAsset = function(id) {
        if (!id || id <= 0) {
            return Promise.reject(new Error('无效的资产 ID'));
        }
        return this.repository.remove(id);
    };

    /**
     * 批量删除资产
     * @param {Array<number>} ids - 资产 ID 数组
     * @returns {Promise<Object>} 删除结果
     */
    AssetService.prototype.batchDeleteAssets = function(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return Promise.reject(new Error('请选择要删除的资产'));
        }
        return this.repository.batchRemove(ids);
    };

    /**
     * 获取资产统计数据
     * @param {Object} filter - 筛选条件
     * @returns {Promise<Object>} 统计数据
     */
    AssetService.prototype.getStatistics = function(filter) {
        return this.repository.getStatistics(filter).then(stats => {
            // 应用统计计算逻辑
            return this._calculateStatistics(stats);
        });
    };

    /**
     * 获取资产分类列表
     * @returns {Promise<Array<string>>} 分类列表
     */
    AssetService.prototype.getCategories = function() {
        return this.repository.getCategories();
    };

    /**
     * 按分类筛选资产
     * @param {string} category - 分类
     * @param {Object} options - 筛选选项
     * @returns {Promise<Array>} 筛选结果
     */
    AssetService.prototype.filterByCategory = function(category, options) {
        if (!category) {
            return this.searchAssets(options || {});
        }
        return this.repository.findByCategory(category, options);
    };

    /**
     * 导入资产数据
     * @param {FormData} formData - 包含文件的表单数据
     * @returns {Promise<Object>} 导入结果
     */
    AssetService.prototype.importAssets = function(formData) {
        if (!formData || !formData.has('file')) {
            return Promise.reject(new Error('请选择要导入的文件'));
        }
        return this.repository.import(formData);
    };

    /**
     * 导出资产数据
     * @param {Object} params - 导出参数
     * @returns {Promise<Blob>} 导出文件
     */
    AssetService.prototype.exportAssets = function(params) {
        return this.repository.export(params);
    };

    // ==================== 私有方法 ====================

    /**
     * 验证搜索条件
     * @param {Object} criteria - 搜索条件
     * @returns {Object} 验证后的条件
     */
    AssetService.prototype._validateSearchCriteria = function(criteria) {
        const validated = {
            page: 1,
            pageSize: 50,
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
     * 验证资产数据
     * @param {Object} data - 资产数据
     * @returns {Object} 验证结果 {valid: boolean, message: string}
     */
    AssetService.prototype._validateAssetData = function(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, message: '资产数据无效' };
        }

        // 必填字段验证（根据实际业务需求调整）
        const requiredFields = ['数据资产名称'];
        for (const field of requiredFields) {
            if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
                return { valid: false, message: '请填写' + field };
            }
        }

        return { valid: true };
    };

    /**
     * 应用业务规则
     * @param {Object} data - 原始数据
     * @returns {Object} 处理后的数据
     */
    AssetService.prototype._applyBusinessRules = function(data) {
        const processed = { ...data };

        // 数据清洗
        Object.keys(processed).forEach(key => {
            if (typeof processed[key] === 'string') {
                processed[key] = processed[key].trim();
            }
        });

        // 自动填充默认值（可根据业务需求添加）
        if (!processed['创建时间']) {
            processed['创建时间'] = new Date().toISOString();
        }

        return processed;
    };

    /**
     * 计算统计数据
     * @param {Object} stats - 原始统计数据
     * @returns {Object} 计算后的统计数据
     */
    AssetService.prototype._calculateStatistics = function(stats) {
        // 可以在这里添加额外的统计计算逻辑
        return stats;
    };

    // ==================== 导出模块 API ====================

    window.AssetService = AssetService;

})(window);
