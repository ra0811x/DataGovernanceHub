/**
 * 三层架构数据映射配置系统 V3
 *
 * 设计原则：
 * 1. 第1层：操作类型（Operation Type）- 决定做什么操作
 * 2. 第2层：数据源/逻辑配置（Source/Logic）- 决定从哪里获取或如何计算
 * 3. 第3层：详细配置（Details）- 具体的参数配置
 *
 * 兼容性：支持新旧配置格式的自动转换
 */

const ThreeLayerArchitecture = (function() {
    'use strict';

    const CONFIG_QUERY_BUTTON_STYLE = {
        background: '#005fe0',
        hover: '#0047b3'
    };

    function renderConfigQueryButtonHtml(onclick, options = {}) {
        const padding = options.padding || '10px 20px';
        const borderRadius = options.borderRadius || '6px';
        const fontSize = options.fontSize || '13px';
        const fontWeight = options.fontWeight || '600';
        const widthStyle = options.fullWidth ? ' width: 100%;' : '';

        return `
            <button type="button"
                onclick="${onclick}"
                style="padding: ${padding}; background: ${CONFIG_QUERY_BUTTON_STYLE.background}; color: white; border: none; border-radius: ${borderRadius}; font-size: ${fontSize}; cursor: pointer; transition: background 0.2s; font-weight: ${fontWeight};${widthStyle}"
                onmouseover="this.style.background='${CONFIG_QUERY_BUTTON_STYLE.hover}'"
                onmouseout="this.style.background='${CONFIG_QUERY_BUTTON_STYLE.background}'">
                配置查询
            </button>
        `;
    }

    function resolveEffectiveColumns(dataSource, config, providedColumns = null) {
        const rawColumns = Array.isArray(providedColumns)
            ? providedColumns
            : Array.isArray((window.currentDataSourceColumns || {})[dataSource])
                ? window.currentDataSourceColumns[dataSource]
                : [];

        if (typeof window.getIndexedDataSourceColumns === 'function') {
            const indexedColumns = window.getIndexedDataSourceColumns(dataSource, config, rawColumns) || [];
            if (Array.isArray(indexedColumns) && indexedColumns.length > 0) {
                return indexedColumns;
            }
        }

        return rawColumns.map((col, idx) => ({
            ...(col && typeof col === 'object' ? col : { name: col }),
            index: idx
        }));
    }

    function findColumnByFieldIndex(columns, fieldIndex) {
        return (columns || []).find(col => String(col?.index) === String(fieldIndex));
    }

    // ============================================
    // 第1层：操作类型定义
    // ============================================

    const OPERATION_TYPES = {
        'read': {
            name: '直接读取',
            description: '从数据源直接获取字段值或生成固定值',
            order: 1
        },
        'calculate': {
            name: '条件计算',
            description: '根据字段值进行条件判断，返回不同结果',
            order: 2
        },
        'lookup': {
            name: '跨表查询',
            description: '通过某个字段的值在其他表中查找关联数据',
            order: 3
        },
        'expand': {
            name: '多行展开',
            description: '一条源记录展开成多条记录，每条使用不同的值',
            order: 4
        }
    };

    // ============================================
    // 第2层：数据源/逻辑定义（按操作类型分组）
    // ============================================

    const SOURCE_TYPES = {
        // ==================== read 操作下的选项 ====================
        'sequence': {
            operation: 'read',
            id: 'sequence',
            oldId: 'sequence',
            category: 'basic',
            name: '自动序号',
            description: '自动生成1、2、3...的递增序号',
            shortName: '自动序号',
            icon: '123',
            color: '#6c757d'
        },
        'fixed': {
            operation: 'read',
            id: 'fixed',
            oldId: 'fixed',
            category: 'basic',
            name: '固定值',
            description: '每次都使用相同的固定文本或数字',
            shortName: '固定值',
            icon: 'pin',
            color: '#6c757d'
        },
        'field_asset': {
            operation: 'read',
            id: 'field_asset',
            oldId: 'field_index_assets',
            category: 'field',
            name: '字段提取（数据概览表）',
            description: '从数据概览表中提取指定列的值',
            shortName: '数据概览表',
            icon: 'table',
            color: '#005fe0'
        },
        'field_merge': {
            operation: 'read',
            id: 'field_merge',
            oldId: 'field_index_merge_results',
            category: 'field',
            name: '字段提取（合并结果表）',
            description: '从合并结果表中提取指定列的值',
            shortName: '合并结果表',
            icon: 'table',
            color: '#005fe0'
        },
        'data_sample_mapper': {
            operation: 'read',
            id: 'data_sample_mapper',
            oldId: 'data_sample_mapper',
            category: 'advanced',
            name: '数据样例映射',
            description: '根据数据名称从"数据分级标准样例"中自动获取数据样例（1-2级不处理、3级脱敏、4级加密）',
            shortName: '数据样例映射',
            icon: 'mask',
            color: '#9c27b0',
            version: '3.2'
        },
        'field_assets_dynamic': {
            operation: 'read',
            id: 'field_assets_dynamic',
            oldId: 'field_assets_dynamic',
            category: 'advanced',
            name: '字段提取+动态生成',
            description: '从数据源提取字段，并根据其他字段动态生成值',
            shortName: '字段提取+动态生成',
            icon: 'magic',
            color: '#9c27b0',
            version: '3.2'
        },

        // ==================== calculate 操作下的选项 ====================
        'conditional_single': {
            operation: 'calculate',
            id: 'conditional_single',
            oldId: 'conditional',
            category: 'conditional',
            name: '单字段条件',
            description: '根据一个字段的值进行条件判断，返回不同结果',
            shortName: '单字段条件',
            icon: 'if',
            color: '#ff9800'
        },
        'conditional_multi': {
            operation: 'calculate',
            id: 'conditional_multi',
            oldId: 'multi_conditional',
            category: 'conditional',
            name: '多字段条件组（OR逻辑）',
            description: '根据多个字段的值按逻辑关系进行判断，组内为AND逻辑，组间为OR逻辑',
            shortName: '多字段条件组',
            icon: 'if-else',
            color: '#ff9800',
            version: '3.2'
        },
        'column_value_count': {
            operation: 'calculate',
            id: 'column_value_count',
            oldId: 'column_value_count',
            category: 'calculate',
            name: '列值统计计数',
            description: '统计某列的值在整个数据集中出现的次数（如：统计"数据名称"列中每个值的出现次数）',
            shortName: '列值统计',
            icon: 'counter',
            color: '#4caf50',
            version: '3.3'
        },

        // ==================== lookup 操作下的选项 ====================
        'vlookup': {
            operation: 'lookup',
            id: 'vlookup',
            oldId: 'vlookup_assets',
            category: 'lookup',
            name: 'VLOOKUP跨表查询',
            description: '通过某个字段的值在数据概览表中查找并返回另一字段',
            shortName: 'VLOOKUP',
            icon: 'search',
            color: '#17a2b8'
        },
        'vlookup_with_mapping': {
            operation: 'lookup',
            id: 'vlookup_with_mapping',
            oldId: 'vlookup_assets_with_mapping',
            category: 'lookup',
            name: 'VLOOKUP跨表查询+映射',
            description: '先通过映射字典转换字段值，再在数据概览表中查找并返回另一字段',
            shortName: 'VLOOKUP+映射',
            icon: 'search-plus',
            color: '#17a2b8'
        },
        'ip_lookup': {
            operation: 'lookup',
            id: 'ip_lookup',
            oldId: 'lookup_ip',
            category: 'lookup',
            name: 'IP地址查询',
            description: '通过IP地址在数据概览表中查找相关信息',
            shortName: 'IP查询',
            icon: 'ip',
            color: '#17a2b8'
        },

        // ==================== expand 操作下的选项 ====================
        'multi_strategy_config': {
            operation: 'expand',
            id: 'multi_strategy_config',
            oldId: 'multi_strategy_config',
            category: 'advanced',
            name: '多策略展开配置',
            description: '配置多行展开策略规则，为每条源记录生成多条记录',
            shortName: '多策略展开',
            icon: 'layers',
            color: '#4caf50',
            version: '3.2'
        },
        'strategy_content_mapping': {
            operation: 'expand',
            id: 'strategy_content_mapping',
            oldId: 'strategy_content_mapping',
            category: 'advanced',
            name: '策略内容映射',
            description: '根据策略类型从展开规则中获取对应的内容描述',
            shortName: '策略内容映射',
            icon: 'document',
            color: '#4caf50',
            version: '3.2'
        }
    };

    // ============================================
    // 第3层：详细配置Schema
    // ============================================

    const CONFIG_SCHEMAS = {
        'sequence': {
            // 自动序号不需要配置
            fields: [],
            hasProcessConfig: false
        },

        'fixed': {
            fields: [
                {
                    name: 'source_value',
                    type: 'text',
                    label: '固定值',
                    placeholder: '不填则单元格为空，可手动输入内容',
                    required: true
                }
            ],
            hasProcessConfig: false
        },

        'field_asset': {
            fields: [
                {
                    name: 'source_value',
                    type: 'field_select',
                    dataSource: 'assets',
                    label: '选择字段',
                    placeholder: '从数据概览表中选择列',
                    required: true
                }
            ],
            hasProcessConfig: true,
            processConfigFields: [
                {
                    name: 'transform',
                    type: 'select',
                    label: '数据处理方式',
                    options: [
                        { value: '', label: '不转换（原样输出）' },
                        { value: 'split_before_slash', label: '取 / 前部分' },
                        { value: 'remove_ip_brackets', label: '去除IP标识' }
                    ],
                    required: false
                }
            ]
        },

        'field_assets_with_transform': {
            fields: [
                {
                    name: 'source_value',
                    type: 'field_select',
                    dataSource: 'assets',
                    label: '选择字段',
                    placeholder: '从数据概览表中选择列',
                    required: true
                }
            ],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示简洁提示
                const sourceValue = rule.source_value || '';
                const conditions = rule.conditions || [];
                const defaultVal = rule.default || '';

                const dataSource = 'assets';
                const allColumns = window.currentDataSourceColumns || {};
                const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                const indexedColumns = typeof window.getIndexedDataSourceColumns === 'function'
                    ? (window.getIndexedDataSourceColumns(dataSource, null, columns) || [])
                    : [];
                const effectiveColumns = indexedColumns.length > 0
                    ? indexedColumns
                    : columns.map((col, idx) => ({
                        ...(col && typeof col === 'object' ? col : { name: col }),
                        index: idx
                    }));
                const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                const colName = col ? (col.name || col) : `索引${sourceValue}`;

                return `
                    <input type="hidden" data-field="source_value" value="${sourceValue}">
                    <input type="hidden" data-field="conditions_json" value='${JSON.stringify(conditions)}'>
                    <input type="hidden" data-field="default_value" value="${defaultVal}">

                    <div style="padding: 8px 10px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #005fe0;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="padding: 2px 6px; background: #005fe0; color: white; border-radius: 3px; font-size: 10px; font-weight: 600;">字段+转换</div>
                            <div style="font-size: 11px; color: #333;">提取【${colName}】</div>
                            <div style="font-size: 10px; color: #666; margin-left: auto;">${conditions.length}条规则</div>
                        </div>
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：只显示"配置查询"按钮
                return renderConfigQueryButtonHtml('openSingleConditionalModal(event)');
            }
        },

        'field_merge': {
            fields: [
                {
                    name: 'source_value',
                    type: 'field_select',
                    dataSource: 'merge_results',
                    label: '选择字段',
                    placeholder: '从合并结果表中选择列',
                    required: true
                }
            ],
            hasProcessConfig: true,
            processConfigFields: [
                {
                    name: 'transform',
                    type: 'select',
                    label: '数据处理方式',
                    options: [
                        { value: '', label: '不转换（原样输出）' },
                        { value: 'split_before_slash', label: '取 / 前部分' },
                        { value: 'remove_ip_brackets', label: '去除IP标识' }
                    ],
                    required: false
                }
            ]
        },

        'field_merge_with_transform': {
            fields: [
                {
                    name: 'source_value',
                    type: 'field_select',
                    dataSource: 'merge_results',
                    label: '选择字段',
                    placeholder: '从合并结果表中选择列',
                    required: true
                }
            ],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示简洁提示
                const sourceValue = rule.source_value || '';
                const conditions = rule.conditions || [];
                const defaultVal = rule.default || '';

                const dataSource = 'merge_results';
                const allColumns = window.currentDataSourceColumns || {};
                const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
                const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                const colName = col ? (col.name || col) : `索引${sourceValue}`;

                return `
                    <input type="hidden" data-field="source_value" value="${sourceValue}">
                    <input type="hidden" data-field="conditions_json" value='${JSON.stringify(conditions)}'>
                    <input type="hidden" data-field="default_value" value="${defaultVal}">

                    <div style="padding: 8px 10px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #005fe0;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="padding: 2px 6px; background: #005fe0; color: white; border-radius: 3px; font-size: 10px; font-weight: 600;">字段+转换</div>
                            <div style="font-size: 11px; color: #333;">提取【${colName}】</div>
                            <div style="font-size: 10px; color: #666; margin-left: auto;">${conditions.length}条规则</div>
                        </div>
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：只显示"配置查询"按钮
                return renderConfigQueryButtonHtml('openSingleConditionalModal(event)');
            }
        },

        'conditional_single': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示摘要
                return renderConditionalSingleSummary(rule, config);
            },
            customRenderProcess: function(rule, config) {
                // 第3级：显示配置按钮
                return renderConditionalSingleButton(rule, config);
            }
        },

        'conditional_multi': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级只显示摘要
                return renderConditionalMultiSummary(rule, config);
            },
            customRenderProcess: function(rule, config) {
                // 第3级显示配置按钮
                return renderConditionalMultiButton(rule, config);
            }
        },

        'column_value_count': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：显示统计配置摘要
                const sourceValue = rule.source_value || '';
                const remarks = rule.remarks || rule.description || '';

                const dataSource = (config && config.data_source) || 'merge_results';
                const allColumns = window.currentDataSourceColumns || {};
                const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
                const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                const colName = col ? (col.name || col) : `索引${sourceValue}`;

                return `
                    <input type="hidden" data-field="source_value" value="${sourceValue}">
                    <div style="font-size: 12px; color: #495057; line-height: 1.5;">
                        <strong style="color: #4caf50;">列值统计：</strong>统计【${colName}】列中每个值在数据集中的出现次数
                        ${remarks ? `<br><span style="color: #6c757d;">${remarks}</span>` : ''}
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：显示配置按钮
                return renderConfigQueryButtonHtml('openColumnValueCountModal(event)');
            }
        },

        'vlookup': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示摘要
                const lookupKey = rule.lookup_key || '';
                const lookupField = rule.lookup_field || '';
                const remarks = rule.remarks || rule.description || '';

                const dataSource = (config && config.data_source) || 'merge_results';
                const allColumns = window.currentDataSourceColumns || {};
                const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                const keyCol = columns[lookupKey];
                const keyColName = keyCol ? (keyCol.name || keyCol) : `索引${lookupKey}`;

                const assetsColumns = Array.isArray(allColumns.assets) ? allColumns.assets : [];
                const returnCol = assetsColumns[lookupField];
                const returnColName = returnCol ? (returnCol.name || returnCol) : `索引${lookupField}`;

                return `
                    <input type="hidden" data-field="lookup_key" value="${lookupKey}">
                    <input type="hidden" data-field="lookup_field" value="${lookupField}">
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：显示配置按钮
                return renderConfigQueryButtonHtml('openVlookupModal(event)');
            }
        },

        'vlookup_with_mapping': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示摘要
                const lookupKey = rule.lookup_key || '';
                const lookupField = rule.lookup_field || '';
                const useMapping = rule.use_mapping || false;
                const mappingConfig = rule.mapping_config || '';
                const remarks = rule.remarks || rule.description || '';

                const dataSource = (config && config.data_source) || 'merge_results';
                const allColumns = window.currentDataSourceColumns || {};
                const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                const keyCol = columns[lookupKey];
                const keyColName = keyCol ? (keyCol.name || keyCol) : `索引${lookupKey}`;

                const assetsColumns = Array.isArray(allColumns.assets) ? allColumns.assets : [];
                const returnCol = assetsColumns[lookupField];
                const returnColName = returnCol ? (returnCol.name || returnCol) : `索引${lookupField}`;

                return `
                    <input type="hidden" data-field="lookup_key" value="${lookupKey}">
                    <input type="hidden" data-field="lookup_field" value="${lookupField}">
                    <input type="hidden" data-field="use_mapping" value="${useMapping}">
                    <input type="hidden" data-field="mapping_config" value="${mappingConfig}">
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：显示配置按钮
                return renderConfigQueryButtonHtml('openVlookupModal(event, true)');
            }
        },

        'ip_lookup': {
            fields: [
                {
                    name: 'source_value',
                    type: 'field_select',
                    dataSource: 'merge_results',
                    label: 'IP字段',
                    placeholder: '选择包含IP地址的字段',
                    required: true,
                    hint: '如：数据源IP'
                },
                {
                    name: 'lookup_field',
                    type: 'text',
                    label: '返回字段名称',
                    placeholder: '如：所属系统类型（文字）',
                    required: true,
                    hint: '指定要返回的字段名称'
                }
            ],
            hasProcessConfig: false
        },

        'multi_strategy': {
            fields: [],
            hasProcessConfig: false,
            customRender: function(rule, config) {
                // 获取展开规则
                const expansionRules = (config && config.expansion_rules) || {};
                const rulesList = Object.entries(expansionRules).map(([key, r]) => ({
                    key: key,
                    gColumn: r.g_column || key,
                    hColumn: r.h_column || '',
                    hasFilter: !!r.filter_condition
                }));

                return `
                    <div style="padding: 12px; background: linear-gradient(135deg, #fff3e0 0%, #fffaf5 100%); border-radius: 6px; border-left: 3px solid #ff9800;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <div style="padding: 3px 8px; background: #ff9800; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">展开规则</div>
                            <div style="font-size: 13px; font-weight: 600; color: #e65100;">为每条源记录生成${rulesList.length}条记录</div>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 10px; line-height: 1.5;">
                            根据以下策略类型展开，每条源记录生成对应的导出记录
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rulesList.map(r => `
                                <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: white; border-radius: 4px; border-left: 2px solid #ff9800;">
                                    <div style="padding: 2px 6px; background: #fff3e0; color: #e65100; border-radius: 3px; font-size: 11px; font-weight: 600;">${r.key}</div>
                                    <div style="font-size: 12px; color: #333; font-weight: 500;">${r.gColumn}</div>
                                    ${r.hasFilter ? `<div style="margin-left: auto; padding: 2px 6px; background: #fff9c4; color: #f57f17; border-radius: 3px; font-size: 10px;">有条件</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                return `
                    <div style="padding: 16px; background: #f8f9fa; border-radius: 6px; text-align: center; color: #6c757d; font-size: 13px;">
                        策略值由展开规则自动生成
                    </div>
                `;
            }
        },

        'conditional_content': {
            fields: [],
            hasProcessConfig: false,
            customRender: function(rule, config) {
                // 获取展开规则
                const expansionRules = (config && config.expansion_rules) || {};
                const rulesList = Object.entries(expansionRules).map(([key, r]) => ({
                    key: key,
                    gColumn: r.g_column || key,
                    hColumn: r.h_column || ''
                }));

                return `
                    <div style="padding: 12px; background: linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%); border-radius: 6px; border-left: 3px solid #4caf50;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <div style="padding: 3px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">动态内容</div>
                            <div style="font-size: 13px; font-weight: 600; color: #2e7d32;">根据G列策略类型获取内容</div>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 10px; line-height: 1.5;">
                            根据G列显示的策略类型，从展开规则中获取对应的内容描述：
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${rulesList.map(r => `
                                <div style="padding: 6px 10px; background: white; border-radius: 4px; border-left: 2px solid #4caf50;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                        <div style="padding: 2px 6px; background: #e8f5e9; color: #2e7d32; border-radius: 3px; font-size: 11px; font-weight: 600;">${r.gColumn}</div>
                                    </div>
                                    <div style="font-size: 11px; color: #666; line-height: 1.4;">${r.hColumn.substring(0, 80)}${r.hColumn.length > 80 ? '...' : ''}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                return `
                    <div style="padding: 16px; background: #f8f9fa; border-radius: 6px; text-align: center; color: #6c757d; font-size: 13px;">
                        内容根据G列策略类型从展开规则中自动匹配
                    </div>
                `;
            }
        },

        'field_assets_dynamic': {
            fields: [
                {
                    name: 'source_value',
                    type: 'field_select',
                    dataSource: 'assets',
                    label: '选择字段',
                    placeholder: '从数据概览表中选择列',
                    required: true
                },
                {
                    name: 'reference_column',
                    type: 'text',
                    label: '参考字段',
                    placeholder: '例如：D列（业务系统）',
                    required: false,
                    hint: '用于动态生成的参考字段'
                }
            ],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：显示字段选择和参考字段
                const sourceValue = rule.source_value || '';
                const referenceColumn = rule.reference_column || '';

                return `
                    <input type="hidden" data-field="source_value" value="${sourceValue}">
                    <input type="hidden" data-field="reference_column" value="${referenceColumn}">
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：只显示"配置查询"按钮
                return renderConfigQueryButtonHtml(
                    'openDynamicGenerationModal(event)',
                    { padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }
                );
            }
        },

        'multi_strategy_config': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示简单提示
                return `
                    <div style="padding: 12px; background: linear-gradient(135deg, #fff3e0 0%, #fffaf5 100%); border-radius: 6px; border-left: 3px solid #ff9800;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="padding: 3px 8px; background: #ff9800; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">多行展开</div>
                            <div style="font-size: 12px; color: #e65100;">根据展开规则生成多条记录</div>
                        </div>
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：只显示"配置查询"按钮
                return renderConfigQueryButtonHtml(
                    'openExpansionRulesModal(event)',
                    { padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }
                );
            }
        },

        'strategy_content_mapping': {
            fields: [],
            hasProcessConfig: true,
            processConfigFields: [],
            customRender: function(rule, config) {
                // 第2级：只显示简单提示
                return `
                    <div style="padding: 12px; background: linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%); border-radius: 6px; border-left: 3px solid #4caf50;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="padding: 3px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">策略映射</div>
                            <div style="font-size: 12px; color: #2e7d32;">根据G列策略类型获取内容</div>
                        </div>
                    </div>
                `;
            },
            customRenderProcess: function(rule, config) {
                // 第3级：只显示"配置查询"按钮
                return renderConfigQueryButtonHtml(
                    'openExpansionRulesModal(event)',
                    { padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }
                );
            }
        },

        'data_sample_mapper': {
            fields: [
                {
                    name: 'name_column_index',
                    type: 'text',
                    label: '数据名称列索引',
                    placeholder: '数据名称所在的列索引（如6或7）',
                    required: true,
                    hint: '从合并结果表中提取数据名称的列索引'
                }
            ],
            hasProcessConfig: false,
            customRender: function(rule, config) {
                // 第2级：显示配置预览
                const nameColIndex = rule.name_column_index || rule.name_column_index || '未设置';
                return `
                    <div style="padding: 12px; background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 6px; border-left: 3px solid #9c27b0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <div style="padding: 3px 8px; background: #9c27b0; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">数据样例映射</div>
                            <div style="font-size: 12px; color: #6a1b9a;">根据数据名称自动从"数据分级标准样例"获取样例</div>
                        </div>
                        <div style="font-size: 11px; color: #7b1fa2; padding-left: 4px; margin-bottom: 4px;">
                            <span style="color: #666;">数据名称列索引:</span> ${nameColIndex}
                        </div>
                        <div style="font-size: 10px; color: #999; padding-left: 4px; border-top: 1px solid #e0e0e0; padding-top: 4px; margin-top: 4px;">
                            <strong>处理规则:</strong> 1-2级不处理 | 3级脱敏 | 4级加密
                        </div>
                    </div>
                `;
            }
        }
    };

    // ============================================
    // 兼容性映射
    // ============================================

    /**
     * 新类型ID -> 旧类型ID映射（用于保存配置）
     * 只包含实际使用的12种核心规则类型
     */
    const NEW_TO_OLD_MAPPING = {
        // 基础类型
        'sequence': 'sequence',
        'fixed': 'fixed',
        // 字段取值
        'field_asset': 'field_index_assets',
        'field_merge': 'field_index_merge_results',
        'data_sample_mapper': 'data_sample_mapper',
        'field_assets_dynamic': 'field_assets_dynamic',
        // 条件判断
        'conditional_single': 'conditional',
        'conditional_multi': 'conditional_groups',
        // 查询类型
        'vlookup': 'vlookup_assets',
        'vlookup_with_mapping': 'vlookup_assets_with_mapping',
        'ip_lookup': 'lookup_ip',
        // 高级类型
        'multi_strategy_config': 'multi_strategy_config',
        'strategy_content_mapping': 'strategy_content_mapping'
    };

    /**
     * 旧类型ID -> 新类型ID映射（用于加载配置）
     */
    const OLD_TO_NEW_MAPPING = {
        // 基础类型
        'sequence': 'sequence',
        'fixed': 'fixed',
        // 字段取值
        'field_index_assets': 'field_asset',
        'field_index_merge_results': 'field_merge',
        'data_sample_mapper': 'data_sample_mapper',
        'field_assets_dynamic': 'field_assets_dynamic',
        // 条件判断
        'conditional': 'conditional_single',
        'conditional_groups': 'conditional_multi',
        'multi_conditional': 'conditional_multi',
        // 查询类型
        'vlookup_assets': 'vlookup',
        'vlookup_assets_with_mapping': 'vlookup_with_mapping',
        'lookup_ip': 'ip_lookup',
        // 高级类型
        'multi_strategy_config': 'multi_strategy_config',
        'strategy_content_mapping': 'strategy_content_mapping',

        // 以下类型为兼容旧配置保留
        'multi_strategy': 'multi_strategy_config',
        'conditional_content': 'strategy_content_mapping',
        'field_merge_with_transform': 'field_merge',
        'field_assets_with_transform': 'field_asset'
    };

    // ============================================
    // 渲染函数
    // ============================================

    function renderField(fieldConfig, rule, config) {
        const value = rule[fieldConfig.name] !== undefined ? rule[fieldConfig.name] : '';

        switch (fieldConfig.type) {
            case 'text':
                return `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fieldConfig.label ? `<label style="font-size: 12px; color: #495057; font-weight: 600;">${fieldConfig.label}</label>` : ''}
                        <input type="text"
                               data-field="${fieldConfig.name}"
                               value="${value}"
                               placeholder="${fieldConfig.placeholder || ''}"
                               ${fieldConfig.required ? 'required' : ''}
                               style="width: 100%; padding: 8px 12px; border: 1px solid ${fieldConfig.required ? '#005fe0' : '#ddd'}; border-radius: 4px; font-size: 13px;">
                        ${fieldConfig.hint ? `<div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${fieldConfig.hint}</div>` : ''}
                    </div>
                `;

            case 'number':
                return `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fieldConfig.label ? `<label style="font-size: 12px; color: #495057; font-weight: 600;">${fieldConfig.label}</label>` : ''}
                        <input type="number"
                               data-field="${fieldConfig.name}"
                               value="${value}"
                               placeholder="${fieldConfig.placeholder || ''}"
                               ${fieldConfig.required ? 'required' : ''}
                               style="width: 100%; padding: 8px 12px; border: 1px solid ${fieldConfig.required ? '#005fe0' : '#ddd'}; border-radius: 4px; font-size: 13px;">
                        ${fieldConfig.hint ? `<div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${fieldConfig.hint}</div>` : ''}
                    </div>
                `;

            case 'textarea':
                return `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fieldConfig.label ? `<label style="font-size: 12px; color: #495057; font-weight: 600;">${fieldConfig.label}</label>` : ''}
                        <textarea data-field="${fieldConfig.name}"
                                  placeholder="${fieldConfig.placeholder || ''}"
                                  rows="${fieldConfig.rows || 3}"
                                  ${fieldConfig.required ? 'required' : ''}
                                  style="width: 100%; padding: 8px 12px; border: 1px solid ${fieldConfig.required ? '#005fe0' : '#ddd'}; border-radius: 4px; font-size: 12px; font-family: monospace; line-height: 1.5; resize: vertical;">${value}</textarea>
                        ${fieldConfig.hint ? `<div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${fieldConfig.hint}</div>` : ''}
                    </div>
                `;

            case 'select':
                const options = fieldConfig.options.map(opt =>
                    `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fieldConfig.label ? `<label style="font-size: 12px; color: #495057; font-weight: 600;">${fieldConfig.label}</label>` : ''}
                        <select data-field="${fieldConfig.name}"
                                ${fieldConfig.required ? 'required' : ''}
                                style="width: 100%; padding: 8px 12px; border: 1px solid ${fieldConfig.required ? '#005fe0' : '#ddd'}; border-radius: 4px; font-size: 13px;">
                            ${options}
                        </select>
                        ${fieldConfig.hint ? `<div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${fieldConfig.hint}</div>` : ''}
                    </div>
                `;

            case 'field_select':
                const dataSource = fieldConfig.dataSource || 'assets';
                const allColumns = window.currentDataSourceColumns || {};
                const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);

                if (effectiveColumns.length === 0) {
                    return `<div style="padding: 10px; background: #fff3cd; border-radius: 4px; text-align: center; color: #856404; font-size: 12px;">[字段列表加载失败，请刷新页面重试]</div>`;
                }

                const columnOptions = effectiveColumns.map((col, idx) => {
                    const parsedOptionIndex = Number.parseInt(col.index, 10);
                    const optionValue = Number.isNaN(parsedOptionIndex) ? idx : parsedOptionIndex;
                    const colLabel = String.fromCharCode(65 + idx);
                    const colName = col.name || col.field_name || String(col);
                    const displayText = col.display_name || `索引${optionValue} (${colLabel}列)：${colName}`;
                    const isSelected = String(value) === String(optionValue) ? 'selected' : '';
                    return `<option value="${optionValue}" ${isSelected}>${displayText}</option>`;
                }).join('');

                return `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fieldConfig.label ? `<label style="font-size: 12px; color: #495057; font-weight: 600;">${fieldConfig.label}</label>` : ''}
                        <select data-field="${fieldConfig.name}"
                                ${fieldConfig.required ? 'required' : ''}
                                style="width: 100%; padding: 8px 12px; border: 1px solid ${fieldConfig.required ? '#005fe0' : '#ddd'}; border-radius: 4px; font-size: 13px;">
                            <option value="">-- 选择字段 --</option>
                            ${columnOptions}
                        </select>
                        <div style="font-size: 11px; color: #6c757d; margin-top: 2px;">从${dataSource === 'assets' ? '数据概览' : '合并结果'}表中选择列</div>
                        ${fieldConfig.hint ? `<div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${fieldConfig.hint}</div>` : ''}
                    </div>
                `;

            case 'button':
                return `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${fieldConfig.label ? `<label style="font-size: 12px; color: #495057; font-weight: 600;">${fieldConfig.label}</label>` : ''}
                        <button type="button"
                                onclick="${fieldConfig.onClick}"
                                style="padding: 10px 16px; background: #005fe0; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: background 0.2s; font-weight: 500;"
                                onmouseover="this.style.background='#0047b3'"
                                onmouseout="this.style.background='#005fe0'">
                            ${fieldConfig.buttonText}
                        </button>
                        ${fieldConfig.hint ? `<div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${fieldConfig.hint}</div>` : ''}
                    </div>
                `;

            case 'hidden':
                return `<input type="hidden" data-field="${fieldConfig.name}" value="${value}">`;

            default:
                return `<input type="text" data-field="${fieldConfig.name}" value="${value}" style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">`;
        }
    }

    function renderFields(fieldConfigs, rule, config) {
        if (!fieldConfigs || fieldConfigs.length === 0) {
            return '';
        }
        return fieldConfigs.map(fieldConfig => renderField(fieldConfig, rule, config)).join('');
    }

    // 特殊渲染函数
    function renderConditionalSingleSummary(rule, config) {
        // 第2级：只显示简洁提示，详细配置在第3级
        const conditions = rule.conditions || [];
        const sourceValue = rule.source_value || '';
        const defaultVal = rule.default || '';

        // 获取字段名称
        const dataSource = (config && config.data_source) || 'merge_results';
        const allColumns = window.currentDataSourceColumns || {};
        const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
        const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
        const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
        const colName = col ? (col.name || col) : `索引${sourceValue}`;

        return `
            <input type="hidden" data-field="single_cond_data" value="${sourceValue}">
            <input type="hidden" data-field="conditions_json" value='${JSON.stringify(conditions)}'>
            <input type="hidden" data-field="default_value" value="${defaultVal}">

            <div style="padding: 8px 10px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #ff9800;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="padding: 2px 6px; background: #ff9800; color: white; border-radius: 3px; font-size: 10px; font-weight: 600;">条件判断</div>
                    <div style="font-size: 11px; color: #333;">判断【${colName}】</div>
                    <div style="font-size: 10px; color: #666; margin-left: auto;">${conditions.length}条规则 | 默认：${defaultVal || '(空)'}</div>
                </div>
            </div>
        `;
    }

    function renderConditionalSingleButton(rule, config) {
        // 第3级：只显示配置按钮
        return renderConfigQueryButtonHtml('openSingleConditionalModal(event)');
    }

    function renderConditionalMultiSummary(rule, config) {
        // 第2级：只显示简洁提示，详细配置在第3级
        const conditions = rule.conditions || [];
        const logic = rule.logic || 'AND';
        const result = rule.result || '';
        const defaultVal = rule.default || '';

        return `
            <input type="hidden" id="multi_cond_config" data-field="multi_conditional_config"
                   value='${JSON.stringify({conditions, logic, result, default: defaultVal})}'>

            <div style="padding: 8px 10px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #ff9800;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="padding: 2px 6px; background: #ff9800; color: white; border-radius: 3px; font-size: 10px; font-weight: 600;">多字段条件</div>
                    <div style="font-size: 11px; color: #333;">${conditions.length}个条件 | ${logic === 'AND' ? '且' : '或'}逻辑</div>
                    <div style="font-size: 10px; color: #666; margin-left: auto;">返回：${result || '(未设置)'} | 默认：${defaultVal || '(空)'}</div>
                </div>
            </div>
        `;
    }

    function renderConditionalMultiButton(rule, config) {
        // 第3级：只显示配置按钮
        return renderConfigQueryButtonHtml('openMultiConditionalModal(event)');
    }

    // ============================================
    // 公共API
    // ============================================

    return {
        /**
         * 获取所有操作类型（第1层）
         */
        getOperations: function() {
            return OPERATION_TYPES;
        },

        /**
         * 获取指定操作下的所有数据源（第2层）
         */
        getSourcesByOperation: function(operationType) {
            return Object.entries(SOURCE_TYPES)
                .filter(([id, source]) => source.operation === operationType)
                .reduce((acc, [id, source]) => {
                    acc[id] = source;
                    return acc;
                }, {});
        },

        /**
         * 获取指定数据源的配置Schema（第3层）
         */
        getSchema: function(sourceType) {
            // 兼容旧类型ID
            const newSourceType = OLD_TO_NEW_MAPPING[sourceType] || sourceType;
            return CONFIG_SCHEMAS[newSourceType] || { fields: [], hasProcessConfig: false };
        },

        /**
         * 将旧类型ID转换为新类型ID
         */
        convertToNewType: function(oldType) {
            return OLD_TO_NEW_MAPPING[oldType] || oldType;
        },

        /**
         * 将新类型ID转换为旧类型ID（用于保存）
         */
        convertToOldType: function(newType) {
            return NEW_TO_OLD_MAPPING[newType] || newType;
        },

        /**
         * 推断操作类型（根据旧类型ID）
         */
        inferOperationFromSourceType: function(oldSourceType) {
            const newSourceType = this.convertToNewType(oldSourceType);
            const source = SOURCE_TYPES[newSourceType];
            return source ? source.operation : null;
        },

        /**
         * 渲染"数据来源配置"列（第2级）
         * 统一格式：始终显示2个下拉框
         */
        renderSourceConfig: function(sourceType, rule, config) {
            const newSourceType = OLD_TO_NEW_MAPPING[sourceType] || sourceType;
            const schema = SOURCE_TYPES[newSourceType];
            const operation = schema ? schema.operation : 'read';

            // 判断是否需要隐藏字段（复杂类型）
            const isComplexType = ['conditional_single', 'conditional_multi',
                                   'field_assets_with_transform', 'field_merge_with_transform',
                                   'vlookup', 'vlookup_with_mapping',
                                   'field_assets_dynamic', 'multi_strategy_config',
                                   'strategy_content_mapping', 'data_sample_mapper',
                                   'column_value_count'].includes(newSourceType);

            // 第2个下拉框是否禁用
            const secondDisabled = isComplexType ? 'disabled' : '';

            return `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <!-- 第1个下拉框：数据源类型 -->
                    <div>
                        <label style="font-size: 11px; color: #666; font-weight: 500; display: block; margin-bottom: 4px;">
                            数据源类型
                        </label>
                        <select data-field="source_type" onchange="onSourceTypeChange(this)"
                            style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            ${this._getSourceTypeOptions(operation, sourceType)}
                        </select>
                    </div>

                    <!-- 第2个下拉框：具体配置 -->
                    <div>
                        <label style="font-size: 11px; color: #666; font-weight: 500; display: block; margin-bottom: 4px;">
                            ${this._getSecondSelectLabel(newSourceType, rule, config)}
                        </label>
                        ${this._renderSecondSelect(newSourceType, rule, config, secondDisabled)}
                    </div>

                    <!-- 隐藏字段：存储复杂类型的配置 -->
                    ${this._renderHiddenFields(newSourceType, rule)}
                </div>
            `;
        },

        /**
         * 获取第1个下拉框的选项（数据源类型）
         */
        _getSourceTypeOptions: function(operation, currentSourceType) {
            const sources = this.getSourcesByOperation(operation);
            return Object.entries(sources).map(([id, source]) => {
                const oldTypeId = NEW_TO_OLD_MAPPING[id] || id;
                const selected = currentSourceType === oldTypeId ? 'selected' : '';
                return `<option value="${oldTypeId}" ${selected}>${source.name} - ${source.description}</option>`;
            }).join('');
        },

        /**
         * 获取第2个下拉框的标签
         */
        _getSecondSelectLabel: function(newSourceType, rule, config) {
            const labels = {
                'sequence': '自动序号（无需配置）',
                'fixed': '固定值',
                'field_asset': '选择字段（数据概览）',
                'field_merge': '选择字段（合并结果）',
                'conditional_single': '条件判断（点击右侧配置）',
                'conditional_multi': '多字段条件（点击右侧配置）',
                'vlookup': '跨表查询（点击右侧配置）',
                'vlookup_with_mapping': '跨表查询+映射（点击右侧配置）',
                'ip_lookup': 'IP查询配置（点击右侧配置）',
                'field_assets_dynamic': '动态生成（点击右侧配置）',
                'field_assets_with_transform': '字段+转换（点击右侧配置）',
                'field_merge_with_transform': '字段+转换（点击右侧配置）',
                'multi_strategy_config': '多行展开（点击右侧配置）',
                'strategy_content_mapping': '策略映射（点击右侧配置）',
                'data_sample_mapper': '样例映射（点击右侧配置）',
                'column_value_count': '统计列选择（点击右侧配置）'
            };
            return labels[newSourceType] || '配置项';
        },

        /**
         * 渲染第2个下拉框
         */
        _renderSecondSelect: function(newSourceType, rule, config, disabled = '') {
            const disabledAttr = disabled ? 'disabled style="background: #f5f5f5; cursor: not-allowed;"' : '';

            // 固定值类型
            if (newSourceType === 'fixed') {
                const value = rule.source_value || '';
                return `<input type="text" data-field="source_value" value="${value}"
                    placeholder="输入固定值" ${disabledAttr}
                    style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">`;
            }

            // 序号类型
            if (newSourceType === 'sequence') {
                return `<input type="text" value="自动生成1、2、3..." disabled
                    style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; background: #f5f5f5; cursor: not-allowed;">`;
            }

            // 字段选择类型
            if (newSourceType === 'field_asset' || newSourceType === 'field_merge') {
                const dataSource = newSourceType === 'field_asset' ? 'assets' : 'merge_results';
                const sourceValue = rule.source_value || '';
                return this._renderFieldSelect(dataSource, sourceValue, disabledAttr);
            }

            // 复杂类型：显示提示信息
            const hints = {
                'conditional_single': '单字段条件判断，根据字段值返回不同结果',
                'conditional_multi': '多字段条件组判断，组内AND、组间OR',
                'vlookup': '通过某字段值在数据概览表查询并返回另一字段',
                'vlookup_with_mapping': '先映射转换，再查询返回',
                'ip_lookup': '通过IP地址查询相关信息',
                'field_assets_dynamic': '根据参考字段动态生成内容',
                'field_assets_with_transform': '提取字段+条件转换',
                'field_merge_with_transform': '提取字段+条件转换',
                'multi_strategy_config': '配置多行展开策略',
                'strategy_content_mapping': '根据策略类型获取内容',
                'data_sample_mapper': '根据数据名称获取样例',
                'column_value_count': '统计某列的值在数据集中出现的次数'
            };
            return `<input type="text" value="${hints[newSourceType] || '请点击右侧按钮配置'}" disabled
                style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; background: #f5f5f5; cursor: not-allowed;">`;
        },

        /**
         * 渲染字段选择下拉框
         */
        _renderFieldSelect: function(dataSource, selectedValue, disabledAttr) {
            const allColumns = window.currentDataSourceColumns || {};
            const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
            const effectiveColumns = resolveEffectiveColumns(dataSource, null, columns);

            const options = effectiveColumns.map((col, idx) => {
                const parsedOptionIndex = Number.parseInt(col.index, 10);
                const optionValue = Number.isNaN(parsedOptionIndex) ? idx : parsedOptionIndex;
                const isSelected = String(optionValue) === String(selectedValue) ? 'selected' : '';
                return `<option value="${optionValue}" ${isSelected}>${col.name || col}</option>`;
            }).join('');

            return `<select data-field="source_value" ${disabledAttr}
                style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                <option value="">-- 选择字段 --</option>
                ${options}
            </select>`;
        },

        /**
         * 渲染隐藏字段（存储复杂类型的配置）
         */
        _renderHiddenFields: function(newSourceType, rule) {
            const conditions = rule.conditions || [];
            const sourceValue = rule.source_value || '';
            const defaultVal = rule.default || '';

            let fields = '';

            // 条件类型
            if (newSourceType === 'conditional_single') {
                fields = `
                    <input type="hidden" data-field="single_cond_data" value="${sourceValue}">
                    <input type="hidden" data-field="conditions_json" value='${JSON.stringify(conditions)}'>
                    <input type="hidden" data-field="default_value" value="${defaultVal}">`;
            } else if (newSourceType === 'conditional_multi') {
                const logic = rule.logic || 'AND';
                const result = rule.result || '';
                fields = `
                    <input type="hidden" id="multi_cond_config" data-field="multi_conditional_config"
                           value='${JSON.stringify({conditions, logic, result, default: defaultVal})}'>`;
            } else if (newSourceType === 'field_assets_with_transform' || newSourceType === 'field_merge_with_transform') {
                fields = `
                    <input type="hidden" data-field="source_value" value="${sourceValue}">
                    <input type="hidden" data-field="conditions_json" value='${JSON.stringify(conditions)}'>
                    <input type="hidden" data-field="default_value" value="${defaultVal}">`;
            }

            return fields;
        },

        /**
         * 渲染"数据处理配置"列（第3级）
         * 根据是否复杂条件判断显示"配置查询"按钮或"不需要处理"
         */
        renderProcessConfig: function(sourceType, rule, config) {
            const newSourceType = OLD_TO_NEW_MAPPING[sourceType] || sourceType;

            // 需要显示"配置查询"按钮的复杂类型
            const complexTypes = [
                'conditional_single',
                'conditional_multi',
                'field_assets_with_transform',
                'field_merge_with_transform',
                'vlookup',
                'vlookup_with_mapping',
                'ip_lookup',
                'field_assets_dynamic',
                'multi_strategy_config',
                'strategy_content_mapping',
                'data_sample_mapper',
                'column_value_count'
            ];

            if (complexTypes.includes(newSourceType)) {
                return this._renderConfigButton(newSourceType);
            }

            // 简单类型：不需要处理
            return `
                <div style="padding: 16px; background: #f8f9fa; border-radius: 6px; text-align: center; color: #6c757d; font-size: 13px;">
                    不需要处理
                </div>
            `;
        },

        /**
         * 渲染配置查询按钮
         */
        _renderConfigButton: function(newSourceType) {
            const buttonConfigs = {
                'conditional_single': { onclick: 'openSingleConditionalModal(event)' },
                'conditional_multi': { onclick: 'openMultiConditionalModal(event)' },
                'field_assets_with_transform': { onclick: 'openSingleConditionalModal(event)' },
                'field_merge_with_transform': { onclick: 'openSingleConditionalModal(event)' },
                'vlookup': { onclick: 'openVlookupModal(event)' },
                'vlookup_with_mapping': { onclick: 'openVlookupModal(event, true)' },
                'ip_lookup': { onclick: 'openIpLookupModal(event)' },
                'field_assets_dynamic': { onclick: 'openDynamicGenerationModal(event)' },
                'multi_strategy_config': { onclick: 'openExpansionRulesModal(event)' },
                'strategy_content_mapping': { onclick: 'openExpansionRulesModal(event)' },
                'data_sample_mapper': { onclick: 'openDataSampleMapperModal(event)' },
                'column_value_count': { onclick: 'openColumnValueCountModal(event)' }
            };

            const config = buttonConfigs[newSourceType] || { onclick: '' };
            return renderConfigQueryButtonHtml(config.onclick, { fullWidth: true });
        },

        /**
         * 加深颜色（用于hover效果）
         */
        _darkenColor: function(hex) {
            const colorMap = {
                '#005fe0': '#0047b3',
                '#0047b3': '#0047b3'
            };
            return colorMap[hex] || hex;
        },

        /**
         * 生成规则摘要（用于说明列）
         */
        generateRuleSummary: function(sourceType, rule, config) {
            const newSourceType = OLD_TO_NEW_MAPPING[sourceType] || sourceType;

            // 根据不同类型生成摘要
            switch(newSourceType) {
                case 'conditional_single': {
                    const conditions = rule.conditions || [];
                    const sourceValue = rule.source_value || '';
                    const defaultVal = rule.default || '';

                    const dataSource = (config && config.data_source) || 'merge_results';
                    const allColumns = window.currentDataSourceColumns || {};
                    const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                    const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
                    const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                    const colName = col ? (col.name || col) : `索引${sourceValue}`;

                    const summary = conditions.slice(0, 3).map(cond => {
                        const matchText = cond.match ? cond.match.substring(0, 15) + (cond.match.length > 15 ? '...' : '') : '';
                        return `"${matchText}"→${cond.result || '未设置'}`;
                    }).join('， ');

                    return `单字段条件：判断【${colName}】，${summary || '未配置'}${conditions.length > 3 ? ` 等${conditions.length}条` : ''}，默认：${defaultVal || '(空)'}`;
                }

                case 'conditional_multi': {
                    const conditions = rule.conditions || [];
                    const logic = rule.logic || 'AND';
                    const result = rule.result || '';
                    const defaultVal = rule.default || '';

                    const dataSource = (config && config.data_source) || 'merge_results';
                    const allColumns = window.currentDataSourceColumns || {};
                    const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                    const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);

                    const summary = conditions.slice(0, 3).map((cond) => {
                        const col = findColumnByFieldIndex(effectiveColumns, cond.field_index);
                        const colName = col ? (col.name || col) : `索引${cond.field_index}`;
                        return `${colName}包含"${cond.match}"`;
                    }).join(logic === 'AND' ? ' 且 ' : ' 或 ');

                    return `多字段条件：${summary || '未配置'}${conditions.length > 3 ? ` 等${conditions.length}个条件` : ''}，匹配返回：${result || '(未设置)'}，默认：${defaultVal || '(空)'}`;
                }

                case 'vlookup': {
                    const lookupKey = rule.lookup_key || '';
                    const lookupField = rule.lookup_field || '';
                    const defaultVal = rule.default || '';

                    const allColumns = window.currentDataSourceColumns || {};

                    // 获取查找键字段名称（从合并结果表）
                    const mergeColumns = Array.isArray(allColumns.merge_results) ? allColumns.merge_results : [];
                    const indexedMergeColumns = resolveEffectiveColumns('merge_results', config, mergeColumns);
                    const keyCol = findColumnByFieldIndex(indexedMergeColumns, lookupKey);
                    const keyColName = keyCol ? (keyCol.name || keyCol) : `索引${lookupKey}`;

                    // 获取返回字段名称（从数据概览表）
                    const assetsColumns = Array.isArray(allColumns.assets) ? allColumns.assets : [];
                    const indexedAssetsColumns = resolveEffectiveColumns('assets', config, assetsColumns);
                    const returnCol = findColumnByFieldIndex(indexedAssetsColumns, lookupField);
                    const returnColName = returnCol ? (returnCol.name || returnCol) : `索引${lookupField}`;

                    return `VLOOKUP查询：用【${keyColName}】的值在数据概览表匹配，返回【${returnColName}】${defaultVal ? `，默认：${defaultVal}` : ''}`;
                }

                case 'vlookup_with_mapping': {
                    const lookupKey = rule.lookup_key || '';
                    const lookupField = rule.lookup_field || '';
                    const useMapping = rule.use_mapping || false;
                    const mappingConfig = rule.mapping_config || '';
                    const defaultVal = rule.default || '';

                    const allColumns = window.currentDataSourceColumns || {};

                    // 获取查找键字段名称（从合并结果表）
                    const mergeColumns = Array.isArray(allColumns.merge_results) ? allColumns.merge_results : [];
                    const indexedMergeColumns = resolveEffectiveColumns('merge_results', config, mergeColumns);
                    const keyCol = findColumnByFieldIndex(indexedMergeColumns, lookupKey);
                    const keyColName = keyCol ? (keyCol.name || keyCol) : `索引${lookupKey}`;

                    // 获取返回字段名称（从数据概览表）
                    const assetsColumns = Array.isArray(allColumns.assets) ? allColumns.assets : [];
                    const indexedAssetsColumns = resolveEffectiveColumns('assets', config, assetsColumns);
                    const returnCol = findColumnByFieldIndex(indexedAssetsColumns, lookupField);
                    const returnColName = returnCol ? (returnCol.name || returnCol) : `索引${lookupField}`;

                    const mappingText = useMapping ? `先通过【${mappingConfig}】映射转换，` : '';

                    return `VLOOKUP查询+映射：${mappingText}用【${keyColName}】的值在数据概览表匹配，返回【${returnColName}】${defaultVal ? `，默认：${defaultVal}` : ''}`;
                }

                case 'ip_lookup': {
                    const sourceValue = rule.source_value || '';
                    const lookupField = rule.lookup_field || '';

                    return `IP查询：通过【${sourceValue}】在数据概览表查找，返回【${lookupField}】的值`;
                }

                case 'multi_strategy': {
                    const remarks = rule.remarks || rule.description || '';
                    return `多策略展开：${remarks || '根据展开规则生成多条记录，每条使用不同的策略类型'}`;
                }

                case 'conditional_content': {
                    const remarks = rule.remarks || rule.description || '';
                    return `动态内容：${remarks || '根据G列策略类型从展开规则中获取对应的内容描述'}`;
                }

                case 'field_assets_dynamic': {
                    const sourceValue = rule.source_value || '';
                    const referenceColumn = rule.reference_column || '';
                    const remarks = rule.remarks || rule.description || '';

                    const dataSource = 'assets';
                    const allColumns = window.currentDataSourceColumns || {};
                    const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                    const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
                    const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                    const colName = col ? (col.name || col) : `索引${sourceValue}`;

                    return `字段提取+动态生成：提取【${colName}】，根据${referenceColumn}列动态生成。${remarks}`;
                }

                case 'multi_strategy_config': {
                    const remarks = rule.remarks || rule.description || '';
                    return `多行展开配置：${remarks || '根据展开规则生成多条记录，每条使用不同的策略类型'}`;
                }

                case 'strategy_content_mapping': {
                    const remarks = rule.remarks || rule.description || '';
                    return `策略内容映射：${remarks || '根据G列策略类型从展开规则中获取对应的内容描述'}`;
                }

                case 'data_sample_mapper': {
                    const nameColIndex = rule.name_column_index || rule.name_column_index || '未设置';
                    return `数据样例映射：根据数据名称（列索引${nameColIndex}）从"数据分级标准样例"获取样例（1-2级不处理、3级脱敏、4级加密）`;
                }

                case 'column_value_count': {
                    const sourceValue = rule.source_value || '';
                    const remarks = rule.remarks || rule.description || '';

                    const dataSource = (config && config.data_source) || 'merge_results';
                    const allColumns = window.currentDataSourceColumns || {};
                    const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                    const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
                    const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                    const colName = col ? (col.name || col) : `索引${sourceValue}`;

                    return `列值统计：统计【${colName}】列中每个值在数据集中的出现次数${remarks ? `（${remarks}）` : ''}`;
                }

                case 'field_merge_with_transform':
                case 'field_assets_with_transform': {
                    const conditions = rule.conditions || [];
                    const sourceValue = rule.source_value || '';
                    const defaultVal = rule.default || '';

                    const dataSource = newSourceType === 'field_merge_with_transform' ? 'merge_results' : 'assets';
                    const allColumns = window.currentDataSourceColumns || {};
                    const columns = Array.isArray(allColumns[dataSource]) ? allColumns[dataSource] : [];
                    const effectiveColumns = resolveEffectiveColumns(dataSource, config, columns);
                    const col = findColumnByFieldIndex(effectiveColumns, sourceValue);
                    const colName = col ? (col.name || col) : `索引${sourceValue}`;

                    const summary = conditions.slice(0, 2).map(cond => {
                        const matchText = cond.match ? cond.match.substring(0, 15) + (cond.match.length > 15 ? '...' : '') : '';
                        return `"${matchText}"→${cond.result || '未设置'}`;
                    }).join('，');

                    return `字段提取+转换：提取【${colName}】，${summary || '未配置条件'}${conditions.length > 2 ? ` 等${conditions.length}条` : ''}，默认：${defaultVal || '(空)'}`;
                }

                default:
                    return '';
            }
        }
    };
})();

// 导出到全局
window.ThreeLayerArchitecture = ThreeLayerArchitecture;
