/**
 * 模式 API 客户端
 * 处理所有与模式相关的 API 调用
 */

(function(window) {
    'use strict';

    /**
     * ModesApi 构造函数
     * @param {Object} config - 配置对象
     */
    function ModesApi(config) {
        // 调用父类构造函数
        window.ApiClient.call(this, config);
    }

    // 继承 ApiClient 原型
    ModesApi.prototype = Object.create(window.ApiClient.prototype);
    ModesApi.prototype.constructor = ModesApi;

    /**
     * 获取模式列表
     * @param {string} pageType - 页面类型 (device/merge)
     * @returns {Promise<Array>} 模式列表
     */
    ModesApi.prototype.list = function(pageType) {
        return this.get('/modes', { page_type: pageType || 'device' });
    };

    /**
     * 获取单个模式详情
     * @param {number} id - 模式 ID
     * @returns {Promise<Object>} 模式详情
     */
    ModesApi.prototype.getById = function(id) {
        return this.get('/modes/' + id);
    };

    /**
     * 创建模式
     * @param {Object} data - 模式数据
     * @param {string} data.page_type - 页面类型
     * @param {string} data.mode_key - 模式键值
     * @param {string} data.mode_name - 模式名称
     * @param {string} data.mode_color - 模式颜色
     * @param {string} data.notes - 备注
     * @returns {Promise<Object>} 创建结果
     */
    ModesApi.prototype.create = function(data) {
        return this.post('/modes', data);
    };

    /**
     * 更新模式
     * @param {number} id - 模式 ID
     * @param {Object} data - 模式数据
     * @returns {Promise<Object>} 更新结果
     */
    ModesApi.prototype.update = function(id, data) {
        return this.put('/modes/' + id, data);
    };

    /**
     * 删除模式
     * @param {number} id - 模式 ID
     * @returns {Promise<Object>} 删除结果
     */
    ModesApi.prototype.delete = function(id) {
        return window.HttpClient.delete('/modes/' + id);
    };

    /**
     * 设置默认模式
     * @param {number} id - 模式 ID
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object>} 设置结果
     */
    ModesApi.prototype.setDefault = function(id, pageType) {
        return this.post('/modes/' + id + '/set-default', {
            page_type: pageType || 'device'
        });
    };

    /**
     * 获取默认模式
     * @param {string} pageType - 页面类型
     * @returns {Promise<Object>} 默认模式
     */
    ModesApi.prototype.getDefault = function(pageType) {
        return this.get('/modes/default', {
            page_type: pageType || 'device'
        });
    };

    /**
     * 复制模式
     * @param {number} id - 模式 ID
     * @param {string} newName - 新模式名称
     * @returns {Promise<Object>} 复制结果
     */
    ModesApi.prototype.copy = function(id, newName) {
        return this.post('/modes/' + id + '/copy', {
            new_name: newName
        });
    };

    /**
     * 获取模式的列配置
     * @param {string} modeKey - 模式键值
     * @returns {Promise<Object>} 列配置
     */
    ModesApi.prototype.getColumnConfig = function(modeKey) {
        return this.get('/modes/columns/' + modeKey);
    };

    /**
     * 保存模式的列配置
     * @param {string} modeKey - 模式键值
     * @param {Object} config - 列配置
     * @returns {Promise<Object>} 保存结果
     */
    ModesApi.prototype.saveColumnConfig = function(modeKey, config) {
        return this.post('/modes/columns/' + modeKey, config);
    };

    // ==================== 导出模块 API ====================

    window.ModesApi = ModesApi;

})(window);
