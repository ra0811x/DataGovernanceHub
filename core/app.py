#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""数管系统 Flask 主入口。"""

import os
import sys

from flask import Flask, send_from_directory

try:
    from flask_cors import CORS
except ModuleNotFoundError:
    CORS = None

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
WEB_ROOT = os.path.join(PROJECT_ROOT, 'web')
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config.config import Config, DatabaseConfig, init_config
from routes import register_all_blueprints


def init_merge_db():
    """初始化合并结果库。"""
    import sqlite3

    conn = sqlite3.connect(DatabaseConfig.MERGE_RESULTS_DB)
    cursor = conn.cursor()
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS merge_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            json_data TEXT
        )
        '''
    )
    conn.commit()
    conn.close()


def init_logs_db():
    """初始化系统日志库。"""
    import sqlite3

    os.makedirs(os.path.join(PROJECT_ROOT, 'data'), exist_ok=True)

    conn = sqlite3.connect(DatabaseConfig.LOGS_DB)
    cursor = conn.cursor()
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            operation_type TEXT NOT NULL,
            page_type TEXT NOT NULL,
            operation_desc TEXT,
            file_name TEXT,
            record_count INTEGER DEFAULT 0,
            user_name TEXT DEFAULT '系统',
            details TEXT
        )
        '''
    )
    cursor.execute(
        'CREATE INDEX IF NOT EXISTS idx_operation_time '
        'ON operation_logs(operation_time)'
    )
    cursor.execute(
        'CREATE INDEX IF NOT EXISTS idx_operation_type '
        'ON operation_logs(operation_type)'
    )
    cursor.execute(
        'CREATE INDEX IF NOT EXISTS idx_page_type '
        'ON operation_logs(page_type)'
    )
    conn.commit()
    conn.close()


def create_app(config_object=Config):
    """创建 Flask 应用实例。"""
    init_config()
    init_merge_db()
    init_logs_db()

    flask_app = Flask(__name__)
    flask_app.config.from_object(config_object)

    if flask_app.config.get('ENABLE_CORS'):
        if CORS is None:
            raise ModuleNotFoundError(
                "No module named 'flask_cors'. Install flask-cors or disable ENABLE_CORS."
            )
        cors_origins = flask_app.config.get('CORS_ORIGINS') or []
        CORS(
            flask_app,
            resources={
                r'/api/*': {
                    'origins': cors_origins
                }
            }
        )

    register_all_blueprints(flask_app)

    @flask_app.route('/js/<path:filename>')
    def serve_js(filename):
        return send_from_directory(os.path.join(PROJECT_ROOT, 'js'), filename)

    @flask_app.route('/css/<path:filename>')
    def serve_css(filename):
        return send_from_directory(os.path.join(PROJECT_ROOT, 'css'), filename)

    @flask_app.route(
        '/api/<path:filename>',
        methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    )
    def api_not_found(filename):
        return {'error': 'Not found'}, 404

    @flask_app.route('/<path:filename>')
    def serve_html(filename):
        if filename.endswith('.html'):
            return send_from_directory(WEB_ROOT, os.path.basename(filename))
        return {'error': 'Not found'}, 404

    @flask_app.route('/index_v3.html')
    def serve_index_v3():
        return send_from_directory(WEB_ROOT, 'index.html')

    @flask_app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404

    @flask_app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500

    return flask_app


app = create_app()


def main():
    """命令行启动入口。"""
    print('=' * 60)
    print('数管系统 - 后端服务')
    print('=' * 60)
    print(f'服务地址: http://127.0.0.1:{app.config["PORT"]}')
    print('按 Ctrl+C 停止服务')
    print('=' * 60)

    app.run(
        host=app.config['HOST'],
        port=app.config['PORT'],
        debug=app.config['DEBUG']
    )


if __name__ == '__main__':
    main()
