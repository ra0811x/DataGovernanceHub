#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
模式管理路由模块
处理页面显示模式的CRUD操作
"""
from flask import Blueprint, request, jsonify
import sqlite3
import os

from config.config import DatabaseConfig, Config

# 创建Blueprint
modes_bp = Blueprint('modes', __name__)

# 模式数据库路径
MODES_DB = os.path.join(Config.BASE_DIR, 'data', 'modes.db')


def get_modes_db_connection():
    """获取模式数据库连接"""
    # 确保数据库和表存在
    conn = sqlite3.connect(MODES_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 创建 modes 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS modes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_type TEXT NOT NULL,
            mode_key TEXT,
            mode_name TEXT NOT NULL,
            mode_color TEXT DEFAULT '#495057',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn


def get_log_operation():
    """延迟导入系统日志写入函数"""
    from routes.routes_logs import log_operation as logs_log_operation
    return logs_log_operation


def log_operation(operation_type, operation_desc, page_type=None, file_name=None, record_count=None, user_notes=None, details=None):
    """兼容模式管理现有调用，并写入系统日志库"""
    try:
        logs_log_operation = get_log_operation()
        logs_log_operation(
            operation_type=operation_type,
            page_type=page_type or 'settings',
            operation_desc=operation_desc,
            file_name=file_name or '',
            record_count=record_count or 0,
            details=details or ''
        )
    except Exception as e:
        print(f'[日志记录失败] {e}')


def _get_modes_by_page_type(page_type):
    """按页面类型查询模式列表（内部复用）"""
    if page_type not in ['device', 'merge']:
        return jsonify({'error': '无效的页面类型'}), 400

    conn = get_modes_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, page_type, mode_key, mode_name, mode_color, notes, created_at
        FROM modes
        WHERE page_type = ?
        ORDER BY id ASC
    ''', (page_type,))
    modes = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'modes': modes})


@modes_bp.route('/api/modes', methods=['GET'])
def get_modes_by_query():
    """兼容前端：通过 query 参数获取模式列表（/api/modes?page_type=device）"""
    page_type = request.args.get('page_type', 'device')
    return _get_modes_by_page_type(page_type)


@modes_bp.route('/api/modes/<page_type>', methods=['GET'])
def get_modes(page_type):
    """获取指定页面的所有模式（/api/modes/device 或 /api/modes/merge）"""
    return _get_modes_by_page_type(page_type)


@modes_bp.route('/api/modes/<int:mode_id>', methods=['GET'])
def get_mode(mode_id):
    """获取单个模式详情（兼容前端 getById）"""
    conn = get_modes_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, page_type, mode_key, mode_name, mode_color, notes, created_at FROM modes WHERE id = ?', (mode_id,))
    mode = cursor.fetchone()
    conn.close()

    if not mode:
        return jsonify({'error': '模式不存在'}), 404

    return jsonify(dict(mode))


@modes_bp.route('/api/modes', methods=['POST'])
def create_mode():
    """创建新模式"""
    data = request.json
    page_type = data.get('page_type')
    mode_key = data.get('mode_key', '').strip()
    mode_name = data.get('mode_name', '').strip()
    mode_color = data.get('mode_color', '#495057')
    notes = data.get('notes', '')

    if not page_type or page_type not in ['device', 'merge']:
        return jsonify({'error': '无效的页面类型'}), 400
    if not mode_name:
        return jsonify({'error': '模式名称不能为空'}), 400

    conn = get_modes_db_connection()
    cursor = conn.cursor()

    # 检查mode_key是否重复
    if mode_key:
        cursor.execute('SELECT id FROM modes WHERE page_type = ? AND mode_key = ?', (page_type, mode_key))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': '模式标识已存在'}), 400

    try:
        cursor.execute('''
            INSERT INTO modes (page_type, mode_key, mode_name, mode_color, notes)
            VALUES (?, ?, ?, ?, ?)
        ''', (page_type, mode_key, mode_name, mode_color, notes))
        mode_id = cursor.lastrowid
        conn.commit()
        conn.close()

        # 记录操作日志
        log_operation(
            'settings_update',
            f'创建模式: {mode_name}',
            page_type=page_type,
            details=f'模式标识: {mode_key or "全部"}'
        )

        return jsonify({'success': True, 'id': mode_id})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@modes_bp.route('/api/modes/<int:mode_id>', methods=['PUT'])
def update_mode(mode_id):
    """更新模式信息"""
    data = request.json
    mode_name = data.get('mode_name', '').strip()
    mode_color = data.get('mode_color', '#495057')
    notes = data.get('notes', '')

    if not mode_name:
        return jsonify({'error': '模式名称不能为空'}), 400

    conn = get_modes_db_connection()
    cursor = conn.cursor()

    # 获取原模式信息
    cursor.execute('SELECT * FROM modes WHERE id = ?', (mode_id,))
    mode = cursor.fetchone()
    if not mode:
        conn.close()
        return jsonify({'error': '模式不存在'}), 404

    try:
        cursor.execute('''
            UPDATE modes
            SET mode_name = ?, mode_color = ?, notes = ?
            WHERE id = ?
        ''', (mode_name, mode_color, notes, mode_id))
        conn.commit()
        conn.close()

        # 记录操作日志
        log_operation(
            'settings_update',
            f'更新模式: {mode_name}',
            page_type=mode['page_type']
        )

        return jsonify({'success': True})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@modes_bp.route('/api/modes/<int:mode_id>', methods=['DELETE'])
def delete_mode(mode_id):
    """删除模式"""
    conn = get_modes_db_connection()
    cursor = conn.cursor()

    # 获取模式信息
    cursor.execute('SELECT * FROM modes WHERE id = ?', (mode_id,))
    mode = cursor.fetchone()

    if not mode:
        conn.close()
        return jsonify({'error': '模式不存在'}), 404

    try:
        cursor.execute('DELETE FROM modes WHERE id = ?', (mode_id,))
        conn.commit()
        conn.close()

        # 记录操作日志
        log_operation(
            'settings_update',
            f'删除模式: {mode["mode_name"]}',
            page_type=mode['page_type']
        )

        return jsonify({'success': True})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500
