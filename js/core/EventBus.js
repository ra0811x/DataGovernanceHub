/**
 * 事件总线
 * 提供发布订阅模式的事件系统，支持命名空间
 */

(function(window) {
    'use strict';

    // ==================== 事件存储 ====================
    const events = {};

    // ==================== 命名空间工具 ====================

    /**
     * 解析事件名称
     * @param {string} eventName - 事件名称（可包含命名空间）
     * @returns {Object} { name: string, namespace: string }
     */
    function parseEventName(eventName) {
        const parts = eventName.split(':');
        if (parts.length > 1) {
            return {
                name: parts.pop(),
                namespace: parts.join(':')
            };
        }
        return {
            name: eventName,
            namespace: null
        };
    }

    /**
     * 匹配事件命名空间
     * @param {string} eventKey - 事件键
     * @param {Object} parsed - 解析后的事件名称
     * @returns {boolean} 是否匹配
     */
    function matchNamespace(eventKey, parsed) {
        if (!parsed.namespace) {
            return true;
        }
        return eventKey.startsWith(parsed.namespace + ':');
    }

    // ==================== 核心方法 ====================

    /**
     * 订阅事件
     * @param {string} eventName - 事件名称（支持命名空间，如 "module:action"）
     * @param {Function} handler - 事件处理函数
     * @param {Object} context - 上下文对象（可选）
     * @returns {Function} 取消订阅函数
     */
    function on(eventName, handler, context) {
        if (typeof handler !== 'function') {
            console.error('[EventBus] Handler must be a function');
            return function() {};
        }

        const parsed = parseEventName(eventName);

        // 初始化事件存储
        if (!events[eventName]) {
            events[eventName] = [];
        }

        // 创建订阅记录
        const subscription = {
            handler: handler,
            context: context || null,
            id: generateId(),
            eventName: eventName
        };

        events[eventName].push(subscription);

        // 返回取消订阅函数
        return function() {
            off(eventName, subscription.id);
        };
    }

    /**
     * 订阅事件（仅执行一次）
     * @param {string} eventName - 事件名称
     * @param {Function} handler - 事件处理函数
     * @param {Object} context - 上下文对象（可选）
     * @returns {Function} 取消订阅函数
     */
    function once(eventName, handler, context) {
        if (typeof handler !== 'function') {
            console.error('[EventBus] Handler must be a function');
            return function() {};
        }

        let unsubscribe = null;

        const wrapper = function() {
            // 取消订阅
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
            // 执行处理函数
            return handler.apply(context || null, arguments);
        };

        unsubscribe = on(eventName, wrapper, context);

        return unsubscribe;
    }

    /**
     * 取消订阅事件
     * @param {string} eventName - 事件名称
     * @param {string|Function} handlerOrId - 处理函数或订阅 ID
     */
    function off(eventName, handlerOrId) {
        if (!events[eventName]) {
            return;
        }

        if (handlerOrId === undefined) {
            // 移除该事件的所有订阅者
            delete events[eventName];
            return;
        }

        const listeners = events[eventName];
        const id = typeof handlerOrId === 'string' ? handlerOrId : null;
        const handler = typeof handlerOrId === 'function' ? handlerOrId : null;

        for (let i = listeners.length - 1; i >= 0; i--) {
            if ((id && listeners[i].id === id) ||
                (handler && listeners[i].handler === handler)) {
                listeners.splice(i, 1);
            }
        }

        // 如果没有订阅者了，删除事件
        if (listeners.length === 0) {
            delete events[eventName];
        }
    }

    /**
     * 发布事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     * @returns {boolean} 是否有订阅者处理了该事件
     */
    function emit(eventName, data) {
        const parsed = parseEventName(eventName);
        let hasListeners = false;

        // 查找匹配的事件订阅者
        Object.keys(events).forEach(function(key) {
            const keyParsed = parseEventName(key);

            // 检查事件名和命名空间是否匹配
            if (keyParsed.name === parsed.name && matchNamespace(key, parsed)) {
                const listeners = events[key];
                if (listeners && listeners.length > 0) {
                    hasListeners = true;
                    // 复制数组，避免在处理过程中数组被修改
                    const listenersCopy = listeners.slice();

                    listenersCopy.forEach(function(subscription) {
                        try {
                            subscription.handler.call(subscription.context, data, eventName);
                        } catch (error) {
                            console.error('[EventBus] Error in handler for "' + eventName + '":', error);
                        }
                    });
                }
            }
        });

        return hasListeners;
    }

    /**
     * 异步发布事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     * @returns {Promise} Promise 对象
     */
    function emitAsync(eventName, data) {
        return new Promise(function(resolve) {
            // 使用 setTimeout 将事件处理推迟到下一个事件循环
            setTimeout(function() {
                emit(eventName, data);
                resolve();
            }, 0);
        });
    }

    // ==================== 批量操作 ====================

    /**
     * 批量订阅事件
     * @param {Object} eventMap - 事件映射 { eventName: handler }
     * @param {Object} context - 上下文对象（可选）
     * @returns {Object} 取消订阅函数集合
     */
    function onMany(eventMap, context) {
        const unsubscribers = {};

        Object.keys(eventMap).forEach(function(eventName) {
            unsubscribers[eventName] = on(eventName, eventMap[eventName], context);
        });

        return {
            offAll: function() {
                Object.keys(unsubscribers).forEach(function(eventName) {
                    unsubscribers[eventName]();
                });
            }
        };
    }

    /**
     * 清空所有事件订阅
     */
    function clear() {
        Object.keys(events).forEach(function(key) {
            delete events[key];
        });
    }

    // ==================== 工具方法 ====================

    /**
     * 生成唯一 ID
     * @returns {string} 唯一 ID
     */
    function generateId() {
        return '_evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取事件的所有订阅者数量
     * @param {string} eventName - 事件名称
     * @returns {number} 订阅者数量
     */
    function listenerCount(eventName) {
        if (!events[eventName]) {
            return 0;
        }
        return events[eventName].length;
    }

    /**
     * 获取所有事件名称
     * @returns {Array<string>} 事件名称列表
     */
    function eventNames() {
        return Object.keys(events);
    }

    // ==================== 导出模块 API ====================

    window.EventBus = {
        // 核心方法
        on: on,
        once: once,
        off: off,
        emit: emit,
        emitAsync: emitAsync,

        // 批量操作
        onMany: onMany,
        clear: clear,

        // 工具方法
        listenerCount: listenerCount,
        eventNames: eventNames,

        // 内部属性（用于测试）
        _events: events
    };

})(window);
