/**
 * 数据服务模块
 * 封装通用的数据请求和处理逻辑
 */

(function(window) {
    'use strict';

    // ==================== 通用数据获取 ====================

    /**
     * 获取数据概览表数据
     * @param {Object} params - 查询参数 {page, pageSize, search, category}
     * @returns {Promise<Object>} {data: Array, total: Number}
     */
    async function getAssets(params) {
        const queryString = new URLSearchParams(params).toString();
        const url = API_BASE + '/assets?' + queryString;
        const res = await fetch(url);
        return await res.json();
    }

    /**
     * 获取合并结果表数据
     * @param {Object} params - 查询参数
     * @returns {Promise<Object>}
     */
    async function getMergeResults(params) {
        const queryString = new URLSearchParams(params).toString();
        const url = API_BASE + '/merge/assets?' + queryString;
        const res = await fetch(url);
        return await res.json();
    }

    /**
     * 获取单条资产详情
     * @param {number} id - 资产ID
     * @returns {Promise<Object>}
     */
    async function getAssetById(id) {
        const res = await fetch(API_BASE + '/assets/' + id);
        return await res.json();
    }

    /**
     * 保存资产信息
     * @param {number} id - 资产ID（新增时为null）
     * @param {Object} data - 资产数据
     * @returns {Promise<Object>}
     */
    async function saveAsset(id, data) {
        const url = API_BASE + '/assets' + (id ? '/' + id : '');
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    }

    /**
     * 删除资产
     * @param {number} id - 资产ID
     * @returns {Promise<Object>}
     */
    async function deleteAsset(id) {
        const res = await fetch(API_BASE + '/assets/' + id, {
            method: 'DELETE'
        });
        return await res.json();
    }

    // ==================== 列配置管理 ====================

    /**
     * 获取列配置
     * @returns {Promise<Object>}
     */
    async function getColumns() {
        const res = await fetch(API_BASE + '/columns');
        return await res.json();
    }

    /**
     * 保存列配置
     * @param {Object} configs - 列配置对象
     * @returns {Promise<Object>}
     */
    async function saveColumns(configs) {
        const res = await fetch(API_BASE + '/columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configs)
        });
        return await res.json();
    }

    // ==================== 统计信息 ====================

    /**
     * 获取统计数据
     * @param {string} type - 统计类型 (device/merge)
     * @returns {Promise<Object>}
     */
    async function getStats(type) {
        const statsUrlMap = {
            device: API_BASE + '/stats',
            merge: API_BASE + '/merge/stats'
        };
        const url = statsUrlMap[type];
        if (!url) {
            throw new Error('不支持的统计类型: ' + type);
        }
        const res = await fetch(url);
        return await res.json();
    }

    // ==================== 数据导入导出 ====================

    /**
     * 导入Excel数据
     * @param {FormData} formData - 包含文件的表单数据
     * @param {string} type - 类型 (device/merge)
     * @returns {Promise<Object>}
     */
    async function importExcel(formData, type) {
        const importUrlMap = {
            device: API_BASE + '/import/confirm',
            merge: API_BASE + '/import/merge/confirm'
        };
        const url = importUrlMap[type];
        if (!url) {
            throw new Error('不支持的导入类型: ' + type);
        }
        const res = await fetch(url, {
            method: 'POST',
            body: formData
        });
        return await res.json();
    }

    /**
     * 导出Excel数据
     * @param {string} type - 类型 (device/merge)
     * @param {Object} params - 导出参数
     * @returns {Promise<Blob>}
     */
    async function exportExcel(type, params) {
        const queryString = new URLSearchParams(params).toString();
        const exportUrlMap = {
            device: API_BASE + '/export/assets/all',
            merge: API_BASE + '/export/merge-results/all'
        };
        const baseUrl = exportUrlMap[type];
        if (!baseUrl) {
            throw new Error('不支持的导出类型: ' + type);
        }
        const url = baseUrl + (queryString ? '?' + queryString : '');
        const res = await fetch(url);
        return await res.blob();
    }

    // ==================== 文件管理 ====================

    /**
     * 获取文件列表
     * @param {string} category - 文件类别
     * @returns {Promise<Object>}
     */
    function formatFileSize(sizeBytes) {
        let value = Number(sizeBytes) || 0;
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let idx = 0;
        while (value >= 1024 && idx < units.length - 1) {
            value /= 1024;
            idx += 1;
        }
        return value.toFixed(1) + units[idx];
    }

    function formatFileModified(modifiedValue) {
        if (!modifiedValue && modifiedValue !== 0) return '-';
        if (typeof modifiedValue === 'number') {
            const date = new Date(modifiedValue * 1000);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString('zh-CN');
            }
        }
        return String(modifiedValue);
    }

    function flattenCategoryFiles(categoryData) {
        if (Array.isArray(categoryData)) {
            return categoryData;
        }
        if (!categoryData || typeof categoryData !== 'object') {
            return [];
        }

        const merged = [];
        Object.keys(categoryData).forEach(function(key) {
            const monthFiles = categoryData[key];
            if (Array.isArray(monthFiles)) {
                merged.push.apply(merged, monthFiles);
            }
        });
        return merged;
    }

    async function getFiles(category) {
        const res = await fetch(API_BASE + '/project-files');
        const data = await res.json();

        if (!res.ok || data.success === false) {
            throw new Error(data.error || '获取工程文件失败');
        }

        const rawCategoryData = data.files ? data.files[category] : null;
        const rawFiles = flattenCategoryFiles(rawCategoryData);
        const normalizedFiles = rawFiles.map(function(file) {
            return {
                name: file.filename || file.name || '',
                size: file.size_formatted || formatFileSize(file.size),
                modified: file.modified_formatted || formatFileModified(file.modified),
                description: file.source || file.category || '',
                current: Boolean(file.is_current),
                switchable: false,
                path: file.path || '',
                type: file.type || category
            };
        });

        const totalSize = rawFiles.reduce(function(sum, file) {
            return sum + (Number(file.size) || 0);
        }, 0);

        return {
            files: normalizedFiles,
            stats: {
                count: normalizedFiles.length,
                size: formatFileSize(totalSize)
            }
        };
    }

    /**
     * 切换数据文件
     * @param {string} type - 类型 (device/merge)
     * @param {string} filename - 文件名
     * @returns {Promise<Object>}
     */
    async function switchFile(type, filename) {
        throw new Error('当前后端未提供文件切换接口');
    }

    function encodePathForUrl(rawPath) {
        const normalizedPath = String(rawPath || '').replace(/\\/g, '/');
        return normalizedPath.split('/').map(encodeURIComponent).join('/');
    }

    function getProjectFileDownloadUrl(category, file) {
        const fileType = encodeURIComponent(category || '');
        const pathValue = file && (file.path || file.name || file.filename || '');
        const encodedPath = encodePathForUrl(pathValue);
        return API_BASE + '/project-files/download/' + fileType + '/' + encodedPath;
    }

    async function deleteProjectFile(category, file) {
        const payload = {
            type: category,
            filename: file && (file.name || file.filename || ''),
            path: file && (file.path || '')
        };
        const res = await fetch(API_BASE + '/project-files/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || data.success === false) {
            throw new Error(data.error || '删除文件失败');
        }
        return data;
    }

    async function uploadTemplate(file, category) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category || '共用');
        const res = await fetch(API_BASE + '/templates/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok || data.success === false) {
            throw new Error(data.error || '上传模板失败');
        }
        return data;
    }

    // ==================== 日志管理 ====================

    /**
     * 获取日志列表
     * @param {Object} params - 查询参数
     * @returns {Promise<Object>}
     */
    async function getLogs(params) {
        const queryString = new URLSearchParams(params).toString();
        const url = API_BASE + '/logs?' + queryString;
        const res = await fetch(url);
        return await res.json();
    }

    /**
     * 获取日志统计
     * @returns {Promise<Object>}
     */
    async function getLogStats() {
        const res = await fetch(API_BASE + '/logs/stats');
        return await res.json();
    }

    // ==================== 数据删除 ====================

    /**
     * 删除页面数据
     * @param {string} type - 类型 (device/merge)
     * @returns {Promise<Object>}
     */
    async function deletePageData(type) {
        const res = await fetch(API_BASE + '/data/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type })
        });
        return await res.json();
    }

    // ==================== 导出模块 ====================

    window.DataService = {
        // 数据获取
        getAssets: getAssets,
        getMergeResults: getMergeResults,
        getAssetById: getAssetById,
        saveAsset: saveAsset,
        deleteAsset: deleteAsset,

        // 列配置
        getColumns: getColumns,
        saveColumns: saveColumns,

        // 统计
        getStats: getStats,

        // 导入导出
        importExcel: importExcel,
        exportExcel: exportExcel,

        // 文件管理
        getFiles: getFiles,
        switchFile: switchFile,
        deleteProjectFile: deleteProjectFile,
        getProjectFileDownloadUrl: getProjectFileDownloadUrl,
        uploadTemplate: uploadTemplate,

        // 日志
        getLogs: getLogs,
        getLogStats: getLogStats,

        // 数据删除
        deletePageData: deletePageData
    };

})(window);
