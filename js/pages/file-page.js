/**
 * 文件管理页面模块
 * 负责工程文件管理、模板上传等功能
 */

(function(window) {
    'use strict';

    const state = {
        currentTab: 'files',
        currentCategory: 'templates',
        currentFiles: []
    };

    const fileCategories = {
        templates: { name: '模板文件', color: '#17a2b8' },
        databases: { name: '数据库文件', color: '#6c757d' },
        merge_results: { name: '合并结果文件', color: '#fd7e14' },
        assets: { name: '数据概览文件', color: '#005fe0' },
        exports: { name: '填报数据文件', color: '#28a745' }
    };
    let stickyOffsetFrame = null;

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function decodeFileNameToken(encodedName) {
        try {
            return decodeURIComponent(encodedName || '');
        } catch (e) {
            return String(encodedName || '');
        }
    }

    function hasWorkspaceLayout() {
        return Boolean(document.getElementById('fileManagementCurrentCategoryTitle'));
    }

    function updateWorkspaceStickyOffset() {
        stickyOffsetFrame = null;
        const page = document.getElementById('page-report');
        const header = page ? page.querySelector('.page-report-header') : null;
        if (!page || !header) {
            return;
        }

        const headerHeight = header.offsetHeight || 0;
        const safeOffset = Math.max(headerHeight, 140);
        page.style.setProperty('--file-sticky-offset', safeOffset + 'px');
    }

    function scheduleWorkspaceStickyOffset() {
        if (stickyOffsetFrame !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(stickyOffsetFrame);
        }
        if (typeof window.requestAnimationFrame === 'function') {
            stickyOffsetFrame = window.requestAnimationFrame(updateWorkspaceStickyOffset);
            return;
        }
        updateWorkspaceStickyOffset();
    }

    function init() {
        scheduleWorkspaceStickyOffset();
        if (hasWorkspaceLayout()) {
            return;
        }
        loadFiles();
    }

    function switchTab(tab, element) {
        if (hasWorkspaceLayout() &&
            typeof window.switchFileManagementTab === 'function' &&
            window.switchFileManagementTab !== switchTab) {
            const result = window.switchFileManagementTab(tab, element);
            scheduleWorkspaceStickyOffset();
            return result;
        }

        state.currentTab = tab;

        document.querySelectorAll('#page-report .tab-button').forEach(function(btn) {
            btn.classList.remove('active');
        });
        if (element) {
            element.classList.add('active');
        }

        ['files', 'templates'].forEach(function(name) {
            const content = document.getElementById('tab-' + name);
            if (content) {
                content.classList.toggle('active', name === tab);
            }
        });

        if (tab === 'files') {
            loadFiles();
        }
        scheduleWorkspaceStickyOffset();
    }

    async function loadFiles() {
        if (hasWorkspaceLayout() &&
            typeof window.loadStoredFiles === 'function') {
            const result = await window.loadStoredFiles();
            scheduleWorkspaceStickyOffset();
            return result;
        }

        const container = document.getElementById('filesContainer');
        if (!container) return;

        try {
            const result = await DataService.getFiles(state.currentCategory);
            state.currentFiles = result.files || [];

            if (state.currentFiles.length > 0) {
                renderFileList(state.currentFiles, container);
            } else {
                container.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">暂无文件</div>';
            }
            scheduleWorkspaceStickyOffset();
        } catch (e) {
            console.error('加载文件列表失败:', e);
            state.currentFiles = [];
            scheduleWorkspaceStickyOffset();
        }
    }

    function renderFileList(files, container) {
        const html = files.map(function(file) {
            const encodedName = encodeURIComponent(file.name || '');
            const name = escapeHtml(file.name);
            const statusBadge = file.current
                ? '<span class="file-status-badge current">当前使用</span>'
                : '<span class="file-status-badge">可用</span>';

            const switchButton = (file.switchable && !file.current)
                ? `<button class="btn btn-primary btn-sm" onclick="FilePage.switchFile('${encodedName}')">切换使用</button>`
                : '<button class="btn btn-sm" disabled>仅支持下载/删除</button>';

            return `
                <div class="file-card ${file.current ? 'active' : ''}" data-filename="${name}">
                    <div class="file-card-header">
                        <span class="file-name">${name}</span>
                        ${statusBadge}
                    </div>
                    <div class="file-card-body">
                        <div class="file-meta">
                            <span>大小: ${escapeHtml(file.size || '-')}</span>
                            <span>修改时间: ${escapeHtml(file.modified || '-')}</span>
                        </div>
                        ${file.description ? `<div class="file-description">${escapeHtml(file.description)}</div>` : ''}
                    </div>
                    <div class="file-card-footer">
                        ${switchButton}
                        <button class="btn btn-sm" onclick="FilePage.downloadFile('${encodedName}')">下载</button>
                        <button class="btn btn-danger btn-sm" onclick="FilePage.deleteFile('${encodedName}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    function switchCategory(category, element) {
        if (hasWorkspaceLayout() &&
            typeof window.switchFileCategory === 'function' &&
            window.switchFileCategory !== switchCategory) {
            const result = window.switchFileCategory(category, element);
            scheduleWorkspaceStickyOffset();
            return result;
        }

        state.currentCategory = category;

        document.querySelectorAll('.category-tab').forEach(function(btn) {
            btn.style.background = '#f8f9fa';
            btn.style.color = '#333';
            btn.style.border = '1px solid #e9ecef';
        });

        if (element) {
            const config = fileCategories[category] || fileCategories.templates;
            element.style.background = config.color;
            element.style.color = 'white';
            element.style.border = 'none';
        }

        loadFiles();
        scheduleWorkspaceStickyOffset();
    }

    async function switchFile(encodedName) {
        const filename = decodeFileNameToken(encodedName);
        if (!confirm('确认切换使用文件: ' + filename + '?')) {
            return;
        }

        try {
            const result = await DataService.switchFile(state.currentCategory, filename);
            if (result && result.success === false) {
                throw new Error(result.error || '切换失败');
            }
            showToast('切换成功', false);
            loadFiles();
            scheduleWorkspaceStickyOffset();
        } catch (e) {
            showToast('切换失败: ' + (e.message || '未知错误'), true);
        }
    }

    function downloadFile(encodedName) {
        const filename = decodeFileNameToken(encodedName);
        const file = state.currentFiles.find(function(item) {
            return item.name === filename;
        }) || { name: filename };

        const a = document.createElement('a');
        a.href = DataService.getProjectFileDownloadUrl(state.currentCategory, file);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function deleteFile(encodedName) {
        const filename = decodeFileNameToken(encodedName);
        if (!confirm('确认删除文件: ' + filename + ' ?\n\n此操作不可恢复。')) {
            return;
        }

        try {
            const file = state.currentFiles.find(function(item) {
                return item.name === filename;
            }) || { name: filename };
            await DataService.deleteProjectFile(state.currentCategory, file);
            showToast('删除成功', false);
            loadFiles();
            scheduleWorkspaceStickyOffset();
        } catch (e) {
            showToast('删除失败: ' + (e.message || '未知错误'), true);
        }
    }

    async function uploadFiles(files) {
        if (!files || files.length === 0) return;

        if (state.currentCategory !== 'templates') {
            showToast('仅模板分类支持上传', true);
            return;
        }

        try {
            showToast('正在上传...', false);
            for (let i = 0; i < files.length; i++) {
                await DataService.uploadTemplate(files[i], '共用');
            }
            showToast('上传成功', false);
            loadFiles();
            scheduleWorkspaceStickyOffset();
        } catch (e) {
            showToast('上传失败: ' + (e.message || '未知错误'), true);
        }
    }

    window.FilePage = {
        init: init,
        switchTab: switchTab,
        switchCategory: switchCategory,
        switchFile: switchFile,
        downloadFile: downloadFile,
        deleteFile: deleteFile,
        uploadFiles: uploadFiles,
        loadFiles: loadFiles,
        state: state
    };

    if (!window.switchFileManagementTab) {
        window.switchFileManagementTab = switchTab;
    }
    if (!window.switchFileCategory) {
        window.switchFileCategory = switchCategory;
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', scheduleWorkspaceStickyOffset);
    }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('resize', scheduleWorkspaceStickyOffset);
        window.addEventListener('load', scheduleWorkspaceStickyOffset);
    }

})(window);
