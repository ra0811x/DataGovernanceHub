#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
路由注册入口。
统一维护 Blueprint 导入与注册顺序，降低 app.py 的耦合。
"""

from routes.routes_asset_name_mapping import asset_name_mapping_bp
from routes.routes_business_system_mapping import business_system_name_mapping_bp
from routes.routes_common import common_bp
from routes.routes_common_custom_reports import common_custom_reports_bp
from routes.routes_common_mapping import common_mapping_bp
from routes.routes_common_public_configs import common_public_configs_bp
from routes.routes_data_process import data_process_bp
from routes.routes_data_sample import data_sample_bp
from routes.routes_device import device_bp
from routes.routes_export import export_bp
from routes.routes_logic_rules import logic_rules_bp
from routes.routes_logs import logs_bp
from routes.routes_merge import merge_bp
from routes.routes_modes import modes_bp


def register_all_blueprints(flask_app):
    """按既定顺序注册所有业务 Blueprint。"""
    flask_app.register_blueprint(device_bp)
    flask_app.register_blueprint(merge_bp)
    flask_app.register_blueprint(export_bp)
    flask_app.register_blueprint(modes_bp)
    flask_app.register_blueprint(logs_bp)
    flask_app.register_blueprint(common_bp)
    flask_app.register_blueprint(common_mapping_bp)
    flask_app.register_blueprint(common_public_configs_bp)
    flask_app.register_blueprint(common_custom_reports_bp)
    flask_app.register_blueprint(logic_rules_bp)
    flask_app.register_blueprint(data_sample_bp)
    flask_app.register_blueprint(business_system_name_mapping_bp)
    flask_app.register_blueprint(asset_name_mapping_bp)
    flask_app.register_blueprint(data_process_bp)
