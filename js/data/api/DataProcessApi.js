/**
 * 数据处理API客户端
 * 用于调用数据处理相关的后端接口
 */

(function(window) {
    'use strict';

    /**
     * DataProcessApi 构造函数
     * @param {Object} config - 配置对象
     * @param {string} config.baseURL - API基础URL
     * @param {number} config.timeout - 请求超时时间（毫秒）
     */
    function DataProcessApi(config) {
        this.baseURL = config.baseURL || '/api';
        this.timeout = 0; // 无超时限制，支持长时间处理
        this.currentTaskId = null;
        this.progressInterval = null;
    }

    /**
     * 一键处理 - 批量清洗并合并
     */
    DataProcessApi.prototype.processAllInOne = function(formData, progressCallback, completeCallback) {
        return this.processWithProgress('/data-process/all-in-one', formData, progressCallback, completeCallback);
    };

    /**
     * 一键处理 - 批量清洗并合并（目录模式）
     * 支持超大数据量：直接读取本地目录，无上传限制
     * @param {Object} requestData - 请求数据 {dirPath, targetColumn, outputName}
     * @param {Function} progressCallback - 进度回调(percent, message, detail)
     * @param {Function} completeCallback - 完成回调(result)
     * @returns {Promise} 处理结果
     */
    DataProcessApi.prototype.processAllInOneByDir = function(requestData, progressCallback, completeCallback) {
        return new Promise((resolve, reject) => {
            console.log('[DataProcessApi] 发起目录模式请求:', requestData);

            // 发送POST请求，body为JSON
            fetch(this.baseURL + '/data-process/all-in-one-dir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            })
            .then(response => {
                console.log('[DataProcessApi] 响应状态:', response.status);
                return response.json();
            })
            .then(result => {
                console.log('[DataProcessApi] 解析后的响应:', result);

                if (result.success) {
                    // 有taskId则开始轮询进度
                    if (result.task_id) {
                        console.log('[DataProcessApi] 收到task_id:', result.task_id, '，开始轮询进度');
                        this.currentTaskId = result.task_id;
                        this.startProgressPolling(result.task_id, progressCallback, (finalResult) => {
                            if (completeCallback) completeCallback(finalResult);
                            resolve(finalResult);
                        }, (error) => {
                            reject(error);
                        });
                    } else {
                        console.log('[DataProcessApi] 没有task_id，直接完成');
                        if (progressCallback) progressCallback(100, '处理完成', '');
                        if (completeCallback) completeCallback(result);
                        resolve(result);
                    }
                } else {
                    reject(new Error(result.error || '处理失败'));
                }
            })
            .catch(error => {
                console.error('[DataProcessApi] 请求失败:', error);
                reject(error);
            });
        });
    };

    /**
     * 带进度的处理方法
     * @param {string} endpoint - API端点
     * @param {FormData} formData - 表单数据
     * @param {Function} progressCallback - 进度回调(percent, message, detail)
     * @param {Function} completeCallback - 完成回调(result)
     * @returns {Promise} 处理结果
     */
    DataProcessApi.prototype.processWithProgress = function(endpoint, formData, progressCallback, completeCallback) {
        return new Promise((resolve, reject) => {
            console.log('[DataProcessApi] 发起请求:', endpoint);

            // 首先发送请求获取初始结果（包含taskId）
            const xhr = new XMLHttpRequest();
            xhr.open('POST', this.baseURL + endpoint);
            // 不设置超时，支持长时间处理

            xhr.onload = () => {
                console.log('[DataProcessApi] 响应状态:', xhr.status);
                console.log('[DataProcessApi] 响应内容:', xhr.responseText);

                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        console.log('[DataProcessApi] 解析后的响应:', response);

                        if (response.success) {
                            // 有taskId则开始轮询进度
                            if (response.task_id) {
                                console.log('[DataProcessApi] 收到task_id:', response.task_id, '，开始轮询进度');
                                this.currentTaskId = response.task_id;
                                this.startProgressPolling(response.task_id, progressCallback, (finalResult) => {
                                    // 异步模式：使用轮询返回的最终结果
                                    if (completeCallback) completeCallback(finalResult);
                                    resolve(finalResult);
                                }, (error) => {
                                    reject(error);
                                });
                            } else {
                                console.log('[DataProcessApi] 没有task_id，直接完成');
                                if (progressCallback) progressCallback(100, '处理完成', '');
                                if (completeCallback) completeCallback(response);
                                resolve(response);
                            }
                        } else {
                            reject(new Error(response.error || '处理失败'));
                        }
                    } catch (e) {
                        console.error('[DataProcessApi] 响应解析失败:', e);
                        reject(new Error('响应解析失败: ' + e.message));
                    }
                } else {
                    reject(new Error('请求失败: HTTP ' + xhr.status));
                }
            };

            xhr.onerror = () => {
                console.error('[DataProcessApi] 网络错误');
                reject(new Error('网络错误，请检查连接'));
            };
            xhr.send(formData);
        });
    };

    /**
     * 开始轮询进度
     */
    DataProcessApi.prototype.startProgressPolling = function(taskId, progressCallback, onComplete, onError) {
        console.log('[DataProcessApi] 开始轮询进度, taskId:', taskId);

        // 先上报开始
        if (progressCallback) progressCallback(0, '任务已创建', '准备处理...');

        // 先清除之前的轮询
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        const self = this; // 保存this引用
        const pollInterval = setInterval(() => {
            console.log('[DataProcessApi] 轮询进度中...');

            fetch(`${self.baseURL}/data-process/progress/${taskId}`)
                .then(res => {
                    console.log('[DataProcessApi] 进度响应状态:', res.status);
                    return res.json();
                })
                .then(data => {
                    console.log('[DataProcessApi] 进度数据:', data);

                    if (progressCallback) {
                        progressCallback(data.percent || 0, data.message || '', data.detail || '');
                    }

                    // 进度达到100或包含完成标志时停止轮询
                    // 只匹配"处理完成"，不匹配中间阶段如"阶段X: 完成"
                    if (data.percent >= 100 || data.message === '处理完成' || data.message.includes('失败')) {
                        clearInterval(pollInterval);
                        self.progressInterval = null;
                        console.log('[DataProcessApi] 进度轮询结束, 最终进度数据:', data);
                        console.log('[DataProcessApi] result存在?', !!data.result, 'result内容:', data.result);

                        // 判断是否真正失败：检查result.success或message包含失败
                        const isFailed = data.message.includes('失败') || (data.result && data.result.success === false);

                        if (isFailed) {
                            if (onError) onError(new Error(data.detail || '处理失败'));
                        } else {
                            // 如果有结果数据，传递给完成回调
                            console.log('[DataProcessApi] 调用完成回调，参数:', data.result || data);
                            if (onComplete) onComplete(data.result || data);
                        }
                    }
                })
                .catch(err => {
                    console.error('[DataProcessApi] 进度轮询错误:', err);
                    clearInterval(pollInterval);
                    self.progressInterval = null;
                    if (onError) onError(err);
                });
        }, 250); // 每250毫秒轮询一次，更及时的进度更新

        this.progressInterval = pollInterval;
        console.log('[DataProcessApi] 轮询已启动, intervalId:', pollInterval);
    };

    /**
     * 停止进度轮询
     */
    DataProcessApi.prototype.stopProgressPolling = function() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        this.currentTaskId = null;
    };

    /**
     * 获取处理结果下载URL
     * @param {string} mode - 模式 (allinone)
     * @param {string} filename - 文件名
     * @returns {string} 下载URL
     */
    DataProcessApi.prototype.getDownloadUrl = function(mode, filename) {
        return `${this.baseURL}/data-process/download/${mode}/${encodeURIComponent(filename)}`;
    };

    /**
     * 获取日志列表
     */
    DataProcessApi.prototype.getLogs = function() {
        return fetch(`${this.baseURL}/data-process/logs`)
            .then(res => res.json());
    };

    /**
     * 获取日志内容
     */
    DataProcessApi.prototype.getLogContent = function(filename) {
        return fetch(`${this.baseURL}/data-process/logs/${filename}`)
            .then(res => res.json());
    };

    /**
     * 获取 SGExportFiles 下的 xlsx 文件列表
     */
    DataProcessApi.prototype.listExportFiles = function() {
        return fetch(`${this.baseURL}/data-process/list-export-files`)
            .then(res => res.json());
    };

    /**
     * 获取目录下Excel文件列表（递归）
     */
    DataProcessApi.prototype.listExcelFiles = function(dirPath) {
        return fetch(`${this.baseURL}/data-process/list-excel-files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dirPath: dirPath })
        }).then(res => res.json());
    };

    /**
     * 拆分 Excel 文件
     * @param {Object} requestData - {sourceFile, splitCount, headerRow, outputName}
     * @param {Function} progressCallback - 进度回调(percent, message, detail)
     * @param {Function} completeCallback - 完成回调(result)
     */
    DataProcessApi.prototype.splitExcel = function(requestData, progressCallback, completeCallback) {
        return new Promise((resolve, reject) => {
            fetch(this.baseURL + '/data-process/split', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            })
            .then(res => res.json())
            .then(result => {
                if (result.success && result.task_id) {
                    this.currentTaskId = result.task_id;
                    this.startProgressPolling(result.task_id, progressCallback, (finalResult) => {
                        if (completeCallback) completeCallback(finalResult);
                        resolve(finalResult);
                    }, reject);
                } else {
                    reject(new Error(result.error || '拆分失败'));
                }
            })
            .catch(reject);
        });
    };

    /**
     * CSV 转换
     * @param {Object} requestData - {dirPath}
     * @param {Function} progressCallback - 进度回调(percent, message, detail)
     * @param {Function} completeCallback - 完成回调(result)
     */
    DataProcessApi.prototype.convertToCsv = function(requestData, progressCallback, completeCallback) {
        return new Promise((resolve, reject) => {
            fetch(this.baseURL + '/data-process/csv-convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            })
            .then(res => res.json())
            .then(result => {
                if (result.success && result.task_id) {
                    this.currentTaskId = result.task_id;
                    this.startProgressPolling(result.task_id, progressCallback, (finalResult) => {
                        if (completeCallback) completeCallback(finalResult);
                        resolve(finalResult);
                    }, reject);
                } else {
                    reject(new Error(result.error || 'CSV转换失败'));
                }
            })
            .catch(reject);
        });
    };

    /**
     * 批量数据去重（目录模式）
     * @param {Object} requestData - {dirPath, outputName}
     * @param {Function} progressCallback - 进度回调(percent, message, detail)
     * @param {Function} completeCallback - 完成回调(result)
     */
    DataProcessApi.prototype.deduplicateData = function(requestData, progressCallback, completeCallback) {
        return new Promise((resolve, reject) => {
            fetch(this.baseURL + '/data-process/deduplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            })
            .then(res => res.json())
            .then(result => {
                if (result.success && result.task_id) {
                    this.currentTaskId = result.task_id;
                    this.startProgressPolling(result.task_id, progressCallback, (finalResult) => {
                        if (completeCallback) completeCallback(finalResult);
                        resolve(finalResult);
                    }, reject);
                } else {
                    reject(new Error(result.error || '数据去重失败'));
                }
            })
            .catch(reject);
        });
    };

    // ==================== 导出模块 API ====================
    window.DataProcessApi = DataProcessApi;

})(window);
