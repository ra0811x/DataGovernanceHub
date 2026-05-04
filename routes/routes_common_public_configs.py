#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
公共配置中心路由模块
将 public-configs 与 dynamic-config-query 相关接口从 routes_common 拆分。
"""

from flask import Blueprint

from routes import routes_common as common_routes

common_public_configs_bp = Blueprint('common_public_configs', __name__)


@common_public_configs_bp.route('/api/public-configs', methods=['GET'])
def get_public_configs():
    return common_routes.get_public_configs()


@common_public_configs_bp.route('/api/public-configs/types', methods=['GET'])
def get_public_config_types():
    return common_routes.get_public_config_types()


@common_public_configs_bp.route('/api/public-configs/types', methods=['POST'])
def create_public_config_type():
    return common_routes.create_public_config_type()


@common_public_configs_bp.route('/api/public-configs/types/<config_key>', methods=['PUT'])
def update_public_config_type(config_key):
    return common_routes.update_public_config_type(config_key)


@common_public_configs_bp.route('/api/public-configs/<config_key>/records', methods=['GET', 'POST'])
def handle_public_config_records(config_key):
    return common_routes.handle_public_config_records(config_key)


@common_public_configs_bp.route('/api/public-configs/<config_key>/records/<int:record_id>', methods=['PUT', 'DELETE'])
def handle_public_config_record_item(config_key, record_id):
    return common_routes.handle_public_config_record_item(config_key, record_id)


@common_public_configs_bp.route('/api/public-configs/<config_key>/import', methods=['POST'])
def import_public_config_records(config_key):
    return common_routes.import_public_config_records(config_key)


@common_public_configs_bp.route('/api/public-configs/<config_key>/export', methods=['GET'])
def export_public_config_records(config_key):
    return common_routes.export_public_config_records(config_key)


@common_public_configs_bp.route('/api/public-configs/<config_key>/template', methods=['GET'])
def download_public_config_template(config_key):
    return common_routes.download_public_config_template(config_key)


@common_public_configs_bp.route('/api/public-configs-center/definitions', methods=['GET'])
def get_public_config_center_definitions():
    return common_routes.get_public_config_center_definitions()


@common_public_configs_bp.route('/api/public-configs-center/bindings', methods=['GET'])
def get_public_config_center_bindings():
    return common_routes.get_public_config_center_bindings()


@common_public_configs_bp.route('/api/dynamic-config-query/definitions', methods=['GET'])
def get_dynamic_config_query_definitions():
    return common_routes.get_dynamic_config_query_definitions()


@common_public_configs_bp.route('/api/dynamic-config-query/definitions', methods=['POST'])
def save_dynamic_config_query_definitions():
    return common_routes.save_dynamic_config_query_definitions()


@common_public_configs_bp.route('/api/public-configs/business-system-name-mappings/save', methods=['POST'])
def save_business_system_name_mapping():
    return common_routes.save_business_system_name_mapping()
