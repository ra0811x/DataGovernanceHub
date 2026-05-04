# -*- coding: utf-8 -*-
"""
数据映射器模块
负责加载和管理数据名称到数据样例的映射关系
"""

import json
import logging
import os
import random
import re

logger = logging.getLogger(__name__)


class DataMapper:
    """数据映射器"""

    # 数据分级对应的敏感等级
    LEVEL_MAPPING = {
        '一般级-第1小级': 1,
        '一般级-第2小级': 2,
        '一般级-第3小级': 3,
        '一般级-第4小级': 4,
        '核心级': 5,  # 最高敏感级别
        '一级': 1,
        '二级': 2,
        '三级': 3,
        '四级': 4,
        '五级': 5,
        '1级': 1,
        '2级': 2,
        '3级': 3,
        '4级': 4,
        '5级': 5
    }

    def __init__(self, mapper_file=None):
        """
        初始化映射器

        Args:
            mapper_file: 映射表文件路径，默认使用JSON配置文件
        """
        self.mapping_dict = {}
        self.standards_dict = {}  # 存储完整标准信息 {name: {level, sample, category}}
        self.loaded = False

        # 默认映射表路径（JSON格式）
        if mapper_file is None:
            mapper_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                'config',
                'data_sample_standards.json'
            )

        self.mapper_file = mapper_file

    def load_mapping(self):
        """
        加载映射表（从JSON文件）
        支持新旧格式：新格式使用 samples 数组，旧格式使用 sample 字符串

        Returns:
            bool: 加载是否成功
        """
        try:
            logger.info(f"正在加载映射表: {self.mapper_file}")

            # 检查文件是否存在
            if not os.path.exists(self.mapper_file):
                logger.warning(f"映射表文件不存在: {self.mapper_file}")
                self.loaded = False
                return False

            # 读取JSON文件
            with open(self.mapper_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 构建映射字典
            self.mapping_dict = {}
            self.standards_dict = {}
            standards = data.get('standards', [])

            for standard in standards:
                # 只加载启用的标准
                if standard.get('enabled', True):
                    name = standard.get('name', '').strip()
                    level = standard.get('level', '').strip()
                    category = standard.get('category', '').strip()

                    # 兼容新旧格式获取样例
                    samples = standard.get('samples', [])
                    if not samples:
                        # 旧格式兼容
                        sample = standard.get('sample', '').strip()
                        if sample:
                            samples = [sample]
                        else:
                            samples = []

                    # 跳过空值
                    if not name or not samples or name == 'nan':
                        continue

                    # 过滤掉空样例
                    samples = [s.strip() for s in samples if s.strip() and s.strip() != 'nan']
                    if not samples:
                        continue

                    # 如果有重复的数据名称，保留第一个
                    if name not in self.mapping_dict:
                        self.mapping_dict[name] = samples  # 存储数组
                        self.standards_dict[name] = {
                            'samples': samples,  # 完整数组
                            'level': level,
                            'category': category
                        }

            self.loaded = True
            total_samples = sum(len(v) if isinstance(v, list) else 1 for v in self.mapping_dict.values())
            logger.info(f"映射表加载完成，共 {len(self.mapping_dict)} 个字段，{total_samples} 个样例")
            return True

        except Exception as e:
            logger.error(f"加载映射表失败: {str(e)}")
            self.loaded = False
            return False

    def get_sample(self, data_name):
        """
        根据数据名称获取数据样例
        如果有多个样例，随机返回一个

        Args:
            data_name: 数据名称

        Returns:
            str: 数据样例，如果找不到则返回None
        """
        if not self.loaded:
            logger.warning("映射表未加载，请先调用 load_mapping()")
            return None

        # 清理输入
        if data_name is None:
            return None

        data_name = str(data_name).strip()

        # 查找映射
        samples = self.mapping_dict.get(data_name)
        if samples:
            # 如果是数组，随机选择一个
            if isinstance(samples, list):
                return random.choice(samples) if samples else None
            # 兼容旧格式（字符串）
            return samples
        return None

    def get_standard_info(self, data_name):
        """
        根据数据名称获取完整标准信息（包括分级）

        Args:
            data_name: 数据名称

        Returns:
            dict: 标准信息 {samples, level, category}，如果找不到则返回None
        """
        if not self.loaded:
            logger.warning("映射表未加载，请先调用 load_mapping()")
            return None

        # 清理输入
        if data_name is None:
            return None

        data_name = str(data_name).strip()

        # 查找映射
        return self.standards_dict.get(data_name)

    def get_samples(self, data_name):
        """
        根据数据名称获取所有样例

        Args:
            data_name: 数据名称

        Returns:
            list: 样例数组，如果找不到则返回空列表
        """
        info = self.get_standard_info(data_name)
        if info:
            samples = info.get('samples', [])
            return samples if isinstance(samples, list) else []
        return []

    def get_data_level(self, data_name):
        """
        根据数据名称获取数据分级

        Args:
            data_name: 数据名称

        Returns:
            int: 数据分级（1-4），找不到则返回1
        """
        info = self.get_standard_info(data_name)
        if info:
            level_text = info.get('level', '')
            return self.LEVEL_MAPPING.get(level_text, 1)
        return 1

    def process_sample_with_masking(self, data_name):
        """
        获取数据样例并应用脱敏/加密规则
        如果有多个样例，随机选择一个后再处理

        Args:
            data_name: 数据名称

        Returns:
            str: 处理后的数据样例
        """
        info = self.get_standard_info(data_name)
        if not info:
            return None

        # 获取样例数组，随机选择一个
        samples = info.get('samples', [])
        if isinstance(samples, list) and samples:
            sample = random.choice(samples)
        elif isinstance(samples, str):
            sample = samples
        else:
            # 兼容旧格式
            sample = info.get('sample', '')

        if not sample:
            return None

        level_text = info.get('level', '')
        level = self.LEVEL_MAPPING.get(level_text, 1)

        # 根据数据分级处理
        if level <= 2:
            # 1-2级：不处理
            return sample
        elif level == 3:
            # 3级：脱敏
            return self._mask_data(sample)
        elif level == 4:
            # 4级：使用AES加密
            try:
                from core.sensitive_data_handler import get_sensitive_handler
                handler = get_sensitive_handler()
                encrypted = handler.encrypt_data(sample)
                return encrypted
            except Exception as e:
                logger.error(f"4级数据加密失败: {str(e)}")
                return '[加密失败]'
        elif level >= 5:
            # 5级（核心级）：加密+标记
            try:
                from core.sensitive_data_handler import get_sensitive_handler
                handler = get_sensitive_handler()
                encrypted = handler.encrypt_data(sample)
                return f'[核心级]{encrypted}'
            except Exception as e:
                logger.error(f"5级数据加密失败: {str(e)}")
                return '[加密失败]'

    def _mask_data(self, value):
        """
        对数据进行脱敏处理（3级数据）

        Args:
            value: 原始值

        Returns:
            str: 脱敏后的值
        """
        if not value:
            return value

        value_str = str(value)

        # 判断数据类型并应用相应脱敏规则
        # 手机号脱敏
        if re.match(r'^1[3-9]\d{9}$', value_str):
            return value_str[:3] + '****' + value_str[7:]

        # 邮箱脱敏
        if '@' in value_str:
            parts = value_str.split('@')
            username = parts[0]
            if len(username) > 1:
                masked_username = username[0] + '*' * (len(username) - 1)
            else:
                masked_username = '*'
            return masked_username + '@' + parts[1]

        # 身份证脱敏
        if len(value_str) == 18 and value_str.isdigit():
            return value_str[:6] + '********' + value_str[14:]

        # 银行卡号脱敏
        if len(value_str) >= 16 and value_str.isdigit():
            return value_str[:4] + '****' + value_str[-4:]

        # 默认：保留首尾，中间用*替换
        if len(value_str) <= 2:
            return '*' * len(value_str)
        return value_str[0] + '*' * (len(value_str) - 2) + value_str[-1]

    def get_mapping_count(self):
        """
        获取映射关系数量

        Returns:
            int: 映射关系数量
        """
        return len(self.mapping_dict)

    def is_loaded(self):
        """
        检查映射表是否已加载

        Returns:
            bool: 是否已加载
        """
        return self.loaded

    def reload(self):
        """
        重新加载映射表

        Returns:
            bool: 加载是否成功
        """
        self.mapping_dict.clear()
        self.standards_dict.clear()
        self.loaded = False
        return self.load_mapping()


# 全局单例
_mapper_instance = None


def get_mapper():
    """获取全局映射器实例"""
    global _mapper_instance
    if _mapper_instance is None:
        _mapper_instance = DataMapper()
        _mapper_instance.load_mapping()
    return _mapper_instance
