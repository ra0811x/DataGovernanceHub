/**
 * 资产仓库
 * 封装资产数据访问逻辑，提供缓存和业务数据转换
 */

(function(window) {
    'use strict';

    /**
     * AssetsRepository 构造函数
     * @param {AssetsApi} api - AssetsApi 实例
     */
    function AssetsRepository(api) {
        this.api = api;
        this._cache = new Map();
        this._cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    /**
     * 生成缓存键
     * @param {string} method - 方法名
     * @param {*} args - 参数
     * @returns {string} 缓存键
     */
    AssetsRepository.prototype._cacheKey = function(method, args) {
        return method + ':' + JSON.stringify(args);
    };

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {*} 缓存值或 null
     */
    AssetsRepository.prototype._getCache = function(key) {
        const cached = this._cache.get(key);
        if (cached && Date.now() - cached.time < this._cacheTimeout) {
            return cached.data;
        }
        this._cache.delete(key);
        return null;
    };

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {*} data - 数据
     */
    AssetsRepository.prototype._setCache = function(key, data) {
        this._cache.set(key, {
            data: data,
            time: Date.now()
        });
    };

    /**
     * 清除缓存
     * @param {string} pattern - 缓存键模式（可选）
     */
    AssetsRepository.prototype.clearCache = function(pattern) {
        if (!pattern) {
            this._cache.clear();
            return;
        }
        // 按模式清除缓存
        for (const key of this._cache.keys()) {
            if (key.indexOf(pattern) === 0) {
                this._cache.delete(key);
            }
        }
    };

    /**
     * 查找所有资产
     * @param {Object} filter - 筛选条件
     * @returns {Promise<{data: Array, total: number}>} 资产列表和总数
     */
    AssetsRepository.prototype.findAll = function(filter) {
        const cacheKey = this._cacheKey('findAll', filter || {});
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.list(filter || {}).then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 根据 ID 查找资产
     * @param {number} id - 资产 ID
     * @returns {Promise<Object>} 资产对象
     */
    AssetsRepository.prototype.findById = function(id) {
        const cacheKey = this._cacheKey('findById', id);
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getById(id).then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存资产（创建或更新）
     * @param {number|Object} idOrData - 资产 ID 或资产数据
     * @param {Object} data - 资产数据（当第一个参数为 ID 时）
     * @returns {Promise<Object>} 保存结果
     */
    AssetsRepository.prototype.save = function(idOrData, data) {
        // 清除相关缓存
        this.clearCache('findAll');
        this.clearCache('findById');

        if (typeof idOrData === 'object' && idOrData !== null) {
            // 创建新资产
            return this.api.create(idOrData);
        }
        // 更新现有资产
        return this.api.update(idOrData, data);
    };

    /**
     * 创建资产
     * @param {Object} data - 资产数据
     * @returns {Promise<Object>} 创建结果
     */
    AssetsRepository.prototype.create = function(data) {
        this.clearCache('findAll');
        return this.api.create(data);
    };

    /**
     * 更新资产
     * @param {number} id - 资产 ID
     * @param {Object} data - 资产数据
     * @returns {Promise<Object>} 更新结果
     */
    AssetsRepository.prototype.update = function(id, data) {
        this.clearCache('findAll');
        this.clearCache('findById:' + id);
        return this.api.update(id, data);
    };

    /**
     * 删除资产
     * @param {number} id - 资产 ID
     * @returns {Promise<Object>} 删除结果
     */
    AssetsRepository.prototype.remove = function(id) {
        this.clearCache('findAll');
        this.clearCache('findById:' + id);
        return this.api.delete(id);
    };

    /**
     * 批量删除资产
     * @param {Array<number>} ids - 资产 ID 数组
     * @returns {Promise<Object>} 删除结果
     */
    AssetsRepository.prototype.batchRemove = function(ids) {
        this.clearCache('findAll');
        return this.api.batchDelete(ids);
    };

    /**
     * 获取统计数据
     * @param {Object} filter - 筛选条件
     * @returns {Promise<Object>} 统计数据
     */
    AssetsRepository.prototype.getStatistics = function(filter) {
        const cacheKey = this._cacheKey('getStatistics', filter || {});
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getStats(filter).then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 获取资产分类列表
     * @returns {Promise<Array<string>>} 分类列表
     */
    AssetsRepository.prototype.getCategories = function() {
        const cacheKey = 'getCategories';
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getCategories().then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 搜索资产
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @returns {Promise<Array>} 搜索结果
     */
    AssetsRepository.prototype.search = function(keyword, options) {
        const filter = {
            search: keyword,
            ...options
        };
        return this.findAll(filter);
    };

    /**
     * 按分类筛选资产
     * @param {string} category - 分类
     * @param {Object} options - 其他选项
     * @returns {Promise<Array>} 筛选结果
     */
    AssetsRepository.prototype.findByCategory = function(category, options) {
        const filter = {
            category: category,
            ...options
        };
        return this.findAll(filter);
    };

    /**
     * 导入资产数据
     * @param {FormData} formData - 包含文件的表单数据
     * @returns {Promise<Object>} 导入结果
     */
    AssetsRepository.prototype.import = function(formData) {
        this.clearCache('findAll');
        return this.api.import(formData);
    };

    /**
     * 导出资产数据
     * @param {Object} params - 导出参数
     * @returns {Promise<Blob>} 导出文件
     */
    AssetsRepository.prototype.export = function(params) {
        return this.api.export(params);
    };

    // ==================== 导出模块 API ====================

    window.AssetsRepository = AssetsRepository;

})(window);
