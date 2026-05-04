/**
 * 应用初始化脚本
 * 演示如何使用三层架构初始化应用
 */

(function(window) {
    'use strict';

    /**
     * 应用容器
     * 管理所有服务的创建和生命周期
     */
    var AppContainer = {
        // API 客户端
        apis: {},
        // 仓库
        repositories: {},
        // 业务服务
        services: {},
        // 控制器
        controllers: {},

        /**
         * 初始化应用
         */
        init: function() {
            console.log('[App] 初始化三层架构应用...');

            // 1. 创建 API 客户端
            this._initApis();

            // 2. 创建仓库
            this._initRepositories();

            // 3. 创建业务服务
            this._initServices();

            // 4. 创建控制器
            this._initControllers();

            // 5. 初始化事件监听
            this._initEventListeners();

            console.log('[App] 三层架构应用初始化完成');
        },

        /**
         * 初始化 API 客户端
         */
        _initApis: function() {
            this.apis = {
                assets: new window.AssetsApi({ baseURL: window.API_BASE || '/api' }),
                merge: new window.MergeApi({ baseURL: window.API_BASE || '/api' }),
                modes: new window.ModesApi({ baseURL: window.API_BASE || '/api' }),
                columns: new window.ColumnsApi({ baseURL: window.API_BASE || '/api' }),
                logs: new window.LogsApi({ baseURL: window.API_BASE || '/api' }),
                files: new window.FilesApi({ baseURL: window.API_BASE || '/api' })
            };
            console.log('[App] API 客户端已创建');
        },

        /**
         * 初始化仓库
         */
        _initRepositories: function() {
            this.repositories = {
                assets: new window.AssetsRepository(this.apis.assets),
                merge: new window.MergeRepository(this.apis.merge),
                modes: new window.ModesRepository(this.apis.modes),
                columns: new window.ColumnsRepository(this.apis.columns)
            };
            console.log('[App] 仓库已创建');
        },

        /**
         * 初始化业务服务
         */
        _initServices: function() {
            this.services = {
                asset: new window.AssetService(this.repositories.assets),
                merge: new window.MergeService(this.repositories.merge),
                column: new window.ColumnService(this.repositories.columns, this.repositories.modes)
            };
            console.log('[App] 业务服务已创建');
        },

        /**
         * 初始化控制器
         */
        _initControllers: function() {
            // 数据概览页控制器
            this.controllers.device = new window.DevicePageController(
                this.services.asset,
                this.services.column,
                window.EventBus
            );

            // 合并结果页控制器
            this.controllers.merge = new window.MergePageController(
                this.services.merge,
                this.services.column,
                window.EventBus
            );

            console.log('[App] 控制器已创建');
        },

        /**
         * 初始化事件监听
         */
        _initEventListeners: function() {
            var self = this;

            // 监听数据刷新事件
            window.EventBus.on('app:refresh', function() {
                console.log('[App] 收到刷新事件');
                if (self.controllers.device) {
                    self.controllers.device.refresh();
                }
                if (self.controllers.merge) {
                    self.controllers.merge.refresh();
                }
            });

            // 监听模式切换事件
            window.EventBus.on('mode:changed', function(data) {
                console.log('[App] 模式切换:', data);
                // 切换模式时清除相关缓存
                if (data.pageType === 'device') {
                    self.repositories.assets.clearCache();
                } else if (data.pageType === 'merge') {
                    self.repositories.merge.clearCache();
                }
            });

            console.log('[App] 事件监听已初始化');
        },

        /**
         * 启动应用
         */
        start: function() {
            console.log('[App] 启动应用...');

            // 初始化数据概览页控制器
            if (this.controllers.device && document.getElementById('tableBody')) {
                this.controllers.device.init();
                console.log('[App] 数据概览页已启动');
            }

            // 注意：合并结果页控制器在页面切换时才初始化
        },

        /**
         * 启动合并结果页
         */
        startMergePage: function() {
            if (this.controllers.merge && document.getElementById('tableBody2')) {
                this.controllers.merge.init();
                console.log('[App] 合并结果页已启动');
            }
        },

        /**
         * 获取服务（供外部使用）
         */
        getService: function(name) {
            return this.services[name];
        },

        /**
         * 获取控制器（供外部使用）
         */
        getController: function(name) {
            return this.controllers[name];
        }
    };

    // ==================== 自动初始化 ====================

    // 在 DOM 加载完成后初始化应用
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            AppContainer.init();
            // 暴露到全局，供外部使用
            window.App = AppContainer;
        });
    } else {
        AppContainer.init();
        window.App = AppContainer;
    }

    // ==================== 导出模块 API ====================

    window.AppContainer = AppContainer;

})(window);
