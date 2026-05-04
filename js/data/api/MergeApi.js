/**
 * Merge results API client.
 * Handles requests for the current merge backend contract.
 */

(function(window) {
    'use strict';

    function MergeApi(config) {
        window.ApiClient.call(this, config);
    }

    MergeApi.prototype = Object.create(window.ApiClient.prototype);
    MergeApi.prototype.constructor = MergeApi;

    MergeApi.prototype.list = function(params) {
        return this.get('/merge/assets', params);
    };

    MergeApi.prototype.getById = function(id) {
        return this.get('/merge/assets/' + id);
    };

    MergeApi.prototype.create = function(data) {
        return this.post('/merge/assets', data);
    };

    MergeApi.prototype.update = function(id, data) {
        return this.put('/merge/assets/' + id, data);
    };

    MergeApi.prototype.delete = function(id) {
        return window.HttpClient.delete('/merge/assets/' + id);
    };

    MergeApi.prototype.batchDelete = function(ids) {
        void ids;
        throw new Error('merge/results/batch-delete API is not available in the current backend contract');
    };

    MergeApi.prototype.getColumns = function() {
        return this.get('/merge/columns');
    };

    MergeApi.prototype.saveColumns = function(config) {
        return this.post('/merge/columns', config);
    };

    MergeApi.prototype.import = function(formData) {
        return this.upload('/import/merge/confirm', formData);
    };

    MergeApi.prototype.export = function(params) {
        const queryString = Object.keys(params || {})
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
            .join('&');
        return window.HttpClient.get(this.buildURL('/export/merge-results/all') + (queryString ? '?' + queryString : ''), null, { headers: {} });
    };

    MergeApi.prototype.getStats = function(params) {
        return this.get('/merge/stats', params);
    };

    window.MergeApi = MergeApi;

})(window);
