# -*- coding: utf-8 -*-
"""
条件规则管理 API 路由模块。
处理条件规则库的增删改查操作。
"""

import json
import os
import re
from datetime import datetime

from flask import Blueprint, Response, jsonify, request

from config.config import Config

# 创建 Blueprint
logic_rules_bp = Blueprint('logic_rules', __name__)

# 规则配置文件路径
LOGIC_RULES_FILE = os.path.join(Config.BASE_DIR, 'config', 'logic_rules.json')


def load_logic_rules():
    """加载条件规则配置。"""
    if not os.path.exists(LOGIC_RULES_FILE):
        return {'rules': {}}

    try:
        with open(LOGIC_RULES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'加载条件规则配置失败: {e}')
        return {'rules': {}}


def save_logic_rules(data):
    """保存条件规则配置。"""
    try:
        with open(LOGIC_RULES_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f'保存条件规则配置失败: {e}')
        return False


def _legacy_normalize_logic_rules_payload(payload, existing_data=None):
    """将导入数据归一化为 logic_rules.json 结构。"""
    if existing_data is None:
        existing_data = {}

    if isinstance(payload, dict) and isinstance(payload.get('data'), dict):
        payload = payload['data']

    rule_types_reference = existing_data.get('rule_types_reference', {})
    rules_source = payload

    if isinstance(payload, dict):
        if isinstance(payload.get('rule_types_reference'), dict):
            rule_types_reference = payload.get('rule_types_reference', {})
        if 'rules' in payload:
            rules_source = payload.get('rules')

    rules = {}

    if isinstance(rules_source, list):
        for item in rules_source:
            if not isinstance(item, dict):
                raise ValueError('规则列表中存在非法项')
            rule_id = item.get('id')
            if not rule_id:
                raise ValueError('导入规则缺少 id 字段')
            rules[rule_id] = item
    elif isinstance(rules_source, dict):
        if {'id', 'name', 'type'}.issubset(set(rules_source.keys())):
            rule_id = rules_source.get('id')
            if not rule_id:
                raise ValueError('导入规则缺少 id 字段')
            rules[rule_id] = rules_source
        else:
            for key, item in rules_source.items():
                if not isinstance(item, dict):
                    raise ValueError(f'规则 {key} 结构无效')
                rule = dict(item)
                rule.setdefault('id', key)
                rules[rule['id']] = rule
    else:
        raise ValueError('导入文件必须是 JSON 对象或数组')

    return {
        'rule_types_reference': rule_types_reference,
        'rules': rules
    }


def normalize_logic_rules_payload(payload, existing_data=None):
    """将导入数据规范化为 logic_rules.json 结构。"""
    if existing_data is None:
        existing_data = {}

    if isinstance(payload, dict) and isinstance(payload.get('data'), dict):
        payload = payload['data']

    rule_types_reference = existing_data.get('rule_types_reference', {})
    rules_source = payload

    if isinstance(payload, dict):
        if isinstance(payload.get('rule_types_reference'), dict):
            rule_types_reference = payload.get('rule_types_reference', {})
        if 'rules' in payload:
            rules_source = payload.get('rules')

    rules = {}

    if isinstance(rules_source, list):
        for item in rules_source:
            if not isinstance(item, dict):
                raise ValueError('规则列表中存在非法项')
            rule_id = item.get('id')
            if not rule_id:
                raise ValueError('导入规则缺少 id 字段')
            rules[rule_id] = item
    elif isinstance(rules_source, dict):
        if {'id', 'name', 'type'}.issubset(set(rules_source.keys())):
            rule_id = rules_source.get('id')
            if not rule_id:
                raise ValueError('导入规则缺少 id 字段')
            rules[rule_id] = rules_source
        else:
            for key, item in rules_source.items():
                if not isinstance(item, dict):
                    raise ValueError(f'规则 {key} 结构无效')
                rule = dict(item)
                rule.setdefault('id', key)
                rules[rule['id']] = rule
    else:
        raise ValueError('导入文件必须是 JSON 对象或数组')

    return {
        'rule_types_reference': rule_types_reference,
        'rules': rules
    }


def _match_rule_value(field_value, match_value, is_regex=False, operator='contains'):
    """统一处理测试接口中的匹配逻辑。"""
    field_text = str(field_value)
    match_text = str(match_value)

    if is_regex:
        return re.search(match_text, field_text) is not None

    if operator == 'startswith':
        return field_text.startswith(match_text)

    return match_text in field_text


@logic_rules_bp.route('/api/logic-rules', methods=['GET'])
def get_logic_rules():
    """获取所有条件规则和规则类型参考。"""
    try:
        data = load_logic_rules()
        rules_list = list(data.get('rules', {}).values())
        rule_types_reference = data.get('rule_types_reference', {})

        return jsonify({
            'success': True,
            'data': {
                'rules': rules_list,
                'rule_types_reference': rule_types_reference,
                'total': len(rules_list)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules/<rule_id>', methods=['GET'])
def get_logic_rule(rule_id):
    """获取单个条件规则。"""
    try:
        data = load_logic_rules()
        rules = data.get('rules', {})

        if rule_id not in rules:
            return jsonify({'success': False, 'error': f'规则不存在: {rule_id}'}), 404

        return jsonify({
            'success': True,
            'data': rules[rule_id]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules', methods=['POST'])
def create_logic_rule():
    """创建新的条件规则。"""
    try:
        rule_data = request.get_json()

        required_fields = ['name', 'type', 'source_field']
        for field in required_fields:
            if field not in rule_data:
                return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400

        rule_id = rule_data.get('id') or f"rule_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        data = load_logic_rules()

        if rule_id in data.get('rules', {}):
            return jsonify({'success': False, 'error': f'规则ID已存在: {rule_id}'}), 400

        now = datetime.now().strftime('%Y-%m-%d')
        rule_data['id'] = rule_id
        rule_data['created_at'] = now
        rule_data['updated_at'] = now
        rule_data['usage_count'] = 0
        rule_data['used_in'] = rule_data.get('used_in', [])

        if 'rules' not in data:
            data['rules'] = {}
        data['rules'][rule_id] = rule_data

        if save_logic_rules(data):
            return jsonify({
                'success': True,
                'data': {'rule_id': rule_id, 'rule': rule_data}
            })
        return jsonify({'success': False, 'error': '保存失败'}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules/<rule_id>', methods=['PUT'])
def update_logic_rule(rule_id):
    """更新条件规则。"""
    try:
        rule_data = request.get_json()
        data = load_logic_rules()
        rules = data.get('rules', {})

        if rule_id not in rules:
            return jsonify({'success': False, 'error': f'规则不存在: {rule_id}'}), 404

        existing_rule = rules[rule_id]
        existing_rule.update(rule_data)
        existing_rule['updated_at'] = datetime.now().strftime('%Y-%m-%d')

        if save_logic_rules(data):
            return jsonify({
                'success': True,
                'data': {'rule_id': rule_id, 'rule': existing_rule}
            })
        return jsonify({'success': False, 'error': '保存失败'}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules/<rule_id>', methods=['DELETE'])
def delete_logic_rule(rule_id):
    """删除条件规则。"""
    try:
        data = load_logic_rules()
        rules = data.get('rules', {})

        if rule_id not in rules:
            return jsonify({'success': False, 'error': f'规则不存在: {rule_id}'}), 404

        rule = rules[rule_id]
        if rule.get('usage_count', 0) > 0:
            return jsonify({
                'success': False,
                'error': f'规则正在被使用，使用次数: {rule["usage_count"]}，无法删除'
            }), 400

        del rules[rule_id]

        if save_logic_rules(data):
            return jsonify({
                'success': True,
                'data': {'deleted_rule_id': rule_id}
            })
        return jsonify({'success': False, 'error': '保存失败'}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules/export', methods=['GET'])
def export_logic_rules():
    """导出条件规则配置。"""
    try:
        data = load_logic_rules()
        filename = f"logic_rules_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        content = json.dumps(data, ensure_ascii=False, indent=2)
        return Response(
            content,
            mimetype='application/json; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules/import', methods=['POST'])
def import_logic_rules():
    """导入条件规则配置。"""
    try:
        if 'file' in request.files:
            upload = request.files['file']
            if not upload or not upload.filename:
                return jsonify({'success': False, 'error': '请选择要导入的 JSON 文件'}), 400
            payload = json.loads(upload.read().decode('utf-8-sig'))
        else:
            payload = request.get_json(silent=True)

        if payload is None:
            return jsonify({'success': False, 'error': '未接收到可导入的规则数据'}), 400

        normalized = normalize_logic_rules_payload(payload, load_logic_rules())
        if save_logic_rules(normalized):
            return jsonify({
                'success': True,
                'data': {
                    'imported_count': len(normalized.get('rules', {}))
                }
            })
        return jsonify({'success': False, 'error': '保存失败'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'success': False, 'error': f'JSON 格式错误: {e}'}), 400
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@logic_rules_bp.route('/api/logic-rules/test', methods=['POST'])
def test_logic_rule():
    """测试条件规则。"""
    try:
        test_data = request.get_json()
        rule = test_data.get('rule')
        test_value = test_data.get('test_value', '')
        test_values = test_data.get('test_values')

        if not rule:
            return jsonify({'success': False, 'error': '缺少规则数据'}), 400

        result = None
        rule_type = rule.get('type')

        if rule_type == 'conditional':
            # 单字段条件判断
            conditions = rule.get('conditions', [])
            default_value = rule.get('default', '')
            match_mode = rule.get('match_mode', 'contains')

            for condition in conditions:
                match_value = condition.get('match', '')
                is_regex = condition.get('regex', False)
                operator = condition.get('operator', match_mode)
                if _match_rule_value(test_value, match_value, is_regex, operator):
                    result = condition.get('result')
                    break

            if result is None:
                result = default_value

        elif rule_type == 'multi_conditional':
            # 多字段条件判断：需要传入 test_values，支持 dict 或 list
            conditions = rule.get('conditions', [])
            logic = rule.get('logic', 'AND')
            default_value = rule.get('default', '')
            result_value = rule.get('result', '')

            if not isinstance(test_values, (dict, list)):
                result = '多字段条件测试需要 test_values（对象或数组）'
            else:
                condition_results = []
                for idx, condition in enumerate(conditions):
                    field_index = condition.get('field_index', idx)
                    match_value = condition.get('match', '')
                    is_regex = condition.get('regex', False)
                    operator = condition.get('operator', 'contains')

                    if isinstance(test_values, list):
                        try:
                            field_value = test_values[int(field_index)]
                        except (ValueError, IndexError, TypeError):
                            field_value = ''
                    else:
                        field_value = test_values.get(str(field_index), test_values.get(field_index, ''))

                    condition_results.append(
                        _match_rule_value(field_value, match_value, is_regex, operator)
                    )

                if logic == 'AND':
                    result = result_value if all(condition_results) else default_value
                else:
                    result = result_value if any(condition_results) else default_value

        elif rule_type == 'conditional_groups':
            groups = rule.get('groups', [])
            group_logic = rule.get('group_logic', 'OR')
            default_value = rule.get('default', '')

            if not isinstance(test_values, (dict, list)):
                result = '条件组测试需要 test_values（对象或数组）'
            else:
                result = default_value
                for group in groups:
                    condition_results = []
                    for idx, condition in enumerate(group.get('conditions', [])):
                        field_index = condition.get('field_index', idx)
                        match_value = condition.get('match', '')
                        is_regex = condition.get('regex', False)
                        operator = condition.get('operator', 'contains')

                        if isinstance(test_values, list):
                            try:
                                field_value = test_values[int(field_index)]
                            except (ValueError, IndexError, TypeError):
                                field_value = ''
                        else:
                            field_value = test_values.get(str(field_index), test_values.get(field_index, ''))

                        condition_results.append(
                            _match_rule_value(field_value, match_value, is_regex, operator)
                        )

                    group_met = all(condition_results)
                    if group_met:
                        result = group.get('result', '')
                        if group_logic == 'OR':
                            break
                    elif group_logic == 'AND':
                        result = default_value
                        break

        else:
            result = f'当前规则类型暂不支持测试：{rule_type}'

        return jsonify({
            'success': True,
            'data': {
                'test_value': test_value,
                'result': result
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
