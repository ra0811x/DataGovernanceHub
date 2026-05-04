/* Reporting page logic extracted from app-shell-legacy.js. */

let logicRuleTypesReference = {};
let currentLogicRule = null;
let allLogicRules = [];

const LOGIC_RULE_REVIEW_STATUS = {
    data_level_to_storage: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：业支10002、SMC附件三、信安10001'
    },
    data_source_judge_crm: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：业支10002'
    },
    ad_class_purpose: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：业支10002、SMC附件三、信安10001'
    },
    ad_class_path: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：业支10002、SMC附件三、信安10001'
    },
    ad_class_scenario: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：业支10002、SMC附件三、信安10001'
    },
    guarantee_measures: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：业支10002、SMC附件三、信安10001'
    },
    xinan_status_conditions: {
        label: '已确认使用',
        color: '#15803d',
        background: '#ecfdf3',
        note: '已确认：信安00000'
    }
};

const LOGIC_RULE_CATEGORY_CONFIG = {
    basic: { name: '基础类型', color: '#6c757d', order: 1 },
    field: { name: '字段取值', color: '#005fe0', order: 2 },
    conditional: { name: '条件判断', color: '#ff9800', order: 3 },
    lookup: { name: '跨表查询', color: '#17a2b8', order: 4 },
    advanced: { name: '高级类型', color: '#7c3aed', order: 5 }
};

const LOGIC_RULE_BASE_KEYS = new Set([
    'id',
    'name',
    'type',
    'description',
    'source_field',
    'created_at',
    'updated_at',
    'usage_count',
    'used_in'
]);

function cloneLogicRuleValue(value) {
    if (value === undefined) {
        return undefined;
    }
    return JSON.parse(JSON.stringify(value));
}

function normalizeLogicRuleType(type) {
    const architecture = window.ThreeLayerArchitecture;
    if (architecture && typeof architecture.convertToNewType === 'function') {
        return architecture.convertToNewType(type);
    }
    return type;
}

function denormalizeLogicRuleType(type) {
    const architecture = window.ThreeLayerArchitecture;
    if (architecture && typeof architecture.convertToOldType === 'function') {
        return architecture.convertToOldType(type);
    }
    return type;
}

function getLogicRuleSourceTypeMetaMap() {
    const architecture = window.ThreeLayerArchitecture;
    if (!architecture || typeof architecture.getOperations !== 'function' || typeof architecture.getSourcesByOperation !== 'function') {
        return {};
    }

    const sourceMetaMap = {};
    const operations = architecture.getOperations();
    Object.keys(operations || {}).forEach(operationKey => {
        const sourceTypes = architecture.getSourcesByOperation(operationKey) || {};
        Object.entries(sourceTypes).forEach(([sourceId, sourceMeta]) => {
            sourceMetaMap[sourceId] = { ...sourceMeta };
            if (sourceMeta && sourceMeta.oldId) {
                sourceMetaMap[sourceMeta.oldId] = { ...sourceMeta, id: sourceMeta.oldId };
            }
        });
    });
    return sourceMetaMap;
}

function getLogicRuleTypeCatalog() {
    const sourceMetaMap = getLogicRuleSourceTypeMetaMap();
    const catalog = {};

    Object.entries(logicRuleTypesReference || {}).forEach(([typeId, meta]) => {
        catalog[typeId] = {
            id: typeId,
            name: meta.name || typeId,
            description: meta.description || '',
            category: meta.category || sourceMetaMap[typeId]?.category || 'basic',
            color: sourceMetaMap[typeId]?.color || LOGIC_RULE_CATEGORY_CONFIG[meta.category || 'basic']?.color || '#6c757d'
        };
    });

    const dynamicDefinitions = window.DynamicConfigQueryManager?.listDefinitions?.() || {};
    Object.entries(dynamicDefinitions).forEach(([normalizedType, definition]) => {
        const sourceMeta = sourceMetaMap[normalizedType] || {};
        const storedType = denormalizeLogicRuleType(normalizedType);
        const fallbackCategory = sourceMeta.category
            || (sourceMeta.operation === 'lookup'
                ? 'lookup'
                : sourceMeta.operation === 'calculate'
                    ? 'conditional'
                    : sourceMeta.operation === 'expand'
                        ? 'advanced'
                        : 'basic');

        catalog[storedType] = {
            id: storedType,
            name: catalog[storedType]?.name || sourceMeta.name || definition.title || storedType,
            description: catalog[storedType]?.description || definition.description || definition.subtitle || sourceMeta.description || '',
            category: catalog[storedType]?.category || fallbackCategory,
            color: catalog[storedType]?.color || sourceMeta.color || LOGIC_RULE_CATEGORY_CONFIG[fallbackCategory]?.color || '#6c757d'
        };
    });

    return catalog;
}

function getLogicRuleTypeMeta(type) {
    const catalog = getLogicRuleTypeCatalog();
    return catalog[type] || {
        id: type,
        name: type,
        description: '',
        category: 'basic',
        color: '#6c757d'
    };
}

function getLogicRuleDynamicDefinition(type) {
    return window.DynamicConfigQueryManager?.getDefinition?.(normalizeLogicRuleType(type)) || null;
}

const reportingCategories = {
    yeji: {
        name: '业支上报',
        description: '生成业支域相关的数据资产报表',
        color: '#007bff',
        dataSource: 'device',
        files: [
            {
                code: '10001',
                name: '数据库资产信息表',
                description: '包含所有业支网相关的数据库资产信息',
                records: 402,
                template: 'Templates/业支上报/i_10600_10001_template.xlsx',
                export: 'SGExportFiles/YeZhi/i_10600_10001_',
                notes: '主要包含数据库实例的基本信息和资产属性',
                status: 'completed'
            },
            {
                code: '10002',
                name: '数据资产字段信息表',
                description: '包含约30万条字段级别的详细记录',
                records: 300000,
                template: 'Templates/业支上报/i_10600_10002_template.xlsx',
                export: 'SGExportFiles/YeZhi/i_10600_10002_',
                notes: '数据量大，导出需要2-3分钟，请耐心等待',
                status: 'completed'
            },
            {
                code: '10004',
                name: '数据策略上报清单',
                description: '包含数据脱敏策略、数据分类分级等信息',
                records: 1449,
                template: 'Templates/业支上报/i_10600_10004_template.xlsx',
                export: 'SGExportFiles/YeZhi/i_10600_10004_',
                notes: '包含数据脱敏策略、数据分类、数据分级、路径负责人等信息',
                status: 'completed'
            }
        ]
    },
    smc: {
        name: 'SMC上报',
        description: '生成SMC相关的数据资产报表',
        color: '#28a745',
        dataSource: 'device',
        files: [
            {
                code: '附件三',
                name: '数据资产清单',
                description: 'SMC附件三：数据资产清单，包含约30万条字段级别的详细记录',
                records: 0,
                template: 'Templates/SMC上报/附件三_数据资产清单_template.xlsx',
                export: 'SGExportFiles/SMC/attachment_3_',
                notes: '数据资产清单报表',
                status: 'completed'
            },
            {
                code: '附件五',
                name: '涉敏资产梳理汇总表',
                description: 'SMC附件五：涉敏资产梳理汇总表',
                records: 0,
                template: 'Templates/SMC上报/附件五_涉敏资产梳理汇总表_template.xlsx',
                export: 'SGExportFiles/SMC/attachment_5_',
                notes: '涉敏资产梳理汇总表',
                status: 'completed'
            }
        ]
    },
    xinan: {
        name: '信安上报',
        description: '生成信息安全管理相关的数据资产报表',
        color: '#dc3545',
        dataSource: 'device',
        files: [
            {
                code: '00000',
                name: '数据资产汇总表',
                description: '包含约400条数据资产信息记录',
                records: 400,
                template: 'Templates/信安上报/i_10600_00000_template_00_000.xlsx',
                export: 'SGExportFiles/XinAn/i_10600_00000_',
                notes: '包含业务系统、资源名称、资源IP等核心信息',
                status: 'completed'
            },
            {
                code: '10001',
                name: '数据资产字段信息表',
                description: '包含数据库字段详细信息及安全分级',
                records: 0,
                template: 'Templates/信安上报/i_10600_10001_template_00_002.xlsx',
                export: 'SGExportFiles/XinAn/i_10600_10001_',
                notes: '包含字段名称、数据分类、数据分级、保障措施等信息',
                status: 'completed'
            }
        ]
    }
};

let reportSettingsActiveCategory = 'yeji';
let reportSettingsActiveCode = '';

function getReportingFileDisplayName(file) {
    if (!file) return '';
    return String(file.display_name || file.name || file.code || '').trim();
}

function getReportingFileDisplayCode(file) {
    if (!file) return '';
    return String(file.display_code || file.code || '').trim();
}

function getActiveReportingCategory() {
    const activeButton = document.querySelector('#reporting-tab-reports .reporting-category-button.active');
    return activeButton ? activeButton.id.replace('reportCategory-', '') : 'yeji';
}

function setActiveReportingCategory(category) {
    document.querySelectorAll('#reporting-tab-reports .reporting-category-button').forEach(btn => {
        btn.classList.toggle('active', btn.id === `reportCategory-${category}`);
    });
}

function setActiveMappingCategory(category, expanded) {
    document.querySelectorAll('.mapping-category-button').forEach(btn => {
        const isActive = expanded && btn.id === `mappingCategory-${category}`;
        btn.classList.toggle('active', isActive);
    });
}

function updateReportingOverview(category, files) {
    const categoryConfig = reportingCategories[category] || {};
    const reportFiles = Array.isArray(files) ? files : (categoryConfig.files || []);
    const title = document.getElementById('reportingCurrentCategoryTitle');
    const description = document.getElementById('reportingCurrentCategoryDescription');
    const count = document.getElementById('reportingCurrentCategoryCount');
    const source = document.getElementById('reportingCurrentCategorySource');

    if (title) title.textContent = categoryConfig.name || '报表导出';
    if (description) description.textContent = categoryConfig.description || '选择分类查看当前可导出的报表。';
    if (count) count.textContent = `${reportFiles.length} 个报表`;
    if (source) source.textContent = categoryConfig.dataSource === 'merge' ? '合并结果' : '数据概览';
}

function updateMappingOverview(category, reportCode = '') {
    const title = document.getElementById('mappingWorkspaceTitle');
    const description = document.getElementById('mappingWorkspaceDescription');
    const hint = document.getElementById('mappingWorkspaceHint');
    const categoryConfig = reportingCategories[category];

    if (!categoryConfig) {
        if (title) title.textContent = '映射管理';
        if (description) description.textContent = '请先从左侧展开分类，再选择具体报表查看映射配置。';
        if (hint) hint.textContent = '等待选择报表';
        return;
    }

    const targetReport = (categoryConfig.files || []).find(file => {
        const fileCode = file.original_code || file.code;
        return fileCode === reportCode || file.code === reportCode;
    });

    if (title) {
        title.textContent = targetReport
            ? `${categoryConfig.name} / ${getReportingFileDisplayName(targetReport)}`
            : `${categoryConfig.name} 映射管理`;
    }

    if (description) {
        description.textContent = targetReport
            ? `当前正在查看 ${getReportingFileDisplayName(targetReport)} 的映射规则。这里的保存会直接影响该报表导出。`
            : `已切换到 ${categoryConfig.name} 分类，请继续从左侧选择具体报表。映射保存后会直接影响导出。`;
    }

    if (hint) {
        hint.textContent = targetReport ? `当前报表：${getReportingFileDisplayCode(targetReport)}` : '等待选择报表';
    }
}

function updateLogicOverview(tab) {
    const metaMap = {
        'rules': {
            title: '条件规则库',
            description: '存放规则模板和储备条件，不直接影响导出；只有应用到映射管理后才生效。',
            hint: '储备层 / 规则模板',
            contentTitle: '规则与字典',
            contentDescription: '当前聚焦规则模板库和我的规则列表。这里的增删改仅影响规则储备，不直接改动导出口径。'
        },
        'sample-standards': {
            title: '数据分级标准样例',
            description: '维护导出时复用的数据样例标准。保存后会直接影响使用 data_sample_mapper 的报表导出。',
            hint: '生效层 / 样例标准',
            contentTitle: '标准样例工作区',
            contentDescription: '这里集中管理标准样例、筛选条件和导入导出动作，属于映射管理的生效配置。'
        },
        'business-system-mapping': {
            title: '公共配置',
            description: '统一维护跨表名称映射类公共配置。已接线配置保存后会直接影响导出，预留项暂不生效。',
            hint: '生效层 / 公共配置',
            contentTitle: '映射字典工作区',
            contentDescription: '这里集中处理已接线公共配置的维护入口和引用范围。保存后会直接影响对应报表导出。'
        }
    };

    const meta = metaMap[tab] || metaMap.rules;
    const title = document.getElementById('logicWorkspaceTitle');
    const description = document.getElementById('logicWorkspaceDescription');
    const hint = document.getElementById('logicWorkspaceHint');
    const contentTitle = document.getElementById('logicContentTitle');
    const contentDescription = document.getElementById('logicContentDescription');
    const workspaceActions = document.getElementById('logicContentWorkspaceActions');

    if (title) title.textContent = meta.title;
    if (description) description.textContent = meta.description;
    if (hint) hint.textContent = meta.hint;
    if (contentTitle) contentTitle.textContent = meta.contentTitle;
    if (contentDescription) contentDescription.textContent = meta.contentDescription;
    if (workspaceActions) {
        workspaceActions.style.display = tab === 'business-system-mapping' ? 'flex' : 'none';
    }
}

// 加载用户自定义报表并合并到预定义报表
async function loadReportingData() {
    try {
        const response = await fetch(API_BASE + '/custom-reports');
        const result = await response.json();

        if (result.success && result.data) {
            const customReports = result.data;

            // 合并每个类别的自定义报表
            for (const category of ['yeji', 'smc', 'xinan']) {
                const baseFiles = reportingCategories[category].files.filter(f => !f.isCustom);
                const mergedFiles = [...baseFiles];

                if (customReports[category] && Array.isArray(customReports[category])) {
                    customReports[category].forEach(report => {
                        const mergedReport = {
                            ...report
                        };
                        const targetCode = report.original_code || report.code;
                        const existingIndex = mergedFiles.findIndex(file => {
                            const fileMatchCode = file.original_code || file.code;
                            return fileMatchCode === targetCode;
                        });

                        if (existingIndex >= 0) {
                            mergedFiles[existingIndex] = {
                                ...mergedFiles[existingIndex],
                                ...mergedReport,
                                isCustom: Boolean(mergedFiles[existingIndex].isCustom)
                            };
                        } else {
                            mergedFiles.push({
                                ...mergedReport,
                                isCustom: true
                            });
                        }
                    });
                }

                reportingCategories[category].files = mergedFiles;
            }

            // 重新渲染当前类别
            renderReportsByCategory(getActiveReportingCategory());
        }
    } catch (error) {
        console.error('加载自定义报表失败:', error);
    }
}

function findReportingFile(category, fileCode) {
    const categoryConfig = reportingCategories[category];
    if (!categoryConfig || !Array.isArray(categoryConfig.files)) {
        return null;
    }

    return categoryConfig.files.find(file => {
        const actualCode = file.original_code || file.code;
        return actualCode === fileCode || file.code === fileCode;
    }) || null;
}

function canEditReportingFile(file) {
    return Boolean(file && file.isCustom === true);
}

function canExportReportingFile(file) {
    return Boolean(file && file.status === 'completed' && file.type !== 'display');
}

function closeReportSettingsModal() {
    const modal = document.getElementById('reportSettingsModal');
    if (!modal) {
        return;
    }
    modal.style.display = 'none';
    modal.classList.remove('show');
    modal.innerHTML = '';
}

function buildReportSettingsCategoryTabs() {
    return ['yeji', 'smc', 'xinan'].map(category => {
        const isActive = reportSettingsActiveCategory === category;
        const color = reportingCategories[category]?.color || '#005fe0';
        return `
            <button type="button"
                onclick="switchReportSettingsCategory('${category}')"
                style="padding: 8px 14px; border-radius: 999px; border: 1px solid ${isActive ? color : '#dbe5f0'}; background: ${isActive ? color : '#fff'}; color: ${isActive ? '#fff' : '#475569'}; cursor: pointer; font-size: 12px; font-weight: 600;">
                ${reportingCategories[category]?.name || category}
            </button>
        `;
    }).join('');
}

function getSortedReportSettingsFiles(category) {
    const files = reportingCategories[category]?.files || [];
    return [...files].sort((a, b) => {
        const codeA = parseInt(a.code, 10);
        const codeB = parseInt(b.code, 10);
        if (Number.isFinite(codeA) && Number.isFinite(codeB)) {
            return codeA - codeB;
        }
        return String(a.code || '').localeCompare(String(b.code || ''), 'zh-CN');
    });
}

function ensureReportSettingsSelection() {
    const files = getSortedReportSettingsFiles(reportSettingsActiveCategory);
    if (!files.length) {
        reportSettingsActiveCode = '';
        return null;
    }

    const selectedFile = findReportingFile(reportSettingsActiveCategory, reportSettingsActiveCode);
    if (selectedFile) {
        return selectedFile;
    }

    reportSettingsActiveCode = files[0].code;
    return files[0];
}

function switchReportSettingsCategory(category) {
    reportSettingsActiveCategory = category;
    reportSettingsActiveCode = '';
    renderReportSettingsModal();
}

function selectReportSettingsReport(code) {
    reportSettingsActiveCode = code;
    renderReportSettingsModal();
}

function renderReportSettingsModal() {
    const modal = document.getElementById('reportSettingsModal');
    if (!modal) {
        return;
    }

    const selectedFile = ensureReportSettingsSelection();
    const files = getSortedReportSettingsFiles(reportSettingsActiveCategory);
    const categoryTitle = reportingCategories[reportSettingsActiveCategory]?.name || reportSettingsActiveCategory;
    const fileOptionsHtml = files.map(file => {
        const isSelected = selectedFile && file.code === selectedFile.code;
        return `<option value="${escapeHtml(file.code)}" ${isSelected ? 'selected' : ''}>${escapeHtml(getReportingFileDisplayCode(file))} - ${escapeHtml(getReportingFileDisplayName(file))}</option>`;
    }).join('');

    const displayName = selectedFile ? getReportingFileDisplayName(selectedFile) : '';
    const displayCode = selectedFile ? getReportingFileDisplayCode(selectedFile) : '';
    const internalCode = selectedFile?.code || '';
    const isCustom = Boolean(selectedFile?.isCustom);
    const typeLabel = selectedFile?.type === 'display' ? '仅展示' : '映射导出';
    const settingsNote = isCustom
        ? '当前为自定义报表，可同时修改显示层参数和报表运行参数。'
        : '当前为系统预置报表，仅保存显示层覆盖项，内部真实代码与正式导出绑定保持不变。';

    modal.innerHTML = `
        <div class="modal-content" style="width: min(820px, 94vw); max-width: 820px; max-height: 90vh; border-radius: 18px; overflow: hidden; box-shadow: 0 26px 64px rgba(15, 53, 120, 0.24);">
            <div class="modal-header" style="padding: 20px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                <div>
                    <div style="font-size: 20px; font-weight: 700;">报表设置</div>
                    <div style="margin-top: 6px; font-size: 12px; opacity: 0.88;">集中维护报表显示名称、显示代码，以及自定义报表的业务参数</div>
                </div>
                <button class="modal-close" type="button" onclick="closeReportSettingsModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px; display: grid; gap: 18px; background: linear-gradient(180deg, rgba(248, 251, 255, 0.98) 0%, rgba(241, 247, 255, 0.96) 100%);">
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${buildReportSettingsCategoryTabs()}
                </div>
                ${selectedFile ? `
                    <div style="display: grid; gap: 16px;">
                        <div style="display: grid; grid-template-columns: minmax(180px, 220px) 1fr; gap: 12px 16px; align-items: center;">
                            <label for="reportSettingsReportSelect" style="font-size: 13px; font-weight: 600; color: #1f2937;">选择报表</label>
                            <select id="reportSettingsReportSelect" onchange="selectReportSettingsReport(this.value)" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff;">
                                ${fileOptionsHtml}
                            </select>
                        </div>
                        <div style="padding: 14px 16px; background: #fff; border: 1px solid #dbeafe; border-radius: 12px; color: #475569; font-size: 12px; line-height: 1.8;">
                            ${escapeHtml(settingsNote)}
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px;">
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">显示名称</label>
                                <input id="reportSettingsDisplayName" type="text" value="${escapeHtml(displayName)}" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff;">
                            </div>
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">显示代码</label>
                                <input id="reportSettingsDisplayCode" type="text" value="${escapeHtml(displayCode)}" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff;">
                            </div>
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">内部真实代码</label>
                                <input type="text" value="${escapeHtml(internalCode)}" readonly style="padding: 10px 12px; border: 1px solid #dbe5f0; border-radius: 8px; font-size: 13px; background: #f8fafc; color: #64748b;">
                            </div>
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">报表属性</label>
                                <input type="text" value="${isCustom ? '自定义报表' : '系统预置报表'} / ${typeLabel}" readonly style="padding: 10px 12px; border: 1px solid #dbe5f0; border-radius: 8px; font-size: 13px; background: #f8fafc; color: #64748b;">
                            </div>
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">标签</label>
                                <input id="reportSettingsTag" type="text" value="${escapeHtml(selectedFile?.tag || '')}" placeholder="如：自定义、重点" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff;">
                            </div>
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">数据来源</label>
                                <select id="reportSettingsDataSource" ${isCustom ? '' : 'disabled'} style="padding: 10px 12px; border: 1px solid ${isCustom ? '#cbd5e1' : '#dbe5f0'}; border-radius: 8px; font-size: 13px; background: ${isCustom ? '#fff' : '#f8fafc'}; color: ${isCustom ? '#0f172a' : '#64748b'};">
                                    <option value="assets" ${(selectedFile?.data_source || '') === 'assets' ? 'selected' : ''}>数据概览</option>
                                    <option value="merge_results" ${(selectedFile?.data_source || '') === 'merge_results' ? 'selected' : ''}>合并结果</option>
                                    <option value="both" ${(selectedFile?.data_source || '') === 'both' ? 'selected' : ''}>两者都</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; gap: 6px;">
                            <label style="font-size: 12px; font-weight: 600; color: #334155;">备注</label>
                            <textarea id="reportSettingsNotes" rows="3" placeholder="填写报表说明" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff; resize: vertical;">${escapeHtml(selectedFile?.notes || '')}</textarea>
                        </div>
                        <div style="display: grid; gap: 14px;">
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">模板文件</label>
                                <input id="reportSettingsTemplate" type="text" value="${escapeHtml(selectedFile?.template || '')}" ${isCustom ? '' : 'readonly'} style="padding: 10px 12px; border: 1px solid ${isCustom ? '#cbd5e1' : '#dbe5f0'}; border-radius: 8px; font-size: 13px; background: ${isCustom ? '#fff' : '#f8fafc'}; color: ${isCustom ? '#0f172a' : '#64748b'};">
                            </div>
                            <div style="display: grid; gap: 6px;">
                                <label style="font-size: 12px; font-weight: 600; color: #334155;">导出目录</label>
                                <input id="reportSettingsExport" type="text" value="${escapeHtml(selectedFile?.export || '')}" ${isCustom ? '' : 'readonly'} style="padding: 10px 12px; border: 1px solid ${isCustom ? '#cbd5e1' : '#dbe5f0'}; border-radius: 8px; font-size: 13px; background: ${isCustom ? '#fff' : '#f8fafc'}; color: ${isCustom ? '#0f172a' : '#64748b'};">
                            </div>
                        </div>
                    </div>
                ` : `
                    <div style="padding: 20px; text-align: center; color: #64748b; background: #fff; border: 1px solid #dbeafe; border-radius: 12px;">
                        ${escapeHtml(categoryTitle)} 当前暂无可设置报表
                    </div>
                `}
            </div>
            <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: space-between; align-items: center;">
                <div style="font-size: 12px; color: #64748b;">保存后会立即刷新报表导出列表和映射管理名称。</div>
                <div class="modal-footer-right" style="display: flex; gap: 10px;">
                    <button class="btn" type="button" onclick="closeReportSettingsModal()">关闭</button>
                    <button class="btn btn-primary" type="button" onclick="saveReportSettings()">保存设置</button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    modal.classList.add('show');
}

function openReportSettingsModal() {
    reportSettingsActiveCategory = getActiveReportingCategory();
    reportSettingsActiveCode = '';
    renderReportSettingsModal();
}

async function saveReportSettings() {
    const selectedFile = ensureReportSettingsSelection();
    if (!selectedFile) {
        showToast('当前没有可设置的报表', true);
        return;
    }

    const payload = {
        category: reportSettingsActiveCategory,
        report_code: selectedFile.code,
        name: selectedFile.name || '',
        type: selectedFile.type || 'mapping',
        status: selectedFile.status || 'completed',
        display_name: document.getElementById('reportSettingsDisplayName')?.value.trim() || '',
        display_code: document.getElementById('reportSettingsDisplayCode')?.value.trim() || '',
        tag: document.getElementById('reportSettingsTag')?.value.trim() || '',
        notes: document.getElementById('reportSettingsNotes')?.value.trim() || ''
    };

    if (selectedFile.isCustom) {
        payload.data_source = document.getElementById('reportSettingsDataSource')?.value || '';
        payload.template = document.getElementById('reportSettingsTemplate')?.value.trim() || '';
        payload.export = document.getElementById('reportSettingsExport')?.value.trim() || '';
    }

    try {
        const response = await fetch(API_BASE + '/report-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showToast(`保存报表设置失败：${result.error || result.message || '未知错误'}`, true);
            return;
        }

        const activeReportTabCategory = getActiveReportingCategory();
        await loadReportingData();
        renderReportsByCategory(activeReportTabCategory);
        updateMappingOverview(currentMappingCategory, currentMappingReportCode);
        await loadMappingReportSelect();

        reportSettingsActiveCategory = payload.category;
        reportSettingsActiveCode = result.data?.code || selectedFile.code;
        renderReportSettingsModal();
        showToast('报表设置已保存', false);
    } catch (error) {
        console.error('保存报表设置失败:', error);
        showToast(`保存失败: ${error.message}`, true);
    }
}

// 渲染单个报表卡片
function renderReportCard(category, file) {
    const exportable = canExportReportingFile(file);
    return `
        <div style="border: 1px solid #e9ecef; border-radius: 6px; padding: 12px 15px; margin-bottom: 10px; background: white; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; gap: 15px;">
            <div style="flex: 1; min-width: 0;">
                <div style="margin-bottom: 4px;">
                    <span style="font-size: 15px; font-weight: 600; color: #333;">${getReportingFileDisplayName(file)}</span>
                </div>
                <div style="font-size: 12px; color: #999;">
                    代码: <span style="font-family: monospace; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">${getReportingFileDisplayCode(file)}</span>
                    ${file.records > 0 ? `<span style="margin-left: 10px;">约 ${file.records.toLocaleString()} 条</span>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                ${exportable
                    ? `<button class="btn btn-sm btn-primary" onclick="exportReportingFile('${category}', '${file.code}')">导出</button>`
                    : `<button class="btn btn-sm" disabled>${file.type === 'display' ? '仅展示' : '待开发'}</button>`}
                <button class="btn btn-sm" onclick="showReportDetail('${category}', '${file.code}')">详情</button>
            </div>
        </div>
    `;
}

// 显示报表详情
function showReportDetail(category, fileCode) {
    const categoryConfig = reportingCategories[category];
    const file = findReportingFile(category, fileCode);

    if (!file) {
        showToast('报表信息不存在', true);
        return;
    }

    const isEditable = canEditReportingFile(file);
    const isExportable = canExportReportingFile(file);
    const detailReadOnlyAttr = isEditable ? '' : 'readonly';
    const applyActionHtml = isEditable
        ? `
                <button class="btn btn-primary" onclick="applyReportDetailChanges('${category}', '${fileCode}')" style="padding: 12px 35px; font-size: 15px;">
                    应用
                </button>
            `
        : `
                <div style="font-size: 13px; color: #666; line-height: 1.7;">
                    当前为系统预置报表，详情页仅支持查看。若需调整导出口径，请到映射管理中修改。
                </div>
            `;
    const exportActionHtml = isExportable
        ? `
                <button class="btn btn-primary" onclick="
                    this.closest('.modal-overlay').remove();
                    exportReportingFile('${category}', '${fileCode}');
                " style="padding: 12px 35px; font-size: 15px;">
                    立即导出此报表
                </button>
            `
        : `
                <button class="btn btn-primary" disabled style="padding: 12px 35px; font-size: 15px; opacity: 0.65; cursor: not-allowed;">
                    ${file.type === 'display' ? '仅展示报表不支持导出' : '当前报表暂不可导出'}
                </button>
            `;

    // 创建详情模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 750px; margin: 40px auto; display: flex; flex-direction: column; max-height: 90vh;">
            <!-- 头部 -->
            <div class="modal-header" style="border-bottom: 3px solid ${categoryConfig.color}; padding: 20px 25px; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 20px; color: #333;">${file.name}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="font-size: 24px;">&#10005;</button>
            </div>

            <!-- 内容区域（可滚动） -->
            <div class="modal-body" style="padding: 0; flex: 1; overflow-y: auto;">
                <!-- 基本信息区块 -->
                <div style="padding: 25px; border-bottom: 1px solid #e9ecef;">
                    <h4 style="margin: 0 0 18px 0; font-size: 16px; color: #333; display: flex; align-items: center;">
                        <span style="display: inline-block; width: 4px; height: 18px; background: ${categoryConfig.color}; margin-right: 10px; border-radius: 2px;"></span>
                        基本信息
                    </h4>

                    <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                        <!-- 报表名称 -->
                        <div style="flex: 0 0 calc(50% - 10px); min-width: 280px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 6px;">报表名称</div>
                            <input type="text" id="detail-name" value="${file.name}" ${detailReadOnlyAttr}
                                style="width: 100%; font-size: 15px; font-weight: 600; color: #333; padding: 8px 12px; background: white; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                        </div>

                        <!-- 报表代码 -->
                        <div style="flex: 0 0 calc(50% - 10px); min-width: 280px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 6px;">报表代码</div>
                            <input type="text" id="detail-code" value="${file.code}" ${detailReadOnlyAttr}
                                style="width: 100%; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; color: #d63384; padding: 8px 12px; background: white; border: 1px solid #ffc4d6; border-radius: 4px; word-break: break-all; box-sizing: border-box;">
                        </div>

                        <!-- 所属类别 -->
                        <div style="flex: 0 0 calc(50% - 10px); min-width: 280px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 6px;">所属类别</div>
                            <div style="display: inline-flex; align-items: center; font-size: 15px; font-weight: 600; color: #333; padding: 8px 12px; background: #f8f9fa; border-radius: 4px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background: ${categoryConfig.color}; border-radius: 50%; margin-right: 8px;"></span>
                                ${categoryConfig.name}
                            </div>
                        </div>

                        <!-- 标签分类 -->
                        <div style="flex: 0 0 calc(50% - 10px); min-width: 280px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 6px;">标签分类</div>
                            <input type="text" id="detail-tag" value="${file.tag || (file.isCustom ? '自定义' : '系统预置')}" ${detailReadOnlyAttr}
                                style="width: 100%; font-size: 14px; color: #333; padding: 8px 12px; background: white; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
                                placeholder="输入标签，如：自定义、测试等">
                        </div>

                        ${file.notes ? `
                        <!-- 备注 -->
                        <div style="flex: 1 1 100%; min-width: 280px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 6px;">备注</div>
                            <textarea id="detail-notes" rows="2" ${detailReadOnlyAttr}
                                style="width: 100%; font-size: 13px; color: #777; line-height: 1.5; padding: 10px 12px; background: white; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;">${file.notes}</textarea>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- 数据源信息区块 -->
                <div style="padding: 25px; border-bottom: 1px solid #e9ecef;">
                    <h4 style="margin: 0 0 18px 0; font-size: 16px; color: #333; display: flex; align-items: center;">
                        <span style="display: inline-block; width: 4px; height: 18px; background: ${categoryConfig.color}; margin-right: 10px; border-radius: 2px;"></span>
                        数据源信息
                    </h4>

                    <div style="background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">
                        <!-- 数据来源 -->
                        <div style="padding: 12px 15px; border-bottom: 1px solid #e9ecef; display: flex; align-items: center;">
                            <div style="flex: 0 0 100px; font-size: 13px; color: #666; font-weight: 500;">数据来源</div>
                            <input type="text" id="detail-dataSource" value="${file.data_source || (categoryConfig.dataSource === 'device' ? '数据概览' : '合并结果')}" ${detailReadOnlyAttr}
                                style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; background: white;">
                        </div>

                        <!-- 模板文件 -->
                        <div style="padding: 12px 15px; border-bottom: 1px solid #e9ecef; display: flex; align-items: center;">
                            <div style="flex: 0 0 100px; font-size: 13px; color: #666; font-weight: 500;">模板文件</div>
                            <div style="flex: 1; font-size: 13px; color: #495057; font-family: 'Consolas', 'Monaco', monospace; word-break: break-all; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #dee2e6;">
                                ${file.template || '未配置'}
                            </div>
                        </div>

                        <!-- 导出目录 -->
                        <div style="padding: 12px 15px; display: flex; align-items: center;">
                            <div style="flex: 0 0 100px; font-size: 13px; color: #666; font-weight: 500;">导出目录</div>
                            <div style="flex: 1; font-size: 13px; color: #495057; font-family: 'Consolas', 'Monaco', monospace; word-break: break-all; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #dee2e6;">
                                ${file.export || '未配置'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 操作按钮区（固定在底部） -->
            <div class="modal-footer" style="padding: 20px 25px; background: #f8f9fa; border-top: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 12px; max-width: 60%;">
                    ${applyActionHtml}
                </div>
                ${exportActionHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// 应用报表详情修改
async function applyReportDetailChanges(category, fileCode) {
    const name = document.getElementById('detail-name').value.trim();
    const code = document.getElementById('detail-code').value.trim();
    const dataSource = document.getElementById('detail-dataSource').value.trim();
    const notes = document.getElementById('detail-notes') ? document.getElementById('detail-notes').value.trim() : '';
    const tag = document.getElementById('detail-tag') ? document.getElementById('detail-tag').value.trim() : '';

    if (!name || !code) {
        showToast('报表名称和代码不能为空', true);
        return;
    }

    // 更新 reportingCategories 中的数据
    const categoryConfig = reportingCategories[category];
    const file = findReportingFile(category, fileCode);

    if (!file) {
        showToast('未找到要更新的报表', true);
        return;
    }

    if (!canEditReportingFile(file)) {
        showToast('系统预置报表不支持在详情页直接修改，请使用映射管理或新增自定义报表', true);
        return;
    }

    try {
        const saveResponse = await fetch(API_BASE + '/custom-reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                category: category,
                original_code: file.original_code || fileCode,
                code: code,
                name: name,
                description: file.description || '',
                records: file.records || 0,
                notes: notes,
                type: file.type || 'display',
                template: file.template || '',
                export: file.export || '',
                data_source: dataSource,
                tag: tag
            })
        });
        const result = await saveResponse.json();

        if (!saveResponse.ok || !result.success) {
            showToast(`报表保存失败：${result.error || result.message || '未知错误'}`, true);
            return;
        }

        await loadReportingData();

        const modal = document.getElementById('detail-name')?.closest('.modal-overlay');
        if (modal) {
            modal.remove();
        }

        showToast('报表信息已更新并保存', false);
    } catch (error) {
        console.error('保存报表详情失败:', error);
        showToast(`保存失败: ${error.message}`, true);
    }
}

// 显示新增报表对话框
async function showAddReportModal() {
    // 获取当前选中的类别
    const currentCategory = getActiveReportingCategory();

    // 加载模板文件列表
    let templateOptions = '<option value="">-- 请选择模板文件 --</option>';
    try {
        const response = await fetch(API_BASE + `/templates/list?category=${currentCategory}`);
        const result = await response.json();

        if (result.success && result.data) {
            templateOptions += result.data.map(template =>
                `<option value="${template.base_name}">${template.filename}</option>`
            ).join('');
        }
    } catch (e) {
        console.error('加载模板文件失败:', e);
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>新增报表</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <!-- 报表类别 -->
                    <div class="form-group">
                        <label>报表类别 *</label>
                        <select id="newReportCategory" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" onchange="onNewReportCategoryChange()">
                            <option value="yeji" ${currentCategory === 'yeji' ? 'selected' : ''}>业支上报</option>
                            <option value="smc" ${currentCategory === 'smc' ? 'selected' : ''}>SMC上报</option>
                            <option value="xinan" ${currentCategory === 'xinan' ? 'selected' : ''}>信安上报</option>
                        </select>
                    </div>

                    <!-- 报表类型 -->
                    <div class="form-group">
                        <label>报表类型 *</label>
                        <select id="reportType" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" onchange="onNewReportTypeChange()">
                            <option value="display">仅展示（列表显示用）</option>
                            <option value="mapping">完整功能（支持数据导出）</option>
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">"完整功能"需要配置映射规则以实现数据导出</small>
                    </div>

                    <div class="form-group">
                        <label>创建方式 *</label>
                        <select id="newReportCreateMode" onchange="toggleAddReportCopyControls(); refreshNewReportTemplateDiff();" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            <option value="blank">空白新建</option>
                            <option value="copy">基于已有报表复制</option>
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">复制模式会复用已有报表的映射配置；完整功能报表还可选择只继承条件规则</small>
                    </div>

                    <!-- 选择模板文件（所有模式都需要） -->
                    <div class="form-group">
                        <label>选择模板文件 *</label>
                        <select id="templateFile" onchange="refreshNewReportTemplateDiff()" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            ${templateOptions}
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">多个报表可以使用同一个模板文件</small>
                    </div>

                    <div class="form-group" id="newReportTemplateDiffPanel" style="display: none;">
                        <label>模板差异检测</label>
                        <div id="newReportTemplateDiffContent" style="padding: 12px 14px; border: 1px solid #dbeafe; border-radius: 8px; background: #f8fbff; font-size: 12px; color: #334155; line-height: 1.8;">
                            请选择来源报表和目标模板后查看差异结果。
                        </div>
                    </div>

                    <div class="form-group" id="newReportSourceReportGroup" style="display: none;">
                        <label>来源报表 *</label>
                        <select id="newReportSourceReport" onchange="refreshNewReportTemplateDiff()" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            <option value="">-- 请选择来源报表 --</option>
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">仅列出当前类别下可作为复制来源的报表</small>
                    </div>

                    <div class="form-group" id="newReportCopyModeGroup" style="display: none;">
                        <label>继承方式 *</label>
                        <select id="newReportCopyMode" onchange="refreshNewReportTemplateDiff()" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            <option value="full">复制整套映射配置</option>
                            <option value="conditions_only">只复制条件规则</option>
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">“只复制条件规则”会保留新模板生成的基础映射，仅迁移条件逻辑</small>
                    </div>

                    <!-- 数据来源 -->
                    <div class="form-group">
                        <label>数据来源 *</label>
                        <select id="newReportDataSource" onchange="togglePrimaryDataSourceField()" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            <option value="assets">数据概览</option>
                            <option value="merge_results">合并结果</option>
                            <option value="both">两者都</option>
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">“两者都”表示报表会同时依赖两边数据，但仍需要指定一个主数据源作为导出主循环</small>
                    </div>

                    <div class="form-group" id="newReportPrimaryDataSourceGroup" style="display: none;">
                        <label>主数据源 *</label>
                        <select id="newReportPrimaryDataSource" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            <option value="assets">数据概览</option>
                            <option value="merge_results">合并结果</option>
                        </select>
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">主数据源决定导出时按哪张表逐行生成结果，另一张表通过映射规则补充</small>
                    </div>

                    <!-- 报表名称 -->
                    <div class="form-group">
                        <label>报表名称 *</label>
                        <input type="text" id="newReportName" placeholder="例如：数据资产统计表" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                    </div>

                    <!-- 报表代码 -->
                    <div class="form-group">
                        <label>报表代码 *</label>
                        <input type="text" id="newReportCode" placeholder="例如：10003" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: 'Consolas', 'Monaco', monospace;">
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 4px;">建议使用数字编号，如：10003、10004</small>
                    </div>

                    <!-- 备注（可选） -->
                    <div class="form-group">
                        <label>备注</label>
                        <textarea id="newReportNotes" placeholder="其他说明信息" rows="2" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; resize: vertical;"></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn btn-primary" onclick="confirmAddReport()">确认添加</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    togglePrimaryDataSourceField();
    toggleAddReportCopyControls();
    updateSourceReportOptions();
    refreshNewReportTemplateDiff();
}

// 更新模板选项（当类别改变时）
async function updateTemplateOptions() {
    const category = document.getElementById('newReportCategory').value;
    const templateSelect = document.getElementById('templateFile');
    if (!templateSelect) return;

    try {
        const response = await fetch(API_BASE + `/templates/list?category=${category}`);
        const result = await response.json();

        if (result.success && result.data) {
            templateSelect.innerHTML = '<option value="">-- 请选择模板文件 --</option>' +
                result.data.map(template =>
                    `<option value="${template.base_name}">${template.filename}</option>`
                ).join('');
        }
    } catch (e) {
        console.error('更新模板选项失败:', e);
    }
    refreshNewReportTemplateDiff();
}

// 获取常见列的固定值
function getFixedValue(columnName) {
    const fixedValues = {
        '公司': '湖北移动',
        '所属部门': '数智化部',
        '网络': '业支网',
        '版本': '1',
        '字符集': 'UTF8',
        '归属4A': '湖北4A',
        '资产归属': '1'
    };
    return fixedValues[columnName] || '';
}

function normalizeMappingDataSource(input) {
    const normalized = String(input || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) return '';

    if (
        normalized === 'assets' ||
        normalized === 'asset' ||
        normalized.includes('数据概览') ||
        normalized === '资产' ||
        normalized === '资产表'
    ) {
        return 'assets';
    }

    if (
        normalized === 'merge_results' ||
        normalized === 'mergeresults' ||
        normalized === 'merge' ||
        normalized.includes('合并结果')
    ) {
        return 'merge_results';
    }

    if (
        normalized === 'both' ||
        normalized === 'all' ||
        normalized === 'dual' ||
        normalized === '两者都' ||
        normalized === '同时使用' ||
        normalized === '双数据源'
    ) {
        return 'both';
    }

    return '';
}

function normalizeAutoMappingColumnName(name) {
    return String(name || '')
        .replace(/\r?\n/g, '')
        .replace(/\s+/g, '')
        .replace(/^\*+/, '')
        .replace(/[（(](必填|选填|必填项|选填项|可选)[)）]/g, '')
        .trim()
        .toLowerCase();
}

function resolveAutoMappingSourceType(options = {}) {
    const dataSource = normalizeMappingDataSource(options.dataSource || options.data_source);
    const dataSourceMode = normalizeMappingDataSource(options.dataSourceMode || options.data_source_mode);
    const primaryDataSource = normalizeMappingDataSource(options.primaryDataSource || options.primary_data_source);

    if (dataSourceMode === 'both') {
        return primaryDataSource === 'merge_results'
            ? 'field_index_merge_results'
            : 'field_index_assets';
    }

    return dataSource === 'merge_results'
        ? 'field_index_merge_results'
        : 'field_index_assets';
}

// 根据模板列信息自动生成映射规则
function generateAutoMappingRules(columns, options = {}) {
    const rules = [];
    const defaultFieldSourceType = resolveAutoMappingSourceType(options);

    columns.forEach((col, index) => {
        const targetName = String(col?.name || '').trim();
        const normalizedColumnName = normalizeAutoMappingColumnName(targetName);
        const rule = {
            target_column: col.letter,
            target_name: targetName,
            source_type: '',
            source_value: '',
            transform: '',
            description: `${targetName}（${col.letter}列）`
        };

        // 第一列或显式序号列默认生成序号
        if (index === 0 || normalizedColumnName === '序号') {
            rule.source_type = 'sequence';
            rule.description = '自动生成序号';
        }
        // 固定值列
        else if (normalizedColumnName === '公司' || normalizedColumnName === '所属部门' ||
                 normalizedColumnName === '网络' || normalizedColumnName === '版本' ||
                 normalizedColumnName === '字符集' || normalizedColumnName === '归属4a' ||
                 normalizedColumnName === '资产归属') {
            rule.source_type = 'fixed';
            rule.source_value = getFixedValue(targetName);
        }
        // 其他列尝试映射到当前报表选择的数据源
        else {
            rule.source_type = defaultFieldSourceType;
            rule.source_value = String(index);
            rule.description = `从${defaultFieldSourceType === 'field_index_assets' ? '数据概览' : '合并结果'}第${index}列映射`;
        }

        rules.push(rule);
    });

    return rules;
}

function getMappingDataSourceLabel(value) {
    const normalized = normalizeMappingDataSource(value);
    if (normalized === 'assets') return '数据概览';
    if (normalized === 'merge_results') return '合并结果';
    if (normalized === 'both') return '两者都';
    return value || '';
}

function onNewReportCategoryChange() {
    updateTemplateOptions();
    updateSourceReportOptions();
    refreshNewReportTemplateDiff();
}

function onNewReportTypeChange() {
    toggleAddReportCopyControls();
    updateSourceReportOptions();
    refreshNewReportTemplateDiff();
}

function toggleAddReportCopyControls() {
    const createModeSelect = document.getElementById('newReportCreateMode');
    const reportTypeSelect = document.getElementById('reportType');
    const sourceReportGroup = document.getElementById('newReportSourceReportGroup');
    const copyModeGroup = document.getElementById('newReportCopyModeGroup');
    const copyModeSelect = document.getElementById('newReportCopyMode');

    if (!createModeSelect || !reportTypeSelect || !sourceReportGroup || !copyModeGroup || !copyModeSelect) {
        return;
    }

    const createMode = createModeSelect.value || 'blank';
    const reportType = reportTypeSelect.value || 'mapping';
    const isCopyMode = createMode === 'copy';

    sourceReportGroup.style.display = isCopyMode ? 'block' : 'none';
    copyModeGroup.style.display = isCopyMode && reportType === 'mapping' ? 'block' : 'none';

    if (reportType !== 'mapping') {
        copyModeSelect.value = 'full';
    }
}

function updateSourceReportOptions() {
    const category = document.getElementById('newReportCategory')?.value;
    const reportType = document.getElementById('reportType')?.value || 'mapping';
    const sourceReportSelect = document.getElementById('newReportSourceReport');

    if (!category || !sourceReportSelect) return;

    const files = (reportingCategories[category]?.files || []).filter(file => {
        const fileType = file.type || 'mapping';
        if (reportType === 'mapping') {
            return fileType === 'mapping' || canExportReportingFile(file);
        }
        return fileType === 'display';
    });

    sourceReportSelect.innerHTML = '<option value="">-- 请选择来源报表 --</option>' +
        files.map(file => `<option value="${file.code}">${escapeHtml(getReportingFileDisplayCode(file))} - ${escapeHtml(getReportingFileDisplayName(file))}</option>`).join('');
}

function renderNewReportTemplateDiff(diffResult) {
    const panel = document.getElementById('newReportTemplateDiffPanel');
    const content = document.getElementById('newReportTemplateDiffContent');
    if (!panel || !content) return;

    if (!diffResult) {
        panel.style.display = 'none';
        content.innerHTML = '请选择来源报表和目标模板后查看差异结果。';
        return;
    }

    const removedCount = Number(diffResult.removed_columns?.length || 0);
    const addedCount = Number(diffResult.added_columns?.length || 0);
    const invalidMappingCount = Number(diffResult.invalid_mapping_rules?.length || 0);
    const invalidConditionalCount = Number(diffResult.invalid_conditional_rules?.length || 0);
    const similarColumns = diffResult.similar_columns || [];

    const listHtml = (items, fieldName) => {
        if (!items || items.length === 0) return '<span style="color: #64748b;">无</span>';
        return items.map(item => `<span style="display: inline-block; margin: 2px 6px 2px 0; padding: 2px 8px; border-radius: 999px; background: #eff6ff; color: #1d4ed8;">${item[fieldName]}</span>`).join('');
    };

    panel.style.display = 'block';
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px;">
            <div style="padding: 8px 10px; background: #f8fafc; border-radius: 6px;"><strong>${Number(diffResult.unchanged_columns?.length || 0)}</strong> 列一致</div>
            <div style="padding: 8px 10px; background: #ecfeff; border-radius: 6px;"><strong>${addedCount}</strong> 列新增</div>
            <div style="padding: 8px 10px; background: #fff7ed; border-radius: 6px;"><strong>${removedCount}</strong> 列删除</div>
            <div style="padding: 8px 10px; background: #fef2f2; border-radius: 6px;"><strong>${invalidConditionalCount}</strong> 条条件规则失效</div>
        </div>
        <div><strong>新增列：</strong>${listHtml(diffResult.added_columns, 'name')}</div>
        <div style="margin-top: 6px;"><strong>删除列：</strong>${listHtml(diffResult.removed_columns, 'name')}</div>
        <div style="margin-top: 6px;"><strong>失效映射：</strong>${invalidMappingCount ? listHtml(diffResult.invalid_mapping_rules, 'target_name') : '<span style="color: #166534;">无</span>'}</div>
        <div style="margin-top: 6px;"><strong>失效条件规则：</strong>${invalidConditionalCount ? listHtml(diffResult.invalid_conditional_rules, 'target_name') : '<span style="color: #166534;">无</span>'}</div>
        <div style="margin-top: 6px;"><strong>相似列建议：</strong>${similarColumns.length ? similarColumns.map(item => `<span style="display: inline-block; margin: 2px 6px 2px 0; padding: 2px 8px; border-radius: 999px; background: #f5f3ff; color: #6d28d9;">${item.source_name} → ${item.target_name}</span>`).join('') : '<span style="color: #64748b;">无</span>'}</div>
    `;
}

async function refreshNewReportTemplateDiff() {
    const createMode = document.getElementById('newReportCreateMode')?.value || 'blank';
    const reportType = document.getElementById('reportType')?.value || 'mapping';
    const category = document.getElementById('newReportCategory')?.value || '';
    const sourceReportCode = document.getElementById('newReportSourceReport')?.value || '';
    const templateFile = document.getElementById('templateFile')?.value || '';

    if (createMode !== 'copy' || reportType !== 'mapping' || !category || !sourceReportCode || !templateFile) {
        renderNewReportTemplateDiff(null);
        return;
    }

    try {
        const response = await fetch(API_BASE + '/mapping-config/template-diff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_category: category,
                source_code: sourceReportCode,
                template_base_name: templateFile
            })
        });
        const result = await response.json();
        if (response.ok && result.success && result.data) {
            renderNewReportTemplateDiff(result.data);
        } else {
            renderNewReportTemplateDiff({
                unchanged_columns: [],
                added_columns: [],
                removed_columns: [],
                similar_columns: [],
                invalid_mapping_rules: [],
                invalid_conditional_rules: []
            });
            const panel = document.getElementById('newReportTemplateDiffPanel');
            const content = document.getElementById('newReportTemplateDiffContent');
            if (panel && content) {
                panel.style.display = 'block';
                content.innerHTML = `<span style="color: #b91c1c;">模板差异检测失败：${result.error || '未知错误'}</span>`;
            }
        }
    } catch (e) {
        const panel = document.getElementById('newReportTemplateDiffPanel');
        const content = document.getElementById('newReportTemplateDiffContent');
        if (panel && content) {
            panel.style.display = 'block';
            content.innerHTML = `<span style="color: #b91c1c;">模板差异检测失败：${e.message}</span>`;
        }
    }
}

function togglePrimaryDataSourceField() {
    const dataSourceSelect = document.getElementById('newReportDataSource');
    const primaryGroup = document.getElementById('newReportPrimaryDataSourceGroup');
    if (!dataSourceSelect || !primaryGroup) return;

    primaryGroup.style.display = dataSourceSelect.value === 'both' ? 'block' : 'none';
}

// 确认添加新报表
async function confirmAddReport() {
    const category = document.getElementById('newReportCategory').value;
    const name = document.getElementById('newReportName').value.trim();
    const code = document.getElementById('newReportCode').value.trim();
    const notes = document.getElementById('newReportNotes').value.trim();
    const reportType = document.getElementById('reportType').value;
    const createMode = document.getElementById('newReportCreateMode')?.value || 'blank';
    const sourceReportCode = document.getElementById('newReportSourceReport')?.value || '';
    const selectedCopyMode = document.getElementById('newReportCopyMode')?.value || 'full';
    const templateFile = document.getElementById('templateFile').value;
    const dataSource = document.getElementById('newReportDataSource').value.trim();
    const primaryDataSource = document.getElementById('newReportPrimaryDataSource')?.value.trim() || '';
    const normalizedMappingDataSource = reportType === 'mapping' ? normalizeMappingDataSource(dataSource) : '';
    const normalizedPrimaryDataSource = reportType === 'mapping' && normalizedMappingDataSource === 'both'
        ? normalizeMappingDataSource(primaryDataSource)
        : normalizedMappingDataSource;
    const effectiveMappingDataSource = normalizedPrimaryDataSource;
    const copyMode = reportType === 'mapping' ? selectedCopyMode : 'full';
    const displayDataSource = normalizedMappingDataSource === 'both'
        ? `两者都（主：${getMappingDataSourceLabel(normalizedPrimaryDataSource)}）`
        : getMappingDataSourceLabel(normalizedMappingDataSource || dataSource);

    // 验证必填项
    if (!name || !code) {
        showToast('报表名称和代码不能为空', true);
        return;
    }

    // 必须选择模板文件
    if (!templateFile) {
        showToast('请选择一个模板文件', true);
        return;
    }

    // 验证数据来源
    if (!dataSource) {
        showToast('请填写数据来源', true);
        return;
    }

    if (createMode === 'copy' && !sourceReportCode) {
        showToast('请选择来源报表', true);
        return;
    }

    if (reportType === 'mapping' && !effectiveMappingDataSource) {
        showToast('完整功能报表的数据来源仅支持“数据概览”“合并结果”或“两者都+主数据源”', true);
        return;
    }

    // 检查代码是否已存在
    const categoryConfig = reportingCategories[category];
    const existingFile = categoryConfig.files.find(f => f.code === code);
    if (existingFile) {
        showToast('该报表代码已存在，请使用其他代码', true);
        return;
    }

    // 创建新报表对象
    const newFile = {
        code: code,
        name: name,
        data_source: displayDataSource,
        template: null,  // 默认为null
        export: null,  // 默认为null
        notes: notes,
        status: createMode === 'copy' ? 'pending' : 'completed',
        type: reportType,
        isCustom: true  // 标记为用户自定义
    };

    // 只有"实现映射"类型才设置template和export
    if (reportType === 'mapping' && templateFile) {
        newFile.template = `Templates/${category === 'yeji' ? '业支上报' : category === 'smc' ? 'SMC上报' : '信安上报'}/${templateFile}_template.xlsx`;
        newFile.export = `SGExportFiles/${category === 'yeji' ? 'YeZhi' : category === 'smc' ? 'SMC' : 'XinAn'}/`;
    }

    try {
        let mappingConfig = null;
        if (reportType === 'mapping') {
            showToast('正在分析模板文件...', false);

            const analyzeResponse = await fetch(API_BASE + '/mapping-config/analyze-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_base_name: templateFile
                })
            });

            const analyzeResult = await analyzeResponse.json();

            if (!analyzeResult.success) {
                showToast('分析模板文件失败: ' + analyzeResult.error, true);
                return;
            }

            const templateInfo = analyzeResult.data;
            const autoMappingRules = generateAutoMappingRules(templateInfo.columns, {
                dataSource: effectiveMappingDataSource,
                dataSourceMode: normalizedMappingDataSource,
                primaryDataSource: normalizedPrimaryDataSource
            });

            mappingConfig = {
                name: name,
                category: category,
                data_source: effectiveMappingDataSource,
                data_source_mode: normalizedMappingDataSource,
                primary_data_source: normalizedMappingDataSource === 'both' ? normalizedPrimaryDataSource : '',
                template_file: templateInfo.template_file,
                mapping_rules: autoMappingRules,
                data_start_row: Number(templateInfo.data_start_row) || 5
            };
        }

        if (createMode === 'copy') {
            const copyResponse = await fetch(API_BASE + '/custom-reports/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_category: category,
                    source_code: sourceReportCode,
                    target_category: category,
                    target_code: code,
                    target_name: name,
                    copy_mode: copyMode,
                    target_report_payload: {
                        notes: notes,
                        status: 'pending',
                        type: reportType,
                        template: newFile.template,
                        export: newFile.export,
                        data_source: displayDataSource
                    },
                    target_mapping_config: mappingConfig
                })
            });

            const copyResult = await copyResponse.json();
            if (!copyResponse.ok || !copyResult.success) {
                showToast(copyResult.error || '复制报表失败', true);
                return;
            }

            const savedReport = copyResult.data || {};
            categoryConfig.files.push({
                ...newFile,
                ...savedReport,
                isCustom: true
            });

            showToast(
                copyMode === 'conditions_only'
                    ? '报表已添加，基础映射已生成，并继承了来源报表的条件规则'
                    : '报表已添加，并继承了来源报表的映射配置',
                false
            );
        } else {
            const saveResponse = await fetch(API_BASE + '/custom-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: category,
                    code: code,
                    name: name,
                    data_source: displayDataSource,
                    notes: notes,
                    type: reportType,
                    template: newFile.template,
                    export: newFile.export
                })
            });

            if (!saveResponse.ok) {
                showToast('保存报表失败', true);
                return;
            }

            categoryConfig.files.push(newFile);

            if (reportType === 'mapping' && mappingConfig) {
                const mappingResponse = await fetch(API_BASE + `/mapping-config/${category}/${code}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappingConfig)
                });

                if (mappingResponse.ok) {
                    showToast(`报表已添加，已自动生成${mappingConfig.mapping_rules.length}条映射规则`, false);
                } else {
                    showToast('报表已添加，但映射配置创建失败', true);
                }
            } else {
                showToast('报表已添加', false);
            }
        }
    } catch (e) {
        console.error('保存报表失败:', e);
        showToast('保存报表时发生错误', true);
        return;
    }

    // 关闭对话框
    document.querySelector('.modal-overlay').remove();

    // 重新渲染报表列表
    renderReportsByCategory(category);

    // 如果当前显示的不是新添加报表的类别，切换到该类别
    const currentCategory = getActiveReportingCategory();
    if (currentCategory !== category) {
        document.getElementById(`reportCategory-${category}`).click();
    }
}

// 渲染所有报表列表
function renderAllReports() {
    // 默认显示业支类别的报表
    setActiveReportingCategory('yeji');
    renderReportsByCategory('yeji');
}

function normalizeExportFileCode(category, fileCode) {
    const code = String(fileCode || '').trim();
    if (!code) return '';

    if (category === 'yeji') {
        return code.replace(/^i_10600_/, '');
    }

    if (category === 'smc') {
        if (code === '附件三' || code === 'attachment_3') return 'attachment_3';
        if (code === '附件五' || code === 'attachment_5') return 'attachment_5';
        return code;
    }

    if (category === 'xinan') {
        if (code === 'i_10600_00000') return '00000';
        if (code === 'i_10600_10001' || code.startsWith('10001-')) return '10001';
        return code;
    }

    return code;
}

async function exportDynamicReportingFile(category, file) {
    const fileCode = file?.code || '';
    const fileName = getReportingFileDisplayName(file) || fileCode;

    if (!fileCode) {
        showToast('报表代码不存在，无法导出', true);
        return;
    }

    return runCancelableExport(
        `${API_BASE}/export/reports/${encodeURIComponent(category)}/${encodeURIComponent(fileCode)}`,
        `确认导出报表“${fileName}”(${fileCode})？\n\n导出期间请勿关闭浏览器！`
    );
}

// 导出报表文件
async function exportReportingFile(category, fileCode) {
    const file = findReportingFile(category, fileCode);
    if (!file) {
        showToast(`未找到报表：${category}/${fileCode}`, true);
        return;
    }

    if (!canExportReportingFile(file)) {
        showToast(file.type === 'display' ? '仅展示报表不支持导出' : '该报表暂不可导出', true);
        return;
    }

    let exportFunction = null;
    const normalizedCode = normalizeExportFileCode(category, fileCode);

    // 根据分类和代码确定导出函数
    if (category === 'yeji' && normalizedCode === '10001') {
        exportFunction = exportYejiI106001;
    } else if (category === 'yeji' && normalizedCode === '10002') {
        exportFunction = exportYejiI106002;
    } else if (category === 'yeji' && normalizedCode === '10004') {
        exportFunction = exportYejiI106004;
    } else if (category === 'xinan' && normalizedCode === '00000') {
        exportFunction = exportXinanI1060000;
    } else if (category === 'xinan' && normalizedCode === '10001') {
        exportFunction = exportXinanI1060100;
    } else if (category === 'smc' && normalizedCode === 'attachment_3') {
        exportFunction = exportSmcAttachment3;
    } else if (category === 'smc' && normalizedCode === 'attachment_5') {
        exportFunction = exportSmcAttachment5;
    } else if (normalizedCode === 'smc_assets') {
        exportFunction = () => showToast('SMC报表功能开发中...', true);
    } else {
        await exportDynamicReportingFile(category, file);
        return;
    }

    // 直接调用对应的导出函数（不再二次确认）
    if (exportFunction) {
        await exportFunction();
    }
}

// 删除报表（二次确认）
async function deleteReportWithConfirm(category, fileCode, fileName) {
    // 第一次确认
    const confirm1 = confirm(
        `确认要删除报表"${fileName}"吗？\n\n` +
        `此操作将同步影响映射管理，请谨慎操作！`
    );

    if (!confirm1) {
        return;
    }

    // 第二次确认
    const confirm2 = confirm(
        `再次确认：真的要删除报表"${fileName}"吗？\n\n` +
        `删除后：\n` +
        `• 将删除已导出的Excel文件\n` +
        `• 将清除该报表的映射配置\n` +
        `• 删除后无法恢复！`
    );

    if (!confirm2) {
        return;
    }

    // 执行删除
    await deleteReport(category, fileCode, fileName);
}

// 调用后端API删除报表
async function deleteReport(category, fileCode, fileName) {
    try {
        showToast('正在删除报表...', false);

        const response = await fetch(`${API_BASE}/custom-reports/${category}/${fileCode}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            let message = `报表"${fileName}"已成功删除`;
            if (result.mapping_deleted) {
                message += '，并删除了映射配置';
            }
            if (result.protected_system_report) {
                message += '；系统预置报表的映射和导出文件已保留';
            }
            showToast(message, false);

            // 刷新报表列表
            await loadReportingData();
        } else {
            showToast(`删除失败：${result.message || result.error || '未知错误'}`, true);
        }
    } catch (error) {
        console.error('删除报表失败:', error);
        showToast('删除报表时发生错误，请查看控制台', true);
    }
}

// ==================== 映射管理 ====================

// 代码映射表（中文 -> 英文）
const reportCodeMapping = {
    '附件三': 'attachment_3',
    '附件五': 'attachment_5'
};

let currentMappingCategory = 'yeji';  // 默认业支
let currentMappingReportCode = '';
let currentMappingApiReportCode = '';
let currentMappingConfig = null;
let mappingTableDirty = false;
let mappingSelectionRequestSeq = 0;
let activeMappingSelectionRequestId = 0;
let allMappingConfigs = {};  // 存储所有映射配置
let publicMappingConfigs = [];
let publicMappingConfigMap = {};
let dataSourceColumns = {
    assets: [],
    merge_results: []
};  // 缓存数据源列名

// 切换映射管理类别（展开/收起）
function toggleMappingCategory(category) {
    const container = document.getElementById(`mappingReports-${category}`);
    const isVisible = container.style.display === 'flex';

    // 收起所有分类
    ['public', 'yeji', 'smc', 'xinan'].forEach(cat => {
        const catContainer = document.getElementById(`mappingReports-${cat}`);

        if (catContainer) catContainer.style.display = 'none';
    });
    setActiveMappingCategory(category, false);

    // 如果当前分类是收起的，则展开
    if (!isVisible) {
        container.style.display = 'flex';
        setActiveMappingCategory(category, true);
    }

    // 清空所有报表的选中状态
    document.querySelectorAll('.mapping-report-item').forEach(item => {
        item.style.background = 'white';
        item.style.border = '1px solid #e9ecef';
        item.style.boxShadow = 'none';
    });

    // 清空配置显示
    currentMappingReportCode = '';
    currentMappingApiReportCode = '';
    currentMappingConfig = null;
    const configContent = document.getElementById('mappingConfigContent');
    configContent.innerHTML = `
        <div class="mapping-empty-state mapping-empty-state--center">
            <span class="mapping-empty-state__badge">映射配置</span>
            <div class="mapping-empty-state__title">请从左侧选择分类，然后选择报表查看映射配置</div>
            <div class="mapping-empty-state__desc">目录切换后会清空当前选中项，避免误改其他报表。</div>
        </div>
    `;
    updateMappingOverview(category);
}

// 切换填报数据选项卡
function switchReportingTab(tab, button) {
    // 隐藏所有选项卡内容
    document.getElementById('reporting-tab-reports').style.display = 'none';
    document.getElementById('reporting-tab-mapping').style.display = 'none';
    document.getElementById('reporting-tab-logic-rules').style.display = 'none';

    // 移除所有按钮的active状态
    const buttons = button.parentElement.querySelectorAll('.tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));

    // 显示选中的选项卡
    document.getElementById('reporting-tab-' + tab).style.display = 'block';
    button.classList.add('active');

    // 控制新增按钮显示
    const addBtnContainer = document.getElementById('addReportButtonContainer');
    if (tab === 'reports') {
        addBtnContainer.style.display = 'flex';
    } else {
        addBtnContainer.style.display = 'none';
    }

    // 如果切换到映射管理，先同步报表配置，再初始化相关数据
    if (tab === 'mapping') {
        if (typeof loadReportingData === 'function') {
            Promise.resolve(loadReportingData())
                .catch(error => {
                    console.error('切换映射管理时加载报表配置失败:', error);
                })
                .finally(() => {
                    updateMappingOverview(currentMappingCategory);
                    loadMappingReportSelect();
                });
        } else {
            updateMappingOverview(currentMappingCategory);
            loadMappingReportSelect();
        }
    }

    // 如果切换到条件规则管理，初始化相关数据
    if (tab === 'logic-rules') {
        updateLogicOverview('rules');
        loadLogicRulesList();
    }
}

function switchToLogicRulesTab() {
    return loadLogicRulesList();
}

// 切换报表类别（业支/SMC/信安）
function switchReportCategory(category, button) {
    setActiveReportingCategory(category);

    // 渲染该类别的报表
    renderReportsByCategory(category);
}

// 按类别渲染报表列表
function renderReportsByCategory(category) {
    const container = document.getElementById('reportsContainer');
    const files = reportingCategories[category]?.files || [];
    updateReportingOverview(category, files);

    if (!files || files.length === 0) {
        container.innerHTML = `
            <div class="reporting-empty-state">
                <span class="reporting-empty-state__badge">暂无数据</span>
                <div class="reporting-empty-state__title">当前分类下还没有可导出的报表</div>
                <div class="reporting-empty-state__desc">可先新增报表，或切换到其他分类查看已有配置。</div>
            </div>
        `;
        return;
    }

    // 按代码排序
    const sortedFiles = [...files].sort((a, b) => {
        const codeA = parseInt(a.code) || 0;
        const codeB = parseInt(b.code) || 0;
        return codeA - codeB;
    });

    // 渲染报表卡片
    container.innerHTML = sortedFiles.map(file => {
        const isCompleted = file.status === 'completed';
        const isCustom = file.isCustom === true;
        const supportsTrialExport = file.type === 'mapping' && !isCompleted;
        const displayName = getReportingFileDisplayName(file);
        const displayCode = getReportingFileDisplayCode(file);
        const categoryColor = category === 'yeji' ? '#005fe0' :
                           category === 'smc' ? '#28a745' : '#dc3545';

        // 构建分类标签（显示自定义标签或默认"自定义"）
        let categoryTags = '';
        const displayTag = file.tag || (isCustom ? '自定义' : '');
        if (displayTag) {
            categoryTags += `<span class="report-tag">${displayTag}</span>`;
        }

        return `
            <div class="report-item-card" style="--report-accent: ${categoryColor};">
                <div class="report-item-card__content">
                    <div class="report-item-card__meta">
                        <div class="report-item-card__code">${displayCode}</div>
                        <div class="report-item-card__name">${displayName}</div>
                        ${file.notes ? `<div class="report-item-card__notes">${file.notes}</div>` : ''}
                    </div>
                </div>
                <div class="report-item-card__actions">
                    ${categoryTags}
                    ${isCompleted && file.type !== 'display' ? `
                        <button class="report-card-btn report-card-btn--ghost" onclick="showReportDetail('${category}', '${file.code}')">详情</button>
                        <button class="report-card-btn report-card-btn--accent" onclick="exportReportingFile('${category}', '${file.code}')">导出</button>
                        ${isCustom ? `<button class="report-card-btn report-card-btn--danger" onclick="deleteReportWithConfirm('${category}', '${file.code}', '${escapeHtml(displayName)}')" title="删除此报表（将同步影响映射管理）">删除</button>` : ''}
                    ` : isCompleted ? `
                        <button class="report-card-btn report-card-btn--ghost" onclick="showReportDetail('${category}', '${file.code}')">详情</button>
                        <button class="report-card-btn report-card-btn--disabled" disabled>仅展示</button>
                        ${isCustom ? `<button class="report-card-btn report-card-btn--danger" onclick="deleteReportWithConfirm('${category}', '${file.code}', '${escapeHtml(displayName)}')" title="删除此报表">删除</button>` : ''}
                    ` : supportsTrialExport ? `
                        <button class="report-card-btn report-card-btn--ghost" onclick="showReportDetail('${category}', '${file.code}')">详情</button>
                        <button class="report-card-btn report-card-btn--accent" onclick="openTrialExportModal('${category}', '${file.code}')">试运行导出</button>
                        ${isCustom ? `<button class="report-card-btn report-card-btn--danger" onclick="deleteReportWithConfirm('${category}', '${file.code}', '${escapeHtml(displayName)}')" title="删除此报表（将同步影响映射管理）">删除</button>` : ''}
                    ` : `
                        <button class="report-card-btn report-card-btn--disabled" disabled>待开发</button>
                    `}
                </div>
            </div>
        `;
    }).join('');

}

// ==================== logic rule bulk apply ====================

async function fetchApplyAllLogicRulesPreview() {
    const response = await fetch(API_BASE + '/logic-rules/apply-all/preview');
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || '\u83b7\u53d6\u5168\u5c40\u5e94\u7528\u9884\u89c8\u5931\u8d25');
    }
    return result.data || {
        rule_count: 0,
        report_count: 0,
        target_count: 0,
        targets: []
    };
}

function closeApplyAllLogicRulesModal() {
    const modal = document.getElementById('applyAllLogicRulesModal');
    if (modal) {
        modal.remove();
    }
}

function handleApplyAllLogicRulesOverlayClick(event) {
    if (event.target?.id === 'applyAllLogicRulesModal') {
        closeApplyAllLogicRulesModal();
    }
}

function openApplyAllLogicRulesModal(previewData = {}) {
    closeApplyAllLogicRulesModal();
    const targets = Array.isArray(previewData.targets) ? previewData.targets : [];
    const previewHtml = targets.length > 0
        ? targets.slice(0, 20).map(item => `
            <div style="padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff;">
                <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${escapeHtml(item.logic_rule_name || item.logic_rule_id || '-')}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${escapeHtml(`${item.category}/${item.report_code} \u5217 ${item.target_column || '-'} ${item.target_name || ''}`)}</div>
            </div>
        `).join('')
        : '<div style="padding: 16px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 10px;">\u5f53\u524d\u6ca1\u6709\u4efb\u4f55\u5df2\u5efa\u7acb\u5f15\u7528\u5173\u7cfb\u7684\u89c4\u5219</div>';

    const modalHtml = `
        <div class="modal-overlay show" id="applyAllLogicRulesModal" onclick="handleApplyAllLogicRulesOverlayClick(event)" style="z-index: 10031;">
            <div class="modal-content" style="width: min(760px, 92vw); max-width: 760px; max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                <div class="modal-header" style="padding: 18px 24px; border-bottom: none; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: #fff;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">\u5168\u5c40\u5e94\u7528</h3>
                        <div style="font-size: 12px; margin-top: 6px; opacity: 0.92;">\u5c06\u89c4\u5219\u5e93\u4e2d\u7684\u6700\u65b0\u5185\u5bb9\u540c\u6b65\u5230\u6240\u6709\u5df2\u5efa\u7acb\u5f15\u7528\u5173\u7cfb\u7684\u62a5\u8868\u5217</div>
                    </div>
                    <button class="modal-close" type="button" onclick="closeApplyAllLogicRulesModal()" style="color: #fff; background: rgba(255,255,255,0.16);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 24px; display: grid; gap: 16px;">
                    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
                        <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px;">
                            <div style="font-size: 12px; color: #64748b;">\u89c4\u5219\u6570</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1f2937;">${Number(previewData.rule_count || 0)}</div>
                        </div>
                        <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px;">
                            <div style="font-size: 12px; color: #64748b;">\u62a5\u8868\u6570</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1f2937;">${Number(previewData.report_count || 0)}</div>
                        </div>
                        <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px;">
                            <div style="font-size: 12px; color: #64748b;">\u76ee\u6807\u5217\u6570</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1f2937;">${Number(previewData.target_count || 0)}</div>
                        </div>
                    </div>
                    <div style="display: grid; gap: 10px; max-height: 320px; overflow-y: auto;">
                        ${previewHtml}
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: flex-end; gap: 10px;">
                    <button class="btn" type="button" onclick="closeApplyAllLogicRulesModal()">\u53d6\u6d88</button>
                    <button class="btn" type="button" onclick="submitApplyAllLogicRules()" style="background: #0f766e; color: white; border: none;">\u786e\u8ba4\u5e94\u7528</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitApplyAllLogicRules() {
    try {
        const response = await fetch(API_BASE + '/logic-rules/apply-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '\u5168\u5c40\u5e94\u7528\u5931\u8d25');
        }

        closeApplyAllLogicRulesModal();
        showToast(`\u5df2\u540c\u6b65 ${result.data?.applied_count || 0} \u4e2a\u62a5\u8868\u5217`, false);
        await loadLogicRulesList();
        if (currentMappingCategory && currentMappingReportCode) {
            await selectMappingReport(currentMappingCategory, currentMappingReportCode, { force: true });
        }
    } catch (error) {
        console.error('Global logic rule apply failed:', error);
        showToast(`\u5168\u5c40\u5e94\u7528\u5931\u8d25\uff1a${error.message}`, true);
    }
}

async function applyAllLogicRulesToReports() {
    try {
        const previewData = await fetchApplyAllLogicRulesPreview();
        if (!Number(previewData.target_count || 0)) {
            showToast('\u5f53\u524d\u6ca1\u6709\u4efb\u4f55\u5df2\u5efa\u7acb\u5f15\u7528\u5173\u7cfb\u7684\u89c4\u5219\u53ef\u5e94\u7528', true);
            return;
        }
        openApplyAllLogicRulesModal(previewData);
    } catch (error) {
        console.error('Failed to load apply-all preview:', error);
        showToast(`\u83b7\u53d6\u5e94\u7528\u9884\u89c8\u5931\u8d25\uff1a${error.message}`, true);
    }
}

function buildMappingRuleSourceBadge(rule) {
    const logicRuleId = String(rule?.logic_rule_id || '').trim();
    const logicRuleName = String(rule?.logic_rule_name || '').trim();
    if (!logicRuleId) {
        return '';
    }

    const badgeLabel = logicRuleName || logicRuleId;
    return `
        <div style="margin-top: 6px;">
            <button type="button" onclick="openLinkedLogicRule('${escapeHtml(logicRuleId)}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; background: #ecfdf3; color: #166534; border: 1px solid #bbf7d0; border-radius: 999px; font-size: 11px; line-height: 1.4; cursor: pointer;">
                <span>\u89c4\u5219\u6765\u6e90</span>
                <span>${escapeHtml(badgeLabel)}</span>
            </button>
        </div>
    `;
}

async function openLinkedLogicRule(ruleId) {
    const normalizedRuleId = String(ruleId || '').trim();
    if (!normalizedRuleId) {
        showToast('\u672a\u627e\u5230\u5173\u8054\u89c4\u5219', true);
        return;
    }

    try {
        const reportingNavItem = Array.from(document.querySelectorAll('.sidebar .nav-item'))
            .find(item => item.textContent && item.textContent.includes('\u586b\u62a5\u6570\u636e'));
        if (reportingNavItem && typeof switchPage === 'function') {
            switchPage('reporting', reportingNavItem);
        }

        if (typeof switchReportingTab === 'function') {
            const logicTabButton = document.querySelector('#page-reporting .tab-button[onclick*="logic-rules"]');
            if (logicTabButton) {
                switchReportingTab('logic-rules', logicTabButton);
            }
        }

        if (typeof switchLogicTab === 'function') {
            const rulesButton = document.querySelector('.logic-tab-button[onclick*="rules"]');
            if (rulesButton) {
                switchLogicTab('rules', rulesButton);
            }
        }

        if (!Array.isArray(allLogicRules) || allLogicRules.length === 0) {
            await loadLogicRulesList();
        }

        await showLogicRuleEditor(normalizedRuleId);
    } catch (error) {
        console.error('Open linked logic rule failed:', error);
        showToast(`\u6253\u5f00\u5173\u8054\u89c4\u5219\u5931\u8d25\uff1a${error.message}`, true);
    }
}

async function fetchLogicRuleUsages(ruleId) {
    const response = await fetch(API_BASE + `/logic-rules/${encodeURIComponent(ruleId)}/usages`);
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || '\u83b7\u53d6\u89c4\u5219\u5f15\u7528\u5931\u8d25');
    }
    return result.data || { usages: [], usage_count: 0 };
}
async function fetchLogicRuleUsageDetail(ruleId) {
    const response = await fetch(API_BASE + `/logic-rules/${encodeURIComponent(ruleId)}/usage-detail`);
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || '\u83b7\u53d6\u89c4\u5219\u8be6\u60c5\u5931\u8d25');
    }
    return result.data || {
        explicit_usages: [],
        explicit_count: 0,
        inferred_usages: [],
        inferred_count: 0
    };
}

function closeLogicRuleUsageDetailModal() {
    const modal = document.getElementById('logicRuleUsageDetailModal');
    if (modal) {
        modal.remove();
    }
}

function handleLogicRuleUsageDetailOverlayClick(event) {
    if (event.target?.id === 'logicRuleUsageDetailModal') {
        closeLogicRuleUsageDetailModal();
    }
}

function renderLogicRuleUsageDetailList(items, emptyText) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        return `<div style="padding: 14px 16px; background: #f8fafc; border-radius: 10px; color: #64748b; font-size: 13px;">${escapeHtml(emptyText)}</div>`;
    }

    return list.map(item => `
        <div style="padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff;">
            <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${escapeHtml(item.report_name || item.report_code || '-')}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${escapeHtml(`${item.category}/${item.report_code} \u5217 ${item.target_column || '-'} ${item.target_name || ''}`)}</div>
        </div>
    `).join('');
}

function openLogicRuleUsageDetailModal(rule, detailData) {
    closeLogicRuleUsageDetailModal();
    const explicitUsages = Array.isArray(detailData?.explicit_usages) ? detailData.explicit_usages : [];
    const inferredUsages = Array.isArray(detailData?.inferred_usages) ? detailData.inferred_usages : [];
    const hasExplicit = explicitUsages.length > 0;
    const explicitTitle = hasExplicit ? '\u5df2\u5efa\u7acb\u5f15\u7528' : '\u663e\u5f0f\u5f15\u7528';
    const explicitEmptyText = '\u5f53\u524d\u6ca1\u6709\u5df2\u5efa\u7acb\u5f15\u7528\u5173\u7cfb\u7684\u62a5\u8868\u5217\u3002';
    const inferredTitle = hasExplicit ? '\u8f85\u52a9\u5339\u914d' : '\u7ed3\u6784\u5339\u914d';
    const inferredEmptyText = hasExplicit
        ? '\u5f53\u524d\u6ca1\u6709\u989d\u5916\u7684\u8f85\u52a9\u5339\u914d\u9879\u3002'
        : '\u5f53\u524d\u6ca1\u6709\u5339\u914d\u5230\u76f8\u540c\u7ed3\u6784\u7684\u62a5\u8868\u5217\u3002';
    const summaryText = hasExplicit
        ? '\u4ee5\u4e0b\u7ed3\u679c\u4ee5\u5df2\u5efa\u7acb\u7684\u6b63\u5f0f\u5f15\u7528\u5173\u7cfb\u4e3a\u51c6\u3002\u8f85\u52a9\u5339\u914d\u4ec5\u7528\u4e8e\u8865\u5145\u4eba\u5de5\u6392\u67e5\uff0c\u4e0d\u4f5c\u4e3a\u6267\u884c\u4f9d\u636e\u3002'
        : '\u5f53\u524d\u8fd8\u6ca1\u6709\u6b63\u5f0f\u5f15\u7528\u5173\u7cfb\u3002\u4e0b\u65b9\u7ed3\u6784\u5339\u914d\u7ed3\u679c\u4ec5\u7528\u4e8e\u8f85\u52a9\u6392\u67e5\uff0c\u4e0d\u4ee3\u8868\u5df2\u5efa\u7acb\u8054\u901a\u3002';

    const modalHtml = `
        <div class="modal-overlay show" id="logicRuleUsageDetailModal" onclick="handleLogicRuleUsageDetailOverlayClick(event)" style="z-index: 10032;">
            <div class="modal-content" style="width: min(760px, 92vw); max-width: 760px; max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                <div class="modal-header" style="padding: 18px 24px; border-bottom: none; background: linear-gradient(135deg, #334155 0%, #475569 100%); color: #fff;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">\u89c4\u5219\u8be6\u60c5</h3>
                        <div style="font-size: 12px; margin-top: 6px; opacity: 0.92;">${escapeHtml(rule?.name || rule?.id || '')}</div>
                    </div>
                    <button class="modal-close" type="button" onclick="closeLogicRuleUsageDetailModal()" style="color: #fff; background: rgba(255,255,255,0.16);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 24px; display: grid; gap: 16px;">
                    <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px; color: #334155; font-size: 13px; line-height: 1.8;">
                        ${summaryText}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
                        <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px;">
                            <div style="font-size: 12px; color: #64748b;">${explicitTitle}</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1f2937;">${Number(detailData?.explicit_count || 0)}</div>
                        </div>
                        <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px;">
                            <div style="font-size: 12px; color: #64748b;">${inferredTitle}</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1f2937;">${Number(detailData?.inferred_count || 0)}</div>
                        </div>
                    </div>
                    <div style="display: grid; gap: 12px;">
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">${explicitTitle}</div>
                            <div style="display: grid; gap: 10px; max-height: 220px; overflow-y: auto;">
                                ${renderLogicRuleUsageDetailList(explicitUsages, explicitEmptyText)}
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">${inferredTitle}</div>
                            <div style="display: grid; gap: 10px; max-height: 220px; overflow-y: auto;">
                                ${renderLogicRuleUsageDetailList(inferredUsages, inferredEmptyText)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: flex-end;">
                    <button class="btn" type="button" onclick="closeLogicRuleUsageDetailModal()">\u5173\u95ed</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function showLogicRuleUsageDetail(ruleId) {
    try {
        const rule = allLogicRules.find(item => item.id === ruleId) || { id: ruleId };
        const detailData = await fetchLogicRuleUsageDetail(ruleId);
        openLogicRuleUsageDetailModal(rule, detailData);
    } catch (error) {
        console.error('Failed to load logic rule usage detail:', error);
        showToast(`\u52a0\u8f7d\u89c4\u5219\u8be6\u60c5\u5931\u8d25\uff1a${error.message}`, true);
    }
}

async function loadLogicRulesList() {
    try {
        const res = await fetch(API_BASE + '/logic-rules');
        const result = await res.json();

        if (result.success && result.data) {
            allLogicRules = result.data.rules || [];
            logicRuleTypesReference = result.data.rule_types_reference || {};
            renderLogicRulesList(allLogicRules);
        } else {
            showToast('\u52a0\u8f7d\u89c4\u5219\u5217\u8868\u5931\u8d25', true);
        }
    } catch (error) {
        console.error('Failed to load logic rules list:', error);
        showToast(`\u52a0\u8f7d\u89c4\u5219\u5217\u8868\u5931\u8d25: ${error.message}`, true);
    }
}

function renderLogicRulesList(rules) {
    const container = document.getElementById('logicRulesList');
    if (!container) {
        return;
    }

    const filteredRules = (rules || []).filter(rule => !String(rule?.id || '').endsWith('_example'));
    if (!filteredRules.length) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></div>
                <div style="font-size: 16px; margin-bottom: 8px;">\u6682\u65e0\u903b\u8f91\u6a21\u5757</div>
                <div style="font-size: 13px;">\u70b9\u51fb\u4e0a\u65b9\u201c\u65b0\u5efa\u89c4\u5219\u201d\u5f00\u59cb\u7ef4\u62a4\u590d\u6742\u903b\u8f91\u6a21\u5757</div>
            </div>
        `;
        return;
    }

    const html = filteredRules.map(rule => {
        const typeMeta = getLogicRuleTypeMeta(rule.type);
        const categoryMeta = LOGIC_RULE_CATEGORY_CONFIG[typeMeta.category] || LOGIC_RULE_CATEGORY_CONFIG.basic;
        const dynamicDefinition = getLogicRuleDynamicDefinition(rule.type);
        const reviewMeta = LOGIC_RULE_REVIEW_STATUS[rule.id] || null;

        return `
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px 20px; transition: all 0.3s; hover: box-shadow 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
                            <h4 style="margin: 0; font-size: 15px; color: #333;">${rule.name}</h4>
                            <span style="padding: 4px 10px; background: ${categoryMeta.color}; color: white; border-radius: 12px; font-size: 11px; font-weight: 600;">${typeMeta.name}</span>
                            ${dynamicDefinition ? '<span style="padding: 4px 10px; background: #eef2ff; color: #4338ca; border-radius: 12px; font-size: 11px; font-weight: 600;">\u52a8\u6001\u6a21\u5757</span>' : ''}
                            ${reviewMeta ? `<span style="padding: 4px 10px; background: ${reviewMeta.background}; color: ${reviewMeta.color}; border-radius: 12px; font-size: 11px; font-weight: 600;">${reviewMeta.label}</span>` : ''}
                        </div>
                        <p style="margin: 0; font-size: 12px; color: #6c757d; line-height: 1.5;">${rule.description || typeMeta.description || '\u6682\u65e0\u63cf\u8ff0'}</p>
                        ${reviewMeta ? `<div style="margin-top: 8px; font-size: 12px; color: ${reviewMeta.color}; line-height: 1.6;">${reviewMeta.note}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="showLogicRuleUsageDetail('${rule.id}')" style="padding: 6px 12px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\u8be6\u60c5</button>
                        <button onclick="editLogicRule('${rule.id}')" style="padding: 6px 12px; background: #005fe0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\u7f16\u8f91</button>
                        <button onclick="deleteLogicRule('${rule.id}')" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\u5220\u9664</button>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px; padding-top: 10px; border-top: 1px solid #e9ecef; font-size: 11px; color: #999; flex-wrap: wrap;">
                    <span>\u4f7f\u7528\u6b21\u6570: ${rule.usage_count || 0}</span>
                    <span>\u521b\u5efa\u65f6\u95f4: ${rule.created_at || '-'}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function updateLogicSidebarMode(tab) {
    const eyebrow = document.getElementById('logicSidebarEyebrow');
    const title = document.getElementById('logicSidebarTitle');
    const description = document.getElementById('logicSidebarDescription');
    const publicConfigSection = document.getElementById('logicPublicConfigNavSection');

    if (tab === 'business-system-mapping') {
        if (eyebrow) eyebrow.textContent = '\u914d\u7f6e\u76ee\u5f55';
        if (title) title.textContent = '\u9009\u62e9\u516c\u5171\u914d\u7f6e';
        if (description) {
            description.textContent = '\u5de6\u4fa7\u5207\u6362\u516c\u5171\u914d\u7f6e\u9879\uff0c\u53f3\u4fa7\u67e5\u770b\u8be6\u60c5\u3001\u5f15\u7528\u8303\u56f4\u548c\u7ef4\u62a4\u5165\u53e3\u3002\u5df2\u63a5\u7ebf\u914d\u7f6e\u4fdd\u5b58\u540e\u76f4\u63a5\u5f71\u54cd\u5bfc\u51fa\uff0c\u9884\u7559\u9879\u6682\u4e0d\u751f\u6548\u3002';
        }
        if (publicConfigSection) publicConfigSection.style.display = 'block';
        return;
    }

    if (eyebrow) eyebrow.textContent = '\u89c4\u5219\u5bfc\u822a';
    if (title) title.textContent = '\u5207\u6362\u89c4\u5219\u5de5\u4f5c\u533a';
    if (description) {
        description.textContent = '\u590d\u6742\u903b\u8f91\u6a21\u5757\u5e93\u5f53\u524d\u5148\u4f5c\u4e3a\u50a8\u5907\u5c42\uff1b\u6570\u636e\u6837\u4f8b\u548c\u5df2\u63a5\u7ebf\u516c\u5171\u914d\u7f6e\u5c5e\u4e8e\u751f\u6548\u5c42\uff0c\u4f1a\u76f4\u63a5\u5f71\u54cd\u5bfc\u51fa\u3002';
    }
    if (publicConfigSection) publicConfigSection.style.display = 'none';
}

let sampleStandardsData = null;
let allSampleStandards = [];

async function loadSampleStandards() {
    try {
        const res = await fetch(API_BASE + '/data-sample-standards');
        const result = await res.json();

        if (result.success && result.data) {
            sampleStandardsData = result.data;
            allSampleStandards = result.data.standards || [];

            // 填充分级筛选下拉框
            populateLevelFilter();

            // 渲染列表
            renderSampleStandards(allSampleStandards);
        }
    } catch (e) {
        console.error('加载数据样例标准失败:', e);
        showToast('加载失败', true);
    }
}

// 填充分级筛选下拉框
function populateLevelFilter() {
    const levels = [...new Set(allSampleStandards.map(s => s.level))].sort();
    const select = document.getElementById('sampleStandardLevelFilter');
    select.innerHTML = '<option value="">全部</option>';
    levels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        select.appendChild(option);
    });
}

function getStandardSamplesArray(standard) {
    if (!standard) return [];
    if (Array.isArray(standard.samples)) {
        return standard.samples.map(s => (s == null ? '' : String(s).trim())).filter(Boolean);
    }
    if (standard.sample != null && String(standard.sample).trim() !== '') {
        return [String(standard.sample).trim()];
    }
    return [];
}

function getStandardSamplesText(standard) {
    const arr = getStandardSamplesArray(standard);
    if (arr.length === 0) return '-';
    if (arr.length <= 5) return arr.join('、');
    return `${arr.slice(0, 5).join('、')} 等${arr.length}个`;
}

// 渲染数据样例标准列表
function renderSampleStandards(standards) {
    const container = document.getElementById('sampleStandardsList');
    document.getElementById('sampleStandardCount').textContent = standards.length;

    if (standards.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 10px; color: #ddd;">-</div>
                <div>暂无数据样例标准</div>
            </div>
        `;
        return;
    }

    container.innerHTML = standards.map(standard => `
        <div class="sample-standard-card" data-id="${standard.id}" style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="font-weight: 600; color: #333; font-size: 14px;">${standard.name}</span>
                        <span style="padding: 2px 8px; background: ${standard.enabled ? '#e8f5e9' : '#ffebee'}; color: ${standard.enabled ? '#2e7d32' : '#c62828'}; border-radius: 10px; font-size: 11px;">${standard.enabled ? '启用' : '禁用'}</span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span style="color: #999;">数据分类:</span> ${standard.category}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        <span style="color: #999;">数据分级:</span> ${standard.level}
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button onclick="editSampleStandard(${standard.id})" style="padding: 4px 8px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">编辑</button>
                    <button onclick="deleteSampleStandard(${standard.id})" style="padding: 4px 8px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">删除</button>
                </div>
            </div>
            <div style="background: #f8f9fa; border-radius: 4px; padding: 10px; margin-top: 8px;">
                <div style="font-size: 11px; color: #999; margin-bottom: 4px;">数据样例 (${getStandardSamplesArray(standard).length}个):</div>
                <div style="font-family: monospace; font-size: 13px; color: #333; word-break: break-all;">${getStandardSamplesText(standard)}</div>
            </div>
        </div>
    `).join('');
}

// 筛选数据样例标准
function filterSampleStandards() {
    const search = document.getElementById('sampleStandardSearch').value.toLowerCase();
    const levelFilter = document.getElementById('sampleStandardLevelFilter').value;
    const statusFilter = document.getElementById('sampleStandardStatusFilter').value;

    let filtered = allSampleStandards.filter(standard => {
        const sampleJoined = getStandardSamplesArray(standard).join('、').toLowerCase();
        const nameText = (standard.name || '').toLowerCase();
        // 搜索过滤
        if (search && !nameText.includes(search) && !sampleJoined.includes(search)) {
            return false;
        }
        // 分级过滤
        if (levelFilter && standard.level !== levelFilter) {
            return false;
        }
        // 状态过滤
        if (statusFilter === 'enabled' && !standard.enabled) {
            return false;
        }
        if (statusFilter === 'disabled' && standard.enabled) {
            return false;
        }
        return true;
    });

    renderSampleStandards(filtered);
}

// 显示标准编辑弹窗
function showSampleStandardEditor(standardId = null) {
    const isEdit = standardId !== null;
    let standard = null;

    if (isEdit) {
        standard = allSampleStandards.find(s => s.id === standardId);
    }

    const initialSamples = standard ? getStandardSamplesArray(standard).join('、') : '';
    const modalHtml = `
        <div id="sampleStandardModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: 8px; padding: 24px; width: 500px; max-width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; color: #333;">${isEdit ? '编辑标准' : '新增标准'}</h3>
                    <button onclick="closeSampleStandardModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
                </div>

                <form id="sampleStandardForm" onsubmit="saveSampleStandard(event, ${standardId})">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px;">数据名称 *</label>
                        <input type="text" id="standardName" value="${standard ? standard.name : ''}" required style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px;">数据分类</label>
                        <input type="text" id="standardCategory" value="${standard ? standard.category : ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px;">数据分级</label>
                        <select id="standardLevel" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            <option value="">请选择</option>
                            <option value="一般级-第1小级" ${standard && standard.level === '一般级-第1小级' ? 'selected' : ''}>一般级-第1小级</option>
                            <option value="一般级-第2小级" ${standard && standard.level === '一般级-第2小级' ? 'selected' : ''}>一般级-第2小级</option>
                            <option value="一般级-第3小级" ${standard && standard.level === '一般级-第3小级' ? 'selected' : ''}>一般级-第3小级</option>
                            <option value="一般级-第4小级" ${standard && standard.level === '一般级-第4小级' ? 'selected' : ''}>一般级-第4小级</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px;">数据样例 *</label>
                        <textarea id="standardSample" required rows="3" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-family: monospace;">${initialSamples}</textarea>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="standardEnabled" ${standard && standard.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span style="font-size: 14px; color: #333;">启用此标准</span>
                        </label>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" onclick="closeSampleStandardModal()" style="padding: 8px 20px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
                        <button type="submit" style="padding: 8px 20px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // 移除旧弹窗
    const oldModal = document.getElementById('sampleStandardModal');
    if (oldModal) oldModal.remove();

    // 添加新弹窗
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 关闭弹窗
function closeSampleStandardModal() {
    const modal = document.getElementById('sampleStandardModal');
    if (modal) modal.remove();
}

// 保存标准
async function saveSampleStandard(event, standardId) {
    event.preventDefault();

    const sampleRaw = document.getElementById('standardSample').value || '';
    const samples = sampleRaw
        .split(/[、,，;；\n]/)
        .map(s => (s == null ? '' : String(s).trim()))
        .filter(Boolean);

    const data = {
        name: document.getElementById('standardName').value,
        category: document.getElementById('standardCategory').value,
        level: document.getElementById('standardLevel').value,
        samples: samples,
        sample: samples.join('、'),
        enabled: document.getElementById('standardEnabled').checked
    };

    try {
        const url = standardId ? `/data-sample-standards/${standardId}` : '/data-sample-standards';
        const method = standardId ? 'PUT' : 'POST';

        const res = await fetch(API_BASE + url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            showToast(standardId ? '更新成功' : '添加成功');
            closeSampleStandardModal();
            loadSampleStandards();
        } else {
            showToast(result.error || '操作失败', true);
        }
    } catch (e) {
        console.error('保存失败:', e);
        showToast('保存失败', true);
    }
}

// 编辑标准
function editSampleStandard(standardId) {
    showSampleStandardEditor(standardId);
}

// 删除标准
async function deleteSampleStandard(standardId) {
    if (!confirm('确认删除此标准吗？')) {
        return;
    }

    try {
        const res = await fetch(API_BASE + `/data-sample-standards/${standardId}`, {
            method: 'DELETE'
        });

        const result = await res.json();

        if (result.success) {
            showToast('删除成功');
            loadSampleStandards();
        } else {
            showToast(result.error || '删除失败', true);
        }
    } catch (e) {
        console.error('删除失败:', e);
        showToast('删除失败', true);
    }
}

// 导入标准
function importSampleStandards() {
    // 创建导入对话框
    const importHtml = `
        <div class="modal-overlay" id="importStandardsModal" style="display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; align-items:center; justify-content:center;">
            <div style="background:white; border-radius:8px; padding:25px; width:500px; max-width:90%; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; color:#333; font-size:18px;">导入数据分级标准样例</h3>
                    <button onclick="closeImportStandardsModal()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#999;">&times;</button>
                </div>

                <div style="margin-bottom:20px;">
                    <p style="margin:0 0 15px 0; font-size:13px; color:#666; line-height:1.6;">
                        请选择Excel文件导入，导入后会根据数据名称自动匹配：
                    </p>
                    <ul style="margin:0 0 15px 0; padding-left:20px; font-size:13px; color:#666;">
                        <li>已存在的记录将被<b>更新</b></li>
                        <li>不存在的记录将被<b>新增</b></li>
                    </ul>

                    <div style="border:2px dashed #ccc; border-radius:6px; padding:20px; text-align:center; background:#f8f9fa;" id="dropZone">
                        <input type="file" id="sampleStandardsImportFileInput" accept=".xlsx,.xls" style="display:none;" onchange="handleImportFileSelect(this)">
                        <div id="dropZoneContent">
                            <div style="font-size:40px; color:#ccc; margin-bottom:10px;">📁</div>
                            <p style="margin:0 0 5px 0; color:#666;">点击选择文件或拖拽文件到此处</p>
                            <p style="margin:0; font-size:12px; color:#999;">支持 .xlsx 或 .xls 格式</p>
                        </div>
                        <div id="selectedFileInfo" style="display:none;">
                            <div style="font-size:30px; margin-bottom:10px;">📄</div>
                            <p style="margin:0 0 5px 0; color:#333;" id="selectedFileName"></p>
                            <p style="margin:0; font-size:12px; color:#999;" id="selectedFileSize"></p>
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button onclick="downloadImportTemplate()" style="padding:8px 15px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">
                        📥 下载导入模板
                    </button>
                    <div style="display:flex; gap:10px;">
                        <button onclick="closeImportStandardsModal()" style="padding:8px 20px; background:white; color:#666; border:1px solid #ddd; border-radius:4px; cursor:pointer; font-size:14px;">取消</button>
                        <button onclick="executeImportStandards()" id="importConfirmBtn" style="padding:8px 20px; background:#005fe0; color:white; border:none; border-radius:4px; cursor:pointer; font-size:14px;" disabled>开始导入</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除已存在的对话框
    const existingModal = document.getElementById('importStandardsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新对话框
    document.body.insertAdjacentHTML('beforeend', importHtml);

    // 设置拖拽上传
    setupDropZone();
}

// 设置拖拽区域
function setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    dropZone.style.cursor = 'pointer';
    dropZone.onclick = () => {
        document.getElementById('sampleStandardsImportFileInput').click();
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#005fe0';
        dropZone.style.background = '#e8f0fe';
    };

    dropZone.ondragleave = () => {
        dropZone.style.borderColor = '#ccc';
        dropZone.style.background = '#f8f9fa';
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        dropZone.style.background = '#f8f9fa';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                handleImportFileSelect({ files: [file] });
            } else {
                showToast('请选择Excel文件（.xlsx或.xls）', true);
            }
        }
    };
}

// 处理文件选择
function handleImportFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('dropZoneContent').style.display = 'none';
    document.getElementById('selectedFileInfo').style.display = 'block';
    document.getElementById('selectedFileName').textContent = file.name;
    document.getElementById('selectedFileSize').textContent = formatFileSize(file.size);
    document.getElementById('importConfirmBtn').disabled = false;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 关闭导入对话框
function closeImportStandardsModal() {
    const modal = document.getElementById('importStandardsModal');
    if (modal) modal.remove();
}

// 下载导入模板
async function downloadImportTemplate() {
    try {
        const response = await fetch(API_BASE + '/data-sample-standards/template');
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '数据分级标准样例_导入模板.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('模板下载成功');
        } else {
            showToast('模板下载失败', true);
        }
    } catch (e) {
        console.error('下载模板失败:', e);
        showToast('模板下载失败', true);
    }
}

async function executeImportStandards() {
    const fileInput = document.getElementById('sampleStandardsImportFileInput');
    const file = fileInput.files[0];
    if (!file) {
        showToast('请选择要导入的文件', true);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const confirmBtn = document.getElementById('importConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '导入中...';

    try {
        const response = await fetch(API_BASE + '/data-sample-standards/import', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message || '导入成功');
            closeImportStandardsModal();
            // 刷新列表
            loadSampleStandards();
        } else {
            showToast(result.error || '导入失败', true);
            confirmBtn.disabled = false;
            confirmBtn.textContent = '开始导入';
        }
    } catch (e) {
        console.error('导入失败:', e);
        showToast('导入失败: ' + e.message, true);
        confirmBtn.disabled = false;
        confirmBtn.textContent = '开始导入';
    }
}

// 导出标准
async function exportSampleStandards() {
    try {
        showToast('正在导出...', false);

        const response = await fetch(API_BASE + '/data-sample-standards/export');

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '数据分级标准样例_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('导出成功');
        } else {
            const result = await response.json();
            showToast(result.error || '导出失败', true);
        }
    } catch (e) {
        console.error('导出失败:', e);
        showToast('导出失败', true);
    }
}

// ==================== 业务系统名称映射字典管理 ====================

const sampleStandardsManagerState = {};

Object.defineProperties(sampleStandardsManagerState, {
    sampleStandardsData: {
        configurable: true,
        enumerable: true,
        get: () => sampleStandardsData,
        set: (value) => {
            sampleStandardsData = value || null;
        }
    },
    allSampleStandards: {
        configurable: true,
        enumerable: true,
        get: () => allSampleStandards,
        set: (value) => {
            allSampleStandards = Array.isArray(value) ? value : [];
        }
    }
});

window.SampleStandardsManager = Object.assign(window.SampleStandardsManager || {}, {
    state: sampleStandardsManagerState,
    loadStandards: loadSampleStandards,
    renderStandards: renderSampleStandards,
    filterStandards: filterSampleStandards,
    showEditor: showSampleStandardEditor,
    closeEditor: closeSampleStandardModal,
    save: saveSampleStandard,
    edit: editSampleStandard,
    remove: deleteSampleStandard,
    downloadImportTemplate,
    importStandards: importSampleStandards,
    exportStandards: exportSampleStandards
});

Object.defineProperty(window.SampleStandardsManager, 'delete', {
    configurable: true,
    enumerable: true,
    value: deleteSampleStandard,
    writable: false
});

function switchLogicTab(tab, button) {
    document.getElementById('logic-tab-content-rules').style.display = 'none';
    document.getElementById('logic-tab-content-sample-standards').style.display = 'none';
    document.getElementById('logic-tab-content-business-system-mapping').style.display = 'none';

    document.querySelectorAll('.logic-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`logic-tab-content-${tab}`).style.display = 'block';
    if (button) {
        button.classList.add('active');
    }

    updateLogicSidebarMode(tab);
    updateLogicOverview(tab);

    if (tab === 'rules') {
        loadLogicRulesWithTemplates();
    } else if (tab === 'sample-standards') {
        loadSampleStandards();
    } else if (tab === 'business-system-mapping') {
        loadBusinessSystemMappings();
    }
}

let publicConfigCenterData = [];
let publicConfigCenterMap = {};
let currentPublicConfigKey = '';
let businessSystemMappingsData = null;
let allBusinessSystemMappings = [];
let assetNameMappingsData = null;
let allAssetNameMappings = [];
let currentBusinessSystemMappingId = null;
let currentAssetNameMappingId = null;
let publicMappingWorkspaceState = {};
let publicConfigTypeEditorState = {
    mode: 'create',
    configKey: '',
    fields: []
};

function normalizePublicConfigCenterMappings(mappings) {
    if (Array.isArray(mappings)) {
        return mappings
            .filter(item => item && typeof item === 'object')
            .map((item, index) => ({
                ...item,
                id: item.id !== undefined ? item.id : index + 1,
                source: item.source || '',
                target: item.target || '',
                enabled: item.enabled !== false
            }));
    }

    if (mappings && typeof mappings === 'object') {
        return Object.entries(mappings).map(([source, target], index) => ({
            id: index + 1,
            source,
            target,
            enabled: true
        }));
    }

    return [];
}

function normalizePublicConfigCenterBindings(bindings) {
    if (!Array.isArray(bindings)) {
        return [];
    }

    return bindings
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id || '',
            config_key: item.config_key || '',
            category: item.category || '',
            report_code: item.report_code || '',
            report_name: item.report_name || item.report_code || '',
            target_column: String(item.target_column || '').trim().toUpperCase(),
            enabled: item.enabled !== false,
            priority: Number(item.priority || 0),
            fallback_policy: item.fallback_policy || '',
            remarks: item.remarks || ''
        }));
}

function buildPublicConfigCenterBindingsMap(bindings) {
    const grouped = {};
    normalizePublicConfigCenterBindings(bindings).forEach(binding => {
        const configKey = binding.config_key;
        if (!configKey) {
            return;
        }

        if (!grouped[configKey]) {
            grouped[configKey] = [];
        }
        grouped[configKey].push(binding);
    });

    Object.values(grouped).forEach(items => {
        items.sort((a, b) => {
            const priorityDiff = Number(a.priority || 0) - Number(b.priority || 0);
            if (priorityDiff !== 0) {
                return priorityDiff;
            }
            return String(a.id || '').localeCompare(String(b.id || ''), 'zh-CN');
        });
    });

    return grouped;
}

function buildPublicConfigCenterUsageSummaries(bindings, activeOnly = false) {
    const grouped = {};

    normalizePublicConfigCenterBindings(bindings).forEach(binding => {
        if (activeOnly && !binding.enabled) {
            return;
        }

        const usageKey = [
            binding.category || '',
            binding.report_code || '',
            binding.report_name || ''
        ].join('::');

        if (!grouped[usageKey]) {
            grouped[usageKey] = {
                category: binding.category || '',
                report_code: binding.report_code || '',
                report_name: binding.report_name || binding.report_code || '',
                target_columns: [],
                enabled: true,
                binding_count: 0
            };
        }

        const usage = grouped[usageKey];
        usage.binding_count += 1;
        if (!binding.enabled) {
            usage.enabled = false;
        }
        if (binding.target_column && !usage.target_columns.includes(binding.target_column)) {
            usage.target_columns.push(binding.target_column);
        }
    });

    return Object.values(grouped)
        .map(item => ({
            ...item,
            target_columns: item.target_columns.sort((a, b) => a.localeCompare(b, 'en'))
        }))
        .sort((a, b) => {
            const categoryDiff = String(a.category || '').localeCompare(String(b.category || ''), 'zh-CN');
            if (categoryDiff !== 0) {
                return categoryDiff;
            }
            return String(a.report_code || '').localeCompare(String(b.report_code || ''), 'zh-CN');
        });
}

function normalizePublicConfigCenterDefinitionItem(definition, registryMeta = {}, bindings = []) {
    const normalizedBindings = normalizePublicConfigCenterBindings(bindings);
    const activeUsages = buildPublicConfigCenterUsageSummaries(normalizedBindings, true);
    const allUsages = buildPublicConfigCenterUsageSummaries(normalizedBindings, false);
    const configBlock = definition && typeof definition.config === 'object' ? definition.config : {};
    const mappingCount = Array.isArray(configBlock.mappings) ? configBlock.mappings.length : 0;
    const supportsDetail = typeof registryMeta.supports_detail === 'boolean'
        ? registryMeta.supports_detail
        : Boolean(definition.detail_api);
    const affectsExport = typeof definition.affects_export === 'boolean'
        ? definition.affects_export
        : Boolean(registryMeta.affects_export);
    const contractRole = definition.contract_role
        || registryMeta.contract_role
        || (affectsExport ? 'runtime' : 'reserve');
    const effectSummary = definition.effect_summary
        || registryMeta.effect_summary
        || (contractRole === 'runtime'
            ? '保存后会直接影响已接线报表导出'
            : '当前仅为预留或储备配置，不直接影响导出');

    return {
        ...registryMeta,
        ...definition,
        key: definition.key || registryMeta.key || '',
        title: registryMeta.title || definition.title || '公共配置',
        name: definition.name || registryMeta.name || definition.title || registryMeta.title || definition.key || '',
        description: definition.description || registryMeta.description || '',
        type: definition.type || registryMeta.config_type || definition.config_type || 'generic',
        config_type: registryMeta.config_type || definition.config_type || definition.type || 'generic',
        editor_mode: registryMeta.editor_mode
            || definition.editor_mode
            || definition.schema?.editor_mode
            || 'generic',
        supports_detail: supportsDetail,
        supports_crud: Boolean(registryMeta.supports_crud),
        supports_import_export: Boolean(
            registryMeta.supports_import_export || definition.schema?.supports_import_export
        ),
        detail_api: registryMeta.detail_api || definition.detail_api || '',
        save_api: registryMeta.save_api || definition.save_api || '',
        template_api: registryMeta.template_api || definition.template_api || '',
        import_api: registryMeta.import_api || definition.import_api || '',
        export_api: registryMeta.export_api || definition.export_api || '',
        schema: definition.schema && typeof definition.schema === 'object' ? definition.schema : {},
        config: configBlock,
        enabled: definition.enabled !== false,
        affects_export: affectsExport,
        contract_role: contractRole,
        effect_summary: effectSummary,
        version: definition.version || registryMeta.version || '1.0',
        last_updated: definition.last_updated || registryMeta.last_updated || '',
        total_count: Number(definition.total_count || mappingCount || registryMeta.total_count || 0),
        bindings: normalizedBindings,
        binding_usages: allUsages,
        used_by: activeUsages.length > 0 ? activeUsages : (Array.isArray(registryMeta.used_by) ? registryMeta.used_by : []),
        usage_count: activeUsages.length > 0 ? activeUsages.length : Number(registryMeta.usage_count || 0),
        binding_count: normalizedBindings.length
    };
}

function buildPublicConfigCenterData(definitions, bindings, registryItems) {
    const definitionItems = Array.isArray(definitions) ? definitions : [];
    const registryList = Array.isArray(registryItems) ? registryItems : [];
    const registryMap = registryList.reduce((acc, item) => {
        if (item && item.key) {
            acc[item.key] = item;
        }
        return acc;
    }, {});
    const bindingsMap = buildPublicConfigCenterBindingsMap(bindings);

    if (definitionItems.length > 0) {
        return definitionItems
            .filter(item => item && item.key)
            .map(item => normalizePublicConfigCenterDefinitionItem(
                item,
                registryMap[item.key] || {},
                bindingsMap[item.key] || []
            ))
            .sort((a, b) => String(a.key || '').localeCompare(String(b.key || ''), 'zh-CN'));
    }

    return registryList
        .filter(item => item && item.key)
        .map(item => {
            const normalizedBindings = normalizePublicConfigCenterBindings(bindingsMap[item.key] || []);
            const activeUsages = buildPublicConfigCenterUsageSummaries(normalizedBindings, true);
            const affectsExport = typeof item.affects_export === 'boolean'
                ? item.affects_export
                : false;
            const contractRole = item.contract_role || (affectsExport ? 'runtime' : 'reserve');
            const effectSummary = item.effect_summary || (
                contractRole === 'runtime'
                    ? '保存后会直接影响已接线报表导出'
                    : '当前仅为预留或储备配置，不直接影响导出'
            );
            return {
                ...item,
                type: item.type || item.config_type || 'generic',
                config_type: item.config_type || item.type || 'generic',
                affects_export: affectsExport,
                contract_role: contractRole,
                effect_summary: effectSummary,
                bindings: normalizedBindings,
                binding_usages: buildPublicConfigCenterUsageSummaries(normalizedBindings, false),
                used_by: activeUsages.length > 0 ? activeUsages : (Array.isArray(item.used_by) ? item.used_by : []),
                usage_count: activeUsages.length > 0 ? activeUsages.length : Number(item.usage_count || 0),
                binding_count: normalizedBindings.length
            };
        })
        .sort((a, b) => String(a.key || '').localeCompare(String(b.key || ''), 'zh-CN'));
}

function escapeSingleQuotedJsValue(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function getDefaultPublicConfigTypeFields() {
    return [
        {
            name: 'source',
            label: '原始值',
            type: 'text',
            required: true,
            searchable: true,
            editable: true,
            visible_in_list: true,
            width: 220,
            placeholder: '请输入原始值'
        },
        {
            name: 'target',
            label: '替换值',
            type: 'text',
            required: true,
            searchable: true,
            editable: true,
            visible_in_list: true,
            width: 220,
            placeholder: '请输入替换值'
        },
        {
            name: 'enabled',
            label: '是否启用',
            type: 'boolean',
            required: false,
            searchable: false,
            editable: true,
            visible_in_list: true,
            width: 100
        }
    ];
}

function normalizePublicConfigTypeEditorField(field = {}, index = 0) {
    const fallbackName = `field_${index + 1}`;
    return {
        name: String(field.name || fallbackName).trim(),
        label: String(field.label || field.name || `字段${index + 1}`).trim(),
        type: String(field.type || 'text').trim(),
        required: field.required === true,
        searchable: field.searchable !== false && field.type !== 'boolean',
        editable: field.editable !== false,
        visible_in_list: field.visible_in_list !== false,
        width: Number(field.width || 180),
        placeholder: String(field.placeholder || '').trim(),
        description: String(field.description || '').trim(),
        options: Array.isArray(field.options)
            ? field.options.map(option => typeof option === 'object' ? (option.label || option.value || '') : String(option || '')).filter(Boolean)
            : []
    };
}

function getPublicConfigTypeEditorBaseConfig(configKey = '') {
    const normalizedKey = String(configKey || currentPublicConfigKey || '').trim();
    if (!normalizedKey) {
        return null;
    }
    return publicConfigCenterMap?.[normalizedKey] || publicMappingConfigMap?.[normalizedKey] || null;
}

function openCurrentPublicConfigTypeManager() {
    if (!currentPublicConfigKey) {
        showToast('请先选择一个公共配置类型', true);
        return;
    }
    openPublicConfigTypeManager('edit', currentPublicConfigKey);
}

function buildPublicConfigTypeActionButton(config) {
    const configKey = String(config?.key || '').trim();
    if (!configKey) {
        return '';
    }
    return `
        <button class="page-reporting-action page-reporting-action--ghost" type="button" onclick="openPublicConfigTypeManager('edit', '${escapeSingleQuotedJsValue(configKey)}')">
            编辑类型
        </button>
    `;
}

function openPublicConfigTypeManager(mode = 'create', configKey = '') {
    const normalizedMode = mode === 'edit' ? 'edit' : 'create';
    const baseConfig = normalizedMode === 'edit'
        ? getPublicConfigTypeEditorBaseConfig(configKey)
        : null;

    if (normalizedMode === 'edit' && !baseConfig) {
        showToast('未找到要编辑的公共配置类型', true);
        return;
    }

    const resolvedKey = normalizedMode === 'edit'
        ? String(baseConfig.key || configKey || '').trim()
        : String(configKey || '').trim();
    const resolvedName = normalizedMode === 'edit'
        ? (baseConfig.name || baseConfig.title || resolvedKey)
        : '';
    const affectExport = normalizedMode === 'edit' ? baseConfig.affects_export === true : false;
    const effectSummary = normalizedMode === 'edit'
        ? (baseConfig.effect_summary || '')
        : '';
    const storageFile = normalizedMode === 'edit'
        ? (
            baseConfig.storage_file
            || baseConfig.storage?.file
            || baseConfig.config?.storage_file
            || (resolvedKey ? `config/${resolvedKey}.json` : '')
        )
        : '';
    const templateFilename = normalizedMode === 'edit'
        ? (baseConfig.template_filename || baseConfig.config?.template_filename || '')
        : '';
    const exportFilename = normalizedMode === 'edit'
        ? (baseConfig.export_filename || baseConfig.config?.export_filename || '')
        : '';
    const capabilities = normalizedMode === 'edit'
        ? (baseConfig.capabilities || {})
        : {};
    const fields = normalizedMode === 'edit'
        ? getPublicConfigFields(baseConfig).map((field, index) => normalizePublicConfigTypeEditorField(field, index))
        : getDefaultPublicConfigTypeFields().map((field, index) => normalizePublicConfigTypeEditorField(field, index));

    publicConfigTypeEditorState = {
        mode: normalizedMode,
        configKey: resolvedKey,
        fields
    };

    closePublicConfigTypeManager();
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay show" id="publicConfigTypeManagerModal" onclick="handlePublicConfigTypeManagerOverlayClick(event)" style="z-index: 10030;">
            <div class="modal-content" style="width: min(1120px, 94vw); max-width: 1120px; max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                <div class="modal-header" style="padding: 18px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">${normalizedMode === 'edit' ? '编辑公共配置类型' : '新增公共配置类型'}</h3>
                        <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">当前先按映射表类型维护，创建后会直接进入公共配置中心并复用统一工作区。</div>
                    </div>
                    <button class="modal-close" type="button" onclick="closePublicConfigTypeManager()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px 24px; overflow-y: auto; background: #f7faff; display: grid; gap: 16px;">
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">
                        <div style="padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; display: grid; gap: 12px;">
                            <div style="font-size: 13px; font-weight: 700; color: #1f2937;">基础信息</div>
                            <div>
                                <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">类型标识 key</label>
                                <input id="publicConfigTypeKey" type="text" value="${escapeHtml(resolvedKey)}" ${normalizedMode === 'edit' ? 'disabled' : ''} placeholder="例如 asset_name_mapping" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">显示名称</label>
                                <input id="publicConfigTypeName" type="text" value="${escapeHtml(resolvedName)}" placeholder="例如 资产名称映射" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">分类</label>
                                <input id="publicConfigTypeCategory" type="text" value="${escapeHtml(normalizedMode === 'edit' ? (baseConfig.category || '') : 'custom')}" placeholder="例如 name_mapping" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">描述</label>
                                <textarea id="publicConfigTypeDescription" placeholder="说明这类公共配置要解决什么问题" style="width: 100%; min-height: 88px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; resize: vertical;">${escapeHtml(normalizedMode === 'edit' ? (baseConfig.description || '') : '')}</textarea>
                            </div>
                        </div>
                        <div style="padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; display: grid; gap: 12px;">
                            <div style="font-size: 13px; font-weight: 700; color: #1f2937;">行为控制</div>
                            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;"><input id="publicConfigTypeEnabled" type="checkbox" ${normalizedMode === 'edit' ? (baseConfig.enabled !== false ? 'checked' : '') : 'checked'}>启用类型</label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;"><input id="publicConfigTypeAffectsExport" type="checkbox" ${affectExport ? 'checked' : ''}>接入导出链路</label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;"><input id="publicConfigTypeImportExport" type="checkbox" ${(capabilities.import_export === false) ? '' : 'checked'}>启用导入导出</label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;"><input id="publicConfigTypeTemplateDownload" type="checkbox" ${(capabilities.template_download === false) ? '' : 'checked'}>启用模板下载</label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;"><input id="publicConfigTypeFrontendEdit" type="checkbox" ${(capabilities.frontend_edit === false) ? '' : 'checked'}>允许前端编辑</label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;"><input id="publicConfigTypeCrud" type="checkbox" ${(capabilities.crud === false) ? '' : 'checked'}>允许行级维护</label>
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">生效说明</label>
                                <textarea id="publicConfigTypeEffectSummary" placeholder="例如：保存后会直接影响某类报表导出" style="width: 100%; min-height: 88px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; resize: vertical;">${escapeHtml(effectSummary)}</textarea>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
                                <div>
                                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">存储文件</label>
                                    <input id="publicConfigTypeStorageFile" type="text" value="${escapeHtml(storageFile)}" placeholder="config/your_type.json" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">编辑模式</label>
                                    <input id="publicConfigTypeEditorMode" type="text" value="${escapeHtml(normalizedMode === 'edit' ? (baseConfig.editor_mode || resolvedKey) : resolvedKey)}" placeholder="默认与 key 保持一致" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">模板文件名</label>
                                    <input id="publicConfigTypeTemplateFilename" type="text" value="${escapeHtml(templateFilename)}" placeholder="例如 自定义映射_导入模板.xlsx" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">导出文件名</label>
                                    <input id="publicConfigTypeExportFilename" type="text" value="${escapeHtml(exportFilename)}" placeholder="例如 自定义映射_导出.xlsx" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; display: grid; gap: 14px;">
                        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 13px; font-weight: 700; color: #1f2937;">字段定义</div>
                                <div style="margin-top: 4px; font-size: 12px; color: #64748b;">字段会直接决定公共配置工作区的列表、搜索、编辑和 Excel 模板结构。</div>
                            </div>
                            <button class="page-reporting-action page-reporting-action--accent" type="button" onclick="addPublicConfigTypeFieldRow()">新增字段</button>
                        </div>
                        <div id="publicConfigTypeFieldsContainer" style="display: grid; gap: 12px;"></div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 14px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: flex-end;">
                    <button class="btn" type="button" onclick="closePublicConfigTypeManager()">取消</button>
                    <button class="btn btn-primary" type="button" onclick="savePublicConfigTypeDefinition()">保存类型</button>
                </div>
            </div>
        </div>
    `);

    renderPublicConfigTypeFieldRows();
}

function closePublicConfigTypeManager() {
    const modal = document.getElementById('publicConfigTypeManagerModal');
    if (modal) {
        modal.remove();
    }
}

function handlePublicConfigTypeManagerOverlayClick(event) {
    if (event && event.target && event.target.id === 'publicConfigTypeManagerModal') {
        closePublicConfigTypeManager();
    }
}

function collectPublicConfigTypeFieldRowsFromForm() {
    const rows = Array.from(document.querySelectorAll('[data-public-config-type-field-row="true"]'));
    if (rows.length === 0) {
        return [];
    }

    return rows.map((row, index) => {
        const fieldType = String(document.getElementById(`publicConfigTypeFieldType_${index}`)?.value || 'text').trim();
        const optionsText = String(document.getElementById(`publicConfigTypeFieldOptions_${index}`)?.value || '').trim();
        return normalizePublicConfigTypeEditorField({
            name: document.getElementById(`publicConfigTypeFieldName_${index}`)?.value || '',
            label: document.getElementById(`publicConfigTypeFieldLabel_${index}`)?.value || '',
            type: fieldType,
            required: document.getElementById(`publicConfigTypeFieldRequired_${index}`)?.checked === true,
            searchable: document.getElementById(`publicConfigTypeFieldSearchable_${index}`)?.checked === true,
            editable: document.getElementById(`publicConfigTypeFieldEditable_${index}`)?.checked !== false,
            visible_in_list: document.getElementById(`publicConfigTypeFieldVisible_${index}`)?.checked !== false,
            width: document.getElementById(`publicConfigTypeFieldWidth_${index}`)?.value || 180,
            placeholder: document.getElementById(`publicConfigTypeFieldPlaceholder_${index}`)?.value || '',
            description: document.getElementById(`publicConfigTypeFieldDescription_${index}`)?.value || '',
            options: fieldType === 'select'
                ? optionsText.split(/[\n,]/).map(item => item.trim()).filter(Boolean)
                : []
        }, index);
    });
}

function renderPublicConfigTypeFieldRows() {
    const container = document.getElementById('publicConfigTypeFieldsContainer');
    if (!container) {
        return;
    }

    const fields = Array.isArray(publicConfigTypeEditorState.fields) && publicConfigTypeEditorState.fields.length > 0
        ? publicConfigTypeEditorState.fields
        : getDefaultPublicConfigTypeFields();

    container.innerHTML = fields.map((field, index) => `
        <div data-public-config-type-field-row="true" data-index="${index}" style="padding: 14px; background: #f8fbff; border: 1px solid #dbeafe; border-radius: 12px; display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="font-size: 12px; font-weight: 700; color: #0f4fa8;">字段 ${index + 1}</div>
                <button class="page-reporting-action page-reporting-action--ghost" type="button" onclick="removePublicConfigTypeFieldRow(${index})">删除字段</button>
            </div>
            <div style="display: grid; grid-template-columns: 1.1fr 1.3fr 0.9fr 0.8fr; gap: 10px;">
                <input id="publicConfigTypeFieldName_${index}" type="text" value="${escapeHtml(field.name)}" placeholder="字段标识，例如 source" style="width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                <input id="publicConfigTypeFieldLabel_${index}" type="text" value="${escapeHtml(field.label)}" placeholder="显示名称" style="width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                <select id="publicConfigTypeFieldType_${index}" style="width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                    <option value="text" ${field.type === 'text' ? 'selected' : ''}>文本</option>
                    <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>多行文本</option>
                    <option value="number" ${field.type === 'number' ? 'selected' : ''}>数字</option>
                    <option value="boolean" ${field.type === 'boolean' ? 'selected' : ''}>布尔</option>
                    <option value="select" ${field.type === 'select' ? 'selected' : ''}>下拉</option>
                </select>
                <input id="publicConfigTypeFieldWidth_${index}" type="number" min="80" step="10" value="${Number(field.width || 180)}" placeholder="列表宽度" style="width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input id="publicConfigTypeFieldPlaceholder_${index}" type="text" value="${escapeHtml(field.placeholder || '')}" placeholder="输入提示语" style="width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
                <input id="publicConfigTypeFieldOptions_${index}" type="text" value="${escapeHtml((field.options || []).join(', '))}" placeholder="下拉选项，逗号分隔" style="width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
            </div>
            <textarea id="publicConfigTypeFieldDescription_${index}" placeholder="字段说明" style="width: 100%; min-height: 60px; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; resize: vertical;">${escapeHtml(field.description || '')}</textarea>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #334155;"><input id="publicConfigTypeFieldRequired_${index}" type="checkbox" ${field.required ? 'checked' : ''}>必填</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #334155;"><input id="publicConfigTypeFieldSearchable_${index}" type="checkbox" ${field.searchable ? 'checked' : ''}>可搜索</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #334155;"><input id="publicConfigTypeFieldEditable_${index}" type="checkbox" ${field.editable ? 'checked' : ''}>可编辑</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #334155;"><input id="publicConfigTypeFieldVisible_${index}" type="checkbox" ${field.visible_in_list ? 'checked' : ''}>列表展示</label>
            </div>
        </div>
    `).join('');
}

function addPublicConfigTypeFieldRow() {
    publicConfigTypeEditorState.fields = collectPublicConfigTypeFieldRowsFromForm();
    publicConfigTypeEditorState.fields.push(
        normalizePublicConfigTypeEditorField({}, publicConfigTypeEditorState.fields.length)
    );
    renderPublicConfigTypeFieldRows();
}

function removePublicConfigTypeFieldRow(index) {
    publicConfigTypeEditorState.fields = collectPublicConfigTypeFieldRowsFromForm();
    if (publicConfigTypeEditorState.fields.length <= 1) {
        showToast('至少保留一个字段', true);
        return;
    }
    publicConfigTypeEditorState.fields.splice(index, 1);
    publicConfigTypeEditorState.fields = publicConfigTypeEditorState.fields.map((field, itemIndex) => (
        normalizePublicConfigTypeEditorField(field, itemIndex)
    ));
    renderPublicConfigTypeFieldRows();
}

function collectPublicConfigTypeDefinitionPayload() {
    const key = String(document.getElementById('publicConfigTypeKey')?.value || '').trim();
    const name = String(document.getElementById('publicConfigTypeName')?.value || '').trim();
    const category = String(document.getElementById('publicConfigTypeCategory')?.value || '').trim() || 'custom';
    const description = String(document.getElementById('publicConfigTypeDescription')?.value || '').trim();
    const enabled = document.getElementById('publicConfigTypeEnabled')?.checked === true;
    const affectsExport = document.getElementById('publicConfigTypeAffectsExport')?.checked === true;
    const effectSummary = String(document.getElementById('publicConfigTypeEffectSummary')?.value || '').trim();
    const storageFile = String(document.getElementById('publicConfigTypeStorageFile')?.value || '').trim() || `config/${key}.json`;
    const editorMode = String(document.getElementById('publicConfigTypeEditorMode')?.value || '').trim() || key;
    const templateFilename = String(document.getElementById('publicConfigTypeTemplateFilename')?.value || '').trim();
    const exportFilename = String(document.getElementById('publicConfigTypeExportFilename')?.value || '').trim();
    const fields = collectPublicConfigTypeFieldRowsFromForm();
    const importExportEnabled = document.getElementById('publicConfigTypeImportExport')?.checked === true;
    const templateDownloadEnabled = document.getElementById('publicConfigTypeTemplateDownload')?.checked === true;
    const frontendEditEnabled = document.getElementById('publicConfigTypeFrontendEdit')?.checked === true;
    const crudEnabled = document.getElementById('publicConfigTypeCrud')?.checked === true;

    return {
        key,
        title: '公共配置',
        name,
        type: 'mapping_table',
        config_type: 'mapping_table',
        category,
        description,
        enabled,
        affects_export: affectsExport,
        contract_role: affectsExport ? 'runtime' : 'reserve',
        effect_summary: effectSummary,
        editor_mode: editorMode,
        storage: {
            type: 'json_file',
            file: storageFile,
            record_path: 'mappings'
        },
        capabilities: {
            detail: true,
            crud: crudEnabled,
            import_export: importExportEnabled,
            frontend_edit: frontendEditEnabled,
            template_download: templateDownloadEnabled
        },
        fields,
        config: {
            storage_file: storageFile,
            template_filename: templateFilename || `${name || key}_导入模板.xlsx`,
            export_filename: exportFilename || `${name || key}_导出.xlsx`,
            mappings: []
        }
    };
}

async function savePublicConfigTypeDefinition() {
    const payload = collectPublicConfigTypeDefinitionPayload();
    if (!payload.key) {
        showToast('请填写类型标识 key', true);
        return;
    }
    if (!payload.name) {
        showToast('请填写显示名称', true);
        return;
    }
    if (!Array.isArray(payload.fields) || payload.fields.length === 0) {
        showToast('请至少配置一个字段', true);
        return;
    }

    try {
        const isEditMode = publicConfigTypeEditorState.mode === 'edit';
        const requestUrl = isEditMode
            ? `${API_BASE}/public-configs/types/${encodeURIComponent(publicConfigTypeEditorState.configKey || payload.key)}`
            : `${API_BASE}/public-configs/types`;
        const response = await fetch(requestUrl, {
            method: isEditMode ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            showToast(result.error || '保存公共配置类型失败', true);
            return;
        }

        showToast(result.message || '公共配置类型保存成功', false);
        closePublicConfigTypeManager();
        currentPublicConfigKey = result.data?.key || payload.key;
        publicConfigCenterData = [];
        publicConfigCenterMap = {};
        delete publicMappingWorkspaceState[currentPublicConfigKey];
        await loadBusinessSystemMappings();
    } catch (e) {
        console.error('保存公共配置类型失败:', e);
        showToast('保存公共配置类型失败', true);
    }
}

async function ensurePublicConfigCenterDataLoaded(forceReload = false) {
    if (!forceReload && Array.isArray(publicConfigCenterData) && publicConfigCenterData.length > 0) {
        return publicConfigCenterData;
    }

    const [definitionsRes, bindingsRes, registryRes] = await Promise.all([
        fetch(API_BASE + '/public-configs-center/definitions'),
        fetch(API_BASE + '/public-configs-center/bindings'),
        fetch(API_BASE + '/public-configs')
    ]);
    const [definitionsResult, bindingsResult, registryResult] = await Promise.all([
        definitionsRes.json(),
        bindingsRes.json(),
        registryRes.json()
    ]);

    const definitions = definitionsResult.success ? (definitionsResult.data || []) : [];
    const bindings = bindingsResult.success ? (bindingsResult.data || []) : [];
    const registryItems = registryResult.success ? (registryResult.data || []) : [];
    publicConfigCenterData = buildPublicConfigCenterData(definitions, bindings, registryItems);
    publicConfigCenterMap = publicConfigCenterData.reduce((acc, item) => {
        if (item && item.key) {
            acc[item.key] = item;
        }
        return acc;
    }, {});

    return publicConfigCenterData;
}

function getAvailablePublicMappingConfigs() {
    const items = Array.isArray(publicConfigCenterData) ? publicConfigCenterData : [];
    const mappingConfigs = items.filter(item => {
        if (!item || !item.key || item.enabled === false) {
            return false;
        }
        const configType = item.config_type || item.type || '';
        return configType === 'mapping_table';
    });

    if (mappingConfigs.length > 0) {
        return mappingConfigs;
    }

    return [
        {
            key: 'business_system_name_mapping',
            name: '业务系统名称映射',
            contract_role: 'runtime',
            affects_export: true
        }
    ];
}

function buildPublicMappingConfigOptionsHtml(selectedValue = '') {
    const options = getAvailablePublicMappingConfigs();
    const normalizedSelectedValue = String(selectedValue || '').trim();
    const optionHtml = options.map(item => {
        const key = String(item.key || '').trim();
        const name = item.name || item.title || key;
        const contractMeta = getPublicConfigContractMeta(item);
        const selected = normalizedSelectedValue === key ? 'selected' : '';
        return `<option value="${escapeHtml(key)}" ${selected}>${escapeHtml(key)}（${escapeHtml(name)} / ${escapeHtml(contractMeta.statusText)}）</option>`;
    });

    if (
        normalizedSelectedValue
        && !options.some(item => String(item.key || '').trim() === normalizedSelectedValue)
    ) {
        optionHtml.push(
            `<option value="${escapeHtml(normalizedSelectedValue)}" selected>${escapeHtml(normalizedSelectedValue)}（当前配置值）</option>`
        );
    }

    return optionHtml.join('');
}

function getPublicConfigContractMeta(config) {
    const affectsExport = config?.affects_export === true;
    const contractRole = String(config?.contract_role || (affectsExport ? 'runtime' : 'reserve'));
    const isRuntime = contractRole === 'runtime' || affectsExport;
    return {
        isRuntime,
        statusText: isRuntime ? '生效层' : '预留项',
        summary: config?.effect_summary
            || (isRuntime
                ? '保存后会直接影响已接线报表导出'
                : '当前仅为预留或储备配置，不直接影响导出'),
        statusBackground: isRuntime ? '#e8f5e9' : '#f5f7fa',
        statusColor: isRuntime ? '#1b5e20' : '#4b5563'
    };
}

function renderPublicConfigCenterEmptyState(title, description) {
    const detailContainer = document.getElementById('publicConfigDetailContent');
    if (!detailContainer) {
        return;
    }

    detailContainer.innerHTML = `
        <div class="mapping-empty-state mapping-empty-state--center" style="min-height: 320px;">
            <span class="mapping-empty-state__badge">公共配置</span>
            <div class="mapping-empty-state__title">${escapeHtml(title || '请先从左侧选择配置项')}</div>
            <div class="mapping-empty-state__desc">${escapeHtml(description || '已接线的公共配置保存后会直接影响导出，预留项暂不生效。')}</div>
        </div>
    `;
}

function updatePublicConfigCenterWorkspace(config) {
    const titleEl = document.getElementById('publicConfigCenterTitle');
    const descriptionEl = document.getElementById('publicConfigCenterDescription');
    const statusEl = document.getElementById('publicConfigCenterStatus');
    const hintEl = document.getElementById('publicConfigCenterHint');

    if (!config) {
        if (titleEl) titleEl.textContent = '公共配置工作区';
        if (descriptionEl) descriptionEl.textContent = '请先从左侧选择一个公共配置项，再在右侧查看详情、引用关系和维护入口。已接线项保存后会直接影响导出。';
        if (statusEl) {
            statusEl.textContent = '等待选择';
            statusEl.style.background = '#eef4ff';
            statusEl.style.color = '#005fe0';
        }
        if (hintEl) hintEl.textContent = '未选择';
        return;
    }

    const name = config.name || config.title || config.key || '公共配置';
    const usageCount = Number(config.usage_count || 0);
    const contractMeta = getPublicConfigContractMeta(config);

    if (titleEl) titleEl.textContent = name;
    if (descriptionEl) {
        descriptionEl.textContent = contractMeta.summary;
    }
    if (statusEl) {
        statusEl.textContent = contractMeta.statusText;
        statusEl.style.background = contractMeta.statusBackground;
        statusEl.style.color = contractMeta.statusColor;
    }
    if (hintEl) {
        hintEl.textContent = contractMeta.isRuntime
            ? `${config.key || name} · ${usageCount} 张报表引用`
            : `${config.key || name} · 当前未接入导出`;
    }
}

function renderPublicConfigCenterList(items) {
    const container = document.getElementById('publicConfigCenterList');
    if (!container) {
        return;
    }

    const configItems = Array.isArray(items) ? items : [];
    if (configItems.length === 0) {
        container.innerHTML = `
            <div class="mapping-empty-state" style="padding: 24px 16px;">
                <span class="mapping-empty-state__badge">暂无配置</span>
                <div class="mapping-empty-state__title" style="font-size: 14px;">当前没有公共配置项</div>
                <div class="mapping-empty-state__desc">后续新增配置后会自动出现在这里。</div>
            </div>
        `;
        return;
    }

    container.innerHTML = configItems.map(item => {
        const isActive = item.key === currentPublicConfigKey;
        const nameLabel = (() => {
            if (item.key === 'asset_name_mapping') {
                return '资产名称映射';
            }
            if (item.key === 'business_system_name_mapping') {
                return '业务系统名称映射';
            }
            return item.name || item.title || item.key || '-';
        })();
        const accentColor = '#2d86ff';
        const activeStyle = isActive
            ? `background: #e7f5ff; border: 2px solid ${accentColor}; box-shadow: 0 4px 12px ${accentColor}40;`
            : 'background: white; border: 1px solid #e9ecef; box-shadow: none;';
        return `
            <div class="mapping-report-item"
                 data-category="public-config-center"
                 data-code="${escapeHtml(item.key || '')}"
                 style="--mapping-accent: ${accentColor}; ${activeStyle}"
                 onclick="selectPublicConfigCenterItem('${item.key}')">
                <div class="mapping-report-item__name">${escapeHtml(nameLabel)}</div>
            </div>
        `;
    }).join('');
}

function renderPublicConfigCenterUsageList(usedBy) {
    const usageList = Array.isArray(usedBy) ? usedBy : [];
    if (usageList.length === 0) {
        return `
            <div style="padding: 12px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b; font-size: 12px; line-height: 1.7;">
                当前还没有报表引用记录。后续新增公共配置或给更多报表接线后，这里会自动展示引用范围。
            </div>
        `;
    }

    return `
        <div style="display: grid; gap: 10px;">
            ${usageList.map(item => `
                <div style="padding: 12px 14px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between; gap: 10px; align-items: center;">
                        <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${escapeHtml(item.report_name || item.report_code || '-')}</div>
                        ${item.enabled === false ? '<span style="padding: 2px 8px; border-radius: 999px; background: #fff1f2; color: #be123c; font-size: 11px;">停用绑定</span>' : ''}
                    </div>
                    <div style="margin-top: 5px; font-size: 12px; color: #6b7280; line-height: 1.7;">
                        ${escapeHtml(item.category || '-')}/${escapeHtml(item.report_code || '-')} · 引用列 ${escapeHtml(Array.isArray(item.target_columns) ? item.target_columns.join(', ') : '-')}
                    </div>
                    ${item.binding_count > 1 ? `<div style="margin-top: 6px; font-size: 11px; color: #94a3b8;">共 ${Number(item.binding_count || 0)} 条绑定规则</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function formatPublicConfigCenterSummaryValue(value) {
    if (value === undefined || value === null) {
        return '未设置';
    }

    if (typeof value === 'boolean') {
        return value ? '是' : '否';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return `${value.length} 项`;
    }

    if (typeof value === 'object') {
        return `${Object.keys(value).length} 个字段`;
    }

    const text = String(value).trim();
    if (!text) {
        return '未设置';
    }

    return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

function renderPublicConfigCenterSummaryGrid(title, items, emptyText = '暂无摘要信息') {
    const normalizedItems = Array.isArray(items)
        ? items.filter(item => item && item.label)
        : [];

    return `
        <div>
            <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 10px;">${escapeHtml(title || '摘要')}</div>
            ${normalizedItems.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
                    ${normalizedItems.map(item => `
                        <div style="padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${escapeHtml(item.label)}</div>
                            <div style="font-size: 13px; color: #1f2937; font-weight: 700; line-height: 1.6; word-break: break-word;">${escapeHtml(formatPublicConfigCenterSummaryValue(item.value))}</div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="padding: 12px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b; font-size: 12px; line-height: 1.7;">
                    ${escapeHtml(emptyText)}
                </div>
            `}
        </div>
    `;
}

function buildPublicConfigCenterDefinitionSummaryItems(config) {
    return [
        { label: '配置键', value: config.key || '' },
        { label: '展示名称', value: config.name || config.title || '' },
        { label: '配置类型', value: config.config_type || config.type || 'generic' },
        { label: '编辑模式', value: config.editor_mode || 'generic' },
        { label: '版本', value: config.version || '1.0' },
        { label: '启用状态', value: config.enabled !== false ? '启用' : '停用' },
        { label: '详情入口', value: config.detail_api || '未配置' },
        { label: '最近更新', value: config.last_updated || '未记录' }
    ];
}

function buildPublicConfigCenterSchemaSummaryItems(config) {
    const schema = config && typeof config.schema === 'object' ? config.schema : {};
    return Object.entries(schema).map(([key, value]) => ({
        label: key,
        value
    }));
}

function buildPublicConfigCenterConfigSummaryItems(config) {
    const configBlock = config && typeof config.config === 'object' ? config.config : {};
    const items = [];

    if (Array.isArray(configBlock.mappings)) {
        const mappings = configBlock.mappings.filter(item => item && typeof item === 'object');
        const enabledCount = mappings.filter(item => item.enabled !== false).length;
        const samplePairs = mappings
            .slice(0, 2)
            .map(item => {
                const source = String(item.source || '').trim();
                const target = String(item.target || '').trim();
                return source || target ? `${source || '-'} -> ${target || '-'}` : '';
            })
            .filter(Boolean);

        items.push({ label: '映射条数', value: `${mappings.length} 条` });
        items.push({ label: '启用映射', value: `${enabledCount} 条` });
        if (samplePairs.length > 0) {
            items.push({ label: '映射示例', value: samplePairs.join('；') });
        }
    }

    Object.entries(configBlock).forEach(([key, value]) => {
        if (key === 'mappings') {
            return;
        }
        items.push({
            label: key,
            value
        });
    });

    return items;
}

function renderPublicConfigCenterBindingDetailList(bindings) {
    const bindingList = normalizePublicConfigCenterBindings(bindings);
    if (bindingList.length === 0) {
        return `
            <div style="padding: 12px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b; font-size: 12px; line-height: 1.7;">
                当前还没有绑定层明细。后续把这个公共配置绑定到更多报表列后，这里会自动展示。
            </div>
        `;
    }

    return `
        <div style="display: grid; gap: 10px;">
            ${bindingList.map(binding => `
                <div style="padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${escapeHtml(binding.report_name || binding.report_code || '-')}</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            <span style="padding: 2px 8px; border-radius: 999px; background: #eef4ff; color: #005fe0; font-size: 11px;">列 ${escapeHtml(binding.target_column || '-')}</span>
                            <span style="padding: 2px 8px; border-radius: 999px; background: #f5f7fa; color: #4b5563; font-size: 11px;">优先级 ${Number(binding.priority || 0)}</span>
                            <span style="padding: 2px 8px; border-radius: 999px; background: ${binding.enabled ? '#ecfdf3' : '#fff1f2'}; color: ${binding.enabled ? '#166534' : '#be123c'}; font-size: 11px;">${binding.enabled ? '启用' : '停用'}</span>
                        </div>
                    </div>
                    <div style="margin-top: 6px; font-size: 12px; color: #6b7280; line-height: 1.7;">
                        ${escapeHtml(binding.category || '-')}/${escapeHtml(binding.report_code || '-')} · 兜底策略 ${escapeHtml(binding.fallback_policy || '未设置')}
                    </div>
                    ${binding.remarks ? `
                        <div style="margin-top: 6px; font-size: 12px; color: #475569; line-height: 1.7;">
                            说明：${escapeHtml(binding.remarks)}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function buildPublicConfigCenterOperationEntries(config, overrides = {}) {
    const supportsCrud = Boolean(config.supports_crud || config.save_api);
    const supportsImportExport = Boolean(
        config.supports_import_export
        || config.template_api
        || config.import_api
        || config.export_api
    );
    const defaultEntries = [
        {
            key: 'help',
            title: '专属说明',
            description: config.detail_api
                ? '当前配置已经登记详情入口，可继续扩展专属说明或二级维护页面。'
                : '当前只启用了通用详情展示，后续可继续挂接专属说明入口。',
            meta_text: config.detail_api ? `detail_api: ${config.detail_api}` : '未登记 detail_api',
            registered: Boolean(config.supports_detail || config.detail_api),
            button_text: '查看说明',
            kind: 'ghost',
            placements: ['title', 'panel']
        },
        {
            key: 'create',
            title: '配置维护',
            description: supportsCrud
                ? '当前配置已经登记维护能力，可继续接入新增、编辑、删除等专属交互。'
                : '当前配置还未登记维护入口，后续可按需补充。',
            meta_text: config.save_api ? `save_api: ${config.save_api}` : '未登记 save_api',
            registered: supportsCrud,
            button_text: '新增/维护',
            kind: 'accent',
            placements: ['toolbar', 'panel']
        },
        {
            key: 'template',
            title: '模板下载',
            description: supportsImportExport
                ? '支持模板化维护的配置，后续可以直接挂接模板下载能力。'
                : '当前配置还未登记模板下载能力。',
            meta_text: config.template_api ? `template_api: ${config.template_api}` : '未登记 template_api',
            registered: Boolean(config.template_api || supportsImportExport),
            button_text: '下载模板',
            kind: 'ghost',
            placements: ['toolbar', 'panel']
        },
        {
            key: 'import',
            title: '批量导入',
            description: supportsImportExport
                ? '后续可通过导入文件快速写入配置，适合批量维护场景。'
                : '当前配置还未登记批量导入能力。',
            meta_text: config.import_api ? `import_api: ${config.import_api}` : '未登记 import_api',
            registered: Boolean(config.import_api || supportsImportExport),
            button_text: '导入',
            kind: 'ghost',
            placements: ['toolbar', 'panel']
        },
        {
            key: 'export',
            title: '配置导出',
            description: supportsImportExport
                ? '后续可把当前配置导出为文件，便于归档和跨环境复用。'
                : '当前配置还未登记导出能力。',
            meta_text: config.export_api ? `export_api: ${config.export_api}` : '未登记 export_api',
            registered: Boolean(config.export_api || supportsImportExport),
            button_text: '导出',
            kind: 'ghost',
            placements: ['toolbar', 'panel']
        }
    ];

    return defaultEntries.map(entry => {
        const override = overrides[entry.key] || {};
        const placements = Array.isArray(override.placements)
            ? override.placements
            : entry.placements;
        const onClick = override.onClick || '';
        const enabled = override.enabled !== undefined ? override.enabled : true;
        const registered = override.registered !== undefined ? override.registered : entry.registered;
        let state = 'placeholder';
        if (onClick && enabled) {
            state = 'ready';
        } else if (registered) {
            state = 'registered';
        }

        return {
            ...entry,
            ...override,
            placements,
            onClick,
            enabled,
            registered,
            state,
            description: override.description || entry.description,
            meta_text: override.meta_text || entry.meta_text,
            button_text: override.button_text || entry.button_text,
            title: override.title || entry.title,
            kind: override.kind || entry.kind
        };
    });
}

function getPublicConfigCenterOperationStateStyle(state) {
    if (state === 'ready') {
        return {
            label: '已接线',
            background: '#ecfdf3',
            color: '#166534'
        };
    }
    if (state === 'registered') {
        return {
            label: '已登记',
            background: '#eef4ff',
            color: '#005fe0'
        };
    }
    return {
        label: '占位',
        background: '#f5f7fa',
        color: '#4b5563'
    };
}

function renderPublicConfigCenterOperationButton(entry, compact = false) {
    const kindClass = entry.kind === 'accent'
        ? 'page-reporting-action page-reporting-action--accent'
        : 'page-reporting-action page-reporting-action--ghost';
    const compactClass = compact ? ' page-reporting-action--compact' : '';
    const disabled = entry.state !== 'ready';
    const onclick = !disabled && entry.onClick ? ` onclick="${entry.onClick}"` : '';
    const disabledAttr = disabled ? ' disabled' : '';
    const label = entry.button_text || '待接入';

    return `
        <button class="${kindClass}${compactClass}" type="button"${onclick}${disabledAttr}>
            ${escapeHtml(label)}
        </button>
    `;
}

function renderPublicConfigCenterHeaderActions(config, overrides = {}, placement = 'title') {
    const entries = buildPublicConfigCenterOperationEntries(config, overrides)
        .filter(entry => Array.isArray(entry.placements) && entry.placements.includes(placement));

    if (entries.length === 0) {
        if (placement === 'title') {
            return `
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button class="page-reporting-action page-reporting-action--ghost page-reporting-action--compact" type="button" disabled>待接专属维护</button>
                </div>
            `;
        }
        return '';
    }

    return `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${entries.map(entry => renderPublicConfigCenterOperationButton(entry, placement === 'title')).join('')}
        </div>
    `;
}

function renderPublicConfigCenterOperationsPanel(config, overrides = {}) {
    const entries = buildPublicConfigCenterOperationEntries(config, overrides)
        .filter(entry => Array.isArray(entry.placements) && entry.placements.includes('panel'));

    return `
        <div class="logic-filter-card">
            <div style="display: grid; gap: 16px;">
                <div style="font-size: 13px; font-weight: 700; color: #334155;">操作入口</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px;">
                    ${entries.map(entry => {
                        const stateStyle = getPublicConfigCenterOperationStateStyle(entry.state);
                        return `
                            <div style="padding: 14px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; display: grid; gap: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                    <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${escapeHtml(entry.title || '操作')}</div>
                                    <span style="padding: 2px 8px; border-radius: 999px; background: ${stateStyle.background}; color: ${stateStyle.color}; font-size: 11px;">${stateStyle.label}</span>
                                </div>
                                <div style="font-size: 12px; color: #475569; line-height: 1.7; min-height: 40px;">${escapeHtml(entry.description || '')}</div>
                                <div style="font-size: 11px; color: #94a3b8; line-height: 1.6; word-break: break-all;">${escapeHtml(entry.meta_text || '未登记元数据')}</div>
                                <div>${renderPublicConfigCenterOperationButton(entry, false)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderPublicConfigCenterDefinitionPanel(config) {
    return `
        <div class="logic-filter-card">
            <div style="display: grid; gap: 16px;">
                ${renderPublicConfigCenterSummaryGrid(
                    '定义层摘要',
                    buildPublicConfigCenterDefinitionSummaryItems(config),
                    '当前还没有定义层摘要信息。'
                )}
                ${renderPublicConfigCenterSummaryGrid(
                    'Schema 摘要',
                    buildPublicConfigCenterSchemaSummaryItems(config),
                    '当前配置尚未定义 schema。'
                )}
                ${renderPublicConfigCenterSummaryGrid(
                    'Config 摘要',
                    buildPublicConfigCenterConfigSummaryItems(config),
                    '当前配置尚未定义 config。'
                )}
            </div>
        </div>
    `;
}

function renderPublicConfigCenterBindingsPanel(config) {
    return `
        <div class="logic-filter-card">
            <div style="display: grid; gap: 16px;">
                <div>
                    <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 10px;">当前引用报表</div>
                    ${renderPublicConfigCenterUsageList(config.binding_usages || config.used_by)}
                </div>
                <div>
                    <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 10px;">绑定层明细</div>
                    ${renderPublicConfigCenterBindingDetailList(config.bindings)}
                </div>
            </div>
        </div>
    `;
}

function renderGenericPublicConfigCenterDetail(config) {
    const detailContainer = document.getElementById('publicConfigDetailContent');
    if (!detailContainer) {
        return;
    }

    const operationOverrides = {};
    const contractMeta = getPublicConfigContractMeta(config);
    detailContainer.innerHTML = `
        <div class="logic-toolbar-card">
            <div class="logic-toolbar-card__head">
                <div class="logic-toolbar-card__copy">
                    <div class="logic-toolbar-card__title-row">
                        <h3>${escapeHtml(config.name || config.title || config.key || '公共配置')}</h3>
                        ${renderPublicConfigCenterHeaderActions(config, operationOverrides, 'title')}
                    </div>
                    <p>${escapeHtml(contractMeta.summary || config.description || '该公共配置项已纳入统一容器，后续可继续接入详情维护能力。')}</p>
                </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px;">
                <span style="padding: 4px 10px; border-radius: 999px; background: ${contractMeta.statusBackground}; color: ${contractMeta.statusColor}; font-size: 12px;">${escapeHtml(contractMeta.statusText)}</span>
                <span style="padding: 4px 10px; border-radius: 999px; background: #eef4ff; color: #005fe0; font-size: 12px;">key: ${escapeHtml(config.key || '')}</span>
                <span style="padding: 4px 10px; border-radius: 999px; background: #f5f7fa; color: #4b5563; font-size: 12px;">类型: ${escapeHtml(config.config_type || config.type || 'generic')}</span>
                <span style="padding: 4px 10px; border-radius: 999px; background: #ecfdf3; color: #166534; font-size: 12px;">引用 ${Number(config.usage_count || 0)} 张报表</span>
                <span style="padding: 4px 10px; border-radius: 999px; background: #fff7ed; color: #c2410c; font-size: 12px;">绑定 ${Number(config.binding_count || 0)} 条规则</span>
            </div>
        </div>
    `;
}

function getPublicMappingWorkspaceStore(configKey) {
    const key = String(configKey || '').trim() || currentPublicConfigKey || 'business_system_name_mapping';
    if (!publicMappingWorkspaceState[key]) {
        publicMappingWorkspaceState[key] = {
            config: null,
            mappings: [],
            currentId: null
        };
    }

    if (key === 'asset_name_mapping') {
        publicMappingWorkspaceState[key].config = publicMappingWorkspaceState[key].config || assetNameMappingsData;
        publicMappingWorkspaceState[key].mappings = publicMappingWorkspaceState[key].mappings.length > 0
            ? publicMappingWorkspaceState[key].mappings
            : allAssetNameMappings;
        publicMappingWorkspaceState[key].currentId = currentAssetNameMappingId;
    } else if (key === 'business_system_name_mapping') {
        publicMappingWorkspaceState[key].config = publicMappingWorkspaceState[key].config || businessSystemMappingsData;
        publicMappingWorkspaceState[key].mappings = publicMappingWorkspaceState[key].mappings.length > 0
            ? publicMappingWorkspaceState[key].mappings
            : allBusinessSystemMappings;
        publicMappingWorkspaceState[key].currentId = currentBusinessSystemMappingId;
    }

    return publicMappingWorkspaceState[key];
}

function setPublicMappingWorkspaceStore(configKey, nextState = {}) {
    const key = String(configKey || '').trim() || currentPublicConfigKey || 'business_system_name_mapping';
    const currentState = publicMappingWorkspaceState[key] || {
        config: null,
        mappings: [],
        currentId: null
    };
    publicMappingWorkspaceState[key] = {
        ...currentState,
        ...nextState,
        mappings: Object.prototype.hasOwnProperty.call(nextState, 'mappings')
            ? (Array.isArray(nextState.mappings) ? nextState.mappings : [])
            : currentState.mappings
    };

    if (key === 'asset_name_mapping') {
        if (Object.prototype.hasOwnProperty.call(nextState, 'config')) {
            assetNameMappingsData = nextState.config;
        }
        if (Object.prototype.hasOwnProperty.call(nextState, 'mappings')) {
            allAssetNameMappings = Array.isArray(nextState.mappings) ? nextState.mappings : [];
        }
        if (Object.prototype.hasOwnProperty.call(nextState, 'currentId')) {
            currentAssetNameMappingId = nextState.currentId;
        }
        return;
    }

    if (key === 'business_system_name_mapping') {
        if (Object.prototype.hasOwnProperty.call(nextState, 'config')) {
            businessSystemMappingsData = nextState.config;
        }
        if (Object.prototype.hasOwnProperty.call(nextState, 'mappings')) {
            allBusinessSystemMappings = Array.isArray(nextState.mappings) ? nextState.mappings : [];
        }
        if (Object.prototype.hasOwnProperty.call(nextState, 'currentId')) {
            currentBusinessSystemMappingId = nextState.currentId;
        }
    }
}

function getPublicConfigFieldMeta(config, fallbackMeta = {}) {
    const schemaFieldMeta = (config && typeof config.field_meta === 'object' ? config.field_meta : null)
        || (config && config.schema && typeof config.schema.field_meta === 'object' ? config.schema.field_meta : {})
        || {};
    const fields = Array.isArray(config?.fields) ? config.fields : [];
    const findFieldLabel = (fieldName, fallbackLabel) => {
        const field = fields.find(item => item && item.name === fieldName);
        return field?.label || fallbackLabel;
    };

    return {
        sourceLabel: schemaFieldMeta.source_label || findFieldLabel('source', fallbackMeta.sourceLabel || '原始值'),
        targetLabel: schemaFieldMeta.target_label || findFieldLabel('target', fallbackMeta.targetLabel || '替换值'),
        enabledLabel: schemaFieldMeta.enabled_label || findFieldLabel('enabled', fallbackMeta.enabledLabel || '是否启用')
    };
}

function getPublicConfigFields(config, fallbackFields = null) {
    const configFields = Array.isArray(config?.fields) && config.fields.length > 0
        ? config.fields
        : null;
    const schemaFields = Array.isArray(config?.schema?.fields) && config.schema.fields.length > 0
        ? config.schema.fields
        : null;
    const fields = configFields || schemaFields || fallbackFields;
    if (Array.isArray(fields) && fields.length > 0) {
        return fields
            .filter(field => field && typeof field === 'object' && String(field.name || '').trim())
            .map(field => ({
                name: String(field.name || '').trim(),
                label: String(field.label || field.name || '').trim(),
                type: String(field.type || 'text').trim(),
                required: field.required === true,
                searchable: field.searchable !== false,
                editable: field.editable !== false,
                visible_in_list: field.visible_in_list !== false,
                width: Number(field.width || 160),
                options: Array.isArray(field.options) ? field.options : [],
                default_value: field.default_value,
                placeholder: field.placeholder || '',
                description: field.description || ''
            }));
    }

    return [
        {
            name: 'source',
            label: '原始值',
            type: 'text',
            required: true,
            searchable: true,
            editable: true,
            visible_in_list: true,
            width: 220,
            placeholder: '请输入原始值'
        },
        {
            name: 'target',
            label: '替换值',
            type: 'text',
            required: true,
            searchable: true,
            editable: true,
            visible_in_list: true,
            width: 220,
            placeholder: '请输入替换值'
        },
        {
            name: 'enabled',
            label: '是否启用',
            type: 'boolean',
            required: false,
            searchable: false,
            editable: true,
            visible_in_list: true,
            width: 100,
            default_value: true
        }
    ];
}

function getPublicConfigStatusFieldName(config) {
    const fields = getPublicConfigFields(config);
    const booleanField = fields.find(field => field.name === 'enabled' || field.type === 'boolean');
    return booleanField ? booleanField.name : '';
}

function getPublicConfigEditableFields(config, fallbackFields = null) {
    return getPublicConfigFields(config, fallbackFields).filter(field => field.editable !== false);
}

function getPublicConfigSearchableFields(config, fallbackFields = null) {
    return getPublicConfigFields(config, fallbackFields).filter(field => field.searchable !== false && field.type !== 'boolean');
}

function getPublicConfigCardFields(config, fallbackFields = null) {
    const statusFieldName = getPublicConfigStatusFieldName(config);
    return getPublicConfigFields(config, fallbackFields).filter(field => {
        if (!field.visible_in_list) {
            return false;
        }
        return field.name !== statusFieldName;
    });
}

function getPublicConfigFieldValue(item, field) {
    if (!item || !field) {
        return '';
    }
    const rawValue = item[field.name];
    if (field.type === 'boolean') {
        return rawValue !== false;
    }
    if (field.type === 'number') {
        if (rawValue === undefined || rawValue === null || rawValue === '') {
            return '';
        }
        const numericValue = Number(rawValue);
        return Number.isFinite(numericValue) ? numericValue : '';
    }
    return rawValue === undefined || rawValue === null ? '' : rawValue;
}

function buildPublicConfigFieldInputHtml(field, value, options = {}) {
    const inputId = options.inputId || `publicConfigField_${field.name}`;
    const label = escapeHtml(field.label || field.name);
    const placeholder = escapeHtml(field.placeholder || `请输入${field.label || field.name}`);
    const helpText = field.description ? `<div style="margin-top: 6px; font-size: 11px; color: #94a3b8; line-height: 1.6;">${escapeHtml(field.description)}</div>` : '';

    if (field.type === 'boolean') {
        return `
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="${inputId}" ${value ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <label for="${inputId}" style="font-size: 14px; color: #333; cursor: pointer;">${label}</label>
            </div>
            ${helpText}
        `;
    }

    if (field.type === 'textarea') {
        return `
            <textarea id="${inputId}" placeholder="${placeholder}" style="width: 100%; min-height: 96px; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical;">${escapeHtml(value)}</textarea>
            ${helpText}
        `;
    }

    if (field.type === 'select') {
        const optionsHtml = field.options.map(option => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionLabel = typeof option === 'object' ? (option.label || option.value) : option;
            const selected = String(value) === String(optionValue) ? 'selected' : '';
            return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(optionLabel)}</option>`;
        }).join('');

        return `
            <select id="${inputId}" style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                <option value="">请选择</option>
                ${optionsHtml}
            </select>
            ${helpText}
        `;
    }

    const inputType = field.type === 'number' ? 'number' : 'text';
    return `
        <input type="${inputType}" id="${inputId}" value="${escapeHtml(value)}" placeholder="${placeholder}" style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        ${helpText}
    `;
}

function getPublicConfigFieldInputValue(field, inputId) {
    const element = document.getElementById(inputId);
    if (!element) {
        return field.type === 'boolean' ? false : '';
    }

    if (field.type === 'boolean') {
        return element.checked === true;
    }

    if (field.type === 'number') {
        const rawValue = element.value.trim();
        if (!rawValue) {
            return '';
        }
        const numericValue = Number(rawValue);
        return Number.isFinite(numericValue) ? numericValue : rawValue;
    }

    return element.value.trim();
}

function getPublicConfigApiValue(config, apiKey, fallbackValue = '') {
    const configKey = String(config?.key || '').trim();
    const genericFallback = (() => {
        if (!configKey) {
            return '';
        }
        if (apiKey === 'detail_api' || apiKey === 'save_api') {
            return `${API_BASE}/public-configs/${configKey}/records`;
        }
        if (apiKey === 'template_api') {
            return `${API_BASE}/public-configs/${configKey}/template`;
        }
        if (apiKey === 'import_api') {
            return `${API_BASE}/public-configs/${configKey}/import`;
        }
        if (apiKey === 'export_api') {
            return `${API_BASE}/public-configs/${configKey}/export`;
        }
        return '';
    })();
    return config?.apis?.[apiKey]
        || config?.[apiKey]
        || publicConfigCenterMap?.[configKey]?.apis?.[apiKey]
        || publicConfigCenterMap?.[configKey]?.[apiKey]
        || genericFallback
        || fallbackValue;
}

function getPublicConfigFilenameValue(config, fileKey, fallbackValue = '') {
    const configKey = String(config?.key || '').trim();
    return config?.[fileKey]
        || config?.config?.[fileKey]
        || publicConfigCenterMap?.[configKey]?.[fileKey]
        || publicConfigCenterMap?.[configKey]?.config?.[fileKey]
        || fallbackValue;
}

function getPublicConfigOperationErrorMessage(rawError, fallbackMessage = '操作失败') {
    const errorText = String(rawError || '').trim();
    if (!errorText) {
        return fallbackMessage;
    }

    if (errorText.includes('映射冲突')) {
        return errorText;
    }

    return errorText;
}

function buildPublicConfigDatedExportFilename(config, fallbackPrefix) {
    const configured = getPublicConfigFilenameValue(config, 'export_filename', '');
    const prefix = (configured || fallbackPrefix || '公共配置导出').replace(/\.xlsx$/i, '');
    const dateText = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}_${dateText}.xlsx`;
}

function renderPublicMappingCards(config, mappings, options = {}) {
    const container = document.getElementById(options.listContainerId);
    const countSpan = document.getElementById(options.countId);
    if (!container) {
        return;
    }

    const fieldMeta = getPublicConfigFieldMeta(config, options.fallbackFieldMeta || {});
    const cardFields = getPublicConfigCardFields(config, options.fallbackFields || null);
    const statusFieldName = getPublicConfigStatusFieldName(config);
    const sourceField = cardFields.find(field => field.name === 'source') || cardFields[0] || { name: 'source', label: fieldMeta.sourceLabel, type: 'text' };
    const targetField = cardFields.find(field => field.name === 'target')
        || cardFields.find(field => field.name !== sourceField.name && field.name !== statusFieldName)
        || null;
    const extraFields = cardFields.filter(field => {
        if (field.name === sourceField.name) {
            return false;
        }
        if (targetField && field.name === targetField.name) {
            return false;
        }
        return field.name !== statusFieldName;
    });
    const emptyTitle = options.emptyTitle || `暂无${config?.name || config?.title || '映射数据'}`;
    const emptyDescription = options.emptyDescription || '点击“新增映射”即可开始维护。';
    const list = Array.isArray(mappings) ? mappings : [];

    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;">&#128193;</div>
                <div>${escapeHtml(emptyTitle)}</div>
                <div style="font-size: 13px; margin-top: 10px;">${escapeHtml(emptyDescription)}</div>
            </div>
        `;
        if (countSpan) {
            countSpan.textContent = '0';
        }
        return;
    }

    if (countSpan) {
        countSpan.textContent = String(list.length);
    }

    const editHandlerName = options.editHandlerName || 'editBusinessSystemMapping';
    const deleteHandlerName = options.deleteHandlerName || 'deleteBusinessSystemMapping';
    container.innerHTML = list.map(mapping => {
        const sourceRawValue = getPublicConfigFieldValue(mapping, sourceField);
        const sourceDisplayValue = sourceRawValue === '' || sourceRawValue === null || sourceRawValue === undefined
            ? '-'
            : sourceRawValue;
        const targetRawValue = targetField ? getPublicConfigFieldValue(mapping, targetField) : '';
        const targetDisplayValue = targetField
            ? ((targetRawValue === '' || targetRawValue === null || targetRawValue === undefined) ? '-' : targetRawValue)
            : '';
        const extraFieldsHtml = extraFields.map(field => {
            const rawValue = getPublicConfigFieldValue(mapping, field);
            const displayValue = field.type === 'boolean'
                ? (rawValue ? '是' : '否')
                : (rawValue === '' ? '-' : rawValue);
            return `
                <div style="min-width: 0; padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${escapeHtml(field.label || field.name)}</div>
                    <div title="${escapeHtml(String(displayValue))}" style="font-size: 12px; color: #0f172a; line-height: 1.5; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(String(displayValue))}</div>
                </div>
            `;
        }).join('');

        return `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                    ${statusFieldName ? `
                        <span style="padding: 3px 10px; border-radius: 999px; font-size: 12px; background: ${(mapping[statusFieldName] !== false) ? '#dcfce7' : '#fee2e2'}; color: ${(mapping[statusFieldName] !== false) ? '#166534' : '#991b1b'};">
                            ${(mapping[statusFieldName] !== false) ? '启用' : '禁用'}
                        </span>
                    ` : '<span></span>'}
                    <div style="display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
                        <button onclick="${editHandlerName}(${mapping.id})" style="padding: 5px 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">编辑</button>
                        <button onclick="${deleteHandlerName}(${mapping.id})" style="padding: 5px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">删除</button>
                    </div>
                </div>
                <div style="display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap;">
                    <div style="flex: 1 1 240px; min-width: 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 10px;">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${escapeHtml(sourceField.label || fieldMeta.sourceLabel)}</div>
                        <div title="${escapeHtml(String(sourceDisplayValue))}" style="font-size: 13px; color: #0f172a; font-weight: 600; line-height: 1.5; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(String(sourceDisplayValue))}</div>
                    </div>
                    ${targetField ? `
                        <div style="display: flex; align-items: center; justify-content: center; flex: 0 0 auto; padding: 0 2px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: #eff6ff; color: #2563eb; font-size: 14px; font-weight: 700;">&#8594;</span>
                        </div>
                        <div style="flex: 1 1 240px; min-width: 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 10px;">
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${escapeHtml(targetField.label || fieldMeta.targetLabel)}</div>
                            <div title="${escapeHtml(String(targetDisplayValue))}" style="font-size: 13px; color: #0f172a; font-weight: 600; line-height: 1.5; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(String(targetDisplayValue))}</div>
                        </div>
                    ` : ''}
                </div>
                ${extraFieldsHtml ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                        ${extraFieldsHtml}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function filterPublicMappingCards(configKey, options = {}) {
    const store = getPublicMappingWorkspaceStore(configKey);
    const config = store.config || {};
    const searchInput = document.getElementById(options.searchInputId);
    const statusFilterInput = document.getElementById(options.statusFilterId);
    const searchValue = String(searchInput?.value || '').toLowerCase();
    const statusFilter = statusFilterInput?.value || '';
    const mappings = Array.isArray(store.mappings) ? store.mappings : [];
    const searchableFields = getPublicConfigSearchableFields(config, options.fallbackFields || null);
    const statusFieldName = getPublicConfigStatusFieldName(config);

    const filtered = mappings.filter(item => {
        const searchableText = searchableFields.map(field => String(getPublicConfigFieldValue(item, field)).toLowerCase()).join(' ');
        const matchSearch = !searchValue || searchableText.includes(searchValue);
        const statusValue = statusFieldName ? item[statusFieldName] !== false : item.enabled !== false;
        const matchStatus = !statusFilter
            || (statusFilter === 'enabled' && statusValue)
            || (statusFilter === 'disabled' && !statusValue);
        return matchSearch && matchStatus;
    });

    renderPublicMappingCards(store.config, filtered, options);
}

function renderPublicMappingDetailWorkspace(config, options = {}) {
    const detailContainer = document.getElementById('publicConfigDetailContent');
    if (!detailContainer) {
        return;
    }

    const normalizedMappings = normalizePublicConfigCenterMappings(
        config.mappings || config.config?.mappings
    );
    setPublicMappingWorkspaceStore(config.key, {
        config,
        mappings: normalizedMappings
    });

    const fieldMeta = getPublicConfigFieldMeta(config, options.fallbackFieldMeta || {});
    const titleText = config.name || config.title || options.titleText || config.key || '公共配置';
    const searchableFields = getPublicConfigSearchableFields(config, options.fallbackFields || null);
    const searchLabels = searchableFields.slice(0, 3).map(field => field.label || field.name).filter(Boolean);
    const searchPlaceholder = options.searchPlaceholder || (
        searchLabels.length > 0
            ? `搜索${searchLabels.join('、')}...`
            : `搜索${fieldMeta.sourceLabel}或${fieldMeta.targetLabel}...`
    );
    const workspaceDescription = options.workspaceDescription || config.description || '统一维护当前公共配置。';
    const operationOverrides = options.operationOverrides || {};
    const toolbarExtraHtml = options.toolbarExtraHtml || '';

    detailContainer.innerHTML = `
        <div class="logic-toolbar-card">
            <div class="logic-toolbar-card__head">
                <div class="logic-toolbar-card__copy">
                    <div class="logic-toolbar-card__title-row">
                        <h3>${escapeHtml(titleText)}</h3>
                        ${renderPublicConfigCenterHeaderActions(config, operationOverrides, 'title')}
                    </div>
                    <p>${escapeHtml(workspaceDescription)}</p>
                </div>
                <div class="logic-toolbar-actions">
                    ${toolbarExtraHtml}
                    ${buildPublicConfigTypeActionButton(config)}
                    ${renderPublicConfigCenterHeaderActions(config, operationOverrides, 'toolbar')}
                </div>
            </div>
        </div>

        <div class="logic-filter-card">
            <div class="logic-filter-bar">
                <div class="logic-filter-group">
                    <label class="logic-filter-label">搜索</label>
                    <input type="text" id="${options.searchInputId}" class="logic-filter-input logic-filter-input--wide" placeholder="${escapeHtml(searchPlaceholder)}" oninput="${options.filterHandlerName}()">
                </div>
                <div class="logic-filter-group">
                    <label class="logic-filter-label">状态</label>
                    <select id="${options.statusFilterId}" class="logic-filter-input" onchange="${options.filterHandlerName}()">
                        <option value="">全部</option>
                        <option value="enabled">启用</option>
                        <option value="disabled">禁用</option>
                    </select>
                </div>
                <div class="logic-counter">
                    共 <span id="${options.countId}">0</span> 条映射
                </div>
            </div>
        </div>

        <div id="${options.listContainerId}" class="logic-rules-list"></div>
    `;

    if (typeof window[options.filterHandlerName] === 'function') {
        window[options.filterHandlerName]();
    }
}

function showPublicMappingEditorModal(configKey, options = {}) {
    const store = getPublicMappingWorkspaceStore(configKey);
    const mappingId = store.currentId;
    const config = store.config || {};
    const editableFields = getPublicConfigEditableFields(config, options.fallbackFields || null);
    const mapping = mappingId ? store.mappings.find(item => item.id === mappingId) : null;
    const title = mappingId
        ? `编辑${config.name || config.title || '映射'}`
        : `新增${config.name || config.title || '映射'}`;
    const getInputId = (field) => {
        if (field.name === 'source' && options.sourceInputId) {
            return options.sourceInputId;
        }
        if (field.name === 'target' && options.targetInputId) {
            return options.targetInputId;
        }
        if (field.name === 'enabled' && options.enabledInputId) {
            return options.enabledInputId;
        }
        return `${options.fieldInputPrefix || 'publicMappingField'}_${field.name}`;
    };
    const fieldsHtml = editableFields.map(field => {
        const currentValue = mapping && Object.prototype.hasOwnProperty.call(mapping, field.name)
            ? getPublicConfigFieldValue(mapping, field)
            : (field.default_value !== undefined ? field.default_value : (field.type === 'boolean' ? true : ''));
        const controlHtml = buildPublicConfigFieldInputHtml(field, currentValue, {
            inputId: getInputId(field)
        });
        const requiredText = field.required ? '<span style="color: #dc3545;">*</span>' : '';
        if (field.type === 'boolean') {
            return `<div>${controlHtml}</div>`;
        }
        return `
            <div>
                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 8px;">${escapeHtml(field.label || field.name)}${requiredText}</label>
                ${controlHtml}
            </div>
        `;
    }).join('');

    const modalHtml = `
        <div id="${options.modalId}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: 8px; width: 600px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <div style="padding: 20px 25px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;">${escapeHtml(title)}</h3>
                    <button onclick="${options.closeHandlerName}()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
                </div>
                <div style="padding: 25px;">
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        ${fieldsHtml}
                    </div>
                </div>
                <div style="padding: 15px 25px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="${options.closeHandlerName}()" style="padding: 8px 20px; background: #f8f9fa; color: #666; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
                    <button onclick="${options.saveHandlerName}()" style="padding: 8px 20px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById(options.modalId);
    if (oldModal) {
        oldModal.remove();
    }
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function savePublicMappingEntry(configKey, options = {}) {
    const store = getPublicMappingWorkspaceStore(configKey);
    const config = store.config || {};
    const editableFields = getPublicConfigEditableFields(config, options.fallbackFields || null);
    const payload = {};
    const missingRequiredLabels = [];
    editableFields.forEach(field => {
        const inputId = field.name === 'source' && options.sourceInputId
            ? options.sourceInputId
            : field.name === 'target' && options.targetInputId
            ? options.targetInputId
            : field.name === 'enabled' && options.enabledInputId
            ? options.enabledInputId
            : `${options.fieldInputPrefix || 'publicMappingField'}_${field.name}`;
        const value = getPublicConfigFieldInputValue(field, inputId);
        payload[field.name] = value;

        if (!field.required) {
            return;
        }

        if (field.type === 'boolean') {
            return;
        }

        if (value === '' || value === null || value === undefined) {
            missingRequiredLabels.push(field.label || field.name);
        }
    });

    if (missingRequiredLabels.length > 0) {
        showToast(`请填写${missingRequiredLabels.join('、')}`, true);
        return;
    }

    try {
        const detailApi = getPublicConfigApiValue(config, 'detail_api', options.fallbackDetailApi || '');
        if (!detailApi) {
            showToast('当前配置未登记维护接口', true);
            return;
        }

        let url = detailApi;
        let method = 'POST';
        if (store.currentId) {
            url = `${detailApi}/${store.currentId}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            showToast(store.currentId ? '更新成功' : '添加成功', false);
            if (typeof window[options.closeHandlerName] === 'function') {
                window[options.closeHandlerName]();
            }
            await loadBusinessSystemMappings();
            return;
        }
        showToast(getPublicConfigOperationErrorMessage(result.error, '保存失败'), true);
    } catch (e) {
        console.error('保存公共配置映射失败:', e);
        showToast('保存失败', true);
    }
}

async function deletePublicMappingEntry(configKey, id, options = {}) {
    const store = getPublicMappingWorkspaceStore(configKey);
    const config = store.config || {};
    const confirmText = options.confirmText || '确定要删除这条映射吗？';
    if (!confirm(confirmText)) {
        return;
    }

    try {
        const detailApi = getPublicConfigApiValue(config, 'detail_api', options.fallbackDetailApi || '');
        if (!detailApi) {
            showToast('当前配置未登记删除接口', true);
            return;
        }

        const response = await fetch(`${detailApi}/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            showToast('删除成功', false);
            await loadBusinessSystemMappings();
            return;
        }
        showToast(result.error || '删除失败', true);
    } catch (e) {
        console.error('删除公共配置映射失败:', e);
        showToast('删除失败', true);
    }
}

async function downloadPublicMappingTemplateByConfig(configKey, fallbackFilename = '') {
    const store = getPublicMappingWorkspaceStore(configKey);
    const config = store.config || {};
    try {
        const templateApi = getPublicConfigApiValue(config, 'template_api', '');
        if (!templateApi) {
            showToast('当前配置未登记模板下载接口', true);
            return;
        }

        const response = await fetch(templateApi);
        if (!response.ok) {
            let errorMessage = '模板下载失败';
            try {
                const result = await response.json();
                errorMessage = result.error || errorMessage;
            } catch (parseError) {
                errorMessage = `模板下载失败（HTTP ${response.status}）`;
            }
            throw new Error(errorMessage);
        }

        const filename = getPublicConfigFilenameValue(config, 'template_filename', fallbackFilename || '公共配置_导入模板.xlsx');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('模板下载成功', false);
    } catch (e) {
        console.error('下载公共配置模板失败:', e);
        showToast(e.message || '模板下载失败', true);
    }
}

function importPublicMappingEntriesByConfig(configKey) {
    const store = getPublicMappingWorkspaceStore(configKey);
    const config = store.config || {};
    const importApi = getPublicConfigApiValue(config, 'import_api', '');
    if (!importApi) {
        showToast('当前配置未登记导入接口', true);
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            showToast('正在导入...', false);
            const response = await fetch(importApi, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message || '导入成功', false);
                await loadBusinessSystemMappings();
                return;
            }
            showToast(getPublicConfigOperationErrorMessage(result.error, '导入失败'), true);
        } catch (e) {
            console.error('导入公共配置映射失败:', e);
            showToast('导入失败', true);
        }
    };

    input.click();
}

async function exportPublicMappingEntriesByConfig(configKey, fallbackPrefix = '') {
    const store = getPublicMappingWorkspaceStore(configKey);
    const config = store.config || {};
    const exportApi = getPublicConfigApiValue(config, 'export_api', '');
    if (!exportApi) {
        showToast('当前配置未登记导出接口', true);
        return;
    }

    try {
        showToast('正在导出...', false);
        const response = await fetch(exportApi);
        if (!response.ok) {
            const result = await response.json();
            showToast(result.error || '导出失败', true);
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildPublicConfigDatedExportFilename(config, fallbackPrefix || config.name || '公共配置导出');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('导出成功', false);
    } catch (e) {
        console.error('导出公共配置映射失败:', e);
        showToast('导出失败', true);
    }
}

function renderBusinessSystemMappingDetailWorkspace(config) {
    const operationOverrides = {
        help: {
            title: '配置说明',
            description: '查看当前映射的口径说明和使用方法。',
            meta_text: 'help: showBusinessSystemMappingHelp()',
            button_text: '说明',
            onClick: 'showBusinessSystemMappingHelp()',
            registered: true,
            placements: ['title', 'panel']
        },
        create: {
            title: '映射维护',
            description: '新增或维护业务系统名称映射，影响已接线报表的名称标准化。',
            meta_text: 'action: showBusinessSystemMappingEditor()',
            button_text: '+ 新增映射',
            onClick: 'showBusinessSystemMappingEditor()',
            registered: true,
            placements: ['toolbar']
        },
        template: {
            description: '下载 Excel 模板后可按批量结构维护映射关系。',
            meta_text: `template_api: ${getPublicConfigApiValue(config, 'template_api', '未登记')}`,
            onClick: 'downloadBusinessSystemMappingTemplate()',
            registered: true,
            placements: ['toolbar', 'panel']
        },
        import: {
            description: '导入 Excel 文件批量更新业务系统名称映射。',
            meta_text: `import_api: ${getPublicConfigApiValue(config, 'import_api', '未登记')}`,
            onClick: 'importBusinessSystemMappings()',
            registered: true,
            placements: ['toolbar', 'panel']
        },
        export: {
            description: '导出当前映射配置，便于归档、比对和跨环境复用。',
            meta_text: `export_api: ${getPublicConfigApiValue(config, 'export_api', '未登记')}`,
            onClick: 'exportBusinessSystemMappings()',
            registered: true,
            placements: ['toolbar', 'panel']
        }
    };

    renderPublicMappingDetailWorkspace(config, {
        listContainerId: 'businessSystemMappingsList',
        countId: 'businessSystemMappingCount',
        searchInputId: 'businessSystemMappingSearch',
        statusFilterId: 'businessSystemMappingStatusFilter',
        filterHandlerName: 'filterBusinessSystemMappings',
        editHandlerName: 'editBusinessSystemMapping',
        deleteHandlerName: 'deleteBusinessSystemMapping',
        operationOverrides,
        toolbarExtraHtml: `
            <button class="page-reporting-action page-reporting-action--ghost" type="button" onclick="showBusinessSystemMappingUsageDetailModal()">
                详情
            </button>
        `,
        workspaceDescription: '管理合并结果表与数据概览表之间的业务系统名称映射关系。当前这项公共配置已接入导出链路。',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: '暂无业务系统名称映射',
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

function renderGenericPublicMappingTableWorkspace(config) {
    const operationOverrides = {
        create: {
            title: '配置维护',
            description: '当前配置已登记维护能力，可继续在前端维护映射数据。',
            meta_text: `detail_api: ${getPublicConfigApiValue(config, 'detail_api', '未登记')}`,
            button_text: '+ 新增映射',
            onClick: 'showGenericPublicMappingEditor()',
            registered: Boolean(getPublicConfigApiValue(config, 'detail_api', '')),
            placements: ['toolbar']
        },
        template: {
            description: '模板下载入口已按公共配置元数据自动解析。',
            meta_text: `template_api: ${getPublicConfigApiValue(config, 'template_api', '未登记')}`,
            button_text: '下载模板',
            onClick: `downloadPublicMappingTemplateByConfig('${config.key}', '${getPublicConfigFilenameValue(config, 'template_filename', '公共配置_导入模板.xlsx')}')`,
            registered: Boolean(getPublicConfigApiValue(config, 'template_api', '')),
            placements: ['toolbar', 'panel']
        },
        import: {
            description: '导入入口已按公共配置元数据自动解析。',
            meta_text: `import_api: ${getPublicConfigApiValue(config, 'import_api', '未登记')}`,
            button_text: '导入',
            onClick: `importPublicMappingEntriesByConfig('${config.key}')`,
            registered: Boolean(getPublicConfigApiValue(config, 'import_api', '')),
            placements: ['toolbar', 'panel']
        },
        export: {
            description: '导出入口已按公共配置元数据自动解析。',
            meta_text: `export_api: ${getPublicConfigApiValue(config, 'export_api', '未登记')}`,
            button_text: '导出',
            onClick: `exportPublicMappingEntriesByConfig('${config.key}', '${config.name || config.title || '公共配置'}')`,
            registered: Boolean(getPublicConfigApiValue(config, 'export_api', '')),
            placements: ['toolbar', 'panel']
        }
    };

    renderPublicMappingDetailWorkspace(config, {
        listContainerId: 'genericPublicMappingsList',
        countId: 'genericPublicMappingCount',
        searchInputId: 'genericPublicMappingSearch',
        statusFilterId: 'genericPublicMappingStatusFilter',
        filterHandlerName: 'filterGenericPublicMappings',
        editHandlerName: 'editGenericPublicMapping',
        deleteHandlerName: 'deleteGenericPublicMapping',
        operationOverrides,
        workspaceDescription: config.description || '当前公共配置已按统一映射表工作区展示，可直接复用搜索、编辑、导入导出能力。',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: `暂无${config.name || config.title || '映射数据'}`,
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

function closeAssetNameMappingHelpModal() {
    const modal = document.getElementById('assetNameMappingHelpModal');
    if (modal) {
        modal.remove();
    }
}

function handleAssetNameMappingHelpOverlayClick(event) {
    if (event && event.target && event.target.id === 'assetNameMappingHelpModal') {
        closeAssetNameMappingHelpModal();
    }
}

function showAssetNameMappingHelp() {
    closeAssetNameMappingHelpModal();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay show" id="assetNameMappingHelpModal" onclick="handleAssetNameMappingHelpOverlayClick(event)" style="z-index: 10020;">
            <div class="modal-content" style="width: min(640px, 92vw); max-width: 640px; max-height: 84vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                <div class="modal-header" style="padding: 18px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">资产名称映射说明</h3>
                        <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">这是一套预留骨架，用于后续统一不同报表中的资产名称口径。</div>
                    </div>
                    <button class="modal-close" type="button" onclick="closeAssetNameMappingHelpModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px 24px; display: grid; gap: 12px; overflow-y: auto; background: #f7faff;">
                    <div style="padding: 14px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; color: #475569; font-size: 13px; line-height: 1.8;">
                        当前页面已经接通新增、编辑、删除、导入、导出和模板下载能力，可先维护映射数据。
                    </div>
                    <div style="padding: 14px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; color: #475569; font-size: 13px; line-height: 1.8;">
                        具体哪些报表、哪些列要使用“资产名称映射”，仍由你后续决定。当前这一步只负责把公共配置维护能力准备好。
                    </div>
                </div>
                <div class="modal-footer" style="padding: 14px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: flex-end;">
                    <button class="btn" type="button" onclick="closeAssetNameMappingHelpModal()">关闭</button>
                </div>
            </div>
        </div>
    `);
}

function getAssetNameMappingFieldMeta() {
    return getPublicConfigFieldMeta(assetNameMappingsData, {
        sourceLabel: '原始值',
        targetLabel: '替换值',
        enabledLabel: '是否启用'
    });
}

function renderAssetNameMappings(mappings) {
    renderPublicMappingCards(assetNameMappingsData, mappings, {
        listContainerId: 'assetNameMappingsList',
        countId: 'assetNameMappingCount',
        editHandlerName: 'editAssetNameMapping',
        deleteHandlerName: 'deleteAssetNameMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: '暂无资产名称映射',
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

function filterAssetNameMappings() {
    filterPublicMappingCards('asset_name_mapping', {
        listContainerId: 'assetNameMappingsList',
        countId: 'assetNameMappingCount',
        searchInputId: 'assetNameMappingSearch',
        statusFilterId: 'assetNameMappingStatusFilter',
        editHandlerName: 'editAssetNameMapping',
        deleteHandlerName: 'deleteAssetNameMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: '暂无资产名称映射',
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

function renderAssetNameMappingDetailWorkspace(config) {
    const operationOverrides = {
        help: {
            title: '配置说明',
            description: '查看资产名称映射的适用范围和后续扩展方向。',
            meta_text: 'help: showAssetNameMappingHelp()',
            button_text: '说明',
            onClick: 'showAssetNameMappingHelp()',
            registered: true,
            placements: ['title']
        },
        create: {
            title: '映射维护',
            description: '新增或维护资产名称映射，先把公共配置数据准备好。',
            meta_text: 'action: showAssetNameMappingEditor()',
            button_text: '+ 新增映射',
            onClick: 'showAssetNameMappingEditor()',
            registered: true,
            placements: ['toolbar']
        },
        template: {
            description: '下载 Excel 模板后可按批量结构维护资产名称映射。',
            meta_text: 'action: downloadAssetNameMappingTemplate()',
            button_text: '下载模板',
            onClick: 'downloadAssetNameMappingTemplate()',
            registered: true,
            placements: ['toolbar']
        },
        import: {
            description: '导入 Excel 文件批量更新资产名称映射。',
            meta_text: 'action: importAssetNameMappings()',
            button_text: '导入',
            onClick: 'importAssetNameMappings()',
            registered: true,
            placements: ['toolbar']
        },
        export: {
            description: '导出当前资产名称映射，便于归档、比对和跨环境复用。',
            meta_text: 'action: exportAssetNameMappings()',
            button_text: '导出',
            onClick: 'exportAssetNameMappings()',
            registered: true,
            placements: ['toolbar']
        }
    };

    renderPublicMappingDetailWorkspace(config, {
        listContainerId: 'assetNameMappingsList',
        countId: 'assetNameMappingCount',
        searchInputId: 'assetNameMappingSearch',
        statusFilterId: 'assetNameMappingStatusFilter',
        filterHandlerName: 'filterAssetNameMappings',
        editHandlerName: 'editAssetNameMapping',
        deleteHandlerName: 'deleteAssetNameMapping',
        operationOverrides,
        workspaceDescription: '统一维护资产名称口径。当前已接通前端维护与导入导出能力，是否用于具体报表列仍由你后续决定。',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: '暂无资产名称映射',
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

function showAssetNameMappingEditor(mappingId = null) {
    setPublicMappingWorkspaceStore('asset_name_mapping', { currentId: mappingId });
    showPublicMappingEditorModal('asset_name_mapping', {
        modalId: 'assetNameMappingEditorModal',
        sourceInputId: 'assetMappingSource',
        targetInputId: 'assetMappingTarget',
        enabledInputId: 'assetMappingEnabled',
        closeHandlerName: 'closeAssetNameMappingEditor',
        saveHandlerName: 'saveAssetNameMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

function closeAssetNameMappingEditor() {
    const modal = document.getElementById('assetNameMappingEditorModal');
    if (modal) modal.remove();
    setPublicMappingWorkspaceStore('asset_name_mapping', { currentId: null });
}

async function saveAssetNameMapping() {
    await savePublicMappingEntry('asset_name_mapping', {
        sourceInputId: 'assetMappingSource',
        targetInputId: 'assetMappingTarget',
        enabledInputId: 'assetMappingEnabled',
        closeHandlerName: 'closeAssetNameMappingEditor',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

function editAssetNameMapping(id) {
    showAssetNameMappingEditor(id);
}

async function deleteAssetNameMapping(id) {
    await deletePublicMappingEntry('asset_name_mapping', id, {
        confirmText: '确定要删除这条资产名称映射吗？'
    });
}

async function downloadAssetNameMappingTemplate() {
    await downloadPublicMappingTemplateByConfig('asset_name_mapping', '资产名称映射_导入模板.xlsx');
}

function importAssetNameMappings() {
    importPublicMappingEntriesByConfig('asset_name_mapping');
}

async function exportAssetNameMappings() {
    await exportPublicMappingEntriesByConfig('asset_name_mapping', '资产名称映射');
}

function filterGenericPublicMappings() {
    filterPublicMappingCards(currentPublicConfigKey, {
        listContainerId: 'genericPublicMappingsList',
        countId: 'genericPublicMappingCount',
        searchInputId: 'genericPublicMappingSearch',
        statusFilterId: 'genericPublicMappingStatusFilter',
        editHandlerName: 'editGenericPublicMapping',
        deleteHandlerName: 'deleteGenericPublicMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

function showGenericPublicMappingEditor(mappingId = null) {
    setPublicMappingWorkspaceStore(currentPublicConfigKey, { currentId: mappingId });
    showPublicMappingEditorModal(currentPublicConfigKey, {
        modalId: 'genericPublicMappingEditorModal',
        sourceInputId: 'genericMappingSource',
        targetInputId: 'genericMappingTarget',
        enabledInputId: 'genericMappingEnabled',
        closeHandlerName: 'closeGenericPublicMappingEditor',
        saveHandlerName: 'saveGenericPublicMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

function closeGenericPublicMappingEditor() {
    const modal = document.getElementById('genericPublicMappingEditorModal');
    if (modal) modal.remove();
    setPublicMappingWorkspaceStore(currentPublicConfigKey, { currentId: null });
}

async function saveGenericPublicMapping() {
    await savePublicMappingEntry(currentPublicConfigKey, {
        sourceInputId: 'genericMappingSource',
        targetInputId: 'genericMappingTarget',
        enabledInputId: 'genericMappingEnabled',
        closeHandlerName: 'closeGenericPublicMappingEditor',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

function editGenericPublicMapping(id) {
    showGenericPublicMappingEditor(id);
}

async function deleteGenericPublicMapping(id) {
    await deletePublicMappingEntry(currentPublicConfigKey, id, {
        confirmText: '确定要删除这条公共配置映射吗？'
    });
}

function closeBusinessSystemMappingUsageDetailModal() {
    const modal = document.getElementById('businessSystemMappingUsageDetailModal');
    if (modal) {
        modal.remove();
    }
}

function handleBusinessSystemMappingUsageDetailOverlayClick(event) {
    if (event && event.target && event.target.id === 'businessSystemMappingUsageDetailModal') {
        closeBusinessSystemMappingUsageDetailModal();
    }
}

function buildBusinessSystemMappingUsageDetailHtml() {
    const usageList = Array.isArray(businessSystemMappingsData?.binding_usages)
        ? businessSystemMappingsData.binding_usages
        : (Array.isArray(businessSystemMappingsData?.used_by) ? businessSystemMappingsData.used_by : []);

    if (usageList.length === 0) {
        return `
            <div style="padding: 14px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b; font-size: 13px; line-height: 1.8;">
                当前还没有报表引用这条规则。
            </div>
        `;
    }

    return `
        <div style="display: grid; gap: 10px;">
            ${usageList.map(item => `
                <div style="padding: 14px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <div style="font-size: 14px; font-weight: 700; color: #1f2937;">${escapeHtml(item.report_name || item.report_code || '-')}</div>
                    <div style="margin-top: 6px; font-size: 12px; color: #64748b; line-height: 1.8;">
                        ${escapeHtml(item.category || '-')}/${escapeHtml(item.report_code || '-')}
                        ${Array.isArray(item.target_columns) && item.target_columns.length > 0
                            ? ` · 引用列 ${escapeHtml(item.target_columns.join(', '))}`
                            : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function showBusinessSystemMappingUsageDetailModal() {
    if (!businessSystemMappingsData) {
        showToast('当前没有可查看的引用详情', true);
        return;
    }

    closeBusinessSystemMappingUsageDetailModal();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay show" id="businessSystemMappingUsageDetailModal" onclick="handleBusinessSystemMappingUsageDetailOverlayClick(event)" style="z-index: 10020;">
            <div class="modal-content" style="width: min(680px, 92vw); max-width: 680px; max-height: 84vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                <div class="modal-header" style="padding: 18px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">规则引用详情</h3>
                        <div style="margin-top: 6px; font-size: 12px; opacity: 0.92;">查看当前有哪些报表引用了业务系统名称映射规则。</div>
                    </div>
                    <button class="modal-close" type="button" onclick="closeBusinessSystemMappingUsageDetailModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px 24px; display: grid; gap: 14px; overflow-y: auto; background: #f7faff;">
                    ${buildBusinessSystemMappingUsageDetailHtml()}
                </div>
                <div class="modal-footer" style="padding: 14px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: flex-end;">
                    <button class="btn" type="button" onclick="closeBusinessSystemMappingUsageDetailModal()">关闭</button>
                </div>
            </div>
        </div>
    `);
}

async function selectPublicConfigCenterItem(configKey) {
    currentPublicConfigKey = configKey;
    renderPublicConfigCenterList(publicConfigCenterData);

    const configMeta = publicConfigCenterMap[configKey];
    if (!configMeta) {
        updatePublicConfigCenterWorkspace(null);
        renderPublicConfigCenterEmptyState('未找到公共配置定义', '请刷新页面后重试。');
        return;
    }

    updatePublicConfigCenterWorkspace(configMeta);

    try {
        let resolvedConfig = { ...configMeta };
        if (configMeta.detail_api) {
            const response = await fetch(configMeta.detail_api);
            const result = await response.json();
            if (result.success && result.data) {
                const detailData = result.data || {};
                resolvedConfig = {
                    ...detailData,
                    ...configMeta,
                    config: {
                        ...(configMeta.config || {}),
                        ...(detailData.config || {})
                    },
                    schema: {
                        ...(configMeta.schema || {}),
                        ...(detailData.schema || {})
                    },
                    capabilities: {
                        ...(configMeta.capabilities || {}),
                        ...(detailData.capabilities || {})
                    },
                    apis: {
                        ...(configMeta.apis || {}),
                        ...(detailData.apis || {})
                    },
                    fields: Array.isArray(detailData.fields) && detailData.fields.length > 0
                        ? detailData.fields
                        : (configMeta.fields || []),
                    mappings: detailData.mappings !== undefined ? detailData.mappings : configMeta.mappings,
                    total_count: detailData.total_count !== undefined ? detailData.total_count : configMeta.total_count,
                    last_updated: detailData.last_updated || configMeta.last_updated,
                    version: detailData.version || configMeta.version
                };
            }
        }

        updatePublicConfigCenterWorkspace(resolvedConfig);

        if (
            resolvedConfig.key === 'business_system_name_mapping'
            || resolvedConfig.editor_mode === 'business_system_name_mapping'
        ) {
            renderBusinessSystemMappingDetailWorkspace(resolvedConfig);
        } else if (
            resolvedConfig.key === 'asset_name_mapping'
            || resolvedConfig.editor_mode === 'asset_name_mapping'
        ) {
            renderAssetNameMappingDetailWorkspace(resolvedConfig);
        } else if (resolvedConfig.config_type === 'mapping_table') {
            renderGenericPublicMappingTableWorkspace(resolvedConfig);
        } else {
            renderGenericPublicConfigCenterDetail(resolvedConfig);
        }
    } catch (e) {
        console.error('加载公共配置详情失败:', e);
        renderPublicConfigCenterEmptyState('加载公共配置失败', '请稍后重试，或检查后端接口是否正常。');
        showToast('加载公共配置失败', true);
    }
}

// 加载公共配置中心及业务系统映射列表
async function loadBusinessSystemMappings() {
    try {
        await ensurePublicConfigCenterDataLoaded(true);

        renderPublicConfigCenterList(publicConfigCenterData);

        const nextKey = currentPublicConfigKey && publicConfigCenterMap[currentPublicConfigKey]
            ? currentPublicConfigKey
            : (publicConfigCenterData[0]?.key || '');

        if (nextKey) {
            await selectPublicConfigCenterItem(nextKey);
            return;
        }

        currentPublicConfigKey = '';
        updatePublicConfigCenterWorkspace(null);
        renderPublicConfigCenterEmptyState('暂无公共配置项', '后续新增配置后会自动出现在这里。');
    } catch (e) {
        console.error('加载公共配置中心失败:', e);
        publicConfigCenterData = [];
        publicConfigCenterMap = {};
        currentPublicConfigKey = '';
        updatePublicConfigCenterWorkspace(null);
        renderPublicConfigCenterList([]);
        renderPublicConfigCenterEmptyState('加载公共配置失败', '请检查网络或后端接口后重试。');
        showToast('加载公共配置失败', true);
    }
}

// 渲染业务系统映射列表
function renderBusinessSystemMappings(mappings) {
    renderPublicMappingCards(businessSystemMappingsData, mappings, {
        listContainerId: 'businessSystemMappingsList',
        countId: 'businessSystemMappingCount',
        editHandlerName: 'editBusinessSystemMapping',
        deleteHandlerName: 'deleteBusinessSystemMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: '暂无业务系统名称映射',
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

// 筛选业务系统映射
function filterBusinessSystemMappings() {
    filterPublicMappingCards('business_system_name_mapping', {
        listContainerId: 'businessSystemMappingsList',
        countId: 'businessSystemMappingCount',
        searchInputId: 'businessSystemMappingSearch',
        statusFilterId: 'businessSystemMappingStatusFilter',
        editHandlerName: 'editBusinessSystemMapping',
        deleteHandlerName: 'deleteBusinessSystemMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        },
        emptyTitle: '暂无业务系统名称映射',
        emptyDescription: '点击“新增映射”即可开始维护。'
    });
}

// 显示新增/编辑映射弹窗
function showBusinessSystemMappingEditor(mappingId = null) {
    setPublicMappingWorkspaceStore('business_system_name_mapping', { currentId: mappingId });
    showPublicMappingEditorModal('business_system_name_mapping', {
        modalId: 'businessSystemMappingEditorModal',
        sourceInputId: 'mappingSource',
        targetInputId: 'mappingTarget',
        enabledInputId: 'mappingEnabled',
        closeHandlerName: 'closeBusinessSystemMappingEditor',
        saveHandlerName: 'saveBusinessSystemMapping',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

// 关闭映射编辑弹窗
function closeBusinessSystemMappingEditor() {
    const modal = document.getElementById('businessSystemMappingEditorModal');
    if (modal) modal.remove();
    setPublicMappingWorkspaceStore('business_system_name_mapping', { currentId: null });
}

// 保存映射
async function saveBusinessSystemMapping() {
    await savePublicMappingEntry('business_system_name_mapping', {
        sourceInputId: 'mappingSource',
        targetInputId: 'mappingTarget',
        enabledInputId: 'mappingEnabled',
        closeHandlerName: 'closeBusinessSystemMappingEditor',
        fallbackFieldMeta: {
            sourceLabel: '原始值',
            targetLabel: '替换值',
            enabledLabel: '是否启用'
        }
    });
}

// 编辑映射
function editBusinessSystemMapping(id) {
    showBusinessSystemMappingEditor(id);
}

// 删除映射
async function deleteBusinessSystemMapping(id) {
    await deletePublicMappingEntry('business_system_name_mapping', id, {
        confirmText: '确定要删除这条业务系统名称映射吗？'
    });
}

// 下载模板
async function downloadBusinessSystemMappingTemplate() {
    await downloadPublicMappingTemplateByConfig('business_system_name_mapping', '业务系统名称映射_导入模板.xlsx');
}

// 导入映射
function importBusinessSystemMappings() {
    importPublicMappingEntriesByConfig('business_system_name_mapping');
}

// 导出映射
async function exportBusinessSystemMappings() {
    await exportPublicMappingEntriesByConfig('business_system_name_mapping', '业务系统名称映射');
}

// HTML转义辅助函数

function toggleRuleTemplatesPanel() {
    const content = document.getElementById('ruleTemplatesPanelContent');
    const arrow = document.getElementById('ruleTemplatesPanelArrow');
    if (!content || !arrow) {
        return;
    }

    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
        if (document.getElementById('ruleTemplatesList')?.children.length === 0) {
            loadRuleTemplatesList();
        }
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

async function loadLogicRulesWithTemplates() {
    ensurePublicConfigCenterDataLoaded().catch(() => {});
    loadRuleTemplatesList();
    loadLogicRulesList();
}

async function loadRuleTemplatesList() {
    try {
        const res = await fetch(API_BASE + '/logic-rules');
        const result = await res.json();

        if (result.success && result.data) {
            logicRuleTypesReference = result.data.rule_types_reference || {};
            const ruleTypes = getLogicRuleTypeCatalog();
            const container = document.getElementById('ruleTemplatesList');
            if (!container) {
                return;
            }

            if (Object.keys(ruleTypes).length === 0) {
                container.innerHTML = '<div style="padding: 30px; text-align: center; color: #999;">\u6682\u65e0\u89c4\u5219\u6a21\u677f</div>';
                return;
            }

            const categories = {};
            Object.keys(LOGIC_RULE_CATEGORY_CONFIG).forEach(key => {
                categories[key] = { ...LOGIC_RULE_CATEGORY_CONFIG[key], types: [] };
            });

            Object.entries(ruleTypes).forEach(([id, type]) => {
                const category = type.category || 'basic';
                if (categories[category]) {
                    categories[category].types.push({ id, ...type });
                }
            });

            let html = '';
            Object.entries(categories)
                .sort((a, b) => a[1].order - b[1].order)
                .forEach(([, cat]) => {
                    if (cat.types.length === 0) return;

                    html += `
                        <div style="grid-column: 1 / -1; padding: 10px 15px; background: ${cat.color}10; border-left: 4px solid ${cat.color}; border-radius: 6px; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="padding: 4px 10px; background: ${cat.color}; color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">${cat.types.length}</span>
                                <span style="font-size: 14px; font-weight: 600; color: ${cat.color};">${cat.name}</span>
                            </div>
                        </div>
                    `;

                    cat.types.forEach(type => {
                        html += `
                            <div style="background: white; border: 1px solid #e9ecef; border-left: 3px solid ${cat.color}; border-radius: 8px; padding: 15px; transition: all 0.3s; hover: box-shadow 0 4px 12px rgba(0,0,0,0.1); cursor: pointer;" onclick="useRuleTemplate('${type.id}', '${type.name.replace(/'/g, "\\'")}', '${cat.name}')">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="padding: 4px 10px; background: ${cat.color}15; color: ${cat.color}; border-radius: 12px; font-size: 11px; font-weight: 600;">${cat.name}</span>
                                </div>
                                <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px;">${type.name}</div>
                                <div style="font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 10px;">${type.description}</div>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="font-size: 11px; color: #999; padding: 4px 8px; background: #f8f9fa; border-radius: 4px;">ID: ${type.id}</div>
                                    <div style="padding: 6px 14px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500;">\u4f7f\u7528\u6a21\u677f \u2192</div>
                                </div>
                            </div>
                        `;
                    });
                });

            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Failed to load rule templates:', error);
        const container = document.getElementById('ruleTemplatesList');
        if (container) {
            container.innerHTML = '<div style="padding: 30px; text-align: center; color: #dc3545;">\u52a0\u8f7d\u5931\u8d25</div>';
        }
    }
}

async function useRuleTemplate(typeId, typeName, categoryName) {
    await showLogicRuleEditor();

    const modal = document.getElementById('logicRuleEditorModal');
    const title = document.getElementById('logicRuleEditorTitle');
    const typeSelect = document.getElementById('logicRuleType');

    if (!modal || !title || !typeSelect) {
        showToast('\u89c4\u5219\u7f16\u8f91\u5668\u5c1a\u672a\u521d\u59cb\u5316', true);
        return;
    }

    title.textContent = '\u65b0\u5efa\u89c4\u5219 - \u4f7f\u7528' + typeName;

    const selectedType = Array.from(typeSelect.options).some(option => option.value === typeId)
        ? typeId
        : 'conditional';
    typeSelect.value = selectedType;
    if (typeof onLogicRuleTypeChange === 'function') {
        onLogicRuleTypeChange(selectedType);
    }

    const nameInput = document.getElementById('logicRuleName');
    const descInput = document.getElementById('logicRuleDescription');
    if (!nameInput || !descInput) {
        showToast('\u89c4\u5219\u7f16\u8f91\u5668\u5c1a\u672a\u521d\u59cb\u5316', true);
        return;
    }

    nameInput.value = '\u6211\u7684' + typeName;
    descInput.value = '\u57fa\u4e8e"' + typeName + '"\u6a21\u677f\u521b\u5efa\u7684\u89c4\u5219';

    modal.style.display = 'flex';
    showToast('\u5df2\u52a0\u8f7d\u6a21\u677f\uff0c\u8bf7\u5b8c\u5584\u914d\u7f6e\u540e\u4fdd\u5b58', false);
}

async function showLogicRuleEditor(ruleId = null) {
    const modal = document.getElementById('logicRuleEditorModal');
    const title = document.getElementById('logicRuleEditorTitle');
    if (!modal || !title) {
        showToast('\u89c4\u5219\u7f16\u8f91\u5668\u5c1a\u672a\u521d\u59cb\u5316', true);
        return;
    }

    if (ruleId) {
        const rule = allLogicRules.find(r => r.id === ruleId);
        if (!rule) {
            showToast('\u89c4\u5219\u4e0d\u5b58\u5728', true);
            return;
        }
        currentLogicRule = rule;
        title.textContent = '\u7f16\u8f91\u903b\u8f91\u6a21\u5757';
        await ensureLogicRuleEditorColumnsLoaded(rule);
        renderLogicRuleEditor(rule);
    } else {
        currentLogicRule = null;
        title.textContent = '\u65b0\u5efa\u903b\u8f91\u6a21\u5757';
        await ensureLogicRuleEditorColumnsLoaded({ source_field: { data_source: 'merge_results' } });
        renderLogicRuleEditor({ type: 'conditional' });
    }

    modal.style.display = 'flex';
}

function renderLogicRuleEditor(rule) {
    const container = document.getElementById('logicRuleEditorBody');
    if (!container) {
        return;
    }

    const nextRule = rule || { type: 'conditional' };
    const type = nextRule.type || 'conditional';
    const typeMeta = getLogicRuleTypeMeta(type);
    const definition = getLogicRuleDynamicDefinition(type);

    container.innerHTML = definition
        ? renderLogicRuleDynamicEditor(nextRule, type, typeMeta, definition)
        : renderLogicRuleLegacyEditor(nextRule, type, typeMeta);
}

function closeLogicRuleEditor() {
    const modal = document.getElementById('logicRuleEditorModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentLogicRule = null;
}

async function saveLogicRule() {
    const ruleData = collectCurrentLogicRuleDraft();
    if (!ruleData) {
        return;
    }
    if (!ruleData.name) {
        showToast('\u8bf7\u8f93\u5165\u89c4\u5219\u540d\u79f0', true);
        return;
    }

    try {
        let res;
        if (currentLogicRule) {
            res = await fetch(API_BASE + `/logic-rules/${currentLogicRule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ruleData)
            });
        } else {
            res = await fetch(API_BASE + '/logic-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ruleData)
            });
        }

        const result = await res.json();
        if (result.success) {
            showToast(currentLogicRule ? '\u89c4\u5219\u66f4\u65b0\u6210\u529f' : '\u89c4\u5219\u521b\u5efa\u6210\u529f', false);
            closeLogicRuleEditor();
            loadLogicRulesList();
        } else {
            showToast('\u4fdd\u5b58\u5931\u8d25: ' + (result.error || '\u672a\u77e5\u9519\u8bef'), true);
        }
    } catch (error) {
        console.error('Failed to save logic rule:', error);
        showToast('\u4fdd\u5b58\u5931\u8d25: ' + error.message, true);
    }
}

function collectCurrentLogicRuleDraft() {
    const name = document.getElementById('logicRuleName')?.value.trim() || '';
    const type = document.getElementById('logicRuleType')?.value || 'conditional';
    const description = document.getElementById('logicRuleDescription')?.value.trim() || '';
    const definition = getLogicRuleDynamicDefinition(type);

    if (definition) {
        syncLogicRuleDynamicJsonFromForm();
        const configElement = document.getElementById('logicRuleConfigJson');
        if (!configElement) {
            showToast('\u6a21\u5757\u914d\u7f6e\u533a\u57df\u672a\u521d\u59cb\u5316', true);
            return null;
        }

        let configData = {};
        try {
            configData = JSON.parse(configElement.value || '{}');
        } catch (error) {
            showToast('JSON \u914d\u7f6e\u683c\u5f0f\u9519\u8bef\uff1a' + error.message, true);
            return null;
        }

        const structuredPatch = collectLogicRuleStructuredJsonPatch(type);
        if ((type === 'multi_conditional' || type === 'conditional_groups') && !structuredPatch) {
            return null;
        }
        if (structuredPatch) {
            Object.assign(configData, structuredPatch);
        }
        configData = sanitizeLogicRuleDynamicConfigData(type, configData);

        const fallbackSourceField = currentLogicRule?.source_field || {
            data_source: 'merge_results',
            field_index: 0,
            field_name: ''
        };
        const sourceField = deriveLogicRuleSourceField(type, definition, configData, fallbackSourceField);
        return {
            name,
            type,
            description,
            source_field: sourceField,
            ...configData
        };
    }

    const dataSource = document.getElementById('logicRuleDataSource')?.value || 'merge_results';
    const fieldIndex = parseInt(document.getElementById('logicRuleFieldIndex')?.value, 10);
    const fieldName = document.getElementById('logicRuleFieldName')?.value.trim() || '';
    const defaultValue = document.getElementById('logicRuleDefaultValue')?.value || '';
    const conditions = [];

    document.querySelectorAll('.logic-rule-condition-row').forEach((row, idx) => {
        const match = row.querySelector('.cond-match-input')?.value.trim() || '';
        const result = row.querySelector('.cond-result-input')?.value.trim() || '';
        const isRegex = row.querySelector('.cond-regex-checkbox')?.checked === true;
        if (match && result) {
            conditions.push({
                field_index: idx,
                match,
                result,
                regex: isRegex
            });
        }
    });

    const ruleData = {
        name,
        type,
        description,
        source_field: {
            data_source: dataSource,
            field_index: Number.isFinite(fieldIndex) ? fieldIndex : 0,
            field_name: fieldName
        },
        conditions,
        default: defaultValue
    };

    if (type === 'multi_conditional' && conditions.length > 0) {
        ruleData.logic = 'AND';
        ruleData.result = conditions[0].result || '';
    }
    return ruleData;
}

function editLogicRule(ruleId) {
    showLogicRuleEditor(ruleId);
}

async function deleteLogicRule(ruleId) {
    const rule = allLogicRules.find(r => r.id === ruleId);
    if (!rule) {
        showToast('\u89c4\u5219\u4e0d\u5b58\u5728', true);
        return;
    }

    const confirmMsg = `\u786e\u8ba4\u8981\u5220\u9664\u89c4\u5219"${rule.name}"\u5417\uff1f\n\n`;
    if (rule.usage_count > 0) {
        alert(`\u8be5\u89c4\u5219\u6b63\u5728\u88ab\u4f7f\u7528\uff08\u4f7f\u7528\u6b21\u6570\uff1a${rule.usage_count}\uff09\uff0c\u65e0\u6cd5\u5220\u9664\uff01`);
        return;
    }
    if (!confirm(confirmMsg + '\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\uff01')) {
        return;
    }

    try {
        const res = await fetch(API_BASE + `/logic-rules/${ruleId}`, {
            method: 'DELETE'
        });
        const result = await res.json();
        if (result.success) {
            showToast('\u89c4\u5219\u5220\u9664\u6210\u529f', false);
            loadLogicRulesList();
        } else {
            showToast('\u5220\u9664\u5931\u8d25: ' + (result.error || '\u672a\u77e5\u9519\u8bef'), true);
        }
    } catch (error) {
        console.error('Failed to delete logic rule:', error);
        showToast('\u5220\u9664\u5931\u8d25: ' + error.message, true);
    }
}

async function testLogicRule() {
    const ruleData = collectCurrentLogicRuleDraft();
    if (!ruleData) {
        return;
    }

    if (!ruleData.name) {
        showToast('\u8bf7\u5148\u586b\u5199\u89c4\u5219\u540d\u79f0', true);
        return;
    }

    if (!['conditional', 'multi_conditional', 'conditional_groups'].includes(ruleData.type)) {
        showToast('\u5f53\u524d\u7c7b\u578b\u6682\u4e0d\u652f\u6301\u5728\u89c4\u5219\u5e93\u5185\u76f4\u63a5\u6d4b\u8bd5\uff0c\u8bf7\u4fdd\u5b58\u540e\u5230\u6620\u5c04\u7f16\u8f91\u533a\u8054\u8c03\u3002', true);
        return;
    }

    if (ruleData.type === 'conditional_groups') {
        if (!Array.isArray(ruleData.groups) || ruleData.groups.length === 0) {
            showToast('\u8bf7\u5148\u81f3\u5c11\u914d\u7f6e\u4e00\u7ec4\u6761\u4ef6\u7ec4', true);
            return;
        }
    } else if (!Array.isArray(ruleData.conditions) || ruleData.conditions.length === 0) {
        showToast('\u8bf7\u5148\u81f3\u5c11\u914d\u7f6e\u4e00\u6761\u6761\u4ef6', true);
        return;
    }

    let payload = { rule: ruleData };
    if (ruleData.type === 'conditional') {
        const testValue = prompt('\u8bf7\u8f93\u5165\u5f85\u6d4b\u8bd5\u7684\u503c');
        if (testValue === null) return;
        payload.test_value = testValue;
    } else if (ruleData.type === 'multi_conditional' || ruleData.type === 'conditional_groups') {
        const testValuesText = prompt('\u8bf7\u8f93\u5165\u6d4b\u8bd5\u503c JSON\uff08\u5982\uff1a["CRM","\u8eab\u4efd\u8bc1"] \u6216 {"0":"CRM","1":"\u8eab\u4efd\u8bc1"}\uff09');
        if (testValuesText === null) return;
        try {
            payload.test_values = JSON.parse(testValuesText);
        } catch (error) {
            showToast('\u6d4b\u8bd5\u503c JSON \u683c\u5f0f\u9519\u8bef\uff1a' + error.message, true);
            return;
        }
    } else {
        const testValue = prompt('\u8bf7\u8f93\u5165\u5f85\u6d4b\u8bd5\u7684\u503c');
        if (testValue === null) return;
        payload.test_value = testValue;
    }

    try {
        const response = await fetch(API_BASE + '/logic-rules/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!result.success) {
            showToast('\u6d4b\u8bd5\u5931\u8d25\uff1a' + (result.error || '\u672a\u77e5\u9519\u8bef'), true);
            return;
        }

        const testResult = result.data ? result.data.result : '';
        const displayResult = (testResult === '' || testResult === null || testResult === undefined)
            ? '<\u7a7a>'
            : String(testResult);
        showToast('\u6d4b\u8bd5\u7ed3\u679c\uff1a' + displayResult, false);
    } catch (error) {
        console.error('Failed to test logic rule:', error);
        showToast('\u6d4b\u8bd5\u5931\u8d25\uff1a' + error.message, true);
    }
}

function addLogicRuleCondition() {
    const container = document.getElementById('logicRuleConditionsList');
    if (!container) {
        return;
    }
    if (container.querySelector('div[style*="\u6682\u65e0\u6761\u4ef6"]')) {
        container.innerHTML = '';
    }

    const idx = container.querySelectorAll('.logic-rule-condition-row').length;
    const newCondHtml = `
        <div class="logic-rule-condition-row" data-cond-idx="${idx}" style="display: flex; gap: 10px; margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
            <input type="text" class="cond-match-input" placeholder="\u5339\u914d\u503c" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
            <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #495057;">
                <input type="checkbox" class="cond-regex-checkbox"> \u6b63\u5219
            </label>
            <span style="color: #6c757d;">&rarr;</span>
            <input type="text" class="cond-result-input" placeholder="\u8fd4\u56de\u503c" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
            <button type="button" class="btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;" onclick="removeLogicRuleCondition(${idx})">\u5220\u9664</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', newCondHtml);
}

function removeLogicRuleCondition(idx) {
    const row = document.querySelector(`.logic-rule-condition-row[data-cond-idx="${idx}"]`);
    if (row) {
        row.remove();
    }

    const container = document.getElementById('logicRuleConditionsList');
    if (container && container.querySelectorAll('.logic-rule-condition-row').length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">\u6682\u65e0\u6761\u4ef6</div>';
    }
}

function importLogicRules() {
    const fileInput = document.getElementById('logicRulesImportInput');
    if (!fileInput) {
        showToast('\u5bfc\u5165\u63a7\u4ef6\u672a\u521d\u59cb\u5316', true);
        return;
    }
    fileInput.click();
}

async function handleLogicRulesImport(input) {
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
        showToast('\u8bf7\u9009\u62e9 JSON \u6587\u4ef6', true);
        input.value = '';
        return;
    }

    if (!confirm('\u5bfc\u5165\u5c06\u8986\u76d6\u5f53\u524d\u6761\u4ef6\u89c4\u5219\u5e93\uff0c\u662f\u5426\u7ee7\u7eed\uff1f')) {
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(API_BASE + '/logic-rules/import', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            showToast(`\u5bfc\u5165\u6210\u529f\uff0c\u5171 ${result.data?.imported_count || 0} \u6761\u89c4\u5219`, false);
            loadLogicRulesList();
        } else {
            showToast('\u5bfc\u5165\u5931\u8d25: ' + (result.error || '\u672a\u77e5\u9519\u8bef'), true);
        }
    } catch (error) {
        console.error('Failed to import logic rules:', error);
        showToast('\u5bfc\u5165\u5931\u8d25: ' + error.message, true);
    } finally {
        input.value = '';
    }
}

async function exportLogicRules() {
    try {
        const response = await fetch(API_BASE + '/logic-rules/export');
        if (!response.ok) {
            throw new Error('\u5bfc\u51fa\u8bf7\u6c42\u5931\u8d25');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'logic_rules_export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('\u5bfc\u51fa\u6210\u529f', false);
    } catch (error) {
        console.error('Failed to export logic rules:', error);
        showToast('\u5bfc\u51fa\u5931\u8d25: ' + error.message, true);
    }
}

function onLogicRuleTypeChange(type) {
    renderLogicRuleEditor({
        ...(currentLogicRule || {}),
        name: document.getElementById('logicRuleName')?.value.trim() || currentLogicRule?.name || '',
        description: document.getElementById('logicRuleDescription')?.value.trim() || currentLogicRule?.description || '',
        type
    });
}

const logicRulesManagerState = {};

Object.defineProperties(logicRulesManagerState, {
    currentRule: {
        configurable: true,
        enumerable: true,
        get: () => currentLogicRule,
        set: (value) => {
            currentLogicRule = value || null;
        }
    },
    allRules: {
        configurable: true,
        enumerable: true,
        get: () => allLogicRules,
        set: (value) => {
            allLogicRules = Array.isArray(value) ? value : [];
        }
    }
});

window.LogicRulesManager = Object.assign(window.LogicRulesManager || {}, {
    state: logicRulesManagerState,
    switchToRulesTab: switchToLogicRulesTab,
    loadRulesList: loadLogicRulesList,
    renderRulesList: renderLogicRulesList,
    showEditor: showLogicRuleEditor,
    closeEditor: closeLogicRuleEditor,
    save: saveLogicRule,
    editRule: editLogicRule,
    deleteRule: deleteLogicRule,
    addCondition: addLogicRuleCondition,
    removeCondition: removeLogicRuleCondition,
    onTypeChange: onLogicRuleTypeChange
});

function getCurrentMappingRuleOptions() {
    if (!currentMappingConfig || !Array.isArray(currentMappingConfig.mapping_rules) || currentMappingConfig.mapping_rules.length === 0) {
        return [];
    }
    return currentMappingConfig.mapping_rules.map((rule, index) => ({
        index,
        category: currentMappingCategory,
        report_code: currentMappingApiReportCode || currentMappingReportCode,
        target_column: String(rule.target_column || '').trim(),
        target_name: String(rule.target_name || '').trim() || '未命名列',
        label: `${index + 1}. ${rule.target_column || '-'} / ${rule.target_name || '未命名列'}`
    }));
}

function closeLogicRuleApplyModal() {
    const modal = document.getElementById('logicRuleApplyModal');
    if (modal) {
        modal.remove();
    }
}

function handleLogicRuleApplyOverlayClick(event) {
    if (event.target?.id === 'logicRuleApplyModal') {
        closeLogicRuleApplyModal();
    }
}

function openLogicRuleApplyModal(options = {}) {
    closeLogicRuleApplyModal();
    const mode = options.mode === 'link' ? 'link' : 'update';
    const rule = options.rule || {};
    const usages = Array.isArray(options.usages) ? options.usages : [];
    const targetOptions = Array.isArray(options.targetOptions) ? options.targetOptions : [];

    const usageHtml = usages.length > 0
        ? usages.map(item => `
            <div style="padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff;">
                <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${escapeHtml(item.report_name || item.report_code || '-')}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${escapeHtml(`${item.category}/${item.report_code} 列 ${item.target_column || '-'} ${item.target_name || ''}`)}</div>
            </div>
        `).join('')
        : '<div style="padding: 16px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 10px;">当前还没有任何已引用列</div>';

    const targetOptionsHtml = targetOptions.map(option => `
        <option value="${escapeHtml(String(option.index))}">${escapeHtml(option.label)}</option>
    `).join('');

    const bodyHtml = mode === 'update'
        ? `
            <div style="display: grid; gap: 14px;">
                <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px; color: #334155; font-size: 13px; line-height: 1.8;">
                    将把规则库中的最新内容同步到所有已引用该规则的报表列。
                </div>
                <div style="display: grid; gap: 10px; max-height: 320px; overflow-y: auto;">
                    ${usageHtml}
                </div>
            </div>
        `
        : `
            <div style="display: grid; gap: 14px;">
                <div style="padding: 14px 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px; color: #334155; font-size: 13px; line-height: 1.8;">
                    当前还没有任何报表列引用该规则。请选择当前映射报表中的目标列，系统会先完成绑定，再写入规则内容。
                </div>
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">目标列</label>
                    <select id="logicRuleApplyTargetSelect" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 8px; font-size: 14px;">
                        <option value="">请选择目标列</option>
                        ${targetOptionsHtml}
                    </select>
                </div>
            </div>
        `;

    const confirmLabel = mode === 'update' ? '确认应用' : '绑定并应用';

    const modalHtml = `
        <div class="modal-overlay show" id="logicRuleApplyModal" onclick="handleLogicRuleApplyOverlayClick(event)" style="z-index: 10030;">
            <div class="modal-content" style="width: min(720px, 92vw); max-width: 720px; max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
                <div class="modal-header" style="padding: 18px 24px; border-bottom: none; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: #fff;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">应用到报表</h3>
                        <div style="font-size: 12px; margin-top: 6px; opacity: 0.92;">${escapeHtml(rule.name || rule.id || '')}</div>
                    </div>
                    <button class="modal-close" type="button" onclick="closeLogicRuleApplyModal()" style="color: #fff; background: rgba(255,255,255,0.16);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 24px; display: grid; gap: 16px;">
                    ${bodyHtml}
                </div>
                <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: flex-end; gap: 10px;">
                    <button class="btn" type="button" onclick="closeLogicRuleApplyModal()">取消</button>
                    <button class="btn" type="button" onclick="submitLogicRuleApplyModal('${escapeHtml(rule.id || '')}', '${mode}')" style="background: #0f766e; color: white; border: none;">${confirmLabel}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitLogicRuleApplyModal(ruleId, mode) {
    try {
        let payload;
        if (mode === 'update') {
            payload = { linked_only: true };
        } else {
            const selectedValue = document.getElementById('logicRuleApplyTargetSelect')?.value || '';
            if (!selectedValue) {
                showToast('请选择目标列', true);
                return;
            }

            const targetOptions = getCurrentMappingRuleOptions();
            const target = targetOptions.find(item => String(item.index) === String(selectedValue));
            if (!target) {
                showToast('目标列无效', true);
                return;
            }

            payload = {
                targets: [{
                    category: target.category,
                    report_code: target.report_code,
                    target_column: target.target_column,
                    target_name: target.target_name
                }]
            };
        }

        const response = await fetch(API_BASE + `/logic-rules/${encodeURIComponent(ruleId)}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '应用失败');
        }

        closeLogicRuleApplyModal();
        showToast(`已应用到 ${result.data?.applied_count || 0} 个报表列`, false);
        await loadLogicRulesList();
        if (currentMappingCategory && currentMappingReportCode) {
            await selectMappingReport(currentMappingCategory, currentMappingReportCode, { force: true });
        }
    } catch (error) {
        console.error('Submit logic rule apply failed:', error);
        showToast(`应用到报表失败：${error.message}`, true);
    }
}

async function applyLogicRuleToReports(ruleId) {
    try {
        const rule = allLogicRules.find(item => item.id === ruleId);
        const usageData = await fetchLogicRuleUsages(ruleId);
        const usages = Array.isArray(usageData.usages) ? usageData.usages : [];

        if (usages.length > 0) {
            openLogicRuleApplyModal({
                mode: 'update',
                rule,
                usages
            });
            return;
        }

        if (!currentMappingCategory || !currentMappingReportCode || !currentMappingConfig) {
            showToast('当前没有已引用列，请先在映射管理中选中目标报表后再应用', true);
            return;
        }

        const targetOptions = getCurrentMappingRuleOptions();
        if (targetOptions.length === 0) {
            showToast('当前报表没有可用的目标列', true);
            return;
        }

        openLogicRuleApplyModal({
            mode: 'link',
            rule,
            targetOptions
        });
    } catch (error) {
        console.error('Apply logic rule to reports failed:', error);
        showToast(`应用到报表失败：${error.message}`, true);
    }
}

async function ensureLogicRuleEditorColumnsLoaded(rule = null) {
    const preferredSource = String(rule?.source_field?.data_source || 'merge_results').trim() || 'merge_results';
    const sources = preferredSource === 'assets'
        ? ['assets', 'merge_results']
        : ['merge_results', 'assets'];
    try {
        await ensureMappingDataSourceColumns(sources);
    } catch (error) {
        console.warn('[ensureLogicRuleEditorColumnsLoaded] Failed to load columns:', error);
    }
}

// 加载映射管理的报表选择
function detectLogicRuleEditorMode(type, configDraft = {}) {
    if (type === 'conditional_groups') {
        return 'groups';
    }
    if (configDraft?.source_type === 'conditional_groups') {
        return 'groups';
    }
    if (Array.isArray(configDraft?.groups) && configDraft.groups.length > 0) {
        return 'groups';
    }
    return 'simple';
}

function sanitizeLogicRuleDynamicConfigData(type, configData = {}) {
    const nextConfig = cloneLogicRuleValue(configData) || {};
    const editorMode = detectLogicRuleEditorMode(type, nextConfig);

    if (type === 'multi_conditional' || type === 'conditional_groups') {
        if (editorMode === 'groups') {
            nextConfig.group_logic = String(nextConfig.group_logic || 'OR').trim() || 'OR';
            nextConfig.groups = Array.isArray(nextConfig.groups) ? nextConfig.groups : [];
            if (nextConfig.default === undefined) {
                nextConfig.default = '';
            }
            delete nextConfig.logic;
            delete nextConfig.result;
            if (type === 'conditional_groups') {
                nextConfig.source_type = 'conditional_groups';
            }
        } else {
            nextConfig.logic = String(nextConfig.logic || 'AND').trim() || 'AND';
            nextConfig.conditions = Array.isArray(nextConfig.conditions) ? nextConfig.conditions : [];
            if (nextConfig.result === undefined) {
                nextConfig.result = '';
            }
            if (nextConfig.default === undefined) {
                nextConfig.default = '';
            }
            delete nextConfig.group_logic;
            delete nextConfig.groups;
        }
    }

    return nextConfig;
}

function resolveLogicRuleDynamicRuntimeValue(field, configDraft, type) {
    if (!field) {
        return undefined;
    }
    if (field.runtimeValueResolver === 'detect_multi_conditional_mode') {
        return detectLogicRuleEditorMode(type, configDraft);
    }
    return undefined;
}

function isLogicRuleDynamicFieldVisible(field, configDraft, type) {
    if (type === 'conditional' && field?.key === 'preset_template') {
        return false;
    }
    if (!field?.visibleWhen) {
        return true;
    }
    const visibleWhen = field.visibleWhen;
    const targetField = visibleWhen.field;
    let currentValue;

    if (targetField === 'mode') {
        currentValue = detectLogicRuleEditorMode(type, configDraft);
    } else {
        currentValue = getLogicRuleDynamicFieldValue({ key: targetField }, configDraft, type);
    }

    return String(currentValue ?? '') === String(visibleWhen.equals ?? '');
}

function buildLogicRuleTypeOptions(selectedType) {
    const catalog = getLogicRuleTypeCatalog();
    return Object.entries(catalog)
        .sort((a, b) => {
            const leftOrder = LOGIC_RULE_CATEGORY_CONFIG[a[1].category]?.order || 99;
            const rightOrder = LOGIC_RULE_CATEGORY_CONFIG[b[1].category]?.order || 99;
            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }
            return String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]), 'zh-CN');
        })
        .map(([typeId, meta]) => {
            const selected = typeId === selectedType ? 'selected' : '';
            return `<option value="${escapeHtml(typeId)}" ${selected}>${escapeHtml(meta.name)}</option>`;
        })
        .join('');
}

function buildLogicRuleConfigDraft(rule, type) {
    const definition = getLogicRuleDynamicDefinition(type);
    const draft = {};

    if (definition?.jsonExample && typeof definition.jsonExample === 'object') {
        Object.assign(draft, cloneLogicRuleValue(definition.jsonExample));
    }
    if (definition?.initialValues && typeof definition.initialValues === 'object') {
        Object.assign(draft, cloneLogicRuleValue(definition.initialValues));
    }

    Object.entries(rule || {}).forEach(([key, value]) => {
        if (LOGIC_RULE_BASE_KEYS.has(key)) {
            return;
        }
        draft[key] = cloneLogicRuleValue(value);
    });

    if (rule?.source_field && draft.source_value === undefined && rule.source_field.field_index !== undefined && rule.source_field.field_index !== null && rule.source_field.field_index !== '') {
        draft.source_value = String(rule.source_field.field_index);
    }
    if (rule?.source_field && draft.lookup_key === undefined && rule.source_field.field_index !== undefined && rule.source_field.field_index !== null && rule.source_field.field_index !== '') {
        draft.lookup_key = String(rule.source_field.field_index);
    }
    if (rule?.default !== undefined && draft.default === undefined) {
        draft.default = rule.default;
    }

    return sanitizeLogicRuleDynamicConfigData(type, draft);
}

function getLogicRuleDynamicFieldValue(field, configDraft, type) {
    if (!field || !field.key) {
        return '';
    }
    const runtimeValue = resolveLogicRuleDynamicRuntimeValue(field, configDraft, type);
    if (runtimeValue !== undefined) {
        return runtimeValue;
    }
    const currentValue = configDraft?.[field.key];
    if (currentValue !== undefined) {
        return currentValue;
    }
    if (field.defaultValue !== undefined) {
        return field.defaultValue;
    }
    return field.type === 'boolean' ? false : '';
}

function resolveLogicRuleFieldDataSource(field, configDraft, type) {
    const configuredDataSource = String(field?.dataSource || '').trim();
    if (configuredDataSource === 'assets' || configuredDataSource === 'merge_results') {
        return configuredDataSource;
    }
    if (configuredDataSource === 'rule_source') {
        return String(currentLogicRule?.source_field?.data_source || 'merge_results').trim() || 'merge_results';
    }
    if (type === 'field_assets_with_transform') {
        return 'assets';
    }
    if (type === 'field_merge_with_transform') {
        return 'merge_results';
    }
    return String(currentLogicRule?.source_field?.data_source || 'merge_results').trim() || 'merge_results';
}

function getLogicRuleFieldSelectedValue(field, value, configDraft, type) {
    const currentValue = value === undefined || value === null ? '' : String(value).trim();
    if (currentValue) {
        return currentValue;
    }

    if (!field?.key) {
        return currentValue;
    }

    if (['source_value', 'lookup_key', 'name_column_index'].includes(field.key)) {
        const fallbackIndex = currentLogicRule?.source_field?.field_index;
        if (fallbackIndex !== undefined && fallbackIndex !== null && fallbackIndex !== '') {
            return String(fallbackIndex).trim();
        }
    }

    return currentValue;
}

function renderLogicRuleFieldSelect(field, value, configDraft, type) {
    const fieldId = `logicRuleDynamicField_${field.key}`;
    const dataSource = resolveLogicRuleFieldDataSource(field, configDraft, type);
    const columns = getIndexedDataSourceColumns(dataSource, null);
    const selectedValue = getLogicRuleFieldSelectedValue(field, value, configDraft, type);

    if (columns.length > 0) {
        return `
            <select id="${fieldId}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" onchange="syncLogicRuleDynamicJsonFromForm()">
                <option value="">请选择字段</option>
                ${buildColumnOptionsHtml(columns, selectedValue)}
            </select>
            <div style="margin-top: 6px; font-size: 12px; color: #64748b; line-height: 1.6;">${escapeHtml(getIndexHintText(dataSource, null))}</div>
        `;
    }

    return `
        <input type="number" id="${fieldId}" value="${escapeHtml(String(selectedValue ?? ''))}" placeholder="请输入字段索引" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" oninput="syncLogicRuleDynamicJsonFromForm()">
        <div style="margin-top: 6px; font-size: 12px; color: #64748b; line-height: 1.6;">当前字段列表未加载，先按索引维护；不会影响后端导出逻辑。</div>
    `;
}

function renderLogicRuleDynamicField(field, configDraft) {
    const fieldId = `logicRuleDynamicField_${field.key || 'info'}`;
    const requiredText = field.required ? '<span style="color: #dc3545;">*</span>' : '';
    const suppressHelpText = ['conditional', 'multi_conditional', 'conditional_groups'].includes(
        currentLogicRule?.type || document.getElementById('logicRuleType')?.value || ''
    );
    const helpText = (!suppressHelpText && field.description)
        ? `<div style="margin-top: 6px; font-size: 12px; color: #64748b; line-height: 1.6;">${escapeHtml(field.description)}</div>`
        : '';

    if (field.type === 'info') {
        return `
            <div style="padding: 12px 14px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 10px; color: #36506c; font-size: 13px; line-height: 1.7;">
                <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(field.title || field.label || '说明')}</div>
                <div>${escapeHtml(field.text || field.description || '')}</div>
            </div>
        `;
    }

    const value = getLogicRuleDynamicFieldValue(field, configDraft, currentLogicRule?.type || document.getElementById('logicRuleType')?.value || 'conditional');
    let controlHtml = '';

    if (field.type === 'textarea') {
        controlHtml = `<textarea id="${fieldId}" rows="${Number(field.rows || 3)}" placeholder="${escapeHtml(field.placeholder || '')}" style="width: 100%; min-height: 88px; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; resize: vertical;" oninput="syncLogicRuleDynamicJsonFromForm()">${escapeHtml(String(value || ''))}</textarea>`;
    } else if (field.type === 'field_select') {
        controlHtml = renderLogicRuleFieldSelect(field, value, configDraft, currentLogicRule?.type || document.getElementById('logicRuleType')?.value || 'conditional');
    } else if (field.type === 'select') {
        const options = (field.options || []).map(option => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionLabel = typeof option === 'object' ? (option.label || option.value) : option;
            const selected = String(value) === String(optionValue) ? 'selected' : '';
            return `<option value="${escapeHtml(String(optionValue))}" ${selected}>${escapeHtml(String(optionLabel))}</option>`;
        }).join('');
        controlHtml = `
            <select id="${fieldId}" data-value-type="${escapeHtml(String(field.valueType || ''))}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" onchange="syncLogicRuleDynamicJsonFromForm()">
                <option value="">请选择</option>
                ${options}
            </select>
        `;
    } else if (field.type === 'public_config_select') {
        const items = Array.isArray(publicConfigCenterData) ? publicConfigCenterData : [];
        const mappingItems = items.filter(item => item && item.enabled !== false && String(item.config_type || item.type || '').trim() === 'mapping_table');
        if (mappingItems.length > 0) {
            const options = mappingItems.map(item => {
                const optionValue = String(item.key || '');
                const optionLabel = item.name || item.title || item.key || optionValue;
                const selected = String(value || '') === optionValue ? 'selected' : '';
                return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(optionLabel)}</option>`;
            }).join('');
            controlHtml = `
                <select id="${fieldId}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" onchange="syncLogicRuleDynamicJsonFromForm()">
                    <option value="">请选择公共配置</option>
                    ${options}
                </select>
            `;
        } else {
            controlHtml = `<input type="text" id="${fieldId}" value="${escapeHtml(String(value ?? ''))}" placeholder="${escapeHtml(field.placeholder || '请输入公共配置 key')}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" oninput="syncLogicRuleDynamicJsonFromForm()">`;
        }
    } else if (field.type === 'boolean') {
        controlHtml = `
            <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #334155;">
                <input type="checkbox" id="${fieldId}" ${value ? 'checked' : ''} onchange="syncLogicRuleDynamicJsonFromForm()">
                <span>${escapeHtml(field.label || field.key)}</span>
            </label>
        `;
        return `<div>${controlHtml}${helpText}</div>`;
    } else {
        const inputType = field.type === 'number' ? 'number' : 'text';
        controlHtml = `<input type="${inputType}" id="${fieldId}" value="${escapeHtml(String(value ?? ''))}" placeholder="${escapeHtml(field.placeholder || '')}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" oninput="syncLogicRuleDynamicJsonFromForm()">`;
    }

    return `
        <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">${escapeHtml(field.label || field.key || '字段')}${requiredText}</label>
            ${controlHtml}
            ${helpText}
        </div>
    `;
}

function getLogicRuleStructuredColumns(dataSource) {
    return getIndexedDataSourceColumns(dataSource, null);
}

function getLogicRuleStructuredDataSourceLabel(dataSource) {
    return dataSource === 'assets' ? '数据概览表' : '合并结果表';
}

function buildLogicRuleStructuredColumnOptionsHtml(columns, selectedValue, dataSource) {
    const dataSourceLabel = getLogicRuleStructuredDataSourceLabel(dataSource);
    const optionsHtml = (columns || []).map(col => {
        const selected = String(selectedValue) === String(col.index) || String(selectedValue) === String(col.name)
            ? 'selected'
            : '';
        return `<option value="${col.index}" ${selected}>${dataSourceLabel} / ${formatColumnDisplayLabel(col, col.index)}</option>`;
    });

    const currentValue = String(selectedValue === undefined || selectedValue === null ? '' : selectedValue).trim();
    if (currentValue && !(columns || []).some(col =>
        currentValue === String(col.index)
        || currentValue === String(col.name || '')
        || currentValue === String(col.display_name || '')
    )) {
        const fallbackLabel = /^-?\d+$/.test(currentValue)
            ? `${dataSourceLabel} / 索引${currentValue}: 当前配置值（字段名未加载）`
            : `${dataSourceLabel} / ${currentValue}（当前配置值）`;
        optionsHtml.unshift(`<option value="${currentValue}" selected>${fallbackLabel}</option>`);
    }

    return optionsHtml.join('');
}

function renderLogicRuleStructuredFieldIndexControl(value, dataSource, inputClass) {
    const columns = getLogicRuleStructuredColumns(dataSource);
    if (columns.length > 0) {
        return `
            <select class="${inputClass}" style="flex: 1.4; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" onchange="syncLogicRuleDynamicJsonFromForm()">
                <option value="">选择字段</option>
                ${buildLogicRuleStructuredColumnOptionsHtml(columns, value, dataSource)}
            </select>
        `;
    }
    return `<input type="number" class="${inputClass}" value="${escapeHtml(String(value ?? ''))}" placeholder="字段索引" style="flex: 1.1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" oninput="syncLogicRuleDynamicJsonFromForm()">`;
}

function buildLogicRuleGroupDisplayNumber(index = 0, startIndex = 0) {
    return Number(startIndex || 0) + Number(index || 0) + 1;
}

function summarizeLogicRuleGroupTitle(group = {}, index = 0, startIndex = 0) {
    return `条件组 ${buildLogicRuleGroupDisplayNumber(index, startIndex)}`;
}

function renderLogicRuleConditionRows(conditions = [], options = {}) {
    const rows = Array.isArray(conditions) && conditions.length > 0 ? conditions : [{}];
    const dataSource = options.dataSource || 'merge_results';
    const includeFieldIndex = options.includeFieldIndex === true;
    const rowClass = options.rowClass || 'logic-rule-structured-condition-row';

    return rows.map((condition, index) => {
        const operatorValue = condition.regex ? 'regex' : (condition.operator || 'contains');
        const fieldControlHtml = includeFieldIndex
            ? `
                <div style="display: flex; flex-direction: column; gap: 4px; flex: 1.6; min-width: 220px;">
                    <div style="font-size: 12px; color: #64748b;">${escapeHtml(getLogicRuleStructuredDataSourceLabel(dataSource))}</div>
                    ${renderLogicRuleStructuredFieldIndexControl(condition.field_index, dataSource, 'logic-rule-cond-field-index')}
                </div>
            `
            : '';
        return `
            <div class="${rowClass}" style="display: flex; gap: 8px; align-items: flex-end; margin-bottom: 10px; flex-wrap: wrap;">
                ${fieldControlHtml}
                <select class="logic-rule-cond-operator" style="width: 120px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" onchange="syncLogicRuleDynamicJsonFromForm()">
                    <option value="contains" ${operatorValue === 'contains' ? 'selected' : ''}>包含</option>
                    <option value="startswith" ${operatorValue === 'startswith' ? 'selected' : ''}>前缀匹配</option>
                    <option value="regex" ${operatorValue === 'regex' ? 'selected' : ''}>正则</option>
                </select>
                <input type="text" class="logic-rule-cond-match" value="${escapeHtml(condition.match || '')}" placeholder="匹配值" style="flex: 1.4; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" oninput="syncLogicRuleDynamicJsonFromForm()">
                ${includeFieldIndex ? '' : `<input type="text" class="logic-rule-cond-result" value="${escapeHtml(condition.result || '')}" placeholder="命中结果" style="flex: 1.4; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" oninput="syncLogicRuleDynamicJsonFromForm()">`}
                <button type="button" onclick="removeLogicRuleStructuredConditionRow(this)" style="padding: 8px 12px; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; font-size: 12px;">删除条件</button>
            </div>
        `;
    }).join('');
}

function renderLogicRuleGroupCards(groups = [], dataSource = 'merge_results', startIndex = 0) {
    const normalizedGroups = Array.isArray(groups) && groups.length > 0 ? groups : [{ logic: 'AND', conditions: [{}], result: '' }];
    return normalizedGroups.map((group, groupIndex) => `
        <div class="logic-rule-group-card" style="padding: 14px; border: 1px solid #dbeafe; border-radius: 12px; background: #ffffff; margin-bottom: 12px;">
            <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px;">
                <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${escapeHtml(summarizeLogicRuleGroupTitle(group, groupIndex, startIndex))}</div>
                <button type="button" onclick="removeLogicRuleGroupCard(this)" style="padding: 8px 12px; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; font-size: 12px;">删除条件组</button>
            </div>
            <div style="display: grid; grid-template-columns: 160px 1fr; gap: 10px; margin-bottom: 12px;">
                <select class="logic-rule-group-logic" style="padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" onchange="syncLogicRuleDynamicJsonFromForm()">
                    <option value="AND" ${String(group.logic || 'AND') === 'AND' ? 'selected' : ''}>组内 AND</option>
                    <option value="OR" ${String(group.logic || 'AND') === 'OR' ? 'selected' : ''}>组内 OR</option>
                </select>
                <input type="text" class="logic-rule-group-result" value="${escapeHtml(group.result || '')}" placeholder="命中结果" style="padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" oninput="syncLogicRuleDynamicJsonFromForm()">
            </div>
            <div class="logic-rule-group-conditions" data-data-source="${escapeHtml(String(dataSource))}">
                ${renderLogicRuleConditionRows(group.conditions || [], { includeFieldIndex: true, dataSource, rowClass: 'logic-rule-group-condition-row' })}
            </div>
            <button type="button" onclick="addLogicRuleGroupConditionRow(this)" style="padding: 8px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px; cursor: pointer; font-size: 12px;">新增组内条件</button>
        </div>
    `).join('');
}

function addLogicRuleStructuredConditionRow(button) {
    const container = button?.previousElementSibling;
    if (!container) {
        return;
    }
    const dataSource = container.dataset.dataSource || 'merge_results';
    container.insertAdjacentHTML('beforeend', renderLogicRuleConditionRows([{}], { includeFieldIndex: false, dataSource }));
    syncLogicRuleDynamicJsonFromForm();
}

function removeLogicRuleStructuredConditionRow(button) {
    const row = button?.closest('.logic-rule-structured-condition-row, .logic-rule-group-condition-row');
    const container = row?.parentElement;
    if (!row || !container) {
        return;
    }
    row.remove();
    if (!container.querySelector('.logic-rule-structured-condition-row, .logic-rule-group-condition-row')) {
        const isGroupContainer = container.classList.contains('logic-rule-group-conditions');
        const dataSource = container.dataset.dataSource || 'merge_results';
        container.insertAdjacentHTML('beforeend', renderLogicRuleConditionRows([{}], { includeFieldIndex: isGroupContainer, dataSource, rowClass: isGroupContainer ? 'logic-rule-group-condition-row' : 'logic-rule-structured-condition-row' }));
    }
    syncLogicRuleDynamicJsonFromForm();
}

function addLogicRuleGroupCard() {
    const container = document.getElementById('logicRuleGroupsContainer');
    if (!container) {
        return;
    }
    const dataSource = container.dataset.dataSource || 'merge_results';
    const existingCount = container.querySelectorAll('.logic-rule-group-card').length;
    container.insertAdjacentHTML('beforeend', renderLogicRuleGroupCards([{ logic: 'AND', conditions: [{}], result: '' }], dataSource, existingCount));
    syncLogicRuleDynamicJsonFromForm();
}

function removeLogicRuleGroupCard(button) {
    const card = button?.closest('.logic-rule-group-card');
    const container = card?.parentElement;
    if (!card || !container) {
        return;
    }
    card.remove();
    if (!container.querySelector('.logic-rule-group-card')) {
        const dataSource = container.dataset.dataSource || 'merge_results';
        container.innerHTML = renderLogicRuleGroupCards([{ logic: 'AND', conditions: [{}], result: '' }], dataSource);
    }
    syncLogicRuleDynamicJsonFromForm();
}

function addLogicRuleGroupConditionRow(button) {
    const card = button?.closest('.logic-rule-group-card');
    const container = card?.querySelector('.logic-rule-group-conditions');
    if (!container) {
        return;
    }
    const dataSource = container.dataset.dataSource || card?.closest('#logicRuleGroupsContainer')?.dataset?.dataSource || 'merge_results';
    container.insertAdjacentHTML('beforeend', renderLogicRuleConditionRows([{}], { includeFieldIndex: true, dataSource, rowClass: 'logic-rule-group-condition-row' }));
    syncLogicRuleDynamicJsonFromForm();
}

function collectLogicRuleConditionsFromRows(container, options = {}) {
    if (!container) {
        return [];
    }
    const includeFieldIndex = options.includeFieldIndex === true;
    const rowSelector = includeFieldIndex ? '.logic-rule-group-condition-row' : '.logic-rule-structured-condition-row';
    return Array.from(container.querySelectorAll(rowSelector)).map(row => {
        const operatorValue = row.querySelector('.logic-rule-cond-operator')?.value || 'contains';
        const condition = {
            match: row.querySelector('.logic-rule-cond-match')?.value || ''
        };
        if (includeFieldIndex) {
            const rawFieldIndex = row.querySelector('.logic-rule-cond-field-index')?.value;
            condition.field_index = rawFieldIndex === '' || rawFieldIndex === undefined ? '' : Number.parseInt(rawFieldIndex, 10);
        } else {
            const resultValue = row.querySelector('.logic-rule-cond-result')?.value || '';
            condition.result = resultValue;
        }
        if (operatorValue === 'regex') {
            condition.regex = true;
        } else if (operatorValue) {
            condition.operator = operatorValue;
        }
        return condition;
    }).filter(condition => {
        if (includeFieldIndex) {
            return String(condition.field_index ?? '').trim() !== '' || String(condition.match || '').trim() !== '';
        }
        return String(condition.match || '').trim() !== '' || String(condition.result || '').trim() !== '';
    });
}

function renderLogicRuleStructuredJsonEditor(type, configDraft) {
    if (type !== 'conditional' && type !== 'multi_conditional' && type !== 'conditional_groups') {
        return '';
    }

    if (type === 'conditional') {
        const conditions = Array.isArray(configDraft.conditions) ? configDraft.conditions : [];
        return `
            <div style="padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: #495057;">条件列表配置</label>
                    <button type="button" onclick="addLogicRuleStructuredConditionRow(this)" style="padding: 8px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px; cursor: pointer; font-size: 12px;">新增条件</button>
                </div>
                <div id="logicRuleConditionsContainer" data-data-source="${escapeHtml(String(currentLogicRule?.source_field?.data_source || 'merge_results'))}">
                    ${renderLogicRuleConditionRows(conditions, { includeFieldIndex: false, dataSource: currentLogicRule?.source_field?.data_source || 'merge_results' })}
                </div>
            </div>
        `;
    }

    const editorMode = detectLogicRuleEditorMode(type, configDraft);
    const sourceDataSource = currentLogicRule?.source_field?.data_source || 'merge_results';

    if (editorMode === 'groups') {
        const groups = Array.isArray(configDraft.groups) ? configDraft.groups : [];
        return `
            <div style="padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: #495057;">条件组配置</label>
                    <button type="button" onclick="addLogicRuleGroupCard()" style="padding: 8px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px; cursor: pointer; font-size: 12px;">新增条件组</button>
                </div>
                <div id="logicRuleGroupsContainer" data-data-source="${escapeHtml(String(sourceDataSource))}">
                    ${renderLogicRuleGroupCards(groups, sourceDataSource)}
                </div>
            </div>
        `;
    }

    return `
        <div style="padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                <label style="font-size: 13px; font-weight: 600; color: #495057;">条件列表配置</label>
                <button type="button" onclick="addLogicRuleStructuredConditionRow(this)" style="padding: 8px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px; cursor: pointer; font-size: 12px;">新增条件</button>
            </div>
            <div id="logicRuleConditionsContainer" data-data-source="${escapeHtml(String(sourceDataSource))}">
                ${renderLogicRuleConditionRows(Array.isArray(configDraft.conditions) ? configDraft.conditions : [], { includeFieldIndex: true, dataSource: sourceDataSource })}
            </div>
        </div>
    `;
}

function collectLogicRuleStructuredJsonPatch(type, options = {}) {
    if (type === 'conditional') {
        return {
            conditions: collectLogicRuleConditionsFromRows(document.getElementById('logicRuleConditionsContainer'), { includeFieldIndex: false })
        };
    }

    const editorMode = detectLogicRuleEditorMode(type, {
        groups: Array.from(document.querySelectorAll('#logicRuleGroupsContainer .logic-rule-group-card')),
        conditions: Array.from(document.querySelectorAll('#logicRuleConditionsContainer .logic-rule-structured-condition-row')),
        source_type: type === 'conditional_groups' ? 'conditional_groups' : ''
    });
    const silent = options.silent === true;

    try {
        if (editorMode === 'groups') {
            const groupCards = Array.from(document.querySelectorAll('#logicRuleGroupsContainer .logic-rule-group-card'));
            const groups = groupCards.map(card => ({
                logic: card.querySelector('.logic-rule-group-logic')?.value || 'AND',
                result: card.querySelector('.logic-rule-group-result')?.value || '',
                conditions: collectLogicRuleConditionsFromRows(card.querySelector('.logic-rule-group-conditions'), { includeFieldIndex: true })
            })).filter(group => String(group.result || '').trim() !== '' || (Array.isArray(group.conditions) && group.conditions.length > 0));
            return {
                source_type: 'conditional_groups',
                groups,
                group_logic: document.getElementById('logicRuleDynamicField_group_logic')?.value || 'OR'
            };
        }

        const conditions = collectLogicRuleConditionsFromRows(document.getElementById('logicRuleConditionsContainer'), { includeFieldIndex: true });
        return {
            conditions,
            logic: document.getElementById('logicRuleDynamicField_logic')?.value || 'AND',
            result: document.getElementById('logicRuleDynamicField_result')?.value || ''
        };
    } catch (error) {
        if (!silent) {
            showToast(`规则结构 JSON 格式错误：${error.message}`, true);
        }
        return null;
    }
}

function safeJsonParseArray(text) {
    const parsed = JSON.parse(text || '[]');
    if (!Array.isArray(parsed)) {
        throw new Error('内容必须是 JSON 数组');
    }
    return parsed;
}

function formatLogicRuleStructuredJson(kind) {
    syncLogicRuleDynamicJsonFromForm();
}

function renderLogicRuleDynamicEditor(rule, type, typeMeta, definition) {
    const configDraft = buildLogicRuleConfigDraft(rule, type);
    const fieldsHtml = (definition.fields || [])
        .filter(field => isLogicRuleDynamicFieldVisible(field, configDraft, type))
        .map(field => renderLogicRuleDynamicField(field, configDraft))
        .join('');
    const structuredJsonEditorHtml = renderLogicRuleStructuredJsonEditor(type, configDraft);

    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">规则名称 <span style="color: #dc3545;">*</span></label>
                <input type="text" id="logicRuleName" value="${escapeHtml(rule?.name || '')}" placeholder="例如：${escapeHtml(typeMeta.name)}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
            </div>
            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">规则类型 <span style="color: #dc3545;">*</span></label>
                <select id="logicRuleType" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" onchange="onLogicRuleTypeChange(this.value)">
                    ${buildLogicRuleTypeOptions(type)}
                </select>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">描述说明</label>
            <textarea id="logicRuleDescription" placeholder="记录当前逻辑模块的用途和维护说明" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 60px; resize: vertical;">${escapeHtml(rule?.description || typeMeta.description || '')}</textarea>
        </div>

        <div style="display: grid; gap: 16px; margin-bottom: 20px;">
            ${fieldsHtml}
        </div>

        ${structuredJsonEditorHtml}

        <details style="margin-top: 12px;">
            <summary style="cursor: pointer; font-size: 13px; font-weight: 600; color: #334155;">高级配置</summary>
            <div style="margin-top: 12px;">
                <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <label style="font-size: 13px; font-weight: 600; color: #495057;">JSON</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="formatLogicRuleConfigJson()" style="padding: 6px 12px; background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 4px; cursor: pointer; font-size: 12px;">格式化</button>
                        <button type="button" onclick="resetLogicRuleConfigJson()" style="padding: 6px 12px; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 12px;">恢复</button>
                    </div>
                </div>
                <textarea id="logicRuleConfigJson" style="width: 100%; min-height: 220px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; font-family: Consolas, 'Courier New', monospace; resize: vertical; line-height: 1.7;">${escapeHtml(JSON.stringify(configDraft, null, 2))}</textarea>
            </div>
        </details>
    `;
}

function renderLogicRuleLegacyEditor(rule, type, typeMeta) {
    const sourceField = rule ? (rule.source_field || { data_source: 'merge_results', field_index: 9, field_name: '数据分级' }) : { data_source: 'merge_results', field_index: 9, field_name: '数据分级' };
    const conditions = rule ? (rule.conditions || []) : [];
    const defaultValue = rule ? (rule.default || '') : '';
    const conditionsHtml = conditions.map((cond, idx) => {
        const matchValue = cond.match || '';
        const resultValue = cond.result || '';
        const isRegex = cond.regex || false;
        return `
            <div class="logic-rule-condition-row" data-cond-idx="${idx}" style="display: flex; gap: 10px; margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                <input type="text" class="cond-match-input" value="${escapeHtml(matchValue)}" placeholder="匹配值" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #495057;">
                    <input type="checkbox" class="cond-regex-checkbox" ${isRegex ? 'checked' : ''}> 正则
                </label>
                <span style="color: #6c757d;">&rarr;</span>
                <input type="text" class="cond-result-input" value="${escapeHtml(resultValue)}" placeholder="返回值" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <button type="button" class="btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;" onclick="removeLogicRuleCondition(${idx})">删除</button>
            </div>
        `;
    }).join('');

    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">规则名称 <span style="color: #dc3545;">*</span></label>
                <input type="text" id="logicRuleName" value="${escapeHtml(rule?.name || '')}" placeholder="例如：${escapeHtml(typeMeta.name)}" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
            </div>
            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">规则类型 <span style="color: #dc3545;">*</span></label>
                <select id="logicRuleType" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" onchange="onLogicRuleTypeChange(this.value)">
                    ${buildLogicRuleTypeOptions(type)}
                </select>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">描述说明</label>
            <textarea id="logicRuleDescription" placeholder="详细描述此规则的用途和逻辑" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 60px; resize: vertical;">${escapeHtml(rule?.description || typeMeta.description || '')}</textarea>
        </div>

        <div id="sourceFieldSection">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">判断字段 <span style="color: #dc3545;">*</span></label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                <div>
                    <label style="display: block; font-size: 12px; color: #6c757d; margin-bottom: 5px;">数据源</label>
                    <select id="logicRuleDataSource" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                        <option value="merge_results" ${sourceField.data_source === 'merge_results' ? 'selected' : ''}>合并结果表</option>
                        <option value="assets" ${sourceField.data_source === 'assets' ? 'selected' : ''}>数据概览表</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #6c757d; margin-bottom: 5px;">字段索引</label>
                    <input type="number" id="logicRuleFieldIndex" value="${escapeHtml(String(sourceField.field_index ?? 9))}" min="0" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #6c757d; margin-bottom: 5px;">字段名称</label>
                    <input type="text" id="logicRuleFieldName" value="${escapeHtml(sourceField.field_name || '')}" placeholder="例如：数据分级" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                </div>
            </div>
        </div>

        <div style="margin-top: 20px; margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">条件列表</label>
            <div id="logicRuleConditionsList" style="max-height: 200px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                ${conditionsHtml || '<div style="text-align: center; padding: 20px; color: #6c757d;">暂无条件</div>'}
            </div>
            <button type="button" onclick="addLogicRuleCondition()" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px;">+ 添加条件</button>
        </div>

        <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #495057; margin-bottom: 8px;">默认值（所有条件都不满足时返回）</label>
            <input type="text" id="logicRuleDefaultValue" value="${escapeHtml(defaultValue)}" placeholder="默认返回值" style="width: 100%; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
        </div>
    `;
}

function readLogicRuleDynamicFieldValue(field) {
    if (!field?.key || field.type === 'info' || field.transient === true) {
        return undefined;
    }
    const element = document.getElementById(`logicRuleDynamicField_${field.key}`);
    if (!element) {
        return undefined;
    }
    if (field.type === 'boolean') {
        return element.checked === true;
    }
    if (field.type === 'select' && element.dataset.valueType === 'boolean') {
        if (element.value === 'true') {
            return true;
        }
        if (element.value === 'false') {
            return false;
        }
    }
    return element.value;
}

function syncLogicRuleDynamicJsonFromForm() {
    const type = document.getElementById('logicRuleType')?.value || currentLogicRule?.type || 'conditional';
    const definition = getLogicRuleDynamicDefinition(type);
    const configElement = document.getElementById('logicRuleConfigJson');
    if (!definition || !configElement) {
        return;
    }

    let configData = {};
    try {
        configData = JSON.parse(configElement.value || '{}');
    } catch (error) {
        configData = {};
    }

    (definition.fields || []).forEach(field => {
        const nextValue = readLogicRuleDynamicFieldValue(field);
        if (nextValue !== undefined) {
            configData[field.key] = nextValue;
        }
    });

    const structuredPatch = collectLogicRuleStructuredJsonPatch(type, { silent: true });
    if (structuredPatch) {
        Object.assign(configData, structuredPatch);
    }

    configElement.value = JSON.stringify(sanitizeLogicRuleDynamicConfigData(type, configData), null, 2);
}

function formatLogicRuleConfigJson() {
    const configElement = document.getElementById('logicRuleConfigJson');
    if (!configElement) {
        return;
    }
    try {
        configElement.value = JSON.stringify(JSON.parse(configElement.value || '{}'), null, 2);
    } catch (error) {
        showToast('JSON 格式错误：' + error.message, true);
    }
}

function resetLogicRuleConfigJson() {
    const type = document.getElementById('logicRuleType')?.value || currentLogicRule?.type || 'conditional';
    renderLogicRuleEditor({
        ...(currentLogicRule || {}),
        name: document.getElementById('logicRuleName')?.value.trim() || currentLogicRule?.name || '',
        description: document.getElementById('logicRuleDescription')?.value.trim() || currentLogicRule?.description || '',
        type
    });
}

function deriveLogicRuleSourceField(type, definition, configData, fallbackSourceField) {
    const nextFallback = fallbackSourceField || { data_source: 'merge_results', field_index: 0, field_name: '' };
    const candidateKeys = ['source_value', 'lookup_key', 'name_column_index'];
    const candidateField = (definition?.fields || []).find(field => candidateKeys.includes(field.key));
    const rawValue = candidateField ? configData?.[candidateField.key] : '';
    const parsedIndex = rawValue === '' || rawValue === undefined || rawValue === null ? Number(nextFallback.field_index || 0) : Number(rawValue);
    let dataSource = nextFallback.data_source || 'merge_results';

    if (candidateField?.dataSource === 'assets') {
        dataSource = 'assets';
    } else if (candidateField?.dataSource === 'merge_results') {
        dataSource = 'merge_results';
    }

    return {
        data_source: dataSource,
        field_index: Number.isFinite(parsedIndex) ? parsedIndex : Number(nextFallback.field_index || 0),
        field_name: nextFallback.field_name || ''
    };
}

async function loadMappingReportSelect() {
    try {
        // 先从reportingCategories生成报表列表
        for (const category of ['yeji', 'smc', 'xinan']) {
            const listContainer = document.getElementById(`mappingReports-${category}`);
            // 仅展示报表(type=display)不进入映射管理区域
            const files = (reportingCategories[category]?.files || []).filter(file => file.type !== 'display');

            const categoryColor = category === 'yeji' ? '#005fe0' :
                                 category === 'smc' ? '#28a745' : '#dc3545';

            if (files.length === 0) {
                listContainer.innerHTML = `
                    <div class="mapping-list-empty">
                        暂无报表
                    </div>
                `;
            } else {
                // 按代码排序
                const sortedFiles = [...files].sort((a, b) => {
                    const codeA = parseInt(a.code) || 0;
                    const codeB = parseInt(b.code) || 0;
                    return codeA - codeB;
                });

                let listHtml = '';
                for (const file of sortedFiles) {
                    const displayName = getReportingFileDisplayName(file);
                    const displayCode = getReportingFileDisplayCode(file);
                    listHtml += `
                        <div class="mapping-report-item"
                             data-category="${category}"
                             data-code="${file.code}"
                             onclick="selectMappingReport('${category}', '${file.code}')"
                             style="--mapping-accent: ${categoryColor};">
                            <div class="mapping-report-item__code">${displayCode}</div>
                            <div class="mapping-report-item__name">${displayName}</div>
                        </div>
                    `;
                }
                listContainer.innerHTML = listHtml;

            }
        }

        const [configRes, publicRes] = await Promise.all([
            fetch(API_BASE + '/mapping-config?include_public=true'),
            fetch(API_BASE + '/public-configs')
        ]);
        const configResult = await configRes.json();
        const publicResult = await publicRes.json();

        if (configResult.success && configResult.config) {
            allMappingConfigs = configResult.config.reports || {};
        }

        publicMappingConfigs = publicResult.success ? (publicResult.data || []) : [];
        publicMappingConfigMap = publicMappingConfigs.reduce((acc, item) => {
            if (item && item.key) {
                acc[item.key] = item;
            }
            return acc;
        }, {});

        renderPublicConfigList();
    } catch (e) {
        console.error('加载报表列表失败:', e);
        showToast('加载报表列表失败', true);
    }
}

function renderPublicConfigList() {
    const publicListContainer = document.getElementById('mappingReports-public');
    if (!publicListContainer) {
        return;
    }

    if (!Array.isArray(publicMappingConfigs) || publicMappingConfigs.length === 0) {
        publicListContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                暂无公共配置
            </div>
        `;
        return;
    }

    let publicListHtml = '';
    for (const config of publicMappingConfigs) {
        const configKey = config.key || '';
        const configName = config.name || config.title || configKey;
        const usageCount = Number(config.usage_count || 0);
        const totalCount = Number(config.total_count || 0);
        const statusText = config.supports_detail ? '已接线' : '已预留';
        publicListHtml += `
            <div class="mapping-report-item"
                 data-category="public"
                 data-code="${configKey}"
                 onclick="selectPublicConfig('${configKey}')"
                 style="padding: 8px 12px; background: white; border: 1px solid #e9ecef; border-left: 3px solid #28a745; border-radius: 4px; cursor: pointer; transition: all 0.3s; font-size: 12px;">
                <div style="font-weight: 600; color: #28a745; margin-bottom: 2px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px;">${escapeHtml(configKey)}</div>
                <div style="font-size: 12px; color: #333; font-weight: 600;">${escapeHtml(configName)}</div>
                <div style="font-size: 11px; color: #6c757d; margin-top: 4px; line-height: 1.5;">${escapeHtml(config.description || '已接入公共配置中心')}</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                    <span style="padding: 2px 8px; border-radius: 999px; background: #e8f5e9; color: #1b5e20; font-size: 10px;">${statusText}</span>
                    <span style="padding: 2px 8px; border-radius: 999px; background: #eef4ff; color: #005fe0; font-size: 10px;">引用 ${usageCount} 张报表</span>
                    <span style="padding: 2px 8px; border-radius: 999px; background: #f5f7fa; color: #4b5563; font-size: 10px;">${totalCount} 条配置</span>
                </div>
            </div>
        `;
    }
    publicListContainer.innerHTML = publicListHtml;
}

function normalizePublicConfigMappings(mappings) {
    if (Array.isArray(mappings)) {
        return mappings.map(item => ({
            id: item.id,
            source: item.source || '',
            target: item.target || '',
            enabled: item.enabled !== false
        }));
    }

    if (mappings && typeof mappings === 'object') {
        return Object.entries(mappings).map(([source, target], index) => ({
            id: index + 1,
            source,
            target,
            enabled: true
        }));
    }

    return [];
}

function renderPublicConfigUsageList(usedBy) {
    const usageList = Array.isArray(usedBy) ? usedBy : [];

    if (usageList.length === 0) {
        return `
            <div style="font-size: 12px; color: #6c757d;">
                当前还没有报表引用记录，后续新增公共配置时可直接沿用这套容器结构。
            </div>
        `;
    }

    return `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${usageList.map(item => `
                <div style="padding: 10px 12px; background: white; border: 1px solid #e9ecef; border-radius: 8px;">
                    <div style="font-size: 13px; font-weight: 600; color: #1f2937;">
                        ${escapeHtml(item.report_name || item.report_code || '-')}
                    </div>
                    <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">
                        ${escapeHtml(item.category || '-')}/${escapeHtml(item.report_code || '-')} · 引用列 ${Array.isArray(item.target_columns) ? escapeHtml(item.target_columns.join(', ')) : '-'}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderBusinessSystemPublicConfig(config, contentDiv) {
    const entries = normalizePublicConfigMappings(config.mappings);
    const previewEntries = entries.slice(0, 20);
    const usageHtml = renderPublicConfigUsageList(config.used_by);

    let tableHtml = '';
    if (entries.length === 0) {
        tableHtml = '<div style="text-align: center; padding: 40px; color: #999;">暂无映射条目</div>';
    } else {
        tableHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        <th style="padding: 10px; text-align: left; font-weight: 600;">合并结果表名称</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600;">数据概览表名称</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600;">状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${previewEntries.map(item => `
                        <tr style="border-bottom: 1px solid #dee2e6;">
                            <td style="padding: 8px 10px;">${escapeHtml(item.source)}</td>
                            <td style="padding: 8px 10px;">${item.target ? escapeHtml(item.target) : '<span style="color: #999;">未配置</span>'}</td>
                            <td style="padding: 8px 10px;">
                                <span style="padding: 2px 8px; border-radius: 999px; font-size: 11px; background: ${item.enabled ? '#e8f5e9' : '#fce8e6'}; color: ${item.enabled ? '#1b5e20' : '#c62828'};">
                                    ${item.enabled ? '启用' : '禁用'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    contentDiv.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #333;">${escapeHtml(config.title || '公共配置')} / ${escapeHtml(config.name || config.key || '')}</h3>
                    <p style="margin: 0; font-size: 13px; color: #6c757d;">${escapeHtml(config.description || '')}</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #28a745;">
                        共 ${Number(config.total_count || entries.length)} 条配置，已接入 ${Number(config.usage_count || 0)} 张报表
                    </p>
                </div>
                <button onclick="openBusinessSystemMappingModal()"
                    style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;">
                    编辑映射字典
                </button>
            </div>

            <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #495057;">使用说明</h4>
                <p style="margin: 0; font-size: 12px; color: #6c757d; line-height: 1.6;">
                    此映射字典用于解决合并结果表与数据概览表中业务系统名称不一致的问题。
                    在导出报表时，系统会先通过此字典将合并结果表的业务系统名称转换为数据概览表中的标准名称，
                    然后再进行VLOOKUP查询。
                </p>
            </div>

            <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #495057;">当前引用报表</h4>
                ${usageHtml}
            </div>

            ${tableHtml}
            ${entries.length > previewEntries.length ? `<div style="margin-top: 12px; font-size: 12px; color: #6c757d;">当前预览前 ${previewEntries.length} 条，完整编辑请进入详情管理。</div>` : ''}
        </div>
    `;
}

function renderGenericPublicConfig(config, contentDiv) {
    contentDiv.innerHTML = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #333;">${escapeHtml(config.title || '公共配置')} / ${escapeHtml(config.name || config.key || '')}</h3>
                <p style="margin: 0; font-size: 13px; color: #6c757d;">${escapeHtml(config.description || '当前已接入公共配置中心，但详情编辑尚未启用。')}</p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
                <span style="padding: 4px 10px; border-radius: 999px; background: #f5f7fa; color: #4b5563; font-size: 12px;">key: ${escapeHtml(config.key || '')}</span>
                <span style="padding: 4px 10px; border-radius: 999px; background: #eef4ff; color: #005fe0; font-size: 12px;">类型: ${escapeHtml(config.config_type || 'generic')}</span>
                <span style="padding: 4px 10px; border-radius: 999px; background: #e8f5e9; color: #1b5e20; font-size: 12px;">引用 ${Number(config.usage_count || 0)} 张报表</span>
            </div>
            <div style="background: #f8f9fa; border: 1px dashed #ced4da; border-radius: 8px; padding: 16px;">
                <div style="font-size: 13px; color: #495057; line-height: 1.8;">
                    这个公共配置项已经纳入统一容器。后续如果平台业务继续扩展，可以直接在后端注册表中新增配置项，
                    再按 <code>config_type</code> 接入对应的详情渲染和编辑能力。
                </div>
            </div>
            <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-top: 20px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #495057;">当前引用报表</h4>
                ${renderPublicConfigUsageList(config.used_by)}
            </div>
        </div>
    `;
}

function updatePublicConfigOverview(config) {
    const title = document.getElementById('mappingWorkspaceTitle');
    const description = document.getElementById('mappingWorkspaceDescription');
    const hint = document.getElementById('mappingWorkspaceHint');
    const displayName = config?.name || config?.key || '公共配置';

    if (title) title.textContent = `公共配置 / ${displayName}`;
    if (description) {
        description.textContent = config?.description
            || '当前正在查看公共配置详情，可继续在右侧查看引用关系或进入详情编辑。';
    }
    if (hint) hint.textContent = `当前配置：${config?.key || displayName}`;
}

// 选择公共配置显示详情
async function selectPublicConfig(configKey) {
    const requestId = ++mappingSelectionRequestSeq;
    activeMappingSelectionRequestId = requestId;
    currentMappingCategory = 'public';
    currentMappingReportCode = '';
    currentMappingApiReportCode = '';
    currentMappingConfig = null;
    mappingTableDirty = false;
    window.currentMappingConfigData = null;
    window.currentTemplateColumnsInfo = null;
    const contentDiv = document.getElementById('mappingConfigContent');

    document.querySelectorAll('.mapping-report-item').forEach(item => {
        item.style.background = 'white';
        item.style.border = '1px solid #e9ecef';
        item.style.boxShadow = 'none';
    });

    const selectedItem = document.querySelector(`.mapping-report-item[data-category="public"][data-code="${configKey}"]`);
    if (selectedItem) {
        selectedItem.style.background = '#e7f5ff';
        selectedItem.style.border = '2px solid #28a745';
        selectedItem.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.25)';
    }

    try {
        const publicConfig = publicMappingConfigMap[configKey];
        if (!publicConfig) {
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545;">
                    <div style="font-size: 14px;">未找到公共配置定义</div>
                </div>
            `;
            return;
        }

        let resolvedConfig = { ...publicConfig };
        if (publicConfig.detail_api) {
            const response = await fetch(publicConfig.detail_api);
            const data = await response.json();
            if (data.success && data.data) {
                resolvedConfig = {
                    ...publicConfig,
                    ...data.data,
                    metadata: publicConfig
                };
            }
        }

        updatePublicConfigOverview(resolvedConfig);

        if (resolvedConfig.editor_mode === 'business_system_name_mapping' || resolvedConfig.config_type === 'mapping_table') {
            renderBusinessSystemPublicConfig(resolvedConfig, contentDiv);
        } else {
            renderGenericPublicConfig(resolvedConfig, contentDiv);
        }
    } catch (e) {
        console.error('加载公共配置失败:', e);
        contentDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #dc3545;">
                <div style="font-size: 14px;">加载公共配置失败</div>
            </div>
        `;
        showToast('加载公共配置失败', true);
    }
}

// 选择报表显示映射配置
async function selectMappingReport(category, reportCode, options = {}) {
    const forceSwitch = options && options.force === true;
    const isSwitchingToDifferentReport = currentMappingCategory !== category || currentMappingReportCode !== reportCode;
    if (!forceSwitch && isSwitchingToDifferentReport && mappingTableDirty) {
        const shouldSaveBeforeSwitch = confirm(
            '检测到当前映射有未保存修改。\n\n点击“确定”：先保存再切换报表\n点击“取消”：不保存并继续切换'
        );

        if (shouldSaveBeforeSwitch) {
            const saved = await saveMappingConfig();
            if (!saved) {
                showToast('保存失败，已取消切换报表', true);
                return;
            }
        } else {
            const shouldDiscardChanges = confirm('确定不保存并切换吗？未保存修改将丢失。');
            if (!shouldDiscardChanges) {
                return;
            }
            mappingTableDirty = false;
        }
    }
    const requestId = ++mappingSelectionRequestSeq;
    activeMappingSelectionRequestId = requestId;

    // 确定分类颜色
    const categoryColors = {
        'yeji': '#005fe0',
        'smc': '#28a745',
        'xinan': '#dc3545'
    };
    const categoryColor = categoryColors[category];
    updateMappingOverview(category, reportCode);

    // 更新选中状态
    document.querySelectorAll('.mapping-report-item').forEach(item => {
        item.style.background = 'white';
        item.style.border = '1px solid #e9ecef';
        item.style.boxShadow = 'none';
    });

    const selectedItem = document.querySelector(`.mapping-report-item[data-category="${category}"][data-code="${reportCode}"]`);
    if (selectedItem) {
        selectedItem.style.background = '#e7f5ff';
        selectedItem.style.border = `2px solid ${categoryColor}`;
        selectedItem.style.boxShadow = `0 4px 12px ${categoryColor}40`;
    }

    // 加载映射配置
    currentMappingCategory = category;
    currentMappingReportCode = reportCode;
    currentMappingApiReportCode = reportCode;

    try {
        // 将中文代码映射为英文代码
        const actualReportCode = reportCodeMapping[reportCode] || reportCode;

        // 先获取映射配置
        const configRes = await fetch(API_BASE + `/mapping-config/${category}/${actualReportCode}`);
        if (requestId !== activeMappingSelectionRequestId) {
            return;
        }

        // 处理404错误（报表暂无映射配置）
        if (configRes.status === 404) {
            currentMappingConfig = null;
            currentMappingApiReportCode = '';
            mappingTableDirty = false;
            window.currentMappingConfigData = null;
            window.currentTemplateColumnsInfo = null;
            const contentDiv = document.getElementById('mappingConfigContent');
            contentDiv.innerHTML = `
                <div class="mapping-empty-state mapping-empty-state--center">
                    <span class="mapping-empty-state__badge">未配置</span>
                    <div class="mapping-empty-state__title">当前报表暂无映射配置</div>
                    <div class="mapping-empty-state__desc">请先配置报表的映射规则，然后再进入编辑器查看详情。</div>
                </div>
            `;
            return;
        }

        const configResult = await configRes.json();
        if (requestId !== activeMappingSelectionRequestId) {
            return;
        }

        if (configResult.success && configResult.data) {
            currentMappingApiReportCode = configResult.matched_key || actualReportCode || reportCode;
            currentMappingConfig = configResult.data;

            // ===== 新增：读取模板文件的列信息 =====
            let templateColumnsInfo = null;
            const templateFile = configResult.data.template_file;

            if (templateFile) {
                try {
                    console.log('[selectMappingReport] 正在分析模板文件:', templateFile);
                    const templateBaseName = templateFile.split('/').pop().replace('.xlsx', '');

                    const analyzeRes = await fetch(API_BASE + '/mapping-config/analyze-template', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ template_base_name: templateBaseName })
                    });
                    if (requestId !== activeMappingSelectionRequestId) {
                        return;
                    }

                    const analyzeResult = await analyzeRes.json();
                    if (requestId !== activeMappingSelectionRequestId) {
                        return;
                    }

                    if (analyzeResult.success && analyzeResult.data) {
                        templateColumnsInfo = analyzeResult.data;
                        console.log('[selectMappingReport] 模板分析成功:', templateColumnsInfo.total_columns, '列');

                        // 验证并补充缺失的列
                        const templateColumns = templateColumnsInfo.columns;
                        const mappingRules = configResult.data.mapping_rules || [];

                        if (templateColumns.length > mappingRules.length) {
                            console.warn(`[selectMappingReport] 模板有${templateColumns.length}列，但配置只有${mappingRules.length}条，需要补充`);

                            // 补充缺失的列配置
                            for (let i = mappingRules.length; i < templateColumns.length; i++) {
                                const templateCol = templateColumns[i];
                                const newRule = {
                                    target_column: templateCol.letter,
                                    target_name: templateCol.name || templateCol.letter,
                                    source_type: 'fixed',
                                    source_value: '',
                                    transform: '',
                                    description: '自动补充（请配置）',
                                    remarks: `从模板文件自动补充：${templateCol.name}`
                                };
                                mappingRules.push(newRule);
                                console.log(`[selectMappingReport] 已补充第${i + 1}列: ${templateCol.letter} - ${templateCol.name}`);
                            }

                            // 更新配置
                            currentMappingConfig.mapping_rules = mappingRules;
                            console.log(`[selectMappingReport] 配置已更新为${mappingRules.length}条规则`);

                            // 自动保存补充后的配置到后端
                            try {
                                const saveRes = await fetch(API_BASE + `/mapping-config/${currentMappingCategory}/${currentMappingApiReportCode || currentMappingReportCode}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(currentMappingConfig)
                                });
                                const saveResult = await saveRes.json();
                                if (saveResult.success) {
                                    console.log('[selectMappingReport] 自动保存配置成功');
                                } else {
                                    console.warn('[selectMappingReport] 自动保存配置失败:', saveResult.error);
                                }
                            } catch (saveErr) {
                                console.warn('[selectMappingReport] 自动保存配置异常:', saveErr);
                            }
                        } else if (templateColumns.length < mappingRules.length) {
                            console.warn(`[selectMappingReport] 模板只有${templateColumns.length}列，但配置有${mappingRules.length}条，可能有多余配置`);
                        } else {
                            console.log(`[selectMappingReport] 模板列数与配置规则数一致: ${templateColumns.length}条`);
                        }
                    } else {
                        console.warn('[selectMappingReport] 模板分析失败:', analyzeResult.error);
                    }
                } catch (e) {
                    console.warn('[selectMappingReport] 分析模板文件失败:', e);
                }
            }

            // 获取数据源列信息：映射编辑器始终预取两边字段，避免双源规则进入空列表
            const dataSource = configResult.data.data_source || 'assets';

            console.log('[selectMappingReport] 准备获取双源列信息，主数据源:', dataSource);

            const loadedColumnsBySource = await ensureMappingDataSourceColumns(['assets', 'merge_results']);
            if (requestId !== activeMappingSelectionRequestId) {
                return;
            }
            const preferredDataSourceColumns = loadedColumnsBySource[dataSource] || [];

            renderMappingConfig(configResult.data, preferredDataSourceColumns, templateColumnsInfo);
        } else {
            if (requestId !== activeMappingSelectionRequestId) {
                return;
            }
            currentMappingConfig = null;
            currentMappingApiReportCode = '';
            mappingTableDirty = false;
            window.currentMappingConfigData = null;
            showToast('加载映射配置失败', true);
        }
    } catch (e) {
        if (requestId !== activeMappingSelectionRequestId) {
            return;
        }
        currentMappingConfig = null;
        currentMappingApiReportCode = '';
        window.currentMappingConfigData = null;
        console.error('加载映射配置失败:', e);
        showToast('加载映射配置失败: ' + e.message, true);
    }
}

// 加载数据源列名
async function loadDataSourceColumns(dataSource) {
    if (dataSourceColumns[dataSource] && dataSourceColumns[dataSource].length > 0) {
        return;  // 已加载过
    }

    try {
        // assets使用 /api/columns，merge_results使用 /api/merge/columns
        const endpoint = dataSource === 'assets' ? '/columns' : '/merge/columns';
        const res = await fetch(API_BASE + endpoint);
        const result = await res.json();

        // 提取列名数组
        let columns = [];

        if (dataSource === 'assets') {
            // assets格式: {"SMC": {...}, "业支": {...}, "全部": {columns: [...]}}
            if (result && result['全部'] && result['全部'].columns) {
                columns = result['全部'].columns.map(col => col.name);
            }
        } else {
            // merge_results格式: {actionColumn: {...}, columns: [...], ...}
            if (result && result.columns && Array.isArray(result.columns)) {
                columns = result.columns.map(col => col.name);
            }
        }

        dataSourceColumns[dataSource] = columns;
        console.log(`已加载${dataSource}的列名:`, columns);
    } catch (e) {
        console.error('加载列名失败:', e);
        dataSourceColumns[dataSource] = [];
    }
}

function mergeDataSourceColumns(existingColumns = {}, nextColumns = {}) {
    const mergedColumns = {
        ...(existingColumns || {})
    };

    Object.entries(nextColumns || {}).forEach(([dataSource, columns]) => {
        if (Array.isArray(columns) && columns.length > 0) {
            mergedColumns[dataSource] = columns;
        } else if (!Array.isArray(mergedColumns[dataSource])) {
            mergedColumns[dataSource] = [];
        }
    });

    return mergedColumns;
}

function resolveMergeResultsIndexMode(config = currentMappingConfig) {
    return 'database';
}

function getIndexedDataSourceColumns(dataSource, config = currentMappingConfig, providedColumns = null) {
    const rawColumns = Array.isArray(providedColumns)
        ? providedColumns
        : Array.isArray((window.currentDataSourceColumns || {})[dataSource])
            ? window.currentDataSourceColumns[dataSource]
            : Array.isArray((dataSourceColumns || {})[dataSource])
                ? dataSourceColumns[dataSource]
                : [];

    const useDatabaseIndex = dataSource === 'merge_results'
        && resolveMergeResultsIndexMode(config) === 'database';

    return rawColumns.map((col, idx) => {
        const columnObject = (col && typeof col === 'object') ? col : { name: col };
        const name = columnObject.name || columnObject.field_name || String(col || '');
        const fallbackIndex = useDatabaseIndex ? idx + 1 : idx;
        const parsedIndex = Number.parseInt(columnObject.index, 10);
        const index = useDatabaseIndex
            ? idx + 1
            : (Number.isNaN(parsedIndex) ? fallbackIndex : parsedIndex);
        const displayName = useDatabaseIndex
            ? `索引${index}: ${name}`
            : (columnObject.display_name || `索引${index}: ${name}`);

        return {
            ...columnObject,
            name,
            index,
            display_name: displayName
        };
    });
}

function findIndexedColumn(columns, fieldIndex) {
    return (columns || []).find(col => String(col.index) === String(fieldIndex));
}

function formatColumnDisplayLabel(column, fallbackValue = '') {
    const columnObject = column && typeof column === 'object' ? column : null;
    const rawIndex = columnObject ? columnObject.index : fallbackValue;
    const parsedIndex = Number.parseInt(rawIndex, 10);
    const indexText = Number.isNaN(parsedIndex) ? String(rawIndex || '').trim() : `索引${parsedIndex}`;
    const name = String(
        columnObject?.name
        || columnObject?.field_name
        || columnObject?.display_name
        || ''
    ).trim();

    if (columnObject?.display_name && String(columnObject.display_name).trim()) {
        return String(columnObject.display_name).trim();
    }
    if (indexText && name) {
        return `${indexText}: ${name}`;
    }
    if (name) {
        return name;
    }
    if (indexText) {
        return `${indexText}: 当前配置值（字段名未加载）`;
    }
    return '当前配置值（字段名未加载）';
}

function buildColumnOptionsHtml(columns, selectedValue) {
    const optionsHtml = (columns || []).map(col => {
        const selected = String(selectedValue) === String(col.index) || String(selectedValue) === String(col.name)
            ? 'selected'
            : '';
        return `<option value="${col.index}" ${selected}>${formatColumnDisplayLabel(col, col.index)}</option>`;
    });

    const currentValue = String(selectedValue === undefined || selectedValue === null ? '' : selectedValue).trim();
    if (currentValue && !(columns || []).some(col =>
        currentValue === String(col.index)
        || currentValue === String(col.name || '')
        || currentValue === String(col.display_name || '')
    )) {
        const fallbackLabel = /^-?\d+$/.test(currentValue)
            ? `索引${currentValue}: 当前配置值（字段名未加载）`
            : `${currentValue}（当前配置值）`;
        optionsHtml.unshift(`<option value="${currentValue}" selected>${fallbackLabel}</option>`);
    }

    return optionsHtml.join('');
}

function getIndexHintText(dataSource, config = currentMappingConfig) {
    if (dataSource === 'merge_results' && resolveMergeResultsIndexMode(config) === 'database') {
        return '使用数据库真实索引，id=0 为系统列，业务字段从 1 开始';
    }
    return '字段索引从 0 开始';
}

async function ensureMappingDataSourceColumns(dataSources = ['assets', 'merge_results']) {
    const loadedColumnsBySource = {};
    const uniqueDataSources = [...new Set((dataSources || []).filter(Boolean))];

    for (const dataSource of uniqueDataSources) {
        const cachedColumns = Array.isArray(window.currentDataSourceColumns?.[dataSource])
            ? window.currentDataSourceColumns[dataSource]
            : [];

        if (cachedColumns.length > 0) {
            loadedColumnsBySource[dataSource] = cachedColumns;
            continue;
        }

        try {
            const columnsRes = await fetch(API_BASE + `/data-source-columns/${dataSource}`);
            const columnsResult = await columnsRes.json();

            if (columnsResult.success && Array.isArray(columnsResult.columns)) {
                loadedColumnsBySource[dataSource] = columnsResult.columns;
                console.log(`[ensureMappingDataSourceColumns] 成功加载${dataSource === 'assets' ? '数据概览' : '合并结果'}表字段:`, columnsResult.columns.length, '个');
            } else {
                loadedColumnsBySource[dataSource] = [];
                console.warn('[ensureMappingDataSourceColumns] 获取列信息失败:', dataSource, columnsResult.error);
            }
        } catch (e) {
            loadedColumnsBySource[dataSource] = [];
            console.warn('[ensureMappingDataSourceColumns] 获取数据源列信息失败:', dataSource, e);
        }
    }

    window.currentDataSourceColumns = mergeDataSourceColumns(window.currentDataSourceColumns, loadedColumnsBySource);
    return loadedColumnsBySource;
}

// 动态生成数据源值输入控件
function generateSourceValueInput(config, ruleIndex) {
    const rule = config.mapping_rules[ruleIndex];
    const sourceType = rule.source_type;

    // 条件判断类型：显示预设模板选择器
    if (sourceType === 'conditional') {
        return generateConditionalTemplateSelect(rule, config);
    }

    // 多字段条件判断类型：显示多字段条件配置器
    if (sourceType === 'multi_conditional') {
        return generateMultiConditionalInput(rule, config);
    }

    // 根据source_type确定使用哪个数据源的列名
    let dataSource = null;

    if (sourceType === 'field_index_assets' || sourceType === 'field_name_assets') {
        dataSource = 'assets';
    } else if (sourceType === 'field_index_merge_results' || sourceType === 'field_name_merge_results') {
        dataSource = 'merge_results';
    } else if (sourceType === 'field_index' || sourceType === 'field_name') {
        // 兼容旧版本：统一按索引处理
        dataSource = config.data_source;
    }

    console.log('generateSourceValueInput调用:', {
        sourceType,
        dataSource,
        hasColumns: !!(dataSource && dataSourceColumns[dataSource]),
        columnsCount: dataSource ? dataSourceColumns[dataSource]?.length || 0 : 0
    });

    // 字段索引类型：显示带列标识的下拉框
    if (dataSource && dataSourceColumns[dataSource] && dataSourceColumns[dataSource].length > 0) {
        const columns = getIndexedDataSourceColumns(dataSource, config, dataSourceColumns[dataSource]);
        const columnOptions = buildColumnOptionsHtml(columns, rule.source_value);

        console.log('生成字段索引下拉框，数据源:', dataSource, '选项数:', columns.length);
        return `
            <select data-field="source_value"
                style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                <option value="">-- 选择列 --</option>
                ${columnOptions}
            </select>
            <div style="font-size: 10px; color: #999; margin-top: 2px;">${getIndexHintText(dataSource, config)}</div>
        `;
    }
    // 固定值类型：添加常用值提示
    else if (sourceType === 'fixed') {
        const commonFixedValues = {
            '所属部门': ['数智化部', '信息部', '技术部'],
            '公司': ['湖北移动', '中国移动'],
            '网络': ['业支网', 'SMC网', '信安网', '政企网'],
            '字符集': ['UTF8', 'GBK', 'UTF-8'],
            '归属4A': ['湖北4A', '4A管控'],
            '资产归属': ['1', '0'],
            '版本': ['1', '2', '3']
        };

        // 根据目标列名提供常用值
        let suggestions = [];
        const targetName = rule.target_name || '';
        for (const [key, values] of Object.entries(commonFixedValues)) {
            if (targetName.includes(key) || key.includes(targetName)) {
                suggestions = values;
                break;
            }
        }

        // 如果没有匹配的，提供一些通用值
        if (suggestions.length === 0) {
            if (targetName.includes('数据') || targetName.includes('来源')) {
                suggestions = ['生产运营中产生', '系统自动采集', '人工录入'];
            } else if (targetName.includes('对外') || targetName.includes('提供')) {
                suggestions = ['不涉及对外提供', '根据需求提供', '定期提供'];
            } else if (targetName.includes('处理') || targetName.includes('方式')) {
                suggestions = ['数据收集|数据传输|数据存储|数据使用加工|数据销毁', '数据存储|数据处理'];
            }
        }

        let suggestionHtml = '';
        if (suggestions.length > 0) {
            suggestionHtml = `
                <div style="font-size: 10px; color: #666; margin-top: 4px;">
                    常用值：
                    ${suggestions.map(v => `<a href="#" onclick="event.preventDefault(); this.closest('td').querySelector('input').value='${v}';" style="color: #005fe0; text-decoration: none; margin-right: 8px;">${v}</a>`).join('')}
                </div>
            `;
        }

        return `
            <input type="text" value="${rule.source_value || ''}" data-field="source_value"
                style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
                placeholder="输入固定值，如：数智化部">
            ${suggestionHtml}
        `;
    }
    // 其他类型：普通文本框
    else {
        console.log('生成普通文本框，sourceType:', sourceType);
        const placeholder = getSourceTypePlaceholder(sourceType);
        const hint = getSourceTypeHint(sourceType);

        return `
            <input type="text" value="${rule.source_value || ''}" data-field="source_value"
                style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
                placeholder="${placeholder}">
            ${hint ? `<div style="font-size: 10px; color: #999; margin-top: 2px;">${hint}</div>` : ''}
        `;
    }
}

// 生成条件判断模板选择器
function generateConditionalTemplateSelect(rule, config) {
    // 预设的条件判断模板
    const conditionalTemplates = [
        {
            id: 'data_storage_status',
            name: '数据存储状态判断',
            description: '根据数据分级判断：1/2→未处理，3→脱敏，4→加密',
            config: {
                source_value: '9',
                conditions: [
                    { match: '1', result: '未处理' },
                    { match: '2', result: '未处理' },
                    { match: '3', result: '数据脱敏处理' },
                    { match: '4', result: '数据加密处理' }
                ],
                default: '未处理'
            }
        },
        {
            id: 'data_purpose_ad_class',
            name: '处理目的判断(A-D类)',
            description: '字段分类为A-D类时，返回"数据留痕"',
            config: {
                source_value: '8',
                conditions: [
                    { match: '^A\\d+-', regex: true, result: '数据留痕' },
                    { match: '^B\\d+-', regex: true, result: '数据留痕' },
                    { match: '^C\\d+-', regex: true, result: '数据留痕' },
                    { match: '^D\\d+-', regex: true, result: '数据留痕' }
                ],
                default: ''
            }
        },
        {
            id: 'data_path_ad_class',
            name: '流转路径判断(A-D类)',
            description: '字段分类为A-D类时，返回"不进行外部流转"',
            config: {
                source_value: '8',
                conditions: [
                    { match: '^A\\d+-', regex: true, result: '不进行外部流转' },
                    { match: '^B\\d+-', regex: true, result: '不进行外部流转' },
                    { match: '^C\\d+-', regex: true, result: '不进行外部流转' },
                    { match: '^D\\d+-', regex: true, result: '不进行外部流转' }
                ],
                default: ''
            }
        },
        {
            id: 'data_scenario_ad_class',
            name: '业务场景判断(A-D类)',
            description: '字段分类为A-D类时，返回"业务数据安全管理"',
            config: {
                source_value: '8',
                conditions: [
                    { match: '^A\\d+-', regex: true, result: '业务数据安全管理' },
                    { match: '^B\\d+-', regex: true, result: '业务数据安全管理' },
                    { match: '^C\\d+-', regex: true, result: '业务数据安全管理' },
                    { match: '^D\\d+-', regex: true, result: '业务数据安全管理' }
                ],
                default: ''
            }
        },
        {
            id: 'data_measure_ad_class',
            name: '保障措施判断(A-D类)',
            description: '字段分类为A-D类时，返回"4A管控"',
            config: {
                source_value: '8',
                conditions: [
                    { match: '^A\\d+-', regex: true, result: '4A管控' },
                    { match: '^B\\d+-', regex: true, result: '4A管控' },
                    { match: '^C\\d+-', regex: true, result: '4A管控' },
                    { match: '^D\\d+-', regex: true, result: '4A管控' }
                ],
                default: ''
            }
        },
        {
            id: 'custom',
            name: '自定义条件',
            description: '手动配置条件和结果',
            config: null
        }
    ];

    // 检查当前规则匹配哪个模板
    let selectedTemplate = 'custom';
    if (rule.conditions && rule.conditions.length > 0) {
        // 尝试匹配现有模板
        for (const template of conditionalTemplates) {
            if (template.id === 'custom') continue;
            if (JSON.stringify(rule.conditions) === JSON.stringify(template.config.conditions) &&
                rule.source_value === template.config.source_value) {
                selectedTemplate = template.id;
                break;
            }
        }
    }

    const options = conditionalTemplates.map(template =>
        `<option value="${template.id}" ${selectedTemplate === template.id ? 'selected' : ''}>${template.name}</option>`
    ).join('');

    // 生成模板说明
    const selectedTemplateObj = conditionalTemplates.find(t => t.id === selectedTemplate);
    const description = selectedTemplateObj ? selectedTemplateObj.description : '';

    return `
        <select data-field="conditional_template" onchange="onConditionalTemplateChange(this, ${config.mapping_rules.indexOf(rule)})"
            style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; margin-bottom: 4px;">
            ${options}
        </select>
        <div style="font-size: 10px; color: #666; margin-bottom: 4px; padding: 4px; background: #f8f9fa; border-radius: 4px;">${description}</div>
        <input type="hidden" data-field="source_value" value="${rule.source_value || ''}">
        <input type="hidden" data-field="conditions_json" value='${rule.conditions ? JSON.stringify(rule.conditions) : ""}'>
        <input type="hidden" data-field="default_value" value="${rule.default !== undefined ? rule.default : ""}">
    `;
}

// 条件模板选择变化时的处理
function onConditionalTemplateChange(select, ruleIndex) {
    const templateId = select.value;
    const row = select.closest('tr');

    // 预设模板配置
    const templates = {
        'data_storage_status': {
            source_value: '9',
            conditions: [
                { match: '1', result: '未处理' },
                { match: '2', result: '未处理' },
                { match: '3', result: '数据脱敏处理' },
                { match: '4', result: '数据加密处理' }
            ],
            default: '未处理'
        },
        'data_purpose_ad_class': {
            source_value: '8',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '数据留痕' },
                { match: '^B\\d+-', regex: true, result: '数据留痕' },
                { match: '^C\\d+-', regex: true, result: '数据留痕' },
                { match: '^D\\d+-', regex: true, result: '数据留痕' }
            ],
            default: ''
        },
        'data_path_ad_class': {
            source_value: '8',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '不进行外部流转' },
                { match: '^B\\d+-', regex: true, result: '不进行外部流转' },
                { match: '^C\\d+-', regex: true, result: '不进行外部流转' },
                { match: '^D\\d+-', regex: true, result: '不进行外部流转' }
            ],
            default: ''
        },
        'data_scenario_ad_class': {
            source_value: '8',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '业务数据安全管理' },
                { match: '^B\\d+-', regex: true, result: '业务数据安全管理' },
                { match: '^C\\d+-', regex: true, result: '业务数据安全管理' },
                { match: '^D\\d+-', regex: true, result: '业务数据安全管理' }
            ],
            default: ''
        },
        'data_measure_ad_class': {
            source_value: '8',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4A管控' },
                { match: '^C\\d+-', regex: true, result: '4A管控' },
                { match: '^D\\d+-', regex: true, result: '4A管控' }
            ],
            default: ''
        }
    };

    // 更新隐藏字段的值
    if (templateId !== 'custom' && templates[templateId]) {
        const template = templates[templateId];
        row.querySelector('[data-field="source_value"]').value = template.source_value;
        row.querySelector('[data-field="conditions_json"]').value = JSON.stringify(template.conditions);
        row.querySelector('[data-field="default_value"]').value = template.default;

        // 显示提示
        showToast(`已应用"${select.options[select.selectedIndex].text.replace(/^[^\s]+\s/, '')}"模板`, false);
    }

    // 更新说明
    const description = select.options[select.selectedIndex].text;
    const descDiv = select.nextElementSibling;
    if (descDiv && descDiv.style.background === '#f8f9fa') {
        descDiv.textContent = description.split(' - ')[1] || description;
    }
}

// 生成多字段条件配置器（简化版，只显示按钮）
function generateMultiConditionalInput(rule, config) {
    const conditions = rule.conditions || [];
    const logic = rule.logic || 'AND';
    const matchResult = rule.result || '';
    const defaultResult = rule.default || '';

    // 生成条件摘要
    const summary = conditions.map((cond, idx) => {
        const dataSource = resolveEffectiveMappingDataSource(config || currentMappingConfig || {});
        const columns = getIndexedDataSourceColumns(dataSource, config);
        const col = findIndexedColumn(columns, cond.field_index);
        const colName = col ? (col.name || col) : `索引${cond.field_index}`;
        return `${colName}包含"${cond.match}"`;
    }).join(logic === 'AND' ? ' 且 ' : ' 或 ');

    return `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <button type="button" class="btn-config-multi-cond"
                onclick="openMultiConditionalModal(event)"
                style="padding: 8px 16px; background: #005fe0; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: background 0.2s; font-weight: 500;"
                onmouseover="this.style.background='#0047b3'" onmouseout="this.style.background='#005fe0'">
                [配置多字段条件]
            </button>
            <div style="font-size: 11px; color: #666; line-height: 1.4; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 2px solid #005fe0;">
                <strong>当前逻辑：</strong><br>
                <span style="color: #333;">${summary || '未配置条件'}</span><br>
                <span style="color: #28a745;">&rarr; ${matchResult}</span> / <span style="color: #6c757d;">默认：${defaultResult}</span>
            </div>
            <!-- 隐藏字段，用于保存配置 -->
            <input type="hidden" id="multi_cond_config" data-field="multi_conditional_config"
                value='${JSON.stringify({conditions, logic, result: matchResult, default: defaultResult})}'>
        </div>
    `;
}

// 添加多字段条件
function addMultiCondition() {
    const container = document.getElementById('multi_cond_conditions_list');
    const idx = container.querySelectorAll('.multi-condition-row').length;

    const dataSource = resolveEffectiveMappingDataSource(currentMappingConfig || {});
    const columns = getIndexedDataSourceColumns(dataSource, currentMappingConfig);

    // 生成字段选项
    let fieldOptions = '';
    if (columns.length > 0) {
        fieldOptions = buildColumnOptionsHtml(columns, '');
    } else {
        fieldOptions = '<option value="" disabled>[数据加载失败]</option>';
    }

    const newCondHtml = `
        <div class="multi-condition-row" data-cond-idx="${idx}" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 12px; background: white; border-radius: 6px; border: 2px solid #dee2e6; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 13px; font-weight: 600; color: #495057; min-width: 50px; padding: 6px 10px; background: #e9ecef; border-radius: 4px; text-align: center;">条件${idx + 1}</div>
            <select class="cond-field-select" style="flex: 2; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;" data-field="conditions.${idx}.field_index">
                <option value="">-- 选择字段 --</option>
                ${fieldOptions}
            </select>
            <select class="cond-operator-select" style="width: 110px; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;" disabled>
                <option value="contains">包含</option>
                <option value="regex">正则</option>
            </select>
            <input type="text" class="cond-match-input" placeholder="输入匹配值"
                style="flex: 1.5; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;"
                data-field="conditions.${idx}.match">
            <button type="button" class="btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.2s;"
                onclick="removeMultiCondition(${idx})" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">删除</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', newCondHtml);
}

// 删除多字段条件
function removeMultiCondition(idx) {
    const row = document.querySelector(`.multi-condition-row[data-cond-idx="${idx}"]`);
    if (row) {
        row.remove();
        // 重新编号
        document.querySelectorAll('.multi-condition-row').forEach((row, newIdx) => {
            row.dataset.condIdx = newIdx;
            row.querySelector('div:first-child').textContent = `条件${newIdx + 1}`;
            // 更新data-field属性中的索引
            row.querySelectorAll('[data-field]').forEach(input => {
                const field = input.getAttribute('data-field');
                if (field && field.startsWith('conditions.')) {
                    input.setAttribute('data-field', field.replace(/conditions\.\d+/, `conditions.${newIdx}`));
                }
            });
            row.querySelector('.btn-remove-cond').setAttribute('onclick', `removeMultiCondition(${newIdx})`);
        });
    }
}

// 生成转换规则下拉框
function generateTransformSelect(rule) {
    const transformOptions = [
        { value: '', label: '不转换（原样输出）' },
        { value: 'split_before_slash', label: '取 / 前部分（如：db_name/schema → db_name）' },
        { value: 'remove_ip_brackets', label: '去除IP标识（如：表名[192.168.1.1] → 表名）' },
        { value: 'strip_general_level_suffix', label: '去除末尾级别说明（如：C2-2：终端设备资料（一般级-第2小级）→ C2-2：终端设备资料）' }
    ];

    const currentTransform = rule.transform || '';

    const options = transformOptions.map(opt =>
        `<option value="${opt.value}" ${currentTransform === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    return `
        <select data-field="transform"
            style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
            ${options}
        </select>
        <div style="font-size: 10px; color: #999; margin-top: 2px;">选择数据处理方式</div>
    `;
}

// ==================== 动态生成配置列内容 ====================

// 生成"数据来源配置"列的内容
/**
 * 生成"数据来源配置"列的内容
 * 使用三层架构系统渲染
 */
function generateDataSourceConfig(config, ruleIndex) {
    const rule = config.mapping_rules[ruleIndex];
    const sourceType = rule.source_type;

    // 使用三层架构系统渲染
    return ThreeLayerArchitecture.renderSourceConfig(sourceType, rule, config);
}

/**
 * 生成"数据处理配置"列的内容
 * 使用三层架构系统渲染
 */
function generateDataProcessConfig(rule) {
    const sourceType = rule.source_type;

    // 使用三层架构系统渲染
    return ThreeLayerArchitecture.renderProcessConfig(sourceType, rule);
}

/**
 * 生成固定值输入框（保留用于兼容）
 */
function generateFixedValueInput(rule, config) {
    return `
        <input type="text" data-field="source_value" value="${rule.source_value || ''}" placeholder="输入固定值"
            style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
    `;
}

/**
 * 生成第2层数据源选项
 * @param {string} operationType - 操作类型（read/calculate/lookup）
 * @param {string} currentSourceType - 当前选中的数据源类型
 * @returns {string} HTML选项字符串
 */
function generateSourceOptions(operationType, currentSourceType) {
    const sources = ThreeLayerArchitecture.getSourcesByOperation(operationType);

    return Object.entries(sources).map(([id, source]) => {
        // 转换为旧类型ID用于对比
        const oldTypeId = ThreeLayerArchitecture.convertToOldType(id);
        const selected = currentSourceType === oldTypeId ? 'selected' : '';
        return `<option value="${oldTypeId}" ${selected}>${source.name} - ${source.description}</option>`;
    }).join('');
}

/**
 * 根据旧类型ID推断操作类型
 * @param {string} sourceType - 数据源类型（旧格式）
 * @returns {string} 操作类型（read/calculate/lookup）
 */
function inferOperationFromSourceType(sourceType) {
    return ThreeLayerArchitecture.inferOperationFromSourceType(sourceType) || 'read';
}

// 生成字段选择下拉框
function generateFieldIndexSelect(rule, config) {
    const sourceType = rule.source_type;
    const dataSource = sourceType === 'field_index_assets' ? 'assets' : 'merge_results';
    const allColumns = window.currentDataSourceColumns || {};
    const columns = getIndexedDataSourceColumns(dataSource, config);

    console.log('[generateFieldIndexSelect] dataSource:', dataSource, 'columns长度:', columns.length);
    console.log('[generateFieldIndexSelect] allColumns:', allColumns);

    if (columns.length === 0) {
        return `
            <div style="padding: 10px; background: #fff3cd; border-radius: 4px; text-align: center; color: #856404; font-size: 12px;">
                [字段列表加载失败，请刷新页面重试]
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 4px;">
                数据源: ${dataSource}, 可用数据源: ${Object.keys(allColumns).join(', ') || '无'}
            </div>
        `;
    }

    const columnOptions = buildColumnOptionsHtml(columns, rule.source_value);

    return `
        <select data-field="source_value"
            style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
            <option value="">-- 选择字段 --</option>
            ${columnOptions}
        </select>
        <div style="font-size: 10px; color: #999;">${getIndexHintText(dataSource, config)}</div>
    `;
}

// 获取source_type的占位符
function getSourceTypePlaceholder(sourceType) {
    const placeholders = {
        'fixed': '输入固定值，如：数智化部',
        'conditional': '输入判断源字段的索引（如：9）',
        'lookup_ip': '输入IP字段名称（如：数据源IP）',
        'sequence': '自动生成，无需输入',
        'vlookup_assets': '自动查询，无需输入',
        'vlookup_assets_with_mapping': '自动查询，无需输入',
        'field_index_assets': '通过下拉框选择字段',
        'field_index_merge_results': '通过下拉框选择字段'
    };
    return placeholders[sourceType] || '输入值';
}

// ===== 单字段条件配置模态框 =====

let currentSingleCondRuleIndex = -1;

function getSingleConditionalTemplatePresets() {
    return {
        'data_storage_status': {
            label: '数据存储状态判断',
            conditions: [
                { match: '1', result: '未处理' },
                { match: '2', result: '未处理' },
                { match: '3', result: '数据脱敏处理' },
                { match: '4', result: '数据加密处理' }
            ],
            default: '未处理'
        },
        'data_purpose_ad_class': {
            label: '处理目的判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        },
        'data_path_ad_class': {
            label: '流转路径判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        },
        'data_scenario_ad_class': {
            label: '应用场景判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        },
        'data_measure_ad_class': {
            label: '安全措施判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        }
    };
}

function detectSingleConditionalTemplateId(conditions = [], defaultVal = '') {
    const presets = getSingleConditionalTemplatePresets();
    const normalizedConditions = JSON.stringify(conditions || []);

    for (const [templateId, preset] of Object.entries(presets)) {
        if (
            normalizedConditions === JSON.stringify(preset.conditions || [])
            && String(defaultVal || '') === String(preset.default || '')
        ) {
            return templateId;
        }
    }

    return '';
}

// 打开单字段条件配置模态框
async function openSingleConditionalModal(evt) {
    const context = getCurrentMappingRuleFromEvent('单字段条件', evt);
    if (!context) return;

    const currentRule = context.currentRule;
    const isFieldTransform = ['field_assets_with_transform', 'field_merge_with_transform'].includes(currentRule.source_type);
    const sourceDataSource = resolveRuleSourceDataSource(currentRule, currentMappingConfig);

    currentSingleCondRuleIndex = context.ruleIndex;

    await ensureMappingColumnsLoaded([sourceDataSource]);
    const columns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);

    const conditions = currentRule.conditions || [];
    const sourceValue = currentRule.source_value || '';
    const defaultVal = currentRule.default || '';
    const remarks = currentRule.remarks || currentRule.description || '';
    const presetTemplateId = detectSingleConditionalTemplateId(conditions, defaultVal);
    const fullJsonConfig = {
        source_value: sourceValue !== '' ? parseInt(sourceValue, 10) : null,
        conditions,
        default: defaultVal,
        remarks
    };
    const selectedFieldLabel = getColumnDisplayNameFromValue(columns, sourceValue, '未选择判断字段');
    const chainSteps = [
        {
            label: '读取字段',
            text: `从${sourceDataSource === 'assets' ? '数据概览表' : '合并结果表'}读取指定字段，当前字段为 ${selectedFieldLabel}`
        },
        {
            label: '顺序判断',
            text: '按 conditions 数组从上到下依次匹配；regex=true 时按正则匹配，否则按包含关系匹配'
        },
        {
            label: '返回结果',
            text: '命中后返回对应 result，全部未命中时返回 default'
        }
    ];

    if (isFieldTransform && currentRule.transform) {
        chainSteps.push({
            label: '输出转换',
            text: `结果输出前继续执行 transform=${currentRule.transform}`
        });
    }

    const moduleHtml = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            ${buildAdvancedStepListCard(
                '执行链路',
                chainSteps,
                '#005fe0',
                '如果同一字段配置了多条条件，系统按数组顺序匹配，命中第一条后即停止继续判断。'
            )}

            <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #005fe0; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">判断源字段（从${sourceDataSource === 'assets' ? '数据概览表' : '合并结果表'}）</div>
                <select id="single_cond_source_field" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="">-- 选择字段 --</option>
                    ${buildColumnOptionsHtml(columns, sourceValue)}
                </select>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">${getIndexHintText(sourceDataSource, currentMappingConfig)}</div>
            </div>

            <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">条件模板（可选）</div>
                <select id="single_cond_template" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" onchange="applySingleConditionalTemplate(this)">
                    <option value="">-- 选择预设模板（可选）--</option>
                    <option value="data_storage_status" ${presetTemplateId === 'data_storage_status' ? 'selected' : ''}>数据存储状态判断</option>
                    <option value="data_purpose_ad_class" ${presetTemplateId === 'data_purpose_ad_class' ? 'selected' : ''}>处理目的判断(A-D类)</option>
                    <option value="data_path_ad_class" ${presetTemplateId === 'data_path_ad_class' ? 'selected' : ''}>流转路径判断(A-D类)</option>
                    <option value="data_scenario_ad_class" ${presetTemplateId === 'data_scenario_ad_class' ? 'selected' : ''}>应用场景判断(A-D类)</option>
                    <option value="data_measure_ad_class" ${presetTemplateId === 'data_measure_ad_class' ? 'selected' : ''}>安全措施判断(A-D类)</option>
                </select>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">模板只会写入 conditions 和 default，你仍然可以继续编辑完整 JSON。</div>
            </div>

            <div style="padding: 15px; background: #f0f0f0; border-left: 4px solid #6c757d; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">默认值</div>
                <input type="text" id="single_cond_default" value="${defaultVal}"
                       placeholder="所有条件都不满足时返回的值"
                       style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>

            <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #28a745; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">备注说明</div>
                <textarea id="single_cond_remarks" rows="3"
                          style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;"
                          placeholder="输入针对此列的说明，例如：依据J列（数据分级）数值判断：1或2=未处理，3=数据脱敏处理，4=数据加密处理">${remarks}</textarea>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">可在此输入针对此列的详细说明和业务规则</div>
            </div>
        </div>
    `;
    const jsonHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">完整配置（JSON格式）</div>
                <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"source_value":字段索引,"conditions":[{"match":"匹配值","regex":false,"result":"返回值"}],"default":"默认值","remarks":"备注"}</div>
                <textarea id="single_cond_json_config" rows="16"
                          style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                          onchange="updateSingleConditionalFromJSON()">${JSON.stringify(fullJsonConfig, null, 2)}</textarea>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">修改 JSON 会同步更新模块编辑里的字段、默认值和备注；conditions 请直接在此 JSON 中维护。</div>
            </div>
        </div>
    `;

    openAdvancedConfigModal({
        title: isFieldTransform ? '字段提取+条件转换配置' : '单字段条件配置',
        subtitle: isFieldTransform
            ? '先读取源字段，再按条件规则转换当前列的导出值'
            : '根据单个字段的值依次判断并返回结果',
        moduleHtml,
        jsonHtml,
        codePreviewBuilder: buildSingleConditionalCodePreview,
        saveHandler: saveSingleConditionalConfig,
        toneColor: '#005fe0',
        maxWidth: '960px',
        ruleIndex: context.ruleIndex,
        sourceType: currentRule.source_type,
        summaryText: remarks || ThreeLayerArchitecture.generateRuleSummary(
            currentRule.source_type,
            currentRule,
            currentMappingConfig
        ) || '',
        dependencyText: isFieldTransform
            ? `依赖${sourceDataSource === 'assets' ? '数据概览表' : '合并结果表'}字段、条件规则和当前列 transform`
            : `依赖${sourceDataSource === 'assets' ? '数据概览表' : '合并结果表'}字段和条件规则`
    });

    setTimeout(() => {
        watchSingleConditionalFields();
    }, 100);
}

// 关闭单字段条件配置模态框
function closeSingleConditionalModal() {
    const modal = document.getElementById('singleConditionalModal');
    if (
        currentAdvancedSaveHandler === saveSingleConditionalConfig
        && document.getElementById('advancedConfigModal')?.style.display === 'flex'
    ) {
        closeAdvancedConfigModal();
        return;
    }
    modal.style.display = 'none';
    currentSingleCondRuleIndex = -1;
}

function updateSingleConditionalFromJSON() {
    try {
        const jsonText = document.getElementById('single_cond_json_config').value;
        const config = JSON.parse(jsonText || '{}');

        if (config.source_value !== undefined && config.source_value !== null) {
            document.getElementById('single_cond_source_field').value = String(config.source_value);
        }
        if (config.default !== undefined) {
            document.getElementById('single_cond_default').value = config.default;
        }
        if (config.remarks !== undefined) {
            document.getElementById('single_cond_remarks').value = config.remarks;
        }

        const templateSelect = document.getElementById('single_cond_template');
        if (templateSelect) {
            templateSelect.value = detectSingleConditionalTemplateId(config.conditions || [], config.default || '');
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析单字段条件JSON失败:', e);
        showToast('单字段条件JSON格式错误：' + e.message, true);
    }
}

function syncSingleConditionalToJSON() {
    try {
        const existingConfig = JSON.parse(document.getElementById('single_cond_json_config').value || '{}');
        const sourceValue = document.getElementById('single_cond_source_field').value;
        const defaultVal = document.getElementById('single_cond_default').value;
        const remarks = document.getElementById('single_cond_remarks').value;

        const config = {
            source_value: sourceValue ? parseInt(sourceValue, 10) : null,
            conditions: Array.isArray(existingConfig.conditions) ? existingConfig.conditions : [],
            default: defaultVal,
            remarks
        };

        document.getElementById('single_cond_json_config').value = JSON.stringify(config, null, 2);
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步单字段条件到JSON失败:', e);
    }
}

function watchSingleConditionalFields() {
    ['single_cond_source_field', 'single_cond_default', 'single_cond_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncSingleConditionalToJSON);
            elem.addEventListener('input', syncSingleConditionalToJSON);
        }
    });
}

// ==================== 业务系统映射字典管理 ====================

let businessSystemMappings = {};
let assetsBusinessSystems = [];

// 打开业务系统映射字典编辑模态框
async function openBusinessSystemMappingModal() {
    const modal = document.getElementById('businessSystemMappingModal');
    modal.style.display = 'flex';

    // 加载当前映射配置
    await loadBusinessSystemMappingsForModal();

    // 渲染映射表格
    renderBusinessSystemMappingTable();
}

// 关闭业务系统映射字典编辑模态框
function closeBusinessSystemMappingModal() {
    document.getElementById('businessSystemMappingModal').style.display = 'none';
}

// 加载业务系统映射字典
async function loadBusinessSystemMappingsForModal() {
    try {
        const response = await fetch('/api/mapping-config?include_public=true');
        const data = await response.json();

        if (data.success && data.config && data.config.public_config) {
            const publicConfig = data.config.public_config || {};
            const businessSystemNameMapping = publicConfig.business_system_name_mapping;
            businessSystemMappings = businessSystemNameMapping ?
                businessSystemNameMapping.mappings || {} : {};
        }
    } catch (error) {
        console.error('加载业务系统映射字典失败:', error);
        businessSystemMappings = {};
    }
}

// 渲染业务系统映射表格
function renderBusinessSystemMappingTable() {
    const tbody = document.getElementById('businessSystemMappingTableBody');
    tbody.innerHTML = '';

    const entries = Object.entries(businessSystemMappings);

    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="padding: 40px; text-align: center; color: #999;">
                    <div style="font-size: 13px;">暂无映射条目，点击"添加映射"或"从数据概览表加载"开始配置</div>
                </td>
            </tr>
        `;
        return;
    }

    entries.forEach(([source, target], index) => {
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom: 1px solid #dee2e6;';
        row.innerHTML = `
            <td style="padding: 10px 15px;">
                <input type="text" value="${source}"
                    onchange="updateMappingSource('${source}', this.value)"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;">
            </td>
            <td style="padding: 10px 15px; position: relative;">
                <div style="display: flex; gap: 5px;">
                    <input type="text" value="${target}"
                        onchange="updateMappingTarget('${source}', this.value)"
                        onclick="showAssetsBusinessSystemsDropdown(this, '${source}')"
                        style="flex: 1; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; cursor: pointer;"
                        readonly>
                    <button onclick="showAssetsBusinessSystemsDropdown(this.previousElementSibling, '${source}')"
                        style="padding: 6px 10px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        ▼
                    </button>
                </div>
            </td>
            <td style="padding: 10px 15px; text-align: center;">
                <button onclick="deleteBusinessSystemMappingDraft('${source}')"
                    style="padding: 5px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    删除
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 添加新的业务系统映射条目
function addBusinessSystemMapping() {
    const newSource = '新系统名称';
    let counter = 1;
    while (businessSystemMappings[newSource]) {
        newSource = `新系统名称${counter}`;
        counter++;
    }

    businessSystemMappings[newSource] = '';
    renderBusinessSystemMappingTable();

    // 自动聚焦到新添加的输入框
    setTimeout(() => {
        const inputs = document.querySelectorAll('#businessSystemMappingTableBody input[type="text"]');
        if (inputs.length > 0) {
            inputs[inputs.length - 2].focus();
            inputs[inputs.length - 2].select();
        }
    }, 100);
}

// 更新映射源（合并结果表名称）
function updateMappingSource(oldSource, newSource) {
    if (oldSource === newSource) return;
    if (businessSystemMappings[newSource]) {
        alert(`映射源"${newSource}"已存在，请使用不同的名称`);
        renderBusinessSystemMappingTable();
        return;
    }

    const target = businessSystemMappings[oldSource];
    delete businessSystemMappings[oldSource];
    businessSystemMappings[newSource] = target;
}

// 更新映射目标（数据概览表名称）
function updateMappingTarget(source, target) {
    businessSystemMappings[source] = target;
}

// 删除业务系统映射条目
function deleteBusinessSystemMappingDraft(source) {
    if (confirm(`确认要删除映射"${source}"吗？`)) {
        delete businessSystemMappings[source];
        renderBusinessSystemMappingTable();
    }
}

// 从数据概览表加载业务系统名称
async function loadAssetsBusinessSystems() {
    try {
        const response = await fetch('/api/get_assets_business_systems');
        const data = await response.json();

        if (data.success && data.business_systems) {
            assetsBusinessSystems = data.business_systems;

            // 分析当前合并结果表中有哪些未映射的系统
            const mergeResultsResponse = await fetch('/api/get_merge_results_business_systems');
            const mergeResultsData = await mergeResultsResponse.json();

            if (mergeResultsData.success && mergeResultsData.business_systems) {
                const unmappedSystems = mergeResultsData.business_systems.filter(
                    bs => !businessSystemMappings[bs]
                );

                if (unmappedSystems.length > 0) {
                    // 尝试自动匹配
                    unmappedSystems.forEach(source => {
                        const exactMatch = assetsBusinessSystems.find(target => target === source);
                        if (exactMatch) {
                            businessSystemMappings[source] = exactMatch;
                        } else {
                            // 模糊匹配
                            const fuzzyMatch = assetsBusinessSystems.find(target =>
                                target.includes(source) || source.includes(target)
                            );
                            if (fuzzyMatch) {
                                businessSystemMappings[source] = fuzzyMatch;
                            } else {
                                businessSystemMappings[source] = '';
                            }
                        }
                    });

                    renderBusinessSystemMappingTable();

                    const matchedCount = Object.values(businessSystemMappings).filter(v => v).length;
                    alert(`已加载并尝试自动匹配${unmappedSystems.length}个业务系统\n成功匹配：${matchedCount}个\n需要手动配置：${unmappedSystems.length - matchedCount}个`);
                } else {
                    alert('当前所有合并结果表的业务系统名称都已配置映射');
                }
            }
        }
    } catch (error) {
        console.error('加载业务系统名称失败:', error);
        alert('加载业务系统名称失败，请查看控制台');
    }
}

// 显示数据概览表业务系统下拉框
function showAssetsBusinessSystemsDropdown(input, source) {
    if (assetsBusinessSystems.length === 0) {
        alert('请先点击"从数据概览表加载"按钮');
        return;
    }

    const dropdown = document.getElementById('businessSystemsDropdown');
    dropdown.innerHTML = '';

    assetsBusinessSystems.forEach(bs => {
        const option = document.createElement('div');
        option.style.cssText = 'padding: 8px 12px; cursor: pointer; font-size: 12px;';
        option.textContent = bs;
        option.onmouseover = function() { this.style.background = '#f8f9fa'; };
        option.onmouseout = function() { this.style.background = 'white'; };
        option.onclick = function() {
            input.value = bs;
            businessSystemMappings[source] = bs;
            dropdown.style.display = 'none';
        };
        dropdown.appendChild(option);
    });

    // 定位下拉框
    const rect = input.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.bottom + 2) + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.style.display = 'block';

    // 点击其他地方关闭下拉框
    setTimeout(() => {
        document.addEventListener('click', function closeDropdown(e) {
            if (!dropdown.contains(e.target) && e.target !== input) {
                dropdown.style.display = 'none';
                document.removeEventListener('click', closeDropdown);
            }
        });
    }, 10);
}

// 保存业务系统映射字典
async function saveBusinessSystemMappingDraft() {
    try {
        // 清理空值
        const cleanedMappings = {};
        for (const [source, target] of Object.entries(businessSystemMappings)) {
            if (source && target) {
                cleanedMappings[source] = target;
            }
        }

        const response = await fetch('/api/public-configs/business-system-name-mappings/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mappings: cleanedMappings
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('公共配置保存成功！');
            closeBusinessSystemMappingModal();
        } else {
            alert('保存失败：' + (data.message || '未知错误'));
        }
    } catch (error) {
        console.error('保存业务系统映射字典失败:', error);
        alert('保存失败，请查看控制台');
    }
}

// 应用单字段条件模板
function applySingleConditionalTemplate(select) {
    const template = select.value;
    if (!template) return;

    const presets = getSingleConditionalTemplatePresets();
    const preset = presets[template];
    if (preset) {
        try {
            const jsonConfig = JSON.parse(document.getElementById('single_cond_json_config').value || '{}');
            jsonConfig.conditions = preset.conditions || [];
            jsonConfig.default = preset.default || '';
            jsonConfig.remarks = jsonConfig.remarks || '';
            document.getElementById('single_cond_default').value = jsonConfig.default;
            document.getElementById('single_cond_json_config').value = JSON.stringify(jsonConfig, null, 2);
        } catch (e) {
            document.getElementById('single_cond_json_config').value = JSON.stringify({
                source_value: null,
                conditions: preset.conditions || [],
                default: preset.default || '',
                remarks: ''
            }, null, 2);
        }
        updateSingleConditionalFromJSON();
    }
}

// 保存单字段条件配置
function saveSingleConditionalConfig() {
    if (currentSingleCondRuleIndex === -1) return;

    try {
        const config = JSON.parse(document.getElementById('single_cond_json_config').value || '{}');
        const sourceValue = config.source_value === null || config.source_value === undefined ? '' : String(config.source_value);
        const conditions = Array.isArray(config.conditions) ? config.conditions : [];
        const defaultVal = config.default || '';
        const remarks = config.remarks || '';

        if (!sourceValue) {
            showToast('请选择判断源字段', true);
            return;
        }

        // 更新规则
        const rule = currentMappingConfig.mapping_rules[currentSingleCondRuleIndex];
        rule.source_value = sourceValue;
        rule.conditions = conditions;
        rule.default = defaultVal;
        rule.remarks = remarks;  // 保存备注

        // 刷新配置显示
        renderMappingConfig();
        mappingTableDirty = true;
        showToast('单字段条件配置已保存');

        closeSingleConditionalModal();
    } catch (e) {
        console.error('保存单字段条件配置失败:', e);
        showToast('保存失败：' + e.message, true);
    }
}

// ===== VLOOKUP配置模态框 =====

let currentVlookupRuleIndex = -1;
let currentVlookupWithMapping = false;

function normalizeLookupFieldIndex(value, fallback = '4') {
    const normalized = String(value === undefined || value === null ? '' : value).trim();
    return /^\d+$/.test(normalized) ? normalized : String(fallback);
}

function parseOptionalInteger(value) {
    const normalized = String(value === undefined || value === null ? '' : value).trim();
    return /^\d+$/.test(normalized) ? parseInt(normalized, 10) : null;
}

// 打开VLOOKUP配置模态框
async function openVlookupModal(evt, withMapping = false) {
    // 获取点击按钮所在的行
    const clickedButton = evt && evt.target ? evt.target : null;
    if (!clickedButton) {
        showToast('未找到触发按钮', true);
        return;
    }
    const row = clickedButton.closest('tr[data-rule-index]');

    if (!row) {
        showToast('未找到配置行', true);
        return;
    }

    const ruleIndex = parseInt(row.dataset.ruleIndex);
    const currentRule = currentMappingConfig.mapping_rules[ruleIndex];

    if (!currentRule) {
        showToast('未找到VLOOKUP配置', true);
        return;
    }

    currentVlookupRuleIndex = ruleIndex;
    currentVlookupWithMapping = withMapping;

    const lookupKey = currentRule.lookup_key || '';
    const lookupField = currentRule.lookup_field || '';
    const lookupFieldIndex = normalizeLookupFieldIndex(currentRule.lookup_field_index, '4');
    const useMapping = currentRule.use_mapping || false;
    const mappingConfig = currentRule.mapping_config || '';
    const fallbackToRawLookup = Boolean(currentRule.fallback_to_raw_lookup);
    const remarks = currentRule.remarks || currentRule.description || '';
    const sourceDataSource = resolveRuleSourceDataSource(currentRule, currentMappingConfig);
    const sourceDataSourceName = getMappingDataSourceDisplayName(sourceDataSource);

    await ensureMappingColumnsLoaded([sourceDataSource, 'assets']);
    if (withMapping) {
        try {
            await ensurePublicConfigCenterDataLoaded();
        } catch (e) {
            console.error('加载公共配置选项失败:', e);
        }
    }
    const sourceColumns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
    const assetsColumns = getIndexedDataSourceColumns('assets', currentMappingConfig);
    const lookupKeyLabel = getColumnDisplayNameFromValue(sourceColumns, lookupKey, '未选择查找键字段');
    const lookupFieldLabel = getColumnDisplayNameFromValue(assetsColumns, lookupField, '未选择返回字段');
    const lookupFieldIndexLabel = getColumnDisplayNameFromValue(
        assetsColumns,
        lookupFieldIndex,
        `索引${lookupFieldIndex}`
    );
    const mappingOptionsHtml = buildPublicMappingConfigOptionsHtml(mappingConfig);

    // 构建配置JSON对象
    const vlookupConfig = {
        lookup_key: parseOptionalInteger(lookupKey),
        lookup_field: parseOptionalInteger(lookupField),
        lookup_field_index: parseInt(lookupFieldIndex, 10),
        default: currentRule.default || '',
        remarks: remarks || ''
    };

    // 如果启用映射，添加映射配置到JSON
    if (withMapping) {
        vlookupConfig.use_mapping = useMapping;
        vlookupConfig.mapping_config = mappingConfig;
        vlookupConfig.fallback_to_raw_lookup = fallbackToRawLookup;
    }

    const moduleHtml = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            ${buildAdvancedStepListCard(
                '执行链路',
                [
                    {
                        label: '读取查找键',
                        text: `当前从${sourceDataSourceName}读取 ${lookupKeyLabel} 作为查找键`
                    },
                    withMapping
                        ? {
                            label: '公共配置映射',
                            text: `先调用公共配置 ${mappingConfig || 'business_system_name_mapping'} 转换查找键，再进入数据概览表联查`
                        }
                        : {
                            label: '直接联查',
                            text: '不经过公共配置映射，直接把查找键送入数据概览表匹配'
                        },
                    {
                        label: '匹配键列',
                        text: `在数据概览表使用 ${lookupFieldIndexLabel} 与查找键做匹配`
                    },
                    {
                        label: '返回字段',
                        text: `在数据概览表命中后返回 ${lookupFieldLabel}；未命中时返回默认值`
                    }
                ],
                '#005fe0',
                currentRule.fallback_to_raw_lookup
                    ? '当前规则启用了 fallback_to_raw_lookup：映射后的键未命中时，会再用原始值补查一次。'
                    : ''
            )}

            <!-- 查找键字段 -->
            <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #005fe0; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">查找键字段（从${sourceDataSourceName}）</div>
                <select id="vlookup_key_field" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="">-- 选择字段 --</option>
                    ${buildColumnOptionsHtml(sourceColumns, lookupKey)}
                </select>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">${getIndexHintText(sourceDataSource, currentMappingConfig)}</div>
            </div>

            <!-- 匹配键列 -->
            <div style="padding: 15px; background: #eef7ff; border-left: 4px solid #005fe0; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">匹配键列（数据概览）</div>
                <select id="vlookup_lookup_field_index" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="">-- 选择字段 --</option>
                    ${buildColumnOptionsHtml(assetsColumns, lookupFieldIndex)}
                </select>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">决定使用数据概览表哪一列与查找键做匹配。</div>
            </div>

            <!-- 返回字段 -->
            <div style="padding: 15px; background: #e8f4fd; border-left: 4px solid #005fe0; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">返回字段（从数据概览表）</div>
                <select id="vlookup_return_field" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="">-- 选择字段 --</option>
                    ${buildColumnOptionsHtml(assetsColumns, lookupField)}
                </select>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">命中后会从数据概览表返回该字段的值，当前字段：${lookupFieldLabel}</div>
            </div>

            <!-- 默认值 -->
            <div style="padding: 15px; background: #f0f0f0; border-left: 4px solid #6c757d; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">默认值（可选）</div>
                <input type="text" id="vlookup_default" value="${currentRule.default || ''}"
                       placeholder="未匹配到时返回的值"
                       style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">如果在数据概览表中未找到匹配项，返回此值</div>
            </div>

            ${withMapping ? `
            <!-- 映射配置 -->
            <div style="padding: 15px; background: #e8f4fd; border-left: 4px solid #005fe0; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">映射字典配置</div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                    <input type="checkbox" id="vlookup_use_mapping" ${useMapping ? 'checked' : ''}
                           style="width: 18px; height: 18px; cursor: pointer;">
                    <label for="vlookup_use_mapping" style="font-size: 13px; color: #333; cursor: pointer;">
                        启用映射字典（先转换查找键，再查询）
                    </label>
                </div>
                <select id="vlookup_mapping_config" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="">-- 选择映射配置 --</option>
                    ${mappingOptionsHtml}
                </select>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">
                    在查询数据概览表之前，先使用映射字典转换查找键的值
                </div>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 12px;">
                    <input type="checkbox" id="vlookup_fallback_to_raw_lookup" ${fallbackToRawLookup ? 'checked' : ''}
                           style="width: 18px; height: 18px; cursor: pointer;">
                    <label for="vlookup_fallback_to_raw_lookup" style="font-size: 13px; color: #333; cursor: pointer;">
                        映射未命中时，回退原始值再查一次
                    </label>
                </div>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">
                    适用于公共配置只覆盖部分系统名称的场景，避免因为映射未配置而直接丢失联查结果。
                </div>
            </div>
            ` : ''}

            <!-- 备注 -->
            <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #28a745; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">备注说明（自定义扩展）</div>
                <textarea id="vlookup_remarks" rows="4"
                          style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;"
                          placeholder="输入针对此列的详细说明、业务规则、维护记录等，例如：依据M列（业务系统名称）去数据概览表匹配，返回G列（所属系统类型）"
                          onchange="syncVlookupRemarksToJSON()">${remarks}</textarea>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">
                    可记录：业务规则、变更历史、维护说明、注意事项等，方便后期维护和交接
                </div>
            </div>
        </div>
    `;
    const jsonHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">VLOOKUP配置（JSON格式）</div>
                <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：${withMapping ?
                    '{"lookup_key":查找键索引,"lookup_field":返回字段索引,"lookup_field_index":匹配键列索引,"use_mapping":是否启用映射,"mapping_config":映射配置名称,"fallback_to_raw_lookup":映射未命中时是否回退原始值,"default":默认值,"remarks":备注}' :
                    '{"lookup_key":查找键索引,"lookup_field":返回字段索引,"lookup_field_index":匹配键列索引,"default":默认值,"remarks":备注}'
                }</div>
                <textarea id="vlookup_json_config" rows="16"
                          style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                          onchange="updateVlookupFromJSON()">${JSON.stringify(vlookupConfig, null, 2)}</textarea>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">
                    修改 JSON 会自动更新模块编辑里的字段选择、默认值、备注和映射开关。
                </div>
            </div>
        </div>
    `;

    openAdvancedConfigModal({
        title: withMapping ? '跨表查询+映射配置' : '跨表查询配置',
        subtitle: withMapping
            ? '先对查找键做名称映射，再到数据概览表中查询目标字段'
            : '根据查找键到数据概览表中查询目标字段',
        moduleHtml,
        jsonHtml,
        codePreviewBuilder: buildVlookupCodePreview,
        saveHandler: saveVlookupConfig,
        toneColor: '#005fe0',
        maxWidth: '960px',
        ruleIndex,
        sourceType: currentRule.source_type,
        summaryText: remarks || ThreeLayerArchitecture.generateRuleSummary(
            currentRule.source_type,
            currentRule,
            currentMappingConfig
        ) || '',
        dependencyText: withMapping
            ? `依赖${sourceDataSourceName}字段、公共配置 ${mappingConfig || 'business_system_name_mapping'} 和数据概览表联查`
            : `依赖${sourceDataSourceName}字段和数据概览表联查`
    });

    // 设置表单字段监听，实现与JSON的双向同步
    setTimeout(() => {
        watchVlookupFields();
    }, 100);
}

// 关闭VLOOKUP配置模态框
function closeVlookupModal() {
    const modal = document.getElementById('vlookupModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const advancedModal = document.getElementById('advancedConfigModal');
    if (advancedModal && advancedModal.style.display === 'flex' && currentAdvancedSaveHandler === saveVlookupConfig) {
        closeAdvancedConfigModal();
        return;
    }
    currentVlookupRuleIndex = -1;
    currentVlookupWithMapping = false;
}

// 从JSON更新表单字段
function updateVlookupFromJSON() {
    try {
        const jsonText = document.getElementById('vlookup_json_config').value;
        const config = JSON.parse(jsonText);

        // 更新表单字段
        if (config.lookup_key !== undefined && config.lookup_key !== null) {
            document.getElementById('vlookup_key_field').value = config.lookup_key;
        }
        if (config.lookup_field !== undefined && config.lookup_field !== null) {
            document.getElementById('vlookup_return_field').value = config.lookup_field;
        }
        if (config.lookup_field_index !== undefined && config.lookup_field_index !== null) {
            const lookupFieldIndexSelect = document.getElementById('vlookup_lookup_field_index');
            if (lookupFieldIndexSelect) {
                lookupFieldIndexSelect.value = normalizeLookupFieldIndex(config.lookup_field_index, '4');
            }
        }
        if (config.default !== undefined) {
            document.getElementById('vlookup_default').value = config.default;
        }
        if (config.remarks !== undefined) {
            document.getElementById('vlookup_remarks').value = config.remarks;
        }

        // 更新映射配置字段（如果存在）
        if (currentVlookupWithMapping) {
            if (config.use_mapping !== undefined) {
                const useMappingCheckbox = document.getElementById('vlookup_use_mapping');
                if (useMappingCheckbox) {
                    useMappingCheckbox.checked = config.use_mapping;
                }
            }
            if (config.mapping_config !== undefined) {
                const mappingConfigSelect = document.getElementById('vlookup_mapping_config');
                if (mappingConfigSelect) {
                    mappingConfigSelect.value = config.mapping_config;
                }
            }
            if (config.fallback_to_raw_lookup !== undefined) {
                const fallbackToRawLookupCheckbox = document.getElementById('vlookup_fallback_to_raw_lookup');
                if (fallbackToRawLookupCheckbox) {
                    fallbackToRawLookupCheckbox.checked = Boolean(config.fallback_to_raw_lookup);
                }
            }
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析JSON失败:', e);
        showToast('JSON格式错误：' + e.message, true);
    }
}

// 从表单字段同步备注到JSON
function syncVlookupRemarksToJSON() {
    try {
        const lookupKey = document.getElementById('vlookup_key_field').value;
        const lookupField = document.getElementById('vlookup_return_field').value;
        const lookupFieldIndexSelect = document.getElementById('vlookup_lookup_field_index');
        const lookupFieldIndex = lookupFieldIndexSelect ? (lookupFieldIndexSelect.value || '4') : '4';
        const defaultVal = document.getElementById('vlookup_default').value;
        const remarks = document.getElementById('vlookup_remarks').value;

        const config = {
            lookup_key: parseOptionalInteger(lookupKey),
            lookup_field: parseOptionalInteger(lookupField),
            lookup_field_index: parseInt(normalizeLookupFieldIndex(lookupFieldIndex, '4'), 10),
            default: defaultVal,
            remarks: remarks
        };

        // 如果启用映射，添加映射配置到JSON
        if (currentVlookupWithMapping) {
            const useMappingCheckbox = document.getElementById('vlookup_use_mapping');
            const mappingConfigSelect = document.getElementById('vlookup_mapping_config');
            const fallbackToRawLookupCheckbox = document.getElementById('vlookup_fallback_to_raw_lookup');
            if (useMappingCheckbox && mappingConfigSelect && fallbackToRawLookupCheckbox) {
                config.use_mapping = useMappingCheckbox.checked;
                config.mapping_config = mappingConfigSelect.value;
                config.fallback_to_raw_lookup = fallbackToRawLookupCheckbox.checked;
            }
        }

        document.getElementById('vlookup_json_config').value = JSON.stringify(config, null, 2);
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步到JSON失败:', e);
    }
}

// 监听表单字段变化，同步到JSON
function watchVlookupFields() {
    ['vlookup_key_field', 'vlookup_return_field', 'vlookup_lookup_field_index', 'vlookup_default', 'vlookup_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncVlookupRemarksToJSON);
            elem.addEventListener('input', syncVlookupRemarksToJSON);
        }
    });

    // 如果启用映射，监听映射字段变化
    if (currentVlookupWithMapping) {
        ['vlookup_use_mapping', 'vlookup_mapping_config', 'vlookup_fallback_to_raw_lookup'].forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('change', syncVlookupRemarksToJSON);
                elem.addEventListener('input', syncVlookupRemarksToJSON);
            }
        });
    }
}

// 保存VLOOKUP配置
function saveVlookupConfig() {
    if (currentVlookupRuleIndex === -1) return;

    try {
        const lookupKey = document.getElementById('vlookup_key_field').value;
        const lookupField = document.getElementById('vlookup_return_field').value;
        const lookupFieldIndexSelect = document.getElementById('vlookup_lookup_field_index');
        const lookupFieldIndex = lookupFieldIndexSelect ? (lookupFieldIndexSelect.value || '4') : '4';
        const defaultVal = document.getElementById('vlookup_default').value;
        const remarks = document.getElementById('vlookup_remarks').value;

        if (!lookupKey) {
            showToast('请选择查找键字段', true);
            return;
        }
        if (!lookupField) {
            showToast('请选择返回字段', true);
            return;
        }

        // 更新规则
        const rule = currentMappingConfig.mapping_rules[currentVlookupRuleIndex];
        rule.lookup_key = lookupKey;
        rule.lookup_field = lookupField;
        rule.lookup_field_index = normalizeLookupFieldIndex(lookupFieldIndex, '4');
        rule.default = defaultVal;
        rule.remarks = remarks;

        // 保存映射配置（如果启用）
        if (currentVlookupWithMapping) {
            const useMappingCheckbox = document.getElementById('vlookup_use_mapping');
            const mappingConfigSelect = document.getElementById('vlookup_mapping_config');
            const fallbackToRawLookupCheckbox = document.getElementById('vlookup_fallback_to_raw_lookup');
            if (useMappingCheckbox && mappingConfigSelect && fallbackToRawLookupCheckbox) {
                rule.use_mapping = useMappingCheckbox.checked;
                rule.mapping_config = mappingConfigSelect.value;
                rule.fallback_to_raw_lookup = fallbackToRawLookupCheckbox.checked;
            }
        }

        // 刷新配置显示
        renderMappingConfig();
        mappingTableDirty = true;
        showToast('VLOOKUP查询配置已保存');

        closeVlookupModal();
    } catch (e) {
        console.error('保存VLOOKUP配置失败:', e);
        showToast('保存失败：' + e.message, true);
    }
}

// ===== IP查询配置模态框 =====

let currentIpLookupRuleIndex = -1;
let currentAdvancedSaveHandler = null;
let currentAdvancedRuleIndex = -1;

function resolveEffectiveMappingDataSource(config) {
    const dataSource = normalizeMappingDataSource(config?.data_source) || 'merge_results';
    const dataSourceMode = normalizeMappingDataSource(config?.data_source_mode);
    const primaryDataSource = normalizeMappingDataSource(config?.primary_data_source);

    if ((dataSource === 'both' || dataSourceMode === 'both') &&
        (primaryDataSource === 'assets' || primaryDataSource === 'merge_results')) {
        return primaryDataSource;
    }

    if (dataSource === 'assets' || dataSource === 'merge_results') {
        return dataSource;
    }

    return 'merge_results';
}

async function ensureMappingColumnsLoaded(requiredSources) {
    if (!window.currentDataSourceColumns) {
        window.currentDataSourceColumns = {};
    }

    for (const dataSource of requiredSources) {
        if (!dataSource) continue;
        if (Array.isArray(window.currentDataSourceColumns[dataSource]) &&
            window.currentDataSourceColumns[dataSource].length > 0) {
            continue;
        }

        const response = await fetch(API_BASE + `/data-source-columns/${dataSource}`);
        const result = await response.json();
        if (!result.success || !Array.isArray(result.columns)) {
            throw new Error(result.error || `${dataSource} 列信息加载失败`);
        }

        window.currentDataSourceColumns[dataSource] = result.columns;
    }
}

async function openIpLookupModal(evt) {
    const clickedButton = evt && evt.target ? evt.target : null;
    if (!clickedButton) {
        showToast('未找到触发按钮', true);
        return;
    }
    const row = clickedButton.closest('tr[data-rule-index]');
    if (!row) {
        showToast('未找到配置行', true);
        return;
    }

    const ruleIndex = parseInt(row.dataset.ruleIndex);
    const currentRule = currentMappingConfig.mapping_rules[ruleIndex];
    if (!currentRule) {
        showToast('未找到IP查询配置', true);
        return;
    }

    currentIpLookupRuleIndex = ruleIndex;

    try {
        const sourceDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
        await ensureMappingColumnsLoaded([sourceDataSource, 'assets']);

        const sourceColumns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
        const assetsColumns = getIndexedDataSourceColumns('assets', currentMappingConfig);
        const sourceValue = currentRule.source_value || '';
        const remarks = currentRule.remarks || currentRule.description || '';
        const sourceDataSourceName = getMappingDataSourceDisplayName(sourceDataSource);

        let lookupField = currentRule.lookup_field || '';
        if (String(lookupField).match(/^\d+$/) && assetsColumns[parseInt(lookupField, 10)]) {
            const columnDef = assetsColumns[parseInt(lookupField, 10)];
            lookupField = columnDef.name || columnDef;
        }

        const ipLookupConfig = {
            source_value: sourceValue !== '' ? parseInt(sourceValue, 10) : null,
            lookup_field: lookupField || '',
            default: currentRule.default || '',
            remarks: remarks || ''
        };

        const moduleHtml = `
            <div style="display: flex; flex-direction: column; gap: 20px;">
                ${buildAdvancedStepListCard(
                    '执行链路',
                    [
                        {
                            label: '读取 IP',
                            text: `当前从${sourceDataSourceName}读取 ${getColumnDisplayNameFromValue(sourceColumns, sourceValue, '未选择IP字段')} 的值作为查询 IP`
                        },
                        {
                            label: '反查资产',
                            text: '系统会用该 IP 在数据概览表中查找匹配的资产行'
                        },
                        {
                            label: '返回字段',
                            text: `命中后返回 ${getColumnDisplayNameFromValue(assetsColumns, lookupField, '未选择返回字段')}，未命中时返回默认值`
                        }
                    ],
                    '#005fe0',
                    '这里的 lookup_field 取的是数据概览表字段名，保存后会直接影响当前列的反查结果。'
                )}

                <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #005fe0; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">IP字段（从${sourceDataSourceName}）</div>
                    <select id="ip_lookup_source_field" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">-- 选择IP字段 --</option>
                        ${buildColumnOptionsHtml(sourceColumns, sourceValue)}
                    </select>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">${getIndexHintText(sourceDataSource, currentMappingConfig)}</div>
                </div>

                <div style="padding: 15px; background: #e8f4fd; border-left: 4px solid #005fe0; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">返回字段（从数据概览表）</div>
                    <select id="ip_lookup_return_field" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">-- 选择返回字段 --</option>
                        ${assetsColumns.map((col) => {
                            const colName = col.name || col;
                            const selected = String(lookupField) === String(colName) ? 'selected' : '';
                            return `<option value="${colName}" ${selected}>${col.display_name || colName}</option>`;
                        }).join('')}
                    </select>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">匹配到资产后，返回此字段的值</div>
                </div>

                <div style="padding: 15px; background: #f0f0f0; border-left: 4px solid #6c757d; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">默认值（可选）</div>
                    <input type="text" id="ip_lookup_default" value="${currentRule.default || ''}"
                           placeholder="未匹配到IP时返回的值"
                           style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                </div>

                <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #28a745; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">备注说明</div>
                    <textarea id="ip_lookup_remarks" rows="4"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;"
                              placeholder="例如：用主机IP去数据概览表反查所属系统类型"
                              onchange="syncIpLookupToJSON()">${remarks}</textarea>
                </div>
            </div>
        `;
        const jsonHtml = `
            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">IP查询配置（JSON格式）</div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"source_value":IP字段索引,"lookup_field":"返回字段名","default":"默认值","remarks":"备注"}</div>
                    <textarea id="ip_lookup_json_config" rows="16"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                              onchange="updateIpLookupFromJSON()">${JSON.stringify(ipLookupConfig, null, 2)}</textarea>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">修改 JSON 会自动同步模块编辑里的字段、默认值和备注。</div>
                </div>
            </div>
        `;

        openAdvancedConfigModal({
            title: 'IP查询配置',
            subtitle: '根据当前行的 IP 地址到数据概览表中反查目标字段',
            moduleHtml,
            jsonHtml,
            codePreviewBuilder: buildIpLookupCodePreview,
            saveHandler: saveIpLookupConfig,
            toneColor: '#005fe0',
            maxWidth: '960px',
            ruleIndex,
            sourceType: currentRule.source_type,
            summaryText: remarks || ThreeLayerArchitecture.generateRuleSummary(
                currentRule.source_type,
                currentRule,
                currentMappingConfig
            ) || '',
            dependencyText: `依赖${sourceDataSourceName} IP 字段和数据概览表按 IP 反查`,
            effectText: '保存后会直接影响当前列使用哪个 IP 字段做反查，以及命中后返回哪一个数据概览表字段。'
        });

        setTimeout(() => {
            watchIpLookupFields();
        }, 100);
    } catch (e) {
        console.error('打开IP查询配置失败:', e);
        showToast('打开IP查询配置失败：' + e.message, true);
    }
}

function closeIpLookupModal() {
    const modal = document.getElementById('ipLookupModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const advancedModal = document.getElementById('advancedConfigModal');
    if (advancedModal && advancedModal.style.display === 'flex' && currentAdvancedSaveHandler === saveIpLookupConfig) {
        closeAdvancedConfigModal();
        return;
    }
    currentIpLookupRuleIndex = -1;
}

function updateIpLookupFromJSON() {
    try {
        const jsonText = document.getElementById('ip_lookup_json_config').value;
        const config = JSON.parse(jsonText);

        if (config.source_value !== undefined && config.source_value !== null) {
            document.getElementById('ip_lookup_source_field').value = config.source_value;
        }
        if (config.lookup_field !== undefined) {
            document.getElementById('ip_lookup_return_field').value = config.lookup_field;
        }
        if (config.default !== undefined) {
            document.getElementById('ip_lookup_default').value = config.default;
        }
        if (config.remarks !== undefined) {
            document.getElementById('ip_lookup_remarks').value = config.remarks;
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析IP查询JSON失败:', e);
        showToast('JSON格式错误：' + e.message, true);
    }
}

function syncIpLookupToJSON() {
    try {
        const sourceValue = document.getElementById('ip_lookup_source_field').value;
        const lookupField = document.getElementById('ip_lookup_return_field').value;
        const defaultVal = document.getElementById('ip_lookup_default').value;
        const remarks = document.getElementById('ip_lookup_remarks').value;

        const config = {
            source_value: sourceValue ? parseInt(sourceValue, 10) : null,
            lookup_field: lookupField,
            default: defaultVal,
            remarks: remarks
        };

        document.getElementById('ip_lookup_json_config').value = JSON.stringify(config, null, 2);
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步IP查询配置失败:', e);
    }
}

function watchIpLookupFields() {
    ['ip_lookup_source_field', 'ip_lookup_return_field', 'ip_lookup_default', 'ip_lookup_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncIpLookupToJSON);
            elem.addEventListener('input', syncIpLookupToJSON);
        }
    });
}

function saveIpLookupConfig() {
    if (currentIpLookupRuleIndex === -1) return;

    try {
        const sourceValue = document.getElementById('ip_lookup_source_field').value;
        const lookupField = document.getElementById('ip_lookup_return_field').value;
        const defaultVal = document.getElementById('ip_lookup_default').value;
        const remarks = document.getElementById('ip_lookup_remarks').value;

        if (!sourceValue) {
            showToast('请选择IP字段', true);
            return;
        }
        if (!lookupField) {
            showToast('请选择返回字段', true);
            return;
        }

        const rule = currentMappingConfig.mapping_rules[currentIpLookupRuleIndex];
        rule.source_value = sourceValue;
        rule.lookup_field = lookupField;
        rule.default = defaultVal;
        rule.remarks = remarks;

        renderMappingConfig();
        mappingTableDirty = true;
        showToast('IP查询配置已保存');
        closeIpLookupModal();
    } catch (e) {
        console.error('保存IP查询配置失败:', e);
        showToast('保存失败：' + e.message, true);
    }
}

function getCurrentMappingRuleFromEvent(errorLabel, evt) {
    const clickedButton = evt && evt.target ? evt.target : null;
    if (!clickedButton) {
        showToast(`未找到${errorLabel}触发按钮`, true);
        return null;
    }
    const row = clickedButton.closest('tr[data-rule-index]');
    if (!row) {
        showToast(`未找到${errorLabel}配置行`, true);
        return null;
    }

    const ruleIndex = parseInt(row.dataset.ruleIndex);
    const currentRule = currentMappingConfig.mapping_rules[ruleIndex];
    if (!currentRule) {
        showToast(`未找到${errorLabel}配置`, true);
        return null;
    }

    return { row, ruleIndex, currentRule };
}

function resolveRuleSourceDataSource(rule, config = currentMappingConfig) {
    const sourceType = String(rule?.source_type || '').trim();

    if (sourceType === 'field_assets_with_transform') {
        return 'assets';
    }
    if (sourceType === 'field_merge_with_transform') {
        return 'merge_results';
    }

    return resolveEffectiveMappingDataSource(config || {});
}

function getColumnDisplayNameFromValue(columns, value, emptyText = '未选择字段') {
    if (value === '' || value === null || value === undefined) {
        return emptyText;
    }

    const matchedColumn = (columns || []).find(col =>
        String(col.index) === String(value)
        || String(col.name || '') === String(value)
        || String(col.display_name || '') === String(value)
    );

    if (matchedColumn) {
        return formatColumnDisplayLabel(matchedColumn, value);
    }

    return /^-?\d+$/.test(String(value).trim())
        ? `索引${String(value).trim()}（字段名未加载）`
        : String(value);
}

function buildAdvancedStepListCard(title, steps = [], toneColor = '#005fe0', noteText = '') {
    const normalizedSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];

    return `
        <div style="padding: 16px 18px; background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%); border: 1px solid ${hexToRgba(toneColor, 0.16)}; border-radius: 14px;">
            <div style="font-size: 12px; font-weight: 700; color: ${toneColor}; letter-spacing: 0.04em;">${escapeHtml(title)}</div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
                ${normalizedSteps.map((step, index) => `
                    <div style="display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; align-items: flex-start;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: ${hexToRgba(toneColor, 0.14)}; color: ${toneColor}; font-size: 12px; font-weight: 700;">${index + 1}</div>
                        <div style="padding-top: 2px;">
                            ${step.label ? `<div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;">${escapeHtml(step.label)}</div>` : ''}
                            <div style="font-size: 13px; color: #475569; line-height: 1.8;">${escapeHtml(step.text || '')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${noteText ? `
                <div style="margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: ${hexToRgba(toneColor, 0.06)}; color: #475569; font-size: 12px; line-height: 1.8;">
                    ${escapeHtml(noteText)}
                </div>
            ` : ''}
        </div>
    `;
}

function hexToRgba(hex, alpha = 1) {
    const normalized = String(hex || '').replace('#', '').trim();
    if (!normalized || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return `rgba(79, 70, 229, ${alpha})`;
    }

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHexColor(hex, amount = 0.18) {
    const normalized = String(hex || '').replace('#', '').trim();
    if (!normalized || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return '#1d4ed8';
    }

    const clamp = value => Math.max(0, Math.min(255, value));
    const factor = 1 - amount;
    const r = clamp(Math.round(parseInt(normalized.slice(0, 2), 16) * factor));
    const g = clamp(Math.round(parseInt(normalized.slice(2, 4), 16) * factor));
    const b = clamp(Math.round(parseInt(normalized.slice(4, 6), 16) * factor));
    return `#${[r, g, b].map(item => item.toString(16).padStart(2, '0')).join('')}`;
}

function getSourceTypeDisplayName(sourceType) {
    const displayNames = {
        'conditional': '单字段条件',
        'conditional_groups': '条件组判断',
        'multi_conditional': '多字段条件',
        'lookup_ip': 'IP查询',
        'vlookup_assets': '跨表查询',
        'vlookup_assets_with_mapping': '跨表查询+映射',
        'data_sample_mapper': '样例映射',
        'column_value_count': '列值统计',
        'field_assets_dynamic': '动态生成',
        'multi_strategy_config': '多行展开',
        'strategy_content_mapping': '策略内容映射',
        'field_merge_with_transform': '字段+转换',
        'field_assets_with_transform': '字段+转换'
    };
    return displayNames[sourceType] || sourceType || '高级配置';
}

function getOperationTypeDisplayName(operationType) {
    const displayNames = {
        'read': '直接读取',
        'calculate': '条件计算',
        'lookup': '跨表查询',
        'expand': '多行展开'
    };
    return displayNames[operationType] || operationType || '未识别';
}

function getMappingDataSourceDisplayName(dataSource) {
    const normalized = normalizeMappingDataSource(dataSource);
    if (normalized === 'assets') return '数据概览表';
    if (normalized === 'merge_results') return '合并结果表';
    if (normalized === 'both') return '双数据源';
    return '合并结果表';
}

function getMappingDataSourceSummaryLabel(config = {}) {
    const dataSource = normalizeMappingDataSource(config?.data_source);
    const dataSourceMode = normalizeMappingDataSource(config?.data_source_mode);
    const primaryDataSource = normalizeMappingDataSource(config?.primary_data_source);

    if ((dataSource === 'both' || dataSourceMode === 'both') &&
        (primaryDataSource === 'assets' || primaryDataSource === 'merge_results')) {
        return `两者都（主：${getMappingDataSourceLabel(primaryDataSource)}）`;
    }

    return getMappingDataSourceLabel(dataSource || config?.data_source || 'merge_results');
}

function getAdvancedConfigDependencyText(sourceType, rule = {}) {
    switch (sourceType) {
        case 'vlookup_assets_with_mapping':
            return rule.mapping_config
                ? `依赖公共配置 ${rule.mapping_config}，并联动数据概览表查询`
                : '依赖公共配置映射和数据概览表查询';
        case 'vlookup_assets':
            return '依赖数据概览表查询结果';
        case 'data_sample_mapper':
            return '依赖“数据分级标准样例”按数据名称匹配，分级取自标准记录本身';
        case 'column_value_count':
            return '依赖当前导出数据集在筛选后的全量统计结果';
        case 'field_assets_dynamic':
            return '依赖数据概览表字段值和策略名称拼接规则';
        case 'multi_strategy_config':
        case 'strategy_content_mapping':
            return '依赖当前报表的 expansion_rules 配置';
        case 'field_assets_with_transform':
        case 'field_merge_with_transform':
            return '依赖当前列的源字段、条件规则和可选 transform';
        case 'conditional':
        case 'conditional_groups':
        case 'multi_conditional':
            return '依赖当前列内的条件判断规则';
        case 'lookup_ip':
            return '依赖 IP 字段和数据概览表反查';
        default:
            return '依赖当前映射配置';
    }
}

function getAdvancedConfigEffectText(sourceType) {
    switch (sourceType) {
        case 'data_sample_mapper':
            return '保存后会直接影响当前列取哪个“数据名称”去匹配样例标准，以及最终原样、脱敏或加密后的导出值。';
        case 'column_value_count':
            return '保存后会直接影响该统计列在导出文件中的计数结果，口径随整体筛选和当前导出数据集一起变化。';
        case 'vlookup_assets':
        case 'vlookup_assets_with_mapping':
            return '保存后会直接影响当前列的跨表查询结果和导出值。';
        case 'field_assets_dynamic':
            return '保存后会直接影响当前列动态生成的文本内容。';
        case 'multi_strategy_config':
        case 'strategy_content_mapping':
            return '保存后会直接影响该报表的多行展开结果和策略内容输出。';
        case 'lookup_ip':
            return '保存后会直接影响当前列按 IP 反查资产字段时的返回值。';
        case 'field_assets_with_transform':
        case 'field_merge_with_transform':
            return '保存后会直接影响当前列读取源字段后如何按条件转换输出。';
        default:
            return '保存后会直接影响当前报表这一列的导出逻辑。';
    }
}

function buildAdvancedConfigContext(options = {}) {
    const ruleIndex = Number.isInteger(options.ruleIndex) ? options.ruleIndex : -1;
    const rule = ruleIndex >= 0 && currentMappingConfig && Array.isArray(currentMappingConfig.mapping_rules)
        ? currentMappingConfig.mapping_rules[ruleIndex]
        : null;
    const sourceType = options.sourceType || (rule ? rule.source_type : '');
    const operationType = sourceType ? inferOperationFromSourceType(sourceType) : '';
    const reportName = currentMappingConfig?.name || currentMappingReportCode || '未选择报表';
    const reportCode = currentMappingReportCode || '未选择';
    const targetColumn = options.targetColumn || (rule ? rule.target_column : '报表级');
    const targetName = options.targetName || (rule ? rule.target_name : '当前报表级配置');
    const summaryText = options.summaryText
        || (rule ? (rule.remarks || ThreeLayerArchitecture.generateRuleSummary(sourceType, rule, currentMappingConfig) || '') : '');

    return {
        categoryName: getCategoryDisplayName(currentMappingCategory),
        reportName,
        reportCode,
        targetColumn,
        targetName,
        sourceType,
        sourceTypeName: getSourceTypeDisplayName(sourceType),
        operationTypeName: getOperationTypeDisplayName(operationType),
        dataSourceName: getMappingDataSourceDisplayName(
            resolveEffectiveMappingDataSource(currentMappingConfig || {})
        ),
        dependencyText: options.dependencyText || getAdvancedConfigDependencyText(sourceType, rule || {}),
        effectText: options.effectText || getAdvancedConfigEffectText(sourceType),
        summaryText,
        scopeText: rule ? '列级生效' : '报表级生效'
    };
}

function buildAdvancedConfigShell(options = {}) {
    const toneColor = options.toneColor || '#005fe0';
    const context = buildAdvancedConfigContext(options);
    const subtitle = options.subtitle || getSourceTypeDescription(context.sourceType) || '';
    const moduleHtml = options.moduleHtml || options.bodyHtml || '';
    const jsonHtml = options.jsonHtml || '';
    const hasPreview = Boolean(options.codePreviewBuilder || options.codeHtml);
    const compactMode = options.compactMode === true;
    const tabs = [];

    if (moduleHtml) {
        tabs.push({ id: 'module', label: '模块编辑' });
    }
    if (jsonHtml) {
        tabs.push({ id: 'json', label: 'JSON编辑' });
    }
    if (hasPreview) {
        tabs.push({ id: 'preview', label: '执行逻辑预览' });
    }

    return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${compactMode ? '' : `
            <div style="padding: 18px 20px; background: linear-gradient(135deg, ${hexToRgba(toneColor, 0.12)} 0%, rgba(255,255,255,0.98) 100%); border: 1px solid ${hexToRgba(toneColor, 0.18)}; border-radius: 16px;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
                    <div style="min-width: 0;">
                        <div style="font-size: 12px; font-weight: 700; color: ${toneColor}; letter-spacing: 0.04em;">当前配置项</div>
                        <div style="margin-top: 6px; font-size: 18px; font-weight: 700; color: #1e293b; line-height: 1.5;">${escapeHtml(context.targetColumn)} 列 / ${escapeHtml(context.targetName)}</div>
                        <div style="margin-top: 8px; font-size: 13px; color: #475569; line-height: 1.8;">${escapeHtml(subtitle)}</div>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px;">
                        <span style="padding: 4px 10px; border-radius: 999px; background: ${hexToRgba(toneColor, 0.12)}; color: ${toneColor}; font-size: 12px; font-weight: 700; white-space: nowrap;">${escapeHtml(context.sourceTypeName)}</span>
                        <span style="padding: 4px 10px; border-radius: 999px; background: #eef4ff; color: #1d4ed8; font-size: 12px; font-weight: 700; white-space: nowrap;">${escapeHtml(context.scopeText)}</span>
                    </div>
                </div>
            </div>
            `}

            ${tabs.length > 1 ? `
                <div style="display: flex; flex-direction: column; gap: 14px;">
                    <div id="advancedConfigTabBar" style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${tabs.map(tab => `
                            <button type="button"
                                data-advanced-tab="${tab.id}"
                                onclick="switchAdvancedConfigTab('${tab.id}')"
                                style="padding: 8px 14px; border-radius: 999px; border: 1px solid ${hexToRgba(toneColor, 0.18)}; background: rgba(255,255,255,0.92); color: #475569; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                                ${escapeHtml(tab.label)}
                            </button>
                        `).join('')}
                    </div>

                    ${moduleHtml ? `
                        <div data-advanced-panel="module" style="display: none;">
                            ${moduleHtml}
                        </div>
                    ` : ''}

                    ${jsonHtml ? `
                        <div data-advanced-panel="json" style="display: none;">
                            ${jsonHtml}
                        </div>
                    ` : ''}

                    ${hasPreview ? `
                        <div data-advanced-panel="preview" style="display: none;">
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                ${compactMode ? '' : `
                                <div style="padding: 14px 16px; background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(255,255,255,0.98) 100%); border: 1px solid ${hexToRgba(toneColor, 0.16)}; border-radius: 14px;">
                                    <div style="font-size: 12px; font-weight: 700; color: ${toneColor}; margin-bottom: 6px;">执行逻辑预览</div>
                                    <div style="font-size: 12px; color: #64748b; line-height: 1.8;">这里显示当前配置对应的执行伪代码。该区域只读，用于帮助理解真实导出链路；真正生效的是模块编辑和 JSON 配置。</div>
                                </div>
                                `}
                                <div style="padding: 14px; border-radius: 14px; background: #0f172a; border: 1px solid rgba(15, 23, 42, 0.12); overflow: auto;">
                                    <pre id="advancedConfigCodePreview" style="margin: 0; color: #e2e8f0; font-size: 12px; line-height: 1.7; font-family: Consolas, 'Courier New', monospace; white-space: pre-wrap;">${escapeHtml(options.codeHtml || '切换到此标签后将生成执行逻辑预览')}</pre>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : moduleHtml}
        </div>
    `;
}

let currentAdvancedCodePreviewBuilder = null;
let currentAdvancedInitialTab = 'module';

function switchAdvancedConfigTab(tabId) {
    const modalBody = document.getElementById('advancedConfigModalBody');
    if (!modalBody) return;

    const buttons = modalBody.querySelectorAll('[data-advanced-tab]');
    const panels = modalBody.querySelectorAll('[data-advanced-panel]');
    const toneColor = document.getElementById('advancedConfigModal')?.dataset?.toneColor || '#005fe0';

    buttons.forEach(button => {
        const active = button.getAttribute('data-advanced-tab') === tabId;
        button.style.background = active ? hexToRgba(toneColor, 0.12) : 'rgba(255,255,255,0.92)';
        button.style.color = active ? toneColor : '#475569';
        button.style.borderColor = active ? hexToRgba(toneColor, 0.32) : hexToRgba(toneColor, 0.18);
        button.style.boxShadow = active ? `0 8px 18px ${hexToRgba(toneColor, 0.12)}` : 'none';
    });

    panels.forEach(panel => {
        panel.style.display = panel.getAttribute('data-advanced-panel') === tabId ? 'block' : 'none';
    });

    if (tabId === 'preview') {
        refreshAdvancedCodePreview();
    }
}

function refreshAdvancedCodePreview() {
    const previewEl = document.getElementById('advancedConfigCodePreview');
    if (!previewEl) return;

    try {
        let content = '';
        if (typeof currentAdvancedCodePreviewBuilder === 'function') {
            content = currentAdvancedCodePreviewBuilder() || '';
        } else {
            content = previewEl.textContent || '';
        }
        previewEl.textContent = content || '当前逻辑暂未生成执行预览';
    } catch (e) {
        console.error('生成执行逻辑预览失败:', e);
        previewEl.textContent = `生成执行逻辑预览失败: ${e.message}`;
    }
}

function refreshAdvancedCodePreviewIfVisible() {
    const previewPanel = document.querySelector('#advancedConfigModalBody [data-advanced-panel="preview"]');
    if (previewPanel && previewPanel.style.display !== 'none') {
        refreshAdvancedCodePreview();
    }
}

function parseJsonWithFallback(text, fallbackValue) {
    try {
        return JSON.parse(text || '');
    } catch (e) {
        return fallbackValue;
    }
}

function buildPreviewFieldRef(dataSource, columns, indexOrName, fallbackLabel = '未选择字段') {
    const label = getColumnDisplayNameFromValue(columns, indexOrName, fallbackLabel);
    if (indexOrName === '' || indexOrName === null || indexOrName === undefined) {
        return fallbackLabel;
    }
    return `${dataSource}[${indexOrName}]  // ${label}`;
}

function buildConditionExpressionPreview(condition, dataSource, columns) {
    const fieldRef = buildPreviewFieldRef(dataSource, columns, condition.field_index, '未选择字段');
    const matchText = JSON.stringify(condition.match || '');
    if (condition.regex) {
        return `regex(${matchText}, ${fieldRef})`;
    }
    if (condition.operator === 'startswith') {
        return `${fieldRef}.startsWith(${matchText})`;
    }
    return `${matchText} in ${fieldRef}`;
}

function buildSingleConditionalCodePreview() {
    const rule = currentSingleCondRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentSingleCondRuleIndex] : {};
    const sourceDataSource = resolveRuleSourceDataSource(rule, currentMappingConfig);
    const columns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('single_cond_json_config')?.value, {
        source_value: rule.source_value || null,
        conditions: rule.conditions || [],
        default: rule.default || '',
        remarks: rule.remarks || ''
    });
    const fieldRef = buildPreviewFieldRef(sourceDataSource, columns, config.source_value, '未选择判断字段');
    const lines = [
        `// 单字段条件：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `source_value = ${fieldRef}`,
        `default_value = ${JSON.stringify(config.default || '')}`,
        '',
        'for condition in conditions:',
        '    if condition.regex:',
        '        matched = regex(condition.match, source_value)',
        '    else:',
        '        matched = condition.match in source_value',
        '    if matched:',
        '        return condition.result',
        '',
        'return default_value'
    ];

    if (Array.isArray(config.conditions) && config.conditions.length > 0) {
        lines.push('', '// 当前 conditions');
        config.conditions.forEach((condition, index) => {
            lines.push(`// ${index + 1}. if ${condition.regex ? 'regex' : 'contains'} ${JSON.stringify(condition.match || '')} -> ${JSON.stringify(condition.result || '')}`);
        });
    }

    if (rule.transform) {
        lines.push('', `// 命中结果输出后仍会继续执行 transform=${rule.transform}`);
    }

    return lines.join('\n');
}

function buildVlookupCodePreview() {
    const rule = currentVlookupRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentVlookupRuleIndex] : {};
    const sourceDataSource = resolveRuleSourceDataSource(rule, currentMappingConfig);
    const sourceColumns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
    const assetsColumns = getIndexedDataSourceColumns('assets', currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('vlookup_json_config')?.value, {
        lookup_key: rule.lookup_key || null,
        lookup_field: rule.lookup_field || null,
        lookup_field_index: parseOptionalInteger(rule.lookup_field_index) ?? 4,
        default: rule.default || '',
        remarks: rule.remarks || '',
        use_mapping: Boolean(rule.use_mapping),
        mapping_config: rule.mapping_config || '',
        fallback_to_raw_lookup: Boolean(rule.fallback_to_raw_lookup)
    });
    const lookupFieldIndex = normalizeLookupFieldIndex(config.lookup_field_index, '4');
    const lookupFieldIndexLabel = getColumnDisplayNameFromValue(
        assetsColumns,
        lookupFieldIndex,
        `索引${lookupFieldIndex}`
    );
    const lookupFieldRef = buildPreviewFieldRef('assets', assetsColumns, config.lookup_field, '未选择返回字段');

    const lines = [
        `// 跨表查询：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `lookup_key = ${buildPreviewFieldRef(sourceDataSource, sourceColumns, config.lookup_key, '未选择查找键字段')}`,
        `lookup_field_index = ${JSON.stringify(lookupFieldIndex)}  // ${lookupFieldIndexLabel}`
    ];

    if (currentVlookupWithMapping || config.use_mapping) {
        lines.push(`mapped_key = public_config.${config.mapping_config || 'business_system_name_mapping'}.get(lookup_key, lookup_key)`);
        if (config.fallback_to_raw_lookup) {
            lines.push(`result = assets.lookup(key=mapped_key, lookup_field_index=${JSON.stringify(lookupFieldIndex)}, return_field=${lookupFieldRef})`);
            lines.push('if result is empty:');
            lines.push(`    result = assets.lookup(key=lookup_key, lookup_field_index=${JSON.stringify(lookupFieldIndex)}, return_field=${lookupFieldRef})`);
        } else {
            lines.push(`result = assets.lookup(key=mapped_key, lookup_field_index=${JSON.stringify(lookupFieldIndex)}, return_field=${lookupFieldRef})`);
        }
    } else {
        lines.push(`result = assets.lookup(key=lookup_key, lookup_field_index=${JSON.stringify(lookupFieldIndex)}, return_field=${lookupFieldRef})`);
    }

    lines.push(`return result or ${JSON.stringify(config.default || '')}`);
    return lines.join('\n');
}

function buildIpLookupCodePreview() {
    const rule = currentIpLookupRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentIpLookupRuleIndex] : {};
    const sourceDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
    const sourceColumns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
    const assetsColumns = getIndexedDataSourceColumns('assets', currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('ip_lookup_json_config')?.value, {
        source_value: rule.source_value || null,
        lookup_field: rule.lookup_field || '',
        default: rule.default || '',
        remarks: rule.remarks || ''
    });

    return [
        `// IP查询：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `ip_value = ${buildPreviewFieldRef(sourceDataSource, sourceColumns, config.source_value, '未选择IP字段')}`,
        'assets_row = assets.lookup_row_by_ip(ip_value)',
        `result = assets_row[${JSON.stringify(config.lookup_field || '')}]  // ${getColumnDisplayNameFromValue(assetsColumns, config.lookup_field, '未选择返回字段')}`,
        `return result or ${JSON.stringify(config.default || '')}`
    ].join('\n');
}

function buildDynamicGenerationCodePreview() {
    const rule = currentAdvancedRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentAdvancedRuleIndex] : {};
    const assetsColumns = getIndexedDataSourceColumns('assets', currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('dynamic_generation_json_config')?.value, {
        source_value: rule.source_value || null,
        reference_column: rule.reference_column || 'D',
        remarks: rule.remarks || ''
    });

    return [
        `// 动态生成：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `source_value = ${buildPreviewFieldRef('assets', assetsColumns, config.source_value, '未选择源字段')}`,
        `reference_column = ${JSON.stringify(config.reference_column || 'D')}`,
        'strategy_type = current_expansion_strategy',
        'business_system = current_context.business_system',
        'result = `${business_system}_${strategy_type}策略`',
        'return result'
    ].join('\n');
}

function buildDataSampleMapperCodePreview() {
    const rule = currentAdvancedRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentAdvancedRuleIndex] : {};
    const sourceDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
    const columns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('data_sample_mapper_json_config')?.value, {
        name_column_index: rule.name_column_index || null,
        remarks: rule.remarks || ''
    });

    return [
        `// 样例映射：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `data_name = ${buildPreviewFieldRef(sourceDataSource, columns, config.name_column_index, '未选择数据名称字段')}`,
        'standard = data_sample_standards.get(data_name)',
        'if standard is empty:',
        '    return ""',
        'sample = random_choice(standard.samples)',
        'level = standard.level',
        'if level <= 2: return sample',
        'if level == 3: return mask(sample)',
        'if level >= 4: return encrypt(sample)'
    ].join('\n');
}

function buildColumnValueCountCodePreview() {
    const rule = currentAdvancedRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentAdvancedRuleIndex] : {};
    const sourceDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
    const columns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('column_value_count_json_config')?.value, {
        source_value: rule.source_value || null,
        remarks: rule.remarks || ''
    });

    return [
        `// 列值统计：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `count_key = ${buildPreviewFieldRef(sourceDataSource, columns, config.source_value, '未选择统计字段')}`,
        'value_counts = count_all_rows_in_current_export_dataset(by=count_key_column)',
        'if count_key is empty:',
        '    return "0"',
        'return String(value_counts.get(count_key, 0))'
    ].join('\n');
}

function buildExpansionRulesCodePreview() {
    const expansionRules = parseJsonWithFallback(document.getElementById('expansion_rules_json')?.value, currentMappingConfig.expansion_rules || {});
    const keys = Object.keys(expansionRules || {});
    const lines = [
        '// 报表级共享 expansion_rules',
        'for strategy_type, rule in expansion_rules.items():',
        '    emit_row(strategy_type = strategy_type, strategy_label = rule.g_column)',
        '',
        '// strategy_content_mapping',
        'content = expansion_rules[current_strategy_type].h_column',
        'return content'
    ];

    if (keys.length > 0) {
        lines.push('', '// 当前策略类型');
        keys.forEach((key, index) => {
            const rule = expansionRules[key] || {};
            lines.push(`// ${index + 1}. ${key} -> g_column=${JSON.stringify(rule.g_column || '')}, h_column=${JSON.stringify(rule.h_column || '')}`);
        });
    }

    return lines.join('\n');
}

function buildMultiConditionalCodePreview() {
    const rule = currentMultiCondRuleIndex >= 0 ? currentMappingConfig.mapping_rules[currentMultiCondRuleIndex] : {};
    const dataSource = resolveEffectiveMappingDataSource(currentMappingConfig || {});
    const columns = getIndexedDataSourceColumns(dataSource, currentMappingConfig);
    const config = parseJsonWithFallback(document.getElementById('multi_cond_json_config')?.value, {});

    if (currentMultiCondMode === 'groups') {
        const groups = Array.isArray(config.groups) ? config.groups : [];
        const lines = [
            `// 条件组判断：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
            `group_logic = ${JSON.stringify(config.group_logic || 'OR')}`,
            `default_value = ${JSON.stringify(config.default || '')}`,
            '',
            'for group in groups:',
            '    group_met = all(condition_met for condition in group.conditions)',
            '    if group_met:',
            '        result = group.result',
            '        if group_logic == "OR":',
            '            return result',
            '    elif group_logic == "AND":',
            '        return default_value',
            '',
            'return result or default_value'
        ];
        if (groups.length > 0) {
            lines.push('', '// 当前 groups');
            groups.forEach((group, index) => {
                const groupExpr = (group.conditions || []).map(condition => buildConditionExpressionPreview(condition, dataSource, columns)).join(' AND ');
                lines.push(`// ${index + 1}. (${groupExpr || '无条件'}) -> ${JSON.stringify(group.result || '')}`);
            });
        }
        return lines.join('\n');
    }

    const conditions = Array.isArray(config.conditions) ? config.conditions : [];
    const logic = config.logic || 'AND';
    const lines = [
        `// 多字段条件：${rule.target_column || ''}列 ${rule.target_name || ''}`.trim(),
        `logic = ${JSON.stringify(logic)}`,
        `result_value = ${JSON.stringify(config.result || '')}`,
        `default_value = ${JSON.stringify(config.default || '')}`,
        ''
    ];

    conditions.forEach((condition, index) => {
        lines.push(`condition_${index + 1} = ${buildConditionExpressionPreview(condition, dataSource, columns)}`);
    });
    lines.push('');
    lines.push(logic === 'AND'
        ? 'if all([condition_1, condition_2, ...]):'
        : 'if any([condition_1, condition_2, ...]):');
    lines.push('    return result_value');
    lines.push('return default_value');

    return lines.join('\n');
}

function openAdvancedConfigModal(titleOrOptions, subtitle, bodyHtml, saveHandler) {
    const options = (titleOrOptions && typeof titleOrOptions === 'object' && !Array.isArray(titleOrOptions))
        ? titleOrOptions
        : {
            title: titleOrOptions,
            subtitle,
            bodyHtml,
            saveHandler
        };
    const modal = document.getElementById('advancedConfigModal');
    const dialog = modal.querySelector('.modal-content');
    const header = modal.querySelector('.modal-header');
    const footer = modal.querySelector('.modal-footer');
    const saveButton = footer ? footer.querySelector('.btn-primary') : null;
    const toneColor = options.toneColor || '#005fe0';
    const toneDark = darkenHexColor(toneColor, 0.18);

    document.getElementById('advancedConfigModalTitle').textContent = options.title || '高级配置';
    document.getElementById('advancedConfigModalSubtitle').textContent = options.subtitle || '';
    document.getElementById('advancedConfigModalBody').innerHTML = buildAdvancedConfigShell(options);
    modal.dataset.toneColor = toneColor;

    if (dialog) {
        dialog.style.maxWidth = options.maxWidth || '920px';
    }
    if (header) {
        header.style.background = `linear-gradient(135deg, ${toneColor} 0%, ${toneDark} 100%)`;
    }
    if (saveButton) {
        saveButton.style.background = toneColor;
    }

    currentAdvancedSaveHandler = options.saveHandler;
    currentAdvancedCodePreviewBuilder = typeof options.codePreviewBuilder === 'function'
        ? options.codePreviewBuilder
        : null;
    currentAdvancedInitialTab = options.initialTab || 'module';
    modal.style.display = 'flex';

    setTimeout(() => {
        switchAdvancedConfigTab(currentAdvancedInitialTab);
    }, 0);
}

function closeAdvancedConfigModal() {
    const modal = document.getElementById('advancedConfigModal');
    const previousSaveHandler = currentAdvancedSaveHandler;
    modal.style.display = 'none';
    currentAdvancedSaveHandler = null;
    currentAdvancedCodePreviewBuilder = null;
    currentAdvancedInitialTab = 'module';
    currentAdvancedRuleIndex = -1;
    if (previousSaveHandler === saveVlookupConfig) {
        currentVlookupRuleIndex = -1;
        currentVlookupWithMapping = false;
    } else if (previousSaveHandler === saveSingleConditionalConfig) {
        currentSingleCondRuleIndex = -1;
    } else if (previousSaveHandler === saveIpLookupConfig) {
        currentIpLookupRuleIndex = -1;
    } else if (previousSaveHandler === saveMultiConditionalConfig) {
        currentMultiCondRuleIndex = -1;
        currentMultiCondMode = 'simple';
    }
}

function saveAdvancedConfigModal() {
    if (typeof currentAdvancedSaveHandler === 'function') {
        currentAdvancedSaveHandler();
    }
}

async function openDynamicGenerationModal(evt) {
    const context = getCurrentMappingRuleFromEvent('动态生成', evt);
    if (!context) return;

    currentAdvancedRuleIndex = context.ruleIndex;

    try {
        await ensureMappingColumnsLoaded(['assets']);
        const assetsColumns = Array.isArray((window.currentDataSourceColumns || {}).assets)
            ? window.currentDataSourceColumns.assets
            : [];
        const sourceValue = context.currentRule.source_value || '';
        const referenceColumn = context.currentRule.reference_column || 'D';
        const remarks = context.currentRule.remarks || context.currentRule.description || '';
        const jsonConfig = {
            source_value: sourceValue !== '' ? parseInt(sourceValue, 10) : null,
            reference_column: referenceColumn,
            remarks: remarks || ''
        };

        const moduleHtml = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${buildAdvancedStepListCard(
                    '执行链路',
                    [
                        {
                            label: '读取配置参数',
                            text: `当前配置会保存资产字段 ${getColumnDisplayNameFromValue(assetsColumns, sourceValue, '未选择源字段')} 和参考列 ${referenceColumn || 'D'}`
                        },
                        {
                            label: '组合上下文',
                            text: '导出时系统会结合当前业务系统上下文和展开出的策略类型生成动态文本'
                        },
                        {
                            label: '写入当前列',
                            text: '生成后的文本会直接写入当前列，影响当前报表的导出内容'
                        }
                    ],
                    '#005fe0',
                    '该类型常用于策略名称、策略标题等需要按业务系统和策略类型动态拼接的场景。'
                )}

                <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #005fe0; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">源字段（assets）</div>
                    <select id="dynamic_generation_source_value" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">-- 选择字段 --</option>
                        ${assetsColumns.map((col, idx) => {
                            const colLabel = String.fromCharCode(65 + idx);
                            const displayText = `${idx + 1}列(${colLabel}列)：${col.name || col}`;
                            const selected = String(sourceValue) === String(idx) ? 'selected' : '';
                            return `<option value="${idx}" ${selected}>${displayText}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div style="padding: 15px; background: #e8f4fd; border-left: 4px solid #005fe0; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">参考列</div>
                    <input type="text" id="dynamic_generation_reference_column" value="${referenceColumn}"
                           placeholder="如：D"
                           style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">用于拼接或生成动态内容时的参考列标识</div>
                </div>
                <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #28a745; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">备注说明</div>
                    <textarea id="dynamic_generation_remarks" rows="4"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;"
                              placeholder="例如：取业务系统字段并按 D 列规则动态生成策略名称">${remarks}</textarea>
                </div>
            </div>
        `;
        const jsonHtml = `
            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">完整配置（JSON格式）</div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"source_value":字段索引,"reference_column":"参考列","remarks":"备注"}</div>
                    <textarea id="dynamic_generation_json_config" rows="16"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                              onchange="updateDynamicGenerationFromJSON()">${JSON.stringify(jsonConfig, null, 2)}</textarea>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">修改 JSON 会自动更新模块编辑里的源字段、参考列和备注。</div>
                </div>
            </div>
        `;

        openAdvancedConfigModal({
            title: '动态生成配置',
            subtitle: '根据资产字段和参考列生成动态内容',
            moduleHtml,
            jsonHtml,
            codePreviewBuilder: buildDynamicGenerationCodePreview,
            saveHandler: saveDynamicGenerationConfig,
            toneColor: '#005fe0',
            ruleIndex: context.ruleIndex,
            sourceType: context.currentRule.source_type,
            summaryText: remarks || ThreeLayerArchitecture.generateRuleSummary(
                context.currentRule.source_type,
                context.currentRule,
                currentMappingConfig
            ) || ''
        });

        setTimeout(() => {
            watchDynamicGenerationFields();
        }, 100);
    } catch (e) {
        console.error('打开动态生成配置失败:', e);
        showToast('打开动态生成配置失败：' + e.message, true);
    }
}

function saveDynamicGenerationConfig() {
    if (currentAdvancedRuleIndex === -1) return;

    const sourceValue = document.getElementById('dynamic_generation_source_value').value;
    const referenceColumn = document.getElementById('dynamic_generation_reference_column').value.trim();
    const remarks = document.getElementById('dynamic_generation_remarks').value;

    if (!sourceValue) {
        showToast('请选择源字段', true);
        return;
    }

    const rule = currentMappingConfig.mapping_rules[currentAdvancedRuleIndex];
    rule.source_value = sourceValue;
    rule.reference_column = referenceColumn || 'D';
    rule.remarks = remarks;

    renderMappingConfig();
    mappingTableDirty = true;
    showToast('动态生成配置已保存');
    closeAdvancedConfigModal();
}

function updateDynamicGenerationFromJSON() {
    try {
        const config = JSON.parse(document.getElementById('dynamic_generation_json_config').value || '{}');
        if (config.source_value !== undefined && config.source_value !== null) {
            document.getElementById('dynamic_generation_source_value').value = String(config.source_value);
        }
        if (config.reference_column !== undefined) {
            document.getElementById('dynamic_generation_reference_column').value = config.reference_column;
        }
        if (config.remarks !== undefined) {
            document.getElementById('dynamic_generation_remarks').value = config.remarks;
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析动态生成JSON失败:', e);
        showToast('动态生成JSON格式错误：' + e.message, true);
    }
}

function syncDynamicGenerationToJSON() {
    try {
        const config = {
            source_value: document.getElementById('dynamic_generation_source_value').value
                ? parseInt(document.getElementById('dynamic_generation_source_value').value, 10)
                : null,
            reference_column: document.getElementById('dynamic_generation_reference_column').value.trim() || 'D',
            remarks: document.getElementById('dynamic_generation_remarks').value || ''
        };
        document.getElementById('dynamic_generation_json_config').value = JSON.stringify(config, null, 2);
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步动态生成到JSON失败:', e);
    }
}

function watchDynamicGenerationFields() {
    ['dynamic_generation_source_value', 'dynamic_generation_reference_column', 'dynamic_generation_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncDynamicGenerationToJSON);
            elem.addEventListener('input', syncDynamicGenerationToJSON);
        }
    });
}

async function openDataSampleMapperModal(evt) {
    const context = getCurrentMappingRuleFromEvent('样例映射', evt);
    if (!context) return;

    currentAdvancedRuleIndex = context.ruleIndex;

    try {
        const sourceDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
        await ensureMappingColumnsLoaded([sourceDataSource]);
        const columns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
        const nameColumnIndex = context.currentRule.name_column_index || '';
        const remarks = context.currentRule.remarks || context.currentRule.description || '';
        const sourceDataSourceName = getMappingDataSourceDisplayName(sourceDataSource);
        const jsonConfig = {
            name_column_index: nameColumnIndex ? parseInt(nameColumnIndex, 10) : null,
            remarks: remarks || ''
        };

        const moduleHtml = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${buildAdvancedStepListCard(
                    '执行链路',
                    [
                        {
                            label: '读取数据名称',
                            text: `当前从${sourceDataSourceName}读取 ${getColumnDisplayNameFromValue(columns, nameColumnIndex, '未选择数据名称字段')} 作为匹配键`
                        },
                        {
                            label: '匹配样例标准',
                            text: '系统会用该数据名称去“数据分级标准样例”中查找标准记录，同时读取该标准记录自己的 level'
                        },
                        {
                            label: '按分级处理样例',
                            text: 'level 1-2 原样返回，level 3 做脱敏，level 4 及以上按加密口径处理后再写入当前列'
                        }
                    ],
                    '#005fe0',
                    '这里的分级来源不是当前报表其他列，而是“数据分级标准样例”匹配到的标准记录。'
                )}

                <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #005fe0; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">数据名称字段（${sourceDataSourceName}）</div>
                    <select id="data_sample_mapper_name_column" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">-- 选择字段 --</option>
                        ${buildColumnOptionsHtml(columns, nameColumnIndex)}
                    </select>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">选择该列后，系统会按数据名称去“数据分级标准样例”中取样例，并根据标准记录中的 level 做原样、脱敏或加密处理。</div>
                </div>
                <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #28a745; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">备注说明</div>
                    <textarea id="data_sample_mapper_remarks" rows="4"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;"
                              placeholder="例如：取数据名称列，从数据分级标准样例中自动获取样例">${remarks}</textarea>
                </div>
            </div>
        `;
        const jsonHtml = `
            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">样例映射配置（JSON格式）</div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"name_column_index": 数据名称字段索引, "remarks": "备注"}</div>
                    <textarea id="data_sample_mapper_json_config" rows="16"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                              onchange="updateDataSampleMapperFromJSON()">${JSON.stringify(jsonConfig, null, 2)}</textarea>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">修改 JSON 会自动更新模块编辑里的字段选择和备注。</div>
                </div>
            </div>
        `;

        openAdvancedConfigModal({
            title: '样例映射配置',
            subtitle: '选择用于匹配数据样例标准的数据名称字段',
            moduleHtml,
            jsonHtml,
            codePreviewBuilder: buildDataSampleMapperCodePreview,
            saveHandler: saveDataSampleMapperConfig,
            toneColor: '#005fe0',
            ruleIndex: context.ruleIndex,
            sourceType: context.currentRule.source_type,
            dependencyText: '依赖“数据分级标准样例”按数据名称匹配，level 来源于标准记录本身',
            effectText: '保存后会直接影响当前列读取哪一个“数据名称”字段去匹配样例标准，以及最终原样、脱敏或加密后的导出值。',
            summaryText: remarks || ThreeLayerArchitecture.generateRuleSummary(
                context.currentRule.source_type,
                context.currentRule,
                currentMappingConfig
            ) || ''
        });

        setTimeout(() => {
            watchDataSampleMapperFields();
        }, 100);
    } catch (e) {
        console.error('打开样例映射配置失败:', e);
        showToast('打开样例映射配置失败：' + e.message, true);
    }
}

function updateDataSampleMapperFromJSON() {
    try {
        const jsonText = document.getElementById('data_sample_mapper_json_config').value;
        const config = JSON.parse(jsonText);

        if (config.name_column_index !== undefined && config.name_column_index !== null) {
            document.getElementById('data_sample_mapper_name_column').value = String(config.name_column_index);
        }
        if (config.remarks !== undefined) {
            document.getElementById('data_sample_mapper_remarks').value = config.remarks;
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析样例映射JSON失败:', e);
        showToast('样例映射JSON格式错误：' + e.message, true);
    }
}

function syncDataSampleMapperToJSON() {
    try {
        const nameColumnIndex = document.getElementById('data_sample_mapper_name_column').value;
        const remarks = document.getElementById('data_sample_mapper_remarks').value;
        const config = {
            name_column_index: nameColumnIndex ? parseInt(nameColumnIndex, 10) : null,
            remarks: remarks || ''
        };

        document.getElementById('data_sample_mapper_json_config').value = JSON.stringify(config, null, 2);
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步样例映射到JSON失败:', e);
    }
}

function watchDataSampleMapperFields() {
    ['data_sample_mapper_name_column', 'data_sample_mapper_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncDataSampleMapperToJSON);
            elem.addEventListener('input', syncDataSampleMapperToJSON);
        }
    });
}

function saveDataSampleMapperConfig() {
    if (currentAdvancedRuleIndex === -1) return;

    const nameColumnIndex = document.getElementById('data_sample_mapper_name_column').value;
    const remarks = document.getElementById('data_sample_mapper_remarks').value;

    if (!nameColumnIndex) {
        showToast('请选择数据名称字段', true);
        return;
    }

    const rule = currentMappingConfig.mapping_rules[currentAdvancedRuleIndex];
    rule.name_column_index = nameColumnIndex;
    rule.remarks = remarks;

    renderMappingConfig();
    mappingTableDirty = true;
    showToast('样例映射配置已保存');
    closeAdvancedConfigModal();
}

async function openColumnValueCountModal(evt) {
    const context = getCurrentMappingRuleFromEvent('列值统计', evt);
    if (!context) return;

    currentAdvancedRuleIndex = context.ruleIndex;

    try {
        const sourceDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
        await ensureMappingColumnsLoaded([sourceDataSource]);
        const columns = getIndexedDataSourceColumns(sourceDataSource, currentMappingConfig);
        const sourceValue = context.currentRule.source_value || '';
        const remarks = context.currentRule.remarks || context.currentRule.description || '';
        const sourceDataSourceName = getMappingDataSourceDisplayName(sourceDataSource);
        const jsonConfig = {
            source_value: sourceValue ? parseInt(sourceValue, 10) : null,
            remarks: remarks || ''
        };

        const moduleHtml = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${buildAdvancedStepListCard(
                    '执行链路',
                    [
                        {
                            label: '选定统计键',
                            text: `当前从${sourceDataSourceName}读取 ${getColumnDisplayNameFromValue(columns, sourceValue, '未选择统计字段')} 的值作为统计键`
                        },
                        {
                            label: '预统计全量数据',
                            text: '导出前，系统会基于当前导出数据集的全量记录先做一次值频次统计'
                        },
                        {
                            label: '回填当前列',
                            text: '当前行会用自己的统计键去频次结果中查值，再把出现次数写回当前列'
                        }
                    ],
                    '#005fe0',
                    '这个统计口径会跟随整体筛选、报表筛选和当前导出数据集变化，不是固定全库计数。'
                )}

                <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #005fe0; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">统计字段</div>
                    <select id="column_value_count_source_value" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">-- 选择字段 --</option>
                        ${buildColumnOptionsHtml(columns, sourceValue)}
                    </select>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">系统会统计该字段当前值在本次导出数据集中的出现次数，并将结果写回当前列。</div>
                </div>
                <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #28a745; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">备注说明</div>
                    <textarea id="column_value_count_remarks" rows="4"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;"
                              placeholder="例如：统计数据名称列在本次导出数据集中重复出现的次数">${remarks}</textarea>
                </div>
            </div>
        `;
        const jsonHtml = `
            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                    <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">列值统计配置（JSON格式）</div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"source_value": 统计字段索引, "remarks": "备注"}</div>
                    <textarea id="column_value_count_json_config" rows="16"
                              style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                              onchange="updateColumnValueCountFromJSON()">${JSON.stringify(jsonConfig, null, 2)}</textarea>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">修改 JSON 会自动更新模块编辑里的统计字段和备注。</div>
                </div>
            </div>
        `;

        openAdvancedConfigModal({
            title: '列值统计配置',
            subtitle: '统计当前数据集中指定列的值出现次数',
            moduleHtml,
            jsonHtml,
            codePreviewBuilder: buildColumnValueCountCodePreview,
            saveHandler: saveColumnValueCountConfig,
            toneColor: '#005fe0',
            ruleIndex: context.ruleIndex,
            sourceType: context.currentRule.source_type,
            dependencyText: '依赖当前导出数据集的全量频次统计结果，口径随筛选范围变化',
            effectText: '保存后会直接影响当前列统计哪一个字段的值，并影响导出文件中的计数结果。',
            summaryText: remarks || ThreeLayerArchitecture.generateRuleSummary(
                context.currentRule.source_type,
                context.currentRule,
                currentMappingConfig
            ) || ''
        });

        setTimeout(() => {
            watchColumnValueCountFields();
        }, 100);
    } catch (e) {
        console.error('打开列值统计配置失败:', e);
        showToast('打开列值统计配置失败：' + e.message, true);
    }
}

function updateColumnValueCountFromJSON() {
    try {
        const jsonText = document.getElementById('column_value_count_json_config').value;
        const config = JSON.parse(jsonText);

        if (config.source_value !== undefined && config.source_value !== null) {
            document.getElementById('column_value_count_source_value').value = String(config.source_value);
        }
        if (config.remarks !== undefined) {
            document.getElementById('column_value_count_remarks').value = config.remarks;
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析列值统计JSON失败:', e);
        showToast('列值统计JSON格式错误：' + e.message, true);
    }
}

function syncColumnValueCountToJSON() {
    try {
        const sourceValue = document.getElementById('column_value_count_source_value').value;
        const remarks = document.getElementById('column_value_count_remarks').value;
        const config = {
            source_value: sourceValue ? parseInt(sourceValue, 10) : null,
            remarks: remarks || ''
        };

        document.getElementById('column_value_count_json_config').value = JSON.stringify(config, null, 2);
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步列值统计到JSON失败:', e);
    }
}

function watchColumnValueCountFields() {
    ['column_value_count_source_value', 'column_value_count_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncColumnValueCountToJSON);
            elem.addEventListener('input', syncColumnValueCountToJSON);
        }
    });
}

function saveColumnValueCountConfig() {
    if (currentAdvancedRuleIndex === -1) return;

    const sourceValue = document.getElementById('column_value_count_source_value').value;
    const remarks = document.getElementById('column_value_count_remarks').value;

    if (!sourceValue) {
        showToast('请选择统计字段', true);
        return;
    }

    const rule = currentMappingConfig.mapping_rules[currentAdvancedRuleIndex];
    rule.source_value = sourceValue;
    rule.remarks = remarks;

    renderMappingConfig();
    mappingTableDirty = true;
    showToast('列值统计配置已保存');
    closeAdvancedConfigModal();
}

function openExpansionRulesModal(evt) {
    const expansionRules = currentMappingConfig.expansion_rules || {};
    const triggerEvent = evt || window.event || null;
    const context = triggerEvent ? getCurrentMappingRuleFromEvent('展开规则', triggerEvent) : null;
    const sourceType = context?.currentRule?.source_type || 'multi_strategy_config';
    const ruleEntries = Object.entries(expansionRules || {});
    const moduleHtml = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${buildAdvancedStepListCard(
                '执行链路',
                [
                    {
                        label: '定义策略类型',
                        text: '你在 expansion_rules 中定义的每一个 key，都会成为一类展开策略'
                    },
                    {
                        label: '展开记录',
                        text: 'multi_strategy_config 会按这些规则把一条源记录展开成多条策略记录，并把策略类型写入对应列'
                    },
                    {
                        label: '映射内容',
                        text: 'strategy_content_mapping 会根据展开出的策略类型，从同一套 expansion_rules 中返回对应内容文本'
                    }
                ],
                '#005fe0',
                '这是一套报表级共享配置，同一次修改会同时影响“多行展开”和“策略内容映射”两个带配置查询的列。'
            )}
            <div style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">当前策略总览</div>
                ${ruleEntries.length > 0 ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                        ${ruleEntries.map(([key, rule]) => `
                            <div style="padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <div style="font-size: 12px; font-weight: 700; color: #1f2937; margin-bottom: 6px;">${escapeHtml(key)}</div>
                                <div style="font-size: 11px; color: #64748b; line-height: 1.7;">展开标签：${escapeHtml((rule || {}).g_column || '未配置')}</div>
                                <div style="font-size: 11px; color: #64748b; line-height: 1.7;">内容字段：${escapeHtml((rule || {}).h_column || '未配置')}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="font-size: 12px; color: #6c757d; line-height: 1.8;">当前还没有定义任何策略类型。请在 JSON 编辑页中维护 expansion_rules。</div>
                `}
            </div>
        </div>
    `;
    const jsonHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                <div style="font-size: 12px; color: #495057; font-weight: 600; margin-bottom: 10px;">展开规则 JSON</div>
                <div style="font-size: 11px; color: #6c757d; margin-bottom: 8px;">建议结构：{"data_masking":{"g_column":"数据脱敏","h_column":"策略描述"},"data_encryption":{...}}</div>
                <textarea id="expansion_rules_json" rows="16"
                          style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                          onchange="refreshAdvancedCodePreviewIfVisible()"
                          oninput="refreshAdvancedCodePreviewIfVisible()">${JSON.stringify(expansionRules, null, 2)}</textarea>
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">该类逻辑以 JSON 为主维护，保存后会同时影响多行展开和策略内容映射。</div>
            </div>
        </div>
    `;
    openAdvancedConfigModal({
        title: sourceType === 'strategy_content_mapping' ? '策略内容映射配置' : '多行展开配置',
        subtitle: '配置多行展开和策略内容映射共用的 expansion_rules',
        moduleHtml,
        jsonHtml,
        codePreviewBuilder: buildExpansionRulesCodePreview,
        saveHandler: saveExpansionRulesConfig,
        toneColor: '#005fe0',
        targetColumn: context?.currentRule?.target_column || '报表级',
        targetName: context?.currentRule?.target_name || 'expansion_rules',
        sourceType,
        dependencyText: '依赖当前报表的展开规则定义',
        effectText: '保存后会直接影响当前报表的多行展开结果，以及由策略类型映射出来的策略内容文本。',
        summaryText: '这是一套报表级共享配置，会同时影响多行展开和策略内容映射两类逻辑。'
    });
}

function saveExpansionRulesConfig() {
    try {
        const rulesJson = document.getElementById('expansion_rules_json').value;
        currentMappingConfig.expansion_rules = JSON.parse(rulesJson || '{}');
        renderMappingConfig();
        mappingTableDirty = true;
        showToast('展开规则配置已保存');
        closeAdvancedConfigModal();
    } catch (e) {
        console.error('保存展开规则失败:', e);
        showToast('展开规则JSON格式错误：' + e.message, true);
    }
}

// ===== 多字段条件配置模态框 =====

let currentMultiCondRuleIndex = -1;
let currentMultiCondMode = 'simple';  // simple | groups

// 打开多字段条件配置模态框
async function openMultiConditionalModal(evt) {
    // 获取点击按钮所在的行
    const clickedButton = evt && evt.target ? evt.target : null;
    if (!clickedButton) {
        showToast('未找到触发按钮', true);
        return;
    }
    const row = clickedButton.closest('tr[data-rule-index]');

    if (!row) {
        showToast('未找到配置行', true);
        return;
    }

    const ruleIndex = parseInt(row.dataset.ruleIndex);
    const currentRule = currentMappingConfig.mapping_rules[ruleIndex];

    if (!currentRule) {
        showToast('未找到多字段条件配置', true);
        return;
    }

    currentMultiCondRuleIndex = ruleIndex;
    currentMultiCondMode = (currentRule.source_type === 'conditional_groups' ||
                            (Array.isArray(currentRule.groups) && currentRule.groups.length > 0))
        ? 'groups'
        : 'simple';

    // 确保数据源列已加载
    const dataSource = resolveEffectiveMappingDataSource(currentMappingConfig || {});
    console.log('[openMultiConditionalModal] 数据源:', dataSource);
    console.log('[openMultiConditionalModal] window.currentDataSourceColumns:', window.currentDataSourceColumns);

    if (!window.currentDataSourceColumns || !window.currentDataSourceColumns[dataSource] || window.currentDataSourceColumns[dataSource].length === 0) {
        console.log('[openMultiConditionalModal] 数据源列未加载，开始加载...');
        try {
            const columnsRes = await fetch(API_BASE + `/data-source-columns/${dataSource}`);
            const columnsResult = await columnsRes.json();

            if (columnsResult.success && columnsResult.columns) {
                if (!window.currentDataSourceColumns) {
                    window.currentDataSourceColumns = {};
                }
                window.currentDataSourceColumns[dataSource] = columnsResult.columns;
                console.log('[openMultiConditionalModal] 成功加载列数据:', columnsResult.columns.length, '个字段');
            } else {
                console.error('[openMultiConditionalModal] 加载列数据失败:', columnsResult.error);
                showToast('加载数据源列失败: ' + (columnsResult.error || '未知错误'), true);
                return;
            }
        } catch (e) {
            console.error('[openMultiConditionalModal] 加载列数据异常:', e);
            showToast('加载数据源列失败: ' + e.message, true);
            return;
        }
    }

    const sourceDataSourceName = getMappingDataSourceDisplayName(dataSource);

    const moduleHtml = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${buildAdvancedStepListCard(
                '执行链路',
                currentMultiCondMode === 'groups'
                    ? [
                        {
                            label: '组内判断',
                            text: `从${sourceDataSourceName}读取每组 conditions 中指定的多个字段，组内条件固定按 AND 判断`
                        },
                        {
                            label: '组间汇总',
                            text: '各组独立判断后，再按 group_logic（OR 或 AND）决定是否命中'
                        },
                        {
                            label: '返回结果',
                            text: '命中某组时返回该组 result；全部未命中时返回 default'
                        }
                    ]
                    : [
                        {
                            label: '读取字段',
                            text: `从${sourceDataSourceName}读取 conditions 中指定的多个字段值`
                        },
                        {
                            label: '联合判断',
                            text: '按 logic（AND 或 OR）对多字段条件联合判断；regex=true 时使用正则匹配'
                        },
                        {
                            label: '返回结果',
                            text: '全部满足时返回 result，不满足时返回 default'
                        }
                    ],
                '#005fe0',
                '完整细节以 JSON 配置为准；模块页负责维护常见参数，JSON 页负责维护完整配置。'
            )}
            <div id="multiConditionalAdvancedEditor"></div>
        </div>
    `;
    const jsonHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
            <div id="multiConditionalJsonEditor"></div>
        </div>
    `;

    openAdvancedConfigModal({
        title: currentMultiCondMode === 'groups' ? '条件组配置' : '多字段条件配置',
        subtitle: currentMultiCondMode === 'groups'
            ? '组内条件按 AND 判断，组间再按 group_logic 汇总'
            : '多个字段按 AND 或 OR 逻辑联合判断',
        moduleHtml,
        jsonHtml,
        codePreviewBuilder: buildMultiConditionalCodePreview,
        saveHandler: saveMultiConditionalConfig,
        toneColor: '#005fe0',
        maxWidth: '1040px',
        ruleIndex,
        sourceType: currentRule.source_type,
        summaryText: (currentRule.remarks || currentRule.description || ThreeLayerArchitecture.generateRuleSummary(
            currentRule.source_type,
            currentRule,
            currentMappingConfig
        )) || '',
        dependencyText: `依赖${sourceDataSourceName}多个字段和当前列的条件规则`
    });

    renderMultiConditionalModalContent(currentRule);
    setTimeout(() => {
        watchMultiConditionalFields();
    }, 100);
}

function buildModalMultiConditionRowsHtml(conditions = []) {
    const dataSource = resolveEffectiveMappingDataSource(currentMappingConfig || {});
    const columns = getIndexedDataSourceColumns(dataSource, currentMappingConfig);

    return (conditions || []).map((cond, idx) => {
        let fieldOptions = '';
        if (columns.length > 0) {
            fieldOptions = buildColumnOptionsHtml(columns, cond.field_index);
        } else {
            fieldOptions = '<option value="" disabled>[数据加载失败]</option>';
        }

        return `
            <div class="modal-multi-condition-row" data-cond-idx="${idx}" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                <div style="font-size: 13px; font-weight: 600; color: #495057; min-width: 60px; padding: 6px 12px; background: white; border-radius: 4px; text-align: center;">条件${idx + 1}</div>
                <select class="modal-cond-field-select" style="flex: 2; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    <option value="">-- 选择字段 --</option>
                    ${fieldOptions}
                </select>
                <select class="modal-cond-operator-select" style="width: 100px; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                    <option value="contains" ${!cond.regex ? 'selected' : ''}>包含</option>
                    <option value="regex" ${cond.regex ? 'selected' : ''}>正则</option>
                </select>
                <input type="text" class="modal-cond-match-input" value="${escapeHtml(cond.match || '')}" placeholder="输入匹配值"
                    style="flex: 1.5; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <button type="button" class="modal-btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;"
                    onclick="removeModalMultiCondition(${idx})">删除</button>
            </div>
        `;
    }).join('');
}

// 渲染模态框内容
function renderMultiConditionalModalContent(rule) {
    const moduleBody = document.getElementById('multiConditionalAdvancedEditor') || document.getElementById('multiConditionalModalBody');
    const jsonBody = document.getElementById('multiConditionalJsonEditor');

    if (!moduleBody) return;

    if (currentMultiCondMode === 'groups') {
        const groupLogic = rule.group_logic || 'OR';
        const groups = rule.groups || [];
        const groupsJson = JSON.stringify(groups, null, 2);
        const defaultResult = rule.default || '';
        const remarks = rule.remarks || rule.description || '';
        const fullConfigJson = JSON.stringify({
            group_logic: groupLogic,
            groups,
            default: defaultResult,
            remarks
        }, null, 2);

        moduleBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                    <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 10px;">组间逻辑关系</label>
                    <select id="modal_multi_group_logic" style="width: 100%; padding: 10px 14px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                        <option value="OR" ${groupLogic === 'OR' ? 'selected' : ''}>OR（任一组满足即可）</option>
                        <option value="AND" ${groupLogic === 'AND' ? 'selected' : ''}>AND（所有组都满足）</option>
                    </select>
                </div>
                <div style="padding: 15px; background: #fff9e6; border-radius: 6px; border-left: 4px solid #ffc107;">
                    <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 8px;">条件组内容</label>
                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">这里维护 groups 数组本身；完整配置请看 JSON 编辑页。</div>
                    <textarea id="modal_cond_groups_json" rows="12"
                              style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;">${groupsJson}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                        <label style="font-size: 14px; font-weight: 600; color: #6c757d; display: block; margin-bottom: 8px;">默认值</label>
                        <input type="text" id="modal_cond_default" value="${defaultResult}" placeholder="默认值"
                            style="width: 100%; padding: 10px 14px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div style="padding: 15px; background: #e8f5e9; border-radius: 6px; border-left: 4px solid #28a745;">
                        <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 8px;">备注说明</label>
                        <input type="text" id="modal_cond_remarks" value="${remarks}"
                            style="width: 100%; padding: 10px 14px; border: 1px solid #28a745; border-radius: 4px; font-size: 13px;"
                            placeholder="输入该列规则说明">
                    </div>
                </div>
            </div>
        `;

        if (jsonBody) {
            jsonBody.innerHTML = `
                <div style="padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 6px;">
                    <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 8px;">完整配置（JSON）</label>
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"group_logic":"OR","groups":[{"conditions":[...],"result":"返回值"}],"default":"默认值","remarks":"备注"}</div>
                    <textarea id="multi_cond_json_config" rows="16"
                              style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                              onchange="updateMultiConditionalFromJSON()">${fullConfigJson}</textarea>
                </div>
            `;
        }
        return;
    }

    const conditions = rule.conditions || [];
    const logic = rule.logic || 'AND';
    const defaultResult = rule.default || '';
    const matchResult = rule.result || '';
    const remarks = rule.remarks || rule.description || '';
    const fullConfigJson = JSON.stringify({
        logic,
        conditions,
        result: matchResult,
        default: defaultResult,
        remarks
    }, null, 2);

    moduleBody.innerHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
            <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 10px;">条件逻辑关系</label>
            <select id="modal_multi_cond_logic" style="width: 100%; padding: 10px 14px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                <option value="AND" ${logic === 'AND' ? 'selected' : ''}>AND（全部满足 - 所有条件都为真）</option>
                <option value="OR" ${logic === 'OR' ? 'selected' : ''}>OR（满足任一 - 任一条件为真即可）</option>
            </select>
        </div>
        <div style="margin-bottom: 20px;">
            <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 10px;">条件列表</label>
            <div id="modal_multi_cond_conditions_list" style="min-height: 60px;">
                ${buildModalMultiConditionRowsHtml(conditions)}
            </div>
            <button type="button" id="modal_btn_add_multi_cond" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;"
                onclick="addModalMultiCondition()">[+] 添加新条件</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div style="padding: 15px; background: #f0fff4; border-radius: 6px; border: 2px solid #28a745;">
                <label style="font-size: 14px; font-weight: 600; color: #28a745; display: block; margin-bottom: 8px;">条件满足时返回的值</label>
                <input type="text" id="modal_cond_result" value="${matchResult}" placeholder="所有条件满足时返回的值"
                    style="width: 100%; padding: 10px 14px; border: 1px solid #28a745; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="padding: 15px; background: #f8f9fa; border-radius: 6px; border: 2px solid #6c757d;">
                <label style="font-size: 14px; font-weight: 600; color: #6c757d; display: block; margin-bottom: 8px;">条件不满足时返回的值</label>
                <input type="text" id="modal_cond_default" value="${defaultResult}" placeholder="默认值"
                    style="width: 100%; padding: 10px 14px; border: 1px solid #6c757d; border-radius: 4px; font-size: 14px;">
            </div>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #e8f5e9; border-radius: 6px; border-left: 4px solid #28a745;">
            <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 8px;">备注说明（针对此列的详细说明）</label>
            <textarea id="modal_cond_remarks" rows="3"
                      style="width: 100%; padding: 10px 14px; border: 1px solid #28a745; border-radius: 4px; font-size: 13px; line-height: 1.5;"
                      placeholder="输入针对此列的详细说明和业务规则，例如：当业务系统名称为CRM且数据名称包含身份证时，填写用户提供">${remarks}</textarea>
            <div style="font-size: 11px; color: #6c757d; margin-top: 6px;">可在此输入针对此列的详细说明和业务规则</div>
        </div>
        <div style="padding: 15px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
            <div style="font-size: 13px; color: #856404; line-height: 1.6;">
                <strong style="display: block; margin-bottom: 5px;">使用示例：</strong>
                当"业务系统名称"包含"CRM"<strong>且</strong>"数据名称"包含"身份证"时，填写"用户提供"，否则填写"生产运营中产生"
            </div>
        </div>
    `;

    if (jsonBody) {
        jsonBody.innerHTML = `
            <div style="padding: 15px; background: #fff9e6; border-radius: 6px; border-left: 4px solid #ffc107;">
                <label style="font-size: 14px; font-weight: 600; color: #495057; display: block; margin-bottom: 8px;">完整配置（JSON）</label>
                <div style="font-size: 11px; color: #666; margin-bottom: 8px;">格式：{"logic":"AND","conditions":[{"field_index":9,"match":"CRM","regex":false}],"result":"命中值","default":"默认值","remarks":"备注"}</div>
                <textarea id="multi_cond_json_config" rows="16"
                          style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5;"
                          onchange="updateMultiConditionalFromJSON()">${fullConfigJson}</textarea>
            </div>
        `;
    }
}

// 模态框中添加条件
function addModalMultiCondition() {
    const container = document.getElementById('modal_multi_cond_conditions_list');
    const idx = container.querySelectorAll('.modal-multi-condition-row').length;

    const dataSource = resolveEffectiveMappingDataSource(currentMappingConfig || {});
    const columns = getIndexedDataSourceColumns(dataSource, currentMappingConfig);

    let fieldOptions = '';
    if (columns.length > 0) {
        fieldOptions = buildColumnOptionsHtml(columns, '');
    } else {
        fieldOptions = '<option value="" disabled>[数据加载失败]</option>';
    }

    const newCondHtml = `
        <div class="modal-multi-condition-row" data-cond-idx="${idx}" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
            <div style="font-size: 13px; font-weight: 600; color: #495057; min-width: 60px; padding: 6px 12px; background: white; border-radius: 4px; text-align: center;">条件${idx + 1}</div>
            <select class="modal-cond-field-select" style="flex: 2; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <option value="">-- 选择字段 --</option>
                ${fieldOptions}
            </select>
            <select class="modal-cond-operator-select" style="width: 100px; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
                <option value="contains">包含</option>
                <option value="regex">正则</option>
            </select>
            <input type="text" class="modal-cond-match-input" placeholder="输入匹配值"
                style="flex: 1.5; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">
            <button type="button" class="modal-btn-remove-cond" style="padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;"
                onclick="removeModalMultiCondition(${idx})">删除</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', newCondHtml);
    syncMultiConditionalToJSON();
    refreshAdvancedCodePreviewIfVisible();
}

// 模态框中删除条件
function removeModalMultiCondition(idx) {
    const row = document.querySelector(`.modal-multi-condition-row[data-cond-idx="${idx}"]`);
    if (row) {
        row.remove();
        // 重新编号
        document.querySelectorAll('.modal-multi-condition-row').forEach((row, newIdx) => {
            row.dataset.condIdx = newIdx;
            row.querySelector('div:first-child').textContent = `条件${newIdx + 1}`;
            row.querySelector('.modal-btn-remove-cond').setAttribute('onclick', `removeModalMultiCondition(${newIdx})`);
        });
        syncMultiConditionalToJSON();
        refreshAdvancedCodePreviewIfVisible();
    }
}

// 关闭模态框
function closeMultiConditionalModal() {
    const modal = document.getElementById('multiConditionalModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const advancedModal = document.getElementById('advancedConfigModal');
    if (advancedModal && advancedModal.style.display === 'flex' && currentAdvancedSaveHandler === saveMultiConditionalConfig) {
        closeAdvancedConfigModal();
        return;
    }
    currentMultiCondRuleIndex = -1;
    currentMultiCondMode = 'simple';
}

function updateMultiConditionalFromJSON() {
    try {
        const config = JSON.parse(document.getElementById('multi_cond_json_config').value || '{}');

        if (currentMultiCondMode === 'groups') {
            document.getElementById('modal_multi_group_logic').value = config.group_logic || 'OR';
            document.getElementById('modal_cond_groups_json').value = JSON.stringify(config.groups || [], null, 2);
            document.getElementById('modal_cond_default').value = config.default || '';
            document.getElementById('modal_cond_remarks').value = config.remarks || '';
            refreshAdvancedCodePreviewIfVisible();
            return;
        }

        document.getElementById('modal_multi_cond_logic').value = config.logic || 'AND';
        document.getElementById('modal_cond_result').value = config.result || '';
        document.getElementById('modal_cond_default').value = config.default || '';
        document.getElementById('modal_cond_remarks').value = config.remarks || '';
        const listEl = document.getElementById('modal_multi_cond_conditions_list');
        if (listEl) {
            listEl.innerHTML = buildModalMultiConditionRowsHtml(config.conditions || []);
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('解析多字段条件JSON失败:', e);
        showToast('多字段条件JSON格式错误：' + e.message, true);
    }
}

function syncMultiConditionalToJSON() {
    try {
        if (currentMultiCondMode === 'groups') {
            const groupLogic = document.getElementById('modal_multi_group_logic')?.value || 'OR';
            const groupsText = document.getElementById('modal_cond_groups_json')?.value || '[]';
            const defaultVal = document.getElementById('modal_cond_default')?.value || '';
            const remarks = document.getElementById('modal_cond_remarks')?.value || '';
            const config = {
                group_logic: groupLogic,
                groups: JSON.parse(groupsText || '[]'),
                default: defaultVal,
                remarks
            };
            const jsonElem = document.getElementById('multi_cond_json_config');
            if (jsonElem) {
                jsonElem.value = JSON.stringify(config, null, 2);
            }
            refreshAdvancedCodePreviewIfVisible();
            return;
        }

        const conditionRows = document.querySelectorAll('#modal_multi_cond_conditions_list .modal-multi-condition-row');
        const conditions = [];
        conditionRows.forEach(row => {
            const fieldSelect = row.querySelector('.modal-cond-field-select');
            const matchInput = row.querySelector('.modal-cond-match-input');
            const operatorSelect = row.querySelector('.modal-cond-operator-select');

            if (fieldSelect && fieldSelect.value !== '') {
                conditions.push({
                    field_index: parseInt(fieldSelect.value, 10),
                    match: matchInput ? matchInput.value : '',
                    regex: operatorSelect && operatorSelect.value === 'regex'
                });
            }
        });

        const config = {
            logic: document.getElementById('modal_multi_cond_logic')?.value || 'AND',
            conditions,
            result: document.getElementById('modal_cond_result')?.value || '',
            default: document.getElementById('modal_cond_default')?.value || '',
            remarks: document.getElementById('modal_cond_remarks')?.value || ''
        };
        const jsonElem = document.getElementById('multi_cond_json_config');
        if (jsonElem) {
            jsonElem.value = JSON.stringify(config, null, 2);
        }
        refreshAdvancedCodePreviewIfVisible();
    } catch (e) {
        console.error('同步多字段条件到JSON失败:', e);
    }
}

function watchMultiConditionalFields() {
    if (currentMultiCondMode === 'groups') {
        ['modal_multi_group_logic', 'modal_cond_groups_json', 'modal_cond_default', 'modal_cond_remarks'].forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('change', syncMultiConditionalToJSON);
                elem.addEventListener('input', syncMultiConditionalToJSON);
            }
        });
        return;
    }

    ['modal_multi_cond_logic', 'modal_cond_result', 'modal_cond_default', 'modal_cond_remarks'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', syncMultiConditionalToJSON);
            elem.addEventListener('input', syncMultiConditionalToJSON);
        }
    });

    const listEl = document.getElementById('modal_multi_cond_conditions_list');
    if (listEl) {
        listEl.addEventListener('change', syncMultiConditionalToJSON);
        listEl.addEventListener('input', syncMultiConditionalToJSON);
    }
}

// 保存模态框配置
function saveMultiConditionalConfig() {
    if (currentMultiCondRuleIndex < 0) {
        showToast('未找到对应的配置行', true);
        return;
    }
    const currentRuleRow = document.querySelector(`tr[data-rule-index="${currentMultiCondRuleIndex}"]`);

    if (currentMultiCondMode === 'groups') {
        try {
            const groupLogic = document.getElementById('modal_multi_group_logic').value || 'OR';
            const groupsText = document.getElementById('modal_cond_groups_json').value || '[]';
            const defaultVal = document.getElementById('modal_cond_default').value;
            const remarks = document.getElementById('modal_cond_remarks').value;
            const groups = JSON.parse(groupsText);

            if (!Array.isArray(groups)) {
                showToast('条件组JSON必须是数组', true);
                return;
            }

            const rule = currentMappingConfig.mapping_rules[currentMultiCondRuleIndex];
            rule.source_type = 'conditional_groups';
            rule.groups = groups;
            rule.group_logic = groupLogic;
            rule.default = defaultVal;
            rule.remarks = remarks;
            delete rule.conditions;
            delete rule.logic;
            delete rule.result;

            renderMappingConfig();
            mappingTableDirty = true;
            closeMultiConditionalModal();
            showToast('条件组配置已保存，请点击"保存配置"提交到服务器', false);
        } catch (e) {
            console.error('保存条件组配置失败:', e);
            showToast('条件组JSON格式错误：' + e.message, true);
        }
        return;
    }

    // 收集数据
    const logic = document.getElementById('modal_multi_cond_logic').value;
    const result = document.getElementById('modal_cond_result').value;
    const defaultVal = document.getElementById('modal_cond_default').value;
    const remarks = document.getElementById('modal_cond_remarks').value;

    // 收集条件
    const conditionRows = document.querySelectorAll('#modal_multi_cond_conditions_list .modal-multi-condition-row');
    const conditions = [];
    conditionRows.forEach(row => {
        const fieldSelect = row.querySelector('.modal-cond-field-select');
        const matchInput = row.querySelector('.modal-cond-match-input');
        const operatorSelect = row.querySelector('.modal-cond-operator-select');

        if (fieldSelect && fieldSelect.value !== '') {
            conditions.push({
                field_index: parseInt(fieldSelect.value, 10),
                match: matchInput ? matchInput.value : '',
                regex: operatorSelect && operatorSelect.value === 'regex'
            });
        }
    });

    // 更新规则对象
    const rule = currentMappingConfig.mapping_rules[currentMultiCondRuleIndex];
    rule.source_type = 'multi_conditional';
    rule.conditions = conditions;
    rule.logic = logic;
    rule.result = result;
    rule.default = defaultVal;
    rule.remarks = remarks;  // 保存备注
    delete rule.groups;
    delete rule.group_logic;

    // 更新表格中的隐藏字段
    const configInput = currentRuleRow
        ? currentRuleRow.querySelector('[data-field="multi_conditional_config"]')
        : null;
    if (configInput) {
        configInput.value = JSON.stringify({conditions, logic, result, default: defaultVal});
    }

    // 刷新配置显示
    renderMappingConfig();
    mappingTableDirty = true;

    // 关闭模态框
    closeMultiConditionalModal();

    showToast('配置已保存，请点击"保存配置"按钮提交到服务器', false);
}

// 获取source_type的详细说明
function getSourceTypeDescription(sourceType) {
    const descriptions = {
        'sequence': '自动序号：自动生成1、2、3...的递增序号，通常用于第一列',
        'fixed': '固定值：每次都使用相同的文本或数字，如"数智化部"、"湖北移动"',
        'field_index_merge_results': '从合并结果表提取：根据列索引提取字段值',
        'field_index_assets': '从数据概览表提取：根据列索引提取字段值',
        'conditional': '单字段条件判断：根据某个字段的值，返回不同的结果（如：分级1-2→未处理，分级3→脱敏）',
        'multi_conditional': '多字段条件判断：根据多个字段的值，按AND/OR逻辑返回不同结果（如：业务系统包含CRM且数据名称包含身份证→用户提供）',
        'vlookup_assets': '跨表VLOOKUP查询：通过某个字段的值，在数据概览表中查找并返回另一个字段的值（如：用业务系统名称查所属系统类型）',
        'vlookup_assets_with_mapping': '跨表VLOOKUP查询+映射：先通过映射字典转换字段值，再在数据概览表中查找并返回另一个字段的值（如：业务系统名称先映射，再查所属系统类型）',
        'lookup_ip': 'IP查询：通过IP地址在数据概览表中查找相关信息，如"所属系统类型"',
        'data_sample_mapper': '样例映射：按数据名称匹配“数据分级标准样例”，再依据标准记录中的分级对样例做原样、脱敏或加密处理',
        'column_value_count': '列值统计：先对当前导出数据集做整列计数，再把当前行对应值的出现次数写回本列',
        'field_assets_dynamic': '动态生成：基于当前业务系统上下文和展开策略生成动态文本',
        'multi_strategy_config': '多行展开：定义一条源记录如何展开成多条策略记录',
        'strategy_content_mapping': '策略内容映射：根据展开出来的策略类型返回对应内容文本',
        'field_assets_with_transform': '字段+转换：先读取字段，再按条件规则和 transform 输出结果',
        'field_merge_with_transform': '字段+转换：先读取字段，再按条件规则和 transform 输出结果',
        'conditional_groups': '条件组判断：组内按 AND 判断，组间再按 OR/AND 汇总'
    };
    return descriptions[sourceType] || '选择数据来源类型';
}

// 获取source_type的提示信息
function getSourceTypeHint(sourceType) {
    const hints = {
        'conditional': '根据指定字段的值进行条件判断，返回不同的结果',
        'lookup_ip': '通过IP地址在数据概览表中查询关联信息',
        'sequence': '自动生成1、2、3...的序号，无需设置值',
        'fixed': '填写固定的文本或数字，每次都使用相同的值',
        'vlookup_assets': '通过某个字段值在数据概览表中查找并返回指定列的值',
        'vlookup_assets_with_mapping': '通过映射字典转换后，在数据概览表中查找并返回指定列的值'
    };
    return hints[sourceType] || '';
}

// 从下拉框选择时更新（已废弃，保留用于兼容）
function updateSourceValueFromSelect(select, ruleIndex) {
    // 下拉框直接绑定到data-field="source_value"，无需额外处理
}

// 获取类别显示名称
function getCategoryDisplayName(category) {
    const names = {
        'yeji': '业支上报',
        'smc': 'SMC上报',
        'xinan': '信安上报'
    };
    return names[category] || category;
}

// 加载选中报表的映射配置
async function loadSelectedMappingConfig() {
    const select = document.getElementById('mappingReportSelect');
    const value = select.value;

    if (!value) {
        showToast('请先选择报表', true);
        return;
    }

    const [category, reportCode] = value.split('/');
    currentMappingCategory = category;
    currentMappingReportCode = reportCode;
    currentMappingApiReportCode = reportCode;

    try {
        // 先获取映射配置
        const configRes = await fetch(API_BASE + `/mapping-config/${category}/${reportCode}`);

        // 处理404错误（报表暂无映射配置）
        if (configRes.status === 404) {
            showToast('该报表暂无映射配置，请先配置', true);
            renderMappingConfig(null, []);
            return;
        }

        const configResult = await configRes.json();

        if (configResult.success && configResult.data) {
            currentMappingApiReportCode = configResult.matched_key || reportCode;
            currentMappingConfig = configResult.data;

            // 获取数据源列信息：映射编辑器始终预取两边字段，避免双源规则进入空列表
            const dataSource = configResult.data.data_source || 'assets';

            console.log('[DEBUG] 准备获取双源列信息，主数据源:', dataSource);

            const loadedColumnsBySource = await ensureMappingDataSourceColumns(['assets', 'merge_results']);
            const preferredDataSourceColumns = loadedColumnsBySource[dataSource] || [];

            renderMappingConfig(configResult.data, preferredDataSourceColumns);
        } else {
            showToast('加载映射配置失败', true);
        }
    } catch (e) {
        console.error('加载映射配置失败:', e);
        showToast('加载映射配置失败: ' + e.message, true);
    }
}

// ============================================
// 开发者平台功能函数
// ============================================

// 切换映射视图模式（表格/代码）
async function switchMappingView(mode) {
    // 从表格切到代码前，先保护未保存编辑
    if (mode === 'code' && window.mappingViewMode === 'table' && mappingTableDirty) {
        const tableRows = document.querySelectorAll('#mappingConfigContent tbody tr');
        if (tableRows.length > 0) {
            const shouldSaveFirst = confirm(
                '检测到你可能在表格中有未保存的修改。\n\n是否先保存后再切换到代码视图？\n\n点击“确定”：先保存并切换\n点击“取消”：留在当前视图'
            );

            if (!shouldSaveFirst) {
                return;
            }

            const saved = await saveMappingConfig();
            if (!saved) {
                showToast('保存失败，已取消切换到代码视图', true);
                return;
            }
        }
    }

    window.mappingViewMode = mode;

    // 更新按钮状态
    const tableBtn = document.getElementById('viewTableBtn');
    const codeBtn = document.getElementById('viewCodeBtn');
    const categoryColor = currentMappingCategory === 'yeji' ? '#005fe0' :
                         currentMappingCategory === 'smc' ? '#28a745' : '#dc3545';

    if (tableBtn && codeBtn) {
        tableBtn.style.background = mode === 'table' ? categoryColor : 'transparent';
        tableBtn.style.color = mode === 'table' ? 'white' : '#888';
        codeBtn.style.background = mode === 'code' ? categoryColor : 'transparent';
        codeBtn.style.color = mode === 'code' ? 'white' : '#888';
    }

    // 重新渲染配置
    if (window.currentMappingConfigData) {
        renderMappingConfig(window.currentMappingConfigData, window.currentDataSourceColumns?.[window.currentMappingConfigData.data_source] || [], window.currentTemplateColumnsInfo);
    }
}

// 渲染代码视图
function renderCodeView(config) {
    const categoryColor = currentMappingCategory === 'yeji' ? '#005fe0' :
                         currentMappingCategory === 'smc' ? '#28a745' : '#dc3545';
    const currentApiUrl = getExportApiUrl(currentMappingCategory, currentMappingReportCode) || '未配置导出接口';
    const readOnlyNotice = '代码视图为只读，请切换到表格视图修改。';

    // 提取当前报表的配置（用于显示）
    const reportConfig = {
        data_source: config.data_source,
        template_file: config.template_file,
        data_start_row: config.data_start_row,
        filter_config: config.filter_config,
        mapping_rules: config.mapping_rules,
        special_logic: config.special_logic || ''
    };

    const jsonContent = JSON.stringify(reportConfig, null, 2);

    return `
        <!-- 代码编辑器 -->
        <div style="display: flex; gap: 16px; height: calc(100vh - 320px);">
            <!-- 左侧：代码编辑区 -->
            <div style="flex: 1; display: flex; flex-direction: column; background: #1e1e1e; border-radius: 6px; overflow: hidden;">
                <!-- 编辑器头部 -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #2d2d2d; border-bottom: 1px solid #3e3e3e;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 12px; color: #888;">mapping_config.json</span>
                        <span style="font-size: 11px; color: #666;">|</span>
                        <span id="codeViewStatus" style="font-size: 11px; color: #8ab4f8;">只读视图</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="copyCodeToClipboard()" title="复制代码" style="padding: 4px 8px; background: #3e3e3e; color: #e0e0e0; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">复制</button>
                        <button onclick="downloadCodeAsFile()" title="下载文件" style="padding: 4px 8px; background: #3e3e3e; color: #e0e0e0; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">下载</button>
                    </div>
                </div>

                <div style="padding: 10px 16px; background: #16213a; border-bottom: 1px solid #2a3758; font-size: 12px; color: #c7d2fe; line-height: 1.6;">
                    ${readOnlyNotice}
                </div>

                <!-- 编辑器主体 -->
                <div style="flex: 1; position: relative; overflow: hidden;">
                    <!-- 行号 -->
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 40px; background: #1e1e1e; border-right: 1px solid #3e3e3e; padding: 10px 0; text-align: right; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; line-height: 1.5; color: #666; overflow: hidden;" id="codeLineNumbers">
                        ${jsonContent.split('\n').map((_, i) => `<div>${i + 1}</div>`).join('')}
                    </div>

                    <!-- 代码内容 -->
                    <textarea
                        id="codeEditor"
                        spellcheck="false"
                        readonly
                        style="width: 100%; height: 100%; background: transparent; color: #d4d4d4; border: none; padding: 10px 10px 10px 50px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; line-height: 1.5; resize: none; outline: none; white-space: pre; overflow: auto;"
                        onkeydown="onCodeEditorKeydown(event)"
                        onscroll="syncCodeScroll(this)"
                    >${jsonContent}</textarea>
                </div>
            </div>

            <!-- 右侧：预览和工具区 -->
            <div style="width: 350px; display: flex; flex-direction: column; gap: 12px;">
                <!-- API测试卡片 -->
                <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <div style="width: 4px; height: 16px; background: ${categoryColor}; border-radius: 2px;"></div>
                        <h4 style="margin: 0; font-size: 14px; color: #333;">API测试</h4>
                    </div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 12px; font-family: monospace; background: #f8f9fa; padding: 8px; border-radius: 4px;">
                        GET ${currentApiUrl}?limit=&lt;测试范围&gt;&amp;skip_log=1
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px;">
                            <span style="color: #666;">测试范围:</span>
                            <select id="testLimitSelect" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
                                <option value="20">前20条</option>
                                <option value="50">前50条</option>
                                <option value="100" selected>前100条</option>
                            </select>
                        </div>
                        <div style="font-size: 11px; color: #6b7280; line-height: 1.6; background: #f8fafc; border-radius: 4px; padding: 8px 10px;">
                            仅验证小样本导出效果，不生成正式文件，不记录正式导出日志。
                        </div>
                        <button onclick="testExportAPI()" style="padding: 10px; background: ${categoryColor}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
                            发送测试请求
                        </button>
                    </div>
                    <div id="apiTestResult" style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 4px; font-size: 11px; color: #666; display: none;">
                        <!-- 测试结果将显示在这里 -->
                    </div>
                </div>

                <!-- 配置摘要卡片 -->
                <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <div style="width: 4px; height: 16px; background: #666; border-radius: 2px;"></div>
                        <h4 style="margin: 0; font-size: 14px; color: #333;">配置摘要</h4>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                        <div style="color: #666;">映射规则:</div>
                        <div style="font-weight: 600; color: #333;">${config.mapping_rules.length} 条</div>
                        <div style="color: #666;">数据源:</div>
                        <div style="font-weight: 600; color: #333;">${getMappingDataSourceSummaryLabel(config)}</div>
                        <div style="color: #666;">起始行:</div>
                        <div style="font-weight: 600; color: #333;">${config.data_start_row}</div>
                        <div style="color: #666;">筛选条件:</div>
                        <div style="font-weight: 600; color: ${config.filter_config?.enabled ? '#28a745' : '#999'};">${config.filter_config?.enabled ? '已启用' : '未启用'}</div>
                    </div>
                </div>

                <!-- 快捷操作卡片 -->
                <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <div style="width: 4px; height: 16px; background: #ffc107; border-radius: 2px;"></div>
                        <h4 style="margin: 0; font-size: 14px; color: #333;">快捷操作</h4>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="formatMappingConfig()" disabled title="${readOnlyNotice}" style="padding: 8px 12px; background: #f8f9fa; color: #999; border: 1px solid #ddd; border-radius: 4px; cursor: not-allowed; font-size: 12px; text-align: left; transition: all 0.2s; opacity: 0.7;">
                            格式化代码 (Ctrl+Shift+F)
                        </button>
                        <button onclick="validateMappingConfig()" style="padding: 8px 12px; background: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px; text-align: left; transition: all 0.2s;">
                            验证JSON格式 (F9)
                        </button>
                        <button onclick="applyCodeChanges()" disabled title="${readOnlyNotice}" style="padding: 8px 12px; background: #f8f9fa; color: #999; border: 1px solid #ddd; border-radius: 4px; cursor: not-allowed; font-size: 12px; text-align: left; transition: all 0.2s; opacity: 0.7;">
                            代码视图只读
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 代码编辑器输入事件
function onCodeEditorInput(textarea) {
    const statusEl = document.getElementById('codeViewStatus');
    try {
        JSON.parse(textarea.value);
        if (statusEl) {
            statusEl.textContent = '已验证';
            statusEl.style.color = '#28a745';
        }
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = '格式错误';
            statusEl.style.color = '#dc3545';
        }
    }
}

// 代码编辑器按键事件
function onCodeEditorKeydown(event) {
    const textarea = event.target;
    const isReadOnly = Boolean(textarea && textarea.readOnly);
    const key = String(event.key || '').toLowerCase();

    // Ctrl+S: 保存
    if (event.ctrlKey && key === 's') {
        event.preventDefault();
        showToast('代码视图为只读，请切换到表格视图修改。', true);
        return;
    }

    // Ctrl+Shift+F: 格式化
    if (event.ctrlKey && event.shiftKey && key === 'f') {
        event.preventDefault();
        showToast('代码视图为只读，请切换到表格视图修改。', true);
        return;
    }

    // F9: 验证
    if (event.key === 'F9') {
        event.preventDefault();
        validateMappingConfig();
        return;
    }

    if (isReadOnly) {
        return;
    }

    // Tab键: 插入2个空格
    if (event.key === 'Tab') {
        event.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
    }
}

// 同步滚动
function syncCodeScroll(textarea) {
    const lineNumbers = document.getElementById('codeLineNumbers');
    if (lineNumbers) {
        lineNumbers.scrollTop = textarea.scrollTop;
    }
}

// 格式化配置
function formatMappingConfig() {
    const editor = document.getElementById('codeEditor');
    if (!editor) return;
    if (editor.readOnly) {
        showToast('代码视图为只读，请切换到表格视图修改。', true);
        return false;
    }

    try {
        const config = JSON.parse(editor.value);
        editor.value = JSON.stringify(config, null, 2);
        onCodeEditorInput(editor);
        showToast('格式化成功', false);
        return true;
    } catch (e) {
        showToast('格式化失败: ' + e.message, true);
        return false;
    }
}

// 验证配置
function validateMappingConfig() {
    const editor = document.getElementById('codeEditor');
    if (!editor) return;
    const statusEl = document.getElementById('codeViewStatus');

    try {
        JSON.parse(editor.value);
        if (statusEl) {
            statusEl.textContent = editor.readOnly ? '只读校验通过' : '已验证';
            statusEl.style.color = '#28a745';
        }
        showToast('JSON格式正确', false);
        return true;
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = '格式错误';
            statusEl.style.color = '#dc3545';
        }
        showToast('JSON格式错误: ' + e.message, true);
        return false;
    }
}

// 应用代码更改
async function applyCodeChanges() {
    const editor = document.getElementById('codeEditor');
    if (!editor) return false;
    if (editor.readOnly) {
        showToast('代码视图为只读，不支持通过前端代码页提交修改。', true);
        return false;
    }

    try {
        const newConfig = JSON.parse(editor.value);

        // 更新当前配置
        if (window.currentMappingConfigData) {
            Object.assign(window.currentMappingConfigData, newConfig);

            // 保存到后端
            const response = await fetch(API_BASE + `/mapping-config/${currentMappingCategory}/${currentMappingApiReportCode || currentMappingReportCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(window.currentMappingConfigData)
            });

            const result = await response.json();
            if (result.success) {
                showToast('配置已保存，立即生效！', false);
                mappingTableDirty = false;
                return true;
            } else {
                showToast('保存失败: ' + result.error, true);
                return false;
            }
        }
    } catch (e) {
        showToast('应用失败: ' + e.message, true);
        return false;
    }

    return false;
}

// 复制代码到剪贴板
function copyCodeToClipboard() {
    const editor = document.getElementById('codeEditor');
    if (editor) {
        editor.select();
        document.execCommand('copy');
        showToast('代码已复制', false);
    }
}

// 下载代码为文件
function downloadCodeAsFile() {
    const editor = document.getElementById('codeEditor');
    if (!editor) return;

    const blob = new Blob([editor.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMappingReportCode}_mapping_config.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('文件已下载', false);
}

// 获取完整的报表代码（用于API调用）
function getFullReportCode(category, reportCode) {
    const prefixes = {
        'yeji': 'i_10600_',
        'smc': 'attachment_',
        'xinan': 'i_10600_',
        'public': ''
    };
    const prefix = prefixes[category] || '';
    // 如果reportCode已经包含前缀，直接返回
    if (reportCode.startsWith(prefix) || reportCode.startsWith('i_10600_') || reportCode.startsWith('attachment_')) {
        return reportCode;
    }
    return prefix + reportCode;
}

// 获取导出API地址（映射管理/试运行共用）
function getExportApiUrl(category, fileCode) {
    const normalizedCode = normalizeExportFileCode(category, fileCode);
    const apiMap = {
        yeji: {
            '10001': '/export/yeji/i_10600_10001',
            '10002': '/export/yeji/i_10600_10002',
            '10004': '/export/yeji/i_10600_10004'
        },
        smc: {
            attachment_3: '/export/smc/attachment_3',
            attachment_5: '/export/smc/attachment_5'
        },
        xinan: {
            '00000': '/export/xinan/i_10600_00000',
            '10001': '/export/xinan/i_10600_10001'
        }
    };

    const fixedApiUrl = apiMap[category]?.[normalizedCode];
    if (fixedApiUrl) {
        return fixedApiUrl;
    }

    if (!category || !fileCode) {
        return '';
    }
    return `/export/reports/${encodeURIComponent(category)}/${encodeURIComponent(fileCode)}`;
}

function getMappingApiTestLimit() {
    const limitSelect = document.getElementById('testLimitSelect');
    const parsedLimit = parseInt(limitSelect?.value || '100', 10);
    return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
}

function buildMappingApiTestUrl(apiUrl, limit) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('skip_log', '1');
    return `${API_BASE + apiUrl}?${params.toString()}`;
}

function buildTrialExportRequestUrl(category, fileCode, limit) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('skip_log', '1');
    return `${API_BASE}/export/reports/${encodeURIComponent(category)}/${encodeURIComponent(fileCode)}?${params.toString()}`;
}

function renderApiTestPreview(result, limit) {
    const previewRows = Array.isArray(result.preview_rows) ? result.preview_rows : [];
    const previewDownloadUrl = result.preview_download_url || '';
    const previewFilename = result.preview_filename || '';
    const previewDownloadButtonHtml = previewDownloadUrl
        ? `
            <div style="margin-top: 12px;">
                <a href="${escapeHtml(previewDownloadUrl)}" target="_blank" style="display: inline-block; padding: 7px 12px; background: #005fe0; color: white; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: 600;">
                    下载临时预览Excel
                </a>
            </div>
        `
        : '';

    return `
        <div style="color: #16a34a; font-weight: 700; margin-bottom: 10px;">测试成功</div>
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; font-size: 12px; line-height: 1.6;">
            <div style="color: #64748b;">测试范围</div>
            <div style="color: #1f2937;">前 ${limit} 条源数据</div>
            <div style="color: #64748b;">输出记录</div>
            <div style="color: #1f2937;">${result.total_rows || 0} 条</div>
            <div style="color: #64748b;">预览记录</div>
            <div style="color: #1f2937;">${result.preview_count || previewRows.length || 0} 条</div>
            <div style="color: #64748b;">文件生成</div>
            <div style="color: #1f2937;">${result.filename ? escapeHtml(result.filename) : '未生成（测试模式）'}</div>
            <div style="color: #64748b;">预览文件</div>
            <div style="color: #1f2937;">${previewFilename ? escapeHtml(previewFilename) : (result.preview_file_error ? '生成失败' : '未生成')}</div>
            <div style="color: #64748b;">系统日志</div>
            <div style="color: #1f2937;">未记录正式导出日志</div>
        </div>
        <div style="margin-top: 10px; padding: 8px 10px; background: #f8fafc; border-radius: 4px; color: #475569; font-size: 12px; line-height: 1.6;">
            ${escapeHtml(result.message || '测试完成')}
        </div>
        ${result.preview_file_error ? `
            <div style="margin-top: 10px; padding: 8px 10px; background: #fff7ed; border-radius: 4px; color: #9a3412; font-size: 12px; line-height: 1.6;">
                临时预览文件生成失败：${escapeHtml(result.preview_file_error)}
            </div>
        ` : ''}
        ${previewDownloadButtonHtml}
    `;
}

function closeTrialExportModal() {
    const modal = document.getElementById('trialExportModal');
    if (modal) {
        modal.remove();
    }
}

function openTrialExportModal(category, fileCode) {
    closeTrialExportModal();

    const file = findReportingFile(category, fileCode);
    if (!file) {
        showToast(`未找到报表：${category}/${fileCode}`, true);
        return;
    }

    const categoryLabel = reportingCategories[category]?.name || category;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.id = 'trialExportModal';
    modal.onclick = (event) => {
        if (event.target === modal) {
            closeTrialExportModal();
        }
    };
    modal.innerHTML = `
        <div class="modal-content" style="width: min(760px, 92vw); max-width: 760px; max-height: 88vh; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 53, 120, 0.22);">
            <div class="modal-header" style="padding: 20px 24px; border-bottom: none; background: linear-gradient(135deg, #0f4fa8 0%, #2d86ff 100%); color: #fff;">
                <div>
                    <div style="font-size: 18px; font-weight: 700;">试运行导出</div>
                    <div style="margin-top: 6px; font-size: 12px; opacity: 0.88;">${escapeHtml(categoryLabel)} / ${escapeHtml(getReportingFileDisplayCode(file))} / ${escapeHtml(getReportingFileDisplayName(file) || '')}</div>
                </div>
                <button class="modal-close" type="button" onclick="closeTrialExportModal()" style="color: #fff; background: rgba(255, 255, 255, 0.16);">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px; display: grid; gap: 16px; background: linear-gradient(180deg, rgba(248, 251, 255, 0.98) 0%, rgba(241, 247, 255, 0.96) 100%);">
                <div style="padding: 14px 16px; background: #fff; border: 1px solid #dbeafe; border-radius: 12px; color: #475569; font-size: 13px; line-height: 1.7;">
                    当前操作会调用正式导出链路，但仅处理前 N 条源数据，并跳过正式导出日志，适合先验证模板映射结果。
                </div>
                <div style="display: grid; grid-template-columns: minmax(140px, 180px) 1fr; gap: 12px 16px; align-items: center;">
                    <label for="trialExportLimitSelect" style="font-size: 13px; font-weight: 600; color: #1f2937;">测试范围</label>
                    <select id="trialExportLimitSelect" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff;">
                        <option value="5">前 5 条</option>
                        <option value="20" selected>前 20 条</option>
                        <option value="50">前 50 条</option>
                        <option value="100">前 100 条</option>
                    </select>
                </div>
                <div id="trialExportResult" style="display: none; padding: 16px; background: #fff; border: 1px solid #dbeafe; border-radius: 12px;"></div>
            </div>
            <div class="modal-footer" style="padding: 16px 24px; background: #f7faff; border-top: 1px solid #e6eef8; justify-content: space-between; align-items: center;">
                <div style="font-size: 12px; color: #64748b;">预览成功后可直接下载临时 Excel 结果核对列名与数据。</div>
                <div class="modal-footer-right" style="display: flex; gap: 10px;">
                    <button class="btn" type="button" onclick="closeTrialExportModal()">关闭</button>
                    <button class="btn btn-primary" type="button" onclick="executeTrialExport()">开始试运行</button>
                </div>
            </div>
        </div>
    `;

    modal.dataset.category = category;
    modal.dataset.fileCode = fileCode;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

async function executeTrialExport() {
    const modal = document.getElementById('trialExportModal');
    const resultDiv = document.getElementById('trialExportResult');
    const limitSelect = document.getElementById('trialExportLimitSelect');

    if (!modal || !resultDiv || !limitSelect) {
        showToast('试运行窗口已关闭', true);
        return;
    }

    const category = modal.dataset.category || '';
    const fileCode = modal.dataset.fileCode || '';
    const limit = parseInt(limitSelect.value || '20', 10);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const requestUrl = buildTrialExportRequestUrl(category, fileCode, safeLimit);

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div style="color: #005fe0;">正在验证前 ${safeLimit} 条源数据，请稍候...</div>`;

    try {
        const response = await fetch(requestUrl);
        const result = await response.json();

        if (!response.ok || !result.success) {
            resultDiv.innerHTML = `<div style="color: #dc3545;">请求失败: ${escapeHtml(result.error || '未知错误')}</div>`;
            return;
        }

        resultDiv.innerHTML = renderApiTestPreview(result, safeLimit);
    } catch (e) {
        resultDiv.innerHTML = `<div style="color: #dc3545;">请求异常: ${escapeHtml(e.message || '未知异常')}</div>`;
    }
}

// 测试导出API
async function testExportAPI() {
    const apiUrl = getExportApiUrl(currentMappingCategory, currentMappingReportCode);

    if (!apiUrl) {
        showToast('该报表暂未配置导出接口', true);
        return;
    }

    if (window.mappingViewMode !== 'code') {
        await switchMappingView('code');
    }

    const resultDiv = document.getElementById('apiTestResult');
    if (!resultDiv) {
        showToast('已取消API测试', true);
        return;
    }

    const limit = getMappingApiTestLimit();
    const requestUrl = buildMappingApiTestUrl(apiUrl, limit);

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div style="color: #005fe0;">正在验证前 ${limit} 条源数据，请稍候...</div>`;

    try {
        const response = await fetch(requestUrl);
        const result = await response.json();

        if (!response.ok || !result.success) {
            resultDiv.innerHTML = `<div style="color: #dc3545;">请求失败: ${escapeHtml(result.error || '未知错误')}</div>`;
            return;
        }

        resultDiv.innerHTML = renderApiTestPreview(result, limit);
    } catch (e) {
        resultDiv.innerHTML = `<div style="color: #dc3545;">请求异常: ${escapeHtml(e.message || '未知异常')}</div>`;
    }
}

// 渲染映射配置界面
function renderMappingConfig(config, dataSourceColumns = [], templateColumnsInfo = null) {
    if (!config) {
        config = currentMappingConfig || window.currentMappingConfigData;
        if (!config) {
            console.error('[RENDER] 无可用映射配置');
            return;
        }
        if (!dataSourceColumns || dataSourceColumns.length === 0) {
            const ds = config.data_source || 'assets';
            const allCols = window.currentDataSourceColumns || {};
            dataSourceColumns = allCols[ds] || [];
        }
        templateColumnsInfo = templateColumnsInfo || window.currentTemplateColumnsInfo || null;
    }
    console.log('[RENDER] renderMappingConfig调用，dataSourceColumns长度:', dataSourceColumns.length);
    // 保存数据源列信息到全局变量（对象格式，按数据源分组）
    const dataSource = config.data_source || 'assets';
    window.currentDataSourceColumns = mergeDataSourceColumns(window.currentDataSourceColumns, {
        [dataSource]: Array.isArray(dataSourceColumns) ? dataSourceColumns : []
    });
    const indexedDataSourceColumns = getIndexedDataSourceColumns(dataSource, config, dataSourceColumns);
    console.log('[RENDER] 已保存数据源列信息到 window.currentDataSourceColumns:', Object.keys(window.currentDataSourceColumns));

    // 保存模板列信息到全局变量
    if (templateColumnsInfo) {
        window.currentTemplateColumnsInfo = templateColumnsInfo;
        console.log('[RENDER] 已保存模板列信息:', templateColumnsInfo.total_columns, '列');
    }

    const container = document.getElementById('mappingConfigContent');

    const categoryColor = currentMappingCategory === 'yeji' ? '#005fe0' :
                         currentMappingCategory === 'smc' ? '#28a745' : '#dc3545';
    const currentApiUrl = getExportApiUrl(currentMappingCategory, currentMappingReportCode) || '未配置导出接口';

    // 添加全局视图状态变量
    window.mappingViewMode = window.mappingViewMode || 'table';
    window.currentMappingConfigData = config;

    let html = `
        <!-- 开发者平台风格头部 -->
        <div style="background: #1e1e1e; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid ${categoryColor};">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <!-- 左侧：报表信息 -->
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="padding: 6px 10px; background: ${categoryColor}; border-radius: 4px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; font-weight: 600; color: white;">${currentMappingReportCode}</div>
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: #e0e0e0;">${config.name}</div>
                        <div style="font-size: 11px; color: #888; font-family: 'Consolas', 'Monaco', monospace;">${currentApiUrl}</div>
                    </div>
                </div>

                <!-- 右侧：工具栏 -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <!-- 视图切换 -->
                    <div style="display: flex; background: #2d2d2d; border-radius: 4px; padding: 2px;">
                        <button onclick="switchMappingView('table')" id="viewTableBtn" style="padding: 5px 12px; background: ${window.mappingViewMode === 'table' ? categoryColor : 'transparent'}; color: ${window.mappingViewMode === 'table' ? 'white' : '#888'}; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-family: 'Consolas', 'Monaco', monospace;">表格</button>
                        <button onclick="switchMappingView('code')" id="viewCodeBtn" style="padding: 5px 12px; background: ${window.mappingViewMode === 'code' ? categoryColor : 'transparent'}; color: ${window.mappingViewMode === 'code' ? 'white' : '#888'}; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-family: 'Consolas', 'Monaco', monospace;">代码</button>
                    </div>

                    <div style="width: 1px; height: 20px; background: #444; margin: 0 4px;"></div>

                    <!-- 操作按钮 -->
                    <button onclick="validateMappingConfig()" title="验证JSON格式" style="padding: 6px 10px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        验证
                    </button>
                    <button onclick="formatMappingConfig()" title="${window.mappingViewMode === 'code' ? '代码视图为只读，请切换到表格视图修改。' : '格式化代码'}" style="padding: 6px 10px; background: #2d2d2d; color: ${window.mappingViewMode === 'code' ? '#777' : '#e0e0e0'}; border: 1px solid #444; border-radius: 4px; cursor: ${window.mappingViewMode === 'code' ? 'not-allowed' : 'pointer'}; font-size: 11px; transition: all 0.2s; opacity: ${window.mappingViewMode === 'code' ? '0.6' : '1'};" ${window.mappingViewMode === 'code' ? 'disabled' : ''}>
                        格式化
                    </button>
                    <button onclick="testExportAPI()" title="测试导出API" style="padding: 6px 10px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        API测试
                    </button>
                    <button onclick="importMappingConfig()" title="导入配置" style="padding: 6px 10px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        导入
                    </button>
                    <button onclick="exportMappingConfig()" title="导出配置" style="padding: 6px 10px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        导出
                    </button>
                    <button onclick="saveMappingConfig()" title="${window.mappingViewMode === 'code' ? '代码视图为只读，请切换到表格视图修改。' : '保存配置 (Ctrl+S)'}" style="padding: 6px 16px; background: ${window.mappingViewMode === 'code' ? '#64748b' : categoryColor}; color: white; border: none; border-radius: 4px; cursor: ${window.mappingViewMode === 'code' ? 'not-allowed' : 'pointer'}; font-size: 11px; font-weight: 600; transition: all 0.2s; opacity: ${window.mappingViewMode === 'code' ? '0.7' : '1'};" ${window.mappingViewMode === 'code' ? 'disabled' : ''}>
                        保存
                    </button>
                </div>
            </div>

            <!-- 状态栏 -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;">
                <div style="display: flex; align-items: center; gap: 16px; font-size: 11px; color: #888;">
                    <span>数据源: <span style="color: #e0e0e0;">${getMappingDataSourceSummaryLabel(config)}</span></span>
                    <span>映射规则: <span style="color: ${categoryColor};">${config.mapping_rules.length}</span> 条</span>
                    <span>起始行: <span style="color: #e0e0e0;">${config.data_start_row}</span></span>
                    ${templateColumnsInfo ? `
                    <span>模板列数: <span style="color: ${templateColumnsInfo.total_columns === (config.mapping_rules?.length || 0) ? '#28a745' : '#dc3545'};">${templateColumnsInfo.total_columns}</span></span>
                    ` : ''}
                </div>
                <div style="font-size: 10px; color: #666; font-family: 'Consolas', 'Monaco', monospace;">
                    ${window.mappingViewMode === 'code' ? '代码视图只读 | F9 验证 | 请切换表格视图修改' : 'Ctrl+S 保存 | Ctrl+Shift+F 格式化 | F9 验证'}
                </div>
            </div>
        </div>
    `;  // 头部HTML结束

    // 根据视图模式渲染不同内容
    if (window.mappingViewMode === 'code') {
        // 代码视图
        html += renderCodeView(config);
    } else {
        // 表格视图（原有内容）
        html += `

        <!-- 配置信息卡片（表格视图） -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px;">
                <div style="font-size: 11px; color: #666; margin-bottom: 4px;">数据源</div>
                <div style="font-size: 13px; font-weight: 600; color: #333;">${getMappingDataSourceSummaryLabel(config)}</div>
            </div>
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px;">
                <div style="font-size: 11px; color: #666; margin-bottom: 4px;">模板文件</div>
                <div style="font-size: 12px; color: #333; font-family: monospace; word-break: break-all;">${config.template_file.split('/').pop()}</div>
            </div>
            ${templateColumnsInfo ? `
            <div style="background: ${templateColumnsInfo.total_columns === (config.mapping_rules?.length || 0) ? '#e8f5e9' : '#fff3cd'}; border: 1px solid ${templateColumnsInfo.total_columns === (config.mapping_rules?.length || 0) ? '#28a745' : '#ffc107'}; border-radius: 4px; padding: 12px;">
                <div style="font-size: 11px; color: #666; margin-bottom: 4px;">列数对比（模板 vs 配置）</div>
                <div style="font-size: 16px; font-weight: 600; ${templateColumnsInfo.total_columns === (config.mapping_rules?.length || 0) ? 'color: #28a745;' : 'color: #dc3545;'}">
                    ${templateColumnsInfo.total_columns}列
                    ${templateColumnsInfo.total_columns !== (config.mapping_rules?.length || 0) ? ` ≠ ${config.mapping_rules?.length || 0}条配置` : ' ✓'}
                </div>
                <div style="font-size: 10px; color: #999; margin-top: 4px;">
                    模板: ${templateColumnsInfo.columns[templateColumnsInfo.total_columns - 1]?.letter}${templateColumnsInfo.total_columns}列
                </div>
                ${templateColumnsInfo.total_columns !== (config.mapping_rules?.length || 0) ? '<div style="font-size: 10px; color: #dc3545; margin-top: 2px;">配置不完整，已自动补充缺失列</div>' : ''}
            </div>
            ` : ''}
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px;">
                <div style="font-size: 11px; color: #666; margin-bottom: 4px;">起始行</div>
                <input type="number" id="data_start_row_input" value="${config.data_start_row}" min="1" max="100"
                       style="width: 80px; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-weight: 600; color: #333;">
                <div style="font-size: 9px; color: #999; margin-top: 2px;">数据从第几行开始填充（前N-1行为表头）</div>
            </div>
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px;">
                <div style="font-size: 11px; color: #666; margin-bottom: 4px;">映射规则数</div>
                <div style="font-size: 24px; font-weight: 600; color: ${categoryColor};">${config.mapping_rules.length}</div>
            </div>
        </div>

        <!-- 数据筛选条件配置 -->
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #333;">数据筛选条件（先决条件）</h4>
            <div style="background: #fff9e6; border: 1px solid #ffc107; border-radius: 6px; padding: 15px;">
                <!-- 数据源说明和切换 -->
                <!-- 废弃功能：筛选数据源切换已隐藏 -->
                <div id="filterDataSourceSwitcher" style="display: none; margin-bottom: 12px; padding: 8px 12px; background: white; border-radius: 4px; border-left: 3px solid #ffc107;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">筛选数据源</div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <select id="filter_data_source_select" onchange="onFilterDataSourceChange(this)" style="padding: 5px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-weight: 600; color: #333;" ${config.filter_config && config.filter_config.enabled ? '' : 'disabled'}>
                            <option value="assets" ${config.data_source === 'assets' || (!config.data_source) ? 'selected' : ''}>数据概览表</option>
                            <option value="merge_results" ${config.data_source === 'merge_results' ? 'selected' : ''}>合并结果表</option>
                        </select>
                        <div style="font-size: 13px; font-weight: 400; color: #666;">
                            <span id="filter_columns_count">加载中...</span>
                        </div>
                    </div>
                    <div style="font-size: 10px; color: #999; margin-top: 4px;">切换筛选数据源将重置所有筛选条件</div>
                </div>

                <!-- 启用筛选和逻辑关系 -->
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
                    <!-- 启用筛选 -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="filter_enabled" ${config.filter_config && config.filter_config.enabled ? 'checked' : ''} onchange="onFilterEnabledChange(this)"
                               style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="filter_enabled" style="font-size: 13px; color: #333; cursor: pointer;">启用数据筛选</label>
                    </div>

                    <!-- 条件间逻辑关系 -->
                    <div style="display: flex; align-items: center; gap: 8px;" id="filter_logic_container">
                        <select id="filter_logic" style="padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;" ${config.filter_config && config.filter_config.enabled ? '' : 'disabled'} onchange="onFilterLogicChange(this)">
                            <option value="AND" ${(!config.filter_config || !config.filter_config.logic || config.filter_config.logic === 'AND') ? 'selected' : ''}>AND（全部满足）</option>
                            <option value="OR" ${config.filter_config && config.filter_config.logic === 'OR' ? 'selected' : ''}>OR（满足任一）</option>
                        </select>
                        <div style="font-size: 11px; color: #666;">多个条件之间的关系</div>
                    </div>
                </div>

                <!-- 筛选条件列表 -->
                <div id="filter_conditions_list" style="margin-bottom: 12px;">
                    ${config.filter_config && config.filter_config.conditions && config.filter_config.conditions.length > 0 ?
                        config.filter_config.conditions.map((cond, idx) => `
                            <div class="filter-condition-row" data-condition-index="${idx}" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
                        <div style="font-size: 12px; color: #666; min-width: 30px;">条件${idx + 1}</div>
                        <select class="filter-field-select" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; min-width: 180px; max-width: 250px;" ${config.filter_config.enabled ? '' : 'disabled'}>
                            <option value="">选择字段</option>
                            ${indexedDataSourceColumns.map(col => `
                                <option value="${col.index}" ${cond.field_index == col.index ? 'selected' : ''}>${col.display_name}</option>
                            `).join('')}
                        </select>
                        <select class="filter-operator-select" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; min-width: 140px;" ${config.filter_config.enabled ? '' : 'disabled'}>
                            <option value="contains" ${cond.operator == 'contains' ? 'selected' : ''}>包含（单值）</option>
                            <option value="contains_any" ${cond.operator == 'contains_any' ? 'selected' : ''}>包含任一（多值OR）</option>
                            <option value="contains_all" ${cond.operator == 'contains_all' ? 'selected' : ''}>包含全部（多值AND）</option>
                            <option value="equals" ${cond.operator == 'equals' ? 'selected' : ''}>等于（单值）</option>
                            <option value="in" ${cond.operator == 'in' ? 'selected' : ''}>等于任一（多值OR）</option>
                            <option value="not_contains" ${cond.operator == 'not_contains' ? 'selected' : ''}>不包含</option>
                            <option value="not_equals" ${cond.operator == 'not_equals' ? 'selected' : ''}>不等于</option>
                            <option value="is_empty" ${cond.operator == 'is_empty' ? 'selected' : ''}>为空</option>
                            <option value="not_empty" ${cond.operator == 'not_empty' ? 'selected' : ''}>不为空</option>
                        </select>
                        <input type="text" class="filter-value-input" placeholder="值（多值逗号分隔）" value="${Array.isArray(cond.value) ? cond.value.join(', ') : (cond.value || '')}"
                               style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; flex: 1; min-width: 150px;" ${config.filter_config.enabled ? '' : 'disabled'}>
                        <button class="btn-remove-condition" onclick="removeFilterCondition(this)" style="padding: 4px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;" ${config.filter_config.enabled ? '' : 'disabled'}>删除</button>
                    </div>
                        `).join('') : `
                        <div class="filter-condition-row" data-condition-index="0" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666; min-width: 30px;">条件1</div>
                            <select class="filter-field-select" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; min-width: 180px; max-width: 250px;" disabled>
                                <option value="" selected>选择字段</option>
                                ${indexedDataSourceColumns.map(col => `
                                    <option value="${col.index}">${col.display_name}</option>
                                `).join('')}
                            </select>
                            <select class="filter-operator-select" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; min-width: 140px;" disabled>
                                <option value="contains">包含（单值）</option>
                                <option value="contains_any">包含任一（多值OR）</option>
                                <option value="contains_all">包含全部（多值AND）</option>
                                <option value="equals">等于（单值）</option>
                                <option value="in">等于任一（多值OR）</option>
                                <option value="not_contains">不包含</option>
                                <option value="not_equals">不等于</option>
                                <option value="is_empty">为空</option>
                                <option value="not_empty">不为空</option>
                            </select>
                            <input type="text" class="filter-value-input" placeholder="值（多值逗号分隔）" value=""
                                   style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; flex: 1; min-width: 150px;" disabled>
                            <button class="btn-remove-condition" onclick="removeFilterCondition(this)" style="padding: 4px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;" disabled>删除</button>
                        </div>
                    `}
                </div>

                <!-- 添加条件按钮 -->
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button id="btn_add_condition" onclick="addFilterCondition()" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;" ${config.filter_config && config.filter_config.enabled ? '' : 'disabled'}>+ 添加筛选条件</button>
                    <div style="font-size: 11px; color: #666;">
                        ${config.filter_config && config.filter_config.description ? config.filter_config.description : '在应用映射规则前，先对源数据进行筛选'}
                    </div>
                </div>
            </div>
        </div>

        <!-- 映射规则表格 -->
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #333;">字段映射规则</h4>
        </div>

        <div style="overflow-x: auto; border: 1px solid #e9ecef; border-radius: 6px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; width: 50px;">序号</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; width: 70px;">列号</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057;">目标字段名</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057;">
                            1. 操作类型<br>
                            <span style="font-size: 10px; color: #999; font-weight: normal;">(第1级)</span>
                        </th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057;">
                            2. 数据来源 + 配置<br>
                            <span style="font-size: 10px; color: #999; font-weight: normal;">(第2级)</span>
                        </th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057;">
                            3. 数据处理配置<br>
                            <span style="font-size: 10px; color: #999; font-weight: normal;">(第3级)</span>
                        </th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; width: 250px;">说明（可编辑）</th>
                    </tr>
                </thead>
                <tbody>
    `;

    config.mapping_rules.forEach((rule, index) => {
        // V3三层架构：推断操作类型
        const operationType = inferOperationFromSourceType(rule.source_type);

        html += `
            <tr style="border-bottom: 1px solid #e9ecef;" data-rule-index="${index}">
                <td style="padding: 10px; text-align: center; color: #666; font-weight: 500;">${index + 1}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600; color: ${categoryColor};">${rule.target_column}</td>
                <td style="padding: 10px;">
                    <input type="text" value="${rule.target_name}" data-field="target_name"
                        style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                    ${buildMappingRuleSourceBadge(rule)}
                </td>
                <td style="padding: 10px;">
                    <!-- 第1级：操作类型 -->
                    <select data-field="operation_type" onchange="onOperationTypeChange(this)"
                        style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                        <option value="read" ${operationType === 'read' ? 'selected' : ''}>直接读取</option>
                        <option value="calculate" ${operationType === 'calculate' ? 'selected' : ''}>条件计算</option>
                        <option value="lookup" ${operationType === 'lookup' ? 'selected' : ''}>跨表查询</option>
                    </select>
                </td>
                <td style="padding: 10px;">
                    <!-- 第2级：数据来源配置（由三层架构系统渲染，始终显示2个下拉框） -->
                    ${ThreeLayerArchitecture.renderSourceConfig(rule.source_type, rule, config)}
                </td>
                <td style="padding: 10px;">
                    ${generateDataProcessConfig(rule)}
                </td>
                <td style="padding: 10px;">
                    <textarea data-field="remarks" rows="3"
                        style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; line-height: 1.5; resize: vertical; min-height: 60px;"
                        placeholder="输入说明文字...">${rule.remarks || ThreeLayerArchitecture.generateRuleSummary(rule.source_type, rule, config) || ''}</textarea>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>

        <!-- 说明文档 -->
        <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">数据源类型说明</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">固定值 (fixed)</div>
                    <div style="font-size: 12px; color: #666;">直接使用source_value中的固定值</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">字段索引(数据概览) (field_index_assets)</div>
                    <div style="font-size: 12px; color: #666;">从数据概览表按数据库真实索引取值，索引 0 为 id</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">字段索引(合并结果) (field_index_merge_results)</div>
                    <div style="font-size: 12px; color: #666;">从合并结果表按数据库真实索引取值，索引 0 为 id，业务字段从 1 开始</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">自动序号 (sequence)</div>
                    <div style="font-size: 12px; color: #666;">自动生成递增序号</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">条件判断 (conditional)</div>
                    <div style="font-size: 12px; color: #666;">根据单个字段的条件返回不同的值</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">多字段条件 (multi_conditional)</div>
                    <div style="font-size: 12px; color: #666;">根据多个字段按AND/OR逻辑返回不同值（如：CRM+身份证→用户提供）</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">IP查询 (lookup_ip)</div>
                    <div style="font-size: 12px; color: #666;">通过IP从assets表查询关联数据</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">跨表查询 (vlookup_assets)</div>
                    <div style="font-size: 12px; color: #666;">通过某个字段值在数据概览表中查找并返回指定列的值</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">跨表查询+映射 (vlookup_assets_with_mapping)</div>
                    <div style="font-size: 12px; color: #666;">通过映射字典转换后，在数据概览表中查找并返回指定列的值</div>
                </div>
            </div>
        </div>
    `;
    }  // else 块结束

    container.innerHTML = html;
    mappingTableDirty = false;

    // 监听表格视图用户编辑，仅真实改动时标记未保存
    if (window.mappingViewMode === 'table') {
        const editableElements = container.querySelectorAll(
            'tbody input, tbody select, tbody textarea, #data_start_row_input, #filter_conditions_list input, #filter_conditions_list select, #filter_enabled, #filter_logic'
        );
        editableElements.forEach(el => {
            el.addEventListener('input', () => { mappingTableDirty = true; });
            el.addEventListener('change', () => { mappingTableDirty = true; });
        });
    }

    // 渲染完成后，动态更新字段计数
    console.log('[RENDER] 准备更新字段计数，dataSourceColumns长度:', indexedDataSourceColumns.length);
    if (indexedDataSourceColumns && indexedDataSourceColumns.length > 0) {
        const countSpan = document.getElementById('filter_columns_count');
        if (countSpan) {
            countSpan.textContent = `(${indexedDataSourceColumns.length} 个字段可选)`;
            console.log('[RENDER] 已更新字段计数为:', indexedDataSourceColumns.length);
        } else {
            console.log('[RENDER] 未找到filter_columns_count元素');
        }
    } else {
        console.log('[RENDER] dataSourceColumns为空或长度为0，无法更新');
    }
}

// 更新数据源类型选项
// 获取数据源类型对应的占位符
function getSourceTypePlaceholder(sourceType) {
    const placeholders = {
        'fixed': '固定值，如：湖北移动',
        'sequence': '自动生成，留空即可',
        'conditional': '条件判断字段名',
        'lookup_ip': 'IP字段名，如：数据源IP',
        'field_index_assets': '从数据概览表选择列',
        'field_index_merge_results': '从合并结果表选择列',
        // 兼容旧版本（统一为字段索引）
        'field_index': '从对应表选择列',
        'field_name': '从对应表选择列',
        'field_name_assets': '从数据概览表选择列',
        'field_name_merge_results': '从合并结果表选择列'
    };
    return placeholders[sourceType] || '根据类型填写';
}

// 编辑映射规则（简化版，直接在表格中编辑）
function editMappingRule(ruleIndex) {
    showToast('请直接在表格中编辑，然后点击"保存配置"按钮', false);
}

// 应用映射修改（重新渲染界面）

/**
 * 第1层操作类型改变时的处理（V3三层架构）
 */
function onOperationTypeChange(select) {
    const row = select.closest('tr');
    if (!row) return;

    const ruleIndex = parseInt(row.dataset.ruleIndex);
    const newOperationType = select.value;

    console.log('[V3] 操作类型改变:', newOperationType, ', 规则索引:', ruleIndex);

    if (currentMappingConfig && currentMappingConfig.mapping_rules[ruleIndex]) {
        const rule = currentMappingConfig.mapping_rules[ruleIndex];

        // 更新第2层数据源下拉框
        const sourceSelect = row.querySelector('select[data-field="source_type"]');
        if (sourceSelect) {
            // 生成新的选项（默认选中第一个）
            sourceSelect.innerHTML = generateSourceOptions(newOperationType, '');

            // 更新规则中的source_type为该操作类型下的第一个选项
            const sources = ThreeLayerArchitecture.getSourcesByOperation(newOperationType);
            const firstSourceId = Object.keys(sources)[0];
            const oldFirstSourceId = ThreeLayerArchitecture.convertToOldType(firstSourceId);
            rule.source_type = oldFirstSourceId;

            console.log('[V3] 自动选择第一个数据源:', oldFirstSourceId);

            // 触发change事件，更新第3列配置
            const event = new Event('change', { bubbles: true });
            sourceSelect.dispatchEvent(event);
        }
    }
}

/**
 * 第2层数据源类型改变时的处理（V3三层架构）
 */
function onSourceTypeChange(select) {
    // 当用户修改source_type时，动态更新配置列
    const row = select.closest('tr');
    if (!row) return;

    const ruleIndex = parseInt(row.dataset.ruleIndex);
    const newSourceType = select.value;

    // 更新当前规则
    if (currentMappingConfig && currentMappingConfig.mapping_rules[ruleIndex]) {
        const rule = currentMappingConfig.mapping_rules[ruleIndex];

        // 更新source_type
        rule.source_type = newSourceType;

        // 根据新类型，清空某些字段
        if (newSourceType === 'sequence') {
            delete rule.source_value;
            delete rule.transform;
            delete rule.conditions;
            delete rule.lookup_key;
            delete rule.lookup_field;
        }

        // 重新生成这两列的内容（使用三层架构系统）
        const dataSourceConfigCell = row.cells[4]; // 数据来源配置列
        const dataProcessConfigCell = row.cells[5]; // 数据处理配置列

        if (dataSourceConfigCell) {
            dataSourceConfigCell.innerHTML = ThreeLayerArchitecture.renderSourceConfig(
                newSourceType, rule, currentMappingConfig
            );
        }

        if (dataProcessConfigCell) {
            dataProcessConfigCell.innerHTML = ThreeLayerArchitecture.renderProcessConfig(
                newSourceType, rule
            );
        }

        console.log('[V3] 数据源类型已更新为:', newSourceType);
    }
}

// 筛选条件启用/禁用切换
function onFilterEnabledChange(checkbox) {
    const enabled = checkbox.checked;
    const logicSelect = document.getElementById('filter_logic');
    const dataSourceSelect = document.getElementById('filter_data_source_select');
    const addBtn = document.getElementById('btn_add_condition');

    // 启用/禁用所有条件输入
    document.querySelectorAll('#filter_conditions_list .filter-field-select').forEach(el => el.disabled = !enabled);
    document.querySelectorAll('#filter_conditions_list .filter-operator-select').forEach(el => el.disabled = !enabled);
    document.querySelectorAll('#filter_conditions_list .filter-value-input').forEach(el => el.disabled = !enabled);
    document.querySelectorAll('#filter_conditions_list .btn-remove-condition').forEach(el => el.disabled = !enabled);

    if (logicSelect) logicSelect.disabled = !enabled;
    if (dataSourceSelect) dataSourceSelect.disabled = !enabled;
    if (addBtn) addBtn.disabled = !enabled;
}

// 逻辑关系切换
function onFilterLogicChange(select) {
    // 可以在这里添加逻辑切换时的处理
    console.log('筛选逻辑改为:', select.value);
}

// 切换筛选数据源
async function onFilterDataSourceChange(select) {
    const newDataSource = select.value;
    const dataSourceName = newDataSource === 'assets' ? '数据概览' : '合并结果';

    if (!confirm(`切换到"${dataSourceName}表"将重置所有筛选条件，是否继续？`)) {
        // 恢复原选择
        select.value = currentMappingConfig.data_source || 'assets';
        return;
    }

    try {
        // 获取新数据源的列信息
        const res = await fetch(API_BASE + `/data-source-columns/${newDataSource}`);
        const result = await res.json();

        if (result.success && result.columns) {
            // 更新全局列信息
            window.currentDataSourceColumns = mergeDataSourceColumns(window.currentDataSourceColumns, {
                [newDataSource]: result.columns
            });
            const indexedColumns = getIndexedDataSourceColumns(newDataSource, currentMappingConfig, result.columns);

            // 更新字段计数显示
            const countSpan = document.getElementById('filter_columns_count');
            if (countSpan) {
                countSpan.textContent = `(${indexedColumns.length} 个字段可选)`;
            }

            // 更新所有条件行的字段下拉列表
            const fieldSelects = document.querySelectorAll('.filter-field-select');
            fieldSelects.forEach(fieldSelect => {
                // 保存当前选中值
                const currentValue = fieldSelect.value;

                // 重新生成选项
                fieldSelect.innerHTML = '<option value="">选择字段</option>' +
                    indexedColumns.map(col =>
                        `<option value="${col.index}">${col.display_name}</option>`
                    ).join('');

                // 尝试恢复选中值（如果新数据源也有该索引）
                if (currentValue !== '') {
                    fieldSelect.value = currentValue;
                }
            });

            showToast(`已切换到${dataSourceName}表`, false);
        } else {
            showToast('获取数据源列信息失败: ' + (result.error || '未知错误'), true);
        }
    } catch (e) {
        console.error('切换数据源失败:', e);
        showToast('切换数据源失败: ' + e.message, true);
    }
}

// 添加筛选条件
function addFilterCondition() {
    const conditionsList = document.getElementById('filter_conditions_list');
    const conditionCount = conditionsList.querySelectorAll('.filter-condition-row').length;
    const newConditionIndex = conditionCount;

    // 获取数据源列信息
    const dataSource = document.getElementById('filter_data_source_select')?.value || currentMappingConfig.data_source || 'assets';
    const availableColumns = getIndexedDataSourceColumns(dataSource, currentMappingConfig);
    const columnsOptions = availableColumns.map(col =>
        `<option value="${col.index}">${col.display_name}</option>`
    ).join('');

    const conditionHtml = `
        <div class="filter-condition-row" data-condition-index="${newConditionIndex}" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
            <div style="font-size: 12px; color: #666; min-width: 30px;">条件${newConditionIndex + 1}</div>
            <select class="filter-field-select" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; min-width: 180px; max-width: 250px;">
                <option value="" selected>选择字段</option>
                ${columnsOptions}
            </select>
            <select class="filter-operator-select" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; min-width: 140px;">
                <option value="contains">包含（单值）</option>
                <option value="contains_any">包含任一（多值OR）</option>
                <option value="contains_all">包含全部（多值AND）</option>
                <option value="equals">等于（单值）</option>
                <option value="in">等于任一（多值OR）</option>
                <option value="not_contains">不包含</option>
                <option value="not_equals">不等于</option>
                <option value="is_empty">为空</option>
                <option value="not_empty">不为空</option>
            </select>
            <input type="text" class="filter-value-input" placeholder="值（多值逗号分隔）" value=""
                   style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; flex: 1; min-width: 150px;">
            <button class="btn-remove-condition" onclick="removeFilterCondition(this)" style="padding: 4px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">删除</button>
        </div>
    `;

    conditionsList.insertAdjacentHTML('beforeend', conditionHtml);
    mappingTableDirty = true;
}

// 删除筛选条件
function removeFilterCondition(button) {
    const conditionRow = button.closest('.filter-condition-row');
    const conditionsList = document.getElementById('filter_conditions_list');
    const conditionRows = conditionsList.querySelectorAll('.filter-condition-row');

    // 至少保留一个条件
    if (conditionRows.length <= 1) {
        showToast('至少保留一个筛选条件', true);
        return;
    }

    conditionRow.remove();

    // 重新编号
    renumberConditions();
    mappingTableDirty = true;
}

// 重新编号条件
function renumberConditions() {
    const conditionsList = document.getElementById('filter_conditions_list');
    const conditionRows = conditionsList.querySelectorAll('.filter-condition-row');

    conditionRows.forEach((row, index) => {
        row.dataset.conditionIndex = index;
        row.querySelector('div').textContent = `条件${index + 1}`;
    });
}

function cloneMappingPackageValue(value) {
    if (value === undefined || value === null) {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
}

function buildCurrentMappingPackagePayload(serverPackage = {}) {
    const packagePayload = cloneMappingPackageValue(serverPackage) || {};
    const reportMeta = cloneMappingPackageValue(findReportingFile(currentMappingCategory, currentMappingReportCode) || {});
    const dynamicDefinitions = window.DynamicConfigQueryManager?.exportDefinitions?.() || null;

    packagePayload.package_type = packagePayload.package_type || 'report_mapping_package';
    packagePayload.version = packagePayload.version || '1.0';
    packagePayload.exported_at = new Date().toISOString();
    packagePayload.category = currentMappingCategory;
    packagePayload.requested_report_code = currentMappingReportCode;
    packagePayload.actual_report_code = currentMappingApiReportCode || currentMappingReportCode;
    packagePayload.mapping_config = cloneMappingPackageValue(currentMappingConfig || packagePayload.mapping_config || {});
    packagePayload.report_meta = Object.assign({}, packagePayload.report_meta || {}, reportMeta || {});
    packagePayload.frontend_dynamic_config_query = dynamicDefinitions;
    return packagePayload;
}

async function loadPersistedDynamicConfigQueryDefinitions() {
    if (!window.DynamicConfigQueryManager?.replaceDefinitions) {
        return false;
    }

    try {
        const response = await fetch(API_BASE + '/dynamic-config-query/definitions');
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || '动态配置查询定义加载失败');
        }

        const payload = result.data || {};
        const definitions = payload.definitions;
        if (!definitions || Object.keys(definitions).length === 0) {
            return false;
        }

        window.DynamicConfigQueryManager.replaceDefinitions(payload);
        return true;
    } catch (error) {
        console.error('加载动态配置查询定义失败:', error);
        return false;
    }
}

async function persistDynamicConfigQueryDefinitions(payload = null) {
    if (!window.DynamicConfigQueryManager?.exportDefinitions) {
        return null;
    }

    const exportPayload = cloneMappingPackageValue(payload || window.DynamicConfigQueryManager.exportDefinitions());
    const response = await fetch(API_BASE + '/dynamic-config-query/definitions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(exportPayload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || '动态配置查询定义保存失败');
    }
    return result.data || exportPayload;
}

async function fetchCurrentMappingPackageFromServer() {
    const targetReportCode = currentMappingApiReportCode || currentMappingReportCode;
    const response = await fetch(API_BASE + `/mapping-config/${encodeURIComponent(currentMappingCategory)}/${encodeURIComponent(targetReportCode)}/package`);
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || '获取报表包失败');
    }
    return result.data || {};
}

function normalizeImportedMappingPackage(rawPayload) {
    const packagePayload = rawPayload && typeof rawPayload === 'object' && rawPayload.data && typeof rawPayload.data === 'object'
        ? rawPayload.data
        : rawPayload;

    if (!packagePayload || typeof packagePayload !== 'object') {
        throw new Error('导入文件内容无效');
    }

    const mappingConfig = packagePayload.mapping_config || packagePayload.config;
    if (!mappingConfig || !Array.isArray(mappingConfig.mapping_rules)) {
        throw new Error('报表包缺少完整 mapping_config');
    }

    return {
        packagePayload,
        mappingConfig
    };
}

function applyImportedDynamicDefinitions(packagePayload) {
    const definitionsPayload = packagePayload.frontend_dynamic_config_query
        || packagePayload.dynamic_config_query
        || packagePayload.dynamic_definitions
        || (packagePayload.definitions ? packagePayload : null);

    if (!definitionsPayload || !window.DynamicConfigQueryManager?.importDefinitions) {
        return false;
    }

    window.DynamicConfigQueryManager.replaceDefinitions(definitionsPayload);
    return true;
}

// 导出映射配置
async function exportMappingConfig() {
    if (!currentMappingConfig) {
        showToast('没有可导出的配置', true);
        return;
    }

    try {
        if (mappingTableDirty) {
            const shouldSaveFirst = confirm('当前映射存在未保存修改，是否先保存再导出报表包？');
            if (!shouldSaveFirst) {
                showToast('已取消导出，请先处理未保存修改', true);
                return;
            }
            if (shouldSaveFirst) {
                const saved = await saveMappingConfig();
                if (!saved) {
                    return;
                }
            }
        }

        const serverPackage = await fetchCurrentMappingPackageFromServer();
        const exportData = buildCurrentMappingPackagePayload(serverPackage);
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `报表映射包_${currentMappingCategory}_${currentMappingReportCode}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('报表包已导出', false);
    } catch (err) {
        console.error('导出报表包失败:', err);
        showToast('导出失败: ' + err.message, true);
    }
}

// 导入映射配置
function importMappingConfig() {
    if (!currentMappingConfig) {
        showToast('没有当前配置，无法导入', true);
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            const { packagePayload, mappingConfig } = normalizeImportedMappingPackage(importData);
            const importedCategory = String(packagePayload.category || '').trim();
            const importedReportCode = String(
                packagePayload.actual_report_code
                || packagePayload.requested_report_code
                || packagePayload.report_code
                || ''
            ).trim();

            if (
                importedCategory
                && importedCategory !== currentMappingCategory
                && !confirm(`导入包来自分类“${importedCategory}”，当前分类是“${currentMappingCategory}”，是否继续载入到当前报表？`)
            ) {
                return;
            }

            if (
                importedReportCode
                && importedReportCode !== currentMappingReportCode
                && importedReportCode !== (currentMappingApiReportCode || '')
                && !confirm(`导入包来自报表“${importedReportCode}”，当前报表是“${currentMappingReportCode}”，是否继续载入到当前报表？`)
            ) {
                return;
            }

            if (!confirm(`该操作将覆盖当前报表“${currentMappingReportCode}”的完整映射配置，是否继续？`)) {
                return;
            }

            const importPayload = buildCurrentMappingPackagePayload(packagePayload);
            importPayload.mapping_config = cloneMappingPackageValue(mappingConfig);

            const response = await fetch(
                API_BASE + `/mapping-config/${encodeURIComponent(currentMappingCategory)}/${encodeURIComponent(currentMappingApiReportCode || currentMappingReportCode)}/package`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(importPayload)
                }
            );
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || '报表包写入失败');
            }

            currentMappingApiReportCode = result.data?.actual_report_code || currentMappingApiReportCode || currentMappingReportCode;
            currentMappingConfig = cloneMappingPackageValue(result.data?.mapping_config || mappingConfig);
            currentMappingConfig.category = currentMappingConfig.category || currentMappingCategory;
            if (!currentMappingConfig.name) {
                currentMappingConfig.name = packagePayload.report_meta?.name || currentMappingReportCode;
            }
            window.currentMappingConfigData = currentMappingConfig;
            applyImportedDynamicDefinitions(result.data?.dynamic_config_query || packagePayload);

            const resolvedDataSource = resolveEffectiveMappingDataSource(currentMappingConfig);
            const loadedColumnsBySource = await ensureMappingDataSourceColumns(
                resolvedDataSource === 'both' ? ['assets', 'merge_results'] : [resolvedDataSource]
            );
            const preferredColumns = loadedColumnsBySource[resolvedDataSource] || loadedColumnsBySource[currentMappingConfig.data_source] || [];

            renderMappingConfig(currentMappingConfig, preferredColumns, window.currentTemplateColumnsInfo || null);
            publicConfigCenterData = [];
            publicConfigCenterMap = {};
            mappingTableDirty = false;
            showToast('报表包已导入并写入服务器', false);
        } catch (err) {
            console.error('导入报表包失败:', err);
            showToast('导入失败: ' + err.message, true);
        }
    };

    input.click();
}

// 保存映射配置
async function saveMappingConfig() {
    if (!currentMappingConfig) {
        showToast('没有可保存的配置', true);
        return false;
    }

    if (window.mappingViewMode === 'code') {
        showToast('代码视图为只读，无法保存，请切换到表格视图修改。', true);
        return false;
    }

    // 收集修改后的数据
    const rows = document.querySelectorAll('#mappingConfigContent tbody tr');
    const newRules = [];

    rows.forEach(row => {
        const ruleIndex = parseInt(row.dataset.ruleIndex);
        const originalRule = currentMappingConfig.mapping_rules[ruleIndex];

        // 获取source_type（必须存在）
        const sourceTypeElem = row.querySelector('[data-field="source_type"]');
        if (!sourceTypeElem) {
            console.error('找不到source_type元素，跳过该行');
            return;
        }

        const rule = JSON.parse(JSON.stringify(originalRule || {}));
        rule.target_column = originalRule.target_column;
        rule.description = originalRule.description;
        rule.source_type = sourceTypeElem.value;

        const sourceValueElem = row.querySelector('[data-field="source_value"]');
        const transformElem = row.querySelector('[data-field="transform"]');
        const targetNameElem = row.querySelector('[data-field="target_name"]');

        if (sourceValueElem) rule.source_value = sourceValueElem.value;
        if (transformElem) rule.transform = transformElem.value;
        if (targetNameElem) rule.target_name = targetNameElem.value;

        // 处理条件判断的特殊字段
        if (rule.source_type === 'conditional') {
            const conditionsJson = row.querySelector('[data-field="conditions_json"]');
            const defaultValue = row.querySelector('[data-field="default_value"]');

            if (conditionsJson && conditionsJson.value) {
                try {
                    rule.conditions = JSON.parse(conditionsJson.value);
                } catch (e) {
                    console.error('解析conditions失败:', e);
                    rule.conditions = originalRule.conditions || [];
                }
            } else {
                rule.conditions = originalRule.conditions || [];
            }

            if (defaultValue && defaultValue.value !== '') {
                rule.default = defaultValue.value;
            } else {
                rule.default = originalRule.default !== undefined ? originalRule.default : '';
            }
        } else if (rule.source_type === 'multi_conditional') {
            // 处理多字段条件（从隐藏的配置字段读取）
            const configInput = row.querySelector('[data-field="multi_conditional_config"]');
            if (configInput && configInput.value) {
                try {
                    const config = JSON.parse(configInput.value);
                    rule.conditions = config.conditions || [];
                    rule.logic = config.logic || 'AND';
                    rule.result = config.result || '';
                    rule.default = config.default || '';
                } catch (e) {
                    console.error('解析多字段条件配置失败:', e);
                    // 如果解析失败，保留原有配置
                    rule.conditions = originalRule.conditions || [];
                    rule.logic = originalRule.logic || 'AND';
                    rule.result = originalRule.result || '';
                    rule.default = originalRule.default !== undefined ? originalRule.default : '';
                }
            } else {
                // 如果找不到配置字段，保留原有配置
                rule.conditions = originalRule.conditions || [];
                rule.logic = originalRule.logic || 'AND';
                rule.result = originalRule.result || '';
                rule.default = originalRule.default !== undefined ? originalRule.default : '';
            }
        } else if (rule.source_type === 'conditional_groups') {
            const groupsJson = row.querySelector('[data-field="groups_json"]');
            const groupLogic = row.querySelector('[data-field="group_logic"]');
            const defaultValue = row.querySelector('[data-field="default_value"]');

            if (groupsJson && groupsJson.value) {
                try {
                    rule.groups = JSON.parse(groupsJson.value);
                } catch (e) {
                    console.error('解析groups失败:', e);
                    rule.groups = originalRule.groups || [];
                }
            } else {
                rule.groups = originalRule.groups || [];
            }

            rule.group_logic = groupLogic && groupLogic.value ? groupLogic.value : (originalRule.group_logic || 'OR');
            if (defaultValue) {
                rule.default = defaultValue.value;
            }
        } else {
            if (originalRule.conditions) rule.conditions = originalRule.conditions;
            if (originalRule.default !== undefined) rule.default = originalRule.default;
        }

        // 保存remarks字段
        const remarksElem = row.querySelector('[data-field="remarks"]');
        if (remarksElem) {
            rule.remarks = remarksElem.value;
        } else if (originalRule.remarks) {
            rule.remarks = originalRule.remarks;
        }

        newRules.push(rule);
    });

    // 更新起始行配置
    const startRowInput = document.getElementById('data_start_row_input');
    if (startRowInput) {
        const newStartRow = parseInt(startRowInput.value);
        if (newStartRow >= 1 && newStartRow <= 100) {
            currentMappingConfig.data_start_row = newStartRow;
        } else {
            showToast('起始行必须是1-100之间的数字', true);
            return false;
        }
    }

    // 更新筛选条件配置
    const filterEnabled = document.getElementById('filter_enabled');
    const filterLogic = document.getElementById('filter_logic');

    if (filterEnabled && filterLogic) {
        if (filterEnabled.checked) {
            // 收集所有筛选条件
            const conditionRows = document.querySelectorAll('#filter_conditions_list .filter-condition-row');
            const conditions = [];

            conditionRows.forEach(row => {
                const fieldSelect = row.querySelector('.filter-field-select');
                const operatorSelect = row.querySelector('.filter-operator-select');
                const valueInput = row.querySelector('.filter-value-input');

                const rawFieldValue = (fieldSelect?.value || '').trim();
                const fieldIndex = rawFieldValue === '' ? NaN : parseInt(rawFieldValue, 10);
                const fieldName = fieldSelect?.options?.[fieldSelect.selectedIndex]?.text || '';
                const operator = operatorSelect?.value || 'contains';
                const rawValue = (valueInput?.value || '').trim();

                // 跳过完全空白的条件行，避免误拦截正常保存
                if (rawFieldValue === '' && rawValue === '') {
                    return;
                }

                // 未选择字段的行视为未完成配置，直接跳过，避免影响其它功能保存
                if (!Number.isFinite(fieldIndex)) {
                    return;
                }

                // 处理多值操作符
                const multiValueOperators = ['contains_any', 'contains_all', 'in'];
                let processedValue = rawValue;

                if (multiValueOperators.includes(operator)) {
                    // 将逗号分隔的字符串转换为数组
                    processedValue = rawValue.split(',')
                        .map(v => v.trim())
                        .filter(v => v !== '');
                }

                conditions.push({
                    field_index: fieldIndex,
                    field_name: fieldName.split(':')[1] ? fieldName.split(':')[1].trim() : fieldName,
                    operator: operator,
                    value: processedValue
                });
            });

            // 生成描述文字
            const logic = filterLogic.value;
            const logicText = logic === 'AND' ? '且' : '或';
            const conditionDescriptions = conditions.map(cond => {
                const operatorDisplayNames = {
                    'contains': '包含',
                    'contains_any': '包含任一',
                    'contains_all': '包含全部',
                    'equals': '等于',
                    'in': '等于任一',
                    'not_contains': '不包含',
                    'not_equals': '不等于',
                    'is_empty': '为空',
                    'not_empty': '不为空'
                };
                const operatorDisplayName = operatorDisplayNames[cond.operator] || cond.operator;
                const valueDisplay = Array.isArray(cond.value) ? `"${cond.value.join('" 或 "')}"` : `"${cond.value}"`;
                return `${cond.field_name}${operatorDisplayName}${valueDisplay}`;
            });
            const description = `只导出${conditionDescriptions.join(' ' + logicText + ' ')}的数据`;

            currentMappingConfig.filter_config = {
                enabled: true,
                logic: logic,
                conditions: conditions,
                description: description
            };
        } else {
            currentMappingConfig.filter_config = {
                enabled: false
            };
        }
    }

    // 更新配置
    currentMappingConfig.mapping_rules = newRules;

    try {
        const res = await fetch(API_BASE + `/mapping-config/${currentMappingCategory}/${currentMappingApiReportCode || currentMappingReportCode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentMappingConfig)
        });

        const result = await res.json();

        if (result.success) {
            showToast('映射配置保存成功！导出时将使用新配置', false);
            mappingTableDirty = false;
            return true;
        } else {
            showToast('保存失败: ' + result.error, true);
            return false;
        }
    } catch (e) {
        console.error('保存映射配置失败:', e);
        showToast('保存失败: ' + e.message, true);
        return false;
    }
}

// ==================== 工程文件管理 ====================

// 加载工程文件列表
// ==================== 工程文件管理 ====================

