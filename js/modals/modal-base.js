/**
 * 模态框基础类
 * 提供通用的模态框功能，其他模态框可以继承或使用此基类
 * 从 index.html 迁移
 */

(function(window) {
    'use strict';

    /**
     * 模态框基础类
     */
    class ModalBase {
        /**
         * 构造函数
         * @param {string} modalId - 模态框的DOM ID
         * @param {Object} options - 配置选项
         */
        constructor(modalId, options = {}) {
            this.modalId = modalId;
            this.element = document.getElementById(modalId);
            this.options = {
                closeOnBackdrop: true,
                closeOnEsc: true,
                onShow: null,
                onHide: null,
                ...options
            };
            this.isOpen = false;

            this.init();
        }

        /**
         * 初始化模态框
         */
        init() {
            if (!this.element) {
                console.warn(`Modal: Element with id "${this.modalId}" not found`);
                return;
            }

            // 绑定关闭按钮事件
            const closeButtons = this.element.querySelectorAll('[data-dismiss="modal"], .modal-close, .close-btn');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.hide());
            });

            // 绑定背景点击关闭
            if (this.options.closeOnBackdrop) {
                this.element.addEventListener('click', (e) => {
                    if (e.target === this.element) {
                        this.hide();
                    }
                });
            }

            // 绑定 ESC 键关闭
            if (this.options.closeOnEsc) {
                this.handleEscKey = (e) => {
                    if (e.key === 'Escape' && this.isOpen) {
                        this.hide();
                    }
                };
                document.addEventListener('keydown', this.handleEscKey);
            }
        }

        /**
         * 显示模态框
         * @param {Object} data - 要传递给模态框的数据
         */
        show(data) {
            if (!this.element) return;

            this.currentData = data;
            this.element.style.display = 'flex';

            // 触发重绘以启用过渡动画
            this.element.offsetHeight;

            this.element.classList.add('show');
            this.isOpen = true;

            // 禁用页面滚动
            document.body.style.overflow = 'hidden';

            // 回调
            if (typeof this.options.onShow === 'function') {
                this.options.onShow(this, data);
            }
        }

        /**
         * 隐藏模态框
         */
        hide() {
            if (!this.element || !this.isOpen) return;

            this.element.classList.remove('show');
            this.isOpen = false;

            // 延迟隐藏，等待动画完成
            setTimeout(() => {
                if (!this.isOpen) {
                    this.element.style.display = 'none';
                    // 恢复页面滚动
                    document.body.style.overflow = '';
                }
            }, 300);

            // 回调
            if (typeof this.options.onHide === 'function') {
                this.options.onHide(this);
            }

            // 清除数据
            this.currentData = null;
        }

        /**
         * 切换显示状态
         */
        toggle() {
            if (this.isOpen) {
                this.hide();
            } else {
                this.show();
            }
        }

        /**
         * 设置模态框内容
         * @param {string} html - HTML 内容
         */
        setContent(html) {
            const contentContainer = this.element.querySelector('.modal-body, .modal-content-body');
            if (contentContainer) {
                contentContainer.innerHTML = html;
            }
        }

        /**
         * 设置模态框标题
         * @param {string} title - 标题文本
         */
        setTitle(title) {
            const titleElement = this.element.querySelector('.modal-title, .modal-content-title');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }

        /**
         * 获取模态框中的表单数据
         * @returns {Object} 表单数据对象
         */
        getFormData() {
            const form = this.element.querySelector('form');
            if (!form) return {};

            const formData = new FormData(form);
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            return data;
        }

        /**
         * 重置表单
         */
        resetForm() {
            const form = this.element.querySelector('form');
            if (form) {
                form.reset();
            }
        }

        /**
         * 销毁模态框
         */
        destroy() {
            if (this.handleEscKey) {
                document.removeEventListener('keydown', this.handleEscKey);
            }
            if (this.element) {
                this.element.remove();
            }
            this.element = null;
        }
    }

    // ==================== 模态框管理器 ====================

    const ModalManager = {
        modals: {},

        /**
         * 注册模态框
         * @param {string} id - 模态框ID
         * @param {ModalBase} modal - 模态框实例
         */
        register(id, modal) {
            this.modals[id] = modal;
        },

        /**
         * 获取模态框实例
         * @param {string} id - 模态框ID
         * @returns {ModalBase|null}
         */
        get(id) {
            return this.modals[id] || null;
        },

        /**
         * 显示指定ID的模态框
         * @param {string} id - 模态框ID
         * @param {Object} data - 数据
         */
        show(id, data) {
            const modal = this.get(id);
            if (modal) {
                modal.show(data);
            } else {
                console.warn(`Modal: "${id}" not found`);
            }
        },

        /**
         * 隐藏指定ID的模态框
         * @param {string} id - 模态框ID
         */
        hide(id) {
            const modal = this.get(id);
            if (modal) {
                modal.hide();
            }
        },

        /**
         * 隐藏所有模态框
         */
        hideAll() {
            Object.values(this.modals).forEach(modal => modal.hide());
        }
    };

    // ==================== 工具函数 ====================

    /**
     * 创建简单的确认对话框
     * @param {string} message - 确认消息
     * @param {Function} onConfirm - 确认回调
     * @param {Object} options - 选项
     */
    function confirm(message, onConfirm, options = {}) {
        const config = {
            title: '确认',
            confirmText: '确定',
            cancelText: '取消',
            type: 'warning',
            ...options
        };

        // 使用原生 confirm 作为备选
        if (typeof window.customConfirm === 'function') {
            window.customConfirm(message, onConfirm, config);
        } else {
            if (window.confirm(message)) {
                onConfirm();
            }
        }
    }

    /**
     * 创建简单的提示对话框
     * @param {string} message - 提示消息
     * @param {Object} options - 选项
     */
    function alert(message, options = {}) {
        const config = {
            title: '提示',
            type: 'info',
            ...options
        };

        if (typeof window.customAlert === 'function') {
            window.customAlert(message, config);
        } else {
            window.alert(message);
        }
    }

    // ==================== 导出 API ====================

    window.ModalBase = ModalBase;
    window.ModalManager = ModalManager;
    window.ModalHelper = {
        confirm: confirm,
        alert: alert
    };

})(window);
