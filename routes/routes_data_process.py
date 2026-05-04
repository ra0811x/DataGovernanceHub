"""
数据处理路由模块
提供一键处理（批量清洗并合并）功能的API接口

目录结构:
temp_data_process/
├── logs/                    # 操作日志
└── allinone/               # 一键处理结果
"""

from flask import Blueprint, request, jsonify, send_file
import os
import zipfile
import shutil
import time
import logging
import re
import json
from datetime import datetime, time as datetime_time
from werkzeug.utils import secure_filename
import threading
import uuid

data_process_bp = Blueprint('data_process', __name__)


def get_log_operation():
    """延迟导入日志记录函数"""
    from routes.routes_logs import log_operation
    return log_operation

# ==================== 目录配置 ====================
ROUTES_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(ROUTES_DIR)
BASE_DIR = os.path.join(PROJECT_ROOT, 'temp_data_process')
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
ALLINONE_DIR = os.path.join(BASE_DIR, 'allinone')
SPLIT_DIR = os.path.join(BASE_DIR, 'split')
CSV_DIR = os.path.join(BASE_DIR, 'csv')
DEDUP_DIR = os.path.join(BASE_DIR, 'dedup')
SGEXPORT_DIR = 'SGExportFiles'

# 创建所有目录
for dir_path in [LOGS_DIR, ALLINONE_DIR, SPLIT_DIR, CSV_DIR, DEDUP_DIR]:
    os.makedirs(dir_path, exist_ok=True)

# ==================== 日志配置 ====================
def setup_logger():
    """配置日志记录器"""
    logger = logging.getLogger('data_process')
    logger.setLevel(logging.INFO)

    # 避免重复添加handler
    if not logger.handlers:
        # 日志格式
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # 文件handler - 按日期分割
        log_file = os.path.join(LOGS_DIR, f'data_process_{datetime.now().strftime("%Y%m%d")}.log')
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        # 控制台handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger

# 初始化日志记录器
logger = setup_logger()

# ==================== 进度跟踪 ====================
# 存储处理进度的字典
progress_store = {}
progress_lock = threading.Lock()
LOG_PHASE_LABELS = {
    'start': '已启动',
    'success': '已完成',
    'failure': '失败'
}


def merge_log_details(*parts):
    values = []
    for part in parts:
        text = str(part or '').strip()
        if text:
            values.append(text)
    return '；'.join(values)


def set_task_log_context(task_id, operation_desc, file_name='', details=''):
    with progress_lock:
        existing = progress_store.get(task_id, {})
        timestamp = existing.get('timestamp', time.time())
        started_at = existing.get('started_at', timestamp)
        progress_store[task_id] = {
            **existing,
            'timestamp': timestamp,
            'started_at': started_at,
            'log_context': {
                'operation_desc': str(operation_desc or '').strip(),
                'file_name': str(file_name or '').strip(),
                'details': str(details or '').strip()
            },
            'log_flags': dict(existing.get('log_flags') or {})
        }


def log_task_event(task_id, phase, file_name='', record_count=0, details=''):
    if phase not in LOG_PHASE_LABELS:
        raise ValueError(f'不支持的日志阶段: {phase}')

    with progress_lock:
        task_progress = progress_store.get(task_id, {})
        log_context = task_progress.get('log_context') or {}
        operation_desc = str(log_context.get('operation_desc') or '').strip()
        if not operation_desc:
            return False

        log_flags = task_progress.setdefault('log_flags', {})
        if log_flags.get(phase):
            return False
        log_flags[phase] = True

        resolved_file_name = str(file_name or log_context.get('file_name') or '').strip()
        resolved_details = merge_log_details(log_context.get('details'), details)

    try:
        log_operation = get_log_operation()
        log_operation(
            operation_type='data_process',
            page_type='dataProcess',
            operation_desc=f'{operation_desc}-{LOG_PHASE_LABELS[phase]}',
            file_name=resolved_file_name,
            record_count=int(record_count or 0),
            details=resolved_details
        )
        return True
    except Exception as log_err:
        with progress_lock:
            task_progress = progress_store.get(task_id, {})
            log_flags = task_progress.get('log_flags')
            if isinstance(log_flags, dict):
                log_flags.pop(phase, None)
        logger.warning(f"[日志记录失败] {log_err}")
        return False


def update_progress(task_id, percent, message, detail='', preserve_result=False):
    """更新处理进度

    Args:
        task_id: 任务ID
        percent: 进度百分比
        message: 进度消息
        detail: 详细信息
        preserve_result: 是否保留已有的result字段（用于中间进度更新）
    """
    with progress_lock:
        # 保留已有的result字段（如果preserve_result为True）
        existing = progress_store.get(task_id, {})
        progress_store[task_id] = {
            'percent': percent,
            'message': message,
            'detail': detail,
            'timestamp': time.time(),
            'started_at': existing.get('started_at', existing.get('timestamp', time.time()))
        }
        # 如果要求保留且已有result字段，保留它
        if preserve_result and 'result' in existing:
            progress_store[task_id]['result'] = existing['result']
        for key in ('log_context', 'log_flags'):
            if key in existing:
                progress_store[task_id][key] = existing[key]


def get_progress(task_id):
    """获取处理进度"""
    with progress_lock:
        progress = progress_store.get(task_id, {'percent': 0, 'message': '未开始', 'detail': ''})
        # 调试日志：检查result是否正确保存
        if progress.get('percent') == 100 or progress.get('message', '').startswith('处理完成'):
            logger.info(f"[get_progress] task_id={task_id}, percent={progress.get('percent')}, message={progress.get('message')}, has_result={('result' in progress)}")
            if 'result' in progress and progress['result']:
                result = progress['result']
                logger.info(f"[get_progress] result.final_rows={result.get('final_rows')}, result.total_zips={result.get('total_zips')}, result.total_excel_files={result.get('total_excel_files')}")
        return progress


def build_missing_task_progress(task_id):
    error_message = f'任务不存在或已过期: {task_id}'
    return {
        'percent': 100,
        'message': '处理失败',
        'detail': error_message,
        'result': build_failed_result(error_message)
    }


def get_task_elapsed_time(task_id):
    with progress_lock:
        task_progress = progress_store.get(task_id, {})
        started_at = task_progress.get('started_at', task_progress.get('timestamp'))

    if not started_at:
        return 0
    return round(max(0, time.time() - started_at), 2)


def is_runtime_log_filename(filename):
    safe_name = os.path.basename(str(filename or ''))
    return safe_name.startswith('data_process_') and safe_name.endswith('.log')


def normalize_directory_path(raw_path):
    """规范化目录路径，兼容复制为路径时携带的首尾引号。"""
    dir_path = str(raw_path or '').strip()
    if not dir_path:
        return ''

    for quote in ('"', "'"):
        if dir_path.startswith(quote):
            dir_path = dir_path[1:].strip()
        if dir_path.endswith(quote):
            dir_path = dir_path[:-1].strip()

    return os.path.normpath(dir_path) if dir_path else ''


def sanitize_output_stem(raw_name, fallback='处理结果'):
    """规范化输出文件名主体，保留中文并去掉非法字符与常见扩展名。"""
    name = re.sub(r'[\\/:*?"<>|]+', '_', str(raw_name or '').strip())
    name = re.sub(r'\.(xlsx|xls|json|zip)$', '', name, flags=re.IGNORECASE)
    return name.strip(' ._') or fallback


def validate_target_column_index(raw_value):
    """校验目标列索引，GUI 与 API 共用 0 基列索引规则。"""
    try:
        value = int(str(raw_value).strip())
    except Exception as exc:
        raise ValueError('目标列索引必须是整数') from exc

    if value < 0:
        raise ValueError('目标列索引必须大于等于 0')
    if value > 16383:
        raise ValueError('目标列索引超出 Excel 列范围')
    return value


def build_allinone_output_names(output_dir, output_name):
    """为一键处理结果和统计文件生成不覆盖旧文件的安全文件名。"""
    base_name = sanitize_output_stem(output_name, '合并结果表')
    candidate = base_name
    suffix = 2

    while True:
        output_filename = f'{candidate}.xlsx'
        stats_filename = f'{candidate}_stats.json'
        output_path = os.path.join(output_dir, output_filename)
        stats_path = os.path.join(output_dir, stats_filename)
        if not os.path.exists(output_path) and not os.path.exists(stats_path):
            return candidate, output_filename, stats_filename
        candidate = f'{base_name}_{suffix}'
        suffix += 1


def normalize_selected_files(raw_selected_files):
    """规范化选中的相对路径列表，兼容 JSON 字符串或单个字符串。"""
    if raw_selected_files in (None, '', []):
        return []

    selected_files = raw_selected_files
    if isinstance(selected_files, str):
        text = selected_files.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                selected_files = parsed
            elif parsed is None:
                selected_files = []
            else:
                selected_files = [str(parsed).strip()]
        except Exception:
            selected_files = [text]
    elif not isinstance(selected_files, (list, tuple, set)):
        raise ValueError('selectedFiles 格式不正确')

    normalized = []
    for item in selected_files:
        if item is None:
            continue
        rel_path = str(item).strip()
        if rel_path:
            normalized.append(rel_path)
    return normalized


def is_excel_file_candidate(filename, allow_extensions=('.xlsx', '.xls')):
    """判断文件是否为可处理的 Excel 文件。"""
    return filename.lower().endswith(allow_extensions) and not filename.startswith('~')


def sanitize_download_filename(filename):
    """规范化下载文件名，并阻止路径穿越。"""
    raw_filename = str(filename or '')
    safe_filename = os.path.basename(raw_filename)
    if safe_filename != raw_filename or safe_filename in ('', '.', '..'):
        raise ValueError('无效文件名')
    return safe_filename


def resolve_download_path(base_dir, filename):
    """解析下载文件路径，确保文件名安全。"""
    safe_filename = sanitize_download_filename(filename)
    return os.path.join(base_dir, safe_filename), safe_filename


def build_relative_output_stem(source_path, base_dir):
    """基于相对路径生成稳定的输出名主体，避免同名文件互相覆盖。"""
    try:
        rel_path = os.path.relpath(source_path, base_dir)
    except Exception:
        rel_path = os.path.basename(source_path)

    rel_stem = os.path.splitext(rel_path)[0].replace('/', '__').replace('\\', '__')
    rel_stem = re.sub(r'[\\/:*?"<>|]+', '_', rel_stem).strip(' ._')
    if rel_stem:
        return rel_stem
    fallback = os.path.splitext(os.path.basename(source_path))[0]
    return re.sub(r'[\\/:*?"<>|]+', '_', fallback).strip(' ._') or '文件'


def make_unique_name(candidate_name, used_names):
    """为输出文件名或前缀去重，避免覆盖已有结果。"""
    if candidate_name not in used_names:
        used_names.add(candidate_name)
        return candidate_name

    stem, ext = os.path.splitext(candidate_name)
    index = 2
    while True:
        unique_name = f'{stem}_{index}{ext}'
        if unique_name not in used_names:
            used_names.add(unique_name)
            return unique_name
        index += 1


def build_failed_result(error_message, **extra_fields):
    """构造统一的失败结果结构。"""
    result = {'success': False, 'error': error_message}
    result.update(extra_fields)
    return result


def fail_task(task_id, error_message, **extra_fields):
    """统一写入失败进度和结果。"""
    update_progress(task_id, 100, '处理失败', error_message)
    with progress_lock:
        progress_store[task_id]['result'] = build_failed_result(error_message, **extra_fields)
    log_task_event(task_id, 'failure', details=error_message)


def get_excel_read_engine(file_path):
    """根据扩展名选择 Excel 读取引擎。"""
    extension = os.path.splitext(str(file_path or ''))[1].lower()
    return 'xlrd' if extension == '.xls' else 'openpyxl'


def convert_xlrd_cell_value(workbook, sheet, row_idx, col_idx):
    value = sheet.cell_value(row_idx, col_idx)

    cell_type = getattr(sheet, 'cell_type', None)
    if not callable(cell_type):
        return value

    import xlrd

    if cell_type(row_idx, col_idx) != xlrd.XL_CELL_DATE:
        return value

    try:
        year, month, day, hour, minute, second = xlrd.xldate.xldate_as_tuple(
            value,
            getattr(workbook, 'datemode', 0),
        )
    except Exception:
        return value

    if (year, month, day) == (0, 0, 0):
        return datetime_time(hour, minute, second)
    if (hour, minute, second) == (0, 0, 0):
        return datetime(year, month, day)
    return datetime(year, month, day, hour, minute, second)


def read_excel_sheet_for_split(source_path):
    """读取首个工作表，兼容 .xlsx 与 .xls。"""
    extension = os.path.splitext(str(source_path or ''))[1].lower()

    if extension == '.xls':
        import xlrd

        workbook = xlrd.open_workbook(source_path, on_demand=True)
        try:
            sheet = workbook.sheet_by_index(0)
            max_row = sheet.nrows or 0
            max_col = sheet.ncols or 0
            rows = [
                [convert_xlrd_cell_value(workbook, sheet, row_idx, col_idx) for col_idx in range(max_col)]
                for row_idx in range(max_row)
            ]
            return sheet.name or 'Sheet1', max_row, max_col, rows
        finally:
            release_resources = getattr(workbook, 'release_resources', None)
            if callable(release_resources):
                release_resources()

    from openpyxl import load_workbook

    workbook = load_workbook(source_path, data_only=True)
    try:
        worksheet = workbook.active
        max_row = worksheet.max_row or 0
        max_col = worksheet.max_column or 0
        rows = [
            [worksheet.cell(row=row_idx, column=col_idx).value for col_idx in range(1, max_col + 1)]
            for row_idx in range(1, max_row + 1)
        ]
        return worksheet.title or 'Sheet1', max_row, max_col, rows
    finally:
        close = getattr(workbook, 'close', None)
        if callable(close):
            close()


def collect_excel_files(dir_path, selected_files=None, allow_extensions=('.xlsx', '.xls')):
    """收集目录下 Excel 文件，支持按相对路径精确筛选。"""
    normalized_dir_path = normalize_directory_path(dir_path)
    if not normalized_dir_path:
        return []

    base_dir = os.path.realpath(normalized_dir_path)
    normalized_selected_files = normalize_selected_files(selected_files)
    excel_files = []
    seen = set()

    if not normalized_selected_files:
        for root, _, filenames in os.walk(base_dir):
            for filename in filenames:
                if not is_excel_file_candidate(filename, allow_extensions):
                    continue
                full_path = os.path.join(root, filename)
                if full_path not in seen:
                    seen.add(full_path)
                    excel_files.append(full_path)
        excel_files.sort()
        return excel_files

    for rel_path in normalized_selected_files:
        rel_path = rel_path.replace('/', os.sep).replace('\\', os.sep)
        normalized_rel_path = os.path.normpath(rel_path)

        if normalized_rel_path in ('', '.'):
            continue
        if os.path.isabs(rel_path) or os.path.isabs(normalized_rel_path):
            raise ValueError(f'selectedFiles 包含绝对路径: {rel_path}')

        full_path = os.path.realpath(os.path.join(base_dir, normalized_rel_path))
        try:
            if os.path.commonpath([base_dir, full_path]) != base_dir:
                raise ValueError(f'selectedFiles 超出目录范围: {rel_path}')
        except ValueError:
            raise ValueError(f'selectedFiles 超出目录范围: {rel_path}')

        filename = os.path.basename(full_path)
        if not is_excel_file_candidate(filename, allow_extensions):
            continue
        if not os.path.isfile(full_path):
            continue
        if full_path not in seen:
            seen.add(full_path)
            excel_files.append(full_path)

    excel_files.sort()
    return excel_files


def clean_old_progress():
    """清理旧的进度记录（超过4小时）"""
    current_time = time.time()
    with progress_lock:
        to_remove = []
        for task_id, data in progress_store.items():
            if current_time - data['timestamp'] > 14400:
                to_remove.append(task_id)
        for task_id in to_remove:
            del progress_store[task_id]


# ==================== API路由 ====================

@data_process_bp.route('/api/data-process/all-in-one', methods=['POST'])
def all_in_one():
    """
    一键处理 - 批量清洗并合并
    异步处理：立即返回task_id，后台线程处理
    """
    task_id = str(uuid.uuid4())

    try:
        files = request.files.getlist('files')
        target_column = validate_target_column_index(request.form.get('targetColumn', 7))
        output_name = sanitize_output_stem(request.form.get('outputName', '合并结果表'), '合并结果表')

        if not files or len(files) == 0:
            return jsonify({'success': False, 'error': '未选择压缩包'})

        for file in files:
            if not file.filename.lower().endswith('.zip'):
                return jsonify({'success': False, 'error': f'文件 {file.filename} 不是ZIP格式'})

        logger.info(f"[all-in-one] Task received: {len(files)} ZIPs, col: {target_column}, output: {output_name}, task_id: {task_id}")

        # 保存文件到临时目录
        temp_dir = os.path.join(BASE_DIR, f'upload_{task_id}')
        os.makedirs(temp_dir, exist_ok=True)

        saved_files = []
        for idx, file in enumerate(files):
            temp_path = os.path.join(temp_dir, f'{idx}_{secure_filename(file.filename)}')
            file.save(temp_path)
            saved_files.append(temp_path)

        set_task_log_context(
            task_id,
            '一键处理-批量清洗并合并',
            file_name=output_name,
            details=merge_log_details(
                f'ZIP 文件数: {len(files)}',
                f'目标列: {target_column}'
            )
        )
        log_task_event(task_id, 'start')
        update_progress(task_id, 2, 'Files saved', f'{len(files)} ZIP files')

        # 后台线程处理
        def process_in_background():
            result = None
            try:
                # 创建简单的文件包装类
                class SavedFile:
                    def __init__(self, path, filename):
                        self.path = path
                        self.filename = filename
                        self.name = filename

                    def save(self, dst):
                        shutil.copy(self.path, dst)

                processing_files = []
                for path in saved_files:
                    filename = os.path.basename(path)
                    # 移除前缀
                    if filename.startswith('_'):
                        filename = filename.split('_', 1)[1]
                    processing_files.append(SavedFile(path, filename))

                logger.info(f"[all-in-one] Starting background processing of {len(processing_files)} files")

                result = process_all_in_one(processing_files, target_column, output_name, ALLINONE_DIR, task_id)
                if not result or not result.get('success'):
                    fail_task(task_id, (result or {}).get('error') or '处理失败')
                    return

                # 清理临时文件
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(f"[all-in-one] Cleaned temp directory: {temp_dir}")
                except Exception as cleanup_err:
                    logger.warning(f"[all-in-one] Failed to clean temp dir: {cleanup_err}")

            except Exception as e:
                logger.error(f"[all-in-one] Background task error: {str(e)}", exc_info=True)
                fail_task(task_id, (result or {}).get('error') or str(e))
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass

        thread = threading.Thread(target=process_in_background, daemon=True)
        thread.start()
        logger.info(f"[all-in-one] Background thread started, task_id: {task_id}")

        # 立即返回
        return jsonify({
            'success': True,
            'task_id': task_id,
            'message': 'Task created'
        })

    except ValueError as e:
        logger.warning(f"[all-in-one] 参数校验失败: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"[all-in-one] Failed to create task: {str(e)}")
        return jsonify({'success': False, 'error': f'Failed to create task: {str(e)}'})


@data_process_bp.route('/api/data-process/progress/<task_id>', methods=['GET'])
def get_task_progress(task_id):
    """Get task progress"""
    with progress_lock:
        if task_id not in progress_store:
            return jsonify(build_missing_task_progress(task_id))
    progress = get_progress(task_id)
    return jsonify(progress)


@data_process_bp.route('/api/data-process/debug/progress', methods=['GET'])
def debug_progress():
    """调试：查看所有进度存储"""
    with progress_lock:
        debug_info = []
        for task_id, data in progress_store.items():
            debug_info.append({
                'task_id': task_id,
                'percent': data.get('percent'),
                'message': data.get('message'),
                'has_result': 'result' in data,
                'result_keys': list(data.get('result', {}).keys()) if 'result' in data else []
            })
        return jsonify({'success': True, 'count': len(debug_info), 'progress_items': debug_info})


@data_process_bp.route('/api/data-process/download/<mode>/<filename>', methods=['GET'])
def download_result(mode, filename):
    """
    下载处理结果文件
    mode: allinone, dedup
    """
    try:
        # 根据模式确定目录
        mode_dirs = {
            'allinone': ALLINONE_DIR,
            'dedup': DEDUP_DIR
        }

        if mode not in mode_dirs:
            return jsonify({'success': False, 'error': '无效的下载模式'}), 400

        try:
            filepath, safe_filename = resolve_download_path(mode_dirs[mode], filename)
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400

        if os.path.exists(filepath):
            logger.info(f"[文件下载] {mode}: {filename}")
            return send_file(filepath, as_attachment=True, download_name=safe_filename)
        else:
            return jsonify({'success': False, 'error': '文件不存在或已过期'}), 404
    except Exception as e:
        logger.error(f"[文件下载] 失败: {str(e)}")
        return jsonify({'success': False, 'error': f'下载失败: {str(e)}'}), 500


@data_process_bp.route('/api/data-process/logs', methods=['GET'])
def get_logs():
    """获取操作日志列表"""
    try:
        log_files = []
        for file in os.listdir(LOGS_DIR):
            if file.endswith('.log'):
                file_path = os.path.join(LOGS_DIR, file)
                log_files.append({
                    'name': file,
                    'size': os.path.getsize(file_path),
                    'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S')
                })
        # 按修改时间倒序
        log_files.sort(key=lambda x: x['modified'], reverse=True)
        return jsonify({'success': True, 'logs': log_files})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@data_process_bp.route('/api/data-process/logs/<filename>', methods=['GET'])
def get_log_content(filename):
    """获取日志文件内容"""
    try:
        safe_filename = secure_filename(filename)
        if not safe_filename.endswith('.log'):
            safe_filename += '.log'
        file_path = os.path.join(LOGS_DIR, safe_filename)

        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({'success': True, 'content': content})
        else:
            return jsonify({'success': False, 'error': '日志文件不存在'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@data_process_bp.route('/api/data-process/list-files', methods=['POST'])
def list_directory_files():
    """
    获取指定目录下的ZIP文件列表
    用于预览文件列表功能
    """
    try:
        # 获取请求参数
        if request.is_json:
            data = request.get_json()
            dir_path = normalize_directory_path(data.get('dirPath', ''))
        else:
            dir_path = normalize_directory_path(request.form.get('dirPath', ''))

        if not dir_path:
            return jsonify({'success': False, 'error': '未提供目录路径'})

        # 验证目录是否存在
        if not os.path.exists(dir_path):
            return jsonify({'success': False, 'error': f'目录不存在: {dir_path}'})

        if not os.path.isdir(dir_path):
            return jsonify({'success': False, 'error': f'路径不是目录: {dir_path}'})

        # 查找目录下的所有ZIP文件
        zip_files = []
        try:
            for filename in os.listdir(dir_path):
                if filename.lower().endswith('.zip'):
                    full_path = os.path.join(dir_path, filename)
                    if os.path.isfile(full_path):
                        file_size = os.path.getsize(full_path)
                        zip_files.append({
                            'name': filename,
                            'size': file_size,
                            'size_mb': round(file_size / 1024 / 1024, 2)
                        })
        except Exception as e:
            return jsonify({'success': False, 'error': f'读取目录失败: {str(e)}'})

        # 按文件名排序
        zip_files.sort(key=lambda x: x['name'])

        # 计算总大小
        total_size = sum(f['size'] for f in zip_files)
        total_size_mb = round(total_size / 1024 / 1024, 2)

        logger.info(f"[list-files] 目录: {dir_path}, 找到 {len(zip_files)} 个ZIP文件")

        return jsonify({
            'success': True,
            'files': zip_files,
            'count': len(zip_files),
            'total_size': total_size,
            'total_size_mb': total_size_mb
        })

    except Exception as e:
        logger.error(f"[list-files] 错误: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)})


@data_process_bp.route('/api/data-process/list-excel-files', methods=['POST'])
def list_excel_files():
    """
    获取指定目录下的Excel文件列表（递归）
    用于CSV转换/数据去重的预览文件列表
    """
    try:
        if request.is_json:
            data = request.get_json()
            dir_path = normalize_directory_path(data.get('dirPath'))
        else:
            dir_path = normalize_directory_path(request.form.get('dirPath'))

        if not dir_path:
            return jsonify({'success': False, 'error': '未提供目录路径'})
        if not os.path.exists(dir_path):
            return jsonify({'success': False, 'error': f'目录不存在: {dir_path}'})
        if not os.path.isdir(dir_path):
            return jsonify({'success': False, 'error': f'路径不是目录: {dir_path}'})

        excel_files = []
        for full_path in collect_excel_files(dir_path):
            filename = os.path.basename(full_path)
            try:
                rel_path = os.path.relpath(full_path, dir_path)
            except Exception:
                rel_path = filename
            file_size = os.path.getsize(full_path)
            excel_files.append({
                'name': filename,
                'rel_path': rel_path.replace('\\', '/'),
                'size': file_size,
                'size_mb': round(file_size / 1024 / 1024, 2)
            })

        excel_files.sort(key=lambda x: x['rel_path'])
        total_size = sum(f['size'] for f in excel_files)
        total_size_mb = round(total_size / 1024 / 1024, 2)

        logger.info(f"[list-excel-files] 目录: {dir_path}, 找到 {len(excel_files)} 个Excel文件")
        return jsonify({
            'success': True,
            'files': excel_files,
            'count': len(excel_files),
            'total_size': total_size,
            'total_size_mb': total_size_mb
        })
    except Exception as e:
        logger.error(f"[list-excel-files] 错误: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)})


# ==================== 辅助处理函数 ====================

def process_all_in_one(files, target_column, output_name, output_dir, task_id=None):
    """一键处理 - 批量清洗并合并"""
    start_time = time.time()
    import pandas as pd

    target_column = validate_target_column_index(target_column)
    output_name, output_filename, stats_filename = build_allinone_output_names(output_dir, output_name)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    temp_extract_all = os.path.join(BASE_DIR, f'temp_allinone_{timestamp}')
    os.makedirs(temp_extract_all, exist_ok=True)

    total_zips = len(files)
    total_excel_files = 0
    total_original_rows = 0
    total_deleted_rows = 0
    all_valid_data = []
    processed_zips = 0
    failed_excel_files = []
    failed_zip_files = []

    # 详细统计信息（用于导出日志）
    zip_statistics = []  # 每个压缩包的统计
    excel_statistics = []  # 每个Excel文件的统计

    logger.info(f"[process_all_in_one] Starting: {total_zips} ZIP files, task_id: {task_id}")

    try:
        # 阶段1: 解压并清洗
        for zip_idx, zip_file in enumerate(files):
            zip_valid_rows = 0  # 在循环开始时初始化
            try:
                logger.info(f"[process_all_in_one] Processing ZIP {zip_idx + 1}/{total_zips}: {zip_file.filename}")

                if task_id:
                    update_progress(task_id, 5, f'阶段1: 解压压缩包 - {processed_zips + 1}/{total_zips}',
                                   f'正在解压: {zip_file.filename}')

                temp_zip = os.path.join(temp_extract_all, f'temp_{processed_zips}_{secure_filename(zip_file.filename)}')
                zip_file.save(temp_zip)

                temp_extract = os.path.join(temp_extract_all, f'extract_{processed_zips}')
                os.makedirs(temp_extract, exist_ok=True)

                with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
                    zip_ref.extractall(temp_extract)

                logger.info(f"[process_all_in_one] Extracted to {temp_extract}")

                # 查找Excel文件
                excel_files = []
                for root, dirs, files in os.walk(temp_extract):
                    for file in files:
                        if file.lower().endswith(('.xlsx', '.xls')):
                            excel_files.append(os.path.join(root, file))

                logger.info(f"[process_all_in_one] Found {len(excel_files)} Excel files")

                if task_id:
                    update_progress(task_id, 8, f'阶段1: 清洗数据 - ZIP {processed_zips + 1}/{total_zips}',
                                   f'发现 {len(excel_files)} 个Excel文件，开始清洗...')

                # 清洗每个Excel文件
                zip_original_rows = 0
                zip_deleted_rows = 0
                zip_excel_stats = []  # 当前ZIP内每个Excel的统计

                for excel_idx, excel_file in enumerate(excel_files):
                    try:
                        excel_filename = os.path.basename(excel_file)

                        # 每处理一个Excel文件都更新进度
                        if task_id:
                            progress = 10 + (processed_zips / total_zips) * 70 + (excel_idx / len(excel_files)) * (70 / total_zips)
                            update_progress(task_id, int(progress),
                                         f'阶段1: 清洗数据 - ZIP {processed_zips + 1}/{total_zips}, Excel {excel_idx + 1}/{len(excel_files)}',
                                         f'正在处理: {excel_filename}')

                        df = pd.read_excel(excel_file)
                        original_count = len(df)
                        total_original_rows += original_count
                        zip_original_rows += original_count

                        if target_column < len(df.columns):
                            target_col = df.columns[target_column]
                            valid_df = df[df[target_col].notna()].copy()
                            deleted_count = original_count - len(valid_df)
                            total_deleted_rows += deleted_count
                            zip_deleted_rows += deleted_count

                            # 记录Excel文件统计
                            excel_statistics.append({
                                'zip_name': zip_file.filename,
                                'excel_file': excel_filename,
                                'original_rows': original_count,
                                'valid_rows': len(valid_df),
                                'deleted_rows': deleted_count
                            })
                            zip_excel_stats.append({
                                'excel_file': excel_filename,
                                'original_rows': original_count,
                                'valid_rows': len(valid_df),
                                'deleted_rows': deleted_count
                            })

                            if len(valid_df) > 0:
                                all_valid_data.append(valid_df)
                                zip_valid_rows += len(valid_df)
                        else:
                            # 目标列不存在，全部删除
                            deleted_count = original_count
                            total_deleted_rows += deleted_count
                            zip_deleted_rows += deleted_count

                            excel_statistics.append({
                                'zip_name': zip_file.filename,
                                'excel_file': excel_filename,
                                'original_rows': original_count,
                                'valid_rows': 0,
                                'deleted_rows': original_count
                            })
                            zip_excel_stats.append({
                                'excel_file': excel_filename,
                                'original_rows': original_count,
                                'valid_rows': 0,
                                'deleted_rows': original_count
                            })

                        total_excel_files += 1

                        # 每处理完一个Excel文件，显示累计信息
                        if task_id:
                            logger.info(f"[Excel进度] ZIP {processed_zips + 1}/{total_zips}, Excel {excel_idx + 1}/{len(excel_files)}: {excel_filename}, 有效行: {zip_valid_rows}")

                    except Exception as e:
                        logger.warning(f"处理Excel文件失败 {excel_file}: {str(e)}")
                        failed_excel_files.append({
                            'zip_name': zip_file.filename,
                            'excel_file': os.path.basename(excel_file),
                            'error': str(e)
                        })
                        continue

                # 记录压缩包统计
                zip_statistics.append({
                    'zip_name': zip_file.filename,
                    'excel_count': len(excel_files),
                    'original_rows': zip_original_rows,
                    'valid_rows': zip_valid_rows,
                    'deleted_rows': zip_deleted_rows,
                    'excel_details': zip_excel_stats
                })

                logger.info(f"[process_all_in_one] ZIP {zip_idx + 1} done: {len(excel_files)} Excel, {zip_valid_rows} valid rows")

                try:
                    shutil.rmtree(temp_extract)
                    os.remove(temp_zip)
                except:
                    pass

                processed_zips += 1

                # 更新进度 - 压缩包处理完成
                if task_id:
                    progress = 10 + (processed_zips / total_zips) * 70
                    update_progress(task_id, int(progress), f'阶段1: 清洗中 - ZIP {processed_zips}/{total_zips}',
                                   f'本压缩包有效行数: {zip_valid_rows} | 累计Excel文件: {total_excel_files}')

            except Exception as e:
                logger.error(f"处理压缩包失败 {zip_file.filename}: {str(e)}", exc_info=True)
                processed_zips += 1
                # 确保即使出错也添加空的统计（避免变量未定义错误）
                failed_zip_files.append({
                    'zip_name': zip_file.filename,
                    'error': str(e)
                })
                if not any(stat.get('zip_name') == zip_file.filename for stat in zip_statistics):
                    zip_statistics.append({
                        'zip_name': zip_file.filename,
                        'excel_count': 0,
                        'original_rows': 0,
                        'valid_rows': 0,
                        'deleted_rows': 0,
                        'excel_details': []
                    })
                continue

        logger.info(f"[process_all_in_one] All ZIPs processed: {total_excel_files} Excel files, {len(all_valid_data)} valid dataframes")

        if failed_excel_files or failed_zip_files:
            error_parts = []
            if failed_excel_files:
                excel_names = ', '.join(
                    f"{item['zip_name']}/{item['excel_file']}" for item in failed_excel_files[:5]
                )
                error_parts.append(f"Excel文件失败 {len(failed_excel_files)} 个: {excel_names}")
            if failed_zip_files:
                zip_names = ', '.join(item['zip_name'] for item in failed_zip_files[:5])
                error_parts.append(f"ZIP文件失败 {len(failed_zip_files)} 个: {zip_names}")

            error_message = '；'.join(error_parts) + '；为避免生成不完整结果，本次一键处理已终止'
            logger.error(f"[process_all_in_one] {error_message}")
            return build_failed_result(
                error_message,
                mode='allinone',
                total_zips=total_zips,
                processed_zips=processed_zips,
                total_excel_files=total_excel_files,
                original_rows=total_original_rows,
                deleted_rows=total_deleted_rows,
                failed_excel_files=failed_excel_files,
                failed_zip_files=failed_zip_files,
                failed_excel_count=len(failed_excel_files),
                failed_zip_count=len(failed_zip_files),
                has_stats=False
            )

        if not all_valid_data:
            return {'success': False, 'error': 'No valid data found'}

        # 阶段2: 合并数据
        if task_id:
            update_progress(task_id, 85, '阶段2: 合并数据', f'正在合并 {len(all_valid_data)} 个数据集...')

        final_df = pd.concat(all_valid_data, ignore_index=True)

        # 限制最大行数为99万行
        MAX_ROWS = 990000
        original_final_rows = len(final_df)
        was_truncated = False

        if len(final_df) > MAX_ROWS:
            final_df = final_df.head(MAX_ROWS).copy()
            was_truncated = True
            truncated_count = original_final_rows - MAX_ROWS
            logger.warning(f"[process_all_in_one] 数据截断: 原始行数 {original_final_rows} -> 保留 {MAX_ROWS} 行，截断 {truncated_count} 行")

        if task_id:
            truncation_msg = f' | 已截断至{MAX_ROWS}行' if was_truncated else ''
            update_progress(task_id, 90, '阶段2: 正在保存文件', f'合并后总行数: {len(final_df)}{truncation_msg} | 原始行数: {total_original_rows} | 删除空值行: {total_deleted_rows}')

        # 保存最终结果
        output_path = os.path.join(output_dir, output_filename)
        final_df.to_excel(output_path, index=False, engine='openpyxl')

        elapsed_time = time.time() - start_time

        if task_id:
            update_progress(task_id, 95, '即将完成...', f'生成文件: {output_filename} | 耗时: {elapsed_time:.1f}秒')

        # 保存统计信息到JSON文件（用于导出日志）
        stats_path = os.path.join(output_dir, stats_filename)
        stats_data = {
            'timestamp': timestamp,
            'output_name': output_name,
            'output_file': output_filename,
            'elapsed_time': elapsed_time,
            'summary': {
                'total_zips': total_zips,
                'processed_zips': processed_zips,
                'total_excel_files': total_excel_files,
                'original_rows': total_original_rows,
                'deleted_rows': total_deleted_rows,
                'final_rows': len(final_df),
                'was_truncated': was_truncated,
                'truncated_count': original_final_rows - MAX_ROWS if was_truncated else 0,
                'clean_rate': (total_deleted_rows / total_original_rows * 100) if total_original_rows > 0 else 0
            },
            'zip_statistics': zip_statistics,
            'excel_statistics': excel_statistics
        }

        import json
        with open(stats_path, 'w', encoding='utf-8') as f:
            json.dump(stats_data, f, ensure_ascii=False, indent=2)

        result = {
            'success': True,
            'output_file': output_filename,
            'stats_file': stats_filename,
            'mode': 'allinone',
            'total_zips': total_zips,
            'processed_zips': processed_zips,
            'total_excel_files': total_excel_files,
            'original_rows': total_original_rows,
            'deleted_rows': total_deleted_rows,
            'final_rows': len(final_df),
            'was_truncated': was_truncated,
            'truncated_count': original_final_rows - MAX_ROWS if was_truncated else 0,
            'clean_rate': (total_deleted_rows / total_original_rows * 100) if total_original_rows > 0 else 0,
            'elapsed_time': elapsed_time,
            'avg_time_per_zip': elapsed_time / total_zips if total_zips > 0 else 0,
            'has_stats': True
        }

        # 将结果保存到进度存储中，供前端获取
        if task_id:
            with progress_lock:
                existing = progress_store.get(task_id, {})
                progress_store[task_id] = {
                    'percent': 100,
                    'message': '处理完成',
                    'detail': f'生成文件: {output_filename}',
                    'result': result,
                    'timestamp': time.time(),
                    'started_at': existing.get('started_at', existing.get('timestamp', time.time()))
                }
                for key in ('log_context', 'log_flags'):
                    if key in existing:
                        progress_store[task_id][key] = existing[key]
            # 立即验证保存是否成功
            logger.info(f"[process_all_in_one] Result saved to progress_store: task_id={task_id}, final_rows={result.get('final_rows')}, total_zips={result.get('total_zips')}")
            saved_progress = progress_store.get(task_id, {})
            logger.info(f"[process_all_in_one] Verified progress_store: percent={saved_progress.get('percent')}, has_result={('result' in saved_progress)}")

        logger.info(f"[process_all_in_one] Completed: {total_excel_files} Excel -> {len(final_df)} rows" +
                   (f" (TRUNCATED from {original_final_rows})" if was_truncated else ""))

        details = f'处理了{total_zips}个压缩包，{total_excel_files}个Excel文件，删除{total_deleted_rows}行空数据'
        if was_truncated:
            details += f'，数据已截断至{MAX_ROWS}行（原始{original_final_rows}行）'
        if task_id:
            log_task_event(
                task_id,
                'success',
                file_name=output_filename,
                record_count=len(final_df),
                details=details
            )

        return result

    finally:
        try:
            shutil.rmtree(temp_extract_all)
        except:
            pass


def extract_asset_name_from_zip(zip_path):
    """从压缩包文件名提取资产名称"""
    name = os.path.basename(zip_path)
    name = name.replace('.zip', '')

    # 去掉常见前缀
    prefixes = ['分类分级结果字段-', '数据结果-', '扫描结果-', 'upload_', 'temp_upload_']
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):]
            break

    # 去掉时间戳后缀
    import re
    name = re.sub(r'[-_]\d{8,}_?\d{6,}$', '', name)

    # 去掉括号内容
    name = name.split('(')[0].strip()

    return name if name else '处理结果'


# 启动时清理旧进度记录
clean_old_progress()


@data_process_bp.route('/api/data-process/all-in-one-dir', methods=['POST'])
def all_in_one_by_dir():
    """
    一键处理 - 批量清洗并合并（目录选择模式）
    支持超大数据量：直接从提供的目录路径读取文件
    优势：无上传大小限制，支持无限文件数量
    """
    task_id = str(uuid.uuid4())

    try:
        # 判断请求类型：JSON（路径输入）或 FormData（文件上传）
        if request.is_json:
            # JSON格式：前端直接发送目录路径
            data = request.get_json()
            dir_path = normalize_directory_path(data.get('dirPath', ''))
            target_column = validate_target_column_index(data.get('targetColumn', 7))
            output_name = sanitize_output_stem(data.get('outputName', '合并结果表'), '合并结果表')

            if not dir_path:
                return jsonify({'success': False, 'error': '未提供目录路径'})

        else:
            # FormData格式：从表单数据中获取路径
            dir_path = normalize_directory_path(request.form.get('dirPath', ''))
            target_column = validate_target_column_index(request.form.get('targetColumn', 7))
            output_name = sanitize_output_stem(request.form.get('outputName', '合并结果表'), '合并结果表')

            if not dir_path:
                return jsonify({'success': False, 'error': '未提供目录路径'})

        logger.info(f"[all-in-one-dir] 目录路径: {dir_path}")

        # 创建临时目录用于任务
        temp_dir = os.path.join(BASE_DIR, f'upload_{task_id}')
        os.makedirs(temp_dir, exist_ok=True)

        # 验证目录是否存在
        if not os.path.exists(dir_path):
            return jsonify({'success': False, 'error': f'目录不存在: {dir_path}'})

        if not os.path.isdir(dir_path):
            return jsonify({'success': False, 'error': f'路径不是目录: {dir_path}'})

        # 查找目录下的所有ZIP文件
        zip_files = []
        try:
            for filename in os.listdir(dir_path):
                if filename.lower().endswith('.zip'):
                    full_path = os.path.join(dir_path, filename)
                    if os.path.isfile(full_path):
                        zip_files.append(full_path)
        except Exception as e:
            return jsonify({'success': False, 'error': f'读取目录失败: {str(e)}'})

        if len(zip_files) == 0:
            return jsonify({'success': False, 'error': f'目录中未找到ZIP文件: {dir_path}'})

        logger.info(f"[all-in-one-dir] Task received: {len(zip_files)} ZIPs from directory, col: {target_column}, output: {output_name}, task_id: {task_id}")
        logger.info(f"[all-in-one-dir] Directory: {dir_path}")

        set_task_log_context(
            task_id,
            '一键处理-批量清洗并合并',
            file_name=output_name,
            details=merge_log_details(
                f'目录: {dir_path}',
                f'ZIP 文件数: {len(zip_files)}',
                f'目标列: {target_column}'
            )
        )
        log_task_event(task_id, 'start')

        # 后台线程处理
        def process_in_background():
            result = None
            try:
                # 清理临时文件
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass

                # 创建文件包装类
                class DirFile:
                    def __init__(self, path, filename):
                        self.path = path
                        self.filename = filename
                        self.name = filename

                    def save(self, dst):
                        shutil.copy(self.path, dst)

                processing_files = []
                for zip_path in zip_files:
                    filename = os.path.basename(zip_path)
                    processing_files.append(DirFile(zip_path, filename))

                logger.info(f"[all-in-one-dir] Starting background processing of {len(processing_files)} files")

                result = process_all_in_one(processing_files, target_column, output_name, ALLINONE_DIR, task_id)

                # 日志记录单独处理，出错不影响结果
                try:
                    logger.info(f"[all-in-one-dir] Completed: {result['total_excel_files']} Excel files -> {result['final_rows']} rows")
                except Exception as log_err:
                    logger.warning(f"[all-in-one-dir] Log记录失败（不影响结果）: {log_err}")

            except Exception as e:
                logger.error(f"[all-in-one-dir] Background task error: {str(e)}", exc_info=True)
                # 只有在没有成功结果时才更新为失败状态
                if result is None or not result.get('success'):
                    fail_task(task_id, (result or {}).get('error') or str(e))

        thread = threading.Thread(target=process_in_background, daemon=True)
        thread.start()
        logger.info(f"[all-in-one-dir] Background thread started, task_id: {task_id}")

        # 立即返回
        return jsonify({
            'success': True,
            'task_id': task_id,
            'message': f'已开始处理 {len(zip_files)} 个压缩包',
            'zip_count': len(zip_files),
            'directory': dir_path
        })

    except ValueError as e:
        logger.warning(f"[all-in-one-dir] 参数校验失败: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"[all-in-one-dir] API error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== 导出日志API ====================

@data_process_bp.route('/api/data-process/export-log', methods=['GET'])
def export_processing_log():
    """
    导出处理日志Excel
    包含两个Sheet:
    1. 处理汇总 - 总体统计信息
    2. 各资产详情 - 每个资产的数据行数分布
    """
    try:
        mode = (request.args.get('mode') or 'allinone').strip().lower()

        def export_latest_runtime_log():
            """导出最新运行日志（适用于split/csv/dedup，也可作为allinone兜底）"""
            runtime_log_files = []
            fallback_log_files = []
            if os.path.exists(LOGS_DIR):
                for fname in os.listdir(LOGS_DIR):
                    if fname.endswith('.log'):
                        fpath = os.path.join(LOGS_DIR, fname)
                        if os.path.isfile(fpath):
                            entry = (fpath, os.path.getmtime(fpath))
                            if is_runtime_log_filename(fname):
                                runtime_log_files.append(entry)
                            else:
                                fallback_log_files.append(entry)

            log_files = runtime_log_files or fallback_log_files

            if not log_files:
                return jsonify({'success': False, 'error': '未找到可导出的日志文件'}), 404

            log_files.sort(key=lambda x: x[1], reverse=True)
            latest_log_path = log_files[0][0]
            latest_log_name = os.path.basename(latest_log_path)

            safe_mode = re.sub(r'[^a-zA-Z0-9_-]+', '_', mode or 'allinone')
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            export_name = f'处理日志_{safe_mode}_{ts}.log'
            export_path = os.path.join(LOGS_DIR, export_name)
            shutil.copyfile(latest_log_path, export_path)
            logger.info(f"[export-log] 运行日志已导出: {export_name} (source={latest_log_name})")

            return jsonify({
                'success': True,
                'filename': export_name,
                'download_url': f'/api/data-process/download/log/{export_name}'
            })

        # 非一键处理模式：直接导出运行日志
        if mode in ('split', 'csv', 'dedup'):
            return export_latest_runtime_log()

        import pandas as pd
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        from openpyxl.utils import get_column_letter

        # 获取最新的统计文件
        stats_files = []
        if os.path.exists(ALLINONE_DIR):
            for filename in os.listdir(ALLINONE_DIR):
                if filename.endswith('_stats.json'):
                    filepath = os.path.join(ALLINONE_DIR, filename)
                    stats_files.append((filepath, os.path.getmtime(filepath)))

        if not stats_files:
            # 一键处理统计文件不存在时，兜底导出运行日志
            return export_latest_runtime_log()

        # 获取最新的统计文件
        stats_files.sort(key=lambda x: x[1], reverse=True)
        latest_stats_file = stats_files[0][0]

        # 读取统计数据
        with open(latest_stats_file, 'r', encoding='utf-8') as f:
            stats_data = json.load(f)

        # 创建Excel工作簿
        wb = Workbook()

        # ==================== Sheet1: 处理汇总 ====================
        ws1 = wb.active
        ws1.title = '处理汇总'

        # 设置列宽
        ws1.column_dimensions['A'].width = 25
        ws1.column_dimensions['B'].width = 20

        # 标题行
        ws1['A1'] = '一键处理日志'
        ws1['A1'].font = Font(size=16, bold=True)
        ws1.merge_cells('A1:B1')
        ws1['A1'].alignment = Alignment(horizontal='center', vertical='center')

        # 处理时间
        timestamp_str = stats_data.get('timestamp', '')
        try:
            dt = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
            formatted_time = dt.strftime('%Y-%m-%d %H:%M:%S')
        except:
            formatted_time = timestamp_str

        ws1['A2'] = '处理时间:'
        ws1['A2'].font = Font(bold=True)
        ws1['B2'] = formatted_time

        # 空行
        row = 4

        # 汇总标题
        ws1[f'A{row}'] = '处理汇总统计'
        ws1[f'A{row}'].font = Font(size=14, bold=True, color='FFFFFF')
        ws1[f'A{row}'].fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
        ws1.merge_cells(f'A{row}:B{row}')
        ws1[f'A{row}'].alignment = Alignment(horizontal='center', vertical='center')
        row += 1

        # 汇总数据
        summary = stats_data.get('summary', {})
        summary_items = [
            ('压缩包总数', summary.get('total_zips', 0)),
            ('成功处理压缩包', summary.get('processed_zips', 0)),
            ('Excel文件总数', summary.get('total_excel_files', 0)),
            ('原始总行数', summary.get('original_rows', 0)),
            ('删除空行数', summary.get('deleted_rows', 0)),
            ('最终有效行数', summary.get('final_rows', 0)),
            ('清洗率', f"{summary.get('clean_rate', 0):.2f}%"),
            ('处理耗时(秒)', f"{stats_data.get('elapsed_time', 0):.2f}"),
        ]

        if summary.get('was_truncated'):
            summary_items.append(('是否截断', '是'))
            summary_items.append(('截断行数', summary.get('truncated_count', 0)))
        else:
            summary_items.append(('是否截断', '否'))

        for label, value in summary_items:
            ws1[f'A{row}'] = label
            ws1[f'A{row}'].font = Font(bold=True)
            ws1[f'B{row}'] = value
            row += 1

        # ==================== Sheet2: 各资产详情 ====================
        ws2 = wb.create_sheet('各资产详情')

        # 设置列宽
        ws2.column_dimensions['A'].width = 35
        ws2.column_dimensions['B'].width = 15
        ws2.column_dimensions['C'].width = 15
        ws2.column_dimensions['D'].width = 15
        ws2.column_dimensions['E'].width = 15

        # 标题行
        ws2['A1'] = '各压缩包资产数据详情'
        ws2['A1'].font = Font(size=14, bold=True)
        ws2.merge_cells('A1:E1')
        ws2['A1'].alignment = Alignment(horizontal='center', vertical='center')

        # 表头
        headers = ['压缩包名称', 'Excel文件数', '原始行数', '有效行数', '删除行数']
        for col, header in enumerate(headers, 1):
            cell = ws2.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
            cell.alignment = Alignment(horizontal='center', vertical='center')

        # 填充数据
        zip_stats = stats_data.get('zip_statistics', [])
        for idx, zip_stat in enumerate(zip_stats, start=4):
            ws2.cell(row=idx, column=1, value=zip_stat.get('zip_name', ''))
            ws2.cell(row=idx, column=2, value=zip_stat.get('excel_count', 0))
            ws2.cell(row=idx, column=3, value=zip_stat.get('original_rows', 0))
            ws2.cell(row=idx, column=4, value=zip_stat.get('valid_rows', 0))
            ws2.cell(row=idx, column=5, value=zip_stat.get('deleted_rows', 0))

        # 添加合计行
        total_row = len(zip_stats) + 5
        ws2.cell(row=total_row, column=1, value='合计')
        ws2.cell(row=total_row, column=1).font = Font(bold=True)
        ws2.cell(row=total_row, column=2, value=len(zip_stats))
        ws2.cell(row=total_row, column=2).font = Font(bold=True)
        ws2.cell(row=total_row, column=3, value=summary.get('original_rows', 0))
        ws2.cell(row=total_row, column=3).font = Font(bold=True)
        ws2.cell(row=total_row, column=4, value=summary.get('final_rows', 0))
        ws2.cell(row=total_row, column=4).font = Font(bold=True)
        ws2.cell(row=total_row, column=5, value=summary.get('deleted_rows', 0))
        ws2.cell(row=total_row, column=5).font = Font(bold=True)

        # ==================== Sheet3: Excel文件明细 ====================
        ws3 = wb.create_sheet('Excel文件明细')

        # 设置列宽
        ws3.column_dimensions['A'].width = 35
        ws3.column_dimensions['B'].width = 35
        ws3.column_dimensions['C'].width = 15
        ws3.column_dimensions['D'].width = 15
        ws3.column_dimensions['E'].width = 15

        # 标题行
        ws3['A1'] = '每个Excel文件数据详情'
        ws3['A1'].font = Font(size=14, bold=True)
        ws3.merge_cells('A1:E1')
        ws3['A1'].alignment = Alignment(horizontal='center', vertical='center')

        # 表头
        headers = ['压缩包名称', 'Excel文件名', '原始行数', '有效行数', '删除行数']
        for col, header in enumerate(headers, 1):
            cell = ws3.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
            cell.alignment = Alignment(horizontal='center', vertical='center')

        # 填充数据
        excel_stats = stats_data.get('excel_statistics', [])
        for idx, excel_stat in enumerate(excel_stats, start=4):
            ws3.cell(row=idx, column=1, value=excel_stat.get('zip_name', ''))
            ws3.cell(row=idx, column=2, value=excel_stat.get('excel_file', ''))
            ws3.cell(row=idx, column=3, value=excel_stat.get('original_rows', 0))
            ws3.cell(row=idx, column=4, value=excel_stat.get('valid_rows', 0))
            ws3.cell(row=idx, column=5, value=excel_stat.get('deleted_rows', 0))

        # 生成输出文件
        output_filename = f'处理日志_{stats_data.get("timestamp", "")}.xlsx'
        output_path = os.path.join(ALLINONE_DIR, output_filename)

        wb.save(output_path)
        logger.info(f"[export-log] 日志文件已生成: {output_filename}")

        return jsonify({
            'success': True,
            'filename': output_filename,
            'download_url': f'/api/data-process/download/allinone/{output_filename}'
        })

    except Exception as e:
        logger.error(f"[export-log] 导出日志失败: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@data_process_bp.route('/api/data-process/download/log/<filename>', methods=['GET'])
def download_runtime_log(filename):
    """下载运行日志文件"""
    try:
        safe_filename = os.path.basename(filename)
        if safe_filename != filename or safe_filename in ('', '.', '..'):
            return jsonify({'success': False, 'error': '无效文件名'}), 400
        file_path = os.path.join(LOGS_DIR, safe_filename)
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        return send_file(file_path, as_attachment=True, download_name=safe_filename)
    except Exception as e:
        logger.error(f"[download-log] 下载失败: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== 数据拆分 ====================

@data_process_bp.route('/api/data-process/list-export-files', methods=['GET'])
def list_export_files():
    """列出 SGExportFiles 目录下所有 xlsx 文件"""
    try:
        files = []
        if not os.path.exists(SGEXPORT_DIR):
            return jsonify({'success': True, 'files': []})

        # 分类映射
        category_map = {
            'yeji': '业支',
            'xinan': '信安',
            'smc': 'SMC'
        }

        for root, dirs, filenames in os.walk(SGEXPORT_DIR):
            for filename in filenames:
                if filename.lower().endswith('.xlsx'):
                    full_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(full_path, SGEXPORT_DIR)
                    size_mb = round(os.path.getsize(full_path) / 1024 / 1024, 2)

                    # 取第一级子目录名作为分类
                    parts = rel_path.replace('\\', '/').split('/')
                    sub_dir = parts[0] if len(parts) > 1 else ''
                    category = category_map.get(sub_dir.lower(), sub_dir if sub_dir else '其他')

                    files.append({
                        'name': filename,
                        'rel_path': rel_path.replace('\\', '/'),
                        'size_mb': size_mb,
                        'category': category
                    })

        files.sort(key=lambda x: (x['category'], x['name']))
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def process_split(source_path, split_count, header_row, output_name, task_id):
    """拆分 Excel 文件的核心逻辑"""
    from openpyxl import Workbook
    import zipfile as zf

    try:
        update_progress(task_id, 5, '正在读取文件', f'读取: {os.path.basename(source_path)}')
        logger.info(f"[split] 开始读取文件: {source_path}")

        sheet_title, max_row, max_col, sheet_rows = read_excel_sheet_for_split(source_path)

        if header_row < 1:
            raise ValueError('标题行必须大于等于1')
        if max_row < header_row:
            raise ValueError(f'标题行超出范围，当前最大行: {max_row}')

        total_rows = max(0, max_row - header_row)  # 仅数据行数量（不含标题）
        logger.info(f"[split] 读取完成，总行数(不含标题): {total_rows}, 标题行: {header_row}, 最大列: {max_col}")

        update_progress(task_id, 20, '计算拆分方案', f'总行数: {total_rows}，拆分为 {split_count} 个文件')

        if total_rows == 0:
            fail_task(task_id, '源文件没有数据行')
            return

        # 计算每份数据行数（向上取整，最后一份可能少一些）
        import math
        rows_per_file = math.ceil(total_rows / split_count)

        # 读取标题区内容（可包含多行）
        header_rows = sheet_rows[:header_row]

        # 生成输出文件名前缀（去掉扩展名 + 文件名安全化）
        base_name = (output_name or os.path.splitext(os.path.basename(source_path))[0]).strip()
        base_name = re.sub(r'[\\/:*?"<>|]+', '_', base_name) or '拆分结果'

        # 清理旧的拆分临时目录
        task_tmp_dir = os.path.join(SPLIT_DIR, task_id)
        os.makedirs(task_tmp_dir, exist_ok=True)

        output_files = []
        actual_split = 0

        for i in range(split_count):
            start_index = i * rows_per_file + header_row
            end_index = min(start_index + rows_per_file, max_row)
            if start_index >= max_row:
                break

            actual_split += 1
            seq = str(actual_split).zfill(3)
            out_filename = f'{base_name}_{seq}.xlsx'
            out_path = os.path.join(task_tmp_dir, out_filename)

            out_wb = Workbook()
            out_ws = out_wb.active
            out_ws.title = sheet_title or 'Sheet1'

            # 先写入原始标题行（保持原始值）
            for header_values in header_rows:
                out_ws.append(header_values)

            # 再写入当前分片数据行
            for row_values in sheet_rows[start_index:end_index]:
                out_ws.append(row_values)

            out_wb.save(out_path)
            output_files.append(out_filename)

            percent = 20 + int(70 * actual_split / split_count)
            update_progress(task_id, percent, f'正在拆分', f'已生成 {actual_split}/{split_count} 个文件')
            logger.info(f"[split] 已生成: {out_filename}，数据行数: {max(0, end_index - start_index)}")

        # 打包成 ZIP
        if not output_files:
            shutil.rmtree(task_tmp_dir, ignore_errors=True)
            fail_task(task_id, '未生成任何拆分结果文件，请检查源文件内容或格式')
            return

        update_progress(task_id, 92, '正在打包', f'共 {actual_split} 个文件')
        zip_filename = f'{base_name}_拆分结果.zip'
        zip_path = os.path.join(SPLIT_DIR, zip_filename)

        with zf.ZipFile(zip_path, 'w', zf.ZIP_DEFLATED) as zipf:
            for fname in output_files:
                zipf.write(os.path.join(task_tmp_dir, fname), fname)

        # 清理临时目录
        shutil.rmtree(task_tmp_dir, ignore_errors=True)

        result = {
            'success': True,
            'mode': 'split',
            'source_file': os.path.basename(source_path),
            'total_rows': total_rows,
            'split_count': actual_split,
            'rows_per_file': rows_per_file,
            'output_file': zip_filename,
            'elapsed_time': get_task_elapsed_time(task_id)
        }

        with progress_lock:
            progress_store[task_id]['result'] = result

        update_progress(task_id, 100, '处理完成', f'已拆分为 {actual_split} 个文件', preserve_result=True)
        log_task_event(
            task_id,
            'success',
            file_name=zip_filename,
            record_count=total_rows,
            details=f'源文件: {os.path.basename(source_path)}；拆分文件数: {actual_split}'
        )
        logger.info(f"[split] 拆分完成: {zip_filename}")

    except Exception as e:
        logger.error(f"[split] 拆分失败: {str(e)}", exc_info=True)
        fail_task(task_id, str(e))


def process_split_by_dir(dir_path, split_count, header_row, output_name, task_id, selected_files=None):
    """按目录批量拆分Excel文件"""
    from openpyxl import Workbook
    import zipfile as zf

    try:
        update_progress(task_id, 2, '正在扫描目录', f'目录: {dir_path}')

        excel_files = collect_excel_files(dir_path, selected_files)

        total_files = len(excel_files)
        if total_files == 0:
            error_message = '未选中有效 Excel 文件' if selected_files else '目录下未找到 Excel 文件'
            fail_task(task_id, error_message)
            return

        task_tmp_dir = os.path.join(SPLIT_DIR, task_id)
        os.makedirs(task_tmp_dir, exist_ok=True)

        processed = 0
        failed = 0
        total_rows_all = 0
        total_parts = 0
        failed_files = []
        used_base_names = set()

        for i, source_path in enumerate(excel_files):
            filename = os.path.basename(source_path)
            try:
                sheet_title, max_row, max_col, sheet_rows = read_excel_sheet_for_split(source_path)

                if max_row < header_row:
                    raise ValueError(f'标题行超出范围(最大行:{max_row})')

                data_rows = max(0, max_row - header_row)
                if data_rows <= 0:
                    continue

                import math
                rows_per_file = math.ceil(data_rows / split_count)
                src_base = build_relative_output_stem(source_path, dir_path)
                raw_base = (output_name or '').strip()
                if raw_base:
                    base_name = f'{raw_base}_{src_base}'
                else:
                    base_name = src_base
                base_name = re.sub(r'[\\/:*?"<>|]+', '_', base_name) or '拆分结果'
                base_name = make_unique_name(base_name, used_base_names)

                header_rows = sheet_rows[:header_row]

                actual_split = 0
                for part_idx in range(split_count):
                    start_index = part_idx * rows_per_file + header_row
                    end_index = min(start_index + rows_per_file, max_row)
                    if start_index >= max_row:
                        break

                    actual_split += 1
                    seq = str(actual_split).zfill(3)
                    out_filename = f'{base_name}_{seq}.xlsx'
                    out_path = os.path.join(task_tmp_dir, out_filename)

                    out_wb = Workbook()
                    out_ws = out_wb.active
                    out_ws.title = sheet_title or 'Sheet1'
                    for header_values in header_rows:
                        out_ws.append(header_values)
                    for row_values in sheet_rows[start_index:end_index]:
                        out_ws.append(row_values)
                    out_wb.save(out_path)

                processed += 1
                total_rows_all += data_rows
                total_parts += actual_split
            except Exception as e:
                failed += 1
                failed_files.append(filename)
                logger.error(f"[split-batch] 处理失败: {filename}, 错误: {str(e)}")

            percent = 5 + int(85 * (i + 1) / total_files)
            update_progress(task_id, percent, '正在拆分', f'已处理 {i + 1}/{total_files}：{filename}')

        generated_files = [fname for fname in os.listdir(task_tmp_dir) if os.path.isfile(os.path.join(task_tmp_dir, fname))]
        if not generated_files:
            shutil.rmtree(task_tmp_dir, ignore_errors=True)
            fail_task(
                task_id,
                '未生成任何拆分结果文件，请检查源文件内容或格式',
                processed_files=processed,
                failed=failed,
                failed_files=failed_files
            )
            return

        update_progress(task_id, 93, '正在打包', f'成功处理 {processed} 个文件')
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_name = re.sub(r'[\\/:*?"<>|]+', '_', (output_name or '').strip()) or '数据拆分结果'
        zip_filename = f'{safe_name}_{ts}.zip'
        zip_path = os.path.join(SPLIT_DIR, zip_filename)

        with zf.ZipFile(zip_path, 'w', zf.ZIP_DEFLATED) as zipf:
            for fname in generated_files:
                zipf.write(os.path.join(task_tmp_dir, fname), fname)

        shutil.rmtree(task_tmp_dir, ignore_errors=True)

        result = {
            'success': True,
            'mode': 'split',
            'total_files': total_files,
            'processed_files': processed,
            'failed': failed,
            'failed_files': failed_files,
            'total_rows': total_rows_all,
            'split_count': total_parts,
            'output_file': zip_filename,
            'elapsed_time': get_task_elapsed_time(task_id)
        }
        with progress_lock:
            progress_store[task_id]['result'] = result
        update_progress(task_id, 100, '处理完成', f'成功拆分 {processed}/{total_files} 个文件', preserve_result=True)
        log_task_event(
            task_id,
            'success',
            file_name=zip_filename,
            record_count=total_rows_all,
            details=f'处理文件数: {processed}/{total_files}；拆分结果数: {total_parts}；失败文件数: {failed}'
        )
        logger.info(f"[split-batch] 完成: {zip_filename}")
    except Exception as e:
        logger.error(f"[split-batch] 失败: {str(e)}", exc_info=True)
        fail_task(task_id, str(e))


@data_process_bp.route('/api/data-process/split', methods=['POST'])
def split_excel():
    """拆分 Excel 文件"""
    try:
        data = request.json or {}
        rel_path = (data.get('sourceFile') or '').strip()
        dir_path = normalize_directory_path(data.get('dirPath'))
        selected_files = normalize_selected_files(data.get('selectedFiles'))
        split_count = int(data.get('splitCount', 2))
        header_row = int(data.get('headerRow', 1))
        output_name = data.get('outputName', '').strip()

        if split_count < 2 or split_count > 999:
            return jsonify({'success': False, 'error': '拆分数量必须在 2-999 之间'}), 400
        if header_row < 1 or header_row > 10:
            return jsonify({'success': False, 'error': '标题行必须在 1-10 之间'}), 400

        task_id = str(uuid.uuid4())
        if dir_path:
            if not os.path.exists(dir_path):
                return jsonify({'success': False, 'error': f'目录不存在: {dir_path}'}), 400
            if not os.path.isdir(dir_path):
                return jsonify({'success': False, 'error': '路径不是目录'}), 400
            set_task_log_context(
                task_id,
                '数据拆分',
                file_name=output_name,
                details=merge_log_details(
                    f'目录: {dir_path}',
                    f'拆分数量: {split_count}',
                    f'标题行: {header_row}',
                    f'选中文件数: {len(selected_files)}'
                )
            )
            log_task_event(task_id, 'start')
            update_progress(task_id, 0, '任务已创建', '准备按目录拆分...')
            thread = threading.Thread(
                target=process_split_by_dir,
                args=(dir_path, split_count, header_row, output_name, task_id, selected_files),
                daemon=True
            )
            thread.start()
        else:
            if not rel_path:
                return jsonify({'success': False, 'error': '请输入目录路径'}), 400
            source_path = os.path.join(SGEXPORT_DIR, rel_path.replace('/', os.sep))
            if not os.path.exists(source_path):
                return jsonify({'success': False, 'error': f'文件不存在: {rel_path}'}), 400
            set_task_log_context(
                task_id,
                '数据拆分',
                file_name=output_name or os.path.basename(rel_path),
                details=merge_log_details(
                    f'源文件: {rel_path}',
                    f'拆分数量: {split_count}',
                    f'标题行: {header_row}'
                )
            )
            log_task_event(task_id, 'start')
            update_progress(task_id, 0, '任务已创建', '准备拆分...')
            thread = threading.Thread(
                target=process_split,
                args=(source_path, split_count, header_row, output_name, task_id),
                daemon=True
            )
            thread.start()

        return jsonify({'success': True, 'task_id': task_id})

    except Exception as e:
        logger.error(f"[split] 启动失败: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@data_process_bp.route('/api/data-process/download/split/<filename>', methods=['GET'])
def download_split(filename):
    """下载拆分结果"""
    try:
        try:
            file_path, safe_filename = resolve_download_path(SPLIT_DIR, filename)
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        return send_file(file_path, as_attachment=True, download_name=safe_filename)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== CSV 转换 ====================

def process_csv_convert(dir_path, task_id, selected_files=None):
    """将目录下所有 Excel 文件转换为 CSV"""
    import pandas as pd
    import zipfile as zf

    try:
        update_progress(task_id, 2, '正在扫描目录', f'目录: {dir_path}')

        # 扫描目录下所有 xlsx/xls 文件
        excel_files = collect_excel_files(dir_path, selected_files)

        total = len(excel_files)
        if total == 0:
            error_message = '未选中有效 Excel 文件' if selected_files else '目录下未找到 Excel 文件'
            fail_task(task_id, error_message)
            return

        update_progress(task_id, 5, f'找到 {total} 个 Excel 文件', '开始转换...')
        logger.info(f"[csv] 找到 {total} 个 Excel 文件")

        task_tmp_dir = os.path.join(CSV_DIR, task_id)
        os.makedirs(task_tmp_dir, exist_ok=True)

        converted = 0
        failed = 0
        failed_files = []
        used_output_names = set()

        for i, excel_path in enumerate(excel_files):
            filename = os.path.basename(excel_path)
            source_stem = build_relative_output_stem(excel_path, dir_path)
            csv_name = make_unique_name(f'{source_stem}.csv', used_output_names)
            csv_path = os.path.join(task_tmp_dir, csv_name)

            try:
                df = pd.read_excel(excel_path, sheet_name=0, engine=get_excel_read_engine(excel_path))
                df.to_csv(csv_path, index=False, encoding='utf-8-sig', sep='|')
                converted += 1
                logger.info(f"[csv] 已转换: {filename} -> {csv_name}")
            except Exception as e:
                failed += 1
                failed_files.append(filename)
                logger.error(f"[csv] 转换失败: {filename}, 错误: {str(e)}")

            percent = 5 + int(85 * (i + 1) / total)
            update_progress(task_id, percent, f'正在转换', f'已处理 {i+1}/{total}：{filename}')

        generated_files = [fname for fname in os.listdir(task_tmp_dir) if os.path.isfile(os.path.join(task_tmp_dir, fname))]
        if not generated_files:
            shutil.rmtree(task_tmp_dir, ignore_errors=True)
            fail_task(
                task_id,
                '未生成任何 CSV 结果文件，请检查源文件内容或格式',
                converted=converted,
                failed=failed,
                failed_files=failed_files
            )
            return

        # 打包成 ZIP
        update_progress(task_id, 92, '正在打包', f'共 {converted} 个 CSV 文件')
        zip_filename = f'CSV转换结果_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
        zip_path = os.path.join(CSV_DIR, zip_filename)

        with zf.ZipFile(zip_path, 'w', zf.ZIP_DEFLATED) as zipf:
            for fname in generated_files:
                zipf.write(os.path.join(task_tmp_dir, fname), fname)

        shutil.rmtree(task_tmp_dir, ignore_errors=True)

        result = {
            'success': True,
            'mode': 'csv',
            'total_files': total,
            'converted': converted,
            'failed': failed,
            'failed_files': failed_files,
            'output_file': zip_filename,
            'elapsed_time': get_task_elapsed_time(task_id)
        }

        with progress_lock:
            progress_store[task_id]['result'] = result

        update_progress(task_id, 100, '处理完成', f'成功转换 {converted}/{total} 个文件', preserve_result=True)
        log_task_event(
            task_id,
            'success',
            file_name=zip_filename,
            record_count=converted,
            details=f'处理文件数: {converted}/{total}；失败文件数: {failed}'
        )
        logger.info(f"[csv] 转换完成: {zip_filename}")

    except Exception as e:
        logger.error(f"[csv] 转换失败: {str(e)}", exc_info=True)
        fail_task(task_id, str(e))


@data_process_bp.route('/api/data-process/csv-convert', methods=['POST'])
def csv_convert():
    """启动 CSV 转换任务"""
    try:
        data = request.json or {}
        dir_path = normalize_directory_path(data.get('dirPath', ''))
        selected_files = normalize_selected_files(data.get('selectedFiles'))

        if not dir_path:
            return jsonify({'success': False, 'error': '请输入目录路径'}), 400
        if not os.path.exists(dir_path):
            return jsonify({'success': False, 'error': f'目录不存在: {dir_path}'}), 400
        if not os.path.isdir(dir_path):
            return jsonify({'success': False, 'error': '路径不是目录'}), 400

        task_id = str(uuid.uuid4())
        set_task_log_context(
            task_id,
            'CSV 转换',
            details=merge_log_details(
                f'目录: {dir_path}',
                f'选中文件数: {len(selected_files)}'
            )
        )
        log_task_event(task_id, 'start')
        update_progress(task_id, 0, '任务已创建', '准备转换...')

        thread = threading.Thread(
            target=process_csv_convert,
            args=(dir_path, task_id, selected_files),
            daemon=True
        )
        thread.start()

        return jsonify({'success': True, 'task_id': task_id})

    except Exception as e:
        logger.error(f"[csv] 启动失败: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@data_process_bp.route('/api/data-process/download/csv/<filename>', methods=['GET'])
def download_csv(filename):
    """下载 CSV 转换结果"""
    try:
        try:
            file_path, safe_filename = resolve_download_path(CSV_DIR, filename)
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        return send_file(file_path, as_attachment=True, download_name=safe_filename)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== 数据去重 ====================

def process_deduplicate(dir_path, output_name, task_id, selected_files=None):
    """批量数据去重：扫描目录中的Excel文件，按整行完全相同去重"""
    import pandas as pd
    import zipfile as zf

    start_time = time.time()
    tmp_dir = os.path.join(DEDUP_DIR, task_id)
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        update_progress(task_id, 2, '正在扫描目录', f'目录: {dir_path}')

        excel_files = collect_excel_files(dir_path, selected_files)

        total_files = len(excel_files)
        if total_files == 0:
            error_message = '未选中有效 Excel 文件' if selected_files else '目录下未找到 Excel 文件'
            fail_task(task_id, error_message)
            return

        update_progress(task_id, 5, f'找到 {total_files} 个 Excel 文件', '开始去重...')
        logger.info(f"[dedup] 找到 {total_files} 个 Excel 文件，目录: {dir_path}")

        processed = 0
        failed = 0
        failed_files = []
        total_original_rows = 0
        total_dedup_rows = 0
        details = []
        used_output_names = set()

        for i, excel_path in enumerate(excel_files):
            filename = os.path.basename(excel_path)
            source_stem = build_relative_output_stem(excel_path, dir_path)
            output_filename = make_unique_name(f"{source_stem}_去重.xlsx", used_output_names)
            output_path = os.path.join(tmp_dir, output_filename)

            try:
                # 仅处理第一个Sheet，保持与CSV转换逻辑一致
                df = pd.read_excel(excel_path, sheet_name=0, engine=get_excel_read_engine(excel_path))
                original_rows = len(df)
                dedup_df = df.drop_duplicates(keep='first')
                dedup_rows = len(dedup_df)
                removed_rows = original_rows - dedup_rows

                # 空表也照常输出，保证结果可追溯
                dedup_df.to_excel(output_path, index=False, engine='openpyxl')

                total_original_rows += original_rows
                total_dedup_rows += dedup_rows
                processed += 1
                details.append({
                    'file': filename,
                    'original_rows': original_rows,
                    'dedup_rows': dedup_rows,
                    'removed_rows': removed_rows
                })
                logger.info(f"[dedup] 已处理: {filename}, 原始{original_rows}, 去重后{dedup_rows}, 删除{removed_rows}")
            except Exception as e:
                failed += 1
                failed_files.append(filename)
                logger.error(f"[dedup] 处理失败: {filename}, 错误: {str(e)}")

            percent = 5 + int(85 * (i + 1) / total_files)
            update_progress(task_id, percent, '正在去重', f'已处理 {i + 1}/{total_files}：{filename}')

        generated_files = [fname for fname in os.listdir(tmp_dir) if os.path.isfile(os.path.join(tmp_dir, fname))]
        if not generated_files:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            fail_task(
                task_id,
                '未生成任何去重结果文件，请检查源文件内容或格式',
                processed=processed,
                failed=failed,
                failed_files=failed_files
            )
            return

        update_progress(task_id, 93, '正在打包结果', f'成功处理 {processed} 个文件')
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_output_name = (output_name or '数据去重结果').strip()
        safe_output_name = re.sub(r'[\\/:*?"<>|]+', '_', safe_output_name)
        if not safe_output_name:
            safe_output_name = '数据去重结果'
        zip_filename = f"{safe_output_name}_{timestamp}.zip"
        zip_path = os.path.join(DEDUP_DIR, zip_filename)

        with zf.ZipFile(zip_path, 'w', zf.ZIP_DEFLATED) as zipf:
            for fname in generated_files:
                zipf.write(os.path.join(tmp_dir, fname), fname)

        shutil.rmtree(tmp_dir, ignore_errors=True)

        removed_total = total_original_rows - total_dedup_rows
        duplicate_rate = (removed_total / total_original_rows * 100) if total_original_rows > 0 else 0
        result = {
            'success': True,
            'mode': 'dedup',
            'total_files': total_files,
            'processed': processed,
            'failed': failed,
            'failed_files': failed_files,
            'original_rows': total_original_rows,
            'dedup_rows': total_dedup_rows,
            'removed_rows': removed_total,
            'duplicate_rate': round(duplicate_rate, 2),
            'output_file': zip_filename,
            'elapsed_time': round(time.time() - start_time, 2),
            'details': details[:50]
        }

        with progress_lock:
            progress_store[task_id]['result'] = result

        update_progress(task_id, 100, '处理完成', f'成功处理 {processed}/{total_files} 个文件', preserve_result=True)
        log_task_event(
            task_id,
            'success',
            file_name=zip_filename,
            record_count=total_dedup_rows,
            details=f'处理文件数: {processed}/{total_files}；删除重复行: {removed_total}；失败文件数: {failed}'
        )
        logger.info(f"[dedup] 去重完成: {zip_filename}, 原始{total_original_rows}, 去重后{total_dedup_rows}, 删除{removed_total}")
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.error(f"[dedup] 去重失败: {str(e)}", exc_info=True)
        fail_task(task_id, str(e))


@data_process_bp.route('/api/data-process/deduplicate', methods=['POST'])
def deduplicate_data():
    """启动批量数据去重任务（目录模式）"""
    try:
        data = request.get_json() if request.is_json else request.form
        dir_path = normalize_directory_path(data.get('dirPath'))
        selected_files = normalize_selected_files(data.get('selectedFiles'))
        output_name = (data.get('outputName') or '数据去重结果').strip()

        if not dir_path:
            return jsonify({'success': False, 'error': '请输入目录路径'}), 400
        if not os.path.exists(dir_path):
            return jsonify({'success': False, 'error': f'目录不存在: {dir_path}'}), 400
        if not os.path.isdir(dir_path):
            return jsonify({'success': False, 'error': '路径不是目录'}), 400

        task_id = str(uuid.uuid4())
        set_task_log_context(
            task_id,
            '数据去重',
            file_name=output_name,
            details=merge_log_details(
                f'目录: {dir_path}',
                f'选中文件数: {len(selected_files)}'
            )
        )
        log_task_event(task_id, 'start')
        update_progress(task_id, 0, '任务已创建', '准备去重...')

        thread = threading.Thread(
            target=process_deduplicate,
            args=(dir_path, output_name, task_id, selected_files),
            daemon=True
        )
        thread.start()

        return jsonify({'success': True, 'task_id': task_id, 'message': '去重任务已启动'})
    except Exception as e:
        logger.error(f"[dedup] 启动失败: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500
