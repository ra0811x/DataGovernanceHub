/**
 * 兼容层 - 旧代码适配器
 * 保持向后兼容，提供旧的全局函数接口
 * 内部调用新的三层架构实现
 */

(function(window) {
    'use strict';

    // ==================== 适配器状态 ====================
    const adapterState = {
        apis: {},
        repositories: {},
        services: {}
    };

    // ==================== 注册函数 ====================

    /**
     * 注册 API 客户端
     * @param {string} name - API 名称
     * @param {Object} api - API 客户端实例
     */
    function registerApi(name, api) {
        adapterState.apis[name] = api;
    }

    /**
     * 注册仓库
     * @param {string} name - 仓库名称
     * @param {Object} repository - 仓库实例
     */
    function registerRepository(name, repository) {
        adapterState.repositories[name] = repository;
    }

    /**
     * 注册服务
     * @param {string} name - 服务名称
     * @param {Object} service - 服务实例
     */
    function registerService(name, service) {
        adapterState.services[name] = service;
    }

    // ==================== DataService 适配 ====================

    /**
     * 旧 DataService 的适配实现
     */
    const LegacyDataService = {
        /**
         * 获取资产列表
         * @param {Object} params - 查询参数
         * @returns {Promise} 资产列表
         */
        getAssets: function(params) {
            if (adapterState.repositories.assets) {
                return adapterState.repositories.assets.findAll(params);
            }
            if (adapterState.apis.assets) {
                return adapterState.apis.assets.list(params);
            }
            return window.HttpClient.get('/assets', params);
        },

        /**
         * 获取单个资产
         * @param {number} id - 资产 ID
         * @returns {Promise} 资产详情
         */
        getAssetById: function(id) {
            if (adapterState.apis.assets) {
                return adapterState.apis.assets.getById(id);
            }
            return window.HttpClient.get('/assets/' + id);
        },

        /**
         * 创建资产
         * @param {Object} data - 资产数据
         * @returns {Promise} 创建结果
         */
        createAsset: function(data) {
            if (adapterState.apis.assets) {
                return adapterState.apis.assets.create(data);
            }
            return window.HttpClient.post('/assets', data);
        },

        /**
         * 更新资产
         * @param {number} id - 资产 ID
         * @param {Object} data - 资产数据
         * @returns {Promise} 更新结果
         */
        updateAsset: function(id, data) {
            if (adapterState.apis.assets) {
                return adapterState.apis.assets.update(id, data);
            }
            return window.HttpClient.put('/assets/' + id, data);
        },

        /**
         * 删除资产
         * @param {number} id - 资产 ID
         * @returns {Promise} 删除结果
         */
        deleteAsset: function(id) {
            if (adapterState.apis.assets) {
                return adapterState.apis.assets.delete(id);
            }
            return window.HttpClient.delete('/assets/' + id);
        },

        /**
         * 获取资产统计
         * @param {Object} params - 查询参数
         * @returns {Promise} 统计数据
         */
        getAssetStats: function(params) {
            if (adapterState.apis.assets) {
                return adapterState.apis.assets.getStats(params);
            }
            return window.HttpClient.get('/stats', params);
        },

        /**
         * 获取合并结果列表
         * @param {Object} params - 查询参数
         * @returns {Promise} 合并结果列表
         */
        getMergeResults: function(params) {
            if (adapterState.repositories.merge) {
                return adapterState.repositories.merge.findAll(params);
            }
            if (adapterState.apis.merge) {
                return adapterState.apis.merge.list(params);
            }
            return window.HttpClient.get('/merge/assets', params);
        },

        /**
         * 获取日志列表
         * @param {Object} params - 查询参数
         * @returns {Promise} 日志列表
         */
        getLogs: function(params) {
            if (adapterState.apis.logs) {
                return adapterState.apis.logs.list(params);
            }
            return window.HttpClient.get('/logs', params);
        },

        /**
         * 获取文件列表
         * @param {string} category - 文件分类
         * @returns {Promise} 文件列表
         */
        getFiles: function(category) {
            if (adapterState.apis.files) {
                return adapterState.apis.files.list(category);
            }
            return window.HttpClient.get('/project-files').then(function(result) {
                if (!category || !result || !result.files) {
                    return result;
                }
                return result.files[category] || [];
            });
        },

        /**
         * 删除数据
         * @param {string} type - 数据类型
         * @returns {Promise} 删除结果
         */
        deleteData: function(type) {
            return window.HttpClient.post('/data/delete', { type: type });
        }
    };

    // ==================== 全局函数适配 ====================

    /**
     * 旧的全局函数映射
     */
    const globalFunctions = {
        // 数据加载相关
        loadData: function() {
            if (window.DevicePage) {
                return window.DevicePage.loadData();
            }
            console.warn('[LegacyAdapter] loadData: DevicePage not found');
        },

        loadMergeData: function() {
            if (window.MergePage) {
                return window.MergePage.loadData();
            }
            console.warn('[LegacyAdapter] loadMergeData: MergePage not found');
        },

        // 列配置相关
        renderColumnToggles: function() {
            if (window.DevicePage) {
                return window.DevicePage.renderColumnToggles();
            }
            console.warn('[LegacyAdapter] renderColumnToggles: DevicePage not found');
        },

        renderColumnToggles2: function() {
            if (window.MergePage) {
                return window.MergePage.renderColumnToggles();
            }
            console.warn('[LegacyAdapter] renderColumnToggles2: MergePage not found');
        },

        toggleColumn: function(index) {
            if (window.DevicePage) {
                return window.DevicePage.toggleColumn(index);
            }
            console.warn('[LegacyAdapter] toggleColumn: DevicePage not found');
        },

        toggleColumn2: function(index) {
            if (window.MergePage) {
                return window.MergePage.toggleColumn(index);
            }
            console.warn('[LegacyAdapter] toggleColumn2: MergePage not found');
        },

        // 保存相关
        saveColumnSettings: function() {
            if (window.DevicePage) {
                return window.DevicePage.saveColumnSettings();
            }
            console.warn('[LegacyAdapter] saveColumnSettings: DevicePage not found');
        },

        // Toast 提示
        showToast: function(message, isError) {
            if (window.showToast) {
                window.showToast(message, isError);
            } else {
                console.log('[Toast]' + (isError ? ' [ERROR]' : '') + ' ' + message);
            }
        }
    };

    // ==================== 初始化 ====================

    /**
     * 初始化兼容层
     */
    function init() {
        // 创建 DataService 适配器
        if (!window.DataService) {
            window.DataService = LegacyDataService;
        } else {
            // 合并到现有 DataService
            Object.keys(LegacyDataService).forEach(function(key) {
                if (!window.DataService[key]) {
                    window.DataService[key] = LegacyDataService[key];
                }
            });
        }

        // 注册全局函数（如果不存在）
        Object.keys(globalFunctions).forEach(function(name) {
            if (!window[name]) {
                window[name] = globalFunctions[name];
            }
        });

        console.log('[LegacyAdapter] Compatibility layer initialized');
    }

    // ==================== 导出模块 API ====================

    window.LegacyAdapter = {
        // 注册方法
        registerApi: registerApi,
        registerRepository: registerRepository,
        registerService: registerService,

        // 初始化
        init: init,

        // 内部状态（用于测试）
        _state: adapterState
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
