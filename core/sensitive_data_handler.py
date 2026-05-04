# -*- coding: utf-8 -*-
"""
敏感数据处理器模块
包含敏感数据脱敏和加密功能
"""

import json
import os
import base64
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class SensitiveDataHandler:
    """敏感数据处理器"""

    def __init__(self, config_path=None):
        """
        初始化敏感数据处理器

        Args:
            config_path: 配置文件路径
        """
        if config_path is None:
            # 默认配置文件路径
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                'config',
                'sensitive_data_config.json'
            )

        self.config_path = config_path
        self.config = self._load_config()
        self.encryption_key = self._get_encryption_key()

    def _load_config(self):
        """加载敏感数据配置"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"加载敏感数据配置失败: {str(e)}，使用默认配置")
            return {
                "data_levels": {},
                "sensitive_types": {},
                "column_mapping": {},
                "mask_rules": {},
                "settings": {"default_masked": True, "mask_character": "*"}
            }

    def _get_encryption_key(self):
        """获取加密密钥"""
        key = b'KLQZwPm8YhN3vT2xCr7uL0dE5fG9hIjO'
        return base64.urlsafe_b64encode(key)

    def get_sensitive_type_by_column(self, column_name):
        """
        根据列名获取敏感数据类型

        Args:
            column_name: 列名

        Returns:
            str: 敏感数据类型，如果不是敏感数据则返回None
        """
        column_mapping = self.config.get("column_mapping", {}).get("assets", {})

        for col_key, sensitive_type in column_mapping.items():
            if col_key in str(column_name):
                return sensitive_type

        return None

    def get_data_level(self, sensitive_type):
        """
        获取敏感数据的数据等级

        Args:
            sensitive_type: 敏感数据类型

        Returns:
            int: 数据等级（1-4），默认返回1
        """
        sensitive_types = self.config.get("sensitive_types", {})
        type_info = sensitive_types.get(sensitive_type, {})
        return type_info.get("data_level", 1)

    def get_mask_rule(self, sensitive_type):
        """
        获取敏感数据的脱敏规则

        Args:
            sensitive_type: 敏感数据类型

        Returns:
            dict: 脱敏规则，如果不存在则返回None
        """
        sensitive_types = self.config.get("sensitive_types", {})
        type_info = sensitive_types.get(sensitive_type, {})
        mask_rule = type_info.get("mask_rule", None)

        if mask_rule:
            mask_rules = self.config.get("mask_rules", {})
            return mask_rules.get(mask_rule)

        return None

    def process_data(self, value, sensitive_type=None, column_name=None):
        """
        处理数据：根据数据等级进行不处理、脱敏或加密

        Args:
            value: 原始数据值
            sensitive_type: 敏感数据类型（如果已知）
            column_name: 列名（用于自动识别敏感数据类型）

        Returns:
            str: 处理后的数据
        """
        if value is None or value == '' or str(value).strip() == '':
            return value

        # 如果没有提供敏感数据类型，尝试从列名推断
        if sensitive_type is None:
            sensitive_type = self.get_sensitive_type_by_column(column_name)

        # 如果不是敏感数据，直接返回
        if sensitive_type is None:
            return value

        # 获取数据等级
        data_level = self.get_data_level(sensitive_type)

        # 根据数据等级进行处理
        if data_level <= 2:
            # 一级、二级：不处理
            return value
        elif data_level == 3:
            # 三级：脱敏
            return self.mask_data(value, sensitive_type)
        elif data_level >= 4:
            # 四级：加密
            return self.encrypt_data(value)

    def mask_data(self, value, sensitive_type):
        """
        对敏感数据进行脱敏处理

        Args:
            value: 原始数据值
            sensitive_type: 敏感数据类型

        Returns:
            str: 脱敏后的数据
        """
        if value is None or value == '':
            return value

        value_str = str(value)
        mask_rule = self.get_mask_rule(sensitive_type)
        mask_char = self.config.get("settings", {}).get("mask_character", "*")

        if not mask_rule:
            # 如果没有脱敏规则，全部用*替换
            return mask_char * len(value_str)

        rule_function = mask_rule.get("function")
        params = mask_rule.get("params", {})

        if rule_function == "mask_keep_first_n":
            return self._mask_keep_first_n(value_str, params.get("keep_first", 0), params.get("keep_last", 0), mask_char)
        elif rule_function == "mask_phone_landline":
            return self._mask_phone_landline(value_str, mask_char)
        elif rule_function == "mask_email":
            return self._mask_email(value_str, mask_char)
        else:
            return mask_char * len(value_str)

    def _mask_keep_first_n(self, value, keep_first, keep_last, mask_char="*"):
        """
        保留前N位和后M位，其余用*替换

        Args:
            value: 原始值
            keep_first: 保留前几位
            keep_last: 保留后几位
            mask_char: 掩码字符

        Returns:
            str: 脱敏后的值
        """
        value_str = str(value)
        length = len(value_str)

        if length <= keep_first + keep_last:
            return value_str

        if keep_first > 0 and keep_last > 0:
            return value_str[:keep_first] + mask_char * (length - keep_first - keep_last) + value_str[-keep_last:]
        elif keep_first > 0:
            return value_str[:keep_first] + mask_char * (length - keep_first)
        elif keep_last > 0:
            return mask_char * (length - keep_last) + value_str[-keep_last:]
        else:
            return mask_char * length

    def _mask_phone_landline(self, value, mask_char="*"):
        """
        座机号脱敏：保留区号和后4位

        Args:
            value: 座机号
            mask_char: 掩码字符

        Returns:
            str: 脱敏后的座机号
        """
        value_str = str(value)

        # 尝试匹配各种座机号格式
        if '-' in value_str:
            parts = value_str.split('-')
            if len(parts) == 2:
                area_code = parts[0]
                number = parts[1]
                if len(number) > 4:
                    return f"{area_code}-{mask_char * (len(number) - 4)}{number[-4:]}"

        # 如果没有分隔符，保留前3-4位（区号）和后4位
        length = len(value_str)
        if length > 7:
            return value_str[:3] + mask_char * (length - 7) + value_str[-4:]

        return mask_char * length

    def _mask_email(self, value, mask_char="*"):
        """
        邮箱脱敏：保留第一个字符和域名

        Args:
            value: 邮箱地址
            mask_char: 掩码字符

        Returns:
            str: 脱敏后的邮箱
        """
        value_str = str(value)

        if '@' not in value_str:
            return mask_char * len(value_str)

        parts = value_str.split('@')
        username = parts[0]
        domain = parts[1]

        if len(username) > 1:
            masked_username = username[0] + mask_char * (len(username) - 1)
        else:
            masked_username = mask_char

        return f"{masked_username}@{domain}"

    def encrypt_data(self, value):
        """
        加密敏感数据（用于四级数据）

        Args:
            value: 原始数据值

        Returns:
            str: 加密后的数据（Base64编码）
        """
        if value is None or value == '':
            return value

        try:
            f = Fernet(self.encryption_key)
            encrypted = f.encrypt(str(value).encode())
            return base64.b64encode(encrypted).decode('utf-8')
        except Exception as e:
            logger.error(f"加密失败: {str(e)}")
            return "ENCRYPT_ERROR"

    def decrypt_data(self, encrypted_value):
        """
        解密敏感数据

        Args:
            encrypted_value: 加密的数据值

        Returns:
            str: 解密后的原始数据
        """
        if encrypted_value is None or encrypted_value == '':
            return encrypted_value

        try:
            f = Fernet(self.encryption_key)
            decrypted = f.decrypt(base64.b64decode(encrypted_value))
            return decrypted.decode('utf-8')
        except Exception as e:
            logger.error(f"解密失败: {str(e)}")
            return "DECRYPT_ERROR"


# 全局实例
_sensitive_handler = None


def get_sensitive_handler():
    """获取敏感数据处理器实例"""
    global _sensitive_handler
    if _sensitive_handler is None:
        _sensitive_handler = SensitiveDataHandler()
    return _sensitive_handler


def mask_sensitive_data(value, sensitive_type=None, column_name=None):
    """
    对敏感数据进行脱敏处理（便捷函数）

    Args:
        value: 原始数据值
        sensitive_type: 敏感数据类型
        column_name: 列名

    Returns:
        str: 处理后的数据
    """
    handler = get_sensitive_handler()
    return handler.process_data(value, sensitive_type, column_name)
