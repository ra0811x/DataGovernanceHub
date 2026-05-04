/**
 * Assets API client.
 * Handles requests for the current assets backend contract.
 */

(function(window) {
    'use strict';

    function AssetsApi(config) {
        window.ApiClient.call(this, config);
    }

    AssetsApi.prototype = Object.create(window.ApiClient.prototype);
    AssetsApi.prototype.constructor = AssetsApi;

    AssetsApi.prototype.list = function(params) {
        return this.get('/assets', params);
    };

    AssetsApi.prototype.getById = function(id) {
        return this.get('/assets/' + id);
    };

    AssetsApi.prototype.create = function(data) {
        return this.post('/assets', data);
    };

    AssetsApi.prototype.update = function(id, data) {
        return this.put('/assets/' + id, data);
    };

    AssetsApi.prototype.delete = function(id) {
        return window.HttpClient.delete('/assets/' + id);
    };

    AssetsApi.prototype.batchDelete = function(ids) {
        void ids;
        throw new Error('assets/batch-delete API is not available in the current backend contract');
    };

    AssetsApi.prototype.getStats = function(params) {
        return this.get('/stats', params);
    };

    AssetsApi.prototype.getCategories = function() {
        throw new Error('assets/categories API is not available in the current backend contract');
    };

    AssetsApi.prototype.import = function(formData) {
        return this.upload('/import/confirm', formData);
    };

    AssetsApi.prototype.export = function(params) {
        const queryString = Object.keys(params || {})
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
            .join('&');
        return window.HttpClient.get(this.buildURL('/export/assets/all') + (queryString ? '?' + queryString : ''), null, { headers: {} });
    };

    window.AssetsApi = AssetsApi;

})(window);
