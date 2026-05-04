# -*- coding: utf-8 -*-
"""
业务系统名称映射公共配置路由。
"""
from datetime import datetime
from io import BytesIO
import json
import os

import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side


business_system_name_mapping_bp = Blueprint(
    'business_system_name_mapping',
    __name__
)

CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'config',
    'business_system_name_mapping.json'
)
API_BASE = '/api/public-configs/business-system-name-mappings'
MAPPING_SHEET_NAME = '公共配置'
SOURCE_COLUMN = '原名称（合并结果表）'
TARGET_COLUMN = '目标名称（数据概览表）'
ENABLED_COLUMN = '是否启用'


def _default_payload():
    return {
        'name': '公共配置',
        'description': '用于将合并结果表中的业务系统名称转换为数据概览表中的标准名称',
        'version': '1.0',
        'last_updated': datetime.now().strftime('%Y-%m-%d'),
        'total_count': 0,
        'mappings': []
    }


def load_mappings():
    """读取公共配置文件。"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        if isinstance(data, dict):
            payload = _default_payload()
            payload.update(data)
            payload['name'] = '公共配置'
            payload['description'] = '用于将合并结果表中的业务系统名称转换为数据概览表中的标准名称'
            payload['mappings'] = data.get('mappings', [])
            payload['total_count'] = len(payload['mappings'])
            return payload
    except Exception:
        pass

    return _default_payload()


def save_mappings(data):
    """保存公共配置文件。"""
    try:
        payload = _default_payload()
        if isinstance(data, dict):
            payload.update(data)
        payload['name'] = '公共配置'
        payload['description'] = '用于将合并结果表中的业务系统名称转换为数据概览表中的标准名称'
        payload['last_updated'] = datetime.now().strftime('%Y-%m-%d')
        payload['total_count'] = len(payload.get('mappings', []))

        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f'保存公共配置失败: {e}')
        return False


def _excel_header_style(cell):
    cell.font = Font(bold=True, size=11, color='FFFFFF')
    cell.fill = PatternFill(
        start_color='4472C4',
        end_color='4472C4',
        fill_type='solid'
    )
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )


def _excel_body_style(cell, center=False):
    cell.alignment = Alignment(
        horizontal='center' if center else 'general',
        vertical='center'
    )
    cell.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )



def _create_excel_output():
    return BytesIO()


@business_system_name_mapping_bp.route(API_BASE, methods=['GET'])
def get_mappings():
    """获取全部业务系统名称映射。"""
    try:
        return jsonify({
            'success': True,
            'data': load_mappings()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@business_system_name_mapping_bp.route(API_BASE, methods=['POST'])
def add_mapping():
    """新增映射。"""
    try:
        req_data = request.get_json() or {}
        data = load_mappings()

        max_id = max([m.get('id', 0) for m in data.get('mappings', [])], default=0)
        new_mapping = {
            'id': max_id + 1,
            'source': req_data.get('source', ''),
            'target': req_data.get('target', ''),
            'enabled': req_data.get('enabled', True)
        }
        data['mappings'].append(new_mapping)

        if not save_mappings(data):
            return jsonify({'success': False, 'error': '保存失败'}), 500

        return jsonify({
            'success': True,
            'data': new_mapping,
            'message': '添加成功'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@business_system_name_mapping_bp.route(f'{API_BASE}/<int:mapping_id>', methods=['PUT'])
def update_mapping(mapping_id):
    """更新映射。"""
    try:
        req_data = request.get_json() or {}
        data = load_mappings()

        for mapping in data.get('mappings', []):
            if mapping.get('id') == mapping_id:
                mapping['source'] = req_data.get('source', mapping.get('source', ''))
                mapping['target'] = req_data.get('target', mapping.get('target', ''))
                mapping['enabled'] = req_data.get('enabled', mapping.get('enabled', True))
                break
        else:
            return jsonify({'success': False, 'error': '映射不存在'}), 404

        if not save_mappings(data):
            return jsonify({'success': False, 'error': '保存失败'}), 500

        return jsonify({'success': True, 'message': '更新成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@business_system_name_mapping_bp.route(f'{API_BASE}/<int:mapping_id>', methods=['DELETE'])
def delete_mapping(mapping_id):
    """删除映射。"""
    try:
        data = load_mappings()
        mappings = data.get('mappings', [])
        original_count = len(mappings)
        data['mappings'] = [m for m in mappings if m.get('id') != mapping_id]

        if len(data['mappings']) == original_count:
            return jsonify({'success': False, 'error': '映射不存在或删除失败'}), 404

        if not save_mappings(data):
            return jsonify({'success': False, 'error': '保存失败'}), 500

        return jsonify({'success': True, 'message': '删除成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@business_system_name_mapping_bp.route(f'{API_BASE}/batch', methods=['POST'])
def batch_import():
    """批量新增映射。"""
    try:
        req_data = request.get_json() or {}
        mappings = req_data.get('mappings', [])
        data = load_mappings()

        max_id = max([m.get('id', 0) for m in data.get('mappings', [])], default=0)
        imported_count = 0

        for mapping_data in mappings:
            max_id += 1
            data['mappings'].append({
                'id': max_id,
                'source': mapping_data.get('source', ''),
                'target': mapping_data.get('target', ''),
                'enabled': mapping_data.get('enabled', True)
            })
            imported_count += 1

        if not save_mappings(data):
            return jsonify({'success': False, 'error': '保存失败'}), 500

        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'message': f'成功导入{imported_count}条映射'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@business_system_name_mapping_bp.route(f'{API_BASE}/export', methods=['GET'])
def export_mappings():
    """导出映射为 Excel 文件。"""
    try:
        data = load_mappings()
        mappings = data.get('mappings', [])
        df = pd.DataFrame({
            SOURCE_COLUMN: [m.get('source', '') for m in mappings],
            TARGET_COLUMN: [m.get('target', '') for m in mappings],
            ENABLED_COLUMN: ['是' if m.get('enabled', True) else '否' for m in mappings]
        })

        filename = f'公共配置_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        output = _create_excel_output()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=MAPPING_SHEET_NAME)
            worksheet = writer.sheets[MAPPING_SHEET_NAME]

            worksheet.column_dimensions['A'].width = 40
            worksheet.column_dimensions['B'].width = 50
            worksheet.column_dimensions['C'].width = 12

            for cell in worksheet[1]:
                _excel_header_style(cell)

            for row in worksheet.iter_rows(min_row=2, max_row=worksheet.max_row):
                for cell in row:
                    _excel_body_style(cell, center=(cell.column == 3))

            worksheet.row_dimensions[1].height = 25

        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@business_system_name_mapping_bp.route(f'{API_BASE}/import', methods=['POST'])
def import_mappings():
    """从 Excel 导入映射。"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '未找到上传文件'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'success': False, 'error': '未选择文件'}), 400
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'success': False, 'error': '仅支持Excel文件（.xlsx或.xls）'}), 400

        file.stream.seek(0)
        df = pd.read_excel(file.stream, engine='openpyxl')

        required_columns = [SOURCE_COLUMN, TARGET_COLUMN]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({
                'success': False,
                'error': f'Excel文件缺少必需的列: {", ".join(missing_columns)}'
            }), 400

        data = load_mappings()
        existing_mappings = data.get('mappings', [])
        max_id = max([m.get('id', 0) for m in existing_mappings], default=0)

        imported_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                source = str(row.get(SOURCE_COLUMN, '')).strip()
                target = str(row.get(TARGET_COLUMN, '')).strip()
                enabled_str = str(row.get(ENABLED_COLUMN, '是')).strip()
                enabled = enabled_str in ('是', 'True', 'true', '1')

                if not source or source == 'nan':
                    skipped_count += 1
                    continue

                existing = next(
                    (m for m in existing_mappings if str(m.get('source', '')).strip() == source),
                    None
                )

                if existing:
                    existing['target'] = target
                    existing['enabled'] = enabled
                    updated_count += 1
                else:
                    max_id += 1
                    existing_mappings.append({
                        'id': max_id,
                        'source': source,
                        'target': target,
                        'enabled': enabled
                    })
                    imported_count += 1
            except Exception as e:
                errors.append(f'第{idx + 2}行处理失败: {str(e)}')

        data['mappings'] = existing_mappings
        if not save_mappings(data):
            return jsonify({'success': False, 'error': '保存失败'}), 500

        response_data = {
            'success': True,
            'imported_count': imported_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'total_count': len(existing_mappings),
            'message': f'导入成功：新增{imported_count}条，更新{updated_count}条，跳过{skipped_count}条'
        }
        if errors:
            response_data['errors'] = errors[:10]
            response_data['message'] += f'，另有{len(errors)}个错误'

        return jsonify(response_data)
    except Exception as e:
        return jsonify({'success': False, 'error': f'导入失败: {str(e)}'}), 500


@business_system_name_mapping_bp.route(f'{API_BASE}/template', methods=['GET'])
def download_template():
    """下载导入模板。"""
    try:
        df = pd.DataFrame({
            SOURCE_COLUMN: [],
            TARGET_COLUMN: [],
            ENABLED_COLUMN: []
        })
        filename = '公共配置_导入模板.xlsx'
        output = _create_excel_output()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=MAPPING_SHEET_NAME)
            workbook = writer.book
            worksheet = writer.sheets[MAPPING_SHEET_NAME]

            worksheet.column_dimensions['A'].width = 40
            worksheet.column_dimensions['B'].width = 50
            worksheet.column_dimensions['C'].width = 12

            for cell in worksheet[1]:
                _excel_header_style(cell)

            example_data = [
                ['4A系统', '中国移动湖北公司业务支撑系统4A安全管理平台', '是'],
                ['RUEI新库', '网厅系统', '是'],
                ['安全系统', '数据安全管控平台', '是']
            ]
            for row_idx, row_data in enumerate(example_data, start=2):
                for col_idx, cell_value in enumerate(row_data, start=1):
                    cell = worksheet.cell(row=row_idx, column=col_idx, value=cell_value)
                    _excel_body_style(cell, center=(col_idx == 3))

            info_sheet = workbook.create_sheet('填写说明')
            instructions = [
                ['公共配置导入模板填写说明'],
                [''],
                ['1. 模板用途'],
                ['   本模板用于批量维护业务系统名称映射公共配置。'],
                ['   原名称填合并结果表中的业务系统名称，目标名称填数据概览表中的标准名称。'],
                [''],
                ['2. 填写规范'],
                ['   原名称（合并结果表）：必填。'],
                ['   目标名称（数据概览表）：必填。'],
                ['   是否启用：可选，填写“是”或“否”，默认按“是”处理。'],
                [''],
                ['3. 导入行为'],
                ['   同名原名称会更新原有记录。'],
                ['   新原名称会新增为新的映射记录。'],
                ['   空原名称会被跳过。']
            ]

            for row_idx, row_data in enumerate(instructions, start=1):
                for col_idx, cell_value in enumerate(row_data, start=1):
                    cell = info_sheet.cell(row=row_idx, column=col_idx, value=cell_value)
                    cell.font = Font(bold=(row_idx == 1), size=14 if row_idx == 1 else 11)
                    info_sheet.column_dimensions[chr(64 + col_idx)].width = 80

        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
