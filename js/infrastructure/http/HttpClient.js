/**
 * HTTP 客户端
 * 统一的 HTTP 请求封装，支持拦截器、错误处理、超时控制
 */

(function(window) {
    'use strict';

    // ==================== 默认配置 ====================
    const DEFAULT_CONFIG = {
        baseURL: '',
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // ==================== 拦截器管理 ====================
    const interceptors = {
        request: [],
        response: [],
        error: []
    };

    /**
     * 添加请求拦截器
     * @param {Function} fn - 拦截器函数
     */
    function useRequestInterceptor(fn) {
        if (typeof fn === 'function') {
            interceptors.request.push(fn);
        }
    }

    /**
     * 添加响应拦截器
     * @param {Function} fn - 拦截器函数
     */
    function useResponseInterceptor(fn) {
        if (typeof fn === 'function') {
            interceptors.response.push(fn);
        }
    }

    /**
     * 添加错误拦截器
     * @param {Function} fn - 拦截器函数
     */
    function useErrorInterceptor(fn) {
        if (typeof fn === 'function') {
            interceptors.error.push(fn);
        }
    }

    /**
     * 执行请求拦截器链
     * @param {Object} config - 请求配置
     * @returns {Object} 处理后的配置
     */
    function processRequestInterceptors(config) {
        return interceptors.request.reduce((result, interceptor) => {
            try {
                return interceptor(result) || result;
            } catch (e) {
                console.error('Request interceptor error:', e);
                return result;
            }
        }, config);
    }

    /**
     * 执行响应拦截器链
     * @param {*} response - 响应数据
     * @returns {*} 处理后的响应
     */
    function processResponseInterceptors(response) {
        return interceptors.response.reduce((result, interceptor) => {
            try {
                return interceptor(result) || result;
            } catch (e) {
                console.error('Response interceptor error:', e);
                return result;
            }
        }, response);
    }

    /**
     * 执行错误拦截器链
     * @param {Error} error - 错误对象
     * @returns {Error} 处理后的错误
     */
    function processErrorInterceptors(error) {
        return interceptors.error.reduce((result, interceptor) => {
            try {
                return interceptor(result) || result;
            } catch (e) {
                console.error('Error interceptor error:', e);
                return result;
            }
        }, error);
    }

    // ==================== HTTP 请求核心 ====================

    /**
     * 构建完整 URL
     * @param {string} url - 请求路径
     * @param {string} baseURL - 基础 URL
     * @returns {string} 完整 URL
     */
    function buildURL(url, baseURL) {
        if (!url) return baseURL;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        return baseURL ? baseURL.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '') : url;
    }

    /**
     * 构建查询字符串
     * @param {Object} params - 查询参数
     * @returns {string} 查询字符串
     */
    function buildQueryString(params) {
        if (!params || typeof params !== 'object') {
            return '';
        }
        const pairs = Object.entries(params)
            .filter(([_, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
                }
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            });
        return pairs.length > 0 ? '?' + pairs.join('&') : '';
    }

    /**
     * 创建带超时的请求
     * @param {string} url - 请求 URL
     * @param {Object} options - fetch 选项
     * @param {number} timeout - 超时时间
     * @returns {Promise} 请求 Promise
     */
    function fetchWithTimeout(url, options, timeout) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Request timeout: ${timeout}ms`)), timeout);
            })
        ]);
    }

    /**
     * 核心请求方法
     * @param {string} url - 请求路径
     * @param {Object} options - 请求选项
     * @returns {Promise} 响应 Promise
     */
    async function request(url, options = {}) {
        const config = {
            method: options.method || 'GET',
            headers: { ...DEFAULT_CONFIG.headers, ...options.headers },
            body: options.body
        };

        // 处理请求拦截器
        const processedConfig = processRequestInterceptors({
            url,
            ...config
        });

        // 构建完整 URL
        const fullURL = buildURL(processedConfig.url, DEFAULT_CONFIG.baseURL);

        // 添加查询参数（仅对 GET 请求）
        let finalURL = fullURL;
        if (options.params && (config.method === 'GET' || config.method === 'HEAD')) {
            finalURL += buildQueryString(options.params);
        }

        // 请求日志
        if (console && console.log) {
            console.log(`[HttpClient] ${config.method} ${finalURL}`, processedConfig.body || '');
        }

        try {
            // 发起请求
            const response = await fetchWithTimeout(
                finalURL,
                {
                    method: config.method,
                    headers: config.headers,
                    body: config.body
                },
                options.timeout || DEFAULT_CONFIG.timeout
            );

            // 解析响应
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // 检查响应状态
            if (!response.ok) {
                const error = new Error(data.message || data.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            // 处理响应拦截器
            return processResponseInterceptors(data);

        } catch (error) {
            // 处理错误拦截器
            const processedError = processErrorInterceptors(error);

            // 错误日志
            if (console && console.error) {
                console.error('[HttpClient] Request failed:', processedError);
            }

            throw processedError;
        }
    }

    // ==================== 便捷方法 ====================

    /**
     * GET 请求
     * @param {string} url - 请求路径
     * @param {Object} params - 查询参数
     * @param {Object} options - 额外选项
     * @returns {Promise} 响应数据
     */
    function get(url, params, options = {}) {
        return request(url, {
            method: 'GET',
            params,
            ...options
        });
    }

    /**
     * POST 请求
     * @param {string} url - 请求路径
     * @param {Object} data - 请求数据
     * @param {Object} options - 额外选项
     * @returns {Promise} 响应数据
     */
    function post(url, data, options = {}) {
        return request(url, {
            method: 'POST',
            body: JSON.stringify(data),
            ...options
        });
    }

    /**
     * PUT 请求
     * @param {string} url - 请求路径
     * @param {Object} data - 请求数据
     * @param {Object} options - 额外选项
     * @returns {Promise} 响应数据
     */
    function put(url, data, options = {}) {
        return request(url, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }

    /**
     * DELETE 请求
     * @param {string} url - 请求路径
     * @param {Object} options - 额外选项
     * @returns {Promise} 响应数据
     */
    function del(url, options = {}) {
        return request(url, {
            method: 'DELETE',
            ...options
        });
    }

    /**
     * PATCH 请求
     * @param {string} url - 请求路径
     * @param {Object} data - 请求数据
     * @param {Object} options - 额外选项
     * @returns {Promise} 响应数据
     */
    function patch(url, data, options = {}) {
        return request(url, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    }

    /**
     * 上传文件
     * @param {string} url - 请求路径
     * @param {FormData} formData - 表单数据
     * @param {Object} options - 额外选项
     * @returns {Promise} 响应数据
     */
    function upload(url, formData, options = {}) {
        // 移除 Content-Type，让浏览器自动设置 multipart/form-data
        const headers = { ...options.headers };
        delete headers['Content-Type'];

        return request(url, {
            method: 'POST',
            body: formData,
            headers,
            ...options
        });
    }

    // ==================== 配置方法 ====================

    /**
     * 设置基础 URL
     * @param {string} baseURL - 基础 URL
     */
    function setBaseURL(baseURL) {
        DEFAULT_CONFIG.baseURL = baseURL;
    }

    /**
     * 设置默认请求头
     * @param {Object} headers - 请求头
     */
    function setDefaultHeaders(headers) {
        Object.assign(DEFAULT_CONFIG.headers, headers);
    }

    /**
     * 设置默认超时时间
     * @param {number} timeout - 超时时间（毫秒）
     */
    function setTimeout(timeout) {
        DEFAULT_CONFIG.timeout = timeout;
    }

    // ==================== 导出模块 API ====================

    window.HttpClient = {
        // 核心方法
        request: request,
        get: get,
        post: post,
        put: put,
        delete: del,
        patch: patch,
        upload: upload,

        // 拦截器
        useRequest: useRequestInterceptor,
        useResponse: useResponseInterceptor,
        useError: useErrorInterceptor,

        // 配置
        setBaseURL: setBaseURL,
        setDefaultHeaders: setDefaultHeaders,
        setTimeout: setTimeout,

        // 内部属性（用于测试）
        _interceptors: interceptors,
        _config: DEFAULT_CONFIG
    };

    // 初始化：设置全局 API_BASE
    if (typeof window.API_BASE !== 'undefined') {
        setBaseURL(window.API_BASE);
    }

})(window);
