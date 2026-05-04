(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.ImportFlowUtils = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    function getDocument(doc) {
        if (doc) {
            return doc;
        }
        if (typeof document !== 'undefined') {
            return document;
        }
        return null;
    }

    function wait(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }

    function hideLegacyProgressModal(doc) {
        var targetDoc = getDocument(doc);
        if (!targetDoc) {
            return false;
        }

        var modal = targetDoc.getElementById('progressModal');
        if (!modal) {
            return false;
        }

        if (modal.classList && typeof modal.classList.remove === 'function') {
            modal.classList.remove('show');
        }
        if (modal.style) {
            modal.style.display = 'none';
        }

        var closeBtn = targetDoc.getElementById('progressCloseBtn');
        if (closeBtn && closeBtn.style) {
            closeBtn.style.display = 'none';
        }

        return true;
    }

    function isEmptyStateVisible(pageType, doc) {
        var targetDoc = getDocument(doc);
        if (!targetDoc) {
            return false;
        }

        var emptyStateId = pageType === 'merge' ? 'mergeEmptyState' : 'deviceEmptyState';
        var emptyState = targetDoc.getElementById(emptyStateId);
        if (!emptyState) {
            return false;
        }

        if (emptyState.hidden === true) {
            return false;
        }
        if (emptyState.style && emptyState.style.display === 'none') {
            return false;
        }

        return true;
    }

    function hasRenderedData(pageType, doc) {
        var targetDoc = getDocument(doc);
        if (!targetDoc) {
            return false;
        }

        var tableBodyId = pageType === 'merge' ? 'tableBody2' : 'tableBody';
        var tableBody = targetDoc.getElementById(tableBodyId);
        if (!tableBody || typeof tableBody.querySelectorAll !== 'function') {
            return false;
        }

        var rows = Array.prototype.slice.call(tableBody.querySelectorAll('tr'));
        if (rows.length === 0) {
            return false;
        }

        return rows.some(function(row) {
            if (!row || typeof row.querySelectorAll !== 'function') {
                return false;
            }

            var cells = Array.prototype.slice.call(row.querySelectorAll('td'));
            if (cells.length === 0) {
                return true;
            }

            return cells.some(function(cell) {
                var className = cell && typeof cell.className === 'string' ? cell.className : '';
                return className.indexOf('loading') === -1;
            });
        });
    }

    async function refreshImportedPage(pageType, options) {
        var settings = options || {};
        var attempts = settings.attempts || (pageType === 'merge' ? 5 : 3);
        var delayMs = settings.delayMs || 250;
        var loadColumns = typeof settings.loadColumns === 'function' ? settings.loadColumns : null;
        var loadData = typeof settings.loadData === 'function' ? settings.loadData : null;
        var loadStats = typeof settings.loadStats === 'function' ? settings.loadStats : null;
        var targetDoc = getDocument(settings.document);

        if (!loadData) {
            throw new Error('refreshImportedPage requires loadData');
        }

        for (var index = 0; index < attempts; index += 1) {
            if (loadColumns) {
                await loadColumns();
            }

            await loadData();

            if (loadStats) {
                await loadStats();
            }

            if (hasRenderedData(pageType, targetDoc) || !isEmptyStateVisible(pageType, targetDoc)) {
                return true;
            }

            if (index < attempts - 1) {
                await wait(delayMs);
            }
        }

        return false;
    }

    return {
        wait: wait,
        hideLegacyProgressModal: hideLegacyProgressModal,
        isEmptyStateVisible: isEmptyStateVisible,
        hasRenderedData: hasRenderedData,
        refreshImportedPage: refreshImportedPage
    };
});
