#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
工具函数模块
"""
import sqlite3
import json
import os
from datetime import datetime
from functools import wraps

# ==================== 数据库工具 ====================

def get_db_connection(db_path='assets.db'):
    """
    获取数据库连接

    Args:
        db_path: 数据库文件路径

    Returns:
        sqlite3.Connection: 数据库连接对象
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_database_and_table(db_path, table_name, create_sql=None):
    """
    确保数据库文件和表存在，如果不存在则创建

    Args:
        db_path: 数据库文件路径
        table_name: 表名
        create_sql: 建表SQL语句（可选）
    """
    # 如果数据库文件不存在，创建它
    if not os.path.exists(db_path):
        # 确保目录存在
        dir_path = os.path.dirname(db_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path)

        # 创建数据库连接（会自动创建文件）
        conn = sqlite3.connect(db_path)
        conn.close()

    # 检查表是否存在
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
    table_exists = cursor.fetchone()

    if not table_exists and create_sql:
        # 表不存在，提供建表SQL则创建
        cursor.execute(create_sql)
        conn.commit()

    conn.close()

# ==================== Excel处理工具 ====================

def generate_export_filename(base_name, template="{name}_{date}.xlsx"):
    """
    生成导出文件名

    Args:
        base_name: 基础名称（不含扩展名）
        template: 文件名模板，支持{name}和{date}占位符

    Returns:
        str: 生成的文件名
    """
    date_str = datetime.now().strftime("%Y%m%d")
    return template.format(name=base_name, date=date_str)

# ==================== 响应工具 ====================

def success_response(data=None, message="操作成功"):
    """
    生成成功响应

    Args:
        data: 返回的数据
        message: 成功消息

    Returns:
        dict: Flask响应字典
    """
    response = {
        'success': True,
        'message': message
    }
    if data is not None:
        response['data'] = data
    return response

def error_response(error_message, status_code=500):
    """
    生成错误响应

    Args:
        error_message: 错误消息
        status_code: HTTP状态码

    Returns:
        tuple: (Flask响应字典, status_code)
    """
    response = {
        'success': False,
        'error': error_message
    }
    return response, status_code

# ==================== 数据验证工具 ====================

def validate_required_fields(data, required_fields):
    """
    验证必填字段

    Args:
        data: 数据字典
        required_fields: 必填字段列表

    Returns:
        tuple: (is_valid, missing_fields)
    """
    missing = []
    for field in required_fields:
        if field not in data or not data[field]:
            missing.append(field)

    return len(missing) == 0, missing

# ==================== 分页工具 ====================

def calculate_pagination(page, page_size, total):
    """
    计算分页参数

    Args:
        page: 当前页码
        page_size: 每页条数
        total: 总记录数

    Returns:
        dict: 分页信息字典
    """
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size

    return {
        'page': page,
        'page_size': page_size,
        'total': total,
        'total_pages': total_pages,
        'offset': offset,
        'has_next': page < total_pages,
        'has_prev': page > 1
    }

# ==================== 文件工具 ====================

def ensure_directory(directory):
    """
    确保目录存在，不存在则创建

    Args:
        directory: 目录路径
    """
    if not os.path.exists(directory):
        os.makedirs(directory)

def get_file_size(file_path):
    """
    获取文件大小

    Args:
        file_path: 文件路径

    Returns:
        int: 文件大小（字节）
    """
    if os.path.exists(file_path):
        return os.path.getsize(file_path)
    return 0

def format_file_size(size_bytes):
    """
    格式化文件大小显示

    Args:
        size_bytes: 字节数

    Returns:
        str: 格式化后的大小（如: 1.5MB）
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f}TB"

# ==================== 日志工具 ====================

class Logger:
    """简单的日志记录器"""

    def __init__(self, log_dir='logs'):
        """
        初始化日志记录器

        Args:
            log_dir: 日志目录
        """
        ensure_directory(log_dir)
        self.log_dir = log_dir

    def log(self, level, message, category='GENERAL'):
        """
        记录日志

        Args:
            level: 日志级别（INFO, WARNING, ERROR）
            message: 日志消息
            category: 日志类别
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] [{category}] {message}\n"

        log_file = os.path.join(self.log_dir, f"{category}_{datetime.now().strftime('%Y%m%d')}.log")

        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)

    def info(self, message, category='GENERAL'):
        """记录INFO级别日志"""
        self.log('INFO', message, category)

    def warning(self, message, category='GENERAL'):
        """记录WARNING级别日志"""
        self.log('WARNING', message, category)

    def error(self, message, category='GENERAL'):
        """记录ERROR级别日志"""
        self.log('ERROR', message, category)

# ==================== 导出进度管理 ====================

class ExportProgressManager:
    """导出进度管理器"""

    def __init__(self):
        """初始化进度管理器"""
        self.progress = {
            'status': 'idle',
            'current': 0,
            'total': 0,
            'message': '',
            'filename': ''
        }

    def start(self, total, message='开始处理...'):
        """开始任务"""
        self.progress = {
            'status': 'running',
            'current': 0,
            'total': total,
            'message': message,
            'filename': ''
        }

    def update(self, current, total, message=''):
        """更新进度"""
        self.progress['current'] = current
        self.progress['total'] = total
        if message:
            self.progress['message'] = message

    def complete(self, filename, total_records):
        """完成任务"""
        self.progress = {
            'status': 'completed',
            'current': total_records,
            'total': total_records,
            'message': '导出成功',
            'filename': filename
        }

    def error(self, error_message):
        """标记错误"""
        self.progress = {
            'status': 'error',
            'current': self.progress.get('current', 0),
            'total': self.progress.get('total', 0),
            'message': f'导出失败: {error_message}',
            'filename': ''
        }

    def get_progress(self):
        """获取当前进度"""
        return self.progress

# ==================== 列配置管理 ====================

def load_columns_config(file_path):
    """
    加载列配置文件

    Args:
        file_path: 配置文件路径

    Returns:
        dict: 配置字典
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'加载配置文件失败: {e}')
        return {}

def save_columns_config(file_path, config):
    """
    保存列配置文件

    Args:
        file_path: 配置文件路径
        config: 配置字典
    """
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f'保存配置文件失败: {e}')
        return False

# ==================== 模板工具 ====================

def get_template_columns_count(template_path):
    """
    获取模板文件的列数

    Args:
        template_path: 模板文件路径

    Returns:
        int: 列数
    """
    try:
        import openpyxl
        wb = openpyxl.load_workbook(template_path)
        ws = wb.active
        col_count = ws.max_column
        wb.close()
        return col_count
    except Exception as e:
        print(f'读取模板失败: {e}')
        return 0


# ==================== 数据历史管理工具 ====================
# 已删除 - 不再需要数据历史管理功能

# ==================== 敏感数据脱敏 ====================

def load_sensitive_data_config():
    """
    加载敏感数据配置
    
    Returns:
        dict: 配置字典
    """
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'sensitive_data_config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'[ERROR] 加载敏感数据配置失败: {e}')
        return {}

def mask_sensitive_data(value, data_type=None, column_name=None):
    """
    对敏感数据进行脱敏处理
    
    Args:
        value: 原始值
        data_type: 数据类型（person_name, id_card等）
        column_name: 列名（用于自动识别类型）
    
    Returns:
        str: 脱敏后的值
    """
    if not value or value == '-' or value == '':
        return value
    
    # 如果是空值或占位符，直接返回
    if str(value).strip() in ['******', 'N/A', 'NULL', 'None', '-']:
        return value
    
    config = load_sensitive_data_config()
    sensitive_types = config.get('sensitive_types', {})
    
    # 确定数据类型
    if not data_type and column_name:
        # 根据列名自动识别
        data_type = identify_sensitive_type(column_name, sensitive_types)
    
    if not data_type:
        # 无法识别类型，返回原值
        return value
    
    type_config = sensitive_types.get(data_type, {})
    data_level = type_config.get('data_level', 1)
    
    # 一级、二级数据不处理
    if data_level <= 2:
        return value
    
    # 三级数据：脱敏
    if data_level == 3:
        mask_rule = type_config.get('mask_rule', '')
        return apply_mask_rule(str(value), mask_rule)
    
    # 四级数据：加密（暂时用高强度脱敏替代）
    if data_level == 4:
        mask_rule = type_config.get('mask_rule', '')
        return apply_mask_rule(str(value), mask_rule)
    
    return value

def identify_sensitive_type(column_name, sensitive_types):
    """
    根据列名识别敏感数据类型
    
    Args:
        column_name: 列名
        sensitive_types: 敏感数据类型配置
    
    Returns:
        str: 数据类型，如 'person_name', 'id_card'
    """
    if not column_name:
        return None
    
    column_name = column_name.strip()
    
    # 遍历所有映射
    for table_type in ['assets', 'merge_results']:
        mapping = sensitive_types.get('column_mapping', {}).get(table_type, {})
        if column_name in mapping:
            return mapping[column_name]
    
    # 尝试模糊匹配
    for table_type in ['assets', 'merge_results']:
        mapping = sensitive_types.get('column_mapping', {}).get(table_type, {})
        for key, value in mapping.items():
            if key in column_name or column_name in key:
                return value
    
    return None

def apply_mask_rule(value, rule):
    """
    应用脱敏规则
    
    Args:
        value: 原始值
        rule: 规则名称
    
    Returns:
        str: 脱敏后的值
    """
    if not value:
        return value
    
    if rule == 'keep_first_1':
        # 保留首字
        if len(value) > 1:
            return value[0] + '*' * (len(value) - 1)
        return value
    
    elif rule == 'keep_6_4':
        # 保留前6位和后4位
        if len(value) >= 10:
            return value[:6] + '*' * (len(value) - 10) + value[-4:]
        return value
    
    elif rule == 'keep_first_3_last_3':
        # 保留前3位和后3位
        if len(value) >= 6:
            return value[:3] + '*' * (len(value) - 6) + value[-3:]
        return value
    
    elif rule == 'keep_3_4':
        # 保留前3位和后4位（手机号）
        if len(value) >= 7:
            return value[:3] + '*' * (len(value) - 7) + value[-4:]
        return value
    
    elif rule == 'keep_area_last_4':
        # 座机号：保留区号和后4位
        if '-' in value:
            parts = value.split('-')
            if len(parts) == 2 and len(parts[1]) >= 4:
                return parts[0] + '-****' + parts[1][-4:]
        return value
    
    elif rule == 'email':
        # 邮箱脱敏
        if '@' in value:
            parts = value.split('@')
            if len(parts) == 2 and len(parts[0]) > 0:
                username = parts[0]
                masked_username = username[0] + '***' if len(username) > 1 else username
                return masked_username + '@' + parts[1]
        return value
    
    elif rule == 'keep_4_4':
        # 保留前4位和后4位
        if len(value) >= 8:
            return value[:4] + '*' * (len(value) - 8) + value[-4:]
        return value
    
    # 默认：全部脱敏
    return '*' * len(value)

def get_sensitive_columns(table_type='assets'):
    """
    获取包含敏感信息的列名列表
    
    Args:
        table_type: 'assets' 或 'merge_results'
    
    Returns:
        list: 敏感列名列表
    """
    config = load_sensitive_data_config()
    mapping = config.get('column_mapping', {}).get(table_type, {})
    return list(mapping.keys())

def should_mask_column(column_name, table_type='assets'):
    """
    判断列是否需要脱敏
    
    Args:
        column_name: 列名
        table_type: 表类型
    
    Returns:
        bool: 是否需要脱敏
    """
    sensitive_columns = get_sensitive_columns(table_type)
    return column_name in sensitive_columns

def encrypt_sensitive_data(value):
    """
    加密敏感数据（用于四级数据）
    
    Args:
        value: 原始值
    
    Returns:
        str: 加密后的值（Base64编码）
    """
    if not value:
        return value
    
    try:
        from cryptography.fernet import Fernet
        import base64
        
        # 生成密钥（在实际应用中应该从配置文件读取）
        key = b'KLQZwPm8YhN3vT2xCr7uL0dE5fG9hIjO'  # 32字节密钥的Base64
        f = Fernet(key)
        
        # 加密
        encrypted = f.encrypt(str(value).encode())
        
        # 返回Base64编码的加密数据
        return base64.b64encode(encrypted).decode('utf-8')
    except ImportError:
        # 如果没有安装cryptography库，使用简单的Base64编码
        import base64
        return 'ENC:' + base64.b64encode(str(value).encode('utf-8')).decode('utf-8')

def decrypt_sensitive_data(encrypted_value):
    """
    解密敏感数据
    
    Args:
        encrypted_value: 加密的值
    
    Returns:
        str: 解密后的原始值
    """
    if not encrypted_value:
        return encrypted_value
    
    try:
        from cryptography.fernet import Fernet
        import base64
        
        key = b'KLQZwPm8YhN3vT2xCr7uL0dE5fG9hIjO'
        f = Fernet(key)
        
        # 解密
        decrypted = f.decrypt(base64.b64decode(encrypted_value))
        return decrypted.decode('utf-8')
    except:
        # 如果解密失败，返回原值
        return encrypted_value

def mask_or_encrypt_data(value, data_type, column_name=None, action='auto'):
    """
    根据数据级别自动选择脱敏或加密
    
    Args:
        value: 原始值
        data_type: 数据类型
        column_name: 列名
        action: 操作类型 ('auto', 'mask', 'encrypt', 'none')
    
    Returns:
        str: 处理后的值
    """
    if not value or str(value).strip() in ['******', 'N/A', 'NULL', 'None', '-']:
        return value
    
    config = load_sensitive_data_config()
    sensitive_types = config.get('sensitive_types', {})
    
    # 确定数据类型
    if not data_type and column_name:
        data_type = identify_sensitive_type(column_name, sensitive_types)
    
    if not data_type:
        return value
    
    type_config = sensitive_types.get(data_type, {})
    data_level = type_config.get('data_level', 1)
    
    # 根据action参数或数据级别决定操作
    if action == 'none':
        return value
    
    if action == 'encrypt' or (action == 'auto' and data_level == 4):
        # 四级数据：加密
        return encrypt_sensitive_data(value)
    
    if action == 'mask' or (action == 'auto' and data_level == 3):
        # 三级数据：脱敏
        return mask_sensitive_data(value, data_type)
    
    # 一级、二级：不处理
    return value
