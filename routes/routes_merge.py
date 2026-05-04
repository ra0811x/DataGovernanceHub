#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
合并结果路由模块
处理合并结果数据的CRUD操作、导入导出等
"""
from flask import Blueprint, request, jsonify, send_file
from io import BytesIO
import json
import pandas as pd
import threading
import os
import re
from datetime import datetime
from urllib.parse import urlparse
from openpyxl import load_workbook

from core.utils import get_db_connection, success_response, error_response
from config.config import DatabaseConfig, PathConfig, Config

# 创建Blueprint
merge_bp = Blueprint('merge', __name__)

# 导入进度追踪
import_progress = {
    'status': 'idle',  # idle, running, completed, error
    'current': 0,
    'total': 0,
    'message': '',
    'error': ''
}
import_lock = threading.Lock()

# 合并结果表期望的数据列数（不含id），从数据库动态读取
def _get_merge_expected_column_count():
    """从当前数据库表结构获取期望的数据列数（不含id）。"""
    try:
        import sqlite3
        conn = sqlite3.connect(DatabaseConfig.MERGE_RESULTS_DB)
        cursor = conn.cursor()
        cursor.execute('PRAGMA table_info(merge_results)')
        cols = cursor.fetchall()
        conn.close()
        data_cols = [c for c in cols if c[1] != 'id']
        # 兼容兜底初始化结构：仅有 json_data 时，不应按“1列”拦截导入。
        # 该场景下导入流程会在后续阶段按上传文件重建正式列结构。
        if len(data_cols) == 1 and data_cols[0][1] == 'json_data':
            return None
        return len(data_cols) if data_cols else None
    except Exception:
        return None


def _validate_merge_import_columns(uploaded_columns):
    _ = uploaded_columns
    return True, None


def _sanitize_merge_import_columns(raw_headers):
    """规范化导入列名，确保非空且唯一。"""
    columns = []
    existed = set()
    for idx, value in enumerate(raw_headers or [], 1):
        base = str(value).strip() if value is not None else ''
        if not base:
            base = f'column_{idx}'
        name = base
        suffix = 1
        while name in existed:
            suffix += 1
            name = f'{base}_{suffix}'
        existed.add(name)
        columns.append(name)
    return columns


def _is_effective_excel_row(row_values):
    """过滤空行，避免导入无效记录。"""
    if not row_values:
        return False
    for value in row_values:
        if value is None:
            continue
        if str(value).strip() != '':
            return True
    return False

# 合并结果导入进度追踪（专用于 /api/import/merge/confirm）
merge_import_progress = {
    'status': 'idle',  # idle, running, completed, error
    'current': 0,
    'total': 0,
    'message': '',
    'error': '',
    'task_id': ''
}
merge_import_lock = threading.Lock()
MERGE_IMPORT_MODE_FULL = 'full'
MERGE_IMPORT_MODE_INCREMENTAL = 'incremental'


def _safe_remove_temp_file(file_path):
    """安全删除临时文件，失败时仅记录日志。"""
    safe_path = str(file_path or '').strip()
    if not safe_path:
        return
    try:
        if os.path.exists(safe_path):
            os.remove(safe_path)
    except Exception as cleanup_err:
        print(f'[临时文件清理失败] {cleanup_err}')


def _should_require_merge_import_confirmation(
    import_mode,
    missing_columns,
    extra_columns,
    incremental_analysis
):
    """
    判断是否需要导入前确认。
    规则：
    1. 存在列差异时始终确认；
    2. 增量导入仅在识别到“新增数据源”时确认，避免默认每次都弹窗。
    """
    if missing_columns or extra_columns:
        return True

    if import_mode != MERGE_IMPORT_MODE_INCREMENTAL:
        return False

    analysis = incremental_analysis if isinstance(incremental_analysis, dict) else {}
    try:
        new_source_count = int(analysis.get('new_source_count') or 0)
    except (TypeError, ValueError):
        new_source_count = 0

    return new_source_count > 0


def get_merge_db_connection():
    """获取合并结果数据库连接"""
    import sqlite3
    conn = sqlite3.connect(DatabaseConfig.MERGE_RESULTS_DB)
    conn.row_factory = sqlite3.Row
    # 自愈：数据库文件被清理后，确保 merge_results 基础表可用，避免接口直接 500。
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS merge_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            json_data TEXT
        )
        '''
    )
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS merge_source_registry (
            source_name TEXT PRIMARY KEY,
            last_mode TEXT NOT NULL DEFAULT '',
            ever_incremental INTEGER NOT NULL DEFAULT 0,
            last_import_time TEXT NOT NULL DEFAULT '',
            last_batch_id TEXT NOT NULL DEFAULT '',
            last_record_count INTEGER NOT NULL DEFAULT 0
        )
        '''
    )
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS merge_import_batches (
            batch_id TEXT PRIMARY KEY,
            import_mode TEXT NOT NULL DEFAULT '',
            file_name TEXT NOT NULL DEFAULT '',
            total_before INTEGER NOT NULL DEFAULT 0,
            total_after INTEGER NOT NULL DEFAULT 0,
            total_delta INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT ''
        )
        '''
    )
    conn.commit()
    return conn


def _normalize_merge_import_mode(raw_mode):
    mode = str(raw_mode or '').strip().lower()
    if mode == MERGE_IMPORT_MODE_FULL:
        return MERGE_IMPORT_MODE_FULL
    return MERGE_IMPORT_MODE_INCREMENTAL


def _resolve_merge_source_column(column_names, strict=False):
    columns = [str(col or '').strip() for col in (column_names or []) if str(col or '').strip()]
    if not columns:
        return None

    if '数据源名称' in columns:
        return '数据源名称'

    for name in columns:
        if '数据源' in name and '名称' in name:
            return name

    if strict:
        return None

    data_columns = [name for name in columns if name.lower() != 'id']
    if len(data_columns) >= 12:
        return data_columns[11]
    return None


def _scan_merge_import_file(saved_path, strict_source=False):
    workbook = None
    try:
        workbook = load_workbook(filename=saved_path, read_only=True, data_only=True)
        worksheet = workbook.active
        row_iter = worksheet.iter_rows(values_only=True)
        header_row = next(row_iter, None)
        if not header_row:
            raise ValueError('Excel 文件为空或缺少表头')

        columns = _sanitize_merge_import_columns(header_row)
        source_column = _resolve_merge_source_column(columns, strict=strict_source)
        source_idx = columns.index(source_column) if source_column and source_column in columns else -1

        total_rows = 0
        source_counts = {}
        for raw_row in row_iter:
            if not _is_effective_excel_row(raw_row):
                continue
            total_rows += 1
            if source_idx >= 0 and source_idx < len(raw_row):
                source_name = '' if raw_row[source_idx] is None else str(raw_row[source_idx]).strip()
            else:
                source_name = ''
            if source_name:
                source_counts[source_name] = source_counts.get(source_name, 0) + 1

        return {
            'columns': columns,
            'total_rows': total_rows,
            'source_column': source_column,
            'source_counts': source_counts
        }
    finally:
        if workbook:
            workbook.close()


def _get_existing_source_counts(cursor, strict_source=False):
    column_names, use_json_format = _get_merge_table_schema(cursor)
    source_column = _resolve_merge_source_column(column_names, strict=strict_source)
    if use_json_format or not source_column:
        return source_column, {}

    source_expr = f'NULLIF(TRIM(COALESCE({_quote_sql_identifier(source_column)}, "")), "")'
    cursor.execute(
        f'''
        SELECT {source_expr} AS source_name, COUNT(*) AS count
        FROM merge_results
        GROUP BY source_name
        '''
    )
    counts = {}
    for row in cursor.fetchall():
        source_name = row['source_name']
        if source_name is None:
            continue
        counts[str(source_name)] = int(row['count'] or 0)
    return source_column, counts


def _build_incremental_import_analysis(upload_source_counts, existing_source_counts):
    upload_source_counts = upload_source_counts or {}
    existing_source_counts = existing_source_counts or {}

    uploaded_sources = sorted(upload_source_counts.keys())
    matched_sources = [name for name in uploaded_sources if name in existing_source_counts]
    new_sources = [name for name in uploaded_sources if name not in existing_source_counts]

    replace_items = []
    for source_name in uploaded_sources:
        old_count = int(existing_source_counts.get(source_name, 0))
        new_count = int(upload_source_counts.get(source_name, 0))
        replace_items.append({
            'source_name': source_name,
            'old_count': old_count,
            'new_count': new_count,
            'delta': new_count - old_count,
            'is_new_source': source_name not in existing_source_counts
        })

    replace_items.sort(key=lambda item: (-item['new_count'], item['source_name']))

    old_total = sum(int(existing_source_counts.get(name, 0)) for name in uploaded_sources)
    new_total = sum(int(upload_source_counts.get(name, 0)) for name in uploaded_sources)

    return {
        'replace_items': replace_items,
        'replace_count': len(matched_sources),
        'new_source_items': [{'source_name': name, 'new_count': int(upload_source_counts.get(name, 0))} for name in new_sources],
        'new_source_count': len(new_sources),
        'uploaded_source_count': len(uploaded_sources),
        'affected_old_total': old_total,
        'incoming_total': new_total,
        'total_delta': new_total - old_total
    }


def _upsert_merge_source_registry(cursor, source_counts, import_mode, batch_id, import_time):
    if not source_counts:
        return

    ever_incremental_value = 1 if import_mode == MERGE_IMPORT_MODE_INCREMENTAL else 0
    for source_name, record_count in source_counts.items():
        source_text = str(source_name or '').strip()
        if not source_text:
            continue
        cursor.execute(
            '''
            INSERT INTO merge_source_registry (
                source_name,
                last_mode,
                ever_incremental,
                last_import_time,
                last_batch_id,
                last_record_count
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(source_name) DO UPDATE SET
                last_mode = excluded.last_mode,
                ever_incremental = CASE
                    WHEN excluded.ever_incremental = 1 THEN 1
                    ELSE merge_source_registry.ever_incremental
                END,
                last_import_time = excluded.last_import_time,
                last_batch_id = excluded.last_batch_id,
                last_record_count = excluded.last_record_count
            ''',
            (
                source_text,
                import_mode,
                ever_incremental_value,
                import_time,
                batch_id,
                int(record_count or 0)
            )
        )


def _record_merge_import_batch(
    cursor,
    batch_id,
    import_mode,
    file_name,
    total_before,
    total_after,
    created_at
):
    cursor.execute(
        '''
        INSERT OR REPLACE INTO merge_import_batches (
            batch_id,
            import_mode,
            file_name,
            total_before,
            total_after,
            total_delta,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            str(batch_id or ''),
            str(import_mode or ''),
            str(file_name or ''),
            int(total_before or 0),
            int(total_after or 0),
            int(total_after or 0) - int(total_before or 0),
            str(created_at or '')
        )
    )


def get_merge_columns():
    """获取合并结果列配置"""
    try:
        with open(PathConfig.MERGE_COLUMNS_JSON, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'columns': []}


def _is_force_import_requested():
    """判断当前请求是否为用户确认后的强制导入。"""
    value = str(request.form.get('force_import', '') or '').strip().lower()
    return value in {'1', 'true', 'yes', 'y', 'on'}


def _get_merge_expected_headers():
    """读取当前合并结果列配置中的标准表头。"""
    config = get_merge_columns()
    columns = config.get('columns') if isinstance(config, dict) else []
    headers = []
    for column in columns or []:
        if not isinstance(column, dict):
            continue
        name = str(column.get('name') or '').strip()
        if not name or name.lower() == 'id':
            continue
        headers.append(name)
    return headers


def _compare_import_headers(imported_headers, expected_headers):
    """比较导入表头与当前标准表头，返回缺失列与新增列。"""
    normalized_expected = [str(header or '').strip() for header in (expected_headers or []) if str(header or '').strip()]
    normalized_imported = [str(header or '').strip() for header in (imported_headers or []) if str(header or '').strip()]

    if not normalized_expected:
        return [], []

    imported_set = set(normalized_imported)
    expected_set = set(normalized_expected)

    missing_columns = [header for header in normalized_expected if header not in imported_set]
    extra_columns = [header for header in normalized_imported if header not in expected_set]
    return missing_columns, extra_columns


def _build_merge_schema_warning(missing_columns, extra_columns):
    """构建合并结果导入列变化提醒文案。"""
    detail_items = []
    if missing_columns:
        detail_items.append(f'缺失列: {", ".join(missing_columns)}')
    if extra_columns:
        detail_items.append(f'新增列: {", ".join(extra_columns)}')

    detail_text = f'（{"；".join(detail_items)}）' if detail_items else ''
    return (
        f'合并结果导入检测到列变化{detail_text}。'
        '继续导入可能导致映射数据偏差，请确认是否继续。'
    )


def _quote_sql_identifier(identifier):
    """对 SQLite 标识符加引号，避免列名中的特殊字符影响查询。"""
    return '"' + str(identifier).replace('"', '""') + '"'


def _get_merge_table_schema(cursor):
    """读取合并结果表结构，并判断是否为旧版 json_data 格式。"""
    cursor.execute('PRAGMA table_info(merge_results)')
    columns_info = cursor.fetchall()
    column_names = [col['name'] for col in columns_info]
    use_json_format = 'json_data' in column_names and len(column_names) <= 3
    return column_names, use_json_format


def _get_merge_data_columns(column_names):
    return [str(col) for col in (column_names or []) if str(col).lower() != 'id']


def _ensure_merge_table_columns(cursor, existing_columns, required_columns):
    """确保 merge_results 包含 required_columns 中所有列，按需追加新列。"""
    existing_data_columns = _get_merge_data_columns(existing_columns)
    missing_columns = [
        col for col in (required_columns or [])
        if col not in existing_data_columns
    ]

    for column_name in missing_columns:
        cursor.execute(
            f'ALTER TABLE merge_results ADD COLUMN {_quote_sql_identifier(column_name)} TEXT'
        )
        existing_data_columns.append(column_name)

    return existing_data_columns


def _build_sqlite_json_path(field_name):
    """构建 SQLite JSON 路径，兼容中文字段名。"""
    safe_field_name = str(field_name or '').replace('\\', '\\\\').replace('"', '\\"')
    return f'$."{safe_field_name}"'


def _build_merge_filter_sql(column_names, use_json_format, search='', category='', advanced_filter=None):
    """构建合并结果筛选 SQL，供统计接口复用。"""
    where_clauses = []
    params = []

    search = str(search or '').strip()
    category = str(category or '').strip()
    advanced_filter = advanced_filter or {}

    if category and category != 'all' and use_json_format and 'category' in column_names:
        where_clauses.append('category = ?')
        params.append(category)

    if search:
        if use_json_format:
            where_clauses.append('json_data LIKE ?')
            params.append(f'%{search}%')
        else:
            data_columns = [col for col in column_names if str(col).lower() != 'id']
            if data_columns:
                search_conditions = ' OR '.join([f'{_quote_sql_identifier(col)} LIKE ?' for col in data_columns])
                where_clauses.append(f'({search_conditions})')
                params.extend([f'%{search}%'] * len(data_columns))

    field = str(advanced_filter.get('field') or '').strip()
    operator = str(advanced_filter.get('operator') or '').strip()
    raw_value = advanced_filter.get('value', '')
    value = '' if raw_value is None else str(raw_value)

    if field and operator:
        if use_json_format:
            field_expr = 'COALESCE(json_extract(json_data, ?), "")'
            field_params = [_build_sqlite_json_path(field)]
        else:
            if field not in column_names:
                raise ValueError(f'字段不存在: {field}')
            field_expr = f'COALESCE({_quote_sql_identifier(field)}, "")'
            field_params = []

        if operator == 'contains':
            where_clauses.append(f'{field_expr} LIKE ?')
            params.extend(field_params + [f'%{value}%'])
        elif operator == 'equals':
            where_clauses.append(f'{field_expr} = ?')
            params.extend(field_params + [value])
        elif operator == 'not_contains':
            where_clauses.append(f'{field_expr} NOT LIKE ?')
            params.extend(field_params + [f'%{value}%'])
        elif operator == 'not_equals':
            where_clauses.append(f'{field_expr} != ?')
            params.extend(field_params + [value])
        elif operator == 'is_empty':
            where_clauses.append(f'TRIM({field_expr}) = ""')
            params.extend(field_params)
        elif operator == 'not_empty':
            where_clauses.append(f'TRIM({field_expr}) != ""')
            params.extend(field_params)
        else:
            raise ValueError(f'不支持的筛选操作符: {operator}')

    return where_clauses, params


def _collect_merge_source_name_stats(payload=None):
    """汇总“数据源名称”统计结果，供 JSON 接口和导出接口共用。"""
    conn = None
    payload = payload or {}
    search = payload.get('search', '')
    category = payload.get('category', '')
    advanced_filter = payload.get('advanced_filter') or {}
    source_field = '数据源名称'

    try:
        conn = get_merge_db_connection()
        cursor = conn.cursor()
        column_names, use_json_format = _get_merge_table_schema(cursor)

        if not use_json_format and source_field not in column_names:
            raise ValueError('合并结果表中不存在“数据源名称”列')

        where_clauses, where_params = _build_merge_filter_sql(
            column_names,
            use_json_format,
            search=search,
            category=category,
            advanced_filter=advanced_filter
        )

        filtered_sql = 'FROM merge_results'
        if where_clauses:
            filtered_sql += ' WHERE ' + ' AND '.join(where_clauses)

        cursor.execute(f'SELECT COUNT(*) AS total {filtered_sql}', where_params)
        total_records = cursor.fetchone()['total']

        if use_json_format:
            source_expr = 'NULLIF(TRIM(COALESCE(json_extract(json_data, ?), "")), "")'
            source_params = [_build_sqlite_json_path(source_field)]
        else:
            source_expr = f'NULLIF(TRIM(COALESCE({_quote_sql_identifier(source_field)}, "")), "")'
            source_params = []

        stats_sql = f'''
            SELECT source_name, COUNT(*) AS count
            FROM (
                SELECT {source_expr} AS source_name
                {filtered_sql}
            ) source_rows
            GROUP BY source_name
            ORDER BY
                CASE WHEN source_name IS NULL THEN 1 ELSE 0 END,
                count DESC,
                source_name COLLATE NOCASE ASC
        '''
        cursor.execute(stats_sql, source_params + where_params)
        rows = cursor.fetchall()

        cursor.execute(
            '''
            SELECT source_name, last_mode, ever_incremental, last_import_time
            FROM merge_source_registry
            '''
        )
        registry_map = {
            str(row['source_name']): {
                'last_mode': str(row['last_mode'] or '').strip().lower(),
                'ever_incremental': bool(int(row['ever_incremental'] or 0)),
                'last_import_time': str(row['last_import_time'] or '').strip()
            }
            for row in cursor.fetchall()
            if str(row['source_name'] or '').strip()
        }

        items = []
        empty_count = 0
        non_empty_distinct_count = 0

        for row in rows:
            source_name = row['source_name']
            count = int(row['count'] or 0)
            is_empty = source_name is None

            if is_empty:
                empty_count = count
                update_mode = 'unknown'
                update_mode_label = '未标注'
                last_import_time = ''
            else:
                non_empty_distinct_count += 1
                registry = registry_map.get(str(source_name), {})
                last_mode = str(registry.get('last_mode') or '').strip().lower()
                ever_incremental = bool(registry.get('ever_incremental'))
                last_import_time = str(registry.get('last_import_time') or '').strip()
                if last_mode == MERGE_IMPORT_MODE_INCREMENTAL:
                    update_mode = MERGE_IMPORT_MODE_INCREMENTAL
                    update_mode_label = '增量更新'
                elif last_mode == MERGE_IMPORT_MODE_FULL and ever_incremental:
                    update_mode = 'mixed'
                    update_mode_label = '曾增量，最近全量'
                elif last_mode == MERGE_IMPORT_MODE_FULL:
                    update_mode = MERGE_IMPORT_MODE_FULL
                    update_mode_label = '仅全量'
                else:
                    update_mode = 'unknown'
                    update_mode_label = '未标注'

            items.append({
                'value': '' if is_empty else source_name,
                'label': '空值/未填写' if is_empty else source_name,
                'count': count,
                'is_empty': is_empty,
                'update_mode': update_mode,
                'update_mode_label': update_mode_label,
                'last_import_time': last_import_time
            })

        return {
            'source_field': source_field,
            'items': items,
            'total_records': total_records,
            'distinct_count': len(items),
            'non_empty_distinct_count': non_empty_distinct_count,
            'empty_count': empty_count
        }
    finally:
        if conn:
            conn.close()


MERGE_LEVEL_NORMALIZE_PATTERN = re.compile(r'一般级\s*-\s*第\s*(\d+)\s*小级')
MERGE_EXPORT_SAMPLING_CONFIG_FILE = os.path.join(
    Config.BASE_DIR,
    'config',
    'merge_export_sampling_config.json'
)
MERGE_EXPORT_SAMPLING_DEFAULT_CONFIG = {
    'enabled': False,
    'rounding': 'floor',
    'keep_at_least_one': True,
    'include_unmatched': False,
    'rules': []
}


def _normalize_merge_matrix_scope(payload):
    """标准化工具箱分布筛选范围。"""
    scope = str((payload or {}).get('scope') or 'all').strip().lower()
    return 'current_filter' if scope == 'current_filter' else 'all'


def _normalize_merge_level_label(level_value):
    """统一字段数据分级显示，兼容存在空格或括号的文本。"""
    raw_text = '' if level_value is None else str(level_value).strip()
    if not raw_text:
        return '', '空值/未填写'

    matched = MERGE_LEVEL_NORMALIZE_PATTERN.search(raw_text)
    if matched:
        level_no = matched.group(1)
        normalized = f'一般级-第{level_no}小级'
        return normalized, normalized

    return raw_text, raw_text


def _normalize_merge_export_sampling_rule(raw_rule):
    """规范化单条导出精细筛选规则。"""
    rule = raw_rule if isinstance(raw_rule, dict) else {}

    source_name = str(rule.get('source_name') or '').strip()
    level_value, _ = _normalize_merge_level_label(rule.get('level_name'))

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
        'level_name': level_value,
        'mode': mode,
        'value': value
    }


def _normalize_merge_export_sampling_config(raw_config):
    """规范化导出精细筛选配置。"""
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

    dedup_map = {}
    ordered_keys = []
    for item in raw_rules:
        normalized_rule = _normalize_merge_export_sampling_rule(item)
        source_name = normalized_rule['source_name']
        level_name = normalized_rule['level_name']
        if not level_name:
            continue

        key = (source_name, level_name)
        if key not in dedup_map:
            ordered_keys.append(key)
        dedup_map[key] = normalized_rule

    rules = [dedup_map[key] for key in ordered_keys]

    return {
        'enabled': enabled,
        'rounding': rounding,
        'keep_at_least_one': keep_at_least_one,
        'include_unmatched': include_unmatched,
        'rules': rules
    }


def _load_merge_export_sampling_config():
    """读取导出精细筛选配置。"""
    config = dict(MERGE_EXPORT_SAMPLING_DEFAULT_CONFIG)
    try:
        if os.path.exists(MERGE_EXPORT_SAMPLING_CONFIG_FILE):
            with open(MERGE_EXPORT_SAMPLING_CONFIG_FILE, 'r', encoding='utf-8-sig') as f:
                raw = json.load(f)
            config = _normalize_merge_export_sampling_config(raw)
    except Exception:
        config = dict(MERGE_EXPORT_SAMPLING_DEFAULT_CONFIG)
    return config


def _save_merge_export_sampling_config(raw_config):
    """保存导出精细筛选配置。"""
    normalized = _normalize_merge_export_sampling_config(raw_config)
    os.makedirs(os.path.dirname(MERGE_EXPORT_SAMPLING_CONFIG_FILE), exist_ok=True)
    with open(MERGE_EXPORT_SAMPLING_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(normalized, f, ensure_ascii=False, indent=2)
    return normalized


def _collect_merge_source_level_matrix(payload=None):
    """统计“数据源名称 × 字段数据分级”分布，供工具箱分布筛选页签使用。"""
    conn = None
    payload = payload or {}
    scope = _normalize_merge_matrix_scope(payload)
    source_field = '数据源名称'
    level_field = '字段数据分级'

    search = payload.get('search', '') if scope == 'current_filter' else ''
    category = payload.get('category', '') if scope == 'current_filter' else ''
    advanced_filter = payload.get('advanced_filter') if scope == 'current_filter' else None

    try:
        conn = get_merge_db_connection()
        cursor = conn.cursor()
        column_names, use_json_format = _get_merge_table_schema(cursor)

        if not use_json_format:
            if source_field not in column_names:
                raise ValueError('合并结果表中不存在“数据源名称”列')
            if level_field not in column_names:
                raise ValueError('合并结果表中不存在“字段数据分级”列')

        where_clauses, where_params = _build_merge_filter_sql(
            column_names,
            use_json_format,
            search=search,
            category=category,
            advanced_filter=advanced_filter
        )

        filtered_sql = 'FROM merge_results'
        if where_clauses:
            filtered_sql += ' WHERE ' + ' AND '.join(where_clauses)

        cursor.execute(f'SELECT COUNT(*) AS total_records {filtered_sql}', where_params)
        total_records = int(cursor.fetchone()['total_records'] or 0)

        if use_json_format:
            source_expr = 'NULLIF(TRIM(COALESCE(json_extract(json_data, ?), "")), "")'
            level_expr = 'NULLIF(TRIM(COALESCE(json_extract(json_data, ?), "")), "")'
            expr_params = [
                _build_sqlite_json_path(source_field),
                _build_sqlite_json_path(level_field)
            ]
        else:
            source_expr = f'NULLIF(TRIM(COALESCE({_quote_sql_identifier(source_field)}, "")), "")'
            level_expr = f'NULLIF(TRIM(COALESCE({_quote_sql_identifier(level_field)}, "")), "")'
            expr_params = []

        matrix_sql = f'''
            SELECT source_name, level_name, COUNT(*) AS count
            FROM (
                SELECT {source_expr} AS source_name, {level_expr} AS level_name
                {filtered_sql}
            ) matrix_rows
            GROUP BY source_name, level_name
        '''
        cursor.execute(matrix_sql, expr_params + where_params)
        rows = cursor.fetchall()

        source_map = {}
        level_totals = {}

        for row in rows:
            source_name = row['source_name']
            level_name = row['level_name']
            count = int(row['count'] or 0)
            if count <= 0:
                continue

            source_value = '' if source_name is None else str(source_name)
            source_label = '空值/未填写' if source_name is None else str(source_name)
            level_value, level_label = _normalize_merge_level_label(level_name)

            source_item = source_map.get(source_value)
            if source_item is None:
                source_item = {
                    'source_value': source_value,
                    'source_label': source_label,
                    'total_count': 0,
                    'levels_map': {}
                }
                source_map[source_value] = source_item

            source_item['total_count'] += count
            source_item['levels_map'][level_value] = {
                'value': level_value,
                'label': level_label,
                'count': source_item['levels_map'].get(level_value, {}).get('count', 0) + count
            }

            level_total_item = level_totals.get(level_value)
            if level_total_item is None:
                level_totals[level_value] = {
                    'value': level_value,
                    'label': level_label,
                    'count': count
                }
            else:
                level_total_item['count'] += count

        level_totals_list = sorted(
            level_totals.values(),
            key=lambda item: (-int(item.get('count') or 0), str(item.get('label') or ''))
        )

        items = []
        for source_item in source_map.values():
            levels_list = sorted(
                source_item['levels_map'].values(),
                key=lambda item: (-int(item.get('count') or 0), str(item.get('label') or ''))
            )
            items.append({
                'source_value': source_item['source_value'],
                'source_label': source_item['source_label'],
                'total_count': source_item['total_count'],
                'levels': levels_list
            })

        items.sort(
            key=lambda item: (
                -int(item.get('total_count') or 0),
                str(item.get('source_label') or '')
            )
        )

        return {
            'scope': scope,
            'source_field': source_field,
            'level_field': level_field,
            'total_records': total_records,
            'source_count': len(items),
            'level_totals': level_totals_list,
            'items': items
        }
    finally:
        if conn:
            conn.close()


CLEANING_LEVEL_SUFFIX_PATTERN = re.compile(r'\s*[（(]\s*一般级\s*-\s*第\s*\d+\s*小级\s*[）)]\s*$')


def _normalize_merge_cleaning_scope(payload):
    """标准化工具箱清洗范围。"""
    scope = str((payload or {}).get('scope') or 'all').strip().lower()
    return 'current_filter' if scope == 'current_filter' else 'all'


def _resolve_merge_cleaning_target_column(column_names, use_json_format, payload=None):
    """解析清洗目标列，默认使用 J 列（索引10）。"""
    payload = payload or {}

    if use_json_format:
        raise ValueError('当前合并结果仍为旧版 json_data 结构，暂不支持按索引清洗。请先重新导入为列式数据。')

    field_name = str(payload.get('field_name') or '').strip()
    if field_name:
        if field_name not in column_names:
            raise ValueError(f'目标字段不存在: {field_name}')
        if field_name == 'id':
            raise ValueError('目标字段不能为 id')
        field_index = column_names.index(field_name)
        return field_name, field_index

    raw_field_index = payload.get('field_index', 10)
    try:
        field_index = int(raw_field_index)
    except (TypeError, ValueError):
        raise ValueError('字段索引必须为整数')

    if field_index < 1 or field_index >= len(column_names):
        raise ValueError(f'字段索引超出范围: {field_index}（可用范围 1~{len(column_names) - 1}）')

    target_column = column_names[field_index]
    if target_column == 'id':
        raise ValueError('目标字段不能为 id')

    return target_column, field_index


def _build_merge_cleaning_filtered_sql(payload, column_names, use_json_format):
    """构建清洗使用的筛选 SQL。"""
    payload = payload or {}
    scope = _normalize_merge_cleaning_scope(payload)

    search = payload.get('search', '') if scope == 'current_filter' else ''
    category = payload.get('category', '') if scope == 'current_filter' else ''
    advanced_filter = payload.get('advanced_filter') if scope == 'current_filter' else None

    where_clauses, where_params = _build_merge_filter_sql(
        column_names,
        use_json_format,
        search=search,
        category=category,
        advanced_filter=advanced_filter
    )

    filtered_sql = 'FROM merge_results'
    if where_clauses:
        filtered_sql += ' WHERE ' + ' AND '.join(where_clauses)

    return scope, filtered_sql, where_params


def _collect_merge_source_name_cleaning_preview(payload=None):
    """生成“多余文字清洗”预览。"""
    conn = None
    payload = payload or {}
    max_samples = payload.get('max_samples', 12)
    try:
        max_samples = max(1, min(int(max_samples), 50))
    except (TypeError, ValueError):
        max_samples = 12

    try:
        conn = get_merge_db_connection()
        cursor = conn.cursor()
        column_names, use_json_format = _get_merge_table_schema(cursor)
        target_column, target_field_index = _resolve_merge_cleaning_target_column(
            column_names,
            use_json_format,
            payload
        )
        scope, filtered_sql, where_params = _build_merge_cleaning_filtered_sql(payload, column_names, use_json_format)

        target_expr = f'COALESCE({_quote_sql_identifier(target_column)}, "")'
        cursor.execute(
            f'SELECT id, {target_expr} AS target_value {filtered_sql}',
            where_params
        )
        rows = cursor.fetchall()

        matched_count = 0
        affected_count = 0
        samples = []

        for row in rows:
            before = '' if row['target_value'] is None else str(row['target_value'])
            if not CLEANING_LEVEL_SUFFIX_PATTERN.search(before):
                continue

            matched_count += 1
            after = CLEANING_LEVEL_SUFFIX_PATTERN.sub('', before).strip()
            if after == before:
                continue

            affected_count += 1
            if len(samples) < max_samples:
                samples.append({
                    'id': row['id'],
                    'before': before,
                    'after': after
                })

        return {
            'scope': scope,
            'target_column': target_column,
            'target_field_index': target_field_index,
            'target_column_label': f'{target_column}（索引{target_field_index}）',
            'matched_count': matched_count,
            'affected_count': affected_count,
            'samples': samples
        }
    finally:
        if conn:
            conn.close()


def _apply_merge_source_name_cleaning(payload=None):
    """执行“多余文字清洗”并写回 merge_results。"""
    conn = None
    payload = payload or {}

    try:
        conn = get_merge_db_connection()
        cursor = conn.cursor()
        column_names, use_json_format = _get_merge_table_schema(cursor)
        target_column, target_field_index = _resolve_merge_cleaning_target_column(
            column_names,
            use_json_format,
            payload
        )
        scope, filtered_sql, where_params = _build_merge_cleaning_filtered_sql(payload, column_names, use_json_format)

        target_expr = f'COALESCE({_quote_sql_identifier(target_column)}, "")'
        cursor.execute(
            f'SELECT id, {target_expr} AS target_value {filtered_sql}',
            where_params
        )
        rows = cursor.fetchall()

        updates = []
        matched_count = 0

        for row in rows:
            before = '' if row['target_value'] is None else str(row['target_value'])
            if not CLEANING_LEVEL_SUFFIX_PATTERN.search(before):
                continue

            matched_count += 1
            after = CLEANING_LEVEL_SUFFIX_PATTERN.sub('', before).strip()
            if after == before:
                continue

            updates.append((after, row['id']))

        if updates:
            update_sql = f'UPDATE merge_results SET {_quote_sql_identifier(target_column)} = ? WHERE id = ?'
            cursor.executemany(update_sql, updates)

        conn.commit()

        return {
            'scope': scope,
            'target_column': target_column,
            'target_field_index': target_field_index,
            'target_column_label': f'{target_column}（索引{target_field_index}）',
            'matched_count': matched_count,
            'updated_count': len(updates)
        }
    finally:
        if conn:
            conn.close()


def get_log_operation():
    """延迟导入日志记录函数"""
    from routes.routes_logs import log_operation
    return log_operation


def save_data_file_metadata_with_stored_name(page_type, file_name, record_count, columns_snapshot, stored_name):
    """保存数据文件元信息（已废弃，不再使用）"""
    # 不再需要保存元信息到 data_files.db
    print(f"[INFO] 导入文件: {file_name}, 记录数: {record_count}")


def update_merge_columns_config(columns, filename):
    """更新合并结果列配置"""
    config = get_merge_columns()
    existing_cols = {col['name']: col for col in config.get('columns', [])}

    new_column_config = []
    for col_name in columns:
        if col_name in existing_cols:
            new_column_config.append(existing_cols[col_name])
        else:
            new_column_config.append({
                'name': col_name,
                'visible': True,
                'width': 120
            })

    config['columns'] = new_column_config
    config['sourceFile'] = filename

    with open(PathConfig.MERGE_COLUMNS_JSON, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    return new_column_config


def _recreate_merge_results_table(cursor, columns):
    """按导入文件列重建合并结果表，兼容列式存储结构。"""
    if not columns:
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS merge_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                json_data TEXT
            )
            '''
        )
        return

    column_defs = ', '.join([f'{_quote_sql_identifier(col)} TEXT' for col in columns])
    cursor.executescript(
        f'''
        DROP TABLE IF EXISTS merge_results;
        CREATE TABLE merge_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            {column_defs}
        )
        '''
    )


def reject_cross_site_delete_request():
    """拦截明显来自外部站点的删除请求。"""
    origin = str(request.headers.get('Origin') or '').strip()
    sec_fetch_site = str(request.headers.get('Sec-Fetch-Site') or '').strip().lower()

    if sec_fetch_site == 'cross-site':
        return jsonify({'error': '跨站删除请求已被拒绝'}), 403

    if not origin:
        return None

    origin_netloc = urlparse(origin).netloc.lower()
    request_netloc = urlparse(request.host_url).netloc.lower()
    if origin_netloc and origin_netloc != request_netloc:
        return jsonify({'error': '跨站删除请求已被拒绝'}), 403

    return None


# ==================== 路由定义 ====================

@merge_bp.route('/api/merge/columns', methods=['GET'])
def get_merge_columns_api():
    """获取合并结果列定义"""
    return jsonify(get_merge_columns())


@merge_bp.route('/api/merge/columns', methods=['POST'])
def update_merge_columns():
    """更新合并结果列配置"""
    data = request.json
    with open(PathConfig.MERGE_COLUMNS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return jsonify({'success': True})


@merge_bp.route('/api/merge/assets', methods=['GET'])
def get_merge_assets():
    """获取合并结果列表（支持分页和搜索）- 优化版本"""
    conn = None
    try:
        page = int(request.args.get('page', 1))
        pageSize = int(request.args.get('pageSize', 50))
        search = request.args.get('search', '')
        category = request.args.get('category', '')

        MAX_PAGE_SIZE = 1000
        if pageSize > MAX_PAGE_SIZE:
            pageSize = MAX_PAGE_SIZE

        conn = get_merge_db_connection()
        cursor = conn.cursor()

        # 检查表结构
        column_names, use_json_format = _get_merge_table_schema(cursor)
        where_clauses, where_params = _build_merge_filter_sql(
            column_names,
            use_json_format,
            search=search,
            category=category
        )
        filtered_sql = 'FROM merge_results'
        if where_clauses:
            filtered_sql += ' WHERE ' + ' AND '.join(where_clauses)
        offset = (page - 1) * pageSize

        # 判断是旧格式（json_data）还是新格式（直接列）
        if use_json_format:
            # 旧格式：使用 json_data 列 - 优化版：服务端分页+搜索
            data = []
            cursor.execute(f'SELECT COUNT(*) as count {filtered_sql}', where_params)
            total = cursor.fetchone()['count']
            query = f'SELECT id, json_data {filtered_sql} ORDER BY id LIMIT ? OFFSET ?'
            cursor.execute(query, where_params + [pageSize, offset])
            rows = cursor.fetchall()

            # 解析JSON数据
            for row in rows:
                try:
                    json_data = json.loads(row['json_data'])
                    json_data['id'] = row['id']
                    data.append(json_data)
                except:
                    pass

            return jsonify({
                'data': data,
                'total': total,
                'page': page,
                'pageSize': pageSize
            })
        else:
            # 新格式：直接使用列结构（大文件导入器创建的格式）
            # 获取总数
            cursor.execute(f'SELECT COUNT(*) as count {filtered_sql}', where_params)
            total_count = cursor.fetchone()['count']

            # 获取列名（排除 id）
            data_columns = [col for col in column_names if col.lower() != 'id']
            columns_str = ', '.join([f'"{col}"' for col in column_names])
            query = f'SELECT {columns_str} {filtered_sql} ORDER BY id LIMIT ? OFFSET ?'
            cursor.execute(query, where_params + [pageSize, offset])
            rows = cursor.fetchall()

            # 转换为字典列表
            data = []
            for row in rows:
                row_dict = dict(row)
                data.append(row_dict)

            return jsonify({
                'data': data,
                'total': total_count,
                'page': page,
                'pageSize': pageSize
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'获取合并结果列表失败: {str(e)}',
            'data': [],
            'total': 0,
            'page': page if 'page' in locals() else 1,
            'pageSize': pageSize if 'pageSize' in locals() else 50
        }), 500
    finally:
        if conn:
            conn.close()


@merge_bp.route('/api/merge/source-name-stats', methods=['POST'])
def get_merge_source_name_stats():
    """统计合并结果中“数据源名称”列的值分布。"""
    try:
        payload = request.get_json(silent=True) or {}
        result = _collect_merge_source_name_stats(payload)
        return jsonify({'success': True, **result})
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@merge_bp.route('/api/merge/source-level-matrix', methods=['POST'])
def get_merge_source_level_matrix():
    """分布筛选功能已停用。"""
    return jsonify({
        'success': False,
        'error': '分布筛选功能已停用'
    }), 410


@merge_bp.route('/api/merge/export-sampling-config', methods=['GET'])
def get_merge_export_sampling_config():
    """导出精细筛选配置功能已停用。"""
    return jsonify({
        'success': False,
        'error': '导出精细筛选配置功能已停用'
    }), 410


@merge_bp.route('/api/merge/export-sampling-config', methods=['POST'])
def save_merge_export_sampling_config():
    """导出精细筛选配置功能已停用。"""
    return jsonify({
        'success': False,
        'error': '导出精细筛选配置功能已停用'
    }), 410


@merge_bp.route('/api/merge/source-name-stats/export', methods=['POST'])
def export_merge_source_name_stats():
    """导出“数据源名称”统计结果为 Excel。"""
    try:
        payload = request.get_json(silent=True) or {}
        result = _collect_merge_source_name_stats(payload)

        export_rows = [
            {
                '数据源名称': item['label'],
                '出现次数': item['count'],
                '是否空值': '是' if item['is_empty'] else '否',
                '更新标注': item.get('update_mode_label') or '未标注',
                '最近导入时间': item.get('last_import_time') or ''
            }
            for item in result['items']
        ]

        df = pd.DataFrame(
            export_rows,
            columns=['数据源名称', '出现次数', '是否空值', '更新标注', '最近导入时间']
        )
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='数据源名称统计')
        output.seek(0)

        filename = f'合并结果_数据源名称统计_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'

        try:
            log_op = get_log_operation()
            log_op(
                operation_type='data_export',
                page_type='merge',
                operation_desc='导出数据源名称统计',
                file_name=filename,
                record_count=len(export_rows)
            )
        except Exception as log_err:
            print(f'[日志记录失败] {log_err}')

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@merge_bp.route('/api/merge/source-name-cleaning/preview', methods=['POST'])
def preview_merge_source_name_cleaning():
    """预览“多余文字清洗”影响范围。"""
    try:
        payload = request.get_json(silent=True) or {}
        result = _collect_merge_source_name_cleaning_preview(payload)
        return jsonify({'success': True, **result})
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@merge_bp.route('/api/merge/source-name-cleaning/apply', methods=['POST'])
def apply_merge_source_name_cleaning():
    """执行“多余文字清洗”并写回 merge_results。"""
    try:
        payload = request.get_json(silent=True) or {}
        result = _apply_merge_source_name_cleaning(payload)

        try:
            log_op = get_log_operation()
            log_op(
                operation_type='data_update',
                page_type='merge',
                operation_desc='工具箱-多余文字清洗',
                file_name='merge_results.db',
                record_count=result.get('updated_count', 0)
            )
        except Exception as log_err:
            print(f'[日志记录失败] {log_err}')

        return jsonify({'success': True, **result})
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@merge_bp.route('/api/merge/assets/<int:asset_id>', methods=['GET'])
def get_merge_asset(asset_id):
    """获取单个合并结果"""
    conn = get_merge_db_connection()
    cursor = conn.cursor()
    cursor.execute('PRAGMA table_info(merge_results)')
    columns_info = cursor.fetchall()
    column_names = [col['name'] for col in columns_info]

    # 判断是旧格式（json_data）还是新格式（直接列）
    if 'json_data' in column_names and len(column_names) <= 3:
        # 旧格式：使用 json_data 列
        cursor.execute('SELECT * FROM merge_results WHERE id = ?', (asset_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            try:
                data = json.loads(row['json_data'])
                data['id'] = row['id']
                return jsonify(data)
            except:
                return jsonify({'error': '数据解析失败'}), 500
        return jsonify({'error': '未找到该记录'}), 404
    else:
        # 新格式：直接使用列结构
        cursor.execute('SELECT * FROM merge_results WHERE id = ?', (asset_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return jsonify(dict(row))
        return jsonify({'error': '未找到该记录'}), 404


@merge_bp.route('/api/merge/assets/<int:asset_id>', methods=['PUT'])
def update_merge_asset(asset_id):
    """更新合并结果"""
    data = request.json
    # 路由参数 asset_id 是唯一更新目标，body 中的 id 仅忽略，不允许覆盖路由参数
    if isinstance(data, dict):
        data.pop('id', None)

    conn = get_merge_db_connection()
    cursor = conn.cursor()
    cursor.execute('PRAGMA table_info(merge_results)')
    columns_info = cursor.fetchall()
    column_names = [col['name'] for col in columns_info]

    # 判断是旧格式（json_data）还是新格式（直接列）
    if 'json_data' in column_names and len(column_names) <= 3:
        # 旧格式：使用 json_data 列
        cursor.execute('UPDATE merge_results SET json_data = ? WHERE id = ?', (json.dumps(data, ensure_ascii=False), asset_id))
    else:
        # 新格式：直接更新各列
        # 构建UPDATE语句
        data_columns = [col for col in column_names if col.lower() != 'id']
        set_clause = ', '.join([f'"{col}" = ?' for col in data_columns])
        values = [data.get(col) for col in data_columns]
        cursor.execute(f'UPDATE merge_results SET {set_clause} WHERE id = ?', values + [asset_id])

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': '未找到该记录'}), 404

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': asset_id})


@merge_bp.route('/api/merge/assets/<int:asset_id>', methods=['DELETE'])
def delete_merge_asset(asset_id):
    """删除合并结果"""
    blocked_response = reject_cross_site_delete_request()
    if blocked_response:
        return blocked_response

    conn = get_merge_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM merge_results WHERE id = ?', (asset_id,))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': '未找到该记录'}), 404
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@merge_bp.route('/api/merge/assets', methods=['POST'])
def create_merge_asset():
    """创建新合并结果"""
    data = request.json
    asset_id = data.pop('id', None)

    conn = get_merge_db_connection()
    cursor = conn.cursor()
    cursor.execute('PRAGMA table_info(merge_results)')
    columns_info = cursor.fetchall()
    column_names = [col['name'] for col in columns_info]

    # 判断是旧格式（json_data）还是新格式（直接列）
    if 'json_data' in column_names and len(column_names) <= 3:
        # 旧格式：使用 json_data 列
        cursor.execute('INSERT INTO merge_results (json_data) VALUES (?)', (json.dumps(data, ensure_ascii=False),))
    else:
        # 新格式：直接插入各列
        data_columns = [col for col in column_names if col.lower() != 'id']
        col_names = ', '.join([f'"{col}"' for col in data_columns])
        placeholders = ', '.join(['?'] * len(data_columns))
        values = [data.get(col) for col in data_columns]
        cursor.execute(f'INSERT INTO merge_results ({col_names}) VALUES ({placeholders})', values)

    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': new_id})


@merge_bp.route('/api/merge/import', methods=['POST'])
def import_merge_file():
    """旧版导入接口已废弃，请使用 /api/import/merge/confirm。"""
    return jsonify({
        'success': False,
        'error': '旧版导入接口已废弃，请使用 /api/import/merge/confirm'
    }), 410


@merge_bp.route('/api/merge/import/progress', methods=['GET'])
def get_import_progress():
    """旧版导入进度接口已废弃，请使用 /api/import/merge/progress。"""
    return jsonify({
        'success': False,
        'error': '旧版导入进度接口已废弃，请使用 /api/import/merge/progress'
    }), 410


@merge_bp.route('/api/merge/export', methods=['GET'])
def export_merge_data():
    """导出合并结果到Excel"""
    conn = None
    try:
        conn = get_merge_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM merge_results ORDER BY id')
        rows = cursor.fetchall()

        if not rows:
            return jsonify({'error': '暂无数据'}), 400

        column_names, use_json_format = _get_merge_table_schema(cursor)

        # 解析数据
        data = []
        all_columns = set()
        if use_json_format:
            for row in rows:
                try:
                    row_data = json.loads(row['json_data'])
                    row_data['id'] = row['id']
                    data.append(row_data)
                    all_columns.update(row_data.keys())
                except:
                    pass
        else:
            for row in rows:
                row_data = dict(row)
                data.append(row_data)
                all_columns.update(row_data.keys())

        # 获取配置的列顺序
        config = get_merge_columns()
        config_columns = [col['name'] for col in config.get('columns', []) if col['visible']]
        if config_columns:
            columns = [c for c in config_columns if c in all_columns]
            remaining_columns = [c for c in all_columns if c not in columns]
            columns.extend(sorted(remaining_columns))
        else:
            columns = sorted(all_columns)

        if 'id' in columns:
            columns = ['id'] + [col for col in columns if col != 'id']

        # 构建DataFrame
        df_data = []
        for row in data:
            df_data.append({col: row.get(col, '') for col in columns})

        df = pd.DataFrame(df_data)

        # 导出
        filename = f'合并结果导出_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        df.to_excel(filename, index=False)

        # 记录操作日志
        try:
            log_op = get_log_operation()
            log_op(
                operation_type='data_export',
                page_type='merge',
                operation_desc='导出合并结果数据',
                file_name=filename,
                record_count=len(rows)
            )
        except Exception as log_err:
            print(f'[日志记录失败] {log_err}')

        return jsonify({'success': True, 'filename': filename})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


@merge_bp.route('/api/merge/stats', methods=['GET'])
def get_merge_stats():
    """获取合并结果统计信息"""
    conn = get_merge_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as total FROM merge_results')
    total = cursor.fetchone()['total']

    conn.close()

    return jsonify({
        'total': total
    })


# ==================== 新的导入API（支持历史版本管理）====================

@merge_bp.route('/api/import/merge/confirm', methods=['POST'])
def confirm_merge_import():
    """导入合并结果 Excel（支持全量追加与增量替换）。"""
    if 'file' not in request.files:
        return jsonify({'error': '未选择文件'}), 400

    file = request.files['file']
    file_name = os.path.basename(str(file.filename or '').strip())
    if not file_name:
        return jsonify({'error': '文件名不能为空'}), 400

    saved_file_path = ''
    should_cleanup_saved_file = False

    try:
        import time

        import_mode = _normalize_merge_import_mode(request.form.get('import_mode'))

        with merge_import_lock:
            if merge_import_progress.get('status') == 'running':
                return jsonify({'error': '已有导入任务正在执行，请等待完成'}), 400

        task_id = datetime.now().strftime('%Y%m%d%H%M%S%f')
        upload_dir = os.path.join(Config.BASE_DIR, 'DataFiles', 'merge_results')
        os.makedirs(upload_dir, exist_ok=True)
        safe_saved_name = f'{task_id}_{file_name}'
        saved_file_path = os.path.join(upload_dir, safe_saved_name)
        file.save(saved_file_path)
        should_cleanup_saved_file = True
        force_import = _is_force_import_requested()

        scan_result = _scan_merge_import_file(
            saved_file_path,
            strict_source=(import_mode == MERGE_IMPORT_MODE_INCREMENTAL)
        )
        imported_headers = scan_result.get('columns') or []
        preview_total_rows = int(scan_result.get('total_rows') or 0)
        upload_source_counts = scan_result.get('source_counts') or {}

        expected_headers = _get_merge_expected_headers()
        missing_columns, extra_columns = _compare_import_headers(imported_headers, expected_headers)
        warning_message = _build_merge_schema_warning(missing_columns, extra_columns) if (missing_columns or extra_columns) else ''

        incremental_analysis = None
        if import_mode == MERGE_IMPORT_MODE_INCREMENTAL:
            conn = None
            try:
                conn = get_merge_db_connection()
                cursor = conn.cursor()
                column_names, use_json_format = _get_merge_table_schema(cursor)
                existing_data_columns = _get_merge_data_columns(column_names)
                existing_source_column = _resolve_merge_source_column(
                    existing_data_columns,
                    strict=True
                )
                cursor.execute('SELECT COUNT(*) AS total FROM merge_results')
                existing_total_rows = int(cursor.fetchone()['total'] or 0)

                if use_json_format:
                    if existing_total_rows > 0:
                        return jsonify({
                            'success': False,
                            'error': '当前合并结果仍为旧版 json_data 结构且已有数据，请先重建为列式数据后再执行增量导入。'
                        }), 400
                    existing_source_column = ''
                    existing_source_counts = {}
                else:
                    if preview_total_rows > 0 and not upload_source_counts:
                        return jsonify({
                            'success': False,
                            'error': '增量导入未识别到“数据源名称”列，无法执行替换。'
                        }), 400
                    if existing_total_rows > 0 and not existing_source_column:
                        return jsonify({
                            'success': False,
                            'error': '当前合并结果缺少“数据源名称”列，无法执行增量替换。'
                        }), 400
                    _, existing_source_counts = _get_existing_source_counts(
                        cursor,
                        strict_source=True
                    )

                incremental_analysis = _build_incremental_import_analysis(
                    upload_source_counts,
                    existing_source_counts
                )
                incremental_analysis['source_column'] = existing_source_column or ''
                incremental_analysis['source_match_mode'] = 'exact_text'
            finally:
                if conn:
                    conn.close()

        requires_confirmation = _should_require_merge_import_confirmation(
            import_mode,
            missing_columns,
            extra_columns,
            incremental_analysis
        )

        if requires_confirmation and not force_import:
            return jsonify({
                'success': False,
                'requires_confirmation': True,
                'warning_type': 'merge_import_confirmation',
                'missing_columns': missing_columns,
                'extra_columns': extra_columns,
                'warning_message': warning_message,
                'import_mode': import_mode,
                'preview_total_rows': preview_total_rows,
                'incremental_analysis': incremental_analysis
            })

        with merge_import_lock:
            merge_import_progress.update({
                'status': 'reading',
                'current': 0,
                'total': 0,
                'message': '正在准备导入...',
                'error': '',
                'task_id': task_id
            })

        def do_merge_import(saved_path, original_file_name, current_task_id, selected_mode, scan_info):
            """后台导入 merge_results。"""
            start_time = time.time()
            conn = None
            workbook = None

            try:
                with merge_import_lock:
                    merge_import_progress.update({
                        'status': 'reading',
                        'message': '正在读取 Excel...',
                        'task_id': current_task_id
                    })

                workbook = load_workbook(filename=saved_path, read_only=True, data_only=True)
                worksheet = workbook.active
                row_iter = worksheet.iter_rows(values_only=True)
                header_row = next(row_iter, None)
                if not header_row:
                    raise ValueError('Excel 文件为空或缺少表头')

                columns = _sanitize_merge_import_columns(header_row)
                upload_source_column = _resolve_merge_source_column(
                    columns,
                    strict=(selected_mode == MERGE_IMPORT_MODE_INCREMENTAL)
                )
                scan_info = scan_info or {}
                estimated_total = int(scan_info.get('total_rows') or 0)
                if estimated_total <= 0:
                    estimated_total = max((worksheet.max_row or 1) - 1, 0)

                with merge_import_lock:
                    merge_import_progress.update({
                        'status': 'importing',
                        'current': 0,
                        'total': estimated_total,
                        'message': f'准备写入 {estimated_total:,} 行数据...',
                        'error': '',
                        'task_id': current_task_id
                    })

                conn = get_merge_db_connection()
                cursor = conn.cursor()
                cursor.execute('SELECT COUNT(*) AS total FROM merge_results')
                total_before = int(cursor.fetchone()['total'] or 0)

                cursor.execute('PRAGMA journal_mode = WAL')
                cursor.execute('PRAGMA synchronous = OFF')
                cursor.execute('PRAGMA temp_store = MEMORY')
                cursor.execute('PRAGMA cache_size = -300000')
                cursor.execute('PRAGMA mmap_size = 536870912')
                cursor.execute('PRAGMA locking_mode = EXCLUSIVE')
                existing_columns, use_json_format = _get_merge_table_schema(cursor)
                if use_json_format:
                    if total_before > 0:
                        raise ValueError('当前合并结果仍为旧版 json_data 结构且已有数据，请先重建为列式数据后再导入。')
                    _recreate_merge_results_table(cursor, columns)
                    conn.commit()
                    existing_columns, _ = _get_merge_table_schema(cursor)

                target_columns = _ensure_merge_table_columns(cursor, existing_columns, columns)
                conn.commit()

                target_source_column = _resolve_merge_source_column(
                    target_columns,
                    strict=(selected_mode == MERGE_IMPORT_MODE_INCREMENTAL)
                )
                uploaded_sources = sorted([
                    str(name).strip()
                    for name in (scan_info.get('source_counts') or {}).keys()
                    if str(name).strip()
                ])

                if selected_mode == MERGE_IMPORT_MODE_INCREMENTAL:
                    if not target_source_column:
                        raise ValueError('当前合并结果表中未找到“数据源名称”列，无法执行增量替换。')
                    if not uploaded_sources and estimated_total > 0:
                        raise ValueError('增量导入未识别到“数据源名称”，无法执行替换。')

                    delete_chunk_size = 400
                    for idx in range(0, len(uploaded_sources), delete_chunk_size):
                        chunk_sources = uploaded_sources[idx:idx + delete_chunk_size]
                        if not chunk_sources:
                            continue
                        placeholders = ', '.join(['?'] * len(chunk_sources))
                        cursor.execute(
                            f'''
                            DELETE FROM merge_results
                            WHERE COALESCE({_quote_sql_identifier(target_source_column)}, '') IN ({placeholders})
                            ''',
                            chunk_sources
                        )
                    conn.commit()

                quoted_columns = ', '.join([_quote_sql_identifier(col) for col in target_columns])
                placeholders = ', '.join(['?'] * len(target_columns))
                insert_sql = f'INSERT INTO merge_results ({quoted_columns}) VALUES ({placeholders})'

                batch_size = 10000
                commit_every_batches = 3
                pending_rows = []
                imported_rows = 0
                batches_since_commit = 0
                imported_source_counts = {}

                def flush_rows(force_commit=False):
                    nonlocal imported_rows, batches_since_commit
                    if not pending_rows:
                        return

                    row_count = len(pending_rows)
                    cursor.executemany(insert_sql, pending_rows)
                    pending_rows.clear()
                    imported_rows += row_count
                    batches_since_commit += 1

                    if force_commit or batches_since_commit >= commit_every_batches:
                        conn.commit()
                        batches_since_commit = 0

                    progress_total = max(estimated_total, imported_rows)
                    percent = round((imported_rows / progress_total) * 100, 1) if progress_total > 0 else 0
                    with merge_import_lock:
                        merge_import_progress.update({
                            'status': 'importing',
                            'current': imported_rows,
                            'total': progress_total,
                            'message': f'导入中... {percent}% ({imported_rows:,} / {progress_total:,})',
                            'task_id': current_task_id
                        })

                for raw_row in row_iter:
                    if not _is_effective_excel_row(raw_row):
                        continue

                    row_values = [
                        '' if value is None else (value if isinstance(value, str) else str(value))
                        for value in raw_row
                    ]

                    if len(row_values) < len(columns):
                        row_values.extend([''] * (len(columns) - len(row_values)))
                    elif len(row_values) > len(columns):
                        row_values = row_values[:len(columns)]

                    row_map = {
                        column_name: row_values[col_idx]
                        for col_idx, column_name in enumerate(columns)
                    }

                    if upload_source_column:
                        source_name = str(row_map.get(upload_source_column) or '').strip()
                        if source_name:
                            imported_source_counts[source_name] = imported_source_counts.get(source_name, 0) + 1

                    pending_rows.append(tuple(row_map.get(col, '') for col in target_columns))
                    if len(pending_rows) >= batch_size:
                        flush_rows()

                flush_rows(force_commit=True)

                elapsed_time = round(time.time() - start_time, 1)
                rows_per_sec = round(imported_rows / elapsed_time, 0) if elapsed_time > 0 else 0

                cursor.execute('SELECT COUNT(*) AS total FROM merge_results')
                total_after = int(cursor.fetchone()['total'] or 0)
                import_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                _record_merge_import_batch(
                    cursor,
                    current_task_id,
                    selected_mode,
                    original_file_name,
                    total_before,
                    total_after,
                    import_time
                )
                _upsert_merge_source_registry(
                    cursor,
                    imported_source_counts,
                    selected_mode,
                    current_task_id,
                    import_time
                )
                conn.commit()
                update_merge_columns_config(target_columns, original_file_name)

                try:
                    log_op = get_log_operation()
                    log_op(
                        operation_type='data_import',
                        page_type='merge',
                        operation_desc='导入合并结果数据（全量追加）' if selected_mode == MERGE_IMPORT_MODE_FULL else '导入合并结果数据（增量替换）',
                        file_name=original_file_name,
                        record_count=imported_rows
                    )
                except Exception as log_err:
                    print(f'[日志记录失败] {log_err}')

                with merge_import_lock:
                    merge_import_progress.update({
                        'status': 'completed',
                        'current': imported_rows,
                        'total': imported_rows,
                        'message': f'导入完成：{imported_rows:,} 行，耗时 {elapsed_time} 秒，速率 {rows_per_sec:,} 行/秒',
                        'error': '',
                        'task_id': current_task_id
                    })

            except Exception as e:
                import traceback
                traceback.print_exc()
                with merge_import_lock:
                    merge_import_progress.update({
                        'status': 'error',
                        'error': str(e),
                        'message': f'导入失败: {str(e)}',
                        'task_id': current_task_id
                    })
            finally:
                if workbook:
                    workbook.close()
                if conn:
                    conn.close()
                try:
                    if os.path.exists(saved_path):
                        os.remove(saved_path)
                except Exception as cleanup_err:
                    print(f'[临时文件清理失败] {cleanup_err}')

        thread = threading.Thread(
            target=do_merge_import,
            args=(saved_file_path, file_name, task_id, import_mode, scan_result)
        )
        thread.daemon = True
        thread.start()
        should_cleanup_saved_file = False

        return jsonify({
            'success': True,
            'started': True,
            'task_id': task_id,
            'message': '导入任务已启动，请查看进度',
            'import_mode': import_mode,
            'missing_columns': missing_columns,
            'extra_columns': extra_columns,
            'warning_message': warning_message,
            'incremental_analysis': incremental_analysis
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500
    finally:
        if should_cleanup_saved_file:
            _safe_remove_temp_file(saved_file_path)


@merge_bp.route('/api/import/merge/progress', methods=['GET'])
def get_merge_import_progress_api():
    """获取合并结果导入进度"""
    try:
        with merge_import_lock:
            return jsonify(dict(merge_import_progress))
    except:
        return jsonify({'status': 'idle', 'message': '无导入任务'})
