# -*- coding: utf-8 -*-
"""
通用导出引擎模块
提供配置驱动的导出功能，支持所有报表类型。
"""
import json
import re
import os
import math
from datetime import datetime
from openpyxl import load_workbook
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing

from core.utils import get_db_connection
from core.data_mapper import get_mapper
from config.config import PathConfig, DatabaseConfig

PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY = 'business_system_name_mapping'
PUBLIC_CONFIG_ASSET_NAME_MAPPING_KEY = 'asset_name_mapping'
BUSINESS_SYSTEM_NAME_MAPPING_FILE_NAME = 'business_system_name_mapping.json'
ASSET_NAME_MAPPING_FILE_NAME = 'asset_name_mapping.json'
PUBLIC_MAPPING_FILE_NAMES = {
    PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY: BUSINESS_SYSTEM_NAME_MAPPING_FILE_NAME,
    PUBLIC_CONFIG_ASSET_NAME_MAPPING_KEY: ASSET_NAME_MAPPING_FILE_NAME,
}


class ExportEngine:
    """通用导出引擎"""

    MERGE_RESULTS_INDEX_MODE_DATABASE = 'database'

    def __init__(self):
        """初始化导出引擎。"""
        self.mapping_config = None
        self.export_scope_config = self._get_default_export_scope_config()
        self.merge_export_sampling_config = self._get_default_merge_export_sampling_config()
        self.merge_fine_scope_policy = self._get_default_merge_fine_scope_policy()
        self.public_mappings = {}
        self.business_system_name_mapping = {}
        self.assets_rows = []
        self.assets_column_names = []
        self.assets_column_to_index = {}
        self.business_system_to_row = {}  # 按业务系统名称（索引4）查找
        self.data_asset_name_to_row = {}  # 按数据资产名称（索引5）查找
        self.assets_lookup_indexes = {}  # 按任意 assets 列索引查找
        self.ip_to_row = {}
        self.data_mapper = None
        self.sensitive_handler = None
        self.column_value_counts = {}  # 存储列值统计结果 {column_index: {value: count}}
        self.merge_results_index_mode = self.MERGE_RESULTS_INDEX_MODE_DATABASE
        # Keep row-level lookup mapping debug output opt-in to avoid stdout floods
        # during large exports.
        self.debug_lookup_mapping = os.environ.get('EXPORT_ENGINE_DEBUG_LOOKUP_MAPPING') == '1'
    def _count_non_empty_cells(self, row):
        """统计一行中非空字段数量，用于重复业务系统时保留信息更完整的记录。"""
        return sum(1 for value in row if value not in (None, ''))

    def _get_default_export_scope_config(self):
        """返回整体筛选默认配置。"""
        return {
            'assets': {
                'enabled': False,
                'mode': 'all',
                'value': 0
            },
            'merge_results': {
                'enabled': False,
                'mode': 'all',
                'value': 0
            }
        }

    def _get_default_merge_export_sampling_config(self):
        """返回合并结果导出精细筛选默认配置。"""
        return {
            'enabled': False,
            'rounding': 'floor',
            'keep_at_least_one': True,
            'include_unmatched': False,
            'rules': []
        }

    def _get_default_merge_fine_scope_policy(self):
        """返回合并结果精细化筛减默认策略。"""
        return {
            'enabled': False,
            'max_target_rows': 950000,
            'tolerance_rows': 50000,
            'manual_ratio_enabled': False,
            'manual_ratio': 0.0,
            'target_mode': 'absolute',
            'target_min': 900000,
            'target_max': 950000,
            'preferred_target': 950000,
            'target_min_percent': 90.0,
            'target_max_percent': 95.0,
            'preferred_target_percent': 95.0,
            'small_source_threshold': 10000,
            'rounding': 'largest_remainder',
            'keep_at_least_one_when_nonzero': False,
            'fallback_when_small_exceeds_max': 'warn_only',
        }

    def _emit_progress(self, progress_callback, **updates):
        """统一发送导出进度更新。"""
        if not progress_callback:
            return

        for key, value in updates.items():
            progress_callback(key, value)

    def _select_preferred_business_system_row(self, existing_row, candidate_row):
        """同一业务系统存在多条记录时，优先保留信息更完整的那一条。"""
        if not existing_row:
            return candidate_row
        if self._count_non_empty_cells(candidate_row) > self._count_non_empty_cells(existing_row):
            return candidate_row
        return existing_row

    def _normalize_export_scope_rule(self, raw_rule):
        """统一解析整体筛选配置。"""
        rule = raw_rule if isinstance(raw_rule, dict) else {}
        mode = str(rule.get('mode', 'all') or 'all').strip().lower()
        if mode not in ('all', 'top_n', 'top_percent'):
            mode = 'all'

        raw_value = rule.get('value', 0)
        if mode == 'top_percent':
            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                value = 0.0
        else:
            try:
                value = int(float(raw_value))
            except (TypeError, ValueError):
                value = 0

        return {
            'enabled': bool(rule.get('enabled', False)),
            'mode': mode,
            'value': value
        }

    def load_export_scope_config(self, config_file=None):
        """
        加载整体筛选配置。
        该配置只在填报导出链路中生效，不影响页面展示与原始数据。
        """
        default_config = self._get_default_export_scope_config()

        try:
            if config_file is None:
                config_file = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    'config',
                    'export_scope_config.json'
                )

            loaded_config = {}
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8-sig') as f:
                    raw_config = json.load(f)
                if isinstance(raw_config, dict):
                    loaded_config = raw_config

            normalized_config = {}
            for source_name, default_rule in default_config.items():
                normalized_config[source_name] = self._normalize_export_scope_rule(
                    loaded_config.get(source_name, default_rule)
                )

            self.export_scope_config = normalized_config
            print('[INFO] 整体筛选配置加载成功')
            return True
        except Exception as e:
            self.export_scope_config = default_config
            print(f'[WARNING] 加载整体筛选配置失败，已回退默认配置: {str(e)}')
            return False

    def _normalize_merge_level_for_sampling(self, value):
        """统一字段数据分级文本，兼容附加说明。"""
        text = '' if value is None else str(value).strip()
        if not text:
            return ''

        matched = re.search(r'一般级\s*-\s*第\s*(\d+)\s*小级', text)
        if matched:
            return f'一般级-第{matched.group(1)}小级'
        return text

    def _normalize_merge_export_sampling_rule(self, raw_rule):
        """统一解析单条精细筛选规则。"""
        rule = raw_rule if isinstance(raw_rule, dict) else {}
        source_name = str(rule.get('source_name') or '').strip()
        level_name = self._normalize_merge_level_for_sampling(rule.get('level_name'))

        mode = str(rule.get('mode') or 'all').strip().lower()
        if mode not in {'all', 'top_n', 'percent'}:
            mode = 'all'

        raw_value = rule.get('value', 0)
        if mode == 'percent':
            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                value = 0.0
            value = max(0.0, min(100.0, value))
        else:
            try:
                value = int(float(raw_value))
            except (TypeError, ValueError):
                value = 0
            value = max(0, value)

        return {
            'source_name': source_name,
            'level_name': level_name,
            'mode': mode,
            'value': value
        }

    def _normalize_merge_export_sampling_config(self, raw_config):
        """统一解析合并结果精细筛选配置。"""
        config = raw_config if isinstance(raw_config, dict) else {}
        rounding = str(config.get('rounding') or 'floor').strip().lower()
        if rounding not in {'floor', 'round'}:
            rounding = 'floor'

        keep_at_least_one = bool(config.get('keep_at_least_one', True))
        enabled = bool(config.get('enabled', False))
        include_unmatched = bool(config.get('include_unmatched', False))

        raw_rules = config.get('rules')
        if not isinstance(raw_rules, list):
            raw_rules = []

        dedup = {}
        ordered_keys = []
        for item in raw_rules:
            rule = self._normalize_merge_export_sampling_rule(item)
            if not rule['level_name']:
                continue
            key = (rule['source_name'], rule['level_name'])
            if key not in dedup:
                ordered_keys.append(key)
            dedup[key] = rule

        rules = [dedup[key] for key in ordered_keys]
        return {
            'enabled': enabled,
            'rounding': rounding,
            'keep_at_least_one': keep_at_least_one,
            'include_unmatched': include_unmatched,
            'rules': rules
        }

    def _normalize_merge_fine_scope_policy(self, raw_policy):
        policy = raw_policy if isinstance(raw_policy, dict) else {}
        normalized = dict(self._get_default_merge_fine_scope_policy())
        normalized['enabled'] = bool(policy.get('enabled', normalized['enabled']))
        try:
            normalized['max_target_rows'] = max(1, int(float(policy.get('max_target_rows', normalized['max_target_rows']))))
        except (TypeError, ValueError):
            pass
        try:
            normalized['tolerance_rows'] = max(0, int(float(policy.get('tolerance_rows', normalized['tolerance_rows']))))
        except (TypeError, ValueError):
            pass
        normalized['manual_ratio_enabled'] = bool(policy.get('manual_ratio_enabled', normalized['manual_ratio_enabled']))
        try:
            normalized['manual_ratio'] = max(0.0, min(1.0, float(policy.get('manual_ratio', normalized['manual_ratio']))))
        except (TypeError, ValueError):
            normalized['manual_ratio'] = 0.0

        target_mode = str(policy.get('target_mode', normalized['target_mode']) or '').strip().lower()
        normalized['target_mode'] = 'percent' if target_mode == 'percent' else 'absolute'

        try:
            normalized['target_min'] = max(1, int(float(policy.get('target_min', normalized['target_min']))))
        except (TypeError, ValueError):
            pass
        try:
            normalized['target_max'] = max(1, int(float(policy.get('target_max', normalized['target_max']))))
        except (TypeError, ValueError):
            pass
        if normalized['target_min'] > normalized['target_max']:
            normalized['target_min'], normalized['target_max'] = normalized['target_max'], normalized['target_min']

        try:
            preferred = int(float(policy.get('preferred_target', normalized['preferred_target'])))
            preferred = max(normalized['target_min'], min(normalized['target_max'], preferred))
            normalized['preferred_target'] = preferred
        except (TypeError, ValueError):
            normalized['preferred_target'] = normalized['target_max']

        try:
            normalized['small_source_threshold'] = max(0, int(float(
                policy.get('small_source_threshold', normalized['small_source_threshold'])
            )))
        except (TypeError, ValueError):
            pass

        try:
            normalized['target_min_percent'] = max(0.0, min(100.0, float(
                policy.get('target_min_percent', normalized['target_min_percent'])
            )))
        except (TypeError, ValueError):
            pass
        try:
            normalized['target_max_percent'] = max(0.0, min(100.0, float(
                policy.get('target_max_percent', normalized['target_max_percent'])
            )))
        except (TypeError, ValueError):
            pass
        if normalized['target_min_percent'] > normalized['target_max_percent']:
            normalized['target_min_percent'], normalized['target_max_percent'] = (
                normalized['target_max_percent'],
                normalized['target_min_percent']
            )
        try:
            preferred_percent = float(policy.get('preferred_target_percent', normalized['preferred_target_percent']))
            preferred_percent = max(
                normalized['target_min_percent'],
                min(normalized['target_max_percent'], preferred_percent)
            )
            normalized['preferred_target_percent'] = preferred_percent
        except (TypeError, ValueError):
            normalized['preferred_target_percent'] = normalized['target_max_percent']

        rounding = str(policy.get('rounding', normalized['rounding']) or '').strip().lower()
        normalized['rounding'] = 'largest_remainder' if rounding == 'largest_remainder' else 'floor'

        normalized['keep_at_least_one_when_nonzero'] = bool(
            policy.get('keep_at_least_one_when_nonzero', normalized['keep_at_least_one_when_nonzero'])
        )
        fallback = str(policy.get(
            'fallback_when_small_exceeds_max',
            normalized['fallback_when_small_exceeds_max']
        ) or '').strip().lower()
        normalized['fallback_when_small_exceeds_max'] = (
            'compress_all' if fallback == 'compress_all' else 'warn_only'
        )
        return normalized

    def load_merge_export_sampling_config(self, config_file=None):
        """兼容旧接口：转为加载精细化筛减策略。"""
        return self.load_merge_fine_scope_policy(config_file=config_file)

    def load_merge_fine_scope_policy(self, config_file=None):
        """加载合并结果精细化筛减策略。"""
        default_policy = self._get_default_merge_fine_scope_policy()
        try:
            if config_file is None:
                config_file = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    'config',
                    'merge_fine_scope_policy.json'
                )

            raw_policy = {}
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8-sig') as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict):
                    raw_policy = loaded

            self.merge_fine_scope_policy = self._normalize_merge_fine_scope_policy(raw_policy)
            print('[INFO] 合并结果精细化筛减策略加载成功')
            return True
        except Exception as e:
            self.merge_fine_scope_policy = default_policy
            print(f'[WARNING] 加载合并结果精细化筛减策略失败，已回退默认配置: {str(e)}')
            return False

    def _calculate_sampling_keep_count(self, total_count, mode, value, rounding, keep_at_least_one):
        """计算当前分组应保留的记录数。"""
        if total_count <= 0 or mode == 'all':
            return total_count

        if mode == 'top_n':
            return max(0, min(total_count, int(value)))

        if mode == 'percent':
            percent = max(0.0, min(100.0, float(value)))
            raw_keep = total_count * percent / 100.0
            keep_count = int(round(raw_keep)) if rounding == 'round' else int(math.floor(raw_keep))
            keep_count = max(0, min(total_count, keep_count))
            if percent > 0 and keep_at_least_one and keep_count == 0 and total_count > 0:
                keep_count = 1
            return keep_count

        return total_count

    def _apply_merge_export_sampling(self, records, progress_callback=None):
        """按精细化筛减策略对 merge_results 导出数据做压缩（仅导出链路生效）。"""
        if not isinstance(records, list):
            records = list(records or [])
        total_before = len(records)
        if total_before == 0:
            return records

        policy = self._normalize_merge_fine_scope_policy(self.merge_fine_scope_policy)
        if not policy.get('enabled'):
            return records

        small_threshold = int(policy.get('small_source_threshold') or 0)
        keep_at_least_one = bool(policy.get('keep_at_least_one_when_nonzero'))
        fallback_mode = str(policy.get('fallback_when_small_exceeds_max') or 'warn_only')
        max_target_rows = max(1, int(policy.get('max_target_rows') or 950000))
        tolerance_rows = max(0, int(policy.get('tolerance_rows') or 50000))
        manual_ratio_enabled = bool(policy.get('manual_ratio_enabled'))
        manual_ratio = max(0.0, min(1.0, float(policy.get('manual_ratio') or 0.0)))

        source_totals = {}
        record_context = []
        for idx, record in enumerate(records):
            fields = self._get_merge_results_fields(record)
            source_name = str(fields.get('数据源名称') or '').strip()
            level_name = self._normalize_merge_level_for_sampling(fields.get('字段数据分级'))
            matched = re.search(r'一般级\s*-\s*第\s*([1-4])\s*小级', level_name)
            level_rank = int(matched.group(1)) if matched else 0
            source_totals[source_name] = source_totals.get(source_name, 0) + 1
            record_context.append({
                'idx': idx,
                'source_name': source_name,
                'level_rank': level_rank
            })

        adjustable_groups = {}
        fixed_indexes = []  # 小库全保留

        for rc in record_context:
            source_total = source_totals.get(rc['source_name'], 0)
            is_small = source_total <= small_threshold
            is_adjustable = not is_small
            if is_adjustable:
                # 大库全量进入压缩池，1-4级保持结构，同时兼容非1-4级桶。
                level_bucket = rc['level_rank'] if rc['level_rank'] in (1, 2, 3, 4) else 0
                key = (rc['source_name'], level_bucket)
                adjustable_groups.setdefault(key, []).append(rc['idx'])
            else:
                fixed_indexes.append(rc['idx'])

        fixed_count = len(fixed_indexes)
        adjustable_total = sum(len(v) for v in adjustable_groups.values())

        if adjustable_total <= 0:
            return records

        # 自动计算 C = (MAX - S) / L
        auto_ratio = (max_target_rows - fixed_count) / adjustable_total if adjustable_total > 0 else 1.0
        auto_ratio = max(0.0, min(1.0, auto_ratio))
        ratio = manual_ratio if manual_ratio_enabled else auto_ratio
        ratio = max(0.0, min(1.0, ratio))
        keep_adjustable_target = int(math.floor(adjustable_total * ratio))
        target_rows = fixed_count + keep_adjustable_target

        # 极端场景兜底（按当前业务应不会触发，保留保护逻辑）。
        if fixed_count >= target_rows:
            if fallback_mode == 'compress_all':
                limited_count = min(target_rows, total_before)
                if limited_count < total_before:
                    self._emit_progress(
                        progress_callback,
                        message=f'精细化筛减兜底：全量压缩 {total_before} -> {limited_count}'
                    )
                return records[:limited_count]
            self._emit_progress(
                progress_callback,
                message='精细化筛减提示：小数据源及固定保留数据已超过目标上限，当前策略无法继续压缩。'
            )
            return records

        keep_adjustable_target = max(0, min(adjustable_total, keep_adjustable_target))

        allocation = []
        base_sum = 0
        for key, indexes in adjustable_groups.items():
            count = len(indexes)
            raw_keep = count * ratio
            keep = int(math.floor(raw_keep))
            if keep_at_least_one and ratio > 0 and count > 0 and keep == 0:
                keep = 1
            keep = max(0, min(count, keep))
            remainder = raw_keep - keep
            allocation.append({
                'key': key,
                'indexes': indexes,
                'count': count,
                'keep': keep,
                'remainder': remainder
            })
            base_sum += keep

        # 纠偏：keep 超过目标时回收。
        if base_sum > keep_adjustable_target:
            overflow = base_sum - keep_adjustable_target
            allocation.sort(key=lambda item: (item['remainder'], item['count']))
            for item in allocation:
                if overflow <= 0:
                    break
                if item['keep'] <= 0:
                    continue
                reducible = min(item['keep'], overflow)
                item['keep'] -= reducible
                overflow -= reducible

        current_keep_sum = sum(item['keep'] for item in allocation)

        # 纠偏：keep 不足目标时按最大余数补齐。
        if current_keep_sum < keep_adjustable_target:
            delta = keep_adjustable_target - current_keep_sum
            allocation.sort(key=lambda item: (item['remainder'], item['count']), reverse=True)
            for item in allocation:
                if delta <= 0:
                    break
                room = item['count'] - item['keep']
                if room <= 0:
                    continue
                add = min(room, delta)
                item['keep'] += add
                delta -= add

        selected_indexes = set(fixed_indexes)
        for item in allocation:
            if item['keep'] <= 0:
                continue
            selected_indexes.update(item['indexes'][:item['keep']])

        filtered_records = [record for idx, record in enumerate(records) if idx in selected_indexes]
        total_after = len(filtered_records)
        if total_after < total_before:
            low_bound = max(0, max_target_rows - tolerance_rows)
            high_bound = max_target_rows + tolerance_rows
            within_range = low_bound <= total_after <= high_bound
            self._emit_progress(
                progress_callback,
                message=(
                    f'精细化筛减生效：{total_before} -> {total_after}；'
                    f'C(auto)={auto_ratio:.6f}，C(use)={ratio:.6f}，'
                    f'目标区间[{low_bound},{high_bound}]，命中={within_range}'
                )
            )
            print(
                f'[SCOPE] merge_results 精细化筛减生效: {total_before} -> {total_after}, '
                f'阈值={small_threshold}, auto_ratio={auto_ratio:.6f}, use_ratio={ratio:.6f}'
            )
        return filtered_records

    def _apply_export_scope(self, records, source_name, progress_callback=None):
        """对导出源数据应用整体筛选，仅用于填报导出链路。"""
        if not isinstance(records, list):
            records = list(records or [])

        total_count = len(records)
        if total_count == 0:
            return records

        scope_config = self.export_scope_config or self._get_default_export_scope_config()
        rule = self._normalize_export_scope_rule(scope_config.get(source_name, {}))

        if not rule.get('enabled', False):
            return records

        mode = rule.get('mode', 'all')
        value = rule.get('value', 0)
        limited_count = total_count
        scope_desc = '全量'

        if mode == 'top_n':
            if value <= 0:
                print(f'[SCOPE] {source_name} 整体筛选已启用，但前 N 行配置无效({value})，跳过截取')
                return records
            limited_count = min(total_count, int(value))
            scope_desc = f'前 {int(value)} 行'
        elif mode == 'top_percent':
            if value <= 0:
                print(f'[SCOPE] {source_name} 整体筛选已启用，但前百分比配置无效({value})，跳过截取')
                return records
            percent = min(float(value), 100.0)
            limited_count = min(total_count, max(1, math.ceil(total_count * percent / 100)))
            scope_desc = f'前 {percent:g}%'
        else:
            return records

        if limited_count >= total_count:
            print(f'[SCOPE] {source_name} 整体筛选生效({scope_desc})，当前总量 {total_count}，无需截取')
            return records

        self._emit_progress(
            progress_callback,
            message=f'整体筛选生效：{source_name} 按 {scope_desc} 截取，{total_count} -> {limited_count}'
        )
        print(f'[SCOPE] {source_name} 整体筛选生效: {scope_desc}，{total_count} -> {limited_count}')
        return records[:limited_count]

    def load_config(self, mapping_config_file=None):
        """
        加载映射配置文件

        Args:
            mapping_config_file: 配置文件路径，默认使用mapping_config.json

        Returns:
            bool: 加载是否成功
        """
        try:
            if mapping_config_file is None:
                mapping_config_file = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    'config',
                    'mapping_config.json'
                )

            # Use utf-8-sig to tolerate UTF-8 BOM files generated by some editors/tools.
            with open(mapping_config_file, 'r', encoding='utf-8-sig') as f:
                self.mapping_config = json.load(f)

            self.load_export_scope_config()
            self.load_merge_fine_scope_policy()
            print('[INFO] 映射配置加载成功')

            return True

        except Exception as e:
            print(f'[ERROR] 加载映射配置失败: {str(e)}')
            return False

    def _extract_public_mapping_pairs(self, mapping_data, config_key=None):
        """从公共配置数据中提取启用的 source -> target 映射。"""
        raw_mappings = mapping_data

        if isinstance(mapping_data, dict):
            if 'public_config' in mapping_data and config_key:
                public_config = mapping_data.get('public_config') or {}
                public_entry = public_config.get(config_key) or {}
                raw_mappings = public_entry.get('mappings', {})
            elif 'mappings' in mapping_data:
                raw_mappings = mapping_data.get('mappings', {})

        mapping_pairs = {}
        if isinstance(raw_mappings, dict):
            for source, target in raw_mappings.items():
                source_text = str(source).strip()
                target_text = str(target).strip()
                if source_text and target_text:
                    mapping_pairs[source_text] = target_text
        elif isinstance(raw_mappings, list):
            for item in raw_mappings:
                if not isinstance(item, dict):
                    continue
                if not item.get('enabled', True):
                    continue
                source_text = str(item.get('source', '')).strip()
                target_text = str(item.get('target', '')).strip()
                if source_text and target_text:
                    mapping_pairs[source_text] = target_text

        return mapping_pairs

    def load_public_mapping(self, config_key, mapping_file=None):
        """
        加载指定公共映射配置。

        Args:
            config_key: 公共配置键
            mapping_file: 可选的映射文件路径

        Returns:
            bool: 加载是否成功
        """
        try:
            mapping_pairs = None
            if mapping_file is not None:
                with open(mapping_file, 'r', encoding='utf-8-sig') as f:
                    mapping_pairs = self._extract_public_mapping_pairs(json.load(f), config_key)
            else:
                default_file_name = PUBLIC_MAPPING_FILE_NAMES.get(config_key)
                if default_file_name:
                    default_mapping_file = os.path.join(
                        os.path.dirname(os.path.dirname(__file__)),
                        'config',
                        default_file_name
                    )
                    try:
                        with open(default_mapping_file, 'r', encoding='utf-8-sig') as f:
                            mapping_pairs = self._extract_public_mapping_pairs(json.load(f), config_key)
                    except FileNotFoundError:
                        mapping_pairs = None
                    except Exception:
                        mapping_pairs = None

            if mapping_pairs is None and isinstance(self.mapping_config, dict):
                mapping_pairs = self._extract_public_mapping_pairs(self.mapping_config, config_key)

            self.public_mappings[config_key] = mapping_pairs or {}
            if config_key == PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY:
                self.business_system_name_mapping = self.public_mappings[config_key]

            print(f'[INFO] 公共配置 {config_key} 加载成功，共 {len(self.public_mappings[config_key])} 条映射')
            return True

        except Exception as e:
            print(f'[ERROR] 加载公共配置 {config_key} 失败: {str(e)}')
            self.public_mappings[config_key] = {}
            if config_key == PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY:
                self.business_system_name_mapping = {}
            return False

    def load_registered_public_mappings(self, config_keys=None):
        """加载当前已登记的全部公共映射配置。"""
        target_keys = config_keys or list(PUBLIC_MAPPING_FILE_NAMES.keys())
        success = True
        for config_key in target_keys:
            if not self.load_public_mapping(config_key):
                success = False
        return success

    def load_business_system_name_mapping(self, mapping_file=None):
        """兼容旧调用：加载业务系统名称映射。"""
        return self.load_public_mapping(
            PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY,
            mapping_file=mapping_file
        )
    def load_assets_mapping(self):
        """
        加载 assets 表数据，构建业务系统名称到行的映射（用于 VLOOKUP）。

        Returns:
            bool: 加载是否成功
        """
        try:
            assets_conn = get_db_connection(DatabaseConfig.ASSETS_DB)
            assets_cursor = assets_conn.cursor()
            assets_cursor.execute('SELECT * FROM assets')
            assets_rows = assets_cursor.fetchall()
            self.assets_column_names = [desc[0] for desc in (assets_cursor.description or [])]
            self.assets_column_to_index = {
                str(name).strip(): idx for idx, name in enumerate(self.assets_column_names)
            }
            self.assets_rows = [tuple(row) for row in assets_rows]

            # 构建业务系统名称到行的映射（按业务系统名称，索引 4）
            # 将 sqlite3.Row 转换为 tuple，避免序列化问题
            self.business_system_to_row = {}
            self.ip_to_row = {}
            for row in self.assets_rows:
                business_system_name = row[4] if len(row) > 4 else ''
                if business_system_name:
                    business_system_key = str(business_system_name).strip()
                    self.business_system_to_row[business_system_key] = self._select_preferred_business_system_row(
                        self.business_system_to_row.get(business_system_key),
                        row
                    )

                for ip_field_index in (7, 9):
                    if ip_field_index >= len(row):
                        continue
                    cell_value = row[ip_field_index]
                    if not cell_value:
                        continue
                    for ip in re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', str(cell_value)):
                        self.ip_to_row.setdefault(ip, row)

            # 构建数据资产名称到行的映射（按数据资产名称，索引 5）
            self.data_asset_name_to_row = {}
            for row in self.assets_rows:
                data_asset_name = row[5] if len(row) > 5 else ''
                if data_asset_name:
                    data_asset_key = str(data_asset_name).strip()
                    self.data_asset_name_to_row[data_asset_key] = row

            self.assets_lookup_indexes = {
                '4': self.business_system_to_row,
                '5': self.data_asset_name_to_row
            }

            assets_conn.close()
            print(
                f'[INFO] assets 表映射加载成功，'
                f'共 {len(self.business_system_to_row)} 个业务系统，'
                f'{len(self.data_asset_name_to_row)} 个数据资产'
            )

            return True

        except Exception as e:
            print(f'[ERROR] 加载 assets 映射失败: {str(e)}')
            return False

    def load_data_mapper(self):
        """加载数据样例映射器。"""
        try:
            self.data_mapper = get_mapper()
            if self.data_mapper.is_loaded():
                print(f'[INFO] 数据样例映射器初始化成功，共 {self.data_mapper.get_mapping_count()} 条映射关系')
                return True
            else:
                print('[WARNING] 数据样例映射器初始化失败')
                return False
        except Exception as e:
            print(f'[ERROR] 加载数据样例映射器失败: {str(e)}')
            return False

    def _resolve_effective_data_source(self, report_config):
        """
        解析导出时真正使用的数据源。
        兼容旧配置仅保存 `data_source` 的情况，也兼容三层编辑器/代码视图中
        可能出现的 `data_source="both" + primary_data_source` 双源配置。
        """
        data_source = str(report_config.get('data_source', 'merge_results') or 'merge_results').strip()
        data_source_mode = str(report_config.get('data_source_mode', '') or '').strip()
        primary_data_source = str(report_config.get('primary_data_source', '') or '').strip()

        if data_source_mode == 'both' and primary_data_source in ('assets', 'merge_results'):
            return primary_data_source

        if data_source == 'both' and primary_data_source in ('assets', 'merge_results'):
            return primary_data_source

        return data_source

    def _normalize_merge_results_index_mode(self, mode):
        """统一 merge_results 索引口径配置。"""
        return self.MERGE_RESULTS_INDEX_MODE_DATABASE

    def _configure_merge_results_index_mode(self, report_config=None):
        """按报表配置设置当前 merge_results 索引口径。"""
        self.merge_results_index_mode = self.MERGE_RESULTS_INDEX_MODE_DATABASE
        return self.merge_results_index_mode

    def _build_merge_results_record_context(self, record_data, record_id=None):
        """
        构建 merge_results 记录上下文，同时保留旧索引和数据库真实索引两套值序列。
        """
        merge_fields = dict(record_data or {})
        existing_record_id = merge_fields.pop('id', None)
        if record_id is None:
            record_id = existing_record_id

        db_values = [record_id] + list(merge_fields.values())

        return {
            '_merge_fields': merge_fields,
            '_merge_record_id': record_id,
            '_merge_db_values': db_values
        }

    def _get_merge_results_fields(self, data):
        """获取 merge_results 业务字段字典。"""
        if isinstance(data, dict) and '_merge_fields' in data:
            fields = data.get('_merge_fields') or {}
            return fields if isinstance(fields, dict) else {}

        return data if isinstance(data, dict) else {}

    def _get_merge_results_values(self, data, index_mode=None):
        """按指定索引口径获取 merge_results 值序列。"""
        if isinstance(data, dict):
            if '_merge_db_values' in data:
                return list(data.get('_merge_db_values') or [])

        merge_fields = self._get_merge_results_fields(data)
        if not merge_fields:
            return []

        if 'id' in merge_fields:
            legacy_values = [value for key, value in merge_fields.items() if key != 'id']
            record_id = merge_fields.get('id')
        else:
            legacy_values = list(merge_fields.values())
            record_id = None

        return [record_id] + legacy_values

    def _get_merge_results_value_by_index(self, data, index_value, index_mode=None):
        """按 merge_results 索引口径获取指定值。"""
        try:
            index = int(index_value)
        except (TypeError, ValueError):
            return ''

        values = self._get_merge_results_values(data, index_mode=index_mode)
        if 0 <= index < len(values):
            value = values[index]
            return '' if value in (None, '') else value

        return ''

    def _record_to_dict(self, record, column_names):
        """将 sqlite 行对象稳定转换为按列名排序的字典。"""
        if record is None:
            return {}

        if isinstance(record, dict):
            return dict(record)

        if hasattr(record, 'keys'):
            return {column_name: record[column_name] for column_name in column_names}

        if isinstance(record, (list, tuple)):
            return {
                column_names[idx]: record[idx]
                for idx in range(min(len(column_names), len(record)))
            }

        return {}

    def apply_transform(self, value, transform):
        """
        应用数据转换

        Args:
            value: 原始值
            transform: 转换类型

        Returns:
            转换后的值
        """
        if not value:
            return value

        if transform == 'split_before_slash':
            # 取斜杠前面的内容
            if '/' in value:
                return value.split('/')[0]
            return value

        elif transform == 'format_level':
            # 将等级统一转换为“第X级”
            level_map = {
                '1': '第1级',
                '一级': '第1级',
                '2': '第2级',
                '二级': '第2级',
                '3': '第3级',
                '三级': '第3级',
                '4': '第4级',
                '四级': '第4级',
            }
            return level_map.get(str(value).strip(), value)

        elif transform == 'format_level_xiao':
            # 将“一般级-第X小级”转换为“第X级”
            match = re.search(r'第(\d+)小级', str(value))
            if match:
                xiao_level = match.group(1)
                return f'第{xiao_level}级'
            else:
                # 如果格式不匹配，尝试直接提取数字
                match = re.search(r'\d+', str(value))
                if match:
                    level_num = match.group(0)
                    return f'第{level_num}级'
            return value

        elif transform in ['remove_ip_suffix', 'remove_ip_brackets']:
            # 移除 [IP] 后缀，例如 "table_name[192.168.1.1]" -> "table_name"
            return re.sub(r'\[[\d\.\d\.\d\.\d]+\]', '', str(value)).strip()

        elif transform == 'strip_general_level_suffix':
            # 去除末尾分级说明，例如：C2-2：终端设备资料（一般级-第2小级） -> C2-2：终端设备资料
            return re.sub(r'\s*[（(]\s*一般级\s*-\s*第\s*\d+\s*小级\s*[）)]\s*$', '', str(value)).strip()

        return value

    def _resolve_record_value(self, record, field_ref, column_index_map=None):
        """按索引或列名从记录中取值。"""
        if field_ref is None:
            return ''

        if isinstance(field_ref, int) or (isinstance(field_ref, str) and field_ref.isdigit()):
            index = int(field_ref)
            if 0 <= index < len(record):
                value = record[index]
                return value if value is not None else ''
            return ''

        field_name = str(field_ref).strip()
        if column_index_map and field_name in column_index_map:
            index = column_index_map[field_name]
            if 0 <= index < len(record):
                value = record[index]
                return value if value is not None else ''

        return ''

    def _match_condition(self, field_value, match_value, is_regex=False, operator='contains'):
        """统一处理条件匹配，兼容 contains/startswith/regex。"""
        field_text = str(field_value)
        if is_regex:
            return re.search(match_value, field_text) is not None
        if operator == 'startswith':
            return field_text.startswith(match_value)
        return str(match_value) in field_text

    def _get_assets_lookup_index(self, lookup_field_index):
        """按 assets 指定列索引返回查找字典（键 -> 行）。"""
        lookup_mode = str(lookup_field_index or '4').strip()
        if not lookup_mode.isdigit():
            lookup_mode = '4'

        cached_index = self.assets_lookup_indexes.get(lookup_mode)
        if cached_index is not None:
            return cached_index

        lookup_index = {}
        column_index = int(lookup_mode)
        if column_index < 0:
            self.assets_lookup_indexes[lookup_mode] = lookup_index
            return lookup_index

        for row in self.assets_rows:
            if column_index >= len(row):
                continue

            cell_value = row[column_index]
            if cell_value in (None, ''):
                continue

            lookup_key = str(cell_value).strip()
            if not lookup_key:
                continue

            lookup_index[lookup_key] = self._select_preferred_business_system_row(
                lookup_index.get(lookup_key),
                row
            )

        self.assets_lookup_indexes[lookup_mode] = lookup_index
        return lookup_index

    def _lookup_assets_row_value(self, lookup_key_value, lookup_field, lookup_field_index='4', default_value=''):
        """根据指定匹配列在 assets 索引中查找值。"""
        if not lookup_key_value:
            return default_value

        lookup_index = self._get_assets_lookup_index(lookup_field_index)
        lookup_key = str(lookup_key_value).strip()
        assets_row = lookup_index.get(lookup_key)
        if not assets_row:
            return default_value

        value = self._resolve_record_value(assets_row, lookup_field, self.assets_column_to_index)
        return value if value != '' else default_value

    def _apply_public_config_mapping(self, raw_value, rule):
        """使用公共配置映射原始值，并按规则返回兜底结果。"""
        source_text = str(raw_value or '').strip()
        mapping_config_key = (
            rule.get('mapping_config')
            or PUBLIC_CONFIG_ASSET_NAME_MAPPING_KEY
        )
        selected_mapping = self.public_mappings.get(mapping_config_key) or {}

        mapped_value = selected_mapping.get(source_text) if source_text else None
        if mapped_value not in (None, ''):
            return mapped_value

        fallback_policy = str(rule.get('fallback_policy') or 'default').strip().lower()
        if fallback_policy in ('raw', 'raw_value', 'return_raw_value', 'continue_with_raw_value'):
            return source_text
        if fallback_policy in ('empty', 'blank', 'return_empty'):
            return ''
        return rule.get('default', '')

    def _lookup_assets_row_by_ip(self, ip_value):
        """按 IP 在 assets 索引中查找行。"""
        if not ip_value:
            return None

        ip_candidates = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', str(ip_value))
        if not ip_candidates:
            ip_candidates = [str(ip_value).strip()]

        for candidate in ip_candidates:
            if candidate in self.ip_to_row:
                return self.ip_to_row[candidate]

        if self.assets_rows:
            for row in self.assets_rows:
                for candidate in ip_candidates:
                    for ip_field_index in (7, 9):
                        if ip_field_index >= len(row):
                            continue
                        cell_value = row[ip_field_index]
                        if not cell_value:
                            continue
                        extracted_ips = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', str(cell_value))
                        if candidate and candidate in extracted_ips:
                            return row

        return None

    def get_value_by_rule_assets(self, rule, asset_data, row_index):
        """
        根据映射规则从 assets 表行数据中获取值。

        Args:
            rule: 映射规则字典
            asset_data: assets 表的行数据（元组）
            row_index: 当前行号

        Returns:
            处理后的值
        """
        source_type = rule.get('source_type', '')
        source_value = rule.get('source_value', '')
        transform = rule.get('transform', '')

        value = ''

        if source_type == 'sequence':
            # 序号：返回行号
            value = str(row_index)

        elif source_type == 'fixed':
            # 固定值
            value = source_value

        elif source_type == 'field_index_assets':
            # 从 assets 表的列中取值（按索引）
            value = self._resolve_record_value(asset_data, source_value)

        elif source_type == 'conditional':
            # 单字段条件判断
            conditions = rule.get('conditions', [])
            default_value = rule.get('default', '')
            match_mode = rule.get('match_mode', 'contains')

            # 获取源字段的值
            source_field_value = self._resolve_record_value(
                asset_data, source_value, self.assets_column_to_index
            )

            # 匹配条件
            value = default_value
            for condition in conditions:
                match = condition.get('match', '')
                is_regex = condition.get('regex', False)
                operator = condition.get('operator', match_mode)
                if self._match_condition(source_field_value, match, is_regex, operator):
                    value = condition.get('result', '')
                    break

        elif source_type in ('multi_conditional', 'conditional_groups'):
            default_value = rule.get('default', '')

            if source_type == 'multi_conditional':
                conditions = rule.get('conditions', [])
                logic = rule.get('logic', 'AND')
                result_value = rule.get('result', '')
                condition_results = []

                for condition in conditions:
                    field_value = self._resolve_record_value(
                        asset_data, condition.get('field_index'), self.assets_column_to_index
                    )
                    condition_results.append(
                        self._match_condition(
                            field_value,
                            condition.get('match', ''),
                            condition.get('regex', False),
                            condition.get('operator', 'contains')
                        )
                    )

                if logic == 'AND':
                    value = result_value if all(condition_results) else default_value
                else:
                    value = result_value if any(condition_results) else default_value
            else:
                groups = rule.get('groups', [])
                group_logic = rule.get('group_logic', 'OR')
                value = default_value

                for group in groups:
                    condition_results = []
                    for condition in group.get('conditions', []):
                        field_value = self._resolve_record_value(
                            asset_data, condition.get('field_index'), self.assets_column_to_index
                        )
                        condition_results.append(
                            self._match_condition(
                                field_value,
                                condition.get('match', ''),
                                condition.get('regex', False),
                                condition.get('operator', 'contains')
                            )
                        )

                    group_met = all(condition_results)
                    if group_met:
                        value = group.get('result', '')
                        if group_logic == 'OR':
                            break
                    elif group_logic == 'AND':
                        value = default_value
                        break

        elif source_type in ('field_assets_with_transform', 'field_merge_with_transform'):
            conditions = rule.get('conditions', [])
            default_value = rule.get('default', '')
            source_field_value = self._resolve_record_value(
                asset_data, source_value, self.assets_column_to_index
            )

            value = default_value
            if source_field_value:
                matched = False
                for condition in conditions:
                    if self._match_condition(
                        source_field_value,
                        condition.get('match', ''),
                        condition.get('regex', False),
                        condition.get('operator', 'contains')
                    ):
                        value = condition.get('result', '')
                        matched = True
                        break

                if not matched and not conditions and transform:
                    value = source_field_value

        elif source_type == 'public_config_mapping':
            source_field_value = self._resolve_record_value(
                asset_data, source_value, self.assets_column_to_index
            )
            value = self._apply_public_config_mapping(source_field_value, rule)

        elif source_type == 'vlookup_assets':
            lookup_key_value = self._resolve_record_value(
                asset_data, rule.get('lookup_key', ''), self.assets_column_to_index
            )
            value = self._lookup_assets_row_value(
                lookup_key_value,
                rule.get('lookup_field', ''),
                rule.get('lookup_field_index', '4'),
                rule.get('default', '')
            )

        elif source_type == 'vlookup_assets_with_mapping':
            lookup_key_value = self._resolve_record_value(
                asset_data, rule.get('lookup_key', ''), self.assets_column_to_index
            )
            mapping_config_key = (
                rule.get('mapping_config')
                or PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY
            )
            selected_mapping = self.public_mappings.get(mapping_config_key) or {}
            if rule.get('use_mapping', False) and selected_mapping and lookup_key_value:
                original_value = lookup_key_value
                lookup_key_value = selected_mapping.get(lookup_key_value, lookup_key_value)
                if self.debug_lookup_mapping and original_value != lookup_key_value:
                    print(f'[DEBUG] 映射: {original_value} -> {lookup_key_value}')

            value = self._lookup_assets_row_value(
                lookup_key_value,
                rule.get('lookup_field', ''),
                rule.get('lookup_field_index', '4'),
                rule.get('default', '')
            )

        elif source_type == 'lookup_ip':
            lookup_ip_value = self._resolve_record_value(
                asset_data, source_value, self.assets_column_to_index
            )
            assets_row = self._lookup_assets_row_by_ip(lookup_ip_value)
            if assets_row:
                value = self._resolve_record_value(
                    assets_row, rule.get('lookup_field', ''), self.assets_column_to_index
                )
            if value == '':
                value = rule.get('default', '')

        elif source_type == 'data_sample_mapper':
            data_name = self._resolve_record_value(
                asset_data, rule.get('name_column_index', '5'), self.assets_column_to_index
            )
            if data_name and self.data_mapper:
                value = self.data_mapper.process_sample_with_masking(data_name)
                if value is None:
                    value = ''

        elif source_type == 'column_value_count':
            column_index = str(rule.get('source_value', ''))
            lookup_value = self._resolve_record_value(
                asset_data, column_index, self.assets_column_to_index
            )
            if lookup_value != '' and column_index in self.column_value_counts:
                value = str(self.column_value_counts[column_index].get(lookup_value, 0))
            else:
                value = '0'

        # 应用转换
        value = self.apply_transform(value, transform)

        return value

    def get_value_by_rule_merge_results(self, rule, data, row_index):
        """
        根据映射规则从 merge_results 表数据中获取值。

        Args:
            rule: 映射规则字典
            data: merge_results 的 JSON 数据（字典）
            row_index: 当前行号

        Returns:
            处理后的值
        """
        source_type = rule.get('source_type', '')
        source_value = rule.get('source_value', '')
        transform = rule.get('transform', '')
        merge_fields = self._get_merge_results_fields(data)

        value = ''

        if source_type == 'sequence':
            # 序号：返回行号
            value = str(row_index)

        elif source_type == 'fixed':
            # 固定值
            value = source_value

        elif source_type == 'field_index_merge_results':
            # 从 merge_results 的 JSON 字段中取值（按索引）
            value = self._get_merge_results_value_by_index(data, source_value)

            # 应用转换（支持 split_before_slash 等）
            if value and transform:
                value = self.apply_transform(value, transform)

        elif source_type == 'conditional':
            # 单字段条件判断
            conditions = rule.get('conditions', [])
            default_value = rule.get('default', '')
            # 支持 rule 级别的 match_mode，或 condition 级别的 operator
            match_mode = rule.get('match_mode', 'contains')  # contains, startswith

            # 获取源字段的值
            try:
                if source_value.isdigit():
                    source_field_value = self._get_merge_results_value_by_index(data, source_value)
                else:
                    source_field_value = merge_fields.get(source_value, '')
            except (ValueError, IndexError, AttributeError):
                source_field_value = ''

            # 匹配条件
            value = default_value
            for condition in conditions:
                match = condition.get('match', '')
                is_regex = condition.get('regex', False)
                # 优先使用 condition 级别的 operator，没有时退回 rule 级别的 match_mode
                operator = condition.get('operator', match_mode)

                if is_regex:
                    if re.search(match, str(source_field_value)):
                        value = condition.get('result', '')
                        break
                else:
                    # 根据 operator 使用不同的匹配逻辑
                    if operator == 'startswith':
                        if str(source_field_value).startswith(match):
                            value = condition.get('result', '')
                            break
                    else:  # contains（默认）
                        if match in str(source_field_value):
                            value = condition.get('result', '')
                            break

        elif source_type == 'multi_conditional':
            # 多字段条件判断（支持 AND/OR 逻辑）
            conditions = rule.get('conditions', [])
            logic = rule.get('logic', 'AND')
            default_value = rule.get('default', '')
            result_value = rule.get('result', '')

            # 检查每个条件
            condition_results = []
            for condition in conditions:
                field_index = condition.get('field_index')
                match_value = condition.get('match', '')
                is_regex = condition.get('regex', False)

                # 获取字段值
                try:
                    if isinstance(field_index, int) or (isinstance(field_index, str) and field_index.isdigit()):
                        field_value = self._get_merge_results_value_by_index(data, field_index)
                    else:
                        field_value = ''
                except (ValueError, IndexError):
                    field_value = ''

                # 判断条件是否满足
                condition_met = False
                if is_regex:
                    condition_met = re.search(match_value, str(field_value)) is not None
                else:
                    condition_met = match_value in str(field_value)

                condition_results.append(condition_met)

            # 应用逻辑
            if logic == 'AND':
                value = result_value if all(condition_results) else default_value
            else:  # OR
                value = result_value if any(condition_results) else default_value

        elif source_type == 'conditional_groups':
            # 条件组判断：支持复杂的 AND/OR 组合逻辑
            # 例如：(A AND B) OR (C AND D)
            # 每个条件组都有自己的 result 值
            groups = rule.get('groups', [])
            group_logic = rule.get('group_logic', 'OR')  # 组与组之间的逻辑关系
            default_value = rule.get('default', '')

            # 检查每个条件组，找到第一个命中的结果
            value = default_value
            for idx, group in enumerate(groups):
                conditions = group.get('conditions', [])
                group_result = group.get('result', '')  # 该条件组的返回值

                # 检查组内的所有条件（组内默认 AND 逻辑）
                condition_results = []
                for condition in conditions:
                    field_index = condition.get('field_index')
                    match_value = condition.get('match', '')
                    is_regex = condition.get('regex', False)
                    operator = condition.get('operator', 'contains')  # 支持 contains 和 startswith

                    # 获取字段值
                    try:
                        if isinstance(field_index, int) or (isinstance(field_index, str) and field_index.isdigit()):
                            field_value = self._get_merge_results_value_by_index(data, field_index)
                        else:
                            field_value = ''
                    except (ValueError, IndexError):
                        field_value = ''

                    # 判断条件是否满足
                    condition_met = False
                    if is_regex:
                        condition_met = re.search(match_value, str(field_value)) is not None
                    else:
                        # 根据 operator 使用不同的匹配逻辑
                        if operator == 'startswith':
                            condition_met = str(field_value).startswith(match_value)
                        else:  # contains（默认）
                            condition_met = match_value in str(field_value)

                    condition_results.append(condition_met)

                # 组内条件必须全部满足（AND 逻辑）
                group_met = all(condition_results)

                if group_met:
                    value = group_result  # 返回该条件组的结果
                    if group_logic == 'OR':
                        # OR 逻辑：找到第一个满足的条件组就返回
                        break
                    # AND 逻辑：继续检查其余条件组
                else:
                    if group_logic == 'AND':
                        # AND 逻辑：任何一个条件组不满足就返回默认值
                        value = default_value
                        break

        elif source_type == 'data_level_guarding_measures':
            # 优化版：数据分级保障措施判断，避免遍历 6 个条件组
            # 逻辑：I 列以 A/B/C/D 开头且 J 列为 1/2 级 -> 4A管控
            #       I 列以 A/B/C/D 开头且 J 列为 3/4 级 -> 4A金库管控
            #       其他情况 -> 置空
            category_index = rule.get('category_index', 8)  # 数据分类列索引（默认 8）
            level_index = rule.get('level_index', 9)       # 数据分级列索引（默认 9）
            level_1_result = rule.get('level_1_result', '4A管控')        # 1/2 级结果
            level_2_result = rule.get('level_2_result', '4A金库管控')    # 3/4 级结果
            default_value = rule.get('default', '')

            try:
                category_value = self._get_merge_results_value_by_index(data, category_index)
                level_value = self._get_merge_results_value_by_index(data, level_index)

                # 判断数据分类是否以 A/B/C/D 开头
                category_prefix = str(category_value)[:1] if category_value else ''
                level_text = str(level_value or '')
                if category_prefix in ['A', 'B', 'C', 'D']:
                    # 判断数据分级，兼容“第X小级”和“X级”
                    has_level_1 = any(token in level_text for token in ('第1小级', '1级', '一级'))
                    has_level_2 = any(token in level_text for token in ('第2小级', '2级', '二级'))
                    has_level_3 = any(token in level_text for token in ('第3小级', '3级', '三级'))
                    has_level_4 = any(token in level_text for token in ('第4小级', '4级', '四级'))

                    if has_level_1 or has_level_2:
                        value = level_1_result
                    elif has_level_3 or has_level_4:
                        value = level_2_result
                    else:
                        value = default_value
                else:
                    value = default_value
            except (ValueError, IndexError):
                value = default_value

        elif source_type == 'vlookup_assets':
            # 跨表 VLOOKUP 查询：通过某个字段值在 assets 表中查找
            lookup_key_index = rule.get('lookup_key', '')
            lookup_return_index = rule.get('lookup_field', '')
            lookup_field_index = rule.get('lookup_field_index')
            default_value = rule.get('default', '')
            # 获取查询键的值（来自 merge_results）
            lookup_key_value = self._get_merge_results_value_by_index(data, lookup_key_index)

            if lookup_field_index in (None, ''):
                # 历史规则未显式配置匹配键列时，先按业务系统（4）查，再回退数据资产名称（5）。
                value = self._lookup_assets_row_value(
                    lookup_key_value,
                    lookup_return_index,
                    '4',
                    ''
                )
                if value == '':
                    value = self._lookup_assets_row_value(
                        lookup_key_value,
                        lookup_return_index,
                        '5',
                        default_value
                    )
            else:
                value = self._lookup_assets_row_value(
                    lookup_key_value,
                    lookup_return_index,
                    str(lookup_field_index),
                    default_value
                )

        elif source_type == 'vlookup_assets_with_mapping':
            # 带映射字典的 VLOOKUP 查询
            use_mapping = rule.get('use_mapping', False)
            mapping_config_key = (
                rule.get('mapping_config')
                or PUBLIC_CONFIG_BUSINESS_SYSTEM_NAME_MAPPING_KEY
            )
            selected_mapping = self.public_mappings.get(mapping_config_key) or {}
            fallback_to_raw_lookup = rule.get('fallback_to_raw_lookup', False)
            default_value = rule.get('default', '')
            lookup_key_index = rule.get('lookup_key', '')
            lookup_return_index = rule.get('lookup_field', '')
            lookup_field_index = rule.get('lookup_field_index', '4')

            # 获取查询键的值（来自 merge_results）
            lookup_key_value = self._get_merge_results_value_by_index(data, lookup_key_index)

            original_lookup_key_value = lookup_key_value

            # 应用映射字典
            if use_mapping and selected_mapping and lookup_key_value:
                original_value = lookup_key_value
                lookup_key_value = selected_mapping.get(lookup_key_value, lookup_key_value)
                if self.debug_lookup_mapping and original_value != lookup_key_value:
                    print(f'[DEBUG] 映射: {original_value} -> {lookup_key_value}')

            value = self._lookup_assets_row_value(
                lookup_key_value,
                lookup_return_index,
                lookup_field_index,
                ''
            )

            if (
                value == ''
                and fallback_to_raw_lookup
                and original_lookup_key_value
                and original_lookup_key_value != lookup_key_value
            ):
                value = self._lookup_assets_row_value(
                    original_lookup_key_value,
                    lookup_return_index,
                    lookup_field_index,
                    ''
                )

            if value == '':
                value = default_value

        elif source_type == 'lookup_ip':
            # 将 merge_results 中的 IP 反查到 assets 表中的指定字段
            lookup_field = rule.get('lookup_field', '')
            default_value = rule.get('default', '')

            try:
                if source_value.isdigit():
                    lookup_ip_value = self._get_merge_results_value_by_index(data, source_value)
                else:
                    lookup_ip_value = merge_fields.get(source_value, '')
            except (ValueError, IndexError, AttributeError):
                lookup_ip_value = ''

            assets_row = self._lookup_assets_row_by_ip(lookup_ip_value)
            if assets_row:
                value = self._resolve_record_value(
                    assets_row, lookup_field, self.assets_column_to_index
                )
            if value == '':
                value = default_value

        elif source_type == 'field_merge_with_transform':
            # 字段提取 + 条件转换
            conditions = rule.get('conditions', [])
            default_value = rule.get('default', '')

            # 获取源字段的值
            try:
                source_field_value = self._get_merge_results_value_by_index(data, source_value)
            except (ValueError, IndexError, TypeError):
                source_field_value = ''

            # 匹配条件（正则或精确匹配）
            value = default_value
            if source_field_value:
                matched = False
                for condition in conditions:
                    match = condition.get('match', '')
                    is_regex = condition.get('regex', False)

                    if is_regex:
                        if re.search(match, str(source_field_value)):
                            value = condition.get('result', '')
                            matched = True
                            break
                    else:
                        if match in str(source_field_value):
                            value = condition.get('result', '')
                            matched = True
                            break

                # 如果没有匹配条件但存在 transform，则直接应用 transform
                if not matched and not conditions and transform:
                    value = source_field_value
                elif matched and transform:
                    # 匹配成功后也应用 transform
                    pass

        elif source_type == 'public_config_mapping':
            try:
                if isinstance(source_value, int) or (isinstance(source_value, str) and source_value.isdigit()):
                    source_field_value = self._get_merge_results_value_by_index(data, source_value)
                else:
                    source_field_value = merge_fields.get(source_value, '')
            except (ValueError, IndexError, TypeError, AttributeError):
                source_field_value = ''
            value = self._apply_public_config_mapping(source_field_value, rule)

        elif source_type == 'data_sample_mapper':
            # 数据样例映射：根据数据名称从映射器中获取数据样例
            name_column_index = rule.get('name_column_index', '6')

            data_name = self._get_merge_results_value_by_index(data, name_column_index)

            # 从映射器获取数据样例（已应用脱敏/加密）
            if data_name and self.data_mapper:
                value = self.data_mapper.process_sample_with_masking(data_name)
                if value is None:
                    value = ''
            else:
                value = ''

        elif source_type == 'column_value_count':
            # 统计指定列的值在数据集中出现的次数
            # source_value 指定要统计的列索引（如 "7" 表示第 7 列，即 K 列数据名称）
            column_index = rule.get('source_value', '')

            try:
                if column_index and column_index.isdigit():
                    # 获取当前行指定列的值
                    lookup_value = self._get_merge_results_value_by_index(data, column_index)
                    if lookup_value not in (None, ''):
                        if column_index in self.column_value_counts:
                            value = str(self.column_value_counts[column_index].get(lookup_value, 0))
                        else:
                            value = '0'
                    else:
                        value = '0'
                else:
                    value = '0'
            except (ValueError, IndexError):
                value = '0'

        # 应用转换
        value = self.apply_transform(value, transform)

        return value

    def _normalize_filter_conditions(self, filter_config):
        """统一解析筛选配置，兼容新版 conditions 和旧版单条件格式。"""
        conditions = filter_config.get('conditions', [])
        logic = str(filter_config.get('logic', 'AND') or 'AND').upper()

        if not conditions:
            field_index = filter_config.get('field_index')
            operator = filter_config.get('operator', 'contains')
            filter_value = filter_config.get('value', '')

            if field_index is not None:
                conditions = [{
                    'field_index': field_index,
                    'operator': operator,
                    'value': filter_value
                }]

        if not conditions:
            filter_column_index = filter_config.get('filter_column_index')
            filter_values = filter_config.get('filter_values', [])
            filter_mode = filter_config.get('filter_mode', 'contains')

            if filter_column_index is not None and filter_values:
                conditions = [{
                    'field_index': filter_column_index,
                    'operator': filter_mode,
                    'value': filter_values
                }]

        return conditions, ('OR' if logic == 'OR' else 'AND')

    def _evaluate_filter_condition(self, field_value, operator, filter_value):
        """判断单条筛选条件是否命中。"""
        field_value_str = str(field_value) if field_value not in (None, '') else ''
        operator = str(operator or 'contains').strip().lower()

        if operator == 'is_empty':
            return not field_value_str or field_value_str.strip() == ''
        if operator == 'not_empty':
            return bool(field_value_str and field_value_str.strip())

        if isinstance(filter_value, list):
            values = [str(value) for value in filter_value if value is not None]
            if not values:
                return False

            if operator == 'contains_all':
                return all(value in field_value_str for value in values)
            if operator in ('contains_any', 'contains'):
                return any(value in field_value_str for value in values)
            if operator in ('in', 'equals'):
                return field_value_str in values
            if operator == 'not_contains':
                return all(value not in field_value_str for value in values)
            if operator == 'not_equals':
                return field_value_str not in values
            if operator == 'startswith':
                return any(field_value_str.startswith(value) for value in values)
            if operator == 'endswith':
                return any(field_value_str.endswith(value) for value in values)
            if operator == 'regex':
                return any(re.search(value, field_value_str) for value in values)
            return False

        filter_value_str = '' if filter_value is None else str(filter_value)

        if operator in ('contains_any', 'contains_all', 'contains'):
            return filter_value_str in field_value_str
        if operator in ('in', 'equals'):
            return field_value_str == filter_value_str
        if operator == 'not_contains':
            return filter_value_str not in field_value_str
        if operator == 'not_equals':
            return field_value_str != filter_value_str
        if operator == 'startswith':
            return field_value_str.startswith(filter_value_str)
        if operator == 'endswith':
            return field_value_str.endswith(filter_value_str)
        if operator == 'regex':
            return bool(re.search(filter_value_str, field_value_str))

        return False

    def _filter_records_by_conditions(self, records, filter_config, value_getter, warning_prefix):
        """按统一筛选配置过滤记录。"""
        if not filter_config.get('enabled', False):
            return records

        conditions, logic = self._normalize_filter_conditions(filter_config)
        if not conditions:
            return records

        print(f'[FILTER] 应用筛选条件: 逻辑={logic}, 条件数={len(conditions)}')

        filtered_records = []
        for record in records:
            try:
                condition_results = []
                for cond in conditions:
                    field_index = cond.get('field_index')
                    try:
                        normalized_field_index = (
                            int(field_index) if field_index not in (None, '') else None
                        )
                    except (TypeError, ValueError):
                        normalized_field_index = field_index

                    field_value = value_getter(record, normalized_field_index)
                    condition_results.append(
                        self._evaluate_filter_condition(
                            field_value,
                            cond.get('operator', 'contains'),
                            cond.get('value', '')
                        )
                    )

                pass_filter = all(condition_results) if logic == 'AND' else any(condition_results)
                if pass_filter:
                    filtered_records.append(record)
            except Exception as e:
                print(f'[WARNING] {warning_prefix}: {str(e)}')
                continue

        print(f'[FILTER] 筛选完成: {len(records)} -> {len(filtered_records)} 条记录')
        return filtered_records

    def apply_filter_assets(self, assets, filter_config):
        """
        对 assets 数据应用筛选条件。

        Args:
            assets: assets 表的行数据列表
            filter_config: 筛选配置字典

        Returns:
            筛选后的数据列表
        """
        if not filter_config.get('enabled', False):
            return assets

        return self._filter_records_by_conditions(
            assets,
            filter_config,
            lambda asset, field_index: (
                asset[field_index]
                if isinstance(field_index, int) and 0 <= field_index < len(asset)
                else ''
            ),
            'assets 筛选处理失败'
        )

    def _build_test_preview_payload(self, mapping_rules, output_rows, limit):
        """Build a JSON-safe preview payload for API test mode."""
        preview_limit = max(1, int(limit or 0))
        preview_rows = []

        for row in list(output_rows or [])[:preview_limit]:
            if isinstance(row, (list, tuple)):
                preview_rows.append([
                    '' if value in (None, '') else str(value)
                    for value in row
                ])
            else:
                preview_rows.append(['' if row in (None, '') else str(row)])

        preview_columns = [
            {
                'target_column': str(rule.get('target_column', '') or ''),
                'target_name': str(rule.get('target_name', '') or '')
            }
            for rule in list(mapping_rules or [])
        ]

        return {
            'preview_limit': preview_limit,
            'preview_columns': preview_columns,
            'preview_rows': preview_rows,
            'preview_count': len(preview_rows)
        }

    def _create_test_preview_file(self, category, report_key, template_file, data_start_row, output_rows):
        """Create a temporary preview workbook for API test mode."""
        template_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), template_file)
        wb = load_workbook(template_path)
        ws = wb.active

        for row_idx, row_data in enumerate(output_rows, data_start_row):
            for col_idx, value in enumerate(row_data, 1):
                ws.cell(row_idx, col_idx, value)

        os.makedirs(PathConfig.EXPORT_FOLDER, exist_ok=True)
        safe_report_key = re.sub(r'[^A-Za-z0-9_-]+', '_', str(report_key or 'report')).strip('_') or 'report'
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        preview_filename = f'api_test_preview_{category}_{safe_report_key}_{timestamp}.xlsx'
        preview_output_path = os.path.join(PathConfig.EXPORT_FOLDER, preview_filename)
        wb.save(preview_output_path)

        return {
            'preview_filename': preview_filename,
            'preview_output_path': preview_output_path,
            'preview_download_url': f'/api/project-files/download/exports/{preview_filename}'
        }

    def export_by_config(self, category, report_key, progress_callback=None, limit=0):
        """
        根据配置导出报表
        每次导出时都重新加载配置，确保使用最新的配置

        Args:
            category: 报表类别 (yeji/smc/xinan)
            report_key: 报表代码（如 i_10600_10001、10001、00000）
            progress_callback: 进度回调函数
            limit: 限制导出行数，0 表示全部，用于测试

        Returns:
            dict: 导出结果 {success, filename, total_rows, output_path, message, limited}
        """
        try:
            # 每次导出都重新加载配置，确保使用最新配置
            self.load_config()
            self.load_registered_public_mappings()

            # 获取报表配置
            report_config = self.mapping_config['reports'][category][report_key]
            mapping_rules = report_config['mapping_rules']
            configured_data_source = report_config.get('data_source', 'merge_results')
            data_source_mode = report_config.get('data_source_mode', '')
            primary_data_source = report_config.get('primary_data_source', '')
            data_source = self._resolve_effective_data_source(report_config)
            merge_results_index_mode = self._configure_merge_results_index_mode(report_config)
            template_file = report_config.get('template_file', '')
            data_start_row = report_config.get('data_start_row', 2)
            filter_config = report_config.get('filter_config', {})
            special_logic = report_config.get('special_logic', '')

            print(f'[START] 开始导出 {category}/{report_key}...')
            print(f'[INFO] 数据源: {configured_data_source}')
            if data_source != configured_data_source or data_source_mode == 'both':
                print(f'[INFO] 有效导出数据源: {data_source} (mode={data_source_mode or "single"}, primary={primary_data_source or "-"})')
            print(f'[INFO] 映射规则数: {len(mapping_rules)}')
            if limit > 0:
                print(f'[INFO] 限制行数: {limit}')
            if special_logic:
                print(f'[INFO] 特殊逻辑: {special_logic}')
            if data_source == 'merge_results':
                index_mode_desc = (
                    '数据库真实索引'
                    if merge_results_index_mode == self.MERGE_RESULTS_INDEX_MODE_DATABASE
                    else '兼容旧版索引(不含id)'
                )
                print(f'[INFO] merge_results索引口径: {index_mode_desc}')

            # 加载依赖
            if data_source == 'merge_results':
                self.load_assets_mapping()
                self.load_data_mapper()

            # 读取数据（使用优化版本）
            if special_logic == 'multi_row_expansion':
                # 多行展开逻辑（业支 10004）
                output_rows = self._process_assets_data_with_expansion(
                    report_config, mapping_rules, filter_config, progress_callback, limit
                )
            elif data_source == 'assets':
                output_rows = self._process_assets_data(
                    report_config, mapping_rules, filter_config, progress_callback, limit
                )
            elif data_source == 'merge_results':
                # 使用优化版本的处理方法
                output_rows = self._process_merge_results_data_optimized(
                    report_config, mapping_rules, progress_callback, batch_size=5000, limit=limit, filter_config=filter_config
                )
            else:
                return {
                    'success': False,
                    'error': f'不支持的数据源: {configured_data_source}'
                }

            if not output_rows:
                return {
                    'success': False,
                    'error': '没有可导出的数据'
                }

            # 测试导出模式（limit > 0）：不保存文件，只返回验证结果
            if limit > 0:
                print('[TEST] 测试导出模式，跳过文件保存')
                print(f'[INFO] 验证通过，可导出 {len(output_rows)} 条记录')

                test_result = {
                    'success': True,
                    'filename': None,
                    'total_rows': len(output_rows),
                    'output_path': None,
                    'message': f'测试成功，可导出 {len(output_rows)} 条记录（未保存文件）',
                    'limited': True,
                    'test_mode': True
                }
                test_result.update(
                    self._build_test_preview_payload(mapping_rules, output_rows, limit)
                )
                try:
                    test_result.update(
                        self._create_test_preview_file(
                            category,
                            report_key,
                            template_file,
                            data_start_row,
                            output_rows
                        )
                    )
                except Exception as preview_err:
                    print(f'[WARNING] 生成测试预览文件失败: {str(preview_err)}')
                    test_result['preview_file_error'] = str(preview_err)
                return test_result

            # 正式导出模式：填充模板并保存文件
            self._emit_progress(
                progress_callback,
                status='running',
                message=f'正在填充模板，共 {len(output_rows)} 条记录...'
            )

            template_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), template_file)
            wb = load_workbook(template_path)
            ws = wb.active

            for row_idx, row_data in enumerate(output_rows, data_start_row):
                for col_idx, value in enumerate(row_data, 1):
                    ws.cell(row_idx, col_idx, value)

            # 生成文件名
            base_filename = report_key.replace('i_10600_', '')
            timestamp = datetime.now().strftime('%Y%m%d')

            # SMC 报表使用特殊文件名格式
            if category == 'smc':
                # 获取当前日期和时间
                now = datetime.now()
                month = now.month
                day = now.day
                hour = now.hour
                minute = now.minute
                second = now.second

                # 根据 report_key 确定报表名称
                report_names = {
                    'attachment_3': '附件三：数据资产清单',
                    'attachment_5': '附件五：涉敏资产梳理汇总表'
                }
                report_name = report_names.get(report_key, f'附件：{report_key}')

                # 生成文件名：附件名-XX月XX日.xlsx
                filename = f'{report_name}-{month}月{day}日.xlsx'
            elif category == 'xinan':
                if base_filename == '00000':
                    suffix = '00_000'
                else:
                    suffix = '00_002'
                filename = f'i_10600_{base_filename}_{timestamp}_{suffix}.xlsx'
            else:
                suffix = '00_001'
                filename = f'i_10600_{base_filename}_{timestamp}_{suffix}.xlsx'

            # 确定输出目录
            if category == 'yeji':
                output_dir = PathConfig.YEZHI_EXPORT_DIR
            elif category == 'smc':
                output_dir = PathConfig.SMC_EXPORT_DIR
            elif category == 'xinan':
                output_dir = getattr(PathConfig, 'XINAN_EXPORT_DIR',
                                   os.path.join(PathConfig.EXPORT_FOLDER, 'XinAn'))
                if not os.path.exists(output_dir):
                    os.makedirs(output_dir)
            else:
                output_dir = PathConfig.EXPORT_FOLDER

            output_path = os.path.join(output_dir, filename)
            self._emit_progress(
                progress_callback,
                status='running',
                message='正在保存导出文件...'
            )
            wb.save(output_path)

            print('[SUCCESS] 导出成功')
            print(f'[INFO] 文件名: {filename}')
            print(f'[INFO] 保存路径: {output_path}')
            print(f'[INFO] 总行数: {len(output_rows)}')

            return {
                'success': True,
                'filename': filename,
                'total_rows': len(output_rows),
                'output_path': output_path,
                'message': f'成功导出{len(output_rows)}条记录到{filename}',
                'limited': False,
                'test_mode': False
            }

        except Exception as e:
            print(f'[ERROR] 导出失败: {str(e)}')
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }

    def _process_assets_data(self, report_config, mapping_rules, filter_config, progress_callback, limit=0):
        """处理 assets 数据源。

        Args:
            limit: 限制处理行数，0 表示全部
        """
        print('[STEP 1] 正在读取 assets 表...')

        conn = get_db_connection(DatabaseConfig.ASSETS_DB)
        cursor = conn.cursor()

        # 如果设置了 limit，则直接在 SQL 中应用
        if limit > 0:
            cursor.execute(f'SELECT * FROM assets LIMIT {limit}')
        else:
            cursor.execute('SELECT * FROM assets')

        assets = cursor.fetchall()
        conn.close()

        total_count = len(assets)
        print(f'[INFO] 读取记录数: {total_count}' + (f' (限制{limit}行)' if limit > 0 else ''))

        # 应用整体筛选（仅影响填报导出）
        assets = self._apply_export_scope(assets, 'assets', progress_callback)

        # 应用筛选
        assets = self.apply_filter_assets(assets, filter_config)

        needs_assets_lookup = any(
            rule.get('source_type') in (
                'vlookup_assets',
                'vlookup_assets_with_mapping',
                'lookup_ip'
            )
            for rule in mapping_rules
        )
        needs_data_mapper = any(rule.get('source_type') == 'data_sample_mapper' for rule in mapping_rules)
        needs_column_count = any(rule.get('source_type') == 'column_value_count' for rule in mapping_rules)

        if needs_assets_lookup and not (self.business_system_to_row or self.data_asset_name_to_row or self.ip_to_row):
            self.load_assets_mapping()

        if needs_data_mapper and self.data_mapper is None:
            self.load_data_mapper()

        if needs_column_count:
            self.column_value_counts = {}
            for rule in mapping_rules:
                if rule.get('source_type') != 'column_value_count':
                    continue
                column_index = str(rule.get('source_value', ''))
                if not column_index.isdigit():
                    continue
                col_idx = int(column_index)
                value_counts = {}
                for asset in assets:
                    if col_idx >= len(asset):
                        continue
                    current_value = asset[col_idx]
                    if current_value:
                        value_counts[current_value] = value_counts.get(current_value, 0) + 1
                self.column_value_counts[column_index] = value_counts

        # 数据转换
        print('[STEP 2] 正在转换数据...')
        output_rows = []

        for idx, asset in enumerate(assets, 1):
            if progress_callback and (idx % 100 == 0 or idx == len(assets)):
                progress_callback('current', idx)
                progress_callback('message', f'正在处理第 {idx}/{len(assets)} 条记录')

            row = []
            for rule in mapping_rules:
                value = self.get_value_by_rule_assets(rule, asset, idx)
                row.append(value)

            output_rows.append(row)

        print(f'[INFO] 数据转换完成，共 {len(output_rows)} 条有效记录')
        return output_rows

    def _process_assets_data_with_expansion(self, report_config, mapping_rules, filter_config, progress_callback, limit=0):
        """
        处理 assets 数据源（带多行展开逻辑）。
        用于业支 10004 表：每条 assets 记录展开为 2-3 条记录
        （数据脱敏、数据加密、数字水印）。

        Args:
            limit: 限制处理行数，0 表示全部
        """
        print('[STEP 1] 正在读取 assets 表...')

        conn = get_db_connection(DatabaseConfig.ASSETS_DB)
        cursor = conn.cursor()

        # 如果设置了 limit，则直接在 SQL 中应用
        if limit > 0:
            cursor.execute(f'SELECT * FROM assets LIMIT {limit}')
        else:
            cursor.execute('SELECT * FROM assets')

        assets = cursor.fetchall()
        conn.close()

        total_count = len(assets)
        print(f'[INFO] 读取记录数: {total_count}' + (f' (限制{limit}行)' if limit > 0 else ''))

        # 应用整体筛选（仅影响填报导出）
        assets = self._apply_export_scope(assets, 'assets', progress_callback)

        # 应用筛选
        assets = self.apply_filter_assets(assets, filter_config)

        # 获取展开规则
        expansion_rules = report_config.get('expansion_rules', {})
        data_masking_rule = expansion_rules.get('data_masking', {})
        data_encryption_rule = expansion_rules.get('data_encryption', {})
        digital_watermark_rule = expansion_rules.get('digital_watermark', {})

        strategy_types = {
            'data_masking': data_masking_rule.get('g_column') or '数据脱敏',
            'data_encryption': data_encryption_rule.get('g_column') or '数据加密',
            'digital_watermark': digital_watermark_rule.get('g_column') or '数字水印'
        }
        masking_type = strategy_types['data_masking']
        encryption_type = strategy_types['data_encryption']
        watermark_type = strategy_types['digital_watermark']
        strategy_content = {
            masking_type: data_masking_rule.get('h_column') or f'{masking_type}策略',
            encryption_type: data_encryption_rule.get('h_column') or f'{encryption_type}策略',
            watermark_type: digital_watermark_rule.get('h_column') or f'{watermark_type}策略'
        }

        print('[STEP 2] 正在生成多行策略数据...')
        output_rows = []
        sequence_number = 1

        for idx, asset in enumerate(assets, 1):
            if progress_callback and (idx % 100 == 0 or idx == len(assets)):
                progress_callback('current', idx)
                progress_callback('message', f'正在处理第 {idx}/{len(assets)} 条记录')

            # 获取基础字段
            business_system = asset[4] if len(asset) > 4 else ''  # D列：业务系统
            data_asset_name = asset[5] if len(asset) > 5 else ''  # E列：数据资产名称

            # 检查是否需要数字水印（业务系统包含 4A 或 CRM）
            has_watermark = bool(business_system and ('4A' in business_system or 'CRM' in business_system))

            # 构建上下文数据，用于动态字段取值
            context = {
                'asset': asset,
                'row_index': idx,
                'business_system': business_system,
                'data_asset_name': data_asset_name
            }

            # 生成数据脱敏记录
            row_masking = self._build_expanded_row(
                mapping_rules, context, sequence_number, masking_type, strategy_content[masking_type]
            )
            output_rows.append(row_masking)
            sequence_number += 1

            # 生成数据加密记录
            row_encryption = self._build_expanded_row(
                mapping_rules, context, sequence_number, encryption_type, strategy_content[encryption_type]
            )
            output_rows.append(row_encryption)
            sequence_number += 1

            # 生成数字水印记录（仅当包含 4A 或 CRM 时）
            if has_watermark:
                row_watermark = self._build_expanded_row(
                    mapping_rules, context, sequence_number, watermark_type, strategy_content[watermark_type]
                )
                output_rows.append(row_watermark)
                sequence_number += 1

        print(f'[INFO] 数据生成完成，共 {len(output_rows)} 条记录（含策略展开）')
        return output_rows

    def _build_expanded_row(self, mapping_rules, context, sequence_number, strategy_type, strategy_content):
        """
        构建展开后的行数据。

        Args:
            mapping_rules: 映射规则列表
            context: 上下文数据 {asset, row_index, business_system, data_asset_name}
            sequence_number: 当前序号
            strategy_type: 策略类型（数据脱敏/数据加密/数字水印）
            strategy_content: 策略内容

        Returns:
            list: 构建好的行数据
        """
        asset = context['asset']
        row_index = context['row_index']

        row = []
        for rule in mapping_rules:
            source_type = rule.get('source_type', '')
            target_column = rule.get('target_column', '')

            value = ''

            if source_type == 'sequence':
                # 序号：使用传入的序号
                value = str(sequence_number)

            elif source_type == 'fixed':
                # 固定值
                value = rule.get('source_value', '')

            elif source_type == 'field_index_assets':
                # 从 assets 表中获取
                source_value = rule.get('source_value', '')
                try:
                    index = int(source_value)
                    value = asset[index] if index < len(asset) else ''
                except (ValueError, IndexError):
                    value = ''

            elif source_type == 'field_assets_dynamic':
                # 动态引用其他列生成策略名称
                # 格式：{D列值}_{策略类型}政策
                reference_column = rule.get('reference_column', 'D')
                if reference_column == 'D':
                    value = f"{context['business_system']}_{strategy_type}政策"
                else:
                    value = f"{context['business_system']}_{strategy_type}政策"

            elif source_type == 'multi_strategy_config':
                # 策略类型列：直接返回当前策略类型
                value = strategy_type

            elif source_type == 'strategy_content_mapping':
                # 策略内容列：根据策略类型返回对应内容
                value = strategy_content

            # 应用转换
            transform = rule.get('transform', '')
            value = self.apply_transform(value, transform)

            row.append(value)

        return row

    def _process_merge_results_data(self, report_config, mapping_rules, progress_callback):
        """处理 merge_results 数据源。"""
        print('[STEP 1] 正在读取 merge_results 表...')

        conn = get_db_connection(DatabaseConfig.MERGE_RESULTS_DB)
        cursor = conn.cursor()

        # 检查表结构
        cursor.execute('PRAGMA table_info(merge_results)')
        columns_info = cursor.fetchall()
        column_names = [col[1] for col in columns_info]

        # 判断是旧格式（json_data）还是新格式（直接列式存储）
        use_json_format = 'json_data' in column_names and len(column_names) <= 3

        cursor.execute('SELECT COUNT(*) FROM merge_results')
        total_count = cursor.fetchone()[0]

        self._emit_progress(
            progress_callback,
            total=total_count,
            message=f'已读取 {total_count} 条原始记录，正在解析数据...'
        )

        if use_json_format:
            cursor.execute('SELECT id, json_data FROM merge_results')
            records = cursor.fetchall()
        else:
            # 新格式：读取所有列
            cursor.execute(f'SELECT * FROM merge_results')
            records = cursor.fetchall()

        conn.close()

        print(f'[INFO] 总记录数: {total_count}')
        print(f'[INFO] 数据格式: {"JSON 格式" if use_json_format else "列式存储"}')

        # 数据转换
        print('[STEP 2] 正在转换数据...')
        output_rows = []

        for idx, record in enumerate(records, 1):
            try:
                if use_json_format:
                    record_id = record[0] if isinstance(record, (list, tuple)) else record['id']
                    json_text = record[1] if isinstance(record, (list, tuple)) else record['json_data']
                    data = self._build_merge_results_record_context(
                        json.loads(json_text) if json_text else {},
                        record_id=record_id
                    )
                else:
                    # 新格式：统一转换为带上下文的记录
                    data = self._build_merge_results_record_context(
                        self._record_to_dict(record, column_names)
                    )
            except Exception as e:
                raise ValueError(f'merge_results 第 {idx} 条记录解析失败: {str(e)}') from e

            if progress_callback and (idx % 1000 == 0 or idx == total_count):
                progress_callback('current', idx)
                progress_callback('message', f'正在处理第 {idx}/{total_count} 条记录')

            try:
                row = []
                for rule in mapping_rules:
                    value = self.get_value_by_rule_merge_results(rule, data, idx)
                    row.append(value)
                output_rows.append(row)
            except Exception as e:
                raise ValueError(f'merge_results 第 {idx} 条记录处理失败: {str(e)}') from e

        print(f'[INFO] 数据转换完成，共 {len(output_rows)} 条有效记录')
        return output_rows

    def _process_merge_results_data_optimized(self, report_config, mapping_rules, progress_callback, batch_size=5000, limit=0, filter_config=None):
        """
        稳定版本：处理 merge_results 数据源。
        优化点：
        1. 预先加载所有数据到内存，减少数据库 IO
        2. 单线程处理，确保逻辑正确
        3. 直接使用已验证的 get_value_by_rule_merge_results 方法

        Args:
            limit: 限制处理行数，0 表示全部
            filter_config: 筛选配置字典，用于筛选 merge_results 数据
        """
        print('[STEP 1] 正在读取 merge_results 表...')

        conn = get_db_connection(DatabaseConfig.MERGE_RESULTS_DB)
        cursor = conn.cursor()

        # 检查表结构
        cursor.execute('PRAGMA table_info(merge_results)')
        columns_info = cursor.fetchall()
        column_names = [col[1] for col in columns_info]

        # 判断是旧格式（json_data）还是新格式（直接列式存储）
        use_json_format = 'json_data' in column_names and len(column_names) <= 3

        # 如果有限制行数，COUNT 和 SELECT 都应用 limit
        if limit > 0:
            cursor.execute(f'SELECT COUNT(*) FROM merge_results LIMIT {limit}')
            total_count = min(cursor.fetchone()[0], limit)
            if use_json_format:
                cursor.execute(f'SELECT id, json_data FROM merge_results LIMIT {limit}')
            else:
                cursor.execute(f'SELECT * FROM merge_results LIMIT {limit}')
        else:
            cursor.execute('SELECT COUNT(*) FROM merge_results')
            total_count = cursor.fetchone()[0]
            if use_json_format:
                cursor.execute('SELECT id, json_data FROM merge_results')
            else:
                cursor.execute('SELECT * FROM merge_results')

        if progress_callback:
            progress_callback('total', total_count)

        # 一次性读取数据到内存
        records = cursor.fetchall()
        conn.close()

        print(f'[INFO] 读取记录数: {total_count}' + (f' (限制{limit}行)' if limit > 0 else ''))
        print(f'[INFO] 数据格式: {"JSON 格式" if use_json_format else "列式存储"}')

        # 解析所有数据
        print('[STEP 2] 正在解析数据...')
        all_data_list = []
        for idx, record in enumerate(records, 1):
            try:
                if use_json_format:
                    record_id = record[0] if isinstance(record, (list, tuple)) else record['id']
                    json_text = record[1] if isinstance(record, (list, tuple)) else record['json_data']
                    data = self._build_merge_results_record_context(
                        json.loads(json_text) if json_text else {},
                        record_id=record_id
                    )
                else:
                    data = self._build_merge_results_record_context(
                        self._record_to_dict(record, column_names)
                    )
                all_data_list.append(data)
            except Exception as e:
                raise ValueError(f'merge_results 第 {idx} 条记录解析失败: {str(e)}') from e

        print(f'[INFO] 解析完成，共 {len(all_data_list)} 条有效记录')

        # 应用精细筛选（按“数据源名称 × 字段数据分级”）
        all_data_list = self._apply_merge_export_sampling(all_data_list, progress_callback)

        # 应用整体筛选（仅影响填报导出）
        all_data_list = self._apply_export_scope(all_data_list, 'merge_results', progress_callback)

        # 应用筛选条件（如果存在）
        if filter_config and filter_config.get('enabled', False):
            print('[STEP 2.5] 正在应用筛选条件...')
            try:
                all_data_list = self._filter_records_by_conditions(
                    all_data_list,
                    filter_config,
                    lambda data, field_index: self._get_merge_results_value_by_index(data, field_index),
                    'merge_results 筛选处理失败'
                )
            except Exception as e:
                raise ValueError(f'merge_results 筛选失败: {str(e)}') from e

        filtered_total = len(all_data_list)
        self._emit_progress(
            progress_callback,
            current=0,
            total=filtered_total,
            message=f'筛选完成，待处理 {filtered_total} 条记录'
        )

        # 检查是否需要统计列值出现次数（用于 column_value_count 类型规则）
        needs_counting = any(rule.get('source_type') == 'column_value_count' for rule in mapping_rules)

        if needs_counting:
            print('[STEP 2.5] 正在统计数据名称出现次数...')
            self.column_value_counts = {}
            # 统计每个索引的值分布
            for rule in mapping_rules:
                if rule.get('source_type') == 'column_value_count':
                    column_index = rule.get('source_value', '')
                    if column_index and column_index.isdigit():
                        # 统计该列各个值的出现次数
                        value_counts = {}
                        for data in all_data_list:
                            try:
                                value = self._get_merge_results_value_by_index(data, column_index)
                                if value:  # 只统计非空值
                                    value_counts[value] = value_counts.get(value, 0) + 1
                            except Exception:
                                continue
                        self.column_value_counts[column_index] = value_counts
                        print(f'[INFO] 列 {column_index} 统计完成，共 {len(value_counts)} 个唯一值')
                        # 显示前 5 个统计结果
                        for i, (val, count) in enumerate(list(value_counts.items())[:5]):
                            print(f'      "{val}": {count}次')
                        if len(value_counts) > 5:
                            print(f'      ... 还有 {len(value_counts) - 5} 个唯一值')

        if not all_data_list:
            return []

        # 单线程处理数据
        print('[STEP 3] 正在处理数据...')
        output_rows = []

        for idx, data in enumerate(all_data_list, 1):
            # 更新进度（每 1000 条更新一次）
            if progress_callback and (idx % 1000 == 0 or idx == len(all_data_list)):
                    self._emit_progress(
                        progress_callback,
                        current=idx,
                        message=f'正在处理第 {idx}/{len(all_data_list)} 条记录'
                    )

            try:
                # 使用原始方法处理每条记录，确保逻辑正确
                row = []
                for rule in mapping_rules:
                    value = self.get_value_by_rule_merge_results(rule, data, idx)
                    row.append(value)

                output_rows.append(row)

            except Exception as e:
                raise ValueError(f'merge_results 第 {idx} 条记录处理失败: {str(e)}') from e

        print(f'[INFO] 数据处理完成，共 {len(output_rows)} 条有效记录')
        return output_rows


# 全局单例
_engine_instance = None
_config_file_mtime = None
_mapping_file_mtime = None


def get_export_engine():
    """获取全局导出引擎实例（支持配置文件自动刷新）"""
    global _engine_instance, _config_file_mtime, _mapping_file_mtime

    # 配置文件路径
    config_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'config',
        'mapping_config.json'
    )
    mapping_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'config',
        BUSINESS_SYSTEM_NAME_MAPPING_FILE_NAME
    )

    # 检查配置文件是否被修改
    config_modified = False
    mapping_modified = False

    try:
        current_config_mtime = os.path.getmtime(config_file)
        if _config_file_mtime is None or current_config_mtime > _config_file_mtime:
            config_modified = True
            _config_file_mtime = current_config_mtime
    except Exception as e:
        print(f'[WARNING] 无法检测配置文件修改时间: {e}')

    try:
        current_mapping_mtime = os.path.getmtime(mapping_file)
        if _mapping_file_mtime is None or current_mapping_mtime > _mapping_file_mtime:
            mapping_modified = True
            _mapping_file_mtime = current_mapping_mtime
    except Exception as e:
        print(f'[WARNING] 无法检测映射文件修改时间: {e}')

    # 如果是第一次创建，或配置文件已被修改，则重新加载配置
    if _engine_instance is None:
        print('[INFO] 创建导出引擎实例')
        _engine_instance = ExportEngine()
        _engine_instance.load_config()
        _engine_instance.load_business_system_name_mapping()
    else:
        # 配置文件被修改后重新加载
        if config_modified:
            print('[INFO] 检测到映射配置文件更新，重新加载配置')
            _engine_instance.load_config()

        if mapping_modified:
            print('[INFO] 检测到业务系统名称映射文件更新，重新加载配置')
            _engine_instance.load_business_system_name_mapping()

    return _engine_instance


