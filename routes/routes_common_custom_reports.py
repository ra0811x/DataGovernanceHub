#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
自定义报表路由模块
将 custom-reports 相关接口从 routes_common 拆分到独立 Blueprint。
"""

from flask import Blueprint

from routes import routes_common as common_routes

common_custom_reports_bp = Blueprint('common_custom_reports', __name__)


@common_custom_reports_bp.route('/api/custom-reports', methods=['GET'])
def get_custom_reports():
    return common_routes.get_custom_reports()


@common_custom_reports_bp.route('/api/custom-reports', methods=['POST'])
def save_custom_report():
    return common_routes.save_custom_report()


@common_custom_reports_bp.route('/api/report-settings', methods=['POST'])
def save_report_settings():
    return common_routes.save_report_settings()


@common_custom_reports_bp.route('/api/custom-reports/copy', methods=['POST'])
def copy_custom_report():
    return common_routes.copy_custom_report()


@common_custom_reports_bp.route('/api/custom-reports/<category>/<code>', methods=['DELETE'])
def delete_custom_report(category, code):
    return common_routes.delete_custom_report(category, code)
