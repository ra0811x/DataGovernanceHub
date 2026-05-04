/**
 * 列配置 API 客户端
 * 处理所有与列配置相关的 API 调用
 */

(function(window) {
    'use strict';

    /**
     * ColumnsApi 构造函数
     * @param {Object} config - 配置对象
     */
    function ColumnsApi(config) {
        // 调用父类构造函数
        window.ApiClient.call(this, config);
    }

    // 继承 ApiClient 原型
    ColumnsApi.prototype = Object.create(window.ApiClient.prototype);
    ColumnsApi.prototype.constructor = ColumnsApi;

    function resolveColumnsEndpoint(pageTypeOrEndpoint) {
        if (typeof pageTypeOrEndpoint === 'string' && pageTypeOrEndpoint.charAt(0) === '/') {
            return pageTypeOrEndpoint;
        }
        return pageTypeOrEndpoint === 'merge' ? '/merge/columns' : '/columns';
    }

    /**
     * 获取列配置
     * @param {string} pageType - 页面类型 (device/merge)
     * @returns {Promise<Object>} 列配置
     */
    ColumnsApi.prototype.get = function(pageTypeOrEndpoint) {
        return window.ApiClient.prototype.get.call(
            this,
            resolveColumnsEndpoint(pageTypeOrEndpoint)
        );
    };

    /**
     * 保存列配置
     * @param {Object} config - 列配置
     * @param {string} pageType - 页面类型 (device/merge)
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsApi.prototype.save = function(config, pageTypeOrEndpoint) {
        return window.ApiClient.prototype.post.call(
            this,
            resolveColumnsEndpoint(pageTypeOrEndpoint),
            config
        );
    };

    /**
     * 获取数据概览列配置
     * @returns {Promise<Object>} 列配置
     */
    ColumnsApi.prototype.getDeviceColumns = function() {
        return window.ApiClient.prototype.get.call(this, '/columns');
    };

    /**
     * 保存数据概览列配置
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsApi.prototype.saveDeviceColumns = function(config) {
        return window.ApiClient.prototype.post.call(this, '/columns', config);
    };

    /**
     * 获取合并结果列配置
     * @returns {Promise<Object>} 列配置
     */
    ColumnsApi.prototype.getMergeColumns = function() {
        return window.ApiClient.prototype.get.call(this, '/merge/columns');
    };

    /**
     * 保存合并结果列配置
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsApi.prototype.saveMergeColumns = function(config) {
        return window.ApiClient.prototype.post.call(this, '/merge/columns', config);
    };

    /**
     * 获取所有模式的列配置
     * @returns {Promise<Object>} 所有列配置
     */
    ColumnsApi.prototype.getAllConfigs = function() {
        return window.ApiClient.prototype.get.call(this, '/columns');
    };

    /**
     * 保存所有模式的列配置
     * @param {Object} configs - 列配置集合
     * @returns {Promise<Object>} 保存结果
     */
    ColumnsApi.prototype.saveAllConfigs = function(configs) {
        return window.ApiClient.prototype.post.call(this, '/columns', configs);
    };

    // ==================== 导出模块 API ====================

    window.ColumnsApi = ColumnsApi;

})(window);
