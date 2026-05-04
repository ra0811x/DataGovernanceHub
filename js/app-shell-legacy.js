/**
 * Legacy shell restored from backup snapshot 0422new.
 * 当前仅恢复 device / merge / file 及通用兼容入口，避免覆盖现有 reporting 拆分结果。
 */

// API配置 - 自动使用当前页面的域名
var API_BASE = window.API_BASE || (window.location.origin + '/api');
window.API_BASE = API_BASE;

// 全局状态
let columns = [];
let currentPage = 1;
let pageSize = 50;
let pendingPageSize = 50;  // 待保存的每页显示数量
let totalRecords = 0;
let currentCategory = '';  // 当前模式: '', 'SMC', '业支', '信安'
let editingId = null;
let currentData = [];  // 保存当前数据
let pendingImportFile = null;  // 待导入的文件
let pendingImportData = null;  // 待导入的数据预览
let sourceFile = '';  // 数据来源文件
let headerHeight = 40;  // 标题行高度
let pendingHeaderHeight = 40;  // 待保存的标题行高度
let allConfigs = {};  // 所有模式的配置 { '全部': {...}, 'SMC': {...}, ... }
let actionColumnConfig = { width: 120, color: '#495057' };  // 操作列配置
let dataRequestId = 0;  // 数据请求序号，用于处理竞态条件

// ==================== V3 三层架构系统说明 ====================
/**
 * 本页面使用三层架构配置系统（ThreeLayerArchitecture）
 * 详见：js/three-layer-architecture.js
 *
 * 第1层：操作类型（read/calculate/lookup）
 * 第2层：数据源/逻辑（根据操作类型动态显示）
 * 第3层：详细配置（字段索引、条件规则等）
 *
 * 使用方法：
 * ThreeLayerArchitecture.getOperations() - 获取所有操作类型
 * ThreeLayerArchitecture.getSourcesByOperation(operation) - 获取数据源列表
 * ThreeLayerArchitecture.renderSourceConfig() - 渲染数据来源配置
 * ThreeLayerArchitecture.renderProcessConfig() - 渲染数据处理配置
 */

// ==================== 合并结果页面状态 ====================
let columns2 = [];
let currentPage2 = 1;
let pageSize2 = 100;
let pendingPageSize2 = 100;
let totalRecords2 = 0;
let currentData2 = [];
let editingId2 = null;
let sourceFile2 = '';
let headerHeight2 = 40;
let pendingHeaderHeight2 = 40;
let headerColor2 = '#6c757d';  // 标题颜色
let actionColumnConfig2 = { width: 120, color: '#6c757d' };
let currentCategory2 = '';  // 当前分类
let dataRequestId2 = 0;  // 数据请求序号，用于处理竞态条件
let isLoadingMergeData = false;  // 防止重复加载
let isMergeColumnsLoaded = false;  // 列配置是否已加载
const advancedFilterState = {
    device: null,
    merge: null
};
let mergeSourceNameStatsState = {
    items: [],
    totalRecords: 0,
    distinctCount: 0,
    nonEmptyDistinctCount: 0,
    emptyCount: 0
};
let mergeSourceLevelMatrixState = {
    items: [],
    totalRecords: 0,
    sourceCount: 0,
    levelTotals: [],
    scope: 'all'
};
function getDefaultMergeExportSamplingConfig() {
    return {
        enabled: false,
        rounding: 'floor',
        keep_at_least_one: true,
        include_unmatched: false,
        rules: []
    };
}

function getDefaultMergeFineScopePolicy() {
    return {
        enabled: false,
        max_target_rows: 950000,
        tolerance_rows: 50000,
        manual_ratio_enabled: false,
        manual_ratio: 0,
        target_mode: 'max_plus_tolerance',
        small_source_threshold: 10000,
        rounding: 'largest_remainder',
        keep_at_least_one_when_nonzero: false,
        fallback_when_small_exceeds_max: 'warn_only'
    };
}

function getDefaultMergeStandardizeDraft() {
    return {
        source_name: '',
        ratio_1: 40,
        ratio_2: 30,
        ratio_3: 20,
        ratio_4: 10
    };
}
let mergeToolboxState = {
    activeTab: 'stats',
    cleaningFieldIndex: 10,
    cleaningScope: 'all',
    cleaningPreview: null,
    fineScopePolicy: getDefaultMergeFineScopePolicy(),
    fineScopePreview: null,
    matrixScope: 'all',
    matrixSamplingConfig: getDefaultMergeExportSamplingConfig(),
    matrixRuleMode: 'fine',
    matrixFineRulesDraft: [],
    matrixStandardizeDraft: getDefaultMergeStandardizeDraft(),
    matrixStandardizeGeneratedRules: []
};
const defaultExportScopeConfigState = {
    config: {
        assets: { enabled: false, mode: 'all', value: 0 },
        merge_results: { enabled: false, mode: 'all', value: 0 }
    },
    sourceTotals: {
        assets: 0,
        merge_results: 0
    }
};
let exportScopeConfigState = JSON.parse(JSON.stringify(defaultExportScopeConfigState));

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
        const entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return entityMap[char] || char;
    });
}

function getAdvancedFilterColumns(pageType) {
    const sourceColumns = pageType === 'merge' ? columns2 : columns;
    return (sourceColumns || [])
        .filter(col => col && col.name && String(col.name).trim() && String(col.name).toLowerCase() !== 'id')
        .map(col => ({
            value: String(col.name),
            label: String(col.name)
        }));
}

function getAdvancedFilterOperatorLabel(operator) {
    const labelMap = {
        contains: '包含',
        equals: '等于',
        not_contains: '不包含',
        not_equals: '不等于',
        is_empty: '为空',
        not_empty: '不为空'
    };
    return labelMap[operator] || operator;
}

function syncAdvancedFilterWithColumns(pageType) {
    const filter = advancedFilterState[pageType];
    if (!filter) {
        renderAdvancedFilterSummary(pageType);
        return;
    }

    const availableColumns = getAdvancedFilterColumns(pageType);
    const matchedColumn = availableColumns.find(col => col.value === filter.field);

    if (!matchedColumn) {
        advancedFilterState[pageType] = null;
    } else {
        filter.fieldLabel = matchedColumn.label;
    }

    renderAdvancedFilterSummary(pageType);
}

function renderAdvancedFilterSummary(pageType) {
    const summaryId = pageType === 'merge' ? 'mergeAdvancedFilterSummary' : 'deviceAdvancedFilterSummary';
    const summaryEl = document.getElementById(summaryId);
    const filter = advancedFilterState[pageType];

    if (!summaryEl) return;

    if (!filter) {
        summaryEl.style.display = 'none';
        summaryEl.innerHTML = '';
        return;
    }

    const operatorLabel = getAdvancedFilterOperatorLabel(filter.operator);
    const suffix = ['is_empty', 'not_empty'].includes(filter.operator)
        ? ''
        : '：' + escapeHtml(filter.value);

    summaryEl.style.display = 'flex';
    summaryEl.style.alignItems = 'center';
    summaryEl.style.gap = '8px';
    summaryEl.style.flexWrap = 'wrap';
    summaryEl.innerHTML = `
                <div style="display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(0, 95, 224, 0.16); background: linear-gradient(135deg, rgba(232, 243, 255, 0.96) 0%, rgba(216, 233, 255, 0.92) 100%); color: #0b4b9f; font-size: 12px; box-shadow: 0 10px 24px rgba(0, 95, 224, 0.08);">
                    <span style="font-weight: 700;">当前高级筛选</span>
                    <span>${escapeHtml(filter.fieldLabel || filter.field)} ${operatorLabel}${suffix}</span>
                </div>
                <button class="btn btn-sm" type="button" onclick="clearAdvancedFilter('${pageType}')">清除</button>
            `;
}

function getAdvancedFilterModalPageType() {
    const pageTypeInput = document.getElementById('advancedFilterPageType');
    return pageTypeInput ? pageTypeInput.value : 'device';
}

function handleAdvancedFilterOverlayClick(event) {
    if (event.target && event.target.id === 'advancedFilterModal') {
        closeAdvancedFilterModal();
    }
}

function syncAdvancedFilterInputState() {
    const operatorEl = document.getElementById('advancedFilterOperator');
    const valueEl = document.getElementById('advancedFilterValue');
    if (!operatorEl || !valueEl) return;

    const requiresValue = !['is_empty', 'not_empty'].includes(operatorEl.value);
    valueEl.disabled = !requiresValue;
    valueEl.placeholder = requiresValue ? '输入筛选值' : '当前条件无需输入值';

    if (!requiresValue) {
        valueEl.value = '';
    }
}

function openAdvancedFilter(pageType) {
    const availableColumns = getAdvancedFilterColumns(pageType);
    if (!availableColumns.length) {
        showToast('当前没有可供筛选的列，请先加载列配置', true);
        return;
    }

    closeAdvancedFilterModal();

    const currentFilter = advancedFilterState[pageType] || {};
    const selectedField = currentFilter.field && availableColumns.some(col => col.value === currentFilter.field)
        ? currentFilter.field
        : availableColumns[0].value;
    const selectedOperator = currentFilter.operator || 'contains';
    const selectedValue = currentFilter.value || '';
    const title = pageType === 'merge' ? '合并结果高级筛选' : '数据概览高级筛选';
    const themeStart = pageType === 'merge' ? '#0f4fa8' : '#1459c5';
    const themeEnd = pageType === 'merge' ? '#2d86ff' : '#5aa9ff';
    const fieldOptions = availableColumns.map(col => `
                <option value="${escapeHtml(col.value)}" ${col.value === selectedField ? 'selected' : ''}>${escapeHtml(col.label)}</option>
            `).join('');

    document.body.insertAdjacentHTML('beforeend', `
                <div class="modal-overlay show" id="advancedFilterModal" onclick="handleAdvancedFilterOverlayClick(event)" style="z-index: 10020;">
                    <div class="modal-content" style="width: min(640px, 92vw); max-width: 640px; max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                        <div class="modal-header" style="padding: 20px 24px; border-bottom: none; background: linear-gradient(135deg, ${themeStart} 0%, ${themeEnd} 100%); color: #fff;">
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">${title}</h3>
                                <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">选择单个列设置筛选条件，结果会继续展示整行其他列。</div>
                            </div>
                            <button class="modal-close" type="button" onclick="closeAdvancedFilterModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
                        </div>
                        <div class="modal-body" style="padding: 24px; display: grid; gap: 14px;">
                            <input type="hidden" id="advancedFilterPageType" value="${pageType}">
                            <div class="form-group">
                                <label>筛选列</label>
                                <select id="advancedFilterField">${fieldOptions}</select>
                            </div>
                            <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 12px;">
                                <div class="form-group">
                                    <label>筛选条件</label>
                                    <select id="advancedFilterOperator" onchange="syncAdvancedFilterInputState()">
                                        <option value="contains" ${selectedOperator === 'contains' ? 'selected' : ''}>包含</option>
                                        <option value="equals" ${selectedOperator === 'equals' ? 'selected' : ''}>等于</option>
                                        <option value="not_contains" ${selectedOperator === 'not_contains' ? 'selected' : ''}>不包含</option>
                                        <option value="not_equals" ${selectedOperator === 'not_equals' ? 'selected' : ''}>不等于</option>
                                        <option value="is_empty" ${selectedOperator === 'is_empty' ? 'selected' : ''}>为空</option>
                                        <option value="not_empty" ${selectedOperator === 'not_empty' ? 'selected' : ''}>不为空</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>筛选值</label>
                                    <input type="text" id="advancedFilterValue" value="${escapeHtml(selectedValue)}">
                                </div>
                            </div>
                            <div style="padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.65;">
                                说明：快速搜索和高级筛选当前按互斥方式工作。输入快速搜索会自动清除高级筛选，应用高级筛选时会自动清空快速搜索。
                            </div>
                        </div>
                        <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; align-items: center;">
                            <button class="btn" type="button" onclick="clearAdvancedFilterFromModal()">清除筛选</button>
                            <div class="modal-footer-right">
                                <button class="btn" type="button" onclick="closeAdvancedFilterModal()">取消</button>
                                <button class="btn btn-primary" type="button" onclick="applyAdvancedFilter()">应用筛选</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);

    syncAdvancedFilterInputState();

    const fieldEl = document.getElementById('advancedFilterField');
    if (fieldEl) {
        fieldEl.focus();
    }
}

function closeAdvancedFilterModal() {
    const modal = document.getElementById('advancedFilterModal');
    if (modal) {
        modal.remove();
    }
}

function clearAdvancedFilter(pageType) {
    const hasFilter = Boolean(advancedFilterState[pageType]);
    advancedFilterState[pageType] = null;
    renderAdvancedFilterSummary(pageType);

    if (!hasFilter) {
        return;
    }

    if (pageType === 'merge') {
        currentPage2 = 1;
        loadMergeData();
    } else {
        currentPage = 1;
        loadData();
    }
}

function clearAdvancedFilterFromModal() {
    const pageType = getAdvancedFilterModalPageType();
    closeAdvancedFilterModal();
    clearAdvancedFilter(pageType);
}

function applyAdvancedFilter() {
    const pageType = getAdvancedFilterModalPageType();
    const fieldEl = document.getElementById('advancedFilterField');
    const operatorEl = document.getElementById('advancedFilterOperator');
    const valueEl = document.getElementById('advancedFilterValue');

    if (!fieldEl || !operatorEl || !valueEl) {
        showToast('高级筛选表单未初始化完成', true);
        return;
    }

    const operator = operatorEl.value;
    const requiresValue = !['is_empty', 'not_empty'].includes(operator);
    const value = requiresValue ? valueEl.value.trim() : '';

    if (requiresValue && !value) {
        showToast('请输入筛选值', true);
        valueEl.focus();
        return;
    }

    const field = fieldEl.value;
    const fieldLabel = fieldEl.options[fieldEl.selectedIndex]?.text || field;
    advancedFilterState[pageType] = {
        field,
        fieldLabel,
        operator,
        value
    };

    const searchInputId = pageType === 'merge' ? 'searchInput2' : 'searchInput';
    const searchInput = document.getElementById(searchInputId);
    if (searchInput) {
        searchInput.value = '';
    }

    renderAdvancedFilterSummary(pageType);
    closeAdvancedFilterModal();

    if (pageType === 'merge') {
        currentPage2 = 1;
        loadMergeData();
    } else {
        currentPage = 1;
        loadData();
    }
}

function formatMergeSourceNameStatNumber(value) {
    const parsedValue = Number(value) || 0;
    return parsedValue.toLocaleString('zh-CN');
}

function getCurrentMergeSourceNameStatsPayload() {
    const searchInput = document.getElementById('searchInput2');
    return {
        search: searchInput ? searchInput.value.trim() : '',
        category: currentCategory2 || '',
        advanced_filter: advancedFilterState.merge ? { ...advancedFilterState.merge } : null
    };
}

function getMergeSourceNameStatsScopeText() {
    const searchInput = document.getElementById('searchInput2');
    const searchValue = searchInput ? searchInput.value.trim() : '';
    const filter = advancedFilterState.merge;

    if (filter) {
        const operatorLabel = getAdvancedFilterOperatorLabel(filter.operator);
        const suffix = ['is_empty', 'not_empty'].includes(filter.operator)
            ? ''
            : `：${filter.value || ''}`;
        return `当前统计基于高级筛选：${filter.fieldLabel || filter.field} ${operatorLabel}${suffix}`;
    }

    if (searchValue) {
        return `当前统计基于快速搜索：${searchValue}`;
    }

    return '当前统计基于全部合并结果数据';
}

function getCurrentMergeToolboxPayload(scope = 'all') {
    if (scope === 'current_filter') {
        return getCurrentMergeSourceNameStatsPayload();
    }
    return {};
}

function getCurrentMergeMatrixPayload(scope = 'all') {
    return {
        ...getCurrentMergeToolboxPayload(scope),
        scope
    };
}

function getMergeSourceLevelMatrixScopeText(scope = 'all') {
    if (scope === 'current_filter') {
        return getMergeSourceNameStatsScopeText();
    }
    return '当前统计基于全部合并结果数据';
}

function normalizeMergeExportSamplingRule(rule) {
    const sourceName = String(rule?.source_name || '').trim();
    const levelName = String(rule?.level_name || '').trim();
    const mode = ['all', 'top_n', 'percent'].includes(rule?.mode) ? rule.mode : 'all';
    let value = 0;
    if (mode === 'percent') {
        value = Number(rule?.value);
        if (!Number.isFinite(value)) value = 0;
        value = Math.max(0, Math.min(100, value));
    } else {
        value = Number(rule?.value);
        if (!Number.isFinite(value)) value = 0;
        value = Math.max(0, Math.floor(value));
    }
    return {
        source_name: sourceName,
        level_name: levelName,
        mode,
        value
    };
}

function normalizeMergeExportSamplingConfig(config) {
    const base = getDefaultMergeExportSamplingConfig();
    const rounding = ['floor', 'round'].includes(config?.rounding) ? config.rounding : 'floor';
    const rawRules = Array.isArray(config?.rules) ? config.rules : [];
    const dedupMap = new Map();
    rawRules.forEach((item) => {
        const rule = normalizeMergeExportSamplingRule(item);
        if (!rule.level_name) return;
        const key = `${rule.source_name}|||${rule.level_name}`;
        dedupMap.set(key, rule);
    });

    return {
        ...base,
        enabled: Boolean(config?.enabled),
        rounding,
        keep_at_least_one: config?.keep_at_least_one !== false,
        include_unmatched: config?.include_unmatched === true,
        rules: Array.from(dedupMap.values())
    };
}

async function loadMergeExportSamplingConfig() {
    // 分布筛选功能已停用：前端仅保留默认态，避免再请求已下线接口
    mergeToolboxState.matrixSamplingConfig = getDefaultMergeExportSamplingConfig();
    mergeToolboxState.matrixFineRulesDraft = [];
    mergeToolboxState.matrixStandardizeGeneratedRules = [];
    renderMergeExportSamplingConfig();
}

function normalizeMergeFineScopePolicy(policy) {
    const base = getDefaultMergeFineScopePolicy();
    const source = policy && typeof policy === 'object' ? policy : {};
    const normalized = { ...base };

    normalized.enabled = Boolean(source.enabled);
    const maxTargetRows = Number.parseInt(source.max_target_rows, 10);
    if (Number.isFinite(maxTargetRows) && maxTargetRows > 0) {
        normalized.max_target_rows = maxTargetRows;
    }
    const toleranceRows = Number.parseInt(source.tolerance_rows, 10);
    if (Number.isFinite(toleranceRows) && toleranceRows >= 0) {
        normalized.tolerance_rows = toleranceRows;
    }
    normalized.manual_ratio_enabled = Boolean(source.manual_ratio_enabled);
    const manualRatio = Number.parseFloat(source.manual_ratio);
    if (Number.isFinite(manualRatio)) {
        normalized.manual_ratio = Math.max(0, Math.min(1, manualRatio));
    }
    normalized.target_mode = 'max_plus_tolerance';

    const smallThreshold = Number.parseInt(source.small_source_threshold, 10);
    if (Number.isFinite(smallThreshold) && smallThreshold >= 0) {
        normalized.small_source_threshold = smallThreshold;
    }

    normalized.rounding = String(source.rounding || base.rounding) === 'floor'
        ? 'floor'
        : 'largest_remainder';
    normalized.keep_at_least_one_when_nonzero = source.keep_at_least_one_when_nonzero !== false;
    normalized.fallback_when_small_exceeds_max =
        String(source.fallback_when_small_exceeds_max || '').trim().toLowerCase() === 'compress_all'
            ? 'compress_all'
            : 'warn_only';

    return normalized;
}

function collectMergeFineScopePolicyFromInputs() {
    const enabledEl = document.getElementById('mergeFineScopeEnabled');
    const maxTargetRowsEl = document.getElementById('mergeFineScopeMaxTargetRows');
    const toleranceRowsEl = document.getElementById('mergeFineScopeToleranceRows');
    const manualRatioEnabledEl = document.getElementById('mergeFineScopeManualRatioEnabled');
    const manualRatioEl = document.getElementById('mergeFineScopeManualRatio');
    const thresholdEl = document.getElementById('mergeFineScopeSmallThreshold');
    const roundingEl = document.getElementById('mergeFineScopeRounding');
    const keepOneEl = document.getElementById('mergeFineScopeKeepOne');
    const fallbackEl = document.getElementById('mergeFineScopeFallback');

    return normalizeMergeFineScopePolicy({
        ...mergeToolboxState.fineScopePolicy,
        enabled: enabledEl ? enabledEl.checked : mergeToolboxState.fineScopePolicy.enabled,
        max_target_rows: maxTargetRowsEl ? maxTargetRowsEl.value : mergeToolboxState.fineScopePolicy.max_target_rows,
        tolerance_rows: toleranceRowsEl ? toleranceRowsEl.value : mergeToolboxState.fineScopePolicy.tolerance_rows,
        manual_ratio_enabled: manualRatioEnabledEl ? manualRatioEnabledEl.checked : mergeToolboxState.fineScopePolicy.manual_ratio_enabled,
        manual_ratio: manualRatioEl ? manualRatioEl.value : mergeToolboxState.fineScopePolicy.manual_ratio,
        target_mode: 'max_plus_tolerance',
        small_source_threshold: thresholdEl ? thresholdEl.value : mergeToolboxState.fineScopePolicy.small_source_threshold,
        rounding: roundingEl ? roundingEl.value : mergeToolboxState.fineScopePolicy.rounding,
        keep_at_least_one_when_nonzero: keepOneEl ? keepOneEl.checked : mergeToolboxState.fineScopePolicy.keep_at_least_one_when_nonzero,
        fallback_when_small_exceeds_max: fallbackEl ? fallbackEl.value : mergeToolboxState.fineScopePolicy.fallback_when_small_exceeds_max
    });
}

function syncMergeFineScopeManualRatioUi() {
    const manualRatioEnabledEl = document.getElementById('mergeFineScopeManualRatioEnabled');
    const manualRatioEl = document.getElementById('mergeFineScopeManualRatio');
    const autoRatioEl = document.getElementById('mergeFineScopeAutoRatio');
    const hasAutoRatio = autoRatioEl && autoRatioEl.value && autoRatioEl.value !== '--';
    const enabled = manualRatioEnabledEl ? manualRatioEnabledEl.checked : false;
    if (manualRatioEnabledEl) {
        manualRatioEnabledEl.disabled = !hasAutoRatio;
    }
    if (manualRatioEl) {
        manualRatioEl.disabled = !(hasAutoRatio && enabled);
        manualRatioEl.style.opacity = manualRatioEl.disabled ? '0.7' : '1';
    }
}

function syncMergeFineScopePolicyInputs() {
    const policy = normalizeMergeFineScopePolicy(mergeToolboxState.fineScopePolicy);
    mergeToolboxState.fineScopePolicy = policy;

    const enabledEl = document.getElementById('mergeFineScopeEnabled');
    const maxTargetRowsEl = document.getElementById('mergeFineScopeMaxTargetRows');
    const toleranceRowsEl = document.getElementById('mergeFineScopeToleranceRows');
    const autoRatioEl = document.getElementById('mergeFineScopeAutoRatio');
    const manualRatioEnabledEl = document.getElementById('mergeFineScopeManualRatioEnabled');
    const manualRatioEl = document.getElementById('mergeFineScopeManualRatio');
    const thresholdEl = document.getElementById('mergeFineScopeSmallThreshold');
    const roundingEl = document.getElementById('mergeFineScopeRounding');
    const keepOneEl = document.getElementById('mergeFineScopeKeepOne');
    const fallbackEl = document.getElementById('mergeFineScopeFallback');

    if (enabledEl) enabledEl.checked = policy.enabled;
    if (maxTargetRowsEl) maxTargetRowsEl.value = String(policy.max_target_rows);
    if (toleranceRowsEl) toleranceRowsEl.value = String(policy.tolerance_rows);
    if (autoRatioEl) {
        const autoRatio = Number(mergeToolboxState.fineScopePreview?.summary?.auto_ratio);
        autoRatioEl.value = Number.isFinite(autoRatio) ? autoRatio.toFixed(6) : '--';
    }
    if (manualRatioEnabledEl) manualRatioEnabledEl.checked = Boolean(policy.manual_ratio_enabled);
    if (manualRatioEl) manualRatioEl.value = String(policy.manual_ratio);
    if (thresholdEl) thresholdEl.value = String(policy.small_source_threshold);
    if (roundingEl) roundingEl.value = policy.rounding;
    if (keepOneEl) keepOneEl.checked = policy.keep_at_least_one_when_nonzero;
    if (fallbackEl) fallbackEl.value = policy.fallback_when_small_exceeds_max;
    syncMergeFineScopeManualRatioUi();
}

function renderMergeFineScopeStatusCard(policy, previewResult, errorMessage = '') {
    const cardEl = document.getElementById('mergeFineScopeStatusCard');
    if (!cardEl) return;

    if (errorMessage) {
        cardEl.style.borderColor = 'rgba(220, 38, 38, 0.24)';
        cardEl.style.background = 'linear-gradient(180deg, rgba(254, 242, 242, 0.98) 0%, rgba(254, 226, 226, 0.96) 100%)';
        cardEl.style.whiteSpace = 'nowrap';
        cardEl.innerHTML = `<span style="font-weight: 700; color: #b91c1c;">精细化筛减：状态异常</span><span style="margin-left: 14px; color: #7f1d1d;">预估导出总量：-- 行</span>`;
        return;
    }

    const resolvedPolicy = normalizeMergeFineScopePolicy(policy || {});
    const summary = (previewResult && previewResult.summary) || {};
    const totalBefore = Number(summary.total_before || 0);
    const totalAfter = Number(summary.total_after || 0);
    const exportRows = totalAfter > 0 ? totalAfter : (totalBefore > 0 ? totalBefore : totalRecords2);
    const statusText = resolvedPolicy.enabled ? '已启用' : '未启用';

    cardEl.style.whiteSpace = 'nowrap';
    cardEl.style.overflow = 'hidden';
    cardEl.style.textOverflow = 'ellipsis';
    if (resolvedPolicy.enabled) {
        cardEl.style.borderColor = 'rgba(18, 92, 196, 0.22)';
        cardEl.style.background = 'linear-gradient(180deg, rgba(236, 246, 255, 0.98) 0%, rgba(223, 239, 255, 0.96) 100%)';
    } else {
        cardEl.style.borderColor = 'rgba(107, 114, 128, 0.22)';
        cardEl.style.background = 'linear-gradient(180deg, rgba(249, 250, 251, 0.98) 0%, rgba(243, 244, 246, 0.96) 100%)';
    }
    cardEl.innerHTML = `
        <span style="font-weight: 700; color: #123f85;">精细化筛减：${escapeHtml(statusText)}</span>
        <span style="margin-left: 14px; font-weight: 700; color: #0f3f80;">预估导出总量：${formatMergeSourceNameStatNumber(exportRows || 0)} 行</span>
    `;
}

async function refreshMergeFineScopeStatusCard(options = {}) {
    const cardEl = document.getElementById('mergeFineScopeStatusCard');
    if (!cardEl) return;

    const showLoading = options.showLoading === true;
    const silent = options.silent !== false;
    if (showLoading) {
        cardEl.style.borderColor = 'rgba(18, 92, 196, 0.14)';
        cardEl.style.background = 'linear-gradient(180deg, rgba(246, 250, 255, 0.98) 0%, rgba(239, 246, 255, 0.96) 100%)';
        cardEl.innerHTML = '正在加载精细化筛减状态...';
    }

    try {
        const policyResponse = await fetch(API_BASE + '/merge/fine-scope-policy');
        const policyResult = await policyResponse.json();
        if (!policyResponse.ok || policyResult.success === false) {
            throw new Error(policyResult.error || '读取精细化筛减参数失败');
        }

        const policy = normalizeMergeFineScopePolicy(policyResult.policy || {});
        mergeToolboxState.fineScopePolicy = policy;

        const previewResponse = await fetch(API_BASE + '/merge/fine-scope-policy/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policy })
        });
        const previewResult = await previewResponse.json();
        if (!previewResponse.ok || previewResult.success === false) {
            throw new Error(previewResult.error || '读取精细化筛减预演失败');
        }

        mergeToolboxState.fineScopePreview = previewResult;
        renderMergeFineScopeStatusCard(policy, previewResult);
    } catch (error) {
        console.error('刷新精细化筛减状态卡失败:', error);
        renderMergeFineScopeStatusCard(null, null, error.message || '状态加载失败');
        if (!silent) {
            showToast('精细化筛减状态加载失败: ' + error.message, true);
        }
    }
}

function renderMergeFineScopePreview(previewResult) {
    const summaryEl = document.getElementById('mergeFineScopeSummary');
    const listEl = document.getElementById('mergeFineScopeList');
    if (!summaryEl || !listEl) return;

    const result = previewResult || {};
    const summary = result.summary || {};
    const items = Array.isArray(result.items) ? result.items : [];
    const statusLabelMap = {
        no_change: '未启用筛减',
        in_range: '命中目标区间',
        below_range: '低于目标区间',
        above_range: '高于目标区间',
        compressed: '已按策略压缩'
    };
    const statusLabel = statusLabelMap[result.status] || String(result.status || '-');
    const warningMessage = String(result.warning_message || '').trim();
    const maxTargetRows = Number(summary.max_target_rows || mergeToolboxState.fineScopePolicy?.max_target_rows || 0);
    const toleranceRows = Number(summary.tolerance_rows || mergeToolboxState.fineScopePolicy?.tolerance_rows || 0);
    const autoRatio = Number(summary.auto_ratio || 0);
    const appliedRatio = Number(summary.applied_ratio || 0);
    const manualEnabled = Boolean(summary.manual_ratio_enabled || mergeToolboxState.fineScopePolicy?.manual_ratio_enabled);
    const manualRatio = Number(summary.manual_ratio || mergeToolboxState.fineScopePolicy?.manual_ratio || 0);
    const autoRatioEl = document.getElementById('mergeFineScopeAutoRatio');
    if (autoRatioEl) {
        autoRatioEl.value = Number.isFinite(autoRatio) ? autoRatio.toFixed(6) : '--';
    }
    syncMergeFineScopeManualRatioUi();
    renderMergeFineScopeStatusCard(mergeToolboxState.fineScopePolicy, result);

    summaryEl.innerHTML = `
                <div style="padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.7;">
                    <div>状态：${escapeHtml(statusLabel)}</div>
                    <div style="margin-top: 4px;">预计总量：${formatMergeSourceNameStatNumber(summary.total_before || 0)} -> ${formatMergeSourceNameStatNumber(summary.total_after || 0)}</div>
                    <div style="margin-top: 4px;">MAX：${formatMergeSourceNameStatNumber(maxTargetRows)}；容差：±${formatMergeSourceNameStatNumber(toleranceRows)}；目标区间：${formatMergeSourceNameStatNumber(summary.target_min || 0)} ~ ${formatMergeSourceNameStatNumber(summary.target_max || 0)}</div>
                    <div style="margin-top: 4px;">自动C：${autoRatio.toFixed(6)}；实际C：${appliedRatio.toFixed(6)}${manualEnabled ? `（手动C=${manualRatio.toFixed(6)}）` : '（自动）'}</div>
                    <div style="margin-top: 4px;">小源阈值：${formatMergeSourceNameStatNumber(summary.small_source_threshold || 0)}；小源总量：${formatMergeSourceNameStatNumber(summary.small_total || 0)}；大源总量：${formatMergeSourceNameStatNumber(summary.large_total || 0)}</div>
                    <div style="margin-top: 4px;">固定保留：${formatMergeSourceNameStatNumber(summary.fixed_total || 0)}；可调总量：${formatMergeSourceNameStatNumber(summary.adjustable_total || 0)}；压缩比例：${Number(summary.applied_ratio || 0).toFixed(6)}</div>
                    <div style="margin-top: 6px; color: ${warningMessage ? '#b45309' : '#6b7280'};">${warningMessage ? escapeHtml(warningMessage) : '仅预演，不修改数据库。'}</div>
                </div>
            `;

    if (!items.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 24px 20px;">当前没有可预演的数据</div>';
        return;
    }

    listEl.innerHTML = `
                <div style="border: 1px solid rgba(18, 92, 196, 0.12); border-radius: 12px; background: #fff;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 784px; table-layout: fixed; font-size: 12px; color: #355070;">
                        <colgroup>
                            <col style="width: 150px;">
                            <col style="width: 70px;">
                            <col style="width: 80px;">
                            <col style="width: 80px;">
                            <col style="width: 80px;">
                            <col style="width: 80px;">
                            <col style="width: 80px;">
                            <col style="width: 65px;">
                        </colgroup>
                        <thead>
                            <tr style="position: sticky; top: 0; background: #f4f8ff; z-index: 1;">
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">数据源名称</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">总量</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">1级 前/后</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">2级 前/后</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">3级 前/后</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">4级 前/后</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">保留/削减</th>
                                <th style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">削减比例</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item) => `
                                <tr>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.source_label || '')}">
                                        ${escapeHtml(item.source_label || '')}
                                        ${item.is_small_source ? '<span style="margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: rgba(19, 94, 196, 0.08); color: #135ec4;">小源</span>' : ''}
                                    </td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${formatMergeSourceNameStatNumber(item.source_total || 0)}</td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${formatMergeSourceNameStatNumber(item.level_1_before || 0)} / ${formatMergeSourceNameStatNumber(item.level_1_keep || 0)}</td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${formatMergeSourceNameStatNumber(item.level_2_before || 0)} / ${formatMergeSourceNameStatNumber(item.level_2_keep || 0)}</td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${formatMergeSourceNameStatNumber(item.level_3_before || 0)} / ${formatMergeSourceNameStatNumber(item.level_3_keep || 0)}</td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${formatMergeSourceNameStatNumber(item.level_4_before || 0)} / ${formatMergeSourceNameStatNumber(item.level_4_keep || 0)}</td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${formatMergeSourceNameStatNumber(item.keep_total || 0)} / ${formatMergeSourceNameStatNumber(item.cut_total || 0)}</td>
                                    <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${Number(item.cut_ratio || 0).toFixed(2)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
}

async function loadMergeFineScopePolicy(showError = false) {
    try {
        const response = await fetch(API_BASE + '/merge/fine-scope-policy');
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.error || '加载精细化筛减参数失败');
        }
        mergeToolboxState.fineScopePolicy = normalizeMergeFineScopePolicy(result.policy || {});
        syncMergeFineScopePolicyInputs();
        return mergeToolboxState.fineScopePolicy;
    } catch (error) {
        console.error('加载精细化筛减参数失败:', error);
        mergeToolboxState.fineScopePolicy = getDefaultMergeFineScopePolicy();
        syncMergeFineScopePolicyInputs();
        if (showError) {
            showToast('加载精细化筛减参数失败: ' + error.message, true);
        }
        return mergeToolboxState.fineScopePolicy;
    }
}

async function previewMergeFineScopePolicy() {
    const summaryEl = document.getElementById('mergeFineScopeSummary');
    const listEl = document.getElementById('mergeFineScopeList');
    if (summaryEl) {
        summaryEl.innerHTML = '<div class="loading" style="padding: 20px 12px;">正在计算预演结果...</div>';
    }
    if (listEl) {
        listEl.innerHTML = '';
    }

    try {
        const policy = collectMergeFineScopePolicyFromInputs();
        mergeToolboxState.fineScopePolicy = policy;
        const response = await fetch(API_BASE + '/merge/fine-scope-policy/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policy })
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.error || '精细化筛减预演失败');
        }
        mergeToolboxState.fineScopePreview = result;
        renderMergeFineScopePreview(result);
    } catch (error) {
        console.error('精细化筛减预演失败:', error);
        if (summaryEl) summaryEl.innerHTML = '';
        if (listEl) {
            listEl.innerHTML = `<div class="loading" style="padding: 20px 12px;">${escapeHtml(error.message || '预演失败')}</div>`;
        }
        showToast('精细化筛减预演失败: ' + error.message, true);
    }
}

async function saveMergeFineScopePolicy() {
    try {
        const policy = collectMergeFineScopePolicyFromInputs();
        const response = await fetch(API_BASE + '/merge/fine-scope-policy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policy })
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.error || '保存精细化筛减参数失败');
        }
        mergeToolboxState.fineScopePolicy = normalizeMergeFineScopePolicy(result.policy || policy);
        syncMergeFineScopePolicyInputs();
        showToast('精细化筛减参数已保存', false);
        await previewMergeFineScopePolicy();
        await refreshMergeFineScopeStatusCard({ showLoading: false, silent: true });
    } catch (error) {
        console.error('保存精细化筛减参数失败:', error);
        showToast('保存精细化筛减参数失败: ' + error.message, true);
    }
}

async function exportMergeFineScopePolicy() {
    try {
        showToast('正在导出精细化筛减参数...', false);
        const response = await fetch(API_BASE + '/merge/fine-scope-policy/export');
        if (!response.ok) {
            let errorMessage = '导出失败';
            try {
                const result = await response.json();
                errorMessage = result.error || errorMessage;
            } catch (parseError) {
                errorMessage = '导出失败';
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const matchedName = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
        const filename = matchedName
            ? decodeURIComponent(matchedName[1] || matchedName[2] || '')
            : ('merge_fine_scope_policy_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.xlsx');

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('精细化筛减参数导出成功', false);
    } catch (error) {
        console.error('导出精细化筛减参数失败:', error);
        showToast('导出精细化筛减参数失败: ' + error.message, true);
    }
}

function chooseMergeFineScopePolicyFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.style.display = 'none';
    input.onchange = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        await importMergeFineScopePolicy(file);
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
    }, 1000);
}

async function importMergeFineScopePolicy(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(API_BASE + '/merge/fine-scope-policy/import', {
            method: 'POST',
            body: formData
        });
        const result = await parseApiResult(response, '导入精细化筛减参数失败');
        if (!result.success) {
            throw new Error(result.error || '导入精细化筛减参数失败');
        }
        mergeToolboxState.fineScopePolicy = normalizeMergeFineScopePolicy(result.policy || {});
        syncMergeFineScopePolicyInputs();
        showToast(result.message || '精细化筛减参数导入成功', false);
        await previewMergeFineScopePolicy();
    } catch (error) {
        console.error('导入精细化筛减参数失败:', error);
        showToast('导入精细化筛减参数失败: ' + error.message, true);
    }
}

function getMergeMatrixSourceOptionsHtml(selectedValue = '') {
    const options = (mergeSourceLevelMatrixState.items || []).map((item) => ({
        value: String(item.source_value ?? ''),
        label: String(item.source_label ?? '空值/未填写')
    }));
    if (!options.length) {
        return '<option value="">暂无数据源名称</option>';
    }
    return options.map((item) => {
        const selected = item.value === String(selectedValue ?? '') ? 'selected' : '';
        return `<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`;
    }).join('');
}

function getMergeMatrixLevelOptionsHtml(selectedValue = '') {
    const options = (mergeSourceLevelMatrixState.levelTotals || []).map((item) => ({
        value: String(item.value ?? ''),
        label: String(item.label ?? '-')
    }));
    if (!options.length) {
        return '<option value="">暂无字段数据分级</option>';
    }
    return options.map((item) => {
        const selected = item.value === String(selectedValue ?? '') ? 'selected' : '';
        return `<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`;
    }).join('');
}

function getMergeLevelRank(levelValue) {
    const text = String(levelValue ?? '').trim();
    const matched = text.match(/第\s*(\d+)\s*小级/);
    if (!matched) return null;
    const rank = Number(matched[1]);
    return [1, 2, 3, 4].includes(rank) ? rank : null;
}

function getMergeSourceItemByValue(sourceValue) {
    const sourceKey = String(sourceValue ?? '');
    const items = Array.isArray(mergeSourceLevelMatrixState.items) ? mergeSourceLevelMatrixState.items : [];
    return items.find((item) => String(item.source_value ?? '') === sourceKey) || null;
}

function getMergeSourceStandardizeCounts(sourceValue) {
    const sourceItem = getMergeSourceItemByValue(sourceValue);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    if (!sourceItem) {
        return {
            sourceItem: null,
            counts,
            total: 0
        };
    }

    const levels = Array.isArray(sourceItem.levels) ? sourceItem.levels : [];
    levels.forEach((level) => {
        const rank = getMergeLevelRank(level?.value || level?.label);
        if (!rank) return;
        counts[rank] += Math.max(0, Number(level?.count) || 0);
    });

    const total = counts[1] + counts[2] + counts[3] + counts[4];
    return { sourceItem, counts, total };
}

function getMergeStandardizeTargetRatios() {
    const ratio1El = document.getElementById('mergeStandardizeRatio1');
    const ratio2El = document.getElementById('mergeStandardizeRatio2');
    const ratio3El = document.getElementById('mergeStandardizeRatio3');
    const ratio4El = document.getElementById('mergeStandardizeRatio4');
    const values = [ratio1El, ratio2El, ratio3El, ratio4El].map((el) => {
        const num = Number(el?.value);
        return Number.isFinite(num) ? Math.max(0, num) : 0;
    });
    return {
        1: values[0],
        2: values[1],
        3: values[2],
        4: values[3]
    };
}

function syncMergeStandardizeDraftFromInputs() {
    const sourceEl = document.getElementById('mergeStandardizeSourceSelect');
    const ratios = getMergeStandardizeTargetRatios();
    mergeToolboxState.matrixStandardizeDraft = {
        source_name: String(sourceEl?.value ?? ''),
        ratio_1: ratios[1],
        ratio_2: ratios[2],
        ratio_3: ratios[3],
        ratio_4: ratios[4]
    };
}

function computeMergeStandardizedAllocation(availableCounts, targetRatios) {
    const ranks = [1, 2, 3, 4];
    const available = {};
    const ratios = {};
    ranks.forEach((rank) => {
        available[rank] = Math.max(0, Number(availableCounts?.[rank]) || 0);
        ratios[rank] = Math.max(0, Number(targetRatios?.[rank]) || 0);
    });

    const activeRanks = ranks.filter((rank) => available[rank] > 0 && ratios[rank] > 0);
    if (!activeRanks.length) {
        return {
            allocations: { 1: 0, 2: 0, 3: 0, 4: 0 },
            totalBefore: available[1] + available[2] + available[3] + available[4],
            totalAfter: 0
        };
    }

    const activeRatioSum = activeRanks.reduce((sum, rank) => sum + ratios[rank], 0);
    const normalizedRatios = {};
    activeRanks.forEach((rank) => {
        normalizedRatios[rank] = ratios[rank] / activeRatioSum;
    });

    let feasibleScale = Infinity;
    activeRanks.forEach((rank) => {
        feasibleScale = Math.min(feasibleScale, available[rank] / normalizedRatios[rank]);
    });

    const totalTarget = Math.max(0, Math.floor(feasibleScale));
    const allocations = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const remainders = [];
    let allocated = 0;

    activeRanks.forEach((rank) => {
        const rawValue = normalizedRatios[rank] * totalTarget;
        const baseValue = Math.min(available[rank], Math.floor(rawValue));
        allocations[rank] = baseValue;
        allocated += baseValue;
        remainders.push({
            rank,
            remainder: rawValue - baseValue
        });
    });

    let remaining = Math.max(0, totalTarget - allocated);
    remainders.sort((a, b) => b.remainder - a.remainder);
    while (remaining > 0) {
        let consumed = false;
        for (let i = 0; i < remainders.length; i++) {
            const rank = remainders[i].rank;
            if (allocations[rank] >= available[rank]) continue;
            allocations[rank] += 1;
            remaining -= 1;
            consumed = true;
            if (remaining <= 0) break;
        }
        if (!consumed) break;
    }

    const totalBefore = available[1] + available[2] + available[3] + available[4];
    const totalAfter = allocations[1] + allocations[2] + allocations[3] + allocations[4];
    return { allocations, totalBefore, totalAfter };
}

function formatMergeRatioPercent(count, total) {
    if (!total) return '0.0%';
    return `${(count * 100 / total).toFixed(1)}%`;
}

function setMergeSamplingRuleMode(mode = 'fine') {
    const normalizedMode = mode === 'standardize' ? 'standardize' : 'fine';
    mergeToolboxState.matrixRuleMode = normalizedMode;

    const fineBtn = document.getElementById('mergeSamplingModeFineBtn');
    const standardBtn = document.getElementById('mergeSamplingModeStandardizeBtn');
    const finePanel = document.getElementById('mergeSamplingFinePanel');
    const standardPanel = document.getElementById('mergeSamplingStandardizePanel');
    const modeNote = document.getElementById('mergeSamplingModeNote');

    if (fineBtn) {
        const active = normalizedMode === 'fine';
        fineBtn.style.background = active ? '#135ec4' : '#ffffff';
        fineBtn.style.color = active ? '#ffffff' : '#355070';
        fineBtn.style.borderColor = active ? '#135ec4' : 'rgba(19, 94, 196, 0.2)';
    }
    if (standardBtn) {
        const active = normalizedMode === 'standardize';
        standardBtn.style.background = active ? '#135ec4' : '#ffffff';
        standardBtn.style.color = active ? '#ffffff' : '#355070';
        standardBtn.style.borderColor = active ? '#135ec4' : 'rgba(19, 94, 196, 0.2)';
    }
    if (finePanel) finePanel.style.display = normalizedMode === 'fine' ? 'grid' : 'none';
    if (standardPanel) standardPanel.style.display = normalizedMode === 'standardize' ? 'grid' : 'none';
    if (modeNote) {
        modeNote.textContent = normalizedMode === 'fine'
            ? '当前模式：精细化筛选。保存时仅应用精细化规则。'
            : '当前模式：分级标准化。保存时仅应用标准化规则。';
    }
}

function buildMergeStandardizedRuleSet(sourceValue, targetRatios) {
    const sourceStats = getMergeSourceStandardizeCounts(sourceValue);
    if (!sourceStats.sourceItem) {
        return { error: '请先选择数据源名称' };
    }
    const ratioSum = targetRatios[1] + targetRatios[2] + targetRatios[3] + targetRatios[4];
    if (ratioSum <= 0) {
        return { error: '目标占比之和必须大于 0' };
    }

    const allocation = computeMergeStandardizedAllocation(sourceStats.counts, targetRatios);
    const rules = [1, 2, 3, 4].map((rank) => normalizeMergeExportSamplingRule({
        source_name: String(sourceValue ?? ''),
        level_name: `一般级-第${rank}小级`,
        mode: 'top_n',
        value: Math.max(0, Math.floor(allocation.allocations[rank] || 0))
    }));

    return { sourceStats, allocation, rules };
}

function getMergeSamplingKeepCount(total, mode, value, rounding, keepAtLeastOne) {
    const count = Math.max(0, Number(total) || 0);
    if (count === 0 || mode === 'all') return count;
    if (mode === 'top_n') {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        return Math.min(count, n);
    }
    if (mode === 'percent') {
        const percent = Math.max(0, Math.min(100, Number(value) || 0));
        const raw = count * percent / 100;
        let keep = rounding === 'round' ? Math.round(raw) : Math.floor(raw);
        keep = Math.max(0, Math.min(count, keep));
        if (percent > 0 && keepAtLeastOne && keep === 0) {
            keep = 1;
        }
        return keep;
    }
    return count;
}

function calculateMergeExportSamplingPreview(config) {
    const normalizedConfig = normalizeMergeExportSamplingConfig(config || {});
    const ruleMap = new Map();
    normalizedConfig.rules.forEach((rule) => {
        ruleMap.set(`${rule.source_name}|||${rule.level_name}`, rule);
    });
    const includeUnmatched = normalizedConfig.include_unmatched === true;

    let totalBefore = 0;
    let totalAfter = 0;
    let matchedGroups = 0;

    (mergeSourceLevelMatrixState.items || []).forEach((sourceItem) => {
        const sourceValue = String(sourceItem.source_value ?? '');
        (sourceItem.levels || []).forEach((levelItem) => {
            const levelValue = String(levelItem.value ?? '');
            const count = Number(levelItem.count) || 0;
            totalBefore += count;

            const key = `${sourceValue}|||${levelValue}`;
            const rule = ruleMap.get(key);
            if (!rule) {
                if (!normalizedConfig.enabled || includeUnmatched) {
                    totalAfter += count;
                }
                return;
            }

            matchedGroups += 1;
            if (!normalizedConfig.enabled) {
                totalAfter += count;
                return;
            }
            totalAfter += getMergeSamplingKeepCount(
                count,
                rule.mode,
                rule.value,
                normalizedConfig.rounding,
                normalizedConfig.keep_at_least_one
            );
        });
    });

    return {
        totalBefore,
        totalAfter,
        matchedGroups,
        ruleCount: normalizedConfig.rules.length
    };
}

function updateMergeSamplingPreviewSummary() {
    const summaryEl = document.getElementById('mergeSamplingPreviewSummary');
    if (!summaryEl) return;

    const preview = calculateMergeExportSamplingPreview({
        ...(mergeToolboxState.matrixSamplingConfig || {}),
        rules: [...(mergeToolboxState.matrixFineRulesDraft || [])]
    });
    const config = mergeToolboxState.matrixSamplingConfig || getDefaultMergeExportSamplingConfig();
    const statusText = config.enabled ? '已启用' : '未启用';
    const roundingText = config.rounding === 'round' ? '四舍五入' : '向下取整';
    const keepOneText = config.keep_at_least_one ? '开启' : '关闭';
    const unmatchedText = config.include_unmatched ? '保留' : '不保留';

    summaryEl.innerHTML = `
                <div style="padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.65;">
                    <div>导出精细筛选：${statusText}</div>
                    <div style="margin-top: 4px;">规则数：${formatMergeSourceNameStatNumber(preview.ruleCount)}，命中分组：${formatMergeSourceNameStatNumber(preview.matchedGroups)}</div>
                    <div style="margin-top: 4px;">预计记录数：${formatMergeSourceNameStatNumber(preview.totalBefore)} -> ${formatMergeSourceNameStatNumber(preview.totalAfter)}</div>
                    <div style="margin-top: 4px;">抽样方式：${roundingText}；比例至少保留 1 条：${keepOneText}</div>
                    <div style="margin-top: 4px;">未命中规则分组：${unmatchedText}</div>
                </div>
            `;
}

function renderMergeExportSamplingRules() {
    const listEl = document.getElementById('mergeSamplingRulesList');
    if (!listEl) return;

    const rules = Array.isArray(mergeToolboxState.matrixFineRulesDraft)
        ? mergeToolboxState.matrixFineRulesDraft
        : [];
    const sourceLabelMap = new Map((mergeSourceLevelMatrixState.items || []).map((item) => [
        String(item.source_value ?? ''),
        String(item.source_label ?? '空值/未填写')
    ]));
    const levelLabelMap = new Map((mergeSourceLevelMatrixState.levelTotals || []).map((item) => [
        String(item.value ?? ''),
        String(item.label ?? '-')
    ]));

    if (!rules.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 18px 16px;">当前没有配置规则</div>';
        return;
    }

    listEl.innerHTML = rules.map((rule, index) => {
        const sourceLabel = sourceLabelMap.get(rule.source_name) || rule.source_name || '空值/未填写';
        const levelLabel = levelLabelMap.get(rule.level_name) || rule.level_name || '-';
        const modeOptions = [
            { value: 'all', label: '保留全部' },
            { value: 'percent', label: '按比例' },
            { value: 'top_n', label: '固定条数' }
        ];
        const modeSelectHtml = modeOptions.map((item) => {
            const selected = item.value === rule.mode ? 'selected' : '';
            return `<option value="${item.value}" ${selected}>${item.label}</option>`;
        }).join('');
        const valueDisabled = rule.mode === 'all' ? 'disabled' : '';
        const valueStep = rule.mode === 'percent' ? '0.01' : '1';
        const valueMin = '0';
        const valueMax = rule.mode === 'percent' ? '100' : '';
        return `
                    <div style="display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.1fr) 150px 130px 72px; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(15, 60, 120, 0.08); background: #fff;">
                        <div style="font-size: 12px; color: #355070; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(sourceLabel)}">${escapeHtml(sourceLabel)}</div>
                        <div style="font-size: 12px; color: #355070; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(levelLabel)}">${escapeHtml(levelLabel)}</div>
                        <select onchange="updateMergeSamplingRuleMode(${index}, this.value)" style="padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(17, 92, 196, 0.2);">${modeSelectHtml}</select>
                        <input type="number" ${valueDisabled} min="${valueMin}" ${valueMax ? `max="${valueMax}"` : ''} step="${valueStep}" value="${escapeHtml(rule.value)}" onchange="updateMergeSamplingRuleValue(${index}, this.value)" style="padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(17, 92, 196, 0.2);">
                        <button class="btn btn-sm" type="button" onclick="removeMergeSamplingRule(${index})">删除</button>
                    </div>
                `;
    }).join('');
}

function renderMergeExportSamplingConfig() {
    const enabledEl = document.getElementById('mergeSamplingEnabled');
    const roundingEl = document.getElementById('mergeSamplingRounding');
    const keepOneEl = document.getElementById('mergeSamplingKeepOne');
    const sourceEl = document.getElementById('mergeSamplingSourceSelect');
    const levelEl = document.getElementById('mergeSamplingLevelSelect');
    const modeEl = document.getElementById('mergeSamplingModeSelect');
    const valueEl = document.getElementById('mergeSamplingValueInput');
    const standardSourceEl = document.getElementById('mergeStandardizeSourceSelect');
    const ratio1El = document.getElementById('mergeStandardizeRatio1');
    const ratio2El = document.getElementById('mergeStandardizeRatio2');
    const ratio3El = document.getElementById('mergeStandardizeRatio3');
    const ratio4El = document.getElementById('mergeStandardizeRatio4');

    const config = normalizeMergeExportSamplingConfig(mergeToolboxState.matrixSamplingConfig);
    mergeToolboxState.matrixSamplingConfig = config;
    if (!Array.isArray(mergeToolboxState.matrixFineRulesDraft)) {
        mergeToolboxState.matrixFineRulesDraft = [...(config.rules || [])];
    }

    if (enabledEl) enabledEl.checked = config.enabled;
    if (roundingEl) roundingEl.value = config.rounding;
    if (keepOneEl) keepOneEl.checked = config.keep_at_least_one;
    if (sourceEl) sourceEl.innerHTML = getMergeMatrixSourceOptionsHtml(sourceEl.value);
    if (levelEl) levelEl.innerHTML = getMergeMatrixLevelOptionsHtml(levelEl.value);
    if (standardSourceEl) {
        standardSourceEl.innerHTML = getMergeMatrixSourceOptionsHtml(
            mergeToolboxState.matrixStandardizeDraft?.source_name || standardSourceEl.value
        );
        standardSourceEl.value = mergeToolboxState.matrixStandardizeDraft?.source_name || standardSourceEl.value || '';
    }
    if (ratio1El) ratio1El.value = String(mergeToolboxState.matrixStandardizeDraft?.ratio_1 ?? 40);
    if (ratio2El) ratio2El.value = String(mergeToolboxState.matrixStandardizeDraft?.ratio_2 ?? 30);
    if (ratio3El) ratio3El.value = String(mergeToolboxState.matrixStandardizeDraft?.ratio_3 ?? 20);
    if (ratio4El) ratio4El.value = String(mergeToolboxState.matrixStandardizeDraft?.ratio_4 ?? 10);
    if (modeEl && !modeEl.value) modeEl.value = 'percent';
    if (valueEl && !valueEl.value) valueEl.value = '100';
    handleMergeSamplingModeInputChange();

    renderMergeExportSamplingRules();
    updateMergeSamplingPreviewSummary();
    updateMergeStandardizePreviewSummary();
    setMergeSamplingRuleMode(mergeToolboxState.matrixRuleMode || 'fine');
}

function handleMergeSamplingModeInputChange() {
    const modeEl = document.getElementById('mergeSamplingModeSelect');
    const valueEl = document.getElementById('mergeSamplingValueInput');
    if (!modeEl || !valueEl) return;

    const mode = modeEl.value || 'percent';
    if (mode === 'all') {
        valueEl.value = '0';
        valueEl.disabled = true;
        valueEl.step = '1';
        valueEl.max = '';
    } else if (mode === 'percent') {
        valueEl.disabled = false;
        valueEl.step = '0.01';
        valueEl.max = '100';
    } else {
        valueEl.disabled = false;
        valueEl.step = '1';
        valueEl.max = '';
    }
}

function addMergeSamplingRule() {
    const sourceEl = document.getElementById('mergeSamplingSourceSelect');
    const levelEl = document.getElementById('mergeSamplingLevelSelect');
    const modeEl = document.getElementById('mergeSamplingModeSelect');
    const valueEl = document.getElementById('mergeSamplingValueInput');

    if (!sourceEl || !levelEl || !modeEl || !valueEl) return;

    const rule = normalizeMergeExportSamplingRule({
        source_name: sourceEl.value,
        level_name: levelEl.value,
        mode: modeEl.value || 'all',
        value: valueEl.value
    });

    if (!rule.level_name) {
        showToast('请先选择字段数据分级', true);
        return;
    }

    const key = `${rule.source_name}|||${rule.level_name}`;
    const dedup = new Map((mergeToolboxState.matrixFineRulesDraft || []).map((item) => [`${item.source_name}|||${item.level_name}`, item]));
    dedup.set(key, rule);
    mergeToolboxState.matrixFineRulesDraft = Array.from(dedup.values());
    mergeToolboxState.matrixSamplingConfig = normalizeMergeExportSamplingConfig({
        ...mergeToolboxState.matrixSamplingConfig,
        enabled: true
    });
    const enabledEl = document.getElementById('mergeSamplingEnabled');
    if (enabledEl) enabledEl.checked = true;

    renderMergeExportSamplingRules();
    updateMergeSamplingPreviewSummary();
    showToast('规则已加入（同组合会被覆盖）', false);
}

function updateMergeStandardizePreviewSummary() {
    const summaryEl = document.getElementById('mergeStandardizePreviewSummary');
    const sourceEl = document.getElementById('mergeStandardizeSourceSelect');
    if (!summaryEl || !sourceEl) return;

    syncMergeStandardizeDraftFromInputs();
    const sourceValue = String(sourceEl.value ?? '');
    const targetRatios = getMergeStandardizeTargetRatios();
    const buildResult = buildMergeStandardizedRuleSet(sourceValue, targetRatios);
    if (buildResult.error) {
        summaryEl.innerHTML = `<div class="loading" style="padding: 10px 12px;">${escapeHtml(buildResult.error)}</div>`;
        return;
    }

    const sourceStats = buildResult.sourceStats;
    const sourceItem = sourceStats.sourceItem;
    const allocation = buildResult.allocation;
    const beforeTotal = allocation.totalBefore;
    const afterTotal = allocation.totalAfter;
    const sourceLabel = String(sourceItem.source_label ?? '空值/未填写');

    summaryEl.innerHTML = `
                <div style="padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.7;">
                    <div>标准化目标：${escapeHtml(sourceLabel)}（仅 1-4 级）</div>
                    <div style="margin-top: 4px;">预计总量：${formatMergeSourceNameStatNumber(beforeTotal)} -> ${formatMergeSourceNameStatNumber(afterTotal)}</div>
                    <div style="margin-top: 8px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;">
                        ${[1, 2, 3, 4].map((rank) => `
                            <div style="padding: 8px 9px; border-radius: 10px; background: rgba(255,255,255,0.9); border: 1px solid rgba(19,94,196,0.12);">
                                <div style="font-weight: 600;">${rank}级</div>
                                <div style="margin-top: 2px;">前：${formatMergeSourceNameStatNumber(sourceStats.counts[rank])}（${formatMergeRatioPercent(sourceStats.counts[rank], beforeTotal)}）</div>
                                <div style="margin-top: 2px;">后：${formatMergeSourceNameStatNumber(allocation.allocations[rank])}（${formatMergeRatioPercent(allocation.allocations[rank], afterTotal)}）</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
}

function applyMergeLevelStandardization() {
    const sourceEl = document.getElementById('mergeStandardizeSourceSelect');
    if (!sourceEl) return;

    syncMergeStandardizeDraftFromInputs();
    const sourceValue = String(sourceEl.value ?? '');
    const targetRatios = getMergeStandardizeTargetRatios();
    const buildResult = buildMergeStandardizedRuleSet(sourceValue, targetRatios);
    if (buildResult.error) {
        showToast(buildResult.error, true);
        return;
    }

    mergeToolboxState.matrixStandardizeGeneratedRules = [...buildResult.rules];
    mergeToolboxState.matrixSamplingConfig = normalizeMergeExportSamplingConfig({
        ...mergeToolboxState.matrixSamplingConfig,
        enabled: true
    });
    const enabledEl = document.getElementById('mergeSamplingEnabled');
    if (enabledEl) enabledEl.checked = true;
    updateMergeSamplingPreviewSummary();
    updateMergeStandardizePreviewSummary();
    showToast('标准化规则已生成，保存时将按“分级标准化”模式生效', false);
}

function removeMergeSamplingRule(index) {
    const rules = Array.isArray(mergeToolboxState.matrixFineRulesDraft)
        ? [...mergeToolboxState.matrixFineRulesDraft]
        : [];
    if (index < 0 || index >= rules.length) return;
    rules.splice(index, 1);
    mergeToolboxState.matrixFineRulesDraft = rules;
    renderMergeExportSamplingRules();
    updateMergeSamplingPreviewSummary();
}

function updateMergeSamplingRuleMode(index, modeValue) {
    const rules = Array.isArray(mergeToolboxState.matrixFineRulesDraft)
        ? [...mergeToolboxState.matrixFineRulesDraft]
        : [];
    if (index < 0 || index >= rules.length) return;
    rules[index] = normalizeMergeExportSamplingRule({
        ...rules[index],
        mode: modeValue
    });
    mergeToolboxState.matrixFineRulesDraft = rules;
    renderMergeExportSamplingRules();
    updateMergeSamplingPreviewSummary();
}

function updateMergeSamplingRuleValue(index, value) {
    const rules = Array.isArray(mergeToolboxState.matrixFineRulesDraft)
        ? [...mergeToolboxState.matrixFineRulesDraft]
        : [];
    if (index < 0 || index >= rules.length) return;
    rules[index] = normalizeMergeExportSamplingRule({
        ...rules[index],
        value
    });
    mergeToolboxState.matrixFineRulesDraft = rules;
    renderMergeExportSamplingRules();
    updateMergeSamplingPreviewSummary();
}

async function saveMergeExportSamplingConfig() {
    const enabledEl = document.getElementById('mergeSamplingEnabled');
    const roundingEl = document.getElementById('mergeSamplingRounding');
    const keepOneEl = document.getElementById('mergeSamplingKeepOne');
    const baseConfig = normalizeMergeExportSamplingConfig({
        ...mergeToolboxState.matrixSamplingConfig,
        enabled: enabledEl ? enabledEl.checked : false,
        rounding: roundingEl ? roundingEl.value : 'floor',
        keep_at_least_one: keepOneEl ? keepOneEl.checked : true
    });
    const mode = mergeToolboxState.matrixRuleMode === 'standardize' ? 'standardize' : 'fine';

    let rulesToSave = [];
    if (mode === 'fine') {
        rulesToSave = [...(mergeToolboxState.matrixFineRulesDraft || [])];
    } else {
        syncMergeStandardizeDraftFromInputs();
        if (!Array.isArray(mergeToolboxState.matrixStandardizeGeneratedRules) || !mergeToolboxState.matrixStandardizeGeneratedRules.length) {
            const draft = mergeToolboxState.matrixStandardizeDraft || getDefaultMergeStandardizeDraft();
            const targetRatios = {
                1: Number(draft.ratio_1) || 0,
                2: Number(draft.ratio_2) || 0,
                3: Number(draft.ratio_3) || 0,
                4: Number(draft.ratio_4) || 0
            };
            const buildResult = buildMergeStandardizedRuleSet(draft.source_name, targetRatios);
            if (buildResult.error) {
                showToast(buildResult.error, true);
                return;
            }
            mergeToolboxState.matrixStandardizeGeneratedRules = [...buildResult.rules];
        }
        rulesToSave = [...mergeToolboxState.matrixStandardizeGeneratedRules];
    }

    const enabledByRules = rulesToSave.length > 0;

    const config = normalizeMergeExportSamplingConfig({
        ...baseConfig,
        enabled: (enabledEl ? enabledEl.checked : false) || enabledByRules,
        rules: rulesToSave
    });

    // 分布筛选功能已停用：仅更新本地状态，不再调用停用接口
    mergeToolboxState.matrixSamplingConfig = config;
    if (mode === 'fine') {
        mergeToolboxState.matrixFineRulesDraft = [...(mergeToolboxState.matrixSamplingConfig.rules || [])];
    }
    renderMergeExportSamplingConfig();
    showToast('分布筛选功能已停用，当前仅保留本地预览状态', false);
}

function getMergeCleaningFieldOptionsHtml(selectedFieldIndex = 10) {
    const selectedIndex = Number(selectedFieldIndex) || 10;
    const options = [];
    const seenIndexes = new Set();

    (columns2 || []).forEach((col, idx) => {
        const fieldIndex = idx + 1; // 数据列索引，id 固定为 0
        const fieldName = String(col?.name || '').trim();
        if (!fieldName) return;
        seenIndexes.add(fieldIndex);
        options.push({
            value: fieldIndex,
            label: `${fieldName}（索引${fieldIndex}）`
        });
    });

    if (!seenIndexes.has(selectedIndex)) {
        options.unshift({
            value: selectedIndex,
            label: `索引${selectedIndex}（当前配置值）`
        });
    }

    if (!options.length) {
        options.push({
            value: selectedIndex,
            label: `索引${selectedIndex}（列配置未加载）`
        });
    }

    return options.map((item) => {
        const isSelected = Number(item.value) === selectedIndex ? 'selected' : '';
        return `<option value="${item.value}" ${isSelected}>${escapeHtml(item.label)}</option>`;
    }).join('');
}

function handleMergeToolboxOverlayClick(event) {
    if (event.target && event.target.id === 'mergeToolboxModal') {
        closeMergeToolboxModal();
    }
}

function handleMergeSourceNameStatsOverlayClick(event) {
    handleMergeToolboxOverlayClick(event);
}

function closeMergeToolboxModal() {
    const toolboxModal = document.getElementById('mergeToolboxModal');
    if (toolboxModal) {
        toolboxModal.remove();
    }
    const legacyModal = document.getElementById('mergeSourceNameStatsModal');
    if (legacyModal) {
        legacyModal.remove();
    }
}

function closeMergeSourceNameStatsModal() {
    closeMergeToolboxModal();
}

        function renderMergeSourceNameStatsSummary() {
            const summaryEl = document.getElementById('mergeSourceNameStatsSummary');
            if (!summaryEl) return;

            const scopeText = escapeHtml(getMergeSourceNameStatsScopeText());

            summaryEl.innerHTML = `
                <div style="padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.65;">
                    <div>${scopeText}</div>
                    <div style="margin-top: 4px;">下方已统一展示每个数据源的 1/2/3/4 级数量、占比、更新标注和最近导入时间。</div>
                </div>
            `;
        }

function renderMergeSourceNameStatsItems(keyword = '') {
    const listEl = document.getElementById('mergeSourceNameStatsList');
    const counterEl = document.getElementById('mergeSourceNameStatsCounter');
    if (!listEl) return;

    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    const allItems = Array.isArray(mergeSourceNameStatsState.items) ? mergeSourceNameStatsState.items : [];
    const filteredItems = normalizedKeyword
        ? allItems.filter((item) => {
            const labelText = String(item.label || '').toLowerCase();
            const valueText = String(item.value || '').toLowerCase();
            return labelText.includes(normalizedKeyword) || valueText.includes(normalizedKeyword);
        })
        : allItems;

    if (counterEl) {
        counterEl.textContent = `显示 ${formatMergeSourceNameStatNumber(filteredItems.length)} / ${formatMergeSourceNameStatNumber(allItems.length)} 项`;
    }

    if (!allItems.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 36px 20px;">当前结果集中没有可统计的数据源名称</div>';
        return;
    }

    if (!filteredItems.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 36px 20px;">没有找到匹配的统计项</div>';
        return;
    }

    listEl.innerHTML = filteredItems.map((item) => {
        const encodedValue = encodeURIComponent(item.value || '');
        const label = escapeHtml(item.label || '');
        const description = item.is_empty ? '空值记录，点击后可查看未填写数据源名称的整行数据' : '点击后按该数据源名称筛选并查看整行';
        const updateModeLabel = escapeHtml(item.update_mode_label || '未标注');
        const lastImportTime = escapeHtml(item.last_import_time || '未记录');

        return `
                    <div style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(15, 60, 120, 0.08); background: rgba(255, 255, 255, 0.9); box-shadow: 0 10px 24px rgba(15, 60, 120, 0.05);">
                        <div style="min-width: 0;">
                            <div style="font-size: 14px; font-weight: 600; color: #163c7a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${label}">${label}</div>
                            <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">${escapeHtml(description)}</div>
                            <div style="margin-top: 4px; font-size: 12px; color: #4b5b74;">更新标注：${updateModeLabel}，最近导入：${lastImportTime}</div>
                        </div>
                        <div style="min-width: 92px; padding: 8px 12px; border-radius: 999px; background: rgba(19, 94, 196, 0.08); color: #135ec4; text-align: center; font-size: 13px; font-weight: 700;">
                            ${formatMergeSourceNameStatNumber(item.count)} 次
                        </div>
                        <button class="btn btn-sm" type="button" onclick="applyMergeSourceNameStatFilter('${encodedValue}', ${item.is_empty ? 'true' : 'false'})">查看整行</button>
                    </div>
                `;
    }).join('');
}

function renderMergeSourceLevelMatrixSummary() {
    const summaryEl = document.getElementById('mergeSourceLevelMatrixSummary');
    if (!summaryEl) return;

    const scopeText = escapeHtml(getMergeSourceLevelMatrixScopeText(mergeSourceLevelMatrixState.scope));
    const totalRecords = Number(mergeSourceLevelMatrixState.totalRecords) || 0;
    const sourceCount = Number(mergeSourceLevelMatrixState.sourceCount) || 0;
    const levelTotals = Array.isArray(mergeSourceLevelMatrixState.levelTotals)
        ? mergeSourceLevelMatrixState.levelTotals
        : [];
    const topLevels = levelTotals.slice(0, 4);

    summaryEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
                    <div style="padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(243, 248, 255, 0.98) 0%, rgba(231, 240, 255, 0.94) 100%); border: 1px solid rgba(28, 104, 215, 0.12);">
                        <div style="font-size: 12px; color: #5b6f8f;">命中记录</div>
                        <div style="margin-top: 6px; font-size: 24px; font-weight: 700; color: #123f85;">${formatMergeSourceNameStatNumber(totalRecords)}</div>
                    </div>
                    <div style="padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(243, 248, 255, 0.98) 0%, rgba(231, 240, 255, 0.94) 100%); border: 1px solid rgba(28, 104, 215, 0.12);">
                        <div style="font-size: 12px; color: #5b6f8f;">数据源名称数量</div>
                        <div style="margin-top: 6px; font-size: 24px; font-weight: 700; color: #123f85;">${formatMergeSourceNameStatNumber(sourceCount)}</div>
                    </div>
                </div>
                <div style="margin-top: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.65;">
                    <div>${scopeText}</div>
                    <div style="margin-top: 4px;">已按“数据源名称总量”从大到小排序，可直接观察每个数据源下 1/2/3/4 级分布。</div>
                </div>
                <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${topLevels.map((level) => `
                        <span style="padding: 7px 10px; border-radius: 999px; border: 1px solid rgba(19, 94, 196, 0.16); background: rgba(19, 94, 196, 0.08); color: #135ec4; font-size: 12px; white-space: nowrap;">
                            ${escapeHtml(level.label || '-')}: ${formatMergeSourceNameStatNumber(level.count)} 条
                        </span>
                    `).join('')}
                </div>
            `;
}

function renderMergeSourceLevelMatrixItems(keyword = '') {
    const listEl = document.getElementById('mergeSourceLevelMatrixList');
    const counterEl = document.getElementById('mergeSourceLevelMatrixCounter');
    if (!listEl) return;

    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    const allItems = Array.isArray(mergeSourceLevelMatrixState.items) ? mergeSourceLevelMatrixState.items : [];
    const filteredItems = normalizedKeyword
        ? allItems.filter((item) => String(item.source_label || '').toLowerCase().includes(normalizedKeyword))
        : allItems;

    if (counterEl) {
        counterEl.textContent = `显示 ${formatMergeSourceNameStatNumber(filteredItems.length)} / ${formatMergeSourceNameStatNumber(allItems.length)} 项`;
    }

    if (!allItems.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 36px 20px;">当前结果集中没有可统计的数据</div>';
        return;
    }

    if (!filteredItems.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 36px 20px;">没有找到匹配的数据源名称</div>';
        return;
    }

    listEl.innerHTML = filteredItems.map((item) => {
        const sourceLabel = escapeHtml(item.source_label || '空值/未填写');
        const totalCount = Number(item.total_count) || 0;
        const levels = Array.isArray(item.levels) ? item.levels : [];

        return `
                    <div style="padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(15, 60, 120, 0.08); background: rgba(255, 255, 255, 0.92); box-shadow: 0 10px 24px rgba(15, 60, 120, 0.05); display: grid; gap: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                            <div style="min-width: 0;">
                                <div style="font-size: 14px; font-weight: 600; color: #163c7a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sourceLabel}">${sourceLabel}</div>
                                <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">字段数据分级分布</div>
                            </div>
                            <div style="padding: 8px 12px; border-radius: 999px; background: rgba(19, 94, 196, 0.08); color: #135ec4; text-align: center; font-size: 13px; font-weight: 700; white-space: nowrap;">
                                总计 ${formatMergeSourceNameStatNumber(totalCount)} 条
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${levels.map((level) => `
                                <span style="padding: 7px 10px; border-radius: 999px; border: 1px solid rgba(19, 94, 196, 0.16); background: rgba(19, 94, 196, 0.06); color: #355070; font-size: 12px; white-space: nowrap;">
                                    ${escapeHtml(level.label || '-')}: ${formatMergeSourceNameStatNumber(level.count)} 条
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
    }).join('');
}

async function loadMergeSourceLevelMatrix() {
    const summaryEl = document.getElementById('mergeSourceLevelMatrixSummary');
    const listEl = document.getElementById('mergeSourceLevelMatrixList');
    const counterEl = document.getElementById('mergeSourceLevelMatrixCounter');
    const scopeSelect = document.getElementById('mergeSourceLevelMatrixScope');
    const scope = (scopeSelect ? scopeSelect.value : mergeToolboxState.matrixScope) || 'all';
    mergeToolboxState.matrixScope = scope;

    // 分布筛选功能已停用：不再请求后端矩阵接口
    mergeSourceLevelMatrixState = {
        items: [],
        totalRecords: 0,
        sourceCount: 0,
        levelTotals: [],
        scope
    };
    if (summaryEl) summaryEl.innerHTML = '';
    if (listEl) {
        listEl.innerHTML = '<div class="loading" style="padding: 36px 20px;">分布筛选功能已停用</div>';
    }
    if (counterEl) {
        counterEl.textContent = '';
    }
    renderMergeExportSamplingConfig();
}

function setMergeToolboxTab(tabName = 'stats') {
    const targetTab = ['stats', 'cleaning', 'fine_scope'].includes(tabName) ? tabName : 'stats';
    mergeToolboxState.activeTab = targetTab;

    document.querySelectorAll('[data-merge-toolbox-tab]').forEach((button) => {
        const isActive = button.getAttribute('data-merge-toolbox-tab') === targetTab;
        button.style.background = isActive ? '#135ec4' : '#ffffff';
        button.style.color = isActive ? '#ffffff' : '#355070';
        button.style.borderColor = isActive ? '#135ec4' : 'rgba(19, 94, 196, 0.2)';
        button.style.boxShadow = isActive ? '0 10px 22px rgba(19, 94, 196, 0.24)' : 'none';
    });

    const statsPanel = document.getElementById('mergeToolboxPanelStats');
    const cleaningPanel = document.getElementById('mergeToolboxPanelCleaning');
    const fineScopePanel = document.getElementById('mergeToolboxPanelFineScope');
    const matrixPanel = document.getElementById('mergeToolboxPanelMatrix');
    if (statsPanel) statsPanel.style.display = targetTab === 'stats' ? 'grid' : 'none';
    if (cleaningPanel) cleaningPanel.style.display = targetTab === 'cleaning' ? 'grid' : 'none';
    if (fineScopePanel) fineScopePanel.style.display = targetTab === 'fine_scope' ? 'grid' : 'none';
    if (matrixPanel) matrixPanel.style.display = 'none';
}

async function switchMergeToolboxTab(tabName = 'stats') {
    setMergeToolboxTab(tabName);

    if (tabName === 'stats') {
        await loadMergeSourceNameStats();
        await loadMergeExportScopeStats('mergeToolboxSourceLevelStatsContainer');
        return;
    }

    if (tabName === 'fine_scope') {
        await loadMergeFineScopePolicy(true);
        await previewMergeFineScopePolicy();
        return;
    }

    return;
}

function renderMergeSourceNameCleaningPreview(result) {
    const summaryEl = document.getElementById('mergeCleaningSummary');
    const listEl = document.getElementById('mergeCleaningPreviewList');
    if (!summaryEl || !listEl) return;

    const matchedCount = Number(result?.matched_count) || 0;
    const affectedCount = Number(result?.affected_count) || 0;
    const samples = Array.isArray(result?.samples) ? result.samples : [];
    const targetColumnLabel = escapeHtml(result?.target_column_label || 'J列（索引10）');
    const scopeText = result?.scope === 'current_filter'
        ? '当前筛选范围'
        : '全量数据';

    summaryEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
                    <div style="padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(243, 248, 255, 0.98) 0%, rgba(231, 240, 255, 0.94) 100%); border: 1px solid rgba(28, 104, 215, 0.12);">
                        <div style="font-size: 12px; color: #5b6f8f;">匹配规则记录</div>
                        <div style="margin-top: 6px; font-size: 24px; font-weight: 700; color: #123f85;">${formatMergeSourceNameStatNumber(matchedCount)}</div>
                    </div>
                    <div style="padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(243, 248, 255, 0.98) 0%, rgba(231, 240, 255, 0.94) 100%); border: 1px solid rgba(28, 104, 215, 0.12);">
                        <div style="font-size: 12px; color: #5b6f8f;">实际将更新</div>
                        <div style="margin-top: 6px; font-size: 24px; font-weight: 700; color: #123f85;">${formatMergeSourceNameStatNumber(affectedCount)}</div>
                    </div>
                </div>
                <div style="margin-top: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 12px; line-height: 1.65;">
                    <div>目标字段：${targetColumnLabel}</div>
                    <div style="margin-top: 4px;">作用范围：${scopeText}</div>
                    <div style="margin-top: 4px;">处理规则：去除末尾“（一般级-第X小级）”。</div>
                </div>
            `;

    if (!samples.length) {
        listEl.innerHTML = '<div class="loading" style="padding: 24px 20px;">没有可展示的预览样例</div>';
        return;
    }

    listEl.innerHTML = `
                <div style="display: grid; gap: 10px;">
                    ${samples.map((item) => {
        const rowId = escapeHtml(item.id);
        const beforeValue = escapeHtml(item.before || '');
        const afterValue = escapeHtml(item.after || '');
        return `
                            <div style="padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(15, 60, 120, 0.1); background: rgba(255, 255, 255, 0.92);">
                                <div style="font-size: 12px; color: #51627d; margin-bottom: 8px;">记录ID：${rowId}</div>
                                <div style="font-size: 12px; color: #45556f; line-height: 1.7;">
                                    <div><strong>处理前：</strong>${beforeValue || '-'}</div>
                                    <div><strong>处理后：</strong>${afterValue || '-'}</div>
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            `;
}

async function previewMergeSourceNameCleaning() {
    const summaryEl = document.getElementById('mergeCleaningSummary');
    const listEl = document.getElementById('mergeCleaningPreviewList');
    const fieldIndexSelect = document.getElementById('mergeCleaningFieldSelect');
    const scopeSelect = document.getElementById('mergeCleaningScope');

    const fieldIndex = Number(fieldIndexSelect ? fieldIndexSelect.value : mergeToolboxState.cleaningFieldIndex);
    const scope = (scopeSelect ? scopeSelect.value : mergeToolboxState.cleaningScope) || 'all';

    if (!Number.isInteger(fieldIndex) || fieldIndex < 1) {
        showToast('字段索引必须是大于等于 1 的整数', true);
        return;
    }

    mergeToolboxState.cleaningFieldIndex = fieldIndex;
    mergeToolboxState.cleaningScope = scope;

    if (summaryEl) {
        summaryEl.innerHTML = '<div class="loading" style="padding: 24px 0;">正在生成清洗预览...</div>';
    }
    if (listEl) {
        listEl.innerHTML = '';
    }

    try {
        const payload = {
            ...getCurrentMergeToolboxPayload(scope),
            scope,
            field_index: fieldIndex,
            max_samples: 12
        };
        const response = await fetch(API_BASE + '/merge/source-name-cleaning/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.error || '清洗预览失败');
        }
        mergeToolboxState.cleaningPreview = result;
        renderMergeSourceNameCleaningPreview(result);
    } catch (error) {
        if (summaryEl) summaryEl.innerHTML = '';
        if (listEl) {
            listEl.innerHTML = `<div class="loading" style="padding: 24px 20px;">${escapeHtml(error.message || '清洗预览失败')}</div>`;
        }
        showToast('清洗预览失败: ' + error.message, true);
    }
}

async function applyMergeSourceNameCleaning() {
    const fieldIndexSelect = document.getElementById('mergeCleaningFieldSelect');
    const scopeSelect = document.getElementById('mergeCleaningScope');

    const fieldIndex = Number(fieldIndexSelect ? fieldIndexSelect.value : mergeToolboxState.cleaningFieldIndex);
    const scope = (scopeSelect ? scopeSelect.value : mergeToolboxState.cleaningScope) || 'all';

    if (!Number.isInteger(fieldIndex) || fieldIndex < 1) {
        showToast('字段索引必须是大于等于 1 的整数', true);
        return;
    }

    mergeToolboxState.cleaningFieldIndex = fieldIndex;
    mergeToolboxState.cleaningScope = scope;

    if (!confirm('确认执行“多余文字清洗”吗？该操作会直接更新 merge_results 数据。')) {
        return;
    }

    try {
        const payload = {
            ...getCurrentMergeToolboxPayload(scope),
            scope,
            field_index: fieldIndex
        };
        const response = await fetch(API_BASE + '/merge/source-name-cleaning/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.error || '清洗执行失败');
        }

        showToast(`清洗完成，已更新 ${formatMergeSourceNameStatNumber(result.updated_count || 0)} 条`, false);
        await loadMergeData();
        await loadMergeSourceNameStats();
        await previewMergeSourceNameCleaning();
    } catch (error) {
        showToast('清洗执行失败: ' + error.message, true);
    }
}

async function openMergeToolboxModal(defaultTab = 'stats') {
    closeMergeToolboxModal();
    mergeToolboxState.activeTab = ['stats', 'cleaning', 'fine_scope'].includes(defaultTab) ? defaultTab : 'stats';
    await loadMergeColumns();
    const cleaningFieldOptionsHtml = getMergeCleaningFieldOptionsHtml(mergeToolboxState.cleaningFieldIndex);

    document.body.insertAdjacentHTML('beforeend', `
                <div class="modal-overlay show" id="mergeToolboxModal" onclick="handleMergeToolboxOverlayClick(event)" style="z-index: 10021;">
                    <div class="modal-content" style="width: min(960px, 95vw); max-width: 960px; max-height: 90vh; border-radius: 20px; overflow: hidden; box-shadow: 0 26px 64px rgba(15, 53, 120, 0.24);">
                        <div class="modal-header" style="padding: 22px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">工具箱</h3>
                                <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">集中处理“数据源名称统计”“多余文字清洗”“精细化筛减（仅导出生效）”。</div>
                            </div>
                            <button class="modal-close" type="button" onclick="closeMergeToolboxModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
                        </div>
                        <div class="modal-body" style="padding: 24px; display: grid; gap: 16px; background: linear-gradient(180deg, rgba(248, 251, 255, 0.98) 0%, rgba(241, 247, 255, 0.96) 100%); overflow-x: hidden;">
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button class="btn" type="button" data-merge-toolbox-tab="stats" onclick="switchMergeToolboxTab('stats')" style="min-width: 150px; border-radius: 999px;">数据源名称统计</button>
                                <button class="btn" type="button" data-merge-toolbox-tab="cleaning" onclick="switchMergeToolboxTab('cleaning')" style="min-width: 150px; border-radius: 999px;">多余文字清洗</button>
                                <button class="btn" type="button" data-merge-toolbox-tab="fine_scope" onclick="switchMergeToolboxTab('fine_scope')" style="min-width: 150px; border-radius: 999px;">精细化筛减</button>
                            </div>

                            <div id="mergeToolboxPanelStats" style="display: grid; gap: 16px;">
                                <div id="mergeSourceNameStatsSummary"></div>
                                <div style="display: grid; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                        <div style="font-size: 13px; font-weight: 600; color: #163c7a;">数据源与字段数据分级统计（1-4级）</div>
                                        <div style="margin-left: auto;">
                                            <button class="btn" type="button" onclick="exportMergeExportScopeStats()">导出统计</button>
                                        </div>
                                    </div>
                                    <div id="mergeToolboxSourceLevelStatsContainer"></div>
                                </div>
                            </div>

                            <div id="mergeToolboxPanelCleaning" style="display: none; gap: 16px;">
                                <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
                                    <label style="display: grid; gap: 6px; font-size: 12px; color: #4f637f;">
                                        <span>目标字段</span>
                                        <select id="mergeCleaningFieldSelect" style="padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                            ${cleaningFieldOptionsHtml}
                                        </select>
                                    </label>
                                    <label style="display: grid; gap: 6px; font-size: 12px; color: #4f637f;">
                                        <span>作用范围</span>
                                        <select id="mergeCleaningScope" style="padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                            <option value="all" ${mergeToolboxState.cleaningScope === 'all' ? 'selected' : ''}>全量数据</option>
                                            <option value="current_filter" ${mergeToolboxState.cleaningScope === 'current_filter' ? 'selected' : ''}>当前筛选结果</option>
                                        </select>
                                    </label>
                                    <div style="display: flex; align-items: end; gap: 8px;">
                                        <button class="btn" type="button" onclick="previewMergeSourceNameCleaning()">预览</button>
                                        <button class="btn btn-success" type="button" onclick="applyMergeSourceNameCleaning()">执行清洗</button>
                                    </div>
                                </div>
                                <div id="mergeCleaningSummary"></div>
                                <div id="mergeCleaningPreviewList" style="display: grid; gap: 10px; max-height: 320px; overflow: auto; padding-right: 6px;"></div>
                            </div>

                            <div id="mergeToolboxPanelFineScope" style="display: none; gap: 16px;">
                                <div style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(18, 92, 196, 0.14); background: rgba(255, 255, 255, 0.86); color: #355070; font-size: 12px; line-height: 1.6;">
                                    该策略仅作用于最终报表导出过程，不会改动 merge_result.db 中的原始数据。
                                </div>
                                <div style="display: grid; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(18, 92, 196, 0.12); background: rgba(255, 255, 255, 0.9);">
                                    <div style="font-size: 12px; color: #6b7280;">先设置 MAX 与容差，再预演得到自动比例 C；如需人工微调，再开启手动 C。</div>
                                    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-items: end;">
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span style="font-weight: 700; color: #123f85;">启用筛减</span>
                                            <div style="display: flex; align-items: center; gap: 6px; min-height: 30px;">
                                                <input id="mergeFineScopeEnabled" type="checkbox">
                                                <span style="font-size: 12px; color: #6b7280;">仅导出生效</span>
                                            </div>
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>目标总行数 MAX</span>
                                            <input id="mergeFineScopeMaxTargetRows" type="number" min="1" step="1" style="padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>容差(行)</span>
                                            <input id="mergeFineScopeToleranceRows" type="number" min="0" step="1" style="padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>小数据源阈值</span>
                                            <input id="mergeFineScopeSmallThreshold" type="number" min="0" step="1" style="padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                        </label>
                                    </div>

                                    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-items: end;">
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>自动比例 C(auto)</span>
                                            <input id="mergeFineScopeAutoRatio" type="text" value="--" readonly style="padding: 8px 10px; border-radius: 8px; border: 1px dashed rgba(17, 92, 196, 0.25); background: #f6f9ff; color: #355070; font-weight: 600;">
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span style="font-weight: 700; color: #123f85;">手动比例 C</span>
                                            <div style="display: flex; align-items: center; gap: 6px; min-height: 30px;">
                                                <input id="mergeFineScopeManualRatioEnabled" type="checkbox">
                                                <span style="font-size: 12px; color: #6b7280;">启用手动覆盖</span>
                                            </div>
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>手动比例值 C(0~1)</span>
                                            <input id="mergeFineScopeManualRatio" type="number" min="0" max="1" step="0.000001" style="padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>取整方式</span>
                                            <select id="mergeFineScopeRounding" style="padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                                <option value="largest_remainder">最大余数法</option>
                                                <option value="floor">向下取整</option>
                                            </select>
                                        </label>
                                    </div>

                                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: end;">
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span style="font-weight: 700; color: #123f85;">比例保底1条</span>
                                            <div style="display: flex; align-items: center; gap: 6px; min-height: 30px;">
                                                <input id="mergeFineScopeKeepOne" type="checkbox">
                                                <span style="font-size: 12px; color: #6b7280;">分组非零至少保留1条</span>
                                            </div>
                                        </label>
                                        <label style="display: grid; gap: 4px; font-size: 12px; color: #4f637f;">
                                            <span>小源超上限兜底</span>
                                            <select id="mergeFineScopeFallback" style="padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(17, 92, 196, 0.2);">
                                                <option value="warn_only">仅告警，不压缩</option>
                                                <option value="compress_all">全量压缩兜底</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between;">
                                    <div style="font-size: 12px; color: #6b7280;">先预演，再保存参数。</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    <button class="btn" type="button" onclick="exportMergeExportScopeStats()">导出统计</button>
                                    <button class="btn" type="button" onclick="previewMergeFineScopePolicy()">预演</button>
                                    <button class="btn btn-success" type="button" onclick="saveMergeFineScopePolicy()">保存参数</button>
                                    </div>
                                </div>
                                <div id="mergeFineScopeSummary"></div>
                                <div id="mergeFineScopeList"></div>
                            </div>

                            <div id="mergeToolboxPanelMatrix" style="display: none; gap: 16px;">
                                <div class="loading" style="padding: 28px 20px;">分布筛选功能已停用</div>
                            </div>
                        </div>
                        <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8;">
                            <div style="font-size: 12px; color: #6b7280;">高级处理工具</div>
                            <div class="modal-footer-right">
                                <button class="btn" type="button" onclick="closeMergeToolboxModal()">关闭</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);

    const keywordInput = document.getElementById('mergeSourceNameStatsKeyword');
    if (keywordInput) {
        keywordInput.addEventListener('input', (event) => {
            renderMergeSourceNameStatsItems(event.target.value);
        });
    }

    const matrixKeywordInput = document.getElementById('mergeSourceLevelMatrixKeyword');
    if (matrixKeywordInput) {
        matrixKeywordInput.addEventListener('input', (event) => {
            renderMergeSourceLevelMatrixItems(event.target.value);
        });
    }

    const matrixScopeSelect = document.getElementById('mergeSourceLevelMatrixScope');
    if (matrixScopeSelect) {
        matrixScopeSelect.addEventListener('change', (event) => {
            mergeToolboxState.matrixScope = event.target.value || 'all';
            loadMergeSourceLevelMatrix();
        });
    }

    const samplingEnabledEl = document.getElementById('mergeSamplingEnabled');
    if (samplingEnabledEl) {
        samplingEnabledEl.addEventListener('change', (event) => {
            mergeToolboxState.matrixSamplingConfig = normalizeMergeExportSamplingConfig({
                ...mergeToolboxState.matrixSamplingConfig,
                enabled: event.target.checked
            });
            updateMergeSamplingPreviewSummary();
        });
    }

    const samplingRoundingEl = document.getElementById('mergeSamplingRounding');
    if (samplingRoundingEl) {
        samplingRoundingEl.addEventListener('change', (event) => {
            mergeToolboxState.matrixSamplingConfig = normalizeMergeExportSamplingConfig({
                ...mergeToolboxState.matrixSamplingConfig,
                rounding: event.target.value
            });
            updateMergeSamplingPreviewSummary();
        });
    }

    const samplingKeepOneEl = document.getElementById('mergeSamplingKeepOne');
    if (samplingKeepOneEl) {
        samplingKeepOneEl.addEventListener('change', (event) => {
            mergeToolboxState.matrixSamplingConfig = normalizeMergeExportSamplingConfig({
                ...mergeToolboxState.matrixSamplingConfig,
                keep_at_least_one: event.target.checked
            });
            updateMergeSamplingPreviewSummary();
        });
    }

    const standardSourceEl = document.getElementById('mergeStandardizeSourceSelect');
    if (standardSourceEl) {
        standardSourceEl.addEventListener('change', () => {
            syncMergeStandardizeDraftFromInputs();
            mergeToolboxState.matrixStandardizeGeneratedRules = [];
            updateMergeStandardizePreviewSummary();
        });
    }

    ['mergeStandardizeRatio1', 'mergeStandardizeRatio2', 'mergeStandardizeRatio3', 'mergeStandardizeRatio4'].forEach((id) => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('input', () => {
                syncMergeStandardizeDraftFromInputs();
                mergeToolboxState.matrixStandardizeGeneratedRules = [];
                updateMergeStandardizePreviewSummary();
            });
        }
    });

    [
        'mergeFineScopeEnabled',
        'mergeFineScopeMaxTargetRows',
        'mergeFineScopeToleranceRows',
        'mergeFineScopeManualRatioEnabled',
        'mergeFineScopeManualRatio',
        'mergeFineScopeSmallThreshold',
        'mergeFineScopeRounding',
        'mergeFineScopeKeepOne',
        'mergeFineScopeFallback'
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventName = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(eventName, () => {
            mergeToolboxState.fineScopePolicy = collectMergeFineScopePolicyFromInputs();
            if (id === 'mergeFineScopeManualRatioEnabled') {
                syncMergeFineScopeManualRatioUi();
            }
        });
        if (eventName !== 'change') {
            el.addEventListener('change', () => {
                mergeToolboxState.fineScopePolicy = collectMergeFineScopePolicyFromInputs();
                if (id === 'mergeFineScopeManualRatioEnabled') {
                    syncMergeFineScopeManualRatioUi();
                }
            });
        }
    });

    await switchMergeToolboxTab(mergeToolboxState.activeTab);
}

async function openMergeSourceNameStatsModal() {
    await openMergeToolboxModal('stats');
}

async function loadMergeSourceNameStats() {
    const summaryEl = document.getElementById('mergeSourceNameStatsSummary');
    const listEl = document.getElementById('mergeSourceNameStatsList');
    const counterEl = document.getElementById('mergeSourceNameStatsCounter');

    if (summaryEl) {
        summaryEl.innerHTML = '<div class="loading" style="padding: 24px 0;">正在统计数据源名称...</div>';
    }
    if (listEl) {
        listEl.innerHTML = '';
    }
    if (counterEl) {
        counterEl.textContent = '';
    }

    try {
        const response = await fetch(API_BASE + '/merge/source-name-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getCurrentMergeSourceNameStatsPayload())
        });
        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.error || '加载数据源名称统计失败');
        }

        mergeSourceNameStatsState = {
            items: Array.isArray(result.items) ? result.items : [],
            totalRecords: Number(result.total_records) || 0,
            distinctCount: Number(result.distinct_count) || 0,
            nonEmptyDistinctCount: Number(result.non_empty_distinct_count) || 0,
            emptyCount: Number(result.empty_count) || 0
        };

        renderMergeSourceNameStatsSummary();
        renderMergeSourceNameStatsItems('');
    } catch (error) {
        console.error('加载数据源名称统计失败:', error);
        if (summaryEl) {
            summaryEl.innerHTML = '';
        }
        if (listEl) {
            listEl.innerHTML = `<div class="loading" style="padding: 36px 20px;">${escapeHtml(error.message || '加载失败')}</div>`;
        }
        showToast('加载数据源名称统计失败: ' + error.message, true);
    }
}

async function exportMergeSourceNameStats() {
    try {
        showToast('正在导出数据源名称统计...', false);

        const response = await fetch(API_BASE + '/merge/source-name-stats/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getCurrentMergeSourceNameStatsPayload())
        });

        if (!response.ok) {
            let errorMessage = '导出失败';
            try {
                const result = await response.json();
                errorMessage = result.error || errorMessage;
            } catch (parseError) {
                errorMessage = '导出失败';
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const matchedName = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^\";]+)"?/i);
        const filename = matchedName
            ? decodeURIComponent(matchedName[1] || matchedName[2] || '')
            : ('合并结果_数据源名称统计_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.xlsx');

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('导出成功', false);
    } catch (error) {
        console.error('导出数据源名称统计失败:', error);
        showToast('导出数据源名称统计失败: ' + error.message, true);
    }
}

function applyMergeSourceNameStatFilter(encodedValue, isEmpty = false) {
    const decodedValue = decodeURIComponent(encodedValue || '');
    advancedFilterState.merge = {
        field: '数据源名称',
        fieldLabel: '数据源名称',
        operator: isEmpty ? 'is_empty' : 'equals',
        value: isEmpty ? '' : decodedValue
    };

    const searchInput = document.getElementById('searchInput2');
    if (searchInput) {
        searchInput.value = '';
    }

    renderAdvancedFilterSummary('merge');
    currentPage2 = 1;
    closeMergeToolboxModal();
    loadMergeData();
}

function getExportScopePageMeta(pageType) {
    if (pageType === 'merge') {
        return {
            source: 'merge_results',
            title: '合并结果整体筛选',
            summaryId: 'mergeExportScopeSummary',
            pageLabel: '合并结果'
        };
    }

    return {
        source: 'assets',
        title: '数据概览整体筛选',
        summaryId: 'deviceExportScopeSummary',
        pageLabel: '数据概览'
    };
}

function normalizeClientExportScopeRule(rule) {
    const sourceRule = rule && typeof rule === 'object' ? rule : {};
    const mode = ['all', 'top_n', 'top_percent'].includes(String(sourceRule.mode || '').trim().toLowerCase())
        ? String(sourceRule.mode || '').trim().toLowerCase()
        : 'all';
    const rawValue = sourceRule.value;
    const value = mode === 'top_percent'
        ? (Number.parseFloat(rawValue) || 0)
        : (Number.parseInt(rawValue, 10) || 0);

    return {
        enabled: Boolean(sourceRule.enabled),
        mode,
        value
    };
}

function calculateExportScopePreviewCount(total, rule) {
    const safeTotal = Number(total) || 0;
    const normalizedRule = normalizeClientExportScopeRule(rule);

    if (!normalizedRule.enabled || normalizedRule.mode === 'all') {
        return safeTotal;
    }

    if (normalizedRule.mode === 'top_n') {
        return Math.max(0, Math.min(safeTotal, normalizedRule.value));
    }

    if (normalizedRule.mode === 'top_percent') {
        if (normalizedRule.value <= 0) {
            return 0;
        }
        const percent = Math.min(normalizedRule.value, 100);
        return Math.min(safeTotal, Math.max(1, Math.ceil(safeTotal * percent / 100)));
    }

    return safeTotal;
}

function formatExportScopeRuleLabel(rule) {
    const normalizedRule = normalizeClientExportScopeRule(rule);

    if (!normalizedRule.enabled || normalizedRule.mode === 'all') {
        return '全量';
    }
    if (normalizedRule.mode === 'top_n') {
        return `前 ${normalizedRule.value.toLocaleString('zh-CN')} 行`;
    }
    if (normalizedRule.mode === 'top_percent') {
        return `前 ${normalizedRule.value}%`;
    }
    return '全量';
}

function renderExportScopeSummary(pageType) {
    const meta = getExportScopePageMeta(pageType);
    const summaryEl = document.getElementById(meta.summaryId);
    if (!summaryEl) return;

    const rule = normalizeClientExportScopeRule((exportScopeConfigState.config || {})[meta.source]);
    const total = Number((exportScopeConfigState.sourceTotals || {})[meta.source]) || 0;
    const previewCount = calculateExportScopePreviewCount(total, rule);
    summaryEl.style.display = 'flex';
    summaryEl.style.alignItems = 'center';
    summaryEl.style.gap = '8px';
    summaryEl.style.flexWrap = 'wrap';
    const isActive = rule.enabled && rule.mode !== 'all';
    const summaryText = isActive
        ? `${escapeHtml(formatExportScopeRuleLabel(rule))} 生效，预计 ${previewCount.toLocaleString('zh-CN')} / ${total.toLocaleString('zh-CN')} 条，仅对填报导出生效`
        : '全量导出，仅对填报导出生效';
    summaryEl.innerHTML = `
                <div class="workspace-scope-status ${isActive ? 'workspace-scope-status--active' : 'workspace-scope-status--default'}">
                    <span class="workspace-scope-status__title">当前导出范围</span>
                    <span>${summaryText}</span>
                </div>
            `;
}

async function loadExportScopeConfig(showError = false) {
    try {
        const response = await fetch(API_BASE + '/export-scope-config');
        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.error || '加载整体筛选配置失败');
        }

        exportScopeConfigState = {
            config: {
                assets: normalizeClientExportScopeRule(result.config?.assets),
                merge_results: normalizeClientExportScopeRule(result.config?.merge_results)
            },
            sourceTotals: {
                assets: Number(result.source_totals?.assets) || 0,
                merge_results: Number(result.source_totals?.merge_results) || 0
            }
        };

        renderExportScopeSummary('device');
        renderExportScopeSummary('merge');
        return exportScopeConfigState;
    } catch (error) {
        console.error('加载整体筛选配置失败:', error);
        if (showError) {
            showToast('加载整体筛选配置失败: ' + error.message, true);
        }
        return exportScopeConfigState;
    }
}

function formatExportScopePercent(value) {
    const safe = Number(value);
    if (!Number.isFinite(safe)) return '0.00%';
    return `${safe.toFixed(2)}%`;
}

function buildMergeSourceNameMetaMap() {
    const map = new Map();
    const items = Array.isArray(mergeSourceNameStatsState.items) ? mergeSourceNameStatsState.items : [];
    items.forEach((item) => {
        const sourceKey = String(item?.value ?? '').trim();
        map.set(sourceKey, {
            update_mode_label: String(item?.update_mode_label || '未标注'),
            last_import_time: String(item?.last_import_time || '未记录')
        });
    });
    return map;
}

function renderMergeExportScopeStats(statsResult, containerId = 'mergeExportScopeStatsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const summary = statsResult?.summary || {};
    const levelTotals = summary.level_totals || {};
    const items = Array.isArray(statsResult?.items) ? statsResult.items : [];
    const sourceMetaMap = buildMergeSourceNameMetaMap();

    const summaryHtml = `
                <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;">
                    <div style="padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(19, 94, 196, 0.15); background: rgba(246, 250, 255, 0.92);">
                        <div style="font-size: 12px; color: #5d6f8b;">总记录数</div>
                        <div style="margin-top: 4px; font-size: 18px; font-weight: 700; color: #123f85;">${Number(summary.total_rows || 0).toLocaleString('zh-CN')}</div>
                    </div>
                    <div style="padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(19, 94, 196, 0.15); background: rgba(246, 250, 255, 0.92);">
                        <div style="font-size: 12px; color: #5d6f8b;">数据源名称数</div>
                        <div style="margin-top: 4px; font-size: 18px; font-weight: 700; color: #123f85;">${Number(summary.non_empty_source_count || 0).toLocaleString('zh-CN')}</div>
                    </div>
                    <div style="padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(19, 94, 196, 0.15); background: rgba(246, 250, 255, 0.92);">
                        <div style="font-size: 12px; color: #5d6f8b;">空值来源记录</div>
                        <div style="margin-top: 4px; font-size: 18px; font-weight: 700; color: #123f85;">${Number(summary.empty_source_rows || 0).toLocaleString('zh-CN')}</div>
                    </div>
                </div>
                <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
                    <span style="padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(19, 94, 196, 0.16); background: rgba(19, 94, 196, 0.08); color: #135ec4; font-size: 12px;">1级：${Number(levelTotals.level_1_count || 0).toLocaleString('zh-CN')}（${formatExportScopePercent(levelTotals.level_1_ratio)}）</span>
                    <span style="padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(19, 94, 196, 0.16); background: rgba(19, 94, 196, 0.08); color: #135ec4; font-size: 12px;">2级：${Number(levelTotals.level_2_count || 0).toLocaleString('zh-CN')}（${formatExportScopePercent(levelTotals.level_2_ratio)}）</span>
                    <span style="padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(19, 94, 196, 0.16); background: rgba(19, 94, 196, 0.08); color: #135ec4; font-size: 12px;">3级：${Number(levelTotals.level_3_count || 0).toLocaleString('zh-CN')}（${formatExportScopePercent(levelTotals.level_3_ratio)}）</span>
                    <span style="padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(19, 94, 196, 0.16); background: rgba(19, 94, 196, 0.08); color: #135ec4; font-size: 12px;">4级：${Number(levelTotals.level_4_count || 0).toLocaleString('zh-CN')}（${formatExportScopePercent(levelTotals.level_4_ratio)}）</span>
                </div>
            `;

    const tableHtml = items.length > 0
        ? `
                    <div style="margin-top: 10px; max-height: 360px; overflow: auto; border: 1px solid rgba(18, 92, 196, 0.12); border-radius: 12px; background: #fff;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #345071;">
                            <thead>
                                <tr style="position: sticky; top: 0; background: #f4f8ff; z-index: 1;">
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">数据源名称</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">总行数</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">1级</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">2级</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">3级</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">4级</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">更新标注</th>
                                    <th style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e5ecf8; color: #000; font-size: 14.4px; font-weight: 700;">最近导入</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item) => {
            const sourceKey = String(item.source_name ?? '').trim();
            const meta = sourceMetaMap.get(sourceKey) || sourceMetaMap.get(String(item.source_label ?? '').trim()) || null;
            const updateModeLabel = escapeHtml(meta?.update_mode_label || '未标注');
            const lastImportTime = escapeHtml(meta?.last_import_time || '未记录');
            return `
                                        <tr>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.source_label || '')}">${escapeHtml(item.source_label || '')}</td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${Number(item.total_count || 0).toLocaleString('zh-CN')}</td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${Number(item.level_1_count || 0).toLocaleString('zh-CN')}<br><span style="color:#6b7280;">${formatExportScopePercent(item.level_1_ratio)}</span></td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${Number(item.level_2_count || 0).toLocaleString('zh-CN')}<br><span style="color:#6b7280;">${formatExportScopePercent(item.level_2_ratio)}</span></td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${Number(item.level_3_count || 0).toLocaleString('zh-CN')}<br><span style="color:#6b7280;">${formatExportScopePercent(item.level_3_ratio)}</span></td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${Number(item.level_4_count || 0).toLocaleString('zh-CN')}<br><span style="color:#6b7280;">${formatExportScopePercent(item.level_4_ratio)}</span></td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center;">${updateModeLabel}</td>
                                            <td style="padding: 8px 10px; border-bottom: 1px solid #f0f4fb; text-align: center; white-space: nowrap;">${lastImportTime}</td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                `
        : '<div style="margin-top: 10px; padding: 18px 14px; border-radius: 12px; border: 1px dashed rgba(17, 92, 196, 0.25); color: #5f6f86; font-size: 12px;">当前没有可统计的合并结果数据。</div>';

    container.innerHTML = `
                <div style="padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071;">
                    ${summaryHtml}
                    ${tableHtml}
                </div>
            `;
}

async function loadMergeExportScopeStats(containerId = 'mergeExportScopeStatsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="loading" style="padding: 20px 12px;">正在加载数据源与分级统计...</div>';

    try {
        const response = await fetch(API_BASE + '/export-scope/merge-source-level-stats');
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.error || '加载统计失败');
        }
        renderMergeExportScopeStats(result, containerId);
    } catch (error) {
        console.error('加载合并结果整体筛选统计失败:', error);
        container.innerHTML = `<div class="loading" style="padding: 20px 12px;">${escapeHtml(error.message || '加载失败')}</div>`;
    }
}

async function exportMergeExportScopeStats() {
    try {
        showToast('正在导出统计表...', false);
        const response = await fetch(API_BASE + '/export-scope/merge-source-level-stats/export');
        if (!response.ok) {
            let errorMessage = '导出失败';
            try {
                const result = await response.json();
                errorMessage = result.error || errorMessage;
            } catch (parseError) {
                errorMessage = '导出失败';
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const matchedName = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^\";]+)"?/i);
        const filename = matchedName
            ? decodeURIComponent(matchedName[1] || matchedName[2] || '')
            : ('合并结果_整体筛选统计_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.xlsx');

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('统计表导出成功', false);
    } catch (error) {
        console.error('导出整体筛选统计失败:', error);
        showToast('导出整体筛选统计失败: ' + error.message, true);
    }
}

function handleExportScopeOverlayClick(event) {
    if (event.target && event.target.id === 'exportScopeModal') {
        closeExportScopeModal();
    }
}

function closeExportScopeModal() {
    const modal = document.getElementById('exportScopeModal');
    if (modal) {
        modal.remove();
    }
}

function syncExportScopeModalState() {
    const pageTypeEl = document.getElementById('exportScopePageType');
    const enabledEl = document.getElementById('exportScopeEnabled');
    const modeEl = document.getElementById('exportScopeMode');
    const valueEl = document.getElementById('exportScopeValue');
    const previewEl = document.getElementById('exportScopePreview');
    const noteEl = document.getElementById('exportScopeValueNote');
    if (!pageTypeEl || !enabledEl || !modeEl || !valueEl || !previewEl || !noteEl) return;

    const meta = getExportScopePageMeta(pageTypeEl.value);
    const total = Number((exportScopeConfigState.sourceTotals || {})[meta.source]) || 0;
    const enabled = enabledEl.checked;
    const mode = modeEl.value;
    const requiresValue = enabled && mode !== 'all';

    valueEl.disabled = !requiresValue;
    if (mode === 'top_percent') {
        valueEl.placeholder = '输入 1-100';
        noteEl.textContent = '按当前源数据原始顺序截取前 N%，仅在填报导出时生效。';
    } else if (mode === 'top_n') {
        valueEl.placeholder = '输入正整数';
        noteEl.textContent = '按当前源数据原始顺序截取前 N 行，仅在填报导出时生效。';
    } else {
        valueEl.placeholder = '当前模式无需填写';
        noteEl.textContent = '关闭整体筛选后，填报导出恢复全量。';
    }

    if (!requiresValue) {
        valueEl.value = mode === 'all' ? '0' : valueEl.value;
    }

    const previewCount = calculateExportScopePreviewCount(total, {
        enabled,
        mode,
        value: valueEl.value
    });
    const ruleLabel = formatExportScopeRuleLabel({
        enabled,
        mode,
        value: valueEl.value
    });
    previewEl.innerHTML = `当前源表共有 <strong>${total.toLocaleString('zh-CN')}</strong> 条，按 <strong>${escapeHtml(ruleLabel)}</strong> 预计参与填报导出 <strong>${previewCount.toLocaleString('zh-CN')}</strong> 条。`;
}

async function openExportScopeModal(pageType) {
    await loadExportScopeConfig(true);
    closeExportScopeModal();

    const meta = getExportScopePageMeta(pageType);
    const rule = normalizeClientExportScopeRule((exportScopeConfigState.config || {})[meta.source]);
    const modalWidthStyle = 'width: min(640px, 92vw); max-width: 640px;';

    document.body.insertAdjacentHTML('beforeend', `
                <div class="modal-overlay show" id="exportScopeModal" onclick="handleExportScopeOverlayClick(event)" style="z-index: 10022;">
                    <div class="modal-content" style="${modalWidthStyle} max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                        <div class="modal-header" style="padding: 20px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">${meta.title}</h3>
                                <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">仅在填报数据导出时生效，不影响当前页面列表、搜索、高级筛选和数据库原始数据。</div>
                            </div>
                            <button class="modal-close" type="button" onclick="closeExportScopeModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
                        </div>
                        <div class="modal-body" style="padding: 24px; display: grid; gap: 16px;">
                            <input type="hidden" id="exportScopePageType" value="${pageType}">
                            <label style="display: inline-flex; align-items: center; gap: 10px; font-size: 14px; color: #163c7a; font-weight: 600;">
                                <input type="checkbox" id="exportScopeEnabled" ${rule.enabled ? 'checked' : ''} onchange="syncExportScopeModalState()">
                                启用整体筛选
                            </label>
                            <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px;">
                                <div class="form-group">
                                    <label>筛选模式</label>
                                    <select id="exportScopeMode" onchange="syncExportScopeModalState()">
                                        <option value="all" ${rule.mode === 'all' ? 'selected' : ''}>全量</option>
                                        <option value="top_n" ${rule.mode === 'top_n' ? 'selected' : ''}>前N行</option>
                                        <option value="top_percent" ${rule.mode === 'top_percent' ? 'selected' : ''}>前N%</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>筛选值</label>
                                    <input type="number" id="exportScopeValue" min="0" step="1" value="${rule.value ?? 0}" oninput="syncExportScopeModalState()">
                                </div>
                            </div>
                            <div id="exportScopeValueNote" style="font-size: 12px; color: #5f6f86;"></div>
                            <div id="exportScopePreview" style="padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(18, 92, 196, 0.12); background: linear-gradient(180deg, rgba(244, 248, 255, 0.96) 0%, rgba(236, 243, 255, 0.92) 100%); color: #345071; font-size: 13px; line-height: 1.7;"></div>
                        </div>
                        <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; align-items: center;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button class="btn" type="button" onclick="resetExportScopeFromModal()">恢复全量</button>
                            </div>
                            <div class="modal-footer-right">
                                <button class="btn" type="button" onclick="closeExportScopeModal()">取消</button>
                                <button class="btn btn-primary" type="button" onclick="saveExportScopeConfigFromModal()">保存</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);

    syncExportScopeModalState();
}

function resetExportScopeFromModal() {
    const enabledEl = document.getElementById('exportScopeEnabled');
    const modeEl = document.getElementById('exportScopeMode');
    const valueEl = document.getElementById('exportScopeValue');
    if (!enabledEl || !modeEl || !valueEl) return;

    enabledEl.checked = false;
    modeEl.value = 'all';
    valueEl.value = '0';
    syncExportScopeModalState();
}

async function saveExportScopeConfigFromModal() {
    const pageTypeEl = document.getElementById('exportScopePageType');
    const enabledEl = document.getElementById('exportScopeEnabled');
    const modeEl = document.getElementById('exportScopeMode');
    const valueEl = document.getElementById('exportScopeValue');

    if (!pageTypeEl || !enabledEl || !modeEl || !valueEl) {
        showToast('整体筛选表单未初始化完成', true);
        return;
    }

    const meta = getExportScopePageMeta(pageTypeEl.value);
    const enabled = enabledEl.checked;
    const mode = modeEl.value;
    let value = mode === 'top_percent'
        ? (Number.parseFloat(valueEl.value) || 0)
        : (Number.parseInt(valueEl.value, 10) || 0);

    if (enabled && mode === 'top_n' && value <= 0) {
        showToast('前N行必须大于0', true);
        valueEl.focus();
        return;
    }
    if (enabled && mode === 'top_percent' && (value <= 0 || value > 100)) {
        showToast('前N%必须在 1 到 100 之间', true);
        valueEl.focus();
        return;
    }

    if (!enabled || mode === 'all') {
        value = 0;
    }

    const nextConfig = {
        ...(exportScopeConfigState.config || {}),
        [meta.source]: {
            enabled,
            mode,
            value
        }
    };

    try {
        const response = await fetch(API_BASE + '/export-scope-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: nextConfig })
        });
        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.error || '保存整体筛选失败');
        }

        exportScopeConfigState = {
            config: {
                assets: normalizeClientExportScopeRule(result.config?.assets),
                merge_results: normalizeClientExportScopeRule(result.config?.merge_results)
            },
            sourceTotals: {
                assets: Number(result.source_totals?.assets) || 0,
                merge_results: Number(result.source_totals?.merge_results) || 0
            }
        };

        renderExportScopeSummary('device');
        renderExportScopeSummary('merge');
        closeExportScopeModal();
        showToast(`${meta.pageLabel}整体筛选已保存`, false);
    } catch (error) {
        console.error('保存整体筛选失败:', error);
        showToast('保存整体筛选失败: ' + error.message, true);
    }
}

async function fetchAdvancedFilterData(pageType, page, pageSizeValue, categoryValue = '') {
    const filter = advancedFilterState[pageType];
    if (!filter) return null;

    const endpoint = pageType === 'merge'
        ? API_BASE + '/merge/advanced-search'
        : API_BASE + '/assets/advanced-search';
    const payload = {
        page: page,
        page_size: pageSizeValue,
        conditions: [
            {
                field: filter.field,
                operator: filter.operator,
                value: filter.value
            }
        ]
    };

    if (pageType === 'merge') {
        payload.category = categoryValue || '';
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok || result.success === false) {
        throw new Error(result.error || '高级筛选失败');
    }

    return {
        total: result.total || 0,
        data: result.data || []
    };
}

// 初始化
async function init() {
    // 更新API地址显示
    const apiUrl = window.location.origin;
    const backendInfo = document.getElementById('backendInfo');
    const backendInfo2 = document.getElementById('backendInfo2');
    if (backendInfo) backendInfo.textContent = 'API: ' + apiUrl;
    if (backendInfo2) backendInfo2.textContent = 'API: ' + apiUrl;

    await loadColumns();
    renderColumnToggles();
    await loadStats();
    await loadData();
}

// 加载列定义
async function loadColumns() {
    try {
        const res = await fetch(API_BASE + '/columns');
        const data = await res.json();

        // 兼容新旧格式
        if (data.columns || data.pageSize) {
            // 旧格式，转换为"全部"模式
            allConfigs = {
                '全部': {
                    columns: data.columns || [],
                    pageSize: data.pageSize || 50,
                    sourceFile: data.sourceFile || '',
                    headerHeight: data.headerHeight || 40
                }
            };
        } else {
            // 新格式，所有模式的配置
            allConfigs = data;
        }

        // 根据当前模式加载对应配置
        loadCurrentModeConfig();
    } catch (e) {
        showToast('加载列配置失败', true);
        columns = [];
    }
}

// 加载当前模式的配置
function loadCurrentModeConfig() {
    const modeKey = currentCategory || '全部';
    const config = allConfigs[modeKey] || allConfigs['全部'] || {};

    columns = config.columns || [];
    pageSize = config.pageSize || 50;
    pendingPageSize = pageSize;
    sourceFile = config.sourceFile || '';
    headerHeight = config.headerHeight || 40;
    pendingHeaderHeight = headerHeight;

    // 加载操作列配置
    actionColumnConfig = config.actionColumn || { width: 120, color: '#495057' };

    // 获取模式颜色（用于操作列）
    const modeColor = getCurrentModeColor();

    // 更新页面显示
    document.getElementById('pageSizePanelSelect').value = pageSize;
    document.getElementById('headerHeightInput').value = headerHeight;
    document.getElementById('headerColorInput').value = modeColor;
    document.getElementById('actionWidthInput').value = actionColumnConfig.width;
    document.getElementById('actionColorInput').value = actionColumnConfig.color;
    updateSourceFileDisplay();
    updateColumnSettingsTitle();
    syncAdvancedFilterWithColumns('device');
}

// 更新列设置标题
function updateColumnSettingsTitle() {
    const title = document.querySelector('.column-panel-title');
    if (title) {
        const modeName = currentCategory || '全部';
        title.textContent = modeName + ' - 列表设置：';
    }
}

// 更新数据来源显示
function updateSourceFileDisplay() {
    const el = document.getElementById('sourceFileDisplay');
    if (el) {
        el.textContent = sourceFile || '未知';
    }
    // 显示下载按钮（如果有源文件）
    const downloadBtn = document.getElementById('downloadSourceBtn');
    if (downloadBtn) {
        downloadBtn.style.display = sourceFile && sourceFile !== '未知' ? 'inline-block' : 'none';
    }
}

// 预览数据更新
function previewUpdate(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const updateFileNameEl = document.getElementById('updateFileName');
    if (updateFileNameEl) {
        updateFileNameEl.textContent = file.name;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast('正在分析Excel文件...', false);

        fetch(API_BASE + '/import/preview', {
            method: 'POST',
            body: formData
        }).then(res => res.json()).then(result => {
            if (result.success) {
                pendingImportFile = file;  // 保存文件供确认使用
                pendingImportData = result;
                showUpdatePreview(result, file);
            } else {
                showToast(result.error || '预览失败', true);
            }
        }).catch(e => {
            showToast('预览失败: ' + e.message, true);
        });
    } catch (e) {
        showToast('预览失败: ' + e.message, true);
    }

    // 清空input以便重复选择同一文件
    input.value = '';
}

// 显示数据更新预览
function showUpdatePreview(data, file) {
    const container = document.getElementById('importPreview');
    const currentCols = new Set(columns.map(c => c.name));
    const newCols = new Set(data.columns);

    // 计算差异
    const added = [...newCols].filter(c => !currentCols.has(c));
    const removed = [...currentCols].filter(c => !newCols.has(c));

    let html = '<div class="import-diff">';
    html += '<h4>更新文件: ' + file.name + '</h4>';

    if (added.length > 0) {
        html += '<div class="diff-item diff-added">+ 新增列: ' + added.join(', ') + '</div>';
    }
    if (removed.length > 0) {
        html += '<div class="diff-item diff-removed">- 缺少列: ' + removed.join(', ') + '</div>';
    }
    if (added.length === 0 && removed.length === 0) {
        html += '<div class="diff-item diff-unchanged">列结构一致</div>';
    }

    html += '</div>';

    // 统计信息
    html += '<div class="import-stats">';
    html += '<div class="import-stat">新数据行数: <b>' + data.rowCount + '</b></div>';
    html += '<div class="import-stat">匹配到现有记录: <b>' + (data.matchedCount || 0) + '</b> 条</div>';
    html += '<div class="import-stat">新增记录: <b>' + (data.newCount || data.rowCount) + '</b> 条</div>';
    html += '</div>';

    container.innerHTML = html;
    document.getElementById('importModal').classList.add('show');
}

// 预览标题行高度
function previewHeaderHeight(value) {
    pendingHeaderHeight = parseInt(value) || 40;
    renderTable();
}

// 下载源文件
function downloadSourceFile() {
    if (!sourceFile || sourceFile === '未知') {
        showToast('没有可下载的源文件', true);
        return;
    }
    // 触发下载API
    window.location.href = API_BASE + '/download-source?file=' + encodeURIComponent(sourceFile);
}

// 加载统计数据
async function loadStats() {
    try {
        const res = await fetch(API_BASE + '/stats');
        const stats = await res.json();
        const totalCountEl = document.getElementById('totalCount');
        if (totalCountEl) totalCountEl.textContent = stats.total;
        const systemCountEl = document.getElementById('systemCount');
        if (systemCountEl) systemCountEl.textContent = stats.systemCount;
    } catch (e) { }
}

// 加载筛选器选项
// 渲染列显示控制
function renderColumnToggles() {
    const container = document.getElementById('columnToggles');
    const modeColor = getCurrentModeColor();
    container.innerHTML = columns.map((col, i) => {
        const colColor = col.color || modeColor;
        return '<label class="column-toggle' + (col.visible ? '' : ' hidden') + '" style="border-left-color: ' + colColor + '">' +
            '<div class="column-toggle-top">' +
            '<input type="checkbox" ' + (col.visible ? 'checked' : '') + ' onchange="toggleColumn(' + i + ')"> ' +
            '<span class="column-toggle-name" contenteditable="true" onblur="updateColumnName(' + i + ', this.textContent)">' + col.name + '</span>' +
            '</div>' +
            '<div class="column-toggle-bottom">' +
            '<label>宽度:</label>' +
            '<input type="number" min="50" max="500" step="10" value="' + (col.width || 120) + '" onchange="changeColumnWidth(' + i + ', this.value)">' +
            '<span>px</span>' +
            '</div>' +
            '<div class="column-toggle-actions">' +
            '<button class="column-toggle-btn" onclick="toggleColumn(' + i + ')">' + (col.visible ? '隐藏' : '显示') + '</button>' +
            '<button class="column-toggle-btn delete" onclick="deleteColumn(' + i + ')">删除</button>' +
            '</div>' +
            '</label>';
    }).join('');
}

// 获取当前模式颜色
function getCurrentModeColor() {
    const modeKey = currentCategory || '全部';
    const config = allConfigs[modeKey] || allConfigs['全部'] || {};
    // 从第一列获取模式颜色，或使用默认颜色
    if (config.columns && config.columns.length > 0) {
        return config.columns[0].color || getDefaultModeColor();
    }
    return getDefaultModeColor();
}

// 获取模式默认颜色
function getDefaultModeColor() {
    const colors = {
        '': '#495057',      // 全部 - 灰色
        'SMC': '#28a745',   // SMC - 绿色
        '业支': '#007bff',  // 业支 - 蓝色
        '信安': '#dc3545'   // 信安 - 红色
    };
    return colors[currentCategory] || '#495057';
}

// 预览标题颜色
function previewHeaderColor(color) {
    // 更新所有列的颜色
    columns.forEach(col => col.color = color);
    renderColumnToggles();
    renderTable();
}

// 预览操作列宽度
function previewActionWidth(width) {
    actionColumnConfig.width = parseInt(width) || 120;
    renderTable();
}

// 预览操作列颜色
function previewActionColor(color) {
    actionColumnConfig.color = color;
    renderTable();
}

// 更新列名
function updateColumnName(index, newName) {
    newName = newName.trim();
    if (!newName) {
        // 空名称，恢复原名称
        renderColumnToggles();
        return;
    }
    if (newName !== columns[index].name) {
        // 检查是否与其他列重名
        if (columns.some((col, i) => i !== index && col.name === newName)) {
            showToast('列名已存在', true);
            renderColumnToggles();
            return;
        }
        columns[index].name = newName;
        renderTable(); // 立即更新表格显示
        showToast('列名已修改，请点击保存按钮生效', false);
    }
}

// 添加新列
function addNewColumn() {
    const input = document.getElementById('newColumnName');
    const name = input.value.trim();

    if (!name) {
        showToast('请输入列名称', true);
        return;
    }

    // 检查是否已存在
    if (columns.some(col => col.name === name)) {
        showToast('列名已存在', true);
        return;
    }

    // 添加新列
    columns.push({
        name: name,
        visible: true,
        width: 120
    });

    input.value = '';
    renderColumnToggles();
    showToast('新列已添加，请点击保存按钮生效', false);
}

// 删除列
function deleteColumn(index) {
    if (!confirm('确定要删除列 "' + columns[index].name + '" 吗？')) return;

    columns.splice(index, 1);
    renderColumnToggles();
    showToast('列已删除，请点击保存按钮生效', false);
}

// 切换列显示（不立即保存）
function toggleColumn(index) {
    columns[index].visible = !columns[index].visible;
    renderColumnToggles();
    renderTable();
}

// 修改列宽（不立即保存）
function changeColumnWidth(index, width) {
    columns[index].width = parseInt(width) || 120;
    renderTable();
}

// 保存列设置到后端
async function saveColumnSettings() {
    try {
        const modeKey = currentCategory || '全部';
        const modeColor = document.getElementById('headerColorInput').value;

        // 统一所有列的颜色
        columns.forEach(col => col.color = modeColor);

        // 获取操作列配置
        actionColumnConfig.width = parseInt(document.getElementById('actionWidthInput').value) || 120;
        actionColumnConfig.color = document.getElementById('actionColorInput').value;

        // 更新当前模式的配置
        allConfigs[modeKey] = {
            columns: columns,
            pageSize: pendingPageSize,
            sourceFile: sourceFile,
            headerHeight: pendingHeaderHeight,
            actionColumn: actionColumnConfig
        };

        const columnSaveRes = await fetch(API_BASE + '/columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allConfigs)
        });
        await parseApiResult(columnSaveRes, '保存失败');

        pageSize = pendingPageSize;
        headerHeight = pendingHeaderHeight;
        currentPage = 1;
        await loadData();
        updateSourceFileDisplay();
        showToast('列设置已保存', false);
    } catch (e) {
        showToast('保存失败', true);
    }
}

// 预览每页显示数量（不立即应用）
function previewPageSize(value) {
    pendingPageSize = parseInt(value);
}

// 获取实际pageSize（-1表示全部显示）
function getActualPageSize() {
    return pageSize === -1 ? 999999 : pageSize;
}

// 获取实际pendingPageSize
function getActualPendingPageSize() {
    return pendingPageSize === -1 ? 999999 : pendingPageSize;
}

// 显示/隐藏列面板
function toggleColumnPanel() {
    document.getElementById('columnPanel').classList.toggle('show');
}

function resetWorkspaceView(pageType) {
    const isMerge = pageType === 'merge';
    const searchInput = document.getElementById(isMerge ? 'searchInput2' : 'searchInput');
    if (searchInput) {
        searchInput.value = '';
    }

    if (advancedFilterState && advancedFilterState[pageType]) {
        advancedFilterState[pageType] = null;
        if (typeof renderAdvancedFilterSummary === 'function') {
            renderAdvancedFilterSummary(pageType);
        }
    }

    if (isMerge) {
        currentPage2 = 1;
        loadMergeData();
    } else {
        currentPage = 1;
        loadData();
    }
}

function updateWorkspaceEmptyState(pageType, options = {}) {
    const isMerge = pageType === 'merge';
    const emptyState = document.getElementById(isMerge ? 'mergeEmptyState' : 'deviceEmptyState');
    const titleEl = document.getElementById(isMerge ? 'mergeEmptyStateTitle' : 'deviceEmptyStateTitle');
    const descEl = document.getElementById(isMerge ? 'mergeEmptyStateDesc' : 'deviceEmptyStateDesc');
    const actionsEl = emptyState ? emptyState.querySelector('.workspace-empty-state__actions') : null;
    const auxBtn = document.getElementById(isMerge ? 'mergeEmptyStateAuxBtn' : 'deviceEmptyStateAuxBtn');
    const tableContainer = document.getElementById(isMerge ? 'mergeTableContainer' : 'deviceTableContainer');
    const pagination = document.getElementById(isMerge ? 'mergePagination' : 'devicePagination');

    if (!emptyState || !titleEl || !descEl || !actionsEl || !auxBtn || !tableContainer || !pagination) {
        return;
    }

    if (options.hasData) {
        emptyState.hidden = true;
        emptyState.style.display = 'none';
        tableContainer.hidden = false;
        tableContainer.style.display = '';
        pagination.hidden = false;
        pagination.style.display = '';
        actionsEl.hidden = true;
        auxBtn.hidden = true;
        auxBtn.onclick = null;
        return;
    }

    let title = isMerge ? '当前还没有导入任何合并结果' : '当前还没有导入任何资产数据';
    let desc = isMerge
        ? '请使用上方工具栏中的“导入数据”导入结果表，或先从数据处理页生成并整理结果后再导入。'
        : '请使用上方工具栏中的“导入数据”导入数据，页面会在导入完成后显示列表内容。';
    let auxLabel = '';
    let auxHandler = null;

    if (options.error) {
        title = isMerge ? '暂时无法读取合并结果数据' : '暂时无法读取数据概览';
        desc = options.message || '请确认后端服务已经启动，再点击“重新加载”重试。';
        auxLabel = '重新加载';
        auxHandler = isMerge ? loadMergeData : loadData;
    } else if (options.hasSearch || options.hasFilter) {
        title = '当前条件下没有找到数据';
        desc = options.hasFilter
            ? '请调整关键词或高级筛选条件后重试，也可以直接清空当前条件恢复全量视图。'
            : '请调整搜索关键词后重试，也可以直接清空当前条件恢复全量视图。';
        auxLabel = '清空条件';
        auxHandler = () => resetWorkspaceView(pageType);
    } else if (options.noColumns) {
        title = isMerge ? '请先导入一份合并结果表' : '当前还没有可显示的列表列';
        desc = isMerge
            ? '请使用上方工具栏中的“导入数据”导入结果表，首次导入后会自动生成列配置并显示数据。'
            : '请先确认列配置，或通过上方工具栏导入一份数据源，随后页面会自动显示可用字段。';
    }

    titleEl.textContent = title;
    descEl.textContent = desc;
    emptyState.hidden = false;
    emptyState.style.display = 'flex';
    tableContainer.hidden = true;
    tableContainer.style.display = 'none';
    pagination.hidden = true;
    pagination.style.display = 'none';

    if (auxLabel && auxHandler) {
        actionsEl.hidden = false;
        auxBtn.hidden = false;
        auxBtn.textContent = auxLabel;
        auxBtn.onclick = auxHandler;
    } else {
        actionsEl.hidden = true;
        auxBtn.hidden = true;
        auxBtn.onclick = null;
    }
}

// 加载数据
async function loadData() {
    // 生成新的请求序号
    const requestId = ++dataRequestId;

    const search = document.getElementById('searchInput').value;

    const actualPageSize = getActualPageSize();

    try {
        let result;
        if (advancedFilterState.device) {
            result = await fetchAdvancedFilterData('device', currentPage, actualPageSize, currentCategory);
        } else {
            const params = new URLSearchParams({
                page: currentPage,
                pageSize: actualPageSize,
                search: search,
                category: currentCategory
            });
            const res = await fetch(API_BASE + '/assets?' + params);
            result = await res.json();
        }

        // 只处理最新的请求响应
        if (requestId !== dataRequestId) {
            return;
        }

        totalRecords = result.total;
        renderTable(result.data);
        updatePagination();
        updateStats();
    } catch (e) {
        // 只处理最新的请求错误
        if (requestId === dataRequestId) {
            currentData = [];
            totalRecords = 0;
            showToast('加载数据失败，请确保后端服务已启动', true);
            updateWorkspaceEmptyState('device', {
                hasData: false,
                error: true,
                message: '无法连接到后端服务，请先运行“启动数管系统.bat”或执行 python core/app.py。'
            });
            updatePagination();
            updateStats();
        }
    }
}

// 渲染表格
function renderTable(data) {
    // 如果没有传递数据，使用缓存的数据
    if (!data) data = currentData;
    else currentData = data;

    const visibleCols = columns.filter(c => c.visible);
    const modeColor = getCurrentModeColor();

    // 渲染表头（应用固定列宽、高度和统一颜色）
    const h = document.getElementById('tableHeader');
    h.innerHTML = visibleCols.map(c => {
        const width = c.width || 120;
        return '<th style="width:' + width + 'px;max-width:' + width + 'px;height:' + pendingHeaderHeight + 'px;vertical-align:middle;background-color:' + modeColor + ';" title="' + c.name + '">' + c.name + '</th>';
    }).join('') + '<th class="col-actions" style="width:' + actionColumnConfig.width + 'px;max-width:' + actionColumnConfig.width + 'px;height:' + pendingHeaderHeight + 'px;vertical-align:middle;background-color:' + actionColumnConfig.color + ';">操作</th>';

    // 按序号列排序（从小到大）
    if (data && data.length > 0) {
        data.sort((a, b) => {
            const seqA = parseFloat(a['序号']) || 0;
            const seqB = parseFloat(b['序号']) || 0;
            return seqA - seqB;
        });
    }

    // 渲染数据
    const b = document.getElementById('tableBody');
    if (!data || data.length === 0) {
        const hasDeviceSearch = !!((document.getElementById('searchInput')?.value || '').trim());
        updateWorkspaceEmptyState('device', {
            hasData: false,
            hasSearch: hasDeviceSearch,
            hasFilter: !!advancedFilterState.device,
            noColumns: visibleCols.length === 0
        });
        b.innerHTML = '<tr><td colspan="22" class="loading">暂无数据</td></tr>';
        return;
    }

    updateWorkspaceEmptyState('device', { hasData: true });

    b.innerHTML = data.map(row => {
        return '<tr>' + visibleCols.map(c => {
            let v = row[c.name];
            const width = c.width || 120;

            const cellContent = (v || '-');
            return '<td style="width:' + width + 'px;max-width:' + width + 'px;" class="' + (!v ? 'empty' : '') + '" title="' + cellContent + '">' + cellContent + '</td>';
        }).join('') + '<td class="col-actions" style="width:' + actionColumnConfig.width + 'px;max-width:' + actionColumnConfig.width + 'px;">' +
            '<button class="btn btn-sm" onclick="editRow(' + row.id + ')">编辑</button>' +
            '</td></tr>';
    }).join('');
}

// 更新分页
function updatePagination() {
    if (pageSize === -1) {
        // 全部显示模式
        document.getElementById('paginationInfo').textContent = '全部显示，共 ' + totalRecords + ' 条';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
    } else {
        const totalPages = Math.ceil(totalRecords / pageSize) || 1;
        document.getElementById('paginationInfo').textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页，共 ' + totalRecords + ' 条';
        document.getElementById('prevBtn').disabled = currentPage === 1;
        document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    }
}

// 更新统计
function updateStats() {
    const displayCountEl = document.getElementById('displayCount');
    if (displayCountEl) displayCountEl.textContent = totalRecords;
}

function bindEditModalHandlers(pageType) {
    const saveBtn = document.getElementById('editModalSaveBtn');
    const deleteBtn = document.getElementById('editModalDeleteBtn');
    const deleteBtnArea = document.getElementById('deleteBtnArea');
    const isMergePage = pageType === 'merge';

    if (saveBtn) {
        saveBtn.onclick = isMergePage ? saveEdit2 : saveEdit;
    }

    if (deleteBtn) {
        deleteBtn.onclick = isMergePage ? deleteAsset2 : deleteAsset;
    }

    // 删除逻辑只绑定到真实按钮，避免外层容器残留旧页面处理器。
    if (deleteBtnArea) {
        deleteBtnArea.onclick = null;
    }
}

// 编辑行
async function editRow(id) {
    editingId = id;
    try {
        const res = await fetch(API_BASE + '/assets/' + id);
        const row = await res.json();

        document.getElementById('modalTitle').textContent = '编辑资产 - ' + (row['数据资产名称'] || row['业务系统']);
        document.getElementById('deleteBtnArea').style.display = 'block';
        bindEditModalHandlers('device');

        const form = document.getElementById('editForm');
        form.innerHTML = columns.map(col => `
                    <div class="form-group">
                        <label>${col.name}</label>
                        <input type="text" id="edit_${col.name}" value="${row[col.name] || ''}">
                    </div>
                `).join('');

        document.getElementById('editModal').classList.add('show');
    } catch (e) {
        showToast('加载资产信息失败', true);
    }
}

// 关闭模态框
function closeModal() {
    document.getElementById('editModal').classList.remove('show');
    editingId = null;
    editingId2 = null;
    bindEditModalHandlers('device');
}

// 保存
async function saveEdit() {
    const data = {};
    columns.forEach(col => {
        const input = document.getElementById('edit_' + col.name);
        if (input) data[col.name] = input.value;
    });

    try {
        if (editingId) {
            // 更新
            const updateRes = await fetch(API_BASE + '/assets/' + editingId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await parseApiResult(updateRes, '保存失败');
        } else {
            // 新增
            const createRes = await fetch(API_BASE + '/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await parseApiResult(createRes, '保存失败');
            editingId = result && result.id;
        }
        closeModal();
        loadData();
        showToast('保存成功', false);
    } catch (e) {
        showToast('保存失败', true);
    }
}

// 删除资产
async function deleteAsset() {
    if (!confirm('确定要删除这条资产记录吗？')) return;

    try {
        const deleteRes = await fetch(API_BASE + '/assets/' + editingId, { method: 'DELETE' });
        await parseApiResult(deleteRes, '删除失败');
        closeModal();
        loadData();
        await loadStats();
        showToast('删除成功', false);
    } catch (e) {
        showToast('删除失败', true);
    }
}

function formatExportSuccessToast(result) {
    const totalRows = Number(result.total_rows || 0).toLocaleString();
    return `导出成功！\n文件名: ${result.filename}\n总行数: ${totalRows}条\n保存位置: ${result.output_path}`;
}

async function runCancelableExport(apiUrl, confirmMessage) {
    if (confirmMessage && !confirm(confirmMessage)) {
        return;
    }

    showExportProgressModal();

    const taskId = createExportTaskId();
    const controller = new AbortController();
    exportProgressContext.taskId = taskId;
    exportProgressContext.controller = controller;

    try {
        pollExportProgress(taskId);

        const res = await fetch(appendExportTaskId(apiUrl, taskId), {
            signal: controller.signal
        });
        const result = await res.json();

        if (!res.ok || (!result.success && !result.started)) {
            updateExportProgressError(result.error || '未知错误');
            return;
        }

        if (result.success && !result.started) {
            updateExportProgressCompleted(result);
        }
    } catch (e) {
        if (e && e.name === 'AbortError' && exportProgressContext.cancelRequested) {
            return;
        }

        updateExportProgressError(e.message || '导出请求失败');
    }
}

// 导出业支上报表 - i_10600_10001
async function exportYejiI106001() {
    return runCancelableExport(
        API_BASE + '/export/yeji/i_10600_10001',
        '确认导出业支上报表 i_10600_10001？\n\n这将导出所有"业支网"相关的数据库资产信息。'
    );
}

// 导出业支上报表 - i_10600_10002（字段信息，约30万行）
async function exportYejiI106002() {
    return runCancelableExport(
        API_BASE + '/export/yeji/i_10600_10002',
        '确认导出业支上报表 i_10600_10002？\n\n注意：此操作将导出约30万条字段级别记录，\n预计需要2-3分钟，请耐心等待。\n\n导出期间请勿关闭浏览器！'
    );
}

// 导出业支上报表 - i_10600_10004（数据策略上报清单）
async function exportYejiI106004() {
    return runCancelableExport(
        API_BASE + '/export/yeji/i_10600_10004',
        '确认导出业支上报表 i_10600_10004（数据策略上报清单）？\n\n注意：此操作将导出数据脱敏策略相关信息。\n\n导出期间请勿关闭浏览器！'
    );
}

// 导出信安上报-数据资产汇总表
async function exportXinanI1060000() {
    return runCancelableExport(
        API_BASE + '/export/xinan/i_10600_00000',
        '确认导出信安上报表 i_10600_00000（数据资产汇总表）？\n\n注意：此操作将导出约400条数据资产记录。\n\n导出期间请勿关闭浏览器！'
    );
}

// 导出信安上报-数据资产字段信息表
async function exportXinanI1060100() {
    return runCancelableExport(
        API_BASE + '/export/xinan/i_10600_10001',
        '确认导出信安上报表 i_10600_10001（数据资产字段信息表）？\n\n注意：此操作将导出所有字段的详细信息。\n\n导出期间请勿关闭浏览器！'
    );
}

// 导出SMC上报-附件三（数据资产清单）
async function exportSmcAttachment3() {
    return runCancelableExport(
        API_BASE + '/export/smc/attachment_3',
        '确认导出SMC上报表 附件三（数据资产清单）？\n\n注意：此操作将导出数据资产清单信息。\n\n导出期间请勿关闭浏览器！'
    );
}

// 导出SMC上报-附件五（涉敏资产梳理汇总表）
async function exportSmcAttachment5() {
    return runCancelableExport(
        API_BASE + '/export/smc/attachment_5',
        '确认导出SMC上报表 附件五（涉敏资产梳理汇总表）？\n\n注意：此操作将导出涉敏资产梳理汇总信息。\n\n导出期间请勿关闭浏览器！'
    );
}

// 导出合并结果到Excel
async function exportMergeResultsToExcel() {
    if (!confirm('确认导出当前合并结果数据到Excel？\n\n这将导出所有合并结果的数据记录。')) {
        return;
    }

    try {
        showToast('正在导出合并结果数据，请稍候...', false);

        const res = await fetch(API_BASE + '/export/merge-results/all');
        const result = await res.json();

        if (result.success) {
            showToast(`导出成功！\n文件名: ${result.filename}\n保存位置: ${result.output_path}`, false, 5000);
            // 刷新文件列表
            await loadStoredFiles();
        } else {
            showToast('导出失败: ' + (result.error || '未知错误'), true);
        }
    } catch (e) {
        showToast('导出失败: ' + e.message, true);
        console.error('导出错误:', e);
    }
}

// 导出数据概览到Excel
async function exportAssetsToExcel() {
    if (!confirm('确认导出当前数据概览数据到Excel？\n\n这将导出所有数据概览的记录。')) {
        return;
    }

    try {
        showToast('正在导出数据概览数据，请稍候...', false);

        const res = await fetch(API_BASE + '/export/assets/all');
        const result = await res.json();

        if (result.success) {
            showToast(`导出成功！\n文件名: ${result.filename}\n保存位置: ${result.output_path}`, false, 5000);
            // 刷新文件列表
            await loadStoredFiles();
        } else {
            showToast('导出失败: ' + (result.error || '未知错误'), true);
        }
    } catch (e) {
        showToast('导出失败: ' + e.message, true);
        console.error('导出错误:', e);
    }
}

// 显示导出进度模态框
let progressPollingInterval = null;
let exportProgressContext = {
    taskId: null,
    controller: null,
    cancelRequested: false,
    terminalHandled: false,
    terminalStatus: '',
    autoCloseTimer: null,
    toastShown: false
};

function clearExportProgressPolling() {
    if (progressPollingInterval) {
        clearInterval(progressPollingInterval);
        progressPollingInterval = null;
    }
}

function resetExportProgressContext() {
    clearExportProgressPolling();
    if (exportProgressContext.autoCloseTimer) {
        clearTimeout(exportProgressContext.autoCloseTimer);
    }

    exportProgressContext = {
        taskId: null,
        controller: null,
        cancelRequested: false,
        terminalHandled: false,
        terminalStatus: '',
        autoCloseTimer: null,
        toastShown: false
    };
}

function setExportProgressAction(mode) {
    const closeBtn = document.getElementById('exportProgressCloseBtn');
    closeBtn.dataset.action = mode;
    closeBtn.style.display = 'block';
    closeBtn.disabled = false;
    closeBtn.textContent = mode === 'cancel' ? '取消导出' : '关闭';
}

function handleExportProgressAction() {
    const closeBtn = document.getElementById('exportProgressCloseBtn');
    if ((closeBtn.dataset.action || 'close') === 'cancel') {
        cancelExportTask();
        return;
    }

    closeExportProgressModal();
}

function showExportProgressModal() {
    resetExportProgressContext();
    const modal = document.getElementById('exportProgressModal');
    modal.style.display = 'flex';

    // 重置进度条
    document.getElementById('exportProgressStatus').textContent = '准备中...';
    document.getElementById('exportProgressStatus').style.color = '#667eea';
    document.getElementById('exportProgressMessage').textContent = '请稍候...';
    document.getElementById('exportProgressPercent').textContent = '0%';
    document.getElementById('exportProgressBar').style.width = '0%';
    document.getElementById('exportProgressBar').style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
    document.getElementById('exportProgressCount').textContent = '';
    setExportProgressAction('cancel');
}

// 关闭导出进度模态框
function closeExportProgressModal() {
    document.getElementById('exportProgressModal').style.display = 'none';
    resetExportProgressContext();
}

function createExportTaskId() {
    return `export-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function appendExportTaskId(apiUrl, taskId) {
    const separator = apiUrl.includes('?') ? '&' : '?';
    return `${apiUrl}${separator}task_id=${encodeURIComponent(taskId)}`;
}

function scheduleExportModalClose(callback) {
    if (exportProgressContext.autoCloseTimer) {
        clearTimeout(exportProgressContext.autoCloseTimer);
    }
    exportProgressContext.autoCloseTimer = setTimeout(() => {
        closeExportProgressModal();
        if (typeof callback === 'function') {
            callback();
        }
    }, 1500);
}

function markExportTerminalState(status) {
    exportProgressContext.terminalHandled = true;
    exportProgressContext.terminalStatus = status;
    clearExportProgressPolling();
}

async function fetchExportProgressOnce(taskId) {
    const res = await fetch(API_BASE + '/export/progress?task_id=' + encodeURIComponent(taskId));
    const progress = await res.json();
    updateExportProgressUI(progress);

    if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'canceled') {
        clearExportProgressPolling();
    }

    return progress;
}

function pollExportProgress(taskId) {
    clearExportProgressPolling();

    const tick = async () => {
        try {
            await fetchExportProgressOnce(taskId);
        } catch (e) {
            if (!exportProgressContext.cancelRequested) {
                console.error('获取进度失败:', e);
            }
        }
    };

    tick();
    progressPollingInterval = setInterval(tick, 1000);
}

async function cancelExportTask() {
    if (!exportProgressContext.taskId || exportProgressContext.cancelRequested) {
        return;
    }

    exportProgressContext.cancelRequested = true;

    if (exportProgressContext.controller) {
        try {
            exportProgressContext.controller.abort();
        } catch (abortErr) {
            console.warn('取消导出请求中止失败:', abortErr);
        }
    }

    const statusEl = document.getElementById('exportProgressStatus');
    const messageEl = document.getElementById('exportProgressMessage');
    statusEl.textContent = '正在取消...';
    statusEl.style.color = '#fd7e14';
    messageEl.textContent = '正在停止导出任务并清理半成品文件，请稍候...';

    try {
        const res = await fetch(API_BASE + '/export/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ task_id: exportProgressContext.taskId })
        });
        const result = await res.json();

        if (result.status === 'completed') {
            await fetchExportProgressOnce(exportProgressContext.taskId);
            return;
        }

        if (!res.ok) {
            exportProgressContext.cancelRequested = false;
            updateExportProgressError(result.error || '取消导出失败');
            return;
        }

        if (result.status === 'canceled') {
            updateExportProgressCanceled(result);
        }
    } catch (e) {
        exportProgressContext.cancelRequested = false;
        updateExportProgressError(`取消导出失败: ${e.message || e}`);
    }
}

// 更新导出进度UI
function updateExportProgressUI(progress) {
    const statusEl = document.getElementById('exportProgressStatus');
    const messageEl = document.getElementById('exportProgressMessage');
    const percentEl = document.getElementById('exportProgressPercent');
    const barEl = document.getElementById('exportProgressBar');
    const countEl = document.getElementById('exportProgressCount');

    // 更新状态
    if (progress.status === 'running') {
        exportProgressContext.terminalStatus = 'running';
        statusEl.textContent = '正在导出...';
        statusEl.style.color = '#667eea';
        setExportProgressAction('cancel');
    } else if (progress.status === 'canceling') {
        exportProgressContext.terminalStatus = 'canceling';
        statusEl.textContent = '正在取消...';
        statusEl.style.color = '#fd7e14';
        setExportProgressAction('cancel');
    } else if (progress.status === 'completed') {
        updateExportProgressCompleted(progress);
        return;
    } else if (progress.status === 'canceled') {
        updateExportProgressCanceled(progress);
        return;
    } else if (progress.status === 'error') {
        updateExportProgressError(progress.message || '导出失败');
        return;
    } else {
        exportProgressContext.terminalStatus = '';
        statusEl.textContent = '准备中...';
        statusEl.style.color = '#667eea';
        setExportProgressAction('cancel');
    }

    // 更新消息
    if (progress.message) {
        messageEl.textContent = progress.message;
    }

    // 更新进度条
    if (progress.total > 0) {
        const percent = Math.min(100, Math.round((progress.current / progress.total) * 100));
        percentEl.textContent = percent + '%';
        barEl.style.width = percent + '%';
        countEl.textContent = `${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`;
    } else if (progress.status === 'canceling') {
        countEl.textContent = '取消中';
    }
}

// 更新导出完成状态
function updateExportProgressCompleted(result) {
    const statusEl = document.getElementById('exportProgressStatus');
    const messageEl = document.getElementById('exportProgressMessage');
    const percentEl = document.getElementById('exportProgressPercent');
    const barEl = document.getElementById('exportProgressBar');
    const countEl = document.getElementById('exportProgressCount');

    // 更新状态
    statusEl.textContent = '✓ 导出成功！';
    statusEl.style.color = '#28a745';

    // 显示详细信息（多行）
    messageEl.innerHTML = `文件名: ${result.filename}<br>总行数: ${Number(result.total_rows || 0).toLocaleString()} 条<br>保存位置: ${result.output_path}`;

    // 进度条显示100%
    percentEl.textContent = '100%';
    barEl.style.width = '100%';
    countEl.textContent = '完成';

    setExportProgressAction('close');

    if (!exportProgressContext.terminalHandled) {
        markExportTerminalState('completed');
    }

    if (!exportProgressContext.toastShown) {
        exportProgressContext.toastShown = true;
        scheduleExportModalClose(() => {
            showToast(formatExportSuccessToast(result), false, 5000);
        });
    }
}

function updateExportProgressCanceled(result) {
    const statusEl = document.getElementById('exportProgressStatus');
    const messageEl = document.getElementById('exportProgressMessage');
    const percentEl = document.getElementById('exportProgressPercent');
    const barEl = document.getElementById('exportProgressBar');
    const countEl = document.getElementById('exportProgressCount');

    if (!exportProgressContext.terminalHandled) {
        markExportTerminalState('canceled');
    }

    statusEl.textContent = '导出已取消';
    statusEl.style.color = '#6c757d';
    messageEl.textContent = result.message || '导出任务已取消';
    percentEl.textContent = '0%';
    barEl.style.width = '0%';
    barEl.style.background = 'linear-gradient(90deg, #6c757d, #adb5bd)';
    countEl.textContent = '已取消';
    setExportProgressAction('close');

    if (!exportProgressContext.toastShown) {
        exportProgressContext.toastShown = true;
        scheduleExportModalClose(() => {
            showToast(result.message || '导出已取消', false, 4000);
        });
    }
}

// 更新导出错误状态
function updateExportProgressError(error) {
    const statusEl = document.getElementById('exportProgressStatus');
    const messageEl = document.getElementById('exportProgressMessage');

    if (!exportProgressContext.terminalHandled) {
        markExportTerminalState('error');
    }

    statusEl.textContent = '导出失败';
    statusEl.style.color = '#dc3545';
    messageEl.textContent = `错误: ${error}`;
    setExportProgressAction('close');
}

// 导入Excel - 直接导入
async function previewImport(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    pendingImportFile = file;
    pendingImportPageType = 'device';

    // 立即显示导入对话框
    showImportDialog();

    // 直接开始导入，不需要预览
    await confirmImport('update');

    // 清空input以便重复选择同一文件
    input.value = '';
}

// 显示导入预览
function showImportPreview(data) {
    const container = document.getElementById('importPreview');
    const currentCols = new Set(columns.map(c => c.name));
    const newCols = new Set(data.columns);

    // 计算差异
    const added = [...newCols].filter(c => !currentCols.has(c));
    const removed = [...currentCols].filter(c => !newCols.has(c));
    const unchanged = [...currentCols].filter(c => newCols.has(c));

    let html = '<div class="import-diff">';

    if (added.length > 0) {
        html += '<h4>新增列 (' + added.length + '):</h4>';
        html += added.map(c => '<div class="diff-item diff-added">+ ' + c + '</div>').join('');
    }

    if (removed.length > 0) {
        html += '<h4>删除列 (' + removed.length + '):</h4>';
        html += removed.map(c => '<div class="diff-item diff-removed">- ' + c + '</div>').join('');
    }

    if (unchanged.length > 0) {
        html += '<h4>保留列 (' + unchanged.length + '):</h4>';
        html += '<div class="diff-item diff-unchanged">' + unchanged.slice(0, 5).join(', ') + (unchanged.length > 5 ? '...' : '') + '</div>';
    }

    html += '</div>';

    // 统计信息
    html += '<div class="import-stats">';
    html += '<div class="import-stat">新数据行数: <b>' + data.rowCount + '</b></div>';
    html += '<div class="import-stat">合并依据: <b>系统资源ID</b></div>';
    html += '<div class="import-stat">匹配到现有记录: <b>' + (data.matchedCount || 0) + '</b> 条</div>';
    html += '<div class="import-stat">新增记录: <b>' + (data.newCount || data.rowCount) + '</b> 条</div>';
    html += '</div>';

    container.innerHTML = html;
    document.getElementById('importModal').classList.add('show');
}

// 关闭导入对话框
function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
    pendingImportFile = null;
    pendingImportData = null;
}

// 显示一键处理说明对话框
function showAllInOneHelp() {
    document.getElementById('allInOneHelpModal').classList.add('show');
}

// 关闭一键处理说明对话框
function closeAllInOneHelp() {
    document.getElementById('allInOneHelpModal').classList.remove('show');
}

// ==================== 导入模式选择 ====================

let pendingImportPageType = null; // 标记当前导入的页面类型
let pendingMergeImportMode = 'incremental';

// 格式化文件大小
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

// 显示导入对话框（选择文件后立即调用）
function showImportDialog() {
    const modal = document.getElementById('importModeModal');
    const fileInfo = document.getElementById('importFileInfo');
    const statusArea = document.getElementById('importStatusArea');
    const summary = document.getElementById('importPreviewSummary');
    const title = document.getElementById('importModalTitle');
    const actions = document.getElementById('importModalActions');

    if (window.ImportFlowUtils && typeof window.ImportFlowUtils.hideLegacyProgressModal === 'function') {
        window.ImportFlowUtils.hideLegacyProgressModal(document);
    }
    if (typeof closeProgressModal === 'function') {
        closeProgressModal();
    }
    if (typeof mergeImportProgressPollingInterval !== 'undefined' && mergeImportProgressPollingInterval) {
        clearInterval(mergeImportProgressPollingInterval);
        mergeImportProgressPollingInterval = null;
    }

    // 显示模态框
    modal.style.display = 'flex';

    const hasSelectedFile = !!pendingImportFile;
    if (hasSelectedFile) {
        fileInfo.style.display = 'block';
        document.getElementById('importFileName').textContent = pendingImportFile.name;
        document.getElementById('importFileSize').textContent = formatFileSize(pendingImportFile.size);
    } else {
        fileInfo.style.display = 'none';
        document.getElementById('importFileName').textContent = '';
        document.getElementById('importFileSize').textContent = '';
    }

    const beginProgress = () => {
        statusArea.style.display = 'block';
        const importStatusText = document.getElementById('importStatusText');
        if (importStatusText) {
            importStatusText.textContent = '';
            importStatusText.style.display = 'none';
        }
        document.getElementById('importProgressBarWrapper').style.display = 'block';
        document.getElementById('importProgressBar').style.width = '0%';
        document.getElementById('importProgressBar').style.animation = 'progress-stripes 1s linear infinite';
        document.getElementById('importProgressText').textContent = '0%';
        document.getElementById('importProgressDetail').textContent = '正在准备导入...';
    };

    if (pendingImportPageType === 'merge' && !hasSelectedFile) {
        title.textContent = '选择导入模式';
        statusArea.style.display = 'none';
        document.getElementById('importProgressBarWrapper').style.display = 'none';
        if (actions) {
            actions.style.display = 'flex';
        }
        const cancelBtn = document.getElementById('importCancelButton');
        if (cancelBtn) {
            cancelBtn.textContent = '关闭';
            cancelBtn.style.display = 'block';
            cancelBtn.onclick = closeImportModeModal;
        }
        summary.innerHTML = `
                    <div style="padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(19, 94, 196, 0.2); background: rgba(244, 248, 255, 0.92); color: #355070; font-size: 13px; line-height: 1.7;">
                        <div style="font-weight: 600; color: #163c7a; margin-bottom: 6px;">请选择导入策略</div>
                        <div>全量导入：将本次文件数据追加到现有 merge_results。</div>
                        <div>增量导入：按“数据源名称”文本完全匹配，先替换命中的旧数据源，再写入本次文件。</div>
                        <div style="margin-top: 8px; color: #6b7280;">提示：增量导入会在执行前给出替换清单与不匹配数据源提示。</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px;">
                        <button class="btn" type="button" onclick="startMergeImportWithMode('incremental')" style="height: 42px;">增量导入（推荐）</button>
                        <button class="btn" type="button" onclick="startMergeImportWithMode('full')" style="height: 42px;">全量导入（追加）</button>
                    </div>
                `;
        summary.style.display = 'block';
        return;
    }

    beginProgress();
    if (actions) {
        actions.style.display = 'none';
    }
    summary.innerHTML = '';
    summary.style.display = 'none';
    title.textContent = '正在导入';
}

function startMergeImportWithMode(mode) {
    if (pendingImportPageType !== 'merge') return;
    pendingMergeImportMode = mode === 'full' ? 'full' : 'incremental';
    const modal = document.getElementById('importModeModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const fileInput = document.getElementById('importFileInput2');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

function openMergeImportModeSelector() {
    pendingImportFile = null;
    pendingImportData = null;
    pendingImportPageType = 'merge';
    showImportDialog();
}

// 显示导入完成
function showImportComplete(result) {
    stopImportValidationHint();
    const statusArea = document.getElementById('importStatusArea');
    const actions = document.getElementById('importModalActions');
    const title = document.getElementById('importModalTitle');
    const summary = document.getElementById('importPreviewSummary');

    // 更新状态
    document.getElementById('importProgressBar').style.animation = 'none';
    document.getElementById('importProgressBar').style.width = '100%';
    document.getElementById('importProgressBar').style.background = 'linear-gradient(90deg, #28a745, #20c997)';
    document.getElementById('importProgressText').textContent = '100%';
    document.getElementById('importProgressDetail').textContent = `共导入 ${result.total_rows || 0} 条记录`;

    // 显示关闭按钮
    if (actions) {
        actions.style.display = 'flex';
    }
    if (summary) {
        summary.innerHTML = '';
        summary.style.display = 'none';
    }
    const cancelBtn = document.getElementById('importCancelButton');
    if (cancelBtn) {
        cancelBtn.textContent = '关闭';
        cancelBtn.style.display = 'block';
        cancelBtn.onclick = closeImportModeModal;
    }

    title.textContent = '导入成功';
}

// 导入失败
function showImportError(error) {
    stopImportValidationHint();
    const statusArea = document.getElementById('importStatusArea');
    const actions = document.getElementById('importModalActions');
    const title = document.getElementById('importModalTitle');
    const summary = document.getElementById('importPreviewSummary');

    // 更新状态
    document.getElementById('importProgressBar').style.background = '#dc3545';
    document.getElementById('importProgressBar').style.animation = 'none';
    document.getElementById('importProgressText').textContent = '失败';
    document.getElementById('importProgressDetail').textContent = error || '未知错误';

    // 显示关闭按钮
    if (actions) {
        actions.style.display = 'flex';
    }
    if (summary) {
        summary.innerHTML = '';
        summary.style.display = 'none';
    }
    const cancelBtn = document.getElementById('importCancelButton');
    if (cancelBtn) {
        cancelBtn.textContent = '关闭';
        cancelBtn.style.display = 'block';
        cancelBtn.onclick = closeImportModeModal;
    }

    title.textContent = '导入失败';
}

// 关闭导入模式选择对话框
function closeImportModeModal() {
    stopImportValidationHint();
    const modal = document.getElementById('importModeModal');
    modal.style.display = 'none';
    pendingImportFile = null;
    pendingImportData = null;
    pendingImportPageType = null;
    pendingMergeImportMode = 'incremental';

    if (importProgressInterval) {
        clearInterval(importProgressInterval);
        importProgressInterval = null;
    }

    if (window.ImportFlowUtils && typeof window.ImportFlowUtils.hideLegacyProgressModal === 'function') {
        window.ImportFlowUtils.hideLegacyProgressModal(document);
    }
    if (typeof closeProgressModal === 'function') {
        closeProgressModal();
    }
    if (typeof mergeImportProgressPollingInterval !== 'undefined' && mergeImportProgressPollingInterval) {
        clearInterval(mergeImportProgressPollingInterval);
        mergeImportProgressPollingInterval = null;
    }

    // 重置UI
    document.getElementById('importProgressBar').style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
    document.getElementById('importProgressBar').style.width = '0%';
    document.getElementById('importProgressText').textContent = '0%';
    document.getElementById('importProgressDetail').textContent = '';
    const importStatusText = document.getElementById('importStatusText');
    if (importStatusText) {
        importStatusText.textContent = '';
        importStatusText.style.display = 'none';
    }
    const summary = document.getElementById('importPreviewSummary');
    if (summary) {
        summary.innerHTML = '';
        summary.style.display = 'none';
    }
    const cancelBtn = document.getElementById('importCancelButton');
    if (cancelBtn) {
        cancelBtn.textContent = '关闭';
    }
}


// 进度轮询定时器
let importProgressInterval = null;
let importValidationHintInterval = null;
let importValidationStartedAt = 0;

function stopImportValidationHint() {
    if (importValidationHintInterval) {
        clearInterval(importValidationHintInterval);
        importValidationHintInterval = null;
    }

    const cancelBtn = document.getElementById('importCancelButton');
    if (cancelBtn) {
        cancelBtn.disabled = false;
        if (cancelBtn.textContent === '校验中...') {
            cancelBtn.textContent = '关闭';
        }
    }
}

function startImportValidationHint(pageType, mergeImportMode, forceImport) {
    stopImportValidationHint();

    const statusArea = document.getElementById('importStatusArea');
    const progressBarWrapper = document.getElementById('importProgressBarWrapper');
    const statusText = document.getElementById('importStatusText');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const progressDetail = document.getElementById('importProgressDetail');
    const cancelBtn = document.getElementById('importCancelButton');

    if (statusArea) statusArea.style.display = 'block';
    if (progressBarWrapper) progressBarWrapper.style.display = 'block';

    let phaseText = '正在校验导入文件，请稍候...';
    if (pageType === 'merge') {
        phaseText = mergeImportMode === 'full'
            ? '正在校验全量导入文件，请稍候...'
            : '正在校验增量导入文件，请稍候...';
    }
    if (forceImport) {
        phaseText = '正在应用确认并重新校验，请稍候...';
    }

    if (statusText) {
        statusText.style.display = 'block';
        statusText.style.color = '#4056b4';
        statusText.textContent = phaseText;
    }
    if (progressBar) {
        progressBar.style.animation = 'progress-stripes 1s linear infinite';
        progressBar.style.width = '18%';
        progressBar.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
    }
    if (progressText) {
        progressText.textContent = '校验中';
    }
    if (progressDetail) {
        progressDetail.textContent = '已等待 0 秒';
    }
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.textContent = '校验中...';
    }

    importValidationStartedAt = Date.now();
    importValidationHintInterval = setInterval(() => {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - importValidationStartedAt) / 1000));
        const detailEl = document.getElementById('importProgressDetail');
        if (!detailEl) {
            return;
        }
        if (elapsedSeconds >= 20) {
            detailEl.textContent = `已等待 ${elapsedSeconds} 秒，文件较大，系统仍在校验，请勿关闭页面`;
        } else {
            detailEl.textContent = `已等待 ${elapsedSeconds} 秒`;
        }
    }, 1000);
}

// 开始导入进度轮询
function normalizeImportProgress(progress, pageType) {
    if (pageType !== 'merge') {
        return progress || {};
    }

    const safeProgress = progress || {};
    const total = Number(safeProgress.total || 0);
    const current = Number(safeProgress.current || 0);
    const percent = total > 0
        ? Math.min(100, Math.round((current / total) * 100))
        : (safeProgress.status === 'completed' ? 100 : 0);

    return Object.assign({}, safeProgress, {
        total_rows: total,
        processed_rows: current,
        percent: percent
    });
}

function startImportProgressPolling(pageType) {
    stopImportValidationHint();
    // 显示导入模式对话框中的进度条
    const importProgressBarWrapper = document.getElementById('importProgressBarWrapper');
    const importStatusArea = document.getElementById('importStatusArea');
    const importModalActions = document.getElementById('importModalActions');

    if (importProgressBarWrapper) importProgressBarWrapper.style.display = 'block';
    if (importStatusArea) importStatusArea.style.display = 'block';
    if (importModalActions) importModalActions.style.display = 'none';

    if (importProgressInterval) {
        clearInterval(importProgressInterval);
    }

    const progressEndpoint = pageType === 'merge'
        ? '/import/merge/progress'
        : '/import/progress';

    let isPolling = false;
    let consecutiveFailures = 0;

    importProgressInterval = setInterval(async () => {
        if (isPolling) {
            return;
        }
        isPolling = true;

        fetch(API_BASE + progressEndpoint)
            .then(res => res.json())
            .then(async progressRaw => {
                consecutiveFailures = 0;
                const progress = normalizeImportProgress(progressRaw, pageType);
                // 更新进度UI
                updateImportProgressUI(progress);

                // 检查是否完成或出错
                if (progress.status === 'completed') {
                    clearInterval(importProgressInterval);
                    importProgressInterval = null;
                    if (pageType === 'merge') {
                        isMergeColumnsLoaded = false;
                    }
                    if (window.currentDataSourceColumns && typeof window.currentDataSourceColumns === 'object') {
                        delete window.currentDataSourceColumns.assets;
                        delete window.currentDataSourceColumns.merge_results;
                    }
                    showImportComplete({ total_rows: progress.processed_rows });

                    if (
                        window.ImportFlowUtils &&
                        typeof window.ImportFlowUtils.refreshImportedPage === 'function'
                    ) {
                        await window.ImportFlowUtils.refreshImportedPage(pageType, {
                            document,
                            loadColumns: pageType === 'merge' && typeof loadMergeColumns === 'function'
                                ? loadMergeColumns
                                : null,
                            loadData: pageType === 'merge'
                                ? loadMergeData
                                : loadData,
                            loadStats: pageType === 'device' && typeof loadStats === 'function'
                                ? loadStats
                                : null
                        });
                    } else if (pageType === 'device') {
                        await loadData();
                        if (typeof loadStats === 'function') {
                            await loadStats();
                        }
                    } else if (typeof loadMergeColumns === 'function') {
                        await loadMergeColumns();
                        if (typeof loadMergeData === 'function') {
                            await loadMergeData();
                        }
                    } else if (typeof loadMergeData === 'function') {
                        await loadMergeData();
                    }
                } else if (progress.status === 'error') {
                    clearInterval(importProgressInterval);
                    importProgressInterval = null;
                    showImportError(progress.error || progress.message);
                } else if (progress.status === 'truncating') {
                    // 文件过大，显示警告
                    const importProgressDetail = document.getElementById('importProgressDetail');
                    if (importProgressDetail) importProgressDetail.textContent = progress.message;
                } else if (progress.status === 'importing' || progress.status === 'reading') {
                    // 确保进度条可见
                    if (importProgressBarWrapper) importProgressBarWrapper.style.display = 'block';
                }
            })
            .catch(e => {
                console.error('获取进度失败:', e);
                consecutiveFailures += 1;
                if (consecutiveFailures >= 5) {
                    clearInterval(importProgressInterval);
                    importProgressInterval = null;
                    showImportError('导入进度获取失败: ' + e.message);
                }
            })
            .finally(() => {
                isPolling = false;
            });
    }, 500); // 每0.5秒轮询，避免过高轮询频率影响导入吞吐
}

// 更新导入进度UI
function updateImportProgressUI(progress) {
    // 更新进度条
    if (progress.percent !== undefined) {
        const importProgressBar = document.getElementById('importProgressBar');
        const importProgressText = document.getElementById('importProgressText');
        if (importProgressBar) importProgressBar.style.width = progress.percent + '%';
        if (importProgressText) importProgressText.textContent = progress.percent + '%';
    }

    // 更新详细信息
    if (progress.processed_rows !== undefined && progress.total_rows) {
        const importProgressDetail = document.getElementById('importProgressDetail');
        if (importProgressDetail) {
            importProgressDetail.textContent = `${progress.processed_rows.toLocaleString()} / ${progress.total_rows.toLocaleString()} 行`;
        }
    }
}

function buildImportSchemaWarning(result, pageType, mergeImportMode = 'incremental') {
    const pageLabel = pageType === 'merge' ? '合并结果' : '数据概览';
    const missingColumns = Array.isArray(result?.missing_columns) ? result.missing_columns : [];
    const extraColumns = Array.isArray(result?.extra_columns) ? result.extra_columns : [];
    const hasSchemaDiff = missingColumns.length > 0 || extraColumns.length > 0;
    const lines = [hasSchemaDiff ? `${pageLabel}导入检测到列变化。` : `${pageLabel}导入预检查结果：`];
    if (missingColumns.length > 0) {
        lines.push(`缺失列（${missingColumns.length}）：${missingColumns.join('、')}`);
    }
    if (extraColumns.length > 0) {
        lines.push(`新增列（${extraColumns.length}）：${extraColumns.join('、')}`);
    }
    if (pageType === 'merge') {
        const modeLabel = mergeImportMode === 'full' ? '全量导入（追加）' : '增量导入（替换命中数据源）';
        lines.push(`导入模式：${modeLabel}`);
        const analysis = result?.incremental_analysis;
        if (analysis && mergeImportMode !== 'full') {
            lines.push(`数据源匹配方式：文本完全匹配`);
            lines.push(`命中替换数据源：${Number(analysis.replace_count || 0).toLocaleString()} 个`);
            lines.push(`新增数据源：${Number(analysis.new_source_count || 0).toLocaleString()} 个`);
            lines.push(`受影响旧记录：${Number(analysis.affected_old_total || 0).toLocaleString()} 条`);
            lines.push(`本次增量记录：${Number(analysis.incoming_total || 0).toLocaleString()} 条`);
            lines.push(`净变化：${Number(analysis.total_delta || 0).toLocaleString()} 条`);
            const newSourceItems = Array.isArray(analysis.new_source_items) ? analysis.new_source_items : [];
            if (newSourceItems.length > 0) {
                const previewNames = newSourceItems.slice(0, 12).map((item) => item.source_name).filter(Boolean);
                if (previewNames.length > 0) {
                    const suffix = newSourceItems.length > previewNames.length ? ' 等' : '';
                    lines.push(`未匹配现有数据源（将按新增导入）：${previewNames.join('、')}${suffix}`);
                }
            }
        }
    }
    lines.push('继续导入可能导致映射数据偏差，是否继续导入？');
    return lines.join('\n');
}

function closeImportConfirmModal() {
    const modal = document.getElementById('importConfirmModal');
    if (modal) {
        modal.remove();
    }
}

function showImportConfirmationDialog(message) {
    closeImportConfirmModal();
    return new Promise((resolve) => {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay show" id="importConfirmModal" style="z-index: 10024;" onclick="if(event.target && event.target.id==='importConfirmModal'){closeImportConfirmModal();window.__importConfirmResolve&&window.__importConfirmResolve(false);}">
                <div class="modal-content" style="width:min(720px,92vw);max-width:720px;max-height:86vh;border-radius:14px;overflow:hidden;">
                    <div class="modal-header" style="padding:16px 20px;background:linear-gradient(135deg,#0f4fa8 0%,#2d86ff 100%);color:#fff;border-bottom:none;">
                        <h3 style="margin:0;font-size:16px;">导入前确认</h3>
                    </div>
                    <div class="modal-body" style="padding:16px 20px;display:grid;gap:12px;">
                        <div style="padding:12px 14px;border-radius:10px;border:1px solid rgba(18,92,196,0.18);background:#f8fbff;color:#274467;font-size:13px;line-height:1.7;max-height:48vh;overflow:auto;white-space:pre-wrap;">${escapeHtml(message || '')}</div>
                    </div>
                    <div class="modal-footer" style="padding:12px 20px;border-top:1px solid #e7eef8;">
                        <div class="modal-footer-right" style="display:flex;gap:8px;justify-content:flex-end;width:100%;">
                            <button class="btn" type="button" onclick="closeImportConfirmModal();window.__importConfirmResolve&&window.__importConfirmResolve(false);">取消导入</button>
                            <button class="btn btn-primary" type="button" onclick="closeImportConfirmModal();window.__importConfirmResolve&&window.__importConfirmResolve(true);">继续导入</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        window.__importConfirmResolve = (value) => {
            const fn = window.__importConfirmResolve;
            window.__importConfirmResolve = null;
            if (typeof fn === 'function') {
                resolve(Boolean(value));
            }
        };
    });
}

// 确认导入函数（支持大文件导入）
async function confirmImport(mode = 'update', forceImport = false) {
    if (!pendingImportFile) return;

    const pageType = pendingImportPageType || 'device';
    const mergeImportMode = pendingMergeImportMode === 'full' ? 'full' : 'incremental';

    const formData = new FormData();
    formData.append('file', pendingImportFile);
    if (pageType === 'merge') {
        formData.append('import_mode', mergeImportMode);
    } else {
        formData.append('type', pageType);  // 'device' 或 'merge'
        formData.append('mode', mode);
    }
    if (forceImport) {
        formData.append('force_import', '1');
    }

    // 隐藏操作按钮
    document.getElementById('importModalActions').style.display = 'none';

    try {
        startImportValidationHint(pageType, mergeImportMode, forceImport);

        const importEndpoint = pageType === 'merge'
            ? '/import/merge/confirm'
            : '/import/large';

        const res = await fetch(API_BASE + importEndpoint, {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (result && result.requires_confirmation) {
            stopImportValidationHint();
            const shouldContinue = await showImportConfirmationDialog(
                buildImportSchemaWarning(result, pageType, mergeImportMode)
            );
            if (shouldContinue) {
                await confirmImport(mode, true);
            } else {
                showToast('已取消导入', false);
                closeImportModeModal();
            }
            return;
        }

        if (result.success || result.started) {
            stopImportValidationHint();
            if (result.warning_message) {
                showToast(result.warning_message, false);
            }
            // 导入已开始，开始轮询进度
            startImportProgressPolling(pageType);
        } else {
            stopImportValidationHint();
            showImportError(result.error || '导入失败');
        }
    } catch (e) {
        stopImportValidationHint();
        console.error('导入失败:', e);
        showImportError('导入失败: ' + e.message);
    }
}


// 显示提示
function showToast(msg, state = false) {
    const toast = document.getElementById('toast');
    const text = String(msg || '');
    const hasErrorToken = /(\[ERROR\]|失败|错误|无效|未找到|不存在|不能为空|超出范围|开发中|未实现|请填写|请选择|请先|格式错误)/.test(text);
    const hasSuccessToken = /(\[SUCCESS\]|成功|完成|已保存|已删除|已导出|已复制|已添加|已应用|已更新|已修改|格式正确|通过)/.test(text);
    let tone = '';

    if (hasSuccessToken && !hasErrorToken) {
        tone = 'success';
    } else if (hasErrorToken) {
        tone = 'error';
    } else if (state === true) {
        tone = 'error';
    }

    toast.textContent = msg;
    toast.className = 'toast show' + (tone ? ' ' + tone : '');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function parseApiResult(response, fallbackMessage) {
    const text = await response.text();
    let result = null;

    if (text) {
        try {
            result = JSON.parse(text);
        } catch (e) {
            if (!response.ok) {
                throw new Error(fallbackMessage || ('请求失败: HTTP ' + response.status));
            }
            throw e;
        }
    }

    if (!response.ok) {
        throw new Error((result && (result.error || result.message)) || fallbackMessage || ('请求失败: HTTP ' + response.status));
    }

    if (result && typeof result === 'object' && result.success === false) {
        throw new Error(result.error || result.message || fallbackMessage || '操作失败');
    }

    return result;
}

// 分页
document.getElementById('prevBtn').onclick = () => { if (currentPage > 1) { currentPage--; loadData(); } };
document.getElementById('nextBtn').onclick = () => {
    const totalPages = Math.ceil(totalRecords / pageSize);
    if (currentPage < totalPages) { currentPage++; loadData(); }
};

// 页面跳转功能（设备管理）
document.getElementById('jumpPageBtn').onclick = () => {
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const input = document.getElementById('jumpPageInput');
    const jumpPage = parseInt(input.value);

    if (!jumpPage || jumpPage < 1) {
        showToast('请输入有效的页码', true);
        return;
    }

    if (jumpPage > totalPages) {
        showToast(`页码超出范围，共 ${totalPages} 页`, true);
        return;
    }

    currentPage = jumpPage;
    input.value = '';
    loadData();
};

// 支持回车键跳转
document.getElementById('jumpPageInput').onkeydown = (e) => {
    if (e.key === 'Enter') {
        document.getElementById('jumpPageBtn').click();
    }
};

// 搜索防抖
let searchTimeout;
document.getElementById('searchInput').oninput = () => {
    if (advancedFilterState.device) {
        advancedFilterState.device = null;
        renderAdvancedFilterSummary('device');
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { currentPage = 1; loadData(); }, 300);
};

// 启动
init();

// ==================== 合并结果页面函数 ====================

// 加载合并结果列配置
async function loadMergeColumns() {
    // 防止重复加载
    if (isMergeColumnsLoaded) {
        return;
    }
    isMergeColumnsLoaded = true;

    try {
        const res = await fetch(API_BASE + '/merge/columns');
        const config = await res.json();

        columns2 = config.columns || [];
        pageSize2 = config.pageSize || 100;
        // 限制最大pageSize，防止卡顿
        if (pageSize2 > 1000) pageSize2 = 1000;
        pendingPageSize2 = pageSize2;
        sourceFile2 = config.sourceFile || '';
        headerHeight2 = config.headerHeight || 40;
        pendingHeaderHeight2 = headerHeight2;
        headerColor2 = config.headerColor || '#6c757d';  // 标题颜色
        actionColumnConfig2 = config.actionColumn || { width: 120, color: '#6c757d' };

        // 更新UI
        document.getElementById('pageSizePanelSelect2').value = pageSize2;
        document.getElementById('headerHeightInput2').value = headerHeight2;
        document.getElementById('headerColorInput2').value = headerColor2;
        const actionWidthInput2 = document.getElementById('actionWidthInput2');
        if (actionWidthInput2) actionWidthInput2.value = actionColumnConfig2.width;
        const actionColorInput2 = document.getElementById('actionColorInput2');
        if (actionColorInput2) actionColorInput2.value = actionColumnConfig2.color;

        renderColumnToggles2();
        updateSourceFileDisplay2();
        syncAdvancedFilterWithColumns('merge');

    } catch (e) {
        console.error('加载合并结果列配置失败:', e);
        // 使用默认配置
        columns2 = [];
        pageSize2 = 100;
        pendingPageSize2 = 100;
        sourceFile2 = '';
        headerHeight2 = 40;
        pendingHeaderHeight2 = 40;
        headerColor2 = '#6c757d';
        actionColumnConfig2 = { width: 120, color: '#6c757d' };
        renderColumnToggles2();
        updateSourceFileDisplay2();
        syncAdvancedFilterWithColumns('merge');

    }
}

// 渲染合并结果列控制面板
function renderColumnToggles2() {
    const container = document.getElementById('columnToggles2');
    if (!columns2 || columns2.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无列配置，请导入Excel文件</div>';
        return;
    }
    container.innerHTML = columns2.map((col, i) => {
        return '<label class="column-toggle' + (col.visible ? '' : ' hidden') + '">' +
            '<div class="column-toggle-top">' +
            '<input type="checkbox" ' + (col.visible ? 'checked' : '') + ' onchange="toggleColumn2(' + i + ')"> ' +
            '<span class="column-toggle-name" contenteditable="true" onblur="updateColumnName2(' + i + ', this.textContent)">' + col.name + '</span>' +
            '</div>' +
            '<div class="column-toggle-bottom">' +
            '<label>宽度:</label>' +
            '<input type="number" min="50" max="500" step="10" value="' + (col.width || 120) + '" onchange="changeColumnWidth2(' + i + ', this.value)">' +
            '<button class="column-toggle-btn delete" onclick="deleteColumn2(' + i + ')">删除</button>' +
            '</div>' +
            '</label>';
    }).join('');
}

// 切换列显示（合并结果）
function toggleColumn2(index) {
    columns2[index].visible = !columns2[index].visible;
    renderColumnToggles2();
    renderTable2();
}

// 修改列宽（合并结果）
function changeColumnWidth2(index, width) {
    columns2[index].width = parseInt(width) || 120;
    renderTable2();
}

// 更新列名（合并结果）
function updateColumnName2(index, newName) {
    newName = newName.trim();
    if (!newName) {
        // 空名称，恢复原名称
        renderColumnToggles2();
        return;
    }
    if (newName !== columns2[index].name) {
        // 检查是否与其他列重名
        if (columns2.some((col, i) => i !== index && col.name === newName)) {
            showToast('列名已存在', true);
            renderColumnToggles2();
            return;
        }
        columns2[index].name = newName;
        renderTable2(); // 立即更新表格显示
        showToast('列名已修改，请点击保存按钮生效', false);
    }
}

// 删除列（合并结果）
function deleteColumn2(index) {
    if (!confirm('确定要删除列 "' + columns2[index].name + '" 吗？')) return;
    columns2.splice(index, 1);
    renderColumnToggles2();
    showToast('列已删除，请点击保存按钮生效', false);
}

// 添加新列（合并结果）
function addNewColumn2() {
    const input = document.getElementById('newColumnName2');
    const name = input.value.trim();

    if (!name) {
        showToast('请输入列名称', true);
        return;
    }

    if (columns2.some(col => col.name === name)) {
        showToast('列名已存在', true);
        return;
    }

    columns2.push({ name: name, visible: true, width: 120 });
    input.value = '';
    renderColumnToggles2();
    showToast('新列已添加，请点击保存按钮生效', false);
}

// 预览每页显示数量（合并结果）
function previewPageSize2(value) {
    pendingPageSize2 = parseInt(value);
}

// 获取实际pageSize2（-1表示全部显示）
function getActualPageSize2() {
    return pageSize2 === -1 ? 999999 : pageSize2;
}

// 获取实际pendingPageSize2
function getActualPendingPageSize2() {
    return pendingPageSize2 === -1 ? 999999 : pendingPageSize2;
}

// 预览标题高度（合并结果）
function previewHeaderHeight2(value) {
    pendingHeaderHeight2 = parseInt(value);
    renderTable2();
}

// 预览标题颜色（合并结果）
function previewHeaderColor2(value) {
    headerColor2 = value;
    renderTable2();
}

// 预览操作列宽度（合并结果）
function previewActionWidth2(value) {
    actionColumnConfig2.width = parseInt(value) || 120;
    renderTable2();
}

// 预览操作列颜色（合并结果）
function previewActionColor2(value) {
    actionColumnConfig2.color = value;
    renderTable2();
}

// 保存列设置（合并结果）
async function saveColumnSettings2() {
    try {
        headerColor2 = document.getElementById('headerColorInput2').value;
        actionColumnConfig2.width = parseInt(document.getElementById('actionWidthInput2')?.value || 120);
        actionColumnConfig2.color = document.getElementById('actionColorInput2').value;

        const config = {
            columns: columns2,
            pageSize: pendingPageSize2,
            sourceFile: sourceFile2,
            headerHeight: pendingHeaderHeight2,
            headerColor: headerColor2,
            actionColumn: actionColumnConfig2
        };

        const mergeColumnSaveRes = await fetch(API_BASE + '/merge/columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        await parseApiResult(mergeColumnSaveRes, '保存失败');

        pageSize2 = pendingPageSize2;
        headerHeight2 = pendingHeaderHeight2;
        currentPage2 = 1;
        await loadMergeData();
        showToast('列设置已保存', false);
    } catch (e) {
        showToast('保存失败', true);
    }
}

// 显示/隐藏列面板（合并结果）
function toggleColumnPanel2() {
    document.getElementById('columnPanel2').classList.toggle('show');
}

// 更新数据来源显示（合并结果）
function updateSourceFileDisplay2() {
    const display = document.getElementById('sourceFileDisplay2');
    if (display) {
        display.textContent = sourceFile2 || '未设置';
    }
}

// 加载合并结果数据
async function loadMergeData() {
    // 检查必要的DOM元素是否存在
    const searchInput2 = document.getElementById('searchInput2');
    if (!searchInput2) {
        console.warn('searchInput2 元素不存在，跳过加载');
        return;
    }

    // 防止重复加载
    if (isLoadingMergeData) {
        console.warn('已有加载任务在进行中，跳过');
        return;
    }
    isLoadingMergeData = true;

    // 生成新的请求序号
    const requestId = ++dataRequestId2;

    const search = searchInput2.value || '';

    const actualPageSize = getActualPageSize2();
    const category = currentCategory2 || '';

    try {
        let result;
        if (advancedFilterState.merge) {
            result = await fetchAdvancedFilterData('merge', currentPage2, actualPageSize, category);
        } else {
            // 手动构建URL
            const url = `${API_BASE}/merge/assets?page=${currentPage2}&pageSize=${actualPageSize}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
            const res = await fetch(url);

            // 检查响应状态
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            // 检查响应是否为空
            const text = await res.text();

            if (!text || text.trim() === '') {
                throw new Error('空响应');
            }

            result = JSON.parse(text);
        }

        // 只处理最新的请求响应
        if (requestId !== dataRequestId2) {
            return;
        }

        totalRecords2 = result.total;
        renderTable2(result.data);
        updatePagination2();
        updateStats2();
    } catch (e) {
        // 只处理最新的请求错误
        if (requestId === dataRequestId2) {
            console.error('加载合并结果数据失败:', e);
            currentData2 = [];
            totalRecords2 = 0;
            updateWorkspaceEmptyState('merge', {
                hasData: false,
                error: true,
                message: '当前无法读取合并结果数据，请确认后端服务正常后再重新加载。'
            });
            updatePagination2();
            updateStats2();
        }
    } finally {
        isLoadingMergeData = false;
        const mergePageEl = document.getElementById('page-database');
        if (mergePageEl && mergePageEl.classList.contains('active')) {
            refreshMergeFineScopeStatusCard({ showLoading: false, silent: true });
        }
    }
}

// 渲染表格（合并结果）
function renderTable2(data) {
    if (!data) data = currentData2;
    else currentData2 = data;

    const visibleCols = columns2.filter(c => c.visible);
    const headerColor = headerColor2 || '#6c757d';
    const actionColor = actionColumnConfig2.color || '#6c757d';

    // 渲染表头
    const h = document.getElementById('tableHeader2');
    if (visibleCols.length === 0) {
        h.innerHTML = '<th style="background-color:' + headerColor + ';">暂无列配置</th><th class="col-actions">操作</th>';
        updateWorkspaceEmptyState('merge', {
            hasData: false,
            hasSearch: !!((document.getElementById('searchInput2')?.value || '').trim()),
            hasFilter: !!advancedFilterState.merge,
            noColumns: true
        });
        document.getElementById('tableBody2').innerHTML = '<tr><td colspan="2" class="loading">请先导入Excel文件以自动创建列配置</td></tr>';
        return;
    }

    h.innerHTML = visibleCols.map(c => {
        const width = c.width || 120;
        return '<th style="width:' + width + 'px;max-width:' + width + 'px;height:' + pendingHeaderHeight2 + 'px;vertical-align:middle;background-color:' + headerColor + ';" title="' + c.name + '">' + c.name + '</th>';
    }).join('') + '<th class="col-actions" style="width:' + actionColumnConfig2.width + 'px;max-width:' + actionColumnConfig2.width + 'px;height:' + pendingHeaderHeight2 + 'px;vertical-align:middle;background-color:' + actionColor + ';">操作</th>';

    // 渲染数据
    const b = document.getElementById('tableBody2');
    if (!data || data.length === 0) {
        updateWorkspaceEmptyState('merge', {
            hasData: false,
            hasSearch: !!((document.getElementById('searchInput2')?.value || '').trim()),
            hasFilter: !!advancedFilterState.merge,
            noColumns: false
        });
        b.innerHTML = '<tr><td colspan="' + (visibleCols.length + 1) + '" class="loading">暂无数据，请导入Excel文件</td></tr>';
        return;
    }

    updateWorkspaceEmptyState('merge', { hasData: true });

    b.innerHTML = data.map(row => {
        return '<tr>' + visibleCols.map(c => {
            let v = row[c.name];
            const width = c.width || 120;

            const cellContent = (v || '-');
            return '<td style="width:' + width + 'px;max-width:' + width + 'px;" class="' + (!v ? 'empty' : '') + '" title="' + cellContent + '">' + cellContent + '</td>';
        }).join('') + '<td class="col-actions" style="width:' + actionColumnConfig2.width + 'px;max-width:' + actionColumnConfig2.width + 'px;">' +
            '<button class="btn btn-sm" onclick="editRow2(' + row.id + ')">编辑</button>' +
            '</td></tr>';
    }).join('');
}

// 更新分页（合并结果）
function updatePagination2() {
    if (pageSize2 === -1) {
        // 全部显示模式
        document.getElementById('paginationInfo2').textContent = '全部显示，共 ' + totalRecords2 + ' 条';
        document.getElementById('prevBtn2').disabled = true;
        document.getElementById('nextBtn2').disabled = true;
    } else {
        const totalPages = Math.ceil(totalRecords2 / pageSize2) || 1;
        document.getElementById('paginationInfo2').textContent = '第 ' + currentPage2 + ' / ' + totalPages + ' 页，共 ' + totalRecords2 + ' 条';
        document.getElementById('prevBtn2').disabled = currentPage2 === 1;
        document.getElementById('nextBtn2').disabled = currentPage2 >= totalPages;
    }
}

// 更新统计（合并结果）
function updateStats2() {
    const totalCount2El = document.getElementById('totalCount2');
    if (totalCount2El) totalCount2El.textContent = totalRecords2;
    const displayCount2El = document.getElementById('displayCount2');
    if (displayCount2El) displayCount2El.textContent = currentData2.length;
}

// 编辑行（合并结果）
async function editRow2(id) {
    editingId2 = id;
    try {
        const res = await fetch(API_BASE + '/merge/assets/' + id);
        const row = await res.json();

        document.getElementById('modalTitle').textContent = '编辑合并结果 - ID: ' + id;
        document.getElementById('deleteBtnArea').style.display = 'block';
        bindEditModalHandlers('merge');

        const form = document.getElementById('editForm');
        form.innerHTML = columns2.map(col => `
                    <div class="form-group">
                        <label>${col.name}</label>
                        <input type="text" id="edit_${col.name}" value="${row[col.name] || ''}">
                    </div>
                `).join('');

        document.getElementById('editModal').classList.add('show');
    } catch (e) {
        showToast('加载记录失败', true);
    }
}

// 保存（合并结果）
async function saveEdit2() {
    const data = {};
    columns2.forEach(col => {
        const input = document.getElementById('edit_' + col.name);
        if (input) data[col.name] = input.value;
    });

    try {
        if (editingId2) {
            data.id = editingId2;
            const updateMergeRes = await fetch(API_BASE + '/merge/assets/' + editingId2, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await parseApiResult(updateMergeRes, '保存失败');
        } else {
            const createMergeRes = await fetch(API_BASE + '/merge/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await parseApiResult(createMergeRes, '保存失败');
            editingId2 = result && result.id;
        }
        closeModal();
        loadMergeData();
        showToast('保存成功', false);
    } catch (e) {
        showToast('保存失败', true);
    }
}

// 删除资产（合并结果）
async function deleteAsset2() {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
        const deleteMergeRes = await fetch(API_BASE + '/merge/assets/' + editingId2, { method: 'DELETE' });
        await parseApiResult(deleteMergeRes, '删除失败');
        closeModal();
        loadMergeData();
        showToast('删除成功', false);
    } catch (e) {
        showToast('删除失败', true);
    }
}

// 导入Excel - 直接导入（合并结果）
async function previewImport2(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    pendingImportFile = file;
    pendingImportPageType = 'merge';

    // 立即显示导入对话框
    showImportDialog();

    // 直接开始导入，导入模式由此前选择决定
    await confirmImport('update');

    // 清空input以便重复选择同一文件
    input.value = '';
}

// 显示进度对话框
function showProgressModal() {
    document.getElementById('progressModal').classList.add('show');
    document.getElementById('progressCloseBtn').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressMessage').textContent = '正在准备导入...';
    document.getElementById('progressCurrent').textContent = '0';
    document.getElementById('progressTotal').textContent = '0';
}

// 关闭进度对话框
function closeProgressModal() {
    document.getElementById('progressModal').classList.remove('show');
}

// 开始轮询进度
let mergeImportProgressPollingInterval = null;
function startProgressPolling() {
    if (mergeImportProgressPollingInterval) {
        clearInterval(mergeImportProgressPollingInterval);
    }

    mergeImportProgressPollingInterval = setInterval(() => {
        fetch(API_BASE + '/import/merge/progress')
            .then(res => res.json())
            .then(progress => {
                updateProgress(progress);

                if (progress.status === 'completed') {
                    clearInterval(mergeImportProgressPollingInterval);
                    mergeImportProgressPollingInterval = null;
                    setTimeout(() => {
                        closeProgressModal();
                        showToast('导入完成! 共 ' + progress.total + ' 条记录', false);
                        loadMergeColumns().then(() => loadMergeData());
                    }, 1000);
                } else if (progress.status === 'error') {
                    clearInterval(mergeImportProgressPollingInterval);
                    mergeImportProgressPollingInterval = null;
                    document.getElementById('progressMessage').textContent = '导入失败: ' + progress.error;
                    document.getElementById('progressBar').style.background = '#dc3545';
                    document.getElementById('progressCloseBtn').style.display = 'inline-block';
                }
            })
            .catch(e => {
                console.error('获取进度失败:', e);
                clearInterval(mergeImportProgressPollingInterval);
                mergeImportProgressPollingInterval = null;
                document.getElementById('progressMessage').textContent = '导入失败: ' + e.message;
                document.getElementById('progressBar').style.background = '#dc3545';
                document.getElementById('progressCloseBtn').style.display = 'inline-block';
            });
    }, 500);
}

// 更新进度显示
function updateProgress(progress) {
    const { current, total, message } = progress;

    document.getElementById('progressMessage').textContent = message;
    document.getElementById('progressCurrent').textContent = current.toLocaleString();
    document.getElementById('progressTotal').textContent = total.toLocaleString();

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('progressBar').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = percent + '%';
}

// 合并结果页面分页
document.getElementById('prevBtn2').onclick = () => { if (currentPage2 > 1) { currentPage2--; loadMergeData(); } };
document.getElementById('nextBtn2').onclick = () => {
    const totalPages = Math.ceil(totalRecords2 / pageSize2);
    if (currentPage2 < totalPages) { currentPage2++; loadMergeData(); }
};

// 页面跳转功能（合并结果）
document.getElementById('jumpPageBtn2').onclick = () => {
    const totalPages = Math.ceil(totalRecords2 / pageSize2) || 1;
    const input = document.getElementById('jumpPageInput2');
    const jumpPage = parseInt(input.value);

    if (!jumpPage || jumpPage < 1) {
        showToast('请输入有效的页码', true);
        return;
    }

    if (jumpPage > totalPages) {
        showToast(`页码超出范围，共 ${totalPages} 页`, true);
        return;
    }

    currentPage2 = jumpPage;
    input.value = '';
    loadMergeData();
};

// 支持回车键跳转
document.getElementById('jumpPageInput2').onkeydown = (e) => {
    if (e.key === 'Enter') {
        document.getElementById('jumpPageBtn2').click();
    }
};

// 合并结果页面搜索防抖
let searchTimeout2;
document.getElementById('searchInput2').oninput = () => {
    if (advancedFilterState.merge) {
        advancedFilterState.merge = null;
        renderAdvancedFilterSummary('merge');
    }
    clearTimeout(searchTimeout2);
    searchTimeout2 = setTimeout(() => { currentPage2 = 1; loadMergeData(); }, 300);
};

// 切换页面
function switchPage(pageName, navElement) {
    // 更新API地址显示
    const apiUrl = window.location.origin;
    const backendInfo = document.getElementById('backendInfo');
    const backendInfo2 = document.getElementById('backendInfo2');
    const backendInfo3 = document.getElementById('backendInfo3');
    if (backendInfo) backendInfo.textContent = 'API: ' + apiUrl;
    if (backendInfo2) backendInfo2.textContent = 'API: ' + apiUrl;
    if (backendInfo3) backendInfo3.textContent = 'API: ' + apiUrl;

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // 显示目标页面
    document.getElementById('page-' + pageName).classList.add('active');

    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navElement) {
        navElement.classList.add('active');
    }

    // 切换到合并结果页面时加载数据
    if (pageName === 'database') {
        refreshMergeFineScopeStatusCard({ showLoading: true, silent: true });
        loadMergeColumns().then(() => loadMergeData());
    }

    // 切换到填报数据页面时先加载配置，再渲染报表列表
    if (pageName === 'reporting') {
        if (typeof loadReportingData === 'function') {
            Promise.resolve(loadReportingData())
                .catch(error => {
                    console.error('进入填报页面时加载报表配置失败:', error);
                })
                .finally(() => {
                    if (typeof renderAllReports === 'function') {
                        renderAllReports();
                    }
                });
        } else if (typeof renderAllReports === 'function') {
            renderAllReports();
        }
    }
}

// ==================== 工程文件管理 ====================

// 加载工程文件列表
// ==================== 工程文件管理 ====================

let currentFileCategory = 'templates';  // 当前文件类别
let allProjectFiles = null;  // 缓存所有文件数据
let projectFilesStats = null;  // 缓存统计信息
let currentFileReportTypeFilters = {
    templates: 'all',
    exports: 'all'
};

function escapeFileManagementHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shouldShowFileReportTypeFilter(category) {
    return category === 'templates' || category === 'exports';
}

function getFileReportTypeOptions() {
    return [
        { value: 'all', label: '全部' },
        { value: '业支上报', label: '业支上报' },
        { value: 'SMC上报', label: 'SMC上报' },
        { value: '信安上报', label: '信安上报' }
    ];
}

function normalizeProjectFileReportTypeLabel(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    if (text.includes('业支') || /yezhi/i.test(text)) {
        return '业支上报';
    }
    if (text.includes('SMC') || /smc/i.test(text)) {
        return 'SMC上报';
    }
    if (text.includes('信安') || /xinan/i.test(text)) {
        return '信安上报';
    }

    return '';
}

function inferProjectFileReportType(file, category = currentFileCategory) {
    if (!file) {
        return '';
    }

    if (category === 'templates') {
        return normalizeProjectFileReportTypeLabel([
            file.category,
            file.path,
            file.filename
        ].filter(Boolean).join(' '));
    }

    if (category === 'exports') {
        return normalizeProjectFileReportTypeLabel([
            file.source,
            file.path,
            file.filename
        ].filter(Boolean).join(' '));
    }

    return '';
}

function getCurrentFileReportTypeFilter(category) {
    return currentFileReportTypeFilters[category] || 'all';
}

function updateFileReportTypeFilter(category, value) {
    if (!shouldShowFileReportTypeFilter(category)) {
        return;
    }

    currentFileReportTypeFilters[category] = value || 'all';
    if (allProjectFiles) {
        renderProjectFiles(allProjectFiles, null);
    }
}

function filterProjectFilesByReportType(categoryData, category, isGrouped) {
    const selectedType = getCurrentFileReportTypeFilter(category);
    if (!shouldShowFileReportTypeFilter(category) || selectedType === 'all') {
        return categoryData;
    }

    if (!isGrouped) {
        return (Array.isArray(categoryData) ? categoryData : []).filter(file => {
            return inferProjectFileReportType(file, category) === selectedType;
        });
    }

    const filteredGroups = {};
    Object.entries(categoryData || {}).forEach(([monthTag, items]) => {
        const matchedItems = (Array.isArray(items) ? items : []).filter(file => {
            return inferProjectFileReportType(file, category) === selectedType;
        });
        if (matchedItems.length > 0) {
            filteredGroups[monthTag] = matchedItems;
        }
    });

    return filteredGroups;
}

function flattenProjectFileCategoryData(categoryData) {
    if (Array.isArray(categoryData)) {
        return categoryData.slice().sort((a, b) => (b?.modified || 0) - (a?.modified || 0));
    }
    if (!categoryData || typeof categoryData !== 'object') {
        return [];
    }

    const merged = [];
    Object.values(categoryData).forEach(items => {
        if (Array.isArray(items)) {
            merged.push(...items);
        }
    });

    return merged.sort((a, b) => (b?.modified || 0) - (a?.modified || 0));
}

function renderFileReportTypeFilter(category, currentCount, totalCount) {
    if (!shouldShowFileReportTypeFilter(category)) {
        return '';
    }

    const selectedType = getCurrentFileReportTypeFilter(category);
    const optionsHtml = getFileReportTypeOptions().map(option => `
                <option value="${option.value}" ${option.value === selectedType ? 'selected' : ''}>${option.label}</option>
            `).join('');
    const scopeLabel = category === 'templates' ? '模板文件' : '填报数据文件';

    return `
                <div class="file-stats-card" style="margin-bottom: 18px; padding: 18px 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                        <div>
                            <div class="file-stats-card__eyebrow">报送体系筛选</div>
                            <div style="margin-top: 6px; font-size: 16px; font-weight: 700; color: #163c7a;">${scopeLabel}</div>
                            <div style="margin-top: 6px; font-size: 13px; color: #5f6f86;">类似“填报数据”区域的切换方式，当前显示 ${currentCount} / ${totalCount} 个文件。</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <label for="fileReportTypeFilter" style="font-size: 13px; color: #425466; font-weight: 600;">报送体系</label>
                            <select id="fileReportTypeFilter" onchange="updateFileReportTypeFilter('${category}', this.value)" style="min-width: 180px; padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(17, 92, 196, 0.18); background: rgba(255, 255, 255, 0.94); color: #163c7a; font-size: 13px; font-weight: 600; box-shadow: 0 12px 28px rgba(15, 60, 120, 0.06);">
                                ${optionsHtml}
                            </select>
                        </div>
                    </div>
                </div>
            `;
}

function getFileCategoryMeta(category) {
    const categoryMeta = {
        templates: {
            title: '模板文件',
            color: '#0f766e',
            soft: '#e8faf7',
            border: '#b9ebe1',
            description: '上传和维护填报模板、工程模板及其版本，确保导出始终使用正确模板。',
            actionHint: '上传模板'
        },
        databases: {
            title: '数据库文件',
            color: '#475569',
            soft: '#eef2f6',
            border: '#d7e0ea',
            description: '统一查看系统当前使用的数据库文件与历史底库，便于切换和清理。',
            actionHint: '刷新列表'
        },
        data_process: {
            title: '数据处理文件',
            color: '#1e40af',
            soft: '#e9efff',
            border: '#c9d7ff',
            description: '集中展示数据处理产物，覆盖一键处理、数据拆分、CSV转换和数据去重结果文件。',
            actionHint: '下载文件'
        },
        merge_results: {
            title: '合并结果文件',
            color: '#d97706',
            soft: '#fff3e2',
            border: '#f5d8aa',
            description: '集中查看合并结果产物，支持下载、归档与追踪检查。',
            actionHint: '下载文件'
        },
        assets: {
            title: '数据概览文件',
            color: '#0b63ce',
            soft: '#eaf3ff',
            border: '#c9ddff',
            description: '管理数据概览底册和相关文件，保持跨表查询所依赖的数据源一致。',
            actionHint: '下载文件'
        },
        exports: {
            title: '填报数据文件',
            color: '#2f855a',
            soft: '#ecfdf3',
            border: '#c8efd9',
            description: '查看已导出的报送文件，按时间归档，便于复核和追踪版本。',
            actionHint: '刷新列表'
        }
    };

    return categoryMeta[category] || categoryMeta.templates;
}

function applyFileManagementTheme(category) {
    const meta = getFileCategoryMeta(category);
    const page = document.getElementById('page-report');

    if (page) {
        page.style.setProperty('--file-accent', meta.color);
        page.style.setProperty('--file-accent-soft', meta.soft);
        page.style.setProperty('--file-accent-border', meta.border);
    }
}

function updateFileCategoryCountBadges(stats) {
    return stats || {};
}

function getCurrentCategoryFileCount(categoryData, isGrouped) {
    if (!categoryData) return 0;
    if (!isGrouped) {
        return Array.isArray(categoryData) ? categoryData.length : 0;
    }

    return Object.values(categoryData).reduce((sum, items) => {
        return sum + (Array.isArray(items) ? items.length : 0);
    }, 0);
}

function updateFileManagementOverview(category, currentCount) {
    const meta = getFileCategoryMeta(category);
    const titleNode = document.getElementById('fileManagementCurrentCategoryTitle');
    const descNode = document.getElementById('fileManagementCurrentCategoryDescription');
    const inlineActionNode = document.getElementById('fileManagementOverviewInlineAction');

    if (titleNode) titleNode.textContent = meta.title;
    if (descNode) descNode.textContent = meta.description;
    if (inlineActionNode) {
        inlineActionNode.innerHTML = category === 'templates'
            ? `
                        <button class="btn file-page-action file-page-action--accent file-page-action--inline" onclick="showTemplateUploadModal()">
                            上传模板
                        </button>
                    `
            : '';
    }
}

function setFileManagementStatsCard(html) {
    return html || '';
}

function renderFileStatsCard(category, currentCount) {
    return '';
}

function renderFileStatsErrorCard(message) {
    return '';
}

async function loadStoredFiles() {
    try {
        const res = await fetch(API_BASE + '/project-files');
        const result = await res.json();

        if (result.success) {
            allProjectFiles = result.files;
            projectFilesStats = result.stats || null;
            renderProjectFiles(result.files, result.stats);
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        console.error('加载工程文件失败:', e);
        setFileManagementStatsCard(renderFileStatsErrorCard(e.message || '未知错误'));
        document.getElementById('filesContainer').innerHTML = `
                    <div class="file-empty-state">
                        <div class="file-empty-state__title">文件列表加载失败</div>
                        <div class="file-empty-state__desc">${escapeFileManagementHtml(e.message || '未知错误')}</div>
                    </div>
                `;
    }
}

// 切换文件类别
function switchFileCategory(category, btn) {
    currentFileCategory = category;
    const targetBtn = btn || document.getElementById('fileCategory-' + category);

    document.querySelectorAll('#page-report .file-management-tabs .category-tab').forEach(b => {
        b.classList.remove('active');
    });
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    applyFileManagementTheme(category);
    updateFileManagementOverview(category, 0);
    updateFileManagementActionButtons(category);

    if (allProjectFiles) {
        renderProjectFiles(allProjectFiles, null);
    }
}

// 更新文件管理区域的操作按钮
function updateFileManagementActionButtons(category) {
    const actionBtnContainer = document.getElementById('fileManagementActionButton');
    if (!actionBtnContainer) return;

    let buttonsHtml = '';

    switch (category) {
        case 'templates':
        case 'merge_results':
        case 'assets':
        case 'exports':
        case 'databases':
        default:
            buttonsHtml = '';
            break;
    }

    actionBtnContainer.innerHTML = buttonsHtml
        ? `<div class="file-management-actions">${buttonsHtml}</div>`
        : '';
}

// 获取类别颜色
function getCategoryColor(category) {
    return getFileCategoryMeta(category).color;
}

// 渲染文件卡片
function renderProjectFiles(files, stats) {
    if (stats) {
        allProjectFiles = files;
        projectFilesStats = stats;
    }

    const container = document.getElementById('filesContainer');
    if (!container) return;

    const isGrouped = currentFileCategory === 'exports';
    const rawCategorySource = files[currentFileCategory] || (isGrouped ? {} : []);
    const rawCategoryData = isGrouped
        ? rawCategorySource
        : flattenProjectFileCategoryData(rawCategorySource);
    const totalCategoryCount = getCurrentCategoryFileCount(rawCategoryData, isGrouped);
    const categoryData = filterProjectFilesByReportType(rawCategoryData, currentFileCategory, isGrouped);
    const reportTypeColors = {
        '业支上报': '#0b63ce',
        'SMC上报': '#2f855a',
        '信安上报': '#c2410c'
    };
    const config = getFileCategoryMeta(currentFileCategory);

    let hasData = false;
    if (isGrouped) {
        hasData = Object.keys(categoryData).length > 0;
    } else {
        hasData = Array.isArray(categoryData) && categoryData.length > 0;
    }

    const currentCount = getCurrentCategoryFileCount(categoryData, isGrouped);
    applyFileManagementTheme(currentFileCategory);
    updateFileCategoryCountBadges(projectFilesStats);
    updateFileManagementOverview(currentFileCategory, currentCount);
    const statsHtml = renderFileStatsCard(currentFileCategory, currentCount);
    setFileManagementStatsCard(statsHtml);
    const filterHtml = renderFileReportTypeFilter(currentFileCategory, currentCount, totalCategoryCount);

    if (!hasData) {
        const selectedType = getCurrentFileReportTypeFilter(currentFileCategory);
        const emptyDesc = shouldShowFileReportTypeFilter(currentFileCategory) && selectedType !== 'all'
            ? `当前分类下暂无“${selectedType}”相关文件，你可以切换筛选查看其他报送体系。`
            : '当前分类下还没有可展示的文件，后续上传、导出或切换数据源后会出现在这里。';
        container.innerHTML = `
                    ${filterHtml}
                    <div class="file-empty-state">
                        <div class="file-empty-state__title">暂无${config.title}</div>
                        <div class="file-empty-state__desc">${emptyDesc}</div>
                    </div>
                `;
        return;
    }

    let html = `${filterHtml}`;
    if (isGrouped) {
        const sortedMonths = Object.keys(categoryData).sort().reverse();
        html += sortedMonths.map(monthTag => {
            const monthFiles = categoryData[monthTag] || [];
            return `
                        <section class="file-month-group">
                            <div class="file-month-group__header">
                                <div>
                                    <div class="file-month-group__eyebrow">时间分组</div>
                                    <div class="file-month-group__title">${escapeFileManagementHtml(monthTag)}</div>
                                </div>
                                <div class="file-month-group__count">${monthFiles.length} 个文件</div>
                            </div>
                            <div class="file-card-list">
                                ${monthFiles.map(file => renderFileCard(file, config, reportTypeColors)).join('')}
                            </div>
                        </section>
                    `;
        }).join('');
    } else {
        html += `
                    <div class="file-card-list">
                        ${categoryData.map(file => renderFileCard(file, config, reportTypeColors)).join('')}
                    </div>
                `;
    }

    container.innerHTML = html;
}

// 渲染单个文件卡片
function renderFileCard(file, config, reportTypeColors) {
    const icon = getFileIcon(file.filename || '');
    const safeFilename = escapeFileManagementHtml(file.filename || '未命名文件');
    const safeSize = escapeFileManagementHtml(file.size_formatted || '-');
    const safeModified = escapeFileManagementHtml(file.modified_formatted || '-');
    const safePath = escapeFileManagementHtml(file.path || '');
    const safeNote = escapeFileManagementHtml(file.note || '');
    let cardColor = config.color;
    let cardBgColor = config.soft;
    const reportTypeLabel = inferProjectFileReportType(file, currentFileCategory);

    if (reportTypeLabel && reportTypeColors[reportTypeLabel]) {
        cardColor = reportTypeColors[reportTypeLabel];
    }

    const colorMap = {
        '#0b63ce': '#eaf3ff',
        '#2f855a': '#ecfdf3',
        '#c2410c': '#fff1e8',
        '#0f766e': '#e8faf7',
        '#475569': '#eef2f6',
        '#d97706': '#fff3e2',
        '#1e40af': '#e9efff'
    };
    cardBgColor = colorMap[cardColor] || config.soft;
    const downloadTarget = (file.type === 'data_process' || currentFileCategory === 'data_process')
        ? (file.path || '')
        : (file.note && file.note === '已导入数据库'
            ? (file.path || '').replace(/\\/g, '/')
            : (file.filename || ''));
    const encodedDownloadTarget = encodeURIComponent(downloadTarget || '');
    const encodedFilePath = encodeURIComponent(file.path || '');
    const encodedFilename = encodeURIComponent(file.filename || '');
    const metaTags = [];

    if (reportTypeLabel) {
        metaTags.push(`
                    <span class="file-pill" style="--file-pill-color: ${cardColor}; --file-pill-bg: ${cardBgColor};">
                        ${escapeFileManagementHtml(reportTypeLabel)}
                    </span>
                `);
    }
    if (file.is_current) {
        metaTags.push('<span class="file-pill file-pill--current">当前数据源</span>');
    }
    if (safeNote) {
        metaTags.push(`<span class="file-pill file-pill--neutral">${safeNote}</span>`);
    }

    return `
                <article class="file-card${file.is_current ? ' is-current' : ''}" style="--file-card-accent: ${cardColor}; --file-card-soft: ${cardBgColor};">
                    <div class="file-card__icon">${icon}</div>
                    <div class="file-card__content">
                        <div class="file-card__title-row">
                            <div class="file-card__title">${safeFilename}</div>
                            ${metaTags.length > 0 ? `<div class="file-card__pills">${metaTags.join('')}</div>` : ''}
                        </div>
                        <div class="file-card__meta">
                            <span>大小 ${safeSize}</span>
                            <span>更新时间 ${safeModified}</span>
                        </div>
                        ${safePath ? `<div class="file-card__path">${safePath}</div>` : ''}
                    </div>
                    <div class="file-card__actions">
                        <button class="btn file-card__action file-card__action--download" onclick="downloadProjectFile('${file.type}', '${encodedDownloadTarget}')">
                            下载
                        </button>
                        ${safePath ? `<button class="btn file-card__action file-card__action--ghost" onclick="copyFilePath('${encodedFilePath}')">复制路径</button>` : ''}
                        <button class="btn file-card__action file-card__action--danger" onclick="deleteProjectFile('${file.type}', '${encodedFilename}', '${encodedFilePath}')">
                            删除
                        </button>
                    </div>
                </article>
            `;
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'xlsx': 'XLS',
        'xls': 'XLS',
        'db': 'DB',
        'json': 'JSON',
        'md': 'MD',
        'txt': 'TXT',
        'pdf': 'PDF'
    };
    return icons[ext] || 'FILE';
}

// 复制文件路径
function copyFilePath(encodedPath) {
    const path = decodeURIComponent(encodedPath || '');
    navigator.clipboard.writeText(path).then(() => {
        showToast('文件路径已复制到剪贴板', true);
    }).catch(() => {
        prompt('文件路径（按Ctrl+C复制）:', path);
    });
}

function normalizeProjectFileType(type) {
    const typeMap = {
        database: 'databases',
        merge_result: 'merge_results',
        asset: 'assets'
    };
    return typeMap[type] || type;
}

// 下载工程文件
async function downloadProjectFile(type, encodedFilename) {
    const filename = decodeURIComponent(encodedFilename || '');
    try {
        showToast('正在准备下载...', false);

        // 创建下载链接
        const normalizedType = normalizeProjectFileType(type);
        const downloadUrl = `${API_BASE}/project-files/download/${normalizedType}/${encodeURIComponent(filename)}`;

        // 使用fetch下载文件
        const response = await fetch(downloadUrl);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '下载失败');
        }

        // 获取文件blob
        const blob = await response.blob();

        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // 清理
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast(`"${filename}" 下载成功`, false);
    } catch (error) {
        console.error('下载文件失败:', error);
        showToast('下载失败: ' + error.message, true);
    }
}

// 删除工程文件
async function deleteProjectFile(type, encodedFilename, encodedPath) {
    const filename = decodeURIComponent(encodedFilename || '');
    const path = decodeURIComponent(encodedPath || '');
    const confirmMsg = `确定要删除文件 "${filename}" 吗？\n\n此操作将永久删除该文件，无法恢复！`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const res = await fetch(API_BASE + '/project-files/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: type, filename: filename, path: path })
        });

        const result = await res.json();

        if (result.success) {
            showToast('删除成功', true);
            await loadStoredFiles(); // 刷新列表
        } else {
            showToast(result.error || '删除失败', true);
        }
    } catch (e) {
        showToast('删除失败: ' + e.message, true);
    }
}

// 下载存储的文件
function downloadStoredFile(fileName) {
    window.open(API_BASE + '/stored-files/download/' + fileName, '_blank');
}

// 删除存储的文件
async function deleteStoredFile(fileName) {
    if (!confirm('确定要删除此文件吗？删除后将无法恢复！')) return;

    try {
        const res = await fetch(API_BASE + '/stored-files/' + fileName, { method: 'DELETE' });
        const result = await res.json();

        if (result.success) {
            showToast('删除成功', true);
            await loadStoredFiles();
        } else {
            showToast(result.error || '删除失败', true);
        }
    } catch (e) {
        showToast('删除失败: ' + e.message, true);
    }
}

// ==================== 模板上传管理 ====================

// 显示模板上传对话框
function showTemplateUploadModal() {
    document.getElementById('templateUploadModal').classList.add('show');
    document.getElementById('templateUploadProgress').style.display = 'none';
    document.getElementById('templateUploadForm').style.display = 'block';
}

// 关闭模板上传对话框
function closeTemplateUploadModal() {
    document.getElementById('templateUploadModal').classList.remove('show');
    document.getElementById('templateFileInput').value = '';
}

// 上传模板文件
async function uploadTemplate() {
    const fileInput = document.getElementById('templateFileInput');
    const category = document.getElementById('templateCategory').value;

    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('请选择要上传的文件', true);
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    // 显示进度
    document.getElementById('templateUploadForm').style.display = 'none';
    document.getElementById('templateUploadProgress').style.display = 'block';
    document.getElementById('templateUploadProgressBar').style.width = '50%';

    try {
        const res = await fetch(API_BASE + '/templates/upload', {
            method: 'POST',
            body: formData
        });

        const result = await res.json();

        document.getElementById('templateUploadProgressBar').style.width = '100%';

        if (result.success) {
            showToast('模板上传成功', true);
            setTimeout(() => {
                closeTemplateUploadModal();
                loadStoredFiles(); // 刷新文件列表
            }, 500);
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        showToast('上传失败: ' + e.message, true);
        document.getElementById('templateUploadProgress').style.display = 'none';
        document.getElementById('templateUploadForm').style.display = 'block';
        document.getElementById('templateUploadProgressBar').style.width = '0%';
    }
}

// 页面切换时加载文件列表
const originalSwitchPage = switchPage;
switchPage = function (pageName, navElement) {
    originalSwitchPage(pageName, navElement);
    if (pageName === 'report') {
        setTimeout(() => loadStoredFiles(), 100);
    }
    if (pageName === 'settings') {
        setTimeout(() => loadLogs(), 100);
    }
};

// 显示映射管理使用参考
function showMappingHelp() {
    document.getElementById('mappingHelpModal').style.display = 'flex';
}

// 关闭映射管理使用参考
function closeMappingHelp() {
    document.getElementById('mappingHelpModal').style.display = 'none';
}

// 显示数据处理使用参考
function showDataProcessHelp() {
    document.getElementById('dataProcessHelpModal').style.display = 'flex';
}

// 关闭数据处理使用参考
function closeDataProcessHelp() {
    document.getElementById('dataProcessHelpModal').style.display = 'none';
}

async function downloadWorkspaceTemplate(pageType) {
    const normalizedPageType = pageType === 'merge' ? 'merge' : 'device';
    const isMerge = normalizedPageType === 'merge';

    try {
        const response = await fetch(API_BASE + '/workspace-template/' + normalizedPageType);
        if (!response.ok) {
            let errorMessage = '模板下载失败';
            try {
                const errorResult = await response.json();
                errorMessage = errorResult.error || errorMessage;
            } catch (parseError) {
                errorMessage = `模板下载失败（HTTP ${response.status}）`;
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isMerge ? '合并结果导入模板.xlsx' : '数据概览导入模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('模板下载成功', false);
    } catch (e) {
        console.error('下载工作区模板失败:', e);
        showToast(e.message || '模板下载失败', true);
    }
}


if (typeof advancedFilterState !== 'undefined') {
    window.advancedFilterState = advancedFilterState;
}

function bootstrapLegacyShell() {
    ensureDeviceExportButton();

    if (typeof init === 'function') {
        Promise.resolve(init()).catch(function (error) {
            console.error('初始化数据概览失败:', error);
        });
    }

    const activePage = document.querySelector('.page.active');
    const activeNav = document.querySelector('.nav-item.active');
    if (!activePage) {
        return;
    }

    const pageName = String(activePage.id || '').replace(/^page-/, '');
    if (pageName && pageName !== 'device' && typeof switchPage === 'function') {
        switchPage(pageName, activeNav);
    }
}

function ensureDeviceExportButton() {
    const devicePage = document.getElementById('page-device');
    if (!devicePage) {
        return;
    }

    const actions = devicePage.querySelector('.workspace-toolbar-actions');
    if (!actions || actions.querySelector('#deviceExportBtn')) {
        return;
    }

    const exportBtn = document.createElement('button');
    exportBtn.id = 'deviceExportBtn';
    exportBtn.className = 'btn';
    exportBtn.type = 'button';
    exportBtn.textContent = '导出数据';
    exportBtn.onclick = exportAssetsToExcel;

    const importBtn = actions.querySelector('.btn.btn-success');
    if (importBtn && importBtn.parentNode === actions) {
        actions.insertBefore(exportBtn, importBtn);
    } else {
        actions.appendChild(exportBtn);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapLegacyShell);
} else {
    bootstrapLegacyShell();
}
