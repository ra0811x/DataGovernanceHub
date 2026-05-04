// ==================== 上传组件 ====================

// 文件上传管理器
class UploadManager {
    constructor(options = {}) {
        this.onFileSelect = options.onFileSelect || null;
        this.onUploadStart = options.onUploadStart || null;
        this.onProgress = options.onProgress || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        this.accept = options.accept || '.xlsx,.xls,.csv';
    }

    // 创建文件输入框
    createInput(id = 'file-input') {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = id;
        input.accept = this.accept;
        input.style.display = 'none';
        input.onchange = (e) => this.handleFileSelect(e);
        document.body.appendChild(input);
        return input;
    }

    // 触发文件选择
    selectFile(inputId = 'file-input') {
        const input = document.getElementById(inputId);
        if (input) {
            input.click();
        }
    }

    // 处理文件选择
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (this.onFileSelect) {
                this.onFileSelect(file);
            }
        }
        // 清空input以便重复选择同一文件
        event.target.value = '';
    }

    // 上传文件
    upload(file, url, options = {}) {
        const formData = new FormData();
        formData.append('file', file);

        // 添加额外参数
        if (options.params) {
            Object.keys(options.params).forEach(key => {
                formData.append(key, options.params[key]);
            });
        }

        const xhr = new XMLHttpRequest();

        // 监听上传进度
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && this.onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                this.onProgress(percent, e.loaded, e.total);
            }
        };

        // 上传完成
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (this.onComplete) {
                        this.onComplete(response);
                    }
                } catch (e) {
                    if (this.onComplete) {
                        this.onComplete({ success: false, error: '解析响应失败' });
                    }
                }
            } else {
                if (this.onError) {
                    this.onError(new Error(`上传失败: ${xhr.status}`));
                }
            }
        };

        // 上传错误
        xhr.onerror = () => {
            if (this.onError) {
                this.onError(new Error('网络错误'));
            }
        };

        // 开始上传
        if (this.onUploadStart) {
            this.onUploadStart();
        }

        xhr.open('POST', url);
        xhr.send(formData);

        return xhr;
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    // 获取文件扩展名
    getExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }

    // 验证文件类型
    validateType(file, allowedTypes = ['xlsx', 'xls', 'csv']) {
        const ext = this.getExtension(file.name).toLowerCase();
        return allowedTypes.includes(ext);
    }
}

// 创建全局实例
window.uploadManager = new UploadManager();
