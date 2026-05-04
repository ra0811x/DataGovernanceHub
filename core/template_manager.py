#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
模板文件管理器
规范化管理所有上报模板文件
"""
import os
import json
from typing import Dict, List, Optional


class TemplateManager:
    """模板文件管理器"""

    def __init__(self, base_dir=None):
        """
        初始化模板管理器

        Args:
            base_dir: 项目根目录，默认为当前目录
        """
        if base_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        self.base_dir = base_dir
        self.templates_dir = os.path.join(base_dir, 'Templates')

        # 确保目录存在
        self._ensure_directories()

        # 元数据文件路径
        self.metadata_files = {
            '业支上报': os.path.join(self.templates_dir, '业支上报', 'metadata.json'),
            'SMC上报': os.path.join(self.templates_dir, 'SMC上报', 'metadata.json'),
            '信安上报': os.path.join(self.templates_dir, '信安上报', 'metadata.json'),
            '共用': os.path.join(self.templates_dir, '共用', 'metadata.json')
        }

        # 初始化元数据文件
        self._initialize_metadata()

    def _ensure_directories(self):
        """确保所有必要的目录存在"""
        categories = ['业支上报', 'SMC上报', '信安上报', '共用']
        for category in categories:
            directory = os.path.join(self.templates_dir, category)
            if not os.path.exists(directory):
                os.makedirs(directory)

    def _initialize_metadata(self):
        """初始化元数据文件"""
        default_metadata = {
            '业支上报': {
                'category': '业支上报',
                'category_code': 'YEZHI',
                'templates': []
            },
            'SMC上报': {
                'category': 'SMC上报',
                'category_code': 'SMC',
                'templates': []
            },
            '信安上报': {
                'category': '信安上报',
                'category_code': 'XINAN',
                'templates': []
            },
            '共用': {
                'category': '共用',
                'category_code': 'SHARED',
                'templates': []
            }
        }

        for category, metadata in default_metadata.items():
            metadata_path = self.metadata_files[category]
            if not os.path.exists(metadata_path):
                self._save_metadata(category, metadata)

    def _load_metadata(self, category: str) -> dict:
        """
        加载元数据

        Args:
            category: 模板分类

        Returns:
            dict: 元数据字典
        """
        metadata_path = self.metadata_files.get(category)
        if not metadata_path or not os.path.exists(metadata_path):
            return {'category': category, 'templates': []}

        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'加载元数据失败: {e}')
            return {'category': category, 'templates': []}

    def _save_metadata(self, category: str, metadata: dict):
        """
        保存元数据

        Args:
            category: 模板分类
            metadata: 元数据字典
        """
        metadata_path = self.metadata_files.get(category)
        if not metadata_path:
            return False

        try:
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f'保存元数据失败: {e}')
            return False

    def get_template_path(self, category: str, template_id: str) -> Optional[str]:
        """
        获取模板文件路径

        Args:
            category: 模板分类（业支上报/SMC上报/信安上报/共用）
            template_id: 模板ID

        Returns:
            str: 模板文件路径，不存在则返回None
        """
        metadata = self._load_metadata(category)
        for template in metadata.get('templates', []):
            if template['template_id'] == template_id:
                filename = template['filename']
                file_path = os.path.join(self.templates_dir, category, filename)
                if os.path.exists(file_path):
                    return file_path
        return None

    def list_templates(self, category: str = None, implemented_only: bool = False) -> List[Dict]:
        """
        列出模板

        Args:
            category: 模板分类，None表示列出所有
            implemented_only: 是否只列出已实现的模板

        Returns:
            list: 模板列表
        """
        if category:
            metadata = self._load_metadata(category)
            templates = metadata.get('templates', [])
            if implemented_only:
                templates = [t for t in templates if t.get('implemented', False)]
            # 添加分类信息
            for template in templates:
                template['category'] = category
            return templates

        # 列出所有模板
        all_templates = []
        for cat in ['业支上报', 'SMC上报', '信安上报', '共用']:
            metadata = self._load_metadata(cat)
            for template in metadata.get('templates', []):
                if implemented_only and not template.get('implemented', False):
                    continue
                template['category'] = cat
                all_templates.append(template)
        return all_templates

    def get_template_info(self, category: str, template_id: str) -> Optional[Dict]:
        """
        获取模板信息

        Args:
            category: 模板分类
            template_id: 模板ID

        Returns:
            dict: 模板信息，不存在则返回None
        """
        metadata = self._load_metadata(category)
        for template in metadata.get('templates', []):
            if template['template_id'] == template_id:
                return template
        return None

    def add_template(self, category: str, template_info: dict) -> Dict:
        """
        添加模板

        Args:
            category: 模板分类
            template_info: 模板信息字典

        Returns:
            dict: 操作结果
        """
        # 验证必填字段
        required_fields = ['template_id', 'template_name', 'filename']
        for field in required_fields:
            if field not in template_info:
                return {'success': False, 'message': f'缺少必填字段: {field}'}

        # 检查模板是否已存在
        metadata = self._load_metadata(category)
        for template in metadata['templates']:
            if template['template_id'] == template_info['template_id']:
                return {'success': False, 'message': f'模板ID已存在: {template_info["template_id"]}'}

        # 添加默认字段
        if 'version' not in template_info:
            template_info['version'] = 'v1.0'
        if 'implemented' not in template_info:
            template_info['implemented'] = False

        # 添加到元数据
        metadata['templates'].append(template_info)
        self._save_metadata(category, metadata)

        return {
            'success': True,
            'message': f'模板已添加: {template_info["template_id"]}',
            'template_id': template_info['template_id']
        }

    def update_template(self, category: str, template_id: str, updates: dict) -> Dict:
        """
        更新模板信息

        Args:
            category: 模板分类
            template_id: 模板ID
            updates: 要更新的字段

        Returns:
            dict: 操作结果
        """
        metadata = self._load_metadata(category)

        # 查找模板
        template_index = None
        for i, template in enumerate(metadata['templates']):
            if template['template_id'] == template_id:
                template_index = i
                break

        if template_index is None:
            return {'success': False, 'message': f'模板不存在: {template_id}'}

        # 更新字段
        for key, value in updates.items():
            if key != 'template_id':  # 不允许修改template_id
                metadata['templates'][template_index][key] = value

        # 更新时间戳
        metadata['templates'][template_index]['last_updated'] = \
            __import__('datetime').datetime.now().strftime('%Y-%m-%d')

        self._save_metadata(category, metadata)

        return {
            'success': True,
            'message': f'模板已更新: {template_id}',
            'template_id': template_id
        }

    def delete_template(self, category: str, template_id: str) -> Dict:
        """
        删除模板

        Args:
            category: 模板分类
            template_id: 模板ID

        Returns:
            dict: 操作结果
        """
        metadata = self._load_metadata(category)

        # 查找并删除模板
        original_count = len(metadata['templates'])
        metadata['templates'] = [t for t in metadata['templates']
                                if t['template_id'] != template_id]

        if len(metadata['templates']) == original_count:
            return {'success': False, 'message': f'模板不存在: {template_id}'}

        self._save_metadata(category, metadata)

        return {
            'success': True,
            'message': f'模板已删除: {template_id}',
            'template_id': template_id
        }

    def get_statistics(self) -> Dict:
        """
        获取模板统计信息

        Returns:
            dict: 统计信息
        """
        stats = {
            'total': 0,
            'implemented': 0,
            'not_implemented': 0,
            'by_category': {}
        }

        for category in ['业支上报', 'SMC上报', '信安上报', '共用']:
            templates = self.list_templates(category)
            implemented = sum(1 for t in templates if t.get('implemented', False))

            stats['by_category'][category] = {
                'total': len(templates),
                'implemented': implemented,
                'not_implemented': len(templates) - implemented
            }

            stats['total'] += len(templates)
            stats['implemented'] += implemented
            stats['not_implemented'] += len(templates) - implemented

        return stats


if __name__ == '__main__':
    # 测试代码
    tm = TemplateManager()

    print('模板管理器测试')
    print(f'模板目录: {tm.templates_dir}')

    # 获取统计信息
    stats = tm.get_statistics()
    print(f'\n模板统计:')
    print(f"  总数: {stats['total']}")
    print(f"  已实现: {stats['implemented']}")
    print(f"  未实现: {stats['not_implemented']}")

    print(f'\n按分类统计:')
    for category, cat_stats in stats['by_category'].items():
        print(f"  {category}: 总计{cat_stats['total']}, "
              f"已实现{cat_stats['implemented']}, "
              f"未实现{cat_stats['not_implemented']}")
