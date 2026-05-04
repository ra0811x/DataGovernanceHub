/**
 * File-related API client aligned to the current backend contract.
 */

(function(window) {
    'use strict';

    function FilesApi(config) {
        window.ApiClient.call(this, config);
    }

    FilesApi.prototype = Object.create(window.ApiClient.prototype);
    FilesApi.prototype.constructor = FilesApi;

    function normalizePathToken(rawPath) {
        return String(rawPath || '').replace(/\\/g, '/');
    }

    function encodePathForUrl(rawPath) {
        return normalizePathToken(rawPath)
            .split('/')
            .map(encodeURIComponent)
            .join('/');
    }

    function extractCategoryFiles(result, category) {
        if (!category) {
            return result;
        }
        if (!result || !result.files) {
            return [];
        }
        return result.files[category] || [];
    }

    FilesApi.prototype.list = function(category) {
        return this.get('/project-files').then(function(result) {
            return extractCategoryFiles(result, category);
        });
    };

    FilesApi.prototype.getById = function(filename) {
        var targetName = String(filename || '');
        return this.get('/stored-files').then(function(result) {
            var files = (result && result.files) || [];
            return files.find(function(item) {
                return item && item.filename === targetName;
            }) || null;
        });
    };

    FilesApi.prototype.upload = function(formData, category) {
        var payload = formData instanceof FormData ? formData : new FormData();
        if (!payload.has('category') && category) {
            payload.append('category', category);
        }
        return this.uploadForm('/templates/upload', payload);
    };

    FilesApi.prototype.uploadForm = function(endpoint, formData) {
        var url = this.buildURL(endpoint);
        return window.HttpClient.upload(url, formData)
            .then(this.handleResponse.bind(this));
    };

    FilesApi.prototype.delete = function(filename) {
        return window.ApiClient.prototype.delete.call(
            this,
            '/stored-files/' + encodeURIComponent(filename || '')
        );
    };

    FilesApi.prototype.batchDelete = function() {
        return Promise.reject(new Error('batchDelete is not supported by current backend'));
    };

    FilesApi.prototype.download = function(fileType, fileTarget) {
        var url;
        if (fileTarget === undefined || fileTarget === null) {
            url = this.buildURL('/stored-files/download/' + encodeURIComponent(fileType || ''));
        } else {
            var type = encodeURIComponent(fileType || '');
            var target = encodePathForUrl(fileTarget || '');
            url = this.buildURL('/project-files/download/' + type + '/' + target);
        }
        return fetch(url, {
            method: 'GET',
            headers: {}
        }).then(function(response) {
            if (!response.ok) {
                return response.text().then(function(text) {
                    throw new Error(text || ('HTTP ' + response.status));
                });
            }
            return response.blob();
        });
    };

    FilesApi.prototype.getProjectFiles = function() {
        return this.get('/project-files');
    };

    FilesApi.prototype.saveProjectFile = function() {
        return Promise.reject(new Error('saveProjectFile is not supported by current backend'));
    };

    FilesApi.prototype.deleteProjectFile = function(fileInfo) {
        if (!fileInfo || typeof fileInfo !== 'object') {
            return Promise.reject(new Error('deleteProjectFile requires file metadata payload'));
        }
        return this.post('/project-files/delete', fileInfo);
    };

    FilesApi.prototype.getDataFiles = function() {
        return this.get('/stored-files');
    };

    FilesApi.prototype.deleteDataFile = function(filename) {
        return window.ApiClient.prototype.delete.call(
            this,
            '/stored-files/' + encodeURIComponent(filename || '')
        );
    };

    window.FilesApi = FilesApi;
})(window);
