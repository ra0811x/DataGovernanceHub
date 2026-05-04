#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
日志管理路由模块
记录和查询系统操作日志
"""
import csv
import io
from urllib.parse import quote

from flask import Blueprint, request, jsonify, Response
from datetime import datetime
import sqlite3
import os

# 导入配置
from config.config import DatabaseConfig

# 创建Blueprint
logs_bp = Blueprint('logs', __name__)


def get_logs_db_connection():
    """获取日志数据库连接"""
    conn = sqlite3.connect(DatabaseConfig.LOGS_DB)
    conn.row_factory = sqlite3.Row
    return conn


def build_log_filters(args):
    operation_type = args.get('operationType')
    page_type = args.get('pageType')
    start_date = args.get('startDate')
    end_date = args.get('endDate')

    where_conditions = []
    params = []

    if operation_type:
        where_conditions.append('operation_type = ?')
        params.append(operation_type)

    if page_type:
        where_conditions.append('page_type = ?')
        params.append(page_type)

    if start_date:
        where_conditions.append("DATE(operation_time, 'localtime') >= ?")
        params.append(start_date)

    if end_date:
        where_conditions.append("DATE(operation_time, 'localtime') <= ?")
        params.append(end_date)

    where_sql = ' WHERE ' + ' AND '.join(where_conditions) if where_conditions else ''
    return where_sql, params


def log_operation(operation_type, page_type, operation_desc='', file_name='', record_count=0, details=''):
    """
    记录操作日志

    参数:
    - operation_type: 操作类型 (data_import, data_export, data_switch, data_process, file_manage, settings_update, etc.)
    - page_type: 页面类型 (device, database, reporting, report, dataProcess, settings)
    - operation_desc: 操作描述
    - file_name: 相关文件名
    - record_count: 记录数量
    - details: 详细信息
    """
    try:
        conn = get_logs_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO operation_logs
            (operation_type, page_type, operation_desc, file_name, record_count, details)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (operation_type, page_type, operation_desc, file_name, record_count, details))

        conn.commit()
        conn.close()
    except Exception as e:
        print(f'[日志记录失败] {str(e)}')


@logs_bp.route('/api/logs', methods=['GET'])
def get_operation_logs():
    """获取操作日志列表"""
    page = int(request.args.get('page', 1))
    pageSize = int(request.args.get('pageSize', 50))

    conn = get_logs_db_connection()
    cursor = conn.cursor()
    where_sql, params = build_log_filters(request.args)

    # 获取总数
    cursor.execute(f'SELECT COUNT(*) as total FROM operation_logs{where_sql}', params)
    total = cursor.fetchone()['total']

    # 获取分页数据
    offset = (page - 1) * pageSize
    cursor.execute(f'''
        SELECT * FROM operation_logs{where_sql}
        ORDER BY operation_time DESC
        LIMIT ? OFFSET ?
    ''', params + [pageSize, offset])

    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'data': logs,
        'total': total,
        'page': page,
        'pageSize': pageSize
    })


@logs_bp.route('/api/logs/<int:log_id>', methods=['GET'])
def get_operation_log_detail(log_id):
    """获取单条操作日志详情"""
    conn = get_logs_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM operation_logs WHERE id = ?', (log_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({'success': False, 'error': '日志不存在'}), 404

    return jsonify(dict(row))


@logs_bp.route('/api/logs/stats', methods=['GET'])
def get_logs_stats():
    """获取日志统计信息"""
    conn = get_logs_db_connection()
    cursor = conn.cursor()

    try:
        # 总操作数
        cursor.execute('SELECT COUNT(*) as total FROM operation_logs')
        total = cursor.fetchone()['total']

        # 今日操作数
        cursor.execute('''
            SELECT COUNT(*) as today_total
            FROM operation_logs
            WHERE DATE(operation_time, 'localtime') = DATE('now', 'localtime')
        ''')
        today_total = cursor.fetchone()['today_total']

        # 按操作类型统计
        cursor.execute('''
            SELECT operation_type, COUNT(*) as count
            FROM operation_logs
            GROUP BY operation_type
            ORDER BY count DESC
        ''')
        by_type = [dict(row) for row in cursor.fetchall()]

        # 按页面类型统计
        cursor.execute('''
            SELECT page_type, COUNT(*) as count
            FROM operation_logs
            GROUP BY page_type
            ORDER BY count DESC
        ''')
        by_page_type = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return jsonify({
            'total': total,
            'today_total': today_total,
            'by_type': by_type,
            'by_page_type': by_page_type
        })
    except Exception as e:
        conn.close()
        return jsonify({
            'total': 0,
            'today_total': 0,
            'by_type': [],
            'by_page_type': []
        })


@logs_bp.route('/api/logs/export', methods=['GET'])
def export_logs():
    """导出操作日志 CSV"""
    conn = get_logs_db_connection()
    cursor = conn.cursor()
    where_sql, params = build_log_filters(request.args)
    cursor.execute(f'''
        SELECT operation_time, operation_type, page_type, operation_desc, file_name, record_count, user_name, details
        FROM operation_logs{where_sql}
        ORDER BY operation_time DESC
    ''', params)
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'operation_time',
        'operation_type',
        'page_type',
        'operation_desc',
        'file_name',
        'record_count',
        'user_name',
        'details'
    ])

    for row in rows:
        writer.writerow([
            row['operation_time'],
            row['operation_type'],
            row['page_type'],
            row['operation_desc'],
            row['file_name'],
            row['record_count'],
            row['user_name'],
            row['details']
        ])

    filename = f'logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    csv_content = '\ufeff' + output.getvalue()
    response = Response(csv_content, mimetype='text/csv; charset=utf-8')
    response.headers['Content-Disposition'] = (
        f"attachment; filename*=UTF-8''{quote(filename)}"
    )
    return response


@logs_bp.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    """清空所有日志"""
    try:
        conn = get_logs_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM operation_logs')
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': '日志已清空'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
