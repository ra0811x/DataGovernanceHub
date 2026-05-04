/**
 * API 客户端基类
 * 基于 HttpClient 的 API 客户端基类，提供统一的 API 调用接口
 */

(function(window) {
    'use strict';

    /**
     * ApiClient 基类
     * @param {Object} config - 配置对象
     */
    function ApiClient(config) {
        this.config = config || {};
        this.baseURL = this.config.baseURL || window.API_BASE || '';
    }

    /**
     * 构建完整 URL
     * @param {string} endpoint - API 端点
     * @returns {string} 完整 URL
     */
    ApiClient.prototype.buildURL = function(endpoint) {
        if (!endpoint) return this.baseURL;

        // 如果是完整 URL，直接返回
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            return endpoint;
        }

        // 拼接 base URL 和 endpoint
        const base = this.baseURL.replace(/\/+$/, '');
        const path = endpoint.replace(/^\/+/, '');
        return base + '/' + path;
    };

    /**
     * 处理响应
     * @param {*} response - 响应数据
     * @returns {*} 处理后的数据
     */
    ApiClient.prototype.handleResponse = function(response) {
        // 统一处理响应格式
        if (response && typeof response === 'object') {
            // 如果响应有 success 字段，检查是否成功
            if (response.hasOwnProperty('success') && !response.success) {
                throw new Error(response.error || response.message || '请求失败');
            }
            // 返回 data 字段或整个响应
            return response.data !== undefined ? response.data : response;
        }
        return response;
    };

    /**
     * 发起 GET 请求
     * @param {string} endpoint - API 端点
     * @param {Object} params - 查询参数
     * @returns {Promise} 响应数据
     */
    ApiClient.prototype.get = function(endpoint, params) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.get(url, params)
            .then(this.handleResponse.bind(this))
            .catch(function(error) {
                console.error('[ApiClient] GET ' + endpoint + ' failed:', error);
                throw error;
            });
    };

    /**
     * 发起 POST 请求
     * @param {string} endpoint - API 端点
     * @param {Object} data - 请求数据
     * @returns {Promise} 响应数据
     */
    ApiClient.prototype.post = function(endpoint, data) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.post(url, data)
            .then(this.handleResponse.bind(this))
            .catch(function(error) {
                console.error('[ApiClient] POST ' + endpoint + ' failed:', error);
                throw error;
            });
    };

    /**
     * 发起 PUT 请求
     * @param {string} endpoint - API 端点
     * @param {Object} data - 请求数据
     * @returns {Promise} 响应数据
     */
    ApiClient.prototype.put = function(endpoint, data) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.put(url, data)
            .then(this.handleResponse.bind(this))
            .catch(function(error) {
                console.error('[ApiClient] PUT ' + endpoint + ' failed:', error);
                throw error;
            });
    };

    /**
     * 发起 DELETE 请求
     * @param {string} endpoint - API 端点
     * @returns {Promise} 响应数据
     */
    ApiClient.prototype.delete = function(endpoint) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.delete(url)
            .then(this.handleResponse.bind(this))
            .catch(function(error) {
                console.error('[ApiClient] DELETE ' + endpoint + ' failed:', error);
                throw error;
            });
    };

    /**
     * 发起 PATCH 请求
     * @param {string} endpoint - API 端点
     * @param {Object} data - 请求数据
     * @returns {Promise} 响应数据
     */
    ApiClient.prototype.patch = function(endpoint, data) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.patch(url, data)
            .then(this.handleResponse.bind(this))
            .catch(function(error) {
                console.error('[ApiClient] PATCH ' + endpoint + ' failed:', error);
                throw error;
            });
    };

    /**
     * 上传文件
     * @param {string} endpoint - API 端点
     * @param {FormData} formData - 表单数据
     * @returns {Promise} 响应数据
     */
    ApiClient.prototype.upload = function(endpoint, formData) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.upload(url, formData)
            .then(this.handleResponse.bind(this))
            .catch(function(error) {
                console.error('[ApiClient] UPLOAD ' + endpoint + ' failed:', error);
                throw error;
            });
    };

    // ==================== 导出模块 API ====================

    window.ApiClient = ApiClient;

})(window);
