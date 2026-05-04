#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
设备管理路由模块
处理资产信息的 CRUD 操作
"""
from urllib.parse import urlparse

from flask import Blueprint, jsonify, request
from config.config import DatabaseConfig, PathConfig
import json
import sqlite3

ASSET_ID_COLUMN = 'id'


def get_db_connection():
    """获取 assets.db 数据库连接。"""
    conn = sqlite3.connect(DatabaseConfig.ASSETS_DB)
    conn.row_factory = sqlite3.Row
    return conn


device_bp = Blueprint('device', __name__)


def get_columns():
    """读取数据概览列配置，兼容平铺结构与按模式分组结构。"""
    try:
        with open(PathConfig.ASSETS_COLUMNS_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                default_config = data.get('全部')
                if isinstance(default_config, dict):
                    return default_config
                if isinstance(data.get('columns'), list):
                    return data
            return {'columns': []}
    except Exception:
        return {'columns': []}


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


@device_bp.route('/api/assets', methods=['GET'])
def get_assets():
    """获取资产列表。"""
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('pageSize', 50))
    search = request.args.get('search', '')
    system = request.args.get('system', '')
    resource = request.args.get('resource', '')
    request.args.get('category', '')

    try:
        from core.utils import ensure_database_and_table

        ensure_database_and_table(
            DatabaseConfig.ASSETS_DB,
            'assets',
            '''CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT
            )'''
        )

        where_conditions = []
        params = []
        column_list = get_columns().get('columns', [])

        if search and column_list:
            where_conditions.append(
                '(' + ' OR '.join([f'"{col["name"]}" LIKE ?' for col in column_list]) + ')'
            )
            params.extend([f'%{search}%'] * len(column_list))

        if system:
            where_conditions.append('"业务系统" = ?')
            params.append(system)

        if resource:
            where_conditions.append('"系统资源类型" = ?')
            params.append(resource)

        where_sql = ' WHERE ' + ' AND '.join(where_conditions) if where_conditions else ''

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(f'SELECT COUNT(*) as total FROM assets{where_sql}', params)
        total = cursor.fetchone()['total']

        offset = (page - 1) * page_size
        sequence_is_numeric_sql = (
            '"序号" IS NOT NULL AND TRIM("序号") != \'\' '
            'AND TRIM("序号") NOT GLOB \'*[^0-9]*\''
        )
        data_sql = (
            f'SELECT * FROM assets{where_sql} '
            f'ORDER BY CASE WHEN {sequence_is_numeric_sql} THEN 0 ELSE 1 END, '
            f'CASE WHEN {sequence_is_numeric_sql} THEN CAST(TRIM("序号") AS INTEGER) END, '
            '"序号", id LIMIT ? OFFSET ?'
        )
        cursor.execute(data_sql, params + [page_size, offset])
        rows = cursor.fetchall()
        conn.close()

        return jsonify({
            'data': [dict(row) for row in rows],
            'total': total,
            'page': page,
            'pageSize': page_size
        })
    except Exception as e:
        return jsonify({
            'error': f'获取资产列表失败: {str(e)}',
            'data': [],
            'total': 0,
            'page': page,
            'pageSize': page_size
        }), 500


@device_bp.route('/api/assets/<int:asset_id>', methods=['GET'])
def get_asset(asset_id):
    """获取单个资产。"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f'SELECT * FROM assets WHERE "{ASSET_ID_COLUMN}" = ?', (asset_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return jsonify(dict(row))
    return jsonify({'error': '未找到该资产'}), 404


@device_bp.route('/api/assets/<int:asset_id>', methods=['PUT'])
def update_asset(asset_id):
    """更新资产。"""
    data = request.json
    columns = get_columns().get('columns', [])

    set_clause = ', '.join([f'"{col["name"]}" = ?' for col in columns])
    values = [data.get(col['name'], '') for col in columns]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f'UPDATE assets SET {set_clause} WHERE "{ASSET_ID_COLUMN}" = ?',
        values + [asset_id]
    )
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': asset_id})


@device_bp.route('/api/assets/<int:asset_id>', methods=['DELETE'])
def delete_asset(asset_id):
    """删除资产。"""
    blocked_response = reject_cross_site_delete_request()
    if blocked_response:
        return blocked_response

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f'DELETE FROM assets WHERE "{ASSET_ID_COLUMN}" = ?', (asset_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@device_bp.route('/api/assets', methods=['POST'])
def create_asset():
    """创建新资产。"""
    data = request.json
    columns = get_columns().get('columns', [])

    col_names = ', '.join([f'"{col["name"]}"' for col in columns])
    placeholders = ', '.join(['?'] * len(columns))
    values = [data.get(col['name'], '') for col in columns]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f'INSERT INTO assets ({col_names}) VALUES ({placeholders})', values)
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': new_id})
