/**
 * 列配置仓库
 * 封装列配置数据访问逻辑
 */

(function(window) {
    'use strict';

    /**
     * ColumnsRepository 构造函数
     * @param {ColumnsApi} api - ColumnsApi 实例
     */
    function ColumnsRepository(api) {
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
    ColumnsRepository.prototype._cacheKey = function(method, args) {
        return method + ':' + JSON.stringify(args);
    };

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {*} 缓存值或 null
     */
    ColumnsRepository.prototype._getCache = function(key) {
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
    ColumnsRepository.prototype._setCache = function(key, data) {
        this._cache.set(key, {
            data: data,
            time: Date.now()
        });
    };

    /**
     * 清除缓存
     * @param {string} pattern - 缓存键模式（可选）
     */
    ColumnsRepository.prototype.clearCache = function(pattern) {
        if (!pattern) {
            this._cache.clear();
            return;
        }
        for (const key of this._cache.keys()) {
            if (key.indexOf(pattern) === 0) {
                this._cache.delete(key);
            }
        }
    };

    /**
     * 获取列配置
     * @param {string} pageType - 页面类型 (device/merge)
     * @returns {Promise<Object>} 列配置
     */
    ColumnsRepository.prototype.get = function(pageType) {
        const cacheKey = this._cacheKey('get', pageType || 'device');
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.get(pageType || 'device').then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存列配置
     * @param {Object} config - 列配置
     * @param {string} pageType - 页面类型 (device/merge)
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsRepository.prototype.save = function(config, pageType) {
        this.clearCache('get:' + (pageType || 'device'));
        return this.api.save(config, pageType || 'device');
    };

    /**
     * 获取数据概览列配置
     * @returns {Promise<Object>} 列配置
     */
    ColumnsRepository.prototype.getDeviceColumns = function() {
        const cacheKey = 'getDeviceColumns';
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getDeviceColumns().then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存数据概览列配置
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsRepository.prototype.saveDeviceColumns = function(config) {
        this.clearCache('getDeviceColumns');
        return this.api.saveDeviceColumns(config);
    };

    /**
     * 获取合并结果列配置
     * @returns {Promise<Object>} 列配置
     */
    ColumnsRepository.prototype.getMergeColumns = function() {
        const cacheKey = 'getMergeColumns';
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getMergeColumns().then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存合并结果列配置
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsRepository.prototype.saveMergeColumns = function(config) {
        this.clearCache('getMergeColumns');
        return this.api.saveMergeColumns(config);
    };

    /**
     * 获取所有模式的列配置
     * @returns {Promise<Object>} 所有列配置
     */
    ColumnsRepository.prototype.getAllConfigs = function() {
        const cacheKey = 'getAllConfigs';
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getAllConfigs().then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存所有模式的列配置
     * @param {Object} configs - 列配置集合
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsRepository.prototype.saveAllConfigs = function(configs) {
        this.clearCache('getAllConfigs');
        this.clearCache('getDeviceColumns');
        this.clearCache('getMergeColumns');
        return this.api.saveAllConfigs(configs);
    };

    /**
     * 根据模式键值获取列配置
     * @param {string} modeKey - 模式键值
     * @returns {Promise<Object>} 列配置
     */
    ColumnsRepository.prototype.getByMode = function(modeKey) {
        return this.getAllConfigs().then(configs => {
            return configs[modeKey] || configs['全部'] || null;
        });
    };

    /**
     * 保存指定模式的列配置
     * @param {string} modeKey - 模式键值
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsRepository.prototype.saveByMode = function(modeKey, config) {
        return this.getAllConfigs().then(configs => {
            configs[modeKey] = config;
            return this.saveAllConfigs(configs);
        });
    };

    // ==================== 导出模块 API ====================

    window.ColumnsRepository = ColumnsRepository;

})(window);
