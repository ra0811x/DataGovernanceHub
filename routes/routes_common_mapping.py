#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
映射配置路由模块
将 mapping-config 相关接口从 routes_common 拆分到独立 Blueprint。
"""

from flask import Blueprint

from routes import routes_common as common_routes

common_mapping_bp = Blueprint('common_mapping', __name__)


@common_mapping_bp.route('/api/mapping-config', methods=['GET'])
def get_mapping_config():
    return common_routes.get_mapping_config()


@common_mapping_bp.route('/api/mapping-config/<category>/<report_code>/package', methods=['GET'])
def export_report_mapping_package(category, report_code):
    return common_routes.export_report_mapping_package(category, report_code)


@common_mapping_bp.route('/api/mapping-config/<category>/<report_code>/package', methods=['POST'])
def import_report_mapping_package(category, report_code):
    return common_routes.import_report_mapping_package(category, report_code)


@common_mapping_bp.route('/api/mapping-config/<category>/<report_code>', methods=['GET'])
def get_report_mapping_config(category, report_code):
    return common_routes.get_report_mapping_config(category, report_code)


@common_mapping_bp.route('/api/mapping-config/<category>/<report_code>', methods=['POST'])
def update_report_mapping_config(category, report_code):
    return common_routes.update_report_mapping_config(category, report_code)


@common_mapping_bp.route('/api/mapping-config/<category>/<report_code>', methods=['PUT'])
def add_report_mapping_config(category, report_code):
    return common_routes.add_report_mapping_config(category, report_code)


@common_mapping_bp.route('/api/mapping-config/<category>/<report_code>', methods=['DELETE'])
def delete_report_mapping_config(category, report_code):
    return common_routes.delete_report_mapping_config(category, report_code)


@common_mapping_bp.route('/api/mapping-config/analyze-template', methods=['POST'])
def analyze_template_file():
    return common_routes.analyze_template_file()


@common_mapping_bp.route('/api/mapping-config/template-diff', methods=['POST'])
def diff_template_file():
    return common_routes.diff_template_file()
