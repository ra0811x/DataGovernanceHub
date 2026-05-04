#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
数管前端系统 - 配置文件
集中管理系统配置参数
"""
import os
import ctypes
from ctypes import wintypes


def _env_bool(name, default=False):
    """从环境变量读取布尔值。"""
    value = os.environ.get(name)
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_int(name, default):
    """从环境变量读取整数值。"""
    value = os.environ.get(name)
    if value is None or str(value).strip() == '':
        return default
    try:
        return int(str(value).strip())
    except ValueError:
        return default


def _env_list(name):
    """从环境变量读取逗号分隔列表。"""
    value = os.environ.get(name, '')
    return [item.strip() for item in str(value).split(',') if item.strip()]


def _env_path(name, default):
    value = os.environ.get(name)
    if value is None or str(value).strip() == '':
        return os.path.normpath(default)
    return os.path.normpath(os.path.expanduser(str(value).strip()))


def _get_windows_downloads_dir():
    """获取当前 Windows 用户的默认下载目录。"""
    # FOLDERID_Downloads: {374DE290-123F-4565-9164-39C4925E467B}
    class GUID(ctypes.Structure):
        _fields_ = [
            ("Data1", wintypes.DWORD),
            ("Data2", wintypes.WORD),
            ("Data3", wintypes.WORD),
            ("Data4", ctypes.c_byte * 8),
        ]

    folder_id_downloads = GUID(
        0x374DE290,
        0x123F,
        0x4565,
        (ctypes.c_byte * 8)(0x91, 0x64, 0x39, 0xC4, 0x92, 0x5E, 0x46, 0x7B),
    )

    path_ptr = ctypes.c_wchar_p()
    try:
        result = ctypes.windll.shell32.SHGetKnownFolderPath(
            ctypes.byref(folder_id_downloads),
            0,
            None,
            ctypes.byref(path_ptr),
        )
        if result == 0 and path_ptr.value:
            return os.path.normpath(path_ptr.value)
    except Exception:
        return ''
    finally:
        if path_ptr:
            ctypes.windll.ole32.CoTaskMemFree(path_ptr)

    return ''


def _default_download_dir(base_dir):
    """获取默认下载目录，失败时回退到项目导出目录。"""
    windows_downloads = _get_windows_downloads_dir()
    if windows_downloads:
        return windows_downloads

    fallback_user_downloads = os.path.join(os.path.expanduser('~'), 'Downloads')
    if os.path.isdir(os.path.dirname(fallback_user_downloads)):
        return os.path.normpath(fallback_user_downloads)

    return os.path.join(base_dir, 'SGExportFiles', 'Common')

# ==================== 基础配置 ====================

class Config:
    """基础配置类"""

    # 项目根目录（向上两级到项目根目录）
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Flask配置
    SECRET_KEY = 'dev-secret-key-please-change-in-production'
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 最大上传500MB
    HOST = os.environ.get('APP_HOST', '127.0.0.1').strip() or '127.0.0.1'
    PORT = _env_int('APP_PORT', 8100)
    DEBUG = _env_bool('APP_DEBUG', False)

    # 跨域配置
    ENABLE_CORS = _env_bool('ENABLE_CORS', False)
    CORS_ORIGINS = _env_list('CORS_ORIGINS')

# ==================== 数据库配置 ====================

class DatabaseConfig:
    """数据库配置类"""

    # 设备管理数据库（数管数据库资产信息概览表）
    ASSETS_DB = os.path.join(Config.BASE_DIR, 'data', 'assets.db')

    # 合并结果数据库
    MERGE_RESULTS_DB = os.path.join(Config.BASE_DIR, 'data', 'merge_results.db')

    # 系统日志数据库
    LOGS_DB = os.path.join(Config.BASE_DIR, 'data', 'logs.db')

    # 数据库连接配置
    ROW_FACTORY = True  # 启用Row工厂，支持字典访问

# ==================== 文件路径配置 ====================

class PathConfig:
    """文件路径配置类"""

    # 列配置文件路径
    ASSETS_COLUMNS_JSON = os.path.join(Config.BASE_DIR, 'config', 'columns.json')
    MERGE_COLUMNS_JSON = os.path.join(Config.BASE_DIR, 'config', 'merge_columns.json')

    # 文件上传目录
    UPLOAD_FOLDER = os.path.join(Config.BASE_DIR, 'uploaded_files')

    # 通用导出文件目录
    EXPORT_FOLDER = _env_path(
        'EXPORT_FOLDER',
        _default_download_dir(Config.BASE_DIR)
    )

    # 日志目录

    # Templates目录（存放各类模板文件）
    TEMPLATES_DIR = os.path.join(Config.BASE_DIR, 'Templates')

    # 业支上报导出目录
    YEZHI_EXPORT_DIR = os.path.join(Config.BASE_DIR, 'SGExportFiles', 'YeZhi')

    # SMC上报导出目录
    SMC_EXPORT_DIR = os.path.join(Config.BASE_DIR, 'SGExportFiles', 'SMC')

    # 信安上报导出目录
    XINAN_EXPORT_DIR = os.path.join(Config.BASE_DIR, 'SGExportFiles', 'XinAn')

    @classmethod
    def ensure_directories(cls):
        """确保所有必要的目录存在"""
        directories = [
            cls.UPLOAD_FOLDER,
            cls.EXPORT_FOLDER,
            cls.TEMPLATES_DIR,
            cls.YEZHI_EXPORT_DIR,
            cls.SMC_EXPORT_DIR,
            cls.XINAN_EXPORT_DIR
        ]
        for directory in directories:
            if not os.path.exists(directory):
                os.makedirs(directory)

# ==================== 分页配置 ====================

class PaginationConfig:
    """分页配置类"""

    # 默认每页条数
    DEFAULT_PAGE_SIZE = 50

    # 最大每页条数
    MAX_PAGE_SIZE = 1000

    # 合并结果页面默认每页条数（大数据量）
    MERGE_DEFAULT_PAGE_SIZE = 100

    # 合并结果页面最大每页条数
    MERGE_MAX_PAGE_SIZE = 500

# ==================== 导出配置 ====================

class ExportConfig:
    """导出配置类"""

    # 导出文件名模板
    FILENAME_TEMPLATE = "{name}_{date}_{seq}.xlsx"
    DATE_FORMAT = "%Y%m%d"
    TIME_FORMAT = "%H%M"

    # 业支上报导出配置
    YEZHI_EXPORTS = {
        'i_10600_10001': {
            'name': 'i_10600_10001',
            'description': '业支上报-数据库资产信息表',
            'template_file': os.path.join(PathConfig.TEMPLATES_DIR, '业支上报', 'i_10600_10001_template.xlsx'),
            'data_start_row': 5,
            'total_columns': 19
        },
        'i_10600_10002': {
            'name': 'i_10600_10002',
            'description': '业支上报-数据资产字段信息表',
            'template_file': os.path.join(PathConfig.TEMPLATES_DIR, '业支上报', 'i_10600_10002_template.xlsx'),
            'data_start_row': 2,
            'total_columns': 29
        }
    }

    # 批量处理配置
    BATCH_SIZE = 10000  # 每批次处理的记录数
    PROGRESS_UPDATE_INTERVAL = 1000  # 进度更新间隔（记录数）

    # 数据样例映射配置
    DATA_MAPPER_FILE = _env_path(
        'DATA_MAPPER_FILE',
        os.path.join(Config.BASE_DIR, '共用文件部分', '数据分级标准样例.xlsx')
    )
    DATA_MAPPER_SHEET = "Sheet1"
    DATA_MAPPER_NAME_COLUMN = "数据类型（数管开发提供）"
    DATA_MAPPER_SAMPLE_COLUMN = "数据样例"

    # 敏感数据配置文件
    SENSITIVE_DATA_CONFIG = os.path.join(Config.BASE_DIR, 'config', 'sensitive_data_config.json')

# ==================== 导入配置 ====================

class ImportConfig:
    """导入配置类"""

    # 支持的文件扩展名
    ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

    # 最大文件大小（字节）
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

    # 导入批次大小
    IMPORT_BATCH_SIZE = 1000

    # 导入进度更新间隔
    IMPORT_PROGRESS_INTERVAL = 100

    @classmethod
    def allowed_file(cls, filename):
        """检查文件扩展名是否允许"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in cls.ALLOWED_EXTENSIONS

# ==================== 日志配置 ====================

class LogConfig:
    """日志配置类"""

    # 日志级别
    LOG_LEVEL = 'INFO'  # DEBUG, INFO, WARNING, ERROR

    # 日志格式
    LOG_FORMAT = '[{timestamp}] [{level}] [{category}] {message}'

    # 日志文件名格式
    LOG_FILE_FORMAT = '{category}_{date}.log'
    LOG_DATE_FORMAT = '%Y%m%d'

    # 日志时间戳格式
    TIMESTAMP_FORMAT = '%Y-%m-%d %H:%M:%S'

    # 日志保留天数
    LOG_RETENTION_DAYS = 30

# ==================== 模式配置 ====================

class ModeConfig:
    """显示模式配置类"""

    # 支持的模式
    MODES = ['全部', 'SMC', '业支', '信安']

    # 各模式的默认列配置
    DEFAULT_MODE_COLUMNS = {
        '全部': None,  # None表示显示所有列
        'SMC': None,
        '业支': None,
        '信安': None
    }

    # 列配置文件
    MODE_COLUMNS_CONFIG = os.path.join(Config.BASE_DIR, 'mode_columns_config.json')

# ==================== 文件管理配置 ====================

class FileManagementConfig:
    """文件管理配置类"""

    # 版本保留策略
    MAX_VERSIONS = 10  # 每个文件最多保留10个历史版本

    # 文件分类
    FILE_CATEGORIES = {
        'assets': '数管数据库资产信息概览表',
        'merge_results': '合并结果表',
        'yezhi_template': '业支上报模板',
        'smc_template': 'SMC上报模板',
        'xinan_template': '信安上报模板'
    }

    # 文件命名规则
    NAMING_RULES = {
        'assets': '数管数据库资产信息概览表_{date}.xlsx',
        'merge_results': '合并结果_{date}.xlsx',
        'yezhi_export': 'i_10600_{template_id}_{date}_{seq}.xlsx'
    }

# ==================== 开发/生产环境配置 ====================

class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    TESTING = False
    # 生产环境应该从环境变量读取
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'production-secret-key'


# ==================== 配置字典 ====================

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}


# ==================== 初始化函数 ====================

def init_config():
    """
    初始化配置
    确保所有必要的目录存在
    """
    PathConfig.ensure_directories()


if __name__ == '__main__':
    # 测试配置
    init_config()
    print("配置初始化成功")
    print(f"项目根目录: {Config.BASE_DIR}")
    print(f"上传目录: {PathConfig.UPLOAD_FOLDER}")
    print(f"导出目录: {PathConfig.EXPORT_FOLDER}")
