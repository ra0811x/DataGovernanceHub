/**
 * 模式仓库
 * 封装模式数据访问逻辑
 */

(function(window) {
    'use strict';

    /**
     * ModesRepository 构造函数
     * @param {ModesApi} api - ModesApi 实例
     */
    function ModesRepository(api) {
        this.api = api;
        this._cache = new Map();
        this._cacheTimeout = 10 * 60 * 1000; // 10分钟缓存（模式变更较少）
    }

    /**
     * 生成缓存键
     * @param {string} method - 方法名
     * @param {*} args - 参数
     * @returns {string} 缓存键
     */
    ModesRepository.prototype._cacheKey = function(method, args) {
        return method + ':' + JSON.stringify(args);
    };

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {*} 缓存值或 null
     */
    ModesRepository.prototype._getCache = function(key) {
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
    ModesRepository.prototype._setCache = function(key, data) {
        this._cache.set(key, {
            data: data,
            time: Date.now()
        });
    };

    /**
     * 清除缓存
     * @param {string} pattern - 缓存键模式（可选）
     */
    ModesRepository.prototype.clearCache = function(pattern) {
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
     * 获取所有模式
     * @param {string} pageType - 页面类型 (device/merge)
     * @returns {Promise<Array>} 模式列表
     */
    ModesRepository.prototype.findAll = function(pageType) {
        const cacheKey = this._cacheKey('findAll', pageType || 'device');
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.list(pageType || 'device').then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 根据 ID 查找模式
     * @param {number} id - 模式 ID
     * @returns {Promise<Object>} 模式对象
     */
    ModesRepository.prototype.findById = function(id) {
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
     * 根据 mode_key 查找模式
     * @param {string} modeKey - 模式键值
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object|null>} 模式对象或 null
     */
    ModesRepository.prototype.findByKey = function(modeKey, pageType) {
        return this.findAll(pageType).then(modes => {
            return modes.find(m => m.mode_key === modeKey) || null;
        });
    };

    /**
     * 获取默认模式
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object>} 默认模式
     */
    ModesRepository.prototype.findDefault = function(pageType) {
        const cacheKey = this._cacheKey('findDefault', pageType || 'device');
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getDefault(pageType || 'device').then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存模式（创建或更新）
     * @param {number|Object} idOrData - 模式 ID 或数据
     * @param {Object} data - 模式数据（当第一个参数为 ID 时）
     * @returns {Promise<Object>} 保存结果
     */
    ModesRepository.prototype.save = function(idOrData, data) {
        this.clearCache('findAll');
        this.clearCache('findById');
        this.clearCache('findDefault');

        if (typeof idOrData === 'object' && idOrData !== null) {
            return this.api.create(idOrData);
        }
        return this.api.update(idOrData, data);
    };

    /**
     * 创建模式
     * @param {Object} data - 模式数据
     * @returns {Promise<Object>} 创建结果
     */
    ModesRepository.prototype.create = function(data) {
        this.clearCache('findAll');
        return this.api.create(data);
    };

    /**
     * 更新模式
     * @param {number} id - 模式 ID
     * @param {Object} data - 模式数据
     * @returns {Promise<Object>} 更新结果
     */
    ModesRepository.prototype.update = function(id, data) {
        this.clearCache('findAll');
        this.clearCache('findById:' + id);
        return this.api.update(id, data);
    };

    /**
     * 删除模式
     * @param {number} id - 模式 ID
     * @returns {Promise<Object>} 删除结果
     */
    ModesRepository.prototype.remove = function(id) {
        this.clearCache('findAll');
        this.clearCache('findById:' + id);
        return this.api.delete(id);
    };

    /**
     * 设置默认模式
     * @param {number} id - 模式 ID
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object>} 设置结果
     */
    ModesRepository.prototype.setDefault = function(id, pageType) {
        this.clearCache('findDefault');
        this.clearCache('findAll');
        return this.api.setDefault(id, pageType || 'device');
    };

    /**
     * 复制模式
     * @param {number} id - 模式 ID
     * @param {string} newName - 新模式名称
     * @returns {Promise<Object>} 复制结果
     */
    ModesRepository.prototype.copy = function(id, newName) {
        this.clearCache('findAll');
        return this.api.copy(id, newName);
    };

    /**
     * 获取模式的列配置
     * @param {string} modeKey - 模式键值
     * @returns {Promise<Object>} 列配置
     */
    ModesRepository.prototype.getColumnConfig = function(modeKey) {
        const cacheKey = this._cacheKey('getColumnConfig', modeKey);
        const cached = this._getCache(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.api.getColumnConfig(modeKey).then(result => {
            this._setCache(cacheKey, result);
            return result;
        });
    };

    /**
     * 保存模式的列配置
     * @param {string} modeKey - 模式键值
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ModesRepository.prototype.saveColumnConfig = function(modeKey, config) {
        this.clearCache('getColumnConfig:' + modeKey);
        return this.api.saveColumnConfig(modeKey, config);
    };

    // ==================== 导出模块 API ====================

    window.ModesRepository = ModesRepository;

})(window);
