/**
 * 日志 API 客户端
 * 处理所有与日志相关的 API 调用
 */

(function(window) {
    'use strict';

    /**
     * LogsApi 构造函数
     * @param {Object} config - 配置对象
     */
    function LogsApi(config) {
        // 调用父类构造函数
        window.ApiClient.call(this, config);
    }

    // 继承 ApiClient 原型
    LogsApi.prototype = Object.create(window.ApiClient.prototype);
    LogsApi.prototype.constructor = LogsApi;

    /**
     * 获取日志列表
     * @param {Object} params - 查询参数
     * @param {number} params.page - 页码
     * @param {number} params.pageSize - 每页数量
     * @param {string} params.level - 日志级别
     * @param {string} params.search - 搜索关键词
     * @returns {Promise<{data: Array, total: number}>} 日志列表和总数
     */
    LogsApi.prototype.list = function(params) {
        return this.get('/logs', params);
    };

    /**
     * 获取日志详情
     * @param {number} id - 日志 ID
     * @returns {Promise<Object>} 日志详情
     */
    LogsApi.prototype.getById = function(id) {
        return this.get('/logs/' + id);
    };

    /**
     * 清空日志
     * @returns {Promise<Object>} 清空结果
     */
    LogsApi.prototype.clear = function() {
        return this.post('/logs/clear');
    };

    /**
     * 导出日志
     * @param {Object} params - 导出参数
     * @returns {Promise<Blob>} 导出文件
     */
    LogsApi.prototype.export = function(params) {
        const url = this.buildURL('/logs/export');
        const queryString = Object.keys(params || {})
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
            .join('&');
        return window.HttpClient.get(url + (queryString ? '?' + queryString : ''), null, {
            headers: {}
        });
    };

    /**
     * 获取日志统计
     * @returns {Promise<Object>} 统计数据
     */
    LogsApi.prototype.getStats = function() {
        return this.get('/logs/stats');
    };

    // ==================== 导出模块 API ====================

    window.LogsApi = LogsApi;

})(window);
